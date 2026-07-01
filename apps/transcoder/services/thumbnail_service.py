import asyncio
import os
import subprocess
import math
from pathlib import Path
from PIL import Image
import logging

logger = logging.getLogger(__name__)

THUMBNAIL_WIDTH = 1280
THUMBNAIL_HEIGHT = 720
THUMBNAIL_FORMAT = "JPEG"
THUMBNAIL_QUALITY = 85


class ThumbnailService:
    """
    Generates thumbnails from video at strategic timestamps.
    Uses FFmpeg for frame extraction, PIL for image optimization.
    """

    @staticmethod
    async def generate_thumbnails(
        input_path: str,
        output_dir: str,
        duration: float,
        count: int = 5,
    ) -> list[dict]:
        """
        Generate `count` thumbnails from strategic timestamps.
        Avoids first and last 5% of video (often black frames).

        Returns list of: { path, timestamp, url_key }
        """
        os.makedirs(output_dir, exist_ok=True)
        results = []

        # Calculate timestamps spread across 10%–90% of video
        start = duration * 0.10
        end = duration * 0.90
        step = (end - start) / max(count - 1, 1)
        timestamps = [start + i * step for i in range(count)]

        for i, ts in enumerate(timestamps):
            output_path = os.path.join(output_dir, f"thumb_{i:02d}.jpg")

            cmd = [
                "ffmpeg", "-y",
                "-ss", str(ts),
                "-i", input_path,
                "-vframes", "1",
                "-vf", f"scale={THUMBNAIL_WIDTH}:{THUMBNAIL_HEIGHT}:force_original_aspect_ratio=decrease,pad={THUMBNAIL_WIDTH}:{THUMBNAIL_HEIGHT}:(ow-iw)/2:(oh-ih)/2:black",
                "-q:v", "2",
                output_path,
            ]

            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            _, stderr = await proc.communicate()

            if proc.returncode != 0 or not os.path.exists(output_path):
                logger.warning(f"Thumbnail generation failed at {ts:.1f}s: {stderr.decode()[:200]}")
                continue

            # Optimize with PIL
            optimized_path = await ThumbnailService._optimize_thumbnail(output_path)

            results.append({
                "path": optimized_path,
                "timestamp": round(ts, 1),
                "index": i,
                "file_size": os.path.getsize(optimized_path),
            })

        return results

    @staticmethod
    async def _optimize_thumbnail(path: str) -> str:
        """Optimize thumbnail size while maintaining quality."""
        try:
            with Image.open(path) as img:
                # Convert to RGB (handles RGBA, palette images)
                if img.mode != "RGB":
                    img = img.convert("RGB")

                # Resize if larger than target
                if img.width > THUMBNAIL_WIDTH or img.height > THUMBNAIL_HEIGHT:
                    img.thumbnail((THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT), Image.LANCZOS)

                # Save optimized
                img.save(path, THUMBNAIL_FORMAT, quality=THUMBNAIL_QUALITY, optimize=True)
        except Exception as e:
            logger.warning(f"Thumbnail optimization failed: {e}")

        return path

    @staticmethod
    async def generate_sprite_sheet(
        input_path: str,
        output_path: str,
        duration: float,
        interval: int = 10,
        thumb_width: int = 160,
        thumb_height: int = 90,
    ) -> dict:
        """
        Generate a sprite sheet for video timeline preview (hover thumbnails).
        Creates one image with thumbnails arranged in a grid.
        """
        count = max(1, int(duration / interval))
        cols = min(10, count)
        rows = math.ceil(count / cols)

        sprite_dir = os.path.dirname(output_path)
        os.makedirs(sprite_dir, exist_ok=True)

        # Generate individual frames
        frames_dir = os.path.join(sprite_dir, "frames_tmp")
        os.makedirs(frames_dir, exist_ok=True)

        cmd = [
            "ffmpeg", "-y",
            "-i", input_path,
            "-vf", f"fps=1/{interval},scale={thumb_width}:{thumb_height}:force_original_aspect_ratio=decrease",
            "-q:v", "5",
            os.path.join(frames_dir, "frame%04d.jpg"),
        ]

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await proc.communicate()

        # Combine frames into sprite sheet
        frame_files = sorted(Path(frames_dir).glob("frame*.jpg"))
        if not frame_files:
            return {}

        sprite_width = cols * thumb_width
        sprite_height = rows * thumb_height
        sprite = Image.new("RGB", (sprite_width, sprite_height), (0, 0, 0))

        for i, frame_file in enumerate(frame_files[:count]):
            try:
                with Image.open(frame_file) as frame_img:
                    col = i % cols
                    row = i // cols
                    x = col * thumb_width
                    y = row * thumb_height
                    frame_img = frame_img.resize((thumb_width, thumb_height), Image.LANCZOS)
                    sprite.paste(frame_img, (x, y))
            except Exception as e:
                logger.warning(f"Failed to add frame {i} to sprite: {e}")

        sprite.save(output_path, "JPEG", quality=80, optimize=True)

        # Cleanup temp frames
        import shutil
        shutil.rmtree(frames_dir, ignore_errors=True)

        return {
            "path": output_path,
            "cols": cols,
            "rows": rows,
            "thumb_width": thumb_width,
            "thumb_height": thumb_height,
            "interval": interval,
            "total_frames": len(frame_files),
        }

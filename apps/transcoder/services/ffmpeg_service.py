import asyncio
import os
import subprocess
import json
import tempfile
import shutil
from pathlib import Path
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# Quality presets for HLS transcoding
QUALITY_PRESETS = {
    "1080p": {"width": 1920, "height": 1080, "bitrate": "5000k", "audio_bitrate": "192k", "crf": 22},
    "720p":  {"width": 1280, "height": 720,  "bitrate": "2800k", "audio_bitrate": "128k", "crf": 23},
    "480p":  {"width": 854,  "height": 480,  "bitrate": "1400k", "audio_bitrate": "128k", "crf": 24},
    "360p":  {"width": 640,  "height": 360,  "bitrate": "800k",  "audio_bitrate": "96k",  "crf": 26},
}

HLS_SEGMENT_DURATION = 6  # seconds


class FFmpegService:
    """
    Handles all FFmpeg operations:
    - Video probing (metadata extraction)
    - Multi-quality HLS transcoding
    - Adaptive bitrate master playlist generation
    """

    @staticmethod
    async def probe_video(input_path: str) -> dict:
        """Extract video metadata using ffprobe."""
        cmd = [
            "ffprobe", "-v", "quiet",
            "-print_format", "json",
            "-show_streams", "-show_format",
            input_path
        ]
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(f"ffprobe failed: {stderr.decode()}")

        data = json.loads(stdout.decode())
        video_stream = next(
            (s for s in data.get("streams", []) if s["codec_type"] == "video"), None
        )
        audio_stream = next(
            (s for s in data.get("streams", []) if s["codec_type"] == "audio"), None
        )

        duration = float(data.get("format", {}).get("duration", 0))
        width = int(video_stream.get("width", 0)) if video_stream else 0
        height = int(video_stream.get("height", 0)) if video_stream else 0
        codec = video_stream.get("codec_name", "unknown") if video_stream else "unknown"
        fps_str = video_stream.get("r_frame_rate", "0/1") if video_stream else "0/1"

        # Parse FPS fraction (e.g., "30000/1001" → 29.97)
        fps = 0.0
        if "/" in fps_str:
            num, den = fps_str.split("/")
            fps = round(int(num) / max(int(den), 1), 2)

        return {
            "duration": round(duration),
            "width": width,
            "height": height,
            "fps": fps,
            "codec": codec,
            "has_audio": audio_stream is not None,
            "file_size": int(data.get("format", {}).get("size", 0)),
            "bitrate": int(data.get("format", {}).get("bit_rate", 0)),
        }

    @staticmethod
    def _determine_qualities(width: int, height: int, target_qualities: list[str]) -> list[str]:
        """Only transcode to qualities ≤ source resolution."""
        resolution_map = {
            "1080p": 1080, "720p": 720, "480p": 480, "360p": 360
        }
        return [
            q for q in target_qualities
            if q in QUALITY_PRESETS and resolution_map.get(q, 0) <= height
        ] or ["360p"]  # Always produce at least 360p

    @staticmethod
    async def transcode_to_hls(
        input_path: str,
        output_dir: str,
        target_qualities: list[str],
        video_info: dict,
        progress_callback=None,
    ) -> dict:
        """
        Transcode video to multi-quality HLS with a master playlist.

        Output structure:
          output_dir/
            master.m3u8          ← Master playlist (ABR)
            1080p/
              playlist.m3u8      ← Quality playlist
              seg000.ts
              seg001.ts ...
            720p/
              playlist.m3u8
              ...
        """
        os.makedirs(output_dir, exist_ok=True)

        applicable_qualities = FFmpegService._determine_qualities(
            video_info["width"], video_info["height"], target_qualities
        )

        quality_results = []

        for i, quality in enumerate(applicable_qualities):
            preset = QUALITY_PRESETS[quality]
            quality_dir = os.path.join(output_dir, quality)
            os.makedirs(quality_dir, exist_ok=True)

            logger.info(f"Transcoding to {quality}: {preset['bitrate']}")

            # Scale filter: maintain aspect ratio, ensure even dimensions
            vf_scale = f"scale=w={preset['width']}:h={preset['height']}:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2"

            cmd = [
                "ffmpeg", "-y",
                "-i", input_path,
                "-vf", vf_scale,
                "-c:v", "libx264",
                "-crf", str(preset["crf"]),
                "-preset", "faster",          # Balance speed vs compression
                "-profile:v", "main",
                "-level", "4.0",
                "-sc_threshold", "0",          # No scene-change keyframes
                "-g", str(HLS_SEGMENT_DURATION * 30),  # GOP = segment_duration * fps
                "-keyint_min", str(HLS_SEGMENT_DURATION * 30),
                "-hls_time", str(HLS_SEGMENT_DURATION),
                "-hls_playlist_type", "vod",
                "-hls_segment_filename", os.path.join(quality_dir, "seg%03d.ts"),
                "-hls_flags", "independent_segments",
                "-c:a", "aac",
                "-b:a", preset["audio_bitrate"],
                "-ar", "48000",
                "-ac", "2",
                os.path.join(quality_dir, "playlist.m3u8"),
            ]

            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            _, stderr = await proc.communicate()

            if proc.returncode != 0:
                error_msg = stderr.decode()
                logger.error(f"FFmpeg failed for {quality}: {error_msg}")
                raise RuntimeError(f"Transcoding failed for {quality}: {error_msg[:500]}")

            # Count output segments
            segment_files = list(Path(quality_dir).glob("seg*.ts"))
            total_size = sum(f.stat().st_size for f in segment_files)

            quality_results.append({
                "label": quality,
                "resolution": f"{preset['width']}x{preset['height']}",
                "bitrate": int(preset["bitrate"].replace("k", "")) * 1000,
                "audio_bitrate": preset["audio_bitrate"],
                "segment_count": len(segment_files),
                "file_size": total_size,
                "hls_playlist_path": os.path.join(quality_dir, "playlist.m3u8"),
            })

            if progress_callback:
                progress = 20 + int((i + 1) / len(applicable_qualities) * 60)
                await progress_callback(progress)

        # Generate master playlist
        master_path = os.path.join(output_dir, "master.m3u8")
        await FFmpegService._write_master_playlist(master_path, applicable_qualities)

        return {
            "qualities": quality_results,
            "master_playlist_path": master_path,
            "applicable_qualities": applicable_qualities,
        }

    @staticmethod
    async def _write_master_playlist(master_path: str, qualities: list[str]) -> None:
        """Write HLS master playlist referencing all quality streams."""
        lines = ["#EXTM3U", "#EXT-X-VERSION:3", ""]

        for quality in sorted(
            qualities,
            key=lambda q: int(q.replace("p", "")),
            reverse=True,
        ):
            preset = QUALITY_PRESETS[quality]
            bandwidth = int(preset["bitrate"].replace("k", "")) * 1000
            audio_bandwidth = int(preset["audio_bitrate"].replace("k", "")) * 1000
            total_bandwidth = bandwidth + audio_bandwidth
            resolution = f"{preset['width']}x{preset['height']}"
            codecs = "avc1.4d401f,mp4a.40.2"

            lines.append(
                f'#EXT-X-STREAM-INF:BANDWIDTH={total_bandwidth},'
                f'RESOLUTION={resolution},'
                f'CODECS="{codecs}",'
                f'NAME="{quality}"'
            )
            lines.append(f"{quality}/playlist.m3u8")
            lines.append("")

        with open(master_path, "w") as f:
            f.write("\n".join(lines))

    @staticmethod
    async def extract_audio(input_path: str, output_path: str) -> None:
        """Extract audio track from video (for waveform generation)."""
        cmd = [
            "ffmpeg", "-y", "-i", input_path,
            "-vn", "-acodec", "libmp3lame", "-ab", "128k",
            output_path
        ]
        proc = await asyncio.create_subprocess_exec(*cmd,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        await proc.communicate()

    @staticmethod
    async def get_video_duration(input_path: str) -> float:
        """Quick duration check without full probe."""
        cmd = [
            "ffprobe", "-v", "quiet", "-show_entries", "format=duration",
            "-of", "csv=p=0", input_path
        ]
        proc = await asyncio.create_subprocess_exec(*cmd,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        stdout, _ = await proc.communicate()
        try:
            return float(stdout.decode().strip())
        except ValueError:
            return 0.0

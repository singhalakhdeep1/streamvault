import asyncio
import os
import tempfile
import shutil
import logging
import httpx
from pathlib import Path
from minio import Minio
from minio.error import S3Error

logger = logging.getLogger(__name__)


class StorageService:
    """
    Handles all MinIO/S3 operations for the transcoder service.
    """

    def __init__(self):
        self.client = Minio(
            endpoint=os.getenv("MINIO_ENDPOINT", "localhost:9000"),
            access_key=os.getenv("MINIO_ACCESS_KEY", "streamvault_admin"),
            secret_key=os.getenv("MINIO_SECRET_KEY", "streamvault_minio_secret"),
            secure=os.getenv("MINIO_USE_SSL", "false").lower() == "true",
        )
        self.hls_bucket = os.getenv("MINIO_HLS_BUCKET", "streamvault-hls")
        self.thumbnails_bucket = os.getenv("MINIO_THUMBNAILS_BUCKET", "streamvault-thumbnails")

    async def download_from_url(self, url: str, dest_path: str) -> str:
        """
        Download a file from a presigned URL to local disk.
        Uses streaming download for large files.
        """
        logger.info(f"Downloading source video from URL...")
        async with httpx.AsyncClient(timeout=3600) as client:
            async with client.stream("GET", url) as response:
                response.raise_for_status()
                total = int(response.headers.get("content-length", 0))
                downloaded = 0

                with open(dest_path, "wb") as f:
                    async for chunk in response.aiter_bytes(chunk_size=8 * 1024 * 1024):  # 8MB chunks
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total > 0:
                            pct = downloaded / total * 100
                            logger.debug(f"Download progress: {pct:.1f}%")

        logger.info(f"Download complete: {os.path.getsize(dest_path) / (1024**2):.1f} MB")
        return dest_path

    def upload_directory(self, local_dir: str, video_id: str) -> dict:
        """
        Upload entire HLS output directory to MinIO.
        Returns mapping of local paths to storage keys.
        """
        uploaded = {}
        base_key = f"videos/{video_id}"

        for root, dirs, files in os.walk(local_dir):
            for filename in files:
                local_path = os.path.join(root, filename)
                relative_path = os.path.relpath(local_path, local_dir)
                storage_key = f"{base_key}/{relative_path}".replace("\\", "/")

                # Determine content type
                content_type = self._get_content_type(filename)

                try:
                    self.client.fput_object(
                        self.hls_bucket,
                        storage_key,
                        local_path,
                        content_type=content_type,
                    )
                    uploaded[relative_path] = storage_key
                    logger.debug(f"Uploaded: {storage_key}")
                except S3Error as e:
                    logger.error(f"Failed to upload {storage_key}: {e}")
                    raise

        logger.info(f"Uploaded {len(uploaded)} HLS files for video {video_id}")
        return uploaded

    def upload_thumbnails(self, thumbnail_paths: list[dict], video_id: str) -> list[dict]:
        """Upload thumbnail files and return public URLs."""
        results = []
        for thumb in thumbnail_paths:
            local_path = thumb["path"]
            filename = os.path.basename(local_path)
            storage_key = f"videos/{video_id}/{filename}"

            try:
                self.client.fput_object(
                    self.thumbnails_bucket,
                    storage_key,
                    local_path,
                    content_type="image/jpeg",
                )
                # Build public URL (MinIO with anonymous download policy)
                minio_endpoint = os.getenv("MINIO_ENDPOINT", "localhost:9000")
                public_url = f"http://{minio_endpoint}/{self.thumbnails_bucket}/{storage_key}"

                results.append({
                    **thumb,
                    "url": public_url,
                    "storage_key": storage_key,
                })
            except S3Error as e:
                logger.error(f"Failed to upload thumbnail {storage_key}: {e}")

        return results

    def upload_sprite_sheet(self, local_path: str, video_id: str) -> str:
        """Upload timeline sprite sheet."""
        storage_key = f"videos/{video_id}/sprite.jpg"
        self.client.fput_object(
            self.thumbnails_bucket, storage_key, local_path, content_type="image/jpeg"
        )
        minio_endpoint = os.getenv("MINIO_ENDPOINT", "localhost:9000")
        return f"http://{minio_endpoint}/{self.thumbnails_bucket}/{storage_key}"

    @staticmethod
    def _get_content_type(filename: str) -> str:
        ext = Path(filename).suffix.lower()
        return {
            ".m3u8": "application/x-mpegURL",
            ".ts": "video/MP2T",
            ".mp4": "video/mp4",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".vtt": "text/vtt",
        }.get(ext, "application/octet-stream")

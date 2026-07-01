import asyncio
import os
import tempfile
import shutil
import logging
from fastapi import FastAPI, HTTPException, Header, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from contextlib import asynccontextmanager

from services.ffmpeg_service import FFmpegService
from services.thumbnail_service import ThumbnailService
from services.storage_service import StorageService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("StreamVault Transcoder starting up...")
    yield
    logger.info("StreamVault Transcoder shutting down...")


app = FastAPI(
    title="StreamVault Transcoder",
    description="FFmpeg-based HLS transcoding service for StreamVault",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Request/Response Models ──────────────────────────────────────────

class TranscodeRequest(BaseModel):
    video_id: str
    source_url: str               # Presigned URL to download the raw video
    output_bucket: str
    qualities: List[str] = ["1080p", "720p", "480p", "360p"]
    generate_thumbnails: bool = True
    thumbnail_count: int = 5
    generate_sprite_sheet: bool = True


class TranscodeResponse(BaseModel):
    video_id: str
    status: str
    duration: int
    width: int
    height: int
    fps: float
    bitrate: int
    codec: str
    hls_master_key: str
    qualities: List[dict]
    thumbnails: List[dict]
    sprite_sheet_url: Optional[str] = None


class ProgressResponse(BaseModel):
    video_id: str
    progress: int
    stage: str
    error: Optional[str] = None


# ─── In-memory progress tracking ─────────────────────────────────────
job_progress: dict[str, ProgressResponse] = {}


# ─── Internal secret validation ──────────────────────────────────────
INTERNAL_SECRET = os.getenv("TRANSCODER_SECRET", "internal_transcoder_secret")


def verify_internal_request(x_internal_secret: str = Header(None)):
    if x_internal_secret != INTERNAL_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")


# ─── Routes ──────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "streamvault-transcoder"}


@app.post("/api/transcode", response_model=TranscodeResponse)
async def transcode_video(
    request: TranscodeRequest,
    x_internal_secret: str = Header(None),
):
    """
    Main transcoding endpoint. Called by NestJS queue processor.

    Flow:
    1. Download source video from presigned URL
    2. Probe video metadata with ffprobe
    3. Transcode to multiple HLS qualities
    4. Generate thumbnails
    5. Generate timeline sprite sheet
    6. Upload all outputs to MinIO
    7. Return metadata for DB update
    """
    if x_internal_secret != INTERNAL_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")

    video_id = request.video_id
    storage = StorageService()
    work_dir = tempfile.mkdtemp(prefix=f"sv_transcode_{video_id}_")

    try:
        logger.info(f"[{video_id}] Starting transcoding pipeline")

        job_progress[video_id] = ProgressResponse(video_id=video_id, progress=0, stage="downloading")

        # ── Step 1: Download source ──────────────────────────────────
        source_ext = ".mp4"
        source_path = os.path.join(work_dir, f"source{source_ext}")
        await storage.download_from_url(request.source_url, source_path)

        job_progress[video_id] = ProgressResponse(video_id=video_id, progress=15, stage="probing")

        # ── Step 2: Probe metadata ───────────────────────────────────
        video_info = await FFmpegService.probe_video(source_path)
        logger.info(f"[{video_id}] Video info: {video_info}")

        job_progress[video_id] = ProgressResponse(video_id=video_id, progress=20, stage="transcoding")

        # ── Step 3: Transcode to HLS ─────────────────────────────────
        hls_output_dir = os.path.join(work_dir, "hls")

        async def update_progress(pct: int):
            job_progress[video_id] = ProgressResponse(
                video_id=video_id, progress=pct, stage="transcoding"
            )

        transcode_result = await FFmpegService.transcode_to_hls(
            input_path=source_path,
            output_dir=hls_output_dir,
            target_qualities=request.qualities,
            video_info=video_info,
            progress_callback=update_progress,
        )

        job_progress[video_id] = ProgressResponse(video_id=video_id, progress=80, stage="uploading")

        # ── Step 4: Upload HLS to MinIO ──────────────────────────────
        uploaded_files = storage.upload_directory(hls_output_dir, video_id)
        hls_master_key = f"videos/{video_id}/master.m3u8"

        # Update quality records with storage keys
        for q in transcode_result["qualities"]:
            q["hls_key"] = f"videos/{video_id}/{q['label']}/playlist.m3u8"

        job_progress[video_id] = ProgressResponse(video_id=video_id, progress=85, stage="thumbnails")

        # ── Step 5: Generate & upload thumbnails ─────────────────────
        uploaded_thumbnails = []
        if request.generate_thumbnails and video_info["duration"] > 0:
            thumb_dir = os.path.join(work_dir, "thumbnails")
            thumbnails = await ThumbnailService.generate_thumbnails(
                input_path=source_path,
                output_dir=thumb_dir,
                duration=video_info["duration"],
                count=request.thumbnail_count,
            )
            uploaded_thumbnails = storage.upload_thumbnails(thumbnails, video_id)

        # ── Step 6: Generate sprite sheet ────────────────────────────
        sprite_url = None
        if request.generate_sprite_sheet and video_info["duration"] > 30:
            sprite_path = os.path.join(work_dir, "sprite.jpg")
            sprite_info = await ThumbnailService.generate_sprite_sheet(
                input_path=source_path,
                output_path=sprite_path,
                duration=video_info["duration"],
            )
            if sprite_info and os.path.exists(sprite_path):
                sprite_url = storage.upload_sprite_sheet(sprite_path, video_id)

        job_progress[video_id] = ProgressResponse(video_id=video_id, progress=100, stage="complete")

        logger.info(f"[{video_id}] Transcoding pipeline complete!")

        return TranscodeResponse(
            video_id=video_id,
            status="READY",
            duration=video_info["duration"],
            width=video_info["width"],
            height=video_info["height"],
            fps=video_info["fps"],
            bitrate=video_info["bitrate"],
            codec=video_info["codec"],
            hls_master_key=hls_master_key,
            qualities=transcode_result["qualities"],
            thumbnails=uploaded_thumbnails,
            sprite_sheet_url=sprite_url,
        )

    except Exception as e:
        logger.error(f"[{video_id}] Transcoding failed: {e}", exc_info=True)
        job_progress[video_id] = ProgressResponse(
            video_id=video_id, progress=0, stage="failed", error=str(e)
        )
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        # Always clean up work directory
        try:
            shutil.rmtree(work_dir, ignore_errors=True)
        except Exception:
            pass


@app.get("/api/progress/{video_id}", response_model=ProgressResponse)
async def get_progress(video_id: str, x_internal_secret: str = Header(None)):
    """Get transcoding progress for a video."""
    if x_internal_secret != INTERNAL_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")

    progress = job_progress.get(video_id)
    if not progress:
        raise HTTPException(status_code=404, detail="Job not found")
    return progress


@app.post("/api/probe")
async def probe_video(
    body: dict,
    x_internal_secret: str = Header(None),
):
    """Probe a video URL for metadata without transcoding."""
    if x_internal_secret != INTERNAL_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")

    source_url = body.get("source_url")
    if not source_url:
        raise HTTPException(status_code=400, detail="source_url required")

    work_dir = tempfile.mkdtemp(prefix="sv_probe_")
    try:
        storage = StorageService()
        source_path = os.path.join(work_dir, "source.mp4")
        await storage.download_from_url(source_url, source_path)
        info = await FFmpegService.probe_video(source_path)
        return info
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)

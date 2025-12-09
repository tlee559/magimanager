#!/usr/bin/env python3
"""
YouTube Downloader Service

A simple FastAPI server that wraps yt-dlp to download YouTube videos.
Run this locally or on a dedicated server with good IP reputation.

Usage:
    pip install fastapi uvicorn yt-dlp playwright
    playwright install chromium
    python server.py

The server exposes:
    GET  /health          - Health check
    POST /info            - Get video info (title, formats, etc.)
    POST /download        - Download video and return file
    POST /screenshot      - Take screenshot of a URL (for landing pages)
"""

import os
import json
import base64
import tempfile
import asyncio
from typing import Optional, Any, Union, List
from pathlib import Path

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
import yt_dlp

app = FastAPI(title="YouTube Downloader Service", version="1.1.0")

# CORS - allow magimanager.com
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://magimanager.com",
        "https://www.magimanager.com",
        "http://localhost:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API key for basic auth (set via environment variable)
API_KEY = os.environ.get("YOUTUBE_SERVICE_API_KEY", "dev-key-change-me")

# Temp directory for downloads
TEMP_DIR = Path(tempfile.gettempdir()) / "youtube-downloads"
TEMP_DIR.mkdir(exist_ok=True)


class InfoRequest(BaseModel):
    url: str
    api_key: str


class DownloadRequest(BaseModel):
    url: str
    api_key: str
    quality: Optional[str] = "best"  # best, 720p, 480p, 360p
    format: Optional[str] = "mp4"  # mp4, webm, mp3


class VideoFormat(BaseModel):
    format_id: str
    ext: str
    quality: Optional[Union[str, int, float]] = None
    resolution: Optional[str] = None
    filesize: Optional[int] = None
    vcodec: Optional[str] = None
    acodec: Optional[str] = None
    fps: Optional[float] = None


class VideoInfo(BaseModel):
    id: str
    title: str
    description: Optional[str]
    thumbnail: Optional[str]
    duration: Optional[int]
    view_count: Optional[int]
    channel: Optional[str]
    upload_date: Optional[str]
    formats: list[VideoFormat]


def verify_api_key(api_key: str):
    """Verify API key"""
    if api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


def get_yt_dlp_opts(quality: str = "best", format: str = "mp4") -> dict:
    """Get yt-dlp options based on quality and format"""
    opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": False,
    }

    if format == "mp3":
        opts["format"] = "bestaudio/best"
        opts["postprocessors"] = [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": "192",
        }]
    else:
        # Video format selection
        if quality == "best":
            opts["format"] = f"bestvideo[ext={format}]+bestaudio[ext=m4a]/best[ext={format}]/best"
        elif quality in ["720p", "480p", "360p"]:
            height = quality.replace("p", "")
            opts["format"] = f"bestvideo[height<={height}][ext={format}]+bestaudio[ext=m4a]/best[height<={height}][ext={format}]/best[height<={height}]"
        else:
            opts["format"] = "best"

    return opts


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "ok", "service": "youtube-downloader"}


@app.post("/info")
async def get_info(request: InfoRequest):
    """Get video information without downloading"""
    verify_api_key(request.api_key)

    try:
        opts = {
            "quiet": True,
            "no_warnings": True,
            "extract_flat": False,
        }

        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(request.url, download=False)

        if not info:
            raise HTTPException(status_code=404, detail="Video not found")

        # Extract formats
        formats = []
        for f in info.get("formats", []):
            formats.append(VideoFormat(
                format_id=f.get("format_id", ""),
                ext=f.get("ext", ""),
                quality=f.get("quality"),
                resolution=f.get("resolution"),
                filesize=f.get("filesize"),
                vcodec=f.get("vcodec"),
                acodec=f.get("acodec"),
                fps=f.get("fps"),
            ))

        return VideoInfo(
            id=info.get("id", ""),
            title=info.get("title", "Unknown"),
            description=info.get("description"),
            thumbnail=info.get("thumbnail"),
            duration=info.get("duration"),
            view_count=info.get("view_count"),
            channel=info.get("channel") or info.get("uploader"),
            upload_date=info.get("upload_date"),
            formats=formats,
        )

    except yt_dlp.DownloadError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/download")
async def download_video(request: DownloadRequest, background_tasks: BackgroundTasks):
    """Download video and return file path"""
    verify_api_key(request.api_key)

    try:
        # Create temp file for download
        output_template = str(TEMP_DIR / "%(id)s.%(ext)s")

        opts = get_yt_dlp_opts(request.quality, request.format)
        opts["outtmpl"] = output_template

        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(request.url, download=True)

        if not info:
            raise HTTPException(status_code=404, detail="Video not found")

        # Find the downloaded file
        video_id = info.get("id", "")
        ext = request.format if request.format != "mp3" else "mp3"

        # yt-dlp may use different extension based on what's available
        downloaded_file = None
        for possible_ext in [ext, "mp4", "webm", "mkv", "mp3", "m4a"]:
            possible_path = TEMP_DIR / f"{video_id}.{possible_ext}"
            if possible_path.exists():
                downloaded_file = possible_path
                break

        if not downloaded_file or not downloaded_file.exists():
            raise HTTPException(status_code=500, detail="Download completed but file not found")

        # Schedule cleanup after response is sent
        def cleanup():
            try:
                if downloaded_file.exists():
                    downloaded_file.unlink()
            except Exception:
                pass

        background_tasks.add_task(cleanup)

        return FileResponse(
            path=str(downloaded_file),
            filename=f"{info.get('title', 'video')}.{downloaded_file.suffix.lstrip('.')}",
            media_type="application/octet-stream",
        )

    except yt_dlp.DownloadError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/download-url")
async def get_download_url(request: DownloadRequest):
    """Get direct download URL (may expire)"""
    verify_api_key(request.api_key)

    try:
        opts = get_yt_dlp_opts(request.quality, request.format)

        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(request.url, download=False)

        if not info:
            raise HTTPException(status_code=404, detail="Video not found")

        # Get the URL for the selected format
        url = info.get("url")

        if not url:
            # Try to find a suitable format
            formats = info.get("formats", [])
            for f in reversed(formats):  # Best quality last
                if f.get("url"):
                    url = f["url"]
                    break

        if not url:
            raise HTTPException(status_code=404, detail="No download URL found")

        return {
            "id": info.get("id"),
            "title": info.get("title"),
            "url": url,
            "ext": info.get("ext"),
            "filesize": info.get("filesize"),
            "duration": info.get("duration"),
        }

    except yt_dlp.DownloadError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8080))
    host = os.environ.get("HOST", "0.0.0.0")

    print(f"Starting YouTube Downloader Service on {host}:{port}")
    print(f"API Key: {API_KEY[:4]}...{API_KEY[-4:]}")

    uvicorn.run(app, host=host, port=port)

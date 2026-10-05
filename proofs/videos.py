"""Private, bounded video ingestion and background review transcoding."""
import json
import math
import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path

from django.conf import settings
from django.core.exceptions import ValidationError
from PIL import Image, ImageDraw

from .images import derivative, font

VIDEO_EXTENSIONS = {'.mp4', '.mov', '.m4v', '.webm'}
MAX_BYTES = 250 * 1024 * 1024
MAX_DURATION = 300


def is_video(upload):
    return Path(upload.name).suffix.lower() in VIDEO_EXTENSIONS


def run(args, timeout=30):
    try:
        return subprocess.run(args, check=True, capture_output=True, timeout=timeout)
    except (OSError, subprocess.SubprocessError) as exc:
        raise ValidationError('Cannot process this video. Use an MP4 or MOV up to 5 minutes and 250 MB.') from exc


def inspect(path):
    result = run(['ffprobe', '-v', 'error', '-protocol_whitelist', 'file', '-format_whitelist', 'mov,matroska,webm', '-show_streams', '-show_format', '-of', 'json', str(path)])
    data = json.loads(result.stdout)
    stream = next((s for s in data['streams'] if s['codec_type'] == 'video'), None)
    duration = float(data['format'].get('duration', 0))
    if not stream or not math.isfinite(duration) or not 0 < duration <= MAX_DURATION:
        raise ValidationError('Video must contain a playable picture and be no longer than 5 minutes.')
    if not 0 < int(stream.get('width', 0)) * int(stream.get('height', 0)) <= 40_000_000:
        raise ValidationError('Video resolution is not supported.')
    return duration


def queue_source(upload):
    if upload.size > MAX_BYTES:
        raise ValidationError('Each video must be smaller than 250 MB.')
    from .models import Version
    if Version.objects.filter(processing__in=['queued','processing']).count() >= 20:
        raise ValidationError('The video queue is full. Please wait for current previews to finish.')
    root = Path(settings.MEDIA_ROOT)
    root.mkdir(parents=True, exist_ok=True)
    name = uuid.uuid4().hex + '.source'
    path = root / name
    try:
        with path.open('wb') as output:
            for chunk in upload.chunks():
                output.write(chunk)
        duration = inspect(path)
        placeholder = Image.new('RGB', (640, 360), '#17191d')
        ImageDraw.Draw(placeholder).text((30, 160), 'Preparing video preview', font=font(24), fill='white')
        thumb = uuid.uuid4().hex + '.jpg'
        placeholder.save(root / thumb)
        return name, thumb, duration
    except Exception:
        path.unlink(missing_ok=True)
        raise


def transcode(version):
    """One worker, one transcode, no original or clean video served to viewers."""
    root = Path(settings.MEDIA_ROOT)
    name = uuid.uuid4().hex
    output, thumb = root / (name + '.mp4'), root / (name + '.jpg')
    try:
        with tempfile.TemporaryDirectory(dir=root) as scratch:
            scratch = Path(scratch)
            scaled = scratch / 'scaled.mp4'
            # Autorotate before scaling; bound both portrait and landscape to 1280x720/720x1280.
            run(['ffmpeg', '-nostdin', '-v', 'error', '-threads', '1', '-protocol_whitelist', 'file',
                 '-format_whitelist', 'mov,matroska,webm', '-i', str(root / version.source_file), '-map', '0:v:0', '-map', '0:a:0?',
                 '-vf', "scale='if(gte(iw,ih),min(1280,iw),min(720,iw))':'if(gte(iw,ih),min(720,ih),min(1280,ih))':force_original_aspect_ratio=decrease:force_divisible_by=2,fps=30",
                 '-c:v', 'libx264', '-threads', '1', '-preset', 'veryfast', '-crf', '27', '-pix_fmt', 'yuv420p',
                 '-c:a', 'aac', '-b:a', '96k', '-map_metadata', '-1', '-movflags', '+faststart', str(scaled)], timeout=900)
            frame = scratch / 'frame.png'
            run(['ffmpeg', '-nostdin', '-v', 'error', '-i', str(scaled), '-frames:v', '1', str(frame)])
            with Image.open(frame) as im:
                w, h = im.size
                derivative(im, version.label, 480).save(thumb, quality=72)
            overlay = Image.new('RGBA', (w, h))
            draw = ImageDraw.Draw(overlay)
            for y in range(20, h, max(100, h // 4)):
                for x in range(-40, w, max(210, w // 2)):
                    draw.text((x, y), 'SIGNAKI · REVIEW ONLY', font=font(max(14, w // 38)), fill=(255,255,255,120), stroke_width=1, stroke_fill=(0,0,0,90))
            draw.rectangle((0, h-38, w, h), fill=(15,23,22,220))
            draw.text((12,h-30), version.label[:90], font=font(16), fill='white')
            overlay_path = scratch / 'watermark.png'
            overlay.save(overlay_path)
            run(['ffmpeg', '-nostdin', '-v', 'error', '-i', str(scaled), '-i', str(overlay_path),
                 '-filter_complex_threads', '1', '-filter_complex', '[0:v][1:v]overlay=0:0[v]',
                 '-map', '[v]', '-map', '0:a:0?', '-c:v', 'libx264', '-threads', '1', '-preset', 'veryfast',
                 '-crf', '25', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-map_metadata', '-1', '-movflags', '+faststart', str(output)], timeout=900)
        return output.name, thumb.name
    except Exception:
        output.unlink(missing_ok=True)
        thumb.unlink(missing_ok=True)
        raise

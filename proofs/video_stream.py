"""Authenticated single-range responses for seeking without loading videos into RAM."""
import re
from django.http import FileResponse, HttpResponse, StreamingHttpResponse


def stream(request, path):
    size = path.stat().st_size
    value = request.headers.get('Range')
    if not value:
        response = FileResponse(path.open('rb'), content_type='video/mp4')
    else:
        match = re.fullmatch(r'bytes=(\d*)-(\d*)', value)
        try:
            if not match or not any(match.groups()): raise ValueError
            first, last = match.groups()
            start = int(first) if first else max(0, size-int(last))
            end = min(size-1, int(last)) if first and last else size-1
            if start > end or start >= size: raise ValueError
        except ValueError:
            return HttpResponse(status=416, headers={'Content-Range':f'bytes */{size}'})

        def chunks():
            with path.open('rb') as source:
                source.seek(start)
                remaining = end-start+1
                while remaining:
                    block = source.read(min(65536, remaining))
                    if not block: break
                    remaining -= len(block)
                    yield block

        response = StreamingHttpResponse(chunks(), status=206, content_type='video/mp4')
        response['Content-Range'] = f'bytes {start}-{end}/{size}'
        response['Content-Length'] = str(end-start+1)
    response['Accept-Ranges'] = 'bytes'
    response['Content-Disposition'] = 'inline; filename="review-preview.mp4"'
    return response

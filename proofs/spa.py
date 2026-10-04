"""Versioned static application shell; no customer data embedded in HTML."""
import json
from functools import lru_cache
from django.conf import settings
from django.shortcuts import render, redirect
from django.http import HttpResponse

@lru_cache(maxsize=1)
def entrypoint():
    path = settings.BASE_DIR / 'frontend' / 'dist' / '.vite' / 'manifest.json'
    return json.loads(path.read_text())['index.html']

def shell(request, path=''):
    if not settings.NEW_UI_ENABLED:
        return redirect('/')
    try:
        entry = entrypoint()
    except (FileNotFoundError, KeyError, ValueError):
        return HttpResponse('Frontend build is unavailable. Please contact the studio.', status=503)
    return render(request, 'spa.html', {'entry_js': '/static/ui/' + entry['file'], 'entry_css': ['/static/ui/' + name for name in entry.get('css', [])]})

def home(request):
    if settings.NEW_UI_ENABLED:
        return redirect('/app/')
    from .views import home as legacy_home
    return legacy_home(request)

def legacy_bridge(view, target):
    """Old bookmarks open the new UI; POST handlers remain available for safe rollback."""
    def wrapped(request, *args, **kwargs):
        if settings.NEW_UI_ENABLED and request.method == 'GET':
            from urllib.parse import urlencode
            query = {key: request.GET[key] for key in ('view', 'version') if request.GET.get(key)}
            url = target.format(**kwargs)
            return redirect(url + ('?' + urlencode(query) if query else ''))
        return view(request, *args, **kwargs)
    return wrapped

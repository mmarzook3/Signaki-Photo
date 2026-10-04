"""Print counts and hashes only; never output customer records or credentials."""
import os, json, hashlib
from pathlib import Path
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()
from django.conf import settings
from django.contrib.auth import get_user_model
from proofs.models import Property, Group, Photo, Version, Comment, Profile

report = {}
exclude = {'last_login', 'review_revision', 'request_id', 'upload_request_id'}
for model in [get_user_model(), Profile, Property, Group, Photo, Version, Comment]:
    fields = [f.attname for f in model._meta.fields if f.name not in exclude]
    rows = list(model.objects.order_by('pk').values(*fields))
    payload = json.dumps(rows, sort_keys=True, default=str, separators=(',', ':')).encode()
    report[model.__name__] = {'count': len(rows), 'sha256': hashlib.sha256(payload).hexdigest()}
files = sorted(Path(settings.MEDIA_ROOT).glob('*.jpg'))
payload = ''.join(p.name + hashlib.sha256(p.read_bytes()).hexdigest() for p in files).encode()
report['proofs'] = {'count': len(files), 'sha256': hashlib.sha256(payload).hexdigest()}
print(json.dumps(report, sort_keys=True))

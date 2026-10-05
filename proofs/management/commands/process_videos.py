"""Persistent single-worker queue; interrupted jobs are retried on worker restart."""
import time
from pathlib import Path
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction, close_old_connections
from django.utils import timezone
from proofs.models import Version
from proofs.videos import transcode


class Command(BaseCommand):
    help = 'Process queued video previews (run exactly one worker per deployment)'

    def add_arguments(self, parser):
        parser.add_argument('--once', action='store_true')

    def handle(self, *args, **options):
        Version.objects.filter(processing='processing').update(processing='queued')
        root = Path(settings.MEDIA_ROOT)
        while True:
            close_old_connections()
            with transaction.atomic():
                version = Version.objects.filter(processing='queued').order_by('created').first()
                if version:
                    version.processing = 'processing'
                    version.processing_started = timezone.now()
                    version.save(update_fields=['processing', 'processing_started'])
            if not version:
                if options['once']: return
                time.sleep(3)
                continue
            previous_thumb = version.thumb
            try:
                image, thumb = transcode(version)
                Version.objects.filter(pk=version.pk).update(image=image, thumb=thumb, processing='ready', source_file='', processing_error='')
                (root / previous_thumb).unlink(missing_ok=True)
            except Exception:
                Version.objects.filter(pk=version.pk).update(processing='failed', source_file='', processing_error='Preview processing failed. Upload a new MP4 version to retry.')
                self.stderr.write(f'Video processing failed for version {version.pk}')
            finally:
                if version.source_file: (root / version.source_file).unlink(missing_ok=True)

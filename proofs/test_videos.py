import json
import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path
from unittest import skipUnless
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.core.exceptions import ValidationError
from django.test import TestCase, override_settings
from proofs.models import Property, Photo, Comment
from proofs.views import add_version


@skipUnless(shutil.which('ffmpeg') and shutil.which('ffprobe'), 'FFmpeg required')
@override_settings(SECURE_SSL_REDIRECT=False, SESSION_COOKIE_SECURE=False, CSRF_COOKIE_SECURE=False)
class VideoTests(TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.override = override_settings(MEDIA_ROOT=self.root)
        self.override.enable()
        self.addCleanup(self.override.disable)
        self.addCleanup(self.temp.cleanup)
        self.owner = get_user_model().objects.create_user('video-owner')
        self.other = get_user_model().objects.create_user('video-other')
        self.admin = get_user_model().objects.create_user('video-admin', is_staff=True)
        self.prop = Property.objects.create(customer=self.owner, name='Video QA')
        self.photo = Photo.objects.create(property=self.prop, name='Film')
        self.source = self.root/'fixture.mp4'
        subprocess.run(['ffmpeg','-v','error','-f','lavfi','-i','color=c=blue:s=320x180:r=30','-t','1','-c:v','libx264','-pix_fmt','yuv420p',str(self.source)], check=True)

    def upload(self):
        return SimpleUploadedFile('tour.mp4', self.source.read_bytes(), content_type='video/mp4')

    def test_transcode_range_isolation_and_versioned_feedback(self):
        version = add_version(self.photo, self.upload())
        self.assertEqual(version.processing, 'queued')
        source = self.root/version.source_file
        self.client.force_login(self.owner)
        self.assertEqual(self.client.get(f'/proof/{version.pk}/image/').status_code,404)
        call_command('process_videos', once=True)
        version.refresh_from_db()
        self.assertEqual(version.processing,'ready',version.processing_error)
        self.assertFalse(source.exists())
        self.assertEqual(version.clean_image,'')
        self.assertTrue((self.root/version.thumb).is_file())
        response=self.client.get(f'/proof/{version.pk}/image/', HTTP_RANGE='bytes=0-99')
        self.assertEqual(response.status_code,206)
        self.assertEqual(len(b''.join(response.streaming_content)),100)
        self.assertEqual(response['Content-Type'],'video/mp4')
        self.assertEqual(self.client.get(f'/proof/{version.pk}/image/',HTTP_RANGE='bytes=99999999-').status_code,416)
        data={'text':'Please smooth this turn','timestamp_seconds':0.5,'request_id':str(uuid.uuid4())}
        endpoint=f'/api/v1/versions/{version.pk}/comments/'
        response=self.client.post(endpoint,data,content_type='application/json')
        self.assertEqual(response.status_code,201,response.content)
        self.assertEqual(Comment.objects.get().timestamp_seconds,0.5)
        self.assertEqual(self.client.post(endpoint,data,content_type='application/json').status_code,200)
        data['timestamp_seconds']=10;data['request_id']=str(uuid.uuid4())
        self.assertEqual(self.client.post(endpoint,data,content_type='application/json').status_code,400)
        self.client.force_login(self.other)
        self.assertEqual(self.client.get(f'/proof/{version.pk}/image/',HTTP_RANGE='bytes=0-99').status_code,404)
        self.assertEqual(self.client.post(endpoint,data,content_type='application/json').status_code,404)
        replacement=add_version(self.photo,self.upload())
        self.assertEqual(replacement.number,2)
        self.assertEqual(Comment.objects.get().version_id,version.pk)

    def test_invalid_video_leaves_no_source(self):
        with self.assertRaises(ValidationError):
            add_version(self.photo,SimpleUploadedFile('bad.mp4',b'not video'))
        self.assertEqual(list(self.root.glob('*.source')),[])
        self.assertEqual(self.photo.versions.count(),0)

    def test_upload_endpoint_queues_video(self):
        self.client.force_login(self.admin)
        response=self.client.post(f'/api/v1/properties/{self.prop.pk}/upload/',{'photos':self.upload()})
        self.assertEqual(response.status_code,200,response.content)
        self.assertTrue(response.json()['items'][0]['ok'])
        self.assertEqual(self.prop.photos.get(name='tour').latest.media_kind,'video')

import io,tempfile
from pathlib import Path
from PIL import Image
from django.test import TestCase,override_settings,Client
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from .models import Property,Photo,Version,Comment,Group,Profile
from .views import add_version
def upload(name='room.jpg'):
 im=Image.new('RGB',(1800,1200),'#8899aa');b=io.BytesIO();im.save(b,'JPEG',exif=b'Exif\x00\x00PRIVATE');return SimpleUploadedFile(name,b.getvalue(),content_type='image/jpeg')
@override_settings(SECURE_SSL_REDIRECT=False,SESSION_COOKIE_SECURE=False,CSRF_COOKIE_SECURE=False,STORAGES={'default':{'BACKEND':'django.core.files.storage.FileSystemStorage'},'staticfiles':{'BACKEND':'django.contrib.staticfiles.storage.StaticFilesStorage'}})
class IsolationTests(TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.override=override_settings(MEDIA_ROOT=Path(self.temp.name));self.override.enable()
  U=get_user_model();self.a=U.objects.create_user('alice',password='Temporary-Pass-123');self.b=U.objects.create_user('bob',password='Temporary-Pass-123');self.admin=U.objects.create_user('admin',is_staff=True,password='Temporary-Pass-123')
  self.p=Property.objects.create(name='Alice property',customer=self.a);self.other=Property.objects.create(name='Bob property',customer=self.b)
  self.photo=Photo.objects.create(property=self.p,name='Room 001');self.v=add_version(self.photo,upload());self.client.force_login(self.a)
 def tearDown(self):self.override.disable();self.temp.cleanup()
 def test_customer_cannot_access_other_property_photo_or_media(self):
  ph=Photo.objects.create(property=self.other,name='Private');v=add_version(ph,upload())
  for path in [f'/properties/{self.other.pk}/',f'/photos/{ph.pk}/',f'/proof/{v.pk}/image/',f'/proof/{v.pk}/thumb/']:
   self.assertEqual(self.client.get(path).status_code,404)
 def test_customer_cannot_admin_upload_or_resolve(self):
  for path in ['/customers/','/properties/new/',f'/properties/{self.p.pk}/upload/',f'/photos/{self.photo.pk}/versions/']:
   self.assertEqual(self.client.post(path).status_code,404)
 def test_anonymous_media_requires_login(self):
  self.client.logout();self.assertEqual(self.client.get(f'/proof/{self.v.pk}/image/').status_code,302)
 def test_latest_default_and_version_specific_comments(self):
  v2=add_version(self.photo,upload())
  self.assertEqual(self.client.get(f'/photos/{self.photo.pk}/').context['selected'],v2)
  self.client.post(f'/photos/{self.photo.pk}/',{'text':'Please warm v1','version':self.v.pk})
  self.assertEqual(Comment.objects.get().version,self.v)
  self.assertEqual(self.client.get(f'/photos/{self.photo.pk}/?version={self.v.pk}').context['selected'],self.v)
 def test_cannot_comment_on_foreign_version(self):
  ph=Photo.objects.create(property=self.other,name='Private');v=add_version(ph,upload())
  self.assertEqual(self.client.post(f'/photos/{self.photo.pk}/',{'text':'attack','version':v.pk}).status_code,404);self.assertFalse(Comment.objects.exists())
 def test_hidden_and_archived_media_denied(self):
  self.photo.hidden=True;self.photo.save();self.assertEqual(self.client.get(f'/proof/{self.v.pk}/image/').status_code,404)
  self.photo.hidden=False;self.photo.save();self.p.archived=True;self.p.save();self.assertEqual(self.client.get(f'/proof/{self.v.pk}/thumb/').status_code,404)
 def test_watermark_is_pixels_metadata_stripped_and_no_original(self):
  files=list(Path(self.temp.name).iterdir());self.assertEqual(len(files),2)
  with Image.open(Path(self.temp.name)/self.v.image) as im:
   self.assertLessEqual(max(im.size),1280);self.assertNotIn('exif',im.info);self.assertGreater(len(im.getcolors(im.width*im.height)),20)
 def test_video_rejected(self):
  from django.core.exceptions import ValidationError
  with self.assertRaises(ValidationError):add_version(self.photo,SimpleUploadedFile('clip.mp4',b'not image'))
  self.assertEqual(self.photo.versions.count(),1)
 def test_csrf_required(self):
  c=Client(enforce_csrf_checks=True);c.force_login(self.a)
  self.assertEqual(c.post(f'/photos/{self.photo.pk}/',{'text':'test','version':self.v.pk}).status_code,403)
 def test_forced_password_change(self):
  Profile.objects.create(user=self.a);self.assertRedirects(self.client.get('/'),'/password/',fetch_redirect_response=False)
 def test_group_from_other_property_rejected(self):
  self.client.force_login(self.admin);g=Group.objects.create(property=self.other,name='Other')
  self.assertEqual(self.client.post(f'/properties/{self.p.pk}/upload/',{'group':g.pk,'photos':upload()}).status_code,404)
 def test_upload_admin_and_resolve(self):
  self.client.force_login(self.admin)
  self.assertEqual(self.client.post(f'/properties/{self.p.pk}/upload/',{'photos':upload('New room.jpg')}).status_code,302)
  self.assertEqual(self.p.photos.count(),2)
  c=Comment.objects.create(version=self.v,author=self.a,text='adjust')
  self.client.post(f'/comments/{c.pk}/resolve/');c.refresh_from_db();self.assertTrue(c.resolved)
 def test_xss_comment_escaped(self):
  Comment.objects.create(version=self.v,author=self.a,text='<script>alert(1)</script>')
  response=self.client.get(f'/photos/{self.photo.pk}/');self.assertContains(response,'&lt;script&gt;');self.assertNotContains(response,'<script>alert')
 def test_login_rate_limit(self):
  self.client.logout()
  for _ in range(10):self.client.post('/login/',{'username':'alice','password':'wrong'})
  self.assertEqual(self.client.post('/login/',{'username':'alice','password':'wrong'}).status_code,429)
 def test_malformed_version_returns_404(self):
  self.assertEqual(self.client.get(f'/photos/{self.photo.pk}/?version=bad').status_code,404)
  self.assertEqual(self.client.post(f'/photos/{self.photo.pk}/',{'text':'test','version':'bad'}).status_code,404)
 def test_hidden_photo_count_is_not_exposed(self):
  self.photo.hidden=True;self.photo.save()
  self.assertEqual(self.client.get('/').context['cards'][0][0].photo_count,0)
 def test_password_reset_invalidates_existing_session(self):
  self.a.set_password('New-Secret-Password-123');self.a.save()
  self.assertEqual(self.client.get('/').status_code,302)

 def test_photo_navigation_respects_access_order_and_groups(self):
  g=Group.objects.create(property=self.p,name='Bedroom')
  self.photo.group=g;self.photo.save()
  second=Photo.objects.create(property=self.p,name='Room 002',group=g,position=2);add_version(second,upload())
  hidden=Photo.objects.create(property=self.p,name='Hidden',hidden=True,position=1);add_version(hidden,upload())
  third=Photo.objects.create(property=self.p,name='Room 003',position=3);add_version(third,upload())
  r=self.client.get(f'/photos/{self.photo.pk}/')
  self.assertIsNone(r.context['previous']);self.assertEqual(r.context['next'],second.pk);self.assertEqual(r.context['photo_total'],3)
  r=self.client.get(f'/photos/{second.pk}/?view=grouped')
  self.assertEqual(r.context['previous'],self.photo.pk);self.assertIsNone(r.context['next']);self.assertEqual(r.context['photo_total'],2)
  self.assertContains(r,'?view=grouped')
  r=self.client.get(f'/photos/{third.pk}/');self.assertIsNone(r.context['next'])
 def test_groups_collapsed_and_all_view_remains_visible(self):
  Group.objects.create(property=self.p,name='Bedroom')
  r=self.client.get(f'/properties/{self.p.pk}/?view=grouped')
  self.assertContains(r,'<details class="gallery-section room-group">')
  self.assertNotContains(r,'<details class="gallery-section room-group" open')
  self.assertContains(r,'group-chevron')
  r=self.client.get(f'/properties/{self.p.pk}/?view=all')
  self.assertNotContains(r,'room-group');self.assertContains(r,'photo-card')

 def test_review_decisions_require_reasons_and_remain_versioned(self):
  url=f'/photos/{self.photo.pk}/'
  for decision in ['rejected','review']:
   before=self.v.status
   self.client.post(url,{'version':self.v.pk,'decision':decision,'text':'   '})
   self.v.refresh_from_db();self.assertEqual(self.v.status,before)
   self.client.post(url,{'version':self.v.pk,'decision':decision,'text':'Please adjust warmth'})
   self.v.refresh_from_db();self.assertEqual(self.v.status,decision)
  self.client.post(url,{'version':self.v.pk,'decision':'approved'})
  self.v.refresh_from_db();self.assertEqual(self.v.status,'approved')
  self.assertEqual(Comment.objects.filter(version=self.v).count(),3)
  v2=add_version(self.photo,upload());self.assertEqual(v2.status,'pending')
  self.client.force_login(self.b)
  self.assertEqual(self.client.post(url,{'version':self.v.pk,'decision':'approved'}).status_code,404)
 def test_delivery_link_is_validated_and_explicitly_shared(self):
  from .forms import PropertyForm
  data={'name':'Test','customer':self.a.pk,'delivery_shared':True,'delivery_url':'https://evil.example/test'}
  self.assertFalse(PropertyForm(data).is_valid())
  data['delivery_url']='https://drive.google.com/drive/folders/example'
  self.assertTrue(PropertyForm(data).is_valid())
  self.p.delivery_url=data['delivery_url'];self.p.save()
  for url in ['/',f'/properties/{self.p.pk}/']:
   self.assertNotContains(self.client.get(url),'Open high-quality photos')
  self.p.delivery_shared=True;self.p.save()
  for url in ['/',f'/properties/{self.p.pk}/']:
   self.assertContains(self.client.get(url),'Open high-quality photos')
  self.client.force_login(self.b);self.assertNotContains(self.client.get('/'),data['delivery_url'])

 def test_gallery_progress_counts_latest_visible_versions(self):
  self.v.status='approved';self.v.save()
  r=self.client.get(f'/properties/{self.p.pk}/')
  self.assertEqual(r.context['reviewed'],1)
  add_version(self.photo,upload())
  r=self.client.get(f'/properties/{self.p.pk}/')
  self.assertEqual(r.context['reviewed'],0);self.assertEqual(r.context['counts']['pending'],1)
  self.photo.hidden=True;self.photo.save()
  r=self.client.get(f'/properties/{self.p.pk}/');self.assertEqual(sum(r.context['counts'].values()),0)

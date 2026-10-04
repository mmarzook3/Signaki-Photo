import tempfile, uuid
from pathlib import Path
from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from proofs.models import Property, Photo, Version, Comment, Favorite, SettingsPreset, GalleryDecision
from proofs.features import DEFAULTS, LABELS
from proofs.tests import upload
from proofs.views import add_version

@override_settings(SECURE_SSL_REDIRECT=False, SESSION_COOKIE_SECURE=False, CSRF_COOKIE_SECURE=False,
 STORAGES={'default':{'BACKEND':'django.core.files.storage.FileSystemStorage'},'staticfiles':{'BACKEND':'django.contrib.staticfiles.storage.StaticFilesStorage'}})
class CollaborationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner=get_user_model().objects.create_user('review-owner')
        cls.other=get_user_model().objects.create_user('review-other')
        cls.admin=get_user_model().objects.create_user('review-admin',is_staff=True)
        cls.prop=Property.objects.create(customer=cls.owner,name='Review property')
        cls.photo=Photo.objects.create(property=cls.prop,name='Living room')
        cls.version=Version.objects.create(photo=cls.photo,number=1,image='old.jpg',thumb='old-small.jpg',label='v1')

    def setUp(self):self.client.force_login(self.owner)
    def call(self,path,data=None,method='post'):
        return getattr(self.client,method)('/api/v1/'+path,data or {},content_type='application/json')
    def config(self,**kwargs):
        self.prop.review_settings={**self.prop.review_settings,**kwargs};self.prop.save()
    def decision(self,**kwargs):return {'decision':'approved','expected_revision':0,'request_id':str(uuid.uuid4()),**kwargs}
    def comment(self,**kwargs):return {'text':'Please adjust this area','request_id':str(uuid.uuid4()),**kwargs}

    def test_favorites_are_idempotent_and_user_scoped(self):
        path=f'photos/{self.photo.pk}/favorite/'
        for _ in range(2):self.assertEqual(self.call(path,{'favorite':True},'put').status_code,200)
        self.assertEqual(Favorite.objects.count(),1)
        self.assertTrue(self.client.get(f'/api/v1/photos/{self.photo.pk}/').json()['photo']['favorite'])
        self.client.force_login(self.other)
        self.assertEqual(self.call(path,{'favorite':False},'put').status_code,404)
        self.client.force_login(self.owner)
        self.assertEqual(self.call(path,{'favorite':False},'put').status_code,200)
        self.assertFalse(Favorite.objects.exists())

    def test_all_write_switches_and_view_only_enforced(self):
        cases=[('favorites',f'photos/{self.photo.pk}/favorite/',{'favorite':True},'put'),
          ('color_labels',f'photos/{self.photo.pk}/label/',{'label':'blue'},'put'),
          ('comments',f'versions/{self.version.pk}/comments/',self.comment(),'post'),
          ('asset_status',f'versions/{self.version.pk}/decision/',self.decision(),'post'),
          ('gallery_status',f'properties/{self.prop.pk}/decision/',self.decision(),'post'),
          ('upload',f'properties/{self.prop.pk}/upload/',{},'post')]
        for key,path,data,method in cases:
            with self.subTest(key=key):
                self.config(**{key:False,'view_only':False})
                self.assertEqual(self.call(path,data,method).status_code,403)
                self.config(**{key:True,'view_only':True})
                self.assertEqual(self.call(path,data,method).status_code,403)

    def test_labels_customization_and_invalid_settings(self):
        self.client.force_login(self.admin)
        path=f'properties/{self.prop.pk}/settings/'
        labels=[{**x,'name':'Selects' if x['id']=='blue' else x['name'],'enabled':x['id']!='red'} for x in LABELS]
        self.assertEqual(self.call(path,{'labels':labels},'patch').status_code,200)
        for invalid in [{'upload':'false'},{'unknown':True},{'labels':[None]},{'allowed_statuses':['wrong']}]:
            self.assertEqual(self.call(path,invalid,'patch').status_code,400)
        self.client.force_login(self.owner)
        self.assertEqual(self.call(path,{'upload':True},'patch').status_code,404)
        self.assertEqual(self.call(f'photos/{self.photo.pk}/label/',{'label':'red'},'put').status_code,400)
        self.assertEqual(self.call(f'photos/{self.photo.pk}/label/',{'label':'blue'},'put').status_code,200)

    def test_presets_are_staff_only_and_reusable(self):
        self.assertEqual(self.client.get('/api/v1/presets/').status_code,404)
        self.client.force_login(self.admin)
        self.assertEqual(len(self.client.get('/api/v1/presets/').json()),4)
        self.assertEqual(self.call('presets/',{'name':'Client review','config':DEFAULTS}).status_code,201)
        self.assertEqual(self.call('presets/',{'name':'Client review','config':DEFAULTS}).status_code,400)
        preset=self.client.get('/api/v1/presets/').json()[-1]
        self.assertEqual(self.call(f'properties/{self.prop.pk}/settings/',preset['config'],'patch').status_code,200)

    def test_versioning_off_blocks_old_media_and_actions(self):
        Version.objects.create(photo=self.photo,number=2,image='new.jpg',thumb='new-small.jpg',label='v2')
        self.config(versioning=False)
        self.assertEqual(len(self.client.get(f'/api/v1/photos/{self.photo.pk}/').json()['photo']['versions']),1)
        self.assertEqual(self.client.get(f'/proof/{self.version.pk}/image/').status_code,404)
        for path,data in [(f'versions/{self.version.pk}/comments/',self.comment()),(f'versions/{self.version.pk}/decision/',self.decision())]:
            self.assertEqual(self.call(path,data).status_code,403)
        self.client.force_login(self.admin)
        self.assertEqual(len(self.client.get(f'/api/v1/photos/{self.photo.pk}/').json()['photo']['versions']),2)

    def test_annotations_round_trip_bounds_retries_and_threads(self):
        path=f'versions/{self.version.pk}/comments/'
        shape={'kind':'rectangle','color':'#ffcc45','points':[[.1,.2],[.7,.8]]}
        payload=self.comment(annotations=[shape]);r=self.call(path,payload)
        self.assertEqual(r.status_code,201);self.assertEqual(r.json()['annotations'],[shape])
        self.assertEqual(self.call(path,payload).status_code,200)
        self.assertEqual(self.call(path,{**payload,'annotations':[]}).status_code,400)
        parent=r.json()['id'];reply=self.call(path,self.comment(parent_id=parent))
        self.assertEqual(reply.status_code,201);self.assertEqual(reply.json()['parent'],parent)
        self.assertEqual(self.call(path,self.comment(parent_id=reply.json()['id'])).status_code,404)
        for bad in [[{**shape,'points':[[2,0],[0,0]]}],[{**shape,'kind':'script'}],[shape]*9,[{**shape,'points':[['x',0],[0,0]]}]]:
            self.assertEqual(self.call(path,self.comment(annotations=bad)).status_code,400)
        self.config(annotations=False)
        self.assertEqual(self.call(path,self.comment(annotations=[shape])).status_code,403)
        self.client.force_login(self.admin)
        self.assertEqual(self.call(f'comments/{parent}/resolve/',{'resolved':True}).status_code,200)
        self.assertFalse(Comment.objects.filter(resolved=False).exists())

    def test_gallery_status_requires_reason_and_rejects_conflicts(self):
        path=f'properties/{self.prop.pk}/decision/'
        self.assertEqual(self.call(path,self.decision(decision='review')).status_code,400)
        data=self.decision(decision='review',text='Please recheck all rooms')
        self.assertEqual(self.call(path,data).status_code,200)
        self.assertEqual(self.call(path,data).status_code,200)
        self.assertEqual(GalleryDecision.objects.count(),1)
        self.assertEqual(self.call(path,self.decision()).status_code,409)

    def test_in_progress_and_disabled_asset_status(self):
        path=f'versions/{self.version.pk}/decision/'
        self.assertEqual(self.call(path,self.decision(decision='in_progress')).status_code,200)
        self.config(allowed_statuses=['approved'])
        self.assertEqual(self.call(path,self.decision(decision='review',text='Change',expected_revision=1)).status_code,400)

    def test_watermark_switch_download_and_customer_upload(self):
        with tempfile.TemporaryDirectory() as tmp, override_settings(MEDIA_ROOT=Path(tmp)):
            self.client.force_login(self.admin)
            path=f'properties/{self.prop.pk}/settings/'
            self.assertEqual(self.call(path,{'watermark':False},'patch').status_code,400)
            self.version.delete()
            v=add_version(self.photo,upload())
            self.assertEqual(len(list(Path(tmp).glob('*.jpg'))),4)
            self.assertNotEqual((Path(tmp)/v.image).read_bytes(),(Path(tmp)/v.clean_image).read_bytes())
            self.assertEqual(self.call(path,{'watermark':False,'upload':True},'patch').status_code,200)
            self.client.force_login(self.owner)
            proof=self.client.get(f'/proof/{v.pk}/image/')
            self.assertEqual(b''.join(proof.streaming_content),(Path(tmp)/v.clean_image).read_bytes());proof.close()
            dl=f'/api/v1/versions/{v.pk}/download/'
            self.assertEqual(self.client.get(dl).status_code,403)
            self.prop.refresh_from_db();self.config(download=True,approved_downloads_only=True)
            self.assertEqual(self.client.get(dl).status_code,403)
            v.status='approved';v.save()
            response=self.client.get(dl);self.assertEqual(response.status_code,200);self.assertIn('attachment',response['Content-Disposition']);response.close()
            info=self.client.get(f'/api/v1/versions/{v.pk}/information/').json();self.assertLessEqual(info['width'],1280)
            self.config(file_information=False)
            self.assertEqual(self.client.get(f'/api/v1/versions/{v.pk}/information/').status_code,403)
            r=self.client.post(f'/api/v1/properties/{self.prop.pk}/upload/',{'photos':upload('customer.jpg')})
            self.assertEqual(r.status_code,200);self.assertTrue(r.json()['items'][0]['ok'])

    def test_legacy_comment_route_cannot_bypass_switch(self):
        self.config(comments=False,asset_status=False)
        self.assertEqual(self.client.post(f'/photos/{self.photo.pk}/',{'version':self.version.pk,'text':'bypass'}).status_code,404)
        self.assertEqual(self.client.post(f'/photos/{self.photo.pk}/',{'version':self.version.pk,'decision':'approved'}).status_code,404)

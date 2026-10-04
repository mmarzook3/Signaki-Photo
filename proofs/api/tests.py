import uuid
from django.test import TestCase, Client, override_settings
from django.contrib.auth import get_user_model
from proofs.models import Property, Photo, Version, Comment, Profile, Group


@override_settings(SECURE_SSL_REDIRECT=False, SESSION_COOKIE_SECURE=False, CSRF_COOKIE_SECURE=False,
    STORAGES={'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'}, 'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'}})
class ApiTests(TestCase):
    def setUp(self):
        users = get_user_model()
        self.owner = users.objects.create_user('reviewer', password='Temporary-Password-123')
        self.other = users.objects.create_user('other', password='Temporary-Password-123')
        self.admin = users.objects.create_user('staff', password='Temporary-Password-123', is_staff=True)
        self.prop = Property.objects.create(customer=self.owner, name='Sample property', delivery_url='https://drive.google.com/drive/folders/private')
        self.photo = Photo.objects.create(property=self.prop, name='Room 1')
        self.version = Version.objects.create(photo=self.photo, number=1, image='private.jpg', thumb='private-small.jpg', label='Room 1 v1')
        self.client.force_login(self.owner)

    def post(self, url, data):
        return self.client.post('/api/v1/' + url, data, content_type='application/json')

    def test_private_delivery_and_media_paths_not_exposed(self):
        response = self.client.get(f'/api/v1/properties/{self.prop.pk}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['property']['delivery_url'], '')
        self.assertNotContains(response, 'private.jpg')
        self.assertIn('/proof/', response.json()['photos'][0]['latest']['image_url'])

    def test_customer_isolation_for_property_version_comment(self):
        self.client.force_login(self.other)
        self.assertEqual(self.client.get(f'/api/v1/properties/{self.prop.pk}/').status_code, 404)
        self.assertEqual(self.post(f'versions/{self.version.pk}/comments/', {'text': 'x', 'request_id': str(uuid.uuid4())}).status_code, 404)
        self.assertEqual(self.post(f'versions/{self.version.pk}/decision/', {'decision': 'approved', 'expected_revision': 0, 'request_id': str(uuid.uuid4())}).status_code, 404)

    def test_hidden_archived_visibility(self):
        self.photo.hidden = True; self.photo.save()
        self.assertEqual(self.client.get('/api/v1/properties/').json()[0]['photo_count'], 0)
        self.assertEqual(self.client.get(f'/api/v1/photos/{self.photo.pk}/').status_code, 404)
        self.prop.archived = True; self.prop.save()
        self.assertEqual(self.client.get('/api/v1/properties/').json(), [])

    def test_required_reasons_and_version_conflict(self):
        url = f'versions/{self.version.pk}/decision/'
        for choice in ['rejected', 'review']:
            self.assertEqual(self.post(url, {'decision': choice, 'text': ' ', 'expected_revision': 0, 'request_id': str(uuid.uuid4())}).status_code, 400)
        key = str(uuid.uuid4())
        payload = {'decision': 'review', 'text': 'Correct warmth', 'expected_revision': 0, 'request_id': key}
        self.assertEqual(self.post(url, payload).status_code, 200)
        self.assertEqual(self.post(url, payload).status_code, 200)
        self.assertEqual(Comment.objects.count(), 1)
        self.assertEqual(self.post(url, {**payload, 'request_id': str(uuid.uuid4())}).status_code, 409)
        v2 = Version.objects.create(photo=self.photo, number=2, image='new.jpg', thumb='new-small.jpg', label='v2')
        self.assertEqual(v2.status, 'pending')

    def test_comment_retry_deduplicated(self):
        data = {'text': 'Test comment', 'request_id': str(uuid.uuid4())}
        url = f'versions/{self.version.pk}/comments/'
        self.assertEqual(self.post(url, data).status_code, 201)
        self.assertEqual(self.post(url, data).status_code, 200)
        self.assertEqual(Comment.objects.count(), 1)
        self.assertEqual(self.post(url, {**data, 'text': 'changed'}).status_code, 400)

    def test_customer_cannot_admin_or_resolve(self):
        for url in ['customers/', f'properties/{self.prop.pk}/groups/', f'properties/{self.prop.pk}/upload/']:
            self.assertEqual(self.post(url, {}).status_code, 404)

    def test_forced_password_change_keeps_session_api_accessible(self):
        Profile.objects.create(user=self.owner)
        self.assertTrue(self.client.get('/api/v1/session/').json()['must_change_password'])
        self.assertEqual(self.client.get('/api/v1/properties/').status_code, 403)

    def test_login_requires_csrf_and_returns_identity(self):
        c = Client(enforce_csrf_checks=True)
        data = {'username': 'reviewer', 'password': 'Temporary-Password-123'}
        self.assertEqual(c.post('/api/v1/session/', data, content_type='application/json').status_code, 403)
        token = c.get('/api/v1/session/').json()['csrf']
        result = c.post('/api/v1/session/', data, content_type='application/json', HTTP_X_CSRFTOKEN=token)
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()['user']['username'], 'reviewer')

    def test_staff_delivery_update_and_customer_visibility(self):
        self.client.force_login(self.admin)
        url = f'/api/v1/properties/{self.prop.pk}/'
        self.assertEqual(self.client.patch(url, {'delivery_url': 'javascript:alert(1)', 'delivery_shared': True}, content_type='application/json').status_code, 400)
        self.assertEqual(self.client.patch(url, {'delivery_shared': True}, content_type='application/json').status_code, 200)
        self.client.force_login(self.owner)
        self.assertEqual(self.client.get(url).json()['property']['delivery_url'], self.prop.delivery_url)

    def test_staff_cannot_impersonate_customer_decision(self):
        self.client.force_login(self.admin)
        self.assertEqual(self.post(f'versions/{self.version.pk}/decision/', {}).status_code, 403)

    @override_settings(NEW_UI_ENABLED=True)
    def test_existing_bookmarks_bridge_without_losing_version(self):
        self.assertRedirects(self.client.get('/'), '/app/', fetch_redirect_response=False)
        response = self.client.get(f'/photos/{self.photo.pk}/?version={self.version.pk}')
        self.assertEqual(response.status_code, 302)
        self.assertIn(f'/app/photos/{self.photo.pk}?version={self.version.pk}', response['Location'])

    def test_legacy_decision_advances_api_conflict_counter(self):
        self.client.post(f'/photos/{self.photo.pk}/', {'version': self.version.pk, 'decision': 'review', 'text': 'Legacy tab correction'})
        self.version.refresh_from_db()
        self.assertEqual(self.version.review_revision, 1)
        self.assertEqual(self.post(f'versions/{self.version.pk}/decision/', {'decision': 'approved', 'expected_revision': 0, 'request_id': str(uuid.uuid4())}).status_code, 409)

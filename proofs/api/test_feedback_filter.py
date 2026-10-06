from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from proofs.models import Property, Photo, Version, Comment


@override_settings(SECURE_SSL_REDIRECT=False, SESSION_COOKIE_SECURE=False)
class FeedbackFilterTests(TestCase):
    def setUp(self):
        self.owner = get_user_model().objects.create_user('feedback-owner')
        self.admin = get_user_model().objects.create_user('feedback-admin', is_staff=True)
        self.other = get_user_model().objects.create_user('feedback-other')
        self.prop = Property.objects.create(customer=self.owner, name='Feedback property')
        self.photo = Photo.objects.create(property=self.prop, name='Room')
        self.old = Version.objects.create(photo=self.photo, number=1, image='old.jpg', thumb='old.jpg', label='v1')
        self.new = Version.objects.create(photo=self.photo, number=2, image='new.jpg', thumb='new.jpg', label='v2')
        self.comment = Comment.objects.create(version=self.old, author=self.owner, text='Please fix this area')
        Comment.objects.create(version=self.new, author=self.owner, text='Already fixed', resolved=True)
        self.client.force_login(self.owner)

    def count(self):
        return self.client.get(f'/api/v1/properties/{self.prop.pk}/').json()['photos'][0]['unresolved_feedback_count']

    def test_old_version_feedback_counts_without_changing_status(self):
        self.assertEqual(self.count(), 1)
        self.assertEqual(self.client.get(f'/api/v1/photos/{self.photo.pk}/').json()['photo']['unresolved_feedback_count'], 1)
        self.new.refresh_from_db()
        self.assertEqual(self.new.status, 'pending')
        self.client.force_login(self.admin)
        response = self.client.post(f'/api/v1/comments/{self.comment.pk}/resolve/', {'resolved': True}, content_type='application/json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.count(), 0)

    def test_counts_respect_comments_versioning_and_customer_access(self):
        self.prop.review_settings = {'versioning': False}
        self.prop.save()
        self.assertEqual(self.count(), 0)
        self.prop.review_settings = {'comments': False}
        self.prop.save()
        self.assertEqual(self.count(), 0)
        self.client.force_login(self.admin)
        self.assertEqual(self.count(), 1)
        self.client.force_login(self.other)
        self.assertEqual(self.client.get(f'/api/v1/properties/{self.prop.pk}/').status_code, 404)

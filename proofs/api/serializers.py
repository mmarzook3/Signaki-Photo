"""Explicit public contracts. No private media paths or unreleased delivery links."""
from django.contrib.auth import get_user_model
from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field
from .review_contracts import GalleryConfiguration
from proofs.features import settings_for, allowed
from proofs.annotations import validate_annotations
from proofs.models import Property, Group, Photo, Version, Comment


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = get_user_model()
        fields = ['id', 'username', 'first_name', 'is_staff', 'is_active']


class VersionSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    thumb_url = serializers.SerializerMethodField()

    class Meta:
        model = Version
        fields = ['id', 'number', 'label', 'note', 'status', 'created', 'review_revision', 'image_url', 'thumb_url']

    def get_image_url(self, obj) -> str:
        return f'/proof/{obj.pk}/image/'

    def get_thumb_url(self, obj) -> str:
        return f'/proof/{obj.pk}/thumb/'


class GroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = ['id', 'name', 'position']


class PhotoSerializer(serializers.ModelSerializer):
    property_id = serializers.UUIDField(read_only=True)
    group_id = serializers.IntegerField(read_only=True, allow_null=True)
    latest = serializers.SerializerMethodField()
    versions = serializers.SerializerMethodField()
    favorite = serializers.SerializerMethodField()

    def get_favorite(self, obj) -> bool:
        request = self.context.get('request')
        return bool(request and any(f.user_id == request.user.pk for f in obj.favorites.all()))

    @extend_schema_field(VersionSerializer(many=True))
    def get_versions(self, obj):
        request = self.context.get('request')
        versions = list(obj.versions.all())
        if request and not allowed(request.user, obj.property, 'versioning'):
            versions = versions[:1]
        return VersionSerializer(versions, many=True).data

    class Meta:
        model = Photo
        fields = ['id', 'property_id', 'name', 'group_id', 'position', 'hidden', 'latest', 'versions', 'favorite', 'color_label']

    @extend_schema_field(VersionSerializer(allow_null=True))
    def get_latest(self, obj):
        return VersionSerializer(obj.latest).data if obj.latest else None


class CommentSerializer(serializers.ModelSerializer):
    version_id = serializers.UUIDField(read_only=True)
    author = UserSerializer(read_only=True)
    version_number = serializers.IntegerField(source='version.number', read_only=True)
    photo_id = serializers.UUIDField(source='version.photo_id', read_only=True)
    photo_name = serializers.CharField(source='version.photo.name', read_only=True)
    property_name = serializers.CharField(source='version.photo.property.name', read_only=True)

    class Meta:
        model = Comment
        fields = ['id', 'version_id', 'version_number', 'photo_id', 'photo_name', 'property_name', 'author', 'text', 'decision', 'resolved', 'created', 'annotations', 'parent']


class PropertySerializer(serializers.ModelSerializer):
    customer = UserSerializer(read_only=True)
    review_settings = serializers.SerializerMethodField()
    watermark_locked = serializers.SerializerMethodField()

    @extend_schema_field(GalleryConfiguration)
    def get_review_settings(self, obj) -> dict:
        return settings_for(obj)

    def get_watermark_locked(self, obj) -> bool:
        return obj.photos.filter(versions__clean_image='').exists()
    delivery_url = serializers.SerializerMethodField()
    cover = serializers.SerializerMethodField()
    photo_count = serializers.SerializerMethodField()
    reviewed_count = serializers.SerializerMethodField()

    class Meta:
        model = Property
        fields = ['id', 'name', 'address', 'customer', 'archived', 'delivery_url', 'delivery_shared', 'cover', 'photo_count', 'reviewed_count', 'review_settings', 'review_status', 'review_revision', 'watermark_locked']

    def visible_photos(self, obj):
        staff = self.context['request'].user.is_staff
        return [p for p in obj.photos.all() if staff or not p.hidden]

    def get_delivery_url(self, obj) -> str:
        return obj.delivery_url if self.context['request'].user.is_staff or obj.delivery_shared else ''

    @extend_schema_field(VersionSerializer(allow_null=True))
    def get_cover(self, obj):
        photos = self.visible_photos(obj)
        latest = next((p.latest for p in photos if p.latest), None)
        return VersionSerializer(latest).data if latest else None

    def get_photo_count(self, obj) -> int:
        return len(self.visible_photos(obj))

    def get_reviewed_count(self, obj) -> int:
        return sum(bool(p.latest and p.latest.status != 'pending') for p in self.visible_photos(obj))


class DecisionInput(serializers.Serializer):
    decision = serializers.ChoiceField(choices=['approved', 'rejected', 'review', 'in_progress'])
    text = serializers.CharField(max_length=4000, required=False, allow_blank=True, default='')
    expected_revision = serializers.IntegerField(min_value=0)
    request_id = serializers.UUIDField()

    def validate(self, data):
        if data['decision'] in {'rejected', 'review'} and not data['text'].strip():
            raise serializers.ValidationError({'text': 'Please explain why the photo is not needed or what changes you need.'})
        return data


class CommentInput(serializers.Serializer):
    annotations = serializers.JSONField(required=False, default=list)
    parent_id = serializers.UUIDField(required=False, allow_null=True, default=None)

    def validate_annotations(self, value):
        return validate_annotations(value)

    text = serializers.CharField(max_length=4000, trim_whitespace=True)
    request_id = serializers.UUIDField()


class SessionResponse(serializers.Serializer):
    user = UserSerializer(allow_null=True)
    csrf = serializers.CharField()
    must_change_password = serializers.BooleanField()
    version = serializers.CharField()


class GalleryResponse(serializers.Serializer):
    property = PropertySerializer()
    groups = GroupSerializer(many=True)
    photos = PhotoSerializer(many=True)


class PhotoResponse(serializers.Serializer):
    photo = PhotoSerializer()
    comments = CommentSerializer(many=True)


class FeedbackResponse(serializers.Serializer):
    items = CommentSerializer(many=True)
    page = serializers.IntegerField()
    pages = serializers.IntegerField()
    count = serializers.IntegerField()


class LoginInput(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)


class PasswordInput(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password1 = serializers.CharField(write_only=True, min_length=12)
    new_password2 = serializers.CharField(write_only=True, min_length=12)


class PropertyInput(serializers.Serializer):
    name = serializers.CharField(max_length=160)
    address = serializers.CharField(max_length=240, required=False, allow_blank=True)
    customer = serializers.IntegerField()
    archived = serializers.BooleanField(required=False)
    delivery_url = serializers.URLField(required=False, allow_blank=True)
    delivery_shared = serializers.BooleanField(required=False)


class PhotoInput(serializers.Serializer):
    name = serializers.CharField(max_length=140, required=False)
    group = serializers.IntegerField(required=False, allow_null=True)
    position = serializers.IntegerField(min_value=0, required=False)
    hidden = serializers.BooleanField(required=False)


class CustomerInput(serializers.Serializer):
    username = serializers.CharField()
    first_name = serializers.CharField(required=False, allow_blank=True)
    password1 = serializers.CharField(write_only=True, min_length=12)
    password2 = serializers.CharField(write_only=True, min_length=12)


class CustomerUpdateInput(serializers.Serializer):
    is_active = serializers.BooleanField(required=False)
    new_password1 = serializers.CharField(required=False, write_only=True, min_length=12)
    new_password2 = serializers.CharField(required=False, write_only=True, min_length=12)


class ResolveInput(serializers.Serializer):
    resolved = serializers.BooleanField()


class UploadInput(serializers.Serializer):
    group = serializers.IntegerField(required=False, allow_null=True)
    photos = serializers.ListField(child=serializers.FileField(), min_length=1, max_length=10)


class ReplacementInput(serializers.Serializer):
    request_id = serializers.UUIDField()
    photo = serializers.FileField()
    note = serializers.CharField(max_length=500, required=False, allow_blank=True)

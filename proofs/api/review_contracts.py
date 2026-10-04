"""Documented collaboration API payloads."""
from rest_framework import serializers

class LabelDefinition(serializers.Serializer):
    id=serializers.CharField()
    name=serializers.CharField(max_length=30)
    color=serializers.CharField()
    enabled=serializers.BooleanField()

class GalleryConfiguration(serializers.Serializer):
    view_only=serializers.BooleanField(required=False)
    gallery_status=serializers.BooleanField(required=False)
    asset_status=serializers.BooleanField(required=False)
    favorites=serializers.BooleanField(required=False)
    comments=serializers.BooleanField(required=False)
    annotations=serializers.BooleanField(required=False)
    color_labels=serializers.BooleanField(required=False)
    download=serializers.BooleanField(required=False)
    upload=serializers.BooleanField(required=False)
    file_information=serializers.BooleanField(required=False)
    workflow=serializers.BooleanField(required=False)
    versioning=serializers.BooleanField(required=False)
    watermark=serializers.BooleanField(required=False)
    approved_downloads_only=serializers.BooleanField(required=False)
    allowed_statuses=serializers.ListField(child=serializers.CharField(),required=False)
    labels=LabelDefinition(many=True,required=False)

class PresetContract(serializers.Serializer):
    id=serializers.CharField(read_only=True)
    name=serializers.CharField(max_length=80)
    config=GalleryConfiguration()
    standard=serializers.BooleanField(read_only=True)

class FavoriteContract(serializers.Serializer):
    favorite=serializers.BooleanField()

class LabelInput(serializers.Serializer):
    label=serializers.CharField(allow_blank=True)

class LabelOutput(serializers.Serializer):
    color_label=serializers.CharField(allow_blank=True)

class GalleryDecisionContract(serializers.Serializer):
    id=serializers.CharField()
    status=serializers.CharField()
    reason=serializers.CharField()
    author=serializers.CharField()
    created=serializers.DateTimeField()

class GalleryDecisionResult(serializers.Serializer):
    status=serializers.CharField()
    revision=serializers.IntegerField()

class InformationContract(serializers.Serializer):
    name=serializers.CharField()
    width=serializers.IntegerField()
    height=serializers.IntegerField()
    bytes=serializers.IntegerField()
    format=serializers.CharField()
    version=serializers.IntegerField()
    created=serializers.DateTimeField()
    kind=serializers.CharField()

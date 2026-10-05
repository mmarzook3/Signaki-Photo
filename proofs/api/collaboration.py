"""Gallery collaboration and private review-copy access."""
from pathlib import Path
from PIL import Image
from django.conf import settings
from django.db import transaction, IntegrityError
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, extend_schema_view
from .review_contracts import GalleryConfiguration, PresetContract, FavoriteContract, LabelInput, LabelOutput, GalleryDecisionContract, GalleryDecisionResult, InformationContract
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, PermissionDenied
from proofs.models import Favorite, SettingsPreset, GalleryDecision, Version
from proofs.features import require, visible_version, settings_for, apply_settings, validate_settings, standard_presets
from proofs.views import properties, photos
from .views import staff
from .serializers import DecisionInput

class PrivateView(APIView):
    permission_classes = [IsAuthenticated]

@extend_schema_view(patch=extend_schema(request=GalleryConfiguration,responses=GalleryConfiguration))
class GallerySettings(PrivateView):
    def patch(self, request, pk):
        staff(request)
        with transaction.atomic():
            prop = get_object_or_404(properties(request).select_for_update(), pk=pk)
            return Response(apply_settings(prop, request.data))

@extend_schema_view(get=extend_schema(responses=PresetContract(many=True)),post=extend_schema(request=PresetContract,responses={201: {"type":"object","properties":{"id":{"type":"string"}}}}))
class Presets(PrivateView):
    def get(self, request):
        staff(request)
        custom = [{'id':str(p.pk), 'name':p.name, 'config':p.config, 'standard':False} for p in SettingsPreset.objects.order_by('name')]
        return Response(standard_presets() + custom)

    def post(self, request):
        staff(request)
        name = request.data.get('name')
        if not isinstance(name, str) or not 1 <= len(name.strip()) <= 80:
            raise ValidationError('Use a preset name of 1–80 characters.')
        config = validate_settings(request.data.get('config'))
        try:
            with transaction.atomic():
                preset = SettingsPreset.objects.create(name=name.strip(), config=config, created_by=request.user)
        except IntegrityError:
            raise ValidationError('A preset with this name already exists.')
        return Response({'id':str(preset.pk)}, status=201)

@extend_schema_view(put=extend_schema(request=FavoriteContract,responses=FavoriteContract))
class PhotoFavorite(PrivateView):
    def put(self, request, pk):
        photo = get_object_or_404(photos(request).select_related('property'), pk=pk)
        require(request.user, photo.property, 'favorites')
        value = request.data.get('favorite')
        if type(value) is not bool:
            raise ValidationError('A boolean is required.')
        if value:
            Favorite.objects.get_or_create(user=request.user, photo=photo)
        else:
            Favorite.objects.filter(user=request.user, photo=photo).delete()
        return Response({'favorite':value})

@extend_schema_view(put=extend_schema(request=LabelInput,responses=LabelOutput))
class PhotoLabel(PrivateView):
    def put(self, request, pk):
        photo = get_object_or_404(photos(request).select_related('property'), pk=pk)
        require(request.user, photo.property, 'color_labels')
        value = request.data.get('label')
        permitted = [''] + [x['id'] for x in settings_for(photo.property)['labels'] if x['enabled']]
        if value not in permitted:
            raise ValidationError('Choose an enabled colour label.')
        photo.color_label = value
        photo.save(update_fields=['color_label'])
        return Response({'color_label':value})

@extend_schema_view(get=extend_schema(responses=GalleryDecisionContract(many=True)),post=extend_schema(request=DecisionInput,responses=GalleryDecisionResult))
class PropertyDecision(PrivateView):
    def get(self, request, pk):
        prop = get_object_or_404(properties(request), pk=pk)
        require(request.user, prop, 'gallery_status')
        return Response([{'id':str(d.pk),'status':d.status,'reason':d.reason,
            'author':d.author.first_name or d.author.username,'created':d.created}
            for d in prop.decisions.select_related('author').order_by('-created')[:100]])

    def post(self, request, pk):
        if request.user.is_staff:
            raise PermissionDenied('Gallery decisions belong to the customer.')
        data = DecisionInput(data=request.data)
        data.is_valid(raise_exception=True)
        data = data.validated_data
        with transaction.atomic():
            prop = get_object_or_404(properties(request).select_for_update(), pk=pk)
            require(request.user, prop, 'gallery_status')
            prior = GalleryDecision.objects.filter(request_id=data['request_id']).first()
            if prior:
                if prior.property_id != prop.pk or prior.author_id != request.user.pk or prior.status != data['decision'] or prior.reason != data['text']:
                    raise ValidationError('Request identifier has already been used.')
            else:
                if prop.review_revision != data['expected_revision']:
                    return Response({'detail':'The gallery status changed. Refresh before saving.'}, status=409)
                GalleryDecision.objects.create(property=prop, author=request.user, status=data['decision'], reason=data['text'], request_id=data['request_id'])
                prop.review_status=data['decision']
                prop.review_revision+=1
                prop.save(update_fields=['review_status','review_revision'])
        return Response({'status':prop.review_status,'revision':prop.review_revision})

def review_path(version, size='image'):
    if version.media_kind == 'video' and size == 'image' and version.processing != 'ready':
        from django.http import Http404
        raise Http404
    prop=version.photo.property
    name=getattr(version,size)
    if version.media_kind != 'video' and not settings_for(prop)['watermark']:
        name=getattr(version,'clean_'+size) or name
    path=Path(settings.MEDIA_ROOT)/name
    if not path.is_file():
        from django.http import Http404
        raise Http404
    return path

@extend_schema_view(get=extend_schema(responses=InformationContract))
class FileInformation(PrivateView):
    def get(self, request, pk):
        version=get_object_or_404(Version.objects.filter(photo__in=photos(request)),pk=pk)
        require(request.user,version.photo.property,'file_information')
        visible_version(request.user,version)
        path=review_path(version)
        with Image.open(review_path(version,'thumb') if version.media_kind=='video' else path) as image:
            width,height=image.size
        return Response({'name':version.label,'width':width,'height':height,'bytes':path.stat().st_size,'format':'MP4 (preview)' if version.media_kind=='video' else 'JPEG','version':version.number,'created':version.created,'kind':'Review copy'})

@extend_schema_view(get=extend_schema(responses={(200,"image/jpeg"):bytes}))
class Download(PrivateView):
    def get(self, request, pk):
        version=get_object_or_404(Version.objects.filter(photo__in=photos(request)),pk=pk)
        require(request.user,version.photo.property,'download')
        visible_version(request.user,version)
        if not request.user.is_staff and settings_for(version.photo.property)['approved_downloads_only'] and version.status!='approved':
            raise PermissionDenied('Only approved photographs can be downloaded.')
        video=version.media_kind=='video'
        return FileResponse(review_path(version).open('rb'),as_attachment=True,filename=f'{version.photo.name}-v{version.number}-review.'+('mp4' if video else 'jpg'),content_type='video/mp4' if video else 'image/jpeg')

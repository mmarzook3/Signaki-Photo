"""Same-origin API. Reuses existing ownership rules and validated domain forms."""
from django.conf import settings
from django.contrib.auth import get_user_model, logout, update_session_auth_hash
from django.contrib.auth.forms import PasswordChangeForm, SetPasswordForm
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction, IntegrityError
from django.db.models import Prefetch
from django.http import Http404
from django.middleware.csrf import get_token
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import ValidationError, PermissionDenied
from proofs.features import allowed, require, visible_version, settings_for
from proofs.models import Property, Group, Photo, Version, Comment, Profile
from proofs.forms import PropertyForm, CustomerForm, GroupForm, PhotoForm
from proofs.views import properties, photos, add_version, login_view
from .serializers import (
    UserSerializer, PropertySerializer, GroupSerializer, PhotoSerializer,
    VersionSerializer, CommentSerializer, DecisionInput, CommentInput,
    SessionResponse, GalleryResponse, PhotoResponse, FeedbackResponse,
    LoginInput, PasswordInput, PropertyInput, PhotoInput, CustomerInput, CustomerUpdateInput, ResolveInput, UploadInput, ReplacementInput,
)


def staff(request):
    if not request.user.is_staff:
        raise Http404


def save_form(form):
    if not form.is_valid():
        raise ValidationError(form.errors)
    return form.save()


def property_queryset(request):
    return properties(request).select_related('customer').prefetch_related(
        Prefetch('photos', queryset=Photo.objects.prefetch_related('versions')),
    )


@method_decorator(csrf_protect, name='dispatch')
@extend_schema_view(get=extend_schema(responses=SessionResponse), post=extend_schema(responses=SessionResponse), delete=extend_schema(responses={200: {"type": "object"}}))
class Session(APIView):
    serializer_class = LoginInput
    permission_classes = [AllowAny]

    def get(self, request):
        user = request.user
        return Response({
            'user': UserSerializer(user).data if user.is_authenticated else None,
            'csrf': get_token(request),
            'must_change_password': bool(user.is_authenticated and hasattr(user, 'profile') and user.profile.must_change_password),
            'version': settings.APP_VERSION,
        })

    def post(self, request):
        # Reuse the persistent IP/username throttling in the original sign-in flow.
        raw = request._request
        raw.POST = request.data
        result = login_view(raw)
        if not raw.user.is_authenticated:
            return Response({'detail': 'Sign-in failed. Check your details or try again later.'}, status=429 if result.status_code == 429 else 400)
        return self.get(request._request)

    def delete(self, request):
        logout(request)
        return Response({'ok': True})


@extend_schema_view(post=extend_schema(responses={200: {"type": "object"}}))
class Password(APIView):
    serializer_class = PasswordInput
    permission_classes = [IsAuthenticated]

    def post(self, request):
        form = PasswordChangeForm(request.user, request.data)
        if not form.is_valid():
            raise ValidationError(form.errors)
        user = form.save()
        update_session_auth_hash(request, user)
        Profile.objects.update_or_create(user=user, defaults={'must_change_password': False})
        return Response({'ok': True})


class Properties(APIView):
    serializer_class = PropertyInput
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=PropertySerializer(many=True))
    def get(self, request):
        return Response(PropertySerializer(property_queryset(request), many=True, context={'request': request}).data)

    def post(self, request):
        staff(request)
        obj = save_form(PropertyForm(request.data))
        return Response({'id': str(obj.pk)}, status=201)


@extend_schema_view(get=extend_schema(responses=GalleryResponse), patch=extend_schema(responses={200: {"type": "object"}}))
class PropertyDetail(APIView):
    serializer_class = PropertyInput
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        obj = get_object_or_404(property_queryset(request), pk=pk)
        images = photos(request).filter(property=obj).select_related('group','property').prefetch_related('versions','favorites')
        return Response({
            'property': PropertySerializer(obj, context={'request': request}).data,
            'groups': GroupSerializer(obj.groups.all(), many=True).data,
            'photos': PhotoSerializer(images, many=True, context={'request':request}).data,
        })

    def patch(self, request, pk):
        staff(request)
        obj = get_object_or_404(Property, pk=pk)
        data = {name: getattr(obj, name) for name in ['name', 'address', 'archived', 'delivery_url', 'delivery_shared']}
        data['customer'] = obj.customer_id
        data.update(request.data)
        save_form(PropertyForm(data, instance=obj))
        return Response({'ok': True})


@extend_schema_view(post=extend_schema(responses=GroupSerializer))
class Groups(APIView):
    serializer_class = GroupSerializer
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        staff(request)
        prop = get_object_or_404(Property, pk=pk)
        form = GroupForm(request.data)
        if not form.is_valid():
            raise ValidationError(form.errors)
        if prop.groups.filter(name=form.cleaned_data['name']).exists():
            raise ValidationError({'name': 'This group already exists.'})
        group = form.save(commit=False)
        group.property = prop
        group.save()
        return Response(GroupSerializer(group).data, status=201)


@extend_schema_view(get=extend_schema(responses=PhotoResponse), patch=extend_schema(responses={200: {"type": "object"}}))
class PhotoDetail(APIView):
    serializer_class = PhotoInput
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        obj = get_object_or_404(photos(request).select_related('property', 'group').prefetch_related('versions','favorites'), pk=pk)
        comments = Comment.objects.filter(version__photo=obj).select_related('version__photo__property', 'author')
        if not allowed(request.user, obj.property, 'comments'):
            comments = comments.none()
        if not allowed(request.user, obj.property, 'versioning'):
            comments = comments.filter(version=obj.latest)
        return Response({'photo': PhotoSerializer(obj, context={'request':request}).data, 'comments': CommentSerializer(comments, many=True).data})

    def patch(self, request, pk):
        staff(request)
        obj = get_object_or_404(Photo, pk=pk)
        data = {'name': obj.name, 'position': obj.position, 'group': obj.group_id, 'hidden': obj.hidden}
        data.update(request.data)
        save_form(PhotoForm(data, instance=obj))
        return Response({'ok': True})


class Decision(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=DecisionInput, responses=VersionSerializer)
    def post(self, request, pk):
        if request.user.is_staff:
            raise PermissionDenied('Customer decisions must be made by the customer.')
        data = DecisionInput(data=request.data)
        data.is_valid(raise_exception=True)
        data = data.validated_data
        with transaction.atomic():
            version = get_object_or_404(Version.objects.select_for_update().filter(photo__in=photos(request)), pk=pk)
            require(request.user, version.photo.property, 'asset_status')
            visible_version(request.user, version)
            if data['decision'] not in settings_for(version.photo.property)['allowed_statuses']:
                raise ValidationError('This review state is disabled.')
            previous = Comment.objects.filter(request_id=data['request_id']).first()
            if previous:
                if previous.author_id != request.user.pk or previous.version_id != version.pk or previous.decision != data['decision'] or previous.text != (data['text'].strip() or ('Photo approved.' if data['decision'] == 'approved' else 'Review in progress.')):
                    raise ValidationError('Request identifier has already been used.')
                return Response(VersionSerializer(version).data)
            if version.review_revision != data['expected_revision']:
                return Response({'detail': 'This decision changed in another session. Refresh and review it before saving.'}, status=409)
            version.status = data['decision']
            version.review_revision += 1
            version.save(update_fields=['status', 'review_revision'])
            Comment.objects.create(version=version, author=request.user, decision=data['decision'], text=data['text'].strip() or ('Photo approved.' if data['decision'] == 'approved' else 'Review in progress.'), resolved=data['decision'] == 'approved', request_id=data['request_id'])
        return Response(VersionSerializer(version).data)


class Comments(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=CommentInput, responses=CommentSerializer)
    def post(self, request, pk):
        version = get_object_or_404(Version.objects.filter(photo__in=photos(request)), pk=pk)
        require(request.user, version.photo.property, 'comments')
        visible_version(request.user, version)
        data = CommentInput(data=request.data)
        data.is_valid(raise_exception=True)
        data = data.validated_data
        if data['annotations']:
            require(request.user, version.photo.property, 'annotations')
        parent = None
        if data['parent_id']:
            parent = get_object_or_404(Comment, pk=data['parent_id'], version=version, parent__isnull=True)
        with transaction.atomic():
            comment, created = Comment.objects.get_or_create(request_id=data['request_id'], defaults={'version': version, 'author': request.user, 'text': data['text'], 'annotations':data['annotations'], 'parent':parent})
            if comment.author_id != request.user.pk or comment.version_id != version.pk or comment.text != data['text'] or comment.decision or comment.annotations != data['annotations'] or comment.parent_id != data['parent_id']:
                raise ValidationError('Request identifier has already been used.')
        return Response(CommentSerializer(comment).data, status=201 if created else 200)


@extend_schema_view(post=extend_schema(responses={200: {"type": "object"}}))
class Resolve(APIView):
    serializer_class = ResolveInput
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        staff(request)
        obj = get_object_or_404(Comment, pk=pk)
        if not isinstance(request.data.get('resolved'), bool):
            raise ValidationError({'resolved': 'A boolean is required.'})
        obj.resolved = request.data['resolved']
        obj.save(update_fields=['resolved'])
        obj.replies.update(resolved=obj.resolved)
        return Response({'ok': True})


@extend_schema_view(get=extend_schema(responses=FeedbackResponse))
class Feedback(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        staff(request)
        qs = Comment.objects.select_related('version__photo__property', 'author').order_by('-created')
        if request.query_params.get('status') != 'all':
            qs = qs.filter(resolved=False)
        from django.core.paginator import Paginator
        page = Paginator(qs, 50).get_page(request.query_params.get('page'))
        return Response({'items': CommentSerializer(page, many=True).data, 'page': page.number, 'pages': page.paginator.num_pages, 'count': page.paginator.count})


@extend_schema_view(get=extend_schema(responses=UserSerializer(many=True)), post=extend_schema(responses=UserSerializer))
class Customers(APIView):
    serializer_class = CustomerInput
    permission_classes = [IsAuthenticated]

    def get(self, request):
        staff(request)
        return Response(UserSerializer(get_user_model().objects.filter(is_staff=False).order_by('username'), many=True).data)

    def post(self, request):
        staff(request)
        with transaction.atomic():
            user = save_form(CustomerForm(request.data))
            Profile.objects.create(user=user)
        return Response(UserSerializer(user).data, status=201)


@extend_schema_view(patch=extend_schema(responses=UserSerializer))
class CustomerDetail(APIView):
    serializer_class = CustomerUpdateInput
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        staff(request)
        user = get_object_or_404(get_user_model(), pk=pk, is_staff=False)
        if 'is_active' in request.data:
            if not isinstance(request.data['is_active'], bool):
                raise ValidationError({'is_active': 'A boolean is required.'})
            user.is_active = request.data['is_active']
            user.save(update_fields=['is_active'])
        elif 'new_password1' in request.data:
            form = SetPasswordForm(user, request.data)
            if not form.is_valid():
                raise ValidationError(form.errors)
            form.save()
            Profile.objects.update_or_create(user=user, defaults={'must_change_password': True})
        else:
            raise ValidationError('Choose an access or password update.')
        return Response(UserSerializer(user).data)


@extend_schema_view(post=extend_schema(responses={200: {"type": "object"}}))
class Upload(APIView):
    serializer_class = UploadInput
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        prop = get_object_or_404(properties(request), pk=pk)
        require(request.user, prop, 'upload')
        group = None
        if request.data.get('group'):
            try:
                group_id = int(request.data['group'])
            except (ValueError, TypeError):
                raise ValidationError({'group': 'Choose a valid room.'})
            group = get_object_or_404(Group, pk=group_id, property=prop)
        files = request.FILES.getlist('photos')
        if not 1 <= len(files) <= 10 or sum(f.size for f in files) > 64 * 1024 * 1024:
            raise ValidationError('Choose 1–10 photos, totalling no more than 64 MB.')
        from pathlib import Path
        result = []
        for file in files:
            name = Path(file.name).stem[:140]
            photo = None
            try:
                with transaction.atomic():
                    if prop.photos.filter(name=name).exists():
                        result.append({'name': name, 'ok': False, 'error': 'Already exists. Open the photo to add a version.'})
                        continue
                    photo = Photo.objects.create(property=prop, group=group, name=name)
                    add_version(photo, file)
                result.append({'name': name, 'ok': True, 'id': str(photo.pk)})
            except DjangoValidationError as exc:
                result.append({'name': name, 'ok': False, 'error': exc.messages[0]})
        return Response({'items': result})


@extend_schema_view(post=extend_schema(responses=VersionSerializer))
class Replacement(APIView):
    serializer_class = ReplacementInput
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        staff(request)
        from uuid import UUID
        try:
            key = UUID(str(request.data.get('request_id')))
        except (ValueError, TypeError):
            raise ValidationError({'request_id': 'A UUID is required.'})
        with transaction.atomic():
            photo = get_object_or_404(Photo.objects.select_for_update(), pk=pk)
            prior = Version.objects.filter(upload_request_id=key).first()
            if prior:
                if prior.photo_id != photo.pk:
                    raise ValidationError('Request identifier has already been used.')
                return Response(VersionSerializer(prior).data)
            if 'photo' not in request.FILES:
                raise ValidationError('Choose a replacement photograph.')
            try:
                version = add_version(photo, request.FILES['photo'], request.data.get('note', ''))
            except DjangoValidationError as exc:
                raise ValidationError(exc.messages)
            version.upload_request_id = key
            version.save(update_fields=['upload_request_id'])
        return Response(VersionSerializer(version).data, status=201)

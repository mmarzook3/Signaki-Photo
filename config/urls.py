from django.urls import path, include, re_path
from proofs import views as v
from proofs import spa
urlpatterns=[path('',spa.home,name='home'),path('healthz/',v.health,name='health'),path('login/',spa.legacy_bridge(v.login_view, '/app/'),name='login'),path('logout/',v.logout_view,name='logout'),path('password/',spa.legacy_bridge(v.password_view, '/app/account'),name='password'),path('customers/',spa.legacy_bridge(v.customers, '/app/customers'),name='customers'),path('customers/<int:pk>/',v.customer_edit,name='customer_edit'),path('properties/new/',v.property_new,name='property_new'),path('properties/<uuid:pk>/',spa.legacy_bridge(v.property_detail, '/app/properties/{pk}'),name='property'),path('properties/<uuid:pk>/edit/',v.property_edit,name='property_edit'),path('properties/<uuid:pk>/groups/',v.group_new,name='group_new'),path('properties/<uuid:pk>/upload/',v.upload,name='upload'),path('photos/<uuid:pk>/',spa.legacy_bridge(v.photo_detail, '/app/photos/{pk}'),name='photo'),path('photos/<uuid:pk>/edit/',v.photo_edit,name='photo_edit'),path('photos/<uuid:pk>/versions/',v.version_upload,name='version_upload'),path('comments/<uuid:pk>/resolve/',v.resolve_comment,name='resolve'),path('feedback/',spa.legacy_bridge(v.feedback, '/app/feedback'),name='feedback'),path('proof/<uuid:pk>/<str:size>/',v.proof,name='proof')]

urlpatterns = [path('api/v1/', include('proofs.api.urls'))] + urlpatterns

urlpatterns = [path("app/", spa.shell), path("app", spa.shell), re_path(r"^app/(?P<path>.*)$", spa.shell)] + urlpatterns

from drf_spectacular.views import SpectacularAPIView
urlpatterns = [path("api/schema/", SpectacularAPIView.as_view(), name="schema")] + urlpatterns

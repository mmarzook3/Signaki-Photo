from django.urls import path
from . import views as v
from . import collaboration as c

urlpatterns = [
    path('presets/',c.Presets.as_view()),
    path('properties/<uuid:pk>/settings/',c.GallerySettings.as_view()),
    path('properties/<uuid:pk>/decision/',c.PropertyDecision.as_view()),
    path('photos/<uuid:pk>/favorite/',c.PhotoFavorite.as_view()),
    path('photos/<uuid:pk>/label/',c.PhotoLabel.as_view()),
    path('versions/<uuid:pk>/information/',c.FileInformation.as_view()),
    path('versions/<uuid:pk>/download/',c.Download.as_view()),
    path('session/', v.Session.as_view()), path('password/', v.Password.as_view()),
    path('properties/', v.Properties.as_view()), path('properties/<uuid:pk>/', v.PropertyDetail.as_view()),
    path('properties/<uuid:pk>/groups/', v.Groups.as_view()), path('properties/<uuid:pk>/upload/', v.Upload.as_view()),
    path('photos/<uuid:pk>/', v.PhotoDetail.as_view()), path('photos/<uuid:pk>/versions/', v.Replacement.as_view()),
    path('versions/<uuid:pk>/decision/', v.Decision.as_view()), path('versions/<uuid:pk>/comments/', v.Comments.as_view()),
    path('comments/<uuid:pk>/resolve/', v.Resolve.as_view()), path('feedback/', v.Feedback.as_view()),
    path('customers/', v.Customers.as_view()), path('customers/<int:pk>/', v.CustomerDetail.as_view()),
]

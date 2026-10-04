from django.urls import path
from . import views as v

urlpatterns = [
    path('session/', v.Session.as_view()), path('password/', v.Password.as_view()),
    path('properties/', v.Properties.as_view()), path('properties/<uuid:pk>/', v.PropertyDetail.as_view()),
    path('properties/<uuid:pk>/groups/', v.Groups.as_view()), path('properties/<uuid:pk>/upload/', v.Upload.as_view()),
    path('photos/<uuid:pk>/', v.PhotoDetail.as_view()), path('photos/<uuid:pk>/versions/', v.Replacement.as_view()),
    path('versions/<uuid:pk>/decision/', v.Decision.as_view()), path('versions/<uuid:pk>/comments/', v.Comments.as_view()),
    path('comments/<uuid:pk>/resolve/', v.Resolve.as_view()), path('feedback/', v.Feedback.as_view()),
    path('customers/', v.Customers.as_view()), path('customers/<int:pk>/', v.CustomerDetail.as_view()),
]

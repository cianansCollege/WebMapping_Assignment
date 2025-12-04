from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    CafeOSMViewSet,
    cafes_near,
    cafes_closest,
    cafes_within_radius,
    counties,
    cafes_in_county
)

router = DefaultRouter()
router.register(r'cafes_osm', CafeOSMViewSet, basename='cafes_osm')

urlpatterns = [
    # REST API routes (includes /cafes_osm/)
    path('', include(router.urls)),

    # Custom endpoints
    path('nearby/', cafes_near, name='cafes_near'),
    path('closest_cafes/', cafes_closest, name='closest_cafes'),
    path('cafes_within_radius/', cafes_within_radius, name='cafes_within_radius'),
    path('counties/', counties, name='counties'),
    path("cafes_in_county/<str:county_name>/", cafes_in_county, name='cafes_in_county'),
]

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    CafeViewSet,
    CafeOSMViewSet,
    cafes_near,
    cafes_closest,
    cafes_within_quarter,
    quarters_geojson,
    cafes_within_radius,
)

router = DefaultRouter()
router.register(r'cafes', CafeViewSet, basename='cafe')
router.register(r'cafes_osm', CafeOSMViewSet, basename='cafes_osm')

urlpatterns = [
    # REST API routes
    path('', include(router.urls)),

    # Custom endpoints
    path('nearby/', cafes_near, name='cafes_near'),
    path('closest_cafes/', cafes_closest, name='cafes_closest'),
    path('within_quarter/<int:rank>/', cafes_within_quarter, name='cafes_within_quarter'),
    path('quarters/', quarters_geojson, name='quarters_geojson'),
    path('cafes_within_radius/', cafes_within_radius, name='cafes_within_radius'),
]

from rest_framework.routers import DefaultRouter
from .views import CafeViewSet, cafes_near, cafe_map, cafes_closest, cafes_within_quarter, quarters_geojson, cafes_within_radius
from django.urls import path, include
from rest_framework import routers

router = DefaultRouter()
router.register(r'cafes', CafeViewSet, basename='cafe')

urlpatterns = [
    # REST API routes (automatically handles /api/cafes/)
    path('', include(router.urls)),

    #my api endpoints
    path('nearby/', cafes_near, name='cafes_near'), # for testing 
    path('closest_cafes/', cafes_closest, name='cafes_closest'),
    path('within_quarter/<int:rank>/', cafes_within_quarter, name='cafes_within_quarter'),
    path('quarters/', quarters_geojson, name='quarters_geojson'),
    path('cafes_within_radius/', cafes_within_radius, name='cafes_within_radius'),
]
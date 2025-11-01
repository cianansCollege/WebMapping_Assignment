from rest_framework.routers import DefaultRouter
from .views import CafeViewSet, cafes_near, cafe_map, cafes_closest
from django.urls import path, include
from rest_framework import routers

router = DefaultRouter()
router.register(r'cafes', CafeViewSet, basename='cafe')

urlpatterns = [
    path('', include(router.urls)),
    path('nearby/', cafes_near, name='cafes_near'),
    path('closest_cafes/', cafes_closest, name='cafes_closest'),
]
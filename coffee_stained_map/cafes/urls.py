from rest_framework.routers import DefaultRouter
from .views import CafeViewSet
from django.urls import path, include
from .views import cafe_map
from rest_framework import routers

router = DefaultRouter()
router.register(r'cafes', CafeViewSet)

urlpatterns = [
    path('api/', include(router.urls)),
    path('map/', cafe_map, name='cafe_map'),
]
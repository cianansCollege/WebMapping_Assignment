from django.shortcuts import render

from rest_framework import viewsets
from .models import Cafe
from .serializers import CafeSerializer

class CafeViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Cafe.objects.all()
    serializer_class = CafeSerializer

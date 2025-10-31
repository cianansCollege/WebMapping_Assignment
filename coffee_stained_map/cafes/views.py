from django.shortcuts import render

from rest_framework import viewsets
from .models import Cafe
from .serializers import CafeSerializer

class CafeViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Cafe.objects.all()
    serializer_class = CafeSerializer

# def cafe_map(request):
#     return render(request, "cafes/map.html")

def cafe_map(request):
    return render(request, "cafes/map_inline.html")

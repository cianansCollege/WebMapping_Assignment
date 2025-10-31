from django.shortcuts import render
from rest_framework import viewsets
from .models import Cafe
from .serializers import CafeSerializer
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D

class CafeViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Cafe.objects.all()
    serializer_class = CafeSerializer

# def cafe_map(request):
#     return render(request, "cafes/map.html")

def cafe_map(request):
    return render(request, "cafes/map_inline.html")

@api_view(['GET'])
def cafes_near(request):
    lat = float(request.GET.get('lat', 53.334))
    lng = float(request.GET.get('lng', -6.264))
    distance = float(request.GET.get('distance', 500))

    ref_point = Point(lng, lat, srid=4326)
    #4326 - standard WGS84 GPS Coordinates
    nearby = Cafe.objects.filter(location__distance_lte=(ref_point, D(m=distance)))

    serializer = CafeSerializer(nearby, many = True)
    return Response(serializer.data)

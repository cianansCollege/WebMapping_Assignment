#Django + REST Framework imports
from django.shortcuts import render
from rest_framework import viewsets
from rest_framework.decorators import api_view
from rest_framework.response import Response

#GeoDjango imports
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D
from django.contrib.gis.db.models.functions import Distance

#Local app imports
from .models import Cafe
from .serializers import CafeSerializer


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

@api_view(['GET'])
def cafes_closest(request):
    lat = float(request.GET.get('lat', 53.334))
    lng = float(request.GET.get('lng', -6.264))
    distance = float(request.GET.get('distance', 500))

    ref_point = Point(lng, lat, srid=4326)

    closest_cafes = Cafe.objects.annotate(distance=Distance('location', ref_point)).order_by('distance')[:5]

    serializer = CafeSerializer(closest_cafes, many = True)
    return Response(serializer.data)


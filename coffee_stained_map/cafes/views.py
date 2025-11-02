#Django + REST Framework imports
from django.shortcuts import render
from rest_framework import viewsets
from rest_framework.decorators import api_view
from rest_framework.response import Response

#GeoDjango imports
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D
from django.contrib.gis.db.models.functions import Distance
from django.core.serializers import serialize

#Local app imports
from .models import Cafe, Quarter
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

@api_view(['GET'])
def cafes_within_quarter(request, rank):
    quarter = Quarter.objects.get(rank=rank)
    cafes = Cafe.objects.filter(location__within=quarter.boundary)
    serializer = CafeSerializer(cafes, many=True)
    return Response(serializer.data)

@api_view(['GET'])
def quarters_geojson(request):
    data =serialize('geojson', Quarter.objects.all(), geometry_field='boundary', fields=('name',))
    return Response(data)


from rest_framework import viewsets
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.http import JsonResponse
from django.contrib.gis.geos import Point
from django.contrib.gis.db.models.functions import Distance
from django.core.serializers import serialize
from .models import Cafe, Quarter
from .serializers import CafeSerializer
from django.shortcuts import render
from json import loads
from django.contrib.gis.measure import D


class CafeViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Cafe.objects.all()
    serializer_class = CafeSerializer

def cafe_map(request):
    return render(request, "map_inline.html")


@api_view(['GET'])
def cafes_near(request):
    """returns cafes within hardcoded distance of a point, for original testing"""
    try:
        lat = float(request.GET.get('lat'))
        lng = float(request.GET.get('lng'))
        distance = float(request.GET.get('distance', 500))
    except (TypeError, ValueError):
        return Response({"error": "Please supply valid lat, lng, and optional distance (m)"}, status=400)

    ref_point = Point(lng, lat, srid=4326)
    nearby = Cafe.objects.filter(location__distance_lte=(ref_point, distance))
    serializer = CafeSerializer(nearby, many=True)
    return Response(serializer.data)



@api_view(['GET'])
def cafes_closest(request):
    """returns 5 cafes nearest to coordinates given"""
    try:
        lat = float(request.GET.get('lat'))
        lng = float(request.GET.get('lng'))
    except (TypeError, ValueError):
        return Response({"error": "Provide numeric lat and lng"}, status=400)

    user_point = Point(lng, lat, srid=4326)
    qs = Cafe.objects.annotate(distance=Distance('location', user_point)).order_by('distance')[:5]
    serializer = CafeSerializer(qs, many=True)
    return Response(serializer.data)


@api_view(['GET'])
def cafes_within_quarter(request, rank):
    """returns cafes within the quarter specifeied using rank"""
    try:
        quarter = Quarter.objects.get(rank=rank)
    except Quarter.DoesNotExist:
        return Response({"error": f"No quarter found with rank {rank}"}, status=404)

    qs = Cafe.objects.filter(location__within=quarter.boundary)
    serializer = CafeSerializer(qs, many=True)
    return Response(serializer.data)


@api_view(['GET'])
def quarters_geojson(request):
    """returns quarter boundary"""
    data = serialize(
        'geojson',
        Quarter.objects.all(),
        geometry_field='boundary',
        fields=('name', 'rank'),
    )
    return JsonResponse(loads(data))


@api_view(['GET'])
def cafes_within_radius(request):
    """returns cafes within radius of a point given by user"""
    try:
        lat = float(request.GET.get('lat'))
        lng = float(request.GET.get('lng'))
        radius = float(request.GET.get('radius', 1000))
    except (TypeError, ValueError):
        return Response({"error": "Provide numeric lat, lng and radius"}, status=400)

    user_point = Point(lng, lat, srid=4326)
    qs = Cafe.objects.filter(location__distance_lte=(user_point, D(m=radius)))
    serializer = CafeSerializer(qs, many=True)
    return Response(serializer.data)
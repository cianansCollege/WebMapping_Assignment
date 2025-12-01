from django.shortcuts import render
from django.http import JsonResponse

from django.contrib.gis.geos import Point
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.measure import D

from rest_framework.decorators import api_view
from rest_framework import viewsets

from .models import CafeOSM, County
from .serializers import CafeOSMSerializer

import json


#renders the map
def cafe_map(request):
    return render(request, "map.html")

class CafeOSMViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = CafeOSM.objects.all()
    serializer_class = CafeOSMSerializer


def safe_title(value):
    if isinstance(value, str):
        value = value.strip()
        return value.title() if value else None
    return None


## API endpoint: /api/cafes_near/?lat=...&lng=...
@api_view(['GET'])
def cafes_near(request):
    lat = float(request.GET.get("lat"))
    lng = float(request.GET.get("lng"))
    radius = float(request.GET.get("radius", 1000))

    pt = Point(lng, lat, srid=4326)

    cafes = CafeOSM.objects.filter(
        geometry__distance_lte=(pt, D(m=radius))
    )

    serializer = CafeOSMSerializer(cafes, many=True)
    return JsonResponse(serializer.data, safe=False)


## API endpoint: /api/closest_cafes/?lat=...&lng=...
@api_view(['GET'])
def cafes_closest(request):
    lat = float(request.GET.get("lat"))
    lng = float(request.GET.get("lng"))
    limit = int(request.GET.get("limit", 5))

    user_location = Point(lng, lat, srid=4326)

    cafes = (
        CafeOSM.objects
        .annotate(distance=Distance("geometry", user_location))
        .order_by("distance")[:limit]
    )

    serializer = CafeOSMSerializer(cafes, many=True)
    return JsonResponse(serializer.data, safe=False)

# API endpoint: /api/cafes_within_radius/?lat=...&lng=...&radius=...
@api_view(['GET'])
def cafes_within_radius(request):
    lat = float(request.GET.get("lat"))
    lng = float(request.GET.get("lng"))
    radius = float(request.GET.get("radius", 500))  # metres

    user_location = Point(lng, lat, srid=4326)

    cafes = CafeOSM.objects.filter(
        geometry__distance_lte=(user_location, D(m=radius))
    )

    serializer = CafeOSMSerializer(cafes, many=True)
    return JsonResponse(serializer.data, safe=False)

@api_view(['GET'])
def counties(request):
    counties = County.objects.all()

    features = []
    for c in counties:

        # English name resolution
        english = (
            safe_title(c.english) or
            safe_title(c.countyname) or
            safe_title(c.county) or
            "Unknown County"
        )

        # Irish/Gaeilge name resolution
        gaeilge = (
            safe_title(c.gaeilge) or
            safe_title(c.contae) or
            "Gan Ainm"
        )

        # Province fallback
        province = safe_title(c.province) or "Ulster"

        features.append({
            "type": "Feature",
            "geometry": json.loads(c.wkb_geometry.geojson),
            "properties": {
                "english_name": english,
                "gaeilge_name": gaeilge,
                "province": province,
            }
        })

    return JsonResponse({
        "type": "FeatureCollection",
        "features": features
    })



@api_view(['GET'])
def cafes_in_county(request, county_name):
    try:
        county = County.objects.get(english__iexact=county_name)
    except County.DoesNotExist:
        return JsonResponse({"error": "County not found"}, status=404)

    cafes = CafeOSM.objects.filter(
        geometry__within=county.geometry
    )

    serializer = CafeOSMSerializer(cafes, many=True)
    return JsonResponse(serializer.data, safe=False)

# add cafes within county and filter by county later
from django.shortcuts import render
from django.http import JsonResponse

from django.contrib.gis.geos import Point
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.measure import D

from rest_framework.decorators import api_view
from rest_framework import viewsets

from .models import CafeOSM, Quarter, County
from .serializers import CafeOSMSerializer

import json


#renders the map
def cafe_map(request):
    return render(request, "map_inline.html")

class CafeOSMViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = CafeOSM.objects.all()
    serializer_class = CafeOSMSerializer


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



# API endpoint: /api/within_quarter/<rank>/
@api_view(['GET'])
def cafes_within_quarter(request, rank):
    # Get the quarter by rank (1–4)
    try:
        quarter = Quarter.objects.get(rank=rank)
    except Quarter.DoesNotExist:
        return JsonResponse({"error": "Quarter not found"}, status=404)

    # Spatial query: ST_Within(cafe, quarter boundary)
    cafes = CafeOSM.objects.filter(
        geometry__within=quarter.boundary
    )

    serializer = CafeOSMSerializer(cafes, many=True)
    return JsonResponse(serializer.data, safe=False)



# API endpoint: /api/quarters/
@api_view(['GET'])
def quarters_geojson(request):
    quarters = Quarter.objects.all()

    features = []
    for q in quarters:
        features.append({
            "type": "Feature",
            "geometry": json.loads(q.boundary.geojson),
            "properties": {
                "name": q.name,
                "rank": q.rank,
            }
        })

    return JsonResponse({
        "type": "FeatureCollection",
        "features": features
    })




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
        features.append({
            "type": "Feature",
            "geometry": json.loads(c.geometry.geojson),
            "properties": {
                "gaeilge": c.gaeilge,
                "name": c.english,        
                "province": c.province,
                "county": c.county,
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


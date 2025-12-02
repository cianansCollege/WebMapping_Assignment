# FILE: views.py
from django.shortcuts import render
from django.http import JsonResponse

from django.contrib.gis.geos import Point
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.measure import D
from django.db.models import Q

from rest_framework.decorators import api_view

from .models import CafeOSM, County
from .serializers import CafeOSMSerializer

import json


# FRONTEND MAP PAGE
def cafe_map(request):
    return render(request, "map.html")


# ---------------------------------------------
# HELPER — Convert queryset to FeatureCollection
# ---------------------------------------------
def cafes_to_featurecollection(cafes):
    """
    Convert a queryset of CafeOSM objects into a GeoJSON FeatureCollection
    using CafeOSMSerializer.
    """
    serializer = CafeOSMSerializer(cafes, many=True)
    features = serializer.data  # DRF GIS returns a list of Feature objects

    return {
        "type": "FeatureCollection",
        "features": features
    }


# ---------------------------------------------
# API — Load ALL cafés (GeoJSON)
# ---------------------------------------------
@api_view(['GET'])
def cafes_osm(request):
    cafes = CafeOSM.objects.all()
    return JsonResponse(cafes_to_featurecollection(cafes))


# ---------------------------------------------
# API — Cafés within radius
# /api/cafes_within_radius/?lat=..&lng=..&radius=..
# ---------------------------------------------
@api_view(['GET'])
def cafes_within_radius(request):
    lat = float(request.GET.get("lat"))
    lng = float(request.GET.get("lng"))
    radius = float(request.GET.get("radius", 500))

    pt = Point(lng, lat, srid=4326)

    cafes = CafeOSM.objects.filter(
        geometry__distance_lte=(pt, D(m=radius))
    )

    return JsonResponse(cafes_to_featurecollection(cafes))


# ---------------------------------------------
# API — Closest cafés
# /api/closest_cafes/?lat=..&lng=..&limit=5
# ---------------------------------------------
@api_view(['GET'])
def cafes_closest(request):
    lat = float(request.GET.get("lat"))
    lng = float(request.GET.get("lng"))
    limit = int(request.GET.get("limit", 5))

    pt = Point(lng, lat, srid=4326)

    cafes = (
        CafeOSM.objects
        .annotate(distance=Distance("geometry", pt))
        .order_by("distance")[:limit]
    )

    return JsonResponse(cafes_to_featurecollection(cafes))


# ---------------------------------------------
# API — Cafés near a point (same as radius)
# /api/cafes_near/?lat=..&lng=..&radius=..
# ---------------------------------------------
@api_view(['GET'])
def cafes_near(request):
    lat = float(request.GET.get("lat"))
    lng = float(request.GET.get("lng"))
    radius = float(request.GET.get("radius", 1000))

    pt = Point(lng, lat, srid=4326)

    cafes = CafeOSM.objects.filter(
        geometry__distance_lte=(pt, D(m=radius))
    )

    return JsonResponse(cafes_to_featurecollection(cafes))


# ---------------------------------------------
# API — County polygons (GeoJSON)
# /api/counties/
# ---------------------------------------------
@api_view(['GET'])
def counties(request):
    counties = County.objects.all()

    features = []
    for c in counties:

        # Resolve English name fallback
        english = (
            (c.english and c.english.strip()) or
            (c.countyname and c.countyname.strip()) or
            (c.county and c.county.strip()) or
            "Unknown County"
        ).title()

        # Resolve Gaeilge name fallback
        gaeilge = (
            (c.gaeilge and c.gaeilge.strip()) or
            (c.contae and c.contae.strip()) or
            "Gan Ainm"
        ).title()

        # Province fallback
        province = (c.province or "Unknown").title()

        # Build GeoJSON feature
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


# ---------------------------------------------
# API — Cafés inside a specific county
# /api/cafes_in_county/Dublin/
# ---------------------------------------------
@api_view(['GET'])
def cafes_in_county(request, county_name):

    county = County.objects.filter(
        Q(english__iexact=county_name) |
        Q(countyname__iexact=county_name) |
        Q(county__iexact=county_name) |
        Q(contae__iexact=county_name) |
        Q(gaeilge__iexact=county_name)
    ).first()

    if county is None:
        return JsonResponse({"error": f"County '{county_name}' not found"}, status=404)

    cafes = CafeOSM.objects.filter(
        geometry__within=county.wkb_geometry
    )

    return JsonResponse(cafes_to_featurecollection(cafes))

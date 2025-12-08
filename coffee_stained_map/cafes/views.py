# ------------------------------------------------------------
# IMPORTS
# ------------------------------------------------------------
from django.shortcuts import render
from django.http import JsonResponse

from django.contrib.gis.geos import Point
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.measure import D
from django.db.models import Q

from rest_framework.decorators import api_view
from rest_framework.viewsets import ReadOnlyModelViewSet

from .models import CafeOSM, County
from .serializers import CafeOSMSerializer

import json


# ------------------------------------------------------------
# FRONTEND PAGE
# ------------------------------------------------------------
def cafe_map(request):
    """Render the main map UI."""
    return render(request, "map.html")


# ------------------------------------------------------------
# VIEWSET — REST ENDPOINT FOR ALL CAFÉS (used by router)
# ------------------------------------------------------------
class CafeOSMViewSet(ReadOnlyModelViewSet):
    """
    ViewSet powering /api/cafes_osm/ when using DRF routers.
    This is the original endpoint the frontend was built around.
    """
    queryset = CafeOSM.objects.all()
    serializer_class = CafeOSMSerializer

def cafes_all(request):
    cafes = (
        CafeOSM.objects
        .only("name", "addr_city", "addr_street", "addr_postcode", "geometry")
        .values("name", "addr_city", "addr_street", "addr_postcode", "geometry")
    )

    features = []
    for c in cafes:
        geom = c["geometry"]
        if geom:
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [geom.x, geom.y],
                },
                "properties": {
                    "name": c["name"],
                    "addr_city": c["addr_city"],
                    "addr_street": c["addr_street"],
                    "addr_postcode": c["addr_postcode"],
                }
            })

    data = {"type": "FeatureCollection", "features": features}
    return JsonResponse(data)


# ------------------------------------------------------------
# HELPER — Convert QuerySets to GeoJSON FeatureCollection
# ------------------------------------------------------------
def cafes_to_featurecollection(cafes):
    serializer = CafeOSMSerializer(cafes, many=True)
    return serializer.data 


# ============================================================
# CUSTOM API ENDPOINTS (FUNCTION-BASED VIEWS)
# ============================================================

# ------------------------------------------------------------
# GET ALL CAFÉS (GeoJSON) — manual endpoint
# /api/cafes_osm/  (duplicate of ViewSet but needed for utility)
# ------------------------------------------------------------
@api_view(['GET'])
def cafes_osm(request):
    cafes = CafeOSM.objects.all()
    return JsonResponse(cafes_to_featurecollection(cafes))


# ------------------------------------------------------------
# CAFÉS WITHIN RADIUS
# /api/cafes_within_radius/?lat=..&lng=..&radius=..
# ------------------------------------------------------------
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


# ------------------------------------------------------------
# CLOSEST CAFÉS TO A POINT
# /api/closest_cafes/?lat=..&lng=..&limit=5
# ------------------------------------------------------------
@api_view(['GET'])
def cafes_closest(request):
    print("### USING THIS cafes_closest VIEW ###")

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


# ------------------------------------------------------------
# CAFÉS NEAR A POINT (same logic as radius, different name)
# /api/cafes_near/?lat=..&lng=..&radius=..
# ------------------------------------------------------------
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


# ------------------------------------------------------------
# ALL COUNTY POLYGONS (GeoJSON)
# /api/counties/
# ------------------------------------------------------------
@api_view(['GET'])
def counties(request):
    counties = County.objects.all()
    features = []

    for c in counties:

        # Clean English name fallback
        english = (
            (c.english and c.english.strip()) or
            (c.countyname and c.countyname.strip()) or
            (c.county and c.county.strip()) or
            "Unknown County"
        ).title()

        # Clean Gaeilge name fallback
        gaeilge = (
            (c.gaeilge and c.gaeilge.strip()) or
            (c.contae and c.contae.strip()) or
            "Gan Ainm"
        ).title()

        # Province fallback
        province = (c.province or "Unknown").title()

        # Assemble GeoJSON feature
        features.append({
            "type": "Feature",
            "geometry": json.loads(c.geometry.geojson),
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


# ------------------------------------------------------------
# CAFÉS INSIDE A SPECIFIC COUNTY (polygon filter)
# /api/cafes_in_county/<name>/
# ------------------------------------------------------------
@api_view(['GET'])
def cafes_in_county(request, county_name):

    # Allow matches on English, Gaeilge, and dataset variants
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
        geometry__within=county.geometry
    )

    return JsonResponse(cafes_to_featurecollection(cafes))

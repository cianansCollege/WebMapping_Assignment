from django.shortcuts import render
from django.http import JsonResponse
from django.db import connection
from django.contrib.gis.geos import Point
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.measure import D
from django.db.models import Q
from rest_framework.decorators import api_view
from rest_framework.viewsets import ReadOnlyModelViewSet
from .models import CafeOSM, County
from .serializers import CafeOSMSerializer
import json


# FRONTEND: render main map template
def cafe_map(request):
    return render(request, "map.html")


# VIEWSET: list all cafes (used by DRF router)
class CafeOSMViewSet(ReadOnlyModelViewSet):
    queryset = CafeOSM.objects.all()
    serializer_class = CafeOSMSerializer


# MANUAL ENDPOINT: all cafes as GeoJSON
def cafes_all(request):
    cafes = (
        CafeOSM.objects
        .values("ogc_fid", "name", "addr_city", "addr_street", "addr_postcode", "geometry")
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
                    "id": c["ogc_fid"],   # <-- JSON ID is now correct
                    "name": c["name"],
                    "addr_city": c["addr_city"],
                    "addr_street": c["addr_street"],
                    "addr_postcode": c["addr_postcode"],
                }
            })

    return JsonResponse({
        "type": "FeatureCollection",
        "features": features
    })



# Convert queryset of cafes into FeatureCollection via serializer
def cafes_to_featurecollection(cafes):
    serializer = CafeOSMSerializer(cafes, many=True)
    return serializer.data


# GET ALL CAFES (old)
# @api_view(['GET'])
# def cafes_osm(request):
#     cafes = CafeOSM.objects.all()
#     return JsonResponse(cafes_to_featurecollection(cafes))


# CAFES WITHIN RADIUS OF A POINT
@api_view(['GET'])
def cafes_within_radius(request):
    # Extract query parameters
    lat = float(request.GET.get("lat"))
    lng = float(request.GET.get("lng"))
    radius = float(request.GET.get("radius", 500))

    # Construct point in WGS84
    pt = Point(lng, lat, srid=4326)

    # Spatial filter using PostGIS distance function
    cafes = CafeOSM.objects.filter(
        geometry__distance_lte=(pt, D(m=radius))
    )

    return JsonResponse(cafes_to_featurecollection(cafes))


# CLOSEST CAFES TO A POINT
@api_view(['GET'])
def cafes_closest(request):
    lat = float(request.GET.get("lat"))
    lng = float(request.GET.get("lng"))
    limit = int(request.GET.get("limit", 5))

    pt = Point(lng, lat, srid=4326)

    # Annotate each cafe with distance and order by it
    cafes = (
        CafeOSM.objects
        .annotate(distance=Distance("geometry", pt))
        .order_by("distance")[:limit]
    )

    return JsonResponse(cafes_to_featurecollection(cafes))


# ALIAS: cafes near a point (same as radius search)
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


# COUNTY POLYGONS AS GEOJSON
@api_view(['GET'])
def counties(request):
    # Raw SQL for fast GeoJSON extraction
    sql = """
        SELECT
            COALESCE(NULLIF(english, ''), NULLIF(countyname,''), 
                     NULLIF(county,''), 'Unknown County') AS english_name,
            COALESCE(NULLIF(gaeilge,''), NULLIF(contae,''), 'Gan Ainm') AS gaeilge_name,
            COALESCE(province, 'Unknown') AS province,
            ST_AsGeoJSON(
                ST_SimplifyPreserveTopology(geometry, 0.001)
            ) AS geom
        FROM counties;
    """

    with connection.cursor() as cursor:
        cursor.execute(sql)
        rows = cursor.fetchall()

    # Build FeatureCollection manually
    features = []
    for english, gaeilge, province, geom in rows:
        features.append({
            "type": "Feature",
            "geometry": json.loads(geom),
            "properties": {
                "english_name": english.title(),
                "gaeilge_name": gaeilge.title(),
                "province": province.title(),
            }
        })

    return JsonResponse({"type": "FeatureCollection", "features": features})


# CAFES INSIDE A SPECIFIC COUNTY POLYGON
@api_view(['GET'])
def cafes_in_county(request, county_name):
    # Match on multiple possible county name fields
    county = County.objects.filter(
        Q(english__iexact=county_name) |
        Q(countyname__iexact=county_name) |
        Q(county__iexact=county_name) |
        Q(contae__iexact=county_name) |
        Q(gaeilge__iexact=county_name)
    ).first()

    if county is None:
        return JsonResponse({"error": f"County '{county_name}' not found"}, status=404)

    # Spatial filter using ST_Within
    cafes = CafeOSM.objects.filter(
        geometry__within=county.geometry
    )

    return JsonResponse(cafes_to_featurecollection(cafes))

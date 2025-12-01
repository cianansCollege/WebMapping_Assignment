from django.contrib import admin
from django.contrib.gis.admin import GISModelAdmin
from .models import County, CafeOSM

# Register OSM cafes (read-only)
@admin.register(CafeOSM)
class CafeOSMAdmin(GISModelAdmin):
    list_display = ("osm_id", "name", "addr_city")
    readonly_fields = ("osm_id", "name", "amenity", "addr_city", "addr_street", "addr_postcode", "geometry")

@admin.register(County)
class CountyAdmin(GISModelAdmin):
    list_display = ("english", "gaeilge", "province")
    readonly_fields = (
        "ogc_fid",
        "wkb_geometry",
        "co_id",
        "countyname",
        "english",
        "gaeilge",
        "scribes",
        "logainm_id",
        "guid",
        "contae",
        "county",
        "province",
        "centroid_x",
        "centroid_y",
        "area",
        "objectid",
        "shape_area",
        "shape_length",
    )
    search_fields = ("english", "gaeilge", "countyname", "contae")
    list_filter = ("province",)
    ordering = ("english",)
from django.contrib import admin
from django.contrib.gis.admin import GISModelAdmin
from .models import County, CafeOSM

# Register OSM cafes (read-only)
@admin.register(CafeOSM)
class CafeOSMAdmin(GISModelAdmin):
    list_display = ("osm_id", "name", "addr_city")
    readonly_fields = ("osm_id", "name", "amenity", "addr_city", "addr_street", "addr_postcode", "geometry")

# Register counties
@admin.register(County)
class CountyAdmin(GISModelAdmin):
    list_display = ("english", "gaeilge", "province")
    readonly_fields = (
        "gid",
        "co_id",
        "english",
        "gaeilge",
        "scribes",
        "logainm_id",
        "county",
        "province",
        "geometry",
    )
    search_fields = ("gaeilge", "english")
    list_filter = ("province",)
    ordering = ("english",)

from django.contrib import admin
from django.contrib.gis.admin import GISModelAdmin
from .models import Quarter, CafeOSM

# Register OSM cafes (read-only)
@admin.register(CafeOSM)
class CafeOSMAdmin(GISModelAdmin):
    list_display = ("osm_id", "name", "addr_city")
    readonly_fields = ("osm_id", "name", "amenity", "addr_city", "addr_street", "addr_postcode", "geometry")

# Register quarters
@admin.register(Quarter)
class QuarterAdmin(GISModelAdmin):
    list_display = ("name", "rank")

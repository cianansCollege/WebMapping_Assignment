from django.contrib import admin
from django.contrib.gis import admin
from .models import Cafe, Quarter

# Register your models here.

@admin.register(Cafe)
class CafeAdmin(admin.OSMGeoAdmin):
    list_display = ('name', 'address')

@admin.register(Quarter)
class QuarterAdmin(admin.OSMGeoAdmin):
    list_display = ('name', 'rank')

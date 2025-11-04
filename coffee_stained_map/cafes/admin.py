from django.contrib import admin
from django.contrib.gis.admin import GISModelAdmin
from .models import Cafe, Quarter

#registers cafe and quarter to be used in admin interface
@admin.register(Cafe)
class CafeAdmin(GISModelAdmin):
    list_display = ("name", "address", "rating")


@admin.register(Quarter)
class QuarterAdmin(GISModelAdmin):
    list_display = ("name", "rank")

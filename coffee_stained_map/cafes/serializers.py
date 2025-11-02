from rest_framework_gis.serializers import GeoFeatureModelSerializer
from rest_framework import serializers
from .models import Cafe

class CafeSerializer(GeoFeatureModelSerializer):
    distance = serializers.SerializerMethodField()

    class Meta:
        model = Cafe
        geo_field = 'location'
        fields = ('id', 'name', 'address', 'rating', 'distance')

    def get_distance(self, obj):
        if hasattr(obj, 'distance'):
            return round(obj.distance.m, 2)
        return None

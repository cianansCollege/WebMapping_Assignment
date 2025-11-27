from rest_framework_gis.serializers import GeoFeatureModelSerializer
from rest_framework import serializers
from .models import Cafe
from .models import CafeOSM

#the serializer converts the cafe model into GeoJSON for the map display
class CafeSerializer(GeoFeatureModelSerializer):
    distance = serializers.SerializerMethodField()

    class Meta:
        model = Cafe
        geo_field = 'location'
        fields = ('id', 'name', 'address', 'rating', 'distance')

    #distance (connected to the above line too), is only added when annotated queries are used eg. closest-cafes
    def get_distance(self, obj):
        #return km or meters
        if hasattr(obj, "distance") and obj.distance is not None:
            #return in km if over 1000m
            meters = obj.distance.m
            if meters >= 1000:
                return f"{round(meters/1000, 1)}km"
            else:
                return f"{round(meters)}m"
        return None


class CafeOSMSerializer(GeoFeatureModelSerializer):
    class Meta:
        model = CafeOSM
        geo_field = 'geometry'
        fields = ('ogc_fid', 'osm_id', 'name', 'amenity',
                  'addr_city', 'addr_street', 'addr_postcode')

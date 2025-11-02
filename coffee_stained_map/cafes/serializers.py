from rest_framework_gis.serializers import GeoFeatureModelSerializer
from .models import Cafe

class CafeSerializer(GeoFeatureModelSerializer):
    class Meta:
        model = Cafe
        geo_field = 'location'  # important: tells serializer to output geometry
        fields = ('id', 'name', 'address', 'rating')

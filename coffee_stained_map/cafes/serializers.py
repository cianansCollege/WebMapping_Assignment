from rest_framework_gis.serializers import GeoFeatureModelSerializer
from .models import CafeOSM

class CafeOSMSerializer(GeoFeatureModelSerializer):
    class Meta:
        model = CafeOSM
        geo_field = 'geometry'
        fields = (
            'ogc_fid',
            'osm_id',
            'name',
            'amenity',
            'addr_city',
            'addr_street',
            'addr_postcode',
        )

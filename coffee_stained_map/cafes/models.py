from django.db import models
from django.contrib.gis.db import models
from django.db.models import Index
from django.contrib.gis.db import models

class CafeOSM(models.Model):
    ogc_fid = models.AutoField(primary_key=True)
    osm_id = models.CharField(max_length=100, null=True, blank=True)
    name = models.CharField(max_length=200, null=True, blank=True)
    amenity = models.CharField(max_length=100, null=True, blank=True)
    addr_city = models.CharField(max_length=100, null=True, blank=True)
    addr_street = models.CharField(max_length=200, null=True, blank=True)
    addr_postcode = models.CharField(max_length=20, null=True, blank=True)
    geometry = models.PointField(srid=4326, db_column='wkb_geometry')

    class Meta:
        db_table = 'cafes_osm'
        managed = False


class County(models.Model):
    gid = models.IntegerField(primary_key=True)
    co_id = models.CharField(max_length=20, null=True, db_column="co_id")
    gaeilge = models.CharField(max_length=100, null=True, db_column="gaeilge")
    english = models.CharField(max_length=100, null=True, db_column="english")
    scribes = models.CharField(max_length=10, null=True, db_column="scribes")
    logainm_id = models.CharField(max_length=20, null=True, db_column="logainm_id")
    county = models.CharField(max_length=100, null=True, db_column="county")
    province = models.CharField(max_length=50, null=True, db_column="province")
    geometry = models.MultiPolygonField(srid=4326)

    class Meta:
        managed = False
        db_table = "counties"


    
    # add indexing later
from django.contrib.gis.db import models
from django.db.models import Index

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
    ogc_fid = models.IntegerField(primary_key=True, db_column="ogc_fid")

    geometry = models.MultiPolygonField(srid=4326, db_column="geometry")

    co_id = models.CharField(max_length=20, null=True, db_column="co_id")
    countyname = models.CharField(max_length=200, null=True, db_column="countyname")
    english = models.CharField(max_length=200, null=True, db_column="english")
    scribes = models.CharField(max_length=10, null=True, db_column="scribes")
    gaeilge = models.CharField(max_length=200, null=True, db_column="gaeilge")
    logainm_id = models.CharField(max_length=20, null=True, db_column="logainm_id")
    guid = models.CharField(max_length=100, null=True, db_column="guid")
    contae = models.CharField(max_length=200, null=True, db_column="contae")
    county = models.CharField(max_length=200, null=True, db_column="county")
    province = models.CharField(max_length=50, null=True, db_column="province")

    centroid_x = models.FloatField(null=True, db_column="centroid_x")
    centroid_y = models.FloatField(null=True, db_column="centroid_y")
    area = models.FloatField(null=True, db_column="area")
    objectid = models.IntegerField(null=True, db_column="objectid")
    shape_area = models.FloatField(null=True, db_column="shape__area")
    shape_length = models.FloatField(null=True, db_column="shape__length")

    class Meta:
        managed = False
        db_table = "counties"



    
    # add indexing later
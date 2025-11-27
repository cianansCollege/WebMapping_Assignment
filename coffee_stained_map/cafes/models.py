from django.db import models
from django.contrib.gis.db import models
from django.db.models import Index
from django.contrib.gis.db import models

#model for quarter in project, to divide dublin in 4 polygons
class Quarter(models.Model):
    name = models.CharField(max_length=15)
    #eg. (name: north-east, rank 1), (name: south-west, rank: 4)
    rank = models.IntegerField()
    boundary = models.PolygonField()

    def __str__(self):
        return self.name
    
    #GIST spatial index to speed up the within queries
    class Meta:
        indexes = [
            Index(fields=["boundary"], name="quarter_boundary_gist", opclasses=["gist"])
        ]
    

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
    co_id = models.CharField(max_length=20, null=True)
    english = models.CharField(max_length=100, null=True)
    scribe = models.CharField(max_length=10, null=True)
    gaeilge = models.CharField(max_length=100, null=True)
    logainm_id = models.CharField(max_length=20, null=True)
    county = models.CharField(max_length=100, null=True)
    province = models.CharField(max_length=50, null=True)
    geometry = models.MultiPolygonField(srid=4326)

    class Meta:
        managed = False
        db_table = "counties"

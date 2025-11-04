from django.db import models
from django.contrib.gis.db import models
from django.db.models import Index
from django.contrib.gis.db import models

#model for cafes in project
class Cafe(models.Model):
    name = models.CharField(max_length=100)
    address = models.CharField(max_length=200)
    #location is whats used for the spatial queries
    location = models.PointField()
    rating = models.FloatField(default=0.0)

    def __str__(self):
        return self.name
    
    #GIST spatial index to speed up the spatial lookups
    class Meta:
        indexes = [
            Index(fields=["location"], name="cafe_location_gist", opclasses=["gist"])
        ]

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
    

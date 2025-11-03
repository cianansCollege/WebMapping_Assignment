from django.db import models
from django.contrib.gis.db import models

class Cafe(models.Model):
    name = models.CharField(max_length=100)
    address = models.CharField(max_length=200)
    location = models.PointField()
    rating = models.FloatField(default=0.0)

    def __str__(self):
        return self.name
    
class Quarter(models.Model):
    name = models.CharField(max_length=15)
    #eg. (name: north-east, rank 1), (name: south-west, rank: 4)
    rank = models.IntegerField()
    boundary = models.PolygonField()

    def __str__(self):
        return self.name
    

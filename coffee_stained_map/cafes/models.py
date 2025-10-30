from django.db import models
from django.contrib.gis.db import models

class Cafe(models.Model):
    name = models.CharField(max_length=100)
    address = models.CharField(max_length=200)
    location = models.PointField()
    rating = models.FloatField(default=0.0)

    def _str_(self):
        return self.name
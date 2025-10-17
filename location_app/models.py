from django.contrib.gis.db import models

class PointOfInterest(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    location = models.PointField()

    def __str__(self):
        return self.name

from django.test import TestCase
from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse
from django.contrib.gis.geos import Point
from cafes.models import Cafe

class CafeAPITestCase(APITestCase):
    """Simple API test for the cafes endpoint"""

    def setUp(self):
        self.cafe = Cafe.objects.create(
            name="Brew Hub",
            address="95 Some Street, Dublin",
            rating=4.5,
            location=Point(-6.2642, 53.3342, srid=4326)
        )

    def test_cafe_list_returns_200(self):
        """Check that the café list endpoint responds successfully"""
        response = self.client.get("/api/cafes/")  # change to your endpoint if needed
        self.assertEqual(response.status_code, status.HTTP_200_OK)


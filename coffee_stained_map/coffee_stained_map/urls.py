from django.contrib import admin
from django.urls import path, include
from cafes.views import cafe_map 
from django.shortcuts import redirect

def home_redirect(request):
    return redirect('cafe_map')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('cafes.urls')),  # API endpoints
    path('map/', cafe_map, name='cafe_map'),  # frontend map page
    path('', home_redirect),
]


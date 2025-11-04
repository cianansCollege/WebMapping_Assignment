README.md including:

    Application description and features
    Setup instructions (local and cloud deployment)
    Technology stack details
    Screenshot(s) of running application
    Known issues or limitations
    API documentation (if applicable)

Application Description:
    My project is a web application that lets a user view cafes nearby on an interactive map.

    Users can:
        -View all cafes on the map.
        -Filter cafes by quarter.
        -Toggle visibility of the quarters.
        -Find the 5 closest cafes from a given location.
        -Search for cafes within a radius.

Features:
    Interactive Map - Leaflet map displaying cafes as markers and polygon quarters
    Spatial Queries - You can find the nearest cafes, cafes within a polygon(I use quarters), or cafes within a radius.
    GeoJSON API - REST endpoint return data in GeoJSON
    Responsive - Used Bootstrap to make it useable on computer and mobile devices.
    Docker Deployment - with Django, PostGIS and pgAdmin

Setup instructions (local and cloud deployment):
    Local:
        Requirements:
            Python 3.11
            PostgreSQL with PostGIS 
        Steps:
            # 1. Clone the repository
            cd coffee_stained_map

            # 2. Create a virtual environment
            python3 -m venv .venv
            source .venv/bin/activate

            # 3. Install dependencies
            pip install -r requirements.txt

            # 4. Create database and enable PostGIS
            psql -U postgres
            CREATE DATABASE coffee_map;
            \c coffee_map
            CREATE EXTENSION postgis;
            \q

            # 5. Apply migrations and load data
            python manage.py migrate
            python manage.py loaddata quarters.json
            python manage.py loaddata cafes.json

            # 6. Run server
            python manage.py runserver  

Technology Stack:
    Frontend - Leaflet and Bootstrap
    Backend - Django 4.2 and GeoDjango
    Database - PostgreSQL and PostGIS
    API - Django REST Framework
    Deploymentv - Docker

Screenshots of running application:
    -See AppFunctioningScreenshots.pdf


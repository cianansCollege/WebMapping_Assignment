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
            1. Clone the repository : https://github.com/cianansCollege/WebMapping_Assignment
                cd WebMapping_Assignment/coffee_stained_map

            2. Create a virtual environment
                python3 -m venv .venv
                source .venv/bin/activate

            3. Install dependencies
                pip install -r requirements.txt

            4. Create database and enable PostGIS
                psql -U postgres
                CREATE DATABASE coffee_map;
                \c coffee_map
                CREATE EXTENSION postgis;
                \q

            5. Apply migrations and load data
                python manage.py migrate
                python manage.py loaddata quarters.json
                python manage.py loaddata cafes.json

            6. Run server
                python manage.py runserver  

    Cloud:
        1. Build and start all services
            docker compose build
            docker compose up

        2. Access the application
            Django App → http://127.0.0.1:8000  
            PgAdmin → http://127.0.0.1:8000/admin/


API Documenation:
    /api/cafes/ - GET Method to view all cafes in GeoJSON Format

    /api/cafes_near/?lat=__&lng=__ - GET Method to view cafes within hardcoded distance to point given

    /api/closest_cafes/?lat=__&lng=__ - GET Method to view 5 closest cafes to point given

    /api/within_quarter/<rank>/ - GET Method to view all cafes within a quarter

    /api/cafes_within_radius/?lat=__&lng=__&radius=__ - GET Method to view all cafes within radius of given point

    /api/quarters/ - GET Method to view all quarters


Technology Stack:
    Frontend - Leaflet and Bootstrap
    Backend - Django 4.2 and GeoDjango
    Database - PostgreSQL and PostGIS
    API - Django REST Framework
    Deploymentv - Docker

Screenshots of running application:
    -See AppFunctioningScreenshots.pdf


Known Issues:
    -Can't remove radius without refreshing page.
    -List of cafes appears below map.
    -No way for user to get current coordinates/click on screen for coordinates. Clunky design.

Architecture:
    Frontend(Leaflet and Bootstrap)
        Sends/Receieves data via HTTP
    ↓
    API Layer(Django REST Framework)
        Executes the spatial queries
    ↓
    Database
        Returns requested info
    ↓
    Docker(Web + Database + PgAdmin)
    

Author:
    Cianán Finn, TU856

Module: Advanced Web Mapping
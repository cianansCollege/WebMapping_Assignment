# Coffee Stained Map

Location-Based Services Application | Advanced Web Mapping CA2 | TU Dublin

## 1. Overview

Coffee Stained Map is a full-stack Location-Based Services (LBS) application that allows users to explore cafés across Ireland using an interactive map.
It provides spatial search tools, mobile-friendly use, and a hybrid mobile deployment using Apache Cordova.

The project consists of three main components:

1. Django + GeoDjango backend (REST API)
2. PostgreSQL/PostGIS spatial database
3. Leaflet-based web client and Cordova hybrid mobile app

The app supports live GPS tracking, routing, spatial filtering, and real-time map interaction.

---

## 2. Features

### Core Functionality

* Interactive map using Leaflet and OpenStreetMap
* View all cafés stored in a PostGIS spatial database
* Filter cafés by county
* Toggle visibility of county polygons
* Find the nearest cafés to a chosen point
* Find cafés within a radius
* Pick coordinates directly from the map
* Use browser or mobile device GPS
* Live tracking mode with dynamic updates
* Routing from user's location to any café
* Clustered café markers for easier browsing

### Mobile (Cordova) Features

* Fully responsive layout
* Map optimised for small screens
* Buttons for quick radius and nearest-café searches
* Works offline after installation (PWA behaviour where supported)

### Deployment

* Docker container for Django server
* Cloud deployment via Render
* API publicly accessible for the mobile app

---

## 3. Technology Stack

### Frontend

* Leaflet JS
* Leaflet Routing Machine
* Leaflet MarkerCluster
* Bootstrap 5
* Cordova hybrid mobile app

### Backend

* Django 4.2
* Django REST Framework
* GeoDjango spatial tools
* Custom SQL + ORM-based spatial queries

### Database

* PostgreSQL
* PostGIS (geometry handling, distance queries, polygon intersections)

### Deployment

* Docker
* Render (cloud hosting)

---

## 4. Local Setup Instructions

### Requirements

* Python 3.11
* PostgreSQL 15 or later
* PostGIS extension
* GDAL installed (required for GeoDjango)

### Steps

1. Clone the repository:

   ```
   git clone https://github.com/cianansCollege/WebMapping_Assignment
   cd WebMapping_Assignment/coffee_stained_map
   ```

2. Create and activate a virtual environment:

   ```
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. Install Python dependencies:

   ```
   pip install -r requirements.txt
   ```

4. Create a database and enable PostGIS:

   ```
   psql -U postgres
   CREATE DATABASE coffee_map;
   \c coffee_map
   CREATE EXTENSION postgis;
   ```

5. Apply Django migrations:

   ```
   python manage.py migrate
   ```

6. Load required datasets (counties and cafés):

   ```
   python manage.py loaddata counties.json
   python manage.py loaddata cafes.json
   ```

7. Run the development server:

   ```
   python manage.py runserver
   ```

---

## 5. Cloud Deployment (Docker + Render)

### Build Docker image locally

```
docker compose build
docker compose up
```

### Access services

* Django App: [http://localhost:8000](http://localhost:8000)
* PgAdmin (if enabled): [http://localhost:8080](http://localhost:8080)

### Deploy to Render

* Push repo to GitHub
* Create new Web Service
* Use Docker deployment
* Add environment variables (SECRET_KEY, DEBUG, database URL)
* Render will build and run the container

---

## 6. API Documentation

### Cafés

| Endpoint                                            | Description                            |
| --------------------------------------------------- | -------------------------------------- |
| `/api/cafes_all/`                                   | All cafés as GeoJSON FeatureCollection |
| `/api/closest_cafes/?lat=..&lng=..&limit=5`         | Closest cafés to a point               |
| `/api/cafes_within_radius/?lat=..&lng=..&radius=..` | Cafés within a radius                  |
| `/api/cafes_near/?lat=..&lng=..&radius=..`          | Alias of radius search                 |
| `/api/cafes_osm/`                                   | Raw CaféOSM dataset (DRF ViewSet)      |

### Counties

| Endpoint                       | Description                           |
| ------------------------------ | ------------------------------------- |
| `/api/counties/`               | All counties with simplified geometry |
| `/api/cafes_in_county/<name>/` | Cafés located inside a named county   |

All endpoints return GeoJSON formatted responses.

---

## 7. Architecture Overview

```
Frontend (Leaflet, Bootstrap, Cordova)
        |
        v
Django REST API (GeoDjango)
        |
        v
PostgreSQL + PostGIS
        |
        v
Cloud Deployment (Docker + Render)
```

* Spatial queries executed by PostGIS
* API layer serializes data into GeoJSON
* Leaflet renders markers, polygons, routes
* Cordova bundles the web app for Android deployment

---

## 8. Screenshots

Screenshots included in:

```
AppFunctioningScreenshots.pdf
```

---

## 9. Known Issues or Limitations

* Rendering many county polygons may be slow on older devices
* Routing depends on third-party services (OSRM; availability may vary)
* GPS accuracy will differ by device
* The Cordova app requires device permissions for location
* Minor UI spacing adjustments may be needed on very small screens

---

## 10. Testing

Run Django tests:

```
docker exec -it coffee_stained_map-web-1 bash
python manage.py test cafes
```

Connect to PostGIS:

```
docker exec -it coffee_stained_map-db-1 psql -U webmapping -d coffee_map
```

---

## 11. Author and Module Information

**Author:**
Cianán Finn
TU Dublin – Computer Science
Student ID: C22393223

**Module:**
Advanced Web Mapping (CA2)

---
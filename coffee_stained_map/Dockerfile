# Base image: Python 3.11 slim
FROM python:3.11-slim

# Prevent Python generating .pyc & buffering stdout
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1


# Install system dependencies needed by GeoDjango
RUN apt-get update && apt-get install -y \
    binutils libproj-dev gdal-bin python3-gdal gcc libgeos-dev libgdal-dev postgis netcat-traditional \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /app

# Copy Python dependencies first (to leverage Docker caching)
COPY requirements.txt /app/

# Install Python dependencies (must include gunicorn)
RUN pip install --no-cache-dir -r requirements.txt

# Copy all project files into container
COPY . /app/

# Expose Django's port
EXPOSE 8000

ENV DJANGO_SETTINGS_MODULE=coffee_stained_map.settings

# Run migrations, collectstatic, then start Gunicorn
CMD ./wait_for_db.sh && \
    python manage.py migrate && \
    python manage.py collectstatic --noinput && \
    gunicorn coffee_stained_map.wsgi:application --bind 0.0.0.0:8000

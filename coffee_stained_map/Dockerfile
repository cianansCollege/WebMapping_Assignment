# Base image: Python 3.11 slim
FROM python:3.11-slim

# Prevents Python from writing pyc files & buffering stdout
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

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy all project files into container
COPY . /app/

# Expose Django's development port
EXPOSE 8000

# Default command: run migrations, then start the dev server
CMD ["./wait_for_db.sh", "python", "manage.py", "runserver", "0.0.0.0:8000"]


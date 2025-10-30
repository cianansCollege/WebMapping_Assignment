import csv
import random

# Dublin coordinates roughly
lat_min, lat_max = 53.33, 53.36
lon_min, lon_max = -6.28, -6.24

# random café name parts
names_start = ["Café", "Coffee", "Bean", "Latte", "Brew", "Mocha", "Espresso"]
names_end = ["Central", "Hub", "Lounge", "Corner", "House", "Spot", "Station"]

with open('cafes.csv', 'w', newline='', encoding='utf-8') as csvfile:
    fieldnames = ['name', 'address', 'longitude', 'latitude', 'rating']
    writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
    writer.writeheader()

    for i in range(30):
        name = f"{random.choice(names_start)} {random.choice(names_end)}"
        address = f"{random.randint(1, 100)} Some Street, Dublin"
        lon = round(random.uniform(lon_min, lon_max), 6)
        lat = round(random.uniform(lat_min, lat_max), 6)
        rating = round(random.uniform(3.0, 5.0), 1)
        writer.writerow({
            'name': name,
            'address': address,
            'longitude': lon,
            'latitude': lat,
            'rating': rating
        })

print("cafes.csv generated with 30 random cafés around Dublin.")

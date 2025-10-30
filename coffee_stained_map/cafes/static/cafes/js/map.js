// map.js — Coffee Stained Map
document.addEventListener("DOMContentLoaded", function () {
    // 1. Initialise the map centered on Dublin
    const map = L.map("map").setView([53.3498, -6.2603], 13);

    // 2. Add OpenStreetMap tiles
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    // 3. Fetch cafés from Django REST API
    fetch("/api/cafes/")
        .then(response => response.json())
        .then(data => {
            // 4. Loop through GeoJSON features
            L.geoJSON(data, {
                pointToLayer: function (feature, latlng) {
                    return L.marker(latlng).bindPopup(
                        `<b>${feature.properties.name}</b><br>` +
                        `${feature.properties.address}<br>` +
                        `⭐ Rating: ${feature.properties.rating}`
                    );
                }
            }).addTo(map);
        })
        .catch(error => console.error("Error loading café data:", error));
});

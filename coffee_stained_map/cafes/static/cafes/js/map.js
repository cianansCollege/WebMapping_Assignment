document.addEventListener("DOMContentLoaded", function () {
    const map = L.map("map").setView([53.3498, -6.2603], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    fetch("/api/cafes/")
        .then(response => response.json())
        .then(data => {
            console.log("Fetched data:", data);

            // Add GeoJSON directly
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

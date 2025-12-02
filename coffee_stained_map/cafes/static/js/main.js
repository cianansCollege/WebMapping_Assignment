console.log("🔥 main.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  console.log("🟢 DOM START");

  try {
      console.log("Button inside DOM:", document.getElementById("locate-btn"));
  } catch (e) {
      console.error("🔥 Error checking button:", e);
  }

  console.log("🟢 DOM END");

  /* ---------------------------------------------
      MAP SETUP
  ---------------------------------------------- */

  const map = L.map("map").setView([53.34731, -6.258946], 11);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 20,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  let markersLayer = L.markerClusterGroup().addTo(map);
  let countiesLayer = L.layerGroup().addTo(map);
  let radiusCircle = null;
  let searchMarker = null;

  // Global storage for user location
  window.userLocation = { lat: null, lng: null };

  window.map = map;
  window.countiesLayer = countiesLayer;


  /* ---------------------------------------------
      LOAD COUNTY POLYGONS
  ---------------------------------------------- */

  fetch("/api/counties/")
    .then(res => res.json())
    .then(geojson => {

      // Draw counties
      const countiesGeoLayer = L.geoJSON(geojson, {
        style: { color: "#ff8800", weight: 1, fillOpacity: 0 },
        onEachFeature: (feature, layer) => {
          const p = feature.properties;
          layer.bindPopup(`
            <i>${p.gaeilge_name}</i><br>
            <b>${p.english_name}, ${p.province}</b>
          `);
        }
      }).addTo(countiesLayer);

      // Populate dropdown
      const select = document.getElementById("county-select");
      geojson.features.forEach(f => {
        const opt = document.createElement("option");
        opt.value = f.properties.english;
        opt.textContent = f.properties.english;
        select.appendChild(opt);
      });

      // Save this for zoom-to-county
      window.countiesGeoLayer = countiesGeoLayer;

    })
    .catch(err => console.error("Error loading counties:", err));


  /* ---------------------------------------------
      HELPER: ADD CAFÉS TO MAP
  ---------------------------------------------- */

  function addCafes(data) {
    markersLayer.clearLayers();

    if (!data || data.type !== "FeatureCollection" || !Array.isArray(data.features)) {
      console.warn("Unexpected café data format:", data);
      return;
    }

    const geoLayer = L.geoJSON(data, {
      pointToLayer: (_, latlng) => L.marker(latlng),
      onEachFeature: (feature, layer) => {
        const p = feature.properties || {};
        layer.bindPopup(`
          <b>${p.name ?? "Unnamed Café"}</b><br>
          ${p.addr_street ?? ""}<br>
          ${p.addr_city ?? ""}<br>
          ${p.amenity ?? ""}
        `);
      }
    });

    markersLayer.addLayer(geoLayer);
  }


  /* ---------------------------------------------
      FILTER: BY COUNTY + ZOOM TO COUNTY
  ---------------------------------------------- */

  document.getElementById("county-select").addEventListener("change", async function () {
    const countyName = this.value;

    if (!countyName) {
      fetch("/api/cafes_osm/")
        .then(r => r.json())
        .then(addCafes);
      return;
    }

    try {
      const res = await fetch(`/api/cafes_in_county/${countyName}/`);
      const data = await res.json();
      addCafes(data);

      // ZOOM TO COUNTY FIX
      countiesLayer.eachLayer(layer => {
        if (layer.feature.properties.english_name === countyName) {
          map.fitBounds(layer.getBounds());
        }
      });

      if (!data.features?.length) {
        alert("No cafés found in this county.");
      }

    } catch (err) {
      console.error("Error loading county cafés:", err);
    }
  });


  /* ---------------------------------------------
      FIND CLOSEST CAFÉS
  ---------------------------------------------- */

  document.getElementById("closest_cafes_button").addEventListener("click", () => {
    const lat = parseFloat(document.getElementById("latInput").value);
    const lng = parseFloat(document.getElementById("lngInput").value);

    if (isNaN(lat) || isNaN(lng)) {
      alert("Enter valid coordinates");
      return;
    }

    fetch(`/api/closest_cafes/?lat=${lat}&lng=${lng}`)
      .then(res => res.json())
      .then(fc => {

        addCafes(fc);

        // Remove previous search marker FIX
        if (searchMarker) map.removeLayer(searchMarker);

        searchMarker = L.marker([lat, lng], {
          icon: L.icon({
            iconUrl: "https://cdn-icons-png.flaticon.com/512/64/64113.png",
            iconSize: [25, 25],
          })
        })
        .addTo(map)
        .bindPopup("Search location")
        .openPopup();

        map.setView([lat, lng], 20);

        // Sidebar list
        const list = document.getElementById("cafe-list");
        list.innerHTML = "<h6 class='fw-semibold mt-3'>Closest Cafés:</h6>";

        fc.features?.forEach(f => {
          const p = f.properties;
          list.innerHTML += `
            <div class="border-bottom pb-2 mb-2">
              <b>${p.name ?? "Unnamed Café"}</b><br>
              ${p.address ?? "No address"}<br>
              ⭐ ${p.rating ?? "N/A"}
              ${p.distance ? `<br>📍 ${p.distance} away` : ""}
            </div>`;
        });

      })
      .catch(err => console.error("Error loading closest cafés:", err));
  });



  /* ---------------------------------------------
      CAFÉS WITHIN RADIUS
  ---------------------------------------------- */

  document.getElementById("cafes_within_radius_button").addEventListener("click", async () => {

    const lat = parseFloat(document.getElementById("latRadius").value);
    const lng = parseFloat(document.getElementById("lngRadius").value);
    const radius = parseFloat(document.getElementById("radiusInput").value);

    if (isNaN(lat) || isNaN(lng) || isNaN(radius)) {
      alert("Please enter valid coordinates and radius");
      return;
    }

    // Remove old radius circle properly (FIXED)
    if (radiusCircle) map.removeLayer(radiusCircle);

    radiusCircle = L.circle([lat, lng], {
      radius,
      color: "blue",
      fillOpacity: 0.1,
      className: "radius-circle"
    }).addTo(map)
      .bindPopup(`Search area: ${radius} m`)
      .openPopup();

    map.setView([lat, lng], 14);

    try {
      const res = await fetch(`/api/cafes_within_radius/?lat=${lat}&lng=${lng}&radius=${radius}`);
      const data = await res.json();

      addCafes(data);

      const list = document.getElementById("radius-list");
      list.innerHTML = "<h6 class='fw-semibold mt-3'>Cafés Within Radius:</h6>";

      if (data.features?.length) {
        data.features.forEach(f => {
          const p = f.properties;
          list.innerHTML += `
            <div class="border-bottom pb-2 mb-2">
              <b>${p.name ?? "Unnamed Café"}</b><br>
              ${p.address ?? "No address"}<br>
              ⭐ ${p.rating ?? "N/A"}
            </div>`;
        });
      } else {
        list.innerHTML += "<p>No cafés found within this radius.</p>";
      }

    } catch (err) {
      console.error("Error loading cafés within radius:", err);
    }
  });



  /* ---------------------------------------------
      LOAD ALL CAFÉS ON START
  ---------------------------------------------- */

  window.addEventListener("load", () => {
    fetch("/api/cafes_osm/")
      .then(res => res.json())
      .then(addCafes)
      .catch(err => console.error("Error loading initial cafés:", err));
  });



  /* ---------------------------------------------
      TOGGLE COUNTY LAYER
  ---------------------------------------------- */

  let countiesVisible = true;
  document.getElementById("toggle-counties-button").addEventListener("click", () => {
    countiesVisible
      ? map.removeLayer(countiesLayer)
      : map.addLayer(countiesLayer);

    countiesVisible = !countiesVisible;

    document.getElementById("toggle-counties-button").textContent =
      countiesVisible ? "Hide Counties" : "Show Counties";
  });



  /* ---------------------------------------------
      ZOOM BUTTONS
  ---------------------------------------------- */

  document.getElementById("toggle-zoom-in-button").addEventListener("click", () => {
    map.setZoom(map.getZoom() + 1);
  });

  document.getElementById("toggle-zoom-out-button").addEventListener("click", () => {
    map.setZoom(map.getZoom() - 1);
  });



  /* ---------------------------------------------
      GET COORDINATES
  ---------------------------------------------- */

  document.getElementById("get-coordinates-button").addEventListener("click", () => {

    document.getElementById("status").textContent =
      "Click anywhere on the map to select coordinates.";

    // Hide counties temporarily
    if (map.hasLayer(countiesLayer)) map.removeLayer(countiesLayer);

    function onMapClick(e) {

      // Restore counties immediately (FIX)
      map.addLayer(countiesLayer);

      const { lat, lng } = e.latlng;
      document.getElementById("coords-display").textContent =
        `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;

      map.off("click", onMapClick);
      document.getElementById("status").textContent = "Coordinate selected.";
    }

    map.on("click", onMapClick);
  });



  /* ---------------------------------------------
      FIND MY LOCATION
  ---------------------------------------------- */

  document.getElementById("locate-btn").addEventListener("click", function () {
    alert("clicked");
    console.log("locate-btn clicked")
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      successLocation,
      errorLocation,
      { enableHighAccuracy: true }
    );
  });

  let userMarker = null;
  let accuracyCircleUser = null;

  function successLocation(position) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const accuracy = position.coords.accuracy;

    window.userLocation = { lat, lng }; // save globally

    if (userMarker) map.removeLayer(userMarker);
    if (accuracyCircleUser) map.removeLayer(accuracyCircleUser);

    userMarker = L.marker([lat, lng]).addTo(map)
      .bindPopup("You are here")
      .openPopup();

    accuracyCircleUser = L.circle([lat, lng], {
      radius: accuracy,
      color: "#136AEC",
      fillColor: "#136AEC",
      fillOpacity: 0.2
    }).addTo(map);

    map.setView([lat, lng], 16);
  }

  function errorLocation() {
    alert("Could not retrieve location. Check your permissions.");
  }

});

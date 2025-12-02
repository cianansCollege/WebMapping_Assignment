console.log("🔥 main.js loaded");

document.addEventListener("DOMContentLoaded", () => {
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

  // Expose for debugging if needed
  window.map = map;
  window.countiesLayer = countiesLayer;

  /* ---------------------------------------------
    HELPER: NORMALISE CAFE DATA TO FEATURECOLLECTION
  ---------------------------------------------- */
  function normaliseToFeatureCollection(data) {
    // If backend already returns FeatureCollection
    if (data && data.type === "FeatureCollection" && Array.isArray(data.features)) {
      return data;
    }

    // If backend returns an array of GeoJSON Features (DRF GIS many=True)
    if (Array.isArray(data)) {
      return {
        type: "FeatureCollection",
        features: data,
      };
    }

    // Unknown / bad format
    console.warn("Unexpected café data format:", data);
    return null;
  }

  /* ---------------------------------------------
    HELPER: ADD CAFÉS TO MAP
  ---------------------------------------------- */
  function addCafes(data) {
    markersLayer.clearLayers();

    const fc = normaliseToFeatureCollection(data);
    if (!fc) return;

    const geoLayer = L.geoJSON(fc, {
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
    LOAD COUNTY POLYGONS + POPULATE DROPDOWN
  ---------------------------------------------- */
  fetch("/api/counties/")
    .then(res => res.json())
    .then(geojson => {
      // Draw counties
      L.geoJSON(geojson, {
        style: { color: "#ff8800", weight: 1, fillOpacity: 0 },
        onEachFeature: (feature, layer) => {
          const props = feature.properties;
          layer.bindPopup(`
            <i>${props.gaeilge_name}</i><br>
            <b>${props.english_name}, ${props.province}</b><br>
          `);
        }
      }).addTo(countiesLayer);

      // Populate dropdown
      const select = document.getElementById("county-select");
      geojson.features.forEach(f => {
        const props = f.properties;
        const name = props.english_name;

        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        select.appendChild(opt);
      });
    })
    .catch(err => console.error("Error loading counties:", err));

  /* ---------------------------------------------
    LOAD ALL CAFÉS (helper)
  ---------------------------------------------- */
  function loadAllCafes() {
    fetch("/api/cafes_osm/")
      .then(res => res.json())
      .then(data => {
        if (typeof data === "string") {
          try {
            data = JSON.parse(data);
          } catch (e) {
            console.error("Error parsing cafes_osm JSON string:", e);
            return;
          }
        }
        addCafes(data);
      })
      .catch(err => console.error("Error loading initial cafés:", err));
  }

  // Initial load
  loadAllCafes();

  /* ---------------------------------------------
    FILTER: BY COUNTY
  ---------------------------------------------- */
  document.getElementById("county-select").addEventListener("change", async function () {
    const countyName = this.value;

    // If blank, reload all cafés
    if (!countyName) {
      loadAllCafes();
      return;
    }

    try {
      const res = await fetch(`/api/cafes_in_county/${encodeURIComponent(countyName)}/`);
      let data = await res.json();
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch (e) {
          console.error("Error parsing cafes_in_county JSON string:", e);
          return;
        }
      }

      addCafes(data);

      const fc = normaliseToFeatureCollection(data);
      const features = fc ? fc.features : [];

      if (!features || !features.length) {
        alert(`No cafés found in ${countyName}.`);
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
      .then(data => {
        if (typeof data === "string") {
          try {
            data = JSON.parse(data);
          } catch (e) {
            console.error("Error parsing closest_cafes JSON string:", e);
            return;
          }
        }

        addCafes(data);

        // Mark search point
        L.marker([lat, lng], {
          icon: L.icon({
            iconUrl: "https://cdn-icons-png.flaticon.com/512/64/64113.png",
            iconSize: [25, 25],
          })
        })
          .addTo(map)
          .bindPopup("Search location")
          .openPopup();

        map.setView([lat, lng], 16);

        // Sidebar list
        const list = document.getElementById("cafe-list");
        list.innerHTML = "<h6 class='fw-semibold mt-3'>Closest Cafés:</h6>";

        const fc = normaliseToFeatureCollection(data);
        const features = fc ? fc.features : [];

        if (features && features.length) {
          features.forEach(f => {
            const p = f.properties || {};
            list.innerHTML += `
              <div class="border-bottom pb-2 mb-2">
                <b>${p.name ?? "Unnamed Café"}</b><br>
                ${p.addr_street ?? ""} ${p.addr_city ?? ""}<br>
              </div>`;
          });
        } else {
          list.innerHTML += "<p>No cafés found.</p>";
        }
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

    // Remove previous circle
    map.eachLayer(layer => {
      if (layer instanceof L.Circle && layer.options.color === "blue") {
        map.removeLayer(layer);
      }
    });

    // Draw new circle
    radiusCircle = L.circle([lat, lng], {
      radius,
      color: "blue",
      fillOpacity: 0.1,
    }).addTo(map)
      .bindPopup(`Search area: ${radius} m`)
      .openPopup();

    map.setView([lat, lng], 14);

    try {
      const res = await fetch(`/api/cafes_within_radius/?lat=${lat}&lng=${lng}&radius=${radius}`);
      let data = await res.json();
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch (e) {
          console.error("Error parsing cafes_within_radius JSON string:", e);
          return;
        }
      }

      const list = document.getElementById("radius-list");
      list.innerHTML = "<h6 class='fw-semibold mt-3'>Cafés Within Radius:</h6>";

      addCafes(data);

      const fc = normaliseToFeatureCollection(data);
      const features = fc ? fc.features : [];

      if (features && features.length) {
        features.forEach(f => {
          const p = f.properties || {};
          list.innerHTML += `
            <div class="border-bottom pb-2 mb-2">
              <b>${p.name ?? "Unnamed Café"}</b><br>
              ${p.addr_street ?? ""} ${p.addr_city ?? ""}<br>
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
    TOGGLE COUNTY LAYER
  ---------------------------------------------- */
  let countiesVisible = true;
  document.getElementById("toggle-counties-button").addEventListener("click", () => {
    if (countiesVisible) {
      map.removeLayer(countiesLayer);
    } else {
      map.addLayer(countiesLayer);
    }

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
    GET COORDINATES — TEMPORARILY HIDE COUNTIES
  ---------------------------------------------- */
  document.getElementById("get-coordinates-button").addEventListener("click", () => {
    console.log("Get Coordinates button clicked");

    document.getElementById("status").textContent =
      "Click anywhere on the map to select coordinates.";

    // REMOVE the counties layer from the map
    if (map.hasLayer(countiesLayer)) {
      console.log("Removing counties layer temporarily");
      map.removeLayer(countiesLayer);
    }

    function onMapClick(e) {
      console.log("Map click detected!", e);

      const { lat, lng } = e.latlng;

      document.getElementById("coords-display").textContent =
        `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;
      console.log(`Coordinates selected: ${lat}, ${lng}`);

      // Stop listening for additional clicks
      console.log("Removing click listener");
      map.off("click", onMapClick);

      // RESTORE the counties layer
      console.log("Restoring counties layer");
      map.addLayer(countiesLayer);

      document.getElementById("status").textContent = "Coordinate selected.";
    }

    console.log("Adding click listener to map");
    map.on("click", onMapClick);
  });
});

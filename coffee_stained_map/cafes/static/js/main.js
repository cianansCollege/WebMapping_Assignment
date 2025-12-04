console.log("🔥 main.js loaded");

document.addEventListener("DOMContentLoaded", () => {

  // ============================================================
  // MAP INITIALISATION
  // ============================================================
  const map = L.map("map").setView([53.34731, -6.258946], 11);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 20,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  // Layers
  let markersLayer = L.markerClusterGroup().addTo(map);
  let countiesLayer = L.layerGroup().addTo(map);
  let radiusCircle = null;

  // Expose for debugging in browser console
  window.map = map;
  window.countiesLayer = countiesLayer;


  // ============================================================
  // HELPER — Ensure backend data is a valid FeatureCollection
  // ============================================================
  function normaliseToFeatureCollection(data) {

    // Case 1: Proper FeatureCollection with array features
    if (data &&
        data.type === "FeatureCollection" &&
        Array.isArray(data.features)) {
      return data;
    }

    // Case 2: Backend returned raw array of Features
    if (Array.isArray(data)) {
      return {
        type: "FeatureCollection",
        features: data,
      };
    }

    // Case 3: Unexpected data format (rare)
    console.warn("Unexpected café data format:", data);
    return null;
  }


  // ============================================================
  // HELPER — Add cafés to map (clears old markers)
  // ============================================================
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


  // ============================================================
  // LOAD COUNTY POLYGONS + POPULATE COUNTY DROPDOWN
  // ============================================================
  fetch("/api/counties/")
    .then(res => res.json())
    .then(geojson => {

      // Render counties
      L.geoJSON(geojson, {
        style: { color: "#ff8800", weight: 1, fillOpacity: 0 },
        onEachFeature: (feature, layer) => {
          const props = feature.properties;
          layer.bindPopup(`
            <i>${props.gaeilge_name}</i><br>
            <b>${props.english_name}, ${props.province}</b>
          `);
        }
      }).addTo(countiesLayer);

      // Populate dropdown
      const select = document.getElementById("county-select");
      geojson.features.forEach(f => {
        const { english_name } = f.properties;
        const opt = document.createElement("option");
        opt.value = english_name;
        opt.textContent = english_name;
        select.appendChild(opt);
      });

    })
    .catch(err => console.error("Error loading counties:", err));


  // ============================================================
  // LOAD ALL CAFÉS (initial load + reset)
  // ============================================================
  function loadAllCafes() {
    fetch("/api/cafes_osm/")
      .then(res => res.json())
      .then(data => {

        // Handle stringified JSON edge case
        if (typeof data === "string") {
          try { data = JSON.parse(data); } 
          catch (e) {
            console.error("Error parsing cafes_osm string:", e);
            return;
          }
        }

        addCafes(data);
      })
      .catch(err => console.error("Error loading initial cafés:", err));
  }

  loadAllCafes(); // Initial call


  // ============================================================
  // FILTER BY COUNTY
  // ============================================================
  document.getElementById("county-select").addEventListener("change", async function () {
    const countyName = this.value;

    console.log("County selected RAW VALUE:", JSON.stringify(countyName));


    // Empty value → reset map
    if (!countyName) {
      console.log("County is EMPTY STRING");
      loadAllCafes();
      return;
    }

    try {
      const res = await fetch(`/api/cafes_in_county/${encodeURIComponent(countyName)}/`);
      let data = await res.json();

      if (typeof data === "string") {
        try { data = JSON.parse(data); }
        catch (e) {
          console.error("Error parsing cafes_in_county string:", e);
          return;
        }
      }

      addCafes(data);

      const fc = normaliseToFeatureCollection(data);
      const features = fc?.features || [];

      if (!features.length) {
        alert(`No cafés found in ${countyName}.`);
      }

    } catch (err) {
      console.error("Error loading county cafés:", err);
    }
  });


  // ============================================================
  // FIND CLOSEST CAFÉS
  // ============================================================
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
          try { data = JSON.parse(data); }
          catch (e) { console.error("Parsing error:", e); return; }
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

        // Sidebar results
        const list = document.getElementById("cafe-list");
        list.innerHTML = "<h6 class='fw-semibold mt-3'>Closest Cafés:</h6>";

        const fc = normaliseToFeatureCollection(data);
        const features = fc?.features || [];

        if (features.length) {
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


  // ============================================================
  // CAFÉS WITHIN RADIUS
  // ============================================================
  document.getElementById("cafes_within_radius_button").addEventListener("click", async () => {
    const lat = parseFloat(document.getElementById("latRadius").value);
    const lng = parseFloat(document.getElementById("lngRadius").value);
    const radius = parseFloat(document.getElementById("radiusInput").value);

    if (isNaN(lat) || isNaN(lng) || isNaN(radius)) {
      alert("Please enter valid coordinates and radius");
      return;
    }

    // Remove existing blue circle
    map.eachLayer(layer => {
      if (layer instanceof L.Circle && layer.options.color === "blue") {
        map.removeLayer(layer);
      }
    });

    // Draw new radius circle
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
        try { data = JSON.parse(data); }
        catch (e) { console.error("Parsing error:", e); return; }
      }

      addCafes(data);

      const list = document.getElementById("radius-list");
      list.innerHTML = "<h6 class='fw-semibold mt-3'>Cafés Within Radius:</h6>";

      const fc = normaliseToFeatureCollection(data);
      const features = fc?.features || [];

      if (features.length) {
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


  // ============================================================
  // SHOW / HIDE COUNTIES LAYER
  // ============================================================
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


  // ============================================================
  // ZOOM CONTROLS
  // ============================================================
  document.getElementById("toggle-zoom-in-button")
    .addEventListener("click", () => map.setZoom(map.getZoom() + 1));

  document.getElementById("toggle-zoom-out-button")
    .addEventListener("click", () => map.setZoom(map.getZoom() - 1));


  // ============================================================
  // GET COORDINATES — TEMPORARILY HIDE COUNTIES
  // ============================================================
  document.getElementById("get-coordinates-button").addEventListener("click", () => {

    document.getElementById("status").textContent =
      "Click anywhere on the map to select coordinates.";

    // Temporarily hide counties
    if (map.hasLayer(countiesLayer)) {
      map.removeLayer(countiesLayer);
    }

    function onMapClick(e) {
      const { lat, lng } = e.latlng;

      document.getElementById("coords-display").textContent =
        `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;

      // Stop listening
      map.off("click", onMapClick);

      // Restore counties
      map.addLayer(countiesLayer);

      document.getElementById("status").textContent = "Coordinate selected.";
    }

    map.on("click", onMapClick);
  });

});

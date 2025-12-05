console.log("main.js loaded: test 1");

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM ready");

  // ============================================================
  // MAP INITIALISATION
  // ============================================================
  console.log("Initialising map...");
  const map = L.map("map").setView([53.34731, -6.258946], 11);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 20,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  const markersLayer = L.markerClusterGroup().addTo(map);
  const countiesLayer = L.layerGroup().addTo(map);
  let radiusCircle = null;
  let routingControl = null;


  // Debug exposure
  window.map = map;
  window.countiesLayer = countiesLayer;

  // ============================================================
  // DOM ELEMENTS
  // ============================================================
  const countySelect           = document.getElementById("county-select");
  const toggleCountiesBtn      = document.getElementById("toggle-counties-button");
  const zoomInBtn              = document.getElementById("toggle-zoom-in-button");
  const zoomOutBtn             = document.getElementById("toggle-zoom-out-button");
  const getCoordsBtn           = document.getElementById("get-coordinates-button");
  const statusEl               = document.getElementById("status");
  const coordsDisplayEl        = document.getElementById("coords-display");

  const closestBtn             = document.getElementById("closest_cafes_button");
  const closestLatInput        = document.getElementById("latInput");
  const closestLngInput        = document.getElementById("lngInput");
  const closestListEl          = document.getElementById("cafe-list");

  const radiusBtn              = document.getElementById("cafes_within_radius_button");
  const radiusLatInput         = document.getElementById("latRadius");
  const radiusLngInput         = document.getElementById("lngRadius");
  const radiusInput            = document.getElementById("radiusInput");
  const radiusListEl           = document.getElementById("radius-list");

  const trackMeBtn             = document.getElementById("track-me-btn");

  // ============================================================
  // SMALL UI HELPERS
  // ============================================================
  function setStatus(msg) {
    console.log(`STATUS: ${msg}`);
    if (statusEl) statusEl.textContent = msg;
  }

  function setCoordsText(msg) {
    console.log(`COORD SELECTED: ${msg}`);
    if (coordsDisplayEl) coordsDisplayEl.textContent = msg;
  }

  function clearLists() {
    console.log("Clearing sidebar lists...");
    if (closestListEl) closestListEl.innerHTML = "";
    if (radiusListEl) radiusListEl.innerHTML = "";
  }

  // ============================================================
  // FETCH HELPER — logs EVERYTHING
  // ============================================================
  async function fetchJSON(url, label = "Request") {
    console.log(`FETCH → ${url}`);

    try {
      const res = await fetch(url);
      console.log(`RESPONSE (${url}): status=${res.status}`);

      if (!res.ok) {
        console.error(`${label} failed: HTTP ${res.status}`);
        return null;
      }

      let data = await res.json();
      console.log(`DATA RECEIVED (${url}):`, data);

      // Sometimes Django returns a string
      if (typeof data === "string") {
        console.log("Parsing stringified JSON...");
        data = JSON.parse(data);
      }

      return data;

    } catch (err) {
      console.error(`NETWORK ERROR (${url}):`, err);
      return null;
    }
  }

  // ============================================================
  // GEO HELPERS
  // ============================================================
  function normaliseToFeatureCollection(data) {
    console.log("Normalising FeatureCollection:", data);

    if (data?.type === "FeatureCollection" && Array.isArray(data.features)) {
      console.log("→ Already a FeatureCollection");
      return data;
    }

    if (Array.isArray(data)) {
      console.log("→ Converting array → FeatureCollection");
      return { type: "FeatureCollection", features: data };
    }

    console.warn("Unexpected GeoJSON format:", data);
    return null;
  }

  function addCafes(data) {
    window.lastCafes = data;
    console.log("addCafes() called with:", data);
    markersLayer.clearLayers();

    const fc = normaliseToFeatureCollection(data);
    if (!fc) {
      console.warn("No valid data passed to addCafes");
      return;
    }

    console.log(` Rendering cafés: count=${fc.features.length}`);

    const geoLayer = L.geoJSON(fc, {
      pointToLayer: (_, latlng) => L.marker(latlng),
      onEachFeature: (feature, layer) => {
        const p = feature.properties || {};
        layer.bindPopup(`
          <b>${p.name ?? "Unnamed Café"}</b><br>
          ${p.addr_street ?? ""}<br>
          ${p.addr_city ?? ""}<br><br>

          <button class="btn btn-dark btn-sm route-btn"
            data-lng="${feature.geometry.coordinates[0]}"
            data-lat="${feature.geometry.coordinates[1]}">
            Route to here
          </button>
        `);
      }
    });

    markersLayer.addLayer(geoLayer);
  }

  // ============================================================
  // LOAD COUNTIES + POPULATE DROPDOWN
  // ============================================================
  async function loadCounties() {
    console.log("Loading counties...");
    const geojson = await fetchJSON("/api/counties/", "Load counties");
    if (!geojson) return;

    console.log("County FeatureCollection:", geojson);

    // Render polygons
    L.geoJSON(geojson, {
      style: { color: "#ff8800", weight: 1, fillOpacity: 0 },
      onEachFeature: (feature, layer) => {
        console.log("County feature:", feature);
        const p = feature.properties || {};
        layer.bindPopup(`
          <i>${p.gaeilge_name}</i><br>
          <b>${p.english_name}, ${p.province}</b>
        `);
      }
    }).addTo(countiesLayer);

    // Populate dropdown
    console.log("Populating county dropdown...");
    geojson.features.forEach(f => {
      const name = f.properties.english_name;
      console.log("Adding county option:", name);

      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      countySelect.appendChild(opt);
    });

    console.log("County dropdown complete.");
  }

  // ============================================================
  // REAL-TIME USER TRACKING
  // ============================================================
  let tracking = false;
  let userMarker = null;
  let userAccuracyCircle = null;

  async function toggleTracking() {
    tracking = !tracking;

    console.log(`Tracking toggled → ${tracking}`);
    trackMeBtn.textContent = tracking ? "Stop Tracking" : "Start Tracking Me";

    if (!tracking) {
      console.log("Stopping GPS tracking & clearing markers");
      if (userMarker) map.removeLayer(userMarker);
      if (userAccuracyCircle) map.removeLayer(userAccuracyCircle);
      userMarker = null;
      userAccuracyCircle = null;
      return;
    }

    if (!navigator.geolocation) {
      alert("Geolocation not supported.");
      return;
    }

    console.log("Starting GPS watchPosition...");

    navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = pos.coords.accuracy;

        console.log("GPS UPDATE:", { lat, lng, accuracy });

        if (!userMarker) {
          console.log("Creating new user marker");
          userMarker = L.marker([lat, lng], {
            icon: L.icon({
              iconUrl: "https://cdn-icons-png.flaticon.com/512/487/487021.png",
              iconSize: [20, 20],
            })
          }).addTo(map);
        } else {
          userMarker.setLatLng([lat, lng]);
        }

        if (!userAccuracyCircle) {
          console.log("Creating accuracy circle:", accuracy);
          userAccuracyCircle = L.circle([lat, lng], {
            radius: accuracy,
            color: "blue",
            fillColor: "blue",
            fillOpacity: 0.15,
          }).addTo(map);
        } else {
          userAccuracyCircle.setLatLng([lat, lng]);
          userAccuracyCircle.setRadius(accuracy);
        }

        // Auto-follow
        console.log("Auto-follow user");
        map.setView([lat, lng], map.getZoom());
      },

      (err) => {
        console.error("GPS ERROR:", err);
        alert("Unable to track location. Enable GPS.");
      },

      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000
      }
    );
  }

  // ============================================================
  // LOAD ALL CAFÉS
  // ============================================================
  async function loadAllCafes() {
    console.log("Loading ALL cafés...");
    const data = await fetchJSON("/api/cafes_osm/", "Load all cafés");
    if (!data) return;

    addCafes(data);
    console.log("All cafés rendered");
  }

  // ============================================================
  // FILTER BY COUNTY
  // ============================================================
  async function loadCafesInCounty(countyName) {
    console.log("loadCafesInCounty:", countyName);

    if (!countyName) {
      console.log("Empty selection → loading all cafés");
      await loadAllCafes();
      return;
    }

    const url = `/api/cafes_in_county/${encodeURIComponent(countyName)}/`;
    const data = await fetchJSON(url, "Load cafés in county");

    if (!data) return;

    addCafes(data);

    const fc = normaliseToFeatureCollection(data);
    if (!fc?.features?.length) {
      console.warn(`No cafés found in ${countyName}`);
      alert(`No cafés found in ${countyName}.`);
    }
  }

  // ============================================================
  // FIND CLOSEST CAFÉS
  // ============================================================
  async function findClosestCafes() {
    const lat = parseFloat(closestLatInput.value);
    const lng = parseFloat(closestLngInput.value);

    console.log("closest search:", { lat, lng });

    if (isNaN(lat) || isNaN(lng)) {
      alert("Invalid coordinates");
      return;
    }

    const url = `/api/closest_cafes/?lat=${lat}&lng=${lng}`;
    const data = await fetchJSON(url, "Closest cafés");
    if (!data) return;

    addCafes(data);

    console.log("Marking search point");
    L.marker([lat, lng], {
      icon: L.icon({
        iconUrl: "https://cdn-icons-png.flaticon.com/512/64/64113.png",
        iconSize: [25, 25],
      })
    }).addTo(map).bindPopup("Search location").openPopup();

    map.setView([lat, lng], 16);

    closestListEl.innerHTML = "<h6>Closest Cafés:</h6>";

    const fc = normaliseToFeatureCollection(data);
    fc.features.forEach(f => {
      const p = f.properties || {};
      closestListEl.innerHTML += `
        <div class="border-bottom pb-2 mb-2">
          <b>${p.name ?? "Unnamed Café"}</b><br>
          ${p.addr_street ?? ""} ${p.addr_city ?? ""}
        </div>
      `;
    });
  }

  // ============================================================
  // CAFÉS WITHIN RADIUS
  // ============================================================
  async function findCafesWithinRadius() {
    const lat = parseFloat(radiusLatInput.value);
    const lng = parseFloat(radiusLngInput.value);
    const radius = parseFloat(radiusInput.value);

    console.log("radius search:", { lat, lng, radius });

    if (isNaN(lat) || isNaN(lng) || isNaN(radius)) {
      alert("Invalid radius search");
      return;
    }

    // Remove old
    map.eachLayer(layer => {
      if (layer instanceof L.Circle && layer.options.color === "blue") {
        map.removeLayer(layer);
      }
    });

    console.log("Drawing radius circle...");
    radiusCircle = L.circle([lat, lng], {
      radius,
      color: "blue",
      fillOpacity: 0.1,
    }).addTo(map).bindPopup(`Search radius: ${radius} m`).openPopup();

    map.setView([lat, lng], 14);

    const url = `/api/cafes_within_radius/?lat=${lat}&lng=${lng}&radius=${radius}`;
    const data = await fetchJSON(url, "Cafés within radius");
    if (!data) return;

    addCafes(data);

    radiusListEl.innerHTML = "<h6>Cafés Within Radius:</h6>";

    const fc = normaliseToFeatureCollection(data);
    fc.features.forEach(f => {
      const p = f.properties || {};
      radiusListEl.innerHTML += `
        <div class="border-bottom pb-2 mb-2">
          <b>${p.name ?? "Unnamed Café"}</b><br>
          ${p.addr_street ?? ""} ${p.addr_city ?? ""}
        </div>
      `;
    });
  }

  // ============================================================
  // TOGGLE COUNTIES LAYER
  // ============================================================
  let countiesVisible = true;

  function toggleCounties() {
    console.log("Toggle counties:", !countiesVisible);

    if (countiesVisible) {
      map.removeLayer(countiesLayer);
    } else {
      map.addLayer(countiesLayer);
    }

    countiesVisible = !countiesVisible;
    toggleCountiesBtn.textContent = countiesVisible ? "Hide Counties" : "Show Counties";
  }

  // ============================================================
  // GET COORDINATES
  // ============================================================
  function activateGetCoordinates() {
    console.log("Activating coordinate picker");
    setStatus("Click anywhere on the map to select coordinates.");

    if (map.hasLayer(countiesLayer)) map.removeLayer(countiesLayer);

    function onMapClick(e) {
      const { lat, lng } = e.latlng;
      console.log("Clicked at:", { lat, lng });

      setCoordsText(`Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`);

      map.off("click", onMapClick);
      map.addLayer(countiesLayer);
      setStatus("Coordinate selected.");
    }

    map.on("click", onMapClick);
  }
  // ============================================================
  // GET BROWSER LOCATION
  // ============================================================
  function getBrowserLocation(callback) {
    if (!navigator.geolocation) {
      alert("Geolocation not supported.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        callback(lat, lng);
      },
      err => {
        console.error("GPS error", err);
        alert("Unable to get location.");
      },
      {
        enableHighAccuracy: true,
        timeout: 8000
      }
    );
  }

    // ============================================================
  // USE MY LOCATION (auto-fill inputs)
  // ============================================================
  document.getElementById("use-my-location-closest")?.addEventListener("click", () => {
    console.log("Using browser location for closest cafés...");
    getBrowserLocation((lat, lng) => {
      closestLatInput.value = lat.toFixed(6);
      closestLngInput.value = lng.toFixed(6);
      findClosestCafes();   // Auto-run the search
    });
  });

  document.getElementById("use-my-location-radius")?.addEventListener("click", () => {
    console.log("Using browser location for radius cafés...");
    getBrowserLocation((lat, lng) => {
      radiusLatInput.value = lat.toFixed(6);
      radiusLngInput.value = lng.toFixed(6);
      // Do NOT auto-run — user must choose radius
    });
  });

  // ============================================================
  // PICK LOCATION ON MAP (for closest cafés)
  // ============================================================
  function pickLocationForClosest() {
    console.log("Pick-on-map for closest cafés activated");
    setStatus("Click on the map to select location");

    // Hide counties
    if (map.hasLayer(countiesLayer)) {
      console.log("Removing counties layer");
      map.removeLayer(countiesLayer);
    }

    function handleClick(e) {
      const { lat, lng } = e.latlng;
      console.log("Picked location for closest:", lat, lng);

      // Fill inputs
      closestLatInput.value = lat.toFixed(6);
      closestLngInput.value = lng.toFixed(6);

      // Restore counties
      console.log("Restoring counties layer");
      map.addLayer(countiesLayer);

      // Remove listener
      map.off("click", handleClick);

      // Run closest café search
      findClosestCafes();
    }

    // Listen for ONE click
    map.on("click", handleClick);
  }

  // ============================================================
  // PICK LOCATION ON MAP (for radius search)
  // ============================================================
  function pickLocationForRadius() {
    console.log("Pick-on-map for radius activated");
    setStatus("Click on the map to select center point");

    // Hide counties
    if (map.hasLayer(countiesLayer)) {
      console.log("Removing counties layer");
      map.removeLayer(countiesLayer);
    }

    function handleClick(e) {
      const { lat, lng } = e.latlng;
      console.log("Picked location for radius:", lat, lng);

      // Fill inputs
      radiusLatInput.value = lat.toFixed(6);
      radiusLngInput.value = lng.toFixed(6);

      // Restore counties
      console.log("Restoring counties layer");
      map.addLayer(countiesLayer);

      // Remove listener
      map.off("click", handleClick);

      // Run radius search
      findCafesWithinRadius();
    }

    // Listen for ONE click
    map.on("click", handleClick);
  }

  document.getElementById("pick-on-map-closest")?.addEventListener("click", pickLocationForClosest);
  document.getElementById("pick-on-map-radius")?.addEventListener("click", pickLocationForRadius);

  // ============================================================
  // ROUTING: When popup opens, attach event listener to button
  // ============================================================
  map.on("popupopen", function (e) {
    const btn = e.popup._contentNode.querySelector(".route-btn");

    if (!btn) return;

    btn.addEventListener("click", function () {
      const lat = parseFloat(btn.dataset.lat);
      const lng = parseFloat(btn.dataset.lng);

      console.log("Routing to café:", lat, lng);

      // Get user's location first
      navigator.geolocation.getCurrentPosition(
        pos => {
          const userLat = pos.coords.latitude;
          const userLng = pos.coords.longitude;

          console.log("User location:", userLat, userLng);

          // Remove previous route
          if (routingControl) {
            map.removeControl(routingControl);
          }

          // Draw new route
          routingControl = L.Routing.control({
            waypoints: [
              L.latLng(userLat, userLng),
              L.latLng(lat, lng)
            ],
            lineOptions: {
              styles: [{ color: "blue", weight: 5 }]
            },
            show: false,
            addWaypoints: false
          }).addTo(map);
        },
        err => {
          alert("Enable location services to use routing.");
        },
        {
          enableHighAccuracy: true,
          timeout: 8000
        }
      );
    });
  });


  // ============================================================
  // EVENT LISTENERS
  // ============================================================
  countySelect?.addEventListener("change", e => {
    console.log("County dropdown changed →", e.target.value);
    loadCafesInCounty(e.target.value);
  });

  closestBtn?.addEventListener("click", findClosestCafes);
  radiusBtn?.addEventListener("click", findCafesWithinRadius);
  toggleCountiesBtn?.addEventListener("click", toggleCounties);
  zoomInBtn?.addEventListener("click", () => map.setZoom(map.getZoom() + 1));
  zoomOutBtn?.addEventListener("click", () => map.setZoom(map.getZoom() - 1));
  getCoordsBtn?.addEventListener("click", activateGetCoordinates);
  trackMeBtn?.addEventListener("click", toggleTracking);

  // ============================================================
  // INITIAL LOAD
  // ============================================================
  (async () => {
    console.log("Initial load starting...");
    setStatus("Loading data…");

    await loadCounties();
    await loadAllCafes();

    setStatus("Ready.");
    console.log("App ready.");
  })();
});

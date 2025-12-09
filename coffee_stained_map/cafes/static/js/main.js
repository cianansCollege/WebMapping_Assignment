console.log("main.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM ready");

  // --- Map setup ---
  const map = L.map("map").setView([53.34731, -6.258946], 11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 20, attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  const markersLayer = L.markerClusterGroup().addTo(map);
  const countiesLayer = L.layerGroup().addTo(map);
  const tempLayer = L.layerGroup().addTo(map); // temporary markers

  let radiusCircle = null;
  let routingControl = null;
  let userLat = null, userLng = null;

  // --- DOM ---
  const countySelect = document.getElementById("county-select");
  const toggleCountiesBtn = document.getElementById("toggle-counties-button");
  const zoomInBtn = document.getElementById("toggle-zoom-in-button");
  const zoomOutBtn = document.getElementById("toggle-zoom-out-button");
  const getCoordsBtn = document.getElementById("get-coordinates-button");
  const statusEl = document.getElementById("status");
  const coordsDisplayEl = document.getElementById("coords-display");
  const closestBtn = document.getElementById("closest_cafes_button");
  const closestLatInput = document.getElementById("latInput");
  const closestLngInput = document.getElementById("lngInput");
  const closestListEl = document.getElementById("cafe-list");
  const radiusBtn = document.getElementById("cafes_within_radius_button");
  const radiusLatInput = document.getElementById("latRadius");
  const radiusLngInput = document.getElementById("lngRadius");
  const radiusInput = document.getElementById("radiusInput");
  const radiusListEl = document.getElementById("radius-list");
  const trackMeBtn = document.getElementById("track-me-btn");

  // --- Helpers ---
  const setStatus = msg => statusEl.textContent = msg;
  const setCoordsText = msg => coordsDisplayEl.textContent = msg;
  const clearLists = () => { closestListEl.innerHTML = ""; radiusListEl.innerHTML = ""; };

  // --- Fetch wrapper ---
  async function fetchJSON(url, label="Request") {
    console.log(`FETCH → ${url}`);
    try {
      const res = await fetch(url);
      if (!res.ok) return console.error(`${label} failed: ${res.status}`), null;
      let data = await res.json();
      return typeof data === "string" ? JSON.parse(data) : data;
    } catch (err) {
      console.error("NETWORK ERR:", err);
      return null;
    }
  }

  // --- GeoJSON normaliser ---
  const normaliseFC = d =>
    d?.type === "FeatureCollection" ? d :
    Array.isArray(d) ? { type: "FeatureCollection", features: d } : null;

  // --- Add cafés to map ---
  function addCafes(data) {
    markersLayer.clearLayers();
    const fc = normaliseFC(data);
    if (!fc) return;
    const cafeLayer = L.geoJSON(fc, {
      pointToLayer: (_, latlng) => L.marker(latlng),
      onEachFeature: (f, l) => {
        const p = f.properties || {};
        l.bindPopup(`
          <b>${p.name ?? "Unnamed Café"}</b><br>
          ${p.addr_street ?? ""}<br>${p.addr_city ?? ""}<br><br>
          <button class="btn btn-dark btn-sm route-btn"
            data-lat="${f.geometry.coordinates[1]}"
            data-lng="${f.geometry.coordinates[0]}">
            Route to here
          </button>
        `);
      }
    });
    markersLayer.addLayer(cafeLayer);
  }

  // --- Load counties ---
  async function loadCounties() {
    const geojson = await fetchJSON("/api/counties/", "Load counties");
    if (!geojson) return;

    L.geoJSON(geojson, {
      style: { color: "#ff8800", weight: 1, fillOpacity: 0 },
      onEachFeature: (f, l) => {
        const p = f.properties;
        l.bindPopup(`<i>${p.gaeilge_name}</i><br><b>${p.english_name}, ${p.province}</b>`);
      }
    }).addTo(countiesLayer);

    geojson.features.forEach(f => {
      const opt = document.createElement("option");
      opt.value = f.properties.english_name;
      opt.textContent = f.properties.english_name;
      countySelect.appendChild(opt);
    });
  }

  // --- Live tracking ---
  let tracking = false, userMarker = null, userAccuracyCircle = null;

  function toggleTracking() {
    tracking = !tracking;
    trackMeBtn.textContent = tracking ? "Stop Tracking" : "Start Tracking Me";
    if (!tracking) {
      tempLayer.removeLayer(userMarker);
      tempLayer.removeLayer(userAccuracyCircle);
      userMarker = userAccuracyCircle = null;
      return;
    }
    navigator.geolocation.watchPosition(pos => {
      const { latitude, longitude, accuracy } = pos.coords;
      userLat = latitude; userLng = longitude;
      if (!userMarker) {
        userMarker = L.marker([latitude, longitude]).addTo(tempLayer);
        userAccuracyCircle = L.circle([latitude, longitude], {
          radius: accuracy, color:"blue", fillOpacity:0.15
        }).addTo(tempLayer);
      } else {
        userMarker.setLatLng([latitude, longitude]);
        userAccuracyCircle.setLatLng([latitude, longitude]);
        userAccuracyCircle.setRadius(accuracy);
      }
      map.setView([latitude, longitude], map.getZoom());
    });
  }

  // --- Load all cafés ---
  async function loadAllCafes() {
    const data = await fetchJSON("/api/cafes_all/");
    if (data) addCafes(data);
  }

  // --- Reset map ---
  function resetMap() {
    console.log("RESET MAP");

    tempLayer.clearLayers(); // KEY CHANGE: wipe all temporary markers
    clearLists();

    if (routingControl) map.removeControl(routingControl), routingControl = null;

    countySelect.value = "";
    loadAllCafes();

    if (!map.hasLayer(countiesLayer)) {
      map.addLayer(countiesLayer);
      countiesVisible = true;
      toggleCountiesBtn.textContent = "Hide Counties";
    }

    map.setView([53.4, -7.8], 8);
    map.closePopup();
  }

  // --- Filter by county ---
  async function loadCafesInCounty(name) {
    if (!name) return loadAllCafes();
    const data = await fetchJSON(`/api/cafes_in_county/${encodeURIComponent(name)}/`);
    if (data) addCafes(data);
    else alert(`No cafés found in ${name}.`);
  }

  // --- Closest cafés ---
  async function findClosestCafes() {
    const lat = parseFloat(closestLatInput.value);
    const lng = parseFloat(closestLngInput.value);
    if (isNaN(lat) || isNaN(lng)) return alert("Invalid coords");

    const data = await fetchJSON(`/api/closest_cafes/?lat=${lat}&lng=${lng}`);
    if (!data) return;

    addCafes(data);

    // Search marker → tempLayer
    L.marker([lat, lng], {
      icon: L.icon({ iconUrl:"https://cdn-icons-png.flaticon.com/512/64/64113.png", iconSize:[25,25] })
    }).addTo(tempLayer).bindPopup("Search location").openPopup();

    map.setView([lat, lng], 16);

    const fc = normaliseFC(data);
    closestListEl.innerHTML = "<h6>Closest Cafés:</h6>";
    fc.features.forEach(f => {
      const p = f.properties, [lng2, lat2] = f.geometry.coordinates;
      closestListEl.innerHTML += `
        <div class="border-bottom pb-2 mb-2">
          <b>${p.name ?? "Unnamed Café"}</b><br>${p.addr_street ?? ""} ${p.addr_city ?? ""}
          <button class="btn btn-dark btn-sm route-btn" data-lat="${lat2}" data-lng="${lng2}">
            Route to here
          </button>
        </div>`;
    });
  }

  // --- Radius search ---
  async function findCafesWithinRadius() {
    const lat = parseFloat(radiusLatInput.value);
    const lng = parseFloat(radiusLngInput.value);
    const r = parseFloat(radiusInput.value);
    if (isNaN(lat) || isNaN(lng) || isNaN(r)) return alert("Invalid radius search");

    // Remove old radius circle
    if (radiusCircle) tempLayer.removeLayer(radiusCircle);

    radiusCircle = L.circle([lat, lng], {
      radius: r, color: "blue", fillOpacity: .1
    }).addTo(tempLayer).bindPopup(`Search radius: ${r} m`).openPopup();

    map.setView([lat, lng], 14);

    const data = await fetchJSON(`/api/cafes_within_radius/?lat=${lat}&lng=${lng}&radius=${r}`);
    if (!data) return;

    addCafes(data);

    const fc = normaliseFC(data);
    radiusListEl.innerHTML = "<h6>Cafés Within Radius:</h6>";
    fc.features.forEach(f => {
      const p = f.properties, [lng2, lat2] = f.geometry.coordinates;
      radiusListEl.innerHTML += `
        <div class="border-bottom pb-2 mb-2">
          <b>${p.name ?? "Unnamed Café"}</b><br>${p.addr_street ?? ""} ${p.addr_city ?? ""}
          <button class="btn btn-dark btn-sm route-btn" data-lat="${lat2}" data-lng="${lng2}">
            Route to here
          </button>
        </div>`;
    });
  }

  // --- Toggle counties ---
  let countiesVisible = true;
  function toggleCounties() {
    countiesVisible ? map.removeLayer(countiesLayer) : map.addLayer(countiesLayer);
    countiesVisible = !countiesVisible;
    toggleCountiesBtn.textContent = countiesVisible ? "Hide Counties" : "Show Counties";
  }

  // --- Pick coordinates ---
  function activateGetCoordinates() {
    map.removeLayer(countiesLayer);
    const pick = e => {
      const { lat, lng } = e.latlng;
      setCoordsText(`Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`);
      map.off("click", pick);
      map.addLayer(countiesLayer);
      setStatus("Coordinate selected.");
    };
    map.on("click", pick);
  }

  // --- Routing via popups ---
  map.on("popupopen", e => {
    const btn = e.popup._contentNode.querySelector(".route-btn");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const lat = parseFloat(btn.dataset.lat);
      const lng = parseFloat(btn.dataset.lng);
      if (userLat === null) return alert("Enable location first.");

      if (routingControl) map.removeControl(routingControl);
      routingControl = L.Routing.control({
        waypoints: [L.latLng(userLat, userLng), L.latLng(lat, lng)],
        lineOptions:{ styles:[{ color:"blue", weight:5 }] }, show:false, addWaypoints:false
      }).addTo(map);
    });
  });

  // --- Routing via sidebar ---
  document.addEventListener("click", e => {
    if (!e.target.classList.contains("route-btn")) return;
    const lat = parseFloat(e.target.dataset.lat);
    const lng = parseFloat(e.target.dataset.lng);
    if (userLat === null) return alert("Enable location first.");

    if (routingControl) map.removeControl(routingControl);
    routingControl = L.Routing.control({
      waypoints:[L.latLng(userLat, userLng), L.latLng(lat, lng)],
      lineOptions:{ styles:[{ color:"blue", weight:5 }] }, show:false, addWaypoints:false
    }).addTo(map);
  });

  // --- Event listeners ---
  countySelect.addEventListener("change", e => loadCafesInCounty(e.target.value));
  closestBtn.addEventListener("click", findClosestCafes);
  radiusBtn.addEventListener("click", findCafesWithinRadius);
  toggleCountiesBtn.addEventListener("click", toggleCounties);
  zoomInBtn.addEventListener("click", () => map.setZoom(map.getZoom()+1));
  zoomOutBtn.addEventListener("click", () => map.setZoom(map.getZoom()-1));
  getCoordsBtn.addEventListener("click", activateGetCoordinates);
  trackMeBtn.addEventListener("click", toggleTracking);
  document.getElementById("reset-btn").addEventListener("click", resetMap);

  // --- Initial load ---
  (async () => {
    setStatus("Loading data…");
    await loadCounties();
    await loadAllCafes();
    setStatus("Ready.");
  })();
});

console.log("main.js loaded");
console.log("APP ORIGIN:", window.location.origin);
alert("APP ORIGIN = " + window.location.origin);

const API_BASE = "https://webmapping-assignment.onrender.com/api";

document.addEventListener("deviceready", () => {
  console.log("app starting");

  // --- Map setup ---
  const map = L.map("map").setView([53.34731, -6.258946], 11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 20, attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  const markersLayer = L.markerClusterGroup().addTo(map);
  const countiesLayer = L.layerGroup().addTo(map);
  const tempLayer = L.layerGroup().addTo(map); // new: temporary markers

  let radiusCircle = null;
  let routingControl = null;

  // --- DOM ---
  const countySelect = document.getElementById("county-select");
  const toggleCountiesBtn = document.getElementById("toggle-counties-button");
  const zoomInBtn = document.getElementById("toggle-zoom-in-button");
  const zoomOutBtn = document.getElementById("toggle-zoom-out-button");
  const getCoordsBtn = document.getElementById("get-coordinates-button");
  const statusEl = document.getElementById("status");
  const coordsEl = document.getElementById("coords-display");

  const closestBtn = document.getElementById("closest_cafes_button");
  const closestLat = document.getElementById("latInput");
  const closestLng = document.getElementById("lngInput");
  const closestList = document.getElementById("cafe-list");

  const radiusBtn = document.getElementById("cafes_within_radius_button");
  const radiusLat = document.getElementById("latRadius");
  const radiusLng = document.getElementById("lngRadius");
  const radiusInput = document.getElementById("radiusInput");
  const radiusList = document.getElementById("radius-list");

  const trackMeBtn = document.getElementById("track-me-btn");

  // --- Helpers ---
  const setStatus = m => statusEl.textContent = m;
  const setCoordsText = m => coordsEl.textContent = m;
  const clearLists = () => { closestList.innerHTML = ""; radiusList.innerHTML = ""; };

  // --- Fetch wrapper ---
  async function fetchJSON(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      return typeof data === "string" ? JSON.parse(data) : data;
    } catch { return null; }
  }

  // --- Normalise FC ---
  const normaliseFC = d =>
    d?.type === "FeatureCollection" ? d :
    Array.isArray(d) ? { type: "FeatureCollection", features: d } : null;

  // --- Add cafés ---
  function addCafes(data) {
    markersLayer.clearLayers();
    const fc = normaliseFC(data);
    if (!fc) return;

    const layer = L.geoJSON(fc, {
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
    markersLayer.addLayer(layer);
  }

  // --- Load counties ---
  async function loadCounties() {
    const geo = await fetchJSON(`${API_BASE}/counties/`);
    if (!geo) return;

    L.geoJSON(geo, {
      style: { color: "#ff8800", weight: 1, fillOpacity: 0 },
      onEachFeature: (f, l) => {
        const p = f.properties;
        l.bindPopup(`<i>${p.gaeilge_name}</i><br><b>${p.english_name}, ${p.province}</b>`);
      }
    }).addTo(countiesLayer);

    geo.features.forEach(f => {
      const opt = document.createElement("option");
      opt.value = f.properties.english_name;
      opt.textContent = f.properties.english_name;
      countySelect.appendChild(opt);
    });
  }

  // --- Reset map ---
  function resetMap() {
    console.log("RESET MAP");

    tempLayer.clearLayers();
    clearLists();

    if (routingControl) map.removeControl(routingControl), routingControl = null;

    countySelect.value = "";
    loadAllCafes();

    if (!map.hasLayer(countiesLayer)) {
      map.addLayer(countiesLayer);
      countiesVisible = true;
      toggleCountiesBtn.textContent = "Hide Counties";
    }

    map.closePopup();
  }

  // --- Live tracking ---
  let tracking = false, userMarker = null, accuracyCircle = null;

  function toggleTracking() {
    tracking = !tracking;
    trackMeBtn.textContent = tracking ? "Stop Tracking" : "Start Tracking Me";

    if (!tracking) {
      tempLayer.removeLayer(userMarker);
      tempLayer.removeLayer(accuracyCircle);
      userMarker = accuracyCircle = null;
      return;
    }

    navigator.geolocation.watchPosition(pos => {
      const { latitude, longitude, accuracy } = pos.coords;

      if (!userMarker) {
        userMarker = L.marker([latitude, longitude]).addTo(tempLayer);
        accuracyCircle = L.circle([latitude, longitude], {
          radius: accuracy, color: "blue", fillOpacity: .15
        }).addTo(tempLayer);
      } else {
        userMarker.setLatLng([latitude, longitude]);
        accuracyCircle.setLatLng([latitude, longitude]);
        accuracyCircle.setRadius(accuracy);
      }

      map.setView([latitude, longitude], map.getZoom());
    });
  }

  // --- Load all cafés ---
  async function loadAllCafes() {
    const data = await fetchJSON(`${API_BASE}/cafes_all/`);
    if (data) addCafes(data);
  }

  // --- Load cafés by county ---
  async function loadCafesInCounty(name) {
    if (!name) return loadAllCafes();
    const data = await fetchJSON(`${API_BASE}/cafes_in_county/${encodeURIComponent(name)}/`);
    if (data) addCafes(data);
    else alert(`No cafés in ${name}`);
  }

  // --- Closest cafés ---
  async function findClosestCafes() {
    const lat = parseFloat(closestLat.value);
    const lng = parseFloat(closestLng.value);
    if (isNaN(lat) || isNaN(lng)) return alert("Invalid coordinates");

    const data = await fetchJSON(`${API_BASE}/closest_cafes/?lat=${lat}&lng=${lng}`);
    if (!data) return;

    addCafes(data);

    L.marker([lat, lng]).addTo(tempLayer)
      .bindPopup("Search location").openPopup();

    map.setView([lat, lng], 16);

    const fc = normaliseFC(data);
    closestList.innerHTML = "<h6>Closest Cafés:</h6>";
    fc.features.forEach(f => {
      const p = f.properties;
      const [lng2, lat2] = f.geometry.coordinates;
      closestList.innerHTML += `
        <div class="border-bottom pb-2 mb-2">
          <b>${p.name ?? "Unnamed Café"}</b><br>${p.addr_street ?? ""} ${p.addr_city ?? ""}
          <button class="btn btn-dark btn-sm route-btn"
            data-lat="${lat2}" data-lng="${lng2}">Route</button>
        </div>`;
    });
  }

  // --- Radius search ---
  async function findCafesWithinRadius() {
    const lat = parseFloat(radiusLat.value);
    const lng = parseFloat(radiusLng.value);
    const r = parseFloat(radiusInput.value);
    if (isNaN(lat) || isNaN(lng) || isNaN(r)) return alert("Invalid radius");

    if (radiusCircle) tempLayer.removeLayer(radiusCircle);

    radiusCircle = L.circle([lat, lng], {
      radius: r, color:"blue", fillOpacity:.1
    }).addTo(tempLayer).bindPopup(`Radius: ${r} m`).openPopup();

    map.setView([lat, lng], 14);

    const data = await fetchJSON(`${API_BASE}/cafes_within_radius/?lat=${lat}&lng=${lng}&radius=${r}`);
    if (!data) return;

    addCafes(data);

    const fc = normaliseFC(data);
    radiusList.innerHTML = "<h6>Cafés Within Radius:</h6>";
    fc.features.forEach(f => {
      const p = f.properties;
      const [lng2, lat2] = f.geometry.coordinates;
      radiusList.innerHTML += `
        <div class="border-bottom pb-2 mb-2">
          <b>${p.name ?? "Unnamed Café"}</b><br>${p.addr_street ?? ""} ${p.addr_city ?? ""}
          <button class="btn btn-dark btn-sm route-btn"
            data-lat="${lat2}" data-lng="${lng2}">Route</button>
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
    };
    map.on("click", pick);
  }

  // --- Routing via popup ---
  map.on("popupopen", e => {
    const btn = e.popup._contentNode.querySelector(".route-btn");
    if (!btn) return;

    btn.addEventListener("click", () => {
      const lat = parseFloat(btn.dataset.lat);
      const lng = parseFloat(btn.dataset.lng);

      navigator.geolocation.getCurrentPosition(pos => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;

        if (routingControl) map.removeControl(routingControl);
        routingControl = L.Routing.control({
          waypoints: [
            L.latLng(userLat, userLng),
            L.latLng(lat, lng)
          ],
          lineOptions:{ styles:[{ color:"blue", weight:5 }] },
          show:false, addWaypoints:false
        }).addTo(map);
      });
    });
  });

  // --- Routing from sidebar ---
  document.addEventListener("click", e => {
    if (!e.target.classList.contains("route-btn")) return;

    const lat = parseFloat(e.target.dataset.lat);
    const lng = parseFloat(e.target.dataset.lng);

    navigator.geolocation.getCurrentPosition(pos => {
      if (routingControl) map.removeControl(routingControl);
      routingControl = L.Routing.control({
        waypoints:[
          L.latLng(pos.coords.latitude, pos.coords.longitude),
          L.latLng(lat, lng)
        ],
        lineOptions:{ styles:[{ color:"blue", weight:5 }] },
        show:false, addWaypoints:false
      }).addTo(map);
    });
  });

  // --- Events ---
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
    setStatus("Loading…");
    await loadCounties();
    await loadAllCafes();
    setStatus("Ready.");
  })();
});

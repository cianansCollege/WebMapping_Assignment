console.log("main.js loaded: cordova build");
console.log("APP ORIGIN:", window.location.origin);

const API_BASE = "https://webmapping-assignment.onrender.com/api";

document.addEventListener("deviceready", () => {
  console.log("Cordova app starting");

  let cachedUserLocation = null;

  navigator.geolocation.getCurrentPosition(
    pos => {
      cachedUserLocation = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      };
      console.log("User location cached:", cachedUserLocation);
    },
    err => console.warn("GPS not ready yet", err),
    { enableHighAccuracy: true }
  );

  const map = L.map("map").setView([53.34731, -6.258946], 11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 20,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  const markersLayer = L.markerClusterGroup().addTo(map);
  const countiesLayer = L.layerGroup().addTo(map);
  let libraryLayer = L.layerGroup().addTo(map);

  let radiusCircle = null;
  let routingControl = null;

  // FAVOURITE ICON
  const favouriteIcon = L.icon({
    iconUrl: "img/heart.png",
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -28]
  });

  const libraryIcon = L.icon({
    iconUrl: "img/library.png",
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -25]
  });

  // DOM references
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

  // UI helpers
  function setStatus(msg) { if (statusEl) statusEl.textContent = msg; }
  function setCoordsText(msg) { if (coordsDisplayEl) coordsDisplayEl.textContent = msg; }
  function clearLists() { closestListEl.innerHTML = ""; radiusListEl.innerHTML = ""; }

  // LocalStorage favourites
  function loadFavourites() { return JSON.parse(localStorage.getItem("favouriteCafes") || "[]"); }
  function saveFavourites(list) { localStorage.setItem("favouriteCafes", JSON.stringify(list)); }
  function toggleFavourite(id) {
    let favs = loadFavourites();
    if (favs.includes(id)) favs = favs.filter(x => x !== id);
    else favs.push(id);
    saveFavourites(favs);
  }

  // Basic fetch wrapper
  async function fetchJSON(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      return typeof data === "string" ? JSON.parse(data) : data;
    } catch {
      return null;
    }
  }

  function normaliseToFC(data) {
    if (data?.type === "FeatureCollection") return data;
    if (Array.isArray(data)) return { type: "FeatureCollection", features: data };
    return null;
  }

  // Add cafes to map
  function addCafes(data) {
    markersLayer.clearLayers();
    const fc = normaliseToFC(data);
    if (!fc) return;

    const favourites = loadFavourites();

    const geoLayer = L.geoJSON(fc, {
      pointToLayer: (feature, latlng) => {
        const id = feature.properties.id;
        if (favourites.includes(id)) return L.marker(latlng, { icon: favouriteIcon });
        return L.marker(latlng);
      },

      onEachFeature: (feature, layer) => {
        const p = feature.properties;
        const cafeId = p.id;

        layer.bindPopup(`
          <b>${p.name ?? "Unnamed Café"}</b><br>
          ${p.addr_street ?? ""}<br>${p.addr_city ?? ""}<br><br>

          <button class="btn btn-dark btn-sm route-btn"
            data-lng="${feature.geometry.coordinates[0]}"
            data-lat="${feature.geometry.coordinates[1]}">
            Route to here
          </button>

          <br><br>

          <button class="btn btn-primary btn-sm library-btn"
            data-lng="${feature.geometry.coordinates[0]}"
            data-lat="${feature.geometry.coordinates[1]}">
            Show Libraries Nearby
          </button>

          <br><br>

          <button class="btn btn-sm favourite-btn"
            data-id="${cafeId}">
            ${favourites.includes(cafeId) ? "Remove Favourite" : "Add Favourite"}
          </button>
        `);
      }
    });

    markersLayer.addLayer(geoLayer);
  }

  // Load counties
  async function loadCounties() {
    const geojson = await fetchJSON(`${API_BASE}/counties/`);
    if (!geojson) return;

    L.geoJSON(geojson, {
      style: { color: "#ff8800", weight: 1, fillOpacity: 0 }
    }).addTo(countiesLayer);

    geojson.features.forEach(f => {
      const opt = document.createElement("option");
      opt.value = f.properties.english_name;
      opt.textContent = f.properties.english_name;
      countySelect.appendChild(opt);
    });
  }

  async function loadAllCafes() {
    const data = await fetchJSON(`${API_BASE}/cafes_all/`);
    if (data) addCafes(data);
  }

  // Reset
  function resetMap() {
    if (radiusCircle) map.removeLayer(radiusCircle);
    if (routingControl) map.removeControl(routingControl);
    libraryLayer.clearLayers();
    clearLists();
    countySelect.value = "";
    loadAllCafes();
  }

  // County filter
  async function loadCafesInCounty(name) {
    if (!name) return loadAllCafes();
    const data = await fetchJSON(`${API_BASE}/cafes_in_county/${encodeURIComponent(name)}/`);
    if (data) addCafes(data);
  }

  // Closest cafes
  async function findClosestCafes() {
    const lat = parseFloat(closestLatInput.value);
    const lng = parseFloat(closestLngInput.value);
    if (isNaN(lat) || isNaN(lng)) return alert("Invalid coordinates");

    const data = await fetchJSON(`${API_BASE}/closest_cafes/?lat=${lat}&lng=${lng}`);
    if (!data) return;

    addCafes(data);

    closestListEl.innerHTML = "<h6>Closest Cafés:</h6>";
    normaliseToFC(data).features.forEach(f => {
      const p = f.properties;
      const [lng2, lat2] = f.geometry.coordinates;
      closestListEl.innerHTML += `
        <div class="border-bottom pb-2 mb-2">
          <b>${p.name}</b><br>${p.addr_street ?? ""} ${p.addr_city ?? ""}
          <button class="btn btn-dark btn-sm route-btn"
            data-lat="${lat2}" data-lng="${lng2}">
            Route
          </button>
        </div>
      `;
    });
  }

  // Radius cafes
  async function findCafesWithinRadius() {
    const lat = parseFloat(radiusLatInput.value);
    const lng = parseFloat(radiusLngInput.value);
    let r = parseFloat(radiusInput.value);
    if (isNaN(lat) || isNaN(lng)) return alert("Invalid coordinates");
    if (isNaN(r) || r <= 0) r = 2000;

    if (radiusCircle) map.removeLayer(radiusCircle);

    radiusCircle = L.circle([lat, lng], {
      radius: r, color: "blue", fillOpacity: 0.1
    }).addTo(map);

    map.setView([lat, lng], 14);

    const data = await fetchJSON(`${API_BASE}/cafes_within_radius/?lat=${lat}&lng=${lng}&radius=${r}`);
    if (!data) return;
    addCafes(data);

    radiusListEl.innerHTML = "<h6>Cafés Within Radius:</h6>";
    normaliseToFC(data).features.forEach(f => {
      const p = f.properties;
      const [lng2, lat2] = f.geometry.coordinates;
      radiusListEl.innerHTML += `
        <div class="border-bottom pb-2 mb-2">
          <b>${p.name}</b><br>${p.addr_street ?? ""} ${p.addr_city ?? ""}
          <button class="btn btn-dark btn-sm route-btn"
            data-lat="${lat2}" data-lng="${lng2}">
            Route
          </button>
        </div>
      `;
    });
  }

  // Counties toggle
  let countiesVisible = true;
  function toggleCounties() {
    if (countiesVisible) map.removeLayer(countiesLayer);
    else map.addLayer(countiesLayer);
    countiesVisible = !countiesVisible;
    toggleCountiesBtn.textContent = countiesVisible ? "Hide Counties" : "Show Counties";
  }

  // Coordinate picker
  function activateGetCoordinates() {
    setStatus("Tap on map");
    function handler(e) {
      setCoordsText(`Lat: ${e.latlng.lat.toFixed(5)}, Lng: ${e.latlng.lng.toFixed(5)}`);
      map.off("click", handler);
      setStatus("Selected");
    }
    map.on("click", handler);
  }

  // GPS helper
  function getDeviceLocation(cb) {
    navigator.geolocation.getCurrentPosition(
      pos => cb(pos.coords.latitude, pos.coords.longitude),
      () => alert("Cannot read location"),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  // Autofill buttons
  document.getElementById("use-my-location-closest")?.addEventListener("click", () => {
    getDeviceLocation((lat, lng) => {
      closestLatInput.value = lat.toFixed(6);
      closestLngInput.value = lng.toFixed(6);
      findClosestCafes();
    });
  });

  document.getElementById("use-my-location-radius")?.addEventListener("click", () => {
    getDeviceLocation((lat, lng) => {
      radiusLatInput.value = lat.toFixed(6);
      radiusLngInput.value = lng.toFixed(6);
    });
  });


  // Routing (popup)
  map.on("popupopen", e => {
    const btn = e.popup._contentNode.querySelector(".route-btn");
    if (!btn) return;

    btn.addEventListener("click", () => {
      const lat = parseFloat(btn.dataset.lat);
      const lng = parseFloat(btn.dataset.lng);

      getDeviceLocation((uLat, uLng) => {
        if (routingControl) map.removeControl(routingControl);

        routingControl = L.Routing.control({
          waypoints: [
            L.latLng(uLat, uLng),
            L.latLng(lat, lng)
          ],
          show: false,
          addWaypoints: false
        })
        .addTo(map)
        .on("routesfound", e => {
          const bounds = L.latLngBounds(e.routes[0].coordinates);
          map.fitBounds(bounds, { padding: [50, 50] });
        });
      });
    });
  });

  // Routing (sidebar)
  document.addEventListener("click", e => {
    if (!e.target.classList.contains("route-btn")) return;

    const lat = parseFloat(e.target.dataset.lat);
    const lng = parseFloat(e.target.dataset.lng);

    getDeviceLocation((uLat, uLng) => {
      if (routingControl) map.removeControl(routingControl);

      routingControl = L.Routing.control({
        waypoints: [
          L.latLng(uLat, uLng),
          L.latLng(lat, lng)
        ],
        show: false,
        addWaypoints: false
      }).addTo(map)
      .on("routesfound", e => {
        const bounds = L.latLngBounds(e.routes[0].coordinates);
        map.fitBounds(bounds, { padding: [50, 50] });
      });
    });
  });


  // Favourites click handler
  document.addEventListener("click", e => {
    const btn = e.target.closest(".favourite-btn");
    if (!btn) return;

    const id = parseInt(btn.dataset.id);
    if (isNaN(id)) return;

    toggleFavourite(id);
    loadAllCafes();
  });


  // Library search via Overpass
  async function fetchLibrariesNear(lat, lng) {
    const query = `
      [out:json][timeout:25];
      (
        node["amenity"="library"](around:10000, ${lat}, ${lng});
        way["amenity"="library"](around:10000, ${lat}, ${lng});
        relation["amenity"="library"](around:10000, ${lat}, ${lng});
      );
      out center;
    `;

    try {
      const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: query
      });
      const json = await res.json();
      return json.elements || [];
    } catch {
      alert("Library search failed");
      return [];
    }
  }


  // Library button handler
  document.addEventListener("click", async e => {
    const btn = e.target.closest(".library-btn");
    if (!btn) return;

    const cafeLat = parseFloat(btn.dataset.lat);
    const cafeLng = parseFloat(btn.dataset.lng);

    libraryLayer.clearLayers();

    const libs = await fetchLibrariesNear(cafeLat, cafeLng);
    if (!libs.length) {
      alert("No libraries found nearby");
      return;
    }

    // Draw library markers
    libs.forEach(lib => {
      const lat2 = lib.lat || lib.center?.lat;
      const lng2 = lib.lon || lib.center?.lon;
      if (!lat2 || !lng2) return;

      L.marker([lat2, lng2], { icon: libraryIcon })
        .addTo(libraryLayer)
        .bindPopup(`<b>Library</b><br>${lib.tags?.name ?? "Unnamed"}`);
    });

    // Find nearest library
    let nearest = null;
    let nearestDist = Infinity;

    libs.forEach(lib => {
      const lat2 = lib.lat || lib.center?.lat;
      const lng2 = lib.lon || lib.center?.lon;
      if (!lat2 || !lng2) return;

      const dist = L.latLng(cafeLat, cafeLng).distanceTo([lat2, lng2]);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = { lat: lat2, lng: lng2 };
      }
    });

    if (!nearest) return;

    // Route café → nearest library
    if (routingControl) map.removeControl(routingControl);

    routingControl = L.Routing.control({
      waypoints: [
        L.latLng(cafeLat, cafeLng),
        L.latLng(nearest.lat, nearest.lng)
      ],
      show: false,
      addWaypoints: false
    })
    .addTo(map)
    .on("routesfound", e => {
      const bounds = L.latLngBounds(e.routes[0].coordinates);
      map.fitBounds(bounds, { padding: [50, 50] });
    });
  });

  // Event listeners
  countySelect?.addEventListener("change", e => loadCafesInCounty(e.target.value));
  closestBtn?.addEventListener("click", findClosestCafes);
  radiusBtn?.addEventListener("click", findCafesWithinRadius);
  toggleCountiesBtn?.addEventListener("click", toggleCounties);
  zoomInBtn?.addEventListener("click", () => map.setZoom(map.getZoom() + 1));
  zoomOutBtn?.addEventListener("click", () => map.setZoom(map.getZoom() - 1));
  getCoordsBtn?.addEventListener("click", activateGetCoordinates);
  trackMeBtn?.addEventListener("click", () => toggleTracking());
  document.getElementById("reset-btn")?.addEventListener("click", resetMap);

  // Initial load
  (async () => {
    setStatus("Loading...");
    await loadCounties();
    await loadAllCafes();
    setStatus("Ready");
  })();
});

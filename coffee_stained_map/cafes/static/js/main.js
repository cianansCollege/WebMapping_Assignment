console.log("main.js loaded: test 1");

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM ready");

  // Map setup
  const map = L.map("map").setView([53.34731, -6.258946], 11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 20,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  const markersLayer = L.markerClusterGroup().addTo(map);
  const countiesLayer = L.layerGroup().addTo(map);

  let radiusCircle = null;
  let routingControl = null;
  let userLat = null;
  let userLng = null;
  let allCafesLayer = null;
  let closestCafesLayer = null;

  // Expose for debugging
  window.map = map;
  window.countiesLayer = countiesLayer;

  // DOM references -> cache buttons so i dont need to repeat query the dom by id, use vars instead
  const countySelect     = document.getElementById("county-select");
  const toggleCountiesBtn = document.getElementById("toggle-counties-button");
  const zoomInBtn        = document.getElementById("toggle-zoom-in-button");
  const zoomOutBtn       = document.getElementById("toggle-zoom-out-button");
  const getCoordsBtn     = document.getElementById("get-coordinates-button");
  const statusEl         = document.getElementById("status");
  const coordsDisplayEl  = document.getElementById("coords-display");

  const closestBtn       = document.getElementById("closest_cafes_button");
  const closestLatInput  = document.getElementById("latInput");
  const closestLngInput  = document.getElementById("lngInput");
  const closestListEl    = document.getElementById("cafe-list");

  const radiusBtn        = document.getElementById("cafes_within_radius_button");
  const radiusLatInput   = document.getElementById("latRadius");
  const radiusLngInput   = document.getElementById("lngRadius");
  const radiusInput      = document.getElementById("radiusInput");
  const radiusListEl     = document.getElementById("radius-list");

  const trackMeBtn       = document.getElementById("track-me-btn");

  // Simple UI helpers
  function setStatus(msg) {
    console.log(`STATUS: ${msg}`);
    if (statusEl) statusEl.textContent = msg;
  }

  function setCoordsText(msg) {
    if (coordsDisplayEl) coordsDisplayEl.textContent = msg;
  }

  function clearLists() {
    if (closestListEl) closestListEl.innerHTML = "";
    if (radiusListEl) radiusListEl.innerHTML = "";
  }

  // Fetch wrapper with logging @@@@
  async function fetchJSON(url, label = "Request") {
    console.log(`FETCH → ${url}`);
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      let data = await res.json();
      if (typeof data === "string") data = JSON.parse(data);
      return data;
    } catch (err) {
      console.error("Network error:", err);
      return null;
    }
  }

  // Format data as FeatureCollection
  function normaliseToFeatureCollection(data) {
    if (data?.type === "FeatureCollection") return data;
    if (Array.isArray(data)) return { type: "FeatureCollection", features: data };
    return null;
  }

  // Render café markers
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
          ${p.addr_street ?? ""}<br>${p.addr_city ?? ""}<br><br>
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

  // Load county polygons + dropdown
  async function loadCounties() {
    const geojson = await fetchJSON("/api/counties/");
    if (!geojson) return;

    L.geoJSON(geojson, {
      style: { color: "#ff8800", weight: 1, fillOpacity: 0 },
      onEachFeature: (f, layer) => {
        const p = f.properties;
        layer.bindPopup(`<i>${p.gaeilge_name}</i><br><b>${p.english_name}</b>`);
      }
    }).addTo(countiesLayer);

    geojson.features.forEach(f => {
      const opt = document.createElement("option");
      opt.value = f.properties.english_name;
      opt.textContent = f.properties.english_name;
      countySelect.appendChild(opt);
    });
  }

  // Live GPS tracking
  let tracking = false;
  let userMarker = null;
  let userAccuracyCircle = null;

  function toggleTracking() {
    tracking = !tracking;
    trackMeBtn.textContent = tracking ? "Stop Tracking" : "Start Tracking Me";

    if (!tracking) {
      if (userMarker) map.removeLayer(userMarker);
      if (userAccuracyCircle) map.removeLayer(userAccuracyCircle);
      userMarker = userAccuracyCircle = null;
      return;
    }

    navigator.geolocation.watchPosition(
      pos => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = pos.coords.accuracy;

        userLat = lat;
        userLng = lng;

        if (!userMarker) {
          userMarker = L.marker([lat, lng]).addTo(map);
        } else {
          userMarker.setLatLng([lat, lng]);
        }

        if (!userAccuracyCircle) {
          userAccuracyCircle = L.circle([lat, lng], {
            radius: acc, color: "blue", fillOpacity: 0.15
          }).addTo(map);
        } else {
          userAccuracyCircle.setLatLng([lat, lng]);
          userAccuracyCircle.setRadius(acc);
        }

        map.setView([lat, lng], map.getZoom());
      },
      () => alert("Enable GPS to track location.")
    );
  }

  // Load all cafés
  async function loadAllCafes() {
    const data = await fetchJSON("/api/cafes_all/");
    if (data) addCafes(data);
  }

  // Reset map state
  function resetMap() {
    if (radiusCircle) map.removeLayer(radiusCircle);
    if (closestCafesLayer) map.removeLayer(closestCafesLayer);
    if (routingControl) map.removeControl(routingControl);

    radiusCircle = closestCafesLayer = routingControl = null;

    clearLists();
    countySelect.value = "";
    loadAllCafes();

    if (!map.hasLayer(countiesLayer)) {
      map.addLayer(countiesLayer);
      countiesVisible = true;
      toggleCountiesBtn.textContent = "Hide Counties";
    }
  }

  // Filter cafés by county
  async function loadCafesInCounty(name) {
    if (!name) return loadAllCafes();
    const data = await fetchJSON(`/api/cafes_in_county/${encodeURIComponent(name)}/`);
    if (data) addCafes(data);
  }

  // Closest cafés
  async function findClosestCafes() {
    const lat = parseFloat(closestLatInput.value);
    const lng = parseFloat(closestLngInput.value);
    if (isNaN(lat) || isNaN(lng)) return alert("Invalid coordinates");

    const data = await fetchJSON(`/api/closest_cafes/?lat=${lat}&lng=${lng}`);
    if (!data) return;
    addCafes(data);

    closestListEl.innerHTML = "<h6>Closest Cafés:</h6>";
    const fc = normaliseToFeatureCollection(data);

    fc.features.forEach(f => {
      const p = f.properties || {};
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

  // Radius search
  async function findCafesWithinRadius() {
    const lat = parseFloat(radiusLatInput.value);
    const lng = parseFloat(radiusLngInput.value);
    let r = parseFloat(radiusInput.value);
    if (isNaN(lat) || isNaN(lng)) return alert("Invalid radius");
    if (isNaN(r) || r <= 0) r = 2000;

    radiusCircle = L.circle([lat, lng], {
      radius: r, color: "blue", fillOpacity: 0.1
    }).addTo(map);

    const data = await fetchJSON(`/api/cafes_within_radius/?lat=${lat}&lng=${lng}&radius=${r}`);
    if (!data) return;
    addCafes(data);

    radiusListEl.innerHTML = "<h6>Cafés Within Radius:</h6>";
    const fc = normaliseToFeatureCollection(data);

    fc.features.forEach(f => {
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

  // County visibility toggle
  let countiesVisible = true;
  function toggleCounties() {
    if (countiesVisible) map.removeLayer(countiesLayer);
    else map.addLayer(countiesLayer);
    countiesVisible = !countiesVisible;
    toggleCountiesBtn.textContent = countiesVisible ? "Hide Counties" : "Show Counties";
  }

  // Pick coordinates
  function activateGetCoordinates() {
    setStatus("Click a location");
    if (map.hasLayer(countiesLayer)) map.removeLayer(countiesLayer);

    function onClick(e) {
      setCoordsText(`Lat: ${e.latlng.lat.toFixed(5)}, Lng: ${e.latlng.lng.toFixed(5)}`);
      map.off("click", onClick);
      map.addLayer(countiesLayer);
      setStatus("Coordinate selected");
    }

    map.on("click", onClick);
  }

  // Browser location helper
  function getBrowserLocation(cb) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        userLat = pos.coords.latitude;
        userLng = pos.coords.longitude;
        cb(userLat, userLng);
      },
      () => alert("Unable to get location"),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  // Autofill “Use My Location”
  document.getElementById("use-my-location-closest")?.addEventListener("click", () => {
    getBrowserLocation((lat, lng) => {
      closestLatInput.value = lat.toFixed(6);
      closestLngInput.value = lng.toFixed(6);
      findClosestCafes();
    });
  });

  document.getElementById("use-my-location-radius")?.addEventListener("click", () => {
    getBrowserLocation((lat, lng) => {
      radiusLatInput.value = lat.toFixed(6);
      radiusLngInput.value = lng.toFixed(6);
    });
  });

  // Pick-on-map for closest
  function pickLocationForClosest() {
    if (map.hasLayer(countiesLayer)) map.removeLayer(countiesLayer);

    function handleClick(e) {
      closestLatInput.value = e.latlng.lat.toFixed(6);
      closestLngInput.value = e.latlng.lng.toFixed(6);
      map.addLayer(countiesLayer);
      map.off("click", handleClick);
      findClosestCafes();
    }

    map.on("click", handleClick);
  }

  // Pick-on-map for radius
  function pickLocationForRadius() {
    if (map.hasLayer(countiesLayer)) map.removeLayer(countiesLayer);

    function handleClick(e) {
      radiusLatInput.value = e.latlng.lat.toFixed(6);
      radiusLngInput.value = e.latlng.lng.toFixed(6);
      map.addLayer(countiesLayer);
      map.off("click", handleClick);
      findCafesWithinRadius();
    }

    map.on("click", handleClick);
  }

  document.getElementById("pick-on-map-closest")?.addEventListener("click", pickLocationForClosest);
  document.getElementById("pick-on-map-radius")?.addEventListener("click", pickLocationForRadius);

  // Routing (popup)
    map.on("popupopen", e => {
      const btn = e.popup._contentNode.querySelector(".route-btn");
      if (!btn) return;

      btn.addEventListener("click", () => {
        console.log("Popup routing button clicked");
        const lat = parseFloat(btn.dataset.lat);
        const lng = parseFloat(btn.dataset.lng);

        navigator.geolocation.getCurrentPosition(
          pos => {
            const uLat = pos.coords.latitude;
            const uLng = pos.coords.longitude;

            if (routingControl) map.removeControl(routingControl);

            routingControl = L.Routing.control({
              waypoints: [
                L.latLng(uLat, uLng),
                L.latLng(lat, lng)
              ],
              show: false,
              addWaypoints: false
            }).addTo(map)
            .on("routesfound", function(e) {
                const route = e.routes[0];
                const bounds = L.latLngBounds(route.coordinates);
                map.fitBounds(bounds, { padding: [50, 50] });
            });
          },
          () => alert("Enable location")
        );
      });
    });

    // Routing (sidebar)
    document.addEventListener("click", e => {
      if (!e.target.classList.contains("route-btn")) return;

      const lat = parseFloat(e.target.dataset.lat);
      const lng = parseFloat(e.target.dataset.lng);

      navigator.geolocation.getCurrentPosition(
        pos => {
          const uLat = pos.coords.latitude;
          const uLng = pos.coords.longitude;

          if (routingControl) map.removeControl(routingControl);

          routingControl = L.Routing.control({
            waypoints: [
              L.latLng(uLat, uLng),
              L.latLng(lat, lng)
            ],
            show: false,
            addWaypoints: false
          }).addTo(map)
          .on("routesfound", function(e) {
              const route = e.routes[0];
              const bounds = L.latLngBounds(route.coordinates);
              map.fitBounds(bounds, { padding: [50, 50] });
          });
        },
        () => alert("Enable location")
      );
    });

  // Event listeners
  countySelect?.addEventListener("change", e => loadCafesInCounty(e.target.value));
  closestBtn?.addEventListener("click", findClosestCafes);
  radiusBtn?.addEventListener("click", findCafesWithinRadius);
  toggleCountiesBtn?.addEventListener("click", toggleCounties);
  zoomInBtn?.addEventListener("click", () => map.setZoom(map.getZoom() + 1));
  zoomOutBtn?.addEventListener("click", () => map.setZoom(map.getZoom() - 1));
  getCoordsBtn?.addEventListener("click", activateGetCoordinates);
  trackMeBtn?.addEventListener("click", toggleTracking);
  document.getElementById("reset-btn")?.addEventListener("click", resetMap);

  // Initial load
  (async () => {
    setStatus("Loading…");
    await loadCounties();
    await loadAllCafes();
    setStatus("Ready.");
  })();
});

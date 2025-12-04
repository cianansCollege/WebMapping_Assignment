console.log("🔥 main.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  console.log("🟢 DOM ready");

  // ============================================================
  // MAP INITIALISATION
  // ============================================================
  const map = L.map("map").setView([53.34731, -6.258946], 11);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 20,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  // Layers
  const markersLayer = L.markerClusterGroup().addTo(map);
  const countiesLayer = L.layerGroup().addTo(map);
  let radiusCircle = null;

  // Expose for debugging
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

  // ============================================================
  // SMALL UI HELPERS
  // ============================================================
  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg;
  }

  function setCoordsText(msg) {
    if (coordsDisplayEl) coordsDisplayEl.textContent = msg;
  }

  function clearLists() {
    if (closestListEl) closestListEl.innerHTML = "";
    if (radiusListEl) radiusListEl.innerHTML = "";
  }

  // ============================================================
  // FETCH HELPER — with basic error handling
  // ============================================================
  async function fetchJSON(url, errorLabel = "Request") {
    try {
      const res = await fetch(url);

      if (!res.ok) {
        console.error(`${errorLabel} failed: HTTP ${res.status}`, res);
        return null;
      }

      let data = await res.json();

      // Handle stringified JSON edge case
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch (e) {
          console.error(`${errorLabel} JSON parse error:`, e);
          return null;
        }
      }

      return data;
    } catch (err) {
      console.error(`${errorLabel} network error:`, err);
      return null;
    }
  }

  // ============================================================
  // GEO HELPERS
  // ============================================================
  function normaliseToFeatureCollection(data) {
    if (data &&
        data.type === "FeatureCollection" &&
        Array.isArray(data.features)) {
      return data;
    }
    if (Array.isArray(data)) {
      return { type: "FeatureCollection", features: data };
    }
    console.warn("Unexpected GeoJSON format:", data);
    return null;
  }

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
  // LOAD COUNTIES + POPULATE DROPDOWN
  // ============================================================
  async function loadCounties() {
    const geojson = await fetchJSON("/api/counties/", "Load counties");
    if (!geojson) return;

    // Render polygons
    L.geoJSON(geojson, {
      style: { color: "#ff8800", weight: 1, fillOpacity: 0 },
      onEachFeature: (feature, layer) => {
        const props = feature.properties || {};
        layer.bindPopup(`
          <i>${props.gaeilge_name}</i><br>
          <b>${props.english_name}, ${props.province}</b>
        `);
      }
    }).addTo(countiesLayer);

    // Populate county select
    if (countySelect) {
      geojson.features.forEach(f => {
        const { english_name } = f.properties || {};
        if (!english_name) return;

        const opt = document.createElement("option");
        opt.value = english_name;
        opt.textContent = english_name;
        countySelect.appendChild(opt);
      });
    }
  }

  // ============================================================
  // LOAD ALL CAFÉS
  // ============================================================
  async function loadAllCafes() {
    const data = await fetchJSON("/api/cafes_osm/", "Load all cafés");
    if (!data) return;
    addCafes(data);
  }

  // ============================================================
  // FILTER BY COUNTY
  // ============================================================
  async function loadCafesInCounty(countyName) {
    if (!countyName) {
      console.log("🔄 Reset to all cafés (empty county selection)");
      await loadAllCafes();
      return;
    }

    console.log("📍 Filtering by county:", countyName);

    const url = `/api/cafes_in_county/${encodeURIComponent(countyName)}/`;
    const data = await fetchJSON(url, "Load cafés in county");

    if (!data) return;

    addCafes(data);

    const fc = normaliseToFeatureCollection(data);
    const features = fc?.features || [];

    if (!features.length) {
      alert(`No cafés found in ${countyName}.`);
    }
  }

  // ============================================================
  // FIND CLOSEST CAFÉS
  // ============================================================
  async function findClosestCafes() {
    const lat = parseFloat(closestLatInput.value);
    const lng = parseFloat(closestLngInput.value);

    if (isNaN(lat) || isNaN(lng)) {
      alert("Enter valid coordinates");
      return;
    }

    const url = `/api/closest_cafes/?lat=${lat}&lng=${lng}`;
    const data = await fetchJSON(url, "Closest cafés");
    if (!data) return;

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
    if (closestListEl) {
      closestListEl.innerHTML = "<h6 class='fw-semibold mt-3'>Closest Cafés:</h6>";

      const fc = normaliseToFeatureCollection(data);
      const features = fc?.features || [];

      if (features.length) {
        features.forEach(f => {
          const p = f.properties || {};
          closestListEl.innerHTML += `
            <div class="border-bottom pb-2 mb-2">
              <b>${p.name ?? "Unnamed Café"}</b><br>
              ${p.addr_street ?? ""} ${p.addr_city ?? ""}<br>
            </div>`;
        });
      } else {
        closestListEl.innerHTML += "<p>No cafés found.</p>";
      }
    }
  }

  // ============================================================
  // CAFÉS WITHIN RADIUS
  // ============================================================
  async function findCafesWithinRadius() {
    const lat    = parseFloat(radiusLatInput.value);
    const lng    = parseFloat(radiusLngInput.value);
    const radius = parseFloat(radiusInput.value);

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
    })
      .addTo(map)
      .bindPopup(`Search area: ${radius} m`)
      .openPopup();

    map.setView([lat, lng], 14);

    const url = `/api/cafes_within_radius/?lat=${lat}&lng=${lng}&radius=${radius}`;
    const data = await fetchJSON(url, "Cafés within radius");
    if (!data) return;

    addCafes(data);

    if (radiusListEl) {
      radiusListEl.innerHTML = "<h6 class='fw-semibold mt-3'>Cafés Within Radius:</h6>";

      const fc = normaliseToFeatureCollection(data);
      const features = fc?.features || [];

      if (features.length) {
        features.forEach(f => {
          const p = f.properties || {};
          radiusListEl.innerHTML += `
            <div class="border-bottom pb-2 mb-2">
              <b>${p.name ?? "Unnamed Café"}</b><br>
              ${p.addr_street ?? ""} ${p.addr_city ?? ""}<br>
            </div>`;
        });
      } else {
        radiusListEl.innerHTML += "<p>No cafés found within this radius.</p>";
      }
    }
  }

  // ============================================================
  // TOGGLE COUNTIES LAYER
  // ============================================================
  let countiesVisible = true;

  function toggleCounties() {
    if (countiesVisible) {
      map.removeLayer(countiesLayer);
    } else {
      map.addLayer(countiesLayer);
    }

    countiesVisible = !countiesVisible;

    toggleCountiesBtn.textContent = countiesVisible
      ? "Hide Counties"
      : "Show Counties";
  }

  // ============================================================
  // GET COORDINATES
  // ============================================================
  function activateGetCoordinates() {
    setStatus("Click anywhere on the map to select coordinates.");

    // Hide counties while picking
    if (map.hasLayer(countiesLayer)) {
      map.removeLayer(countiesLayer);
    }

    function onMapClick(e) {
      const { lat, lng } = e.latlng;

      setCoordsText(`Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`);

      map.off("click", onMapClick);
      map.addLayer(countiesLayer);

      setStatus("Coordinate selected.");
    }

    map.on("click", onMapClick);
  }

  // ============================================================
  // EVENT LISTENERS
  // ============================================================
  if (countySelect) {
    countySelect.addEventListener("change", e => {
      const countyName = e.target.value;
      loadCafesInCounty(countyName);
    });
  }

  if (closestBtn) {
    closestBtn.addEventListener("click", findClosestCafes);
  }

  if (radiusBtn) {
    radiusBtn.addEventListener("click", findCafesWithinRadius);
  }

  if (toggleCountiesBtn) {
    toggleCountiesBtn.addEventListener("click", toggleCounties);
  }

  if (zoomInBtn) {
    zoomInBtn.addEventListener("click", () =>
      map.setZoom(map.getZoom() + 1)
    );
  }

  if (zoomOutBtn) {
    zoomOutBtn.addEventListener("click", () =>
      map.setZoom(map.getZoom() - 1)
    );
  }

  if (getCoordsBtn) {
    getCoordsBtn.addEventListener("click", activateGetCoordinates);
  }

  // ============================================================
  // INITIAL LOAD
  // ============================================================
  (async () => {
    setStatus("Loading data…");
    await Promise.all([
      loadCounties(),
      loadAllCafes(),
    ]);
    setStatus("Ready.");
  })();

});

console.log("main.js loaded: test 1");

document.addEventListener("DOMContentLoaded", () => {

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

  console.log("DOM ready");

  // Map setup
  const map = L.map("map").setView([53.34731, -6.258946], 11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 20,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  const markersLayer = L.markerClusterGroup().addTo(map);
  const countiesLayer = L.layerGroup().addTo(map);
  let libraryLayer = L.layerGroup().addTo(map);


  // Heart icon for favourites
  const favouriteIcon = L.icon({
    iconUrl: "/static/img/heart.png",   // you must add this file
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -28]
  });

  const libraryIcon = L.icon({
    iconUrl: "/static/img/library.png",
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -25]
  });



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

  function loadFavourites() {
    return JSON.parse(localStorage.getItem("favouriteCafes") || "[]");
  }

  function saveFavourites(list) {
    localStorage.setItem("favouriteCafes", JSON.stringify(list));
  }

  function toggleFavourite(cafeId) {
      let favs = loadFavourites();
      console.log("FAVOURITES: Current favourites before toggle:", favs);
      if (favs.includes(cafeId)) {
          console.log("FAVOURITES: Removing", cafeId);
          favs = favs.filter(id => id !== cafeId);
      } else {
          console.log("FAVOURITES: Adding", cafeId);
          favs.push(cafeId);
      }

      saveFavourites(favs);
      console.log("FAVOURITES: Updated favourites saved:", favs);
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

      if (!fc) {
          console.log("CAFES: FeatureCollection invalid, aborting.");
          return;
      }

      const favourites = loadFavourites();

      const geoLayer = L.geoJSON(fc, {
          pointToLayer: (feature, latlng) => {
              const cafeId = feature.properties.id;
              const isFavourite = favourites.includes(cafeId);

              if (isFavourite) {
                  return L.marker(latlng, { icon: favouriteIcon });
              }
              return L.marker(latlng);
          },

          onEachFeature: (feature, layer) => {
              const p = feature.properties;
              const cafeId = feature.properties.id;
              const isFavourite = favourites.includes(cafeId);

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
                      ${isFavourite ? "Remove Favourite" : "Add Favourite"}
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

        map.setView([lat, lng], 13);
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
    if (libraryLayer) map.removeLayer(libraryLayer);

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
    if (!cachedUserLocation) {
      alert("Getting your location… try again in 1–2 seconds.");
      return;
    }

    cb(cachedUserLocation.lat, cachedUserLocation.lng);
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

        if (!cachedUserLocation) {
          alert("Getting your location… try again.");
          return;
        }

        const uLat = cachedUserLocation.lat;
        const uLng = cachedUserLocation.lng;

        const lat = parseFloat(btn.dataset.lat);
        const lng = parseFloat(btn.dataset.lng);

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

    // Routing (sidebar)
    document.addEventListener("click", e => {
      if (!e.target.classList.contains("route-btn")) return;

      if (!cachedUserLocation) {
        alert("Getting your location… try again.");
        return;
      }

      const uLat = cachedUserLocation.lat;
      const uLng = cachedUserLocation.lng;

      const lat = parseFloat(e.target.dataset.lat);
      const lng = parseFloat(e.target.dataset.lng);

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

        const url = "https://overpass-api.de/api/interpreter";

        try {
            const response = await fetch(url, {
                method: "POST",
                body: query
            });

            const json = await response.json();
            return json.elements || [];
        } catch (err) {
            console.error("LIBRARIES: Overpass request failed:", err);
            alert("Failed to load libraries withink 10km.");
            return [];
        }
    }


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
  
  document.addEventListener("click", e => {
      const favBtn = e.target.closest(".favourite-btn");

      if (!favBtn) {
          return;
      }

      const rawId = favBtn.dataset.id;
      const cafeId = parseInt(rawId);

      if (isNaN(cafeId)) {
          return;
      }

      toggleFavourite(cafeId);
      loadAllCafes();
  });

  document.addEventListener("click", async e => {
      const btn = e.target.closest(".library-btn");
      if (!btn) return;

      const cafeLat = parseFloat(btn.dataset.lat);
      const cafeLng = parseFloat(btn.dataset.lng);

      // Clear previous library markers
      libraryLayer.clearLayers();

      // Fetch libraries
      const libs = await fetchLibrariesNear(cafeLat, cafeLng);

      if (!libs.length) {
          alert("No libraries found nearby.");
          return;
      }

      // put libraries on the map
      libs.forEach(lib => {
          const lat2 = lib.lat || lib.center?.lat;
          const lng2 = lib.lon || lib.center?.lon;

          if (!lat2 || !lng2) return;

          L.marker([lat2, lng2], { icon: libraryIcon })
              .addTo(libraryLayer)
              .bindPopup(`<b>Library</b><br>${lib.tags?.name ?? "Unnamed"}`);
      });

      // Choose the closest library
      let nearest = null;
      let nearestDist = Infinity;

      libs.forEach(lib => {
          const lat2 = lib.lat || lib.center?.lat;
          const lng2 = lib.lon || lib.center?.lon;
          if (!lat2 || !lng2) return;

          const dist = L.latLng(cafeLat, cafeLng).distanceTo([lat2, lng2]);
          if (dist < nearestDist) {
              nearestDist = dist;
              nearest = { lat: lat2, lng: lng2, name: lib.tags?.name ?? "Library" };
          }
      });

      if (!nearest) {
          console.log("LIBRARIES: no valid nearest library found");
          return;
      }

      // Remove old routing line if it exists
      if (routingControl) map.removeControl(routingControl);

      // Add new routing line from café to nearest library
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





  // Initial load
  (async () => {
    setStatus("Loading…");
    await loadCounties();
    await loadAllCafes();
    setStatus("Ready.");
  })();
});

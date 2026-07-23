/* Colorado 14ers roadtrip map. Data comes from data.js (generated). */

const CLASS_COLOR = {
  "Class 1": "#4bbf73",
  "Class 2": "#9ac93f",
  "Difficult Class 2": "#e2c541",
  "Easy Class 3": "#f0932b",
  "Class 3": "#e8613c",
  "Class 4": "#d6344f",
};
// Risk levels, escalating. RISK_ORDER comes from data.js.
const RISK_COLOR = {
  Low: "#4bbf73",
  Moderate: "#e2c541",
  Considerable: "#f0932b",
  High: "#e8613c",
  Extreme: "#d6344f",
};
// The three risk dimensions rated per route, in the order shown.
const RISKS = [
  ["exposure", "Exposure"],
  ["rockfall", "Rockfall"],
  ["routefinding", "Route-finding"],
];
const riskRank = (level) => RISK_ORDER.indexOf(level);

const LAYERS_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
  '<path d="M12 3 2 8.5 12 14l10-5.5L12 3Zm7.1 8.1L12 15 4.9 11.1 2 12.7 12 18.2l10-5.5-2.9-1.6Z"/>' +
  "</svg>";

// Inline so it works with no icon font or external request.
const TENT_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
  '<path d="M12 3.2 2.4 20.2h19.2L12 3.2Zm0 4.9 5.6 9.9h-3.1L12 13.4l-2.5 4.6H6.4L12 8.1Z"/>' +
  "</svg>";

// A water drop -- lake trails are a separate category from peaks and hubs, so
// they get their own silhouette rather than reusing either marker shape.
const WAVE_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
  '<path d="M12 2.5c3.6 5.1 7 9.3 7 13a7 7 0 1 1-14 0c0-3.7 3.4-7.9 7-13Z"/>' +
  "</svg>";

const hubById = Object.fromEntries(HUBS.map((h) => [h.id, h]));
const peakNames = new Set(PEAKS.map((p) => p.name));
const featuredNames = () => PEAKS.filter((p) => p.featured).map((p) => p.name);

// Which peaks are on the map at all. Persisted so a hand-curated selection
// survives reloads; the filters below operate only on this set.
const STORE_KEY = "14ers-enabled-v1";

/* --- share links -------------------------------------------------------
   The selection is encoded as a bitmask in the URL hash, so a link carries
   it between devices with no server involved. Bit position is derived from
   each peak's stable id rather than this array's index, so adding, removing
   or reordering peaks can never make an existing link point at the wrong
   mountains -- it only ever drops bits for peaks that no longer exist.     */
const ID_BASE = 10000;
const EMPTY_CODE = "0";

function encodeSelection(names) {
  const offsets = [...names]
    .map((n) => PEAKS.find((p) => p.name === n))
    .filter(Boolean)
    .map((p) => p.id - ID_BASE)
    .filter((o) => o >= 0);
  if (!offsets.length) return EMPTY_CODE;

  const bytes = new Uint8Array((Math.max(...offsets) >> 3) + 1);
  offsets.forEach((o) => (bytes[o >> 3] |= 1 << (o & 7)));
  const bin = String.fromCharCode(...bytes);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeSelection(code) {
  if (code === EMPTY_CODE) return new Set();
  const bin = atob(code.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const out = new Set();
  PEAKS.forEach((p) => {
    const o = p.id - ID_BASE;
    if (o >= 0 && (bytes[o >> 3] >> (o & 7)) & 1) out.add(p.name);
  });
  return out;
}

const hashCode = () => (location.hash.match(/[#&]p=([A-Za-z0-9_-]+)/) || [])[1];

function shareUrl() {
  return (
    location.origin + location.pathname + location.search +
    "#p=" + encodeSelection(state.enabled)
  );
}

// Keep the address bar in sync without pushing history entries, so the URL is
// always copyable straight from the browser.
function syncUrl() {
  history.replaceState(null, "", shareUrl());
}

function loadEnabled() {
  const code = hashCode();
  if (code) {
    try {
      return decodeSelection(code);
    } catch {
      /* malformed link — fall through to stored/default selection */
    }
  }
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (!Array.isArray(saved)) return new Set(featuredNames());
    // Drop names that no longer exist so a data update can't wedge the picker.
    const known = saved.filter((n) => peakNames.has(n));
    return new Set(known);
  } catch {
    return new Set(featuredNames());
  }
}

function saveEnabled() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify([...state.enabled]));
  } catch {
    /* private browsing / storage disabled — selection just won't persist */
  }
}

const state = {
  hub: "",
  maxClass: CLASS_ORDER.length - 1,
  maxRisk: RISK_ORDER.length - 1,
  selected: null,
  selectedLake: null,
  enabled: loadEnabled(),
};

/* ---------------- map ---------------- */

const OSM_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const ESRI_ATTR = "Tiles &copy; Esri — Source: Esri, USGS, NOAA";
const ESRI_HILLSHADE =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}";
const ofm = (name) => `https://tiles.openfreemap.org/styles/${name}`;

const TOPO_TILES = "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png";
const TOPO_ATTR = `Map data ${OSM_ATTR}, <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)`;
// OpenTopoMap's contour/relief shading is great close up but goes muddy red-brown
// at low zoom, where it swamps the markers. So it's only drawn once zoomed in,
// fading in across this range with a muted vector basemap underneath.
const TOPO_MIN = 10.5;
const TOPO_FULL = 11.5;

// Vector basemaps from OpenFreeMap (no API key).
const BASEMAPS = {
  Terrain: { style: ofm("positron"), hillshade: true, topo: true },
  Roads: { style: ofm("bright") },
  Dark: { style: ofm("dark"), hillshade: true, dark: true },
};
const DEFAULT_BASEMAP = "Terrain";

state.basemap = DEFAULT_BASEMAP;

const map = new maplibregl.Map({
  container: "map",
  style: BASEMAPS[DEFAULT_BASEMAP].style,
  center: [-106.4, 39.0],
  zoom: 5.6,
  attributionControl: { compact: true },
});
map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");

// MapLibre renders the compact attribution expanded, so the map opens with a
// ~540px credit bar across the bottom. Collapse it to its "i" button.
//
// Timing matters: attribution starts empty and is only populated once sources
// load, and MapLibre adds `maplibregl-compact-show` at that point -- so removing
// the class on "load" is too early and simply gets undone. Wait for the compact
// class to appear, then collapse once and unhook.
//
// This sticks: MapLibre only re-adds `compact-show` when `maplibregl-compact` is
// absent, and it stays present from here on. Its own toggle reads the class off
// the DOM rather than tracking state, so the button keeps working normally.
const collapseAttribution = () => {
  const el = map.getContainer().querySelector(".maplibregl-ctrl-attrib");
  if (!el || !el.classList.contains("maplibregl-compact")) return;
  el.classList.remove("maplibregl-compact-show");
  map.off("sourcedata", collapseAttribution);
  map.off("idle", collapseAttribution);
};
map.on("sourcedata", collapseAttribution);
map.on("idle", collapseAttribution);

// Overlay the Esri hillshade on a vector style. Added as a live layer rather than
// patched into the style JSON: setStyle() replaces everything, so this has to be
// reapplied on every style.load anyway, and doing it through the map API avoids
// handing MapLibre a style object it would mutate.
function addHillshade(opacity) {
  if (map.getSource("hillshade")) return;
  map.addSource("hillshade", {
    type: "raster",
    tiles: [ESRI_HILLSHADE],
    tileSize: 256,
    maxzoom: 16,
    attribution: ESRI_ATTR,
  });
  // Sit above the landcover/water fills but below the road lines and labels:
  // underneath the fills the relief gets washed out, on top it mutes the text.
  const layers = map.getStyle().layers;
  const lastFill = layers.findLastIndex((l) => l.type === "fill");
  const beforeId = layers[lastFill + 1]?.id;
  map.addLayer(
    { id: "hillshade", type: "raster", source: "hillshade", paint: { "raster-opacity": opacity } },
    beforeId
  );
}

// OpenTopoMap on top of the vector base, but only once zoomed in far enough that
// its colouring helps rather than hurts. Below TOPO_MIN it's fully transparent,
// so what shows through is the muted vector style plus hillshade.
function addTopo() {
  if (map.getSource("topo")) return;
  map.addSource("topo", {
    type: "raster",
    tiles: [TOPO_TILES.replace("{s}", "a"), TOPO_TILES.replace("{s}", "b")],
    tileSize: 256,
    maxzoom: 17,
    attribution: TOPO_ATTR,
  });
  map.addLayer({
    id: "topo",
    type: "raster",
    source: "topo",
    minzoom: TOPO_MIN,
    paint: {
      "raster-opacity": ["interpolate", ["linear"], ["zoom"], TOPO_MIN, 0, TOPO_FULL, 1],
    },
  });
}

// Colorado is bounded by two meridians and two parallels, so a rectangle traces
// it closely enough at these zooms (the surveyed line has small jogs).
const CO_BORDER = {
  type: "Feature",
  geometry: {
    type: "LineString",
    coordinates: [
      [-109.0448, 41.0006],
      [-102.0415, 41.0006],
      [-102.0415, 36.9931],
      [-109.0448, 36.9931],
      [-109.0448, 41.0006],
    ],
  },
};

// State lines on every basemap: neighbouring states in a neutral tone, Colorado
// picked out in the accent colour so the trip area reads at a glance.
function addBorders() {
  if (!map.getSource("co-border")) {
    map.addSource("co-border", { type: "geojson", data: CO_BORDER });
  }
  // Other states come from the vector tiles' admin boundaries.
  if (map.getSource("openmaptiles") && !map.getLayer("state-lines")) {
    map.addLayer({
      id: "state-lines",
      type: "line",
      source: "openmaptiles",
      "source-layer": "boundary",
      filter: ["==", ["get", "admin_level"], 4],
      paint: {
        "line-color": BASEMAPS[state.basemap]?.dark ? "#8fa3b5" : "#6b7c8c",
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.8, 10, 2],
        "line-opacity": 0.85,
      },
    });
  }
  if (!map.getLayer("co-border-line")) {
    map.addLayer({
      id: "co-border-line",
      type: "line",
      source: "co-border",
      paint: {
        "line-color": "#f2a65a",
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 1.6, 10, 3.5],
        "line-opacity": 0.95,
      },
    });
  }
}

// Fires on first load and after every setStyle, which is exactly when these
// added layers and the dark-marker class need reapplying.
map.on("style.load", () => {
  const cfg = BASEMAPS[state.basemap] || {};
  if (cfg.hillshade) addHillshade(cfg.dark ? 0.3 : 0.5);
  if (cfg.topo) addTopo();
  addBorders(); // last, so the lines draw over the topo raster
  map.getContainer().classList.toggle("map-dark", !!cfg.dark);
});

function setBasemap(name) {
  if (!BASEMAPS[name]) return;
  state.basemap = name;
  // Markers are DOM elements owned by MapLibre, so they survive setStyle.
  map.setStyle(BASEMAPS[name].style);
  document
    .querySelectorAll("[data-basemap]")
    .forEach((el) => el.classList.toggle("is-on", el.dataset.basemap === name));
}

const markers = new Map(); // peak name -> { marker, el }
const hubMarkers = [];
const lakeMarkers = new Map(); // lake name -> { marker, el }

// Marker ring = difficulty class, inner dot = exposure.
function peakEl(p) {
  const el = document.createElement("div");
  el.className = "pk-marker";
  el.title = p.name;
  el.style.background = CLASS_COLOR[p.cls];
  el.innerHTML = `<i style="background:${RISK_COLOR[p.exposure]}"></i>`;
  return el;
}

function riskRow(p) {
  return RISKS.map(
    ([key, label]) =>
      `<span class="tag risk"><span class="dot" style="background:${RISK_COLOR[p[key]]}"></span>` +
      `${label} ${p[key]}</span>`
  ).join("");
}

function peakPopup(p) {
  return (
    `<h3>${p.name}</h3>` +
    `<div>${p.elev.toLocaleString()} ft · #${p.rank} · ${p.range}</div>` +
    `<div><strong>${p.cls}</strong> · ${p.dist} · ${p.gain} gain</div>` +
    `<div class="tags">${riskRow(p)}</div>` +
    `<p>${p.note}</p>` +
    `<p>Base: <strong>${hubById[p.hub].name}</strong></p>` +
    `<p class="popup-route">Standard route: <strong>${p.route}</strong></p>`
  );
}

function lakePopup(l) {
  return (
    `<h3>${l.name}</h3>` +
    `<div>${l.elev.toLocaleString()} ft</div>` +
    `<div>${l.dist} · ${l.gain} gain</div>` +
    `<p>${l.note}</p>`
  );
}

// Basemap switcher and legend share one collapsible control, so the map keeps a
// single button in the corner. MapLibre has no built-in layer control.
class MapPanel {
  onAdd() {
    const swatches = (items, render) => items.map((i) => `<li>${render(i)}</li>`).join("");

    const el = document.createElement("div");
    el.className = "maplibregl-ctrl maplibregl-ctrl-group map-panel";
    el.innerHTML =
      `<button class="map-panel-toggle" type="button" title="Basemap & legend" ` +
      `aria-label="Basemap and legend">${LAYERS_SVG}</button>` +
      `<div class="map-panel-body">` +
      `<h4>Basemap</h4>` +
      `<div class="map-panel-bases">` +
      Object.keys(BASEMAPS)
        .map((n) => `<button type="button" data-basemap="${n}">${n}</button>`)
        .join("") +
      `</div>` +
      `<div class="map-legend">` +
      `<h4>Peak markers</h4>` +
      `<p class="map-legend-hint">Ring colour = difficulty of the standard route.</p>` +
      `<ul>${swatches(CLASS_ORDER, (c) =>
        `<span class="lg-ring" style="background:${CLASS_COLOR[c]}"></span>${c}`
      )}</ul>` +
      `<p class="map-legend-hint">Centre dot = exposure (how bad a fall would be).</p>` +
      `<ul>${swatches(RISK_ORDER, (r) =>
        `<span class="lg-dot" style="background:${RISK_COLOR[r]}"></span>${r}`
      )}</ul>` +
      `<h4>Hubs</h4>` +
      `<ul><li><span class="lg-tent">${TENT_SVG}</span>Town to sleep &amp; climb from</li></ul>` +
      `<h4>Lake trails</h4>` +
      `<ul><li><span class="lg-wave">${WAVE_SVG}</span>Not a 14er &mdash; a nearby lake hike</li></ul>` +
      `</div>` +
      `<div class="map-offline">` +
      `<h4>Offline</h4>` +
      `<p class="map-legend-hint" id="offline-hint">Every peak, hub and lake trail, cached for use with no signal.</p>` +
      `<button id="offline-dl-btn" type="button">Download for offline (~100 MB)</button>` +
      `<p class="offline-status" id="offline-status" role="status"></p>` +
      `</div></div>`;

    el.querySelector(".map-panel-toggle").addEventListener("click", () =>
      el.classList.toggle("is-open")
    );
    el.querySelectorAll("[data-basemap]").forEach((b) =>
      b.addEventListener("click", () => setBasemap(b.dataset.basemap))
    );
    el.querySelector("#offline-dl-btn").addEventListener("click", (e) => {
      e.target.closest("button").blur();
      if (offlineRunning) {
        offlineRunning = false; // same button cancels a run in progress
      } else {
        runOfflineDownload();
      }
    });
    // Don't let map drag/zoom gestures start on the panel.
    ["mousedown", "dblclick", "wheel", "touchstart"].forEach((evt) =>
      el.addEventListener(evt, (e) => e.stopPropagation())
    );
    this._el = el;
    return el;
  }
  onRemove() {
    this._el.remove();
  }
}
map.addControl(new MapPanel(), "top-right");
// Only safe to query by id once addControl has appended the panel to the
// document -- onAdd() itself runs before that append happens.
refreshOfflineStatus();

/* ---------------- offline map download ----------------
   Caches enough tiles to view every peak and hub without a connection, rather
   than relying on having panned there before -- the point is that it works at
   a trailhead you've never opened the map at.

   Driven through the real map instead of hand-building tile URLs: OpenFreeMap's
   vector tile endpoint is versioned (a timestamped path segment that rotates
   over time) and each style pulls its own sprite images and font-glyph ranges,
   none of which this file otherwise knows the shape of. Panning the live map to
   a location and waiting for it to go idle makes MapLibre request exactly what
   it actually needs, and the service worker's normal cache-first handling
   catches all of it -- so this list can never drift out of sync with what
   rendering really requires. */
const OFFLINE_STORE_KEY = "14ers-offline-v1";

// Order: cheapest/most useful first, so an interrupted download still leaves
// the most generally-useful tiles (state overview, all hubs) in place even if
// it never reaches the last few peaks.
function offlineStops() {
  const stops = [];
  stops.push({ lon: -106.4, lat: 39.0, zoom: 5, label: "Colorado overview" });
  stops.push({ lon: -106.4, lat: 39.0, zoom: 7, label: "Colorado overview" });
  stops.push({ lon: -106.4, lat: 39.0, zoom: 9, label: "Colorado overview" });
  HUBS.forEach((h) => stops.push({ lon: h.lon, lat: h.lat, zoom: 12, label: h.name }));
  LAKES.forEach((l) => stops.push({ lon: l.lon, lat: l.lat, zoom: 13, label: l.name }));
  PEAKS.forEach((p) => stops.push({ lon: p.lon, lat: p.lat, zoom: 13, label: p.name }));
  return stops;
}

function waitForIdle(timeoutMs) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      map.off("idle", finish);
      resolve();
    };
    map.on("idle", finish);
    setTimeout(finish, timeoutMs);
  });
}

function setOfflineStatus(text) {
  const el = document.getElementById("offline-status");
  if (el) el.textContent = text;
}

function refreshOfflineStatus() {
  const btn = document.getElementById("offline-dl-btn");
  if (!btn) return;
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(OFFLINE_STORE_KEY));
  } catch {
    saved = null;
  }
  if (saved?.at) {
    const when = new Date(saved.at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    btn.textContent = "Refresh offline map";
    setOfflineStatus(`Last downloaded ${when}.`);
  } else {
    setOfflineStatus("");
  }
}

let offlineRunning = false;

async function runOfflineDownload() {
  if (offlineRunning) return;
  if (!("serviceWorker" in navigator)) {
    setOfflineStatus("This browser doesn't support offline caching.");
    return;
  }
  offlineRunning = true;
  // Stays enabled throughout, on purpose: the click handler routes a click
  // during a run to cancellation rather than starting a second overlapping run.
  const btn = document.getElementById("offline-dl-btn");
  const prevLabel = btn.textContent;

  const savedBasemap = state.basemap;
  const savedCenter = map.getCenter();
  const savedZoom = map.getZoom();

  try {
    await navigator.serviceWorker.ready;
    // Best-effort: reduces (but on iOS can't fully guarantee) the odds this
    // gets evicted under storage pressure. Safe to call even where it's a
    // no-op.
    if (navigator.storage?.persist) {
      try {
        await navigator.storage.persist();
      } catch {
        /* not critical -- the download still proceeds */
      }
    }

    const full = offlineStops();
    // Every peak and hub gets the shared vector tiles + hillshade under the
    // default style. Roads and Dark only need a lighter pass: their vector
    // tiles and hillshade are the same requests already cached above, so this
    // is just enough to pick up each style's own JSON, sprite and glyphs.
    const light = offlineStops().filter((s) => s.zoom <= 12);
    const passes = [
      { name: "Terrain", stops: full },
      { name: "Roads", stops: light },
      { name: "Dark", stops: light },
    ].filter((p) => BASEMAPS[p.name]);

    const total = passes.reduce((n, p) => n + p.stops.length, 0);
    let done = 0;

    for (const pass of passes) {
      setOfflineStatus(`Loading ${pass.name} style…`);
      setBasemap(pass.name);
      await waitForIdle(8000);
      // The topo overlay is a cosmetic, zoomed-in-only raster layer that costs
      // more than every other layer combined for what it adds on top of the
      // hillshade. Hiding it here means it's simply never requested during the
      // download; it still caches itself normally on any zoomed-in view a
      // person actually visits online. This has to be redone after every
      // setBasemap: setStyle() replaces the whole style, and the style.load
      // handler re-adds the topo layer visible by default.
      if (map.getLayer("topo")) map.setLayoutProperty("topo", "visibility", "none");

      for (const stop of pass.stops) {
        if (!offlineRunning) break; // cancelled
        map.jumpTo({ center: [stop.lon, stop.lat], zoom: stop.zoom });
        await waitForIdle(6000);
        done++;
        btn.textContent = `Cancel (${done}/${total})`;
        setOfflineStatus(`Caching ${stop.label}…`);
      }
      if (!offlineRunning) break;
    }

    if (offlineRunning) {
      localStorage.setItem(OFFLINE_STORE_KEY, JSON.stringify({ at: new Date().toISOString(), count: total }));
      setOfflineStatus(`Offline map ready — ${total} locations cached.`);
    } else {
      setOfflineStatus("Cancelled. What was cached so far still works offline.");
    }
  } catch {
    setOfflineStatus("Download failed — check your connection and try again.");
  } finally {
    offlineRunning = false;
    setBasemap(savedBasemap);
    map.jumpTo({ center: savedCenter, zoom: savedZoom });
    refreshOfflineStatus();
    if (btn.textContent.startsWith("Cancel")) btn.textContent = prevLabel;
  }
}

HUBS.forEach((h) => {
  const el = document.createElement("div");
  el.className = "hub-marker";
  el.title = h.name;
  el.innerHTML = TENT_SVG;
  el.addEventListener("click", () => selectHub(h.id));

  const marker = new maplibregl.Marker({ element: el })
    .setLngLat([h.lon, h.lat])
    .setPopup(
      new maplibregl.Popup({ offset: 16, maxWidth: "300px" }).setHTML(
        `<h3>${h.name}</h3><p>${h.blurb}</p>` +
          `<p><strong>Camping:</strong> ${h.camping}<br><strong>Drive:</strong> ${h.drive}</p>`
      )
    )
    .addTo(map);
  hubMarkers.push(marker);
});

// Always on the map, unaffected by the hub/difficulty/risk filters or the peak
// picker -- a separate category, not a 14er option to toggle.
LAKES.forEach((l) => {
  const el = document.createElement("div");
  el.className = "lake-marker";
  el.title = l.name;
  el.innerHTML = WAVE_SVG;
  el.addEventListener("click", () => selectLake(l.name, false, { openPopup: false }));

  const marker = new maplibregl.Marker({ element: el })
    .setLngLat([l.lon, l.lat])
    .setPopup(new maplibregl.Popup({ offset: 14, maxWidth: "300px" }).setHTML(lakePopup(l)))
    .addTo(map);
  lakeMarkers.set(l.name, { marker, el });
});

PEAKS.forEach((p) => {
  const el = peakEl(p);
  el.addEventListener("click", () => select(p.name, false, { openPopup: false }));
  const marker = new maplibregl.Marker({ element: el })
    .setLngLat([p.lon, p.lat])
    .setPopup(new maplibregl.Popup({ offset: 14, maxWidth: "320px" }).setHTML(peakPopup(p)));
  markers.set(p.name, { marker, el, on: false });
});

/* ---------------- filtering ---------------- */

// Max-risk applies to the worst of the three dimensions, so filtering to
// "Moderate" never leaves a High-rockfall peak in the list.
const worstRisk = (p) => Math.max(...RISKS.map(([key]) => riskRank(p[key])));

const visible = () =>
  PEAKS.filter(
    (p) =>
      state.enabled.has(p.name) &&
      (!state.hub || p.hub === state.hub) &&
      CLASS_ORDER.indexOf(p.cls) <= state.maxClass &&
      worstRisk(p) <= state.maxRisk
  );

function render() {
  const list = visible();

  showAllBtn.classList.toggle("is-shown", !!state.hub);

  const shown = new Set(list.map((p) => p.name));
  // Only add/remove on an actual change. render() runs on every filter tweak and
  // every selection, and re-adding a marker that's already on the map churns its
  // popup state -- enough to swallow the close half of a popup toggle.
  markers.forEach((entry, name) => {
    const { marker, el } = entry;
    if (shown.has(name)) {
      if (!entry.on) {
        marker.addTo(map);
        entry.on = true;
      }
      el.classList.toggle("sel", name === state.selected);
    } else if (entry.on) {
      marker.remove();
      entry.on = false;
    }
  });

  // Lakes are always on the map, so this only ever needs to update selection
  // styling -- never add/remove.
  lakeMarkers.forEach(({ el }, name) => {
    el.classList.toggle("sel", name === state.selectedLake);
  });

  const ul = document.getElementById("peak-list");
  ul.innerHTML = "";

  // Group by hub, ordered as HUBS is, so the list reads as an itinerary.
  HUBS.forEach((h) => {
    const inHub = list.filter((p) => p.hub === h.id);
    if (!inHub.length) return;

    const heading = document.createElement("li");
    heading.className = "hub-heading";
    heading.textContent = `${h.name} — ${inHub.length} peak${inHub.length > 1 ? "s" : ""}`;
    ul.appendChild(heading);

    inHub.forEach((p) => ul.appendChild(peakCard(p)));
  });

  // Always shown, regardless of filters or the peak picker -- a separate
  // category rather than something to toggle alongside the 14ers.
  const lakeHeading = document.createElement("li");
  lakeHeading.className = "hub-heading lake-heading";
  lakeHeading.textContent = `Lake trails — not 14ers`;
  ul.appendChild(lakeHeading);
  LAKES.forEach((l) => ul.appendChild(lakeCard(l)));

  const n = list.length;
  const chosen = state.enabled.size;
  const hidden = PEAKS.length - chosen;
  document.getElementById("count").textContent =
    (n === chosen ? `${n} peak${n === 1 ? "" : "s"}` : `${n} of ${chosen} match filters`) +
    (hidden ? ` · ${hidden} not chosen` : "");

  if (!n) {
    const empty = document.createElement("li");
    empty.className = "peak-note";
    empty.textContent = chosen
      ? "No chosen peaks match these filters."
      : "No peaks chosen yet — open “Choose peaks” to pick some.";
    ul.appendChild(empty);
  }
  document.getElementById("pick-count").textContent = `(${chosen}/${PEAKS.length})`;
}

function peakCard(p) {
  const li = document.createElement("li");
  li.className = "peak" + (p.name === state.selected ? " active" : "");
  li.style.borderLeftColor = CLASS_COLOR[p.cls];
  li.dataset.name = p.name;
  li.innerHTML =
    `<div class="peak-head">` +
    `<span class="peak-name">${p.name}</span>` +
    `<span class="peak-elev">${p.elev.toLocaleString()} ft</span>` +
    `</div>` +
    `<div class="tags">` +
    `<span class="tag cls" style="background:${CLASS_COLOR[p.cls]}">${p.cls}</span>` +
    `<span class="tag">${p.dist}</span>` +
    `<span class="tag">${p.gain}</span>` +
    `</div>` +
    `<div class="tags">${riskRow(p)}</div>` +
    `<p class="peak-note">${p.note}</p>` +
    `<div class="peak-route">${p.route}</div>`;

  li.addEventListener("click", () => select(p.name, true));
  return li;
}

function lakeCard(l) {
  const li = document.createElement("li");
  li.className = "peak lake-card" + (l.name === state.selectedLake ? " active" : "");
  li.dataset.name = l.name;
  li.innerHTML =
    `<div class="peak-head">` +
    `<span class="peak-name">${l.name}</span>` +
    `<span class="peak-elev">${l.elev.toLocaleString()} ft</span>` +
    `</div>` +
    `<div class="tags">` +
    `<span class="tag">${l.dist}</span>` +
    `<span class="tag">${l.gain} gain</span>` +
    `</div>` +
    `<p class="peak-note">${l.note}</p>`;

  li.addEventListener("click", () => selectLake(l.name, true));
  return li;
}

// `openPopup: false` is for clicks on the marker itself: setPopup() installs its
// own click handler on the same element, so opening the popup here too would
// toggle it twice in one click and leave it shut -- which on mobile, where the
// peak list is hidden, means a tapped peak shows nothing at all.
function select(name, fly, { openPopup = true } = {}) {
  state.selected = name;
  state.selectedLake = null;
  render();
  const p = PEAKS.find((x) => x.name === name);
  const { marker } = markers.get(name);

  // Popups are per-marker, so without this an old one stays open behind the new
  // -- across both peaks and lakes, since only one thing is selected at a time.
  markers.forEach(({ marker: other }, otherName) => {
    if (otherName !== name && other.getPopup()?.isOpen()) other.togglePopup();
  });
  lakeMarkers.forEach(({ marker: other }) => {
    if (other.getPopup()?.isOpen()) other.togglePopup();
  });

  if (fly) {
    map.flyTo({ center: [p.lon, p.lat], zoom: Math.max(map.getZoom(), 11), duration: 800 });
  }
  if (openPopup && !marker.getPopup().isOpen()) marker.togglePopup();
  document.querySelector(`.peak[data-name="${CSS.escape(name)}"]`)
    ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

// Mirrors select(), but for the always-on lake layer: no fly-zoom default, no
// enabled-set gating, and it clears any peak selection instead of the reverse.
function selectLake(name, fly, { openPopup = true } = {}) {
  state.selectedLake = name;
  state.selected = null;
  render();
  const l = LAKES.find((x) => x.name === name);
  const { marker } = lakeMarkers.get(name);

  markers.forEach(({ marker: other }) => {
    if (other.getPopup()?.isOpen()) other.togglePopup();
  });
  lakeMarkers.forEach(({ marker: other }, otherName) => {
    if (otherName !== name && other.getPopup()?.isOpen()) other.togglePopup();
  });

  if (fly) {
    map.flyTo({ center: [l.lon, l.lat], zoom: Math.max(map.getZoom(), 11), duration: 800 });
  }
  if (openPopup && !marker.getPopup().isOpen()) marker.togglePopup();
  document.querySelector(`.lake-card[data-name="${CSS.escape(name)}"]`)
    ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

// Floating pill shown over the map whenever a hub filter narrows what's on
// it -- the only way back to the full peak set on mobile without opening the
// sidebar, which the hub filter dropdown lives in.
const showAllBtn = document.createElement("button");
showAllBtn.type = "button";
showAllBtn.className = "show-all-btn";
showAllBtn.textContent = "Show all peaks";
showAllBtn.addEventListener("click", () => {
  state.hub = "";
  hubSel.value = "";
  render();
  fitVisible();
});
document.getElementById("map").appendChild(showAllBtn);

function selectHub(id) {
  state.hub = id;
  document.getElementById("filter-hub").value = id;
  state.selected = null;
  render();
  fitVisible();
}

// map.on("click") fires for every click MapLibre detects in the viewport, not
// just ones that hit bare map background -- Marker filters the same event by
// originalEvent.target to decide whether it should react (see its _onMapClick),
// rather than the map suppressing the event for marker/popup clicks. Do the
// same filtering here, or every marker tap would select-then-immediately-clear.
map.on("click", (e) => {
  if (e.originalEvent?.target?.closest(".maplibregl-marker, .maplibregl-popup")) return;
  if (!state.selected && !state.selectedLake) return;
  state.selected = null;
  state.selectedLake = null;
  markers.forEach(({ marker }) => {
    if (marker.getPopup()?.isOpen()) marker.togglePopup();
  });
  lakeMarkers.forEach(({ marker }) => {
    if (marker.getPopup()?.isOpen()) marker.togglePopup();
  });
  render();
});

function fitVisible() {
  const list = visible();
  // A zero-sized container makes the fit math produce nonsense, so bail until
  // the layout has settled.
  const c = map.getContainer();
  if (!list.length || !c.clientWidth || !c.clientHeight) return;
  const bounds = new maplibregl.LngLatBounds();
  list.forEach((p) => bounds.extend([p.lon, p.lat]));
  // Include the hub itself when one is picked; otherwise all hubs, so the
  // starting view frames the whole trip regardless of viewport size.
  const hubs = state.hub ? [hubById[state.hub]] : HUBS;
  hubs.forEach((h) => bounds.extend([h.lon, h.lat]));
  map.fitBounds(bounds, { padding: 70, maxZoom: 13, duration: 700 });
}

/* ---------------- controls ---------------- */

const hubSel = document.getElementById("filter-hub");
HUBS.forEach((h) => hubSel.add(new Option(`${h.name} (${PEAKS.filter((p) => p.hub === h.id).length})`, h.id)));

const clsSel = document.getElementById("filter-class");
CLASS_ORDER.forEach((c, i) => clsSel.add(new Option(`Up to ${c}`, i)));
clsSel.value = CLASS_ORDER.length - 1;

const riskSel = document.getElementById("filter-risk");
RISK_ORDER.forEach((level, i) => riskSel.add(new Option(`Up to ${level}`, i)));
riskSel.value = RISK_ORDER.length - 1;

const legend = document.getElementById("legend-class");
CLASS_ORDER.forEach((c) => {
  const li = document.createElement("li");
  li.innerHTML = `<span class="dot" style="background:${CLASS_COLOR[c]}"></span>${c}`;
  legend.appendChild(li);
});

const riskLegend = document.getElementById("legend-risk");
RISK_ORDER.forEach((level) => {
  const li = document.createElement("li");
  li.innerHTML = `<span class="dot" style="background:${RISK_COLOR[level]}"></span>${level}`;
  riskLegend.appendChild(li);
});

hubSel.addEventListener("change", (e) => {
  state.hub = e.target.value;
  render();
  fitVisible();
});
clsSel.addEventListener("change", (e) => {
  state.maxClass = Number(e.target.value);
  render();
});
riskSel.addEventListener("change", (e) => {
  state.maxRisk = Number(e.target.value);
  render();
});
document.getElementById("filter-reset").addEventListener("click", () => {
  Object.assign(state, {
    hub: "",
    maxClass: CLASS_ORDER.length - 1,
    maxRisk: RISK_ORDER.length - 1,
    selected: null,
  });
  hubSel.value = "";
  clsSel.value = CLASS_ORDER.length - 1;
  riskSel.value = RISK_ORDER.length - 1;
  render();
  fitVisible();
});

/* ---------------- peak picker ---------------- */

const picker = document.getElementById("picker");
const pickList = document.getElementById("pick-list");
const pickSearch = document.getElementById("pick-search");

function renderPicker() {
  const q = pickSearch.value.trim().toLowerCase();
  const match = (p) =>
    !q ||
    [p.name, p.range, p.cls, hubById[p.hub].name].some((s) => s.toLowerCase().includes(q));

  pickList.innerHTML = "";
  let shown = 0;

  HUBS.forEach((h) => {
    const inHub = PEAKS.filter((p) => p.hub === h.id && match(p));
    if (!inHub.length) return;
    shown += inHub.length;

    const allOn = inHub.every((p) => state.enabled.has(p.name));
    const group = document.createElement("section");
    group.className = "pick-group";
    group.innerHTML =
      `<div class="pick-group-head">` +
      `<span>${h.name}</span>` +
      `<button type="button" data-hub="${h.id}">${allOn ? "Clear" : "Select"} all</button>` +
      `</div>`;

    inHub
      .sort((a, b) => b.elev - a.elev)
      .forEach((p) => {
        const id = `pick-${p.name.replace(/\W+/g, "-")}`;
        const row = document.createElement("label");
        row.className = "pick-row" + (p.featured ? " is-featured" : "");
        row.setAttribute("for", id);
        row.innerHTML =
          `<input type="checkbox" id="${id}" data-peak="${p.name}"` +
          `${state.enabled.has(p.name) ? " checked" : ""}>` +
          `<span class="pick-name">${p.name}` +
          `${p.featured ? '<span class="pick-star" title="Featured pick">★</span>' : ""}` +
          `${p.rank === 99 ? '<span class="pick-unranked" title="Unranked — under 300 ft of prominence">unranked</span>' : ""}` +
          `</span>` +
          `<span class="pick-meta">${p.elev.toLocaleString()}′ · ${p.cls} · ` +
          `exp <span style="color:${RISK_COLOR[p.exposure]}">${p.exposure}</span></span>`;
        group.appendChild(row);
      });

    pickList.appendChild(group);
  });

  document.getElementById("pick-status").textContent =
    `${state.enabled.size} of ${PEAKS.length} chosen` +
    (q ? ` · showing ${shown} match${shown === 1 ? "" : "es"}` : "");

  if (!shown) {
    pickList.innerHTML = `<p class="picker-empty">No peaks match “${pickSearch.value}”.</p>`;
  }
}

function applySelection() {
  saveEnabled();
  syncUrl();
  renderPicker();
  // A hidden peak must not stay selected on the map behind the dialog.
  if (state.selected && !state.enabled.has(state.selected)) state.selected = null;
  render();
}

pickList.addEventListener("change", (e) => {
  const name = e.target.dataset.peak;
  if (!name) return;
  e.target.checked ? state.enabled.add(name) : state.enabled.delete(name);
  applySelection();
});

pickList.addEventListener("click", (e) => {
  const hub = e.target.dataset.hub;
  if (!hub) return;
  const inHub = PEAKS.filter((p) => p.hub === hub);
  const allOn = inHub.every((p) => state.enabled.has(p.name));
  inHub.forEach((p) => (allOn ? state.enabled.delete(p.name) : state.enabled.add(p.name)));
  applySelection();
});

document.querySelectorAll("[data-bulk]").forEach((btn) =>
  btn.addEventListener("click", () => {
    const mode = btn.dataset.bulk;
    if (mode === "all") state.enabled = new Set(peakNames);
    else if (mode === "none") state.enabled = new Set();
    else state.enabled = new Set(featuredNames());
    applySelection();
  })
);

pickSearch.addEventListener("input", renderPicker);

const shareBtn = document.getElementById("pick-share");
let shareTimer;
shareBtn.addEventListener("click", async () => {
  syncUrl();
  clearTimeout(shareTimer);
  try {
    await navigator.clipboard.writeText(shareUrl());
    shareBtn.textContent = "Link copied";
  } catch {
    // Clipboard blocked (insecure context, permissions): the address bar is
    // already in sync, so point at that instead of failing silently.
    shareBtn.textContent = "Copy it from the address bar";
  }
  shareTimer = setTimeout(() => {
    shareBtn.textContent = "Copy link to this selection";
  }, 2500);
});

document.getElementById("pick-open").addEventListener("click", () => {
  renderPicker();
  picker.showModal();
});
document.getElementById("pick-close").addEventListener("click", () => picker.close());
// Click on the backdrop (outside the dialog box) closes it.
picker.addEventListener("click", (e) => {
  if (e.target === picker) picker.close();
});
picker.addEventListener("close", () => fitVisible());

const toggle = document.getElementById("panel-toggle");
toggle.addEventListener("click", () => {
  const open = document.getElementById("sidebar").classList.toggle("open");
  toggle.setAttribute("aria-expanded", String(open));
  toggle.textContent = open ? "Map" : "Peaks";
  // The map is hidden behind the panel on mobile; re-measure when it reappears.
  if (!open) map.resize();
});

// Debounced: resizing the GL canvas on every resize event forces a full
// re-render each frame, which stutters badly while dragging a window edge.
let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => map.resize(), 150);
});

// The default style is already loading from the Map constructor, so only the
// panel's active state needs setting here -- calling setBasemap would kick off a
// redundant second setStyle for the same basemap.
document
  .querySelectorAll("[data-basemap]")
  .forEach((el) => el.classList.toggle("is-on", el.dataset.basemap === state.basemap));

render();
// If we arrived via a share link, adopt that selection on this device too,
// and make sure the address bar always carries the current selection.
saveEnabled();
syncUrl();

// A share link can also arrive *after* load — pasted into an already-open tab,
// or restored by an embedding app. syncUrl() uses replaceState, which doesn't
// fire hashchange, so this can't loop on our own updates.
window.addEventListener("hashchange", () => {
  const code = hashCode();
  if (!code) return;
  let incoming;
  try {
    incoming = decodeSelection(code);
  } catch {
    return; // malformed link: leave the current selection alone
  }
  state.enabled = incoming;
  state.selected = null;
  saveEnabled();
  if (picker.open) renderPicker();
  render();
  fitVisible();
});

// Fit once the container has real dimensions. Both hooks are guarded by
// fitVisible()'s size check, so whichever fires first wins harmlessly.
requestAnimationFrame(() => {
  map.resize();
  fitVisible();
});
window.addEventListener("load", () => {
  map.resize();
  fitVisible();
});

// Minimapa · aplicación principal
import * as maplibregl from '../vendor/maplibre-gl.mjs';
import { CONFIG } from './config.js';
import { $, $$, h, dist, bearing, angDiff, fmtDist, fmtDur, fmtClock, debounce, store, escapeHtml, bboxOf, pointAlong } from './util.js';
import { SKINS, buildStyle, LABEL_ANCHOR } from './skins.js';
import { attachImages, alertIconURL, blipIconURL } from './blips.js';
import { ICONS, maneuverSVG } from './icons.js';
import { speak, sound, unlockAudio, configureVoice, spanishVoices, stopSpeaking } from './voice.js';
import { getRoutes, fetchRouteLimits, matchPosition, tomtomTraffic } from './routing.js';
import { NavEngine, RouteSimulator } from './nav.js';
import { RadarDB, RadarWatcher, RADAR_TYPES, REPORT_TYPES, radarsOnRoute } from './radars.js';
import { searchPlaces, reverse, searchCategory, CATEGORIES } from './search.js';
import { loadFuel, nearestFuel, FUELS, fmtPrice } from './fuel.js';
import { NATIVE, Native, BUILD, startNativeGps, openNativeSettings, nativeKeepAwake, shareText, checkForUpdate, apkLink } from './native.js';

// ======================================================================
// Ajustes
// ======================================================================
const DEFAULTS = {
  skin: 'radar', buildings3d: false, poi: true, showRadars: true,
  headingUp: true, tilt: true, autoZoom: true,
  voice: true, voiceURI: null, volume: 1, soundStyle: 'sirena',
  avoidTolls: false, avoidHighways: false, keepAwake: 'siempre',
  radarTypes: { fijo: true, tramo: true, semaforo: true, cinturon: true, linea: false, movil: true },
  alertDistance: 'auto', overTolerance: 0, overspeedAlerts: true, reportAlerts: true,
  osmLive: true, freeDriveLimits: true,
  tomtomKey: '', traffic: false, fuelType: 'g95',
};
const S = { ...DEFAULTS, ...store.get('settings', {}) };
S.radarTypes = { ...DEFAULTS.radarTypes, ...(S.radarTypes || {}) };
function saveSettings() {
  store.set('settings', S);
  carSettings();
  configureVoice({ enabled: S.voice, voiceURI: S.voiceURI, volume: S.volume, soundStyle: S.soundStyle });
}
configureVoice({ enabled: S.voice, voiceURI: S.voiceURI, volume: S.volume, soundStyle: S.soundStyle });

const st = {
  mode: 'browse', // browse | preview | nav
  fix: null, lastRawFix: null, heading: null, compass: null, lastFixAt: 0,
  follow: true, everFixed: false,
  dest: null, stops: [], routes: [], selRoute: 0, route: null, origin: null, navState: null,
  sim: null, simSpeed: 'auto',
  results: [], resultsTitle: '', pin: null, addingStop: false, fuelSort: 'dist',
  trail: [], lastMatchAt: 0, limitFree: null, limitFreeAt: 0, streetFree: '', locality: '', lastReverseAt: 0, lastOsmCheck: 0,
  traffic: null, wakeLock: null, rerouting: false, sheetView: null,
};

const favs = () => store.get('favs', []);
const recents = () => store.get('recents', []);

// ======================================================================
// Mapa
// ======================================================================
function applySkinVars() {
  const sk = SKINS[S.skin] || SKINS.radar;
  const r = document.documentElement.style;
  r.setProperty('--accent', sk.accent);
  r.setProperty('--accent-ink', sk.accentInk);
  r.setProperty('--route', sk.route);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0b0d0c');
}
applySkinVars();

const map = new maplibregl.Map({
  container: 'map',
  style: buildStyle(S.skin, { poi: S.poi, buildings3d: S.buildings3d }),
  center: store.get('lastCenter', CONFIG.startCenter),
  zoom: store.get('lastZoom', CONFIG.startZoom),
  attributionControl: { compact: true },
  maxPitch: 70,
  fadeDuration: 120,
  dragRotate: true,
  touchPitch: true,
});
attachImages(map, () => SKINS[S.skin]);
map.on('style.load', addOverlays);
map.on('moveend', debounce(() => {
  const c = map.getCenter();
  store.set('lastCenter', [c.lng, c.lat]);
  store.set('lastZoom', map.getZoom());
}, 1000));
for (const ev of ['dragstart', 'zoomstart', 'rotatestart', 'pitchstart']) {
  map.on(ev, (e) => { if (e.originalEvent && st.follow) setFollow(false); });
}
map.on('rotate', () => { const svg = $('#btnCompass svg'); if (svg) svg.style.transform = `rotate(${-map.getBearing()}deg)`; });

const radarDB = new RadarDB();
const EMPTY = { type: 'FeatureCollection', features: [] };

function setData(id, data) { map.getSource(id)?.setData(data); }

function applyPoiMode() {
  const nav = st.mode === 'nav';
  for (const id of ['poi-mid', 'poi-low']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', nav ? 'none' : 'visible');
}

function addOverlays() {
  applyPoiMode();
  const sk = SKINS[S.skin];
  const before = map.getLayer(LABEL_ANCHOR) ? LABEL_ANCHOR : undefined;
  const src = (id, data) => { if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data }); };
  src('route', routeGeo());
  src('routePts', routePtsGeo());
  src('radars', radarDB.geojson());
  src('results', resultsGeo());
  src('favs', favsGeo());
  src('pin', pinGeo());
  const lineLayout = { 'line-join': 'round', 'line-cap': 'round' };
  const wz = (a, b) => ['interpolate', ['linear'], ['zoom'], 8, a, 17, b];

  if (S.traffic && S.tomtomKey) {
    map.addSource('traffic', {
      type: 'raster', tileSize: 256, minzoom: 6, maxzoom: 18,
      tiles: [`https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${encodeURIComponent(S.tomtomKey)}&tileSize=256`],
      attribution: 'Tráfico © TomTom',
    });
    map.addLayer({ id: 'traffic', type: 'raster', source: 'traffic', paint: { 'raster-opacity': 0.8 } }, before);
  }
  map.addLayer({ id: 'route-alt', type: 'line', source: 'route', filter: ['==', ['get', 'kind'], 'alt'], layout: lineLayout, paint: { 'line-color': sk.routeAlt, 'line-width': wz(4, 9), 'line-opacity': 0.9 } }, before);
  map.addLayer({ id: 'route-done', type: 'line', source: 'route', filter: ['==', ['get', 'kind'], 'done'], layout: lineLayout, paint: { 'line-color': sk.routeDone, 'line-width': wz(3, 7), 'line-opacity': 0.8 } }, before);
  map.addLayer({ id: 'route-glow', type: 'line', source: 'route', filter: ['==', ['get', 'kind'], 'main'], layout: lineLayout, paint: { 'line-color': sk.route, 'line-width': wz(12, 26), 'line-blur': 10, 'line-opacity': 0.45 } }, before);
  map.addLayer({ id: 'route-casing', type: 'line', source: 'route', filter: ['==', ['get', 'kind'], 'main'], layout: lineLayout, paint: { 'line-color': sk.routeCasing, 'line-width': wz(7, 15) } }, before);
  map.addLayer({ id: 'route-main', type: 'line', source: 'route', filter: ['==', ['get', 'kind'], 'main'], layout: lineLayout, paint: { 'line-color': sk.route, 'line-width': wz(4.5, 10) } }, before);
  map.addLayer({ id: 'radar-sections', type: 'line', source: 'radars', minzoom: 11, filter: ['==', ['get', 'tipo'], 'tramo-linea'], layout: { visibility: S.showRadars ? 'visible' : 'none' }, paint: { 'line-color': '#ff6d00', 'line-width': 3, 'line-dasharray': [2, 1.5], 'line-opacity': 0.75 } }, before);

  const textPaint = { 'text-color': sk.text, 'text-halo-color': sk.halo, 'text-halo-width': 1.4 };
  map.addLayer({
    id: 'favs', type: 'symbol', source: 'favs',
    layout: { 'icon-image': ['concat', 'blip-', ['get', 'kind']], 'icon-size': 1.15, 'icon-allow-overlap': true, 'text-field': ['step', ['zoom'], '', 14, ['get', 'name']], 'text-font': CONFIG.fonts.regular, 'text-size': 11, 'text-offset': [0, 1.5], 'text-anchor': 'top', 'text-optional': true },
    paint: textPaint,
  });
  map.addLayer({
    id: 'radars', type: 'symbol', source: 'radars', minzoom: 8,
    filter: ['!=', ['get', 'tipo'], 'tramo-linea'],
    layout: {
      visibility: S.showRadars ? 'visible' : 'none',
      'icon-image': ['get', 'icon'], 'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 14, 0.85, 17, 1],
      'icon-allow-overlap': ['step', ['zoom'], false, 13, true],
      'text-field': ['step', ['zoom'], '', 13, ['to-string', ['get', 'lim']]], 'text-font': CONFIG.fonts.bold, 'text-size': 11,
      'text-offset': [0, 1.45], 'text-anchor': 'top', 'text-optional': true,
    },
    paint: { 'text-color': '#ffffff', 'text-halo-color': '#c62828', 'text-halo-width': 2.2 },
  });
  map.addLayer({
    id: 'results', type: 'symbol', source: 'results',
    layout: {
      'icon-image': ['concat', 'blip-', ['get', 'blip']], 'icon-size': 1.2, 'icon-allow-overlap': true,
      'text-field': ['get', 'label'], 'text-font': CONFIG.fonts.bold, 'text-size': ['case', ['get', 'isPrice'], 13, 11],
      'text-offset': [0, 1.5], 'text-anchor': 'top', 'text-optional': true, 'symbol-sort-key': ['get', 'rank'],
    },
    paint: { 'text-color': ['case', ['get', 'isPrice'], '#f6c945', sk.text], 'text-halo-color': sk.halo, 'text-halo-width': 1.6 },
  });
  map.addLayer({ id: 'routePts', type: 'symbol', source: 'routePts', layout: { 'icon-image': ['get', 'icon'], 'icon-allow-overlap': true, 'icon-ignore-placement': true } });
  map.addLayer({ id: 'pin', type: 'symbol', source: 'pin', layout: { 'icon-image': 'pin', 'icon-anchor': 'bottom', 'icon-allow-overlap': true, 'icon-ignore-placement': true } });
}

// ---- GeoJSON de capas propias ----
function routeGeo() {
  const features = [];
  if (st.mode === 'nav' && st.route && st.navState) {
    const r = st.route, ns = st.navState;
    const i = ns.segIndex;
    const sn = [ns.snapped.lon, ns.snapped.lat];
    features.push({ type: 'Feature', properties: { kind: 'done' }, geometry: { type: 'LineString', coordinates: [...r.coords.slice(0, i + 1), sn] } });
    features.push({ type: 'Feature', properties: { kind: 'main' }, geometry: { type: 'LineString', coordinates: [sn, ...r.coords.slice(i + 1)] } });
  } else {
    st.routes.forEach((r, idx) => {
      if (idx !== st.selRoute) features.push({ type: 'Feature', properties: { kind: 'alt', idx }, geometry: { type: 'LineString', coordinates: r.coords } });
    });
    const sel = st.routes[st.selRoute];
    if (sel) features.push({ type: 'Feature', properties: { kind: 'main', idx: st.selRoute }, geometry: { type: 'LineString', coordinates: sel.coords } });
  }
  return { type: 'FeatureCollection', features };
}
function routePtsGeo() {
  const features = [];
  st.stops.forEach((s) => features.push({ type: 'Feature', properties: { icon: 'stop' }, geometry: { type: 'Point', coordinates: [s.lon, s.lat] } }));
  if (st.dest && st.mode !== 'browse') features.push({ type: 'Feature', properties: { icon: 'dest' }, geometry: { type: 'Point', coordinates: [st.dest.lon, st.dest.lat] } });
  return { type: 'FeatureCollection', features };
}
function resultsGeo() {
  return {
    type: 'FeatureCollection',
    features: st.results.map((p, i) => ({
      type: 'Feature', geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
      properties: { i, blip: p.blip || 'res', label: p.price ? fmtPrice(p.price).replace(' €', '') : (p.name || '').slice(0, 24), isPrice: !!p.price, rank: i },
    })),
  };
}
function favsGeo() {
  const features = [];
  const home = store.get('home'), work = store.get('work');
  if (home) features.push({ type: 'Feature', properties: { kind: 'home', name: 'Casa' }, geometry: { type: 'Point', coordinates: [home.lon, home.lat] } });
  if (work) features.push({ type: 'Feature', properties: { kind: 'work', name: 'Trabajo' }, geometry: { type: 'Point', coordinates: [work.lon, work.lat] } });
  for (const f of favs()) features.push({ type: 'Feature', properties: { kind: 'fav', name: f.name, id: f.id }, geometry: { type: 'Point', coordinates: [f.lon, f.lat] } });
  return { type: 'FeatureCollection', features };
}
function pinGeo() {
  return st.pin ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [st.pin.lon, st.pin.lat] } }] } : EMPTY;
}
const refreshRoutes = () => { setData('route', routeGeo()); setData('routePts', routePtsGeo()); };
const refreshResults = () => setData('results', resultsGeo());
const refreshFavs = () => { setData('favs', favsGeo()); carPlaces(); };
const refreshPin = () => setData('pin', pinGeo());
radarDB.onChange(() => { const g = radarDB.geojson(); setData('radars', g); carRadars(g); });

// ======================================================================
// Marcador del jugador
// ======================================================================
const playerEl = h('div', { class: 'player' });
playerEl.innerHTML = '<div class="halo"></div><svg viewBox="0 0 54 54"><path d="M27 5 43 45 27 36 11 45Z" fill="#f5f5f5" stroke="#0d0d0d" stroke-width="2.6" stroke-linejoin="round"/><path d="M27 12 37.5 39 27 33Z" fill="#cfcfcf"/></svg>';
const player = new maplibregl.Marker({ element: playerEl, rotationAlignment: 'map', pitchAlignment: 'map' });
let playerOnMap = false;
const anim = { from: null, to: null, t0: 0, dur: 900, rFrom: 0, rTo: 0, raf: 0 };

function movePlayer(pos, rot) {
  if (!playerOnMap) { player.setLngLat([pos.lon, pos.lat]).addTo(map); playerOnMap = true; anim.to = pos; anim.rTo = rot; player.setRotation(rot); return; }
  const cur = player.getLngLat();
  anim.from = { lat: cur.lat, lon: cur.lng };
  anim.to = pos;
  anim.rFrom = player.getRotation();
  let d = ((rot - anim.rFrom + 540) % 360) - 180;
  anim.rTo = anim.rFrom + d;
  anim.t0 = performance.now();
  anim.dur = st.fix?.sim ? 1000 : 900;
  if (dist(anim.from.lat, anim.from.lon, pos.lat, pos.lon) > 300) { anim.from = pos; }
  cancelAnimationFrame(anim.raf);
  const step = (t) => {
    const k = Math.min(1, (t - anim.t0) / anim.dur);
    player.setLngLat([anim.from.lon + (anim.to.lon - anim.from.lon) * k, anim.from.lat + (anim.to.lat - anim.from.lat) * k]);
    player.setRotation(anim.rFrom + (anim.rTo - anim.rFrom) * k);
    if (k < 1) anim.raf = requestAnimationFrame(step);
  };
  anim.raf = requestAnimationFrame(step);
}

function setFollow(on) {
  st.follow = on;
  $('#btnLocate').classList.toggle('attn', !on && !!st.fix);
  if (on && st.fix) followCamera(st.navState && !st.navState.offRoute ? st.navState.snapped : st.fix, currentRotation(), st.fix, st.navState, true);
}

function currentRotation() {
  const ns = st.navState;
  if (st.mode === 'nav' && ns && !ns.offRoute && (st.fix?.speed || 0) > 1.5) return ns.segBearing;
  if ((st.fix?.speed || 0) > 1.2 && st.heading != null) return st.heading;
  return st.compass ?? st.heading ?? 0;
}

function followCamera(pos, rot, fix, ns, instant = false) {
  const kmh = (fix.speed || 0) * 3.6;
  const navMode = st.mode === 'nav';
  let zoom = map.getZoom();
  if (S.autoZoom) {
    zoom = navMode ? (kmh > 100 ? 15.2 : kmh > 70 ? 15.8 : kmh > 40 ? 16.4 : 17)
      : (kmh > 90 ? 14.8 : kmh > 50 ? 15.6 : kmh > 12 ? 16.2 : Math.max(zoom, 15.5));
    if (navMode && ns?.next && ns.distNext < 220) zoom = Math.max(zoom, 17.2);
  }
  const moving = kmh > 8 || navMode;
  const brg = S.headingUp ? (moving ? rot : (st.compass != null && kmh < 5 ? map.getBearing() : rot)) : 0;
  const pitch = S.tilt && (navMode || kmh > 15) ? 52 : 0;
  const H = map.getContainer().clientHeight;
  const landscape = map.getContainer().clientWidth > H;
  const padTop = pitch ? Math.round(H * (navMode && !landscape ? 0.42 : 0.28)) : 0;
  const opts = { center: [pos.lon, pos.lat], zoom, bearing: brg, pitch, padding: { top: padTop, bottom: navMode ? 90 : 0, left: 0, right: 0 } };
  if (instant) map.easeTo({ ...opts, duration: 600 });
  else map.easeTo({ ...opts, duration: fix.sim ? 1000 : 900, easing: (t) => t, essential: true });
}

// ======================================================================
// GPS, brújula y bucle principal
// ======================================================================
function startGps() {
  if (NATIVE && Native.geo) {
    startNativeGps((f) => { if (!st.sim) processFix(f); }, (err) => {
      if (err?.code === 'NOT_AUTHORIZED') {
        toast('Minimapa necesita la ubicación. Te abro los ajustes para permitirla.', 6000);
        setTimeout(openNativeSettings, 2500);
      } else if (!st.fix) toast('Buscando señal GPS…');
    }).catch(() => toast('No se pudo iniciar el GPS'));
    return;
  }
  if (!('geolocation' in navigator)) { toast('Este navegador no da acceso al GPS'); return; }
  navigator.geolocation.watchPosition(onPosition, onGpsError, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
}
function onPosition(pos) {
  if (st.sim) return; // durante la simulación se ignora el GPS real
  const c = pos.coords;
  processFix({ lat: c.latitude, lon: c.longitude, acc: c.accuracy, speed: c.speed, heading: c.heading, t: pos.timestamp || Date.now() });
}
function onGpsError(err) {
  if (err.code === 1) toast('Permiso de ubicación denegado: actívalo en los ajustes del navegador.', 6000);
  else if (!st.fix) toast('Buscando señal GPS…');
}

function startCompass() {
  const handler = (e) => {
    let hdg = null;
    if (e.webkitCompassHeading != null) hdg = e.webkitCompassHeading;
    else if (e.absolute && e.alpha != null) hdg = (360 - e.alpha) % 360;
    if (hdg == null) return;
    hdg = (hdg + (screen.orientation?.angle || 0)) % 360;
    st.compass = st.compass == null ? hdg : st.compass + ((((hdg - st.compass) % 360) + 540) % 360 - 180) * 0.2;
    st.compass = (st.compass + 360) % 360;
    if (playerOnMap && (!st.fix || (st.fix.speed || 0) < 1.2) && st.mode !== 'nav') player.setRotation(st.compass);
  };
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().then((r) => { if (r === 'granted') addEventListener('deviceorientation', handler); }).catch(() => {});
    } else {
      addEventListener('deviceorientationabsolute', handler);
      addEventListener('deviceorientation', (e) => { if (e.webkitCompassHeading != null) handler(e); });
    }
  } catch { /* sin brújula */ }
}

function processFix(fix) {
  const prev = st.lastRawFix;
  if (prev && fix.t > prev.t) {
    const d = dist(prev.lat, prev.lon, fix.lat, fix.lon);
    const dt = (fix.t - prev.t) / 1000;
    if ((fix.speed == null || isNaN(fix.speed)) && dt > 0) fix.speed = d / dt;
    if ((fix.heading == null || isNaN(fix.heading)) && d > 4) fix.heading = bearing(prev.lat, prev.lon, fix.lat, fix.lon);
  }
  if (fix.speed != null && fix.speed < 1.2) fix.heading = st.heading ?? fix.heading;
  if (fix.heading == null || isNaN(fix.heading)) fix.heading = st.heading;
  st.lastRawFix = fix;
  st.fix = fix;
  st.lastFixAt = Date.now();
  if (fix.heading != null && (fix.speed || 0) > 1.2) st.heading = fix.heading;
  const last = st.trail[st.trail.length - 1];
  if (!last || dist(last.lat, last.lon, fix.lat, fix.lon) > 15) { st.trail.push(fix); if (st.trail.length > 12) st.trail.shift(); }
  $('#gpsStatus').hidden = true;
  playerEl.classList.remove('stale');

  let ns = null;
  let pos = { lat: fix.lat, lon: fix.lon };
  if (st.mode === 'nav' && st.route) {
    ns = nav.update(fix);
    st.navState = ns;
    if (ns && !ns.offRoute && ns.offset < 40) pos = ns.snapped;
    updateNavUI(ns);
    setData('route', routeGeo());
  }
  const rot = currentRotation();
  const watchFix = { ...fix, heading: ns && !ns.offRoute && (fix.speed || 0) > 1.5 ? ns.segBearing : fix.heading };
  const rs = watcher.update(watchFix, ns);
  updateAlertUI(rs);
  updateSpeedo(fix, ns);
  movePlayer(pos, rot);
  if (!st.everFixed) {
    st.everFixed = true;
    map.jumpTo({ center: [pos.lon, pos.lat], zoom: Math.max(map.getZoom(), 15) });
  }
  if (st.follow) followCamera(pos, rot, fix, ns);
  else $('#btnLocate').classList.add('attn');
  updateStreetPill();
  freeDriveExtras(fix, ns);
  carLive(fix, ns, rs, pos, rot);
}

function freeDriveExtras(fix, ns) {
  const now = Date.now();
  if (S.freeDriveLimits && !fix.sim && (!ns || ns.limit == null) && (fix.speed || 0) > 2.5 && now - st.lastMatchAt > 12000 && st.trail.length >= 3) {
    st.lastMatchAt = now;
    matchPosition(st.trail.slice(-6)).then((r) => {
      if (!r) return;
      st.limitFree = r.limit; st.limitFreeAt = Date.now();
      if (r.name) st.streetFree = r.name;
    }).catch(() => {});
  }
  if (st.limitFreeAt && now - st.limitFreeAt > 45000) st.limitFree = null;
  if (!fix.sim && now - st.lastReverseAt > 90000) {
    st.lastReverseAt = now;
    reverse(fix.lat, fix.lon).then((r) => { st.locality = r.locality; if (r.street) st.streetFree = st.streetFree || r.street; updateStreetPill(); }).catch(() => {});
  }
  if (S.osmLive && now - st.lastOsmCheck > 60000) {
    st.lastOsmCheck = now;
    radarDB.ensureOsmAround(fix.lat, fix.lon).catch(() => {});
  }
}

// Vigilancia de señal GPS
setInterval(() => {
  if (!st.fix || st.sim) return;
  const stale = Date.now() - st.lastFixAt > 12000;
  playerEl.classList.toggle('stale', stale);
  $('#gpsStatus').hidden = !(stale && st.mode === 'nav');
}, 2000);

// ======================================================================
// Navegación
// ======================================================================
const nav = new NavEngine({
  speak: (t, o) => speak(t, o),
  reroute: (fix) => reroute(fix),
  arrive: () => onArrive(),
  waypoint: () => {
    st.stops.shift();
    sound('ok');
    speak('Parada alcanzada. Seguimos.');
    setData('routePts', routePtsGeo());
  },
});

const watcher = new RadarWatcher(radarDB, () => S, {
  speak: (t, o) => speak(t, o),
  sound: (k) => sound(k),
});

async function previewRoute(dest) {
  closeSkinPop();
  st.dest = dest;
  st.mode = 'preview';
  st.results = []; refreshResults();
  st.pin = null; refreshPin();
  document.body.classList.add('preview');
  $('#q').blur();
  const origin = st.fix
    ? { lat: st.fix.lat, lon: st.fix.lon, heading: (st.fix.speed || 0) > 3 ? st.fix.heading : null }
    : (() => { const c = map.getCenter(); return { lat: c.lat, lon: c.lng, approx: true }; })();
  st.origin = origin;
  openSheet(h('div', null, h('h2', null, 'Calculando ruta…'), h('div', { class: 'spinner' })), 'loading');
  try {
    const routes = await getRoutes({ points: [origin, ...st.stops, dest], alternatives: true, avoidTolls: S.avoidTolls, avoidHighways: S.avoidHighways });
    if (st.mode !== 'preview') return;
    routes.forEach((r) => { r.radarsList = radarsOnRoute(r, radarDB, S.radarTypes); });
    st.routes = routes; st.selRoute = 0; st.traffic = null;
    refreshRoutes();
    fitRoute(routes[0]);
    renderPreview();
    if (S.tomtomKey) {
      tomtomTraffic([origin, ...st.stops, dest], S.tomtomKey).then((t) => { st.traffic = t; if (st.mode === 'preview') renderPreview(); }).catch(() => {});
    }
  } catch (e) {
    console.error(e);
    openSheet(h('div', null,
      h('h2', null, 'Sin ruta'),
      h('p', { class: 'empty' }, e.final ? e.message : 'No se pudo calcular la ruta. Revisa la conexión e inténtalo otra vez.'),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => previewRoute(dest) }, 'Reintentar'), h('button', { class: 'btn', onclick: cancelPreview }, 'Cancelar')),
    ), 'error');
  }
}

function resetPadding() { map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 }); }

function fitRoute(route, padding) {
  resetPadding();
  const [w, s, e, n] = bboxOf(route.coords);
  const H = map.getContainer().clientHeight;
  map.fitBounds([[w, s], [e, n]], { padding: padding || { top: 90, bottom: Math.round(H * 0.45), left: 40, right: 40 }, bearing: 0, pitch: 0, duration: 700, maxZoom: 16 });
}

function renderPreview() {
  const dest = st.dest;
  const cards = st.routes.map((r, i) => {
    const nR = (r.radarsList || []).filter((x) => x.radar).length;
    const traffic = i === 0 && st.traffic ? st.traffic : null;
    const dur = traffic ? r.duration * (traffic.travel / Math.max(1, traffic.noTraffic)) : r.duration;
    return h('button', { class: `rcard${i === st.selRoute ? ' sel' : ''}`, onclick: () => { st.selRoute = i; refreshRoutes(); renderPreview(); } },
      h('span', { class: 'letter' }, String.fromCharCode(65 + i)),
      h('span', { class: 'dur' }, fmtDur(dur), h('small', null, `${fmtDist(r.length)} · llegada ${fmtClock(new Date(Date.now() + dur * 1000))}`)),
      h('span', { class: 'badges' },
        nR ? h('span', { class: 'badge red' }, `${nR} radar${nR > 1 ? 'es' : ''}`) : h('span', { class: 'badge' }, 'Sin radares'),
        r.summary.toll ? h('span', { class: 'badge gold' }, 'Peaje') : null,
        traffic && traffic.delay > 60 ? h('span', { class: 'badge red' }, `+${fmtDur(traffic.delay)} tráfico`) : null,
      ),
      h('span', { class: 'via' }, r.via ? `por ${r.via}` : r.provider === 'osrm' ? 'Ruta (servidor de respaldo)' : ''),
    );
  });
  const toggle = (key, label) => h('button', { class: `toggle${S[key] ? ' on' : ''}`, onclick: () => { S[key] = !S[key]; saveSettings(); previewRoute(dest); } }, label);
  const simSel = h('select', { class: 'sel', 'aria-label': 'Velocidad de simulación', onchange: (e) => { st.simSpeed = e.target.value; } },
    ...[['auto', 'Simular: ritmo normal'], ['over', 'Simular: +20% (probar avisos)'], ['50', 'Simular: 50 km/h'], ['90', 'Simular: 90 km/h'], ['120', 'Simular: 120 km/h']]
      .map(([v, l]) => h('option', { value: v, selected: st.simSpeed === v }, l)));
  const stopsList = st.stops.length ? h('div', { class: 'list' }, ...st.stops.map((s, i) => h('div', { class: 'item' },
    h('span', { class: 'ic', html: ICONS.pin }), h('span', { class: 'tx' }, h('div', { class: 'tt' }, `Parada ${i + 1}: ${s.name}`)),
    h('button', { class: 'btn small', onclick: () => { st.stops.splice(i, 1); previewRoute(dest); } }, 'Quitar')))) : null;
  openSheet(h('div', null,
    h('h2', null, h('span', { html: ICONS.route, style: { width: '22px', height: '22px', display: 'inline-block' } }), dest.name),
    st.origin?.approx ? h('p', { class: 'empty', style: { padding: '0 0 8px' } }, 'Aún no hay GPS: la ruta sale desde el centro del mapa.') : null,
    h('div', { class: 'routes' }, ...cards),
    h('div', { class: 'toggles' }, toggle('avoidTolls', 'Sin peajes'), toggle('avoidHighways', 'Sin autopistas')),
    stopsList,
    h('div', { class: 'row', style: { marginTop: '8px' } },
      h('button', { class: 'btn primary', onclick: () => startNav(false), html: `${ICONS.go}<span>Iniciar</span>` })),
    h('div', { class: 'row', style: { marginTop: '8px' } },
      simSel, h('button', { class: 'btn', onclick: () => startNav(true), html: `${ICONS.play}<span>Simular</span>` })),
    h('div', { class: 'row', style: { marginTop: '8px' } },
      h('button', { class: 'btn', onclick: () => { st.addingStop = true; $('#q').value = ''; $('#q').focus(); showSearchHome(); }, html: `${ICONS.plus}<span>Parada</span>` }),
      h('button', { class: 'btn', onclick: cancelPreview }, 'Cancelar')),
  ), 'preview');
}

function cancelPreview() {
  st.mode = 'browse'; st.routes = []; st.dest = null; st.stops = []; st.addingStop = false;
  document.body.classList.remove('preview');
  refreshRoutes(); closeSheet();
}

function startNav(simulate) {
  const route = st.routes[st.selRoute];
  if (!route) return;
  if (!simulate && !st.fix) toast('Esperando GPS… La navegación empezará en cuanto haya señal.');
  st.route = route; st.routes = [route]; st.selRoute = 0;
  st.mode = 'nav';
  st.navState = null;
  document.body.classList.remove('preview');
  document.body.classList.add('nav');
  closeSheet();
  applyPoiMode();
  nav.setRoute(route);
  nav.trafficFactor = st.traffic ? st.traffic.travel / Math.max(1, st.traffic.noTraffic) : 1;
  watcher.setRoute(route);
  refreshRoutes();
  carRoute();
  ['#navTop', '#navBottom', '#speedo'].forEach((s) => { $(s).hidden = false; });
  updateTrafficLabel();
  setFollow(true);
  const first = route.maneuvers[0];
  if (first) speak(first.pre || first.text, { priority: 'high' });
  loadLimits(route);
  requestWakeLock();
  if (simulate) {
    st.sim = new RouteSimulator(route, { speedMode: st.simSpeed, onFix: (f) => processFix(f) });
    st.sim.start();
    toast('Simulación: el coche recorre la ruta solo.');
  } else if (st.fix) {
    processFix({ ...st.fix, t: Date.now() });
  }
}

function loadLimits(route) {
  fetchRouteLimits(route, (partial) => { route.limits = partial.slice(); }).then((l) => { if (l.length) route.limits = l; }).catch(() => {});
}

async function reroute(fix) {
  if (st.rerouting || !st.dest) return;
  st.rerouting = true;
  carLiveNow();
  sound('reroute');
  speak('Recalculando.');
  toast('Recalculando ruta…');
  try {
    const routes = await getRoutes({ points: [{ lat: fix.lat, lon: fix.lon, heading: (fix.speed || 0) > 2 ? fix.heading : null }, ...st.stops, st.dest], alternatives: false, avoidTolls: S.avoidTolls, avoidHighways: S.avoidHighways });
    if (st.mode !== 'nav') return;
    const r = routes[0];
    st.route = r; st.routes = [r];
    nav.setRoute(r, { keepProgress: true });
    watcher.setRoute(r);
    st.sim?.setRoute(r);
    refreshRoutes();
    carRoute();
    loadLimits(r);
  } catch (e) {
    console.warn(e);
    toast('No se pudo recalcular. Sigo intentándolo.');
  } finally {
    st.rerouting = false;
  }
  carLiveNow();
}

function onArrive() {
  sound('arrive');
  showMission('Destino alcanzado', st.dest?.name || '');
  setTimeout(() => { if (st.mode === 'nav') endNav(); }, 5000);
}

function endNav() {
  st.sim?.stop(); st.sim = null;
  st.mode = 'browse'; st.route = null; st.routes = []; st.stops = []; st.dest = null; st.navState = null; st.traffic = null;
  nav.route = null;
  watcher.setRoute(null);
  applyPoiMode();
  document.body.classList.remove('nav', 'preview');
  ['#navTop', '#navBottom', '#navThen', '#alertCard', '#sectionCard', '#gpsStatus'].forEach((s) => { $(s).hidden = true; });
  $('#flash').classList.remove('on');
  stopSpeaking();
  refreshRoutes();
  carRoute();
  requestWakeLock();
  if (st.fix) { map.easeTo({ pitch: 0, padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: 600 }); }
}

function updateTrafficLabel() {
  const t = st.traffic;
  $('#etaTraffic').textContent = t && t.delay > 60 ? `Tráfico: +${fmtDur(t.delay)}` : '';
}

function updateNavUI(ns) {
  if (!ns) return;
  const m = ns.next;
  if (m) {
    $('#manIcon').innerHTML = maneuverSVG(m.kind, m.exit);
    $('#manDist').textContent = m.kind === 'arrive' && ns.distNext < 30 ? 'YA' : fmtDist(ns.distNext);
    let text = escapeHtml(m.text || '');
    const street = (m.street || '').split(' / ')[0];
    if (street && text.includes(escapeHtml(street))) text = text.replace(escapeHtml(street), `<b>${escapeHtml(street)}</b>`);
    $('#manText').innerHTML = text;
    $('#manSign').textContent = m.sign || '';
    const after = ns.afterNext;
    const then = $('#navThen');
    if (after && ns.distAfter < 400 && m.kind !== 'arrive') {
      then.innerHTML = `<span>Después</span>${maneuverSVG(after.kind, after.exit)}`;
      then.hidden = false;
    } else then.hidden = true;
  }
  const eta = new Date(Date.now() + ns.remainingTime * 1000);
  $('#etaTime').textContent = fmtClock(eta);
  $('#etaRest').textContent = fmtDur(ns.remainingTime);
  $('#etaDist').textContent = fmtDist(ns.remaining);
  $('#progBar').style.width = `${Math.min(100, (ns.along / st.route.length) * 100).toFixed(1)}%`;
}

function updateSpeedo(fix, ns) {
  const kmh = Math.max(0, Math.round((fix.speed || 0) * 3.6));
  const limit = ns?.limit ?? st.limitFree;
  $('#speedo').hidden = false;
  $('#speedVal').textContent = kmh;
  const ls = $('#limitSign');
  if (limit) { ls.hidden = false; ls.textContent = limit; } else ls.hidden = true;
  const tol = 1 + (Number(S.overTolerance) || 0) / 100;
  $('#speedo').classList.toggle('over', !!(limit && kmh > limit * tol + 2));
}

function updateStreetPill() {
  const pill = $('#streetPill');
  let street = '';
  if (st.mode === 'nav' && st.navState && st.route) {
    const idx = st.navState.nextIndex;
    const cur = idx > 0 ? st.route.maneuvers[idx - 1] : st.route.maneuvers[0];
    street = cur?.street?.split(' / ')[0] || st.streetFree;
  } else street = st.streetFree;
  const show = !!st.fix && !!(street || st.locality) && (st.mode === 'nav' || (st.fix.speed || 0) > 2);
  pill.hidden = !show;
  if (show) pill.innerHTML = `${st.locality ? `<small>${escapeHtml(st.locality)}</small>` : ''}${escapeHtml(street || '')}`;
}

let lastAlertId = null;
function updateAlertUI(rs) {
  const card = $('#alertCard');
  const a = rs?.alert;
  if (a) {
    const id = (a.radar || a.report).id;
    if (id !== lastAlertId) {
      lastAlertId = id;
      card.querySelector('img').src = alertIconURL(a.type.icon);
      card.querySelector('.a-type').textContent = a.type.label;
    }
    card.hidden = false;
    card.classList.toggle('report', a.kind === 'report');
    card.classList.toggle('over', !!a.over);
    card.querySelector('.a-dist').textContent = fmtDist(a.d);
    const lim = card.querySelector('.a-lim');
    if (a.limit && a.kind === 'radar') { lim.hidden = false; lim.textContent = a.limit; } else lim.hidden = true;
    card.querySelector('.a-bar i').style.width = `${Math.max(3, Math.min(100, (1 - a.d / a.alertDist) * 100))}%`;
    $('#flash').classList.toggle('on', a.kind === 'radar' && a.d < 300);
  } else {
    card.hidden = true; lastAlertId = null;
    $('#flash').classList.remove('on');
  }
  const sc = $('#sectionCard');
  const s = rs?.section;
  if (s) {
    sc.hidden = false;
    sc.classList.toggle('over', !!s.over);
    sc.querySelector('.s-avg').innerHTML = `${Math.round(s.avg)} <small>km/h media${s.limit ? ` · límite ${s.limit}` : ''}</small>`;
    sc.querySelector('.s-sub').textContent = `Quedan ${fmtDist(s.remaining)} de tramo`;
  } else sc.hidden = true;
}

// ======================================================================
// Panel inferior, búsqueda y lugares
// ======================================================================
function openSheet(content, view) {
  const body = $('#sheetBody');
  body.replaceChildren(content);
  body.scrollTop = 0;
  $('#sheet').hidden = false;
  st.sheetView = view;
  document.body.classList.add('sheet-open');
}
function closeSheet() {
  $('#sheet').hidden = true;
  st.sheetView = null;
  document.body.classList.remove('sheet-open');
}

function nearPoint() {
  if (st.fix) return { lat: st.fix.lat, lon: st.fix.lon };
  const c = map.getCenter();
  return { lat: c.lat, lon: c.lng };
}

function placeItem(p, onclick, right) {
  const icon = p.blip ? h('img', { src: blipIconURL(p.blip, SKINS[S.skin]), alt: '' }) : h('span', { html: ICONS.pin });
  return h('button', { class: 'item', onclick },
    h('span', { class: 'ic' }, icon),
    h('span', { class: 'tx' }, h('div', { class: 'tt' }, p.name), p.address ? h('div', { class: 'sub' }, p.address) : null),
    right || (p.dist != null ? h('span', { class: 'rt' }, fmtDist(p.dist)) : null));
}

function showSearchHome() {
  if (st.mode === 'nav') return;
  const home = store.get('home'), work = store.get('work');
  const quick = h('div', { class: 'row' },
    h('button', { class: 'btn', onclick: () => (home ? goTo(home) : toast('Busca tu casa y pulsa «Casa» para guardarla')), html: `${ICONS.home}<span>Casa</span>` }),
    h('button', { class: 'btn', onclick: () => (work ? goTo(work) : toast('Busca tu trabajo y pulsa «Trabajo» para guardarlo')), html: `${ICONS.work}<span>Trabajo</span>` }));
  const cats = h('div', { class: 'row', style: { gap: '6px' } }, ...CATEGORIES.map((c) => h('button', { class: 'chip', onclick: () => runCategory(c) }, h('img', { src: blipIconURL(c.blip, SKINS[S.skin]), alt: '' }), c.label)));
  const fl = favs();
  const rl = recents();
  openSheet(h('div', null,
    st.addingStop ? h('h2', null, 'Añadir parada') : null,
    quick,
    h('h3', null, 'Cerca'), cats,
    fl.length ? h('h3', null, 'Favoritos') : null,
    fl.length ? h('div', { class: 'list' }, ...fl.map((p) => placeItem({ ...p, blip: 'fav', dist: st.fix ? dist(st.fix.lat, st.fix.lon, p.lat, p.lon) : null }, () => selectPlace(p)))) : null,
    rl.length ? h('h3', null, 'Recientes') : null,
    rl.length ? h('div', { class: 'list' }, ...rl.map((p) => placeItem({ ...p, dist: st.fix ? dist(st.fix.lat, st.fix.lon, p.lat, p.lon) : null }, () => selectPlace(p)))) : null,
  ), 'home');
}

let queryToken = 0;
async function onQuery() {
  const q = $('#q').value.trim();
  $('#btnClearQ').hidden = !q;
  if (q.length < 2) { showSearchHome(); return; }
  const token = ++queryToken;
  openSheet(h('div', null, h('div', { class: 'spinner' })), 'results');
  try {
    const list = await searchPlaces(q, nearPoint());
    if (token !== queryToken) return;
    st.results = list.slice(0, 10).map((p) => ({ ...p, blip: 'res' }));
    refreshResults();
    openSheet(h('div', null,
      list.length ? h('div', { class: 'list' }, ...list.map((p) => placeItem(p, () => selectPlace(p)))) : h('p', { class: 'empty' }, 'Sin resultados. Prueba con otra dirección o un nombre de lugar.'),
    ), 'results');
  } catch (e) {
    if (token !== queryToken) return;
    openSheet(h('p', { class: 'empty' }, 'No se pudo buscar. Revisa la conexión.'), 'results');
  }
}

function addRecent(p) {
  const list = recents().filter((x) => !(Math.abs(x.lat - p.lat) < 1e-5 && Math.abs(x.lon - p.lon) < 1e-5));
  list.unshift({ id: p.id, name: p.name, address: p.address, lat: p.lat, lon: p.lon });
  store.set('recents', list.slice(0, 15));
  carPlaces();
}

function goTo(p) {
  if (st.addingStop) { addStop(p); return; }
  addRecent(p);
  previewRoute({ name: p.name, lat: p.lat, lon: p.lon, address: p.address });
}

function addStop(p) {
  st.addingStop = false;
  st.stops.push({ name: p.name, lat: p.lat, lon: p.lon });
  $('#q').value = '';
  previewRoute(st.dest);
}

function selectPlace(p) {
  closeSkinPop();
  $('#q').blur();
  st.pin = { lat: p.lat, lon: p.lon };
  refreshPin();
  map.easeTo({ center: [p.lon, p.lat], zoom: Math.max(map.getZoom(), 15), padding: { bottom: Math.round(map.getContainer().clientHeight * 0.35), top: 0, left: 0, right: 0 }, duration: 600 });
  setFollow(false);
  renderPlace(p);
}

function renderPlace(p) {
  const isFav = favs().some((f) => Math.abs(f.lat - p.lat) < 1e-5 && Math.abs(f.lon - p.lon) < 1e-5);
  const d = st.fix ? dist(st.fix.lat, st.fix.lon, p.lat, p.lon) : null;
  const prices = p.prices ? h('div', { class: 'prices' }, ...FUELS.filter((f) => p.prices[f.id]).map((f) => h('div', null, f.label, h('b', null, fmtPrice(p.prices[f.id]).replace(' €', ''))))) : null;
  openSheet(h('div', null,
    h('div', { class: 'place-head' },
      h('div', { class: 'tx' },
        h('div', { class: 'place-name' }, p.name),
        p.address ? h('div', { class: 'place-addr' }, p.address) : null,
        h('div', { class: 'place-meta' }, [d != null ? `A ${fmtDist(d)}` : null, p.hours || null].filter(Boolean).join(' · ')),
      ),
      h('button', { class: 'icon-btn', onclick: () => { closeSheet(); st.pin = null; refreshPin(); }, html: ICONS.close, 'aria-label': 'Cerrar' })),
    prices,
    h('div', { class: 'row', style: { marginTop: '12px' } },
      st.addingStop
        ? h('button', { class: 'btn primary', onclick: () => addStop(p), html: `${ICONS.plus}<span>Añadir parada</span>` })
        : h('button', { class: 'btn primary', onclick: () => goTo(p), html: `${ICONS.go}<span>Ir</span>` }),
      h('button', { class: 'btn', onclick: () => toggleFav(p), html: `${isFav ? ICONS.star : ICONS.starO}<span>${isFav ? 'Guardado' : 'Guardar'}</span>` })),
    h('div', { class: 'row', style: { marginTop: '8px' } },
      h('button', { class: 'btn small', onclick: () => { store.set('home', { name: 'Casa', lat: p.lat, lon: p.lon, address: p.name }); refreshFavs(); toast('Casa guardada'); }, html: `${ICONS.home}<span>Casa</span>` }),
      h('button', { class: 'btn small', onclick: () => { store.set('work', { name: 'Trabajo', lat: p.lat, lon: p.lon, address: p.name }); refreshFavs(); toast('Trabajo guardado'); }, html: `${ICONS.work}<span>Trabajo</span>` }),
      h('button', { class: 'btn small', onclick: () => copyText(`${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}`), html: `${ICONS.copy}<span>Coords</span>` }),
      navigator.share ? h('button', { class: 'btn small', onclick: () => navigator.share({ title: p.name, text: p.name, url: `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}#map=17/${p.lat}/${p.lon}` }).catch(() => {}), html: `${ICONS.share}<span>Compartir</span>` }) : null),
  ), 'place');
}

function toggleFav(p) {
  let list = favs();
  const idx = list.findIndex((f) => Math.abs(f.lat - p.lat) < 1e-5 && Math.abs(f.lon - p.lon) < 1e-5);
  if (idx >= 0) { list.splice(idx, 1); toast('Quitado de favoritos'); } else { list.unshift({ id: p.id || `${p.lat},${p.lon}`, name: p.name, address: p.address, lat: p.lat, lon: p.lon }); toast('Guardado en favoritos'); }
  store.set('favs', list);
  refreshFavs();
  renderPlace(p);
}

async function copyText(t) {
  try { await navigator.clipboard.writeText(t); toast('Copiado'); } catch { toast(t, 5000); }
}

async function runCategory(cat) {
  closeSkinPop();
  $$('#chips .chip').forEach((c) => c.classList.toggle('on', c.dataset.id === cat.id));
  const near = nearPoint();
  openSheet(h('div', null, h('h2', null, cat.label), h('div', { class: 'spinner' })), 'category');
  try {
    if (cat.id === 'fuel') { await runFuel(near); return; }
    let list = await searchCategory(cat, near.lat, near.lon, 3000);
    if (list.length < 3) list = await searchCategory(cat, near.lat, near.lon, 10000);
    showResults(cat.label, list);
  } catch (e) {
    console.warn(e);
    openSheet(h('div', null, h('h2', null, cat.label), h('p', { class: 'empty' }, 'No se pudieron cargar los lugares (servidor ocupado). Inténtalo en un momento.')), 'category');
  }
}

async function runFuel(near) {
  let data;
  try { data = await loadFuel(); } catch {
    const list = await searchCategory(CATEGORIES[0], near.lat, near.lon, 5000);
    showResults('Gasolineras', list);
    return;
  }
  const render = () => {
    const list = nearestFuel(data, near.lat, near.lon, { fuel: S.fuelType, sort: st.fuelSort, radius: 10000 });
    st.results = list; refreshResults();
    if (list.length) fitPoints(list);
    const fuelSel = h('select', { class: 'sel', onchange: (e) => { S.fuelType = e.target.value; saveSettings(); render(); } },
      ...FUELS.map((f) => h('option', { value: f.id, selected: S.fuelType === f.id }, f.label)));
    const sortBtn = (k, l) => h('button', { class: `toggle${st.fuelSort === k ? ' on' : ''}`, onclick: () => { st.fuelSort = k; render(); } }, l);
    openSheet(h('div', null,
      h('h2', null, 'Gasolineras'),
      h('div', { class: 'toggles' }, fuelSel, sortBtn('dist', 'Cercanas'), sortBtn('price', 'Más baratas')),
      list.length ? h('div', { class: 'list' }, ...list.map((p) => placeItem(p, () => selectPlace(p),
        h('span', { class: 'rt' }, h('div', { class: 'price' }, fmtPrice(p.price).replace(' €', '')), h('div', { class: 'sub' }, fmtDist(p.dist)))))) : h('p', { class: 'empty' }, 'No hay gasolineras con ese carburante cerca.'),
      h('p', { class: 'legal' }, `Precios oficiales del Ministerio${data.fecha ? ` (${data.fecha})` : ''}.`),
    ), 'category');
  };
  render();
}

function showResults(title, list) {
  st.results = list.slice(0, 60);
  refreshResults();
  if (list.length) fitPoints(st.results);
  openSheet(h('div', null,
    h('h2', null, title),
    list.length ? h('div', { class: 'list' }, ...st.results.map((p) => placeItem(p, () => selectPlace(p)))) : h('p', { class: 'empty' }, 'No hay resultados cerca.'),
  ), 'category');
}

function fitPoints(list) {
  const pts = list.slice(0, 15).map((p) => [p.lon, p.lat]);
  if (st.fix) pts.push([st.fix.lon, st.fix.lat]);
  const [w, s, e, n] = bboxOf(pts);
  setFollow(false);
  resetPadding();
  map.fitBounds([[w, s], [e, n]], { padding: { top: 120, bottom: Math.round(map.getContainer().clientHeight * 0.5), left: 40, right: 40 }, maxZoom: 16, duration: 600 });
}

// ---- Clics en el mapa ----
map.on('click', 'results', (e) => { const p = st.results[e.features[0].properties.i]; if (p) selectPlace(p); });
map.on('click', 'favs', (e) => {
  const f = e.features[0].properties;
  const [lon, lat] = e.features[0].geometry.coordinates;
  selectPlace({ name: f.name, lat, lon, blip: f.kind });
});
map.on('click', 'route-alt', (e) => { if (st.mode === 'preview') { st.selRoute = e.features[0].properties.idx; refreshRoutes(); renderPreview(); } });
map.on('click', 'radars', (e) => {
  const id = e.features[0].properties.id;
  const r = radarDB.byId(id);
  if (!r) return;
  if (r.type && REPORT_TYPES[r.type]) { showReportInfo(r); return; }
  const t = RADAR_TYPES[r.tipo];
  const src = { dgt: 'DGT', madrid: 'Ayuntamiento de Madrid', sct: 'Servei Català de Trànsit', tachwire: 'DGT (listado 2026)', osm: 'OpenStreetMap', personal: 'Tu reporte' }[r.fuente] || r.fuente || '';
  openSheet(h('div', null,
    h('div', { class: 'place-head' },
      h('img', { src: alertIconURL(t.icon), alt: '', style: { width: '44px', height: '44px' } }),
      h('div', { class: 'tx' },
        h('div', { class: 'place-name' }, t.label),
        h('div', { class: 'place-addr' }, r.nombre || ''),
        h('div', { class: 'place-meta' }, [r.limite ? `Límite ${r.limite} km/h` : 'Límite desconocido', r.rumbo != null ? `Sentido ${Math.round(r.rumbo)}°` : 'Ambos sentidos', src].filter(Boolean).join(' · '))),
      h('button', { class: 'icon-btn', onclick: closeSheet, html: ICONS.close, 'aria-label': 'Cerrar' })),
    r.report ? h('div', { class: 'row', style: { marginTop: '12px' } }, h('button', { class: 'btn danger', onclick: () => { radarDB.removeReport(r.report.id); closeSheet(); toast('Reporte borrado'); }, html: `${ICONS.trash}<span>Borrar mi reporte</span>` })) : null,
  ), 'radar');
});
for (const id of ['poi-top', 'poi-mid', 'poi-low']) {
  map.on('click', id, (e) => {
    const f = e.features[0];
    const [lon, lat] = f.geometry.coordinates;
    const name = f.properties['name:es'] || f.properties.name || 'Lugar';
    selectPlace({ id: `poi${f.id || ''}`, name, address: f.properties.subclass ? f.properties.subclass.replace(/_/g, ' ') : '', lat, lon });
  });
}
for (const id of ['results', 'favs', 'radars', 'route-alt', 'poi-top', 'poi-mid', 'poi-low']) {
  map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
}

// Pulsación larga: soltar un pin
(function longPress() {
  let timer = null, start = null;
  const el = map.getCanvasContainer();
  const fire = (pt) => {
    const ll = map.unproject(pt);
    dropPin(ll.lat, ll.lng);
  };
  el.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { clearTimeout(timer); return; }
    const r = el.getBoundingClientRect();
    start = { x: e.touches[0].clientX - r.left, y: e.touches[0].clientY - r.top };
    clearTimeout(timer);
    timer = setTimeout(() => fire([start.x, start.y]), 600);
  }, { passive: true });
  el.addEventListener('touchmove', (e) => {
    if (!start) return;
    const r = el.getBoundingClientRect();
    if (Math.hypot(e.touches[0].clientX - r.left - start.x, e.touches[0].clientY - r.top - start.y) > 10) clearTimeout(timer);
  }, { passive: true });
  el.addEventListener('touchend', () => clearTimeout(timer));
  map.on('contextmenu', (e) => dropPin(e.lngLat.lat, e.lngLat.lng));
})();

async function dropPin(lat, lon) {
  if (st.mode === 'nav') return;
  navigator.vibrate?.(20);
  const p = { id: `pin${lat},${lon}`, name: 'Punto en el mapa', address: `${lat.toFixed(5)}, ${lon.toFixed(5)}`, lat, lon };
  selectPlace(p);
  try {
    const r = await reverse(lat, lon);
    if (st.pin && st.pin.lat === lat && st.sheetView === 'place') renderPlace({ ...p, name: r.name, address: r.address || p.address });
  } catch { /* sin dirección */ }
}

// ======================================================================
// Reportes
// ======================================================================
function openReportPanel() {
  const pos = st.fix || (() => { const c = map.getCenter(); return { lat: c.lat, lon: c.lng }; })();
  const ov = h('div', { class: 'overlay' },
    h('div', { class: 'menu-head' }, h('div', { class: 'menu-title' }, 'Reportar'), h('button', { class: 'icon-btn', onclick: () => ov.remove(), html: ICONS.close, 'aria-label': 'Cerrar' })),
    h('p', { class: 'legal' }, st.fix ? 'Se guarda en tu posición actual, solo en este móvil. Los radares que reportes también te avisarán.' : 'Sin GPS: se guardará en el centro del mapa.'),
    h('div', { class: 'report-grid' }, ...Object.entries(REPORT_TYPES).map(([k, def]) => h('button', {
      class: 'rep',
      onclick: () => {
        radarDB.addReport(k, pos.lat, pos.lon, (st.fix?.speed || 0) > 2 ? st.heading : null);
        if (st.route) watcher.setRoute(st.route);
        ov.remove();
        sound('ok');
        toast(`${def.label} reportado${def.ttl ? ` (caduca en ${fmtDur(def.ttl / 1000)})` : ''}`);
      },
    }, h('img', { src: alertIconURL(def.icon), alt: '' }), def.label))),
  );
  document.body.append(ov);
}

function showReportInfo(rep) {
  const def = REPORT_TYPES[rep.type];
  openSheet(h('div', null,
    h('div', { class: 'place-head' },
      h('img', { src: alertIconURL(def.icon), alt: '', style: { width: '44px', height: '44px' } }),
      h('div', { class: 'tx' }, h('div', { class: 'place-name' }, def.label), h('div', { class: 'place-addr' }, `Reportado ${new Date(rep.t).toLocaleString('es-ES')}`),
        h('div', { class: 'place-meta' }, rep.exp ? `Caduca ${new Date(rep.exp).toLocaleString('es-ES')}` : 'Permanente')),
      h('button', { class: 'icon-btn', onclick: closeSheet, html: ICONS.close })),
    h('div', { class: 'row', style: { marginTop: '12px' } }, h('button', { class: 'btn danger', onclick: () => { radarDB.removeReport(rep.id); closeSheet(); toast('Reporte borrado'); }, html: `${ICONS.trash}<span>Borrar</span>` })),
  ), 'report');
}

// ======================================================================
// Menú de pausa (ajustes)
// ======================================================================
function sw(key, label, desc, after) {
  const el = h('button', { class: `switch${S[key] ? ' on' : ''}`, role: 'switch', 'aria-checked': String(!!S[key]), 'aria-label': label });
  const row = h('div', { class: 'opt', onclick: () => { S[key] = !S[key]; el.classList.toggle('on', S[key]); el.setAttribute('aria-checked', String(S[key])); saveSettings(); after?.(); } },
    h('div', { class: 'ol' }, h('div', { class: 'ot' }, label), desc ? h('div', { class: 'od' }, desc) : null), el);
  return row;
}
function selectOpt(key, label, options, after, desc) {
  return h('div', { class: 'opt' },
    h('div', { class: 'ol' }, h('div', { class: 'ot' }, label), desc ? h('div', { class: 'od' }, desc) : null),
    h('select', { class: 'sel', onchange: (e) => { const v = e.target.value; S[key] = /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v; saveSettings(); after?.(); } },
      ...options.map(([v, l]) => h('option', { value: v, selected: String(S[key]) === String(v) }, l))));
}

function skinCards(onPick) {
  return h('div', { class: 'skins' }, ...Object.values(SKINS).map((sk) => h('button', { class: `skin${S.skin === sk.id ? ' on' : ''}`, onclick: () => onPick(sk.id) },
    h('div', { class: 'sw', style: { background: sk.bg } },
      h('i', { style: { left: '0', right: '0', top: '38%', height: '7px', background: sk.roads.motorway } }),
      h('i', { style: { left: '28%', top: '0', bottom: '0', width: '4px', background: sk.roads.primary } }),
      h('i', { style: { left: '62%', top: '0', bottom: '0', width: '3px', background: sk.roads.minor } }),
      h('i', { style: { right: '0', top: '0', width: '30%', height: '30%', background: sk.water } }),
      h('i', { style: { left: '6%', bottom: '10%', width: '18%', height: '28%', background: sk.park } }),
      h('i', { style: { left: '10%', right: '20%', top: '70%', height: '5px', background: sk.route, boxShadow: `0 0 8px ${sk.route}` } })),
    h('div', { class: 'sn' }, sk.name), h('div', { class: 'sd' }, sk.desc))));
}

function setSkin(id) {
  S.skin = id; saveSettings(); applySkinVars();
  reloadStyle();
}
function reloadStyle() {
  map.setStyle(buildStyle(S.skin, { poi: S.poi, buildings3d: S.buildings3d }), { diff: false });
}

function openMenu(tab = 'mapa') {
  closeSkinPop();
  const tabs = [['mapa', 'Mapa'], ['rutas', 'Navegación'], ['radares', 'Radares'], ['lugares', 'Lugares'], ['info', 'Info']];
  const body = h('div', { class: 'menu-body' });
  const tabBar = h('div', { class: 'tabs' });
  const ov = h('div', { class: 'overlay', id: 'menu' },
    h('div', { class: 'menu-head' }, h('div', { class: 'menu-title' }, 'MINI', h('span', null, 'MAPA')), h('button', { class: 'icon-btn', onclick: () => ov.remove(), html: ICONS.close, 'aria-label': 'Cerrar' })),
    tabBar, body);
  const show = (t) => {
    tabBar.replaceChildren(...tabs.map(([k, l]) => h('button', { class: `tab${k === t ? ' on' : ''}`, onclick: () => show(k) }, l)));
    body.replaceChildren(...menuTab(t, () => show(t)));
    body.scrollTop = 0;
  };
  show(tab);
  document.body.append(ov);
}

function menuTab(t, rerender) {
  if (t === 'mapa') {
    return [
      h('h3', null, 'Estilo del mapa'),
      skinCards((id) => { setSkin(id); rerender(); }),
      h('h3', null, 'Capas'),
      sw('poi', 'Lugares en el mapa', 'Iconos de gasolineras, tiendas, restaurantes…', reloadStyle),
      sw('showRadars', 'Radares en el mapa', null, () => ['radars', 'radar-sections'].forEach((l) => map.getLayer(l) && map.setLayoutProperty(l, 'visibility', S.showRadars ? 'visible' : 'none'))),
      sw('buildings3d', 'Edificios en 3D', 'Más bonito, gasta algo más de batería', reloadStyle),
      sw('traffic', 'Tráfico en directo', S.tomtomKey ? 'Capa de TomTom' : 'Necesita una clave gratuita de TomTom (pestaña Navegación)', () => { if (S.traffic && !S.tomtomKey) { toast('Primero añade la clave de TomTom en Navegación'); S.traffic = false; saveSettings(); rerender(); return; } reloadStyle(); }),
      h('h3', null, 'Cámara'),
      sw('headingUp', 'Mapa orientado según la marcha', 'Si lo apagas, el norte queda siempre arriba'),
      sw('tilt', 'Vista inclinada al conducir'),
      sw('autoZoom', 'Zoom automático según la velocidad'),
    ];
  }
  if (t === 'rutas') {
    const voices = spanishVoices();
    const keyInput = h('input', { class: 'field', type: 'text', placeholder: 'Clave API de TomTom (opcional)', value: S.tomtomKey || '', autocomplete: 'off' });
    return [
      h('h3', null, 'Voz y sonido'),
      sw('voice', 'Indicaciones por voz', null, () => $('#btnMute').innerHTML = S.voice ? ICONS.volume : ICONS.mute),
      voices.length ? selectOpt('voiceURI', 'Voz', [['', 'Automática (español)'], ...voices.map((v) => [v.voiceURI, `${v.name} (${v.lang})`])]) : h('div', { class: 'opt' }, h('div', { class: 'ol' }, h('div', { class: 'ot' }, 'Voz'), h('div', { class: 'od' }, 'El sistema aún no ha cargado voces en español.'))),
      selectOpt('volume', 'Volumen de avisos', [['1', 'Alto'], ['0.7', 'Medio'], ['0.4', 'Bajo']]),
      selectOpt('soundStyle', 'Sonido de radar', [['sirena', 'Sirena corta'], ['pitido', 'Pitido']], () => { unlockAudio(); sound('radar'); }),
      h('div', { class: 'opt' }, h('div', { class: 'ol' }, h('div', { class: 'ot' }, 'Probar la voz')), h('button', { class: 'btn small', onclick: () => { unlockAudio(); speak('En 300 metros, gira a la derecha en Calle Mayor.', { priority: 'high' }); } }, 'Probar')),
      h('h3', null, 'Rutas'),
      sw('avoidTolls', 'Evitar peajes'),
      sw('avoidHighways', 'Evitar autopistas y autovías'),
      selectOpt('keepAwake', 'Pantalla encendida', [['siempre', 'Siempre con la app abierta'], ['navegando', 'Solo navegando'], ['nunca', 'No forzar']], requestWakeLock, 'El GPS del navegador se pausa si se apaga la pantalla'),
      sw('freeDriveLimits', 'Límite de velocidad sin ruta', 'Consulta el límite de la vía cada pocos segundos'),
      h('h3', null, 'Tráfico (opcional)'),
      h('p', { class: 'legal' }, 'Con una clave gratuita de developer.tomtom.com verás el tráfico en el mapa y el retraso en la hora de llegada.'),
      keyInput,
      h('div', { class: 'row', style: { marginTop: '8px' } }, h('button', { class: 'btn small', onclick: () => { S.tomtomKey = keyInput.value.trim(); if (S.tomtomKey) S.traffic = true; saveSettings(); reloadStyle(); toast(S.tomtomKey ? 'Clave guardada' : 'Clave borrada'); rerender(); } }, 'Guardar clave')),
    ];
  }
  if (t === 'radares') {
    const meta = radarDB.meta;
    const typeRows = Object.entries(RADAR_TYPES).map(([k, def]) => {
      const on = S.radarTypes[k] !== false;
      const el = h('button', { class: `switch${on ? ' on' : ''}`, role: 'switch', 'aria-checked': String(on), 'aria-label': def.label });
      return h('div', { class: 'opt', onclick: () => { S.radarTypes[k] = !(S.radarTypes[k] !== false); el.classList.toggle('on', S.radarTypes[k]); saveSettings(); if (st.route) watcher.setRoute(st.route); } },
        h('img', { src: alertIconURL(def.icon), alt: '', style: { width: '30px', height: '30px' } }),
        h('div', { class: 'ol' }, h('div', { class: 'ot' }, def.label)), el);
    });
    const reps = radarDB.activeReports();
    const counts = {};
    for (const r of radarDB.all) counts[r.tipo] = (counts[r.tipo] || 0) + 1;
    return [
      h('h3', null, 'Avisar de'),
      ...typeRows,
      sw('reportAlerts', 'Mis reportes (controles, obras, accidentes…)'),
      h('h3', null, 'Avisos'),
      selectOpt('alertDistance', 'Distancia del aviso', [['auto', 'Automática (según velocidad)'], ['300', '300 m'], ['500', '500 m'], ['800', '800 m'], ['1000', '1 km']]),
      sw('overspeedAlerts', 'Alerta si vas por encima del límite', 'Pitido y aviso de voz cerca del radar y en tramos'),
      selectOpt('overTolerance', 'Margen antes de avisar', [['0', 'Sin margen'], ['5', '+5 %'], ['10', '+10 %']]),
      h('h3', null, 'Base de datos'),
      h('dl', { class: 'kv' },
        h('dt', null, 'Radares cargados'), h('dd', null, String(radarDB.all.length)),
        h('dt', null, 'Actualizada'), h('dd', null, meta?.generado ? new Date(meta.generado).toLocaleString('es-ES') : 'Sin datos todavía'),
        h('dt', null, 'Por tipo'), h('dd', null, Object.entries(counts).map(([k, v]) => `${RADAR_TYPES[k]?.label || k}: ${v}`).join(' · ') || '—'),
        h('dt', null, 'Fuentes'), h('dd', null, (meta?.fuentes || []).map((f) => `${f.nombre}${f.total != null ? ` (${f.total})` : ''}`).join(' · ') || '—'),
        h('dt', null, 'OSM en directo'), h('dd', null, `${Object.keys(radarDB.osmCells).length} zonas en caché`)),
      sw('osmLive', 'Completar con OpenStreetMap en directo', 'Descarga los radares de OSM de la zona por la que vas (útil fuera de España)'),
      h('div', { class: 'row', style: { marginTop: '10px' } },
        h('button', { class: 'btn', onclick: async () => { toast('Buscando actualizaciones…'); try { const r = await radarDB.refresh(true); toast(r.changed ? `Base actualizada: ${r.total} radares` : 'Ya tienes la última versión'); rerender(); } catch { toast('No se pudo descargar la base'); } }, html: `${ICONS.refresh}<span>Actualizar ahora</span>` })),
      h('h3', null, `Mis reportes (${reps.length})`),
      h('div', { class: 'row' },
        h('button', { class: 'btn small', onclick: () => openTextDialog('Exportar reportes', JSON.stringify(radarDB.reports), null) }, 'Exportar'),
        h('button', { class: 'btn small', onclick: () => openTextDialog('Importar reportes', '', (txt) => { try { radarDB.importReports(JSON.parse(txt)); toast('Reportes importados'); } catch { toast('Texto no válido'); } }) }, 'Importar'),
        h('button', { class: 'btn small', onclick: () => { radarDB.clearExpired(); toast('Caducados borrados'); rerender(); } }, 'Limpiar caducados')),
    ];
  }
  if (t === 'lugares') {
    const home = store.get('home'), work = store.get('work');
    const fl = favs();
    return [
      h('h3', null, 'Casa y trabajo'),
      h('div', { class: 'list' },
        h('div', { class: 'item' }, h('span', { class: 'ic', html: ICONS.home }), h('span', { class: 'tx' }, h('div', { class: 'tt' }, 'Casa'), h('div', { class: 'sub' }, home?.address || 'Sin configurar: búscala y pulsa «Casa»')), home ? h('button', { class: 'btn small', onclick: () => { store.del('home'); refreshFavs(); rerender(); } }, 'Borrar') : null),
        h('div', { class: 'item' }, h('span', { class: 'ic', html: ICONS.work }), h('span', { class: 'tx' }, h('div', { class: 'tt' }, 'Trabajo'), h('div', { class: 'sub' }, work?.address || 'Sin configurar: búscalo y pulsa «Trabajo»')), work ? h('button', { class: 'btn small', onclick: () => { store.del('work'); refreshFavs(); rerender(); } }, 'Borrar') : null)),
      h('h3', null, `Favoritos (${fl.length})`),
      fl.length ? h('div', { class: 'list' }, ...fl.map((f, i) => h('div', { class: 'item' }, h('span', { class: 'ic', html: ICONS.star }), h('span', { class: 'tx' }, h('div', { class: 'tt' }, f.name), h('div', { class: 'sub' }, f.address || '')),
        h('button', { class: 'btn small', onclick: () => { const l = favs(); l.splice(i, 1); store.set('favs', l); refreshFavs(); rerender(); } }, 'Borrar')))) : h('p', { class: 'empty' }, 'Aún no tienes favoritos.'),
      h('h3', null, 'Recientes'),
      h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => { store.set('recents', []); toast('Recientes borrados'); } }, 'Borrar recientes')),
      h('h3', null, 'Copia de seguridad'),
      h('div', { class: 'row' },
        h('button', { class: 'btn small', onclick: () => openTextDialog('Exportar lugares y ajustes', JSON.stringify({ settings: S, favs: favs(), home: store.get('home'), work: store.get('work'), reports: radarDB.reports }), null) }, 'Exportar todo'),
        h('button', { class: 'btn small', onclick: () => openTextDialog('Importar lugares y ajustes', '', (txt) => {
          try {
            const d = JSON.parse(txt);
            if (d.settings) { Object.assign(S, d.settings); saveSettings(); }
            if (d.favs) store.set('favs', d.favs);
            if (d.home) store.set('home', d.home);
            if (d.work) store.set('work', d.work);
            if (d.reports) radarDB.importReports(d.reports);
            refreshFavs(); toast('Datos importados'); reloadStyle();
          } catch { toast('Texto no válido'); }
        }) }, 'Importar')),
    ];
  }
  // info
  return [
    NATIVE ? h('h3', null, 'Android Auto') : null,
    NATIVE ? h('p', { class: 'legal' }, 'Abre Minimapa en el móvil antes de conectar el coche (puede quedarse en segundo plano). En Android Auto: Ajustes → toca 10 veces «Versión» → ⋮ → Ajustes de desarrollador → marca «Fuentes desconocidas». En el coche verás el mapa con tu skin, las maniobras, los radares y el botón Destinos.') : null,
    h('h3', null, 'Cómo se usa'),
    h('p', { class: 'legal' }, 'Busca un sitio o mantén pulsado el mapa, pulsa «Ir» y luego «Iniciar». «Simular» recorre la ruta sin moverte (ideal para probar los avisos). El botón del triángulo guarda reportes en tu posición. Sin ruta, la app sigue avisando de radares y mostrando el límite de la vía.'),
    h('h3', null, 'Datos y créditos'),
    h('p', { class: 'legal', html: [
      'Mapa: <a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a>, <a href="https://openmaptiles.org" target="_blank" rel="noopener">OpenMapTiles</a> y <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© colaboradores de OpenStreetMap</a>.',
      'Rutas: <a href="https://valhalla1.openstreetmap.de" target="_blank" rel="noopener">Valhalla (FOSSGIS)</a> y <a href="https://project-osrm.org" target="_blank" rel="noopener">OSRM</a>. Búsqueda: <a href="https://photon.komoot.io" target="_blank" rel="noopener">Photon</a> y Nominatim. Lugares: Overpass API.',
      'Radares: DGT (Punto de Acceso Nacional), Ayuntamiento de Madrid (CC BY 4.0), Servei Català de Trànsit, listado DGT georreferenciado por Tachwire (ODbL) y OpenStreetMap (ODbL).',
      'Carburantes: Ministerio para la Transición Ecológica. Tráfico opcional: TomTom.',
      'Motor de mapa: MapLibre GL JS (BSD-3). Tipografías: Oswald y Bebas Neue (OFL).',
    ].join('<br><br>') }),
    h('h3', null, 'Aviso'),
    h('p', { class: 'legal' }, 'Navegador de uso personal. Los radares son ubicaciones públicas y pueden estar incompletas o desactualizadas: respeta siempre los límites y la señalización. No manipules el móvil mientras conduces. Este proyecto no está afiliado a ningún videojuego ni a sus editores.'),
    h('dl', { class: 'kv' }, h('dt', null, 'Versión'), h('dd', null, `${CONFIG.version}${NATIVE ? ' · app Android' : ' · web'}`)),
    st.update ? h('div', { class: 'row', style: { marginTop: '12px' } },
      h('a', { class: 'btn primary', href: st.update.url, target: '_blank', rel: 'noopener', style: { textDecoration: 'none' } }, `Descargar versión ${st.update.version}`)) : null,
    h('h3', null, 'Probar con amigos'),
    h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: shareApp, html: `${ICONS.share}<span>Compartir la app</span>` }),
      h('button', { class: 'btn primary', onclick: openFeedback }, 'Enviar opinión')),
    h('div', { class: 'row', style: { marginTop: '12px' } },
      document.fullscreenEnabled ? h('button', { class: 'btn small', onclick: () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {}), html: `${ICONS.fullscreen}<span>Pantalla completa</span>` }) : null),
  ];
}

function openTextDialog(title, text, onOk) {
  const ta = h('textarea', { class: 'code' });
  ta.value = text;
  const ov = h('div', { class: 'overlay' },
    h('div', { class: 'menu-head' }, h('div', { class: 'panel-title', style: { flex: '1' } }, title), h('button', { class: 'icon-btn', onclick: () => ov.remove(), html: ICONS.close })),
    ta,
    h('div', { class: 'row', style: { marginTop: '10px' } },
      onOk ? h('button', { class: 'btn primary', onclick: () => { onOk(ta.value); ov.remove(); } }, 'Importar') : h('button', { class: 'btn primary', onclick: () => copyText(ta.value) }, 'Copiar'),
      h('button', { class: 'btn', onclick: () => ov.remove() }, 'Cerrar')));
  document.body.append(ov);
  if (!onOk) ta.select();
}

// Popover rápido de estilos
let skinPop = null;
function closeSkinPop() { skinPop?.remove(); skinPop = null; }
function toggleSkinPop() {
  if (skinPop) { closeSkinPop(); return; }
  const render = () => {
    skinPop.replaceChildren(
      h('div', { class: 'panel-title' }, 'Estilo'),
      skinCards((id) => { setSkin(id); render(); }),
      sw('buildings3d', 'Edificios 3D', null, reloadStyle),
      sw('showRadars', 'Radares', null, () => ['radars', 'radar-sections'].forEach((l) => map.getLayer(l) && map.setLayoutProperty(l, 'visibility', S.showRadars ? 'visible' : 'none'))),
      sw('poi', 'Lugares', null, reloadStyle),
    );
  };
  skinPop = h('div', { id: 'skinPop' });
  render();
  document.body.append(skinPop);
}

// ======================================================================
// Varios: avisos, pantalla, misión cumplida
// ======================================================================
let toastTimer;
function toast(msg, ms = 2800) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

function showMission(title, sub) {
  const m = $('#mission');
  m.querySelector('.mission-title').textContent = title;
  m.querySelector('.mission-sub').textContent = sub;
  m.hidden = false;
  setTimeout(() => { m.hidden = true; }, 4500);
}

async function requestWakeLock() {
  const want = S.keepAwake === 'siempre' || (S.keepAwake === 'navegando' && st.mode === 'nav');
  if (NATIVE && Native.keepAwake) { nativeKeepAwake(want); return; }
  if (!('wakeLock' in navigator)) return;
  if (!want) { try { await st.wakeLock?.release(); } catch { /* nada */ } st.wakeLock = null; return; }
  if (st.wakeLock && !st.wakeLock.released) return;
  try { st.wakeLock = await navigator.wakeLock.request('screen'); } catch { /* denegado */ }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') requestWakeLock(); });


// ======================================================================
// Android Auto y app nativa
// ======================================================================
const recentErrors = [];
addEventListener('error', (e) => { recentErrors.push(String(e.message || e).slice(0, 160)); if (recentErrors.length > 6) recentErrors.shift(); });
addEventListener('unhandledrejection', (e) => { recentErrors.push(String(e.reason?.message || e.reason).slice(0, 160)); if (recentErrors.length > 6) recentErrors.shift(); });

const CAR = NATIVE && !!Native.car;
let carLastSent = 0;
let carIconKey = '';

function carCall(method, args) {
  if (!CAR) return;
  try { Native.car[method](args).catch(() => {}); } catch { /* sin puente */ }
}

function carNavInfo(ns, alert) {
  const info = { active: st.mode === 'nav' && !!st.route, loading: !!st.rerouting, voice: !!S.voice, street: st.streetFree || '', locality: st.locality || '' };
  if (alert) info.alert = { id: alert.id, title: alert.label, text: `${alert.label} a ${fmtDist(alert.d)}${alert.limit ? ` · límite ${alert.limit}` : ''}` };
  if (info.active && ns?.next) {
    const m = ns.next, a = ns.afterNext;
    info.cur = { kind: m.kind, exit: m.exit || 0, text: m.text || '', street: (m.street || '').split(' / ')[0] };
    if (a && ns.distAfter < 500 && m.kind !== 'arrive') info.next = { kind: a.kind, exit: a.exit || 0, text: a.text || '', street: (a.street || '').split(' / ')[0] };
    info.distNext = ns.distNext;
    info.remaining = ns.remaining;
    info.remainingTime = ns.remainingTime;
  } else if (info.active) {
    info.loading = true;
  }
  return info;
}

function carLive(fix, ns, rs, pos, rot) {
  if (!CAR) return;
  const now = Date.now();
  if (now - carLastSent < 700) return;
  carLastSent = now;
  const tol = 1 + (Number(S.overTolerance) || 0) / 100;
  const limit = ns?.limit ?? st.limitFree ?? null;
  const kmh = (fix.speed || 0) * 3.6;
  const a = rs?.alert;
  const alert = a ? { id: (a.radar || a.report).id, icon: a.type.icon, label: a.type.label, d: Math.round(a.d), alertDist: a.alertDist, limit: a.kind === 'radar' ? a.limit : null, over: !!a.over, kind: a.kind } : null;
  const sec = rs?.section;
  const live = {
    lat: pos.lat, lon: pos.lon, rot, speed: fix.speed || 0, limit, over: !!(limit && kmh > limit * tol + 2),
    nav: st.mode === 'nav', segIndex: ns?.segIndex ?? null, snapped: ns?.snapped ?? null, distNext: ns?.distNext ?? null,
    alert, section: sec ? { avg: sec.avg, limit: sec.limit, remaining: sec.remaining, over: !!sec.over } : null,
    street: st.streetFree || '', locality: st.locality || '',
  };
  carCall('update', { live: JSON.stringify(live), nav: carNavInfo(ns, alert) });
  if (st.mode === 'nav' && ns?.next) carIcons(ns);
}

function carLiveNow() {
  if (!CAR || !st.fix) return;
  carLastSent = 0;
  const ns = st.mode === 'nav' ? st.navState : null;
  const pos = ns && !ns.offRoute && ns.offset < 40 ? ns.snapped : { lat: st.fix.lat, lon: st.fix.lon };
  carLive(st.fix, ns, watcher.lastState, pos, currentRotation());
}

async function svgToPng(svg, size = 96) {
  const src = svg.replace('<svg ', `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" `).replaceAll('currentColor', '#ffffff');
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(src)}`;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = c.height = size;
  c.getContext('2d').drawImage(img, 0, 0, size, size);
  return c.toDataURL('image/png');
}

async function carIcons(ns) {
  const m = ns.next, a = ns.afterNext && ns.distAfter < 500 ? ns.afterNext : null;
  const key = `${ns.nextIndex}:${m.kind}:${m.exit}|${a ? `${a.kind}:${a.exit}` : ''}`;
  if (key === carIconKey) return;
  carIconKey = key;
  try {
    const current = await svgToPng(maneuverSVG(m.kind, m.exit));
    const next = a ? await svgToPng(maneuverSVG(a.kind, a.exit)) : '';
    carCall('setIcons', { current, next });
  } catch { /* sin icono: Android Auto usa el suyo */ }
}

function carRoute() {
  const r = st.mode === 'nav' ? st.route : null;
  const json = r ? JSON.stringify({ coords: r.coords, dest: st.dest ? { lat: st.dest.lat, lon: st.dest.lon } : null, stops: st.stops.map((x) => ({ lat: x.lat, lon: x.lon })) }) : 'null';
  carIconKey = '';
  carCall('setRoute', { json });
}

function carRadars(g) { carCall('setRadars', { json: JSON.stringify(g || radarDB.geojson()) }); }

function carSettings() {
  carCall('setSettings', { json: JSON.stringify({ skin: S.skin, buildings3d: S.buildings3d, poi: S.poi, showRadars: S.showRadars, headingUp: S.headingUp, tilt: S.tilt }) });
}

function carPlaces() {
  if (!CAR) return;
  const out = [];
  const seen = new Set();
  const add = (p, name) => {
    if (!p) return;
    const k = `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ name: name || p.name, address: name ? p.address || p.name || '' : p.address || '', lat: p.lat, lon: p.lon });
  };
  add(store.get('home'), 'Casa');
  add(store.get('work'), 'Trabajo');
  favs().forEach((p) => add(p));
  recents().slice(0, 6).forEach((p) => add(p));
  carCall('setPlaces', { places: out.slice(0, 16) });
}

async function navigateNow(dest) {
  if (!st.fix) { speak('Todavía no tengo tu posición.'); toast('Esperando GPS…'); return; }
  if (st.mode === 'nav') endNav();
  closeSheet();
  st.dest = { name: dest.name, lat: dest.lat, lon: dest.lon, address: dest.address };
  st.stops = [];
  addRecent(st.dest);
  st.rerouting = true;
  carLiveNow();
  try {
    const f = st.fix;
    const routes = await getRoutes({ points: [{ lat: f.lat, lon: f.lon, heading: (f.speed || 0) > 3 ? f.heading : null }, st.dest], alternatives: false, avoidTolls: S.avoidTolls, avoidHighways: S.avoidHighways });
    routes.forEach((r) => { r.radarsList = radarsOnRoute(r, radarDB, S.radarTypes); });
    st.routes = routes; st.selRoute = 0; st.traffic = null;
    st.rerouting = false;
    startNav(false);
  } catch (e) {
    st.rerouting = false;
    st.dest = null;
    speak('No he podido calcular la ruta.');
    toast(e.final ? e.message : 'No se pudo calcular la ruta');
    carLiveNow();
  }
}

async function navigateNearest(kind) {
  const near = nearPoint();
  try {
    let list = [];
    if (kind === 'fuel' || kind === 'fuel-cheap') {
      try {
        const data = await loadFuel();
        list = nearestFuel(data, near.lat, near.lon, { fuel: S.fuelType, sort: kind === 'fuel-cheap' ? 'price' : 'dist', radius: kind === 'fuel-cheap' ? 10000 : 8000 });
        if (kind === 'fuel-cheap') list = list.filter((x) => x.price);
      } catch {
        list = await searchCategory(CATEGORIES[0], near.lat, near.lon, 6000);
      }
    } else {
      list = await searchCategory(CATEGORIES.find((c) => c.id === kind) || CATEGORIES[1], near.lat, near.lon, 3000);
    }
    const p = list[0];
    if (!p) { speak('No he encontrado nada cerca.'); return; }
    const price = p.price ? `, a ${p.price.toFixed(3).replace('.', ' con ')} euros el litro` : '';
    speak(`Vamos a ${p.name}${price}.`);
    navigateNow(p);
  } catch {
    speak('No he podido buscar ahora mismo.');
  }
}

function onCarAction(action, data) {
  switch (action) {
    case 'endNav':
      if (st.mode === 'nav') { endNav(); speak('Navegación terminada.'); }
      break;
    case 'toggleVoice':
      S.voice = !S.voice; saveSettings();
      if (!S.voice) stopSpeaking(); else speak('Voz activada.');
      $('#btnMute').innerHTML = S.voice ? ICONS.volume : ICONS.mute;
      carLiveNow();
      break;
    case 'navigate':
      if (data && isFinite(data.lat)) navigateNow(data);
      break;
    case 'nearest':
      navigateNearest(data?.kind || 'fuel');
      break;
    case 'carConnected':
      toast('Android Auto conectado');
      carSettings(); carRadars(); carPlaces(); carRoute(); carLiveNow();
      break;
    default:
      break;
  }
}

function initNative() {
  if (!NATIVE) return;
  document.body.classList.add('native');
  if (CAR) {
    Native.car.addListener('carAction', (ev) => onCarAction(ev?.action, ev?.data || {}));
    carSettings(); carRadars(); carPlaces(); carRoute();
  }
  Native.app?.addListener('backButton', () => {
    const ov = [...document.querySelectorAll('.overlay')].pop();
    if (ov) { ov.remove(); return; }
    if (skinPop) { closeSkinPop(); return; }
    if (st.mode === 'preview') { cancelPreview(); return; }
    if (st.sheetView) { closeSheet(); st.pin = null; refreshPin(); return; }
    Native.app.minimizeApp?.();
  });
  setTimeout(() => {
    checkForUpdate().then((u) => {
      if (!u) return;
      st.update = u;
      toast(`Hay una versión nueva (${u.version}). Menú → Info para descargarla.`, 7000);
    }).catch(() => {});
  }, 8000);
}

function feedbackInfo() {
  const counts = radarDB.all.length;
  return [
    `Minimapa ${BUILD.version}${NATIVE ? ' (app Android)' : ' (web)'}`,
    `Móvil: ${navigator.userAgent.replace(/.*Android/, 'Android').slice(0, 60)}`,
    `Skin: ${S.skin} · Radares: ${counts} · GPS: ${st.fix ? `±${Math.round(st.fix.acc || 0)} m` : 'sin señal'}`,
    recentErrors.length ? `Errores: ${recentErrors.join(' | ')}` : '',
  ].filter(Boolean).join('\n');
}

function openFeedback() {
  const ta = h('textarea', { class: 'code', placeholder: '¿Qué tal va? Qué funciona, qué falla, qué echas de menos…', style: { fontFamily: 'inherit', fontSize: '15px' } });
  const send = (via) => {
    const text = `${ta.value.trim() || '(sin comentario)'}\n\n— ${feedbackInfo()}`;
    if (via === 'whatsapp') {
      const a = h('a', { href: `https://wa.me/?text=${encodeURIComponent(`Opinión sobre Minimapa:\n${text}`)}`, target: '_blank', rel: 'noopener' });
      document.body.append(a); a.click(); a.remove();
    } else {
      shareText('Opinión sobre Minimapa', text).then((ok) => { if (!ok) copyText(text); });
    }
  };
  const ov = h('div', { class: 'overlay' },
    h('div', { class: 'menu-head' }, h('div', { class: 'panel-title', style: { flex: '1' } }, 'Enviar opinión'), h('button', { class: 'icon-btn', onclick: () => ov.remove(), html: ICONS.close, 'aria-label': 'Cerrar' })),
    h('p', { class: 'legal' }, 'Se añade la versión, el modelo de móvil y los últimos errores para que sea más fácil arreglar lo que falle.'),
    ta,
    h('div', { class: 'row', style: { marginTop: '10px' } },
      h('button', { class: 'btn primary', onclick: () => send('whatsapp') }, 'WhatsApp'),
      h('button', { class: 'btn', onclick: () => send('share'), html: `${ICONS.share}<span>Otra app</span>` })));
  document.body.append(ov);
  ta.focus();
}

function shareApp() {
  const link = apkLink() || location.href;
  const text = `Prueba Minimapa, el navegador con mapas tipo videojuego y avisos de radares.\n\n1) Descarga e instala: ${link}\n2) Permite instalar apps de origen desconocido si te lo pide.\n3) Para Android Auto: en Android Auto → Ajustes, toca 10 veces "Versión", luego ⋮ → Ajustes de desarrollador → marca "Fuentes desconocidas".`;
  shareText('Minimapa', text).then((ok) => { if (!ok) copyText(text); });
}

// ======================================================================
// Arranque
// ======================================================================
function buildUI() {
  $('#btnMenu').innerHTML = ICONS.menu;
  $('#btnSkin').innerHTML = ICONS.layers;
  $('#btnClearQ').innerHTML = ICONS.close;
  $('#btnCompass').innerHTML = ICONS.compass;
  $('#btnReport').innerHTML = ICONS.report;
  $('#btnLocate').innerHTML = ICONS.locate;
  $('#btnMute').innerHTML = S.voice ? ICONS.volume : ICONS.mute;
  $('#btnOverview').innerHTML = ICONS.overview;
  $('#btnEnd').innerHTML = ICONS.close;

  $('#chips').replaceChildren(...CATEGORIES.slice(0, 9).map((c) => h('button', { class: 'chip', dataset: { id: c.id }, onclick: () => runCategory(c) }, h('img', { src: blipIconURL(c.blip, SKINS[S.skin]), alt: '' }), c.label)));

  const q = $('#q');
  q.addEventListener('focus', () => { if (!q.value.trim()) showSearchHome(); });
  q.addEventListener('input', debounce(onQuery, 320));
  q.addEventListener('input', () => { $('#btnClearQ').hidden = !q.value; });
  q.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); onQuery(); }
    if (e.key === 'Escape') { q.blur(); closeSheet(); }
  });
  $('#btnClearQ').addEventListener('click', () => {
    q.value = ''; $('#btnClearQ').hidden = true; st.results = []; refreshResults(); st.pin = null; refreshPin();
    $$('#chips .chip').forEach((c) => c.classList.remove('on'));
    if (st.mode === 'preview') renderPreview(); else closeSheet();
  });
  $('#btnMenu').addEventListener('click', () => openMenu());
  $('#btnSkin').addEventListener('click', toggleSkinPop);
  $('#btnLocate').addEventListener('click', () => {
    if (!st.fix) { toast('Buscando tu posición…'); return; }
    setFollow(true);
  });
  $('#btnCompass').addEventListener('click', () => {
    S.headingUp = !S.headingUp; saveSettings();
    if (!S.headingUp) map.easeTo({ bearing: 0, duration: 400 });
    toast(S.headingUp ? 'Mapa orientado según la marcha' : 'Norte arriba');
    if (st.follow && st.fix) setFollow(true);
  });
  $('#btnReport').addEventListener('click', openReportPanel);
  $('#btnMute').addEventListener('click', () => {
    S.voice = !S.voice; saveSettings();
    if (!S.voice) stopSpeaking();
    $('#btnMute').innerHTML = S.voice ? ICONS.volume : ICONS.mute;
    toast(S.voice ? 'Voz activada' : 'Voz silenciada');
  });
  $('#btnOverview').addEventListener('click', () => {
    if (!st.route) return;
    setFollow(false);
    const ns = st.navState;
    const rest = ns ? st.route.coords.slice(ns.segIndex) : st.route.coords;
    fitRoute({ coords: rest.length > 1 ? rest : st.route.coords }, { top: 120, bottom: 120, left: 40, right: 40 });
  });
  $('#btnEnd').addEventListener('click', () => { endNav(); toast('Navegación terminada'); });
  $('.sheet-grip').addEventListener('click', () => {
    if (st.mode === 'preview') return;
    closeSheet();
  });
  map.on('click', (e) => {
    if (skinPop) { closeSkinPop(); return; }
    const hits = map.queryRenderedFeatures(e.point, { layers: ['results', 'favs', 'radars', 'route-alt', 'poi-top', 'poi-mid', 'poi-low'].filter((l) => map.getLayer(l)) });
    if (!hits.length && st.mode === 'browse' && st.sheetView && st.sheetView !== 'loading') { closeSheet(); st.pin = null; refreshPin(); }
  });
}

function start() {
  const sp = $('#splash');
  if (sp.dataset.started) return;
  sp.dataset.started = '1';
  unlockAudio();
  startCompass();
  startGps();
  requestWakeLock();
  sp.remove();
  if (!store.get('tipShown')) { store.set('tipShown', true); setTimeout(() => toast('Consejo: mantén pulsado el mapa para soltar un pin y crear una ruta.', 5000), 1500); }
}

buildUI();
initNative();
radarDB.init().catch((e) => console.warn('Radares:', e));
$('#splash').addEventListener('click', start);
$('#splash').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') start(); });

if (!NATIVE && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Ganchos para pruebas y depuración desde la consola
window.__mm = { onCarAction, carLive, navigateNow, map, st, S, radarDB, nav, watcher, processFix, previewRoute, startNav, endNav, selectPlace, toast, runCategory, openMenu, setSkin, pointAlong, angDiff };

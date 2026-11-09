// Minimapa · aplicación principal
import * as maplibregl from '../vendor/maplibre-gl.mjs';
import { CONFIG } from './config.js';
import { $, $$, h, dist, bearing, angDiff, fmtDist, fmtDur, fmtClock, debounce, store, escapeHtml, bboxOf, pointAlong, projectToSegment } from './util.js';
import { SKINS, buildStyle, LABEL_ANCHOR, BUILTIN_SKINS, EDIT_COLORS, EDIT_OPTIONS, editableFrom, registerSkin, unregisterSkin, cleanSkinDef, skinFx, playerColors } from './skins.js';
import { attachImages, alertIconURL, blipIconURL } from './blips.js';
import { ICONS, maneuverSVG, laneSVG } from './icons.js';
import { speak, sound, unlockAudio, configureVoice, spanishVoices, stopSpeaking } from './voice.js';
import { getRoutes, fetchRouteLimits, matchPosition, tomtomTraffic } from './routing.js';
import { NavEngine, RouteSimulator } from './nav.js';
import { RadarDB, RadarWatcher, RADAR_TYPES, REPORT_TYPES, radarsOnRoute } from './radars.js';
import { searchPlaces, reverse, searchCategory, CATEGORIES, placeDetails, openState, hoursText } from './search.js';
import { loadFuel, nearestFuel, FUELS, fmtPrice } from './fuel.js';
import { isNight } from './sun.js';
import { IncidentDB, ZbeDB, TrafficWatcher, INCIDENT_TYPES, STICKERS, stickerName, zbeRuleText, zoneTitle } from './traffic.js';
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
  autoSkin: false, daySkin: 'atlas', nightSkin: 'radar', vibrate: true, autoRecenter: true,
  showIncidents: true, incidentAlerts: true, showZbe: true, zbeAlerts: true, sticker: null, avoidZbe: true,
};
const S = { ...DEFAULTS, ...store.get('settings', {}) };
S.radarTypes = { ...DEFAULTS.radarTypes, ...(S.radarTypes || {}) };

// Skins creadas con el editor (o importadas de un amigo)
const customSkins = () => store.get('customSkins', []);
for (const d of customSkins()) registerSkin(d);
for (const k of ['skin', 'daySkin', 'nightSkin']) if (!SKINS[S[k]]) S[k] = DEFAULTS[k];
let previewSkinId = null; // skin que se está probando en el editor
const curSkinId = () => (previewSkinId && SKINS[previewSkinId] ? previewSkinId : S.skin);
const curSkin = () => SKINS[curSkinId()] || SKINS.radar;
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
  const sk = curSkin();
  const r = document.documentElement.style;
  r.setProperty('--accent', sk.accent);
  r.setProperty('--accent-ink', sk.accentInk);
  r.setProperty('--route', sk.route);
  r.setProperty('--map-fx', skinFx(sk));
  document.dispatchEvent(new Event('skinchange'));
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0b0d0c');
}
applySkinVars();

const map = new maplibregl.Map({
  container: 'map',
  style: buildStyle(curSkinId(), { poi: S.poi, buildings3d: S.buildings3d }),
  center: store.get('lastCenter', CONFIG.startCenter),
  zoom: store.get('lastZoom', CONFIG.startZoom),
  attributionControl: { compact: true },
  maxPitch: 70,
  fadeDuration: 120,
  dragRotate: true,
  touchPitch: true,
});
attachImages(map, curSkin);
// Efecto de pantalla de la skin (papel, líneas de monitor…) por encima del mapa
map.getContainer().insertBefore(h('div', { id: 'mapFx' }), map.getContainer().querySelector('.maplibregl-control-container'));
map.on('style.load', addOverlays);
map.on('moveend', debounce(() => {
  const c = map.getCenter();
  store.set('lastCenter', [c.lng, c.lat]);
  store.set('lastZoom', map.getZoom());
}, 1000));
for (const ev of ['dragstart', 'zoomstart', 'rotatestart', 'pitchstart']) {
  map.on(ev, (e) => {
    if (!e.originalEvent) return;
    st.lastUserMove = Date.now();
    if (st.follow) setFollow(false);
  });
}
// La atribución del mapa empieza plegada (botón "i") para no tapar el velocímetro
const foldAttribution = () => document.querySelectorAll('.maplibregl-ctrl-attrib.maplibregl-compact-show').forEach((e) => e.classList.remove('maplibregl-compact-show'));
map.on('load', foldAttribution);
map.on('style.load', () => setTimeout(foldAttribution, 50));
map.on('rotate', () => { const svg = $('#btnCompass svg'); if (svg) svg.style.transform = `rotate(${-map.getBearing()}deg)`; });

const radarDB = new RadarDB();
const incDB = new IncidentDB();
const zbeDB = new ZbeDB();
const EMPTY = { type: 'FeatureCollection', features: [] };

function setData(id, data) { map.getSource(id)?.setData(data); }

function applyPoiMode() {
  const nav = st.mode === 'nav';
  for (const id of ['poi-mid', 'poi-low']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', nav ? 'none' : 'visible');
}

function addOverlays() {
  applyPoiMode();
  const sk = curSkin();
  const before = map.getLayer(LABEL_ANCHOR) ? LABEL_ANCHOR : undefined;
  const src = (id, data) => { if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data }); };
  src('route', routeGeo());
  src('routePts', routePtsGeo());
  src('radars', radarDB.geojson());
  src('results', resultsGeo());
  src('favs', favsGeo());
  src('pin', pinGeo());
  src('incidents', incDB.geojson(S.showIncidents));
  src('zbe', zbeDB.geojson(S.showZbe, S.sticker));
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
  // Zonas de bajas emisiones: borde discontinuo (rojo si tu coche no puede entrar)
  map.addLayer({ id: 'zbe-fill', type: 'fill', source: 'zbe', minzoom: 9, paint: { 'fill-color': ['case', ['==', ['get', 'deny'], 1], '#e53935', '#43a047'], 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.1, 14, 0.04] } }, before);
  map.addLayer({ id: 'zbe-line', type: 'line', source: 'zbe', minzoom: 9, paint: { 'line-color': ['case', ['==', ['get', 'deny'], 1], '#e53935', '#43a047'], 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 1.2, 15, 2.6], 'line-dasharray': [3, 2], 'line-opacity': 0.8 } }, before);
  map.addLayer({ id: 'route-alt', type: 'line', source: 'route', filter: ['==', ['get', 'kind'], 'alt'], layout: lineLayout, paint: { 'line-color': sk.routeAlt, 'line-width': wz(4, 9), 'line-opacity': 0.9 } }, before);
  map.addLayer({ id: 'route-done', type: 'line', source: 'route', filter: ['==', ['get', 'kind'], 'done'], layout: lineLayout, paint: { 'line-color': sk.routeDone, 'line-width': wz(3, 7), 'line-opacity': 0.8 } }, before);
  map.addLayer({ id: 'route-glow', type: 'line', source: 'route', filter: ['==', ['get', 'kind'], 'main'], layout: lineLayout, paint: { 'line-color': sk.route, 'line-width': wz(12, 26), 'line-blur': 10, 'line-opacity': 0.45 } }, before);
  map.addLayer({ id: 'route-casing', type: 'line', source: 'route', filter: ['==', ['get', 'kind'], 'main'], layout: lineLayout, paint: { 'line-color': sk.routeCasing, 'line-width': wz(7, 15) } }, before);
  map.addLayer({ id: 'route-main', type: 'line', source: 'route', filter: ['==', ['get', 'kind'], 'main'], layout: lineLayout, paint: { 'line-color': sk.route, 'line-width': wz(4.5, 10) } }, before);
  map.addLayer({
    id: 'route-arrows', type: 'symbol', source: 'route', minzoom: 13, filter: ['==', ['get', 'kind'], 'main'],
    layout: { 'symbol-placement': 'line', 'symbol-spacing': 90, 'icon-image': 'route-arrow', 'icon-size': ['interpolate', ['linear'], ['zoom'], 13, 0.6, 18, 1], 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-rotation-alignment': 'map' },
  }, before);
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
    id: 'incidents', type: 'symbol', source: 'incidents', minzoom: 7,
    layout: {
      'icon-image': ['get', 'icon'], 'icon-size': ['interpolate', ['linear'], ['zoom'], 7, 0.55, 13, 0.85, 17, 1],
      'icon-allow-overlap': ['step', ['zoom'], false, 13, true], 'symbol-sort-key': ['-', 10, ['get', 'prio']],
    },
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
  parkingGeo(features);
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
incDB.onChange(() => {
  setData('incidents', incDB.geojson(S.showIncidents));
  trafficWatcher.refresh();
  carRadars();
  if (st.mode === 'preview' && st.routes.length) { annotateRoutes(st.routes); renderPreview(); }
});
zbeDB.onChange(() => { setData('zbe', zbeDB.geojson(S.showZbe, S.sticker)); trafficWatcher.refresh(); });
const refreshZbe = () => setData('zbe', zbeDB.geojson(S.showZbe, S.sticker));

// ======================================================================
// Marcador del jugador
// ======================================================================
const playerEl = h('div', { class: 'player' });
function paintPlayer() {
  const { fill, stroke } = playerColors(curSkin());
  playerEl.innerHTML = `<div class="halo"></div><svg viewBox="0 0 54 54"><path d="M27 5 43 45 27 36 11 45Z" fill="${fill}" stroke="${stroke}" stroke-width="2.6" stroke-linejoin="round"/><path d="M27 12 37.5 39 27 33Z" fill="${fill}" opacity=".78" style="mix-blend-mode:multiply"/></svg>`;
}
paintPlayer();
document.addEventListener('skinchange', paintPlayer);
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
  // Un solo seguimiento de GPS: si ya está en marcha y no hay señal, se abren los ajustes de permisos
  if (st.gpsStarted) { if (NATIVE && !st.fix) openNativeSettings(); return; }
  st.gpsStarted = true;
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
  if (!fix.dr) st.dr = null; // vuelve la señal real
  const prev = st.lastRawFix;
  if (!fix.dr && prev && fix.t > prev.t) {
    const d = dist(prev.lat, prev.lon, fix.lat, fix.lon);
    const dt = (fix.t - prev.t) / 1000;
    if ((fix.speed == null || isNaN(fix.speed)) && dt > 0) fix.speed = d / dt;
    if ((fix.heading == null || isNaN(fix.heading)) && d > 4) fix.heading = bearing(prev.lat, prev.lon, fix.lat, fix.lon);
  }
  if (fix.speed != null && fix.speed < 1.2) fix.heading = st.heading ?? fix.heading;
  if (fix.heading == null || isNaN(fix.heading)) fix.heading = st.heading;
  if (!fix.dr) {
    st.lastRawFix = fix;
    st.lastFixAt = Date.now();
    if ((fix.speed || 0) > 3) st.lastSpeed = fix.speed;
  }
  st.fix = fix;
  if (fix.heading != null && (fix.speed || 0) > 1.2) st.heading = fix.heading;
  const last = st.trail[st.trail.length - 1];
  if (!last || dist(last.lat, last.lon, fix.lat, fix.lon) > 15) { st.trail.push(fix); if (st.trail.length > 12) st.trail.shift(); }
  $('#gpsStatus').hidden = !fix.dr;
  $('#gpsStatus').classList.toggle('dr', !!fix.dr);
  if (fix.dr) $('#gpsStatus').textContent = 'TÚNEL · POSICIÓN ESTIMADA';
  playerEl.classList.toggle('stale', !!fix.dr);

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
  const walking = st.travelMode === 'pie';
  const rs = walking ? null : watcher.update(watchFix, ns);
  const ts = walking ? null : trafficWatcher.update(watchFix, ns);
  st.trafficState = ts;
  updateAlertUI(rs, ts);
  updateSpeedo(fix, ns);
  movePlayer(pos, rot);
  if (!st.everFixed) {
    st.everFixed = true;
    map.jumpTo({ center: [pos.lon, pos.lat], zoom: Math.max(map.getZoom(), 15) });
  }
  // Recentrado automático: navegando, o circulando, si dejas el mapa quieto unos segundos
  if (!st.follow && S.autoRecenter && (st.mode === 'nav' || (fix.speed || 0) > 4)
      && Date.now() - (st.lastUserMove || 0) > 12000 && !st.sheetView && !document.querySelector('.overlay')) {
    st.follow = true;
    $('#btnLocate').classList.remove('attn');
  }
  if (st.follow) followCamera(pos, rot, fix, ns);
  else $('#btnLocate').classList.add('attn');
  checkAutoSkin(fix);
  updateStreetPill();
  freeDriveExtras(fix, ns);
  carLive(fix, ns, mergeAlerts(rs, ts), pos, rot);
}

/** Un solo aviso en pantalla: radares primero, después ZBE prohibida, incidencias y el resto. */
function mergeAlerts(rs, ts) {
  if (!ts) return rs;
  let a = rs?.alert || null;
  if (!a) {
    const z = ts.zbe, i = ts.alert;
    if (z && z.ok === false) a = z;
    else if (i) a = i;
    else if (z) a = z;
  }
  return { ...(rs || {}), alert: a };
}

function freeDriveExtras(fix, ns) {
  const now = Date.now();
  if (fix.dr) return;
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
  if (!st.fix || st.sim || st.dr) return;
  const stale = Date.now() - st.lastFixAt > 12000;
  playerEl.classList.toggle('stale', stale);
  $('#gpsStatus').textContent = 'SIN GPS';
  $('#gpsStatus').classList.remove('dr');
  $('#gpsStatus').hidden = !(stale && st.mode === 'nav');
}, 2000);

// Túneles: sin señal y navegando, la posición sigue avanzando por la ruta a la última velocidad conocida
// (así los avisos de radar y las indicaciones siguen llegando a tiempo dentro del túnel)
setInterval(() => {
  if (st.mode !== 'nav' || !st.route || st.sim || !st.navState || st.travelMode === 'pie') return;
  const age = Date.now() - (st.lastFixAt || 0);
  if (age < 2500) return;
  const ns = st.navState;
  if (!st.dr) {
    if (ns.offRoute || ns.offset > 40 || (st.lastSpeed || 0) < 4 || !st.lastRawFix || (st.lastRawFix.speed || 0) < 3) return;
    st.dr = { along0: ns.along, t0: st.lastFixAt, v: Math.min(st.lastSpeed, 36) };
  }
  const travelled = (st.dr.v * (Date.now() - st.dr.t0)) / 1000;
  // Como mucho 5 km o 3 minutos: después es mejor admitir que no sabemos dónde estamos
  if (travelled > 5000 || Date.now() - st.dr.t0 > 180000) return;
  const along = Math.min(st.dr.along0 + travelled, st.route.length - 5);
  const p = pointAlong(st.route.coords, st.route.cum, along);
  const c = st.route.coords;
  const hdg = bearing(c[p.i][1], c[p.i][0], c[p.i + 1][1], c[p.i + 1][0]);
  processFix({ lat: p.lat, lon: p.lon, speed: st.dr.v, heading: hdg, acc: 25, t: Date.now(), dr: true });
}, 1000);

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
  sound: (k) => {
    sound(k);
    if (!S.vibrate || !navigator.vibrate) return;
    if (k === 'radar') navigator.vibrate([180, 90, 180]);
    else if (k === 'over') navigator.vibrate(140);
    else if (k === 'section') navigator.vibrate(90);
  },
});

const trafficWatcher = new TrafficWatcher(incDB, zbeDB, () => S, {
  speak: (t, o) => speak(t, o),
  sound: (k) => { sound(k); if (S.vibrate && navigator.vibrate && k === 'radar') navigator.vibrate([120, 80, 120]); },
});

/** Datos extra de cada ruta: incidencias de la DGT y zonas de bajas emisiones que atraviesa. */
function annotateRoutes(routes) {
  for (const r of routes) {
    r.incidents = incDB.onRoute(r);
    r.zbe = zbeDB.onRoute(r);
  }
}

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
    const points = [origin, ...st.stops, dest];
    if (Date.now() - incDB.fetchedAt > 4 * 60e3) incDB.load().catch(() => {});
    const routes = await routesAvoidingZbe(points, true);
    if (st.mode !== 'preview') return;
    routes.forEach((r) => { r.radarsList = radarsOnRoute(r, radarDB, S.radarTypes); });
    annotateRoutes(routes);
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
        ...routeBadges(r),
        traffic && traffic.delay > 60 ? h('span', { class: 'badge red' }, `+${fmtDur(traffic.delay)} tráfico`) : null,
      ),
      h('span', { class: 'via' }, r.via ? `por ${r.via}` : r.provider === 'osrm' ? 'Ruta (servidor de respaldo)' : ''),
    );
  });
  const toggle = (key, label) => h('button', { class: `toggle${S[key] ? ' on' : ''}`, onclick: () => { S[key] = !S[key]; saveSettings(); previewRoute(dest); } }, label);
  const stopsList = st.stops.length ? h('div', { class: 'list' }, ...st.stops.map((s, i) => h('div', { class: 'item' },
    h('span', { class: 'ic', html: ICONS.pin }), h('span', { class: 'tx' }, h('div', { class: 'tt' }, `Parada ${i + 1}: ${s.name}`)),
    h('button', { class: 'btn small', onclick: () => { st.stops.splice(i, 1); previewRoute(dest); } }, 'Quitar')))) : null;
  openSheet(h('div', null,
    h('h2', null, h('span', { html: ICONS.route, style: { width: '22px', height: '22px', display: 'inline-block' } }), dest.name),
    st.origin?.approx ? h('p', { class: 'empty', style: { padding: '0 0 8px' } }, 'Aún no hay GPS: la ruta sale desde el centro del mapa.') : null,
    h('div', { class: 'routes' }, ...cards),
    h('div', { class: 'toggles' }, toggle('avoidTolls', 'Sin peajes'), toggle('avoidHighways', 'Sin autopistas')),
    routeNotes(st.routes[st.selRoute]),
    stopsList,
    h('div', { class: 'row', style: { marginTop: '8px' } },
      h('button', { class: 'btn primary', onclick: () => startNav(false), html: `${ICONS.go}<span>Iniciar</span>` }),
      h('button', { class: 'btn', onclick: () => shareTrip(), html: `${ICONS.share || ''}<span>Compartir</span>` })),
    h('div', { class: 'row', style: { marginTop: '8px' } },
      h('button', { class: 'btn', onclick: () => { st.addingStop = true; $('#q').value = ''; $('#q').focus(); showSearchHome(); }, html: `${ICONS.plus}<span>Parada</span>` }),
      h('button', { class: 'btn', onclick: cancelPreview }, 'Cancelar')),
  ), 'preview');
}

function routeBadges(r) {
  const out = [];
  const inc = r.incidents || [];
  const cortes = inc.filter((x) => x.inc.type === 'corte').length;
  const graves = inc.filter((x) => ['accidente', 'retencion'].includes(x.inc.type)).length;
  if (cortes) out.push(h('span', { class: 'badge red' }, `${cortes} corte${cortes > 1 ? 's' : ''}`));
  if (graves) out.push(h('span', { class: 'badge red' }, `${graves} incidencia${graves > 1 ? 's' : ''}`));
  const obras = inc.length - cortes - graves;
  if (obras > 0) out.push(h('span', { class: 'badge gold' }, `${obras} aviso${obras > 1 ? 's' : ''} DGT`));
  for (const z of (r.zbe || []).slice(0, 2)) {
    const ok = zbeDB.allowed(z.zone, S.sticker);
    out.push(h('span', { class: `badge ${ok === false ? 'red' : 'green'}` }, `ZBE ${z.zone.name}`));
  }
  if (r.avoidedZbe?.length) out.push(h('span', { class: 'badge green' }, 'Rodea ZBE'));
  return out;
}

function routeNotes(r) {
  if (!r) return null;
  const items = [];
  for (const z of r.zbe || []) {
    const ok = zbeDB.allowed(z.zone, S.sticker);
    items.push(h('div', { class: `note ${ok === false ? 'bad' : ''}` },
      h('img', { src: alertIconURL(ok === false ? 'zbe-no' : 'zbe'), alt: '' }),
      h('span', null, h('b', null, `Zona de bajas emisiones: ${zoneTitle(z.zone)}`), h('small', null, `${z.startsInside ? 'Sales desde dentro' : `A ${fmtDist(z.along)}`} · ${zbeRuleText(z.zone, S.sticker, zbeDB)}${!hasSticker() ? ' · Indica la etiqueta de tu coche en Menú → Rutas' : ''}`))));
  }
  if (r.zbeAvoidFailed) items.push(h('div', { class: 'note bad' }, h('span', null, h('b', null, 'No se pudo calcular un rodeo de la ZBE'), h('small', null, 'Esta ruta la atraviesa.'))));
  for (const it of (r.incidents || []).slice(0, 5)) {
    const i = it.inc;
    items.push(h('div', { class: `note ${['corte', 'accidente'].includes(i.type) ? 'bad' : ''}` },
      h('img', { src: alertIconURL(INCIDENT_TYPES[i.type].icon), alt: '' }),
      h('span', null, h('b', null, `${i.label}${i.road ? ` · ${i.road}${i.km != null ? ` km ${i.km}` : ''}` : ''}`), h('small', null, [`A ${fmtDist(it.along)}`, i.text].filter(Boolean).join(' · ')))));
  }
  if ((r.incidents || []).length > 5) items.push(h('div', { class: 'note' }, h('span', null, h('small', null, `Y ${r.incidents.length - 5} avisos más de la DGT en la ruta`))));
  return items.length ? h('div', { class: 'notes' }, ...items) : null;
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
  trafficWatcher.setRoute(route);
  refreshRoutes();
  carRoute();
  ['#navTop', '#navBottom', '#speedo'].forEach((s) => { $(s).hidden = false; });
  updateTrafficLabel();
  setFollow(true);
  const first = route.maneuvers[0];
  if (first) speak(first.pre || first.text, { priority: 'high' });
  if (st.travelMode !== 'pie') loadLimits(route);
  document.body.classList.toggle('walking', st.travelMode === 'pie');
  requestWakeLock();
  if (simulate) {
    st.sim = new RouteSimulator(route, { speedMode: st.simSpeed, onFix: (f) => processFix(f) });
    st.sim.start();
  } else if (st.fix) {
    processFix({ ...st.fix, t: Date.now() });
  }
}

function loadLimits(route) {
  fetchRouteLimits(route, (partial) => { route.limits = partial.slice(); }).then((l) => { if (l.length) route.limits = l; }).catch(() => {});
}

/** Zonas de bajas emisiones prohibidas para tu coche que conviene rodear (no las de origen, destino o paradas). */
function zbeToAvoid(points) {
  if (!S.avoidZbe || !hasSticker() || !zbeDB.zones.length) return [];
  return zbeDB.zones.filter((z) => zbeDB.allowed(z, S.sticker) === false && !points.some((p) => zbeDB.zonesAt(p.lat, p.lon).includes(z)));
}

// El servidor de rutas solo admite zonas a evitar de hasta 10 km de perímetro en total
const EXCLUDE_MAX = 9800;
const ringLength = (ring) => ring.reduce((sum, p, i) => (i ? sum + dist(ring[i - 1][1], ring[i - 1][0], p[1], p[0]) : 0), 0);
function squareAround(lat, lon, half) {
  const dLat = half / 111320, dLon = half / (111320 * Math.cos((lat * Math.PI) / 180));
  return [[lon - dLon, lat - dLat], [lon + dLon, lat - dLat], [lon + dLon, lat + dLat], [lon - dLon, lat + dLat], [lon - dLon, lat - dLat]];
}

/**
 * Rutas que rodean las ZBE prohibidas para tu coche. Las zonas pequeñas se excluyen enteras;
 * en las grandes se van cerrando, una a una, las entradas que usa la ruta (como haría un conductor).
 */
async function routesAvoidingZbe(points, alternatives, maxTries = 6) {
  const opts = { points, alternatives, avoidTolls: S.avoidTolls, avoidHighways: S.avoidHighways };
  const [w, s, e, n] = bboxOf(points.map((p) => [p.lon, p.lat]), 0.3);
  const avoid = zbeToAvoid(points).filter((z) => !(z.bbox[0] > e || z.bbox[2] < w || z.bbox[1] > n || z.bbox[3] < s));
  if (!avoid.length) return getRoutes(opts);
  const polys = [];
  let used = 0;
  for (const z of avoid) {
    const per = z.parts.reduce((sum, p) => sum + ringLength(p), 0);
    if (used + per <= EXCLUDE_MAX * 0.6) { polys.push(...z.parts); used += per; }
  }
  let last = null;
  for (let i = 0; i < maxTries; i++) {
    let routes;
    try {
      routes = await getRoutes({ ...opts, excludePolygons: polys.length ? polys : undefined });
    } catch (err) {
      console.warn('Sin ruta rodeando la ZBE:', err?.message || err);
      break;
    }
    last = routes;
    const crossing = zbeDB.onRoute(routes[0]).filter((x) => avoid.includes(x.zone) && !x.startsInside);
    if (!crossing.length) {
      if (polys.length) routes.forEach((r) => { r.avoidedZbe = avoid.map((z) => z.name); });
      return routes;
    }
    // Cerrar la entrada: un cuadrado pequeño justo dentro de la zona, sobre la calle que usa la ruta
    const r0 = routes[0];
    const p = pointAlong(r0.coords, r0.cum, Math.min(r0.length, crossing[0].along + 40));
    const sq = squareAround(p.lat, p.lon, 45);
    if (used + ringLength(sq) > EXCLUDE_MAX) break;
    polys.push(sq); used += ringLength(sq);
  }
  const routes = last || await getRoutes(opts);
  routes.forEach((r) => { r.zbeAvoidFailed = true; });
  return routes;
}

async function reroute(fix) {
  if (st.rerouting || !st.dest) return;
  st.rerouting = true;
  carLiveNow();
  sound('reroute');
  speak('Recalculando.');
  toast('Recalculando ruta…');
  try {
    const pts = [{ lat: fix.lat, lon: fix.lon, heading: (fix.speed || 0) > 2 ? fix.heading : null }, ...st.stops, st.dest];
    const routes = st.travelMode === 'pie' ? await getRoutes({ points: pts, alternatives: false, costing: 'pedestrian' }) : await routesAvoidingZbe(pts, false, 3);
    if (st.mode !== 'nav') return;
    const r = routes[0];
    st.route = r; st.routes = [r];
    nav.setRoute(r, { keepProgress: true });
    watcher.setRoute(r);
    trafficWatcher.setRoute(r);
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
  const destName = st.dest?.name || '';
  showMission('Destino alcanzado', destName);
  setTimeout(() => {
    if (st.mode !== 'nav') return;
    const walking = st.travelMode === 'pie';
    endNav();
    if (!walking) offerParking(destName);
  }, 5000);
}

// ======================================================================
// Aparcamiento
// ======================================================================
const parking = () => store.get('parking', null);
function parkingGeo(features) {
  const pk = parking();
  if (pk) features.push({ type: 'Feature', properties: { kind: 'parked', name: 'Tu coche', id: 'parked' }, geometry: { type: 'Point', coordinates: [pk.lon, pk.lat] } });
}
function saveParking(note = '') {
  const pos = st.fix || nearPoint();
  if (!pos) { toast('Aún no tengo tu posición'); return; }
  store.set('parking', { lat: pos.lat, lon: pos.lon, t: Date.now(), note });
  refreshFavs();
  toast('Aparcamiento guardado');
  reverse(pos.lat, pos.lon).then((r) => { const pk = parking(); if (pk && r?.name) { pk.address = r.name; store.set('parking', pk); } }).catch(() => {});
}
function offerParking(destName) {
  openSheet(h('div', null,
    h('h2', null, 'Has llegado'),
    h('p', { class: 'legal' }, `${destName ? `${destName}. ` : ''}¿Guardo dónde has aparcado para volver luego al coche?`),
    h('div', { class: 'row' },
      h('button', { class: 'btn primary', onclick: () => { saveParking(); closeSheet(); }, html: `${ICONS.car}<span>Guardar aparcamiento</span>` }),
      h('button', { class: 'btn', onclick: closeSheet }, 'No'))), 'arrived');
}
function showParking() {
  const pk = parking();
  if (!pk) return;
  const d = st.fix ? dist(st.fix.lat, st.fix.lon, pk.lat, pk.lon) : null;
  const ago = Math.round((Date.now() - pk.t) / 60000);
  const agoTxt = ago < 60 ? `hace ${Math.max(1, ago)} min` : ago < 1440 ? `hace ${Math.round(ago / 60)} h` : `el ${new Date(pk.t).toLocaleDateString('es-ES')}`;
  const note = h('input', { class: 'field', type: 'text', maxlength: '80', placeholder: 'Nota: planta, plaza, calle…', value: pk.note || '' });
  note.addEventListener('change', () => { const x = parking(); if (x) { x.note = note.value.trim(); store.set('parking', x); } });
  st.pin = null; refreshPin();
  map.easeTo({ center: [pk.lon, pk.lat], zoom: Math.max(map.getZoom(), 16), duration: 600 });
  setFollow(false);
  openSheet(h('div', null,
    h('div', { class: 'place-head' },
      h('img', { src: blipIconURL('parked', curSkin()), alt: '', style: { width: '40px', height: '40px' } }),
      h('div', { class: 'tx' },
        h('div', { class: 'place-name' }, 'Tu coche'),
        h('div', { class: 'place-addr' }, pk.address || `${pk.lat.toFixed(5)}, ${pk.lon.toFixed(5)}`),
        h('div', { class: 'place-meta' }, [`Aparcado ${agoTxt}`, d != null ? `a ${fmtDist(d)}` : null].filter(Boolean).join(' · '))),
      h('button', { class: 'icon-btn', onclick: closeSheet, html: ICONS.close, 'aria-label': 'Cerrar' })),
    note,
    h('div', { class: 'row', style: { marginTop: '10px' } },
      h('button', { class: 'btn primary', onclick: () => walkTo({ name: 'Tu coche', lat: pk.lat, lon: pk.lon }), html: `${ICONS.walk}<span>Ir a pie</span>` }),
      h('button', { class: 'btn', onclick: () => { store.del('parking'); refreshFavs(); closeSheet(); toast('Aparcamiento borrado'); }, html: `${ICONS.trash}<span>Olvidar</span>` })),
  ), 'parking');
}

/** Ruta a pie (para volver al coche). Sin radares ni límites. */
async function walkTo(dest) {
  if (!st.fix) { toast('Esperando GPS…'); return; }
  closeSheet();
  openSheet(h('div', null, h('h2', null, 'Calculando ruta a pie…'), h('div', { class: 'spinner' })), 'loading');
  try {
    const routes = await getRoutes({ points: [{ lat: st.fix.lat, lon: st.fix.lon }, dest], alternatives: false, costing: 'pedestrian' });
    st.dest = dest; st.stops = []; st.routes = routes; st.selRoute = 0; st.travelMode = 'pie';
    startNav(false);
  } catch {
    openSheet(h('div', null, h('h2', null, 'Sin ruta a pie'), h('p', { class: 'empty' }, 'No se pudo calcular. Revisa la conexión.')), 'error');
  }
}

// ======================================================================
// Compartir la llegada y buscar en la ruta
// ======================================================================
function shareTrip() {
  const dest = st.dest;
  if (!dest) return;
  let secs, dist0;
  if (st.mode === 'nav' && st.navState) { secs = st.navState.remainingTime; dist0 = st.navState.remaining; }
  else { const r = st.routes[st.selRoute]; secs = r?.duration; dist0 = r?.length; }
  const eta = secs ? fmtClock(new Date(Date.now() + secs * 1000)) : null;
  const link = `https://www.google.com/maps/search/?api=1&query=${dest.lat.toFixed(6)},${dest.lon.toFixed(6)}`;
  const txt = `Voy de camino a ${dest.name}${eta ? `. Llegaré sobre las ${eta} (${fmtDur(secs)}, ${fmtDist(dist0)})` : ''}.`;
  shareText('Mi llegada', `${txt}\n${link}`).then((ok) => { if (!ok) copyText(`${txt} ${link}`); });
}

function openRouteMenu() {
  const cats = [
    { id: 'fuel', label: 'Gasolinera', blip: 'fuel' },
    ...['parking', 'food', 'cafe', 'charge', 'car'].map((id) => CATEGORIES.find((c) => c.id === id)).filter(Boolean),
  ];
  openSheet(h('div', null,
    h('h2', null, 'En ruta'),
    h('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } },
      ...cats.map((c) => h('button', { class: 'chip', onclick: () => searchAlongRoute(c) }, h('img', { src: blipIconURL(c.blip, curSkin()), alt: '' }), c.label))),
    h('div', { class: 'row', style: { marginTop: '12px' } },
      h('button', { class: 'btn', onclick: () => { closeSheet(); shareTrip(); }, html: `${ICONS.share}<span>Compartir llegada</span>` }),
      h('button', { class: 'btn', onclick: () => showSteps(), html: `${ICONS.route}<span>Indicaciones</span>` })),
  ), 'routemenu');
}

/** Lista de indicaciones que quedan. */
function showSteps() {
  const r = st.route, ns = st.navState;
  if (!r) return;
  const from = ns ? ns.nextIndex : 0;
  const items = r.maneuvers.slice(from).map((m, k) => {
    const at = r.cum[m.begin] - (ns ? ns.along : 0);
    return h('div', { class: 'item' }, h('span', { class: 'ic', html: maneuverSVG(m.kind, m.exit) }),
      h('span', { class: 'tx' }, h('div', { class: 'tt' }, m.text), m.sign ? h('div', { class: 'sub' }, m.sign) : null),
      h('span', { class: 'rt' }, k === 0 && ns ? fmtDist(ns.distNext) : fmtDist(Math.max(0, at))));
  });
  openSheet(h('div', null, h('h2', null, 'Indicaciones'), h('div', { class: 'list steps' }, ...items)), 'steps');
}

/** Lugares a lo largo de la ruta que queda (los primeros ~40 km), ordenados por cuándo te los encuentras. */
async function searchAlongRoute(cat) {
  const r = st.route, ns = st.navState;
  if (!r) return;
  const from = ns ? ns.along : 0;
  const to = Math.min(r.length, from + 40000);
  openSheet(h('div', null, h('h2', null, `${cat.label} en la ruta`), h('div', { class: 'spinner' })), 'along');
  const pts = [];
  for (let a = from; a <= to; a += 700) { const p = pointAlong(r.coords, r.cum, a); pts.push([p.lat, p.lon]); }
  let list = [];
  try {
    if (cat.id === 'fuel') {
      const data = await loadFuel();
      const [w, s, e, n] = bboxOf(pts.map(([la, lo]) => [lo, la]), 0.01);
      list = nearestFuel(data, (s + n) / 2, (w + e) / 2, { fuel: S.fuelType, radius: Math.max(dist(s, w, n, e) / 2 + 1500, 3000), limit: 2000 });
    } else {
      list = await searchCategory(CATEGORIES.find((c) => c.id === cat.id), 0, 0, 600, pts.slice(0, 70));
    }
  } catch {
    openSheet(h('div', null, h('h2', null, `${cat.label} en la ruta`), h('p', { class: 'empty' }, 'No se pudo buscar ahora mismo. Inténtalo en un momento.')), 'along');
    return;
  }
  // Posición de cada sitio sobre la ruta y cuánto hay que desviarse
  const near = [];
  for (const p of list) {
    let best = null;
    for (let i = 0; i < r.coords.length - 1; i++) {
      if (r.cum[i + 1] < from || r.cum[i] > to) continue;
      const c0 = r.coords[i], c1 = r.coords[i + 1];
      if (Math.abs(p.lat - c0[1]) > 0.02 || Math.abs(p.lon - c0[0]) > 0.03) continue;
      const q = projectToSegment(p.lat, p.lon, c0[1], c0[0], c1[1], c1[0]);
      if (!best || q.d < best.d) best = { d: q.d, along: r.cum[i] + q.t * (r.cum[i + 1] - r.cum[i]) };
    }
    if (best && best.d < 700 && best.along > from) near.push({ ...p, ahead: best.along - from, detour: best.d * 2.2 });
  }
  near.sort((a, b) => a.ahead - b.ahead);
  const cheap = cat.id === 'fuel' ? near.filter((x) => x.price).reduce((m, x) => (m && m.price <= x.price ? m : x), null) : null;
  openSheet(h('div', null,
    h('h2', null, `${cat.label} en la ruta`),
    near.length ? h('div', { class: 'list' }, ...near.slice(0, 25).map((p) => h('button', { class: 'item', onclick: () => addStopDuringNav(p) },
      h('span', { class: 'ic' }, h('img', { src: blipIconURL(p.blip || cat.blip, curSkin()), alt: '' })),
      h('span', { class: 'tx' }, h('div', { class: 'tt' }, p.name, p === cheap ? h('span', { class: 'badge green', style: { marginLeft: '6px' } }, 'La más barata') : null),
        h('div', { class: 'sub' }, [`A ${fmtDist(p.ahead)}`, p.detour > 150 ? `desvío ${fmtDist(p.detour)}` : 'en la ruta', p.hours && openState(p.hours) ? openState(p.hours).text.split(' · ')[0] : null].filter(Boolean).join(' · '))),
      p.price ? h('span', { class: 'rt price' }, fmtPrice(p.price)) : null)))
      : h('p', { class: 'empty' }, 'No hay nada de esto cerca de la ruta en los próximos 40 km.'),
  ), 'along');
}

async function addStopDuringNav(p) {
  if (st.mode !== 'nav' || !st.fix) return;
  st.stops.unshift({ name: p.name, lat: p.lat, lon: p.lon });
  closeSheet();
  toast(`Parada añadida: ${p.name}`);
  speak(`Vamos primero a ${p.name}.`);
  setData('routePts', routePtsGeo());
  await reroute(st.fix);
}

function endNav() {
  st.sim?.stop(); st.sim = null;
  st.mode = 'browse'; st.route = null; st.routes = []; st.stops = []; st.dest = null; st.navState = null; st.traffic = null; st.travelMode = null; st.dr = null;
  nav.route = null;
  watcher.setRoute(null);
  trafficWatcher.setRoute(null);
  applyPoiMode();
  document.body.classList.remove('nav', 'preview', 'walking');
  ['#navTop', '#navBottom', '#navThen', '#alertCard', '#sectionCard', '#gpsStatus', '#laneBar'].forEach((s) => { $(s).hidden = true; });
  document.body.classList.remove('has-lanes');
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
    // Carriles: cuando la maniobra está cerca (más margen en vías rápidas)
    const lanesOn = !!(m.lanes && ns.distNext < ((st.fix?.speed || 0) > 20 ? 1800 : 700) && m.lanes.some((l) => l.a || l.v));
    const lb = $('#laneBar');
    if (lanesOn) {
      const key = `${ns.nextIndex}`;
      if (lb.dataset.k !== key) { lb.dataset.k = key; lb.innerHTML = laneSVG(m.lanes); }
    }
    lb.hidden = !lanesOn;
    document.body.classList.toggle('has-lanes', lanesOn);
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
function updateAlertUI(rs, ts) {
  const card = $('#alertCard');
  const a = mergeAlerts(rs, ts)?.alert;
  if (a) {
    const id = a.id || (a.radar || a.report).id;
    if (id !== lastAlertId) {
      lastAlertId = id;
      card.querySelector('img').src = alertIconURL(a.type.icon);
      card.querySelector('.a-type').textContent = a.type.label;
      const sub = card.querySelector('.a-sub');
      sub.textContent = a.sub || '';
      sub.hidden = !a.sub;
    }
    card.hidden = false;
    card.classList.toggle('report', a.kind === 'report');
    card.classList.toggle('incident', a.kind === 'incident');
    card.classList.toggle('zbe', a.kind === 'zbe');
    card.classList.toggle('zbe-no', a.kind === 'zbe' && a.ok === false);
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
  const icon = p.blip ? h('img', { src: blipIconURL(p.blip, curSkin()), alt: '' }) : h('span', { html: ICONS.pin });
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
  const cats = h('div', { class: 'row', style: { gap: '6px' } }, ...CATEGORIES.map((c) => h('button', { class: 'chip', onclick: () => runCategory(c) }, h('img', { src: blipIconURL(c.blip, curSkin()), alt: '' }), c.label)));
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
  const os = p.hours && !p.prices ? openState(p.hours) : null;
  const details = [];
  if (os) details.push(h('div', { class: `detail ${os.open ? 'open' : 'closed'}` }, h('b', null, os.text), h('small', null, hoursText(p.hours))));
  else if (p.hours) details.push(h('div', { class: 'detail' }, h('small', null, p.prices ? `Horario: ${p.hours}` : hoursText(p.hours))));
  const links = [];
  if (p.phone) links.push(h('a', { class: 'btn small', href: `tel:${p.phone.split(';')[0].replace(/[^\d+]/g, '')}`, html: `${ICONS.phone}<span>Llamar</span>` }));
  if (p.web) links.push(h('a', { class: 'btn small', href: /^https?:/.test(p.web) ? p.web : `https://${p.web}`, target: '_blank', rel: 'noopener', html: `${ICONS.web}<span>Web</span>` }));
  // Detalles de OpenStreetMap (horario, teléfono, web) si aún no los tenemos
  if (!p.detailsLoaded && /^(N|W|R|node|way|relation)\d+$/.test(p.id || '')) {
    p.detailsLoaded = true;
    placeDetails(p).then((x) => {
      if (!x || (!x.hours && !x.phone && !x.web)) return;
      Object.assign(p, { hours: p.hours || x.hours, phone: p.phone || x.phone, web: p.web || x.web });
      if (st.sheetView === 'place' && st.pin && Math.abs(st.pin.lat - p.lat) < 1e-6) renderPlace(p);
    }).catch(() => {});
  }
  openSheet(h('div', null,
    h('div', { class: 'place-head' },
      h('div', { class: 'tx' },
        h('div', { class: 'place-name' }, p.name),
        p.address ? h('div', { class: 'place-addr' }, p.address) : null,
        h('div', { class: 'place-meta' }, [d != null ? `A ${fmtDist(d)}` : null].filter(Boolean).join(' · ')),
      ),
      h('button', { class: 'icon-btn', onclick: () => { closeSheet(); st.pin = null; refreshPin(); }, html: ICONS.close, 'aria-label': 'Cerrar' })),
    prices,
    ...details,
    links.length ? h('div', { class: 'row', style: { marginTop: '8px' } }, ...links) : null,
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
  if (f.kind === 'parked') { showParking(); return; }
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
map.on('click', 'incidents', (e) => {
  const i = incDB.byId(e.features[0].properties.id);
  if (i) showIncident(i);
});
map.on('click', 'zbe-fill', (e) => {
  if (map.queryRenderedFeatures(e.point, { layers: ['results', 'favs', 'radars', 'incidents', 'poi-top', 'poi-mid', 'poi-low'].filter((l) => map.getLayer(l)) }).length) return;
  if (st.mode !== 'browse' || map.getZoom() > 15.5) return;
  const z = zbeDB.zones.find((x) => x.id === e.features[0].properties.id);
  if (z) showZbe(z);
});

function showIncident(i) {
  const since = i.start ? Math.round((Date.now() - i.start) / 60000) : null;
  const sinceTxt = since == null ? '' : since < 90 ? `Desde hace ${Math.max(1, since)} min` : since < 48 * 60 ? `Desde hace ${Math.round(since / 60)} h` : `Desde el ${new Date(i.start).toLocaleDateString('es-ES')}`;
  openSheet(h('div', null,
    h('div', { class: 'place-head' },
      h('img', { src: alertIconURL(INCIDENT_TYPES[i.type].icon), alt: '', style: { width: '44px', height: '44px' } }),
      h('div', { class: 'tx' },
        h('div', { class: 'place-name' }, i.label),
        h('div', { class: 'place-addr' }, [i.road && `${i.road}${i.km != null ? ` km ${i.km}` : ''}`, i.town].filter(Boolean).join(' · ')),
        h('div', { class: 'place-meta' }, [i.text, sinceTxt, i.end ? `Hasta el ${new Date(i.end).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : '', 'DGT'].filter(Boolean).join(' · '))),
      h('button', { class: 'icon-btn', onclick: closeSheet, html: ICONS.close, 'aria-label': 'Cerrar' })),
  ), 'incident');
}

function showZbe(z) {
  const ok = zbeDB.allowed(z, S.sticker);
  openSheet(h('div', null,
    h('div', { class: 'place-head' },
      h('img', { src: alertIconURL(ok === false ? 'zbe-no' : 'zbe'), alt: '', style: { width: '44px', height: '44px' } }),
      h('div', { class: 'tx' },
        h('div', { class: 'place-name' }, `ZBE ${zoneTitle(z)}`),
        h('div', { class: 'place-addr' }, 'Zona de bajas emisiones'),
        h('div', { class: 'place-meta' }, [zbeRuleText(z, S.sticker, zbeDB), z.h24 === false ? 'Con horario' : 'Todos los días', 'DGT'].join(' · '))),
      h('button', { class: 'icon-btn', onclick: closeSheet, html: ICONS.close, 'aria-label': 'Cerrar' })),
    z.desc ? h('p', { class: 'legal' }, z.desc) : null,
    !hasSticker() ? h('p', { class: 'legal' }, 'Indica la etiqueta ambiental de tu coche en Menú → Rutas y te diré si puedes entrar y cómo rodearla.') : null,
    z.url ? h('div', { class: 'row' }, h('a', { class: 'btn small', href: z.url, target: '_blank', rel: 'noopener' }, 'Normativa del ayuntamiento')) : null,
  ), 'zbe');
}

for (const id of ['poi-top', 'poi-mid', 'poi-low']) {
  map.on('click', id, (e) => {
    const f = e.features[0];
    const [lon, lat] = f.geometry.coordinates;
    const name = f.properties['name:es'] || f.properties.name || 'Lugar';
    selectPlace({ id: `poi${f.id || ''}`, name, address: f.properties.subclass ? f.properties.subclass.replace(/_/g, ' ') : '', lat, lon });
  });
}
for (const id of ['results', 'favs', 'radars', 'incidents', 'route-alt', 'poi-top', 'poi-mid', 'poi-low']) {
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
const hasSticker = () => S.sticker != null && S.sticker !== '';
function stickerSelect(after) {
  return h('div', { class: 'opt' },
    h('div', { class: 'ol' }, h('div', { class: 'ot' }, 'Etiqueta ambiental de tu coche'), h('div', { class: 'od' }, 'La de la DGT (pegatina del parabrisas). Sirve para avisarte de las zonas de bajas emisiones donde no puedes entrar.')),
    h('select', { class: 'sel', onchange: (e) => { S.sticker = e.target.value || null; saveSettings(); refreshZbe(); after?.(); } },
      h('option', { value: '', selected: !hasSticker() }, 'No lo sé'),
      ...STICKERS.map(([v, l]) => h('option', { value: v, selected: String(S.sticker) === v }, l))));
}

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
    h('div', { class: 'sn' }, sk.name, sk.custom ? h('span', { class: 'tag-own' }, 'Tuya') : null), h('div', { class: 'sd' }, sk.desc))));
}

function setSkin(id) {
  S.skin = id; saveSettings(); applySkinVars();
  reloadStyle();
}

/** Elegir skin a mano: con el cambio automático activo, se guarda para el periodo actual (día o noche). */
function pickSkin(id) {
  if (S.autoSkin) {
    const p = st.fix || nearPoint();
    if (isNight(p.lat, p.lon)) S.nightSkin = id; else S.daySkin = id;
  }
  setSkin(id);
}

let lastSkinCheck = 0;
function checkAutoSkin(fix) {
  if (!S.autoSkin) return;
  const now = Date.now();
  if (now - lastSkinCheck < 120000) return;
  lastSkinCheck = now;
  const p = fix || st.fix || nearPoint();
  const want = isNight(p.lat, p.lon) ? S.nightSkin : S.daySkin;
  if (SKINS[want] && want !== S.skin) setSkin(want);
}
function reloadStyle() {
  map.setStyle(buildStyle(curSkinId(), { poi: S.poi, buildings3d: S.buildings3d }), { diff: false });
}

// ======================================================================
// Editor de skins
// ======================================================================
const skinDefOf = (id) => customSkins().find((d) => d.id === id) || null;
function draftFrom(sk, extra = {}) {
  const e = editableFrom(sk);
  const colors = Object.fromEntries(EDIT_COLORS.map(([k]) => [k, e[k]]));
  const opts = Object.fromEntries(Object.entries(e).filter(([k]) => !colors[k] && !EDIT_COLORS.some(([c]) => c === k)));
  return { base: sk.custom ? sk.base : sk.id, colors, opts, ...extra };
}
function saveCustomSkin(def) {
  const list = customSkins().filter((d) => d.id !== def.id);
  list.push(def);
  store.set('customSkins', list);
  registerSkin(def);
}
function skinCode(def) {
  return JSON.stringify({ minimapaSkin: 1, id: def.id, name: def.name, base: def.base, colors: def.colors, opts: def.opts });
}
async function shareSkin(def) {
  const text = `Skin «${def.name}» para MiniMapa. Copia todo este mensaje y pégalo en Menú → Mapa → Importar skin:\n\n${skinCode(def)}`;
  if (await shareText(`Skin ${def.name}`, text)) return;
  try { await navigator.clipboard.writeText(text); toast('Código copiado: pégaselo a tu amigo'); }
  catch { openSkinImport(skinCode(def), true); }
}

function openSkinEditor(def) {
  closeSkinPop(); $('#menu')?.remove(); closeSkinEditor(false);
  const isNew = !def;
  const original = def ? JSON.parse(JSON.stringify(def)) : null;
  const d = def ? JSON.parse(JSON.stringify(def)) : draftFrom(curSkin(), { id: `custom-${Date.now().toString(36)}`, name: 'Mi skin' });
  d.opts = { ...draftFrom(SKINS[d.base] || SKINS.radar).opts, ...d.opts };
  const preview = debounce(() => {
    registerSkin(d); previewSkinId = d.id; applySkinVars(); reloadStyle();
  }, 380);
  const lsw = (key, label) => {
    const el = h('button', { class: `switch${d.opts[key] ? ' on' : ''}`, role: 'switch', 'aria-checked': String(!!d.opts[key]), 'aria-label': label });
    return h('div', { class: 'opt', onclick: () => { d.opts[key] = !d.opts[key]; el.classList.toggle('on', d.opts[key]); el.setAttribute('aria-checked', String(d.opts[key])); preview(); } },
      h('div', { class: 'ol' }, h('div', { class: 'ot' }, label)), el);
  };
  const lsel = (key, label) => h('div', { class: 'opt' }, h('div', { class: 'ol' }, h('div', { class: 'ot' }, label)),
    h('select', { class: 'sel', onchange: (e) => { d.opts[key] = e.target.value; preview(); } }, ...EDIT_OPTIONS[key].map(([v, l]) => h('option', { value: v, selected: d.opts[key] === v }, l))));
  const colorGrid = h('div', { class: 'color-grid' });
  const paintColors = () => colorGrid.replaceChildren(...EDIT_COLORS.map(([k, l]) => h('label', { class: 'color-cell' },
    h('input', { type: 'color', value: d.colors[k], oninput: (e) => { d.colors[k] = e.target.value; preview(); } }), h('span', null, l))));
  paintColors();
  const lineOn = h('button', { class: `switch${d.opts.centerLine ? ' on' : ''}`, role: 'switch', 'aria-label': 'Línea central' });
  const lineColor = h('input', { type: 'color', value: d.opts.centerLine || '#f2d21b', oninput: (e) => { d.opts.centerLine = e.target.value; lineOn.classList.add('on'); preview(); } });
  const width = h('input', { type: 'range', min: '0.5', max: '1.6', step: '0.05', value: String(d.opts.roadWidthMult || 1), oninput: (e) => { d.opts.roadWidthMult = Number(e.target.value); preview(); } });
  const opts = h('div', null);
  const paintOpts = () => opts.replaceChildren(
    lsw('glow', 'Brillo de neón en las vías'),
    lsw('casingOff', 'Calles sin borde (trazo fino)'),
    lsw('labelItalic', 'Rótulos en cursiva'),
    lsw('uppercaseDistricts', 'Barrios en mayúsculas'),
    lsw('shields', 'Placas con el número de carretera'),
    h('div', { class: 'opt' }, h('div', { class: 'ol' }, h('div', { class: 'ot' }, 'Línea central en carreteras')), lineColor,
      (lineOn.onclick = () => { d.opts.centerLine = d.opts.centerLine ? '' : lineColor.value; lineOn.classList.toggle('on', !!d.opts.centerLine); preview(); }, lineOn)),
    h('div', { class: 'opt' }, h('div', { class: 'ol' }, h('div', { class: 'ot' }, 'Grosor de las calles')), width),
    lsel('blipShape', 'Iconos de lugares'),
    lsel('buildingMode', 'Edificios'),
    lsel('fx', 'Efecto de pantalla'),
  );
  paintOpts();
  const name = h('input', { class: 'field', type: 'text', maxlength: '28', value: d.name, placeholder: 'Nombre de la skin', oninput: (e) => { d.name = e.target.value; } });
  const baseSel = h('select', { class: 'sel', onchange: (e) => {
    const nd = draftFrom(SKINS[e.target.value]);
    d.base = nd.base; d.colors = nd.colors; d.opts = nd.opts;
    paintColors(); lineColor.value = d.opts.centerLine || '#f2d21b'; lineOn.classList.toggle('on', !!d.opts.centerLine); width.value = String(d.opts.roadWidthMult || 1); paintOpts(); preview();
  } }, ...BUILTIN_SKINS.map((id) => h('option', { value: id, selected: id === d.base }, SKINS[id].name)));
  let delArmed = false;
  const delBtn = isNew ? null : h('button', { class: 'btn danger small', html: `${ICONS.trash}<span>Borrar</span>`, onclick: (e) => {
    if (!delArmed) { delArmed = true; e.currentTarget.querySelector('span').textContent = '¿Seguro?'; return; }
    store.set('customSkins', customSkins().filter((x) => x.id !== d.id));
    unregisterSkin(d.id); previewSkinId = null;
    for (const k of ['skin', 'daySkin', 'nightSkin']) if (S[k] === d.id) S[k] = DEFAULTS[k];
    closeSkinEditor(false); setSkin(S.skin); toast('Skin borrada');
  } });
  const panel = h('section', { id: 'skinEditor' },
    h('div', { class: 'se-head' }, h('div', { class: 'panel-title' }, isNew ? 'Nueva skin' : 'Editar skin'),
      h('button', { class: 'icon-btn', 'aria-label': 'Cancelar', html: ICONS.close, onclick: () => closeSkinEditor(true) })),
    h('div', { class: 'se-body' },
      name,
      h('div', { class: 'opt' }, h('div', { class: 'ol' }, h('div', { class: 'ot' }, 'Partir de'), h('div', { class: 'od' }, 'Carga los colores y el estilo de otra skin')), baseSel),
      h('h3', null, 'Colores'), colorGrid,
      h('h3', null, 'Estilo'), opts),
    h('div', { class: 'row se-foot' },
      h('button', { class: 'btn primary', onclick: () => {
        d.name = (d.name || '').trim() || 'Mi skin';
        const clean = cleanSkinDef(d);
        if (!clean) { toast('Faltan colores'); return; }
        saveCustomSkin(clean); previewSkinId = null; closeSkinEditor(false); pickSkin(clean.id); toast(`Skin «${clean.name}» guardada`);
      } }, 'Guardar'),
      h('button', { class: 'btn small', html: `${ICONS.share || ''}<span>Compartir</span>`, onclick: () => { const clean = cleanSkinDef({ ...d, name: (d.name || '').trim() || 'Mi skin' }); if (clean) shareSkin(clean); } }),
      delBtn));
  panel._cancel = () => {
    if (original) registerSkin(original); else unregisterSkin(d.id);
  };
  document.body.classList.add('skin-editing');
  document.body.append(panel);
  preview();
}
function closeSkinEditor(restore) {
  const p = $('#skinEditor');
  if (!p) return;
  if (restore) p._cancel?.();
  p.remove();
  document.body.classList.remove('skin-editing');
  if (previewSkinId || restore) { previewSkinId = null; applySkinVars(); reloadStyle(); }
}

function openSkinImport(prefill = '', readOnly = false) {
  const ta = h('textarea', { class: 'code', placeholder: 'Pega aquí el mensaje o el código de la skin', spellcheck: 'false' });
  ta.value = prefill;
  if (readOnly) ta.readOnly = true;
  const file = h('input', { type: 'file', accept: '.json,.txt,application/json,text/plain', hidden: true, onchange: async (e) => { const f = e.target.files?.[0]; if (f) ta.value = await f.text(); } });
  const ov = h('div', { class: 'overlay', id: 'skinImport' },
    h('div', { class: 'menu-head' }, h('div', { class: 'panel-title', style: { flex: '1' } }, readOnly ? 'Código de la skin' : 'Importar skin'), h('button', { class: 'icon-btn', onclick: () => ov.remove(), html: ICONS.close, 'aria-label': 'Cerrar' })),
    h('p', { class: 'legal' }, readOnly ? 'Copia este código y mándaselo a tu amigo. Él lo pega en Menú → Mapa → Importar skin.' : 'Pega el mensaje que te han pasado (puede llevar texto alrededor) o abre un archivo .json.'),
    ta, file,
    readOnly ? h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { class: 'btn primary', onclick: () => { ta.select(); try { document.execCommand('copy'); toast('Copiado'); } catch { /* sin portapapeles */ } } }, 'Copiar'))
      : h('div', { class: 'row', style: { marginTop: '10px' } },
        h('button', { class: 'btn small', onclick: () => file.click() }, 'Abrir archivo'),
        h('button', { class: 'btn primary', onclick: () => {
          const def = parseSkinText(ta.value);
          if (!def) { toast('No encuentro una skin válida en ese texto'); return; }
          saveCustomSkin(def); ov.remove(); $('#menu')?.remove(); pickSkin(def.id); toast(`Skin «${def.name}» añadida`);
        } }, 'Importar')));
  document.body.append(ov);
  if (!readOnly) setTimeout(() => ta.focus(), 50);
}
function parseSkinText(text) {
  const a = String(text || '').indexOf('{'), b = String(text || '').lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return cleanSkinDef(JSON.parse(text.slice(a, b + 1))); } catch { return null; }
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
    body.replaceChildren(...menuTab(t, () => show(t)).filter(Boolean));
    body.scrollTop = 0;
  };
  show(tab);
  document.body.append(ov);
}

function menuTab(t, rerender) {
  if (t === 'mapa') {
    return [
      h('h3', null, 'Estilo del mapa'),
      skinCards((id) => { pickSkin(id); rerender(); }),
      sw('autoSkin', 'Cambiar sola de día a noche', 'Según la salida y la puesta de sol donde estés', () => { lastSkinCheck = 0; checkAutoSkin(); rerender(); }),
      S.autoSkin ? selectOpt('daySkin', 'Skin de día', Object.values(SKINS).map((k) => [k.id, k.name]), () => { lastSkinCheck = 0; checkAutoSkin(); }) : null,
      S.autoSkin ? selectOpt('nightSkin', 'Skin de noche', Object.values(SKINS).map((k) => [k.id, k.name]), () => { lastSkinCheck = 0; checkAutoSkin(); }) : null,
      h('h3', null, 'Tus skins'),
      ...customSkins().map((d) => h('div', { class: 'opt' },
        h('div', { class: 'ol' }, h('div', { class: 'ot' }, d.name), h('div', { class: 'od' }, `A partir de ${SKINS[d.base]?.name || d.base}`)),
        h('button', { class: 'btn small', onclick: () => openSkinEditor(skinDefOf(d.id)) }, 'Editar'),
        h('button', { class: 'btn small', onclick: () => shareSkin(d) }, 'Pasar'))),
      customSkins().length ? null : h('p', { class: 'legal' }, 'Crea tu propia skin cambiando los colores y el estilo, con el mapa de fondo para ver cómo queda. Luego se la puedes pasar a tu amigo.'),
      h('div', { class: 'row', style: { marginTop: '8px' } },
        h('button', { class: 'btn small primary', onclick: () => openSkinEditor(null) }, 'Crear skin'),
        h('button', { class: 'btn small', onclick: () => openSkinImport() }, 'Importar skin')),
      h('h3', null, 'Capas'),
      sw('poi', 'Lugares en el mapa', 'Iconos de gasolineras, tiendas, restaurantes…', reloadStyle),
      sw('showRadars', 'Radares en el mapa', null, () => ['radars', 'radar-sections'].forEach((l) => map.getLayer(l) && map.setLayoutProperty(l, 'visibility', S.showRadars ? 'visible' : 'none'))),
      sw('showIncidents', 'Incidencias de tráfico', 'Accidentes, cortes, obras y retenciones de la DGT', () => { setData('incidents', incDB.geojson(S.showIncidents)); carRadars(); }),
      sw('showZbe', 'Zonas de bajas emisiones', 'Borde rojo si tu coche no puede entrar', refreshZbe),
      sw('buildings3d', 'Edificios en 3D', 'Más bonito, gasta algo más de batería', reloadStyle),
      sw('traffic', 'Tráfico en directo', S.tomtomKey ? 'Capa de TomTom' : 'Necesita una clave gratuita de TomTom (pestaña Navegación)', () => { if (S.traffic && !S.tomtomKey) { toast('Primero añade la clave de TomTom en Navegación'); S.traffic = false; saveSettings(); rerender(); return; } reloadStyle(); }),
      h('h3', null, 'Cámara'),
      sw('headingUp', 'Mapa orientado según la marcha', 'Si lo apagas, el norte queda siempre arriba'),
      sw('tilt', 'Vista inclinada al conducir'),
      sw('autoZoom', 'Zoom automático según la velocidad'),
      sw('autoRecenter', 'Volver a centrar solo', 'Si mueves el mapa mientras conduces, vuelve a tu posición a los 12 segundos'),
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
      stickerSelect(rerender),
      sw('avoidZbe', 'Rodear las zonas de bajas emisiones prohibidas', hasSticker() ? 'Si el destino está dentro, se entra igualmente y te aviso' : 'Primero indica la etiqueta de tu coche'),
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
      sw('incidentAlerts', 'Incidencias de tráfico de la DGT', 'Cortes, accidentes, retenciones, obras y obstáculos en tu camino'),
      sw('zbeAlerts', 'Zonas de bajas emisiones', 'Al acercarte o entrar en una'),
      h('h3', null, 'Avisos'),
      selectOpt('alertDistance', 'Distancia del aviso', [['auto', 'Automática (según velocidad)'], ['300', '300 m'], ['500', '500 m'], ['800', '800 m'], ['1000', '1 km']]),
      sw('overspeedAlerts', 'Alerta si vas por encima del límite', 'Pitido y aviso de voz cerca del radar y en tramos'),
      sw('vibrate', 'Vibrar con los avisos'),
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
    const pk = parking();
    return [
      h('h3', null, 'Aparcamiento'),
      h('div', { class: 'list' },
        h('div', { class: 'item' }, h('span', { class: 'ic', html: ICONS.car }), h('span', { class: 'tx' }, h('div', { class: 'tt' }, pk ? 'Tu coche' : 'Sin guardar'), h('div', { class: 'sub' }, pk ? (pk.note || pk.address || 'Toca «Ver» para ir') : 'Guarda dónde aparcas para volver luego a pie')),
          pk ? h('button', { class: 'btn small', onclick: () => { $('#menu')?.remove(); showParking(); } }, 'Ver') : null,
          h('button', { class: 'btn small', onclick: () => { saveParking(); rerender(); } }, pk ? 'Aquí' : 'Guardar aquí'))),
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
    h('p', { class: 'legal' }, 'Busca un sitio o mantén pulsado el mapa, pulsa «Ir» y luego «Iniciar». Navegando, el botón ⋯ busca gasolineras y otros sitios en tu camino, muestra las indicaciones y comparte tu hora de llegada. El botón del triángulo guarda reportes en tu posición. Sin ruta, la app sigue avisando de radares, incidencias de la DGT y zonas de bajas emisiones, y muestra el límite de la vía.'),
    h('h3', null, 'Datos y créditos'),
    h('p', { class: 'legal', html: [
      'Mapa: <a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a>, <a href="https://openmaptiles.org" target="_blank" rel="noopener">OpenMapTiles</a> y <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© colaboradores de OpenStreetMap</a>.',
      'Rutas: <a href="https://valhalla1.openstreetmap.de" target="_blank" rel="noopener">Valhalla (FOSSGIS)</a> y <a href="https://project-osrm.org" target="_blank" rel="noopener">OSRM</a>. Búsqueda: <a href="https://photon.komoot.io" target="_blank" rel="noopener">Photon</a> y Nominatim. Lugares: Overpass API.',
      'Radares: DGT (Punto de Acceso Nacional), Ayuntamiento de Madrid (CC BY 4.0), Servei Català de Trànsit, listado DGT georreferenciado por Tachwire (ODbL) y OpenStreetMap (ODbL).',
      'Carburantes: Ministerio para la Transición Ecológica. Incidencias de tráfico y zonas de bajas emisiones: DGT (Punto de Acceso Nacional, CC BY). Tráfico opcional: TomTom.',
      'Motor de mapa: MapLibre GL JS (BSD-3). Tipografías: Oswald y Bebas Neue (OFL).',
    ].join('<br><br>') }),
    h('h3', null, 'Aviso'),
    h('p', { class: 'legal' }, 'Navegador de uso personal. Los radares son ubicaciones públicas y pueden estar incompletas o desactualizadas: respeta siempre los límites y la señalización. No manipules el móvil mientras conduces. Este proyecto no está afiliado a ningún videojuego ni a sus editores.'),
    h('dl', { class: 'kv' }, h('dt', null, 'Versión'), h('dd', null, `${CONFIG.version}${NATIVE ? ' · app Android' : ' · web'}`)),
    st.update ? h('div', { class: 'row', style: { marginTop: '12px' } },
      h('a', { class: 'btn primary', href: st.update.url, target: '_blank', rel: 'noopener', style: { textDecoration: 'none' } }, `Descargar versión ${st.update.version}`)) : null,
    NATIVE ? h('div', { class: 'row', style: { marginTop: '12px' } }, h('button', { class: 'btn', onclick: () => { document.querySelector('#menu')?.remove(); openSetup(false); } }, 'Asistente de configuración')) : null,
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
      skinCards((id) => { pickSkin(id); render(); }),
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
    if (m.lanes && ns.distNext < 2000 && m.lanes.some((l) => l.a || l.v)) info.cur.lanes = m.lanes;
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
  const alert = a ? { id: a.id || (a.radar || a.report).id, icon: a.type.icon, label: a.sub && a.kind !== 'radar' ? `${a.type.label} · ${a.sub}` : a.type.label, d: Math.round(a.d), alertDist: a.alertDist, limit: a.kind === 'radar' ? a.limit : null, over: !!a.over, kind: a.kind } : null;
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
  carLive(st.fix, ns, mergeAlerts(watcher.lastState, st.trafficState), pos, currentRotation());
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

async function svgStringToPng(svgStr) {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgStr)}`;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || 200; c.height = img.naturalHeight || 64;
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}

async function carIcons(ns) {
  const m = ns.next, a = ns.afterNext && ns.distAfter < 500 ? ns.afterNext : null;
  const lanes = m.lanes && m.lanes.some((l) => l.a || l.v) ? m.lanes : null;
  const key = `${ns.nextIndex}:${m.kind}:${m.exit}|${a ? `${a.kind}:${a.exit}` : ''}|${lanes ? 'L' : ''}`;
  if (key === carIconKey) return;
  carIconKey = key;
  try {
    const current = await svgToPng(maneuverSVG(m.kind, m.exit));
    const next = a ? await svgToPng(maneuverSVG(a.kind, a.exit)) : '';
    const lanesImg = lanes ? await svgStringToPng(laneSVG(lanes, { size: 64 })) : '';
    carCall('setIcons', { current, next, lanes: lanesImg });
  } catch { /* sin icono: Android Auto usa el suyo */ }
}

function carRoute() {
  const r = st.mode === 'nav' ? st.route : null;
  const json = r ? JSON.stringify({ coords: r.coords, dest: st.dest ? { lat: st.dest.lat, lon: st.dest.lon } : null, stops: st.stops.map((x) => ({ lat: x.lat, lon: x.lon })) }) : 'null';
  carIconKey = '';
  carCall('setRoute', { json });
}

function carRadars(g) {
  if (!CAR) return;
  const base = g || radarDB.geojson();
  const inc = S.showIncidents ? incDB.geojson(true).features.map((f) => ({ ...f, properties: { ...f.properties, lim: '', tipo: 'incidencia' } })) : [];
  carCall('setRadars', { json: JSON.stringify({ type: 'FeatureCollection', features: [...base.features, ...inc] }) });
}

function carSettings() {
  const def = SKINS[S.skin]?.custom ? skinDefOf(S.skin) : null;
  carCall('setSettings', { json: JSON.stringify({ skin: S.skin, skinDef: def, buildings3d: S.buildings3d, poi: S.poi, showRadars: S.showRadars, headingUp: S.headingUp, tilt: S.tilt }) });
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
    if ($('#skinEditor')) { closeSkinEditor(true); return; }
    if (skinPop) { closeSkinPop(); return; }
    if (st.mode === 'preview') { cancelPreview(); return; }
    if (st.sheetView) { closeSheet(); st.pin = null; refreshPin(); return; }
    Native.app.minimizeApp?.();
  });
  setTimeout(() => {
    checkForUpdate().then((u) => {
      if (!u) return;
      st.update = u;
      if (store.get('updateSeen') !== u.version) openUpdateDialog(u);
    }).catch(() => {});
  }, 8000);
}


function openUpdateDialog(u) {
  store.set('updateSeen', u.version);
  const changes = (u.notes.split(/Cambios:/i)[1] || '').trim();
  const ov = h('div', { class: 'overlay' },
    h('div', { class: 'menu-head' }, h('div', { class: 'menu-title' }, 'NUEVA ', h('span', null, 'VERSIÓN')), h('button', { class: 'icon-btn', onclick: () => ov.remove(), html: ICONS.close, 'aria-label': 'Cerrar' })),
    h('p', { class: 'legal' }, `Tienes la ${BUILD.version}. Ya está disponible la ${u.version}.`),
    changes ? h('div', { class: 'update-notes' }, changes) : null,
    h('div', { class: 'row' },
      h('a', { class: 'btn primary', href: u.url, target: '_blank', rel: 'noopener', style: { textDecoration: 'none' } }, 'Descargar e instalar'),
      h('button', { class: 'btn', onclick: () => ov.remove() }, 'Más tarde')),
    h('p', { class: 'legal', style: { marginTop: '12px' } }, 'Se instala encima de la actual: no pierdes favoritos, reportes ni ajustes.'));
  document.body.append(ov);
}

/** Asistente para dejar el móvil listo: ubicación, notificación, batería y Android Auto. */
async function openSetup(first) {
  const sys = Native.sistema;
  let stat = {};
  const body = h('div', { class: 'menu-body' });
  const ov = h('div', { class: 'overlay', id: 'setup' },
    h('div', { class: 'menu-head' }, h('div', { class: 'menu-title' }, 'PONLO A ', h('span', null, 'PUNTO')), h('button', { class: 'icon-btn', onclick: () => close(), html: ICONS.close, 'aria-label': 'Cerrar' })),
    body);
  const close = () => { store.set('setupDone', true); ov.remove(); document.removeEventListener('visibilitychange', onVis); };
  const refresh = async () => {
    try { stat = sys ? await sys.status() : {}; } catch { stat = {}; }
    const brand = stat.manufacturer ? stat.manufacturer.charAt(0).toUpperCase() + stat.manufacturer.slice(1) : 'tu móvil';
    const steps = [
      { n: 1, title: 'Ubicación', ok: !!st.fix, desc: 'Para el GPS, las rutas y los avisos de radar. Si te deja, elige «Permitir siempre».', btn: st.fix ? null : ['Dar permiso', () => { startGps(); setTimeout(refresh, 2500); }] },
      { n: 2, title: 'Notificación', ok: !!stat.notifications, desc: 'La notificación «Minimapa activo» es la que mantiene el GPS, la voz y los avisos con la pantalla apagada o en Android Auto.', btn: ['Permitir', async () => { await sys?.requestNotifications(); setTimeout(refresh, 1500); }] },
      { n: 3, title: 'Batería sin restricciones', ok: !!stat.battery, desc: `Evita que ${brand} cierre Minimapa en segundo plano a mitad de ruta. Muy importante en Xiaomi, Samsung, Huawei y Oppo.`, btn: ['Quitar restricción', async () => { await sys?.requestBattery(); }] },
      { n: 4, title: 'Android Auto', ok: !!store.get('autoSetupDone'), desc: stat.androidAuto === false ? 'No tienes la app Android Auto instalada. Si tu coche la usa, instálala primero.' : 'Abre Android Auto → Ajustes → toca 10 veces «Versión» → menú ⋮ → «Ajustes de desarrollador» → marca «Fuentes desconocidas». Después Minimapa sale en el coche.', btn: [stat.androidAuto === false ? 'Instalar Android Auto' : 'Abrir Android Auto', async () => { store.set('autoSetupDone', true); await sys?.openAndroidAuto(); }] },
      { n: 5, title: 'Etiqueta ambiental', ok: hasSticker(), desc: 'Elige la pegatina de la DGT de tu coche para saber en qué zonas de bajas emisiones puedes entrar y rodear las demás.', extra: true },
    ];
    body.replaceChildren(
      h('p', { class: 'legal' }, first ? 'Cinco pasos y listo. Puedes volver aquí cuando quieras desde Menú → Info.' : 'Comprueba que todo está bien para usar Minimapa con la pantalla apagada y en el coche.'),
      ...steps.map((x) => h('div', { class: `setup-step${x.ok ? ' ok' : ''}` },
        h('div', { class: 'n' }, x.ok ? '✓' : String(x.n)),
        h('div', { class: 'tx' },
          h('div', { class: 'tt' }, x.title),
          h('div', { class: 'dd' }, x.desc),
          x.ok ? h('div', { class: 'st' }, x.n === 5 ? stickerName(S.sticker) : 'Listo') : null,
          x.extra ? stickerSelect(refresh) : null,
          !x.ok && x.btn ? h('button', { class: 'btn small primary', onclick: x.btn[1] }, x.btn[0]) : (x.n === 4 && x.btn ? h('button', { class: 'btn small', onclick: x.btn[1] }, x.btn[0]) : null)))),
      h('div', { class: 'row', style: { marginTop: '16px' } }, h('button', { class: 'btn primary', onclick: () => close() }, 'Listo, a conducir')),
    );
  };
  // Al volver de los ajustes del sistema se actualiza el estado
  const onVis = () => { if (document.visibilityState === 'visible') setTimeout(refresh, 400); };
  document.addEventListener('visibilitychange', onVis);
  document.body.append(ov);
  await refresh();
}

/** Arrastrar el panel inferior hacia abajo para cerrarlo. */
function enableSheetDrag() {
  const sheet = $('#sheet');
  const bodyEl = $('#sheetBody');
  let y0 = null, dy = 0;
  sheet.addEventListener('touchstart', (e) => {
    const onGrip = e.target.closest('.sheet-grip');
    if (!onGrip && bodyEl.scrollTop > 0) return;
    y0 = e.touches[0].clientY; dy = 0;
    sheet.classList.add('dragging');
  }, { passive: true });
  sheet.addEventListener('touchmove', (e) => {
    if (y0 == null) return;
    dy = Math.max(0, e.touches[0].clientY - y0);
    if (dy > 4) sheet.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  const end = () => {
    if (y0 == null) return;
    y0 = null;
    sheet.classList.remove('dragging');
    sheet.classList.add('snap');
    if (dy > 90 && st.mode !== 'preview') {
      sheet.style.transform = 'translateY(100%)';
      setTimeout(() => { closeSheet(); st.pin = null; refreshPin(); sheet.style.transform = ''; sheet.classList.remove('snap'); }, 180);
    } else {
      sheet.style.transform = '';
      setTimeout(() => sheet.classList.remove('snap'), 220);
    }
  };
  sheet.addEventListener('touchend', end);
  sheet.addEventListener('touchcancel', end);
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
  $('#btnRouteMenu').innerHTML = ICONS.more;
  $('#btnRouteMenu').addEventListener('click', openRouteMenu);
  $('#btnEnd').innerHTML = ICONS.close;

  $('#chips').replaceChildren(...CATEGORIES.slice(0, 9).map((c) => h('button', { class: 'chip', dataset: { id: c.id }, onclick: () => runCategory(c) }, h('img', { src: blipIconURL(c.blip, curSkin()), alt: '' }), c.label)));

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
    const hits = map.queryRenderedFeatures(e.point, { layers: ['results', 'favs', 'radars', 'incidents', 'zbe-fill', 'route-alt', 'poi-top', 'poi-mid', 'poi-low'].filter((l) => map.getLayer(l)) });
    if (!hits.length && st.mode === 'browse' && st.sheetView && st.sheetView !== 'loading') { closeSheet(); st.pin = null; refreshPin(); }
  });
}

function start() {
  const sp = $('#splash');
  if (!sp || sp.dataset.started) return;
  sp.dataset.started = '1';
  unlockAudio();
  startCompass();
  startGps();
  requestWakeLock();
  if (NATIVE) {
    sp.classList.add('fade');
    setTimeout(() => sp.remove(), 500);
    if (!store.get('setupDone')) setTimeout(() => openSetup(true), 900);
    else if (!store.get('tipShown')) { store.set('tipShown', true); setTimeout(() => toast('Consejo: mantén pulsado el mapa para soltar un pin y crear una ruta.', 5000), 1500); }
  } else {
    sp.remove();
    if (!store.get('tipShown')) { store.set('tipShown', true); setTimeout(() => toast('Consejo: mantén pulsado el mapa para soltar un pin y crear una ruta.', 5000), 1500); }
  }
  // Por si el sistema bloquea el audio hasta el primer toque
  document.addEventListener('pointerdown', unlockAudio, { once: true });
}

buildUI();
initNative();
radarDB.init().catch((e) => console.warn('Radares:', e));
zbeDB.load().catch(() => {});
incDB.load().catch(() => {});
// Incidencias: cada 5 minutos navegando y cada 15 sin ruta (solo con la app a la vista o navegando)
setInterval(() => {
  const age = Date.now() - incDB.fetchedAt;
  const every = st.mode === 'nav' ? 5 * 60e3 : 15 * 60e3;
  if (age > every && (st.mode === 'nav' || document.visibilityState === 'visible')) incDB.load(true).catch(() => {});
}, 60e3);
$('#splash').addEventListener('click', start);
enableSheetDrag();
if (NATIVE) setTimeout(start, 900); // en la app no hace falta pulsar: arranca sola tras el logo
$('#splash').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') start(); });

if (!NATIVE && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Ganchos para pruebas y depuración desde la consola
window.__mm = { onCarAction, carLive, navigateNow, map, st, S, radarDB, nav, watcher, processFix, previewRoute, startNav, endNav, selectPlace, toast, runCategory, openMenu, setSkin, pointAlong, angDiff, openSkinEditor, openSkinImport, SKINS, curSkinId, incDB, zbeDB, trafficWatcher, showIncident, showZbe, showParking, saveParking, openRouteMenu, searchAlongRoute, showSteps, walkTo, renderPreview };

// Mapa de la pantalla del coche (Android Auto). Solo dibuja: la app del móvil le manda la posición,
// la ruta, los radares y los avisos a través de CarMapRenderer.java.
import * as maplibregl from '../vendor/maplibre-gl.mjs';
import { CONFIG } from './config.js';
import { SKINS, buildStyle, LABEL_ANCHOR } from './skins.js';
import { attachImages, alertIconURL } from './blips.js';
import { fmtDist, clamp } from './util.js';

const $ = (s) => document.querySelector(s);
const EMPTY = { type: 'FeatureCollection', features: [] };

const S = { skin: 'radar', buildings3d: false, poi: true, showRadars: true, headingUp: true, tilt: true };
let dark = false;
// De noche el coche no usa la skin clara (deslumbra)
const carSkin = () => (dark && S.skin === 'atlas' ? 'radar' : S.skin);
let radars = EMPTY;
let route = null; // {coords, dest, stops}
let live = null;
let follow = true;
let manualZoom = null;
let area = null;
let lastAlertIcon = '';

const map = new maplibregl.Map({
  container: 'map',
  style: buildStyle(carSkin(), { poi: S.poi, buildings3d: S.buildings3d }),
  center: CONFIG.startCenter,
  zoom: 15,
  interactive: false, // los gestos llegan desde Android Auto
  attributionControl: { compact: true },
  fadeDuration: 0,
  maxPitch: 65,
});
attachImages(map, () => SKINS[carSkin()]);
const foldAttribution = () => document.querySelectorAll('.maplibregl-ctrl-attrib.maplibregl-compact-show').forEach((e) => e.classList.remove('maplibregl-compact-show'));
map.on('load', foldAttribution);

function applySkinVars() {
  document.documentElement.style.setProperty('--accent', (SKINS[carSkin()] || SKINS.radar).accent);
}

function src(id, data) {
  if (map.getSource(id)) map.getSource(id).setData(data);
  else map.addSource(id, { type: 'geojson', data });
}

function addOverlays() {
  const sk = SKINS[carSkin()] || SKINS.radar;
  for (const id of ['poi-mid', 'poi-low']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
  const before = map.getLayer(LABEL_ANCHOR) ? LABEL_ANCHOR : undefined;
  src('route', routeGeo());
  src('routePts', routePtsGeo());
  src('radars', radars);
  const lineLayout = { 'line-join': 'round', 'line-cap': 'round' };
  const wz = (a, b) => ['interpolate', ['linear'], ['zoom'], 8, a, 17, b];
  map.addLayer({ id: 'route-done', type: 'line', source: 'route', filter: ['==', ['get', 'kind'], 'done'], layout: lineLayout, paint: { 'line-color': sk.routeDone, 'line-width': wz(3, 7), 'line-opacity': 0.8 } }, before);
  map.addLayer({ id: 'route-glow', type: 'line', source: 'route', filter: ['==', ['get', 'kind'], 'main'], layout: lineLayout, paint: { 'line-color': sk.route, 'line-width': wz(12, 26), 'line-blur': 10, 'line-opacity': 0.45 } }, before);
  map.addLayer({ id: 'route-casing', type: 'line', source: 'route', filter: ['==', ['get', 'kind'], 'main'], layout: lineLayout, paint: { 'line-color': sk.routeCasing, 'line-width': wz(7, 15) } }, before);
  map.addLayer({ id: 'route-main', type: 'line', source: 'route', filter: ['==', ['get', 'kind'], 'main'], layout: lineLayout, paint: { 'line-color': sk.route, 'line-width': wz(4.5, 10) } }, before);
  map.addLayer({
    id: 'route-arrows', type: 'symbol', source: 'route', minzoom: 13, filter: ['==', ['get', 'kind'], 'main'],
    layout: { 'symbol-placement': 'line', 'symbol-spacing': 90, 'icon-image': 'route-arrow', 'icon-size': ['interpolate', ['linear'], ['zoom'], 13, 0.7, 18, 1.1], 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-rotation-alignment': 'map' },
  }, before);
  map.addLayer({ id: 'radar-sections', type: 'line', source: 'radars', minzoom: 11, filter: ['==', ['get', 'tipo'], 'tramo-linea'], layout: { visibility: S.showRadars ? 'visible' : 'none' }, paint: { 'line-color': '#ff6d00', 'line-width': 3, 'line-dasharray': [2, 1.5], 'line-opacity': 0.75 } }, before);
  map.addLayer({
    id: 'radars', type: 'symbol', source: 'radars', minzoom: 8, filter: ['!=', ['get', 'tipo'], 'tramo-linea'],
    layout: {
      visibility: S.showRadars ? 'visible' : 'none',
      'icon-image': ['get', 'icon'], 'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.55, 14, 0.95, 17, 1.1],
      'icon-allow-overlap': true,
      'text-field': ['step', ['zoom'], '', 13, ['to-string', ['get', 'lim']]], 'text-font': CONFIG.fonts.bold, 'text-size': 12,
      'text-offset': [0, 1.5], 'text-anchor': 'top', 'text-optional': true,
    },
    paint: { 'text-color': '#ffffff', 'text-halo-color': '#c62828', 'text-halo-width': 2.2 },
  });
  map.addLayer({ id: 'routePts', type: 'symbol', source: 'routePts', layout: { 'icon-image': ['get', 'icon'], 'icon-allow-overlap': true, 'icon-ignore-placement': true } });
}
map.on('style.load', addOverlays);

function routeGeo() {
  if (!route?.coords?.length) return EMPTY;
  const c = route.coords;
  if (live?.segIndex != null && live.snapped) {
    const i = clamp(live.segIndex, 0, c.length - 1);
    const sn = [live.snapped.lon, live.snapped.lat];
    return {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: { kind: 'done' }, geometry: { type: 'LineString', coordinates: [...c.slice(0, i + 1), sn] } },
        { type: 'Feature', properties: { kind: 'main' }, geometry: { type: 'LineString', coordinates: [sn, ...c.slice(i + 1)] } },
      ],
    };
  }
  return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { kind: 'main' }, geometry: { type: 'LineString', coordinates: c } }] };
}

function routePtsGeo() {
  const f = [];
  for (const s of route?.stops || []) f.push({ type: 'Feature', properties: { icon: 'stop' }, geometry: { type: 'Point', coordinates: [s.lon, s.lat] } });
  if (route?.dest) f.push({ type: 'Feature', properties: { icon: 'dest' }, geometry: { type: 'Point', coordinates: [route.dest.lon, route.dest.lat] } });
  return { type: 'FeatureCollection', features: f };
}

// ---- Marcador ----
const el = document.createElement('div');
el.className = 'player';
el.innerHTML = '<svg viewBox="0 0 54 54"><path d="M27 5 43 45 27 36 11 45Z" fill="#f5f5f5" stroke="#0d0d0d" stroke-width="2.6" stroke-linejoin="round"/><path d="M27 12 37.5 39 27 33Z" fill="#cfcfcf"/></svg>';
const player = new maplibregl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' });
let onMap = false;
const anim = { from: null, to: null, t0: 0, r0: 0, r1: 0, raf: 0 };
function movePlayer(lat, lon, rot) {
  if (!onMap) { player.setLngLat([lon, lat]).setRotation(rot).addTo(map); onMap = true; return; }
  const cur = player.getLngLat();
  anim.from = { lat: cur.lat, lon: cur.lng };
  anim.to = { lat, lon };
  anim.r0 = player.getRotation();
  anim.r1 = anim.r0 + ((((rot - anim.r0) % 360) + 540) % 360 - 180);
  anim.t0 = performance.now();
  cancelAnimationFrame(anim.raf);
  const step = (t) => {
    const k = Math.min(1, (t - anim.t0) / 900);
    player.setLngLat([anim.from.lon + (anim.to.lon - anim.from.lon) * k, anim.from.lat + (anim.to.lat - anim.from.lat) * k]);
    player.setRotation(anim.r0 + (anim.r1 - anim.r0) * k);
    if (k < 1) anim.raf = requestAnimationFrame(step);
  };
  anim.raf = requestAnimationFrame(step);
}

// ---- Cámara ----
function camPadding() {
  const W = window.innerWidth, H = window.innerHeight;
  const a = area || { left: 0, top: 0, right: W, bottom: H };
  const vh = a.bottom - a.top;
  const tilted = S.tilt;
  return { left: a.left, right: Math.max(0, W - a.right), top: a.top + (tilted ? vh * 0.38 : vh * 0.1), bottom: Math.max(0, H - a.bottom) };
}

function follow2(instant) {
  if (!live) return;
  const kmh = (live.speed || 0) * 3.6;
  const auto = live.nav ? (kmh > 100 ? 15.2 : kmh > 70 ? 15.8 : kmh > 40 ? 16.4 : 17) : (kmh > 90 ? 14.8 : kmh > 50 ? 15.6 : 16.2);
  const zoom = manualZoom ?? (live.nav && live.distNext != null && live.distNext < 220 ? Math.max(auto, 17.2) : auto);
  const opts = { center: [live.lon, live.lat], zoom, bearing: S.headingUp ? live.rot || 0 : 0, pitch: S.tilt ? 50 : 0, padding: camPadding(), duration: instant ? 500 : 950 };
  if (!instant) opts.easing = (t) => t;
  map.easeTo(opts);
}

// ---- HUD ----
function hud() {
  if (!live) return;
  const kmh = Math.max(0, Math.round((live.speed || 0) * 3.6));
  $('#speedVal').textContent = kmh;
  const ls = $('#limitSign');
  if (live.limit) { ls.hidden = false; ls.textContent = live.limit; } else ls.hidden = true;
  $('#speedo').classList.toggle('over', !!live.over);
  const a = live.alert;
  const card = $('#alertCard');
  if (a) {
    if (a.icon !== lastAlertIcon) { lastAlertIcon = a.icon; card.querySelector('img').src = alertIconURL(a.icon); }
    card.hidden = false;
    card.querySelector('.a-type').textContent = a.label;
    card.querySelector('.a-dist').textContent = fmtDist(a.d);
    const lim = card.querySelector('.a-lim');
    if (a.limit) { lim.hidden = false; lim.textContent = a.limit; } else lim.hidden = true;
    card.classList.toggle('over', !!a.over);
    card.classList.toggle('report', a.kind === 'report');
    card.querySelector('.a-bar i').style.width = `${Math.max(3, Math.min(100, (1 - a.d / (a.alertDist || 500)) * 100))}%`;
    $('#flash').classList.toggle('on', a.kind === 'radar' && a.d < 300);
  } else {
    card.hidden = true;
    $('#flash').classList.remove('on');
  }
  const s = live.section;
  const sc = $('#sectionCard');
  if (s) {
    sc.hidden = false;
    sc.classList.toggle('over', !!s.over);
    sc.querySelector('.s-avg').innerHTML = `${Math.round(s.avg)} <small>km/h media${s.limit ? ` · límite ${s.limit}` : ''}</small>`;
    sc.querySelector('.s-sub').textContent = `Quedan ${fmtDist(s.remaining)}`;
  } else sc.hidden = true;
  const st = $('#street');
  if (!live.nav && (live.street || live.locality)) {
    st.hidden = false;
    st.innerHTML = '';
    if (live.locality) { const sm = document.createElement('small'); sm.textContent = live.locality; st.append(sm); }
    st.append(document.createTextNode(live.street || ''));
  } else st.hidden = true;
}

// ---- API que llama Android ----
function restyle() {
  map.setStyle(buildStyle(carSkin(), { poi: S.poi, buildings3d: S.buildings3d }), { diff: false });
}

window.carSetDark = (d) => {
  const before = carSkin();
  dark = !!d;
  applySkinVars();
  if (carSkin() !== before) restyle();
};

window.carSetSettings = (s) => {
  const before = carSkin();
  const needs = !!s.buildings3d !== !!S.buildings3d || s.poi !== S.poi;
  Object.assign(S, s);
  applySkinVars();
  if (needs || carSkin() !== before) restyle();
  else for (const id of ['radars', 'radar-sections']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', S.showRadars ? 'visible' : 'none');
};

window.carSetRadars = (g) => {
  radars = g || EMPTY;
  map.getSource('radars')?.setData(radars);
};

window.carSetRoute = (r) => {
  route = r && r.coords?.length ? r : null;
  map.getSource('route')?.setData(routeGeo());
  map.getSource('routePts')?.setData(routePtsGeo());
};

window.carUpdate = (l) => {
  const first = !live;
  live = l;
  $('#wait').classList.add('gone');
  movePlayer(l.lat, l.lon, l.rot || 0);
  if (route) map.getSource('route')?.setData(routeGeo());
  hud();
  if (follow) follow2(first);
};

window.carSetArea = (a) => {
  const dpr = window.devicePixelRatio || 1;
  // Android manda píxeles físicos; el CSS usa píxeles lógicos
  area = { left: a.left / dpr, top: a.top / dpr, right: a.right / dpr, bottom: a.bottom / dpr };
  const W = window.innerWidth, H = window.innerHeight;
  const r = document.documentElement.style;
  r.setProperty('--vl', `${area.left}px`);
  r.setProperty('--vt', `${area.top}px`);
  r.setProperty('--vr', `${Math.max(0, W - area.right)}px`);
  r.setProperty('--vb', `${Math.max(0, H - area.bottom)}px`);
  if (follow) follow2(true);
};

window.carBrain = (alive) => {
  if (!alive && !live) $('#wait').classList.remove('gone');
};

window.carGesture = (type, a, b, c) => {
  const dpr = window.devicePixelRatio || 1;
  if (type === 'scroll') {
    follow = false;
    map.panBy([a / dpr, b / dpr], { duration: 0 });
  } else if (type === 'fling') {
    follow = false;
    map.panBy([-a / dpr * 0.15, -b / dpr * 0.15], { duration: 500 });
  } else if (type === 'scale') {
    const z = map.getZoom() + Math.log2(c || 1);
    manualZoom = clamp(z, 3, 19);
    if (follow) follow2(true);
    else map.zoomTo(manualZoom, { around: map.unproject([a / dpr, b / dpr]), duration: 0 });
  }
};

window.carAction = (name, on) => {
  if (name === 'zoomIn' || name === 'zoomOut') {
    manualZoom = clamp(map.getZoom() + (name === 'zoomIn' ? 1 : -1), 3, 19);
    if (follow) follow2(true); else map.zoomTo(manualZoom, { duration: 300 });
  } else if (name === 'recenter') {
    follow = true;
    manualZoom = null;
    follow2(true);
  } else if (name === 'pan') {
    if (on) follow = false;
  }
};

applySkinVars();
// Para pruebas en un navegador normal
window.__car = { map, S, get live() { return live; } };

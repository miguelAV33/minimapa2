// Utilidades: geometría, formato, DOM, almacenamiento y red.

export const EARTH_R = 6371008.8;
export const toRad = (d) => (d * Math.PI) / 180;
export const toDeg = (r) => (r * 180) / Math.PI;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Distancia en metros (haversine). */
export function dist(aLat, aLon, bLat, bLon) {
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Rumbo inicial 0-360 de A hacia B. */
export function bearing(aLat, aLon, bLat, bLon) {
  const la1 = toRad(aLat), la2 = toRad(bLat), dLon = toRad(bLon - aLon);
  const y = Math.sin(dLon) * Math.cos(la2);
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Diferencia angular absoluta 0-180. */
export function angDiff(a, b) {
  const d = Math.abs((((a - b) % 360) + 540) % 360 - 180);
  return d;
}

/** Punto a una distancia y rumbo. */
export function destPoint(lat, lon, brg, d) {
  const δ = d / EARTH_R, θ = toRad(brg), φ1 = toRad(lat), λ1 = toRad(lon);
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return [toDeg(φ2), ((toDeg(λ2) + 540) % 360) - 180];
}

/**
 * Proyección de P sobre el segmento AB en un plano local (equirectangular).
 * Devuelve t (0-1), distancia en metros y el punto proyectado.
 */
export function projectToSegment(pLat, pLon, aLat, aLon, bLat, bLon) {
  const k = EARTH_R * Math.PI / 180;
  const c = Math.cos(toRad(pLat));
  const ax = (aLon - pLon) * k * c, ay = (aLat - pLat) * k;
  const bx = (bLon - pLon) * k * c, by = (bLat - pLat) * k;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? -(ax * dx + ay * dy) / len2 : 0;
  t = clamp(t, 0, 1);
  const px = ax + t * dx, py = ay + t * dy;
  return { t, d: Math.hypot(px, py), lat: aLat + t * (bLat - aLat), lon: aLon + t * (bLon - aLon) };
}

/** Decodifica una polilínea codificada (precisión 5 u 6) a [[lon, lat], ...]. */
export function decodePolyline(str, precision = 6) {
  const factor = 10 ** precision;
  const out = [];
  let index = 0, lat = 0, lon = 0;
  while (index < str.length) {
    let result = 0, shift = 0, b;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    result = 0; shift = 0;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lon += result & 1 ? ~(result >> 1) : result >> 1;
    out.push([lon / factor, lat / factor]);
  }
  return out;
}

/** Codifica [[lon, lat], ...] como polilínea. */
export function encodePolyline(coords, precision = 6) {
  const factor = 10 ** precision;
  let out = '', pLat = 0, pLon = 0;
  const enc = (v) => {
    v = v < 0 ? ~(v << 1) : v << 1;
    let s = '';
    while (v >= 0x20) { s += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; }
    return s + String.fromCharCode(v + 63);
  };
  for (const [lon, lat] of coords) {
    const iLat = Math.round(lat * factor), iLon = Math.round(lon * factor);
    out += enc(iLat - pLat) + enc(iLon - pLon);
    pLat = iLat; pLon = iLon;
  }
  return out;
}

/** Distancias acumuladas de una lista de [lon, lat]. */
export function cumulative(coords) {
  const cum = new Float64Array(coords.length);
  for (let i = 1; i < coords.length; i++) {
    cum[i] = cum[i - 1] + dist(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
  }
  return cum;
}

/** Punto a lo largo de una línea a una distancia dada. */
export function pointAlong(coords, cum, along) {
  if (along <= 0) return { lon: coords[0][0], lat: coords[0][1], i: 0 };
  const n = coords.length;
  if (along >= cum[n - 1]) return { lon: coords[n - 1][0], lat: coords[n - 1][1], i: n - 2 };
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= along) lo = mid; else hi = mid; }
  const seg = cum[hi] - cum[lo];
  const t = seg > 0 ? (along - cum[lo]) / seg : 0;
  return {
    lon: coords[lo][0] + t * (coords[hi][0] - coords[lo][0]),
    lat: coords[lo][1] + t * (coords[hi][1] - coords[lo][1]),
    i: lo,
  };
}

/** Bounding box [w, s, e, n] de coords [[lon, lat]]. */
export function bboxOf(coords, padDeg = 0) {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const [lon, lat] of coords) {
    if (lon < w) w = lon; if (lon > e) e = lon; if (lat < s) s = lat; if (lat > n) n = lat;
  }
  return [w - padDeg, s - padDeg, e + padDeg, n + padDeg];
}

// ---------- Formato ----------

export function fmtDist(m) {
  if (m == null || !isFinite(m)) return '—';
  if (m < 1000) {
    const r = m < 100 ? Math.max(0, Math.round(m / 10) * 10) : Math.round(m / 50) * 50;
    return r >= 1000 ? '1 km' : `${r} m`;
  }
  const km = m / 1000;
  return `${km < 10 ? km.toFixed(1).replace('.', ',') : Math.round(km)} km`;
}

export function fmtDur(s) {
  if (s == null || !isFinite(s)) return '—';
  const min = Math.round(s / 60);
  if (min < 1) return '<1 min';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), mm = min % 60;
  return mm ? `${h} h ${mm} min` : `${h} h`;
}

export function fmtClock(date) {
  return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

/** Distancia para la voz: "500 metros", "1,5 kilómetros". */
export function speakDist(m) {
  if (m < 1000) {
    const r = m < 200 ? Math.round(m / 50) * 50 : Math.round(m / 100) * 100;
    if (r >= 1000) return 'un kilómetro';
    return `${Math.max(50, r)} metros`;
  }
  const km = Math.round(m / 100) / 10;
  if (km === 1) return 'un kilómetro';
  if (Number.isInteger(km)) return `${km} kilómetros`;
  return `${String(km).replace('.', ',')} kilómetros`;
}

export function lowerFirst(s) {
  if (!s) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---------- DOM ----------

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Crea un elemento: h('div', {class: 'x', onclick}, 'texto', otroNodo) */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

// ---------- Almacenamiento ----------

const PREFIX = 'minimapa.';
export const store = {
  get(key, def) {
    try { const v = localStorage.getItem(PREFIX + key); return v == null ? def : JSON.parse(v); } catch { return def; }
  },
  set(key, val) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(val)); return true; } catch { return false; }
  },
  del(key) { try { localStorage.removeItem(PREFIX + key); } catch { /* sin almacenamiento */ } },
};

let dbPromise;
function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open('minimapa', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) { reject(e); }
  });
  return dbPromise;
}
export const idb = {
  async get(key) {
    try {
      const db = await openDb();
      return await new Promise((res, rej) => {
        const r = db.transaction('kv').objectStore('kv').get(key);
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      });
    } catch { return undefined; }
  },
  async set(key, val) {
    try {
      const db = await openDb();
      await new Promise((res, rej) => {
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(val, key);
        tx.oncomplete = res; tx.onerror = () => rej(tx.error);
      });
      return true;
    } catch { return false; }
  },
};

// ---------- Red ----------

export async function fetchWithTimeout(url, opts = {}) {
  const { timeout = 15000, ...rest } = opts;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    return await fetch(url, { ...rest, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJSON(url, opts = {}) {
  const r = await fetchWithTimeout(url, opts);
  if (!r.ok) {
    let body = '';
    try { body = await r.text(); } catch { /* nada */ }
    const err = new Error(`HTTP ${r.status} ${url.split('?')[0]}`);
    err.status = r.status; err.body = body;
    throw err;
  }
  return r.json();
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

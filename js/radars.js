// Radares: carga y actualización periódica de la base, índice espacial, radares de OSM en directo,
// reportes personales y vigilante de avisos (fijos, tramos, semáforos, cámaras y reportes).
import { CONFIG } from './config.js';
import { dist, bearing, angDiff, projectToSegment, clamp, speakDist, idb, store, fetchJSON, fetchWithTimeout, uid, bboxOf } from './util.js';

export const RADAR_TYPES = {
  fijo: { label: 'Radar fijo', icon: 'radar-fijo', speak: 'Radar fijo' },
  tramo: { label: 'Radar de tramo', icon: 'radar-tramo', speak: 'Tramo de velocidad media' },
  semaforo: { label: 'Semáforo con cámara', icon: 'radar-semaforo', speak: 'Semáforo con cámara' },
  cinturon: { label: 'Cámara de cinturón y móvil', icon: 'radar-cinturon', speak: 'Cámara de control de cinturón y móvil' },
  linea: { label: 'Cámara de línea continua o stop', icon: 'radar-linea', speak: 'Cámara de control de línea continua' },
  movil: { label: 'Radar móvil', icon: 'radar-movil', speak: 'Posible radar móvil' },
};

const H = 3600e3;
export const REPORT_TYPES = {
  radar: { label: 'Radar fijo', icon: 'radar-fijo', ttl: null, radar: 'fijo' },
  movil: { label: 'Radar móvil', icon: 'radar-movil', ttl: 3 * H, radar: 'movil' },
  control: { label: 'Control', icon: 'rep-control', ttl: 2 * H, speak: 'Control' },
  accidente: { label: 'Accidente', icon: 'rep-accidente', ttl: 2 * H, speak: 'Accidente' },
  obras: { label: 'Obras', icon: 'rep-obras', ttl: 30 * 24 * H, speak: 'Obras' },
  peligro: { label: 'Peligro', icon: 'rep-peligro', ttl: 6 * H, speak: 'Peligro' },
  atasco: { label: 'Atasco', icon: 'rep-atasco', ttl: 1 * H, speak: 'Atasco' },
};

const CELL = 0.05; // ~5,5 km
const key = (la, lo) => `${Math.floor(la / CELL)}:${Math.floor(lo / CELL)}`;

/** Convierte la respuesta de Overpass (nodos speed_camera y relaciones enforcement) a radares. */
export function parseOverpass(json) {
  const nodes = new Map(), ways = new Map(), rels = [];
  for (const el of json.elements || []) {
    if (el.type === 'node') nodes.set(el.id, el);
    else if (el.type === 'way') ways.set(el.id, el);
    else if (el.type === 'relation') rels.push(el);
  }
  const pos = (m) => {
    if (m.type === 'node') { const n = nodes.get(m.ref); return n && n.lat != null ? [n.lat, n.lon] : null; }
    if (m.type === 'way') {
      const w = ways.get(m.ref);
      if (!w?.nodes?.length) return null;
      const n = nodes.get(w.nodes[Math.floor(w.nodes.length / 2)]);
      return n && n.lat != null ? [n.lat, n.lon] : null;
    }
    return null;
  };
  const lim = (v) => { const n = parseInt(v, 10); return n >= 5 && n <= 200 && /^\d+$/.test(String(v).trim()) ? n : null; };
  const dirOf = (v) => {
    if (!v) return null;
    const card = { N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5, S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5 };
    const first = String(v).split(';')[0].trim().toUpperCase();
    if (first in card) return card[first];
    const n = parseFloat(first);
    return isFinite(n) && n >= 0 && n <= 360 ? n % 360 : null;
  };
  const out = [];
  const consumed = new Set();
  const devDir = new Map();
  for (const r of rels) {
    const t = r.tags || {};
    if (t.type !== 'enforcement') continue;
    const from = (r.members || []).find((m) => m.role === 'from');
    const to = (r.members || []).find((m) => m.role === 'to');
    const devices = (r.members || []).filter((m) => m.role === 'device' && m.type === 'node');
    const pFrom = from && pos(from), pTo = to && pos(to);
    if (t.enforcement === 'average_speed') {
      const pts = devices.map(pos).filter(Boolean);
      const a = pFrom || pts[0], b = pTo || pts[pts.length - 1];
      if (!a || !b || dist(a[0], a[1], b[0], b[1]) < 40) continue;
      devices.forEach((d) => consumed.add(d.ref));
      out.push({ id: `osm-r${r.id}`, tipo: 'tramo', lat: a[0], lon: a[1], fin: b, rumbo: Math.round(bearing(a[0], a[1], b[0], b[1])), limite: lim(t.maxspeed), fuente: 'osm' });
    } else if (t.enforcement === 'maxspeed' || t.enforcement === 'traffic_signals') {
      for (const d of devices) {
        const dir = pFrom && pTo && dist(pFrom[0], pFrom[1], pTo[0], pTo[1]) > 40 ? Math.round(bearing(pFrom[0], pFrom[1], pTo[0], pTo[1])) : null;
        devDir.set(d.ref, { dir, lim: lim(t.maxspeed), tipo: t.enforcement === 'traffic_signals' ? 'semaforo' : 'fijo' });
      }
    }
  }
  for (const n of nodes.values()) {
    const t = n.tags || {};
    const isCam = t.highway === 'speed_camera';
    const rel = devDir.get(n.id);
    if ((!isCam && !rel) || consumed.has(n.id) || n.lat == null) continue;
    out.push({
      id: `osm-n${n.id}`, tipo: rel?.tipo || 'fijo', lat: n.lat, lon: n.lon,
      rumbo: dirOf(t.direction) ?? rel?.dir ?? null, limite: lim(t.maxspeed) ?? rel?.lim ?? null, fuente: 'osm',
    });
  }
  return out;
}

export class RadarDB {
  constructor() {
    this.main = [];
    this.meta = null;
    this.osmCells = {};
    this.reports = store.get('reports', []);
    this.all = [];
    this.grid = new Map();
    this.listeners = new Set();
  }

  onChange(fn) { this.listeners.add(fn); }
  _emit() { for (const fn of this.listeners) fn(this); }

  async init() {
    const cached = await idb.get('radares');
    if (cached?.radares) this._setMain(cached);
    const cells = await idb.get('osmCells');
    if (cells) this.osmCells = cells;
    this._rebuild();
    this.refresh(!cached).catch(() => {});
    setInterval(() => this.refresh(false).catch(() => {}), 30 * 60e3);
  }

  _setMain(data) {
    this.main = (data.radares || []).filter((r) => isFinite(r.lat) && isFinite(r.lon) && RADAR_TYPES[r.tipo]);
    this.meta = { generado: data.generado, fuentes: data.fuentes || [], total: this.main.length };
  }

  /** Descarga la base si han pasado más de N horas (o si force). */
  async refresh(force) {
    const last = store.get('radarCheckedAt', 0);
    if (!force && this.meta && Date.now() - last < CONFIG.radarRefreshHours * H) return { changed: false };
    let data = null, lastErr;
    for (const url of [].concat(CONFIG.radarData)) {
      try {
        data = await fetchJSON(`${url}?t=${Date.now()}`, { timeout: 20000, cache: 'no-store' });
        // La copia incluida en la app solo vale si no tenemos nada mejor
        if (this.meta && !/^https?:/.test(url) && data.generado <= this.meta.generado) return { changed: false };
        break;
      } catch (e) { lastErr = e; data = null; }
    }
    if (!data) throw lastErr || new Error('Sin datos de radares');
    store.set('radarCheckedAt', Date.now());
    if (!Array.isArray(data.radares) || data.radares.length < 1) throw new Error('Base de radares no válida');
    const changed = !this.meta || data.generado !== this.meta.generado || data.radares.length !== this.meta.total;
    if (changed) {
      this._setMain(data);
      await idb.set('radares', data);
      this._rebuild();
    }
    return { changed, total: this.main.length };
  }

  /** Radares de OpenStreetMap en directo alrededor de una posición (celdas de 0,5°, caché 7 días). */
  async ensureOsmAround(lat, lon) {
    const c = 0.5;
    const cy = Math.floor(lat / c), cx = Math.floor(lon / c);
    const k = `${cy}:${cx}`;
    const cell = this.osmCells[k];
    if (cell && Date.now() - cell.t < 7 * 24 * H) return false;
    if (this._osmBusy) return false;
    this._osmBusy = true;
    try {
      const s = cy * c, w = cx * c, n = s + c, e = w + c;
      const q = `[out:json][timeout:25];(node["highway"="speed_camera"](${s},${w},${n},${e});relation["type"="enforcement"](${s},${w},${n},${e}););out body;>;out skel qt;`;
      let json = null;
      for (const url of CONFIG.overpass) {
        try {
          const r = await fetchWithTimeout(url, { method: 'POST', body: `data=${encodeURIComponent(q)}`, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 30000 });
          if (r.ok) { json = await r.json(); break; }
        } catch { /* siguiente servidor */ }
      }
      if (!json) return false;
      this.osmCells[k] = { t: Date.now(), radares: parseOverpass(json) };
      await idb.set('osmCells', this.osmCells);
      this._rebuild();
      return true;
    } finally {
      this._osmBusy = false;
    }
  }

  // ----- Reportes personales -----
  addReport(type, lat, lon, heading) {
    const def = REPORT_TYPES[type];
    const rep = { id: `rep-${uid()}`, type, lat, lon, rumbo: heading ?? null, t: Date.now(), exp: def.ttl ? Date.now() + def.ttl : null };
    this.reports.push(rep);
    this._saveReports();
    return rep;
  }
  removeReport(id) { this.reports = this.reports.filter((r) => r.id !== id); this._saveReports(); }
  clearExpired() { const n = this.reports.length; this.reports = this.reports.filter((r) => !r.exp || r.exp > Date.now()); if (n !== this.reports.length) this._saveReports(); }
  importReports(list) {
    const ids = new Set(this.reports.map((r) => r.id));
    for (const r of list) if (r?.id && REPORT_TYPES[r.type] && isFinite(r.lat) && !ids.has(r.id)) this.reports.push(r);
    this._saveReports();
  }
  _saveReports() { store.set('reports', this.reports); this._rebuild(); }

  activeReports() { const now = Date.now(); return this.reports.filter((r) => !r.exp || r.exp > now); }

  _rebuild() {
    const merged = [...this.main];
    // OSM en directo: solo lo que no esté ya en la base principal
    const mainGrid = new Map();
    for (const r of this.main) {
      const k = key(r.lat, r.lon);
      if (!mainGrid.has(k)) mainGrid.set(k, []);
      mainGrid.get(k).push(r);
    }
    for (const cell of Object.values(this.osmCells)) {
      for (const r of cell.radares || []) {
        const k = key(r.lat, r.lon);
        const dupe = (mainGrid.get(k) || []).some((m) => dist(m.lat, m.lon, r.lat, r.lon) < 80);
        if (!dupe) merged.push(r);
      }
    }
    for (const rep of this.activeReports()) {
      const def = REPORT_TYPES[rep.type];
      if (def.radar) merged.push({ id: rep.id, tipo: def.radar, lat: rep.lat, lon: rep.lon, rumbo: rep.rumbo, limite: null, fuente: 'personal', report: rep });
    }
    this.all = merged;
    this.grid = new Map();
    for (const r of merged) {
      const k = key(r.lat, r.lon);
      if (!this.grid.has(k)) this.grid.set(k, []);
      this.grid.get(k).push(r);
    }
    this._emit();
  }

  near(lat, lon, radius) {
    const dLat = radius / 111000, dLon = radius / (111000 * Math.cos((lat * Math.PI) / 180));
    return this.inBBox(lon - dLon, lat - dLat, lon + dLon, lat + dLat);
  }

  inBBox(w, s, e, n) {
    const out = [];
    for (let y = Math.floor(s / CELL); y <= Math.floor(n / CELL); y++) {
      for (let x = Math.floor(w / CELL); x <= Math.floor(e / CELL); x++) {
        const list = this.grid.get(`${y}:${x}`);
        if (list) for (const r of list) if (r.lat >= s && r.lat <= n && r.lon >= w && r.lon <= e) out.push(r);
      }
    }
    return out;
  }

  /** GeoJSON para el mapa. */
  geojson() {
    const features = [];
    for (const r of this.all) {
      const t = RADAR_TYPES[r.tipo];
      features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [r.lon, r.lat] }, properties: { id: r.id, icon: t.icon, lim: r.limite || '', tipo: r.tipo } });
      if (r.fin) features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[r.lon, r.lat], [r.fin[1], r.fin[0]]] }, properties: { id: r.id, tipo: 'tramo-linea' } });
    }
    for (const rep of this.activeReports()) {
      const def = REPORT_TYPES[rep.type];
      if (def.radar) continue;
      features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [rep.lon, rep.lat] }, properties: { id: rep.id, icon: def.icon, lim: '', tipo: 'reporte' } });
    }
    return { type: 'FeatureCollection', features };
  }

  byId(id) { return this.all.find((r) => r.id === id) || this.reports.find((r) => r.id === id); }
}

/** Radares sobre una ruta: distancia a lo largo de la ruta y compatibilidad de sentido. */
export function radarsOnRoute(route, db, enabledTypes) {
  const [w, s, e, n] = bboxOf(route.coords, 0.01);
  const cands = db.inBBox(w, s, e, n).filter((r) => enabledTypes[r.tipo] !== false);
  const c = route.coords;
  const out = [];
  const nearest = (lat, lon) => {
    let best = null;
    for (let i = 0; i < c.length - 1; i++) {
      // prefiltro barato
      const minLat = Math.min(c[i][1], c[i + 1][1]) - 0.002, maxLat = Math.max(c[i][1], c[i + 1][1]) + 0.002;
      if (lat < minLat || lat > maxLat) continue;
      const minLon = Math.min(c[i][0], c[i + 1][0]) - 0.003, maxLon = Math.max(c[i][0], c[i + 1][0]) + 0.003;
      if (lon < minLon || lon > maxLon) continue;
      const p = projectToSegment(lat, lon, c[i][1], c[i][0], c[i + 1][1], c[i + 1][0]);
      if (!best || p.d < best.d) best = { d: p.d, i, along: route.cum[i] + p.t * (route.cum[i + 1] - route.cum[i]) };
    }
    return best;
  };
  for (const r of cands) {
    const a = nearest(r.lat, r.lon);
    if (!a || a.d > (r.tipo === 'tramo' ? 45 : 30)) continue;
    const segB = bearing(c[a.i][1], c[a.i][0], c[a.i + 1][1], c[a.i + 1][0]);
    if (r.rumbo != null && angDiff(r.rumbo, segB) > 70) continue;
    const item = { radar: r, along: a.along };
    if (r.fin) {
      const b = nearest(r.fin[0], r.fin[1]);
      if (!b || b.d > 70 || b.along <= a.along) continue;
      item.alongEnd = b.along;
    }
    out.push(item);
  }
  for (const rep of db.activeReports()) {
    const def = REPORT_TYPES[rep.type];
    if (def.radar) continue;
    if (rep.lon < w || rep.lon > e || rep.lat < s || rep.lat > n) continue;
    const a = nearest(rep.lat, rep.lon);
    if (a && a.d < 40) out.push({ report: rep, along: a.along });
  }
  out.sort((x, y) => x.along - y.along);
  return out;
}

/**
 * Vigila la posición y genera avisos. cb: speak(text, opts), sound(kind), update(state)
 * state = { alert: {...}|null, section: {...}|null }
 */
export class RadarWatcher {
  constructor(db, getSettings, cb) {
    this.db = db;
    this.getSettings = getSettings;
    this.cb = cb;
    this.memo = new Map();
    this.route = null;
    this.onRoute = [];
    this.section = null;
    this.lastFix = null;
    this.lastState = null;
  }

  setRoute(route) {
    this.route = route;
    this.onRoute = route ? radarsOnRoute(route, this.db, this.getSettings().radarTypes) : [];
    return this.onRoute;
  }

  _memo(id) {
    let m = this.memo.get(id);
    if (!m) { m = { far: false, near: false, passed: false, overAt: 0, t: Date.now() }; this.memo.set(id, m); }
    m.t = Date.now();
    return m;
  }

  _cleanup() {
    const now = Date.now();
    for (const [k, v] of this.memo) if (now - v.t > 5 * 60e3) this.memo.delete(k);
  }

  update(fix, nav) {
    const S = this.getSettings();
    const kmh = (fix.speed || 0) * 3.6;
    const alertDist = S.alertDistance === 'auto' ? clamp(kmh * 8, 300, 1000) : Number(S.alertDistance) || 500;
    const nearDist = clamp((fix.speed || 0) * 5, 100, 250);
    const tol = 1 + (Number(S.overTolerance) || 0) / 100;
    const useRoute = nav && this.route && !nav.offRoute && nav.offset < 60;

    // Odómetro para tramos
    const now = Date.now();
    if (this.section && this.lastFix) {
      const d = dist(this.lastFix.lat, this.lastFix.lon, fix.lat, fix.lon);
      const dt = Math.max(0.2, (now - (this.lastFixAt || now)) / 1000);
      // Un salto imposible (>250 km/h) es un fallo del GPS: no cuenta para la media del tramo
      if (d / dt < 70) this.section.odo += d; else this.section.t0 += dt * 1000;
    }
    this.lastFix = fix;
    this.lastFixAt = now;

    let best = null; // {radar|report, d, limit}
    if (useRoute) {
      for (const it of this.onRoute) {
        const d = it.along - nav.along;
        if (d < -25) continue;
        if (d > alertDist) break;
        const id = (it.radar || it.report).id;
        if (this._memo(id).passed) continue;
        if (it.report && !S.reportAlerts) continue;
        best = { ...it, d: Math.max(0, d) };
        break;
      }
      // Marcar como pasados
      for (const it of this.onRoute) {
        const d = it.along - nav.along;
        if (d < -25 && d > -400) this._memo((it.radar || it.report).id).passed = true;
      }
    } else if (fix.heading != null && (fix.speed || 0) > 2) {
      const cands = this.db.near(fix.lat, fix.lon, alertDist + 100);
      for (const r of cands) {
        if (S.radarTypes[r.tipo] === false) continue;
        const d = dist(fix.lat, fix.lon, r.lat, r.lon);
        if (d > alertDist) continue;
        const m = this._memo(r.id);
        const brg = bearing(fix.lat, fix.lon, r.lat, r.lon);
        const ahead = angDiff(brg, fix.heading) < (d < 150 ? 50 : 28);
        if (m.near && (!ahead || d > (m.lastD ?? d) + 15)) m.passed = true; // ya lo hemos pasado
        m.lastD = d;
        if (m.passed || !ahead) continue;
        if (r.rumbo != null && angDiff(r.rumbo, fix.heading) > 70) continue;
        if (!best || d < best.d) best = { radar: r, d };
      }
      if (S.reportAlerts) {
        for (const rep of this.db.activeReports()) {
          if (REPORT_TYPES[rep.type].radar) continue;
          const d = dist(fix.lat, fix.lon, rep.lat, rep.lon);
          if (d > alertDist) continue;
          const brg = bearing(fix.lat, fix.lon, rep.lat, rep.lon);
          if (angDiff(brg, fix.heading) > 30) continue;
          const m = this._memo(rep.id);
          if (m.passed) continue;
          if (!best || d < best.d) best = { report: rep, d };
        }
      }
    }

    // ----- Aviso del objetivo más cercano -----
    let alert = null;
    if (best) {
      const item = best.radar || best.report;
      const m = this._memo(item.id);
      if (best.radar) {
        const r = best.radar;
        const t = RADAR_TYPES[r.tipo];
        const limit = r.limite || nav?.limit || null;
        const over = !!(limit && kmh > limit * tol);
        if (!m.far) {
          m.far = true;
          this.cb.sound?.('radar');
          const limTxt = limit && ['fijo', 'tramo', 'movil'].includes(r.tipo) ? `. Límite ${limit}` : '';
          this.cb.speak?.(`${t.speak} a ${speakDist(best.d)}${limTxt}.`, { priority: 'high' });
        }
        if (!m.near && best.d <= nearDist) { m.near = true; this.cb.sound?.('near'); }
        if (over && ['fijo', 'tramo', 'movil'].includes(r.tipo) && S.overspeedAlerts) {
          const now = Date.now();
          if (now - m.overAt > 2500) {
            if (!m.overAt) this.cb.speak?.('Reduce la velocidad.', { priority: 'high' });
            m.overAt = now;
            this.cb.sound?.('over');
          }
        }
        alert = { kind: 'radar', radar: r, type: t, d: best.d, limit, over, alertDist };
        // Llegada al inicio de un tramo
        if (r.tipo === 'tramo' && r.fin && best.d < 35 && (!this.section || this.section.radar.id !== r.id)) this._startSection(r, best, fix);
      } else {
        const rep = best.report;
        const def = REPORT_TYPES[rep.type];
        if (!m.far) {
          m.far = true;
          this.cb.sound?.('near');
          this.cb.speak?.(`${def.speak} a ${speakDist(best.d)}.`);
        }
        if (best.d < 30) m.passed = true;
        alert = { kind: 'report', report: rep, type: def, d: best.d, alertDist };
      }
    }

    // Activación de tramo en modo libre (por si el radar del inicio no se avisó)
    if (!this.section && !useRoute && fix.heading != null) {
      for (const r of this.db.near(fix.lat, fix.lon, 60)) {
        if (r.tipo !== 'tramo' || !r.fin || S.radarTypes.tramo === false) continue;
        const dirSec = r.rumbo ?? bearing(r.lat, r.lon, r.fin[0], r.fin[1]);
        if (dist(fix.lat, fix.lon, r.lat, r.lon) < 40 && angDiff(dirSec, fix.heading) < 60 && !this._memo(r.id).sectionDone) {
          this._startSection(r, null, fix);
          break;
        }
      }
    }

    // ----- Tramo activo -----
    let section = null;
    if (this.section) {
      const sec = this.section;
      const r = sec.radar;
      const elapsed = (Date.now() - sec.t0) / 1000;
      const avg = elapsed > 4 ? (sec.odo / elapsed) * 3.6 : kmh;
      let remaining;
      if (useRoute && sec.alongEnd != null) remaining = sec.alongEnd - nav.along;
      else remaining = dist(fix.lat, fix.lon, r.fin[0], r.fin[1]);
      const limit = r.limite || nav?.limit || null;
      const over = !!(limit && avg > limit * tol && elapsed > 15);
      if (over && S.overspeedAlerts && Date.now() - (sec.warnAt || 0) > 20000) {
        sec.warnAt = Date.now();
        this.cb.sound?.('over');
        this.cb.speak?.('Tu velocidad media supera el límite del tramo.', { priority: 'high' });
      }
      if (!useRoute) {
        if (remaining < 50) sec.closeToEnd = true;
        if (sec.closeToEnd && remaining > (sec.minRemaining ?? remaining) + 25) remaining = -1; // nos alejamos del final
        sec.minRemaining = Math.min(sec.minRemaining ?? remaining, remaining);
      }
      const ended = remaining < 15 || sec.odo > sec.length * 1.7 + 300;
      if (ended) {
        this._memo(r.id).sectionDone = true;
        this.cb.sound?.('section');
        this.cb.speak?.(`Fin del tramo. Velocidad media: ${Math.round(avg)} kilómetros por hora.`);
        this.section = null;
      } else {
        section = { radar: r, avg, limit, remaining: Math.max(0, remaining), length: sec.length, over, elapsed };
      }
    }

    if (Math.random() < 0.02) this._cleanup();
    const state = { alert, section };
    this.lastState = state;
    return state;
  }

  _startSection(r, routeItem, fix) {
    const onRoute = this.onRoute.find((it) => it.radar?.id === r.id);
    this.section = {
      radar: r, t0: Date.now(), odo: 0,
      alongEnd: onRoute?.alongEnd ?? null,
      length: onRoute?.alongEnd != null ? onRoute.alongEnd - onRoute.along : dist(r.lat, r.lon, r.fin[0], r.fin[1]),
    };
    this.lastFix = fix;
    this.lastFixAt = Date.now();
    this.cb.sound?.('section');
    this.cb.speak?.(`Inicio de tramo de velocidad media${r.limite ? `. Límite ${r.limite}` : ''}.`, { priority: 'high' });
  }

  reset() { this.memo.clear(); this.section = null; }
}

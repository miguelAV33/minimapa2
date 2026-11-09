// Incidencias de tráfico de la DGT (accidentes, cortes, obras, retenciones…) y zonas de bajas emisiones (ZBE).
// Las incidencias salen del Punto de Acceso Nacional de la DGT (DATEX II v3.7, se actualiza cada pocos minutos).
// Las ZBE salen del mismo sitio, convertidas cada día por GitHub Actions a data/zbe.json.
import { CONFIG } from './config.js';
import { dist, bearing, angDiff, projectToSegment, bboxOf, clamp, speakDist, fetchWithTimeout } from './util.js';
import { NATIVE, Native } from './native.js';

export const INCIDENT_TYPES = {
  corte: { label: 'Carretera cortada', icon: 'inc-corte', speak: 'Carretera cortada', range: 3000, prio: 7 },
  accidente: { label: 'Accidente', icon: 'inc-accidente', speak: 'Accidente', range: 2000, prio: 6 },
  retencion: { label: 'Retención', icon: 'inc-retencion', speak: 'Retención', range: 2000, prio: 5 },
  obstaculo: { label: 'Obstáculo en la vía', icon: 'inc-obstaculo', speak: 'Obstáculo en la vía', range: 1000, prio: 4 },
  vehiculo: { label: 'Vehículo detenido', icon: 'inc-vehiculo', speak: 'Vehículo detenido', range: 700, prio: 3 },
  clima: { label: 'Tiempo adverso', icon: 'inc-clima', speak: 'Precaución', range: 1500, prio: 2 },
  obras: { label: 'Obras', icon: 'inc-obras', speak: 'Obras', range: 1000, prio: 1 },
};

const TEXTS = {
  // gestión de carriles y calzadas
  laneClosures: 'Carril cortado', carriagewayClosures: 'Calzada cortada', roadClosed: 'Carretera cortada',
  singleAlternateLineTraffic: 'Paso alternativo', narrowLanes: 'Carriles estrechos', intermittentShortTermClosures: 'Cortes intermitentes',
  lanesDeviated: 'Desvío de carriles', newRoadworksLayout: 'Nuevo trazado por obras', useOfSpecifiedLanesOrCarriagewaysAllowed: 'Circula por los carriles señalizados',
  doNotUseSpecifiedLanesOrCarriageways: 'Carriles no utilizables', weightRestrictionInOperation: 'Restricción de peso', contraflow: 'Circulación en sentido contrario',
  // causas detalladas
  roadworks: 'Obras', accident: 'Accidente', vehicleStuck: 'Vehículo detenido', vehicleOnFire: 'Vehículo en llamas', brokenDownVehicle: 'Vehículo averiado',
  vehicleWithOverwideLoad: 'Transporte especial', obstructionOnTheRoad: 'Obstáculo en la calzada', objectOnTheRoad: 'Objeto en la calzada',
  spillageOnTheRoad: 'Derrame en la calzada', rockfalls: 'Desprendimientos', flooding: 'Inundación', avalanches: 'Aludes', landslips: 'Corrimiento de tierras',
  fallenTrees: 'Árbol caído', animalsOnTheRoad: 'Animales en la vía', damagedRoadSurface: 'Firme dañado', roadSurfaceInPoorCondition: 'Firme en mal estado',
  slipperyRoad: 'Calzada deslizante', rain: 'Lluvia', heavyRain: 'Lluvia intensa', fog: 'Niebla', denseFog: 'Niebla densa', visibilityReduced: 'Visibilidad reducida',
  strongWinds: 'Viento fuerte', snowfall: 'Nieve', heavySnowfall: 'Nevada intensa', ice: 'Hielo', blackIce: 'Hielo en la calzada', badWeather: 'Mal tiempo',
  smokeHazard: 'Humo', slowTraffic: 'Tráfico lento', queuingTraffic: 'Retención', stationaryTraffic: 'Tráfico detenido', heavyTraffic: 'Tráfico denso',
};
const COMPASS = { northBound: 0, northEastBound: 45, eastBound: 90, southEastBound: 135, southBound: 180, southWestBound: 225, westBound: 270, northWestBound: 315 };
const DETAIL_KEYS = ['roadMaintenanceType', 'accidentType', 'abnormalTrafficType', 'vehicleObstructionType', 'obstructionType', 'environmentalObstructionType',
  'poorEnvironmentType', 'infrastructureDamageType', 'nonWeatherRelatedRoadConditionType', 'weatherRelatedRoadConditionType', 'animalPresenceType'];

// Lectura rápida del XML de DATEX II con expresiones regulares (no hace falta DOM: funciona igual en Node y en el móvil)
const tagRe = (name) => new RegExp(`<(?:[\\w-]+:)?${name}\\b[^>]*>([^<]*)</(?:[\\w-]+:)?${name}>`);
const tagAllRe = (name) => new RegExp(`<(?:[\\w-]+:)?${name}\\b[^>]*>([^<]*)</(?:[\\w-]+:)?${name}>`, 'g');
const RE = Object.fromEntries(['causeType', 'roadOrCarriagewayOrLaneManagementType', 'overallStartTime', 'overallEndTime', 'validityStatus', 'roadName',
  'tpegDirection', 'tpegDirectionRoad', 'kilometerPoint', 'municipality', 'province', 'temporarySpeedLimit', 'genericSituationRecordName', 'severity']
  .map((n) => [n, tagRe(n)]));
const DETAIL_RE = DETAIL_KEYS.map((k) => tagAllRe(k));
const get = (s, n) => { const m = RE[n].exec(s); return m ? m[1].trim() : ''; };
function pointIn(block) {
  if (!block) return null;
  const la = /<(?:[\w-]+:)?latitude>([-\d.]+)</.exec(block), lo = /<(?:[\w-]+:)?longitude>([-\d.]+)</.exec(block);
  if (!la || !lo) return null;
  const lat = Number(la[1]), lon = Number(lo[1]);
  if (!(lat > 26 && lat < 48 && lon > -19 && lon < 9)) return null; // España (con margen)
  const km = get(block, 'kilometerPoint');
  return { lat, lon, km: km ? Number(km) : null };
}
const section = (s, name) => {
  const m = new RegExp(`<(?:[\\w-]+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${name}>`).exec(s);
  return m ? m[1] : null;
};

function classify(rec, type) {
  const mgmt = get(rec, 'roadOrCarriagewayOrLaneManagementType');
  const cause = get(rec, 'causeType');
  const details = [];
  for (const re of DETAIL_RE) { re.lastIndex = 0; let m; while ((m = re.exec(rec))) details.push(m[1].trim()); }
  let t = null;
  if (mgmt === 'roadClosed' || mgmt === 'carriagewayClosures') t = 'corte';
  else if (cause === 'accident' || type === 'Accident') t = 'accidente';
  else if (cause === 'abnormalTraffic' || type === 'AbnormalTraffic') t = 'retencion';
  else if (cause === 'vehicleObstruction' || type === 'VehicleObstruction') t = 'vehiculo';
  else if (cause === 'poorEnvironment' || cause === 'poorEnvironmentConditions' || type === 'PoorEnvironmentConditions' || type === 'WeatherRelatedRoadConditions'
    || details.includes('slipperyRoad')) t = 'clima';
  else if (['obstruction', 'environmentalObstruction', 'infrastructureDamageObstruction', 'animalPresenceObstruction'].includes(cause)
    || ['GeneralObstruction', 'NonWeatherRelatedRoadConditions', 'EnvironmentalObstruction', 'InfrastructureDamageObstruction', 'AnimalPresenceObstruction'].includes(type)) t = 'obstaculo';
  else if (cause === 'roadMaintenance' || type === 'MaintenanceWorks' || type === 'ConstructionWorks' || type === 'RoadOrCarriagewayOrLaneManagement') t = 'obras';
  const texts = [];
  for (const d of details) if (TEXTS[d] && !texts.includes(TEXTS[d])) texts.push(TEXTS[d]);
  if (mgmt && TEXTS[mgmt] && !texts.includes(TEXTS[mgmt])) texts.push(TEXTS[mgmt]);
  const lim = get(rec, 'temporarySpeedLimit');
  if (lim) texts.push(`Límite temporal ${Math.round(Number(lim))}`);
  return { t, texts, mgmt, limit: lim ? Math.round(Number(lim)) : null };
}

/**
 * Convierte el XML de incidencias de la DGT en una lista compacta.
 * Cada situación (puede tener varios registros) se queda con el tipo más importante.
 */
export function parseDatex(xml, now = Date.now()) {
  const out = [];
  const chunks = xml.split(/<(?:[\w-]+:)?situation\s/).slice(1);
  for (const ch of chunks) {
    const sitId = (/^[^>]*\bid="([^"]+)"/.exec(ch) || [])[1] || '';
    const recs = ch.split(/<(?:[\w-]+:)?situationRecord\s/).slice(1);
    let best = null;
    const texts = [];
    let limit = null;
    for (const rec of recs) {
      const head = rec.slice(0, rec.indexOf('>'));
      const type = ((/type="(?:[\w-]+:)?(\w+)"/.exec(head) || [])[1]) || '';
      if (type === 'GeneralInstructionOrMessageToRoadUsers') continue;
      const status = get(rec, 'validityStatus');
      if (status && status !== 'active' && status !== 'definedByValidityTimeSpec') continue;
      const start = Date.parse(get(rec, 'overallStartTime')) || null;
      const end = Date.parse(get(rec, 'overallEndTime')) || null;
      if (start && start > now + 10 * 60e3) continue; // aún no ha empezado
      if (end && end < now) continue; // ya ha terminado
      const c = classify(rec, type);
      for (const tx of c.texts) if (!texts.includes(tx)) texts.push(tx);
      if (c.limit) limit = c.limit;
      if (!c.t) continue;
      const loc = section(rec, 'locationReference') || rec;
      const from = pointIn(section(loc, 'from')), to = pointIn(section(loc, 'to'));
      const pt = from || to || pointIn(section(loc, 'point')) || pointIn(loc);
      if (!pt) continue;
      const cand = { type: c.t, mgmt: c.mgmt, start, end, loc, from, to, pt };
      if (!best || INCIDENT_TYPES[c.t].prio > INCIDENT_TYPES[best.type].prio) best = cand;
    }
    if (!best) continue;
    const { loc, from, to, pt } = best;
    const comp = COMPASS[get(loc, 'tpegDirection')];
    const dirRoad = get(loc, 'tpegDirectionRoad');
    const label = best.type === 'corte' && best.mgmt === 'carriagewayClosures' ? 'Calzada cortada' : INCIDENT_TYPES[best.type].label;
    const item = {
      id: `dgt-${sitId}`, type: best.type, label,
      text: texts.filter((x) => x !== label).slice(0, 3).join(' · '),
      lat: pt.lat, lon: pt.lon,
      road: get(loc, 'roadName') || '', km: pt.km ?? null,
      dir: comp ?? null, both: dirRoad === 'both' || comp == null,
      town: get(loc, 'municipality') || get(loc, 'province') || '',
      start: best.start, end: best.end, limit,
    };
    if (from && to && dist(from.lat, from.lon, to.lat, to.lon) > 30) { item.lat2 = to.lat; item.lon2 = to.lon; }
    out.push(item);
  }
  return out;
}

/** Posición de un elemento sobre la ruta: distancia a lo largo y desvío lateral. */
function nearestOnRoute(route, lat, lon) {
  const c = route.coords;
  let best = null;
  for (let i = 0; i < c.length - 1; i++) {
    const minLat = Math.min(c[i][1], c[i + 1][1]) - 0.002, maxLat = Math.max(c[i][1], c[i + 1][1]) + 0.002;
    if (lat < minLat || lat > maxLat) continue;
    const minLon = Math.min(c[i][0], c[i + 1][0]) - 0.003, maxLon = Math.max(c[i][0], c[i + 1][0]) + 0.003;
    if (lon < minLon || lon > maxLon) continue;
    const p = projectToSegment(lat, lon, c[i][1], c[i][0], c[i + 1][1], c[i + 1][0]);
    if (!best || p.d < best.d) best = { d: p.d, i, along: route.cum[i] + p.t * (route.cum[i + 1] - route.cum[i]) };
  }
  return best;
}

export class IncidentDB {
  constructor() {
    this.items = [];
    this.fetchedAt = 0;
    this.published = 0;
    this.listeners = new Set();
    this.loading = null;
    this.error = null;
  }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _emit() { for (const fn of this.listeners) { try { fn(this); } catch (e) { console.warn(e); } } }

  /** Descarga las incidencias. En el APK va directo a la DGT; en el navegador, a la copia de GitHub Pages. */
  load(force = false) {
    if (this.loading) return this.loading;
    if (!force && Date.now() - this.fetchedAt < 4 * 60e3) return Promise.resolve(this.items);
    this.loading = (async () => {
      try {
        const xml = await fetchIncidentsXml();
        const pub = Date.parse((/<(?:[\w-]+:)?publicationTime>([^<]+)</.exec(xml) || [])[1] || '') || Date.now();
        // Una copia vieja (más de 2 h) es peor que nada: los cortes y accidentes cambian rápido
        if (Date.now() - pub > 2 * 3600e3) throw new Error('datos de incidencias antiguos');
        this.items = parseDatex(xml);
        this.published = pub;
        this.fetchedAt = Date.now();
        this.error = null;
        this._emit();
      } catch (e) {
        this.error = e;
        this.fetchedAt = Date.now() - 3 * 60e3; // reintentar en un par de minutos
        console.warn('Incidencias DGT:', e?.message || e);
      } finally {
        this.loading = null;
      }
      return this.items;
    })();
    return this.loading;
  }

  inBBox(w, s, e, n) { return this.items.filter((i) => i.lon >= w && i.lon <= e && i.lat >= s && i.lat <= n); }

  geojson(enabled = true) {
    if (!enabled) return { type: 'FeatureCollection', features: [] };
    return {
      type: 'FeatureCollection',
      features: this.items.map((i) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [i.lon, i.lat] }, properties: { id: i.id, icon: INCIDENT_TYPES[i.type].icon, prio: INCIDENT_TYPES[i.type].prio } })),
    };
  }

  byId(id) { return this.items.find((i) => i.id === id); }

  /** Incidencias en una ruta, en el sentido de la marcha, ordenadas por distancia. */
  onRoute(route) {
    if (!route || !this.items.length) return [];
    const [w, s, e, n] = bboxOf(route.coords, 0.01);
    const out = [];
    for (const inc of this.inBBox(w, s, e, n)) {
      const a = nearestOnRoute(route, inc.lat, inc.lon);
      let b = inc.lat2 != null ? nearestOnRoute(route, inc.lat2, inc.lon2) : null;
      if (b && b.d > 60) b = null;
      if (!a || a.d > (inc.type === 'retencion' || inc.type === 'corte' ? 60 : 45)) {
        if (!b) continue;
      }
      const hit = a && a.d <= 60 ? a : b;
      const segB = bearing(route.coords[hit.i][1], route.coords[hit.i][0], route.coords[hit.i + 1][1], route.coords[hit.i + 1][0]);
      // En autovías las dos calzadas están a pocos metros: se descarta lo que va en sentido contrario
      if (!inc.both && inc.dir != null && angDiff(inc.dir, segB) > 80) continue;
      const along = Math.min(a && a.d <= 60 ? a.along : Infinity, b ? b.along : Infinity);
      const alongEnd = Math.max(a && a.d <= 60 ? a.along : -Infinity, b ? b.along : -Infinity);
      out.push({ inc, along, alongEnd: alongEnd > along ? alongEnd : along });
    }
    out.sort((x, y) => x.along - y.along);
    return out;
  }
}

async function fetchIncidentsXml() {
  const http = NATIVE ? Native.http : null;
  let lastErr;
  if (http) {
    // La DGT no permite leer sus datos desde una web (sin CORS): en el APK se piden con la conexión nativa (comprimida, ~200 KB)
    try {
      const r = await http.get({ url: CONFIG.dgtIncidents, responseType: 'text', connectTimeout: 12000, readTimeout: 30000, headers: { Accept: 'application/xml' } });
      if (r.status === 200 && typeof r.data === 'string' && r.data.length > 200) return r.data;
      lastErr = new Error(`DGT ${r.status}`);
    } catch (e) { lastErr = e; }
  }
  for (const url of CONFIG.incidentData) {
    try {
      const res = await fetchWithTimeout(url, { timeout: 30000, cache: 'no-store' });
      if (res.ok) return await res.text();
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('sin datos de incidencias');
}

// ======================================================================
// Zonas de bajas emisiones
// ======================================================================
/** Etiquetas ambientales de la DGT, de la más limpia a la más contaminante. */
export const STICKERS = [
  ['0', 'Cero emisiones (azul)'],
  ['ECO', 'ECO (azul y verde)'],
  ['C', 'C (verde)'],
  ['B', 'B (amarilla)'],
  ['A', 'Sin etiqueta'],
];
export const stickerRank = (s) => ({ 0: 0, '0': 0, ECO: 1, C: 2, B: 3, A: 4 })[s] ?? null;
export const stickerName = (s) => (STICKERS.find(([k]) => k === s) || [])[1] || '';

function inRing(lon, lat, ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

export class ZbeDB {
  constructor() { this.zones = []; this.listeners = new Set(); }
  onChange(fn) { this.listeners.add(fn); }
  set(data) {
    const zones = (data?.zones || []).filter((z) => Array.isArray(z.parts) && z.parts.length);
    for (const z of zones) if (!z.bbox) z.bbox = bboxOf(z.parts.flat());
    this.zones = zones;
    for (const fn of this.listeners) fn(this);
  }
  async load() {
    for (const url of CONFIG.zbeData) {
      try {
        const res = await fetchWithTimeout(url, { timeout: 20000 });
        if (!res.ok) continue;
        const data = await res.json();
        if (data?.zones?.length) { this.set(data); return true; }
      } catch { /* siguiente */ }
    }
    return false;
  }
  zonesAt(lat, lon) {
    return this.zones.filter((z) => lon >= z.bbox[0] && lon <= z.bbox[2] && lat >= z.bbox[1] && lat <= z.bbox[3] && z.parts.some((p) => inRing(lon, lat, p)));
  }
  /** ¿Puede entrar un coche con esta etiqueta? null = no se sabe (sin etiqueta configurada o zona sin reglas). */
  allowed(zone, sticker) {
    const r = stickerRank(sticker);
    if (r == null || zone.deny == null) return null;
    return r < zone.deny;
  }
  /** Zonas que atraviesa una ruta: dónde se entra y si el destino está dentro. */
  onRoute(route) {
    if (!route || !this.zones.length) return [];
    const [w, s, e, n] = bboxOf(route.coords);
    const c = route.coords;
    const out = [];
    for (const z of this.zones) {
      const [zw, zs, ze, zn] = z.bbox;
      if (zw > e || ze < w || zs > n || zn < s) continue;
      const inside = (lon, lat) => lon >= zw && lon <= ze && lat >= zs && lat <= zn && z.parts.some((p) => inRing(lon, lat, p));
      const firstInside = inside(c[0][0], c[0][1]);
      let entry = firstInside ? 0 : null;
      // Se recorre cada tramo cada ~25 m, pero solo los que tocan el recuadro de la zona
      for (let i = 0; i < c.length - 1 && entry == null; i++) {
        const [x0, y0] = c[i], [x1, y1] = c[i + 1];
        if (Math.max(x0, x1) < zw || Math.min(x0, x1) > ze || Math.max(y0, y1) < zs || Math.min(y0, y1) > zn) continue;
        const len = route.cum[i + 1] - route.cum[i];
        const steps = Math.max(1, Math.ceil(len / 25));
        for (let k = 1; k <= steps; k++) {
          const t = k / steps;
          if (inside(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) { entry = route.cum[i] + len * t; break; }
        }
      }
      if (entry == null) continue;
      const last = c[c.length - 1];
      out.push({ zone: z, along: entry, startsInside: firstInside, destInside: inside(last[0], last[1]) });
    }
    return out.sort((a, b) => a.along - b.along);
  }
  geojson(enabled = true, sticker = null) {
    if (!enabled) return { type: 'FeatureCollection', features: [] };
    return {
      type: 'FeatureCollection',
      features: this.zones.map((z) => ({
        type: 'Feature',
        geometry: { type: 'MultiPolygon', coordinates: z.parts.map((p) => [p]) },
        properties: { id: z.id, name: z.name, deny: this.allowed(z, sticker) === false ? 1 : 0 },
      })),
    };
  }
}

const plain = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
/** Nombre de la zona con su ciudad si hace falta: «Distrito Centro (Madrid)». */
export function zoneTitle(z) {
  if (!z.city || plain(z.name).includes(plain(z.city)) || plain(z.city).includes(plain(z.name))) return z.name;
  return `${z.name} (${z.city})`;
}

/** Texto de las reglas de una zona para la etiqueta del usuario. */
export function zbeRuleText(zone, sticker, db) {
  const ok = db.allowed(zone, sticker);
  const banned = zone.deny == null ? '' : STICKERS.filter(([k]) => stickerRank(k) >= zone.deny).map(([k]) => (k === 'A' ? 'sin etiqueta' : k)).join(', ');
  if (ok === false) return `Tu coche (${stickerName(sticker).toLowerCase()}) no puede circular por ella${zone.h24 === false ? ' en su horario' : ''}`;
  if (ok === true) return 'Tu coche puede circular por ella';
  return banned ? `Prohibida para: ${banned}` : 'Consulta las condiciones de acceso';
}

// ======================================================================
// Avisos de incidencias y ZBE mientras conduces
// ======================================================================
export class TrafficWatcher {
  constructor(incDB, zbeDB, getSettings, cb) {
    this.inc = incDB; this.zbe = zbeDB; this.getSettings = getSettings; this.cb = cb;
    this.route = null; this.onRouteInc = []; this.onRouteZbe = [];
    this.done = new Set();
    this.insideZones = null;
  }
  setRoute(route) {
    this.route = route;
    this.refresh();
  }
  refresh() {
    this.onRouteInc = this.route ? this.inc.onRoute(this.route) : [];
    this.onRouteZbe = this.route ? this.zbe.onRoute(this.route) : [];
  }
  reset() { this.done.clear(); this.insideZones = null; }

  update(fix, nav) {
    const S = this.getSettings();
    const useRoute = nav && this.route && !nav.offRoute && nav.offset < 60;
    let alert = null;
    // ----- Incidencias -----
    if (S.incidentAlerts !== false) {
      if (useRoute) {
        for (const it of this.onRouteInc) {
          const d = it.along - nav.along;
          if (it.alongEnd - nav.along < -30) continue; // ya pasada
          const def = INCIDENT_TYPES[it.inc.type];
          if (d > def.range) continue;
          alert = this._incAlert(it.inc, Math.max(0, d), def, d <= 0);
          break;
        }
      } else if (fix.heading != null && (fix.speed || 0) > 3) {
        let best = null;
        const near = this.inc.inBBox(fix.lon - 0.04, fix.lat - 0.03, fix.lon + 0.04, fix.lat + 0.03);
        for (const inc of near) {
          const def = INCIDENT_TYPES[inc.type];
          const d = dist(fix.lat, fix.lon, inc.lat, inc.lon);
          if (d > Math.min(def.range, 1500)) continue;
          if (angDiff(bearing(fix.lat, fix.lon, inc.lat, inc.lon), fix.heading) > 25) continue;
          if (!inc.both && inc.dir != null && angDiff(inc.dir, fix.heading) > 70) continue;
          if (this.done.has(`${inc.id}:passed`)) continue;
          if (!best || d < best.d) best = { inc, d };
        }
        if (best) alert = this._incAlert(best.inc, best.d, INCIDENT_TYPES[best.inc.type], false);
      }
    }
    // ----- Zonas de bajas emisiones -----
    let zbe = null;
    if (S.zbeAlerts !== false && this.zbe.zones.length) {
      if (useRoute) {
        for (const z of this.onRouteZbe) {
          const d = z.along - nav.along;
          if (z.startsInside || d < -50 || d > 1500) continue;
          zbe = this._zbeAlert(z.zone, Math.max(0, d), S.sticker);
          break;
        }
      }
      // Entrada real en una zona (con o sin ruta)
      const now = this.zbe.zonesAt(fix.lat, fix.lon).map((z) => z.id);
      if (this.insideZones) {
        for (const id of now) {
          if (!this.insideZones.includes(id)) {
            const z = this.zbe.zones.find((x) => x.id === id);
            if (z && !this.done.has(`zbe:${id}`)) zbe = this._zbeAlert(z, 0, S.sticker);
          }
        }
      }
      this.insideZones = now;
    }
    return { alert, zbe };
  }

  _incAlert(inc, d, def, passing) {
    const key = `${inc.id}:spoken`;
    if (!this.done.has(key)) {
      this.done.add(key);
      this.cb.sound?.(inc.type === 'corte' || inc.type === 'accidente' ? 'radar' : 'near');
      const road = inc.road && !/^\d/.test(inc.road) ? ` en la ${inc.road}` : '';
      let txt = `${inc.type === 'corte' ? inc.label : INCIDENT_TYPES[inc.type].speak} a ${speakDist(d)}${road}.`;
      if (inc.type === 'clima' && inc.text) txt = `${inc.text.split(' · ')[0]} a ${speakDist(d)}.`;
      if (inc.type === 'corte') txt += ' Busca un desvío.';
      this.cb.speak?.(txt, { priority: inc.type === 'corte' || inc.type === 'accidente' ? 'high' : 'normal' });
    }
    if (passing || d < 20) this.done.add(`${inc.id}:passed`);
    return { kind: 'incident', id: inc.id, inc, type: { label: inc.label, icon: INCIDENT_TYPES[inc.type].icon }, d, alertDist: INCIDENT_TYPES[inc.type].range, sub: [inc.road && `${inc.road}${inc.km != null ? ` km ${inc.km}` : ''}`, inc.text].filter(Boolean).join(' · ') };
  }

  _zbeAlert(zone, d, sticker) {
    const key = `zbe:${zone.id}`;
    const ok = this.zbe.allowed(zone, sticker);
    if (!this.done.has(key)) {
      this.done.add(key);
      this.cb.sound?.(ok === false ? 'radar' : 'near');
      const name = zoneTitle(zone);
      let txt = d > 50 ? `Zona de bajas emisiones de ${name} a ${speakDist(d)}.` : `Entras en la zona de bajas emisiones de ${name}.`;
      if (ok === false) txt += ' Tu coche no tiene permiso para circular por ella.';
      this.cb.speak?.(txt, { priority: 'high' });
    }
    return { kind: 'zbe', id: zone.id, zone, d, ok, alertDist: 1500, type: { label: 'Zona de bajas emisiones', icon: ok === false ? 'zbe-no' : 'zbe' }, sub: zoneTitle(zone) };
  }
}

export const incidentRange = (type) => clamp(INCIDENT_TYPES[type]?.range || 1000, 300, 3000);

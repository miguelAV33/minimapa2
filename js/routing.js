// Cálculo de rutas (Valhalla con OSRM de respaldo), límites de velocidad y tráfico opcional.
import { CONFIG } from './config.js';
import { decodePolyline, encodePolyline, cumulative, fetchJSON, fetchWithTimeout, dist } from './util.js';

// ---------- Utilidades comunes ----------

const VALHALLA_KIND = {
  0: 'straight', 1: 'depart', 2: 'depart', 3: 'depart', 4: 'arrive', 5: 'arrive', 6: 'arrive',
  7: 'straight', 8: 'straight', 9: 'slight-right', 10: 'right', 11: 'sharp-right', 12: 'uturn', 13: 'uturn',
  14: 'sharp-left', 15: 'left', 16: 'slight-left', 17: 'straight', 18: 'ramp-right', 19: 'ramp-left',
  20: 'exit-right', 21: 'exit-left', 22: 'straight', 23: 'keep-right', 24: 'keep-left', 25: 'merge',
  26: 'roundabout', 27: 'roundabout-exit', 28: 'ferry', 29: 'straight', 37: 'merge', 38: 'merge',
};

/** Reparte el tiempo de cada maniobra entre sus vértices, en proporción a la distancia. */
function buildTimes(coords, cum, maneuvers, totalTime) {
  const times = new Float64Array(coords.length);
  for (let k = 0; k < maneuvers.length; k++) {
    const m = maneuvers[k];
    const a = m.begin;
    const b = k + 1 < maneuvers.length ? maneuvers[k + 1].begin : coords.length - 1;
    const len = cum[b] - cum[a];
    for (let i = a + 1; i <= b; i++) {
      const frac = len > 0 ? (cum[i] - cum[a]) / len : 1;
      times[i] = times[a] + frac * (m.time || 0);
    }
  }
  // Ajuste final por si la suma no cuadra con el total
  const last = times[coords.length - 1];
  if (last > 0 && totalTime > 0 && Math.abs(last - totalTime) > 5) {
    const f = totalTime / last;
    for (let i = 0; i < times.length; i++) times[i] *= f;
  }
  return times;
}

function finalize(route) {
  route.cum = cumulative(route.coords);
  route.length = route.cum[route.cum.length - 1];
  for (const m of route.maneuvers) m.along = route.cum[Math.min(m.begin, route.coords.length - 1)];
  route.times = buildTimes(route.coords, route.cum, route.maneuvers, route.duration);
  route.duration = route.times[route.times.length - 1] || route.duration;
  route.via = viaNames(route);
  route.limits = null;
  return route;
}

function viaNames(route) {
  const byLen = [...route.maneuvers]
    .filter((m) => m.street && !['arrive', 'waypoint'].includes(m.kind))
    .sort((a, b) => (b.length || 0) - (a.length || 0));
  const out = [];
  for (const m of byLen) {
    const ref = m.street.split(' / ').find((s) => /^[A-Z]{1,3}-\d/.test(s)) || m.street.split(' / ')[0];
    if (ref && !out.includes(ref)) out.push(ref);
    if (out.length >= 2) break;
  }
  return out.join(' · ');
}

function signText(sign) {
  if (!sign) return '';
  const pick = (arr) => (arr || []).map((e) => e.text).filter(Boolean);
  const num = pick(sign.exit_number_elements);
  const branch = pick(sign.exit_branch_elements);
  const toward = pick(sign.exit_toward_elements);
  const parts = [];
  if (num.length) parts.push(`Salida ${num[0]}`);
  if (branch.length) parts.push(branch.slice(0, 2).join(' / '));
  if (toward.length) parts.push(`hacia ${toward.slice(0, 2).join(' / ')}`);
  return parts.join(' · ');
}

// ---------- Valhalla ----------

async function valhallaCall(path, body, timeout = 20000) {
  let lastErr;
  for (const base of CONFIG.valhalla) {
    try {
      const r = await fetchWithTimeout(`${base}/${path}`, {
        method: 'POST', timeout, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok) {
        const err = new Error(data?.error || `Valhalla HTTP ${r.status}`);
        err.code = data?.error_code; err.status = r.status;
        if (r.status === 400) throw err; // error del propio cálculo: no reintentar
        lastErr = err; continue;
      }
      return data;
    } catch (e) {
      if (e.status === 400) throw e;
      lastErr = e;
      // Reintento por GET (algunos proxys no aceptan POST con JSON)
      try {
        const url = `${base}/${path}?json=${encodeURIComponent(JSON.stringify(body))}`;
        if (url.length < 7500) return await fetchJSON(url, { timeout });
      } catch (e2) { lastErr = e2; }
    }
  }
  throw lastErr || new Error('Valhalla no disponible');
}

function fromValhallaTrip(trip, opts) {
  const coords = [], maneuvers = [];
  const nLegs = trip.legs.length;
  trip.legs.forEach((leg, li) => {
    let shape = decodePolyline(leg.shape, 6);
    const base = coords.length ? coords.length - 1 : 0;
    if (coords.length) shape = shape.slice(1);
    coords.push(...shape);
    for (const m of leg.maneuvers) {
      let kind = VALHALLA_KIND[m.type] || 'straight';
      if (kind === 'depart' && li > 0) continue;
      const isLastLeg = li === nLegs - 1;
      let text = m.instruction;
      let pre = m.verbal_pre_transition_instruction || m.instruction;
      let alert = m.verbal_transition_alert_instruction || pre;
      if (kind === 'arrive' && !isLastLeg) {
        kind = 'waypoint';
        text = 'Has llegado a la parada';
        pre = alert = 'Has llegado a la parada.';
      }
      maneuvers.push({
        kind, text, pre, alert,
        post: m.verbal_post_transition_instruction || '',
        street: (m.street_names || m.begin_street_names || []).join(' / '),
        sign: signText(m.sign),
        exit: m.roundabout_exit_count || 0,
        begin: base + m.begin_shape_index,
        time: m.time || 0,
        length: (m.length || 0) * 1000,
        toll: !!m.toll,
        lanes: Array.isArray(m.lanes) && m.lanes.length > 1 ? m.lanes.map((l) => ({ d: l.directions | 0, v: l.valid | 0, a: l.active | 0 })) : null,
      });
    }
  });
  return finalize({
    provider: 'valhalla',
    coords, maneuvers,
    duration: trip.summary?.time || 0,
    summary: { toll: !!trip.summary?.has_toll, highway: !!trip.summary?.has_highway, ferry: !!trip.summary?.has_ferry },
    points: opts.points,
  });
}

async function valhallaRoutes(opts) {
  const locations = opts.points.map((p, i) => {
    const loc = { lat: p.lat, lon: p.lon, type: i === 0 || i === opts.points.length - 1 ? 'break' : 'break' };
    if (i === 0 && p.heading != null) { loc.heading = Math.round(p.heading); loc.heading_tolerance = 60; }
    return loc;
  });
  const walk = opts.costing === 'pedestrian';
  const body = {
    locations,
    costing: walk ? 'pedestrian' : 'auto',
    costing_options: walk ? { pedestrian: {} } : { auto: { use_tolls: opts.avoidTolls ? 0 : 0.5, use_highways: opts.avoidHighways ? 0 : 1, use_ferry: 0.3 } },
    directions_options: { units: 'kilometers', language: 'es-ES' },
    alternates: opts.alternatives && opts.points.length === 2 ? 2 : 0,
    turn_lanes: !walk,
  };
  if (opts.excludePolygons?.length) body.exclude_polygons = opts.excludePolygons;
  const data = await valhallaCall('route', body);
  const trips = [data.trip, ...(data.alternates || []).map((a) => a.trip)].filter(Boolean);
  return trips.map((t) => fromValhallaTrip(t, opts));
}

// ---------- OSRM (respaldo) ----------

const ORD = ['', 'primera', 'segunda', 'tercera', 'cuarta', 'quinta', 'sexta', 'séptima', 'octava', 'novena'];
const MOD_TEXT = {
  uturn: 'Cambia de sentido', 'sharp right': 'Gira bruscamente a la derecha', right: 'Gira a la derecha',
  'slight right': 'Gira ligeramente a la derecha', straight: 'Sigue recto', 'slight left': 'Gira ligeramente a la izquierda',
  left: 'Gira a la izquierda', 'sharp left': 'Gira bruscamente a la izquierda',
};
const MOD_KIND = {
  uturn: 'uturn', 'sharp right': 'sharp-right', right: 'right', 'slight right': 'slight-right', straight: 'straight',
  'slight left': 'slight-left', left: 'left', 'sharp left': 'sharp-left',
};
const side = (mod) => (/left/.test(mod || '') ? 'izquierda' : 'derecha');

export function osrmInstruction(st) {
  const m = st.maneuver || {};
  const name = st.ref && st.name ? `${st.name} (${st.ref})` : st.name || st.ref || '';
  const on = name ? ` por ${name}` : '';
  const onto = name ? ` hacia ${name}` : '';
  const mod = m.modifier;
  switch (m.type) {
    case 'depart': return { kind: 'depart', text: `Sal${on}` };
    case 'arrive': return { kind: 'arrive', text: 'Has llegado a tu destino' };
    case 'roundabout': case 'rotary': case 'roundabout turn':
      return { kind: 'roundabout', text: `En la rotonda, toma la ${ORD[m.exit] || `salida ${m.exit}`}${m.exit && ORD[m.exit] ? ' salida' : ''}${onto}` };
    case 'exit roundabout': case 'exit rotary': return { kind: 'roundabout-exit', text: `Sal de la rotonda${onto}` };
    case 'on ramp': return { kind: /left/.test(mod) ? 'ramp-left' : 'ramp-right', text: `Toma la incorporación${onto}` };
    case 'off ramp': return { kind: /left/.test(mod) ? 'exit-left' : 'exit-right', text: `Toma la salida${st.exits ? ` ${st.exits}` : ''} a la ${side(mod)}${onto}` };
    case 'fork': return { kind: /left/.test(mod) ? 'keep-left' : 'keep-right', text: `En la bifurcación, mantente a la ${side(mod)}${onto}` };
    case 'merge': return { kind: 'merge', text: `Incorpórate${onto}` };
    case 'end of road': return { kind: MOD_KIND[mod] || 'right', text: `Al final de la vía, gira a la ${side(mod)}${onto}` };
    case 'new name': case 'continue':
      if (!mod || mod === 'straight') return { kind: 'straight', text: `Continúa${on}` };
      return { kind: MOD_KIND[mod] || 'straight', text: `${MOD_TEXT[mod] || 'Continúa'}${onto}` };
    default:
      return { kind: MOD_KIND[mod] || 'straight', text: `${MOD_TEXT[mod] || 'Continúa'}${onto}` };
  }
}

function fromOsrmRoute(r, opts) {
  const coords = [], maneuvers = [];
  const nLegs = r.legs.length;
  r.legs.forEach((leg, li) => {
    leg.steps.forEach((st) => {
      const g = st.geometry.coordinates;
      const base = coords.length ? coords.length - 1 : 0;
      coords.push(...(coords.length ? g.slice(1) : g));
      let { kind, text } = osrmInstruction(st);
      if (kind === 'depart' && li > 0) return;
      if (kind === 'arrive' && li < nLegs - 1) { kind = 'waypoint'; text = 'Has llegado a la parada'; }
      maneuvers.push({
        kind, text, pre: `${text}.`, alert: `${text}.`, post: '',
        street: st.name || st.ref || '', sign: st.exits ? `Salida ${st.exits}` : '',
        exit: st.maneuver?.exit || 0, begin: base, time: st.duration || 0, length: st.distance || 0, toll: false,
        lanes: osrmLanes(st.intersections?.[0]?.lanes),
      });
    });
  });
  return finalize({ provider: 'osrm', coords, maneuvers, duration: r.duration, summary: { toll: false, highway: false, ferry: false }, points: opts.points });
}

// Indicaciones de carril de OSRM → máscara de bits (mismos valores que Valhalla)
const LANE_BITS = { none: 1, straight: 2, 'sharp left': 4, left: 8, 'slight left': 16, 'slight right': 32, right: 64, 'sharp right': 128, uturn: 256 };
function osrmLanes(lanes) {
  if (!Array.isArray(lanes) || lanes.length < 2) return null;
  const out = lanes.map((l) => {
    const d = (l.indications || []).reduce((m, i) => m | (LANE_BITS[i] || 0), 0) || 1;
    const vi = l.valid_indication ? LANE_BITS[l.valid_indication] || d : d;
    return { d, v: l.valid ? vi : 0, a: l.valid ? vi : 0 };
  });
  return out.some((l) => l.a) && out.some((l) => !l.a) ? out : null;
}

async function osrmRoutes(opts) {
  const path = opts.points.map((p) => `${p.lon.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
  const params = new URLSearchParams({ overview: 'false', geometries: 'geojson', steps: 'true', alternatives: opts.alternatives && opts.points.length === 2 ? 'true' : 'false' });
  if (opts.avoidTolls || opts.avoidHighways) {
    const ex = [opts.avoidTolls && 'toll', opts.avoidHighways && 'motorway'].filter(Boolean).join(',');
    params.set('exclude', ex);
  }
  let data;
  try {
    data = await fetchJSON(`${CONFIG.osrm}/route/v1/driving/${path}?${params}`, { timeout: 20000 });
  } catch (e) {
    if (params.has('exclude')) { params.delete('exclude'); data = await fetchJSON(`${CONFIG.osrm}/route/v1/driving/${path}?${params}`, { timeout: 20000 }); }
    else throw e;
  }
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error('No se encontró ruta');
  return data.routes.map((r) => fromOsrmRoute(r, opts));
}

/**
 * Calcula rutas. points: [{lat, lon, heading?}, ...destino]. Devuelve un array (la primera es la recomendada).
 */
export async function getRoutes(opts) {
  try {
    const routes = await valhallaRoutes(opts);
    if (routes.length) return routes;
    throw new Error('Sin rutas');
  } catch (e) {
    // Con zonas a evitar o a pie no hay respaldo posible (OSRM no sabe hacerlo)
    if (opts.excludePolygons?.length || opts.costing === 'pedestrian') throw e;
    if (e.code === 442 || e.code === 171) {
      const err = new Error('No hay ruta en coche hasta ese punto'); err.final = true; throw err;
    }
    console.warn('Valhalla falló, uso OSRM:', e);
    return osrmRoutes(opts);
  }
}

// ---------- Límites de velocidad ----------

/** Pide a Valhalla los límites de velocidad a lo largo de la ruta, por tramos de ≤150 km. */
export async function fetchRouteLimits(route, onPartial) {
  const out = [];
  const n = route.coords.length;
  let i0 = 0;
  let chunks = 0;
  while (i0 < n - 1 && chunks < 8) {
    let i1 = i0;
    while (i1 < n - 1 && route.cum[i1] - route.cum[i0] < 150000 && i1 - i0 < 12000) i1++;
    const part = route.coords.slice(i0, i1 + 1);
    const offset = route.cum[i0];
    let data = null;
    for (const shape_match of ['edge_walk', 'map_snap']) {
      try {
        data = await valhallaCall('trace_attributes', {
          encoded_polyline: encodePolyline(part, 6), shape_match, costing: 'auto',
          filters: { attributes: ['edge.speed_limit', 'edge.begin_shape_index', 'edge.end_shape_index', 'shape'], action: 'include' },
        }, 30000);
        break;
      } catch { data = null; }
    }
    if (data?.edges) {
      const shp = data.shape ? decodePolyline(data.shape, 6) : part;
      const cum = cumulative(shp);
      for (const e of data.edges) {
        const lim = typeof e.speed_limit === 'number' && e.speed_limit > 0 && e.speed_limit < 200 ? e.speed_limit : null;
        const a = cum[Math.min(e.begin_shape_index ?? 0, cum.length - 1)] + offset;
        const b = cum[Math.min(e.end_shape_index ?? 0, cum.length - 1)] + offset;
        if (b > a) out.push({ a, b, lim });
      }
      onPartial?.(out);
    }
    i0 = i1;
    chunks++;
  }
  return out;
}

/** Límite de velocidad en un punto de la ruta (búsqueda binaria). */
export function limitAt(limits, along) {
  if (!limits?.length) return null;
  let lo = 0, hi = limits.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const L = limits[mid];
    if (along < L.a) hi = mid - 1; else if (along > L.b) lo = mid + 1; else return L.lim;
  }
  return null;
}

/** Ajusta las últimas posiciones a la red viaria: devuelve límite y nombre de la calle. */
export async function matchPosition(points) {
  if (points.length < 2) return null;
  const data = await valhallaCall('trace_attributes', {
    shape: points.map((p) => ({ lat: p.lat, lon: p.lon })), costing: 'auto', shape_match: 'map_snap',
    filters: { attributes: ['edge.speed_limit', 'edge.names', 'matched.edge_index', 'matched.type'], action: 'include' },
  }, 10000);
  const mp = data.matched_points || [];
  for (let i = mp.length - 1; i >= 0; i--) {
    const idx = mp[i].edge_index;
    if (idx != null && data.edges?.[idx]) {
      const e = data.edges[idx];
      const lim = typeof e.speed_limit === 'number' && e.speed_limit > 0 && e.speed_limit < 200 ? e.speed_limit : null;
      return { limit: lim, name: (e.names || [])[0] || '' };
    }
  }
  return null;
}

// ---------- Tráfico (opcional, TomTom con clave gratuita) ----------

export async function tomtomTraffic(points, key) {
  const path = points.map((p) => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`).join(':');
  const url = `https://api.tomtom.com/routing/1/calculateRoute/${path}/json?key=${encodeURIComponent(key)}&traffic=true&travelMode=car&routeType=fastest&computeTravelTimeFor=all&language=es-ES`;
  const data = await fetchJSON(url, { timeout: 12000 });
  const s = data.routes?.[0]?.summary;
  if (!s) return null;
  return { travel: s.travelTimeInSeconds, delay: s.trafficDelayInSeconds || 0, noTraffic: s.noTrafficTravelTimeInSeconds || s.travelTimeInSeconds };
}

/** Distancia en línea recta como estimación rápida. */
export function crowDistance(a, b) { return dist(a.lat, a.lon, b.lat, b.lon); }

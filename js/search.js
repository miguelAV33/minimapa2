// Búsqueda de direcciones (Photon / Nominatim), geocodificación inversa y búsqueda por categorías (Overpass).
import { CONFIG } from './config.js';
import { fetchJSON, fetchWithTimeout, dist } from './util.js';

export const CATEGORIES = [
  { id: 'fuel', label: 'Gasolineras', blip: 'fuel', q: 'nwr["amenity"="fuel"]' },
  { id: 'parking', label: 'Parking', blip: 'parking', q: 'nwr["amenity"="parking"]["access"!~"private|customers"]' },
  { id: 'food', label: 'Comer', blip: 'food', q: 'nwr["amenity"~"^(restaurant|fast_food)$"]' },
  { id: 'cafe', label: 'Café', blip: 'cafe', q: 'nwr["amenity"~"^(cafe|bar)$"]' },
  { id: 'shop', label: 'Súper', blip: 'shop', q: 'nwr["shop"~"^(supermarket|convenience)$"]' },
  { id: 'pharmacy', label: 'Farmacia', blip: 'pharmacy', q: 'nwr["amenity"="pharmacy"]' },
  { id: 'hospital', label: 'Urgencias', blip: 'hospital', q: 'nwr["amenity"~"^(hospital|clinic)$"]' },
  { id: 'bank', label: 'Cajero', blip: 'bank', q: 'nwr["amenity"~"^(atm|bank)$"]' },
  { id: 'car', label: 'Taller', blip: 'car', q: 'nwr["shop"~"^(car_repair|tyres|car)$"]' },
  { id: 'charge', label: 'Carga EV', blip: 'charge', q: 'nwr["amenity"="charging_station"]' },
  { id: 'hotel', label: 'Hotel', blip: 'hotel', q: 'nwr["tourism"~"^(hotel|hostel|motel|guest_house)$"]' },
  { id: 'wash', label: 'Lavado', blip: 'car', q: 'nwr["amenity"="car_wash"]' },
];

/** "40.41, -3.70" o "40,41 -3,70" → {lat, lon} */
export function parseCoords(q) {
  const m = q.trim().match(/^(-?\d{1,2}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)$/);
  if (!m) return null;
  const lat = parseFloat(m[1].replace(',', '.')), lon = parseFloat(m[2].replace(',', '.'));
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

function photonFeature(f, near) {
  const p = f.properties || {};
  const [lon, lat] = f.geometry.coordinates;
  const street = [p.street, p.housenumber].filter(Boolean).join(' ');
  const name = p.name || street || p.city || 'Sin nombre';
  const parts = [p.name && street ? street : null, p.district, p.city || p.town || p.village, p.state].filter(Boolean);
  const uniq = [...new Set(parts)].filter((x) => x !== name);
  return {
    id: `${p.osm_type || ''}${p.osm_id || ''}` || `${lat},${lon}`,
    name, address: uniq.join(', '), lat, lon, kind: p.osm_value || p.type || '',
    dist: near ? dist(near.lat, near.lon, lat, lon) : null,
  };
}

/** Busca lugares/direcciones, con preferencia por los cercanos. */
export async function searchPlaces(q, near) {
  const c = parseCoords(q);
  if (c) return [{ id: `c${c.lat},${c.lon}`, name: `${c.lat.toFixed(5)}, ${c.lon.toFixed(5)}`, address: 'Coordenadas', lat: c.lat, lon: c.lon, kind: 'coords', dist: near ? dist(near.lat, near.lon, c.lat, c.lon) : null }];
  try {
    const params = new URLSearchParams({ q, limit: '10' });
    if (near) { params.set('lat', near.lat.toFixed(4)); params.set('lon', near.lon.toFixed(4)); params.set('location_bias_scale', '0.3'); }
    const data = await fetchJSON(`${CONFIG.photon}/api/?${params}`, { timeout: 8000 });
    const list = (data.features || []).map((f) => photonFeature(f, near));
    if (list.length) return list;
  } catch (e) { console.warn('Photon:', e); }
  const params = new URLSearchParams({ q, format: 'jsonv2', limit: '10', 'accept-language': 'es', addressdetails: '1' });
  if (near) {
    const d = 0.6;
    params.set('viewbox', `${near.lon - d},${near.lat + d},${near.lon + d},${near.lat - d}`);
  }
  const data = await fetchJSON(`${CONFIG.nominatim}/search?${params}`, { timeout: 10000 });
  return data.map((r) => ({
    id: `${r.osm_type}${r.osm_id}`, name: r.name || r.display_name.split(',')[0], address: r.display_name.split(',').slice(1, 4).join(',').trim(),
    lat: +r.lat, lon: +r.lon, kind: r.type, dist: near ? dist(near.lat, near.lon, +r.lat, +r.lon) : null,
  }));
}

/** Dirección de un punto: {name, address, locality}. */
export async function reverse(lat, lon) {
  try {
    const data = await fetchJSON(`${CONFIG.photon}/reverse?lat=${lat}&lon=${lon}&limit=1`, { timeout: 7000 });
    const f = data.features?.[0];
    if (f) {
      const p = f.properties;
      const street = [p.street, p.housenumber].filter(Boolean).join(' ');
      return { name: p.name || street || p.city || 'Punto en el mapa', address: [p.name ? street : null, p.city || p.town || p.village].filter(Boolean).join(', '), locality: p.district || p.city || p.town || p.village || '', street: p.street || p.name || '' };
    }
  } catch { /* respaldo */ }
  const r = await fetchJSON(`${CONFIG.nominatim}/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&accept-language=es`, { timeout: 9000 });
  const a = r.address || {};
  const street = [a.road, a.house_number].filter(Boolean).join(' ');
  return { name: r.name || street || r.display_name?.split(',')[0] || 'Punto en el mapa', address: [street, a.city || a.town || a.village].filter(Boolean).join(', '), locality: a.suburb || a.city || a.town || a.village || '', street: a.road || '' };
}

/** Lugares de una categoría alrededor de un punto (o a lo largo de una línea: along = [[lat, lon], ...]). */
export async function searchCategory(cat, lat, lon, radius = 3000, along = null) {
  const area = along ? `around:${radius},${along.map(([la, lo]) => `${la.toFixed(5)},${lo.toFixed(5)}`).join(',')}` : `around:${radius},${lat.toFixed(5)},${lon.toFixed(5)}`;
  const q = `[out:json][timeout:25];(${cat.q}(${area}););out center tags ${along ? 150 : 80};`;
  let data = null, lastErr;
  for (const url of CONFIG.overpass) {
    try {
      const r = await fetchWithTimeout(url, { method: 'POST', body: `data=${encodeURIComponent(q)}`, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 25000 });
      if (r.ok) { data = await r.json(); break; }
      lastErr = new Error(`Overpass ${r.status}`);
    } catch (e) { lastErr = e; }
  }
  if (!data) throw lastErr || new Error('Overpass no disponible');
  return (data.elements || []).map((el) => {
    const la = el.lat ?? el.center?.lat, lo = el.lon ?? el.center?.lon;
    const t = el.tags || {};
    const name = t.name || t.brand || t.operator || cat.label.replace(/s$/, '');
    const addr = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' ') || t['addr:city'] || '';
    return {
      id: `${el.type}${el.id}`, name, address: addr, lat: la, lon: lo, kind: cat.id, blip: cat.blip, dist: dist(lat, lon, la, lo),
      hours: t.opening_hours || '', phone: t.phone || t['contact:phone'] || '', web: t.website || t['contact:website'] || '',
    };
  }).filter((x) => x.lat != null).sort((a, b) => a.dist - b.dist);
}

/** Horario, teléfono y web de un lugar de OpenStreetMap (id tipo N123, W45, node123…). */
export async function placeDetails(p) {
  const m = /^(N|W|R|node|way|relation)(\d+)$/.exec(p?.id || '');
  if (!m) return null;
  const params = new URLSearchParams({ osm_ids: `${m[1][0].toUpperCase()}${m[2]}`, format: 'jsonv2', extratags: '1', 'accept-language': 'es' });
  const data = await fetchJSON(`${CONFIG.nominatim}/lookup?${params}`, { timeout: 9000 });
  const x = data?.[0]?.extratags;
  if (!x) return null;
  return {
    hours: x.opening_hours || '', phone: x.phone || x['contact:phone'] || '', web: x.website || x['contact:website'] || x.url || '',
  };
}

// ---------- Horarios (formato opening_hours de OpenStreetMap) ----------
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const DAY_ES = { Mo: 'L', Tu: 'M', We: 'X', Th: 'J', Fr: 'V', Sa: 'S', Su: 'D', PH: 'festivos' };
const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

function parseDays(sel) {
  const days = new Set();
  for (const part of sel.split(',')) {
    const r = /^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?$/.exec(part.trim());
    if (part.trim() === 'PH') continue;
    if (!r) return null;
    const a = DAYS.indexOf(r[1]), b = r[2] ? DAYS.indexOf(r[2]) : a;
    for (let i = a; ; i = (i + 1) % 7) { days.add(i); if (i === b) break; }
  }
  return days;
}

/** Interpreta lo más habitual de opening_hours. Devuelve null si no se entiende. */
export function parseHours(oh) {
  if (!oh) return null;
  const txt = oh.trim();
  if (txt === '24/7') return { always: true, rules: [] };
  const rules = [];
  for (let rule of txt.split(';')) {
    rule = rule.trim();
    if (!rule) continue;
    if (/^PH\b/.test(rule)) continue; // festivos: no se tienen en cuenta
    const m = /^((?:(?:Mo|Tu|We|Th|Fr|Sa|Su|PH)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?,?)+)?\s*(.*)$/.exec(rule);
    let days = new Set([0, 1, 2, 3, 4, 5, 6]);
    if (m[1]) { days = parseDays(m[1].replace(/,$/, '')); if (!days) return null; }
    const rest = (m[2] || '').trim();
    if (/^(off|closed)$/i.test(rest)) { rules.push({ days, ranges: [] }); continue; }
    if (rest === '24/7' || rest === '00:00-24:00') { rules.push({ days, ranges: [[0, 1440]] }); continue; }
    const ranges = [];
    for (const r of rest.split(',')) {
      const t = /^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/.exec(r.trim());
      if (!t) return null;
      ranges.push([toMin(t[1]), toMin(t[2])]);
    }
    if (!ranges.length) return null;
    rules.push({ days, ranges });
  }
  return rules.length ? { always: false, rules } : null;
}

/** ¿Abierto ahora? {open, text} o null. */
export function openState(oh, now = new Date()) {
  const p = parseHours(oh);
  if (!p) return null;
  if (p.always) return { open: true, text: 'Abierto 24 horas' };
  const rangesFor = (d) => { let r = null; for (const rule of p.rules) if (rule.days.has(d)) r = rule.ranges; return r || []; };
  const d = now.getDay(), min = now.getHours() * 60 + now.getMinutes();
  const fmt = (m) => `${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  // tramos de hoy y los que vienen de ayer pasada la medianoche
  for (const [a, b] of rangesFor(d)) {
    const end = b <= a ? b + 1440 : b;
    if (min >= a && min < end) return { open: true, text: end - min <= 60 ? `Abierto · cierra pronto (${fmt(end)})` : `Abierto · cierra a las ${fmt(end)}` };
  }
  for (const [a, b] of rangesFor((d + 6) % 7)) if (b <= a && min < b) return { open: true, text: `Abierto · cierra a las ${fmt(b)}` };
  const later = rangesFor(d).map(([a]) => a).filter((a) => a > min).sort((x, y) => x - y)[0];
  if (later != null) return { open: false, text: `Cerrado · abre a las ${fmt(later)}` };
  const tomorrow = rangesFor((d + 1) % 7).map(([a]) => a).sort((x, y) => x - y)[0];
  return { open: false, text: tomorrow != null ? `Cerrado · abre mañana a las ${fmt(tomorrow)}` : 'Cerrado' };
}

/** Horario legible en español: «L-V 09:00-14:00; S cerrado». */
export function hoursText(oh) {
  if (!oh) return '';
  if (oh.trim() === '24/7') return 'Todos los días, 24 horas';
  return oh.replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH)\b/g, (x) => DAY_ES[x]).replace(/\boff\b|\bclosed\b/g, 'cerrado').replace(/;\s*/g, ' · ');
}

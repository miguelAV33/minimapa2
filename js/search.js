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

/** Lugares de una categoría alrededor de un punto. */
export async function searchCategory(cat, lat, lon, radius = 3000) {
  const q = `[out:json][timeout:20];(${cat.q}(around:${radius},${lat.toFixed(5)},${lon.toFixed(5)}););out center tags 80;`;
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
    return { id: `${el.type}${el.id}`, name, address: addr, lat: la, lon: lo, kind: cat.id, blip: cat.blip, dist: dist(lat, lon, la, lo), hours: t.opening_hours || '' };
  }).filter((x) => x.lat != null).sort((a, b) => a.dist - b.dist);
}

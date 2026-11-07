// Gasolineras con precio (datos oficiales del Ministerio, actualizados por GitHub Actions).
import { CONFIG } from './config.js';
import { fetchJSON, dist, idb } from './util.js';

export const FUELS = [
  { id: 'g95', label: 'Gasolina 95' },
  { id: 'g98', label: 'Gasolina 98' },
  { id: 'diesel', label: 'Diésel' },
  { id: 'dieselPlus', label: 'Diésel+' },
  { id: 'glp', label: 'GLP' },
];

let cache = null;

const num = (v) => {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return isFinite(n) && n > 0 ? n : null;
};

function fromMinetur(data) {
  const pick = (o, re) => { const k = Object.keys(o).find((x) => re.test(x)); return k ? o[k] : null; };
  const list = (data.ListaEESSPrecio || []).map((e) => [
    e.IDEESS, num(e.Latitud), num(pick(e, /^Longitud/)), e['Rótulo'] || e.Rotulo || '', e['Dirección'] || e.Direccion || '',
    e.Municipio || '', e.Horario || '',
    num(pick(e, /Gasolina 95 E5$/)), num(pick(e, /Gasolina 98 E5$/)), num(pick(e, /Gasoleo A$/)), num(pick(e, /Gasoleo Premium$/)), num(pick(e, /Gases licuados/)),
  ]).filter((r) => r[1] && r[2]);
  return { generado: new Date().toISOString(), fecha: data.Fecha || '', estaciones: list };
}

export async function loadFuel() {
  if (cache && Date.now() - cache.loadedAt < 3 * 3600e3) return cache;
  let data = null;
  for (const url of [].concat(CONFIG.fuelData)) {
    try {
      data = await fetchJSON(`${url}?t=${Math.floor(Date.now() / 3600e3)}`, { timeout: 20000 });
      if (data?.estaciones?.length) break;
    } catch { data = null; }
  }
  if (!data?.estaciones?.length) {
    try { data = fromMinetur(await fetchJSON(CONFIG.minetur, { timeout: 30000, headers: { Accept: 'application/json' } })); } catch { data = null; }
  }
  if (data?.estaciones?.length) {
    cache = { ...data, loadedAt: Date.now() };
    idb.set('fuel', data);
    return cache;
  }
  const stored = await idb.get('fuel');
  if (stored?.estaciones) { cache = { ...stored, loadedAt: Date.now() - 2 * 3600e3 }; return cache; }
  throw new Error('No hay datos de precios');
}

const IDX = { g95: 7, g98: 8, diesel: 9, dieselPlus: 10, glp: 11 };

/** Estaciones cercanas con precio del carburante elegido. */
export function nearestFuel(data, lat, lon, { radius = 8000, fuel = 'g95', sort = 'dist', limit = 40 } = {}) {
  const dLat = radius / 111000, dLon = radius / (111000 * Math.cos((lat * Math.PI) / 180));
  const out = [];
  for (const e of data.estaciones) {
    if (Math.abs(e[1] - lat) > dLat || Math.abs(e[2] - lon) > dLon) continue;
    const d = dist(lat, lon, e[1], e[2]);
    if (d > radius) continue;
    out.push({
      id: `fuel${e[0]}`, name: e[3] || 'Gasolinera', address: [e[4], e[5]].filter(Boolean).join(', '), hours: e[6],
      lat: e[1], lon: e[2], dist: d, price: e[IDX[fuel]], prices: { g95: e[7], g98: e[8], diesel: e[9], dieselPlus: e[10], glp: e[11] }, kind: 'fuel', blip: 'fuel',
    });
  }
  out.sort(sort === 'price' ? (a, b) => (a.price ?? 99) - (b.price ?? 99) || a.dist - b.dist : (a, b) => a.dist - b.dist);
  return out.slice(0, limit);
}

export const fmtPrice = (p) => (p ? `${p.toFixed(3).replace('.', ',')} €` : '—');

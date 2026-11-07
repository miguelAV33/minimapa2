// Skins de mapa inspiradas en la estética de los mapas de videojuegos de mundo abierto.
// Paletas propias: no se usa ningún recurso gráfico de ningún juego.
import { CONFIG } from './config.js';

export const SKINS = {
  radar: {
    id: 'radar',
    name: 'Minimapa',
    desc: 'Radar oscuro y desaturado, ruta morada. El clásico de conducir de noche por la ciudad.',
    bg: '#2e3732', residential: '#333d38', industrial: '#38403c', commercial: '#3a3f3f',
    park: '#2a4330', wood: '#26402a', grass: '#2d4732', sand: '#4a4a3c', farmland: '#313b31',
    cemetery: '#2f3f34', hospital: '#40363a', school: '#3b3a33', pitch: '#2f4a36',
    water: '#1c3d58', waterway: '#244b6b', building: '#3c4741', buildingLine: '#46524b', building3d: '#4a564f',
    aeroway: '#3b4440', runway: '#59615d',
    roads: {
      motorway: '#d4d8d5', trunk: '#c3c8c5', primary: '#adb4b0', secondary: '#9aa29e', tertiary: '#8b938f',
      minor: '#737c78', service: '#626a66', path: '#6b746f', rail: '#59615d',
      casing: '#1b211e', motorwayCasing: '#151a17',
    },
    text: '#eef1ef', halo: '#1a201d', roadText: '#e4e8e6', roadHalo: '#232a26',
    placeText: '#ffffff', placeHalo: '#141916', districtText: '#c9d1cc', waterText: '#8fb6d6',
    boundary: '#8b938f',
    route: '#b45cff', routeCasing: '#2a0f45', routeAlt: '#7d6a8f', routeDone: '#5a4a68',
    blipBg: '#1a1f1c', blipRing: '#ffffff',
    accent: '#b45cff', accentInk: '#ffffff',
    shields: true, uppercaseDistricts: true,
  },
  retro: {
    id: 'retro',
    name: 'Retro 2004',
    desc: 'Tonos oliva y arena de mapa de principios de los 2000, ruta roja y detalles dorados.',
    bg: '#7f8f5b', residential: '#8f8e70', industrial: '#8e8571', commercial: '#958b74',
    park: '#64843f', wood: '#557637', grass: '#6c8b46', sand: '#c3ad74', farmland: '#87935c',
    cemetery: '#6f8150', hospital: '#9a8576', school: '#958a6b', pitch: '#5f8a45',
    water: '#335b8f', waterway: '#3d679c', building: '#a29a80', buildingLine: '#857d64', building3d: '#ada58a',
    aeroway: '#8f8d78', runway: '#6d6a5c',
    roads: {
      motorway: '#f1ead2', trunk: '#ece4ca', primary: '#e6dec4', secondary: '#ddd5bb', tertiary: '#d4ccb2',
      minor: '#c8c0a6', service: '#b9b197', path: '#b9b197', rail: '#4f4b3e',
      casing: '#4a4535', motorwayCasing: '#3a3628',
    },
    text: '#1d1a12', halo: '#e9e2c8', roadText: '#2a261b', roadHalo: '#efe8cf',
    placeText: '#14120c', placeHalo: '#e9e2c8', districtText: '#2f2b20', waterText: '#dbe6f5',
    boundary: '#4a4535',
    route: '#e8392f', routeCasing: '#5c120d', routeAlt: '#a98f6a', routeDone: '#8a6a57',
    blipBg: '#1f1d16', blipRing: '#f3e9c6',
    accent: '#e8c547', accentInk: '#1d1a12',
    shields: true, uppercaseDistricts: true,
  },
  neon: {
    id: 'neon',
    name: 'Neón 86',
    desc: 'Noche costera ochentera: rosa neón, cian y ruta amarilla con brillo.',
    bg: '#160b29', residential: '#1b0f33', industrial: '#201237', commercial: '#24123b',
    park: '#0f2a36', wood: '#0d2a2f', grass: '#103036', sand: '#2e1f3d', farmland: '#160f2e',
    cemetery: '#122634', hospital: '#2b1235', school: '#22163a', pitch: '#0f3038',
    water: '#05304a', waterway: '#0a4566', building: '#271544', buildingLine: '#ff3fa4', building3d: '#3a1d63',
    aeroway: '#21123a', runway: '#3a2360',
    roads: {
      motorway: '#2ff3e0', trunk: '#4fd8ff', primary: '#ff3fa4', secondary: '#d9368f', tertiary: '#a42f86',
      minor: '#8a3aa3', service: '#5e2c7c', path: '#5e2c7c', rail: '#3a2360',
      casing: '#0b0517', motorwayCasing: '#06323a',
    },
    text: '#ffe3f6', halo: '#160b29', roadText: '#ffd6f2', roadHalo: '#1b0f33',
    placeText: '#ffffff', placeHalo: '#ff3fa4', districtText: '#7ef9ee', waterText: '#5fd3ff',
    boundary: '#ff3fa4',
    route: '#ffe14d', routeCasing: '#5a3d00', routeAlt: '#7a5aa8', routeDone: '#6b5c3a',
    blipBg: '#0d0619', blipRing: '#2ff3e0',
    accent: '#ff3fa4', accentInk: '#ffffff',
    shields: false, uppercaseDistricts: true, glow: true,
  },
  atlas: {
    id: 'atlas',
    name: 'Atlas',
    desc: 'Mapa de papel del menú de pausa: claro, cálido y muy legible de día.',
    bg: '#e8dcbf', residential: '#dfd1b0', industrial: '#d7c9ab', commercial: '#e0cfae',
    park: '#bdd19a', wood: '#a8c486', grass: '#c3d6a0', sand: '#efe0b4', farmland: '#e3dab5',
    cemetery: '#c3cfa4', hospital: '#e8c9be', school: '#e7d7b0', pitch: '#b5cf92',
    water: '#8cc4dd', waterway: '#79b6d3', building: '#cfc09f', buildingLine: '#b7a783', building3d: '#d8caa9',
    aeroway: '#d8cdb3', runway: '#bdb197',
    roads: {
      motorway: '#ef9f45', trunk: '#f2b558', primary: '#f5c96b', secondary: '#f8e3a1', tertiary: '#fbf0cc',
      minor: '#ffffff', service: '#fbf7ec', path: '#9c8b6a', rail: '#9c8b6a',
      casing: '#b4a383', motorwayCasing: '#a76a2a',
    },
    text: '#3b3326', halo: '#f3ecd9', roadText: '#3b3326', roadHalo: '#fffaf0',
    placeText: '#2b2419', placeHalo: '#f3ecd9', districtText: '#6b5a40', waterText: '#2f6f93',
    boundary: '#8a6d9a',
    route: '#8e3bd6', routeCasing: '#ffffff', routeAlt: '#a99bb8', routeDone: '#b9a8c9',
    blipBg: '#2b2419', blipRing: '#ffffff',
    accent: '#8e3bd6', accentInk: '#ffffff',
    shields: true, uppercaseDistricts: true,
  },
};

const NAME = ['coalesce', ['get', 'name:es'], ['get', 'name'], ['get', 'name_int']];
const ROAD_CLASSES = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service', 'busway', 'raceway'];

function classMatch(map, fallback) {
  const expr = ['match', ['get', 'class']];
  for (const [k, v] of Object.entries(map)) expr.push(k.includes('|') ? k.split('|') : k, v);
  expr.push(fallback);
  return expr;
}

// Anchura de vía (px) por clase y zoom; las rampas (enlaces) son más estrechas.
const WIDTHS = {
  5: { motorway: 0.9, trunk: 0.7, primary: 0.5, _: 0 },
  8: { motorway: 1.6, trunk: 1.3, primary: 1, secondary: 0.6, _: 0 },
  10: { motorway: 2.4, trunk: 2, primary: 1.6, secondary: 1.2, tertiary: 0.9, minor: 0.5, _: 0.3 },
  12: { motorway: 4, trunk: 3.4, primary: 3, secondary: 2.4, tertiary: 1.8, minor: 1.1, service: 0.6, _: 0.5 },
  14: { motorway: 7, trunk: 6, primary: 5.5, secondary: 5, tertiary: 4.2, minor: 3, service: 1.8, _: 1.2 },
  16: { motorway: 13, trunk: 12, primary: 11, secondary: 10, tertiary: 9, minor: 7, service: 4, _: 2.5 },
  18: { motorway: 28, trunk: 26, primary: 24, secondary: 22, tertiary: 20, minor: 16, service: 9, _: 5 },
  20: { motorway: 60, trunk: 56, primary: 52, secondary: 48, tertiary: 44, minor: 36, service: 20, _: 10 },
};
const CASING_EXTRA = { 5: 0.6, 8: 0.8, 10: 1, 12: 1.4, 14: 2, 16: 2.6, 18: 3.4, 20: 5 };

function widthExpr(extra = false) {
  const expr = ['interpolate', ['exponential', 1.5], ['zoom']];
  for (const [z, m] of Object.entries(WIDTHS)) {
    const { _: fb, ...rest } = m;
    const base = ['*', classMatch(rest, fb), ['case', ['==', ['get', 'ramp'], 1], 0.6, 1]];
    expr.push(Number(z), extra ? ['+', base, CASING_EXTRA[z]] : base);
  }
  return expr;
}

function roadColor(s) {
  const r = s.roads;
  return classMatch({
    motorway: r.motorway, trunk: r.trunk, primary: r.primary, secondary: r.secondary,
    tertiary: r.tertiary, 'minor|busway|raceway': r.minor, service: r.service,
  }, r.minor);
}

// Las vías menores aparecen poco a poco según el zoom (mult < 1 para túneles).
function roadOpacity(mult = 1) {
  const m = (v) => (typeof v === 'number' ? v * mult : ['*', mult, v]);
  return ['step', ['zoom'],
    m(classMatch({ 'motorway|trunk|primary': 1, secondary: 0.9 }, 0)),
    10, m(classMatch({ 'motorway|trunk|primary|secondary': 1, tertiary: 0.9 }, 0)),
    12, m(classMatch({ service: 0 }, 1)),
    14, m(1),
  ];
}

// Categoría de "blip" según la clase de punto de interés de OpenMapTiles.
export const POI_BLIP = [
  'match', ['get', 'class'],
  'fuel', 'blip-fuel',
  'parking', 'blip-parking',
  ['restaurant', 'fast_food', 'food_court'], 'blip-food',
  ['cafe', 'bakery', 'ice_cream'], 'blip-cafe',
  ['bar', 'pub', 'beer', 'nightclub', 'alcohol_shop'], 'blip-bar',
  ['grocery', 'supermarket', 'convenience', 'shop', 'clothing_store', 'mall'], 'blip-shop',
  'pharmacy', 'blip-pharmacy',
  ['hospital', 'doctors', 'dentist', 'clinic', 'veterinary'], 'blip-hospital',
  ['bank', 'atm'], 'blip-bank',
  ['car', 'car_repair', 'car_rental'], 'blip-car',
  ['lodging', 'hotel', 'campsite'], 'blip-hotel',
  'police', 'blip-police',
  'fire_station', 'blip-fire',
  ['school', 'college', 'university', 'kindergarten', 'library'], 'blip-school',
  ['attraction', 'museum', 'art_gallery', 'castle', 'monument', 'viewpoint', 'zoo', 'theme_park'], 'blip-star',
  ['cinema', 'theatre', 'music'], 'blip-cinema',
  ['park', 'garden', 'playground', 'dog_park'], 'blip-park',
  ['railway', 'bus', 'subway', 'tram', 'ferry_terminal', 'aerialway'], 'blip-transit',
  ['stadium', 'sports', 'golf', 'swimming', 'swimming_pool', 'pitch'], 'blip-sport',
  ['post', 'town_hall', 'place_of_worship'], 'blip-landmark',
  'charging_station', 'blip-charge',
  'blip-dot',
];

/** Construye el estilo MapLibre de una skin. */
export function buildStyle(skinId, opts = {}) {
  const s = SKINS[skinId] || SKINS.radar;
  const F = CONFIG.fonts;
  const showPoi = opts.poi !== false;
  const b3d = !!opts.buildings3d;
  const layers = [];
  const L = (layer) => layers.push(layer);
  const roadFilter = (brunnel) => {
    const f = ['all', ['match', ['get', 'class'], ROAD_CLASSES, true, false]];
    if (brunnel === 'tunnel') f.push(['==', ['get', 'brunnel'], 'tunnel']);
    else if (brunnel === 'bridge') f.push(['==', ['get', 'brunnel'], 'bridge']);
    else f.push(['!', ['match', ['get', 'brunnel'], ['tunnel', 'bridge'], true, false]]);
    return f;
  };

  L({ id: 'background', type: 'background', paint: { 'background-color': s.bg } });

  // Suelo
  L({
    id: 'landcover', type: 'fill', source: 'omt', 'source-layer': 'landcover',
    paint: {
      'fill-color': classMatch({ 'wood|forest': s.wood, 'grass|wetland': s.grass, 'sand|beach|rock': s.sand, farmland: s.farmland, ice: '#e8eef2' }, s.grass),
      'fill-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 10, 0.9],
    },
  });
  L({
    id: 'landuse', type: 'fill', source: 'omt', 'source-layer': 'landuse',
    filter: ['match', ['get', 'class'], ['residential', 'suburb', 'neighbourhood', 'industrial', 'garages', 'railway', 'quarry', 'commercial', 'retail', 'cemetery', 'hospital', 'school', 'university', 'college', 'kindergarten', 'stadium', 'pitch', 'playground', 'military'], true, false],
    paint: {
      'fill-color': classMatch({
        'residential|suburb|neighbourhood': s.residential,
        'industrial|garages|railway|quarry|military': s.industrial,
        'commercial|retail': s.commercial,
        cemetery: s.cemetery, hospital: s.hospital,
        'school|university|college|kindergarten': s.school,
        'stadium|pitch|playground': s.pitch,
      }, s.residential),
      'fill-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.4, 12, 1],
    },
  });
  L({ id: 'park', type: 'fill', source: 'omt', 'source-layer': 'park', paint: { 'fill-color': s.park, 'fill-opacity': 0.9 } });
  L({ id: 'aeroway-area', type: 'fill', source: 'omt', 'source-layer': 'aeroway', minzoom: 11, filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': s.aeroway } });
  L({
    id: 'aeroway-runway', type: 'line', source: 'omt', 'source-layer': 'aeroway', minzoom: 11,
    filter: ['all', ['==', ['geometry-type'], 'LineString'], ['match', ['get', 'class'], ['runway', 'taxiway'], true, false]],
    paint: { 'line-color': s.runway, 'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 11, ['match', ['get', 'class'], 'runway', 3, 1], 17, ['match', ['get', 'class'], 'runway', 60, 20]] },
  });

  // Agua
  L({
    id: 'waterway', type: 'line', source: 'omt', 'source-layer': 'waterway',
    filter: ['!=', ['get', 'brunnel'], 'tunnel'],
    paint: { 'line-color': s.waterway, 'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], 8, ['match', ['get', 'class'], 'river', 1, 0.3], 18, ['match', ['get', 'class'], 'river', 24, 6]] },
  });
  L({ id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', filter: ['!=', ['get', 'brunnel'], 'tunnel'], paint: { 'fill-color': s.water } });

  // Edificios
  if (b3d) {
    L({
      id: 'building-3d', type: 'fill-extrusion', source: 'omt', 'source-layer': 'building', minzoom: 14,
      paint: {
        'fill-extrusion-color': s.building3d,
        'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 15.5, ['coalesce', ['get', 'render_height'], 8]],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 0.85,
      },
    });
  } else {
    L({
      id: 'building', type: 'fill', source: 'omt', 'source-layer': 'building', minzoom: 13,
      paint: {
        'fill-color': s.building,
        'fill-outline-color': s.buildingLine,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 14.5, s.glow ? 0.75 : 1],
      },
    });
  }

  // Caminos y vías férreas
  L({
    id: 'path', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 14,
    filter: ['match', ['get', 'class'], ['path', 'track'], true, false],
    paint: { 'line-color': s.roads.path, 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 0.6, 18, 2.2], 'line-dasharray': [2, 1.5] },
  });
  L({
    id: 'rail', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 11,
    filter: ['all', ['match', ['get', 'class'], ['rail', 'transit'], true, false], ['!=', ['get', 'brunnel'], 'tunnel']],
    paint: { 'line-color': s.roads.rail, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.8, 18, 3], 'line-dasharray': [3, 2] },
  });

  // Carreteras: túneles, superficie y puentes
  const roadSet = (prefix, brunnel, opacity = 1) => {
    if (s.glow && brunnel === 'surface') {
      L({
        id: `${prefix}-glow`, type: 'line', source: 'omt', 'source-layer': 'transportation',
        filter: ['all', roadFilter(brunnel), ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], true, false]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': roadColor(s), 'line-width': widthExpr(true), 'line-blur': 6, 'line-opacity': 0.45, 'line-gap-width': 0 },
      });
    }
    L({
      id: `${prefix}-casing`, type: 'line', source: 'omt', 'source-layer': 'transportation', filter: roadFilter(brunnel),
      layout: { 'line-cap': brunnel === 'surface' ? 'round' : 'butt', 'line-join': 'round' },
      paint: {
        'line-color': classMatch({ motorway: s.roads.motorwayCasing }, s.roads.casing),
        'line-width': widthExpr(true),
        'line-opacity': roadOpacity(brunnel === 'tunnel' ? 0.5 : 1),
        ...(brunnel === 'tunnel' ? { 'line-dasharray': [0.5, 0.25] } : {}),
      },
    });
    L({
      id: `${prefix}-fill`, type: 'line', source: 'omt', 'source-layer': 'transportation', filter: roadFilter(brunnel),
      layout: { 'line-cap': brunnel === 'surface' ? 'round' : 'butt', 'line-join': 'round' },
      paint: {
        'line-color': roadColor(s),
        'line-width': widthExpr(false),
        'line-opacity': roadOpacity(brunnel === 'tunnel' ? opacity : 1),
      },
    });
  };
  roadSet('tunnel', 'tunnel', 0.55);
  roadSet('road', 'surface');
  roadSet('bridge', 'bridge');

  L({
    id: 'oneway', type: 'symbol', source: 'omt', 'source-layer': 'transportation', minzoom: 16,
    filter: ['all', ['==', ['get', 'oneway'], 1], ['match', ['get', 'class'], ['primary', 'secondary', 'tertiary', 'minor', 'service'], true, false]],
    layout: { 'symbol-placement': 'line', 'symbol-spacing': 120, 'icon-image': 'oneway', 'icon-size': 0.7, 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true },
    paint: { 'icon-opacity': 0.55 },
  });

  L({
    id: 'boundary', type: 'line', source: 'omt', 'source-layer': 'boundary',
    filter: ['all', ['<=', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]],
    paint: { 'line-color': s.boundary, 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.6, 10, ['match', ['get', 'admin_level'], 2, 2, 1.2]], 'line-dasharray': [3, 2], 'line-opacity': 0.6 },
  });

  // Etiquetas
  L({
    id: 'water-label', type: 'symbol', source: 'omt', 'source-layer': 'water_name',
    filter: ['==', ['geometry-type'], 'Point'],
    layout: { 'text-field': NAME, 'text-font': F.italic, 'text-size': 12, 'text-max-width': 6 },
    paint: { 'text-color': s.waterText, 'text-halo-color': s.halo, 'text-halo-width': 1 },
  });
  L({
    id: 'water-label-line', type: 'symbol', source: 'omt', 'source-layer': 'water_name',
    filter: ['==', ['geometry-type'], 'LineString'],
    layout: { 'text-field': NAME, 'text-font': F.italic, 'text-size': 12, 'symbol-placement': 'line' },
    paint: { 'text-color': s.waterText, 'text-halo-color': s.halo, 'text-halo-width': 1 },
  });
  L({
    id: 'waterway-label', type: 'symbol', source: 'omt', 'source-layer': 'waterway', minzoom: 13,
    filter: ['==', ['get', 'class'], 'river'],
    layout: { 'text-field': NAME, 'text-font': F.italic, 'text-size': 11, 'symbol-placement': 'line' },
    paint: { 'text-color': s.waterText, 'text-halo-color': s.halo, 'text-halo-width': 1 },
  });
  L({
    id: 'road-label', type: 'symbol', source: 'omt', 'source-layer': 'transportation_name', minzoom: 13,
    filter: ['match', ['get', 'class'], ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service'], true, false],
    layout: {
      'symbol-placement': 'line', 'text-field': NAME, 'text-font': F.regular,
      'text-size': ['interpolate', ['linear'], ['zoom'], 13, classMatch({ 'motorway|trunk|primary': 11 }, 10), 18, classMatch({ 'motorway|trunk|primary': 15 }, 13)],
      'text-max-angle': 30, 'text-padding': 4,
    },
    paint: { 'text-color': s.roadText, 'text-halo-color': s.roadHalo, 'text-halo-width': 1.6 },
  });
  if (s.shields) {
    L({
      id: 'road-shield', type: 'symbol', source: 'omt', 'source-layer': 'transportation_name', minzoom: 7,
      filter: ['all', ['has', 'ref'], ['<=', ['coalesce', ['get', 'ref_length'], 9], 7], ['match', ['get', 'class'], ['motorway', 'trunk', 'primary', 'secondary'], true, false]],
      layout: {
        'symbol-placement': 'line', 'symbol-spacing': 360,
        'text-field': ['get', 'ref'], 'text-font': F.bold, 'text-size': 10, 'text-rotation-alignment': 'viewport',
        'icon-image': ['case',
          ['any', ['==', ['get', 'class'], 'motorway'], ['==', ['slice', ['get', 'ref'], 0, 2], 'A-'], ['==', ['slice', ['get', 'ref'], 0, 3], 'AP-']], 'shield-blue',
          ['==', ['slice', ['get', 'ref'], 0, 2], 'N-'], 'shield-red',
          'shield-orange'],
        'icon-text-fit': 'both', 'icon-text-fit-padding': [2, 4, 2, 4], 'icon-rotation-alignment': 'viewport',
      },
      paint: { 'text-color': '#ffffff' },
    });
  }
  L({
    id: 'place-district', type: 'symbol', source: 'omt', 'source-layer': 'place', minzoom: 11,
    filter: ['match', ['get', 'class'], ['suburb', 'quarter', 'neighbourhood'], true, false],
    layout: {
      'text-field': NAME, 'text-font': F.bold, 'text-max-width': 8,
      'text-size': ['interpolate', ['linear'], ['zoom'], 11, 10, 16, 14],
      'text-transform': s.uppercaseDistricts ? 'uppercase' : 'none', 'text-letter-spacing': 0.18,
    },
    paint: { 'text-color': s.districtText, 'text-halo-color': s.halo, 'text-halo-width': 1.4, 'text-opacity': 0.9 },
  });
  L({
    id: 'place-village', type: 'symbol', source: 'omt', 'source-layer': 'place', minzoom: 9,
    filter: ['match', ['get', 'class'], ['village', 'hamlet'], true, false],
    layout: { 'text-field': NAME, 'text-font': F.regular, 'text-size': ['interpolate', ['linear'], ['zoom'], 9, 10, 15, 14], 'text-max-width': 8 },
    paint: { 'text-color': s.placeText, 'text-halo-color': s.placeHalo, 'text-halo-width': 1.4 },
  });
  L({
    id: 'place-town', type: 'symbol', source: 'omt', 'source-layer': 'place', minzoom: 7,
    filter: ['==', ['get', 'class'], 'town'],
    layout: { 'text-field': NAME, 'text-font': F.bold, 'text-size': ['interpolate', ['linear'], ['zoom'], 7, 11, 14, 17], 'text-max-width': 8, 'text-transform': 'uppercase', 'text-letter-spacing': 0.08 },
    paint: { 'text-color': s.placeText, 'text-halo-color': s.placeHalo, 'text-halo-width': 1.6 },
  });
  L({
    id: 'place-city', type: 'symbol', source: 'omt', 'source-layer': 'place', minzoom: 4, maxzoom: 15,
    filter: ['==', ['get', 'class'], 'city'],
    layout: { 'text-field': NAME, 'text-font': F.bold, 'text-size': ['interpolate', ['linear'], ['zoom'], 4, 12, 12, 22], 'text-max-width': 8, 'text-transform': 'uppercase', 'text-letter-spacing': 0.12 },
    paint: { 'text-color': s.placeText, 'text-halo-color': s.placeHalo, 'text-halo-width': 2 },
  });
  L({
    id: 'place-state', type: 'symbol', source: 'omt', 'source-layer': 'place', maxzoom: 8,
    filter: ['match', ['get', 'class'], ['state', 'country'], true, false],
    layout: { 'text-field': NAME, 'text-font': F.bold, 'text-size': ['match', ['get', 'class'], 'country', 15, 12], 'text-transform': 'uppercase', 'text-letter-spacing': 0.2, 'text-max-width': 8 },
    paint: { 'text-color': s.districtText, 'text-halo-color': s.halo, 'text-halo-width': 1.4 },
  });
  L({
    id: 'housenumber', type: 'symbol', source: 'omt', 'source-layer': 'housenumber', minzoom: 18,
    layout: { 'text-field': ['get', 'housenumber'], 'text-font': F.regular, 'text-size': 10 },
    paint: { 'text-color': s.districtText, 'text-halo-color': s.halo, 'text-halo-width': 1, 'text-opacity': 0.8 },
  });

  if (showPoi) {
    const poiLayer = (id, minzoom, filter) => L({
      id, type: 'symbol', source: 'omt', 'source-layer': 'poi', minzoom, filter,
      layout: {
        'icon-image': POI_BLIP, 'icon-size': ['interpolate', ['linear'], ['zoom'], 14, 0.8, 18, 1],
        'text-field': ['step', ['zoom'], '', 16, NAME], 'text-font': F.regular, 'text-size': 10.5,
        'text-anchor': 'top', 'text-offset': [0, 1.2], 'text-optional': true, 'text-max-width': 8,
        'symbol-sort-key': ['get', 'rank'],
      },
      paint: { 'text-color': s.text, 'text-halo-color': s.halo, 'text-halo-width': 1.3 },
    });
    const known = ['!=', POI_BLIP, 'blip-dot'];
    poiLayer('poi-top', 14, ['all', known, ['<=', ['coalesce', ['get', 'rank'], 99], 6]]);
    poiLayer('poi-mid', 16, ['all', known, ['>', ['coalesce', ['get', 'rank'], 99], 6], ['<=', ['coalesce', ['get', 'rank'], 99], 20]]);
    poiLayer('poi-low', 17, ['all', known, ['>', ['coalesce', ['get', 'rank'], 99], 20]]);
  }

  return {
    version: 8,
    name: `Minimapa · ${s.name}`,
    glyphs: CONFIG.glyphsUrl,
    sources: {
      omt: {
        type: 'vector', url: CONFIG.tilesUrl,
        attribution: '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> · <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">© OpenMapTiles</a> · Datos <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a>',
      },
    },
    layers,
  };
}

/** Primera capa de etiquetas: las capas propias (ruta, radares) se insertan debajo. */
export const LABEL_ANCHOR = 'water-label';

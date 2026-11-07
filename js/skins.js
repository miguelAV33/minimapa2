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
  western: {
    id: 'western',
    name: 'Frontera 1899',
    desc: 'Mapa de papel envejecido con tinta sepia, rótulos a mano y ruta en tinta roja.',
    bg: '#e9dcbc', residential: '#e2d2ad', industrial: '#ddcca6', commercial: '#e0cfaa',
    park: '#cfd0a0', wood: '#b9bf8c', grass: '#d4d3a5', sand: '#ecdcb2', farmland: '#e4d8b2',
    cemetery: '#d0cba0', hospital: '#e4cdb0', school: '#e3d3ae', pitch: '#cdd09f',
    water: '#9db8b0', waterway: '#7f9f98', building: '#d9c8a2', buildingLine: '#a68e66', building3d: '#d8c7a2',
    aeroway: '#ddd0b0', runway: '#b9a682',
    roads: {
      motorway: '#6b2f1a', trunk: '#7a3d22', primary: '#5a3a22', secondary: '#6e5236', tertiary: '#7d6448',
      minor: '#8f7a5e', service: '#a08e72', path: '#8f7a5e', rail: '#5a4632',
      casing: '#e9dcbc', motorwayCasing: '#e9dcbc',
    },
    text: '#3b2414', halo: '#efe4c8', roadText: '#4a2c17', roadHalo: '#efe4c8',
    placeText: '#2c1a0e', placeHalo: '#efe4c8', districtText: '#5c3d22', waterText: '#3f6660',
    boundary: '#7a3d22',
    route: '#b3261e', routeCasing: '#f3e8cc', routeAlt: '#9c8566', routeDone: '#a88f6e',
    blipBg: '#efe4c8', blipRing: '#4a2c17', blipShape: 'ink', blipInk: '#4a2c17',
    accent: '#b3261e', accentInk: '#ffffff',
    shields: false, uppercaseDistricts: true, labelItalic: true, casingOff: true, roadWidthMult: 0.55,
    buildingMode: 'faint', fx: 'paper', player: { fill: '#3b2414', stroke: '#f3e8cc' },
  },
  cyber: {
    id: 'cyber',
    name: 'Megaciudad 2077',
    desc: 'Ciudad futurista de noche: negro, amarillo eléctrico, ruta cian y líneas de pantalla.',
    bg: '#0a0a0c', residential: '#101014', industrial: '#141418', commercial: '#16161c',
    park: '#0f1a17', wood: '#0e1916', grass: '#10201b', sand: '#1d1a12', farmland: '#121214',
    cemetery: '#111816', hospital: '#1a1014', school: '#15151a', pitch: '#0f1d18',
    water: '#062a33', waterway: '#0b4552', building: '#15151b', buildingLine: '#4a4612', building3d: '#1e1e26',
    aeroway: '#16161c', runway: '#2a2a30',
    roads: {
      motorway: '#fcee0a', trunk: '#f5d90a', primary: '#e8cc10', secondary: '#d0b412', tertiary: '#ad9814',
      minor: '#56565f', service: '#34343a', path: '#3a3a40', rail: '#2a2a30',
      casing: '#000000', motorwayCasing: '#3a3400',
    },
    text: '#e8e8e8', halo: '#000000', roadText: '#e8e8e8', roadHalo: '#000000',
    placeText: '#fcee0a', placeHalo: '#000000', districtText: '#00f0ff', waterText: '#00c8d8',
    boundary: '#ff003c',
    route: '#00f0ff', routeCasing: '#002a2e', routeAlt: '#5a6b70', routeDone: '#2e5357',
    blipBg: '#000000', blipRing: '#fcee0a', blipShape: 'diamond',
    accent: '#fcee0a', accentInk: '#000000',
    shields: false, uppercaseDistricts: true, glow: true, fx: 'scanlines', player: { fill: '#fcee0a', stroke: '#000000' },
  },
  hacker: {
    id: 'hacker',
    name: 'Terminal',
    desc: 'Ciudad en modo escáner: edificios en alambre azul, calles cian y rejilla de datos.',
    bg: '#03080d', residential: '#061019', industrial: '#07121c', commercial: '#08141f',
    park: '#04140f', wood: '#04120d', grass: '#051a13', sand: '#0a1418', farmland: '#050d12',
    cemetery: '#051410', hospital: '#0d0f19', school: '#071320', pitch: '#05170f',
    water: '#010407', waterway: '#0a2a3a', building: '#071724', buildingLine: '#1ec8ff', building3d: '#0b2333',
    aeroway: '#07121c', runway: '#0f2a3a',
    roads: {
      motorway: '#e8faff', trunk: '#bff0ff', primary: '#7fe3ff', secondary: '#3fc6ef', tertiary: '#2aa3cc',
      minor: '#1b6f8f', service: '#134e66', path: '#134e66', rail: '#0f3a4d',
      casing: '#03080d', motorwayCasing: '#03080d',
    },
    text: '#bfefff', halo: '#03080d', roadText: '#9fe6ff', roadHalo: '#03080d',
    placeText: '#ffffff', placeHalo: '#03080d', districtText: '#1ec8ff', waterText: '#2a7fa0',
    boundary: '#1ec8ff',
    route: '#f5fdff', routeCasing: '#0a6f99', routeAlt: '#2f5d70', routeDone: '#2a4a58',
    blipBg: '#03080d', blipRing: '#1ec8ff', blipShape: 'square',
    accent: '#1ec8ff', accentInk: '#001018',
    shields: false, uppercaseDistricts: true, glow: true, roadWidthMult: 0.7, buildingMode: 'outline',
    fx: 'grid', player: { fill: '#e8faff', stroke: '#03080d' },
  },
  racing: {
    id: 'racing',
    name: 'Circuito',
    desc: 'Mapa de juego de carreras: azul noche, autopistas con borde naranja y ruta de fuego.',
    bg: '#121a2b', residential: '#16203a', industrial: '#18223a', commercial: '#1a2440',
    park: '#123228', wood: '#10302a', grass: '#13372d', sand: '#2b2a2a', farmland: '#152036',
    cemetery: '#14302a', hospital: '#2a1f35', school: '#1c2540', pitch: '#13372d',
    water: '#0a2d55', waterway: '#0d3a6b', building: '#1c2846', buildingLine: '#263457', building3d: '#22305a',
    aeroway: '#18223a', runway: '#2a3a60',
    roads: {
      motorway: '#ffffff', trunk: '#e8eefc', primary: '#c9d6f5', secondary: '#9fb2df', tertiary: '#7f93c4',
      minor: '#4f6293', service: '#3b4c78', path: '#3b4c78', rail: '#2a3a60',
      casing: '#0b1120', motorwayCasing: '#ff7a00',
    },
    text: '#e8eefc', halo: '#0b1120', roadText: '#dfe7fb', roadHalo: '#0b1120',
    placeText: '#ffffff', placeHalo: '#0b1120', districtText: '#8fb1ff', waterText: '#6fa8e8',
    boundary: '#ff7a00',
    route: '#ff6a00', routeCasing: '#3a1400', routeAlt: '#5a6b8f', routeDone: '#6a4a3a',
    blipBg: '#0b1120', blipRing: '#ffffff',
    accent: '#ff6a00', accentInk: '#ffffff',
    shields: true, uppercaseDistricts: true, glow: true, centerLine: '#ffb300', fx: 'none',
  },
  pixel: {
    id: 'pixel',
    name: 'Pixel 97',
    desc: 'Vista cenital de los clásicos de 1997: asfalto oscuro, aceras, línea amarilla y ruta verde.',
    bg: '#8a8f86', residential: '#9a958a', industrial: '#8d8a83', commercial: '#a29a8c',
    park: '#4caf3c', wood: '#3a8f2e', grass: '#5cbf48', sand: '#d8c27a', farmland: '#9fb35a',
    cemetery: '#6f9f5a', hospital: '#c9a3a3', school: '#b3a37a', pitch: '#4caf3c',
    water: '#2f7de1', waterway: '#2f7de1', building: '#6e6a64', buildingLine: '#3e3b37', building3d: '#7a766f',
    aeroway: '#8d8a83', runway: '#3a3a3a',
    roads: {
      motorway: '#2c2c2c', trunk: '#303030', primary: '#333333', secondary: '#363636', tertiary: '#3a3a3a',
      minor: '#404040', service: '#4a4a4a', path: '#b9ad8f', rail: '#5a4a3a',
      casing: '#cfcfc6', motorwayCasing: '#d8d8cf',
    },
    text: '#ffffff', halo: '#202020', roadText: '#ffffff', roadHalo: '#202020',
    placeText: '#ffffff', placeHalo: '#202020', districtText: '#ffe14d', waterText: '#dff0ff',
    boundary: '#202020',
    route: '#33ff33', routeCasing: '#0a3a0a', routeAlt: '#8fbf8f', routeDone: '#557755',
    blipBg: '#202020', blipRing: '#ffffff', blipShape: 'square',
    accent: '#33ff33', accentInk: '#0b0d0c',
    shields: false, uppercaseDistricts: true, centerLine: '#f2d21b', roadWidthMult: 1.25, fx: 'none',
    player: { fill: '#ffe14d', stroke: '#202020' },
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

function widthExpr(extra = false, mult = 1) {
  const expr = ['interpolate', ['exponential', 1.5], ['zoom']];
  for (const [z, m] of Object.entries(WIDTHS)) {
    const { _: fb, ...rest } = m;
    const base = ['*', classMatch(rest, fb), ['case', ['==', ['get', 'ramp'], 1], 0.6 * mult, mult]];
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
  const F0 = CONFIG.fonts;
  // Rótulos en cursiva para las skins de mapa dibujado a mano
  const F = s.labelItalic ? { regular: F0.italic, bold: F0.italic, italic: F0.italic } : F0;
  const wm = s.roadWidthMult || 1;
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
  } else if (s.buildingMode === 'outline') {
    // Edificios "en alambre": solo el contorno
    L({ id: 'building', type: 'fill', source: 'omt', 'source-layer': 'building', minzoom: 13, paint: { 'fill-color': s.building, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 14.5, 0.6] } });
    L({ id: 'building-outline', type: 'line', source: 'omt', 'source-layer': 'building', minzoom: 14, paint: { 'line-color': s.buildingLine, 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 0.4, 18, 1.2], 'line-opacity': 0.75 } });
  } else if (s.buildingMode !== 'none') {
    L({
      id: 'building', type: 'fill', source: 'omt', 'source-layer': 'building', minzoom: 13,
      paint: {
        'fill-color': s.building,
        'fill-outline-color': s.buildingLine,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 14.5, s.buildingMode === 'faint' ? 0.55 : s.glow ? 0.75 : 1],
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
        paint: { 'line-color': roadColor(s), 'line-width': widthExpr(true, wm), 'line-blur': 6, 'line-opacity': 0.45 },
      });
    }
    if (!s.casingOff) L({
      id: `${prefix}-casing`, type: 'line', source: 'omt', 'source-layer': 'transportation', filter: roadFilter(brunnel),
      layout: { 'line-cap': brunnel === 'surface' ? 'round' : 'butt', 'line-join': 'round' },
      paint: {
        'line-color': classMatch({ motorway: s.roads.motorwayCasing }, s.roads.casing),
        'line-width': widthExpr(true, wm),
        'line-opacity': roadOpacity(brunnel === 'tunnel' ? 0.5 : 1),
        ...(brunnel === 'tunnel' ? { 'line-dasharray': [0.5, 0.25] } : {}),
      },
    });
    L({
      id: `${prefix}-fill`, type: 'line', source: 'omt', 'source-layer': 'transportation', filter: roadFilter(brunnel),
      layout: { 'line-cap': brunnel === 'surface' ? 'round' : 'butt', 'line-join': 'round' },
      paint: {
        'line-color': roadColor(s),
        'line-width': widthExpr(false, wm),
        'line-opacity': roadOpacity(brunnel === 'tunnel' ? opacity : 1),
      },
    });
  };
  roadSet('tunnel', 'tunnel', 0.55);
  roadSet('road', 'surface');
  roadSet('bridge', 'bridge');
  // Línea central discontinua en las vías principales (estilo juego de carreras o vista cenital)
  if (s.centerLine) {
    L({
      id: 'road-centerline', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 13,
      filter: ['all', ['match', ['get', 'class'], ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'], true, false], ['!=', ['get', 'brunnel'], 'tunnel'], ['!=', ['get', 'ramp'], 1]],
      paint: { 'line-color': s.centerLine, 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.7, 18, 2.4], 'line-dasharray': [3, 3], 'line-opacity': 0.9 },
    });
  }

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
      filter: ['all', ['has', 'ref'], ['<=', ['coalesce', ['get', 'ref_length'], 9], 7], ['match', ['get', 'class'], ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'], true, false]],
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

/** Efecto de pantalla de cada skin (papel envejecido, líneas de monitor, rejilla de datos). */
export function skinFx(skin) {
  switch (skin?.fx) {
    case 'paper': return 'radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(92,52,18,.38) 100%)';
    case 'scanlines': return 'repeating-linear-gradient(0deg, rgba(0,0,0,.14) 0 1px, rgba(0,0,0,0) 1px 3px), radial-gradient(ellipse at center, rgba(0,0,0,0) 60%, rgba(0,0,0,.45) 100%)';
    case 'grid': return 'linear-gradient(rgba(30,200,255,.07) 1px, rgba(0,0,0,0) 1px) 0 0/44px 44px, linear-gradient(90deg, rgba(30,200,255,.07) 1px, rgba(0,0,0,0) 1px) 0 0/44px 44px, radial-gradient(ellipse at center, rgba(0,0,0,0) 60%, rgba(0,8,14,.55) 100%)';
    default: return 'none';
  }
}

/** Colores de la flecha del jugador. */
export function playerColors(skin) {
  return skin?.player || { fill: '#f5f5f5', stroke: '#0d0d0d' };
}

// ======================================================================
// Skins personalizadas (editor)
// ======================================================================
/** Skins que vienen con la app; las demás las crea el usuario. */
export const BUILTIN_SKINS = Object.keys(SKINS);

const hex = (c) => {
  let x = String(c || '#000').replace('#', '');
  if (x.length === 3) x = x.split('').map((v) => v + v).join('');
  const n = parseInt(x.slice(0, 6), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
/** Mezcla dos colores (t=0 → a, t=1 → b). */
export function mix(a, b, t) { const A = hex(a), B = hex(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); }
/** Aclara (t>0) u oscurece (t<0) un color. */
export function shade(c, t) { return t >= 0 ? mix(c, '#ffffff', t) : mix(c, '#000000', -t); }
/** Luminancia relativa (0 negro, 1 blanco). */
export function lum(c) {
  const [r, g, b] = hex(c).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const isHex = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);

/** Colores que se pueden tocar en el editor: [clave, etiqueta]. */
export const EDIT_COLORS = [
  ['bg', 'Fondo'], ['water', 'Agua'], ['park', 'Parques'], ['building', 'Edificios'],
  ['motorway', 'Autopistas'], ['primary', 'Carreteras'], ['minor', 'Calles'],
  ['text', 'Rótulos'], ['route', 'Ruta'], ['accent', 'Botones y detalles'],
];
/** Opciones del editor con sus valores posibles. */
export const EDIT_OPTIONS = {
  blipShape: [['circle', 'Redondos'], ['square', 'Cuadrados'], ['diamond', 'Rombos'], ['ink', 'Tinta']],
  buildingMode: [['fill', 'Rellenos'], ['faint', 'Suaves'], ['outline', 'Solo contorno'], ['none', 'Ocultos']],
  fx: [['none', 'Ninguno'], ['paper', 'Papel viejo'], ['scanlines', 'Pantalla antigua'], ['grid', 'Rejilla de datos']],
};

/** Valores del editor sacados de una skin existente. */
export function editableFrom(sk) {
  return {
    bg: sk.bg, water: sk.water, park: sk.park, building: sk.building,
    motorway: sk.roads.motorway, primary: sk.roads.primary, minor: sk.roads.minor,
    text: sk.placeText || sk.text, route: sk.route, accent: sk.accent,
    glow: !!sk.glow, uppercaseDistricts: !!sk.uppercaseDistricts, shields: !!sk.shields,
    labelItalic: !!sk.labelItalic, casingOff: !!sk.casingOff, centerLine: sk.centerLine || '',
    blipShape: sk.blipShape || 'circle', buildingMode: sk.buildingMode || 'fill', fx: sk.fx || 'none',
    roadWidthMult: sk.roadWidthMult || 1,
  };
}

/**
 * Construye una paleta completa a partir de los pocos colores del editor.
 * def = { id, name, base, colors: {...EDIT_COLORS}, opts: {...} }
 */
export function deriveSkin(def) {
  const base = SKINS[def.base] && BUILTIN_SKINS.includes(def.base) ? SKINS[def.base] : SKINS.radar;
  const c = { ...editableFrom(base), ...(def.colors || {}) };
  for (const [k] of EDIT_COLORS) if (!isHex(c[k])) c[k] = editableFrom(base)[k];
  const o = { ...editableFrom(base), ...(def.opts || {}) };
  const dark = lum(c.bg) < 0.25;
  const halo = dark ? shade(c.bg, -0.55) : shade(c.bg, 0.45);
  const sk = {
    ...base,
    id: def.id, name: String(def.name || 'Mi skin').slice(0, 28), desc: 'Skin personalizada', custom: true, base: base.id,
    bg: c.bg,
    residential: mix(c.bg, c.text, 0.04), industrial: mix(c.bg, c.text, 0.06), commercial: mix(c.bg, c.text, 0.07),
    farmland: mix(c.bg, c.park, 0.12), sand: mix(c.bg, '#d8c27a', 0.25),
    park: c.park, wood: shade(c.park, dark ? -0.12 : -0.08), grass: mix(c.park, c.bg, 0.3), pitch: c.park,
    cemetery: mix(c.park, c.bg, 0.5), hospital: mix(c.bg, '#c96a7a', 0.12), school: mix(c.bg, '#c9a96a', 0.1),
    water: c.water, waterway: shade(c.water, dark ? 0.12 : -0.1), waterText: mix(c.water, c.text, 0.65),
    building: c.building, building3d: shade(c.building, dark ? 0.08 : -0.05), buildingLine: shade(c.building, dark ? 0.18 : -0.18),
    aeroway: mix(c.bg, c.building, 0.5), runway: shade(c.building, dark ? 0.15 : -0.15),
    roads: {
      motorway: c.motorway, trunk: mix(c.motorway, c.primary, 0.4), primary: c.primary,
      secondary: mix(c.primary, c.minor, 0.4), tertiary: mix(c.primary, c.minor, 0.7), minor: c.minor,
      service: mix(c.minor, c.bg, 0.3), path: mix(c.minor, c.bg, 0.15), rail: mix(c.minor, c.bg, 0.2),
      casing: dark ? shade(c.bg, -0.5) : shade(c.bg, -0.25), motorwayCasing: shade(c.motorway, dark ? -0.5 : -0.35),
    },
    text: c.text, halo, roadText: c.text, roadHalo: halo, placeText: c.text, placeHalo: halo,
    districtText: mix(c.text, c.accent, 0.5), boundary: mix(c.text, c.bg, 0.5),
    route: c.route, routeCasing: shade(c.route, -0.6), routeAlt: mix(c.route, c.bg, 0.55), routeDone: mix(c.route, c.bg, 0.72),
    accent: c.accent, accentInk: lum(c.accent) > 0.45 ? '#0b0d0c' : '#ffffff',
    blipBg: dark ? shade(c.bg, -0.4) : shade(c.bg, 0.5), blipRing: c.accent, blipInk: c.text,
    glow: !!o.glow, uppercaseDistricts: !!o.uppercaseDistricts, shields: !!o.shields,
    labelItalic: !!o.labelItalic, casingOff: !!o.casingOff,
    centerLine: isHex(o.centerLine) ? o.centerLine : '',
    blipShape: EDIT_OPTIONS.blipShape.some(([v]) => v === o.blipShape) ? o.blipShape : 'circle',
    buildingMode: EDIT_OPTIONS.buildingMode.some(([v]) => v === o.buildingMode) ? o.buildingMode : 'fill',
    fx: EDIT_OPTIONS.fx.some(([v]) => v === o.fx) ? o.fx : 'none',
    roadWidthMult: Math.max(0.4, Math.min(1.8, Number(o.roadWidthMult) || 1)),
    player: base.player,
  };
  return sk;
}

/** Comprueba y normaliza una skin importada. Devuelve null si no es válida. */
export function cleanSkinDef(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw.minimapaSkin && typeof raw.minimapaSkin === 'object' ? raw.minimapaSkin : raw;
  if (!d.colors || typeof d.colors !== 'object') return null;
  const colors = {};
  for (const [k] of EDIT_COLORS) if (isHex(d.colors[k])) colors[k] = d.colors[k].toLowerCase();
  if (Object.keys(colors).length < 3) return null;
  const opts = {};
  const src = d.opts || {};
  for (const k of ['glow', 'uppercaseDistricts', 'shields', 'labelItalic', 'casingOff']) if (k in src) opts[k] = !!src[k];
  for (const k of Object.keys(EDIT_OPTIONS)) if (EDIT_OPTIONS[k].some(([v]) => v === src[k])) opts[k] = src[k];
  if (src.centerLine === '' || isHex(src.centerLine)) opts.centerLine = src.centerLine;
  if (Number.isFinite(Number(src.roadWidthMult))) opts.roadWidthMult = Math.max(0.4, Math.min(1.8, Number(src.roadWidthMult)));
  const id = /^custom-[a-z0-9-]{1,40}$/.test(d.id || '') ? d.id : `custom-${Date.now().toString(36)}`;
  return { id, name: String(d.name || 'Skin importada').replace(/[<>]/g, '').slice(0, 28), base: BUILTIN_SKINS.includes(d.base) ? d.base : 'radar', colors, opts };
}

/** Registra (o actualiza) una skin personalizada para poder usarla en el mapa. */
export function registerSkin(def) {
  const clean = cleanSkinDef(def);
  if (!clean) return null;
  SKINS[clean.id] = deriveSkin(clean);
  return clean;
}
export function unregisterSkin(id) {
  if (!BUILTIN_SKINS.includes(id)) delete SKINS[id];
}

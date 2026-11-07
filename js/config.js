// Configuración de servicios. Todo lo que hay aquí es gratuito y sin registro.
// Para pruebas se puede sobrescribir con window.__MINIMAPA_OVERRIDES antes de cargar la app.
export const CONFIG = Object.assign({
  version: '1.0.0',
  // Mapa vectorial (OpenStreetMap vía OpenFreeMap)
  tilesUrl: 'https://tiles.openfreemap.org/planet',
  glyphsUrl: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  fonts: {
    regular: ['Noto Sans Regular'],
    bold: ['Noto Sans Bold'],
    italic: ['Noto Sans Italic'],
  },
  // Rutas: Valhalla (FOSSGIS) con instrucciones en español; OSRM como respaldo
  valhalla: ['https://valhalla1.openstreetmap.de'],
  osrm: 'https://router.project-osrm.org',
  // Búsqueda de direcciones y lugares
  photon: 'https://photon.komoot.io',
  nominatim: 'https://nominatim.openstreetmap.org',
  // Consultas de puntos de interés y radares de OpenStreetMap en directo
  overpass: [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
  ],
  // Precios de carburantes (Ministerio para la Transición Ecológica)
  minetur: 'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/',
  // Datos generados cada día por GitHub Actions (mismo sitio, sin CORS)
  radarData: 'data/radares.json',
  fuelData: 'data/gasolineras.json',
  radarRefreshHours: 6,
  // Vista inicial si aún no hay GPS (Madrid)
  startCenter: [-3.7038, 40.4168],
  startZoom: 11,
}, globalThis.__MINIMAPA_OVERRIDES || {});

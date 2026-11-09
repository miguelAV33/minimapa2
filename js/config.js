// Configuración de servicios. Todo lo que hay aquí es gratuito y sin registro.
import { BUILD } from './build-info.js';

// En el APK los datos actualizados se descargan de GitHub Pages; si no hay conexión, se usan los incluidos.
const remote = (path) => (BUILD.remoteBase ? [BUILD.remoteBase + path, path] : [path]);
// Para pruebas se puede sobrescribir con window.__MINIMAPA_OVERRIDES antes de cargar la app.
export const CONFIG = Object.assign({
  version: BUILD.version,
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
  radarData: remote('data/radares.json'),
  fuelData: remote('data/gasolineras.json'),
  zbeData: remote('data/zbe.json'),
  // Incidencias de tráfico de la DGT. El APK las pide directamente; la web usa la copia que deja GitHub Actions
  dgtIncidents: 'https://nap.dgt.es/datex2/v3/dgt/SituationPublication/datex2_v37.xml',
  incidentData: BUILD.remoteBase ? [BUILD.remoteBase + 'data/incidencias.xml'] : ['data/incidencias.xml'],
  radarRefreshHours: 6,
  // Vista inicial si aún no hay GPS (Madrid)
  startCenter: [-3.7038, 40.4168],
  startZoom: 11,
}, globalThis.__MINIMAPA_OVERRIDES || {});

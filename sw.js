// Service worker: la app funciona sin conexión y guarda en caché el mapa que ya has visto.
const VERSION = 'minimapa-1.0.0';
const SHELL_CACHE = `${VERSION}-app`;
const TILE_CACHE = 'minimapa-tiles';
const MAX_TILES = 6000;

const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/config.js', 'js/util.js', 'js/skins.js', 'js/blips.js', 'js/icons.js', 'js/voice.js',
  'js/routing.js', 'js/nav.js', 'js/radars.js', 'js/search.js', 'js/fuel.js',
  'vendor/maplibre-gl.mjs', 'vendor/maplibre-gl-worker.mjs', 'vendor/maplibre-gl.css',
  'fonts/oswald-latin-400-normal.woff2', 'fonts/oswald-latin-500-normal.woff2', 'fonts/oswald-latin-600-normal.woff2',
  'fonts/oswald-latin-700-normal.woff2', 'fonts/bebas-neue-latin-400-normal.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/favicon-64.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.endsWith('-app') && k !== SHELL_CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

let putCount = 0;
async function trimTiles() {
  const c = await caches.open(TILE_CACHE);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - MAX_TILES; i++) await c.delete(keys[i]);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Datos que se actualizan solos: primero la red
  if (url.origin === location.origin && url.pathname.includes('/data/')) {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) (await caches.open(SHELL_CACHE)).put(url.pathname, res.clone());
        return res;
      } catch {
        return (await caches.match(url.pathname)) || Response.error();
      }
    })());
    return;
  }

  // App: caché y actualización en segundo plano
  if (url.origin === location.origin) {
    e.respondWith((async () => {
      const cached = await caches.match(req, { ignoreSearch: true });
      const net = fetch(req).then(async (res) => {
        if (res.ok) (await caches.open(SHELL_CACHE)).put(req, res.clone());
        return res;
      }).catch(() => null);
      return cached || (await net) || Response.error();
    })());
    return;
  }

  // Teselas y tipografías del mapa: caché primero (las URL de teselas llevan versión)
  if (url.hostname === 'tiles.openfreemap.org') {
    const isTileJson = /^\/planet\/?$/.test(url.pathname);
    e.respondWith((async () => {
      const c = await caches.open(TILE_CACHE);
      if (isTileJson) {
        try { const res = await fetch(req); if (res.ok) c.put(req, res.clone()); return res; } catch { return (await c.match(req)) || Response.error(); }
      }
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) {
        c.put(req, res.clone());
        if (++putCount % 200 === 0) trimTiles();
      }
      return res;
    })());
  }
});

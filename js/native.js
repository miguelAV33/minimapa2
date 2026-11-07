// Integración con la app Android (Capacitor). En el navegador todo esto queda desactivado.
import { BUILD } from './build-info.js';

const Cap = globalThis.Capacitor;
export const NATIVE = !!(Cap && typeof Cap.isNativePlatform === 'function' && Cap.isNativePlatform());

function plugin(name) {
  if (!NATIVE) return null;
  return Cap.Plugins?.[name] || (typeof Cap.registerPlugin === 'function' ? Cap.registerPlugin(name) : null);
}

export const Native = {
  get geo() { return plugin('BackgroundGeolocation'); },
  get tts() { return plugin('TextToSpeech'); },
  get keepAwake() { return plugin('KeepAwake'); },
  get share() { return plugin('Share'); },
  get app() { return plugin('App'); },
  get car() { return plugin('CarBridge'); },
  get sistema() { return plugin('Sistema'); },
};

/** GPS nativo que sigue funcionando con la pantalla apagada (servicio en primer plano con notificación). */
export async function startNativeGps(onFix, onError) {
  const geo = Native.geo;
  if (!geo) return false;
  await geo.addWatcher({
    backgroundTitle: 'Minimapa activo',
    backgroundMessage: 'Navegación y avisos de radar en marcha. Ciérrala desde la app.',
    requestPermissions: true,
    stale: false,
    distanceFilter: 0,
  }, (loc, err) => {
    if (err) { onError?.(err); return; }
    if (!loc) return;
    onFix({
      lat: loc.latitude, lon: loc.longitude, acc: loc.accuracy,
      speed: loc.speed ?? null, heading: loc.bearing ?? null, t: loc.time || Date.now(),
    });
  });
  return true;
}

export function openNativeSettings() {
  try { Native.geo?.openSettings(); } catch { /* nada */ }
}

/** Mantener la pantalla encendida. */
export async function nativeKeepAwake(on) {
  const k = Native.keepAwake;
  if (!k) return false;
  try { if (on) await k.keepAwake(); else await k.allowSleep(); return true; } catch { return false; }
}

/** Compartir texto (WhatsApp, Telegram, correo…). */
export async function shareText(title, text, url) {
  if (Native.share) {
    try { await Native.share.share({ title, text, url, dialogTitle: title }); return true; } catch { return false; }
  }
  if (navigator.share) {
    try { await navigator.share({ title, text, url }); return true; } catch { return false; }
  }
  return false;
}

/** ¿Hay una versión nueva del APK en GitHub? Devuelve {version, url, notes} o null. */
export async function checkForUpdate() {
  if (!NATIVE || !BUILD.repo || !BUILD.code) return null;
  const r = await fetch(`https://api.github.com/repos/${BUILD.repo}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
  if (!r.ok) return null;
  const rel = await r.json();
  const m = String(rel.tag_name || '').match(/(\d+)\.(\d+)\.(\d+)/);
  const code = m ? Number(m[3]) : 0;
  if (code <= BUILD.code) return null;
  const asset = (rel.assets || []).find((a) => /\.apk$/i.test(a.name));
  return { version: rel.tag_name.replace(/^v/, ''), url: asset?.browser_download_url || rel.html_url, page: rel.html_url, notes: rel.body || '' };
}

/** Enlace de descarga fijo del APK (para pasárselo a otra persona). */
export function apkLink() {
  return BUILD.repo ? `https://github.com/${BUILD.repo}/releases/latest/download/minimapa.apk` : '';
}

export { BUILD };

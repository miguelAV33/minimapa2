// Salida y puesta de sol (algoritmo NOAA simplificado) para cambiar de skin de día a noche.
const rad = Math.PI / 180;

/** Horas (Date) de salida y puesta de sol para un día y lugar. Devuelve null en noche/día polar. */
export function sunTimes(lat, lon, date = new Date()) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const day = Math.floor((date.getTime() - start) / 864e5);
  const g = (2 * Math.PI / 365) * (day - 1);
  const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const cosH = (Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl))) - Math.tan(lat * rad) * Math.tan(decl);
  if (cosH > 1 || cosH < -1) return null;
  const ha = Math.acos(cosH) / rad;
  const base = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const sunrise = new Date(base + (720 - 4 * (lon + ha) - eqTime) * 60000);
  const sunset = new Date(base + (720 - 4 * (lon - ha) - eqTime) * 60000);
  return { sunrise, sunset };
}

/** ¿Es de noche ahora en ese punto? (con 20 minutos de margen de crepúsculo) */
export function isNight(lat, lon, date = new Date()) {
  const t = sunTimes(lat, lon, date);
  if (!t) return Math.abs(lat) > 60 ? [10, 11, 0, 1].includes(date.getUTCMonth()) : false;
  const m = 20 * 60000;
  return date < new Date(t.sunrise.getTime() + m) || date > new Date(t.sunset.getTime() - m);
}

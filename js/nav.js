// Motor de navegación giro a giro: ajuste a la ruta, siguiente maniobra, avisos de voz,
// detección de salida de ruta, tiempo restante y llegada. Sin dependencias del DOM.
import { projectToSegment, bearing, angDiff, speakDist, lowerFirst, clamp, dist } from './util.js';
import { limitAt } from './routing.js';

export class NavEngine {
  /**
   * cb.speak(text, {priority}), cb.reroute(fix), cb.arrive(), cb.waypoint(index)
   */
  constructor(cb = {}) {
    this.cb = cb;
    this.route = null;
  }

  setRoute(route, { keepProgress = false } = {}) {
    this.route = route;
    this.seg = 0;
    this.along = 0;
    this.offCount = 0;
    this.lastReroute = keepProgress ? this.lastReroute : 0;
    this.arrived = false;
    this.flags = route.maneuvers.map(() => ({ far: false, mid: false, pre: false, post: false }));
    this.lastIdx = -1;
    this.trafficFactor = 1;
    this.globalSearchCounter = 0;
    // No anunciar la maniobra de salida si ya estamos en marcha
    if (route.maneuvers[0]?.kind === 'depart') this.flags[0] = { far: true, mid: true, pre: true, post: false };
  }

  /** Busca el segmento más cercano entre i0 e i1. */
  _search(fix, i0, i1, heading) {
    const c = this.route.coords;
    let best = null;
    for (let i = i0; i < i1; i++) {
      const p = projectToSegment(fix.lat, fix.lon, c[i][1], c[i][0], c[i + 1][1], c[i + 1][0]);
      let score = p.d;
      if (heading != null && fix.speed > 3) {
        const sb = bearing(c[i][1], c[i][0], c[i + 1][1], c[i + 1][0]);
        if (angDiff(sb, heading) > 100) score += 30;
      }
      if (!best || score < best.score) best = { i, p, score };
    }
    return best;
  }

  /** Procesa una posición GPS. fix: {lat, lon, speed (m/s), heading, acc}. */
  update(fix) {
    const r = this.route;
    if (!r || this.arrived) return null;
    const n = r.coords.length;
    const heading = fix.heading;

    // 1) Ajuste local (ventana hacia delante)
    const i0 = Math.max(0, this.seg - 3);
    let i1 = this.seg;
    const limitAlong = r.cum[this.seg] + 2500;
    while (i1 < n - 1 && r.cum[i1] < limitAlong) i1++;
    i1 = Math.max(i1, Math.min(n - 1, this.seg + 2));
    let best = this._search(fix, i0, Math.min(i1, n - 1), heading);

    const acc = clamp(fix.acc || 10, 5, 60);
    const threshold = 30 + acc;

    // 2) Si estamos lejos, búsqueda global de vez en cuando (por si retomamos la ruta más adelante)
    if (best && best.p.d > threshold && ++this.globalSearchCounter % 3 === 0) {
      const g = this._search(fix, 0, n - 1, heading);
      if (g && g.p.d < best.p.d) best = g;
    }
    if (!best) return null;

    const offset = best.p.d;
    const segLen = r.cum[best.i + 1] - r.cum[best.i];
    const along = r.cum[best.i] + best.p.t * segLen;
    // No retroceder por ruido del GPS
    if (along >= this.along - 30 || offset < threshold) {
      this.seg = best.i;
      this.along = Math.max(along, this.along - 30);
    }
    const segBearing = bearing(r.coords[best.i][1], r.coords[best.i][0], r.coords[best.i + 1][1], r.coords[best.i + 1][0]);

    // 3) ¿Fuera de ruta?
    let offRoute = false;
    if (offset > threshold) {
      const wrongWay = heading != null && fix.speed > 3 && angDiff(heading, segBearing) > 60;
      this.offCount += wrongWay || offset > threshold * 2 ? 2 : 1;
      if (this.offCount >= 3) offRoute = true;
    } else {
      this.offCount = 0;
    }
    const now = Date.now();
    if (offRoute && now - (this.lastReroute || 0) > 7000) {
      this.lastReroute = now;
      this.offCount = 0;
      this.cb.reroute?.(fix);
    }

    // 4) Siguiente maniobra
    const ms = r.maneuvers;
    let idx = -1;
    for (let k = 0; k < ms.length; k++) {
      if (ms[k].along > this.along + 4 || (ms[k].kind === 'arrive' && k === ms.length - 1)) { idx = k; break; }
    }
    const next = idx >= 0 ? ms[idx] : null;
    const distNext = next ? Math.max(0, next.along - this.along) : 0;
    const afterNext = idx >= 0 && idx + 1 < ms.length ? ms[idx + 1] : null;
    const distAfter = afterNext ? afterNext.along - next.along : Infinity;

    // 5) Tiempo y distancia restantes
    const remaining = Math.max(0, r.length - this.along);
    const tSeg = r.times[best.i] + best.p.t * (r.times[best.i + 1] - r.times[best.i]);
    const remainingTime = Math.max(0, (r.duration - tSeg) * (this.trafficFactor || 1));

    // 6) Avisos de voz
    if (!offRoute && next && offset <= threshold) this._announce(idx, next, distNext, fix.speed || 0, afterNext, distAfter);

    // Paso de una maniobra intermedia de parada
    if (next && next.kind === 'waypoint' && distNext < 25 && !this.flags[idx].post) {
      this.flags[idx].post = true;
      this.cb.waypoint?.(idx);
    }

    // 7) Llegada
    const destLast = r.coords[n - 1];
    const dDest = dist(fix.lat, fix.lon, destLast[1], destLast[0]);
    if ((remaining < 25 && offset < threshold + 20) || dDest < 20) {
      this.arrived = true;
      this.cb.speak?.('Has llegado a tu destino.', { priority: 'high' });
      this.cb.arrive?.();
    }

    return {
      along: this.along, offset, offRoute, segIndex: best.i, segBearing,
      snapped: { lat: best.p.lat, lon: best.p.lon },
      next, nextIndex: idx, distNext, afterNext, distAfter,
      remaining, remainingTime,
      limit: limitAt(r.limits, this.along),
      arrived: this.arrived,
    };
  }

  _announce(idx, m, d, speed, after, distAfter) {
    const f = this.flags[idx];
    const v = Math.max(speed, 8);
    const farD = v > 22 ? 2000 : v > 14 ? 1000 : 500;
    const midD = v > 22 ? 800 : 0;
    const preD = clamp(v * 9, 60, 350);
    const say = (t, p) => this.cb.speak?.(t, p);
    const instr = (s) => lowerFirst((s || m.text || '').replace(/\.$/, ''));

    // Indicación "continúa X km" justo después de una maniobra si la siguiente queda lejos
    if (this.lastIdx !== idx) {
      this.lastIdx = idx;
      if (idx > 0 && d > 3000) {
        const prev = this.route.maneuvers[idx - 1];
        if (prev && !this.flags[idx - 1].post) {
          this.flags[idx - 1].post = true;
          say(`Continúa durante ${speakDist(d)}.`);
        }
      }
    }
    if (m.kind === 'arrive' || m.kind === 'waypoint') {
      if (!f.far && d <= farD && d > preD * 1.5) { f.far = true; say(`En ${speakDist(d)}, ${m.kind === 'arrive' ? 'llegarás a tu destino' : 'llegarás a la parada'}.`); }
      if (!f.pre && d <= Math.max(preD, 120) && d > 30) { f.pre = true; f.far = true; say(m.kind === 'arrive' ? 'Tu destino está cerca.' : 'Tu parada está cerca.'); }
      return;
    }
    if (!f.far && d <= farD && d > preD * 1.8) {
      f.far = true;
      say(`En ${speakDist(d)}, ${instr(m.alert)}.`);
    } else if (midD && !f.mid && d <= midD && d > preD * 1.8 && f.far) {
      f.mid = true;
      say(`En ${speakDist(d)}, ${instr(m.alert)}.`);
    }
    if (!f.pre && d <= preD) {
      f.pre = true; f.far = true; f.mid = true;
      let text = m.pre || m.text;
      if (after && distAfter < 150 && !/luego/i.test(text) && after.kind !== 'arrive') {
        text = `${text.replace(/\.$/, '')}. Luego, ${instr(after.alert || after.text)}.`;
      }
      say(text, { priority: 'high' });
    }
  }
}

/** Genera posiciones simuladas a lo largo de una ruta (para probar sin moverse). */
export class RouteSimulator {
  constructor(route, { speedMode = 'auto', onFix, intervalMs = 1000 } = {}) {
    this.route = route;
    this.speedMode = speedMode;
    this.onFix = onFix;
    this.intervalMs = intervalMs;
    this.along = 0;
    this.timer = null;
    this.paused = false;
  }

  _speedAt(along) {
    const r = this.route;
    const lim = limitAt(r.limits, along);
    // velocidad estimada por el propio cálculo de ruta
    let i = 0, lo = 0, hi = r.cum.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (r.cum[mid] <= along) lo = mid; else hi = mid; }
    i = lo;
    const dt = r.times[i + 1] - r.times[i];
    const dd = r.cum[i + 1] - r.cum[i];
    const est = dt > 0 ? dd / dt : 13.9;
    const base = lim ? lim / 3.6 : est;
    switch (this.speedMode) {
      case 'over': return base * 1.2;
      case '50': return 50 / 3.6;
      case '90': return 90 / 3.6;
      case '120': return 120 / 3.6;
      default: return clamp(est, 3, 40);
    }
  }

  start() {
    this.stop();
    let last = null;
    const tick = () => {
      if (this.paused) return;
      const r = this.route;
      const v = this._speedAt(this.along);
      this.along = Math.min(r.length, this.along + v * (this.intervalMs / 1000));
      let lo = 0, hi = r.cum.length - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (r.cum[mid] <= this.along) lo = mid; else hi = mid; }
      const seg = r.cum[hi] - r.cum[lo];
      const t = seg > 0 ? (this.along - r.cum[lo]) / seg : 0;
      const lat = r.coords[lo][1] + t * (r.coords[hi][1] - r.coords[lo][1]);
      const lon = r.coords[lo][0] + t * (r.coords[hi][0] - r.coords[lo][0]);
      const hdg = bearing(r.coords[lo][1], r.coords[lo][0], r.coords[hi][1], r.coords[hi][0]);
      const fix = { lat, lon, speed: v, heading: hdg, acc: 5, t: Date.now(), sim: true };
      last = fix;
      this.onFix?.(fix);
      if (this.along >= r.length) this.stop();
    };
    this.timer = setInterval(tick, this.intervalMs);
    tick();
    return last;
  }

  setRoute(route) {
    // Tras recalcular, seguir desde el principio de la nueva ruta
    this.route = route;
    this.along = 0;
  }

  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }
}

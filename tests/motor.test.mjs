// Pruebas del motor de navegación y de los avisos de radar (sin navegador): node tests/motor.test.mjs
import assert from 'node:assert/strict';
import { encodePolyline, destPoint, dist, decodePolyline, cumulative, pointAlong, bearing, fmtDist, fmtDur, speakDist } from '../js/util.js';
import { NavEngine, RouteSimulator } from '../js/nav.js';
import { RadarDB, RadarWatcher, radarsOnRoute, parseOverpass } from '../js/radars.js';
import { osrmInstruction, limitAt } from '../js/routing.js';
import { parseCoords } from '../js/search.js';

let pass = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { console.error('  ✗', name); throw e; } };

// ---- Ruta sintética: 600 m al norte, giro a la derecha 800 m, giro a la izquierda 500 m ----
const start = [40.2380, -3.7700];
const pts = [start];
const walk = (brg, meters, step = 20) => { for (let d = step; d <= meters; d += step) pts.push(destPoint(...pts[pts.length - 1], brg, step)); };
walk(0, 600); const iRight = pts.length - 1;
walk(90, 800); const iLeft = pts.length - 1;
walk(0, 500); const iEnd = pts.length - 1;
const coords = pts.map(([la, lo]) => [lo, la]);

// Respuesta con el formato de Valhalla
const trip = {
  legs: [{
    shape: encodePolyline(coords, 6),
    maneuvers: [
      { type: 1, instruction: 'Conduce hacia el norte por Calle Real.', verbal_pre_transition_instruction: 'Conduce hacia el norte por Calle Real.', street_names: ['Calle Real'], time: 50, length: 0.6, begin_shape_index: 0, end_shape_index: iRight },
      { type: 10, instruction: 'Gira a la derecha en Avenida del Sol.', verbal_transition_alert_instruction: 'Gira a la derecha en Avenida del Sol.', verbal_pre_transition_instruction: 'Gira a la derecha en Avenida del Sol.', street_names: ['Avenida del Sol'], time: 60, length: 0.8, begin_shape_index: iRight, end_shape_index: iLeft },
      { type: 15, instruction: 'Gira a la izquierda en Calle Luna.', verbal_transition_alert_instruction: 'Gira a la izquierda en Calle Luna.', verbal_pre_transition_instruction: 'Gira a la izquierda en Calle Luna.', street_names: ['Calle Luna'], time: 40, length: 0.5, begin_shape_index: iLeft, end_shape_index: iEnd },
      { type: 4, instruction: 'Has llegado a tu destino.', verbal_pre_transition_instruction: 'Has llegado a tu destino.', time: 0, length: 0, begin_shape_index: iEnd, end_shape_index: iEnd },
    ],
  }],
  summary: { time: 150, length: 1.9, has_toll: false },
};

// Ruta normalizada igual que la construye routing.js (sin red)
function buildRoute() {
  const r = {
    provider: 'valhalla', coords: decodePolyline(trip.legs[0].shape, 6), duration: 150, summary: {},
    maneuvers: trip.legs[0].maneuvers.map((m) => ({
      kind: { 1: 'depart', 10: 'right', 15: 'left', 4: 'arrive' }[m.type], text: m.instruction,
      pre: m.verbal_pre_transition_instruction, alert: m.verbal_transition_alert_instruction || m.verbal_pre_transition_instruction,
      street: (m.street_names || []).join(' / '), begin: m.begin_shape_index, time: m.time, length: m.length * 1000, exit: 0, sign: '',
    })),
  };
  r.cum = cumulative(r.coords);
  r.length = r.cum[r.cum.length - 1];
  r.maneuvers.forEach((m) => { m.along = r.cum[m.begin]; });
  r.times = new Float64Array(r.coords.length);
  for (let i = 1; i < r.coords.length; i++) r.times[i] = (r.cum[i] / r.length) * r.duration;
  r.limits = [{ a: 0, b: 600, lim: 50 }, { a: 600, b: 1400, lim: 70 }, { a: 1400, b: 2000, lim: 30 }];
  return r;
}

console.log('Utilidades');
test('polilínea ida y vuelta', () => {
  const back = decodePolyline(encodePolyline(coords, 6), 6);
  assert.equal(back.length, coords.length);
  assert.ok(Math.abs(back[10][0] - coords[10][0]) < 1e-6);
});
test('formatos', () => {
  assert.equal(fmtDist(347), '350 m');
  assert.equal(fmtDist(1530), '1,5 km');
  assert.equal(fmtDur(3900), '1 h 5 min');
  assert.equal(speakDist(1500), '1,5 kilómetros');
  assert.equal(speakDist(480), '500 metros');
});
test('coordenadas pegadas en el buscador', () => {
  assert.deepEqual(parseCoords('40.2381, -3.7701'), { lat: 40.2381, lon: -3.7701 });
  assert.deepEqual(parseCoords('40,2381 -3,7701'), { lat: 40.2381, lon: -3.7701 });
  assert.equal(parseCoords('Calle Mayor 5'), null);
});
test('instrucciones OSRM en español', () => {
  assert.equal(osrmInstruction({ name: 'Gran Vía', maneuver: { type: 'turn', modifier: 'left' } }).text, 'Gira a la izquierda hacia Gran Vía');
  assert.equal(osrmInstruction({ name: '', maneuver: { type: 'roundabout', exit: 2 } }).text, 'En la rotonda, toma la segunda salida');
  assert.equal(osrmInstruction({ maneuver: { type: 'off ramp', modifier: 'slight right' }, exits: '12', name: 'M-50' }).kind, 'exit-right');
});
test('límite a lo largo de la ruta', () => {
  const r = buildRoute();
  assert.equal(limitAt(r.limits, 300), 50);
  assert.equal(limitAt(r.limits, 1000), 70);
  assert.equal(limitAt(r.limits, 5000), null);
});

console.log('Navegación');
test('recorrido completo: avisos, maniobras y llegada', () => {
  const route = buildRoute();
  const said = [];
  let arrived = 0, reroutes = 0;
  const eng = new NavEngine({ speak: (t) => said.push(t), arrive: () => arrived++, reroute: () => reroutes++ });
  eng.setRoute(route);
  const sim = new RouteSimulator(route, { speedMode: '50' });
  const fixes = [];
  sim.onFix = (f) => fixes.push(f);
  // avanzar el simulador a mano, sin temporizadores
  while (sim.along < route.length) {
    const v = 50 / 3.6;
    sim.along = Math.min(route.length, sim.along + v);
    const p = pointAlong(route.coords, route.cum, sim.along);
    const c = route.coords;
    const hdg = bearing(c[p.i][1], c[p.i][0], c[p.i + 1][1], c[p.i + 1][0]);
    fixes.push({ lat: p.lat, lon: p.lon, speed: v, heading: hdg, acc: 5, t: Date.now() });
  }
  let sawRight = false, sawLeft = false;
  for (const f of fixes) {
    const s = eng.update(f);
    if (s?.next?.kind === 'right') sawRight = true;
    if (s?.next?.kind === 'left') sawLeft = true;
  }
  assert.ok(sawRight && sawLeft, 'debe pasar por las dos maniobras');
  assert.equal(reroutes, 0, 'no debe recalcular siguiendo la ruta');
  assert.equal(arrived, 1, 'debe llegar una vez');
  const txt = said.join(' | ');
  assert.match(txt, /En 500 metros, gira a la derecha en Avenida del Sol/);
  assert.match(txt, /Gira a la derecha en Avenida del Sol\./);
  assert.match(txt, /gira a la izquierda en Calle Luna/i);
  assert.match(txt, /Has llegado a tu destino/);
  console.log('     voz:', said.slice(0, 6).join(' / '));
});
test('se detecta la salida de la ruta y pide recalcular', () => {
  const route = buildRoute();
  let reroutes = 0;
  const eng = new NavEngine({ reroute: () => reroutes++ });
  eng.setRoute(route);
  eng.update({ lat: pts[5][0], lon: pts[5][1], speed: 10, heading: 0, acc: 5 });
  // nos desviamos 120 m al oeste
  for (let k = 0; k < 4; k++) {
    const p = destPoint(pts[8 + k][0], pts[8 + k][1], 270, 120);
    eng.update({ lat: p[0], lon: p[1], speed: 10, heading: 270, acc: 5 });
  }
  assert.equal(reroutes, 1);
});
test('tiempo restante y límite en el punto actual', () => {
  const route = buildRoute();
  const eng = new NavEngine({});
  eng.setRoute(route);
  const s = eng.update({ lat: pts[iRight + 10][0], lon: pts[iRight + 10][1], speed: 14, heading: 90, acc: 5 });
  assert.ok(s.remaining > 1000 && s.remaining < 1300, `restante ${s.remaining}`);
  assert.ok(s.remainingTime > 60 && s.remainingTime < 110, `tiempo ${s.remainingTime}`);
  assert.equal(s.limit, 70);
});

console.log('Radares');
function dbWith(radares) {
  const db = new RadarDB();
  db._setMain({ generado: 'test', radares });
  db._rebuild();
  return db;
}
const S = { radarTypes: { fijo: true, tramo: true, semaforo: true, cinturon: true, linea: false, movil: true }, alertDistance: 'auto', overTolerance: 0, overspeedAlerts: true, reportAlerts: true };

test('radar fijo en la ruta: aviso, cercanía, exceso y paso', () => {
  const route = buildRoute();
  const rp = pointAlong(route.coords, route.cum, 1000); // en Avenida del Sol (rumbo 90)
  const db = dbWith([
    { id: 'r1', tipo: 'fijo', lat: rp.lat, lon: rp.lon, rumbo: 90, limite: 70, fuente: 'test' },
    { id: 'r2', tipo: 'fijo', lat: rp.lat + 0.00005, lon: rp.lon, rumbo: 270, limite: 70, fuente: 'test' }, // sentido contrario
    { id: 'r3', tipo: 'linea', lat: rp.lat, lon: rp.lon + 0.001, fuente: 'test' }, // tipo desactivado
  ]);
  const onRoute = radarsOnRoute(route, db, S.radarTypes);
  assert.deepEqual(onRoute.map((x) => x.radar.id), ['r1']);
  const said = [], sounds = [];
  const w = new RadarWatcher(db, () => S, { speak: (t) => said.push(t), sound: (k) => sounds.push(k) });
  w.setRoute(route);
  const eng = new NavEngine({});
  eng.setRoute(route);
  let maxAlert = null;
  for (let a = 0; a < route.length; a += 15) {
    const p = pointAlong(route.coords, route.cum, a);
    const c = route.coords;
    const hdg = bearing(c[p.i][1], c[p.i][0], c[p.i + 1][1], c[p.i + 1][0]);
    const fix = { lat: p.lat, lon: p.lon, speed: 85 / 3.6, heading: hdg, acc: 5 };
    const ns = eng.update(fix);
    const st = w.update(fix, ns);
    if (st.alert) maxAlert = st.alert;
  }
  assert.ok(maxAlert && maxAlert.radar.id === 'r1');
  assert.equal(said.filter((t) => t.startsWith('Radar fijo a')).length, 1, said.join(' | '));
  assert.match(said.join(' '), /Límite 70/);
  assert.ok(sounds.includes('radar') && sounds.includes('near') && sounds.includes('over'), sounds.join(','));
  assert.ok(said.includes('Reduce la velocidad.'));
  console.log('     voz:', said.join(' / '));
});

test('sin ruta: aviso solo si el radar está delante y en nuestro sentido', () => {
  const base = [40.3, -3.6];
  const ahead = destPoint(...base, 45, 400);
  const db = dbWith([
    { id: 'a', tipo: 'fijo', lat: ahead[0], lon: ahead[1], rumbo: 45, limite: 100, fuente: 't' },
    { id: 'b', tipo: 'fijo', lat: destPoint(...base, 225, 300)[0], lon: destPoint(...base, 225, 300)[1], fuente: 't' }, // detrás
  ]);
  const said = [];
  const w = new RadarWatcher(db, () => S, { speak: (t) => said.push(t), sound: () => {} });
  let p = base;
  let ids = new Set();
  for (let k = 0; k < 30; k++) {
    const st = w.update({ lat: p[0], lon: p[1], speed: 25, heading: 45, acc: 5 }, null);
    if (st.alert) ids.add(st.alert.radar.id);
    p = destPoint(...p, 45, 25);
  }
  assert.deepEqual([...ids], ['a']);
  assert.equal(said.filter((t) => t.startsWith('Radar fijo')).length, 1);
});

test('tramo de velocidad media: inicio, media y fin', () => {
  const route = buildRoute();
  const a = pointAlong(route.coords, route.cum, 700), b = pointAlong(route.coords, route.cum, 1300);
  const db = dbWith([{ id: 't1', tipo: 'tramo', lat: a.lat, lon: a.lon, fin: [b.lat, b.lon], rumbo: 90, limite: 70, fuente: 't' }]);
  const said = [];
  const w = new RadarWatcher(db, () => S, { speak: (t) => said.push(t), sound: () => {} });
  w.setRoute(route);
  const eng = new NavEngine({});
  eng.setRoute(route);
  const realNow = Date.now;
  let fake = realNow();
  Date.now = () => fake;
  let sawSection = false;
  try {
    for (let s = 0; s < route.length; s += 20) {
      fake += 1000; // 20 m/s = 72 km/h
      const p = pointAlong(route.coords, route.cum, s);
      const c = route.coords;
      const hdg = bearing(c[p.i][1], c[p.i][0], c[p.i + 1][1], c[p.i + 1][0]);
      const fix = { lat: p.lat, lon: p.lon, speed: 20, heading: hdg, acc: 5 };
      const st = w.update(fix, eng.update(fix));
      if (st.section) sawSection = true;
    }
  } finally { Date.now = realNow; }
  assert.ok(sawSection);
  const txt = said.join(' | ');
  assert.match(txt, /Inicio de tramo de velocidad media\. Límite 70/);
  const m = txt.match(/Velocidad media: (\d+)/);
  assert.ok(m, txt);
  assert.ok(Math.abs(Number(m[1]) - 72) <= 4, `media ${m[1]}`);
  console.log('     voz:', said.join(' / '));
});

test('radares de OpenStreetMap en directo', () => {
  const r = parseOverpass({
    elements: [
      { type: 'node', id: 1, lat: 40, lon: -3, tags: { highway: 'speed_camera', maxspeed: '80', direction: '90' } },
      { type: 'node', id: 5, lat: 40.2, lon: -3.2 }, { type: 'node', id: 6, lat: 40.23, lon: -3.2 },
      { type: 'relation', id: 11, tags: { type: 'enforcement', enforcement: 'average_speed', maxspeed: '120' }, members: [{ type: 'node', ref: 5, role: 'from' }, { type: 'node', ref: 6, role: 'to' }] },
    ],
  });
  assert.equal(r.length, 2);
  assert.equal(r.find((x) => x.id === 'osm-n1').rumbo, 90);
  assert.equal(r.find((x) => x.id === 'osm-r11').tipo, 'tramo');
});

test('base real: formato y tipos', async () => {
  const fs = await import('node:fs');
  const data = JSON.parse(fs.readFileSync(new URL('../data/radares.json', import.meta.url)));
  const db = dbWith(data.radares);
  assert.ok(db.all.length > 1000);
  const madrid = db.near(40.4168, -3.7038, 8000);
  assert.ok(madrid.length > 10, `radares cerca de Sol: ${madrid.length}`);
});

console.log(`\n${pass} pruebas correctas`);

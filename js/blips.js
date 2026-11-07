// Iconos del mapa ("blips") dibujados en canvas en tiempo de ejecución, con los colores de cada skin.
// Todos son diseños propios y simples.

const PR = 2; // densidad de píxeles de las imágenes

export const BLIP_COLORS = {
  fuel: '#ffb020', parking: '#3d8bff', food: '#ff7a45', cafe: '#d39a66', bar: '#ec5aa5', shop: '#4fd1a5',
  pharmacy: '#3fd16b', hospital: '#ff4d4d', bank: '#2ecc71', car: '#a7b4c2', hotel: '#9b8cff', police: '#4f8dff',
  fire: '#ff5a36', school: '#f2c94c', star: '#ffd23f', cinema: '#c084fc', park: '#5dd36b', transit: '#38bdf8',
  sport: '#22c55e', landmark: '#d6dde6', charge: '#7dd3fc', dot: '#9aa8b8',
  fav: '#ffd23f', home: '#5dd36b', work: '#38bdf8', res: '#ffffff',
};

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w * PR; c.height = h * PR;
  const ctx = c.getContext('2d');
  ctx.scale(PR, PR);
  return { c, ctx };
}

function toImage(c, ctx, extra = {}) {
  return { data: ctx.getImageData(0, 0, c.width, c.height), opts: { pixelRatio: PR, ...extra } };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function star(ctx, cx, cy, R, r, n = 5) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const rad = i % 2 ? r : R;
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    ctx.lineTo(cx + rad * Math.cos(a), cy + rad * Math.sin(a));
  }
  ctx.closePath();
}

/** Dibuja un glifo centrado en (0,0) dentro de un cuadro de ±1 (escalado fuera). */
const GLYPHS = {
  letter: (ctx, ch) => {
    ctx.font = `700 ${ch.length > 1 ? 1.15 : 1.5}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ch, 0, 0.08);
  },
  fuel: (ctx, bg) => {
    roundRect(ctx, -0.62, -0.7, 0.8, 1.4, 0.12); ctx.fill();
    ctx.fillStyle = bg; ctx.fillRect(-0.48, -0.55, 0.52, 0.38);
    ctx.lineWidth = 0.16; ctx.beginPath(); ctx.moveTo(0.18, -0.35); ctx.lineTo(0.55, -0.35); ctx.lineTo(0.55, 0.35); ctx.lineTo(0.38, 0.5); ctx.stroke();
  },
  food: (ctx) => {
    ctx.lineWidth = 0.17; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-0.35, -0.75); ctx.lineTo(-0.35, 0.75); ctx.stroke();
    for (const x of [-0.6, -0.1]) { ctx.beginPath(); ctx.moveTo(x, -0.75); ctx.lineTo(x, -0.25); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-0.6, -0.25); ctx.quadraticCurveTo(-0.35, 0.05, -0.1, -0.25); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0.42, 0.75); ctx.lineTo(0.42, -0.75); ctx.quadraticCurveTo(0.78, -0.4, 0.62, 0.05); ctx.lineTo(0.42, 0.05); ctx.stroke();
  },
  cafe: (ctx) => {
    ctx.lineWidth = 0.14; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-0.7, -0.15); ctx.lineTo(0.35, -0.15); ctx.lineTo(0.25, 0.55); ctx.lineTo(-0.6, 0.55); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(0.42, 0.15, 0.22, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    for (const x of [-0.4, -0.1]) { ctx.beginPath(); ctx.moveTo(x, -0.35); ctx.quadraticCurveTo(x + 0.15, -0.55, x, -0.75); ctx.stroke(); }
  },
  bar: (ctx) => {
    ctx.lineWidth = 0.15; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-0.65, -0.6); ctx.lineTo(0.65, -0.6); ctx.lineTo(0, 0.1); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, 0.1); ctx.lineTo(0, 0.6); ctx.moveTo(-0.35, 0.65); ctx.lineTo(0.35, 0.65); ctx.stroke();
  },
  shop: (ctx) => {
    ctx.lineWidth = 0.14;
    roundRect(ctx, -0.6, -0.25, 1.2, 0.95, 0.12); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -0.25, 0.3, Math.PI, 0); ctx.stroke();
  },
  pharmacy: (ctx) => { ctx.fillRect(-0.22, -0.7, 0.44, 1.4); ctx.fillRect(-0.7, -0.22, 1.4, 0.44); },
  car: (ctx, bg) => {
    roundRect(ctx, -0.8, -0.1, 1.6, 0.5, 0.15); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-0.5, -0.1); ctx.lineTo(-0.3, -0.5); ctx.lineTo(0.3, -0.5); ctx.lineTo(0.5, -0.1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = bg;
    for (const x of [-0.45, 0.45]) { ctx.beginPath(); ctx.arc(x, 0.42, 0.18, 0, Math.PI * 2); ctx.fill(); }
  },
  hotel: (ctx) => {
    ctx.fillRect(-0.8, 0.1, 1.6, 0.35); ctx.fillRect(-0.8, -0.5, 0.18, 1.1); ctx.fillRect(0.62, 0.1, 0.18, 0.5);
    roundRect(ctx, -0.55, -0.2, 0.5, 0.28, 0.1); ctx.fill(); roundRect(ctx, 0.0, -0.15, 0.8, 0.25, 0.08); ctx.fill();
  },
  police: (ctx, bg) => {
    ctx.beginPath(); ctx.moveTo(0, -0.8); ctx.lineTo(0.65, -0.55); ctx.lineTo(0.6, 0.1); ctx.quadraticCurveTo(0.45, 0.6, 0, 0.82); ctx.quadraticCurveTo(-0.45, 0.6, -0.6, 0.1); ctx.lineTo(-0.65, -0.55); ctx.closePath(); ctx.fill();
    ctx.fillStyle = bg; star(ctx, 0, -0.02, 0.36, 0.15); ctx.fill();
  },
  fire: (ctx) => {
    ctx.beginPath(); ctx.moveTo(0, -0.85);
    ctx.bezierCurveTo(0.55, -0.3, 0.7, 0.1, 0.5, 0.45); ctx.bezierCurveTo(0.3, 0.85, -0.3, 0.85, -0.5, 0.45);
    ctx.bezierCurveTo(-0.65, 0.1, -0.4, -0.2, -0.2, -0.3); ctx.bezierCurveTo(-0.15, -0.05, 0, 0.0, 0.05, -0.15);
    ctx.bezierCurveTo(0.15, -0.4, 0.05, -0.65, 0, -0.85); ctx.fill();
  },
  school: (ctx) => {
    ctx.beginPath(); ctx.moveTo(-0.8, -0.55); ctx.quadraticCurveTo(-0.4, -0.75, -0.05, -0.5); ctx.lineTo(-0.05, 0.65); ctx.quadraticCurveTo(-0.4, 0.45, -0.8, 0.6); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0.8, -0.55); ctx.quadraticCurveTo(0.4, -0.75, 0.05, -0.5); ctx.lineTo(0.05, 0.65); ctx.quadraticCurveTo(0.4, 0.45, 0.8, 0.6); ctx.closePath(); ctx.fill();
  },
  star: (ctx) => { star(ctx, 0, 0.05, 0.85, 0.36); ctx.fill(); },
  cinema: (ctx, bg) => {
    roundRect(ctx, -0.75, -0.55, 1.5, 1.1, 0.15); ctx.fill();
    ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(-0.2, -0.3); ctx.lineTo(0.35, 0); ctx.lineTo(-0.2, 0.3); ctx.closePath(); ctx.fill();
  },
  park: (ctx) => {
    ctx.beginPath(); ctx.arc(0, -0.2, 0.55, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(-0.1, 0.2, 0.2, 0.6);
  },
  transit: (ctx, bg) => {
    roundRect(ctx, -0.6, -0.75, 1.2, 1.35, 0.2); ctx.fill();
    ctx.fillStyle = bg; ctx.fillRect(-0.42, -0.5, 0.84, 0.45);
    for (const x of [-0.32, 0.32]) { ctx.beginPath(); ctx.arc(x, 0.28, 0.1, 0, Math.PI * 2); ctx.fill(); }
  },
  sport: (ctx) => {
    ctx.lineWidth = 0.14;
    ctx.beginPath(); ctx.arc(0, 0, 0.7, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-0.7, 0); ctx.lineTo(0.7, 0); ctx.moveTo(0, -0.7); ctx.lineTo(0, 0.7); ctx.stroke();
  },
  landmark: (ctx) => {
    ctx.beginPath(); ctx.moveTo(-0.8, -0.35); ctx.lineTo(0, -0.8); ctx.lineTo(0.8, -0.35); ctx.closePath(); ctx.fill();
    for (const x of [-0.55, -0.1, 0.35]) ctx.fillRect(x, -0.25, 0.2, 0.75);
    ctx.fillRect(-0.8, 0.55, 1.6, 0.2);
  },
  charge: (ctx) => {
    ctx.beginPath(); ctx.moveTo(0.15, -0.85); ctx.lineTo(-0.5, 0.1); ctx.lineTo(-0.05, 0.1); ctx.lineTo(-0.2, 0.85); ctx.lineTo(0.5, -0.15); ctx.lineTo(0.05, -0.15); ctx.closePath(); ctx.fill();
  },
  dot: (ctx) => { ctx.beginPath(); ctx.arc(0, 0, 0.42, 0, Math.PI * 2); ctx.fill(); },
  home: (ctx, bg) => {
    ctx.beginPath(); ctx.moveTo(-0.8, -0.05); ctx.lineTo(0, -0.8); ctx.lineTo(0.8, -0.05); ctx.closePath(); ctx.fill();
    ctx.fillRect(-0.55, -0.1, 1.1, 0.85); ctx.fillStyle = bg; ctx.fillRect(-0.15, 0.25, 0.3, 0.5);
  },
  work: (ctx, bg) => {
    roundRect(ctx, -0.8, -0.35, 1.6, 1.05, 0.15); ctx.fill();
    ctx.lineWidth = 0.14; ctx.strokeRect(-0.3, -0.62, 0.6, 0.3);
    ctx.fillStyle = bg; ctx.fillRect(-0.8, 0.05, 1.6, 0.08);
  },
  camera: (ctx, bg) => {
    roundRect(ctx, -0.8, -0.45, 1.25, 0.9, 0.15); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0.45, -0.2); ctx.lineTo(0.85, -0.45); ctx.lineTo(0.85, 0.45); ctx.lineTo(0.45, 0.2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(-0.18, 0, 0.26, 0, Math.PI * 2); ctx.fill();
  },
  section: (ctx) => {
    ctx.lineWidth = 0.16; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-0.75, 0); ctx.lineTo(0.75, 0);
    ctx.moveTo(-0.45, -0.3); ctx.lineTo(-0.75, 0); ctx.lineTo(-0.45, 0.3);
    ctx.moveTo(0.45, -0.3); ctx.lineTo(0.75, 0); ctx.lineTo(0.45, 0.3); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -0.5, 0.18, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0.5, 0.18, 0, Math.PI * 2); ctx.fill();
  },
  light: (ctx) => {
    ctx.fillStyle = '#111'; roundRect(ctx, -0.38, -0.85, 0.76, 1.7, 0.2); ctx.fill();
    [['#ff3b30', -0.5], ['#ffcc00', 0], ['#34c759', 0.5]].forEach(([c, y]) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, y, 0.2, 0, Math.PI * 2); ctx.fill(); });
  },
  phone: (ctx, bg) => {
    roundRect(ctx, -0.42, -0.8, 0.84, 1.6, 0.16); ctx.fill();
    ctx.fillStyle = bg; ctx.fillRect(-0.3, -0.6, 0.6, 1.05);
  },
  stopline: (ctx) => {
    ctx.fillRect(-0.8, 0.35, 1.6, 0.25);
    ctx.lineWidth = 0.14; ctx.beginPath(); ctx.moveTo(0, 0.2); ctx.lineTo(0, -0.75); ctx.moveTo(-0.3, -0.45); ctx.lineTo(0, -0.75); ctx.lineTo(0.3, -0.45); ctx.stroke();
  },
  tripod: (ctx, bg) => {
    roundRect(ctx, -0.6, -0.8, 1.0, 0.65, 0.12); ctx.fill();
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(-0.1, -0.48, 0.18, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = ctx.fillStyle = '#fff'; ctx.lineWidth = 0.13;
    ctx.beginPath(); ctx.moveTo(-0.1, -0.15); ctx.lineTo(-0.6, 0.8); ctx.moveTo(-0.1, -0.15); ctx.lineTo(0.4, 0.8); ctx.moveTo(-0.1, -0.15); ctx.lineTo(-0.1, 0.8); ctx.stroke();
  },
  exclaim: (ctx) => { ctx.fillRect(-0.12, -0.55, 0.24, 0.75); ctx.beginPath(); ctx.arc(0, 0.5, 0.14, 0, Math.PI * 2); ctx.fill(); },
  cone: (ctx) => {
    ctx.beginPath(); ctx.moveTo(-0.2, -0.75); ctx.lineTo(0.2, -0.75); ctx.lineTo(0.5, 0.55); ctx.lineTo(-0.5, 0.55); ctx.closePath(); ctx.fill();
    ctx.fillRect(-0.75, 0.55, 1.5, 0.2);
  },
  jam: (ctx, bg) => {
    for (const [x, y] of [[-0.45, -0.35], [0.45, -0.35], [0, 0.35]]) {
      roundRect(ctx, x - 0.32, y - 0.22, 0.64, 0.44, 0.1); ctx.fill();
    }
    ctx.fillStyle = bg;
  },
  flag: (ctx) => {
    ctx.fillRect(-0.55, -0.8, 0.14, 1.6);
    ctx.beginPath(); ctx.moveTo(-0.41, -0.8); ctx.lineTo(0.7, -0.5); ctx.lineTo(-0.41, -0.15); ctx.closePath(); ctx.fill();
  },
};

const POI_GLYPH = {
  fuel: 'fuel', parking: ['letter', 'P'], food: 'food', cafe: 'cafe', bar: 'bar', shop: 'shop', pharmacy: 'pharmacy',
  hospital: ['letter', 'H'], bank: ['letter', '€'], car: 'car', hotel: 'hotel', police: 'police', fire: 'fire',
  school: 'school', star: 'star', cinema: 'cinema', park: 'park', transit: 'transit', sport: 'sport',
  landmark: 'landmark', charge: 'charge', dot: 'dot', fav: 'star', home: 'home', work: 'work', res: 'dot',
};

function drawGlyph(ctx, spec, cx, cy, scale, bg) {
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(scale, scale);
  if (Array.isArray(spec)) GLYPHS[spec[0]](ctx, spec[1], bg);
  else GLYPHS[spec](ctx, bg);
  ctx.restore();
}

/** Blip circular de punto de interés. */
function makeBlip(kind, skin, size = 22) {
  const color = BLIP_COLORS[kind] || BLIP_COLORS.dot;
  const { c, ctx } = canvas(size, size);
  const r = size / 2 - 1.2;
  ctx.fillStyle = skin.blipBg; ctx.beginPath(); ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 1.6; ctx.strokeStyle = color; ctx.stroke();
  ctx.fillStyle = color; ctx.strokeStyle = color;
  drawGlyph(ctx, POI_GLYPH[kind] || 'dot', size / 2, size / 2, size * 0.27, skin.blipBg);
  return toImage(c, ctx);
}

/** Icono cuadrado de radar o aviso. */
const ALERT_STYLE = {
  'radar-fijo': ['#e53935', 'camera'],
  'radar-tramo': ['#ff6d00', 'section'],
  'radar-semaforo': ['#263238', 'light'],
  'radar-cinturon': ['#7b1fa2', 'phone'],
  'radar-linea': ['#5d4037', 'stopline'],
  'radar-movil': ['#c62828', 'tripod'],
  'rep-control': ['#1e63d6', 'police'],
  'rep-accidente': ['#d32f2f', 'exclaim'],
  'rep-obras': ['#ef6c00', 'cone'],
  'rep-peligro': ['#f9a825', 'exclaim'],
  'rep-atasco': ['#c62828', 'jam'],
};
function makeAlertIcon(id, size = 26) {
  const [bg, glyph] = ALERT_STYLE[id];
  const { c, ctx } = canvas(size, size);
  ctx.fillStyle = 'rgba(0,0,0,.35)'; roundRect(ctx, 1.5, 2.5, size - 3, size - 3, 5); ctx.fill();
  ctx.fillStyle = bg; roundRect(ctx, 1, 1, size - 3, size - 3, 5); ctx.fill();
  ctx.lineWidth = 1.6; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff';
  drawGlyph(ctx, glyph, (size - 1) / 2, (size - 1) / 2, size * 0.3, bg);
  return toImage(c, ctx);
}

function makeShield(color) {
  const w = 22, hh = 16;
  const { c, ctx } = canvas(w, hh);
  ctx.fillStyle = color; roundRect(ctx, 1, 1, w - 2, hh - 2, 3); ctx.fill();
  ctx.lineWidth = 1.2; ctx.strokeStyle = '#ffffff'; roundRect(ctx, 2.2, 2.2, w - 4.4, hh - 4.4, 2); ctx.stroke();
  return toImage(c, ctx, { stretchX: [[6 * PR, (w - 6) * PR]], stretchY: [[5 * PR, (hh - 5) * PR]], content: [4 * PR, 3 * PR, (w - 4) * PR, (hh - 3) * PR] });
}

function makeTag(skin) {
  const w = 22, hh = 18;
  const { c, ctx } = canvas(w, hh);
  ctx.fillStyle = skin.blipBg; roundRect(ctx, 1, 1, w - 2, hh - 2, 4); ctx.fill();
  ctx.lineWidth = 1.4; ctx.strokeStyle = skin.accent; ctx.stroke();
  return toImage(c, ctx, { stretchX: [[6 * PR, (w - 6) * PR]], stretchY: [[6 * PR, (hh - 6) * PR]], content: [5 * PR, 3 * PR, (w - 5) * PR, (hh - 3) * PR] });
}

function makeOneway(skin) {
  const w = 16, hh = 8;
  const { c, ctx } = canvas(w, hh);
  ctx.strokeStyle = skin.roadText; ctx.lineWidth = 1.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(2, hh / 2); ctx.lineTo(w - 3, hh / 2); ctx.moveTo(w - 6, 1.5); ctx.lineTo(w - 3, hh / 2); ctx.lineTo(w - 6, hh - 1.5); ctx.stroke();
  return toImage(c, ctx);
}

/** Destino: rombo con bandera, en el color de la ruta. */
function makeDest(skin, kind) {
  const size = 34;
  const { c, ctx } = canvas(size, size);
  const color = kind === 'stop' ? '#ffd23f' : skin.route;
  ctx.save(); ctx.translate(size / 2, size / 2); ctx.rotate(Math.PI / 4);
  ctx.fillStyle = 'rgba(0,0,0,.4)'; roundRect(ctx, -10, -9, 21, 21, 4); ctx.fill();
  ctx.fillStyle = color; roundRect(ctx, -11, -11, 22, 22, 4); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#fff';
  drawGlyph(ctx, kind === 'stop' ? ['letter', 'P'] : 'flag', size / 2, size / 2, 7, color);
  return toImage(c, ctx);
}

function makePin(skin) {
  const w = 28, hh = 38;
  const { c, ctx } = canvas(w, hh);
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(w / 2, hh - 3, 6, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = skin.accent;
  ctx.beginPath(); ctx.moveTo(w / 2, hh - 4);
  ctx.bezierCurveTo(w / 2 - 4, hh - 14, 2, hh - 18, 2, 13); ctx.arc(w / 2, 13, w / 2 - 2, Math.PI, 0); ctx.bezierCurveTo(w - 2, hh - 18, w / 2 + 4, hh - 14, w / 2, hh - 4);
  ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(w / 2, 13, 4.5, 0, Math.PI * 2); ctx.fill();
  return toImage(c, ctx);
}

/** Crea la imagen pedida por el estilo (evento styleimagemissing). */
export function makeImage(id, skin) {
  if (id.startsWith('blip-')) return makeBlip(id.slice(5), skin);
  if (ALERT_STYLE[id]) return makeAlertIcon(id);
  if (id === 'shield-blue') return makeShield('#1f5fbf');
  if (id === 'shield-red') return makeShield('#c62828');
  if (id === 'shield-orange') return makeShield('#d9822b');
  if (id === 'oneway') return makeOneway(skin);
  if (id === 'tag') return makeTag(skin);
  if (id === 'dest') return makeDest(skin, 'dest');
  if (id === 'stop') return makeDest(skin, 'stop');
  if (id === 'pin') return makePin(skin);
  return null;
}

export function attachImages(map, getSkin) {
  const resolve = (id) => {
    if (!id || map.hasImage(id)) return;
    const img = makeImage(id, getSkin());
    if (img) map.addImage(id, img.data, img.opts);
  };
  if (typeof map.setMissingStyleImageResolver === 'function') {
    // MapLibre 6: las imágenes se generan bajo demanda con un "resolver"
    map.setMissingStyleImageResolver(resolve);
  } else {
    map.on('styleimagemissing', (e) => resolve(e.id));
  }
}

/** Icono de radar/aviso como dataURL para la interfaz. */
export function alertIconURL(id, size = 40) {
  const img = makeImage(id, null) || makeImage('radar-fijo');
  const c = document.createElement('canvas');
  c.width = img.data.width; c.height = img.data.height;
  c.getContext('2d').putImageData(img.data, 0, 0);
  return c.toDataURL();
}

export function blipIconURL(kind, skin) {
  const img = makeBlip(kind, skin, 28);
  const c = document.createElement('canvas');
  c.width = img.data.width; c.height = img.data.height;
  c.getContext('2d').putImageData(img.data, 0, 0);
  return c.toDataURL();
}

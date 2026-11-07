// Iconos SVG de la interfaz y de las maniobras (diseño propio).

const svg = (body, vb = 24, extra = '') => `<svg viewBox="0 0 ${vb} ${vb}" aria-hidden="true" ${extra}>${body}</svg>`;
const S = 'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';

export const ICONS = {
  menu: svg(`<path ${S} d="M4 6h16M4 12h16M4 18h16"/>`),
  layers: svg(`<path ${S} d="M12 3 2.5 8 12 13l9.5-5Z"/><path ${S} d="m2.5 12.5 9.5 5 9.5-5"/><path ${S} d="m2.5 16.5 9.5 5 9.5-5" opacity=".6"/>`),
  search: svg(`<circle ${S} cx="10.5" cy="10.5" r="6.5"/><path ${S} d="m15.5 15.5 5 5"/>`),
  close: svg(`<path ${S} d="M6 6l12 12M18 6 6 18"/>`),
  locate: svg(`<circle ${S} cx="12" cy="12" r="6"/><path ${S} d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/>`),
  compass: svg(`<path d="M12 2.5 15.5 12h-7Z" fill="#ff4d4d"/><path d="M12 21.5 8.5 12h7Z" fill="currentColor" opacity=".85"/>`),
  report: svg(`<path ${S} d="M12 3 2 20h20Z"/><path ${S} d="M12 10v4.5"/><circle cx="12" cy="17.3" r="1.2" fill="currentColor"/>`),
  volume: svg(`<path d="M4 9h4l5-4v14l-5-4H4Z" fill="currentColor"/><path ${S} d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>`),
  mute: svg(`<path d="M4 9h4l5-4v14l-5-4H4Z" fill="currentColor"/><path ${S} d="m16 9 6 6m0-6-6 6"/>`),
  overview: svg(`<path ${S} d="M4 19c4-1 3-6 8-7s4-6 8-7"/><circle cx="4" cy="19" r="2" fill="currentColor"/><circle cx="20" cy="5" r="2" fill="currentColor"/>`),
  stop: svg(`<rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor"/>`),
  star: svg(`<path d="m12 2.8 2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8Z" fill="currentColor"/>`),
  starO: svg(`<path ${S} d="m12 2.8 2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8Z"/>`),
  home: svg(`<path ${S} d="M3.5 11 12 4l8.5 7"/><path ${S} d="M6 9.5V20h12V9.5"/><path ${S} d="M10 20v-5h4v5"/>`),
  work: svg(`<rect ${S} x="3" y="7.5" width="18" height="12" rx="1.5"/><path ${S} d="M9 7.5V5h6v2.5M3 12.5h18"/>`),
  play: svg(`<path d="M7 4.5v15l12.5-7.5Z" fill="currentColor"/>`),
  go: svg(`<path d="M12 2.5 20 21l-8-4.5L4 21Z" fill="currentColor"/>`),
  gear: svg(`<circle ${S} cx="12" cy="12" r="3.2"/><path ${S} d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>`),
  refresh: svg(`<path ${S} d="M20 11a8 8 0 1 0-2.3 5.7"/><path ${S} d="M20 4v7h-7"/>`),
  trash: svg(`<path ${S} d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13"/>`),
  plus: svg(`<path ${S} d="M12 5v14M5 12h14"/>`),
  pin: svg(`<path d="M12 22s7-7.2 7-12.5A7 7 0 0 0 5 9.5C5 14.8 12 22 12 22Z" fill="currentColor"/><circle cx="12" cy="9.5" r="2.6" fill="#000" opacity=".55"/>`),
  back: svg(`<path ${S} d="M15 5 8 12l7 7"/>`),
  copy: svg(`<rect ${S} x="8" y="8" width="12" height="12" rx="1.5"/><path ${S} d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>`),
  route: svg(`<circle ${S} cx="6" cy="18" r="2.5"/><circle ${S} cx="18" cy="6" r="2.5"/><path ${S} d="M8.5 18H16a3 3 0 0 0 0-6H8a3 3 0 0 1 0-6h7.5"/>`),
  share: svg(`<circle ${S} cx="18" cy="5.5" r="2.5"/><circle ${S} cx="6" cy="12" r="2.5"/><circle ${S} cx="18" cy="18.5" r="2.5"/><path ${S} d="m8.3 10.8 7.4-4M8.3 13.2l7.4 4"/>`),
  fullscreen: svg(`<path ${S} d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>`),
};

// ---- Maniobras (48×48, trazo blanco) ----
const M = 'fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"';
const DIM = 'fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity=".35"';
const mirror = (body) => `<g transform="translate(48 0) scale(-1 1)">${body}</g>`;

const BASE = {
  straight: `<path ${M} d="M24 42V9"/><path ${M} d="M13 19 24 8l11 11"/>`,
  right: `<path ${M} d="M16 42V27c0-6 4-9 9-9h12"/><path ${M} d="M29 10l8 8-8 8"/>`,
  'slight-right': `<path ${M} d="M17 42V29l15-15"/><path ${M} d="M22 12h11v11"/>`,
  'sharp-right': `<path ${M} d="M17 42V14c0-4 3-5 6-2l12 14"/><path ${M} d="M36 16v11H25"/>`,
  uturn: `<path ${M} d="M31 42V19a8 8 0 0 0-16 0v13"/><path ${M} d="M8 25l7 8 7-8"/>`,
  'keep-right': `<path ${DIM} d="M24 42V30L14 18V8"/><path ${M} d="M24 42V30l10-12V8"/><path ${M} d="M27 14l7-7 7 7"/>`,
  'ramp-right': `<path ${DIM} d="M18 42V8"/><path ${M} d="M18 42V30c0-8 8-12 16-16"/><path ${M} d="M26 11l9 2-2 9"/>`,
  merge: `<path ${M} d="M30 42V9"/><path ${M} d="M20 19 30 8l10 11"/><path ${M} d="M12 42c0-9 5-14 16-18"/>`,
  depart: `<circle cx="24" cy="36" r="5" fill="currentColor"/><path ${M} d="M24 30V9"/><path ${M} d="M14 18l10-10 10 10"/>`,
  arrive: `<path ${M} d="M13 43V6"/><path d="M15 7h22l-5 8 5 8H15Z" fill="currentColor"/>`,
  ferry: `<path ${M} d="M8 30h32l-5 9H13Z"/><path ${M} d="M14 30V20h20v10M24 20v-8"/>`,
};

export function maneuverSVG(kind, exit = 0) {
  let body;
  if (kind === 'roundabout' || kind === 'roundabout-exit') {
    body = `<circle ${M} cx="24" cy="20" r="9"/><path ${M} d="M24 43V29"/><path ${M} d="M30.5 13.5 38 6"/><path ${M} d="M31 6h7v7"/>` +
      (exit ? `<text x="24" y="25" text-anchor="middle" font-family="Oswald, sans-serif" font-weight="700" font-size="14" fill="currentColor">${exit}</text>` : '');
  } else if (kind === 'waypoint') {
    body = BASE.arrive;
  } else if (BASE[kind]) {
    body = BASE[kind];
  } else {
    const m = kind.match(/^(.*)-left$/);
    if (m) {
      const right = `${m[1]}-right`;
      body = mirror(BASE[right] || BASE[m[1] === 'exit' ? 'ramp-right' : 'right'] || BASE.right);
    } else if (kind === 'exit-right') {
      body = BASE['ramp-right'];
    } else if (kind === 'left') {
      body = mirror(BASE.right);
    } else {
      body = BASE.straight;
    }
  }
  if (kind === 'left') body = mirror(BASE.right);
  return svg(body, 48);
}

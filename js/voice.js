// Voz (Web Speech API) y sonidos generados con Web Audio.

let audioCtx = null;
let voices = [];
const state = { enabled: true, voiceURI: null, volume: 1, rate: 1.05, soundStyle: 'sirena' };

function loadVoices() {
  try { voices = speechSynthesis.getVoices().filter((v) => /^es/i.test(v.lang)); } catch { voices = []; }
}
if (typeof speechSynthesis !== 'undefined') {
  loadVoices();
  speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
}

export function configureVoice(opts) { Object.assign(state, opts); }
export function spanishVoices() { loadVoices(); return voices; }

/** Debe llamarse desde un toque del usuario para desbloquear audio en iOS/Android. */
export function unlockAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    g.gain.value = 0.0001; o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.02);
  } catch { /* sin audio */ }
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0; speechSynthesis.speak(u);
  } catch { /* sin voz */ }
}

function pickVoice() {
  if (!voices.length) loadVoices();
  if (state.voiceURI) {
    const v = voices.find((x) => x.voiceURI === state.voiceURI);
    if (v) return v;
  }
  return voices.find((v) => v.lang === 'es-ES' && /google|mónica|monica|jorge|helena|laura|pablo/i.test(v.name))
    || voices.find((v) => v.lang === 'es-ES') || voices[0] || null;
}

let lastText = '', lastAt = 0;
/** Habla un texto. priority 'high' corta lo que se esté diciendo. */
export function speak(text, { priority = 'normal' } = {}) {
  if (!state.enabled || !text) return;
  const now = Date.now();
  if (text === lastText && now - lastAt < 4000) return; // evita repeticiones
  lastText = text; lastAt = now;
  try {
    if (priority === 'high') speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) u.voice = v;
    u.lang = v?.lang || 'es-ES';
    u.volume = state.volume; u.rate = state.rate;
    speechSynthesis.speak(u);
  } catch { /* sin voz */ }
}

export function stopSpeaking() { try { speechSynthesis.cancel(); } catch { /* nada */ } }

function tone(freq, start, dur, type = 'sine', vol = 0.25, endFreq) {
  const t0 = audioCtx.currentTime + start;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (endFreq) o.frequency.linearRampToValueAtTime(endFreq, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol * state.volume, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(audioCtx.destination);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

/** Sonidos: 'radar' (aviso), 'near' (radar muy cerca), 'over' (exceso), 'section', 'ok', 'reroute', 'arrive'. */
export function sound(kind) {
  if (!audioCtx || !state.enabled) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    switch (kind) {
      case 'radar':
        if (state.soundStyle === 'sirena') {
          // "Iuu-iuu" corto, como una sirena lejana
          tone(720, 0, 0.32, 'triangle', 0.22, 980);
          tone(980, 0.34, 0.32, 'triangle', 0.22, 720);
          tone(720, 0.68, 0.32, 'triangle', 0.22, 980);
        } else {
          tone(880, 0, 0.14, 'square', 0.12); tone(1175, 0.18, 0.2, 'square', 0.12);
        }
        break;
      case 'near': tone(1320, 0, 0.09, 'square', 0.12); tone(1320, 0.14, 0.09, 'square', 0.12); break;
      case 'over': for (let i = 0; i < 3; i++) tone(1568, i * 0.13, 0.09, 'sawtooth', 0.14); break;
      case 'section': tone(660, 0, 0.18, 'sine', 0.25); tone(990, 0.2, 0.25, 'sine', 0.25); break;
      case 'ok': tone(784, 0, 0.12, 'sine', 0.2); tone(1046, 0.12, 0.2, 'sine', 0.2); break;
      case 'reroute': tone(523, 0, 0.1, 'sine', 0.18); tone(659, 0.11, 0.1, 'sine', 0.18); tone(784, 0.22, 0.14, 'sine', 0.18); break;
      case 'arrive':
        [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.12, 0.35, 'triangle', 0.2));
        break;
      case 'tick': tone(1200, 0, 0.04, 'square', 0.06); break;
      default: break;
    }
  } catch { /* sin audio */ }
}

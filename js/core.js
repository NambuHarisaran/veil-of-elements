/* ============================================================
   Veil of the Elements — Core Engine
   Global namespace: window.VEIL
   ============================================================ */
(function () {
"use strict";

const VEIL = (window.VEIL = window.VEIL || {});
VEIL.scenes = VEIL.scenes || {};

/* ------------------------------------------------------------
   U — math / utility
   ------------------------------------------------------------ */
const U = VEIL.U = {
  TAU: Math.PI * 2,
  lerp: (a, b, t) => a + (b - a) * t,
  clamp: (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v),
  rand: (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a)),
  randInt: (a, b) => Math.floor(U.rand(a, b + 1)),
  chance: (p) => Math.random() < p,
  pick: (arr) => arr[(Math.random() * arr.length) | 0],
  sign: (x) => (x < 0 ? -1 : x > 0 ? 1 : 0),
  dist: (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by),
  approach: (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target)),
  aabb: (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y,
  wrap: (v, m) => ((v % m) + m) % m,
  smooth: (t) => t * t * (3 - 2 * t),
  ease: {
    inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    out: (t) => 1 - Math.pow(1 - t, 3),
    outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    outElastic: (t) => { if (t === 0 || t === 1) return t; const c4 = (2 * Math.PI) / 3; return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1; },
    inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  },
  // seeded deterministic RNG (mulberry32)
  seed(s) {
    let a = s >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },
};

/* ------------------------------------------------------------
   Color helpers
   ------------------------------------------------------------ */
function hexToRgb(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
U.rgba = (hex, a) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; };
// accepts hex ("#abc"), rgb()/rgba(), or named — returns a color with the given alpha
U.alpha = (color, a) => {
  if (typeof color !== 'string') return `rgba(255,255,255,${a})`;
  if (color[0] === '#') { const [r, g, b] = hexToRgb(color); return `rgba(${r},${g},${b},${a})`; }
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (m) { const p = m[1].split(',').map((s) => s.trim()); return `rgba(${p[0]},${p[1]},${p[2]},${a})`; }
  return color;
};
U.lerpColor = (c1, c2, t) => {
  const a = hexToRgb(c1), b = hexToRgb(c2);
  const r = Math.round(U.lerp(a[0], b[0], t));
  const g = Math.round(U.lerp(a[1], b[1], t));
  const bl = Math.round(U.lerp(a[2], b[2], t));
  return `rgb(${r},${g},${bl})`;
};

/* ------------------------------------------------------------
   draw — canvas drawing helpers
   ------------------------------------------------------------ */
const draw = VEIL.draw = {
  glow(ctx, x, y, r, color, a = 1) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, U.rgba(color, a));
    g.addColorStop(0.5, U.rgba(color, a * 0.35));
    g.addColorStop(1, U.rgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, U.TAU); ctx.fill();
  },
  vGrad(ctx, x, y, w, h, stops) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    stops.forEach((s) => g.addColorStop(s[0], s[1]));
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  },
  roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },
  star(ctx, x, y, r, color, a = 1) {
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = color;
    ctx.translate(x, y);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.moveTo(0, 0); ctx.quadraticCurveTo(r * 0.18, r * 0.18, r, 0);
      ctx.quadraticCurveTo(r * 0.18, -r * 0.18, 0, 0);
    }
    ctx.fill(); ctx.restore();
  },
  // deterministic mountain / hill silhouette
  ridge(ctx, baseY, amp, rough, color, seed, yTop) {
    const rng = U.seed(seed);
    const W = VEIL.engine.W;
    ctx.beginPath();
    ctx.moveTo(0, yTop !== undefined ? yTop : VEIL.engine.H);
    ctx.lineTo(0, baseY);
    let y = baseY;
    for (let x = 0; x <= W; x += 24) {
      y += (rng() - 0.5) * rough;
      y = U.clamp(y, baseY - amp, baseY + amp * 0.4);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, yTop !== undefined ? yTop : VEIL.engine.H);
    ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
  },
  mist(ctx, y, h, color, t, a = 0.18) {
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const yy = y + i * h * 0.5;
      const off = Math.sin(t * 0.2 + i) * 40;
      const g = ctx.createLinearGradient(0, yy, 0, yy + h);
      g.addColorStop(0, U.rgba(color, 0));
      g.addColorStop(0.5, U.rgba(color, a));
      g.addColorStop(1, U.rgba(color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(off - 60, yy, VEIL.engine.W + 120, h);
    }
    ctx.restore();
  },
  text(ctx, str, x, y, opt = {}) {
    ctx.save();
    ctx.font = `${opt.weight || 400} ${opt.size || 24}px ${opt.font || 'Cinzel, serif'}`;
    ctx.textAlign = opt.align || 'center';
    ctx.textBaseline = opt.baseline || 'middle';
    if (opt.glow) { ctx.shadowColor = opt.glow; ctx.shadowBlur = opt.blur || 24; }
    if (opt.spacing) ctx.letterSpacing = opt.spacing;
    ctx.fillStyle = opt.color || '#fff';
    ctx.globalAlpha = opt.alpha === undefined ? 1 : opt.alpha;
    ctx.fillText(str, x, y);
    ctx.restore();
  },
  vignette(ctx, strength = 0.6, color = '#000') {
    const { W, H } = VEIL.engine;
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
    g.addColorStop(0, U.rgba(color, 0));
    g.addColorStop(1, U.rgba(color, strength));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  },
  grain(ctx, amount = 0.04) {
    const { W, H } = VEIL.engine;
    ctx.save(); ctx.globalAlpha = amount; ctx.globalCompositeOperation = 'overlay';
    for (let i = 0; i < 60; i++) {
      const v = (Math.random() * 255) | 0;
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    }
    ctx.restore();
  },
};

/* ------------------------------------------------------------
   sky — procedural backdrops (used as fallback / shared)
   ------------------------------------------------------------ */
VEIL.sky = {
  paint(ctx, pal, t) {
    const { W, H } = VEIL.engine;
    draw.vGrad(ctx, 0, 0, W, H, [
      [0, pal.top || '#1a1330'],
      [0.55, pal.mid || '#241a44'],
      [1, pal.bottom || '#0c0820'],
    ]);
    // soft sun/moon
    if (pal.orb) {
      const ox = pal.orbX !== undefined ? pal.orbX * W : W * 0.7;
      const oy = pal.orbY !== undefined ? pal.orbY * H : H * 0.3;
      draw.glow(ctx, ox, oy, pal.orbR || 220, pal.orb, 0.5);
      ctx.fillStyle = pal.orb; ctx.beginPath();
      ctx.arc(ox, oy, (pal.orbR || 220) * 0.18, 0, U.TAU); ctx.fill();
    }
  },
};

/* ------------------------------------------------------------
   Input
   ------------------------------------------------------------ */
const MAP = {
  left: ['arrowleft', 'a'], right: ['arrowright', 'd'],
  up: ['arrowup', 'w'], down: ['arrowdown', 's'],
  jump: [' ', 'arrowup', 'w'],
  attack: ['j', 'z'], heavy: ['k', 'x'],
  ability: ['l', 'q'], dash: ['shift', '.', ';'],
  block: ['f'], interact: ['e', 'enter'],
  advance: [' ', 'enter', 'e', 'j'],
  pause: ['escape', 'p'],
};
class Input {
  constructor() {
    this.held = new Set();
    this.edge = new Set();
    this.consumed = new Set();
    this.anyKey = false;
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
      if (!this.held.has(k)) this.edge.add(k);
      this.held.add(k);
      this.anyKey = true;
      if (VEIL.engine && VEIL.engine.scene && VEIL.engine.scene.onKey) VEIL.engine.scene.onKey(e);
      if (VEIL.audio) VEIL.audio.resume();
    });
    window.addEventListener('keyup', (e) => this.held.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.held.clear());
    window.addEventListener('mousedown', (e) => {
      if (VEIL.audio) VEIL.audio.resume();
      if (e.button === 0) { this.edge.add('mouse0'); this.held.add('mouse0'); }
      if (e.button === 2) { this.edge.add('mouse2'); this.held.add('mouse2'); }
    });
    window.addEventListener('mouseup', (e) => { this.held.delete(e.button === 0 ? 'mouse0' : 'mouse2'); });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  _keys(a) {
    let ks = MAP[a] || [a];
    if (a === 'attack') ks = ks.concat('mouse0');
    if (a === 'block') ks = ks.concat('mouse2');
    return ks;
  }
  down(a) { return this._keys(a).some((k) => this.held.has(k)); }
  pressed(a) { return this._keys(a).some((k) => this.edge.has(k)); }
  endFrame() { this.edge.clear(); this.anyKey = false; }
}
VEIL.Input = Input;

/* ------------------------------------------------------------
   Audio — procedural Web Audio (ambient pads + sfx)
   ------------------------------------------------------------ */
class Audio {
  constructor() {
    this.ok = false; this.muted = false;
    this.ctx = null; this.master = null; this.musicGain = null; this.sfxGain = null;
    this.nodes = []; this.theme = null;
  }
  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = 0.0; this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = 0.5; this.sfxGain.connect(this.master);
      this.ok = true;
    } catch (e) { this.ok = false; }
  }
  resume() { if (!this.ctx) this.init(); if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.9; }

  // --- SFX (synthesized) ---
  blip(freq, dur, type = 'sine', vol = 0.3, glideTo = null, attack = 0.005) {
    if (!this.ok || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.sfxGain); o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, vol = 0.3, freq = 1200, q = 1, type = 'bandpass') {
    if (!this.ok || this.muted) return;
    const t = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.sfxGain); src.start(t);
  }
  sfx(name) {
    if (!this.ok || this.muted) { this.resume(); return; }
    switch (name) {
      case 'jump': this.blip(420, 0.18, 'sine', 0.22, 720); break;
      case 'land': this.noise(0.12, 0.22, 300, 0.7, 'lowpass'); break;
      case 'step': this.noise(0.045, 0.07, 240 + Math.random() * 120, 0.9, 'lowpass'); break;
      case 'attack': this.blip(640, 0.08, 'triangle', 0.16, 360); this.noise(0.06, 0.12, 2400, 2); break;
      case 'hit': this.noise(0.12, 0.32, 1100, 1.2); this.blip(180, 0.12, 'square', 0.14, 80); break;
      case 'heavy': this.blip(160, 0.22, 'sawtooth', 0.2, 60); this.noise(0.14, 0.2, 500, 1); break;
      case 'parry': this.blip(1320, 0.12, 'sine', 0.3, 2100); this.blip(1980, 0.18, 'sine', 0.18); break;
      case 'dash': this.noise(0.16, 0.22, 1800, 0.8, 'highpass'); break;
      case 'hurt': this.blip(300, 0.22, 'sawtooth', 0.22, 120); this.noise(0.1, 0.18, 700, 1); break;
      case 'pickup': this.blip(880, 0.1, 'sine', 0.2); this.blip(1320, 0.16, 'sine', 0.18); break;
      case 'fragment': this.blip(660, 0.18, 'sine', 0.2, 990); this.blip(990, 0.3, 'sine', 0.16, 1320); break;
      case 'ability': this.blip(220, 0.3, 'sine', 0.22, 880); this.noise(0.2, 0.12, 1600, 0.6, 'highpass'); break;
      case 'slam': this.blip(120, 0.34, 'sawtooth', 0.3, 40); this.noise(0.26, 0.3, 240, 0.7, 'lowpass'); break;
      case 'ui': this.blip(720, 0.06, 'sine', 0.12, 900); break;
      case 'select': this.blip(540, 0.08, 'triangle', 0.16, 760); break;
      case 'boss': this.blip(90, 0.7, 'sawtooth', 0.3, 60); this.noise(0.6, 0.18, 200, 0.6, 'lowpass'); break;
      case 'corrupt': this.blip(110, 0.5, 'sawtooth', 0.16, 220); this.noise(0.4, 0.12, 900, 0.5); break;
      case 'heal': this.blip(520, 0.2, 'sine', 0.18, 780); this.blip(780, 0.3, 'sine', 0.14, 1040); break;
      case 'whisper': this.noise(0.5, 0.05, 2600, 0.4, 'bandpass'); break;
    }
  }

  // --- Ambient music: evolving pad per theme ---
  music(theme) {
    if (!this.ok) { this.resume(); this._pending = theme; return; }
    if (this.theme === theme) return;
    this.theme = theme;
    this._stopMusic();
    const t = this.ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(t);
    this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, t);
    this.musicGain.gain.linearRampToValueAtTime(theme === 'silent' ? 0 : 0.14, t + 3);
    if (theme === 'silent') return;

    const THEMES = {
      title:  { root: 110.0, scale: [0, 3, 5, 7, 10], type: 'sine', cutoff: 700, rate: 0.05 },
      temple: { root: 130.8, scale: [0, 2, 4, 7, 9], type: 'sine', cutoff: 800, rate: 0.05 },
      mountain:{ root: 98.0,  scale: [0, 2, 3, 7, 8], type: 'triangle', cutoff: 600, rate: 0.04 },
      forest: { root: 146.8, scale: [0, 2, 4, 5, 9], type: 'sine', cutoff: 900, rate: 0.06 },
      earth:  { root: 87.3,  scale: [0, 3, 5, 7, 10], type: 'sawtooth', cutoff: 500, rate: 0.04 },
      water:  { root: 164.8, scale: [0, 2, 4, 7, 11], type: 'sine', cutoff: 1100, rate: 0.07 },
      fire:   { root: 110.0, scale: [0, 1, 5, 6, 10], type: 'sawtooth', cutoff: 650, rate: 0.05 },
      air:    { root: 196.0, scale: [0, 4, 7, 9, 11], type: 'triangle', cutoff: 1300, rate: 0.08 },
      dark:   { root: 73.4,  scale: [0, 3, 6, 7, 10], type: 'sawtooth', cutoff: 480, rate: 0.03 },
      ending: { root: 130.8, scale: [0, 4, 7, 9, 11], type: 'sine', cutoff: 1000, rate: 0.05 },
    };
    const cfg = THEMES[theme] || THEMES.temple;

    // Drone: two detuned oscillators through a slow-LFO lowpass
    for (let i = 0; i < 2; i++) {
      const o = this.ctx.createOscillator();
      o.type = cfg.type; o.frequency.value = cfg.root * (i ? 1.5 : 1) + (i ? 0.4 : -0.3);
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cfg.cutoff; f.Q.value = 4;
      const lfo = this.ctx.createOscillator(); lfo.frequency.value = cfg.rate;
      const lg = this.ctx.createGain(); lg.gain.value = cfg.cutoff * 0.5;
      lfo.connect(lg); lg.connect(f.frequency);
      const g = this.ctx.createGain(); g.gain.value = 0.22;
      o.connect(f); f.connect(g); g.connect(this.musicGain);
      o.start(t); lfo.start(t);
      this.nodes.push(o, lfo);
    }
    // Gentle bell arpeggio
    this._arpTimer = setInterval(() => {
      if (this.muted || this.theme !== theme || document.hidden) return;
      if (Math.random() < 0.55) {
        const step = cfg.scale[(Math.random() * cfg.scale.length) | 0];
        const oct = Math.random() < 0.5 ? 2 : 4;
        const freq = cfg.root * oct * Math.pow(2, step / 12);
        this._bell(freq, 0.04 + Math.random() * 0.03);
      }
    }, 1400);
  }
  _bell(freq, vol) {
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
    const o2 = this.ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2.01;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
    o.connect(g); o2.connect(g); g.connect(this.musicGain);
    o.start(t); o2.start(t); o.stop(t + 2.7); o2.stop(t + 2.7);
  }
  _stopMusic() {
    if (this._arpTimer) { clearInterval(this._arpTimer); this._arpTimer = null; }
    const t = this.ctx ? this.ctx.currentTime : 0;
    this.nodes.forEach((n) => { try { n.stop(t + 0.05); } catch (e) {} });
    this.nodes = [];
  }
}
VEIL.Audio = Audio;

/* ------------------------------------------------------------
   Particles — shared additive particle system
   ------------------------------------------------------------ */
// Cached radial glow sprites — avoids allocating a gradient per particle
// per frame (the prime GC-stutter source in busy combat scenes).
const _glowCache = {};
function glowSprite(color) {
  let s = _glowCache[color];
  if (s) return s;
  const sz = 64, c = document.createElement('canvas'); c.width = c.height = sz;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(sz / 2, sz / 2, 0, sz / 2, sz / 2, sz / 2);
  grd.addColorStop(0, U.alpha(color, 1));
  grd.addColorStop(0.45, U.alpha(color, 0.5));
  grd.addColorStop(1, U.alpha(color, 0));
  g.fillStyle = grd; g.fillRect(0, 0, sz, sz);
  if (Object.keys(_glowCache).length < 256) _glowCache[color] = c;  // bounded
  return c;
}
function quantColor(col) {
  if (col[0] === '#') return col;                  // hex: small fixed set, cache directly
  const m = col.match(/rgba?\(([^)]+)\)/);
  if (!m) return col;
  const p = m[1].split(','), q = (v) => (Math.round(parseFloat(v) / 24) * 24) | 0;
  return 'rgb(' + q(p[0]) + ',' + q(p[1]) + ',' + q(p[2]) + ')';   // quantize lerped colors
}
class Particles {
  constructor() { this.list = []; }
  clear() { this.list.length = 0; }
  emit(o) {
    this.list.push({
      x: o.x, y: o.y,
      vx: o.vx || 0, vy: o.vy || 0,
      g: o.g || 0, drag: o.drag === undefined ? 1 : o.drag,
      life: o.life || 1, max: o.life || 1,
      r: o.r || 3, r2: o.r2 === undefined ? o.r || 3 : o.r2,
      color: o.color || '#fff', color2: o.color2 || null,
      a: o.a === undefined ? 1 : o.a,
      glow: o.glow !== false,
      shape: o.shape || 'circle',
      spin: o.spin || 0, rot: o.rot || 0,
      add: o.add !== false,
    });
  }
  burst(x, y, n, o) {
    o = o || {};
    for (let i = 0; i < n; i++) {
      const ang = o.ang !== undefined ? o.ang + U.rand(-(o.spread || Math.PI), (o.spread || Math.PI)) : U.rand(0, U.TAU);
      const spd = U.rand(o.spdMin || 30, o.spdMax || 180);
      this.emit(Object.assign({}, o, {
        x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
        life: U.rand((o.lifeMin || 0.4), (o.lifeMax || 1)),
        r: U.rand(o.rMin || 2, o.rMax || 5),
      }));
    }
  }
  update(dt) {
    const l = this.list;
    for (let i = l.length - 1; i >= 0; i--) {
      const p = l[i];
      p.life -= dt;
      if (p.life <= 0) { l.splice(i, 1); continue; }
      p.vy += p.g * dt;
      p.vx *= Math.pow(p.drag, dt * 60);
      p.vy *= Math.pow(p.drag, dt * 60);
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }
  }
  draw(ctx, cam) {
    const ox = cam ? -cam.x : 0, oy = cam ? -cam.y : 0;
    for (const p of this.list) {
      const t = p.life / p.max;
      const r = U.lerp(p.r2, p.r, t);
      const col = p.color2 ? U.lerpColor(p.color2, p.color, t) : p.color;
      const a = p.a * U.clamp(t * 1.6, 0, 1);
      if (a <= 0.003 || r <= 0.1) continue;
      ctx.save();
      ctx.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
      ctx.translate(p.x + ox, p.y + oy);
      if (p.shape === 'circle') {
        ctx.globalAlpha = a;
        if (p.glow) ctx.drawImage(glowSprite(quantColor(col)), -r, -r, r * 2, r * 2);
        else { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, r, 0, U.TAU); ctx.fill(); }
      } else {
        if (p.glow) { const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, U.alpha(col, a)); g.addColorStop(1, U.alpha(col, 0)); ctx.fillStyle = g; }
        else { ctx.globalAlpha = a; ctx.fillStyle = col; }
        ctx.rotate(p.rot);
        if (p.shape === 'square') ctx.fillRect(-r, -r, r * 2, r * 2);
        else if (p.shape === 'spark') ctx.fillRect(-r * 0.3, -r * 2, r * 0.6, r * 4);
        else if (p.shape === 'petal') { ctx.beginPath(); ctx.ellipse(0, 0, r * 0.5, r * 1.4, 0, 0, U.TAU); ctx.fill(); }
      }
      ctx.restore();
    }
  }
}
VEIL.Particles = Particles;

/* ------------------------------------------------------------
   Camera — parallax offset + trauma shake
   ------------------------------------------------------------ */
class Camera {
  constructor() { this.x = 0; this.y = 0; this.tx = 0; this.ty = 0; this.trauma = 0; this.sx = 0; this.sy = 0; this.bounds = null; this.zoom = 1; this.zoomTarget = 1; }
  setBounds(minX, maxX) { this.bounds = { minX, maxX }; }
  setZoom(z) { this.zoom = this.zoomTarget = z; }
  follow(px, py, dt, lerpAmt = 6, lead = 0) {
    const { W, H } = VEIL.engine;
    this.zoom = U.lerp(this.zoom, this.zoomTarget, 1 - Math.exp(-dt * 4));
    // frame-rate-independent (critically-ish damped) smoothing
    const kx = 1 - Math.exp(-dt * lerpAmt);
    const ky = 1 - Math.exp(-dt * lerpAmt * 0.8);
    // horizontal: follow target + smoothed look-ahead
    this.tx = px - W / 2 + lead;
    this.x = U.lerp(this.x, this.tx, kx);
    // vertical: deadzone so small hops don't jitter the framing
    const tyc = py - H * 0.58; const dz = 46;
    let goalY = this.y;
    if (tyc > this.y + dz) goalY = tyc - dz; else if (tyc < this.y - dz) goalY = tyc + dz;
    this.ty = tyc;
    this.y = U.lerp(this.y, goalY, ky);
    if (this.bounds) {
      // visible world half-span grows as we zoom out; keep it inside [minX, maxX]
      const half = (W / 2) / this.zoom;
      let min = this.bounds.minX + half - W / 2;
      let max = this.bounds.maxX - half - W / 2;
      this.x = min > max ? (min + max) / 2 : U.clamp(this.x, min, max);
    }
  }
  shake(amount) { this.trauma = U.clamp(this.trauma + amount, 0, 1); }
  update(dt) {
    const tr = this.trauma * this.trauma;
    this.sx = (Math.random() * 2 - 1) * 22 * tr;
    this.sy = (Math.random() * 2 - 1) * 22 * tr;
    this.trauma = Math.max(0, this.trauma - dt * 1.4);
  }
  begin(ctx) {
    const { W, H } = VEIL.engine;
    ctx.save();
    if (this.zoom !== 1) { ctx.translate(W / 2, H / 2); ctx.scale(this.zoom, this.zoom); ctx.translate(-W / 2, -H / 2); }
    // sub-pixel (no rounding) so the world + parallax scroll smoothly without shimmer
    ctx.translate(-(this.x + this.sx), -(this.y + this.sy));
  }
  end(ctx) { ctx.restore(); }
  get ox() { return this.x + this.sx; }
  get oy() { return this.y + this.sy; }
}
VEIL.Camera = Camera;

/* ------------------------------------------------------------
   Save — localStorage
   ------------------------------------------------------------ */
VEIL.Save = {
  KEY: 'veil_save_v1',
  write(state) { try { localStorage.setItem(this.KEY, JSON.stringify(state)); } catch (e) {} },
  read() { try { return JSON.parse(localStorage.getItem(this.KEY)); } catch (e) { return null; } },
  clear() { try { localStorage.removeItem(this.KEY); } catch (e) {} },
};

/* ------------------------------------------------------------
   Engine
   ------------------------------------------------------------ */
function freshState() {
  return {
    hp: 100, maxHp: 100,
    abilities: { dash: false, block: false, groundSlam: false, timeSlow: false, emberShot: false, glide: false },
    fragments: [],
    realmsCleared: [],
    ending: null,
    flags: {},
    checkpoint: 'act1_hall',
  };
}

class Engine {
  constructor() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.W = 1280; this.H = 720;
    this.time = 0; this.dt = 0; this.timeScale = 1;
    this.state = freshState();
    this.input = new Input();
    this.audio = VEIL.audio = new Audio();
    this.camera = new Camera();
    this.particles = new Particles();
    this.scene = null; this.sceneName = null;
    this.transitioning = false;
    this.grade = null; // {color, amount}
    this._frozen = 0; // hitstop timer
    this.fader = document.getElementById('fader');
    this.paused = false;
  }
  start() {
    window.addEventListener('resize', () => this._resize());
    this._resize();
    // hide loading
    const ld = document.getElementById('loading');
    setTimeout(() => { ld.classList.add('gone'); setTimeout(() => ld.remove(), 700); }, 600);
    this.fader.classList.add('clear');
    this.go('title');
    this._last = performance.now();
    requestAnimationFrame((t) => this._loop(t));
  }
  _resize() {
    // canvas keeps logical size; CSS object-fit handles scaling
    // compute scale to map mouse if needed later
    const r = this.canvas.getBoundingClientRect();
    this.viewScale = r.width / this.W;
    this.viewRect = r;
  }
  freeze(sec) { this._frozen = Math.max(this._frozen, sec); } // hitstop

  go(name, params) {
    if (this.transitioning) return;
    this.transitioning = true;
    this.fader.classList.remove('clear');
    if (VEIL.dialogue) VEIL.dialogue.cancel();
    setTimeout(() => {
      if (this.scene && this.scene.exit) this.scene.exit(this);
      this.particles.clear();
      this.camera = new Camera();
      this.timeScale = 1; this.grade = null;
      const Scene = VEIL.scenes[name];
      if (Scene) {
        this.scene = typeof Scene === 'function' ? new Scene() : Object.create(Scene);
        this.sceneName = name;
        if (this.scene.enter) this.scene.enter(this, params || {});
      } else {
        this.scene = VEIL._placeholder(name);
        this.sceneName = name;
      }
      requestAnimationFrame(() => {
        this.fader.classList.add('clear');
        setTimeout(() => { this.transitioning = false; }, 600);
      });
    }, 600);
  }

  // quick fade overlay without scene change (e.g., death)
  flash(color, a = 0.6) {
    const c = this.ctx;
    c.save(); c.globalAlpha = a; c.fillStyle = color; c.fillRect(0, 0, this.W, this.H); c.restore();
  }

  _loop(now) {
    let dt = (now - this._last) / 1000;
    this._last = now;
    dt = U.clamp(dt, 0, 1 / 30);
    this.realDt = dt;

    // hitstop
    let gdt = dt;
    if (this._frozen > 0) { this._frozen -= dt; gdt = 0; }
    this.dt = gdt;
    this.time += dt;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);

    // Guard the per-frame work: a single thrown error in a scene must never
    // brick the whole game (the loop's requestAnimationFrame lives at the end,
    // so an uncaught throw here would permanently freeze rendering + input).
    try {
      if (!this.paused && this.scene && this.scene.update) this.scene.update(gdt);
      this.particles.update(dt);
      this.camera.update(dt);

      if (this.scene && this.scene.draw) this.scene.draw(ctx);

      // post grade
      if (this.grade) {
        ctx.save(); ctx.globalCompositeOperation = 'soft-light';
        ctx.globalAlpha = this.grade.amount; ctx.fillStyle = this.grade.color;
        ctx.fillRect(0, 0, this.W, this.H); ctx.restore();
      }

      // HUD
      if (this.scene && this.scene.hud && VEIL.hud) VEIL.hud.draw(ctx, this);

      // UI updates (dialogue typing etc.)
      if (VEIL.dialogue) VEIL.dialogue.update(dt);
      if (VEIL.ui) VEIL.ui.update(dt);

      // pause toggle
      if (this.input.pressed('pause') && this.scene && this.scene.canPause) {
        if (VEIL.ui) VEIL.ui.togglePause();
      }
    } catch (err) {
      this._frameError(err);
    }

    this.input.endFrame();
    requestAnimationFrame((t) => this._loop(t));
  }

  // Throttled error reporter — log first occurrences, then go quiet so a
  // recurring per-frame error doesn't flood the console.
  _frameError(err) {
    this._errCount = (this._errCount || 0) + 1;
    if (this._errCount <= 5) console.error('[VEIL] frame error:', err);
    else if (this._errCount === 6) console.error('[VEIL] further frame errors suppressed.');
  }

  save() { this.state.checkpoint = this.sceneName; VEIL.Save.write(this.state); }
}
VEIL.Engine = Engine;
VEIL.freshState = freshState;

VEIL._placeholder = function (name) {
  return {
    name, hud: false, canPause: false,
    enter() {}, exit() {},
    update() {},
    draw(ctx) {
      VEIL.sky.paint(ctx, { top: '#1a1330', mid: '#241a44', bottom: '#0c0820' }, VEIL.engine.time);
      draw.text(ctx, 'Loading realm…', VEIL.engine.W / 2, VEIL.engine.H / 2 - 20, { size: 30, color: '#f4c560', glow: '#9a6bff' });
      draw.text(ctx, name, VEIL.engine.W / 2, VEIL.engine.H / 2 + 24, { size: 16, color: '#c9b3ff', font: 'Spectral, serif' });
    },
  };
};

})();

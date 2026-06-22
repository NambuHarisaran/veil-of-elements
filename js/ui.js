/* ============================================================
   Veil of the Elements — UI: dialogue, HUD, compass, menus
   ============================================================ */
(function () {
"use strict";
const VEIL = window.VEIL;
const U = VEIL.U, draw = VEIL.draw;

/* ------------------------------------------------------------
   Procedural character portraits (abstract elemental sigils)
   ------------------------------------------------------------ */
const PORTRAIT = {
  disciple: { c1: '#9a6bff', c2: '#f4c560', kind: 'figure' },
  master:   { c1: '#f4c560', c2: '#ffe6a8', kind: 'sage' },
  forest:   { c1: '#6fe6a0', c2: '#d8ffd0', kind: 'spirit' },
  tharos:   { c1: '#c9974f', c2: '#8a5a2b', kind: 'rune', sym: 'earth' },
  nerai:    { c1: '#5fd0ff', c2: '#bfeeff', kind: 'rune', sym: 'water' },
  rion:     { c1: '#ff7a3c', c2: '#ffd27a', kind: 'rune', sym: 'fire' },
  aelra:    { c1: '#cfe8ff', c2: '#ffffff', kind: 'rune', sym: 'air' },
  dark:     { c1: '#9a6bff', c2: '#3a2566', kind: 'void' },
  narrator: { c1: '#f4c560', c2: '#9a6bff', kind: 'eye' },
};
VEIL.portrait = function (who, canvas, t) {
  const cfg = PORTRAIT[who] || PORTRAIT.narrator;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height, cx = W / 2, cy = H / 2;
  ctx.clearRect(0, 0, W, H);
  // bg glow
  const bg = ctx.createRadialGradient(cx, cy, 4, cx, cy, W * 0.7);
  bg.addColorStop(0, U.alpha(cfg.c1, 0.5)); bg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(cx, cy);
  const pulse = 1 + Math.sin(t * 2) * 0.04;
  ctx.scale(pulse, pulse);
  ctx.lineWidth = 2.4; ctx.strokeStyle = cfg.c2; ctx.fillStyle = cfg.c1;
  ctx.shadowColor = cfg.c1; ctx.shadowBlur = 16;
  const R = W * 0.3;
  if (cfg.kind === 'figure') {
    // hooded disciple
    ctx.beginPath(); ctx.moveTo(0, -R); ctx.quadraticCurveTo(R * 0.8, -R * 0.2, R * 0.5, R);
    ctx.lineTo(-R * 0.5, R); ctx.quadraticCurveTo(-R * 0.8, -R * 0.2, 0, -R); ctx.fill();
    ctx.fillStyle = cfg.c2; ctx.beginPath(); ctx.arc(0, -R * 0.25, R * 0.22, 0, U.TAU); ctx.fill();
  } else if (cfg.kind === 'sage') {
    ctx.beginPath(); ctx.arc(0, -R * 0.2, R * 0.55, Math.PI, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-R * 0.55, -R * 0.2); ctx.quadraticCurveTo(0, R * 1.1, R * 0.55, -R * 0.2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, R * 0.1, R * 0.12, 0, U.TAU); ctx.fill();
    for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + (i - 1) * 0.5; draw.star(ctx, Math.cos(a) * R * 0.7, Math.sin(a) * R * 0.7 - R * 0.1, R * 0.12, cfg.c2, 0.9); }
  } else if (cfg.kind === 'spirit') {
    for (let i = 0; i < 5; i++) { const a = (i / 5) * U.TAU + t * 0.3; ctx.beginPath(); ctx.ellipse(Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5, R * 0.5, R * 0.18, a, 0, U.TAU); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(0, 0, R * 0.2, 0, U.TAU); ctx.fill();
  } else if (cfg.kind === 'void') {
    ctx.fillStyle = '#0a0712'; ctx.beginPath(); ctx.arc(0, 0, R * 0.7, 0, U.TAU); ctx.fill();
    ctx.strokeStyle = cfg.c1; for (let i = 0; i < 3; i++) { ctx.globalAlpha = 0.8 - i * 0.2; ctx.beginPath(); ctx.arc(0, 0, R * (0.7 + i * 0.12), t + i, t + i + 4); ctx.stroke(); }
    ctx.globalAlpha = 1;
  } else if (cfg.kind === 'eye') {
    ctx.beginPath(); ctx.ellipse(0, 0, R * 0.9, R * 0.5, 0, 0, U.TAU); ctx.stroke();
    ctx.fillStyle = cfg.c1; ctx.beginPath(); ctx.arc(0, 0, R * 0.28, 0, U.TAU); ctx.fill();
    ctx.fillStyle = '#0a0712'; ctx.beginPath(); ctx.arc(0, 0, R * 0.12, 0, U.TAU); ctx.fill();
  } else if (cfg.kind === 'rune') {
    drawElementSigil(ctx, cfg.sym, R, cfg.c1, cfg.c2, t);
  }
  ctx.restore();
};

function drawElementSigil(ctx, sym, R, c1, c2, t) {
  ctx.save(); ctx.rotate(Math.sin(t * 0.5) * 0.1);
  ctx.strokeStyle = c2; ctx.fillStyle = c1; ctx.lineWidth = 3;
  if (sym === 'earth') {
    ctx.beginPath(); ctx.moveTo(0, -R); ctx.lineTo(R * 0.9, R * 0.6); ctx.lineTo(-R * 0.9, R * 0.6); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, R * 0.1, R * 0.3, 0, U.TAU); ctx.fill();
  } else if (sym === 'water') {
    ctx.beginPath(); ctx.moveTo(0, -R); ctx.quadraticCurveTo(R * 0.8, R * 0.1, 0, R * 0.8); ctx.quadraticCurveTo(-R * 0.8, R * 0.1, 0, -R); ctx.fill();
  } else if (sym === 'fire') {
    ctx.beginPath(); ctx.moveTo(0, -R); ctx.quadraticCurveTo(R * 0.6, -R * 0.1, R * 0.3, R * 0.7); ctx.quadraticCurveTo(0, R, -R * 0.3, R * 0.7); ctx.quadraticCurveTo(-R * 0.6, -R * 0.1, 0, -R); ctx.fill();
  } else if (sym === 'air') {
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, -R * 0.4 + i * R * 0.45, R * (0.7 - i * 0.15), Math.PI * 0.1, Math.PI * 0.9); ctx.stroke(); }
  }
  ctx.restore();
}

/* ------------------------------------------------------------
   Dialogue system
   ------------------------------------------------------------ */
VEIL.dialogue = {
  el: null, active: false, queue: [], idx: 0,
  shown: '', target: '', who: '', tt: 0, speed: 42,
  choosing: false, choiceIdx: 0, onDone: null, portraitT: 0, lineDone: false, holdAdvance: 0,

  _init() {
    if (this.el) return;
    this.el = document.getElementById('dialogue');
    this.elName = document.getElementById('dlg-name');
    this.elText = document.getElementById('dlg-text');
    this.elChoices = document.getElementById('dlg-choices');
    this.elCont = document.getElementById('dlg-cont');
    this.elPortrait = document.getElementById('dlg-portrait');
    this.pcanvas = document.createElement('canvas'); this.pcanvas.width = 96; this.pcanvas.height = 96;
    this.elPortrait.appendChild(this.pcanvas);
  },
  play(lines, onDone, opts) {
    this._init();
    opts = opts || {};
    this.queue = lines.slice(); this.idx = -1; this.onDone = onDone || null;
    this.active = true; this.choosing = false;
    this.cinematic = opts.cinematic !== false;
    if (this.cinematic) VEIL.ui.cinematic(true);
    this.el.classList.remove('hidden');
    requestAnimationFrame(() => this.el.classList.add('show'));
    this.holdAdvance = 0.25;
    this._next();
  },
  _next() {
    this.idx++;
    if (this.idx >= this.queue.length) return this._finish();
    const line = this.queue[this.idx];
    this.who = line.who || 'narrator';
    this.target = line.text || '';
    this.shown = ''; this.tt = 0; this.lineDone = false;
    this.choosing = false; this.elChoices.innerHTML = '';
    this.elCont.classList.remove('ready');
    this.elName.textContent = this._displayName(this.who);
    this.elText.textContent = '';
    this.curLine = line;
    if (VEIL.audio) VEIL.audio.sfx('whisper');
  },
  _displayName(who) {
    const NAMES = { disciple: 'Disciple', master: 'The Master', forest: 'Forest Spirit', tharos: 'Tharos · Earth', nerai: 'Nerai · Water', rion: 'Rion · Fire', aelra: 'Aelra · Air', dark: 'The Veiled Voice', narrator: '' };
    return NAMES[who] !== undefined ? NAMES[who] : who;
  },
  _showChoices(choices) {
    this.choosing = true; this.choiceIdx = 0;
    this.elChoices.innerHTML = '';
    choices.forEach((ch, i) => {
      const b = document.createElement('div');
      b.className = 'choice' + (i === 0 ? ' sel' : '');
      b.textContent = ch.text;
      b.onclick = () => this._pick(i);
      b.onmouseenter = () => { this.choiceIdx = i; this._hl(); };
      this.elChoices.appendChild(b);
    });
  },
  _hl() { [...this.elChoices.children].forEach((c, i) => c.classList.toggle('sel', i === this.choiceIdx)); },
  _pick(i) {
    const ch = this.curLine.choices[i];
    if (VEIL.audio) VEIL.audio.sfx('select');
    this.choosing = false; this.elChoices.innerHTML = '';
    if (ch.set && VEIL.engine) VEIL.engine.state.flags[ch.set] = true;
    if (ch.onPick) ch.onPick();
    if (ch.then && ch.then.length) { this.queue.splice(this.idx + 1, 0, ...ch.then); }
    this._next();
  },
  _finish() {
    this.active = false;
    this.el.classList.remove('show');
    setTimeout(() => { if (!this.active) this.el.classList.add('hidden'); }, 360);
    if (this.cinematic) VEIL.ui.cinematic(false);
    const cb = this.onDone; this.onDone = null;
    if (cb) cb();
  },
  cancel() {
    if (!this.active) return;
    this.active = false; this.choosing = false;
    if (this.el) { this.el.classList.remove('show'); this.el.classList.add('hidden'); this.elChoices.innerHTML = ''; }
    VEIL.ui.cinematic(false); this.onDone = null;
  },
  update(dt) {
    if (!this.active) return;
    this.portraitT += dt;
    VEIL.portrait(this.who, this.pcanvas, this.portraitT);
    if (this.holdAdvance > 0) this.holdAdvance -= dt;

    if (!this.lineDone) {
      this.tt += dt * this.speed;
      const n = Math.floor(this.tt);
      if (n > this.shown.length) {
        this.shown = this.target.slice(0, n);
        this.elText.textContent = this.shown;
      }
      if (this.shown.length >= this.target.length) {
        this.lineDone = true;
        if (this.curLine.choices) this._showChoices(this.curLine.choices);
        else this.elCont.classList.add('ready');
      }
    }

    const adv = VEIL.engine.input.pressed('advance') || VEIL.engine.input.pressed('mouse0');
    if (this.choosing) {
      if (VEIL.engine.input.pressed('up')) { this.choiceIdx = (this.choiceIdx - 1 + this.curLine.choices.length) % this.curLine.choices.length; this._hl(); VEIL.audio.sfx('ui'); }
      if (VEIL.engine.input.pressed('down')) { this.choiceIdx = (this.choiceIdx + 1) % this.curLine.choices.length; this._hl(); VEIL.audio.sfx('ui'); }
      if ((VEIL.engine.input.pressed('advance') || VEIL.engine.input.pressed('interact')) && this.holdAdvance <= 0) this._pick(this.choiceIdx);
      return;
    }
    if (adv && this.holdAdvance <= 0) {
      if (!this.lineDone) { this.shown = this.target; this.elText.textContent = this.shown; this.lineDone = true; if (this.curLine.choices) this._showChoices(this.curLine.choices); else this.elCont.classList.add('ready'); this.holdAdvance = 0.12; }
      else { this._next(); this.holdAdvance = 0.12; }
    }
  },
};

/* ------------------------------------------------------------
   UI: cinematic bars, banners, toasts, pause
   ------------------------------------------------------------ */
VEIL.ui = {
  init() {
    this.stage = document.getElementById('stage');
    this.bannerEl = document.getElementById('banner');
    this.bKicker = document.getElementById('banner-kicker');
    this.bTitle = document.getElementById('banner-title');
    this.bSub = document.getElementById('banner-sub');
    if (!this.bannerEl.querySelector('.rule')) { const r = document.createElement('div'); r.className = 'rule'; this.bannerEl.appendChild(r); }
    this.toastEl = document.getElementById('toast');
    this.overlay = document.getElementById('overlay');
    this._bannerT = 0; this._toastT = 0;
  },
  cinematic(on) { this.stage.classList.toggle('cine', on); },
  banner(kicker, title, sub, dur = 3.2) {
    this.bKicker.textContent = kicker || '';
    this.bTitle.textContent = title || '';
    this.bSub.textContent = sub || '';
    this.bannerEl.classList.remove('hidden');
    requestAnimationFrame(() => this.bannerEl.classList.add('show'));
    this._bannerT = dur;
  },
  toast(text, dur = 2.4) {
    this.toastEl.textContent = text;
    this.toastEl.classList.remove('hidden');
    requestAnimationFrame(() => this.toastEl.classList.add('show'));
    this._toastT = dur;
  },
  update(dt) {
    if (this._bannerT > 0) { this._bannerT -= dt; if (this._bannerT <= 0) { this.bannerEl.classList.remove('show'); setTimeout(() => this.bannerEl.classList.add('hidden'), 1000); } }
    if (this._toastT > 0) { this._toastT -= dt; if (this._toastT <= 0) { this.toastEl.classList.remove('show'); setTimeout(() => this.toastEl.classList.add('hidden'), 400); } }
  },
  togglePause() {
    const e = VEIL.engine;
    if (e.paused) { this.closeOverlay(); return; }
    e.paused = true;
    if (VEIL.audio) VEIL.audio.sfx('ui');
    this.overlay.innerHTML = '';
    const p = document.createElement('div'); p.className = 'panel';
    p.innerHTML = `<h2>Paused</h2>`;
    const resume = mkBtn('Resume', () => this.closeOverlay());
    const muted = e.audio && e.audio.muted;
    const sound = mkBtn(muted ? 'Sound: Off' : 'Sound: On', () => { e.audio.setMuted(!e.audio.muted); e.state.flags.muted = e.audio.muted; sound.textContent = e.audio.muted ? 'Sound: Off' : 'Sound: On'; });
    const ctr = mkBtn('Controls', () => this.controls());
    const title = mkBtn('Return to Title', () => { this.closeOverlay(); e.go('title'); });
    [resume, sound, ctr, title].forEach((b) => p.appendChild(b));
    const hint = document.createElement('div'); hint.className = 'hint'; hint.textContent = 'Press Esc to resume';
    p.appendChild(hint);
    this.overlay.appendChild(p);
    this.overlay.classList.remove('hidden');
  },
  controls() {
    this.overlay.innerHTML = '';
    const p = document.createElement('div'); p.className = 'panel';
    p.innerHTML = `<h2>Controls</h2>
      <div style="text-align:left;line-height:2;font-size:.98rem;color:#e7ddc7">
        <div><span class="kbd">A</span><span class="kbd">D</span> / <span class="kbd">◄</span><span class="kbd">►</span> &nbsp; Move</div>
        <div><span class="kbd">Space</span> / <span class="kbd">W</span> &nbsp; Jump (hold higher)</div>
        <div><span class="kbd">J</span> &nbsp; Light attack &nbsp;·&nbsp; <span class="kbd">K</span> &nbsp; Heavy attack</div>
        <div><span class="kbd">L</span> &nbsp; Elemental power &nbsp;·&nbsp; <span class="kbd">Shift</span> &nbsp; Dash</div>
        <div><span class="kbd">F</span> &nbsp; Block / Parry (hold)</div>
        <div><span class="kbd">E</span> &nbsp; Interact / Talk &nbsp;·&nbsp; <span class="kbd">Esc</span> &nbsp; Pause</div>
      </div>`;
    p.appendChild(mkBtn('Back', () => this.togglePause()));
    this.overlay.appendChild(p);
  },
  closeOverlay() { VEIL.engine.paused = false; this.overlay.classList.add('hidden'); this.overlay.innerHTML = ''; if (VEIL.audio) VEIL.audio.sfx('ui'); },
  panel(html, buttons) {
    this.overlay.innerHTML = '';
    const p = document.createElement('div'); p.className = 'panel'; p.innerHTML = html;
    (buttons || []).forEach((b) => p.appendChild(mkBtn(b.label, b.fn)));
    this.overlay.appendChild(p); this.overlay.classList.remove('hidden');
    return p;
  },
};
function mkBtn(label, fn) { const b = document.createElement('button'); b.className = 'menu-btn'; b.textContent = label; b.onclick = fn; return b; }
VEIL.mkBtn = mkBtn;

/* ------------------------------------------------------------
   HUD — health, abilities, compass, realm progress
   ------------------------------------------------------------ */
const ELEMENTS = ['earth', 'water', 'fire', 'air', 'dark'];
const ECOLOR = { earth: '#c9974f', water: '#5fd0ff', fire: '#ff7a3c', air: '#cfe8ff', dark: '#9a6bff' };

VEIL.hud = {
  draw(ctx, e) {
    const st = e.state;
    const pad = 26, x = pad, y = pad;
    // --- Health ---
    const bw = 300, bh = 16;
    ctx.save();
    draw.roundRect(ctx, x, y, bw, bh, 8); ctx.fillStyle = 'rgba(10,7,18,.6)'; ctx.fill();
    ctx.strokeStyle = U.rgba('#f4c560', 0.4); ctx.lineWidth = 1; ctx.stroke();
    const hpFrac = U.clamp(st.hp / st.maxHp, 0, 1);
    draw.roundRect(ctx, x + 2, y + 2, (bw - 4) * hpFrac, bh - 4, 6);
    const g = ctx.createLinearGradient(x, 0, x + bw, 0);
    g.addColorStop(0, '#ff8a5c'); g.addColorStop(0.5, '#f4c560'); g.addColorStop(1, '#ffe6a8');
    ctx.fillStyle = g; ctx.fill();
    draw.text(ctx, 'VITALITY', x + 4, y - 10, { size: 11, color: '#c9b3ff', align: 'left', font: 'Cinzel, serif', spacing: '3px' });
    ctx.restore();

    // --- Ability chips ---
    const player = e.scene && e.scene.player;
    const chips = [];
    if (st.abilities.dash) chips.push({ k: 'dash', label: 'Dash', cd: player ? player.dashCd : 0, max: 0.7, col: '#cfe8ff' });
    if (st.abilities.groundSlam) chips.push({ k: 'slam', label: 'Slam', cd: player ? player.slamCd : 0, max: 1.4, col: '#c9974f' });
    if (st.abilities.timeSlow) chips.push({ k: 'slow', label: 'Flow', cd: player ? player.slowCd : 0, max: 4, col: '#5fd0ff' });
    if (st.abilities.emberShot) chips.push({ k: 'ember', label: 'Ember', cd: player ? player.emberCd : 0, max: 0.6, col: '#ff7a3c' });
    if (st.abilities.glide) chips.push({ k: 'glide', label: 'Glide', cd: 0, max: 1, col: '#cfe8ff' });
    let cx2 = x, cy2 = y + 34;
    chips.forEach((c) => {
      const s = 38;
      draw.roundRect(ctx, cx2, cy2, s, s, 9); ctx.fillStyle = 'rgba(10,7,18,.6)'; ctx.fill();
      ctx.strokeStyle = U.rgba(c.col, 0.7); ctx.lineWidth = 1.4; ctx.stroke();
      draw.glow(ctx, cx2 + s / 2, cy2 + s / 2, s * 0.5, c.col, 0.25);
      draw.text(ctx, c.label[0], cx2 + s / 2, cy2 + s / 2 - 2, { size: 18, color: c.col, glow: c.col, blur: 8 });
      if (c.cd > 0) {
        const f = U.clamp(c.cd / c.max, 0, 1);
        ctx.save(); draw.roundRect(ctx, cx2, cy2, s, s, 9); ctx.clip();
        ctx.fillStyle = 'rgba(5,3,8,.7)'; ctx.fillRect(cx2, cy2 + s * (1 - f), s, s * f); ctx.restore();
      }
      draw.text(ctx, c.label, cx2 + s / 2, cy2 + s + 8, { size: 9, color: '#b9b0a0', font: 'Cinzel, serif', spacing: '1px' });
      cx2 += s + 10;
    });

    // --- Compass (top-right) ---
    this.compass(ctx, e, e.W - 70, 70);

    // --- Fragments ---
    if (st.fragments.length) {
      draw.text(ctx, '✦ ' + st.fragments.length + ' / 4 Fragments of Truth', e.W - 26, e.H - 24, { size: 13, color: '#f4c560', align: 'right', font: 'Cinzel, serif', spacing: '1px' });
    }
  },
  compass(ctx, e, cx, cy) {
    const R = 38;
    ctx.save();
    draw.glow(ctx, cx, cy, R + 14, '#9a6bff', 0.18);
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, U.TAU);
    ctx.fillStyle = 'rgba(10,7,18,.55)'; ctx.fill();
    ctx.strokeStyle = U.rgba('#f4c560', 0.45); ctx.lineWidth = 1.4; ctx.stroke();
    // element pips
    ELEMENTS.forEach((el, i) => {
      const a = -Math.PI / 2 + (i / ELEMENTS.length) * U.TAU;
      const px = cx + Math.cos(a) * (R - 8), py = cy + Math.sin(a) * (R - 8);
      const lit = el === 'dark' ? !!e.state.flags.darkRestored : e.state.realmsCleared.includes(el);
      ctx.beginPath(); ctx.arc(px, py, 3.2, 0, U.TAU);
      ctx.fillStyle = lit ? ECOLOR[el] : 'rgba(120,110,140,.35)';
      if (lit) { ctx.shadowColor = ECOLOR[el]; ctx.shadowBlur = 10; }
      ctx.fill(); ctx.shadowBlur = 0;
    });
    // needle
    const ang = (e.scene && e.scene.compassAngle !== undefined) ? e.scene.compassAngle : Math.sin(e.time * 0.5) * 0.3 - Math.PI / 2;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
    ctx.beginPath(); ctx.moveTo(R - 12, 0); ctx.lineTo(-6, 4); ctx.lineTo(-6, -4); ctx.closePath();
    ctx.fillStyle = '#f4c560'; ctx.shadowColor = '#f4c560'; ctx.shadowBlur = 10; ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.arc(cx, cy, 3, 0, U.TAU); ctx.fillStyle = '#ffe6a8'; ctx.fill();
    ctx.restore();
  },
};

})();

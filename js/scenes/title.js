/* ============================================================
   Title Screen — orbiting elements around the missing Dark
   ============================================================ */
(function () {
"use strict";
const VEIL = window.VEIL;
const U = VEIL.U, draw = VEIL.draw;

const EL = [
  { name: 'Earth', color: '#c9974f' },
  { name: 'Water', color: '#5fd0ff' },
  { name: 'Fire', color: '#ff7a3c' },
  { name: 'Air', color: '#cfe8ff' },
  { name: 'Dark', color: '#9a6bff', missing: true },
];

VEIL.scenes['title'] = class TitleScene {
  enter(e) {
    this.e = e; this.t = 0; this.canPause = false; this.hud = false;
    this.stars = Array.from({ length: 120 }, () => ({ x: Math.random(), y: Math.random() * 0.85, r: Math.random() * 1.6 + 0.3, tw: Math.random() * 6 }));
    this.dust = Array.from({ length: 40 }, () => ({ x: Math.random(), y: Math.random(), v: Math.random() * 0.02 + 0.005, r: Math.random() * 2 + 0.5, ph: Math.random() * 10 }));
    this.sel = 0;
    this.hasSave = !!VEIL.Save.read();
    this.items = [];
    this._buildItems();
    this.pointer = { x: -1, y: -1, click: false };
    this._onMove = (ev) => { const r = e.canvas.getBoundingClientRect(); this.pointer.x = (ev.clientX - r.left) / r.width * e.W; this.pointer.y = (ev.clientY - r.top) / r.height * e.H; };
    this._onClick = () => { this.pointer.click = true; };
    window.addEventListener('mousemove', this._onMove);
    window.addEventListener('mousedown', this._onClick);
    e.audio.resume(); e.audio.music('title');
    this.intro = 0;
  }
  _buildItems() {
    this.items = [];
    this.items.push({ label: 'Begin the Journey', fn: () => this._begin() });
    if (this.hasSave) this.items.push({ label: 'Continue', fn: () => this._continue() });
    this.items.push({ label: 'Controls', fn: () => this._controls() });
    this.items.push({ label: () => 'Sound: ' + (this.e.audio.muted ? 'Off' : 'On'), fn: () => { this.e.audio.setMuted(!this.e.audio.muted); this.e.state.flags.muted = this.e.audio.muted; } });
  }
  exit() { window.removeEventListener('mousemove', this._onMove); window.removeEventListener('mousedown', this._onClick); if (this._panel) VEIL.ui.overlay.classList.add('hidden'); }
  _begin() { this.e.audio.sfx('select'); this.e.state = VEIL.freshState(); VEIL.Save.clear(); this.e.go('act1_hall'); }
  _continue() { const s = VEIL.Save.read(); if (s) { this.e.state = Object.assign(VEIL.freshState(), s); } this.e.audio.sfx('select'); this.e.go(this.e.state.checkpoint || 'act1_hall'); }
  _controls() {
    this.e.audio.sfx('ui');
    const p = VEIL.ui.panel(`<h2>Controls</h2>
      <div style="text-align:left;line-height:2;font-size:.98rem;color:#e7ddc7">
        <div><span class="kbd">A</span><span class="kbd">D</span> / <span class="kbd">◄</span><span class="kbd">►</span> &nbsp; Move</div>
        <div><span class="kbd">Space</span> / <span class="kbd">W</span> &nbsp; Jump (hold = higher)</div>
        <div><span class="kbd">J</span> Light · <span class="kbd">K</span> Heavy attack</div>
        <div><span class="kbd">Shift</span> Dash · <span class="kbd">F</span> Block / Parry</div>
        <div><span class="kbd">L</span> Ember · <span class="kbd">R</span> Slow Time · <span class="kbd">↓</span> Ground Slam (air)</div>
        <div><span class="kbd">E</span> Interact · <span class="kbd">Esc</span> Pause</div>
      </div>`, [{ label: 'Back', fn: () => { VEIL.ui.overlay.classList.add('hidden'); VEIL.ui.overlay.innerHTML = ''; } }]);
  }
  onKey(ev) {
    if (!VEIL.ui.overlay.classList.contains('hidden')) return;
    const k = ev.key.toLowerCase();
    if (k === 'arrowup' || k === 'w') { this.sel = (this.sel - 1 + this.items.length) % this.items.length; this.e.audio.sfx('ui'); }
    else if (k === 'arrowdown' || k === 's') { this.sel = (this.sel + 1) % this.items.length; this.e.audio.sfx('ui'); }
    else if (k === 'enter' || k === ' ' || k === 'e' || k === 'j') { this.items[this.sel].fn(); }
  }
  update(dt) {
    this.t += dt; this.intro = Math.min(1, this.intro + dt / 2);
    if (!VEIL.ui.overlay.classList.contains('hidden')) { this.pointer.click = false; return; }
    // pointer hover/click on menu
    this.items.forEach((it, i) => {
      if (it._box && this.pointer.x >= it._box.x && this.pointer.x <= it._box.x + it._box.w && this.pointer.y >= it._box.y && this.pointer.y <= it._box.y + it._box.h) {
        if (this.sel !== i) { this.sel = i; this.e.audio.sfx('ui'); }
        if (this.pointer.click) it.fn();
      }
    });
    this.pointer.click = false;
  }
  draw(ctx) {
    const { W, H } = this.e, t = this.t;
    // sky
    draw.vGrad(ctx, 0, 0, W, H, [[0, '#0c0820'], [0.5, '#1a1140'], [1, '#070410']]);
    // stars
    for (const s of this.stars) { const a = 0.4 + Math.sin(t * 1.5 + s.tw) * 0.4; ctx.globalAlpha = Math.max(0, a); ctx.fillStyle = '#dfe6ff'; ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, U.TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
    // distant temple silhouette
    ctx.fillStyle = '#0a0718';
    draw.ridge(ctx, H * 0.82, 60, 70, '#0d0922', 99, H);
    this._temple(ctx, W * 0.5, H * 0.82);
    // floating dust
    for (const d of this.dust) { const yy = U.wrap(d.y - t * d.v, 1); draw.glow(ctx, d.x * W, yy * H, d.r * 4, '#c9b3ff', 0.15); }

    // --- orbiting elements around the void ---
    const cx = W * 0.5, cy = H * 0.40, R = 150;
    // central void (missing Dark)
    const voidPulse = 1 + Math.sin(t * 1.5) * 0.06;
    ctx.save(); ctx.translate(cx, cy);
    draw.glow(ctx, 0, 0, 60 * voidPulse, '#9a6bff', 0.25);
    ctx.fillStyle = '#070410'; ctx.beginPath(); ctx.arc(0, 0, 34 * voidPulse, 0, U.TAU); ctx.fill();
    ctx.strokeStyle = U.rgba('#9a6bff', 0.6); ctx.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) { ctx.globalAlpha = 0.5 - i * 0.12; ctx.beginPath(); ctx.arc(0, 0, 40 + i * 10, t * (i % 2 ? -1 : 1) + i, t * (i % 2 ? -1 : 1) + i + 4.2); ctx.stroke(); }
    ctx.globalAlpha = 1; ctx.restore();

    EL.forEach((el, i) => {
      if (el.missing) return;
      const a = -Math.PI / 2 + (i / 4) * U.TAU + t * 0.25;
      const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R * 0.62;
      draw.glow(ctx, x, y, 26, el.color, 0.8);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 5, 0, U.TAU); ctx.fill();
      // orbit ring
    });
    ctx.strokeStyle = U.rgba('#9a6bff', 0.12); ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(cx, cy, R, R * 0.62, 0, 0, U.TAU); ctx.stroke();

    // --- Title ---
    ctx.globalAlpha = U.ease.out(this.intro);
    draw.text(ctx, 'VEIL OF THE ELEMENTS', cx, cy + 200, { size: 52, color: '#ffe6a8', glow: '#9a6bff', blur: 30, weight: 600, spacing: '6px' });
    draw.text(ctx, 'The Missing Spirit', cx, cy + 244, { size: 22, color: '#c9b3ff', font: 'Spectral, serif', alpha: 0.9 });
    ctx.globalAlpha = 1;

    // --- Menu ---
    const baseY = H * 0.78;
    this.items.forEach((it, i) => {
      const label = typeof it.label === 'function' ? it.label() : it.label;
      const y = baseY + i * 38;
      const selected = i === this.sel;
      it._box = { x: cx - 160, y: y - 16, w: 320, h: 32 };
      if (selected) { draw.glow(ctx, cx, y, 120, '#f4c560', 0.12); draw.text(ctx, '◆', cx - 130, y, { size: 13, color: '#9a6bff' }); draw.text(ctx, '◆', cx + 130, y, { size: 13, color: '#9a6bff' }); }
      draw.text(ctx, label, cx, y, { size: 17, color: selected ? '#ffe6a8' : '#9a8fb0', font: 'Cinzel, serif', spacing: '3px', glow: selected ? '#f4c560' : null, blur: 12 });
    });

    draw.vignette(ctx, 0.6, '#000');
    draw.text(ctx, '↑ ↓ to choose · Enter to select', cx, H - 26, { size: 12, color: '#6a6080', font: 'Spectral, serif' });
  }
  _temple(ctx, x, y) {
    ctx.save(); ctx.fillStyle = '#0a0718'; ctx.globalAlpha = 0.9;
    ctx.fillRect(x - 110, y - 90, 220, 90);
    // roof
    ctx.beginPath(); ctx.moveTo(x - 130, y - 90); ctx.lineTo(x, y - 150); ctx.lineTo(x + 130, y - 90); ctx.closePath(); ctx.fill();
    // columns gaps
    ctx.globalAlpha = 1; ctx.fillStyle = '#160f2c';
    for (let i = -2; i <= 2; i++) ctx.fillRect(x + i * 40 - 6, y - 80, 12, 80);
    // faint warm light within
    draw.glow(ctx, x, y - 40, 80, '#f4c560', 0.12);
    ctx.restore();
  }
};

})();

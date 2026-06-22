/* ============================================================
   ACT I — The Lesson (Hall of Balance, temple in the clouds)
   Cinematic + dialogue. The Dark sigil vanishes.
   ============================================================ */
(function () {
"use strict";
const VEIL = window.VEIL;
const U = VEIL.U, draw = VEIL.draw;

const SIGILS = [
  { sym: 'earth', color: '#c9974f' },
  { sym: 'water', color: '#5fd0ff' },
  { sym: 'fire', color: '#ff7a3c' },
  { sym: 'air', color: '#cfe8ff' },
  { sym: 'dark', color: '#9a6bff' },
];

VEIL.scenes['act1_hall'] = class HallScene {
  enter(e) {
    this.e = e; this.t = 0; this.hud = false; this.canPause = true;
    this.phase = 'banner'; this.phaseT = 0;
    this.darkAlpha = 1; this.candle = 1; this.darken = 0; this.pan = -40;
    this.dust = Array.from({ length: 50 }, () => ({ x: Math.random(), y: Math.random(), v: Math.random() * 0.01 + 0.003, r: Math.random() * 2 + 0.5 }));
    this.flames = [];
    e.audio.resume(); e.audio.music('temple');
    VEIL.ui.banner(VEIL.story.realms.hall.kicker, VEIL.story.realms.hall.title, VEIL.story.realms.hall.sub, 3.4);
  }
  exit() {}
  update(dt) {
    this.t += dt; this.phaseT += dt;
    this.pan = U.lerp(this.pan, 0, dt * 0.5);
    for (const d of this.dust) { d.y -= d.v * dt; if (d.y < -0.05) d.y = 1.05; }

    if (this.phase === 'banner' && this.phaseT > 2.4) { this.phase = 'opening'; this._go(); }

    if (this.phase === 'vanish') {
      // flicker then implode
      const k = this.phaseT;
      if (k < 1.2) this.darkAlpha = (Math.sin(k * 22) > 0 ? 1 : 0.2) * (1 - k / 1.4);
      else this.darkAlpha = Math.max(0, this.darkAlpha - dt * 2);
      if (k > 1.2 && !this._imploded) {
        this._imploded = true;
        const p = this._sigilPos(4);
        for (let i = 0; i < 30; i++) { const a = U.rand(0, U.TAU), r = U.rand(60, 120); this.e.particles.emit({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, vx: -Math.cos(a) * r * 2, vy: -Math.sin(a) * r * 2, life: 0.8, r: 5, color: '#9a6bff', color2: '#c9b3ff' }); }
        this.e.camera.shake(0.6); this.e.audio.sfx('corrupt'); this.candleTarget = 0.18;
      }
      if (this.candleTarget !== undefined) this.candle = U.approach(this.candle, this.candleTarget, dt * 1.2);
      if (k > 1.2) this.darken = Math.min(0.5, this.darken + dt * 0.4);
      // ceiling dust fall
      if (k > 1.2 && U.chance(0.5)) this.e.particles.emit({ x: U.rand(0, this.e.W), y: 40, vx: 0, vy: U.rand(60, 160), g: 200, life: 1.4, r: U.rand(1, 3), color: '#8a7a5a', glow: false, add: false });
      if (k > 2.0 && !this._vanishTalked) { this._vanishTalked = true; VEIL.dialogue.play(VEIL.story.act1Vanish, () => this._finish()); }
    }
  }
  _go() {
    VEIL.dialogue.play(VEIL.story.act1Opening(this.e), () => { this.phase = 'vanish'; this.phaseT = 0; });
  }
  _finish() {
    this.e.state.flags.hasCompass = true;
    VEIL.ui.toast('✦ The Compass is yours');
    this.e.save();
    setTimeout(() => this.e.go('act2_descent'), 1200);
  }
  _sigilPos(i) {
    const { W, H } = this.e; const cx = W / 2 + this.pan, cy = H * 0.34;
    const a = -Math.PI * 0.5 + (i - 2) * 0.42;
    return { x: cx + Math.cos(a) * 230, y: cy + Math.sin(a) * 120 + 40 };
  }
  draw(ctx) {
    const { W, H } = this.e, t = this.t, px = this.pan;
    // warm temple gradient
    draw.vGrad(ctx, 0, 0, W, H, [[0, '#1c1430'], [0.4, '#3a2a3e'], [0.7, '#6b4a3a'], [1, '#2a1c22']]);
    // clouds beyond arches
    ctx.save(); ctx.globalAlpha = 0.5 * this.candle + 0.2;
    for (let i = 0; i < 5; i++) { const cx2 = U.wrap(W * 0.2 * i + t * 6, W + 200) - 100; draw.glow(ctx, cx2, H * 0.5 + Math.sin(i) * 40, 130, '#f4c560', 0.18); }
    ctx.restore();

    // god rays
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.06 * this.candle;
    for (let i = 0; i < 6; i++) { ctx.fillStyle = '#f4c560'; ctx.beginPath(); const xx = W * 0.5 + (i - 3) * 90 + px; ctx.moveTo(xx, 0); ctx.lineTo(xx + 40, 0); ctx.lineTo(xx + 120, H); ctx.lineTo(xx - 40, H); ctx.closePath(); ctx.fill(); }
    ctx.restore();

    // back wall + sigils
    const cx = W / 2 + px;
    SIGILS.forEach((s, i) => {
      const p = this._sigilPos(i);
      const isDark = s.sym === 'dark';
      const a = isDark ? this.darkAlpha : 1;
      if (a <= 0.02) { // empty frame
        ctx.save(); ctx.globalAlpha = 0.4; ctx.strokeStyle = U.rgba('#9a6bff', 0.4); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, 26, 0, U.TAU); ctx.stroke(); ctx.restore();
        return;
      }
      ctx.save(); ctx.globalAlpha = a;
      draw.glow(ctx, p.x, p.y, 40, s.color, 0.5 * a);
      ctx.translate(p.x, p.y);
      this._sigil(ctx, s.sym, 22, s.color);
      ctx.restore();
    });

    // columns
    ctx.fillStyle = '#241726';
    for (let i = -3; i <= 3; i++) { const x = cx + i * 150; ctx.fillRect(x - 14, H * 0.2, 28, H * 0.6); draw.vGrad(ctx, x - 14, H * 0.2, 28, H * 0.6, [[0, U.rgba('#f4c560', 0.15)], [1, U.rgba('#000', 0)]]); ctx.fillStyle = '#241726'; }

    // floor
    draw.vGrad(ctx, 0, H * 0.78, W, H * 0.22, [[0, '#3a2630'], [1, '#160e16']]);
    ctx.strokeStyle = U.rgba('#f4c560', 0.1 * this.candle); for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo(cx - 400 + i * 100, H * 0.8); ctx.lineTo(cx - 600 + i * 150, H); ctx.stroke(); }

    // candles
    const cands = [cx - 320, cx - 160, cx + 160, cx + 320];
    cands.forEach((x, i) => {
      const fy = H * 0.62;
      ctx.fillStyle = '#2a1c22'; ctx.fillRect(x - 4, fy, 8, 40);
      const fl = this.candle * (0.8 + Math.sin(t * 8 + i) * 0.2);
      draw.glow(ctx, x, fy - 4, 24 * fl, '#ffcf6a', 0.7 * fl);
      ctx.fillStyle = U.rgba('#fff4d0', fl); ctx.beginPath(); ctx.ellipse(x, fy - 6, 3, 7 * fl, 0, 0, U.TAU); ctx.fill();
      if (this.candle > 0.5 && U.chance(0.2)) this.e.particles.emit({ x, y: fy - 8, vx: U.rand(-6, 6), vy: -30, life: 0.8, r: 2, color: '#ffcf6a' });
    });

    // Master (center, tall robed gold)
    this._figure(ctx, cx, H * 0.78, 130, '#5a3f2a', '#f4c560', t, true);
    // seated disciples
    this._seated(ctx, cx - 230, H * 0.84); this._seated(ctx, cx + 230, H * 0.84);
    // the disciple (player) — front, hooded violet
    this._figure(ctx, cx - 60, H * 0.9, 64, '#241a3a', '#9a6bff', t, false);

    // dust motes
    for (const d of this.dust) { ctx.globalAlpha = 0.3; draw.glow(ctx, d.x * W, d.y * H, d.r * 3, '#ffe6a8', 0.12); }
    ctx.globalAlpha = 1;

    // particles + darken + vignette
    this.e.particles.draw(ctx, null);
    if (this.darken > 0) { ctx.fillStyle = U.rgba('#070410', this.darken); ctx.fillRect(0, 0, W, H); }
    draw.vignette(ctx, 0.5, '#1a0e08');
  }
  _sigil(ctx, sym, R, c) {
    ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = 3; ctx.shadowColor = c; ctx.shadowBlur = 12;
    if (sym === 'earth') { ctx.beginPath(); ctx.moveTo(0, -R); ctx.lineTo(R, R * 0.7); ctx.lineTo(-R, R * 0.7); ctx.closePath(); ctx.stroke(); }
    else if (sym === 'water') { ctx.beginPath(); ctx.moveTo(0, -R); ctx.quadraticCurveTo(R, R * 0.2, 0, R); ctx.quadraticCurveTo(-R, R * 0.2, 0, -R); ctx.stroke(); }
    else if (sym === 'fire') { ctx.beginPath(); ctx.moveTo(0, -R); ctx.quadraticCurveTo(R * 0.7, 0, R * 0.3, R * 0.8); ctx.quadraticCurveTo(0, R, -R * 0.3, R * 0.8); ctx.quadraticCurveTo(-R * 0.7, 0, 0, -R); ctx.stroke(); }
    else if (sym === 'air') { for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, -R * 0.4 + i * R * 0.5, R * (0.8 - i * 0.18), Math.PI * 0.1, Math.PI * 0.9); ctx.stroke(); } }
    else { ctx.beginPath(); ctx.arc(0, 0, R * 0.8, 0, U.TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, R * 0.35, 0, U.TAU); ctx.fill(); }
    ctx.shadowBlur = 0;
  }
  _figure(ctx, x, baseY, h, robe, trim, t, master) {
    ctx.save(); ctx.translate(x, baseY);
    const sway = Math.sin(t * 1.2) * 2;
    ctx.fillStyle = robe;
    ctx.beginPath(); ctx.moveTo(-h * 0.22, -h + 14); ctx.quadraticCurveTo(-h * 0.35, 0, -h * 0.3, 0); ctx.lineTo(h * 0.3, 0); ctx.quadraticCurveTo(h * 0.35, 0, h * 0.22, -h + 14); ctx.closePath(); ctx.fill();
    // trim
    ctx.strokeStyle = U.rgba(trim, 0.6); ctx.lineWidth = 2; ctx.stroke();
    // head/hood
    ctx.fillStyle = U.lerpColor(robe, '#000', 0.2);
    ctx.beginPath(); ctx.arc(sway, -h + 8, h * 0.16, 0, U.TAU); ctx.fill();
    // inner glow
    draw.glow(ctx, sway, -h * 0.55, master ? 16 : 10, trim, 0.5);
    if (master) { draw.glow(ctx, 0, -h + 8, 40, trim, 0.25); }
    ctx.restore();
  }
  _seated(ctx, x, y) { ctx.save(); ctx.fillStyle = '#1c1426'; ctx.beginPath(); ctx.arc(x, y, 22, Math.PI, 0); ctx.fill(); ctx.beginPath(); ctx.arc(x, y - 18, 10, 0, U.TAU); ctx.fill(); ctx.restore(); }
};

})();

/* ============================================================
   ACT VIII — Return to the Hall of Balance
   Half-corrupted temple. Revelation + moral choice.
   ============================================================ */
(function () {
"use strict";
const VEIL = window.VEIL;
const U = VEIL.U, draw = VEIL.draw;

const SIG = [
  { sym: 'earth', color: '#c9974f', key: 'earth' },
  { sym: 'water', color: '#5fd0ff', key: 'water' },
  { sym: 'fire', color: '#ff7a3c', key: 'fire' },
  { sym: 'air', color: '#cfe8ff', key: 'air' },
];

VEIL.scenes['act8_return'] = class ReturnScene {
  enter(e) {
    this.e = e; this.t = 0; this.hud = false; this.canPause = true;
    this.corrupt = 0.7; this.darkFrame = 0; this.phase = 'intro'; this.phaseT = 0;
    e.audio.resume(); e.audio.music('dark');
    e.grade = { color: '#2a1840', amount: 0.2 };
    const r = VEIL.story.realms.return; VEIL.ui.banner(r.kicker, r.title, r.sub, 3.6);
    this.veins = Array.from({ length: 14 }, (_, i) => ({ x: Math.random(), y: Math.random() * 0.7, len: Math.random() * 0.3 + 0.1, ph: i }));
  }
  exit() { this.e.grade = null; }
  update(dt) {
    this.t += dt; this.phaseT += dt;
    this.darkFrame = (Math.sin(this.t * 2) + 1) / 2;
    if (this.phase === 'intro' && this.phaseT > 2.6) { this.phase = 'talk'; VEIL.dialogue.play(VEIL.story.act8, () => this._choose()); }
    if (U.chance(0.04)) this.e.particles.emit({ x: U.rand(0, this.e.W), y: U.rand(0, this.e.H * 0.7), vx: 0, vy: U.rand(-20, -60), life: 1.4, r: U.rand(1, 3), color: '#9a6bff' });
  }
  _choose() {
    this.phase = 'choice';
    VEIL.dialogue.play(VEIL.story.act8Choice, () => {
      const balance = this.e.state.flags.chooseBalance;
      this.e.state.ending = balance ? 'balance' : 'light';
      this.e.state.flags.darkRestored = !!balance;
      this.e.save();
      // dramatic beat before the ending
      this.e.camera.shake(0.5); this.e.audio.sfx(balance ? 'fragment' : 'corrupt');
      for (let i = 0; i < 40; i++) this.e.particles.emit({ x: this.e.W / 2, y: this.e.H * 0.38, vx: U.rand(-300, 300), vy: U.rand(-300, 300), life: 1.2, r: 5, color: balance ? '#f4c560' : '#6a6a7a', color2: '#9a6bff' });
      setTimeout(() => this.e.go('act9_ending'), 1400);
    });
  }
  draw(ctx) {
    const { W, H } = this.e, t = this.t;
    // dim corrupted temple
    draw.vGrad(ctx, 0, 0, W, H, [[0, '#140d22'], [0.5, '#2a1c2e'], [1, '#0c0712']]);
    draw.glow(ctx, W * 0.5, H * 0.4, 260, '#3a2a5e', 0.5);

    // corruption veins
    ctx.save(); ctx.strokeStyle = U.rgba('#9a6bff', 0.5); ctx.lineWidth = 2; ctx.shadowColor = '#9a6bff'; ctx.shadowBlur = 10;
    for (const v of this.veins) { ctx.beginPath(); const x = v.x * W; let y = 0; ctx.moveTo(x, y); for (let s = 0; s < 6; s++) { y += v.len * H / 6; ctx.lineTo(x + Math.sin(t + v.ph + s) * 20, y); } ctx.stroke(); }
    ctx.restore();

    // columns (cracked)
    const cx = W / 2;
    ctx.fillStyle = '#1c1426';
    for (let i = -3; i <= 3; i++) { const x = cx + i * 150; ctx.fillRect(x - 14, H * 0.2, 28, H * 0.6); }

    // four lit sigils in arc + empty dark frame center-top
    SIG.forEach((s, i) => {
      const a = -Math.PI * 0.5 + (i - 1.5) * 0.42; const x = cx + Math.cos(a) * 230, y = H * 0.34 + Math.sin(a) * 120 + 20;
      const lit = this.e.state.realmsCleared.includes(s.key);
      ctx.save(); ctx.globalAlpha = lit ? 1 : 0.25;
      if (lit) draw.glow(ctx, x, y, 38, s.color, 0.6);
      ctx.translate(x, y); this._sig(ctx, s.sym, 20, lit ? s.color : '#555');
      ctx.restore();
    });
    // empty dark frame, pulsing
    const dfx = cx, dfy = H * 0.16;
    ctx.save(); ctx.globalAlpha = 0.5 + this.darkFrame * 0.4;
    draw.glow(ctx, dfx, dfy, 30 + this.darkFrame * 16, '#9a6bff', 0.4);
    ctx.strokeStyle = U.rgba('#9a6bff', 0.7); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(dfx, dfy, 24, 0, U.TAU); ctx.stroke();
    ctx.setLineDash([6, 8]); ctx.beginPath(); ctx.arc(dfx, dfy, 32, t, t + U.TAU); ctx.stroke();
    ctx.restore();

    // floor
    draw.vGrad(ctx, 0, H * 0.78, W, H * 0.22, [[0, '#241622'], [1, '#0c0712']]);

    // Master + disciple
    this._fig(ctx, cx + 70, H * 0.82, 120, '#3a2a3e', '#f4c560', t, true);
    this._fig(ctx, cx - 90, H * 0.86, 64, '#241a3a', '#9a6bff', t, false);

    this.e.particles.draw(ctx, null);
    draw.vignette(ctx, 0.6, '#0c0712');
  }
  _sig(ctx, sym, R, c) {
    ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = 2.6; ctx.shadowColor = c; ctx.shadowBlur = 10;
    if (sym === 'earth') { ctx.beginPath(); ctx.moveTo(0, -R); ctx.lineTo(R, R * 0.7); ctx.lineTo(-R, R * 0.7); ctx.closePath(); ctx.stroke(); }
    else if (sym === 'water') { ctx.beginPath(); ctx.moveTo(0, -R); ctx.quadraticCurveTo(R, R * 0.2, 0, R); ctx.quadraticCurveTo(-R, R * 0.2, 0, -R); ctx.stroke(); }
    else if (sym === 'fire') { ctx.beginPath(); ctx.moveTo(0, -R); ctx.quadraticCurveTo(R * 0.7, 0, R * 0.3, R * 0.8); ctx.quadraticCurveTo(0, R, -R * 0.3, R * 0.8); ctx.quadraticCurveTo(-R * 0.7, 0, 0, -R); ctx.stroke(); }
    else { for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, -R * 0.4 + i * R * 0.5, R * (0.8 - i * 0.18), Math.PI * 0.1, Math.PI * 0.9); ctx.stroke(); } }
    ctx.shadowBlur = 0;
  }
  _fig(ctx, x, baseY, h, robe, trim, t, master) {
    ctx.save(); ctx.translate(x, baseY); const sway = Math.sin(t * 1.2) * 2;
    ctx.fillStyle = robe; ctx.beginPath(); ctx.moveTo(-h * 0.22, -h + 14); ctx.quadraticCurveTo(-h * 0.35, 0, -h * 0.3, 0); ctx.lineTo(h * 0.3, 0); ctx.quadraticCurveTo(h * 0.35, 0, h * 0.22, -h + 14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = U.lerpColor(robe, '#000', 0.2); ctx.beginPath(); ctx.arc(sway, -h + 8, h * 0.16, 0, U.TAU); ctx.fill();
    draw.glow(ctx, sway, -h * 0.55, master ? 14 : 10, trim, 0.5); ctx.restore();
  }
};

})();

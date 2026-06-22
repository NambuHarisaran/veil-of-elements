/* ============================================================
   ACT IX — Endings
   Path of Balance (Restore Dark) / Path of Light (Keep Sealed)
   ============================================================ */
(function () {
"use strict";
const VEIL = window.VEIL;
const U = VEIL.U, draw = VEIL.draw;

VEIL.scenes['act9_ending'] = class EndingScene {
  enter(e) {
    this.e = e; this.t = 0; this.hud = false; this.canPause = false;
    this.balance = e.state.ending === 'balance';
    this.reveal = 0; this.heal = 0; this.grey = 0; this.done = false;
    e.audio.resume(); e.audio.music(this.balance ? 'ending' : 'silent');
    this.stars = Array.from({ length: 120 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.6 + 0.3, tw: Math.random() * 6 }));
    VEIL.dialogue.play(this.balance ? VEIL.story.endingBalance : VEIL.story.endingLight, () => this._card(), { cinematic: true });
  }
  exit() {}
  _card() {
    this.done = true;
    setTimeout(() => {
      VEIL.ui.panel(
        `<h2>${this.balance ? 'Path of Balance' : 'Path of Light'}</h2>
         <div style="font-style:italic;color:#e7ddc7;font-size:1.1rem;line-height:1.6;margin:6px 0 4px">
           ${this.balance ? '“In darkness, light found its shape.”' : '“Peace without truth is silence.”'}
         </div>
         <div class="hint">Fragments of Truth gathered: ${this.e.state.fragments.length} / 4</div>`,
        [
          { label: this.balance ? 'See the Other Path' : 'See the Other Path', fn: () => { VEIL.ui.overlay.classList.add('hidden'); VEIL.ui.overlay.innerHTML = ''; this.e.state.ending = this.balance ? 'light' : 'balance'; this.e.state.flags.darkRestored = !this.balance; this.e.go('act9_ending'); } },
          { label: 'Return to Title', fn: () => { VEIL.ui.overlay.classList.add('hidden'); VEIL.ui.overlay.innerHTML = ''; this.e.go('title'); } },
        ]
      );
    }, 800);
  }
  update(dt) {
    this.t += dt;
    if (this.balance) this.heal = Math.min(1, this.heal + dt * 0.18);
    else this.grey = Math.min(1, this.grey + dt * 0.12);
    if (this.balance && U.chance(0.4)) this.e.particles.emit({ x: U.rand(0, this.e.W), y: this.e.H + 10, vx: U.rand(-20, 20), vy: U.rand(-60, -140), life: U.rand(1.5, 3), r: U.rand(1.5, 4), color: U.chance(0.5) ? '#f4c560' : '#9a6bff' });
  }
  draw(ctx) {
    const { W, H } = this.e, t = this.t;
    if (this.balance) {
      // light + shadow interwoven, world healing
      draw.vGrad(ctx, 0, 0, W, H, [[0, U.lerpColor('#0c0820', '#1a1442', this.heal)], [0.5, U.lerpColor('#1a1140', '#3a2a6a', this.heal)], [1, U.lerpColor('#070410', '#1c1230', this.heal)]]);
      // interwoven beams
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 10; i++) { const a = (i / 10) * U.TAU + t * 0.2; const col = i % 2 ? '#f4c560' : '#9a6bff'; ctx.strokeStyle = U.rgba(col, 0.12 + this.heal * 0.1); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(W / 2, H * 0.4); ctx.lineTo(W / 2 + Math.cos(a) * 600, H * 0.4 + Math.sin(a) * 600); ctx.stroke(); }
      ctx.restore();
      // central bloom
      draw.glow(ctx, W / 2, H * 0.4, 120 + Math.sin(t * 2) * 16, '#ffe6a8', 0.5);
      draw.glow(ctx, W / 2, H * 0.4, 80, '#9a6bff', 0.4);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(W / 2, H * 0.4, 18, 0, U.TAU); ctx.fill();
      // returning color motes
      for (const s of this.stars) { ctx.globalAlpha = (0.3 + Math.sin(t + s.tw) * 0.3) * this.heal; ctx.fillStyle = i_color(s); ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, U.TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
      this.e.particles.draw(ctx, null);
      draw.vignette(ctx, 0.45, '#0a0718');
    } else {
      // world stabilizes but loses color
      const g = this.grey;
      draw.vGrad(ctx, 0, 0, W, H, [[0, U.lerpColor('#16121f', '#2a2a30', g)], [0.5, U.lerpColor('#221c2e', '#3a3a40', g)], [1, U.lerpColor('#0c0a12', '#1c1c20', g)]]);
      // a lifeless compass
      const cx = W / 2, cy = H * 0.4;
      draw.glow(ctx, cx, cy, 70 * (1 - g * 0.6), U.lerpColor('#9a6bff', '#9a9aa2', g), 0.3 * (1 - g * 0.5));
      ctx.strokeStyle = U.lerpColor('#f4c560', '#8a8a90', g); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 50, 0, U.TAU); ctx.stroke();
      // frozen needle
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.6);
      ctx.fillStyle = U.lerpColor('#f4c560', '#8a8a90', g); ctx.beginPath(); ctx.moveTo(40, 0); ctx.lineTo(-6, 4); ctx.lineTo(-6, -4); ctx.closePath(); ctx.fill(); ctx.restore();
      // desaturating stars
      for (const s of this.stars) { ctx.globalAlpha = (0.2 + Math.sin(t * 0.5 + s.tw) * 0.15) * (1 - g * 0.4); ctx.fillStyle = U.lerpColor('#cfd6ff', '#9a9aa2', g); ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, U.TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
      draw.vignette(ctx, 0.6, '#0a0a0e');
    }
    function i_color(s) { return ['#f4c560', '#9a6bff', '#5fd0ff', '#6fe6a0', '#ff7a3c'][(s.r * 13) % 5 | 0]; }
  }
};

})();

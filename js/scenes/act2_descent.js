/* ============================================================
   ACT II — Descent from the Hall (Tutorial Zone)
   Misty mountain path. Movement, jump, attack. Murals + whispers.
   REFERENCE SCENE — shows full Platformer usage + parallax bg.
   ============================================================ */
(function () {
"use strict";
const VEIL = window.VEIL;
const U = VEIL.U, draw = VEIL.draw;

VEIL.scenes['act2_descent'] = class DescentScene {
  enter(e) {
    this.e = e; this.hud = true; this.canPause = true; this.t = 0;
    e.audio.resume(); e.audio.music('mountain');
    e.grade = { color: '#3a4a6a', amount: 0.18 };
    this.whisperT = 4; this.whisperIdx = 0;
    this.snow = Array.from({ length: 80 }, () => ({ x: Math.random() * 4000, y: Math.random() * 720, v: Math.random() * 40 + 20, r: Math.random() * 1.6 + 0.4, ph: Math.random() * 10 }));

    const T = { platform: '#3b4258', platformEdge: '#9fb4d8', accent: '#7fa0d0' };
    const self = this;
    const level = {
      width: 4000, killY: 920, spawn: { x: 80, y: 560 }, theme: T,
      vignette: 0.5, vignetteColor: '#0a1424',
      solids: [
        { x: -40, y: 580, w: 600, h: 160 },
        { x: 700, y: 610, w: 320, h: 130 },
        { x: 840, y: 500, w: 150, h: 16, oneway: true },
        { x: 1120, y: 560, w: 380, h: 180 },
        { x: 1300, y: 450, w: 130, h: 16, oneway: true },
        { x: 1620, y: 600, w: 320, h: 140 },
        { x: 2040, y: 560, w: 360, h: 180 },
        { x: 2220, y: 450, w: 140, h: 16, oneway: true },
        { x: 2520, y: 600, w: 360, h: 140 },
        { x: 2980, y: 560, w: 520, h: 180 },
        { x: 3600, y: 560, w: 700, h: 200 },
      ],
      hazards: [
        { x: 2400, y: 720, w: 120, h: 30, dmg: 16 },
      ],
      checkpoints: [ { x: 1300, y: 560 }, { x: 2700, y: 600 } ],
      enemies: [
        { kind: 'wisp', x: 3060, y: 420 }, { kind: 'wisp', x: 3260, y: 440 },
      ],
      triggers: [
        { x: 1080, y: 0, w: 60, h: 720, once: true, onEnter: () => self._mural(0) },
        { x: 2000, y: 0, w: 60, h: 720, once: true, onEnter: () => self._mural(1) },
        { x: 2980, y: 0, w: 60, h: 720, once: true, onEnter: () => VEIL.ui.toast(VEIL.story.hints.attack, 3.4) },
      ],
      goal: { x: 3760, y: 0, color: '#9fb4d8', onReach: () => self._shrine() },
      interactables: [
        { x: 430, y: 545, r: 70, label: 'Read mural', color: '#9fb4d8', once: true, keepMarker: true, sfx: 'whisper', onInteract: () => self._examine(0) },
        { x: 1300, y: 525, r: 72, label: 'Rest at shrine', color: '#f4c560', sfx: 'heal', onInteract: (it, p) => self._rest(p) },
        { x: 3120, y: 525, r: 70, label: 'Read mural', color: '#9fb4d8', once: true, keepMarker: true, sfx: 'whisper', onInteract: () => self._examine(1) },
      ],
      paintBg: (ctx, w, t) => self._bg(ctx, w, t),
      paintFg: (ctx, w, t) => self._fg(ctx, w, t),
    };
    this.pf = new VEIL.Platformer(e, level);
    this.player = this.pf.player;
    this.compassAngle = 0;
    setTimeout(() => { if (e.sceneName === 'act2_descent') VEIL.ui.toast(VEIL.story.hints.move, 3.6); }, 900);
    VEIL.dialogue.play(VEIL.story.act2Intro, null, { cinematic: false });
  }
  exit() { this.e.grade = null; }

  _mural(i) { VEIL.ui.toast('✦ ' + VEIL.story.murals[i], 5); this.e.audio.sfx('whisper'); }
  _examine(i) {
    const lore = [
      [{ who: 'narrator', text: 'The mural shows five flames around a sixth — a dark one — at the centre. Hands reach to smother it.' },
       { who: 'dark', text: 'They called it shadow. They never asked what the shadow kept warm.' }],
      [{ who: 'narrator', text: 'Here the sixth flame is gone. The other five lean inward, guttering, as if missing the weight that held them.' },
       { who: 'dark', text: 'Balance is not the absence of dark. It is the courage to hold it.' }],
    ];
    VEIL.dialogue.play(lore[i] || lore[0], null, { cinematic: false });
  }
  _rest(p) {
    const healed = Math.min(p.e.state.maxHp, p.e.state.hp + 40);
    const gained = healed - p.e.state.hp; p.e.state.hp = healed;
    VEIL.ui.toast(gained > 0 ? '✦ The shrine restores you (+' + Math.round(gained) + ')' : '✦ You are already whole', 2.6);
    this.pf.particles.burst(p.cx, p.cy, 18, { color: '#f4c560', color2: '#ffe6a8', spdMax: 160, lifeMax: 0.8, rMax: 4 });
  }
  _shrine() {
    this.pf.player.vx = 0;
    VEIL.dialogue.play(VEIL.story.act2Shrine, () => { this.e.save(); this.e.go('act3_forest'); });
  }

  update(dt) {
    this.t += dt;
    this.pf.update(dt);
    // compass points toward goal
    const dx = this.pf.goal.x - this.pf.player.cx;
    this.compassAngle = U.lerp(this.compassAngle, Math.atan2(-0.2, dx), dt * 4);
    // ambient whispers
    this.whisperT -= dt;
    if (this.whisperT <= 0) { this.whisperT = U.rand(9, 16); const w = VEIL.story.whispers[this.whisperIdx % VEIL.story.whispers.length]; this.whisperIdx++; VEIL.ui.toast('“' + w + '”', 4); this.e.audio.sfx('whisper'); }
    // snow drift
    for (const s of this.snow) { s.y += s.v * dt; s.x -= 8 * dt; if (s.y > 760) { s.y = -10; s.x = this.pf.camera.x + Math.random() * this.e.W; } }
  }
  draw(ctx) { this.pf.draw(ctx); }

  // ---- parallax mountain backdrop ----
  _bg(ctx, w, t) {
    const { W, H } = this.e; const cam = w.camera;
    draw.vGrad(ctx, 0, 0, W, H, [[0, '#152138'], [0.45, '#2a3a55'], [0.8, '#5a6a82'], [1, '#7a8499']]);
    // pale sun behind mist
    draw.glow(ctx, W * 0.7 - cam.x * 0.05, H * 0.28, 200, '#d8e4f4', 0.4);
    // far temple (where you came from), upper-left, parallax slow
    const tx = W * 0.18 - cam.x * 0.08, ty = H * 0.22;
    ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = '#1c2742';
    ctx.fillRect(tx - 50, ty, 100, 50); ctx.beginPath(); ctx.moveTo(tx - 64, ty); ctx.lineTo(tx, ty - 36); ctx.lineTo(tx + 64, ty); ctx.closePath(); ctx.fill();
    ctx.restore();
    // ridges (3 layers, increasing parallax)
    this._ridge(ctx, cam.x * 0.12, H * 0.55, 90, '#27374f', 11);
    draw.mist(ctx, H * 0.5, 120, '#5a6a82', t, 0.14);
    this._ridge(ctx, cam.x * 0.26, H * 0.66, 120, '#1d2a40', 23);
    draw.mist(ctx, H * 0.62, 130, '#3a4a64', t + 5, 0.16);
    this._ridge(ctx, cam.x * 0.45, H * 0.78, 150, '#121d30', 37);
  }
  _ridge(ctx, off, baseY, amp, color, seed) {
    const { W, H } = this.e; const rng = U.seed(seed);
    ctx.save(); ctx.translate(-(off % 600), 0);
    ctx.beginPath(); ctx.moveTo(-100, H); ctx.lineTo(-100, baseY);
    let y = baseY;
    for (let x = -100; x <= W + 700; x += 40) { y += (rng() - 0.5) * amp * 0.4; y = U.clamp(y, baseY - amp, baseY + amp * 0.3); ctx.lineTo(x, y); }
    ctx.lineTo(W + 700, H); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    ctx.restore();
  }
  _fg(ctx, w, t) {
    const { W, H } = this.e;
    // drifting snow (screen space, already world-ish)
    ctx.save(); ctx.fillStyle = '#dfeaff';
    for (const s of this.snow) { const sx = s.x - w.camera.x; if (sx < -20 || sx > W + 20) continue; ctx.globalAlpha = 0.5 + Math.sin(t * 2 + s.ph) * 0.3; ctx.beginPath(); ctx.arc(sx, s.y, s.r, 0, U.TAU); ctx.fill(); }
    ctx.restore();
    // bottom mist
    draw.mist(ctx, H * 0.82, 120, '#8a96ac', t, 0.18);
  }
};

})();

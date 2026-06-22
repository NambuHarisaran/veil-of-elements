/* ============================================================
   ACT III — The Spirit Forest
   Bioluminescent forest, creeping corruption, cleanse-orb puzzle.
   Forest Spirit grants Dash. Leads to act4_earth.
   ============================================================ */
(function () {
"use strict";
const VEIL = window.VEIL;
const U = VEIL.U, draw = VEIL.draw;

VEIL.scenes['act3_forest'] = class ForestScene {

  /* ----------------------------------------------------------
     ENTER
  ---------------------------------------------------------- */
  enter(e) {
    this.e      = e;
    this.t      = 0;
    this.hud    = true;
    this.canPause = true;

    e.audio.resume();
    e.audio.music(VEIL.story.realms.forest.music);
    e.grade = { color: '#0d2e1a', amount: 0.22 };

    const r = VEIL.story.realms.forest;
    VEIL.ui.banner(r.kicker, r.title, r.sub);

    /* ---- puzzle state ---- */
    this.orbsCollected = 0;
    this.rootsCleansed = 0;
    this.ROOTS_NEEDED  = 3;
    this.rootsOpen     = false;

    /* ---- ambient particles: fireflies / spores ---- */
    this.spores = Array.from({ length: 110 }, () => ({
      x:     U.rand(0, 4800),
      y:     U.rand(60, 700),
      vx:    U.rand(-14, 14),
      vy:    U.rand(-8, 8),
      r:     U.rand(1.2, 3.4),
      ph:    U.rand(0, U.TAU),
      col:   U.chance(0.52) ? '#6fe6a0' : '#c9b3ff',
      speed: U.rand(0.5, 1.8),
    }));

    /* ---- root barrier solids (spliced out when cleansed) ---- */
    this.rootBarriers = [
      { x: 1740, y: 360, w: 36, h: 328, _rootId: 0 },
      { x: 2940, y: 340, w: 36, h: 358, _rootId: 1 },
      { x: 4000, y: 330, w: 36, h: 372, _rootId: 2 },
    ];
    /* root "node" hitboxes slightly wider for detection */
    this.rootNodes = this.rootBarriers.map((b) => ({
      x: b.x - 22, y: b.y, w: b.w + 44, h: b.h,
      cleansed: false,
      _rootId: b._rootId,
    }));

    const self = this;

    /* ---- level definition ---- */
    const level = {
      width: 4800,
      killY: 950,
      spawn: { x: 90, y: 570 },
      theme: {
        platform:     '#1a3a28',
        platformEdge: '#6fe6a0',
        accent:       '#9a6bff',
      },
      vignette:      0.62,
      vignetteColor: '#020e07',

      /* ==== SOLIDS ==== */
      solids: [
        /* --- opening grove --- */
        { x: -60,  y: 580, w: 520,  h: 180 },
        { x: 560,  y: 610, w: 280,  h: 150 },
        { x: 680,  y: 490, w: 120,  h: 16,  oneway: true },
        { x: 900,  y: 560, w: 320,  h: 170 },
        { x: 960,  y: 440, w: 140,  h: 16,  oneway: true },
        /* --- mid-forest (before barrier 0) --- */
        { x: 1280, y: 590, w: 380,  h: 160 },
        { x: 1380, y: 470, w: 120,  h: 16,  oneway: true },
        { x: 1500, y: 376, w: 90,   h: 16,  oneway: true },
        { x: 1580, y: 590, w: 124,  h: 160 },
        /* barrier 0 slot: x=1740 */
        { x: 1776, y: 590, w: 280,  h: 160 },
        { x: 1840, y: 460, w: 110,  h: 16,  oneway: true },
        /* --- dense canopy section --- */
        { x: 2100, y: 560, w: 340,  h: 180 },
        { x: 2200, y: 430, w: 100,  h: 16,  oneway: true },
        { x: 2320, y: 346, w: 130,  h: 16,  oneway: true },
        { x: 2500, y: 570, w: 404,  h: 170 },
        { x: 2590, y: 440, w: 100,  h: 16,  oneway: true },
        { x: 2720, y: 340, w: 80,   h: 16,  oneway: true },
        /* barrier 1 slot: x=2940 — ground above (#9) extended to 2904
           so the player can stand within melee reach of the root node,
           matching barriers 0 & 2 (~36px edge-to-face). */
        { x: 2976, y: 580, w: 300,  h: 160 },
        { x: 3060, y: 450, w: 110,  h: 16,  oneway: true },
        /* --- deep corrupted forest --- */
        { x: 3320, y: 550, w: 380,  h: 190 },
        { x: 3400, y: 410, w: 130,  h: 16,  oneway: true },
        { x: 3540, y: 306, w: 100,  h: 16,  oneway: true },
        { x: 3720, y: 560, w: 240,  h: 180 },
        { x: 3820, y: 420, w: 90,   h: 16,  oneway: true },
        /* barrier 2 slot: x=4000 */
        { x: 4036, y: 560, w: 420,  h: 180 },
        { x: 4120, y: 430, w: 130,  h: 16,  oneway: true },
        /* --- final clearing --- */
        { x: 4480, y: 560, w: 420,  h: 200 },
        { x: 4550, y: 416, w: 120,  h: 16,  oneway: true },
        /* inject barrier solids (spliced when cleansed) */
        self.rootBarriers[0],
        self.rootBarriers[1],
        self.rootBarriers[2],
      ],

      /* ==== HAZARDS ==== */
      hazards: [
        { x: 1686, y: 700, w: 50,  h: 28, dmg: 14 },
        { x: 2854, y: 702, w: 62,  h: 28, dmg: 14 },
        { x: 3652, y: 702, w: 56,  h: 28, dmg: 14 },
        { x: 3942, y: 702, w: 50,  h: 28, dmg: 14 },
      ],

      /* ==== ENEMIES ==== */
      enemies: [
        { kind: 'wisp', x: 1000, y: 460, opts: { tint: '#c9b3ff' } },
        { kind: 'wisp', x: 2160, y: 400, opts: { tint: '#c9b3ff' } },
        { kind: 'wisp', x: 2620, y: 360, opts: { tint: '#c9b3ff' } },
        { kind: 'wisp', x: 3380, y: 430, opts: { tint: '#c9b3ff' } },
        { kind: 'husk', x: 1840, y: 610, opts: { tint: '#9a6bff' } },
        { kind: 'husk', x: 3100, y: 600, opts: { tint: '#9a6bff' } },
      ],

      /* ==== PICKUPS: cleansing orbs (6 total — generous) ==== */
      pickups: [
        { x: 1330, y: 556, r: 14, kind: 'orb', color: '#6fe6a0', onCollect: () => self._collectOrb() },
        { x: 1430, y: 436, r: 14, kind: 'orb', color: '#6fe6a0', onCollect: () => self._collectOrb() },
        { x: 2260, y: 312, r: 14, kind: 'orb', color: '#6fe6a0', onCollect: () => self._collectOrb() },
        { x: 2640, y: 436, r: 14, kind: 'orb', color: '#6fe6a0', onCollect: () => self._collectOrb() },
        { x: 3460, y: 272, r: 14, kind: 'orb', color: '#6fe6a0', onCollect: () => self._collectOrb() },
        { x: 3860, y: 382, r: 14, kind: 'orb', color: '#6fe6a0', onCollect: () => self._collectOrb() },
      ],

      /* ==== CHECKPOINTS ==== */
      checkpoints: [
        { x: 1300, y: 590 },
        { x: 2550, y: 570 },
        { x: 3750, y: 560 },
      ],

      /* ==== TRIGGERS ==== */
      triggers: [
        /* Forest Spirit speaks near the start */
        {
          x: 440, y: 0, w: 80, h: 720, once: true,
          onEnter: () => {
            VEIL.dialogue.play(VEIL.story.act3Spirit, () => {
              e.state.abilities.dash = true;
              VEIL.ui.toast(VEIL.story.hints.dash, 4);
            });
          },
        },
        /* Puzzle hint near barrier 0 */
        {
          x: 1570, y: 0, w: 60, h: 720, once: true,
          onEnter: () => {
            VEIL.ui.toast('✦ Corrupted roots bar the way. Seek the glowing orbs, then strike the roots to cleanse them.', 5.2);
            e.audio.sfx('whisper');
          },
        },
        /* Hint near barrier 1 */
        {
          x: 2750, y: 0, w: 60, h: 720, once: true,
          onEnter: () => {
            VEIL.ui.toast('✦ Carry an orb and strike the root — the light will do the rest.', 4);
            e.audio.sfx('whisper');
          },
        },
      ],

      /* ==== LORE ==== */
      interactables: [
        { x: 300, y: 580, markY: 556, r: 70, label: 'Worn rune', color: '#9a6bff', once: true, keepMarker: true, sfx: 'fragment',
          onInteract: () => VEIL.story.revealEcho(VEIL.engine, 'roots') },
      ],

      /* ==== GOAL ==== */
      goal: {
        x: 4680,
        color: '#6fe6a0',
        onReach: () => self._finish(),
      },

      paintBg: (ctx, w, t) => self._bg(ctx, w, t),
      paintFg: (ctx, w, t) => self._fg(ctx, w, t),
    };

    this.pf     = new VEIL.Platformer(e, level);
    this.player = this.pf.player;
    this.compassAngle = 0;

    /* ---- puzzle: melee-strike hook ---- */
    this.pf.onPlayerStrike = (hb, dmg, player) => {
      for (const rn of this.rootNodes) {
        if (rn.cleansed) continue;
        if (U.aabb(hb, rn)) {
          this._cleanseRoot(rn);
          break;
        }
      }
    };
  }

  /* ----------------------------------------------------------
     EXIT
  ---------------------------------------------------------- */
  exit() { this.e.grade = null; }

  /* ----------------------------------------------------------
     UPDATE
  ---------------------------------------------------------- */
  update(dt) {
    this.t += dt;
    this.pf.update(dt);

    /* compass points toward goal */
    const dx = this.pf.goal.x - this.player.cx;
    this.compassAngle = U.lerp(this.compassAngle, Math.atan2(-0.18, dx), dt * 4);

    /* drift spores */
    const camX = this.pf.camera.x;
    for (const s of this.spores) {
      s.x += s.vx * dt;
      s.y += Math.sin(this.t * s.speed + s.ph) * 14 * dt;
      if (s.x < camX - 80)         s.x = camX + this.e.W + 40;
      if (s.x > camX + this.e.W + 80) s.x = camX - 40;
      if (s.y < -20)                s.y = 720;
      if (s.y > 740)                s.y = 0;
    }
  }

  /* ----------------------------------------------------------
     DRAW (delegates to platformer)
  ---------------------------------------------------------- */
  draw(ctx) { this.pf.draw(ctx); }

  onKey(ev) {}

  /* ----------------------------------------------------------
     PUZZLE: collect orb
  ---------------------------------------------------------- */
  _collectOrb() {
    this.orbsCollected++;
    this.e.audio.sfx('pickup');
    VEIL.ui.toast('✦ Cleansing orb — (' + this.orbsCollected + ' held)', 2.2);
  }

  /* ----------------------------------------------------------
     PUZZLE: cleanse root barrier
  ---------------------------------------------------------- */
  _cleanseRoot(rn) {
    if (rn.cleansed) return;
    /* consume one orb if held; cleanse always succeeds so level stays completable */
    if (this.orbsCollected > 0) this.orbsCollected--;
    rn.cleansed = true;
    this.rootsCleansed++;

    /* splice the solid barrier out so the player can pass */
    const idx = this.pf.solids.findIndex((s) => s._rootId === rn._rootId);
    if (idx !== -1) this.pf.solids.splice(idx, 1);

    /* green burst */
    const bx = rn.x + rn.w / 2;
    const by = rn.y + rn.h / 2;
    this.pf.particles.burst(bx, by, 30, {
      color: '#6fe6a0', color2: '#c9b3ff',
      spdMax: 330, lifeMax: 0.9, rMax: 8,
    });
    this.e.audio.sfx('fragment');
    this.e.camera.shake(0.28);

    if (this.rootsCleansed >= this.ROOTS_NEEDED && !this.rootsOpen) {
      this.rootsOpen = true;
      VEIL.ui.toast('✦ The roots dissolve. The path opens…', 4.5);
      this.e.audio.sfx('ability');
    } else {
      VEIL.ui.toast('✦ Root cleansed! (' + this.rootsCleansed + ' / ' + this.ROOTS_NEEDED + ')', 2.6);
    }
  }

  /* ----------------------------------------------------------
     FINISH — play cleansed dialogue then complete realm
  ---------------------------------------------------------- */
  _finish() {
    this.pf.frozenInput = true;
    this.player.vx      = 0;
    VEIL.dialogue.play(VEIL.story.act3Cleansed, () => {
      VEIL.completeRealm(null, 'dash', null, 'act4_earth');
    });
  }

  /* ==========================================================
     BACKGROUND — painterly bioluminescent forest (parallax)
  ========================================================== */
  _bg(ctx, world, t) {
    const { W, H } = this.e;
    const camX     = world.camera.x;

    /* --- sky: deep teal-black canopy zenith to forest-floor glow --- */
    draw.vGrad(ctx, 0, 0, W, H, [
      [0,    '#020e07'],
      [0.28, '#061a0f'],
      [0.55, '#0c2a18'],
      [0.80, '#113320'],
      [1,    '#071209'],
    ]);

    /* --- spirit moon (green-white) --- */
    const moonX = W * 0.63 - camX * 0.02;
    draw.glow(ctx, moonX, H * 0.10, 280, '#a0f8c0', 0.13);
    draw.glow(ctx, moonX, H * 0.10, 110, '#d4fff0', 0.22);
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle   = '#cfffea';
    ctx.beginPath(); ctx.arc(moonX, H * 0.10, 22, 0, U.TAU); ctx.fill();
    ctx.restore();

    /* --- corruption moon (violet, far corner) --- */
    const vmoonX = W * 0.21 - camX * 0.03;
    draw.glow(ctx, vmoonX, H * 0.14, 190, '#9a6bff', 0.09);
    draw.glow(ctx, vmoonX, H * 0.14, 70,  '#c9b3ff', 0.16);

    /* --- god-rays through canopy (additive) --- */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
      const rng  = U.seed(42 + i);
      const rx   = (rng() * 0.88 + 0.06) * W - (camX * (0.04 + rng() * 0.06));
      const topA = 0.05 + rng() * 0.06;
      const wid  = 20 + rng() * 42;
      const sway = Math.sin(t * 0.17 + i * 1.3) * 9;
      const rayCol = i % 3 === 0 ? '#0e4a2a' : (i % 3 === 1 ? '#163d22' : '#1a4f2e');
      const g = ctx.createLinearGradient(rx + sway, 0, rx, H);
      g.addColorStop(0,   U.rgba(rayCol, topA));
      g.addColorStop(0.55, U.rgba(rayCol, topA * 0.45));
      g.addColorStop(1,   U.rgba(rayCol, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(rx - wid * 0.5 + sway, 0);
      ctx.lineTo(rx + wid * 0.5 + sway, 0);
      ctx.lineTo(rx + wid * 1.5,        H);
      ctx.lineTo(rx - wid * 1.5,        H);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    /* --- distant tree silhouettes, 3 depth layers --- */
    this._treeLine(ctx, camX * 0.07, H * 0.56, 230, 95,  '#061409', 17);
    draw.mist(ctx, H * 0.48, 90,  '#0a2414', t,      0.11);
    this._treeLine(ctx, camX * 0.16, H * 0.65, 185, 72,  '#0a1e10', 31);
    draw.mist(ctx, H * 0.60, 110, '#0e2c1a', t + 4, 0.13);
    this._treeLine(ctx, camX * 0.30, H * 0.74, 155, 56,  '#0e2418', 53);
    draw.mist(ctx, H * 0.70, 120, '#102c1c', t + 8, 0.14);

    /* --- glowing root network (decorative, behind platforms) --- */
    this._drawBgRoots(ctx, camX, t, W, H);

    /* --- bioluminescent bloom pools on forest floor --- */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const pools = [
      { px: 0.12, col: '#1a6636', r: 160 },
      { px: 0.37, col: '#1a3366', r: 140 },
      { px: 0.60, col: '#1a5533', r: 130 },
      { px: 0.82, col: '#331a66', r: 120 },
    ];
    for (const p of pools) {
      const bx  = p.px * W - camX * 0.18;
      const pul = 0.03 * Math.sin(t * 0.8 + p.px * 10);
      draw.glow(ctx, bx, H * 0.88, p.r * (1 + pul), p.col, 0.18 + pul);
    }
    ctx.restore();
  }

  /* --- distant tree silhouette strip --- */
  _treeLine(ctx, off, baseY, maxH, variation, color, seed) {
    const { W, H } = this.e;
    const rng = U.seed(seed);
    ctx.save();
    ctx.translate(-(off % 520), 0);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-60, H);
    let x = -60;
    while (x < W + 640) {
      const tW     = 14 + rng() * 22;
      const tH     = maxH * (0.38 + rng() * 0.62);
      const ty     = baseY - tH;
      const crownW = 20 + rng() * 40;
      ctx.lineTo(x, baseY);
      ctx.lineTo(x, ty + tH * 0.35);
      ctx.quadraticCurveTo(
        x - crownW * 0.6, ty - variation * rng(),
        x + crownW * 0.5, ty,
      );
      ctx.quadraticCurveTo(
        x + crownW * 1.0, ty - variation * rng() * 0.5,
        x + crownW * 0.5 + tW, ty + tH * 0.3,
      );
      ctx.lineTo(x + crownW + tW, baseY);
      x += crownW + tW + rng() * 32;
    }
    ctx.lineTo(W + 640, H);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /* --- glowing root tangle (background decorative strokes) --- */
  _drawBgRoots(ctx, camX, t, W, H) {
    const rng = U.seed(77);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 14; i++) {
      const rx  = rng() * (W + 400) - 200 - (camX * 0.22 % (W + 400));
      const ry  = H * (0.64 + rng() * 0.28);
      const len = 80 + rng() * 160;
      const ang = (rng() - 0.5) * 1.2;
      const col = U.chance(0.55) ? '#1a6636' : '#3d1a66';
      const pul = 0.07 + 0.04 * Math.sin(t * 1.1 + i * 0.7);
      ctx.strokeStyle = U.rgba(col, pul);
      ctx.lineWidth   = 1.2 + rng() * 2.4;
      ctx.shadowColor = col;
      ctx.shadowBlur  = 10;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.quadraticCurveTo(
        rx + Math.cos(ang) * len * 0.5 + rng() * 44 - 22,
        ry + rng() * 28 - 40,
        rx + Math.cos(ang) * len,
        ry + Math.sin(ang) * len * 0.4,
      );
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  /* ==========================================================
     FOREGROUND — spores, root barriers, canopy fringe, grain
  ========================================================== */
  _fg(ctx, world, t) {
    const { W, H } = this.e;
    const camX     = world.camera.x;
    const camY     = world.camera.y;

    /* --- root barrier overlays (screen-space, world-aligned) --- */
    this._drawRootBarriers(ctx, camX, camY, t);

    /* --- spores / fireflies (screen-space additive) --- */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const s of this.spores) {
      const sx = s.x - camX;
      if (sx < -20 || sx > W + 20) continue;
      const pulse = (Math.sin(t * s.speed * 2.2 + s.ph) + 1) * 0.5;
      const a     = 0.22 + pulse * 0.58;
      const r     = s.r * (0.7 + pulse * 0.42);
      draw.glow(ctx, sx, s.y, r * 3.8, s.col, a * 0.5);
      ctx.globalAlpha = a * 0.9;
      ctx.fillStyle   = s.col;
      ctx.beginPath();
      ctx.arc(sx, s.y, r * 0.6, 0, U.TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    /* --- ground mist (two tones) --- */
    draw.mist(ctx, H * 0.80, 130, '#0e3320', t,     0.18);
    draw.mist(ctx, H * 0.88, 100, '#1a0a33', t + 6, 0.12);

    /* --- dark canopy fringe overlaid at top --- */
    this._drawCanopyFringe(ctx, camX, t, W);

    /* --- film grain --- */
    draw.grain(ctx, 0.033);
  }

  /* --- Animated violet root barriers drawn in screen-space --- */
  _drawRootBarriers(ctx, camX, camY, t) {
    for (const rn of this.rootNodes) {
      if (rn.cleansed) continue;
      const sx = rn.x - camX;
      const sy = rn.y - camY;
      if (sx + rn.w < -10 || sx > this.e.W + 10) continue;

      ctx.save();

      /* pulsing outer glow */
      const pulse = 0.52 + 0.24 * Math.sin(t * 2.4 + rn._rootId * 1.1);
      draw.glow(ctx, sx + rn.w / 2, sy + rn.h / 2, rn.w * 2.8, '#9a6bff', pulse * 0.55);

      /* woven root strands */
      const segs = 7;
      for (let i = 0; i < segs; i++) {
        const rng = U.seed(rn._rootId * 100 + i);
        const fy  = sy + (i / (segs - 1)) * rn.h;
        const cx1 = sx + rn.w * 0.5 + (rng() - 0.5) * rn.w * 1.7;
        const cx2 = sx + rn.w * 0.5 + (rng() - 0.5) * rn.w * 1.7;
        const col = U.chance(0.6) ? '#9a6bff' : '#c9b3ff';
        ctx.strokeStyle = U.rgba(col, 0.72 + 0.22 * Math.sin(t * 3 + i));
        ctx.lineWidth   = 1.5 + rng() * 3;
        ctx.shadowColor = '#9a6bff';
        ctx.shadowBlur  = 8;
        ctx.beginPath();
        ctx.moveTo(sx, fy);
        ctx.bezierCurveTo(
          cx1, fy - 28 * rng(),
          cx2, fy + 28 * rng(),
          sx + rn.w, fy + (rng() - 0.5) * 30,
        );
        ctx.stroke();
      }

      /* serpentine core vine */
      const cg = ctx.createLinearGradient(sx + rn.w / 2, sy, sx + rn.w / 2, sy + rn.h);
      cg.addColorStop(0,   U.rgba('#9a6bff', 0.2));
      cg.addColorStop(0.5, U.rgba('#c9b3ff', 0.65));
      cg.addColorStop(1,   U.rgba('#9a6bff', 0.2));
      ctx.strokeStyle = cg;
      ctx.lineWidth   = 5;
      ctx.shadowBlur  = 18;
      ctx.beginPath();
      ctx.moveTo(sx + rn.w / 2, sy);
      for (let j = 0; j <= 9; j++) {
        const jy = sy + (j / 9) * rn.h;
        const jx = sx + rn.w / 2 + Math.sin(t * 1.6 + j * 0.9 + rn._rootId * 2) * 8;
        ctx.lineTo(jx, jy);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      /* interaction prompt when player carries orbs */
      if (this.orbsCollected > 0) {
        draw.text(ctx, '[ Attack to Cleanse ]', sx + rn.w / 2, sy - 20, {
          size: 11, color: '#c9b3ff', font: 'Spectral, serif',
          alpha: 0.48 + 0.42 * Math.sin(t * 3),
          glow: '#9a6bff', blur: 8,
        });
      }

      ctx.restore();
    }
  }

  /* --- dark canopy silhouette across top of screen --- */
  _drawCanopyFringe(ctx, camX, t, W) {
    const rng = U.seed(11);
    ctx.save();
    ctx.fillStyle = '#020a05';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    let cx2 = 0;
    while (cx2 < W + 100) {
      const leafW = 38 + rng() * 82;
      const leafH = 38 + rng() * 92;
      const sway  = Math.sin(t * 0.28 + cx2 * 0.005) * 5;
      ctx.lineTo(cx2 + sway, 0);
      ctx.quadraticCurveTo(cx2 + leafW * 0.5 + sway, leafH, cx2 + leafW + sway, 0);
      cx2 += leafW;
    }
    ctx.lineTo(W + 100, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

};

})();

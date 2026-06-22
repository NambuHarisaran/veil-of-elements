/* ============================================================
   ACT VII — AIR REALM, "The Weightless Path"
   Floating stone ruins above a sea of clouds. Serene, sunlit,
   the airiest realm of all. PRECISION PLATFORMING + GLIDE:
   wide gaps the player can only cross by holding Jump to glide,
   horizontal WIND-GUST zones that steer the glide, one-way
   cloud-ledges, and lots of verticality.
   Traverse the path → open sky arena → BOSS: The Tempest (flying).
   Guardian Aelra speaks; reward: Sky Bow (Glide) + "Freedom needs grounding."
   Palette: pastel sky blues / peach / white · gold (#f4c560) vs violet (#9a6bff).
   ============================================================ */
(function () {
"use strict";
const VEIL = window.VEIL;
const U = VEIL.U, draw = VEIL.draw;

const ARENA_X = 4980;     // centre of the boss arena (in the air)
const ARENA_FLOOR = 470;  // y of the arena landing platform top
const ARENA_AIR = 250;    // y the flying boss hovers around
const GOAL_X = 5400;

// horizontal wind-gust regions. dir: +1 pushes right, -1 pushes left.
// force is added to player.vx over time when the player's centre is inside.
const GUSTS = [
  { x: 1180, y: 120, w: 520, h: 560, dir: 1, force: 560 },   // helps clear the first big glide gap
  { x: 2360, y: 80,  w: 560, h: 600, dir: -1, force: 600 },  // headwind: must steer into it
  { x: 3360, y: 100, w: 600, h: 560, dir: 1, force: 640 },   // crosswind over a deep chasm
  { x: 4360, y: 60,  w: 520, h: 640, dir: -1, force: 520 },  // approach to the arena
];

VEIL.scenes['act7_air'] = class AirScene {
  enter(e) {
    this.e = e; this.t = 0; this.hud = true; this.canPause = true;
    e.audio.resume();
    const r = VEIL.story.realms.air;
    e.audio.music(r.music);
    e.grade = { color: '#bcd6ff', amount: 0.10 };
    VEIL.ui.banner(r.kicker, r.title, r.sub);

    this.bossStarted = false;
    this.windPhase = 0;

    // --- atmosphere: drifting feathers (world-space) ---
    this.feathers = Array.from({ length: 46 }, () => ({
      x: U.rand(0, 5600), y: U.rand(0, 720),
      vx: U.rand(8, 34), vy: U.rand(8, 26),
      r: U.rand(3, 7), ph: U.rand(0, 10), spin: U.rand(-1.2, 1.2),
      rot: U.rand(0, 6.28), gold: U.chance(0.22),
    }));
    // tiny glints / pollen of light high in the air
    this.glints = Array.from({ length: 70 }, () => ({
      x: U.rand(0, 5600), y: U.rand(0, 640),
      vx: U.rand(4, 18), ph: U.rand(0, 10), r: U.rand(0.6, 2.0), gold: U.chance(0.3),
    }));
    // parallax cloud puffs (each layer drawn from these, scaled by depth)
    this.clouds = Array.from({ length: 26 }, (_, i) => ({
      x: U.rand(0, 1600), y: U.rand(0, 720),
      s: U.rand(0.6, 1.6), ph: U.rand(0, 10), seed: 100 + i * 7,
    }));

    const T = { platform: '#5a6a86', platformEdge: '#cfe8ff', accent: '#9a6bff' };
    const self = this;

    const level = {
      width: 5600, killY: 1000, spawn: { x: 80, y: 600 }, theme: T,
      vignette: 0.42, vignetteColor: '#1a2438',
      solids: [
        // ---- opening terrace (safe footing, learn the controls) ----
        { x: -40, y: 600, w: 540, h: 220 },
        { x: 360, y: 488, w: 140, h: 14, oneway: true },     // a cloud-step up
        { x: 640, y: 560, w: 300, h: 260 },                  // (widened: keeps first glide gap ~240px, clearable)
        // -- FIRST BIG GAP (requires glide; tailwind gust helps) --
        { x: 1180, y: 540, w: 150, h: 280 },                 // small landing isle
        { x: 1120, y: 430, w: 110, h: 14, oneway: true },
        { x: 1460, y: 500, w: 130, h: 320 },
        // staircase of small floating isles climbing up-right
        { x: 1700, y: 430, w: 120, h: 360 },
        { x: 1900, y: 360, w: 110, h: 14, oneway: true },
        { x: 2060, y: 470, w: 130, h: 340 },
        { x: 2240, y: 392, w: 110, h: 14, oneway: true },
        // -- HEADWIND SPAN: glide left-to-right against a leftward gust --
        { x: 2360, y: 560, w: 190, h: 260 },                 // (widened: headwind launch gap now ~150px, clearable into the wind)
        { x: 2700, y: 470, w: 130, h: 340 },                 // checkpoint isle
        { x: 2900, y: 360, w: 110, h: 14, oneway: true },
        // tall ruin pillar climb (verticality)
        { x: 3100, y: 540, w: 150, h: 280 },
        { x: 3060, y: 420, w: 120, h: 14, oneway: true },
        { x: 3240, y: 320, w: 120, h: 14, oneway: true },
        { x: 3100, y: 230, w: 140, h: 14, oneway: true },
        // -- CROSSWIND CHASM: long glide right, crosswind nudges you on --
        { x: 3360, y: 250, w: 120, h: 18 },                  // high launch ledge
        { x: 3720, y: 360, w: 120, h: 460 },                 // mid catch isle
        { x: 3960, y: 300, w: 110, h: 14, oneway: true },
        { x: 4120, y: 440, w: 140, h: 380 },                 // checkpoint isle
        // -- APPROACH descent toward arena (gentle steps + a glide-down) --
        { x: 4360, y: 380, w: 130, h: 18 },
        { x: 4560, y: 470, w: 130, h: 14, oneway: true },
        { x: 4720, y: 540, w: 150, h: 280 },
        // ---- BOSS ARENA: a broad open sky platform ----
        { x: 4880, y: ARENA_FLOOR, w: 540, h: 350 },
        // two small floating cover ledges to glide between during the fight
        { x: 4980, y: 350, w: 100, h: 14, oneway: true },
        { x: 5240, y: 350, w: 100, h: 14, oneway: true },
        // goal pedestal lip past the arena
        { x: 5380, y: ARENA_FLOOR, w: 140, h: 350 },
      ],
      hazards: [
        // a couple of wind-shorn spire tips that punish a clipped jump
        { x: 2640, y: 452, w: 50, h: 18, dmg: 14 },
        { x: 3960, y: 282, w: 50, h: 18, dmg: 14 },
      ],
      checkpoints: [
        { x: 1180, y: 540 },
        { x: 2700, y: 470 },
        { x: 4120, y: 440 },   // just before the arena approach
      ],
      enemies: [
        { kind: 'wisp', x: 1520, y: 360, opts: { tint: '#cfe8ff', color: '#7fa0d0' } },
        { kind: 'wisp', x: 2120, y: 300, opts: { tint: '#cfe8ff', color: '#7fa0d0' } },
        { kind: 'wisp', x: 3180, y: 200, opts: { tint: '#cfe8ff', color: '#7fa0d0' } },
        { kind: 'wisp', x: 3820, y: 240, opts: { tint: '#cfe8ff', color: '#7fa0d0' } },
        { kind: 'wisp', x: 4180, y: 320, opts: { tint: '#cfe8ff', color: '#7fa0d0' } },
      ],
      triggers: [
        // intro (fires once the player takes a step) → grant glide
        { x: 90, y: 0, w: 80, h: 720, once: true, onEnter: () => self._intro() },
        // lore whispers on the wind
        { x: 1700, y: 0, w: 50, h: 720, once: true, onEnter: () => self._whisper(0) },
        { x: 3100, y: 0, w: 50, h: 720, once: true, onEnter: () => self._whisper(1) },
        { x: 4120, y: 0, w: 50, h: 720, once: true, onEnter: () => self._whisper(2) },
        // arena seal — start the boss
        { x: 4900, y: 0, w: 60, h: 720, once: true, onEnter: () => self._startBoss() },
      ],
      goal: { x: GOAL_X, y: 0, color: '#f4c560', onReach: () => {} },
      paintBg: (ctx, w, t) => self._bg(ctx, w, t),
      paintMid: (ctx, w, t) => self._mid(ctx, w, t),
      paintProps: (ctx, w, t) => self._props(ctx, w, t),
      paintFg: (ctx, w, t) => self._fg(ctx, w, t),
    };

    this.pf = new VEIL.Platformer(e, level);
    this.player = this.pf.player;
    this.compassAngle = 0;
    this.pf.onBossKilled = () => self._win();

    // build (but do not begin) the flying boss, hovering in the air
    this.boss = this.pf.addBoss(ARENA_X, ARENA_AIR, this._bossCfg());
  }
  exit() { this.e.grade = null; }

  // ---------------------------------------------------------
  // story beats
  // ---------------------------------------------------------
  _intro() {
    VEIL.dialogue.play(VEIL.story.act7Intro, () => {
      this.e.state.abilities.glide = true;
      VEIL.ui.toast('Sky Bow — Glide: hold Jump while falling', 5);
      this.e.audio.sfx('ability');
    });
  }
  _whisper(i) {
    const lines = [
      'The wind carries no grudges — only those who fight it fall.',
      'A ruin floats because it let go of the ground.',
      'Soar, but remember where the earth keeps your name.',
    ];
    VEIL.ui.toast('✦ ' + lines[i % lines.length], 4.5);
    this.e.audio.sfx('whisper');
  }
  _startBoss() {
    if (this.bossStarted || !this.boss) return;
    this.bossStarted = true;
    this.boss.begin();
    this.e.camera.shake(0.4);
    VEIL.ui.banner('Guardian', 'The Tempest', 'The Weightless Path');
    VEIL.ui.toast('Glide between the ledges — strike when the storm settles', 5);
  }
  _win() {
    this.player.vx = 0;
    this.e.camera.shake(0.6);
    VEIL.dialogue.play(VEIL.story.act7Win, () => {
      VEIL.completeRealm('air', null, 'air', 'act8_return');
    });
  }

  // ---------------------------------------------------------
  // BOSS DEFINITION — The Tempest (flying, no gravity)
  // ---------------------------------------------------------
  _bossCfg() {
    const self = this;
    return {
      name: 'The Tempest', title: 'The Weightless Path',
      hp: 340, color: '#8aa0bf', tint: '#cfe8ff', style: 'tempest',
      w: 70, h: 70, phases: 2, cdMin: 0.7, cdMax: 1.4,
      onPhase: (b, phase) => {
        b.world.camera.shake(0.6);
        VEIL.ui.toast(phase >= 2 ? '✦ The Tempest descends — it dives now!' : '✦ The wind howls!', 3);
        b.cfg.cdMin = Math.max(0.5, 0.7 - (phase - 1) * 0.15);
        b.cfg.cdMax = Math.max(0.9, 1.4 - (phase - 1) * 0.3);
      },
      attacks: [
        this._atkWindBlast(),
        this._atkFeatherVolley(),
        this._atkDive(),
      ],
      drawBody: (b, ctx, cx, cy, flashing) => self._drawTempest(b, ctx, cx, cy, flashing),
    };
  }

  // keep the flying boss inside the arena column at all times
  _clampBoss(b) {
    const minX = 4860, maxX = 5340;
    const minY = 120, maxY = 360;
    if (b.x < minX) { b.x = minX; if (b.vx < 0) b.vx = 0; }
    if (b.x + b.w > maxX) { b.x = maxX - b.w; if (b.vx > 0) b.vx = 0; }
    if (b.y < minY) { b.y = minY; if (b.vy < 0) b.vy = 0; }
    if (b.y > maxY) { b.y = maxY; if (b.vy > 0) b.vy = 0; }
  }

  // 1) WIND BLAST — telegraph, then a strong push that shoves the player
  //    away from the boss + a few feather projectiles.
  _atkWindBlast() {
    const self = this;
    return {
      name: 'blast', tele: 0.85, dur: 0.4, rec: 0.8, vuln: 1.4, minPhase: 0,
      onStart(b) { b.data.blown = false; },
      telegraph(b, dt) {
        // gather: drift toward the player's height, suck particles inward
        const p = b.world.player;
        b.vx = U.approach(b.vx, 0, 300 * dt);
        b.vy = U.approach(b.vy, U.sign((p.cy - 60) - (b.y + b.h / 2)) * 90, 260 * dt);
        self._clampBoss(b);
        if (U.chance(0.7)) {
          const a = U.rand(0, U.TAU), rr = U.rand(80, 150);
          b.world.particles.emit({
            x: b.x + b.w / 2 + Math.cos(a) * rr, y: b.y + b.h / 2 + Math.sin(a) * rr,
            vx: -Math.cos(a) * 260, vy: -Math.sin(a) * 260, life: 0.5, r: 4,
            color: '#cfe8ff', color2: '#9a6bff',
          });
        }
      },
      run(b, dt) {
        if (b.data.blown) return;
        b.data.blown = true;
        b.e.audio.sfx('ability');
        b.world.camera.shake(0.5);
        const p = b.world.player;
        const dir = U.sign(p.cx - (b.x + b.w / 2)) || 1;
        // STRONG push added to player.vx, away from the boss
        p.vx += dir * 760; p.vy -= 140;
        // visible gust cone + a fan of feathers riding the blast
        b.world.particles.burst(b.x + b.w / 2, b.y + b.h / 2, 30, {
          color: '#cfe8ff', color2: '#9a6bff', ang: dir > 0 ? 0 : Math.PI,
          spread: 0.7, spdMax: 560, lifeMax: 0.8, rMax: 7,
        });
        for (let i = -2; i <= 2; i++) {
          b.shoot({
            x: b.x + b.w / 2, y: b.y + b.h / 2,
            vx: dir * 300, vy: i * 80, dmg: 12, color: '#cfe8ff', r: 9, life: 2.4,
          });
        }
      },
    };
  }

  // 2) FEATHER VOLLEY — a fan of homing-ish feather projectiles.
  _atkFeatherVolley() {
    const self = this;
    return {
      name: 'volley', tele: 0.6, dur: 0.5, rec: 0.7, vuln: 0, minPhase: 0,
      onStart(b) { b.data.fired = 0; b.data.shots = 5 + b.phase; },
      telegraph(b, dt) {
        // hover and circle a little while charging quills above
        b.vx = U.approach(b.vx, Math.sin(b.anim * 2) * 60, 300 * dt);
        b.vy = U.approach(b.vy, -40, 240 * dt);
        self._clampBoss(b);
        if (U.chance(0.5)) b.world.particles.emit({
          x: b.x + b.w / 2 + U.rand(-30, 30), y: b.y - 8 + U.rand(-10, 10),
          vx: U.rand(-30, 30), vy: U.rand(-40, -10), life: 0.4, r: 4, color: '#cfe8ff',
        });
      },
      run(b, dt) {
        const step = 0.5 / b.data.shots;
        const want = Math.min(b.data.shots, Math.floor(b.t / step) + 1);
        const p = b.world.player;
        while (b.data.fired < want) {
          const i = b.data.fired++;
          const base = Math.atan2(p.cy - (b.y + b.h / 2), p.cx - (b.x + b.w / 2));
          const spread = (i - (b.data.shots - 1) / 2) * 0.22;
          const a = base + spread;
          const spd = 320;
          b.shoot({
            x: b.x + b.w / 2, y: b.y + b.h / 2,
            vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
            dmg: 11, color: '#cfe8ff', r: 8, life: 3, homing: 0.6,
          });
          b.e.audio.sfx('attack');
        }
        self._clampBoss(b);
      },
    };
  }

  // 3) DIVE — (phase 2) swoop along a path through the player's position.
  _atkDive() {
    const self = this;
    return {
      name: 'dive', tele: 0.75, dur: 0.9, rec: 1.0, vuln: 1.2, minPhase: 2,
      onStart(b) {
        const p = b.world.player;
        // lock a dive target through the player's current spot
        b.data.tx = U.clamp(p.cx, 4900, 5300);
        b.data.ty = U.clamp(p.cy, 160, 420);
        b.data.hit = false;
        b.face = U.sign(b.data.tx - (b.x + b.w / 2)) || b.face;
      },
      telegraph(b, dt) {
        // rear up high and back, away from the dive target (clear tell)
        const cx0 = b.x + b.w / 2, cy0 = b.y + b.h / 2;
        b.vx = U.approach(b.vx, -b.face * 160, 600 * dt);
        b.vy = U.approach(b.vy, -200, 700 * dt);
        self._clampBoss(b);
        if (U.chance(0.8)) b.world.particles.emit({
          x: cx0 + U.rand(-20, 20), y: cy0 + U.rand(-20, 20),
          vx: U.rand(-60, 60), vy: U.rand(-60, 60), life: 0.4, r: 4,
          color: '#9a6bff', color2: '#cfe8ff',
        });
      },
      run(b, dt) {
        // accelerate hard toward the locked target, then through it
        const cx0 = b.x + b.w / 2, cy0 = b.y + b.h / 2;
        const dx = b.data.tx - cx0, dy = b.data.ty - cy0;
        const d = Math.hypot(dx, dy) || 1;
        const spd = 900;
        b.vx = U.lerp(b.vx, (dx / d) * spd, 8 * dt);
        b.vy = U.lerp(b.vy, (dy / d) * spd, 8 * dt);
        // contact hitbox during the swoop
        if (!b.data.hit) {
          const before = b.world.player.iframe;
          b.hitPlayer({ x: b.x + 6, y: b.y + 6, w: b.w - 12, h: b.h - 12 }, 18);
          if (b.world.player.iframe > before) { b.data.hit = true; b.world.camera.shake(0.4); }
        }
        // wind trail
        if (U.chance(0.9)) b.world.particles.emit({
          x: cx0, y: cy0, vx: -b.vx * 0.3, vy: -b.vy * 0.3, life: 0.4, r: 6,
          color: '#cfe8ff', color2: '#9a6bff',
        });
        b.world.camera.shake(0.06);
        self._clampBoss(b);
      },
    };
  }

  // procedural body: a swirling wind vortex with a bright calm eye
  _drawTempest(b, ctx, cx, cy, flashing) {
    const r = b.w * 0.6;
    ctx.save();
    ctx.translate(cx, cy);
    // outer swirling bands of wind (rotating arcs)
    ctx.globalCompositeOperation = 'lighter';
    const spin = b.anim * 2.2;
    for (let i = 0; i < 4; i++) {
      const rr = r * (0.7 + i * 0.28);
      const a0 = spin + i * 1.3;
      ctx.strokeStyle = U.rgba(i % 2 ? '#cfe8ff' : '#9a6bff', 0.42 - i * 0.07);
      ctx.lineWidth = 7 - i;
      ctx.shadowColor = i % 2 ? '#cfe8ff' : '#9a6bff'; ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(0, 0, rr, a0, a0 + Math.PI * 1.25);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'source-over';
    // body core
    const col = flashing ? '#ffffff' : (b.vulnerable ? '#f4c560' : b.color);
    const grd = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 0.8);
    grd.addColorStop(0, '#ffffff');
    grd.addColorStop(0.5, col);
    grd.addColorStop(1, U.rgba(col, 0));
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, U.TAU); ctx.fill();
    // calm eye
    const eyeCol = b.vulnerable ? '#f4c560' : '#cfe8ff';
    draw.glow(ctx, 0, 0, 18, eyeCol, 0.9);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, U.TAU); ctx.fill();
    // two glowing eyes that track the player
    ctx.fillStyle = '#f4c560'; ctx.shadowColor = '#f4c560'; ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(b.face * 8 - 6, -4, 2.6, 0, U.TAU);
    ctx.arc(b.face * 8 + 6, -4, 2.6, 0, U.TAU);
    ctx.fill(); ctx.shadowBlur = 0;
    ctx.restore();
  }

  // ---------------------------------------------------------
  // loop
  // ---------------------------------------------------------
  update(dt) {
    this.t += dt;
    this.windPhase += dt;
    this.pf.update(dt);

    // --- WIND GUST ZONES: push the player when inside a gust rect ---
    const p = this.player;
    if (!p.dead) {
      for (const g of GUSTS) {
        if (p.cx >= g.x && p.cx <= g.x + g.w && p.cy >= g.y && p.cy <= g.y + g.h) {
          // gentle pulse so gusts breathe; never quite zero so they read clearly
          const pulse = 0.7 + 0.3 * Math.sin(this.windPhase * 1.3 + g.x * 0.01);
          p.vx += g.dir * g.force * pulse * dt;
        }
      }
    }

    // compass points toward the arena, then the goal
    const target = this.bossStarted ? GOAL_X : ARENA_X;
    const dx = target - p.cx;
    this.compassAngle = U.lerp(this.compassAngle, Math.atan2(-0.18, dx), dt * 4);

    // feathers + glints drift (carried gently rightward by the prevailing wind)
    const camx = this.pf.camera.x;
    for (const f of this.feathers) {
      f.x += f.vx * dt; f.y += f.vy * dt + Math.sin(this.t * 0.6 + f.ph) * 6 * dt;
      f.rot += f.spin * dt;
      if (f.x > camx + this.e.W + 60) f.x = camx - 60;
      if (f.y > 760) { f.y = -20; f.x = camx + U.rand(0, this.e.W); }
    }
    for (const g of this.glints) {
      g.x += g.vx * dt;
      if (g.x > camx + this.e.W + 40) g.x = camx - 40;
    }
    for (const c of this.clouds) { c.x += (8 + c.s * 6) * dt; if (c.x > 1700) c.x -= 1700 + U.rand(0, 200); }
  }
  draw(ctx) { this.pf.draw(ctx); }

  // =========================================================
  // PARALLAX BACKDROP — the "stunning" part.
  // Floating sky islands above a sea of clouds: layered cloud
  // banks, distant floating ruins, a soft sun, drifting feathers.
  // =========================================================
  _bg(ctx, w, t) {
    const { W, H } = this.e; const cam = w.camera;

    // sky: high-altitude pastel — pale cyan up top into warm peach near the cloud sea
    draw.vGrad(ctx, 0, 0, W, H, [
      [0, '#7fb4e6'], [0.34, '#aed3f2'], [0.6, '#dcebf7'],
      [0.82, '#fbe6d4'], [1, '#f7d3b8'],
    ]);

    // soft high sun, very slow parallax, with a warm gold bloom
    const sx = W * 0.74 - cam.x * 0.015, sy = H * 0.24;
    draw.glow(ctx, sx, sy, 420, '#fff4dc', 0.5);
    draw.glow(ctx, sx, sy, 170, '#ffe6b0', 0.7);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = U.rgba('#fff7e6', 0.95);
    ctx.beginPath(); ctx.arc(sx, sy, 40, 0, U.TAU); ctx.fill();
    ctx.restore();

    // ---- far floating islands (tiny silhouettes, drifting clouds beneath) ----
    this._farIslands(ctx, cam.x * 0.05, H * 0.34, 18, 0.5);
    // ---- distant cloud bank (slow) ----
    this._cloudBank(ctx, cam.x * 0.07, H * 0.40, 1.7, '#eef6ff', 0.55, 11);
    // ---- mid floating ruins (bigger, with sky-bridges) ----
    this._farIslands(ctx, cam.x * 0.14, H * 0.50, 30, 0.8);
    // ---- mid cloud bank ----
    this._cloudBank(ctx, cam.x * 0.20, H * 0.58, 2.4, '#ffffff', 0.7, 27);
    // ---- distant violet storm seed swirling far off (where the Tempest waits) ----
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    draw.glow(ctx, W * 0.86 - cam.x * 0.11, H * 0.34, 130, '#9a6bff', 0.14);
    draw.glow(ctx, W * 0.20 - cam.x * 0.09, H * 0.30, 90, '#cfe8ff', 0.16);
    ctx.restore();
    // ---- near cloud sea (the bottom horizon of cloud, faster) ----
    this._cloudBank(ctx, cam.x * 0.34, H * 0.80, 3.4, '#ffffff', 0.85, 41);
  }

  // distant floating-island silhouettes: a flat top, tapering rocky underside
  _farIslands(ctx, off, baseY, count, alpha) {
    const { W, H } = this.e; const rng = U.seed(777 + ((baseY * 3) | 0));
    ctx.save(); ctx.globalAlpha = alpha;
    const span = 540;
    ctx.translate(-(off % span), 0);
    for (let k = -1; k < Math.ceil(W / span) + 2; k++) {
      const bx = k * span + rng() * 200;
      const by = baseY - rng() * 70;
      const iw = 60 + rng() * 120;
      const ih = 30 + rng() * 50;
      const col = U.lerpColor('#7a90b8', '#c9dcf2', rng());
      ctx.fillStyle = col;
      // flat top
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + iw, by);
      // jagged underside narrowing to a point
      ctx.lineTo(bx + iw * 0.66, by + ih * 0.7);
      ctx.lineTo(bx + iw * 0.5, by + ih);
      ctx.lineTo(bx + iw * 0.34, by + ih * 0.6);
      ctx.closePath(); ctx.fill();
      // a tiny ruined column / arch on a few of them
      if (rng() > 0.55) {
        ctx.fillStyle = U.alpha(col, 0.9);
        const cwx = bx + iw * (0.3 + rng() * 0.4);
        ctx.fillRect(cwx, by - 16 - rng() * 14, 5, 18 + rng() * 12);
      }
      // pale rim of light on the sunlit top edge
      ctx.strokeStyle = U.rgba('#fff7e6', 0.25); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + iw, by); ctx.stroke();
    }
    ctx.restore();
  }

  // soft layered cloud bank built from overlapping puffs, deterministic per seed
  _cloudBank(ctx, off, baseY, scale, color, alpha, seed) {
    const { W } = this.e; const rng = U.seed(seed);
    ctx.save(); ctx.globalAlpha = alpha;
    const span = 420 * scale;
    ctx.translate(-(off % span), 0);
    for (let k = -1; k < Math.ceil(W / span) + 2; k++) {
      const cxp = k * span + rng() * span * 0.5;
      const cyp = baseY + (rng() - 0.5) * 50 * scale;
      const puffs = 4 + ((rng() * 4) | 0);
      const drift = Math.sin(this.t * 0.12 + k) * 8;
      for (let i = 0; i < puffs; i++) {
        const px = cxp + (i - puffs / 2) * 50 * scale + drift;
        const py = cyp - Math.sin((i / puffs) * Math.PI) * 30 * scale;
        const pr = (34 + rng() * 40) * scale;
        const g = ctx.createRadialGradient(px, py, pr * 0.2, px, py, pr);
        g.addColorStop(0, U.rgba(color, 0.95));
        g.addColorStop(0.6, U.rgba(color, 0.5));
        g.addColorStop(1, U.rgba(color, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(px, py, pr, 0, U.TAU); ctx.fill();
      }
    }
    ctx.restore();
  }

  // mid layer (world-space, behind solids): god-rays + arena storm glow
  _mid(ctx, w, t) {
    const { H } = this.e;
    // soft sun-rays slanting down across the world
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const rx = 500 + i * 900 + Math.sin(t * 0.08 + i) * 30;
      const g = ctx.createLinearGradient(rx, 0, rx - 200, H);
      g.addColorStop(0, U.rgba('#fff4dc', 0.06));
      g.addColorStop(1, U.rgba('#fff4dc', 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(rx, -20); ctx.lineTo(rx + 80, -20);
      ctx.lineTo(rx - 150, H); ctx.lineTo(rx - 320, H);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();

    // arena: a swirling cyan/violet storm halo while the Tempest lives
    if (this.boss && (this.boss.active || (this.boss.dead && this.boss.dying < 1.4))) {
      const pulse = 0.5 + Math.sin(t * 3) * 0.25;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      draw.glow(ctx, ARENA_X, ARENA_AIR, 280, '#cfe8ff', 0.14 * pulse);
      draw.glow(ctx, ARENA_X, ARENA_AIR, 180, '#9a6bff', 0.12 * pulse);
      ctx.restore();
    }
  }

  // props layer (world-space, in front of solids): visible WIND STREAKS in gusts
  _props(ctx, w, t) {
    const cam = w.camera; const { W } = this.e;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (const g of GUSTS) {
      // cull off-screen gust zones
      if (g.x + g.w < cam.x - 40 || g.x > cam.x + W + 40) continue;
      const col = g.dir > 0 ? '#cfe8ff' : '#bdb0ff';
      const n = Math.max(6, Math.floor(g.w / 70));
      for (let i = 0; i < n; i++) {
        const seed = (i * 53 + (g.x | 0)) % 360;
        const ly = g.y + 24 + ((seed * 9301 + 49297) % (g.h - 48));
        // streaks scroll in the gust direction
        const speed = 220 + (seed % 60);
        let sx = g.x + U.wrap(t * speed * g.dir + seed * 7, g.w + 120) - 60;
        const len = 40 + (seed % 40);
        const wob = Math.sin(t * 2 + seed) * 4;
        const a = 0.12 + 0.10 * (0.5 + 0.5 * Math.sin(t * 3 + seed));
        ctx.strokeStyle = U.rgba(col, a);
        ctx.lineWidth = 1.4 + (seed % 2);
        ctx.beginPath();
        ctx.moveTo(sx, ly + wob);
        ctx.lineTo(sx + g.dir * len, ly + wob - g.dir * 2);
        ctx.stroke();
        // a little arrowhead so direction reads instantly
        ctx.beginPath();
        ctx.moveTo(sx + g.dir * len, ly + wob - g.dir * 2);
        ctx.lineTo(sx + g.dir * (len - 8), ly + wob - 4);
        ctx.moveTo(sx + g.dir * len, ly + wob - g.dir * 2);
        ctx.lineTo(sx + g.dir * (len - 8), ly + wob + 4);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // foreground (screen-space): drifting feathers, light glints, low haze
  _fg(ctx, w, t) {
    const { W, H } = this.e; const camx = w.camera.x;

    // light glints / pollen
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const g of this.glints) {
      const x = g.x - camx; if (x < -20 || x > W + 20) continue;
      const a = 0.2 + Math.sin(t * 1.6 + g.ph) * 0.18;
      ctx.fillStyle = U.rgba(g.gold ? '#ffe6b0' : '#eaf4ff', U.clamp(a, 0, 0.5));
      ctx.beginPath(); ctx.arc(x, g.y, g.r, 0, U.TAU); ctx.fill();
    }
    ctx.restore();

    // drifting feathers (little curved quills)
    for (const f of this.feathers) {
      const x = f.x - camx; if (x < -20 || x > W + 20) continue;
      ctx.save();
      ctx.translate(x, f.y); ctx.rotate(f.rot + Math.sin(t + f.ph) * 0.3);
      ctx.globalAlpha = 0.6;
      const col = f.gold ? '#ffe6b0' : '#eaf4ff';
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(0, 0, f.r * 0.5, f.r * 1.5, 0, 0, U.TAU); ctx.fill();
      // central quill line
      ctx.strokeStyle = U.rgba('#9bb6d8', 0.6); ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(0, -f.r * 1.5); ctx.lineTo(0, f.r * 1.5); ctx.stroke();
      ctx.restore();
    }

    // soft bright haze along the bottom (the cloud sea bleeding upward)
    draw.mist(ctx, H * 0.9, 130, '#ffffff', t, 0.16);
  }
};

})();

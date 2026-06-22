/* ============================================================
   ACT VI — FIRE REALM, "Trial of Control"
   A volcanic forge: rivers of lava, blackened obsidian shelves,
   ancient forge braziers, heat-haze and falling ash. Traverse the
   lava trial → wide obsidian arena → BOSS: the Cinder Wraith.
   Guardian Rion speaks; reward: the Ember Blade (emberShot).
   Palette: gold (#f4c560) / ember-orange vs violet (#9a6bff) corruption.
   ============================================================ */
(function () {
"use strict";
const VEIL = window.VEIL;
const U = VEIL.U, draw = VEIL.draw;

const ARENA_X = 4560;      // centre of the boss arena
const ARENA_FLOOR = 624;   // y of the arena ground top
const GOAL_X = 5040;
const NUM_FORGES = 3;      // optional flavour: ancient forges to ignite

VEIL.scenes['act6_fire'] = class FireScene {
  enter(e) {
    this.e = e; this.t = 0; this.hud = true; this.canPause = true;
    e.audio.resume();
    const r = VEIL.story.realms.fire;
    e.audio.music(r.music);
    e.grade = { color: '#6e1c08', amount: 0.18 };
    VEIL.ui.banner(r.kicker, r.title, r.sub);

    this.bossStarted = false;
    this.forgesLit = 0;

    // --- atmosphere: rising ember sparks (world-space, drift upward) ---
    this.embers = Array.from({ length: 110 }, () => ({
      x: U.rand(0, 5200), y: U.rand(0, 760),
      vy: U.rand(-70, -22), vx: U.rand(-14, 14),
      r: U.rand(0.7, 2.6), ph: U.rand(0, 10), hot: U.chance(0.5),
    }));
    // --- falling ash flecks (drift down, slow lateral) ---
    this.ash = Array.from({ length: 70 }, () => ({
      x: U.rand(0, 5200), y: U.rand(0, 760),
      v: U.rand(14, 44), sway: U.rand(0.4, 1.4), ph: U.rand(0, 10), r: U.rand(0.8, 2.2),
    }));
    // --- lava-glow haze columns (world anchors over the lava rivers) ---
    this.lavaGlows = [];

    const T = { platform: '#3a1a12', platformEdge: '#ff7a3c', accent: '#9a6bff' };
    const self = this;
    const FY = 672; // baseline ground top

    const level = {
      width: 5200, killY: 980, spawn: { x: 80, y: FY - 40 }, theme: T,
      vignette: 0.62, vignetteColor: '#1a0703',
      solids: [
        // ---- opening obsidian shelf ----
        { x: -40, y: FY, w: 540, h: 240 },
        // first lava river — stepping obsidian slabs across the flow
        { x: 620, y: 620, w: 170, h: 220 },
        { x: 700, y: 502, w: 130, h: 14, oneway: true },   // high ledge w/ first forge
        { x: 880, y: 588, w: 150, h: 230 },
        { x: 1080, y: 560, w: 170, h: 240 },
        // ascending obsidian terraces over a wider lava channel
        { x: 1320, y: 600, w: 150, h: 220 },
        { x: 1540, y: 520, w: 140, h: 14, oneway: true },
        { x: 1740, y: 560, w: 200, h: 240 },
        // forge-platform plateau (set-dressing forge #2 sits here)
        { x: 2010, y: 532, w: 320, h: 260 },
        { x: 2180, y: 414, w: 150, h: 14, oneway: true },
        // climbing obsidian pillars beside a tall lava fall
        { x: 2420, y: 600, w: 150, h: 220 },
        { x: 2600, y: 492, w: 140, h: 14, oneway: true },
        { x: 2760, y: 396, w: 150, h: 14, oneway: true },
        { x: 2600, y: 300, w: 160, h: 14, oneway: true },
        // high obsidian causeway across the chasm of fire
        { x: 2880, y: 352, w: 480, h: 26 },
        { x: 2980, y: 240, w: 130, h: 14, oneway: true },   // forge #3 perch (top of the world)
        // descent terraces toward the arena (over molten pools)
        { x: 3440, y: 470, w: 280, h: 330 },
        { x: 3640, y: 360, w: 140, h: 14, oneway: true },
        { x: 3800, y: 560, w: 230, h: 240 },
        { x: 4110, y: 612, w: 200, h: 200 },
        // ---- BOSS ARENA: a wide obsidian forge-floor (NO lava centre) ----
        { x: 4300, y: ARENA_FLOOR, w: 740, h: 220 },
        // arena back wall — placed at the FAR (right) edge so it frames the
        // arena without blocking the left-side entrance (was a soft-lock here).
        { x: 5200, y: 360, w: 26, h: 264 },
        { x: 4600, y: 516, w: 90, h: 16, oneway: true },    // cover stub
        { x: 4820, y: 516, w: 90, h: 16, oneway: true },    // cover stub
        // goal pedestal lip (Rion's anvil-shrine)
        { x: 5020, y: ARENA_FLOOR, w: 180, h: 220 },
      ],
      hazards: [
        // ---- LAVA RIVERS / POOLS (deadly molten flow) ----
        { kind: 'lava', x: 500, y: 740, w: 120, h: 120, dmg: 24 },
        { kind: 'lava', x: 790, y: 752, w: 90, h: 120, dmg: 24 },
        { kind: 'lava', x: 1030, y: 752, w: 50, h: 120, dmg: 24 },
        { kind: 'lava', x: 1250, y: 760, w: 70, h: 120, dmg: 24 },
        { kind: 'lava', x: 1470, y: 760, w: 270, h: 120, dmg: 24 }, // wide channel
        { kind: 'lava', x: 1940, y: 770, w: 70, h: 120, dmg: 24 },
        { kind: 'lava', x: 2330, y: 770, w: 90, h: 120, dmg: 24 },
        { kind: 'lava', x: 2570, y: 770, w: 290, h: 120, dmg: 24 }, // chasm beneath the high causeway
        { kind: 'lava', x: 3360, y: 780, w: 80, h: 110, dmg: 24 },
        { kind: 'lava', x: 3720, y: 780, w: 80, h: 110, dmg: 24 },
        { kind: 'lava', x: 4030, y: 790, w: 80, h: 100, dmg: 24 },
        // a corruption-spike trap on a tempting high one-way ledge
        { x: 2600, y: 286, w: 90, h: 14, dmg: 18 },
      ],
      checkpoints: [
        { x: 1080, y: 560 },
        { x: 2010, y: 532 },
        { x: 3460, y: 470 },
        { x: 4180, y: 612 },   // just outside the arena
      ],
      enemies: [
        { kind: 'husk', x: 900, y: 588, opts: { tint: '#ff7a3c' } },
        { kind: 'spitter', x: 1120, y: 560, opts: { tint: '#ff9a3c' } },
        { kind: 'husk', x: 1780, y: 560, opts: { tint: '#ff7a3c' } },
        { kind: 'spitter', x: 2120, y: 532, opts: { tint: '#ff9a3c' } },
        { kind: 'husk', x: 2470, y: 600, opts: { tint: '#ff7a3c' } },
        { kind: 'spitter', x: 3180, y: 352, opts: { tint: '#ff9a3c' } },
        { kind: 'husk', x: 3540, y: 470, opts: { tint: '#ff7a3c' } },
        { kind: 'husk', x: 3880, y: 560, opts: { tint: '#ff7a3c' } },
      ],
      triggers: [
        // intro (fires once the player takes a step)
        { x: 90, y: 0, w: 80, h: 720, once: true, onEnter: () => self._intro() },
        // lore whispers carved into the forge walls
        { x: 1320, y: 0, w: 50, h: 720, once: true, onEnter: () => self._whisper(0) },
        { x: 2010, y: 0, w: 50, h: 720, once: true, onEnter: () => self._whisper(1) },
        { x: 2880, y: 0, w: 50, h: 720, once: true, onEnter: () => self._whisper(2) },
        // arena seal — start the boss
        { x: 4360, y: 0, w: 60, h: 720, once: true, onEnter: () => self._startBoss() },
      ],
      interactables: [
        { x: 300, y: 672, markY: 648, r: 70, label: 'Worn rune', color: '#9a6bff', once: true, keepMarker: true, sfx: 'fragment',
          onInteract: () => VEIL.story.revealEcho(VEIL.engine, 'flame') },
      ],
      goal: { x: GOAL_X, y: 0, color: '#f4c560', onReach: () => {} },
      paintBg: (ctx, w, t) => self._bg(ctx, w, t),
      paintMid: (ctx, w, t) => self._mid(ctx, w, t),
      paintProps: (ctx, w, t) => self._props(ctx, w, t),
      paintFg: (ctx, w, t) => self._fg(ctx, w, t),
    };

    // --- ancient forges (optional flavour: ignite with embers) ---
    // Placed on accessible ledges; lighting all is rewarded but NOT required.
    this.forges = [
      { x: 765, y: 502, lit: false, flick: U.rand(0, 10) },
      { x: 2120, y: 532, lit: false, flick: U.rand(0, 10) },
      { x: 3045, y: 240, lit: false, flick: U.rand(0, 10) },
    ];

    this.pf = new VEIL.Platformer(e, level);
    this.player = this.pf.player;
    this.compassAngle = 0;
    this.pf.onBossKilled = () => self._win();
    // ember strikes can ignite forges (player melee/ember hitbox callback)
    this.pf.onPlayerStrike = (hb) => self._tryLightForges(hb);

    // build (but do not begin) the boss
    this.boss = this.pf.addBoss(ARENA_X, ARENA_FLOOR, this._bossCfg());
  }
  exit() { this.e.grade = null; }

  // ---------------------------------------------------------
  // story beats
  // ---------------------------------------------------------
  _intro() {
    VEIL.dialogue.play(VEIL.story.act6Intro, () => {
      this.e.state.abilities.emberShot = true;
      VEIL.ui.toast('Ember Blade — Loose an Ember (L)', 5);
      this.e.audio.sfx('ability');
      setTimeout(() => { if (this.e.sceneName === 'act6_fire') VEIL.ui.toast('✦ Light the ancient forges — but mind the heat', 4); }, 5400);
    });
  }
  _whisper(i) {
    const lines = [
      'Fire unshaped is only ruin. Give it edges.',
      'The forge does not fear the flame — it commands it.',
      'Burn too bright, and you will have nothing left to burn.',
    ];
    VEIL.ui.toast('✦ ' + lines[i % lines.length], 4.5);
    this.e.audio.sfx('whisper');
  }

  // optional flavour: an ember strike near a forge lights it
  _tryLightForges(hb) {
    for (const f of this.forges) {
      if (f.lit) continue;
      const box = { x: f.x - 40, y: f.y - 80, w: 80, h: 90 };
      if (U.aabb(hb, box)) {
        f.lit = true; this.forgesLit++;
        this.e.audio.sfx('ability'); this.e.camera.shake(0.12);
        this.pf.particles.burst(f.x, f.y - 28, 26, { color: '#ffd27a', color2: '#ff5a2a', ang: -Math.PI / 2, spread: 1.1, spdMax: 320, lifeMax: 0.7, rMax: 7 });
        if (this.forgesLit >= NUM_FORGES) VEIL.ui.toast('✦ All forges burn — the realm answers your control', 4);
        else VEIL.ui.toast('✦ Forge lit  ' + this.forgesLit + ' / ' + NUM_FORGES, 2.6);
      }
    }
  }

  _startBoss() {
    if (this.bossStarted || !this.boss) return;
    this.bossStarted = true;
    this.boss.begin();
    this.e.camera.shake(0.5);
    VEIL.ui.banner('Guardian', 'Cinder Wraith', 'Trial of Control');
    VEIL.ui.toast('Strike when its core blazes gold — dodge the geysers', 5);
  }
  _win() {
    this.player.vx = 0;
    this.e.camera.shake(0.7);
    VEIL.dialogue.play(VEIL.story.act6Win, () => {
      VEIL.completeRealm('fire', null, 'fire', 'act7_air');
    });
  }

  // ---------------------------------------------------------
  // BOSS DEFINITION — Cinder Wraith
  // ---------------------------------------------------------
  _bossCfg() {
    const self = this;
    return {
      name: 'Cinder Wraith', title: 'Trial of Control',
      hp: 380, color: '#7a2a12', tint: '#ff7a3c', style: 'wraith',
      w: 46, h: 64, phases: 3, chase: true, speed: 110,
      cdMin: 0.6, cdMax: 1.4,
      onPhase: (b, phase) => {
        b.world.camera.shake(0.55);
        VEIL.ui.toast(phase === 2
          ? '✦ The Wraith ignites — it begins to charge!'
          : '✦ The core roars white-hot — the Wraith rages!', 3);
        // escalate: faster, hungrier; tighter windows as it weakens
        b.cfg.speed = 110 + phase * 36;
        b.cfg.cdMin = Math.max(0.40, 0.6 - phase * 0.08);
        b.cfg.cdMax = Math.max(0.85, 1.4 - phase * 0.16);
        b.world.particles.burst(b.x + b.w / 2, b.y + b.h / 2, 34, { color: '#ffd27a', color2: '#ff3a0a', spdMax: 360, lifeMax: 0.9, rMax: 8 });
      },
      attacks: [
        this._atkFireballVolley(),
        this._atkLavaGeyser(),
        this._atkEmberDash(),
      ],
      // flaming wraith body — a hovering robed cinder with a molten core
      drawBody: (b, ctx, cx, cy, flashing) => self._drawWraith(b, ctx, cx, cy, flashing),
    };
  }

  // 1) FIREBALL VOLLEY — fan of embers; later phases add slight homing.
  _atkFireballVolley() {
    return {
      name: 'volley', tele: 0.55, dur: 0.5, rec: 0.7, vuln: 1.3, minPhase: 0,
      onStart(b) { b.data.fired = 0; b.data.count = 2 + b.phase; b.vx = 0; },
      telegraph(b, dt) {
        // gather a swelling ember at the core
        if (U.chance(0.7)) b.world.particles.emit({
          x: b.x + b.w / 2 + U.rand(-10, 10), y: b.y + b.h * 0.4 + U.rand(-10, 10),
          vx: U.rand(-20, 20), vy: U.rand(-20, 20), life: 0.4, r: 4,
          color: '#ffd27a', color2: '#ff5a2a',
        });
      },
      run(b, dt, phase) {
        const step = 0.5 / b.data.count;
        const want = Math.min(b.data.count, Math.floor(b.t / step) + 1);
        while (b.data.fired < want) {
          const i = b.data.fired++;
          const p = b.world.player;
          const sx = b.x + b.w / 2, sy = b.y + b.h * 0.4;
          const base = Math.atan2(p.cy - sy, p.cx - sx);
          const spread = (i - (b.data.count - 1) / 2) * 0.20;
          const a = base + spread;
          const spd = 300 + phase * 30;
          b.shoot({
            x: sx, y: sy, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
            dmg: 13, color: '#ff7a3c', r: 9, life: 2.4,
            homing: phase >= 2 ? 1.2 : 0,
          });
          b.e.audio.sfx('corrupt');
          b.world.camera.shake(0.08);
        }
      },
    };
  }

  // 2) LAVA GEYSER — telegraphed vertical eruption columns at the player's
  //    position. Clear ground tell → a tall hitbox erupts. Camera shake.
  _atkLavaGeyser() {
    return {
      name: 'geyser', tele: 0.85, dur: 0.55, rec: 0.7, vuln: 1.0, minPhase: 0,
      onStart(b) {
        b.vx = 0;
        // lock geyser positions at telegraph start: player + extras in later phases
        const p = b.world.player;
        b.data.cols = [p.cx];
        if (b.phase >= 2) b.data.cols.push(p.cx - 220, p.cx + 220);
        b.data.erupted = false;
      },
      telegraph(b, dt) {
        // glowing fissures crack open beneath each column
        for (const c of b.data.cols) {
          if (U.chance(0.6)) b.world.particles.emit({
            x: c + U.rand(-26, 26), y: b.floorY,
            vx: U.rand(-30, 30), vy: U.rand(-30, -4), life: 0.45, r: 4,
            color: '#ffd27a', color2: '#ff3a0a',
          });
        }
      },
      run(b, dt, phase) {
        if (!b.data.erupted) {
          b.data.erupted = true;
          b.world.camera.shake(0.7);
          b.e.audio.sfx('slam');
          for (const c of b.data.cols) {
            b.world.particles.burst(c, b.floorY, 26, {
              color: '#ffd27a', color2: '#ff3a0a', ang: -Math.PI / 2, spread: 0.5,
              spdMax: 620, lifeMax: 0.8, rMax: 9, g: 600,
            });
          }
        }
        // tall eruption hitboxes persist through the act window
        for (const c of b.data.cols) {
          const box = { x: c - 30, y: b.floorY - 320, w: 60, h: 330 };
          b.hitPlayer(box, 18);
          if (U.chance(0.8)) b.world.particles.emit({
            x: c + U.rand(-24, 24), y: b.floorY - U.rand(0, 300),
            vx: U.rand(-30, 30), vy: U.rand(-200, -60), g: 300, life: 0.5, r: U.rand(4, 8),
            color: '#ff7a3c', color2: '#ffd27a',
          });
        }
      },
    };
  }

  // 3) EMBER DASH — (phase 2+) charge across the arena leaving an ember trail.
  _atkEmberDash() {
    return {
      name: 'dash', tele: 0.65, dur: 0.55, rec: 0.85, vuln: 1.1, minPhase: 2,
      onStart(b) {
        const p = b.world.player;
        b.face = U.sign(p.cx - (b.x + b.w / 2)) || b.face;
        b.data.hit = false;
      },
      telegraph(b, dt) {
        // wind back, gather heat at the trailing edge
        b.vx = U.approach(b.vx, -b.face * 60, 240 * dt);
        if (U.chance(0.7)) b.world.particles.emit({
          x: b.x + b.w / 2 - b.face * b.w * 0.5, y: b.y + b.h / 2,
          vx: -b.face * U.rand(60, 160), vy: U.rand(-30, 30), life: 0.4, r: 4,
          color: '#ff7a3c', color2: '#ffd27a',
        });
      },
      run(b, dt, phase) {
        b.vx = b.face * (560 + phase * 30);
        b.vy = 0; // wraith hovers — flat charge
        // charging body hitbox
        const box = { x: b.face > 0 ? b.x + b.w - 8 : b.x - 56, y: b.y + 4, w: 64, h: b.h - 8 };
        if (!b.data.hit) { const before = b.world.player.iframe; b.hitPlayer(box, 18); if (b.world.player.iframe > before) b.data.hit = true; }
        // searing ember trail left behind
        b.world.particles.emit({
          x: b.x + b.w / 2 - b.face * b.w * 0.3, y: b.y + b.h / 2 + U.rand(-18, 18),
          vx: -b.face * U.rand(20, 80), vy: U.rand(-40, 20), g: 60, life: 0.6, r: U.rand(4, 7),
          color: '#ff7a3c', color2: '#ffd27a',
        });
      },
    };
  }

  // flaming wraith renderer: a hovering robed cinder with a molten core
  _drawWraith(b, ctx, cx, cy, flashing) {
    const t = b.anim;
    ctx.save(); ctx.translate(cx, cy);
    // hover bob
    const bob = Math.sin(t * 3) * 4;
    ctx.translate(0, bob);

    // outer flame halo
    draw.glow(ctx, 0, 0, b.w * 1.4, '#ff5a2a', 0.35 + Math.sin(t * 5) * 0.08);

    // tattered robe — wavering flame silhouette (tail flickers below)
    const col = flashing ? '#ffffff' : '#3a160c';
    ctx.fillStyle = col;
    ctx.beginPath();
    const top = -b.h * 0.5, midW = b.w * 0.5;
    ctx.moveTo(-midW, top + b.h * 0.3);
    ctx.quadraticCurveTo(-midW * 1.1, top, 0, top - 4);
    ctx.quadraticCurveTo(midW * 1.1, top, midW, top + b.h * 0.3);
    // flickering lower hem — tongues of flame
    const tongues = 5;
    for (let i = tongues; i >= 0; i--) {
      const fx = U.lerp(midW, -midW, i / tongues);
      const fl = (Math.sin(t * 8 + i * 1.6) * 0.5 + 0.5);
      ctx.lineTo(fx, b.h * (0.45 + fl * 0.28));
      if (i > 0) { const mx = U.lerp(midW, -midW, (i - 0.5) / tongues); ctx.lineTo(mx, top + b.h * 0.5); }
    }
    ctx.closePath(); ctx.fill();

    // ember-orange rim flames licking the edges
    ctx.strokeStyle = flashing ? '#fff' : U.rgba('#ff7a3c', 0.9);
    ctx.lineWidth = 2.5; ctx.shadowColor = '#ff5a2a'; ctx.shadowBlur = 12;
    ctx.stroke(); ctx.shadowBlur = 0;

    // violet corruption veins through the robe
    ctx.strokeStyle = U.rgba('#9a6bff', 0.7); ctx.lineWidth = 1.8;
    ctx.shadowColor = '#9a6bff'; ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(-midW * 0.4, top + 6); ctx.lineTo(-2, b.h * 0.1); ctx.lineTo(midW * 0.3, b.h * 0.3);
    ctx.stroke(); ctx.shadowBlur = 0;

    // molten core (gold when vulnerable, ember-orange otherwise)
    const coreCol = b.vulnerable ? '#f4c560' : '#ff7a3c';
    draw.glow(ctx, 0, -b.h * 0.06, 20 + Math.sin(t * 6) * 3, coreCol, 0.95);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -b.h * 0.06, b.vulnerable ? 7 : 5, 0, U.TAU); ctx.fill();

    // burning eyes
    ctx.fillStyle = '#ffe6a8'; ctx.shadowColor = '#ff9a3c'; ctx.shadowBlur = 10;
    const ey = -b.h * 0.34;
    ctx.beginPath(); ctx.arc(b.face * 5 - 6, ey, 3, 0, U.TAU); ctx.arc(b.face * 5 + 6, ey, 3, 0, U.TAU); ctx.fill();
    ctx.shadowBlur = 0;

    // stray sparks rising off the body
    if (U.chance(0.5)) b.world.particles.emit({
      x: cx + U.rand(-b.w * 0.4, b.w * 0.4), y: cy + bob + U.rand(-b.h * 0.3, b.h * 0.3),
      vx: U.rand(-20, 20), vy: U.rand(-90, -30), life: 0.6, r: U.rand(1.5, 3),
      color: '#ffd27a', color2: '#ff5a2a',
    });
    ctx.restore();
  }

  // ---------------------------------------------------------
  // loop
  // ---------------------------------------------------------
  update(dt) {
    this.t += dt;
    this.pf.update(dt);

    // compass points toward the arena, then toward the goal once the boss falls
    const target = (this.bossStarted && (!this.boss || this.boss.dead)) ? GOAL_X : ARENA_X;
    const dx = target - this.player.cx;
    this.compassAngle = U.lerp(this.compassAngle, Math.atan2(-0.18, dx), dt * 4);

    // forge flicker timers
    for (const f of this.forges) f.flick += dt;

    // ember sparks rise; ash drifts down
    const camx = this.pf.camera.x;
    for (const em of this.embers) {
      em.y += em.vy * dt; em.x += em.vx * dt + Math.sin(this.t * 0.8 + em.ph) * 6 * dt;
      if (em.y < -20) { em.y = 760; em.x = camx + U.rand(-40, this.e.W + 40); }
      if (em.x < camx - 60) em.x = camx + this.e.W + 40;
      if (em.x > camx + this.e.W + 60) em.x = camx - 40;
    }
    for (const a of this.ash) {
      a.y += a.v * dt; a.x += Math.sin(this.t * a.sway + a.ph) * 10 * dt - 6 * dt;
      if (a.y > 760) { a.y = -10; a.x = camx + U.rand(0, this.e.W); }
    }
  }
  draw(ctx) { this.pf.draw(ctx); }

  // =========================================================
  // PARALLAX BACKDROP — the "stunning" part.
  // Layered volcano silhouettes, lava glow on the horizon,
  // forge-light embers, falling ash, heat-haze shimmer.
  // =========================================================
  _bg(ctx, w, t) {
    const { W, H } = this.e; const cam = w.camera;

    // sky: smoke-choked volcanic gradient — black crown, ember belly
    draw.vGrad(ctx, 0, 0, W, H, [
      [0, '#1a0703'], [0.28, '#3a0e05'], [0.52, '#6e1c08'],
      [0.74, '#a83410'], [0.9, '#d65a18'], [1, '#3a1108'],
    ]);

    // rising lava glow on the horizon (broad, throbbing)
    const hy = H * 0.82;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const pulse = 0.5 + Math.sin(t * 1.2) * 0.12;
    draw.glow(ctx, W * 0.5 - cam.x * 0.02, hy, 620, '#ff5a18', 0.30 * pulse);
    draw.glow(ctx, W * 0.20 - cam.x * 0.03, hy + 30, 320, '#ff7a2a', 0.26);
    draw.glow(ctx, W * 0.80 - cam.x * 0.03, hy + 20, 360, '#ff7a2a', 0.26);
    ctx.restore();

    // smothered ember sun, high and dim through ash
    const sx = W * 0.30 - cam.x * 0.015, sy = H * 0.24;
    draw.glow(ctx, sx, sy, 240, '#ff9a3c', 0.18);
    draw.glow(ctx, sx, sy, 90, '#ffcf6a', 0.32);

    // banded ash haze sweeping the sky
    ctx.save(); ctx.globalAlpha = 0.5;
    for (let i = 0; i < 4; i++) {
      const by = H * (0.18 + i * 0.07) + Math.sin(t * 0.13 + i) * 6;
      draw.hGradBand(ctx, by, 24 + i * 6, U.rgba('#1a0c06', 0.22));
    }
    ctx.restore();

    // ---- far volcano range (smoking cones) — very slow ----
    this._volcanoes(ctx, cam.x * 0.05, H * 0.62, 280, 230, '#3a1208', 11, 0.9, t, true);
    draw.mist(ctx, H * 0.56, 150, '#a83410', t, 0.10);
    // ---- mid volcano range — taller, sharper ----
    this._volcanoes(ctx, cam.x * 0.14, H * 0.72, 230, 280, '#250a04', 27, 0.95, t, false);
    // distant violet corruption seeping into the magma
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    draw.glow(ctx, W * 0.36 - cam.x * 0.10, H * 0.66, 120, '#9a6bff', 0.16);
    draw.glow(ctx, W * 0.78 - cam.x * 0.12, H * 0.64, 100, '#9a6bff', 0.13);
    ctx.restore();
    draw.mist(ctx, H * 0.66, 150, '#6e1c08', t + 4, 0.12);
    // ---- near jagged obsidian ridge — faster ----
    this._ridge(ctx, cam.x * 0.32, H * 0.84, 130, '#170604', 41);
    // ---- closest cinder shoulders framing the bottom ----
    this._ridge(ctx, cam.x * 0.52, H * 0.96, 110, '#0d0402', 57);
    draw.mist(ctx, H * 0.86, 150, '#a83410', t + 2, 0.14);
  }

  // smoking volcano cones with a glowing crater + lava streaks
  _volcanoes(ctx, off, baseY, w, h, color, seed, alpha, t, smoke) {
    const { W, H } = this.e; const rng = U.seed(seed);
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.translate(-(off % (w * 2.2)), 0);
    for (let x = -w * 2; x < W + w * 2.2; x += w * 1.5) {
      const ch = h * (0.6 + rng() * 0.7);
      const cw = w * (0.7 + rng() * 0.6);
      const peakX = x + cw / 2;
      const top = baseY - ch;
      const craterW = cw * 0.18 * (0.7 + rng() * 0.6);
      // cone body
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, H);
      ctx.lineTo(peakX - craterW, top + 4);
      ctx.lineTo(peakX + craterW, top + 4);
      ctx.lineTo(x + cw, H);
      ctx.closePath(); ctx.fill();
      // glowing crater + lava streaks down the sun-facing flank
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      draw.glow(ctx, peakX, top + 8, craterW * 2.4, '#ff5a18', 0.5);
      ctx.strokeStyle = U.rgba('#ff7a2a', 0.45); ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(peakX + craterW * 0.4, top + 6);
      ctx.lineTo(peakX + cw * 0.18, top + ch * 0.4);
      ctx.lineTo(peakX + cw * 0.10, top + ch * 0.7);
      ctx.stroke();
      ctx.restore();
      // lazy smoke plume off the nearest range
      if (smoke) {
        ctx.save(); ctx.globalAlpha = 0.12;
        for (let s = 0; s < 3; s++) {
          const py = top - 10 - s * 46;
          const px = peakX + Math.sin(t * 0.3 + s + seed) * (16 + s * 14);
          ctx.fillStyle = '#1a0c06';
          ctx.beginPath(); ctx.arc(px, py, 28 + s * 16, 0, U.TAU); ctx.fill();
        }
        ctx.restore();
      }
    }
    ctx.restore();
  }

  _ridge(ctx, off, baseY, amp, color, seed) {
    const { W, H } = this.e; const rng = U.seed(seed);
    ctx.save(); ctx.translate(-(off % 640), 0);
    ctx.beginPath(); ctx.moveTo(-120, H); ctx.lineTo(-120, baseY);
    let y = baseY;
    for (let x = -120; x <= W + 760; x += 30) {
      y += (rng() - 0.5) * amp * 0.55;
      y = U.clamp(y, baseY - amp, baseY + amp * 0.35);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W + 760, H); ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
    ctx.restore();
  }

  // mid layer (world-space, behind solids): lava-river underglow + arena seam
  _mid(ctx, w, t) {
    // warm underglow pulsing up from each lava hazard
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const hz of this.pf.hazards) {
      if (hz.kind !== 'lava') continue;
      const cx = hz.x + hz.w / 2;
      const fl = 0.5 + Math.sin(t * 2 + hz.x * 0.02) * 0.18;
      draw.glow(ctx, cx, hz.y, Math.max(120, hz.w * 1.1), '#ff5a18', 0.32 * fl);
      draw.glow(ctx, cx, hz.y - 20, hz.w * 0.7, '#ffd27a', 0.18 * fl);
    }
    ctx.restore();

    // arena: violet corruption seam pulsing in the back wall while the boss lives
    if (this.boss && (this.boss.active || (this.boss.dead && this.boss.dying < 1.4))) {
      const pulse = 0.5 + Math.sin(t * 3) * 0.25;
      draw.glow(ctx, ARENA_X, ARENA_FLOOR - 130, 240, '#9a6bff', 0.18 * pulse);
    }
  }

  // props (world-space, in front of solids): the ancient forge braziers
  _props(ctx, w, t) {
    for (const f of this.forges) this._drawForge(ctx, f, t);
  }
  _drawForge(ctx, f, t) {
    const x = f.x, y = f.y;
    ctx.save();
    // stone brazier bowl on a short plinth
    ctx.fillStyle = '#241008';
    draw.roundRect(ctx, x - 22, y - 18, 44, 22, 6); ctx.fill();
    ctx.fillStyle = '#170a05';
    ctx.fillRect(x - 8, y + 2, 16, 22);
    ctx.fillStyle = '#2e140a';
    draw.roundRect(ctx, x - 18, y + 22, 36, 8, 3); ctx.fill();
    // rim highlight
    ctx.strokeStyle = U.rgba(f.lit ? '#ff7a3c' : '#5a2a18', 0.7); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 20, y - 14); ctx.lineTo(x + 20, y - 14); ctx.stroke();
    if (f.lit) {
      // living flame
      const fl = 0.7 + Math.sin(f.flick * 7) * 0.3;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      draw.glow(ctx, x, y - 22, 60 * fl, '#ff7a2a', 0.6);
      draw.glow(ctx, x, y - 30, 30, '#ffd27a', 0.7);
      ctx.fillStyle = U.rgba('#ffe6a8', 0.9);
      ctx.beginPath();
      ctx.moveTo(x - 10, y - 14);
      ctx.quadraticCurveTo(x - 6, y - 34 - fl * 8, x, y - 46 - fl * 12);
      ctx.quadraticCurveTo(x + 6, y - 34 - fl * 8, x + 10, y - 14);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    } else {
      // dormant: faint violet-corrupted embers waiting to be lit
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      draw.glow(ctx, x, y - 16, 22, '#9a6bff', 0.12 + Math.sin(f.flick * 2) * 0.05);
      ctx.restore();
    }
    ctx.restore();
  }

  // foreground (screen-space): heat-haze, rising embers, falling ash, glow
  _fg(ctx, w, t) {
    const { W, H } = this.e; const camx = w.camera.x;

    // heat-haze shimmer band low on the screen (subtle additive ripple)
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const hy = H * (0.74 + i * 0.07) + Math.sin(t * 1.6 + i) * 5;
      const a = 0.05 + Math.sin(t * 2 + i * 2) * 0.025;
      const g = ctx.createLinearGradient(0, hy - 30, 0, hy + 30);
      g.addColorStop(0, U.rgba('#ff7a2a', 0));
      g.addColorStop(0.5, U.rgba('#ff7a2a', U.clamp(a, 0, 0.12)));
      g.addColorStop(1, U.rgba('#ff7a2a', 0));
      ctx.fillStyle = g; ctx.fillRect(0, hy - 30, W, 60);
    }
    ctx.restore();

    // rising ember sparks (additive)
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const em of this.embers) {
      const x = em.x - camx; if (x < -20 || x > W + 20) continue;
      const a = 0.4 + Math.sin(t * 4 + em.ph) * 0.3;
      ctx.fillStyle = U.rgba(em.hot ? '#ffd27a' : '#ff7a2a', U.clamp(a, 0, 0.8));
      ctx.beginPath(); ctx.arc(x, em.y, em.r, 0, U.TAU); ctx.fill();
    }
    ctx.restore();

    // falling ash flecks (dim, source-over grey)
    ctx.save(); ctx.fillStyle = '#1a1110'; ctx.globalAlpha = 0.5;
    for (const a of this.ash) {
      const x = a.x - camx; if (x < -10 || x > W + 10) continue;
      ctx.globalAlpha = 0.25 + Math.sin(t * 2 + a.ph) * 0.15;
      ctx.beginPath(); ctx.arc(x, a.y, a.r, 0, U.TAU); ctx.fill();
    }
    ctx.restore();

    // warm bottom glow / smoke haze
    draw.mist(ctx, H * 0.9, 140, '#6e1c08', t, 0.2);
  }
};

// small helper used by the backdrop (added defensively if absent)
if (!draw.hGradBand) {
  draw.hGradBand = function (ctx, y, h, color) {
    const g = ctx.createLinearGradient(0, y - h, 0, y + h);
    g.addColorStop(0, U.alpha(color, 0));
    g.addColorStop(0.5, color);
    g.addColorStop(1, U.alpha(color, 0));
    ctx.fillStyle = g; ctx.fillRect(0, y - h, VEIL.engine.W, h * 2);
  };
}

})();

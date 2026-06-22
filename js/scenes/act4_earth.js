/* ============================================================
   ACT IV — EARTH REALM, "The Weight of Life"
   Crumbling ochre cliffs, stone bridges, dust haze, a hazy sun.
   Trial of traversal → wide arena → BOSS: the Corrupted Golem.
   Guardian Tharos speaks; reward: Earth Gauntlets (Block + Ground Slam).
   Palette: gold (#f4c560) light vs violet (#9a6bff) corruption.
   ============================================================ */
(function () {
"use strict";
const VEIL = window.VEIL;
const U = VEIL.U, draw = VEIL.draw;

const ARENA_X = 4560;     // centre of the boss arena
const ARENA_FLOOR = 612;  // y of the arena ground top
const GOAL_X = 4980;

VEIL.scenes['act4_earth'] = class EarthScene {
  enter(e) {
    this.e = e; this.t = 0; this.hud = true; this.canPause = true;
    e.audio.resume();
    const r = VEIL.story.realms.earth;
    e.audio.music(r.music);
    e.grade = { color: '#5a3010', amount: 0.16 };
    VEIL.ui.banner(r.kicker, r.title, r.sub);

    // --- atmosphere: drifting dust motes (world-space) ---
    this.motes = Array.from({ length: 90 }, () => ({
      x: U.rand(0, 5200), y: U.rand(0, 720),
      vx: U.rand(6, 26), vy: U.rand(-6, 10),
      r: U.rand(0.6, 2.4), ph: U.rand(0, 10), gold: U.chance(0.4),
    }));
    // falling rubble flecks from the crumbling cliffs
    this.flecks = Array.from({ length: 28 }, () => ({
      x: U.rand(0, 5200), y: U.rand(0, 720), v: U.rand(18, 50), r: U.rand(0.8, 2),
    }));
    this.bossStarted = false;

    const T = { platform: '#5a4030', platformEdge: '#c9974f', accent: '#9a6bff' };
    const self = this;
    const FY = 660; // baseline ground top

    const level = {
      width: 5200, killY: 940, spawn: { x: 80, y: FY - 40 }, theme: T,
      vignette: 0.6, vignetteColor: '#0a0603',
      solids: [
        // ---- opening shelf ----
        { x: -40, y: FY, w: 560, h: 200 },
        // first gap with stepping ledges + a one-way mesa shelf
        { x: 620, y: 600, w: 240, h: 200 },
        { x: 760, y: 478, w: 150, h: 14, oneway: true },
        { x: 980, y: 548, w: 300, h: 240 },
        { x: 1140, y: 430, w: 150, h: 14, oneway: true },
        // crumbled bridge spans (broken into chunks → small jumps)
        { x: 1400, y: 588, w: 150, h: 200 },
        { x: 1620, y: 560, w: 130, h: 220 },
        { x: 1840, y: 588, w: 150, h: 200 },
        // tall pillar climb
        { x: 2080, y: 610, w: 360, h: 200 },
        { x: 2260, y: 500, w: 140, h: 14, oneway: true },
        { x: 2420, y: 408, w: 150, h: 14, oneway: true },
        { x: 2300, y: 318, w: 170, h: 14, oneway: true },
        // high stone bridge across a chasm (spike pit below)
        { x: 2560, y: 360, w: 520, h: 26 },
        { x: 2640, y: 248, w: 130, h: 14, oneway: true },
        // landing terrace after the bridge
        { x: 3160, y: 470, w: 320, h: 320 },
        { x: 3340, y: 360, w: 140, h: 14, oneway: true },
        // secret: a hidden upper shelf the cliff kept to itself (optional climb)
        { x: 3300, y: 268, w: 160, h: 12, oneway: true },
        // descent steps toward the arena
        { x: 3560, y: 560, w: 240, h: 230 },
        { x: 3880, y: 600, w: 240, h: 200 },
        { x: 4180, y: 636, w: 200, h: 170 },
        // ---- BOSS ARENA: a wide crumbling plateau ----
        { x: 4360, y: ARENA_FLOOR, w: 720, h: 220 },
        // a couple of cover stubs the player can vault for breathing room
        { x: 4640, y: 508, w: 90, h: 16, oneway: true },
        { x: 4860, y: 508, w: 90, h: 16, oneway: true },
        // far arena wall (behind the goal) — frames the plateau without blocking entry
        { x: 5180, y: 300, w: 30, h: 320 },
        // goal pedestal lip
        { x: 5060, y: ARENA_FLOOR, w: 140, h: 220 },
      ],
      hazards: [
        // corruption-spike pits punishing bad landings
        { x: 540, y: 900, w: 80, h: 40, dmg: 18 },
        { x: 1560, y: 760, w: 60, h: 40, dmg: 18 },
        { x: 2440, y: 760, w: 120, h: 40, dmg: 18 },   // chasm beneath the high bridge
        { x: 3480, y: 760, w: 80, h: 40, dmg: 18 },
        // a spike ridge on a tempting one-way ledge
        { x: 2300, y: 304, w: 90, h: 14, dmg: 18 },
      ],
      checkpoints: [
        { x: 2110, y: 610 },
        { x: 3200, y: 470 },
        { x: 4220, y: 636 },   // just before the arena
      ],
      enemies: [
        { kind: 'husk', x: 1040, y: 548 },
        { kind: 'husk', x: 1700, y: 560 },
        { kind: 'spitter', x: 2980, y: 360 },
        { kind: 'husk', x: 3260, y: 470 },
        { kind: 'brute', x: 3680, y: 560, opts: { tint: '#b388ff' } },
        { kind: 'husk', x: 4060, y: 600 },
        // a corrupted wisp drifts over the high bridge; a husk guards the early ledges
        { kind: 'wisp', x: 2820, y: 300 },
        { kind: 'husk', x: 1880, y: 588 },
      ],
      triggers: [
        // intro (fires once the player takes a step)
        { x: 90, y: 0, w: 80, h: 720, once: true, onEnter: () => self._intro() },
        // lore whispers carved into the cliff
        { x: 1380, y: 0, w: 50, h: 720, once: true, onEnter: () => self._whisper(0) },
        { x: 2560, y: 0, w: 50, h: 720, once: true, onEnter: () => self._whisper(1) },
        { x: 3160, y: 0, w: 50, h: 720, once: true, onEnter: () => self._whisper(2) },
        // arena seal — start the boss
        { x: 4400, y: 0, w: 60, h: 720, once: true, onEnter: () => self._startBoss() },
      ],
      pickups: [
        // reward on the secret shelf
        { x: 3320, y: 248, kind: 'health', r: 14,
          onCollect: () => { e.state.hp = U.clamp(e.state.hp + 35, 0, e.state.maxHp); e.audio.sfx('heal'); VEIL.ui.toast('✦ Heartroot — vigor restored (+35)'); } },
      ],
      interactables: [
        // carved lore the player can read by pressing E
        { x: 1060, y: 548, markY: 522, r: 70, label: 'Cliff mural', color: '#c9b3ff', once: true, keepMarker: true, sfx: 'whisper',
          onInteract: () => self._mural(3) },
        { x: 3420, y: 268, markY: 244, r: 70, label: 'Worn rune', color: '#9a6bff', once: true, keepMarker: true, sfx: 'fragment',
          onInteract: () => self._echo('weight') },
        { x: 4250, y: 636, markY: 600, r: 74, label: 'Tharos’ mark', color: '#f4c560', once: true, keepMarker: true, sfx: 'whisper',
          onInteract: () => self._mural(5) },
      ],
      goal: { x: GOAL_X, y: 0, color: '#f4c560', onReach: () => {} },
      paintBg: (ctx, w, t) => self._bg(ctx, w, t),
      paintMid: (ctx, w, t) => self._mid(ctx, w, t),
      paintFg: (ctx, w, t) => self._fg(ctx, w, t),
    };

    this.pf = new VEIL.Platformer(e, level);
    this.player = this.pf.player;
    this.compassAngle = 0;
    this.pf.onBossKilled = () => self._win();
    this.pf.onSlam = (x, y) => { e.audio.sfx('slam'); };

    // build (but do not begin) the boss
    this.boss = this.pf.addBoss(ARENA_X, ARENA_FLOOR, this._bossCfg());
  }
  exit() { this.e.grade = null; }

  // ---------------------------------------------------------
  // story beats
  // ---------------------------------------------------------
  _intro() {
    VEIL.dialogue.play(VEIL.story.act4Intro, () => {
      this.e.state.abilities.block = true;
      this.e.state.abilities.groundSlam = true;
      VEIL.ui.toast('Earth Gauntlets — Block (F) · Ground Slam (↓ in air)', 5);
      this.e.audio.sfx('ability');
    });
  }
  _whisper(i) {
    const lines = [
      'Stone forgets nothing. It only waits to fall.',
      'A bridge is a promise — and promises crack.',
      'Bear the weight. Do not let it bear you.',
    ];
    VEIL.ui.toast('✦ ' + lines[i % lines.length], 4.5);
    this.e.audio.sfx('whisper');
  }
  // press-E lore: a cliff mural (short narration)
  _mural(i) {
    const m = VEIL.story.murals[i % VEIL.story.murals.length];
    // defer one frame so the same 'E' press doesn't instantly advance the dialogue
    setTimeout(() => VEIL.dialogue.play([{ who: 'narrator', text: m }]), 0);
  }
  // press-E lore: reveal an Echo of the Veil and record it
  _echo(id) {
    const ec = VEIL.story.echoes.find((x) => x.id === id);
    if (!ec) return;
    this.e.state.flags['echo_' + id] = true; this.e.save();
    setTimeout(() => VEIL.dialogue.play([
      { who: 'narrator', text: '✦ Echo of the Veil — “' + ec.title + '”' },
      { who: 'narrator', text: ec.text },
    ]), 0);
  }
  _startBoss() {
    if (this.bossStarted || !this.boss) return;
    this.bossStarted = true;
    this.boss.begin();
    this.e.camera.shake(0.4);
    VEIL.ui.banner('Guardian', 'Corrupted Golem', 'The Weight of Life');
    VEIL.ui.toast('Block the pound (F) — strike the core when it glows gold', 5);
  }
  _win() {
    this.player.vx = 0;
    this.e.camera.shake(0.6);
    VEIL.dialogue.play(VEIL.story.act4Win, () => {
      VEIL.completeRealm('earth', null, 'earth', 'act5_water');
    });
  }

  // ---------------------------------------------------------
  // BOSS DEFINITION — Corrupted Golem
  // ---------------------------------------------------------
  _bossCfg() {
    return {
      name: 'Corrupted Golem', title: 'Guardian of the Weight of Life',
      hp: 420, color: '#5a3f2a', tint: '#9a6bff', style: 'golem',
      w: 104, h: 124, phases: 3, armored: true, chase: false,
      cdMin: 0.8, cdMax: 1.6,
      onPhase: (b, phase) => {
        b.world.camera.shake(0.6);
        VEIL.ui.toast(phase === 2 ? '✦ The Golem buckles — it begins to charge!' : '✦ The core blazes — the Golem rages!', 3);
        // escalate: tighter recovery windows as it weakens
        b.cfg.cdMin = Math.max(0.45, 0.8 - phase * 0.14);
        b.cfg.cdMax = Math.max(0.9, 1.6 - phase * 0.22);
      },
      attacks: [
        this._atkGroundPound(),
        this._atkBoulders(),
        this._atkCharge(),
      ],
    };
  }

  // 1) GROUND POUND — the core loop. Rear up, slam, ground shockwave,
  //    then expose the gold core (vuln) so the player can punish.
  _atkGroundPound() {
    return {
      name: 'pound', tele: 0.8, dur: 0.42, rec: 0.6, vuln: 1.6, minPhase: 0,
      onStart(b) { b.data.raised = 0; b.vx = 0; },
      telegraph(b, dt) {
        // rear back: lift slightly, dust gathers under fists
        b.data.raised = U.lerp(b.data.raised, 1, dt * 6);
        b.vy = Math.min(b.vy, -40 * b.data.raised);
        if (U.chance(0.6)) b.world.particles.emit({
          x: b.x + b.w / 2 + U.rand(-b.w * 0.5, b.w * 0.5), y: b.floorY,
          vx: U.rand(-30, 30), vy: U.rand(-90, -20), life: 0.5, r: 4,
          color: '#c9974f', color2: '#5a4030',
        });
      },
      run(b, dt, phase) {
        if (b.data.struck) return;
        b.data.struck = true;
        b.vy = 900; // drive the fists down
        b.world.camera.shake(0.7);
        b.e.audio.sfx('slam');
        // wide ground shockwave hitbox sweeping out from the golem
        const reach = 300 + phase * 60;
        const box = { x: b.x + b.w / 2 - reach, y: b.floorY - 38, w: reach * 2, h: 60 };
        b.hitPlayer(box, 18);
        // dust shock ring + ground cracks
        b.world.particles.burst(b.x + b.w / 2, b.floorY, 30, {
          color: '#f4c560', color2: '#8a5a2b', ang: -Math.PI / 2, spread: 1.5,
          spdMax: 420, lifeMax: 0.7, rMax: 8,
        });
        for (let i = 0; i < 16; i++) {
          const dir = i < 8 ? -1 : 1;
          b.world.particles.emit({
            x: b.x + b.w / 2, y: b.floorY,
            vx: dir * U.rand(120, 360), vy: U.rand(-160, -40), g: 900,
            life: U.rand(0.4, 0.8), r: U.rand(3, 7), color: '#8a5a2b', color2: '#c9974f',
          });
        }
        // launch a couple of low debris projectiles outward in later phases
        if (phase >= 2) {
          for (const d of [-1, 1]) b.shoot({
            x: b.x + b.w / 2 + d * b.w * 0.4, y: b.floorY - 16,
            vx: d * 300, vy: -260, g: 760, dmg: 13, color: '#9a6bff', r: 9, life: 2,
          });
        }
      },
    };
  }

  // 2) BOULDER THROW — arcing corrupted boulders toward the player.
  _atkBoulders() {
    return {
      name: 'boulders', tele: 0.6, dur: 0.5, rec: 0.7, vuln: 0, minPhase: 1,
      onStart(b) { b.data.thrown = 0; b.data.count = 1 + b.phase; },
      telegraph(b, dt) {
        // gather a boulder above the raised arm
        if (U.chance(0.5)) b.world.particles.emit({
          x: b.x + b.w / 2 + b.face * 28 + U.rand(-12, 12), y: b.y - 6 + U.rand(-12, 12),
          vx: U.rand(-20, 20), vy: U.rand(-20, 20), life: 0.4, r: 4, color: '#9a6bff',
        });
      },
      run(b, dt) {
        // release boulders in a small spread across the act window
        const step = 0.5 / b.data.count;
        const want = Math.min(b.data.count, Math.floor(b.t / step) + 1);
        while (b.data.thrown < want) {
          const i = b.data.thrown++;
          const p = b.world.player;
          const sx = b.x + b.w / 2 + b.face * 30, sy = b.y - 8;
          const dx = p.cx - sx;
          // aim with a lobbing arc; spread successive throws
          const spread = (i - (b.data.count - 1) / 2) * 70;
          b.shoot({
            x: sx, y: sy, vx: U.clamp(dx * 1.0, -560, 560) * 0.55 + spread,
            vy: -360, g: 720, dmg: 14, color: '#9a6bff', r: 11, life: 3,
          });
          b.e.audio.sfx('corrupt');
          b.world.camera.shake(0.12);
        }
      },
    };
  }

  // 3) CHARGE / SWEEP — (phase 2+) lunge across the arena with a sweeping fist.
  _atkCharge() {
    return {
      name: 'charge', tele: 0.7, dur: 0.7, rec: 0.9, vuln: 1.1, minPhase: 2,
      onStart(b) {
        const p = b.world.player;
        b.face = U.sign(p.cx - (b.x + b.w / 2)) || b.face;
        b.data.hit = false;
      },
      telegraph(b, dt) {
        // crouch + scrape dust, eyes flare
        b.vx = U.approach(b.vx, -b.face * 40, 200 * dt);
        if (U.chance(0.6)) b.world.particles.emit({
          x: b.x + b.w / 2 - b.face * b.w * 0.4, y: b.floorY,
          vx: -b.face * U.rand(60, 160), vy: U.rand(-40, 0), life: 0.4, r: 4,
          color: '#c9974f',
        });
      },
      run(b, dt) {
        b.vx = b.face * 560;
        // sweeping hitbox in front of the golem
        const box = { x: b.face > 0 ? b.x + b.w - 10 : b.x - 66, y: b.y + 10, w: 76, h: b.h - 16 };
        if (!b.data.hit) { const before = b.world.player.iframe; b.hitPlayer(box, 20); if (b.world.player.iframe > before) b.data.hit = true; }
        if (U.chance(0.7)) b.world.particles.emit({
          x: b.x + b.w / 2, y: b.floorY, vx: -b.face * U.rand(80, 220), vy: U.rand(-60, 10),
          life: 0.5, r: 5, color: '#8a5a2b', color2: '#c9974f', g: 600,
        });
      },
    };
  }

  // ---------------------------------------------------------
  // loop
  // ---------------------------------------------------------
  update(dt) {
    this.t += dt;
    this.pf.update(dt);

    // compass points toward the arena/goal
    const target = this.bossStarted ? GOAL_X : ARENA_X;
    const dx = target - this.player.cx;
    this.compassAngle = U.lerp(this.compassAngle, Math.atan2(-0.18, dx), dt * 4);

    // dust + rubble drift
    const camx = this.pf.camera.x;
    for (const m of this.motes) {
      m.x += m.vx * dt; m.y += m.vy * dt + Math.sin(this.t * 0.6 + m.ph) * 4 * dt;
      if (m.x > camx + this.e.W + 40) m.x = camx - 40;
      if (m.y > 740) m.y = -10; if (m.y < -20) m.y = 720;
    }
    for (const f of this.flecks) {
      f.y += f.v * dt; f.x -= 10 * dt;
      if (f.y > 760) { f.y = -10; f.x = camx + U.rand(0, this.e.W); }
    }
  }
  draw(ctx) { this.pf.draw(ctx); }

  // =========================================================
  // PARALLAX BACKDROP — the "stunning" part.
  // Layered canyon mesas, dust haze, a hazy ochre sun.
  // =========================================================
  _bg(ctx, w, t) {
    const { W, H } = this.e; const cam = w.camera;

    // sky: warm dust-laden gradient, ochre high to deep umber low
    draw.vGrad(ctx, 0, 0, W, H, [
      [0, '#3a2412'], [0.32, '#6e4420'], [0.55, '#a9682c'],
      [0.74, '#c98a3c'], [1, '#7a5024'],
    ]);

    // hazy ochre sun, low and large, very slow parallax
    const sx = W * 0.66 - cam.x * 0.02, sy = H * 0.40;
    draw.glow(ctx, sx, sy, 360, '#f4c560', 0.30);
    draw.glow(ctx, sx, sy, 150, '#ffe6a8', 0.55);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = U.rgba('#ffe6a8', 0.9);
    ctx.beginPath(); ctx.arc(sx, sy, 46, 0, U.TAU); ctx.fill();
    ctx.restore();

    // banded dust haze sweeping across the sun
    ctx.save(); ctx.globalAlpha = 0.5;
    for (let i = 0; i < 4; i++) {
      const hy = H * (0.30 + i * 0.06) + Math.sin(t * 0.15 + i) * 6;
      draw.hGradBand(ctx, hy, 26 + i * 6, U.rgba('#d89a52', 0.18));
    }
    ctx.restore();

    // ---- far mesa range (silhouette table-mountains) — slow ----
    this._mesas(ctx, cam.x * 0.06, H * 0.56, 150, 92, '#7a4a26', 11, 0.85);
    draw.mist(ctx, H * 0.52, 140, '#c98a3c', t, 0.12);
    // ---- mid mesa range — flat tops, steep sides ----
    this._mesas(ctx, cam.x * 0.16, H * 0.66, 200, 118, '#5e3618', 27, 0.95);
    // distant violet corruption seeping into a far canyon
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    draw.glow(ctx, W * 0.30 - cam.x * 0.10, H * 0.60, 120, '#9a6bff', 0.18);
    draw.glow(ctx, W * 0.82 - cam.x * 0.12, H * 0.58, 90, '#9a6bff', 0.14);
    ctx.restore();
    draw.mist(ctx, H * 0.64, 150, '#8a5a2b', t + 4, 0.14);
    // ---- near canyon ridge — jagged, dark, faster ----
    this._ridge(ctx, cam.x * 0.34, H * 0.80, 130, '#3a2110', 41);
    // ---- closest cliff shoulders framing the bottom ----
    this._ridge(ctx, cam.x * 0.52, H * 0.92, 110, '#23130a', 57);
    draw.mist(ctx, H * 0.84, 140, '#6e4420', t + 2, 0.16);
  }

  // flat-topped table mesas, deterministic per seed
  _mesas(ctx, off, baseY, w, h, color, seed, alpha) {
    const { W, H } = this.e; const rng = U.seed(seed);
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.translate(-(off % (w * 2.4)), 0);
    ctx.fillStyle = color;
    for (let x = -w * 2; x < W + w * 2.4; x += w * 1.6) {
      const mh = h * (0.6 + rng() * 0.8);
      const mw = w * (0.6 + rng() * 0.7);
      const top = baseY - mh;
      const taper = mw * 0.16;
      ctx.beginPath();
      ctx.moveTo(x, H);
      ctx.lineTo(x + taper, top + 6);
      // slightly eroded flat top
      const notch = rng() * 8;
      ctx.lineTo(x + taper + 4, top);
      ctx.lineTo(x + mw - taper - 4, top - notch);
      ctx.lineTo(x + mw - taper, top + 6);
      ctx.lineTo(x + mw, H);
      ctx.closePath(); ctx.fill();
      // warm rim light on the sun-facing edge
      ctx.save();
      ctx.strokeStyle = U.rgba('#f4c560', 0.12); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + mw - taper - 4, top - notch); ctx.lineTo(x + mw - taper, top + 6); ctx.lineTo(x + mw, H * 0.86);
      ctx.stroke(); ctx.restore();
    }
    ctx.restore();
  }

  _ridge(ctx, off, baseY, amp, color, seed) {
    const { W, H } = this.e; const rng = U.seed(seed);
    ctx.save(); ctx.translate(-(off % 640), 0);
    ctx.beginPath(); ctx.moveTo(-120, H); ctx.lineTo(-120, baseY);
    let y = baseY;
    for (let x = -120; x <= W + 760; x += 36) {
      y += (rng() - 0.5) * amp * 0.5;
      y = U.clamp(y, baseY - amp, baseY + amp * 0.35);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W + 760, H); ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
    ctx.restore();
  }

  // mid layer (world-space, behind solids): ambient gold dust columns + arena haze
  _mid(ctx, w, t) {
    const { H } = this.e;
    // soft god-rays slanting from the sun across the world
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const rx = 700 + i * 920 + Math.sin(t * 0.1 + i) * 30;
      const g = ctx.createLinearGradient(rx, 0, rx - 220, H);
      g.addColorStop(0, U.rgba('#f4c560', 0.05));
      g.addColorStop(1, U.rgba('#f4c560', 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(rx, -20); ctx.lineTo(rx + 90, -20);
      ctx.lineTo(rx - 130, H); ctx.lineTo(rx - 320, H);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();

    // arena: a violet corruption seam pulsing in the back wall while the boss lives
    if (this.boss && (this.boss.active || (this.boss.dead && this.boss.dying < 1.4))) {
      const pulse = 0.5 + Math.sin(t * 3) * 0.25;
      draw.glow(ctx, ARENA_X, ARENA_FLOOR - 120, 220, '#9a6bff', 0.18 * pulse);
    }
  }

  // foreground (screen-space): dust motes, rubble flecks, bottom haze
  _fg(ctx, w, t) {
    const { W, H } = this.e; const camx = w.camera.x;
    // dust motes
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const m of this.motes) {
      const x = m.x - camx; if (x < -20 || x > W + 20) continue;
      const a = (0.18 + Math.sin(t * 1.4 + m.ph) * 0.14);
      ctx.fillStyle = U.rgba(m.gold ? '#f4c560' : '#e8c79a', U.clamp(a, 0, 0.5));
      ctx.beginPath(); ctx.arc(x, m.y, m.r, 0, U.TAU); ctx.fill();
    }
    ctx.restore();
    // falling rubble flecks
    ctx.save(); ctx.fillStyle = '#3a2110'; ctx.globalAlpha = 0.5;
    for (const f of this.flecks) {
      const x = f.x - camx; if (x < -10 || x > W + 10) continue;
      ctx.fillRect(x, f.y, f.r, f.r * 1.6);
    }
    ctx.restore();
    // warm bottom haze
    draw.mist(ctx, H * 0.86, 120, '#8a5a2b', t, 0.18);
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

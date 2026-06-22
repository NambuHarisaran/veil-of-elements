/* ============================================================
   ACT V — Water Realm, "Echoes of Reflection"
   A sunken temple beneath a crystal lake. Caustic light ripples,
   drifting bubbles, refracted god-rays, submerged columns.
   Tool of this realm: Slow Time (R). The boss is a watery echo of
   the disciple — fast and aggressive at normal speed, beatable when
   the player slows time (the clone runs on time-scaled dt; you do not).
   Palette: deep crystal blues/teals · gold #f4c560 vs violet #9a6bff.
   ============================================================ */
(function () {
"use strict";
const VEIL = window.VEIL;
const U = VEIL.U, draw = VEIL.draw;

VEIL.scenes['act5_water'] = class WaterScene {
  enter(e) {
    this.e = e; this.t = 0; this.hud = true; this.canPause = true;
    e.audio.resume(); e.audio.music(VEIL.story.realms.water.music);
    e.grade = { color: '#1a4a6a', amount: 0.16 };
    const r = VEIL.story.realms.water;
    VEIL.ui.banner(r.kicker, r.title, r.sub);

    // ---- ambient field: drifting bubbles + suspended motes (world space) ----
    this.bubbles = Array.from({ length: 90 }, () => ({
      x: U.rand(0, 5000), y: U.rand(0, 760), r: U.rand(1.2, 5), v: U.rand(22, 70),
      wob: U.rand(0, 10), ws: U.rand(0.6, 1.8),
    }));
    this.motes = Array.from({ length: 70 }, () => ({
      x: U.rand(0, 5000), y: U.rand(0, 760), r: U.rand(0.4, 1.8), ph: U.rand(0, 10),
      vx: U.rand(-8, 8), vy: U.rand(-5, 5),
    }));
    // caustic bands — precomputed sine offsets for the moving light overlay
    this.caustics = Array.from({ length: 7 }, (_, i) => ({ off: i * 0.9, spd: 0.4 + i * 0.06, amp: 16 + i * 5 }));

    const T = { platform: '#1f4a64', platformEdge: '#5fd0ff', accent: '#9a6bff' };
    const self = this;

    // ---- moving platforms (animated in onUpdate; easier to time with Slow Time) ----
    this.movers = [
      { ref: null, base: { x: 1980, y: 470 }, ax: 0, ay: 120, spd: 1.1, ph: 0 },   // vertical lift
      { ref: null, base: { x: 3060, y: 620 }, ax: 200, ay: 0, spd: 0.85, ph: 1.6 }, // horizontal ferry
    ];

    const level = {
      width: 5000, killY: 940, spawn: { x: 90, y: 560 }, theme: T,
      vignette: 0.6, vignetteColor: '#02101e',
      solids: [
        // --- opening sanctum floor ---
        { x: -60, y: 600, w: 720, h: 200 },
        { x: 360, y: 470, w: 150, h: 16, oneway: true },
        // --- first submerged steps ---
        { x: 760, y: 620, w: 300, h: 180 },
        { x: 900, y: 500, w: 140, h: 16, oneway: true },
        { x: 1160, y: 560, w: 320, h: 220 },
        { x: 1320, y: 430, w: 150, h: 16, oneway: true },
        // --- collapsed colonnade gap (vertical mover #0 bridges it) ---
        { x: 1580, y: 600, w: 280, h: 200 },
        { x: 2160, y: 560, w: 360, h: 220 },   // landing after the lift
        { x: 2300, y: 430, w: 150, h: 16, oneway: true },
        // --- mid ruin shelves ---
        { x: 2620, y: 620, w: 300, h: 180 },
        { x: 2760, y: 490, w: 140, h: 16, oneway: true },
        // --- ferry crossing (horizontal mover #1) over a drop ---
        { x: 2960, y: 660, w: 80, h: 140 },     // small pillar start
        { x: 3420, y: 600, w: 360, h: 200 },    // far landing
        { x: 3560, y: 470, w: 150, h: 16, oneway: true },
        // --- approach to arena ---
        { x: 3880, y: 620, w: 320, h: 180 },
        // --- BOSS ARENA (flat flooded plaza) ---
        { x: 4180, y: 640, w: 860, h: 220 },
        // (arena side columns are drawn as decoration in _props — NOT solids,
        //  so they neither wall off the entrance nor obstruct the chase fight)
      ],
      hazards: [
        // submerged spike-coral in the colonnade pit
        { x: 1880, y: 760, w: 260, h: 30, dmg: 16 },
        { x: 3060, y: 800, w: 340, h: 30, dmg: 16 },
      ],
      checkpoints: [ { x: 1320, y: 560 }, { x: 2700, y: 620 }, { x: 3960, y: 620 } ],
      enemies: [
        { kind: 'wisp', x: 1180, y: 440, opts: { tint: '#5fd0ff', color: '#3a6a9a' } },
        { kind: 'wisp', x: 1700, y: 460, opts: { tint: '#5fd0ff', color: '#3a6a9a' } },
        { kind: 'spitter', x: 2360, y: 560, opts: { tint: '#5fd0ff', color: '#2a4a6a' } },
        { kind: 'wisp', x: 2820, y: 420, opts: { tint: '#5fd0ff', color: '#3a6a9a' } },
        { kind: 'spitter', x: 3620, y: 600, opts: { tint: '#5fd0ff', color: '#2a4a6a' } },
        { kind: 'wisp', x: 4020, y: 480, opts: { tint: '#5fd0ff', color: '#3a6a9a' } },
      ],
      triggers: [
        // start: Nerai speaks, then grant Slow Time
        { x: 120, y: 0, w: 80, h: 800, once: true, onEnter: () => self._intro() },
        // lore whispers near submerged murals
        { x: 1180, y: 0, w: 60, h: 800, once: true, onEnter: () => self._whisper('The mirror keeps every face it has ever held.') },
        { x: 2640, y: 0, w: 60, h: 800, once: true, onEnter: () => self._whisper('Slow the water, and you slow what swims in it.') },
        // arena gate: summon the reflection
        { x: 4260, y: 0, w: 70, h: 800, once: true, onEnter: () => self._arena() },
      ],
      interactables: [
        { x: 320, y: 600, markY: 576, r: 70, label: 'Worn rune', color: '#9a6bff', once: true, keepMarker: true, sfx: 'fragment',
          onInteract: () => VEIL.story.revealEcho(VEIL.engine, 'mirror') },
      ],
      goal: { x: 5020, y: 0, color: '#5fd0ff', show: false },
      paintBg: (ctx, w, t) => self._bg(ctx, w, t),
      paintMid: (ctx, w, t) => self._mid(ctx, w, t),
      paintProps: (ctx, w, t) => self._props(ctx, w, t),
      paintFg: (ctx, w, t) => self._fg(ctx, w, t),
    };

    this.pf = new VEIL.Platformer(e, level);
    this.player = this.pf.player;
    this.compassAngle = 0;
    this.arenaStarted = false;

    // moving platforms — added as live solids so player physics collides with them;
    // their x/y are animated each frame in _levelUpdate. Easier to time with Slow Time.
    this._ensureMover(0, 130, 18);
    this._ensureMover(1, 130, 18);

    this.pf.onUpdate = (dt) => self._levelUpdate(dt);
    this.pf.onBossKilled = () => self._win();
  }

  _ensureMover(i, w, h) {
    const m = this.movers[i];
    if (!m.ref) {
      const s = { x: m.base.x, y: m.base.y, w, h, style: 'mover', oneway: false };
      this.pf.solids.push(s);
      m.ref = s;
    }
  }

  exit() { this.e.grade = null; }

  // ---------- story flow ----------
  _intro() {
    const self = this;
    VEIL.dialogue.play(VEIL.story.act5Intro, () => {
      self.e.state.abilities.timeSlow = true;
      VEIL.ui.toast('Flow Staff — Slow Time (R)', 5);
      self.e.audio.sfx('fragment');
      self.player.world.particles.burst(self.player.cx, self.player.cy, 26, { color: '#5fd0ff', color2: '#bfeeff', spdMax: 240, lifeMax: 0.8 });
    });
  }
  _whisper(text) { VEIL.ui.toast('“' + text + '”', 4); this.e.audio.sfx('whisper'); }

  _arena() {
    if (this.arenaStarted) return; this.arenaStarted = true;
    const self = this;
    this.e.audio.sfx('corrupt'); this.pf.camera.shake(0.4);
    VEIL.ui.toast('The water stills… something rises from the mirror.', 3.4);
    // spawn the reflection clone on the arena floor
    const arenaFloorY = 640, arenaX = 4760;
    this.boss = this.pf.addBoss(arenaX, arenaFloorY, this._bossCfg());
    // brief beat, then begin
    setTimeout(() => { if (self.boss && !self.boss.dead) self.boss.begin(); }, 900);
  }

  _win() {
    this.player.vx = 0;
    this.pf.camera.shake(0.5);
    const fx = this.boss ? this.boss.x : this.player.cx;
    this.player.world.particles.burst(fx, this.player.cy, 30, { color: '#5fd0ff', color2: '#f4c560', spdMax: 320, lifeMax: 1 });
    VEIL.dialogue.play(VEIL.story.act5Win, () => VEIL.completeRealm('water', null, 'water', 'act6_fire'));
  }

  // ---------- BOSS: Nerai's Reflection (watery echo of the disciple) ----------
  _bossCfg() {
    return {
      name: 'Nerai’s Reflection', title: 'Echo of Reflection',
      hp: 360, color: '#2a5a7a', tint: '#5fd0ff', style: 'wraith',
      w: 40, h: 60, phases: 2, chase: true, speed: 130, cdMin: 0.7, cdMax: 1.4,
      attacks: [
        // (1) MIRROR LUNGE — fast telegraphed dash, the player's cue to slow time
        {
          name: 'lunge', tele: 0.42, dur: 0.30, rec: 0.7, vuln: 0.7,
          onStart(b) { b.data.dir = U.sign(b.world.player.cx - (b.x + b.w / 2)) || b.face; },
          telegraph(b, dt) {
            b.vx = U.approach(b.vx, 0, 900 * dt);
            if (U.chance(0.5)) b.world.particles.emit({ x: b.x + b.w / 2 - b.data.dir * 18, y: b.y + b.h / 2, vx: -b.data.dir * 60, vy: U.rand(-20, 20), life: 0.3, r: 5, color: '#bfeeff' });
          },
          run(b, dt, phase) {
            const lunge = phase >= 2 ? 720 : 560;
            b.vx = b.data.dir * lunge;
            // a trailing slash hitbox riding the body
            const hb = { x: b.data.dir > 0 ? b.x + b.w - 8 : b.x - 46, y: b.y + 4, w: 54, h: b.h - 8 };
            b.hitPlayer(hb, 16);
            b.world.particles.emit({ x: b.x + b.w / 2, y: b.y + b.h / 2, vx: -b.data.dir * 120, vy: U.rand(-30, 30), life: 0.3, r: 6, color: '#5fd0ff', color2: '#9a6bff' });
          },
        },
        // (2) MIRRORED SHARD — quick aimed projectile; phase 2 fires a second offset shard
        {
          name: 'shard', tele: 0.5, dur: 0.2, rec: 0.6, vuln: 0.5,
          telegraph(b, dt) {
            b.vx = U.approach(b.vx, 0, 700 * dt);
            const cx = b.x + b.w / 2, cy = b.y + b.h * 0.4;
            if (U.chance(0.6)) b.world.particles.emit({ x: cx + b.face * 16, y: cy, vx: b.face * 30, vy: 0, life: 0.25, r: 4, color: '#bfeeff' });
          },
          run(b, dt, phase) {
            if (b.data.fired) return; b.data.fired = true;
            const p = b.world.player;
            const sx = b.x + b.w / 2, sy = b.y + b.h * 0.4;
            const a = Math.atan2(p.cy - sy, p.cx - sx);
            const spd = phase >= 2 ? 460 : 380;
            b.shoot({ x: sx, y: sy, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, dmg: 13, color: '#5fd0ff', r: 9, life: 3 });
            if (phase >= 2) {
              const a2 = a + 0.28;
              b.shoot({ x: sx, y: sy, vx: Math.cos(a2) * spd, vy: Math.sin(a2) * spd, dmg: 13, color: '#9a6bff', r: 9, life: 3 });
            }
            b.e.audio.sfx('corrupt');
            b.world.particles.burst(sx, sy, 8, { color: '#bfeeff', color2: '#5fd0ff', spdMax: 200, lifeMax: 0.4 });
          },
        },
        // (3) REFLECTING TIDE — phase 2 only: a brief homing droplet, punishes standing still
        {
          name: 'tide', tele: 0.55, dur: 0.25, rec: 0.8, vuln: 0.55, minPhase: 2,
          telegraph(b, dt) { b.vx = U.approach(b.vx, 0, 800 * dt); b.world.particles.emit({ x: b.x + b.w / 2, y: b.y, vx: 0, vy: -40, life: 0.4, r: 5, color: '#9a6bff' }); },
          run(b, dt, phase) {
            if (b.data.fired) return; b.data.fired = true;
            const cx = b.x + b.w / 2, cy = b.y + b.h * 0.4;
            b.shoot({ x: cx, y: cy - 6, vx: b.face * 120, vy: -120, dmg: 12, color: '#5fd0ff', r: 8, life: 3.2, homing: 1.6 });
            b.e.audio.sfx('ability');
          },
        },
      ],
      onPhase(b, phase) {
        if (phase >= 2) { VEIL.ui.toast('The reflection sharpens — it moves faster now.', 3); b.cfg.speed = 175; }
      },
      // a watery mirror-image of the hooded disciple — cyan core, violet cloak, glowing
      drawBody(b, ctx, cx, cy, flashing) {
        ctx.save();
        ctx.translate(cx, cy);
        const sway = Math.sin(b.anim * 3) * 2;
        const f = b.face;
        // soft watery halo
        draw.glow(ctx, 0, 0, b.w * 1.1, '#5fd0ff', 0.25 + Math.sin(b.anim * 4) * 0.05);
        // rippling vertical refraction shimmer behind the figure
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.4;
        for (let i = -2; i <= 2; i++) {
          const rx = i * 7 + Math.sin(b.anim * 5 + i) * 3;
          ctx.fillStyle = U.rgba('#bfeeff', 0.10);
          ctx.fillRect(rx - 1.5, -b.h * 0.5, 3, b.h);
        }
        ctx.restore();

        // legs (mirror of the disciple's stance)
        ctx.strokeStyle = U.rgba('#9a6bff', 0.85); ctx.lineWidth = 6; ctx.lineCap = 'round';
        const ls = Math.sin(b.anim * 6) * (Math.abs(b.vx) > 40 ? 8 : 2);
        ctx.beginPath(); ctx.moveTo(-4, b.h * 0.12); ctx.lineTo(-4 + ls, b.h * 0.5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(4, b.h * 0.12); ctx.lineTo(4 - ls, b.h * 0.5); ctx.stroke();

        // flowing violet cloak
        const cg = ctx.createLinearGradient(0, -b.h * 0.5, 0, b.h * 0.5);
        cg.addColorStop(0, flashing ? '#ffffff' : '#6b46c0');
        cg.addColorStop(1, flashing ? '#cfe8ff' : '#2a1a5a');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.moveTo(-b.w * 0.5, -b.h * 0.28);
        ctx.quadraticCurveTo(-b.w * 0.6 + sway, b.h * 0.2, -b.w * 0.32 + sway, b.h * 0.48);
        ctx.lineTo(b.w * 0.32 - sway, b.h * 0.48);
        ctx.quadraticCurveTo(b.w * 0.6 - sway, b.h * 0.2, b.w * 0.5, -b.h * 0.28);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = U.rgba('#5fd0ff', 0.6); ctx.lineWidth = 1.5; ctx.stroke();

        // torso
        ctx.fillStyle = flashing ? '#fff' : '#1f3a6a';
        draw.roundRect(ctx, -b.w * 0.26, -b.h * 0.32, b.w * 0.52, b.h * 0.46, 7); ctx.fill();
        // cyan core (the seed of reflection)
        const coreCol = b.vulnerable ? '#f4c560' : '#5fd0ff';
        draw.glow(ctx, 0, -b.h * 0.08, 14, coreCol, 0.9);
        ctx.fillStyle = '#eafcff'; ctx.beginPath(); ctx.arc(0, -b.h * 0.08, 3.6, 0, U.TAU); ctx.fill();

        // hood / head
        ctx.fillStyle = flashing ? '#fff' : '#23305c';
        ctx.beginPath();
        ctx.moveTo(-10, -b.h * 0.30);
        ctx.quadraticCurveTo(0, -b.h * 0.56, 10, -b.h * 0.30);
        ctx.quadraticCurveTo(f * 6, -b.h * 0.26, 0, -b.h * 0.26);
        ctx.closePath(); ctx.fill();
        // face shadow + glowing cyan eyes (gold when vulnerable)
        ctx.fillStyle = '#06121f'; ctx.beginPath(); ctx.ellipse(f * 2, -b.h * 0.33, 7, 6, 0, 0, U.TAU); ctx.fill();
        ctx.fillStyle = b.vulnerable ? '#f4c560' : '#5fd0ff'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(f * 4, -b.h * 0.34, 1.6, 0, U.TAU); ctx.fill(); ctx.shadowBlur = 0;

        // mirrored staff (the Flow Staff's reflection)
        ctx.save(); ctx.translate(f * 9, -b.h * 0.18);
        const swingA = b.state === 'act' && b.cur && b.cur.name === 'lunge' ? f * (0.3 + Math.sin(b.t * 14) * 0.4) : f * (Math.sin(b.anim * 2) * 0.08 - 0.28);
        ctx.rotate(swingA);
        ctx.strokeStyle = '#1a2a4a'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, -16); ctx.stroke();
        const bg = ctx.createLinearGradient(0, -16, 0, -38);
        bg.addColorStop(0, '#bfeeff'); bg.addColorStop(1, U.rgba('#5fd0ff', 0.2));
        ctx.strokeStyle = bg; ctx.lineWidth = 4; ctx.shadowColor = '#5fd0ff'; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(0, -40); ctx.stroke();
        draw.glow(ctx, 0, -40, 11, '#5fd0ff', 0.85);
        ctx.restore();

        ctx.restore();
      },
    };
  }

  // ---------- per-frame level logic ----------
  _levelUpdate(dt) {
    // animate moving platforms (real dt so timing is consistent; player feels
    // them slow visually relative to enemies during time-slow but the platform
    // motion itself stays predictable — Slow Time still helps reaction timing).
    const ts = this.e.timeScale;
    const at = this.t; // accumulated scene time
    for (const m of this.movers) {
      if (!m.ref) continue;
      const ph = at * m.spd + m.ph;
      m.ref.x = m.base.x + Math.sin(ph) * m.ax;
      m.ref.y = m.base.y + (m.ay ? (Math.sin(ph) * 0.5 + 0.5) * m.ay : 0);
    }
    // bubbles rise (slowed slightly under time-slow for cohesion)
    const bdt = dt * (0.4 + ts * 0.6);
    for (const b of this.bubbles) {
      b.y -= b.v * bdt;
      b.x += Math.sin(this.t * b.ws + b.wob) * 12 * bdt;
      if (b.y < -10) { b.y = 770; b.x = U.rand(0, 5000); }
    }
    for (const m of this.motes) {
      m.x += m.vx * bdt; m.y += m.vy * bdt;
      if (m.x < -20) m.x = 5020; else if (m.x > 5020) m.x = -20;
      if (m.y < -20) m.y = 770; else if (m.y > 770) m.y = -20;
    }
  }

  update(dt) {
    this.t += dt;
    this.pf.update(dt);
    // compass points toward the arena / goal
    const dx = this.pf.goal.x - this.pf.player.cx;
    this.compassAngle = U.lerp(this.compassAngle, Math.atan2(-0.2, dx), dt * 4);
    if (VEIL.compass) VEIL.compass.set(this.compassAngle);
  }

  draw(ctx) { this.pf.draw(ctx); }

  // ============================================================
  //  UNDERWATER TEMPLE BACKDROP — parallax + caustics + god-rays
  // ============================================================
  _bg(ctx, w, t) {
    const { W, H } = this.e; const cam = w.camera;
    // deep crystal-blue water column
    draw.vGrad(ctx, 0, 0, W, H, [
      [0, '#0a3a5e'], [0.32, '#0a2c4a'], [0.62, '#072036'], [1, '#031320'],
    ]);
    // pale light disc — the lake surface sun, refracted, high parallax-slow
    const sx = W * 0.62 - cam.x * 0.04, sy = H * 0.16;
    draw.glow(ctx, sx, sy, 280, '#bfeeff', 0.30);
    draw.glow(ctx, sx, sy, 120, '#eafcff', 0.35);

    // --- refracted god-rays slanting from the surface ---
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
      const baseX = (i / 7) * (W + 400) - 200 + Math.sin(t * 0.25 + i) * 26 - cam.x * 0.05;
      const sweep = Math.sin(t * 0.35 + i * 1.3) * 50;
      const topW = 26 + Math.sin(t * 0.5 + i) * 10;
      const g = ctx.createLinearGradient(baseX, 0, baseX + 160 + sweep, H);
      g.addColorStop(0, U.rgba('#9fe4ff', 0.12));
      g.addColorStop(0.5, U.rgba('#5fd0ff', 0.05));
      g.addColorStop(1, U.rgba('#5fd0ff', 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(baseX - topW, 0); ctx.lineTo(baseX + topW, 0);
      ctx.lineTo(baseX + 140 + sweep, H); ctx.lineTo(baseX - 60 + sweep, H);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();

    // --- far temple silhouette (the great drowned ziggurat), slow parallax ---
    this._farTemple(ctx, cam.x * 0.08, H);

    // --- mid columns layer (broken submerged colonnade) ---
    this._columnRow(ctx, cam.x * 0.20, H * 0.62, 120, 9, '#0c2c46', 0.9);
    // drifting silt mist between layers
    draw.mist(ctx, H * 0.55, 150, '#0e4060', t * 0.6, 0.10);
    this._columnRow(ctx, cam.x * 0.36, H * 0.74, 170, 7, '#0a2238', 1);
    draw.mist(ctx, H * 0.7, 150, '#08283e', t * 0.5 + 4, 0.12);

    // --- caustic light bands cast on the water (moving overlay) ---
    this._caustics(ctx, t, cam);
  }

  _farTemple(ctx, off, H) {
    const { W } = this.e;
    ctx.save(); ctx.globalAlpha = 0.55; ctx.translate(-(off % 900), 0);
    for (let base = -200; base < W + 1100; base += 900) {
      // stepped ziggurat silhouette
      const bx = base, by = H * 0.78;
      ctx.fillStyle = '#0a2740';
      const steps = 5, sw = 260, sh = 36;
      for (let s = 0; s < steps; s++) {
        const w = sw - s * 44, x = bx + (sw - w) / 2, y = by - s * sh;
        ctx.fillRect(x, y, w, sh + 1);
      }
      // crowning archway with a faint cyan light within
      const ax = bx + sw / 2, ay = by - steps * sh;
      ctx.fillStyle = '#0c2c48';
      ctx.beginPath(); ctx.moveTo(ax - 34, ay); ctx.lineTo(ax - 34, ay - 40);
      ctx.quadraticCurveTo(ax, ay - 78, ax + 34, ay - 40); ctx.lineTo(ax + 34, ay); ctx.closePath(); ctx.fill();
      draw.glow(ctx, ax, ay - 26, 40, '#5fd0ff', 0.18);
    }
    ctx.restore();
  }

  _columnRow(ctx, off, baseY, height, count, color, scale) {
    const { W } = this.e; const span = (W + 480) / count;
    ctx.save(); ctx.translate(-(off % span), 0);
    const rng = U.seed((baseY * 7) | 0);
    for (let i = -1; i <= count + 1; i++) {
      const x = i * span + 30;
      const broken = rng() < 0.4;
      const h = height * (broken ? 0.45 + rng() * 0.3 : 1) * scale;
      const cw = 30 * scale;
      // shaft
      const g = ctx.createLinearGradient(x, baseY - h, x, baseY);
      g.addColorStop(0, U.lerpColor(color, '#5fd0ff', 0.12));
      g.addColorStop(1, U.lerpColor(color, '#000', 0.3));
      ctx.fillStyle = g;
      ctx.fillRect(x - cw / 2, baseY - h, cw, h);
      // capital / base blocks
      ctx.fillStyle = U.lerpColor(color, '#000', 0.15);
      ctx.fillRect(x - cw / 2 - 5, baseY - h, cw + 10, 9);
      ctx.fillRect(x - cw / 2 - 6, baseY - 9, cw + 12, 9);
      // fluting highlight
      ctx.strokeStyle = U.rgba('#5fd0ff', 0.10); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x - cw * 0.2, baseY - h + 10); ctx.lineTo(x - cw * 0.2, baseY - 6); ctx.stroke();
    }
    ctx.restore();
  }

  // caustic light ripples — overlapping additive sine bands that crawl across
  _caustics(ctx, t, cam) {
    const { W, H } = this.e;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const c of this.caustics) {
      const baseY = H * (0.12 + c.off * 0.11);
      ctx.beginPath();
      const phase = t * c.spd + c.off * 3 - cam.x * 0.0006;
      for (let x = -20; x <= W + 20; x += 18) {
        const y = baseY + Math.sin(x * 0.012 + phase) * c.amp + Math.sin(x * 0.031 + phase * 1.7) * (c.amp * 0.4);
        if (x === -20) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.lineWidth = 2 + Math.sin(t + c.off) * 1.2;
      ctx.strokeStyle = U.rgba('#aef0ff', 0.05 + c.off * 0.004);
      ctx.shadowColor = '#5fd0ff'; ctx.shadowBlur = 16;
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---- world-space decals BEHIND solids (sunken murals on the floor pillars) ----
  _mid(ctx, w, t) {
    const cam = w.camera;
    // glowing rune-mirrors on a few back walls
    const marks = [ { x: 1190, y: 460 }, { x: 2650, y: 560 }, { x: 4280, y: 420 } ];
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const m of marks) {
      if (m.x < cam.x - 80 || m.x > cam.x + this.e.W + 80) continue;
      const pulse = 0.4 + Math.sin(t * 1.5 + m.x) * 0.2;
      draw.glow(ctx, m.x, m.y, 46, '#9a6bff', 0.12 * pulse);
      ctx.strokeStyle = U.rgba('#bfeeff', 0.3 * pulse); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(m.x, m.y, 22, 0, U.TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(m.x, m.y, 14, t * 0.6, t * 0.6 + Math.PI * 1.4); ctx.stroke();
    }
    ctx.restore();
  }

  // ---- props drawn within camera space, above solids: arena ring + bubbles caught behind ----
  _props(ctx, w, t) {
    const cam = w.camera;
    // arena framing columns (decorative only — drawn here so they don't wall
    // off the entrance or obstruct the chase fight). Tall submerged pillars.
    for (const cx of [4235, 5005]) {
      if (cx < cam.x - 60 || cx > cam.x + this.e.W + 60) continue;
      const top = 360, botY = 640, cw = 30;
      const g = ctx.createLinearGradient(cx, top, cx, botY);
      g.addColorStop(0, U.lerpColor('#0c2c46', '#5fd0ff', 0.14));
      g.addColorStop(1, U.lerpColor('#0c2c46', '#000', 0.3));
      ctx.fillStyle = g; ctx.fillRect(cx - cw / 2, top, cw, botY - top);
      ctx.fillStyle = U.lerpColor('#0c2c46', '#000', 0.15);
      ctx.fillRect(cx - cw / 2 - 6, top, cw + 12, 10);
      ctx.fillRect(cx - cw / 2 - 7, botY - 10, cw + 14, 10);
      ctx.strokeStyle = U.rgba('#5fd0ff', 0.12); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx - 5, top + 12); ctx.lineTo(cx - 5, botY - 8); ctx.stroke();
    }
    // boss arena ritual ring on the plaza floor
    if (this.arenaStarted) {
      const ax = 4610, ay = 640;
      if (ax > cam.x - 400 && ax < cam.x + this.e.W + 400) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const a = this.boss && this.boss.dead ? U.clamp(1 - (this.boss.dying || 0), 0, 1) : 1;
        ctx.globalAlpha = a;
        ctx.strokeStyle = U.rgba('#5fd0ff', 0.35); ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(ax, ay - 2, 360, 30, 0, 0, U.TAU); ctx.stroke();
        ctx.strokeStyle = U.rgba('#9a6bff', 0.25); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(ax, ay - 2, 300, 24, 0, 0, U.TAU); ctx.stroke();
        // slow-rotating glyph marks
        for (let i = 0; i < 6; i++) {
          const ang = t * 0.5 + (i / 6) * U.TAU;
          const gx = ax + Math.cos(ang) * 330, gy = ay - 2 + Math.sin(ang) * 26;
          draw.glow(ctx, gx, gy, 10, '#bfeeff', 0.5);
        }
        ctx.restore();
      }
    }
  }

  // ---- foreground: bubbles, suspended motes, surface shimmer (screen space) ----
  _fg(ctx, w, t) {
    const { W, H } = this.e; const cam = w.camera;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    // rising bubbles
    for (const b of this.bubbles) {
      const sx = b.x - cam.x, sy = b.y;
      if (sx < -10 || sx > W + 10) continue;
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = U.rgba('#cfeeff', 0.5);
      ctx.beginPath(); ctx.arc(sx, sy, b.r, 0, U.TAU); ctx.fill();
      // little highlight
      ctx.fillStyle = U.rgba('#ffffff', 0.6);
      ctx.beginPath(); ctx.arc(sx - b.r * 0.3, sy - b.r * 0.3, b.r * 0.35, 0, U.TAU); ctx.fill();
    }
    // suspended motes (parallax drift)
    for (const m of this.motes) {
      const sx = m.x - cam.x * 0.85, sy = m.y;
      const wx = U.wrap(sx, W + 40) - 20;
      ctx.globalAlpha = 0.3 + Math.sin(t * 1.5 + m.ph) * 0.2;
      draw.glow(ctx, wx, sy, m.r * 3, '#9fe4ff', 0.5);
    }
    ctx.restore();

    // top-of-screen surface shimmer (you are deep below it)
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.22);
    g.addColorStop(0, U.rgba('#bfeeff', 0.10)); g.addColorStop(1, U.rgba('#bfeeff', 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.22);
    for (let x = 0; x < W; x += 40) {
      const y = 6 + Math.sin(t * 1.4 + x * 0.03) * 5 + Math.sin(t * 2.1 + x * 0.07) * 3;
      ctx.fillStyle = U.rgba('#eafcff', 0.06);
      ctx.fillRect(x, y, 30, 3);
    }
    ctx.restore();

    // bottom silt haze
    draw.mist(ctx, H * 0.86, 110, '#0a3048', t * 0.4, 0.16);

    // subtle blue color cast over everything (deep-water feel)
    ctx.save(); ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = U.rgba('#1a6a9a', 0.18); ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
};

})();

/* ============================================================
   Veil of the Elements — Player & Combat
   Articulated procedural character: skeletal rig + 2-bone IK,
   foot planting, velocity-driven squash & stretch, anticipation,
   follow-through, verlet cape (secondary motion), per-state poses.
   Physics, hitboxes and the public API are unchanged.

   world provides:
     solids[], enemies[], hazards[], particles, camera, engine,
     spawnDamage(x,y,amt,col), spawnProjectile(opts),
     onPlayerDeath(), gravity(optional)
   ============================================================ */
(function () {
"use strict";
const VEIL = window.VEIL;
const U = VEIL.U, draw = VEIL.draw;

const C = {
  W: 30, H: 52,
  GRAV: 2400, MAXFALL: 1320, GLIDEFALL: 210,
  RUN: 330, ACC_G: 3000, ACC_A: 1900, FRIC: 2600,
  JUMP: 770, JUMPCUT: 0.42,
  COYOTE: 0.10, BUFFER: 0.12,
  DASH: 720, DASHTIME: 0.16, DASHCD: 0.62,
  IFRAME: 0.7,
};

/* ------------------------------------------------------------
   Rig proportions (local space, origin at the feet, y-up = −y)
   ------------------------------------------------------------ */
const RIG = {
  hipY: -26, chestY: -39, neckY: -45, headY: -52, headR: 8.4,
  shoulderY: -42, shoulderX: 5.5, hipX: 5,
  thigh: 15, shin: 15,          // leg bones (slack gives a readable knee bend)
  upperArm: 12, foreArm: 11,    // arm bones
  stride: 26, stepH: 13,        // run cycle (wider stride => natural cadence)
};

/* Two-bone IK. Returns mid joint (knee/elbow) + clamped end effector.
   `bend` (+1/−1) selects which way the joint folds. */
function ik2(ax, ay, bx, by, l1, l2, bend) {
  let dx = bx - ax, dy = by - ay;
  let dist = Math.hypot(dx, dy) || 0.0001;
  const max = l1 + l2 - 0.02, min = Math.abs(l1 - l2) + 0.02;
  if (dist > max) { dx *= max / dist; dy *= max / dist; dist = max; }
  else if (dist < min) { dx *= min / dist; dy *= min / dist; dist = min; }
  const base = Math.atan2(dy, dx);
  const cosa = U.clamp((dist * dist + l1 * l1 - l2 * l2) / (2 * dist * l1), -1, 1);
  const a = Math.acos(cosa) * bend;
  const ja = base + a;
  return { jx: ax + Math.cos(ja) * l1, jy: ay + Math.sin(ja) * l1, ex: ax + dx, ey: ay + dy };
}

class Player {
  constructor(world, x, y) {
    this.world = world; this.e = world.engine;
    this.x = x; this.y = y; this.w = C.W; this.h = C.H;
    this.vx = 0; this.vy = 0;
    this.face = 1; this.onGround = false; this.wasGround = false;
    this.coyote = 0; this.buffer = 0;
    this.anim = 0; this.runT = 0;
    this.state = 'idle';
    // combat
    this.atkTimer = 0; this.combo = 0; this.comboWin = 0; this.atkType = null;
    this.hitSet = null; this.attackQueued = false;
    this.dashTime = 0; this.dashCd = 0; this.iframe = 0;
    this.blocking = false; this.parryWin = 0; this.blockHold = 0;
    this.hurt = 0; this.dead = false; this.deadT = 0;
    this.slamming = false; this.slamCd = 0;
    this.slowCd = 0; this.slowTime = 0;
    this.emberCd = 0; this.heat = 0;
    this.gliding = false;
    this.spawnX = x; this.spawnY = y;
    this.hitFlash = 0;
    this.invulnStart = 0;
    this._fallV = 0;            // last-frame vertical speed (for landing impact)
    // --- animation state ---
    this.legPhase = 0;          // run-cycle phase
    this.breath = U.rand(0, 7);  // idle breathing
    this.sq = 0; this.sqVel = 0; // squash & stretch spring
    this.armWind = 0;            // attack follow-through
    this.lookY = 0; this.lean = 0;
    this.landAnim = 0; this.launchAnim = 0;
    this.turnT = 0; this._animFace = 1;   // quick-pivot squash on direction change
    this.ghosts = [];           // dash afterimages
    this.cape = this._initCape();
    // foot planting (world-locked stance feet) + pose blending
    this.feet = [{ x: RIG.hipX, y: 0, wx: 0, planted: false }, { x: -RIG.hipX, y: 0, wx: 0, planted: false }];
    this._lastTargets = null; this._blendFrom = null; this._blendT = 1; this._lastDrawnState = 'idle';
  }
  get ab() { return this.e.state.abilities; }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  _initCape() {
    const n = 8, nodes = [];
    for (let i = 0; i < n; i++) nodes.push({ x: 0, y: i * 5.5, px: 0, py: i * 5.5 });
    return nodes;
  }

  damage(amt, fromX) {
    if (this.dead || this.iframe > 0 || this.dashTime > 0) return;
    // block / parry
    if (this.blocking) {
      const facingHit = U.sign(fromX - this.cx) === this.face;
      if (facingHit) {
        if (this.parryWin > 0) { // PARRY!
          this.e.audio.sfx('parry'); this.e.freeze(0.09); this.world.camera.shake(0.3);
          this.world.particles.burst(this.cx + this.face * 22, this.cy, 22, { color: '#ffe6a8', color2: '#9a6bff', spdMax: 320, lifeMax: 0.5, rMax: 5 });
          this.world.onParry && this.world.onParry(this);
          this.e.state.hp = U.clamp(this.e.state.hp + 3, 0, this.e.state.maxHp);
          return;
        }
        amt *= 0.25; // blocked
        this.world.camera.shake(0.12);
        this.world.particles.burst(this.cx + this.face * 18, this.cy, 8, { color: '#cfe8ff', spdMax: 160, lifeMax: 0.3 });
      }
    }
    this.e.state.hp -= amt;
    this.hurt = 0.35; this.iframe = C.IFRAME; this.hitFlash = 0.2;
    this.vx = U.sign(this.cx - fromX) * 260; this.vy = -260;
    this.e.audio.sfx('hurt'); this.world.camera.shake(0.35);
    this.world.particles.burst(this.cx, this.cy, 12, { color: '#ff6a8a', spdMax: 220, lifeMax: 0.5 });
    if (this.e.state.hp <= 0) this.die();
  }
  die() {
    if (this.dead) return;
    this.dead = true; this.deadT = 0; this.e.state.hp = 0;
    this.e.audio.sfx('corrupt'); this.world.camera.shake(0.6);
    this.world.particles.burst(this.cx, this.cy, 30, { color: '#9a6bff', color2: '#f4c560', spdMax: 280, lifeMax: 1 });
  }
  respawn() {
    this.dead = false; this.deadT = 0; this.x = this.spawnX; this.y = this.spawnY;
    this.vx = this.vy = 0; this.e.state.hp = this.e.state.maxHp; this.iframe = 1;
    this.sq = 0; this.sqVel = 0; this.ghosts.length = 0;
  }
  setSpawn(x, y) { this.spawnX = x; this.spawnY = y; }

  update(dt) {
    const inp = this.e.input;
    if (this.dead) { this.deadT += dt; this.vy += C.GRAV * dt; this._moveY(dt); this._animUpdate(dt); if (this.deadT > 1.6) this.world.onPlayerDeath && this.world.onPlayerDeath(); return; }
    if (this.e.paused) return;

    // timers
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.slamCd = Math.max(0, this.slamCd - dt);
    this.slowCd = Math.max(0, this.slowCd - dt);
    this.emberCd = Math.max(0, this.emberCd - dt);
    this.iframe = Math.max(0, this.iframe - dt);
    this.hurt = Math.max(0, this.hurt - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.comboWin = Math.max(0, this.comboWin - dt);
    if (this.comboWin <= 0 && this.atkTimer <= 0) this.combo = 0;
    this.heat = Math.max(0, this.heat - dt * 0.5);

    // time-slow active timer (real-time)
    if (this.slowTime > 0) { this.slowTime -= dt; if (this.slowTime <= 0) this.e.timeScale = 1; }

    const inputLock = this.atkTimer > 0 && this.atkType === 'heavy';
    const dirX = (inp.down('right') ? 1 : 0) - (inp.down('left') ? 1 : 0);

    // ---- dash ----
    if (inp.pressed('dash') && this.ab.dash && this.dashCd <= 0 && this.dashTime <= 0) {
      this.dashTime = C.DASHTIME; this.dashCd = C.DASHCD; this.iframe = Math.max(this.iframe, C.DASHTIME + 0.04);
      const d = dirX !== 0 ? dirX : this.face; this.face = d;
      this.vx = d * C.DASH; this.vy = 0;
      this.e.audio.sfx('dash'); this.world.camera.shake(0.12);
    }
    if (this.dashTime > 0) {
      this.dashTime -= dt;
      this.world.particles.emit({ x: this.cx - this.face * 6, y: this.cy + U.rand(-14, 14), vx: -this.face * 40, vy: 0, life: 0.3, r: 7, r2: 1, color: '#cfe8ff', color2: '#9a6bff' });
      this.vx = U.approach(this.vx, this.face * C.RUN, 1200 * dt);
    } else {
      // ---- horizontal movement ----
      if (!inputLock) {
        if (dirX !== 0) { this.face = dirX; this.vx = U.approach(this.vx, dirX * C.RUN, (this.onGround ? C.ACC_G : C.ACC_A) * dt); }
        else this.vx = U.approach(this.vx, 0, (this.onGround ? C.FRIC : C.ACC_A * 0.6) * dt);
      } else this.vx = U.approach(this.vx, 0, C.FRIC * 1.4 * dt);
    }

    // ---- jump ----
    if (this.onGround) this.coyote = C.COYOTE; else this.coyote -= dt;
    if (inp.pressed('jump')) this.buffer = C.BUFFER; else this.buffer -= dt;
    if (this.buffer > 0 && this.coyote > 0 && this.dashTime <= 0 && !this.slamming) {
      this.vy = -C.JUMP; this.onGround = false; this.coyote = 0; this.buffer = 0;
      this.launchAnim = 1; this.sq = -0.30; this.sqVel = -2.0;   // stretch on launch
      this.e.audio.sfx('jump');
      this.world.particles.burst(this.cx, this.y + this.h, 8, { color: '#cfe8ff', ang: -Math.PI / 2, spread: 0.9, spdMax: 140, lifeMax: 0.35, rMax: 4 });
    }
    if (!inp.down('jump') && this.vy < 0) this.vy *= Math.pow(C.JUMPCUT, dt * 60);

    // ---- glide (Air) ----
    this.gliding = false;
    if (this.ab.glide && !this.onGround && this.vy > 0 && inp.down('jump') && this.dashTime <= 0) {
      this.gliding = true; this.vy = Math.min(this.vy, C.GLIDEFALL);
      if (U.chance(0.5)) this.world.particles.emit({ x: this.cx + U.rand(-20, 20), y: this.y, vx: U.rand(-30, 30), vy: -20, life: 0.5, r: 3, color: '#cfe8ff' });
    }

    // ---- ground slam (Earth) ----
    if (this.ab.groundSlam && !this.onGround && !this.slamming && this.dashTime <= 0 && inp.pressed('down') && this.slamCd <= 0) {
      this.slamming = true; this.vy = 1500; this.vx = 0; this.e.audio.sfx('ability');
    }
    if (this.slamming) {
      this.vy = Math.max(this.vy, 1400);
      this.world.particles.emit({ x: this.cx + U.rand(-12, 12), y: this.cy, vx: 0, vy: -60, life: 0.3, r: 6, color: '#c9974f' });
    }

    // ---- ember shot (Fire) ----
    if (this.ab.emberShot && inp.pressed('ability') && this.emberCd <= 0 && this.heat < 1) {
      this.emberCd = 0.42; this.heat = Math.min(1, this.heat + 0.22);
      this.world.spawnProjectile && this.world.spawnProjectile({
        x: this.cx + this.face * 20, y: this.cy - 4, vx: this.face * 620, vy: 0,
        dmg: 16, owner: 'player', color: '#ff7a3c', r: 8, life: 1.2,
      });
      this.e.audio.sfx('ability');
      this.world.particles.burst(this.cx + this.face * 22, this.cy - 4, 6, { color: '#ffd27a', color2: '#ff5a2a', ang: this.face > 0 ? 0 : Math.PI, spread: 0.5, spdMax: 200, lifeMax: 0.3 });
    }

    // ---- time slow (Water) : press R ----
    if (this.ab.timeSlow && inp.pressed('r') && this.slowCd <= 0 && this.slowTime <= 0) {
      this.slowTime = 3.4; this.slowCd = 8; this.e.timeScale = 0.34;
      this.e.audio.sfx('ability'); this.world.camera.shake(0.1);
      this.world.particles.burst(this.cx, this.cy, 26, { color: '#5fd0ff', color2: '#bfeeff', spdMax: 260, lifeMax: 0.8 });
    }

    // ---- block / parry (hold F) ----
    const wantBlock = this.ab.block && inp.down('block') && this.onGround && this.dashTime <= 0 && this.atkTimer <= 0;
    if (wantBlock && !this.blocking) { this.blocking = true; this.parryWin = 0.18; this.e.audio.sfx('ui'); }
    if (this.blocking) { this.parryWin = Math.max(0, this.parryWin - dt); if (!wantBlock) this.blocking = false; this.vx = U.approach(this.vx, 0, C.FRIC * 2 * dt); }

    // ---- attacks ----
    if ((inp.pressed('attack') || inp.pressed('heavy')) && this.dashTime <= 0 && !this.blocking && !this.slamming) {
      const heavy = inp.pressed('heavy');
      if (this.atkTimer <= 0) this._startAttack(heavy ? 'heavy' : 'light');
      else if (this.atkType === 'light' && this.comboWin > 0) this.attackQueued = heavy ? 'heavy' : 'light';
    }
    if (this.atkTimer > 0) {
      this.atkTimer -= dt;
      this._attackHits();
      if (this.atkTimer <= 0 && this.attackQueued) { const q = this.attackQueued; this.attackQueued = false; this._startAttack(q); }
    }

    // ---- gravity & integrate ----
    this.vy += C.GRAV * dt;
    if (this.vy > C.MAXFALL) this.vy = C.MAXFALL;
    this.wasGround = this.onGround;
    this._moveX(dt); this._moveY(dt);

    // landing
    if (this.onGround && !this.wasGround) {
      if (this.slamming) this._slamImpact();
      else if (this.vy >= 0) {
        const hard = Math.abs(this._fallV) > 700;
        this.landAnim = 1; this.sq = U.clamp(0.18 + Math.abs(this._fallV) / 4200, 0.18, 0.5); this.sqVel = 0;
        this.e.audio.sfx('land'); if (hard) this.world.camera.shake(0.12);
        this.world.particles.burst(this.cx, this.y + this.h, hard ? 9 : 6, { color: '#e8e0cf', ang: -Math.PI / 2, spread: 1.2, spdMax: hard ? 150 : 110, lifeMax: 0.3, rMax: 3 });
      }
    }

    // hazards
    for (const hz of (this.world.hazards || [])) {
      if (U.aabb(this, hz)) this.damage(hz.dmg || 18, hz.x + hz.w / 2);
    }
    // fell out of world
    if (this.world.killY !== undefined && this.y > this.world.killY) this.damage(9999, this.cx);

    this.anim += dt;
    if (Math.abs(this.vx) > 30 && this.onGround) this.runT += dt * (Math.abs(this.vx) / C.RUN) * 12; else this.runT = U.lerp(this.runT, 0, dt * 8);
    this._fallV = this.vy;
    this.state = this.dead ? 'dead' : (!this.onGround ? (this.gliding ? 'glide' : (this.vy < 0 ? 'jump' : 'fall')) : (this.atkTimer > 0 ? 'attack' : (Math.abs(this.vx) > 30 ? 'run' : 'idle')));
    this._animUpdate(dt);
  }

  // -------- animation drivers (no gameplay effect) --------
  _animUpdate(dt) {
    dt = Math.min(dt, 1 / 30);
    this.breath += dt;
    this.landAnim = Math.max(0, this.landAnim - dt * 3.2);
    this.launchAnim = Math.max(0, this.launchAnim - dt * 3.6);
    // quick pivot when changing facing while moving — masks the instant mirror
    if (this.face !== this._animFace) {
      if (Math.abs(this.vx) > 40 || this.state === 'run') this.turnT = 1;
      this._animFace = this.face;
    }
    this.turnT = Math.max(0, this.turnT - dt / 0.12);
    // squash & stretch spring — near-critical damping settles cleanly (no ringing jitter)
    const k = 320, c = 26;
    this.sqVel += (-k * this.sq - c * this.sqVel) * dt;
    this.sq = U.clamp(this.sq + this.sqVel * dt, -0.45, 0.55);
    // run leg phase — cadence matched to speed so a foot-locked stance doesn't skate
    if (this.onGround && Math.abs(this.vx) > 30) this.legPhase += dt * (Math.PI * Math.abs(this.vx) / RIG.stride) * 0.9;
    this._footUpdate(dt);
    // pose-blend bookkeeping: cross-fade control targets when the state changes
    if (this.state !== this._lastDrawnState) {
      // snap into fast actions; cross-fade everything else (incl. attack recovery)
      const snappy = this.state === 'attack' || this.state === 'dash' || this.dashTime > 0 || this.slamming;
      this._blendFrom = snappy ? null : this._lastTargets;
      this._blendT = snappy ? 1 : 0;
      this._lastDrawnState = this.state;
    }
    if (this._blendT < 1) this._blendT = Math.min(1, this._blendT + dt / 0.14);
    // body lean from horizontal velocity (+ a little when airborne)
    const target = U.clamp(this.vx / C.RUN, -1, 1) * (this.onGround ? 0.14 : 0.20);
    this.lean = U.lerp(this.lean, target, U.clamp(dt * 10, 0, 1));
    // head pitch: look down when falling, up when rising
    const ly = U.clamp(this.vy / 1600, -1, 1) * 2.4;
    this.lookY = U.lerp(this.lookY, this.onGround ? 0 : ly, U.clamp(dt * 8, 0, 1));
    // attack follow-through residue
    this.armWind = Math.max(0, this.armWind - dt * 4);
    // dash afterimages
    if (this.dashTime > 0) { if (!this._ghostT || this.anim - this._ghostT > 0.02) { this._ghostT = this.anim; this.ghosts.push({ x: this.cx, y: this.y + this.h, face: this.face, life: 0.22, lean: this.lean }); } }
    for (let i = this.ghosts.length - 1; i >= 0; i--) { this.ghosts[i].life -= dt; if (this.ghosts[i].life <= 0) this.ghosts.splice(i, 1); }
    this._capeUpdate(dt);
  }

  // verlet cloth cape, simulated in the character's local forward space
  _capeUpdate(dt) {
    const nodes = this.cape;
    const seg = 5.5, grav = 70;
    // anchor follows the back shoulder; trail opposes motion
    const sp = (this.vx * this.face) / C.RUN;          // forward speed (signed by facing)
    const windX = -sp * 7 - (this.gliding ? 9 : 0) + Math.sin(this.anim * 3) * 1.4;
    const windY = (this.onGround ? 0 : -this.vy * 0.012) + (this.gliding ? -6 : 0);
    nodes[0].x = -RIG.shoulderX * 0.5; nodes[0].y = RIG.neckY + 2;  // pinned to upper back
    for (let i = 1; i < nodes.length; i++) {
      const nd = nodes[i];
      let vx = (nd.x - nd.px) * 0.86, vy = (nd.y - nd.py) * 0.86;
      nd.px = nd.x; nd.py = nd.y;
      nd.x += vx + windX * dt; nd.y += vy + (grav + windY) * dt;
    }
    for (let it = 0; it < 4; it++) {
      nodes[0].x = -RIG.shoulderX * 0.5; nodes[0].y = RIG.neckY + 2;
      for (let i = 1; i < nodes.length; i++) {
        const a = nodes[i - 1], b = nodes[i];
        let dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy) || 0.0001;
        const diff = (d - seg) / d;
        b.x -= dx * diff; b.y -= dy * diff;
        if (b.y < a.y - 1) b.y = a.y - 1;       // never swing above anchor much
      }
    }
  }

  // world-locked foot planting for the run cycle
  _footUpdate(dt) {
    if (this.state !== 'run') { this.feet[0].planted = false; this.feet[1].planted = false; return; }
    const stride = RIG.stride, stepH = RIG.stepH, face = this.face;
    for (let i = 0; i < 2; i++) {
      const ph = U.wrap(this.legPhase + i * Math.PI, U.TAU);
      const f = this.feet[i];
      if (ph < Math.PI) { // stance: planted in world, slides backward in local space as the body advances
        if (!f.planted) {
          f.planted = true; f.wx = this.cx + (stride * 0.5) * face;
          if (Math.abs(this.vx) > 130) { // footfall feedback
            this.e.audio.sfx('step');
            this.world.particles.burst(f.wx, this.y + this.h, 3, { color: '#e8e0cf', ang: -Math.PI / 2, spread: 1.3, spdMax: 70, lifeMax: 0.26, rMax: 2.4 });
          }
        }
        f.x = (f.wx - this.cx) * face; f.y = 0;
      } else { // swing: lift and carry forward to the next plant point
        f.planted = false;
        const t = (ph - Math.PI) / Math.PI;
        f.x = U.lerp(-stride * 0.5, stride * 0.5, t);
        f.y = -Math.sin(t * Math.PI) * stepH;
      }
    }
  }

  _startAttack(type) {
    this.atkType = type;
    if (type === 'heavy') { this.atkTimer = 0.42; this.combo = 0; this.e.audio.sfx('heavy'); }
    else { this.combo = (this.combo % 3) + 1; this.atkTimer = 0.26; this.comboWin = 0.5; this.e.audio.sfx('attack'); }
    this.hitSet = new Set();
    this.armWind = 1;
    if (!this.onGround && type === 'light') this.vy = Math.min(this.vy, 60);
    // little forward lunge
    this.vx += this.face * (type === 'heavy' ? 120 : 70);
  }
  _attackHits() {
    // hitbox active in the mid portion of the swing
    const t = this.atkType === 'heavy' ? 0.42 : 0.26;
    const phase = 1 - this.atkTimer / t;
    if (phase < 0.15 || phase > 0.7) return;
    const reach = this.atkType === 'heavy' ? 64 : 52;
    const hb = { x: this.face > 0 ? this.x + this.w - 6 : this.x - reach + 6, y: this.y + 6, w: reach, h: this.h - 12 };
    const dmg = this.atkType === 'heavy' ? 34 : [0, 11, 12, 17][this.combo];
    for (const en of this.world.enemies) {
      if (en.dead || (en.invuln && en.invuln > 0)) continue;
      if (this.hitSet.has(en)) continue;
      if (U.aabb(hb, en)) {
        this.hitSet.add(en);
        const kb = this.atkType === 'heavy' ? 520 : 240;
        en.takeHit(dmg, this.face, { kb, ky: this.atkType === 'heavy' ? -260 : -120 });
        this.world.spawnDamage(en.x + en.w / 2, en.y, dmg, this.atkType === 'heavy' ? '#ffb347' : '#ffe6a8');
        this.e.freeze(this.atkType === 'heavy' ? 0.085 : 0.05);
        this.world.camera.shake(this.atkType === 'heavy' ? 0.32 : 0.18);
        this.world.particles.burst(en.x + en.w / 2, en.y + en.h / 2, this.atkType === 'heavy' ? 16 : 9, { color: '#ffe6a8', color2: '#ff7a3c', spdMax: 300, lifeMax: 0.4, rMax: 5 });
        if (this.heat > 0) this.world.particles.burst(en.x + en.w / 2, en.y + en.h / 2, 4, { color: '#ff7a3c', spdMax: 180, lifeMax: 0.3 });
      }
    }
    // destructible / puzzle nodes
    if (this.world.onPlayerStrike) this.world.onPlayerStrike(hb, dmg, this);
  }
  _slamImpact() {
    this.slamming = false; this.slamCd = 1.2;
    this.sq = 0.5; this.sqVel = 0;
    this.e.audio.sfx('slam'); this.world.camera.shake(0.5); this.e.freeze(0.06);
    const R = 130;
    this.world.particles.burst(this.cx, this.y + this.h, 26, { color: '#c9974f', color2: '#f4c560', ang: -Math.PI / 2, spread: 1.4, spdMax: 360, lifeMax: 0.6, rMax: 7 });
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI - Math.PI; this.world.particles.emit({ x: this.cx, y: this.y + this.h, vx: Math.cos(a) * 280, vy: Math.sin(a) * 120 - 40, g: 800, life: 0.6, r: 6, color: '#8a5a2b' }); }
    for (const en of this.world.enemies) {
      if (en.dead) continue;
      if (Math.abs(en.x + en.w / 2 - this.cx) < R && Math.abs(en.y + en.h / 2 - (this.y + this.h)) < 90) {
        en.takeHit(28, U.sign(en.x + en.w / 2 - this.cx) || 1, { kb: 420, ky: -380 });
        this.world.spawnDamage(en.x + en.w / 2, en.y, 28, '#c9974f');
      }
    }
    if (this.world.onSlam) this.world.onSlam(this.cx, this.y + this.h, R);
  }

  // ---- collision ----
  _moveX(dt) {
    this.x += this.vx * dt;
    for (const s of this.world.solids) {
      if (s.oneway) continue;
      if (U.aabb(this, s)) {
        if (this.vx > 0) this.x = s.x - this.w; else if (this.vx < 0) this.x = s.x + s.w;
        this.vx = 0;
      }
    }
  }
  _moveY(dt) {
    this.y += this.vy * dt;
    this.onGround = false;
    for (const s of this.world.solids) {
      if (!U.aabb(this, s)) continue;
      if (s.oneway) {
        if (this.vy > 0 && (this.y + this.h) - this.vy * dt <= s.y + 6 && !this.e.input.down('down')) { this.y = s.y - this.h; this.vy = 0; this.onGround = true; }
        continue;
      }
      if (this.vy > 0) { this.y = s.y - this.h; this.vy = 0; this.onGround = true; }
      else if (this.vy < 0) { this.y = s.y + s.h; this.vy = 0; }
    }
  }

  /* ============================================================
     POSE — control targets in local forward space, then 2-bone IK.
     (origin = feet, +x = facing direction, −y = up).
     Targets are cross-faded on state change; IK is solved from the
     blended targets so bone lengths always stay valid.
     ============================================================ */
  _poseTargets() {
    const st = this.state;
    const breath = Math.sin(this.breath * 1.8) * 1.0;
    const sway = Math.sin(this.breath * 0.9) * 0.6;

    let hip = { x: 0, y: RIG.hipY };
    let chest = { x: 0, y: RIG.chestY };
    let bob = 0;

    // ---- legs ----
    let footF, footB, kneeBend = 1;
    if (st === 'run') {
      bob = (Math.cos(this.legPhase * 2) - 1) * 1.1;   // smooth double-bounce (no kink)
      footF = { x: this.feet[0].x + RIG.hipX, y: this.feet[0].y };
      footB = { x: this.feet[1].x - RIG.hipX, y: this.feet[1].y };
    } else if (st === 'jump' || st === 'fall' || st === 'glide') {
      const fall = st === 'fall' || st === 'glide';
      footF = { x: RIG.hipX + (fall ? 3 : 7), y: fall ? -2 : -10 };
      footB = { x: -RIG.hipX - (fall ? 8 : 3), y: fall ? -1 : -5 };
    } else if (st === 'attack') {
      footF = { x: RIG.hipX + 10, y: 0 };
      footB = { x: -RIG.hipX - 6, y: 0 };
      hip.x = 2;
    } else { // idle / block
      const shift = sway;
      footF = { x: RIG.hipX + 3 + shift, y: 0 };
      footB = { x: -RIG.hipX - 2 + shift, y: 0 };
      bob = breath * 0.5;
      hip.x = shift * 0.6;
    }
    hip.y += this.landAnim * 4; chest.y += this.landAnim * 3;
    hip.y += bob; chest.y += bob * 0.7;
    const hipF = { x: hip.x + RIG.hipX, y: hip.y };
    const hipB = { x: hip.x - RIG.hipX, y: hip.y };

    // ---- spine / head ----
    chest.x += sway * 0.4;
    const neck = { x: chest.x + this.lean * 6, y: RIG.neckY + bob * 0.6 };
    const head = { x: neck.x + this.lean * 5, y: RIG.headY + this.lookY * 0.4 + bob * 0.5 };
    const shoulderF = { x: chest.x + RIG.shoulderX, y: RIG.shoulderY + bob * 0.6 };
    const shoulderB = { x: chest.x - RIG.shoulderX, y: RIG.shoulderY + bob * 0.6 };

    // ---- arms ----
    let handF, handB, elbowBendF = 1, elbowBendB = -1;
    const swingPhase = this.legPhase;
    if (st === 'run') {
      handB = { x: RIG.shoulderX + Math.cos(swingPhase) * 7 + 2, y: RIG.hipY + 4 + Math.max(0, Math.sin(swingPhase)) * 3 };
      handF = { x: RIG.shoulderX + Math.cos(swingPhase + Math.PI) * 6 + 4, y: RIG.hipY + 2 };
    } else if (st === 'attack') {
      handF = this._attackHand();
      handB = { x: -RIG.shoulderX - 2, y: RIG.hipY + 6 };
    } else if (this.blocking) {
      handF = { x: RIG.shoulderX + 12, y: RIG.chestY + 6 };
      handB = { x: 0, y: RIG.hipY + 4 };
    } else if (st === 'glide') {
      handF = { x: RIG.shoulderX + 16, y: RIG.shoulderY - 2 };
      handB = { x: -RIG.shoulderX - 14, y: RIG.shoulderY - 1 }; elbowBendB = 1;
    } else if (st === 'jump' || st === 'fall') {
      handF = { x: RIG.shoulderX + 6, y: RIG.chestY - (st === 'jump' ? 6 : 0) };
      handB = { x: -RIG.shoulderX - 4, y: RIG.chestY + 4 };
    } else { // idle
      handF = { x: RIG.shoulderX + 7 + sway, y: RIG.hipY + 8 + breath * 0.4 };
      handB = { x: -RIG.shoulderX - 1 + sway, y: RIG.hipY + 4 };
    }
    return { hip, chest, neck, head, shoulderF, shoulderB, hipF, hipB, footF, footB, handF, handB, elbowBendF, elbowBendB, kneeBend, bob };
  }

  _solvePose(T) {
    const legF = ik2(T.hipF.x, T.hipF.y, T.footF.x, T.footF.y, RIG.thigh, RIG.shin, T.kneeBend);
    const legB = ik2(T.hipB.x, T.hipB.y, T.footB.x, T.footB.y, RIG.thigh, RIG.shin, T.kneeBend);
    const armF = ik2(T.shoulderF.x, T.shoulderF.y, T.handF.x, T.handF.y, RIG.upperArm, RIG.foreArm, T.elbowBendF);
    const armB = ik2(T.shoulderB.x, T.shoulderB.y, T.handB.x, T.handB.y, RIG.upperArm, RIG.foreArm, T.elbowBendB);
    return { hip: T.hip, chest: T.chest, neck: T.neck, head: T.head, shoulderF: T.shoulderF, shoulderB: T.shoulderB,
      hipF: T.hipF, hipB: T.hipB, handF: T.handF, handB: T.handB, bob: T.bob, legF, legB, armF, armB };
  }

  _lerpTargets(a, b, t) {
    const P = (ka, kb) => ({ x: U.lerp(ka.x, kb.x, t), y: U.lerp(ka.y, kb.y, t), ang: kb.ang });
    return {
      hip: P(a.hip, b.hip), chest: P(a.chest, b.chest), neck: P(a.neck, b.neck), head: P(a.head, b.head),
      shoulderF: P(a.shoulderF, b.shoulderF), shoulderB: P(a.shoulderB, b.shoulderB),
      hipF: P(a.hipF, b.hipF), hipB: P(a.hipB, b.hipB),
      footF: P(a.footF, b.footF), footB: P(a.footB, b.footB),
      handF: P(a.handF, b.handF), handB: P(a.handB, b.handB),
      elbowBendF: b.elbowBendF, elbowBendB: b.elbowBendB, kneeBend: b.kneeBend, bob: U.lerp(a.bob, b.bob, t),
    };
  }

  // front hand position through an attack swing (forward space)
  _attackHand() {
    const heavy = this.atkType === 'heavy';
    const dur = heavy ? 0.42 : 0.26;
    const p = U.clamp(1 - this.atkTimer / dur, 0, 1);
    // wind-up (raise back/up) then slash down-forward
    const windup = heavy ? 0.34 : 0.26;
    let ang, rad = heavy ? 26 : 22;
    if (p < windup) {
      const t = U.ease.out(p / windup);
      ang = U.lerp(-0.5, heavy ? -2.5 : -2.1, t);   // raise overhead/back
    } else {
      const t = U.ease.out((p - windup) / (1 - windup));
      ang = U.lerp(heavy ? -2.5 : -2.1, heavy ? 1.0 : 0.7, t); // swing through
      rad += t * 6;
    }
    const ox = RIG.shoulderX, oy = RIG.shoulderY + 2;
    return { x: ox + Math.cos(ang) * rad, y: oy + Math.sin(ang) * rad, ang };
  }

  /* ============================================================
     RENDER
     ============================================================ */
  draw(ctx) {
    const cx = this.x + this.w / 2, by = this.y + this.h;

    // ground shadow (world space, scales with height off floor)
    if (this.onGround || this.state === 'attack') {
      ctx.save(); ctx.globalAlpha = 0.30; ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(cx, by, this.w * 0.62 * (1 + this.sq * 0.4), 6, 0, 0, U.TAU); ctx.fill(); ctx.restore();
    }

    // dash afterimages
    for (const g of this.ghosts) this._drawGhost(ctx, g);

    ctx.save();
    let alpha = 1;
    if (this.dead) alpha *= U.clamp(1 - this.deadT / 1.6, 0, 1);
    if (this.iframe > 0 && this.dashTime <= 0) alpha *= 0.62 + 0.3 * Math.sin(this.e.time * 34);   // soft shimmer, not a hard strobe
    ctx.globalAlpha = alpha;

    // time-slow aura
    if (this.slowTime > 0) draw.glow(ctx, cx, this.cy, 46, '#5fd0ff', 0.25);
    if (this.dashTime > 0) draw.glow(ctx, cx, this.cy, 40, '#cfe8ff', 0.3);

    // local transform: feet origin, lean, squash & stretch
    ctx.translate(cx, by);
    ctx.rotate(this.lean * 0.5);
    let sy = 1 - this.sq, sx = 1 + this.sq * 0.6;
    if (!this.onGround && !this.dead) { const stv = U.clamp(this.vy / 2400, -0.18, 0.24); sy *= 1 + stv; sx *= 1 - stv * 0.5; }
    if (this.turnT > 0) sx *= U.lerp(1, 0.55, U.ease.inOut(this.turnT));   // quick pivot squash
    ctx.scale(sx, sy);

    if (this.dead) this._drawDead(ctx);
    else {
      let T = this._poseTargets();
      if (this._blendT < 1 && this._blendFrom) T = this._lerpTargets(this._blendFrom, T, U.ease.inOut(this._blendT));
      this._lastTargets = T;
      this._drawRig(ctx, this._solvePose(T));
    }

    ctx.restore();
  }

  _flip(p) { return { x: p.x * this.face, y: p.y }; }

  _drawRig(ctx, P) {
    const f = this.face;
    const flashing = this.hitFlash > 0;
    const robe = flashing ? '#b89aff' : '#2a1f47';
    const robeLo = flashing ? '#9a78e0' : '#160f28';
    const trim = '#f4c560';

    // ---------- back limbs (behind body) ----------
    this._limb(ctx, P.shoulderB, P.armB.jx, P.armB.jy, P.armB.ex, P.armB.ey, 6.0, robeLo, f);
    this._limb(ctx, P.hipB, P.legB.jx, P.legB.jy, P.legB.ex, P.legB.ey, 6.6, '#221934', f, true);

    // ---------- cape (secondary motion) ----------
    this._drawCape(ctx, P, robe, robeLo);

    // ---------- torso / robe ----------
    ctx.beginPath();
    const hipW = 11, shW = 9;
    ctx.moveTo((P.shoulderB.x - shW) * f, P.shoulderB.y);
    ctx.lineTo((P.shoulderF.x + shW) * f, P.shoulderF.y);
    ctx.quadraticCurveTo((P.chest.x + hipW + 2) * f, P.chest.y + 5, (P.hipF.x + hipW - 2) * f, P.hip.y + 1);
    ctx.lineTo((P.hipB.x - hipW + 2) * f, P.hip.y + 1);
    ctx.quadraticCurveTo((P.chest.x - hipW - 2) * f, P.chest.y + 5, (P.shoulderB.x - shW) * f, P.shoulderB.y);
    ctx.closePath();
    const tg = ctx.createLinearGradient(0, P.chest.y - 6, 0, P.hip.y + 6);
    tg.addColorStop(0, robe); tg.addColorStop(1, robeLo);
    ctx.fillStyle = tg; ctx.fill();
    // gold sash / trim
    ctx.strokeStyle = U.rgba(trim, 0.5); ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo((P.shoulderB.x - 2) * f, P.shoulderB.y + 3); ctx.lineTo((P.hipF.x + hipW - 2) * f, P.hip.y + 3); ctx.stroke();

    // inner violet core — the seed of Dark
    const corePulse = 0.5 + Math.sin(this.anim * 3) * 0.18;
    const coreY = (P.chest.y + P.hip.y) / 2;
    draw.glow(ctx, P.chest.x * f, coreY, 13 + corePulse * 4, '#9a6bff', 0.5);
    ctx.fillStyle = '#c9b3ff'; ctx.beginPath(); ctx.arc(P.chest.x * f, coreY, 3.2, 0, U.TAU); ctx.fill();

    // ---------- front leg ----------
    this._limb(ctx, P.hipF, P.legF.jx, P.legF.jy, P.legF.ex, P.legF.ey, 7.0, '#322554', f, true);

    // ---------- head + hood ----------
    this._drawHead(ctx, P, robe, robeLo, trim, flashing);

    // ---------- front arm + weapon ----------
    this._limb(ctx, P.shoulderF, P.armF.jx, P.armF.jy, P.armF.ex, P.armF.ey, 6.8, robe, f);
    this._drawWeapon(ctx, P);

    // ---------- block shimmer ----------
    if (this.blocking) {
      ctx.save(); ctx.translate((P.handF.x + 6) * f, P.handF.y);
      const a = this.parryWin > 0 ? 0.85 : 0.4;
      const g = ctx.createLinearGradient(0, -26, 0, 26);
      g.addColorStop(0, U.rgba('#cfe8ff', 0)); g.addColorStop(0.5, U.rgba(this.parryWin > 0 ? '#ffe6a8' : '#cfe8ff', a)); g.addColorStop(1, U.rgba('#cfe8ff', 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 9, 30, 0, 0, U.TAU); ctx.fill(); ctx.restore();
    }
  }

  // draw a 2-bone limb (upper: anchor→joint, fore: joint→end) as tapered strokes
  _limb(ctx, anchor, jx, jy, ex, ey, width, color, f, foot) {
    ctx.lineCap = 'round'; ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(anchor.x * f, anchor.y); ctx.lineTo(jx * f, jy); ctx.stroke();
    ctx.lineWidth = width * 0.82;
    ctx.beginPath(); ctx.moveTo(jx * f, jy); ctx.lineTo(ex * f, ey); ctx.stroke();
    if (foot) { // shoe (toe points forward)
      ctx.fillStyle = '#15101f';
      ctx.beginPath(); ctx.ellipse((ex + 2) * f, ey - 1, 5.5, 3.2, 0, 0, U.TAU); ctx.fill();
    } else { // hand
      ctx.fillStyle = '#caa6ff';
      ctx.beginPath(); ctx.arc(ex * f, ey, 2.7, 0, U.TAU); ctx.fill();
    }
  }

  _drawHead(ctx, P, robe, robeLo, trim, flashing) {
    const f = this.face;
    const hx = P.head.x * f, hy = P.head.y;
    // hood (drape from neck over head)
    ctx.fillStyle = flashing ? '#b89aff' : '#241a3a';
    ctx.beginPath();
    ctx.moveTo((P.neck.x - 9) * f, P.neck.y + 2);
    ctx.quadraticCurveTo(hx - 11 * f, hy - 2, hx - 2 * f, hy - RIG.headR - 1);
    ctx.quadraticCurveTo(hx + (RIG.headR + 5) * f, hy - RIG.headR + 2, hx + 9 * f, hy + 7);
    ctx.quadraticCurveTo((P.neck.x + 7) * f, P.neck.y + 3, (P.neck.x - 9) * f, P.neck.y + 2);
    ctx.closePath();
    const hg = ctx.createLinearGradient(0, hy - RIG.headR, 0, P.neck.y + 4);
    hg.addColorStop(0, robe); hg.addColorStop(1, robeLo); ctx.fillStyle = hg; ctx.fill();
    ctx.strokeStyle = U.rgba(trim, 0.35); ctx.lineWidth = 1.2; ctx.stroke();
    // face shadow
    ctx.fillStyle = '#0a0712';
    ctx.beginPath(); ctx.ellipse(hx + 2.5 * f, hy + 1, RIG.headR * 0.72, RIG.headR * 0.62, 0, 0, U.TAU); ctx.fill();
    // glowing eyes
    const eg = flashing ? '#ffffff' : trim;
    ctx.fillStyle = eg; ctx.shadowColor = trim; ctx.shadowBlur = 7;
    ctx.beginPath(); ctx.arc(hx + 4.5 * f, hy, 1.5, 0, U.TAU); ctx.fill();
    ctx.globalAlpha *= 0.6; ctx.beginPath(); ctx.arc(hx + 1.5 * f, hy + 0.5, 1.1, 0, U.TAU); ctx.fill();
    ctx.globalAlpha /= 0.6; ctx.shadowBlur = 0;
  }

  _drawCape(ctx, P, robe, robeLo) {
    const f = this.face, n = this.cape;
    ctx.beginPath();
    ctx.moveTo((n[0].x + 5) * f, n[0].y);
    for (let i = 0; i < n.length; i++) { const w = (1 - i / n.length) * 7 + 1.5; ctx.lineTo((n[i].x + w) * f, n[i].y); }
    for (let i = n.length - 1; i >= 0; i--) { const w = (1 - i / n.length) * 7 + 1.5; ctx.lineTo((n[i].x - w) * f, n[i].y); }
    ctx.closePath();
    const cg = ctx.createLinearGradient(0, n[0].y, 0, n[n.length - 1].y);
    cg.addColorStop(0, robe); cg.addColorStop(1, U.rgba(robeLo, 0.85));
    ctx.fillStyle = cg; ctx.fill();
    ctx.strokeStyle = U.rgba('#9a6bff', 0.25); ctx.lineWidth = 1; ctx.stroke();
  }

  _drawWeapon(ctx, P) {
    const ab = this.ab;
    let col = '#c9b3ff', glow = '#9a6bff';
    if (ab.emberShot) { col = '#ffb347'; glow = '#ff5a2a'; }
    else if (ab.timeSlow) { col = '#bfeeff'; glow = '#5fd0ff'; }
    else if (ab.groundSlam) { col = '#e8c79a'; glow = '#c9974f'; }
    const f = this.face;
    const gripX = P.armF.ex, gripY = P.armF.ey;   // clamped hand position
    // stable carry pose; only the attack swing drives the angle
    let ang;
    if (this.state === 'attack' && P.handF.ang !== undefined) ang = P.handF.ang + Math.PI * 0.62;
    else if (this.blocking) ang = -0.12;
    else ang = 0.05 + Math.sin(this.anim * 2) * 0.045;   // near-vertical carry, slight sway

    ctx.save();
    ctx.translate(gripX * f, gripY);
    ctx.scale(f, 1);
    ctx.rotate(ang);
    // slash arc fx during the active swing
    if (this.state === 'attack') {
      const dur = this.atkType === 'heavy' ? 0.42 : 0.26;
      const sw = U.clamp(1 - this.atkTimer / dur, 0, 1);
      if (sw > 0.28 && sw < 0.82) {
        const a2 = (sw - 0.28) / 0.54;
        const ag = ctx.createLinearGradient(0, -42, 0, 4);
        ag.addColorStop(0, U.rgba(col, 0)); ag.addColorStop(1, U.rgba(col, 0.55 * Math.sin(a2 * Math.PI)));
        ctx.strokeStyle = ag; ctx.lineWidth = this.atkType === 'heavy' ? 11 : 6.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(0, -4, this.atkType === 'heavy' ? 42 : 36, -0.8, 0.8); ctx.stroke();
      }
    }
    // haft / hilt
    ctx.strokeStyle = '#3a2f22'; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 7); ctx.lineTo(0, -12); ctx.stroke();
    // pommel gem
    draw.glow(ctx, 0, -1, 4, glow, 0.7);
    // glowing blade / staff head
    const bg = ctx.createLinearGradient(0, -12, 0, -40);
    bg.addColorStop(0, col); bg.addColorStop(1, U.rgba(col, 0.25));
    ctx.strokeStyle = bg; ctx.lineWidth = ab.emberShot ? 5.5 : 3.8; ctx.shadowColor = glow; ctx.shadowBlur = 13;
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(0, -40); ctx.stroke();
    ctx.shadowBlur = 0;
    draw.glow(ctx, 0, -40, 10, glow, 0.85);
    if (ab.emberShot && this.heat > 0.05) draw.glow(ctx, 0, -26, 9 * this.heat, '#ff7a3c', 0.4 * this.heat);
    ctx.restore();
  }

  _drawGhost(ctx, g) {
    const a = U.clamp(g.life / 0.22, 0, 1) * 0.4;
    ctx.save(); ctx.globalAlpha = a;
    ctx.translate(g.x, g.y); ctx.rotate(g.lean * 0.5);
    ctx.fillStyle = '#9a6bff';
    draw.roundRect(ctx, -8, -RIG.headR - 44, 16, 40, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -46, RIG.headR, 0, U.TAU); ctx.fill();
    ctx.restore();
  }

  _drawDead(ctx) {
    // collapse: fold forward onto the ground
    const t = U.clamp(this.deadT / 0.6, 0, 1);
    ctx.rotate(this.face * U.ease.out(t) * 1.4);
    ctx.globalAlpha *= 1;
    ctx.fillStyle = '#241a3a';
    draw.roundRect(ctx, -9, -40, 18, 38, 8); ctx.fill();
    ctx.fillStyle = '#160f28'; ctx.beginPath(); ctx.arc(0, -42, RIG.headR, 0, U.TAU); ctx.fill();
    draw.glow(ctx, 0, -22, 16 * (1 - t), '#9a6bff', 0.5 * (1 - t));
  }
}
VEIL.Player = Player;
VEIL.PCONST = C;
VEIL.ik2 = ik2;   // shared 2-bone IK solver (used by enemies too)

})();

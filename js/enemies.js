/* ============================================================
   Veil of the Elements — Enemies, Bosses, Projectiles
   ============================================================ */
(function () {
"use strict";
const VEIL = window.VEIL;
const U = VEIL.U, draw = VEIL.draw;
const GRAV = 2200;

function solveX(b, solids) {
  b.x += b.vx * b._dt;
  for (const s of solids) { if (s.oneway) continue; if (U.aabb(b, s)) { if (b.vx > 0) b.x = s.x - b.w; else if (b.vx < 0) b.x = s.x + s.w; b.vx = -b.vx * (b.bounce || 0); b._hitWall = true; } }
}
function solveY(b, solids) {
  b.y += b.vy * b._dt; b.onGround = false;
  for (const s of solids) { if (!U.aabb(b, s)) continue; if (s.oneway && (b.vy <= 0 || (b.y + b.h) - b.vy * b._dt > s.y + 8)) continue; if (b.vy > 0) { b.y = s.y - b.h; b.vy = 0; b.onGround = true; } else if (b.vy < 0) { b.y = s.y + s.h; b.vy = 0; } }
}

/* ------------------------------------------------------------
   Projectile
   ------------------------------------------------------------ */
class Projectile {
  constructor(world, o) {
    this.world = world; Object.assign(this, { x: 0, y: 0, vx: 0, vy: 0, g: 0, r: 7, dmg: 12, owner: 'enemy', color: '#9a6bff', life: 2, spin: 0, rot: 0, homing: 0, dead: false }, o);
    this.w = this.r * 2; this.h = this.r * 2;
  }
  update(dt) {
    this.life -= dt; if (this.life <= 0) { this.dead = true; return; }
    if (this.homing && this.owner === 'enemy') {
      const p = this.world.player; const a = Math.atan2(p.cy - this.y, p.cx - this.x);
      this.vx = U.lerp(this.vx, Math.cos(a) * 360, this.homing * dt); this.vy = U.lerp(this.vy, Math.sin(a) * 360, this.homing * dt);
    }
    this.vy += this.g * dt; this.x += this.vx * dt; this.y += this.vy * dt; this.rot += this.spin * dt;
    this.world.particles.emit({ x: this.x, y: this.y, vx: U.rand(-20, 20), vy: U.rand(-20, 20), life: 0.3, r: this.r * 0.6, color: this.color });
    // hit solids
    for (const s of this.world.solids) { if (s.oneway) continue; const box = { x: this.x - this.r, y: this.y - this.r, w: this.w, h: this.h }; if (U.aabb(box, s)) { this._pop(); return; } }
    const box = { x: this.x - this.r, y: this.y - this.r, w: this.w, h: this.h };
    if (this.owner === 'player') {
      for (const en of this.world.enemies) { if (en.dead || (en.invuln && en.invuln > 0)) continue; if (U.aabb(box, en)) { en.takeHit(this.dmg, U.sign(this.vx) || 1, { kb: 200, ky: -80 }); this.world.spawnDamage(en.x + en.w / 2, en.y, this.dmg, this.color); this._pop(); return; } }
    } else {
      const p = this.world.player;
      if (!p.dead && U.aabb(box, p)) { p.damage(this.dmg, this.x); this._pop(); return; }
    }
  }
  _pop() { this.dead = true; this.world.particles.burst(this.x, this.y, 8, { color: this.color, spdMax: 160, lifeMax: 0.4, rMax: 4 }); }
  draw(ctx) {
    draw.glow(ctx, this.x, this.y, this.r * 2.2, this.color, 0.7);
    ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(this.x, this.y, this.r * 0.5, 0, U.TAU); ctx.fill(); ctx.globalAlpha = 1;
  }
}
VEIL.Projectile = Projectile;

/* ------------------------------------------------------------
   Enemy (corrupted spirits) — kinds: husk, wisp, spitter, brute
   ------------------------------------------------------------ */
const KIND = {
  husk:    { w: 36, h: 46, hp: 40, dmg: 12, speed: 110, aggro: 360, color: '#6b4a8a', tint: '#9a6bff', fly: false, contact: 8 },
  wisp:    { w: 30, h: 30, hp: 18, dmg: 9, speed: 90, aggro: 420, color: '#7a5bb0', tint: '#c9b3ff', fly: true, contact: 9 },
  spitter: { w: 38, h: 44, hp: 30, dmg: 11, speed: 60, aggro: 480, color: '#5a4a7a', tint: '#9a6bff', fly: false, contact: 6 },
  brute:   { w: 60, h: 70, hp: 110, dmg: 20, speed: 70, aggro: 380, color: '#4a3a64', tint: '#b388ff', fly: false, contact: 14 },
};

class Enemy {
  constructor(world, x, y, kind, opts) {
    this.world = world; this.e = world.engine; this.kind = kind;
    const k = KIND[kind] || KIND.husk;
    opts = opts || {};
    this.w = k.w; this.h = k.h;
    this.x = x; this.y = y - this.h; this.spawnX = x; this.spawnY = this.y;
    this.vx = 0; this.vy = 0; this.onGround = false;
    this.maxHp = opts.hp || k.hp; this.hp = this.maxHp;
    this.dmg = opts.dmg || k.dmg; this.speed = k.speed; this.aggro = k.aggro;
    this.color = opts.color || k.color; this.tint = opts.tint || k.tint; this.fly = k.fly; this.contactDmg = k.contact;
    this.face = opts.face || -1; this.dead = false; this.dying = 0;
    this.state = 'patrol'; this.t = 0; this.tele = 0; this.cd = U.rand(0.5, 1.5); this.atk = 0; this.atkHit = false;
    this.hurt = 0; this.flash = 0; this.invuln = 0; this.contactCd = 0; this.anim = U.rand(0, 10);
    this.hover = this.y; this.patrolDir = U.chance(0.5) ? 1 : -1; this.patrolRange = opts.range || 120;
    this.isBoss = false;
    // --- animation state ---
    this.legPhase = U.rand(0, 6); this.sq = 0; this.sqVel = 0;
    this.breath = U.rand(0, 6); this.wob = U.rand(0, 6); this.limbWind = 0;
    this.tendrils = [0, 1, 2, 3].map((i) => ({ a: 0, v: 0, ph: i * 1.7 }));
  }
  takeHit(dmg, dir, opts) {
    opts = opts || {};
    this.hp -= dmg; this.hurt = 0.18; this.flash = 0.14;
    this.sq = 0.45; this.sqVel = 0;     // squash recoil
    this.vx = dir * (opts.kb || 200); if (!this.fly) this.vy = opts.ky || -120; else this.vy = (opts.ky || -120) * 0.5;
    this.state = 'hurt'; this.t = 0;
    this.world.particles.burst(this.x + this.w / 2, this.y + this.h / 2, 6, { color: this.tint, spdMax: 200, lifeMax: 0.4, rMax: 4 });
    if (this.hp <= 0) this._die();
  }
  _die() {
    if (this.dead) return; this.dead = true; this.dying = 0;
    this.e.audio.sfx('hit'); this.world.camera.shake(0.18);
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    this.world.particles.burst(cx, cy, 24, { color: this.tint, color2: '#3a2566', spdMax: 300, lifeMax: 0.9, rMax: 6 });
    // shards burst outward and fall
    for (let i = 0; i < 10; i++) { const a = U.rand(0, U.TAU); this.world.particles.emit({ x: cx, y: cy, vx: Math.cos(a) * U.rand(80, 260), vy: Math.sin(a) * U.rand(70, 190) - 60, g: 900, life: U.rand(0.5, 0.95), r: U.rand(2, 4), r2: 0.5, color: this.color, color2: this.tint, glow: false, shape: 'square', spin: U.rand(-9, 9) }); }
    // dark smoke rising as the corruption disperses
    for (let i = 0; i < 6; i++) this.world.particles.emit({ x: cx + U.rand(-8, 8), y: cy, vx: U.rand(-30, 30), vy: U.rand(-55, -20), life: U.rand(0.6, 1.1), r: U.rand(5, 9), r2: 13, color: '#160f28', glow: false });
    if (this.world.onEnemyKilled) this.world.onEnemyKilled(this);
  }
  update(dt) {
    this._dt = dt;
    if (this.dead) return;
    this.t += dt; this.anim += dt;
    this.hurt = Math.max(0, this.hurt - dt); this.flash = Math.max(0, this.flash - dt);
    this.contactCd = Math.max(0, this.contactCd - dt); this.cd = Math.max(0, this.cd - dt);
    const p = this.world.player;
    const dx = p.cx - (this.x + this.w / 2), dy = p.cy - (this.y + this.h / 2);
    const dpx = Math.abs(dx), dist = Math.hypot(dx, dy);
    const aggro = dist < this.aggro && !p.dead;

    if (this.state === 'hurt') { if (this.t > 0.22) { this.state = aggro ? 'chase' : 'patrol'; this.t = 0; } }

    if (this.fly) this._flyAI(dt, p, dx, dy, dist, aggro);
    else this._groundAI(dt, p, dx, dpx, aggro);

    // physics
    if (!this.fly) { this.vy += GRAV * dt; if (this.vy > 1400) this.vy = 1400; }
    solveX(this, this.world.solids);
    if (!this.fly) solveY(this, this.world.solids);
    else { this.y += this.vy * dt; this.vy *= 0.9; }

    // contact damage
    if (this.contactCd <= 0 && !p.dead && U.aabb(this, p) && this.state !== 'telegraph') {
      p.damage(this.contactDmg, this.x + this.w / 2); this.contactCd = 0.8;
    }
    if (this.face === 0) this.face = U.sign(dx) || 1;
    this._animTick(dt);
  }
  _animTick(dt) {
    this.breath += dt; this.wob += dt;
    // squash & stretch spring back to rest
    const k = 250, c = 15;
    this.sqVel += (-k * this.sq - c * this.sqVel) * dt;
    this.sq = U.clamp(this.sq + this.sqVel * dt, -0.4, 0.5);
    // ground walk cadence
    if (!this.fly && this.onGround && Math.abs(this.vx) > 12) this.legPhase += dt * (Math.abs(this.vx) / Math.max(40, this.speed)) * 9;
    // flying tendril flail (secondary motion)
    if (this.fly) for (const td of this.tendrils) { const tgt = Math.sin(this.wob * 3 + td.ph) * 0.55 - this.vx * 0.002; td.v += (tgt - td.a) * 22 * dt; td.v *= 0.86; td.a += td.v * dt; }
  }
  _groundAI(dt, p, dx, dpx, aggro) {
    if (this.state === 'hurt') return;
    if (this.kind === 'spitter') {
      // keep distance, shoot
      if (aggro) {
        this.face = U.sign(dx) || this.face;
        if (dpx < 220) this.vx = U.approach(this.vx, -U.sign(dx) * this.speed, 600 * dt);
        else this.vx = U.approach(this.vx, 0, 800 * dt);
        if (this.cd <= 0 && this.state !== 'telegraph') { this.state = 'telegraph'; this.tele = 0.55; this.t = 0; }
        if (this.state === 'telegraph') { this.tele -= dt; this.vx = U.approach(this.vx, 0, 1000 * dt); if (this.tele <= 0) { this._shoot(p); this.state = 'chase'; this.cd = U.rand(1.4, 2.4); } }
      } else { this._patrol(dt); }
      return;
    }
    if (aggro) {
      this.face = U.sign(dx) || this.face;
      const atkRange = this.kind === 'brute' ? 78 : 56;
      if (this.state === 'telegraph') { this.tele -= dt; this.vx = U.approach(this.vx, 0, 1400 * dt);
        if (this.tele <= 0) { this.state = 'attack'; this.atk = this.kind === 'brute' ? 0.5 : 0.34; this.atkHit = false; this.vx = this.face * (this.kind === 'brute' ? 120 : 260); }
        return; }
      if (this.state === 'attack') { this.atk -= dt; this.vx *= 0.86;
        if (!this.atkHit && this.atk < (this.kind === 'brute' ? 0.34 : 0.2)) { this._melee(p); this.atkHit = true; }
        if (this.atk <= 0) { this.state = 'chase'; this.cd = U.rand(0.6, 1.2); }
        return; }
      // chase
      if (dpx > atkRange) this.vx = U.approach(this.vx, U.sign(dx) * this.speed, 700 * dt);
      else { this.vx = U.approach(this.vx, 0, 900 * dt); if (this.cd <= 0) { this.state = 'telegraph'; this.tele = this.kind === 'brute' ? 0.7 : 0.42; this.world.audio && null; } }
    } else { this.state = 'patrol'; this._patrol(dt); }
  }
  _patrol(dt) {
    this.vx = U.approach(this.vx, this.patrolDir * this.speed * 0.45, 500 * dt);
    if (Math.abs(this.x - this.spawnX) > this.patrolRange) { this.patrolDir = -U.sign(this.x - this.spawnX); }
    if (this._hitWall) { this.patrolDir *= -1; this._hitWall = false; }
    this.face = this.patrolDir;
  }
  _flyAI(dt, p, dx, dy, dist, aggro) {
    this.face = U.sign(dx) || this.face;
    if (aggro) {
      if (this.state === 'telegraph') { this.tele -= dt; this.vx *= 0.9; this.vy *= 0.9; if (this.tele <= 0) { this.state = 'attack'; const a = Math.atan2(dy, dx); this.vx = Math.cos(a) * 420; this.vy = Math.sin(a) * 420; this.atk = 0.5; } return; }
      if (this.state === 'attack') { this.atk -= dt; if (this.atk <= 0) { this.state = 'chase'; this.cd = U.rand(1, 2); } return; }
      // hover toward player
      const a = Math.atan2(dy, dx);
      this.vx = U.lerp(this.vx, Math.cos(a) * this.speed, 2 * dt);
      this.vy = U.lerp(this.vy, Math.sin(a) * this.speed + Math.sin(this.anim * 3) * 30, 2 * dt);
      if (this.cd <= 0 && dist < 260) { this.state = 'telegraph'; this.tele = 0.45; }
    } else {
      this.vx *= 0.92; this.vy = Math.sin(this.anim * 2) * 24;
    }
  }
  _melee(p) {
    const reach = this.kind === 'brute' ? 70 : 50;
    const hb = { x: this.face > 0 ? this.x + this.w - 6 : this.x - reach + 6, y: this.y, w: reach, h: this.h };
    if (!p.dead && U.aabb(hb, p)) p.damage(this.dmg, this.x + this.w / 2);
    if (this.kind === 'brute') { this.world.camera.shake(0.2); this.world.particles.burst(this.x + this.w / 2 + this.face * 40, this.y + this.h, 10, { color: this.tint, ang: -Math.PI / 2, spread: 1, spdMax: 220, lifeMax: 0.4 }); }
  }
  _shoot(p) {
    const sx = this.x + this.w / 2, sy = this.y + this.h * 0.4;
    const a = Math.atan2(p.cy - sy, p.cx - sx);
    this.world.spawnProjectile({ x: sx, y: sy, vx: Math.cos(a) * 320, vy: Math.sin(a) * 320, dmg: this.dmg, color: this.tint, r: 8, life: 2.4 });
    this.e.audio.sfx('corrupt');
  }
  draw(ctx) {
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    if (this.dead) {
      this.dying += this.world.engine.realDt || 0.016;
      const a = U.clamp(1 - this.dying / 0.5, 0, 1);
      draw.glow(ctx, cx, cy, this.w * (1 + this.dying), this.tint, a * 0.5);
      return;
    }
    ctx.save();
    // shadow
    if (!this.fly && this.onGround) { ctx.globalAlpha = 0.25; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(cx, this.y + this.h, this.w * 0.5, 5, 0, 0, U.TAU); ctx.fill(); ctx.globalAlpha = 1; }
    // telegraph indicator
    if (this.state === 'telegraph') { const f = (Math.sin(this.t * 30) + 1) / 2; draw.glow(ctx, cx, cy, this.w * 1.4, '#ff5a6a', 0.3 + f * 0.3); }
    const flashing = this.flash > 0;
    const bodyCol = flashing ? '#ffffff' : this.color;
    // corruption aura
    draw.glow(ctx, cx, cy, this.w * 0.9, this.tint, 0.22 + Math.sin(this.anim * 4) * 0.05);

    ctx.translate(cx, cy);
    if (this.kind === 'wisp') {
      const r = this.w * 0.4;
      ctx.fillStyle = bodyCol; ctx.beginPath();
      for (let i = 0; i <= 16; i++) { const a = (i / 16) * U.TAU; const rr = r * (1 + Math.sin(a * 3 + this.anim * 5) * 0.18); ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = flashing ? '#fff' : this.tint; ctx.beginPath(); ctx.arc(this.face * 4, -2, 3, 0, U.TAU); ctx.fill();
    } else {
      // body blob
      const sway = Math.sin(this.anim * (this.state === 'attack' ? 14 : 4)) * 3;
      ctx.fillStyle = bodyCol;
      draw.roundRect(ctx, -this.w / 2, -this.h / 2 + sway, this.w, this.h, this.w * 0.3); ctx.fill();
      // jagged corrupted top
      ctx.fillStyle = flashing ? '#fff' : U.lerpColor(this.color, '#000', 0.3);
      ctx.beginPath(); ctx.moveTo(-this.w / 2, -this.h / 2 + sway + 8);
      const spikes = this.kind === 'brute' ? 5 : 3;
      for (let i = 0; i <= spikes; i++) { const px = -this.w / 2 + (i / spikes) * this.w; ctx.lineTo(px, -this.h / 2 + sway - (i % 2 ? 10 : 2)); }
      ctx.lineTo(this.w / 2, -this.h / 2 + sway + 8); ctx.closePath(); ctx.fill();
      // eyes
      ctx.fillStyle = flashing ? '#fff' : '#ffcf6a'; ctx.shadowColor = '#ff9a3c'; ctx.shadowBlur = 8;
      const ey = -this.h * 0.12 + sway;
      ctx.beginPath(); ctx.arc(this.face * this.w * 0.16 - 5, ey, 2.6, 0, U.TAU); ctx.arc(this.face * this.w * 0.16 + 5, ey, 2.6, 0, U.TAU); ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
    // hp bar (small)
    if (this.hp < this.maxHp && !this.isBoss) {
      const bw = this.w, bx = this.x, by = this.y - 10;
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(bx, by, bw, 4);
      ctx.fillStyle = this.tint; ctx.fillRect(bx, by, bw * U.clamp(this.hp / this.maxHp, 0, 1), 4);
    }
  }
}
VEIL.Enemy = Enemy;

/* ------------------------------------------------------------
   Boss — configurable, multi-phase, telegraphed attacks
   config: { name, title, hp, color, tint, style, w, h, attacks:[...] , onPhase }
   attack: { name, tele, dur, cd, run(boss,dt,phase), telegraph(boss) }
   ------------------------------------------------------------ */
class Boss {
  constructor(world, x, y, cfg) {
    this.world = world; this.e = world.engine; this.cfg = cfg;
    this.w = cfg.w || 90; this.h = cfg.h || 110;
    this.x = x - this.w / 2; this.y = y - this.h; this.spawnX = this.x; this.floorY = y;
    this.vx = 0; this.vy = 0; this.onGround = false;
    this.maxHp = cfg.hp || 400; this.hp = this.maxHp;
    this.color = cfg.color || '#4a3a64'; this.tint = cfg.tint || '#9a6bff'; this.style = cfg.style || 'golem';
    this.face = -1; this.dead = false; this.dying = 0; this.isBoss = true;
    this.state = 'intro'; this.t = 0; this.introT = 1.6;
    this.flash = 0; this.hurt = 0; this.invuln = 1.6; this.vulnerable = false;
    this.phase = 1; this.maxPhase = cfg.phases || 3;
    this.attacks = cfg.attacks || []; this.cur = null; this.cd = 1.4; this.anim = 0;
    this.data = {}; // scratch for attacks
    this.active = false;
  }
  begin() { this.active = true; this.state = 'idle'; this.invuln = 0.5; if (this.e.audio) this.e.audio.sfx('boss'); }
  takeHit(dmg, dir, opts) {
    if (this.dead || this.invuln > 0) return;
    if (this.cfg.armored && !this.vulnerable) { dmg *= 0.12; this.world.particles.burst(this.x + this.w / 2 + dir * this.w * 0.4, this.y + this.h / 2, 6, { color: '#cfe8ff', spdMax: 140, lifeMax: 0.3 }); }
    this.hp -= dmg; this.hurt = 0.12; this.flash = 0.1;
    this.world.particles.burst(this.x + this.w / 2, this.y + this.h * 0.4, 5, { color: this.tint, spdMax: 160, lifeMax: 0.35 });
    const np = Math.ceil(this.maxPhase * (1 - this.hp / this.maxHp)) ; // not used directly
    const phaseByHp = Math.min(this.maxPhase, 1 + Math.floor((1 - U.clamp(this.hp / this.maxHp, 0, 1)) * this.maxPhase));
    if (phaseByHp > this.phase) { this.phase = phaseByHp; this._enterPhase(); }
    if (this.hp <= 0) this._die();
  }
  _enterPhase() {
    this.e.audio.sfx('boss'); this.world.camera.shake(0.5); this.invuln = 0.8; this.cd = 0.6;
    this.world.particles.burst(this.x + this.w / 2, this.y + this.h / 2, 30, { color: this.tint, color2: '#f4c560', spdMax: 320, lifeMax: 0.9, rMax: 7 });
    if (this.cfg.onPhase) this.cfg.onPhase(this, this.phase);
  }
  _die() {
    this.dead = true; this.dying = 0; this.active = false;
    this.e.audio.sfx('boss'); this.world.camera.shake(0.9); this.e.freeze(0.2);
    if (this.world.onBossKilled) this.world.onBossKilled(this);
  }
  update(dt) {
    this._dt = dt; this.anim += dt;
    if (this.dead) { this.dying += dt; if (this.dying < 1.4 && U.chance(0.6)) this.world.particles.burst(this.x + U.rand(0, this.w), this.y + U.rand(0, this.h), 4, { color: this.tint, color2: '#f4c560', spdMax: 200, lifeMax: 1 }); return; }
    this.flash = Math.max(0, this.flash - dt); this.hurt = Math.max(0, this.hurt - dt); this.invuln = Math.max(0, this.invuln - dt);
    if (!this.active) return;
    const p = this.world.player; this.face = U.sign(p.cx - (this.x + this.w / 2)) || this.face;

    if (this.state === 'idle') {
      this.cd -= dt;
      if (this.cd <= 0 && this.attacks.length) {
        const pool = this.attacks.filter((a) => !a.minPhase || a.minPhase <= this.phase);
        this.cur = U.pick(pool); this.t = 0; this.state = 'telegraph'; this.data = {}; this.vulnerable = false;
        if (this.cur.onStart) this.cur.onStart(this);
      }
      this._idleMove(dt, p);
    } else if (this.state === 'telegraph') {
      this.t += dt; if (this.cur.telegraph) this.cur.telegraph(this, dt);
      if (this.t >= (this.cur.tele || 0.6)) { this.state = 'act'; this.t = 0; }
    } else if (this.state === 'act') {
      this.t += dt; if (this.cur.run) this.cur.run(this, dt, this.phase);
      if (this.t >= (this.cur.dur || 0.6)) { this.state = 'recover'; this.t = 0; if (this.cur.vuln) { this.vulnerable = true; this.vulnT = this.cur.vuln; } }
    } else if (this.state === 'recover') {
      this.t += dt; this.vx = U.approach(this.vx, 0, 600 * dt);
      if (this.vulnerable) { this.vulnT -= dt; if (this.vulnT <= 0) this.vulnerable = false; }
      if (this.t >= (this.cur.rec || 0.8) && !this.vulnerable) { this.state = 'idle'; this.cd = U.rand(this.cfg.cdMin || 0.7, this.cfg.cdMax || 1.6); }
    }

    // physics (ground bosses)
    if (this.style !== 'tempest' && this.style !== 'clone-air') { this.vy += GRAV * dt; solveX(this, this.world.solids); solveY(this, this.world.solids); }
    else { this.x += this.vx * dt; this.y += this.vy * dt; }
  }
  _idleMove(dt, p) {
    const dx = p.cx - (this.x + this.w / 2);
    if (this.cfg.chase) { if (Math.abs(dx) > 120) this.vx = U.approach(this.vx, U.sign(dx) * (this.cfg.speed || 90), 400 * dt); else this.vx = U.approach(this.vx, 0, 600 * dt); }
    else this.vx = U.approach(this.vx, 0, 500 * dt);
  }
  // helper for attacks to damage player with a box
  hitPlayer(box, dmg) { const p = this.world.player; if (!p.dead && U.aabb(box, p)) p.damage(dmg, box.x + box.w / 2); }
  shoot(o) { this.world.spawnProjectile(Object.assign({ owner: 'enemy', color: this.tint, r: 9, dmg: 14, life: 3 }, o)); }

  draw(ctx) {
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    if (this.dead) { const a = U.clamp(1 - this.dying / 1.4, 0, 1); draw.glow(ctx, cx, cy, this.w * (1 + this.dying * 0.6), this.tint, a * 0.6); if (a <= 0) return; ctx.globalAlpha = a; }
    // intro rise
    let yo = 0; if (this.state === 'intro') yo = (1 - U.ease.out(U.clamp(this.t / this.introT, 0, 1))) * 60;
    ctx.save(); ctx.translate(0, yo);
    // aura
    draw.glow(ctx, cx, cy, this.w * (this.vulnerable ? 1.1 : 0.85), this.vulnerable ? '#f4c560' : this.tint, 0.3 + Math.sin(this.anim * 3) * 0.06);
    if (this.state === 'telegraph') { const f = (Math.sin(this.t * 24) + 1) / 2; draw.glow(ctx, cx, cy, this.w * 1.3, '#ff5a6a', 0.2 + f * 0.35); }
    const flashing = this.flash > 0;
    if (this.cfg.drawBody) this.cfg.drawBody(this, ctx, cx, cy, flashing);
    else this._drawDefault(ctx, cx, cy, flashing);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  _drawDefault(ctx, cx, cy, flashing) {
    ctx.save(); ctx.translate(cx, cy);
    const col = flashing ? '#fff' : this.color;
    if (this.style === 'golem') {
      ctx.fillStyle = col;
      // body chunks
      draw.roundRect(ctx, -this.w / 2, -this.h / 2, this.w, this.h, 14); ctx.fill();
      ctx.fillStyle = flashing ? '#fff' : U.lerpColor(this.color, '#000', 0.25);
      // cracks of corruption
      ctx.strokeStyle = this.tint; ctx.lineWidth = 3; ctx.shadowColor = this.tint; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.moveTo(-this.w * 0.2, -this.h * 0.4); ctx.lineTo(0, 0); ctx.lineTo(this.w * 0.16, this.h * 0.3); ctx.moveTo(0, 0); ctx.lineTo(-this.w * 0.22, this.h * 0.2); ctx.stroke();
      ctx.shadowBlur = 0;
      // core
      const coreCol = this.vulnerable ? '#f4c560' : this.tint;
      draw.glow(ctx, 0, 0, 22, coreCol, 0.9); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, U.TAU); ctx.fill();
      // eyes
      ctx.fillStyle = '#ffcf6a'; ctx.shadowColor = '#ff9a3c'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(this.face * 14 - 8, -this.h * 0.3, 4, 0, U.TAU); ctx.arc(this.face * 14 + 8, -this.h * 0.3, 4, 0, U.TAU); ctx.fill(); ctx.shadowBlur = 0;
    } else {
      // generic wraith
      ctx.fillStyle = col; ctx.beginPath();
      for (let i = 0; i <= 20; i++) { const a = (i / 20) * U.TAU; const rr = this.w * 0.5 * (1 + Math.sin(a * 3 + this.anim * 4) * 0.12); ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr * (this.h / this.w)); }
      ctx.closePath(); ctx.fill();
      draw.glow(ctx, 0, 0, 18, this.vulnerable ? '#f4c560' : this.tint, 0.9);
    }
    ctx.restore();
  }
}
VEIL.Boss = Boss;

})();

/* ============================================================
   Veil of the Elements — Platformer
   Reusable side-scroll world. A scene composes one:
     this.pf = new VEIL.Platformer(engine, levelDef);
   levelDef: {
     width, killY, spawn:{x,y},
     solids:[{x,y,w,h,oneway?,style?}],
     hazards:[{x,y,w,h,dmg}],
     enemies:[{kind,x,y,opts}],
     pickups:[{x,y,kind,r?,onCollect}],
     triggers:[{x,y,w,h,once?,onEnter,onExit?}],
     checkpoints:[{x,y}],
     goal:{x, onReach},
     theme:{ platform, platformEdge, accent },
     paintBg(ctx,world,t), paintFg(ctx,world,t)
   }
   ============================================================ */
(function () {
"use strict";
const VEIL = window.VEIL;
const U = VEIL.U, draw = VEIL.draw;

class Platformer {
  constructor(engine, def) {
    this.engine = engine; this.e = engine; this.def = def;
    this.particles = engine.particles; this.camera = engine.camera; this.audio = engine.audio;
    this.solids = (def.solids || []).map((s) => Object.assign({}, s));
    this.hazards = (def.hazards || []).map((h) => Object.assign({}, h));
    this.killY = def.killY !== undefined ? def.killY : 1400;
    this.width = def.width || 3000;
    this.theme = def.theme || { platform: '#2a2438', platformEdge: '#f4c560', accent: '#9a6bff' };
    this.damageNums = [];
    this.projectiles = [];
    this.pickups = (def.pickups || []).map((p) => Object.assign({ r: 16, taken: false }, p));
    this.triggers = (def.triggers || []).map((t) => Object.assign({ fired: false, inside: false }, t));
    this.interactables = (def.interactables || []).map((o) => Object.assign({ r: 66, used: false }, o));
    this.nearInteract = null;
    this.checkpoints = def.checkpoints || [];
    this.goal = def.goal || null; this.goalReached = false;
    this.enemies = [];
    this.boss = null;
    this.t = 0;
    this.flowField = []; // decorative

    const sp = def.spawn || { x: 100, y: 300 };
    this.player = new VEIL.Player(this, sp.x, sp.y - VEIL.PCONST.H);
    (def.enemies || []).forEach((d) => this.addEnemy(d.kind, d.x, d.y, d.opts));
    // pull the framing back so each realm reads as a vast, open space
    this.camera.setZoom(def.zoom || 0.85);
    this.camera.setBounds(0, this.width);
    this.camera.x = U.clamp(this.player.cx - engine.W / 2, 0, this.width - engine.W);
    // callbacks (scene overrides)
    this.onEnemyKilled = null; this.onBossKilled = null; this.onSlam = null;
    this.onParry = null; this.onPlayerStrike = null; this.onUpdate = null;
    this.onReachGoal = def.goal && def.goal.onReach || null;
    this.frozenInput = false;
  }

  addEnemy(kind, x, y, opts) { const en = new VEIL.Enemy(this, x, y, kind, opts); this.enemies.push(en); return en; }
  addBoss(x, y, cfg) { this.boss = new VEIL.Boss(this, x, y, cfg); this.enemies.push(this.boss); return this.boss; }
  spawnProjectile(o) { this.projectiles.push(new VEIL.Projectile(this, o)); }
  spawnDamage(x, y, amt, col) { this.damageNums.push({ x: x + U.rand(-8, 8), y, vy: -60, life: 0.9, amt: Math.round(amt), col: col || '#ffe6a8' }); }
  setCheckpoint(x, y) { this.player.setSpawn(x, y - VEIL.PCONST.H); }
  onPlayerDeath() {
    // fade, respawn
    if (this._respawning) return; this._respawning = true;
    const f = this.engine.fader; f.classList.remove('clear');
    setTimeout(() => { this.player.respawn(); this.enemies.forEach((en) => { if (!en.isBoss) { /* keep */ } }); f.classList.add('clear'); this._respawning = false; }, 650);
  }

  update(dt) {
    this.t += dt;
    const ts = this.engine.timeScale;
    const edt = dt * ts;

    if (!this.engine.paused) this.player.update(dt);

    // enemies & boss (time-scaled)
    for (const en of this.enemies) { if (!en.dead || en.dying < 1.5) en.update(edt); }
    // cull dead enemies after fade
    for (let i = this.enemies.length - 1; i >= 0; i--) { const en = this.enemies[i]; if (en.dead && (en.dying || 0) > (en.isBoss ? 1.6 : 0.6)) { if (en === this.boss) this.boss = null; this.enemies.splice(i, 1); } }

    // projectiles
    for (const pr of this.projectiles) pr.update(edt);
    this.projectiles = this.projectiles.filter((p) => !p.dead);

    // damage numbers
    for (const d of this.damageNums) { d.y += d.vy * dt; d.vy += 120 * dt; d.life -= dt; }
    this.damageNums = this.damageNums.filter((d) => d.life > 0);

    // pickups
    for (const pk of this.pickups) { if (pk.taken) continue; if (U.dist(this.player.cx, this.player.cy, pk.x, pk.y) < pk.r + 22) { pk.taken = true; pk.onCollect && pk.onCollect(this.player, pk); } }

    // triggers
    for (const tr of this.triggers) {
      const inside = U.aabb(this.player, tr);
      if (inside && !tr.inside) { tr.inside = true; if (!(tr.once && tr.fired)) { tr.fired = true; tr.onEnter && tr.onEnter(this.player, tr); } }
      if (!inside && tr.inside) { tr.inside = false; tr.onExit && tr.onExit(this.player, tr); }
    }

    // interactables — nearest in range shows an "E" prompt; press to trigger
    this.nearInteract = null;
    if (!this.engine.paused && !this.player.dead && !(VEIL.dialogue && VEIL.dialogue.active)) {
      let best = null, bd = 1e9;
      for (const it of this.interactables) {
        if (it.once && it.used) continue;
        const d = U.dist(this.player.cx, this.player.cy, it.x, it.y);
        if (d < it.r && d < bd) { bd = d; best = it; }
      }
      this.nearInteract = best;
      if (best && this.engine.input.pressed('interact')) {
        if (best.once) best.used = true;
        this.engine.audio.sfx(best.sfx || 'ui');
        best.onInteract && best.onInteract(best, this.player);
      }
    }

    // checkpoints
    for (const cp of this.checkpoints) { if (!cp.set && Math.abs(this.player.cx - cp.x) < 40) { cp.set = true; this.setCheckpoint(cp.x, cp.y); VEIL.ui.toast('✦ Resting place'); this.engine.audio.sfx('heal'); } }

    // goal
    if (this.goal && !this.goalReached && this.player.cx > this.goal.x) { this.goalReached = true; this.onReachGoal && this.onReachGoal(); }

    // camera — follow with smoothed velocity look-ahead
    const lead = U.clamp(this.player.vx * 0.34, -200, 200);
    this.camLead = U.lerp(this.camLead || 0, lead, U.clamp(dt * 3, 0, 1));
    this.camera.follow(this.player.cx, this.player.cy - 30, dt, 6, this.camLead);

    if (this.onUpdate) this.onUpdate(dt);
  }

  draw(ctx) {
    const cam = this.camera;
    // --- background (parallax) ---
    if (this.def.paintBg) this.def.paintBg(ctx, this, this.t);
    else VEIL.sky.paint(ctx, { top: '#1a1330', mid: '#241a44', bottom: '#0c0820' }, this.t);

    cam.begin(ctx);

    // decals behind
    if (this.def.paintMid) this.def.paintMid(ctx, this, this.t);

    // solids
    this._drawSolids(ctx);

    // hazards
    for (const hz of this.hazards) this._drawHazard(ctx, hz);

    // pickups
    for (const pk of this.pickups) if (!pk.taken) this._drawPickup(ctx, pk);

    // interactables (markers + floating prompt)
    for (const it of this.interactables) this._drawInteract(ctx, it);

    // goal beacon
    if (this.goal && this.goal.show !== false) this._drawGoal(ctx);

    // enemies
    for (const en of this.enemies) en.draw(ctx);
    // projectiles
    for (const pr of this.projectiles) pr.draw(ctx);
    // player
    this.player.draw(ctx);

    // particles in world space — already inside the camera transform, so no extra offset
    this.particles.draw(ctx);

    // damage numbers
    for (const d of this.damageNums) {
      const a = U.clamp(d.life / 0.9, 0, 1);
      draw.text(ctx, d.amt, d.x, d.y, { size: 20 + (d.amt > 25 ? 6 : 0), color: d.col, font: 'Cinzel, serif', alpha: a, glow: d.col, blur: 8, weight: 600 });
    }

    if (this.def.paintProps) this.def.paintProps(ctx, this, this.t);

    cam.end(ctx);

    // foreground (screen or parallax)
    if (this.def.paintFg) this.def.paintFg(ctx, this, this.t);

    // boss bar
    if (this.boss && this.boss.active && !this.boss.dead) this._drawBossBar(ctx, this.boss);

    // vignette
    draw.vignette(ctx, this.def.vignette !== undefined ? this.def.vignette : 0.55, this.def.vignetteColor || '#000');

    // time-slow overlay
    if (this.engine.timeScale < 1) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = U.rgba('#5fd0ff', 0.06); ctx.fillRect(0, 0, this.engine.W, this.engine.H); ctx.restore(); }
  }

  _drawSolids(ctx) {
    const th = this.theme; const cam = this.camera;
    for (const s of this.solids) {
      if (s.x + s.w < cam.x - 40 || s.x > cam.x + this.engine.W + 40) continue;
      if (s.invisible) continue;
      ctx.save();
      if (s.oneway) {
        const g = ctx.createLinearGradient(0, s.y, 0, s.y + s.h);
        g.addColorStop(0, U.alpha(th.platformEdge, 0.5)); g.addColorStop(1, U.alpha(th.platform, 0.2));
        ctx.fillStyle = g; ctx.fillRect(s.x, s.y, s.w, 6);
        ctx.fillStyle = U.alpha(th.platform, 0.35); ctx.fillRect(s.x, s.y, s.w, s.h);
      } else {
        // body
        const g = ctx.createLinearGradient(0, s.y, 0, s.y + s.h);
        g.addColorStop(0, U.lerpColor(th.platform, '#000', 0.05)); g.addColorStop(1, U.lerpColor(th.platform, '#000', 0.45));
        ctx.fillStyle = g; ctx.fillRect(s.x, s.y, s.w, s.h);
        // top edge highlight
        ctx.fillStyle = U.alpha(th.platformEdge, 0.85); ctx.fillRect(s.x, s.y, s.w, 4);
        ctx.fillStyle = U.alpha(th.platformEdge, 0.18); ctx.fillRect(s.x, s.y + 4, s.w, 3);
        // subtle texture lines
        ctx.strokeStyle = U.alpha('#000', 0.18); ctx.lineWidth = 1;
        const seed = U.seed((s.x * 13 + s.y * 7) | 0);
        for (let i = 0; i < Math.min(6, s.w / 40); i++) { const lx = s.x + 8 + seed() * (s.w - 16); ctx.beginPath(); ctx.moveTo(lx, s.y + 6); ctx.lineTo(lx + seed() * 8 - 4, s.y + s.h); ctx.stroke(); }
      }
      ctx.restore();
    }
  }
  _drawHazard(ctx, hz) {
    ctx.save();
    if (hz.kind === 'lava') {
      const g = ctx.createLinearGradient(0, hz.y, 0, hz.y + hz.h); g.addColorStop(0, '#ffd27a'); g.addColorStop(0.3, '#ff7a2a'); g.addColorStop(1, '#8a1f0a');
      ctx.fillStyle = g; ctx.fillRect(hz.x, hz.y, hz.w, hz.h);
      ctx.fillStyle = U.alpha('#ffd27a', 0.6); for (let x = hz.x; x < hz.x + hz.w; x += 30) { const yy = hz.y + Math.sin(this.t * 3 + x * 0.05) * 4; ctx.fillRect(x, yy, 16, 4); }
    } else { // corruption spikes
      ctx.fillStyle = U.alpha('#9a6bff', 0.85); ctx.strokeStyle = '#3a2566'; ctx.lineWidth = 1;
      const n = Math.max(2, Math.floor(hz.w / 18));
      for (let i = 0; i < n; i++) { const sx = hz.x + (i / n) * hz.w; ctx.beginPath(); ctx.moveTo(sx, hz.y + hz.h); ctx.lineTo(sx + hz.w / n / 2, hz.y + Math.sin(this.t * 4 + i) * 3); ctx.lineTo(sx + hz.w / n, hz.y + hz.h); ctx.closePath(); ctx.fill(); }
      draw.glow(ctx, hz.x + hz.w / 2, hz.y + hz.h / 2, hz.w * 0.5, '#9a6bff', 0.2);
    }
    ctx.restore();
  }
  _drawPickup(ctx, pk) {
    const bob = Math.sin(this.t * 2 + pk.x) * 5;
    const y = pk.y + bob;
    let col = '#f4c560';
    if (pk.kind === 'orb') col = pk.color || '#6fe6a0';
    else if (pk.kind === 'health') col = '#ff6a8a';
    else if (pk.kind === 'fragment' || pk.kind === 'keyfrag') col = '#ffe6a8';
    draw.glow(ctx, pk.x, y, pk.r * 1.8, col, 0.6);
    ctx.save(); ctx.translate(pk.x, y); ctx.rotate(this.t * (pk.kind === 'fragment' ? 0.6 : 1));
    if (pk.kind === 'fragment' || pk.kind === 'keyfrag') { draw.star(ctx, 0, 0, pk.r, '#fff', 0.95); ctx.strokeStyle = col; ctx.lineWidth = 1.5; }
    else { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, pk.r * 0.5, 0, U.TAU); ctx.fill(); }
    ctx.restore();
  }
  _drawInteract(ctx, it) {
    if (it.once && it.used && !it.keepMarker) return;
    const near = it === this.nearInteract;
    const col = it.color || '#f4c560';
    const bob = Math.sin(this.t * 2 + it.x * 0.01) * 3;
    const x = it.x, y = (it.markY !== undefined ? it.markY : it.y) + bob;
    // ambient marker rune
    draw.glow(ctx, x, y, 13, col, 0.22 + (near ? 0.22 : 0) + Math.sin(this.t * 3) * 0.04);
    ctx.save(); ctx.globalAlpha = 0.8; ctx.strokeStyle = col; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(x, y, 7, this.t, this.t + Math.PI * 1.5); ctx.stroke(); ctx.restore();
    if (!near) return;
    // floating prompt bubble
    const py = y - 30;
    draw.glow(ctx, x, py, 18, col, 0.45);
    ctx.save();
    ctx.beginPath(); ctx.arc(x, py, 11, 0, U.TAU); ctx.fillStyle = 'rgba(10,7,18,.82)'; ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.stroke();
    draw.text(ctx, 'E', x, py + 0.5, { size: 13, color: col, font: 'Cinzel, serif', glow: col, blur: 6, weight: 600 });
    if (it.label) draw.text(ctx, it.label, x, py - 19, { size: 12, color: '#e7ddc7', font: 'Spectral, serif', glow: '#000', blur: 4 });
    ctx.restore();
  }
  _drawGoal(ctx) {
    const g = this.goal; const x = g.x, y0 = g.y || 0, h = this.engine.H;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const grad = ctx.createLinearGradient(x, 0, x, h); grad.addColorStop(0, U.alpha(g.color || '#f4c560', 0)); grad.addColorStop(0.5, U.alpha(g.color || '#f4c560', 0.25)); grad.addColorStop(1, U.alpha(g.color || '#f4c560', 0));
    ctx.fillStyle = grad; ctx.fillRect(x - 30, 0, 60, h);
    for (let i = 0; i < 3; i++) { const yy = U.wrap(this.t * 60 + i * 200, h + 200) - 100; draw.glow(ctx, x, yy, 30, g.color || '#f4c560', 0.4); }
    ctx.restore();
  }
  _drawBossBar(ctx, boss) {
    const W = this.engine.W; const bw = W * 0.6, bx = (W - bw) / 2, by = this.engine.H - 54;
    draw.text(ctx, boss.cfg.name || 'Guardian', W / 2, by - 16, { size: 18, color: '#f4c560', glow: '#9a6bff', blur: 12, font: 'Cinzel, serif', spacing: '3px' });
    if (boss.cfg.title) draw.text(ctx, boss.cfg.title, W / 2, by - 1, { size: 11, color: '#c9b3ff', font: 'Spectral, serif', spacing: '2px' });
    ctx.save();
    draw.roundRect(ctx, bx, by + 8, bw, 12, 6); ctx.fillStyle = 'rgba(10,7,18,.7)'; ctx.fill();
    ctx.strokeStyle = U.alpha('#9a6bff', 0.6); ctx.lineWidth = 1; ctx.stroke();
    const f = U.clamp(boss.hp / boss.maxHp, 0, 1);
    draw.roundRect(ctx, bx + 2, by + 10, (bw - 4) * f, 8, 4);
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, '#9a6bff'); g.addColorStop(1, '#f4c560'); ctx.fillStyle = g; ctx.fill();
    // phase ticks
    for (let i = 1; i < boss.maxPhase; i++) { const px = bx + (bw) * (i / boss.maxPhase); ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.moveTo(px, by + 9); ctx.lineTo(px, by + 19); ctx.stroke(); }
    ctx.restore();
  }
}
VEIL.Platformer = Platformer;

})();

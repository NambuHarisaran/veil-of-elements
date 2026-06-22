# Veil of the Elements — The Missing Spirit

A browser-playable 2.5D cinematic action-adventure built from the original game script.
All art is generated procedurally (Canvas2D / CSS / SVG) — no external assets, copyright-safe, works offline.

---

## Story (faithful to the script)

A young **disciple** is sent by the **Master** to discover why the **Dark Element** vanished
from the world, breaking the balance of Earth, Water, Fire, Air, and Dark. Across five realms
the disciple learns from elemental **Guardians** that Dark was never evil — it was *feared*.
The Master sealed it long ago. The player chooses to **Restore** it (Path of Balance) or
**Keep it Sealed** (Path of Light).

### Acts
1. **The Lesson** — Hall of Balance (temple in the clouds). Cinematic + dialogue choice. Dark sigil vanishes. Receive the Compass.
2. **Descent from the Hall** — Misty mountain path. Movement/jump tutorial, compass, murals, whispers. Reach the shrine.
3. **The Spirit Forest** — Glowing roots + spreading corruption. Cleanse-orb puzzle, Forest Spirit. Unlock Earth.
4. **Earth Realm — The Weight of Life** — Crumbling cliffs. Carry Heartstone, shield block, ground slam. Guardian **Tharos**, boss **Corrupted Golem**. Reward: Earth Gauntlets + "Decay renews."
5. **Water Realm — Echoes of Reflection** — Sunken temple, crystal lake. Time-slow (Flow Staff), mirror puzzle. Guardian **Nerai**, reflection-clone fight. Reward: Flow Staff + "Shadow defines clarity."
6. **Fire Realm — Trial of Control** — Volcanic forge. Ember Blade channel, overheat meter. Guardian **Rion**. Reward: Ember Blade + "Containment is not destruction."
7. **Air Realm — The Weightless Path** — Floating ruins, sky bridges. Wind glide (Sky Bow), precision platforming. Guardian **Aelra**. Reward: Sky Bow + "Freedom needs grounding."
8. **Return to the Hall** — Half-corrupted temple. Four lights lit, fifth dim. Revelation + moral choice.
9. **Endings** — Path of Balance (Restore) / Path of Light (Keep Sealed).

---

## Art Direction
- **Symbolic contrast:** gold `#f4c560` (light) vs violet `#9a6bff` (dark).
- **Mood:** mystical, painterly, meditative, cinematic.
- Per-realm signature palette + signature particle (dust, pollen, spores, embers, caustics, ash, feathers/cloud).
- Procedural parallax: 4–6 layers of gradients + silhouettes per scene.
- Post: vignette, soft bloom (`shadowBlur`), per-realm color grade, gentle film grain.
- Fonts: `Cinzel` (display) + `Spectral` (body), serif fallbacks.

---

## Engine API (the contract — all scenes/agents follow this)

Single global namespace: **`window.VEIL`**.

### `VEIL.engine`
```
canvas, ctx            // main canvas + 2d context
W, H                   // logical render size (1280x720, letterboxed/scaled to fit)
time                   // seconds since boot
dt                     // last frame delta (seconds, clamped)
input                  // VEIL.Input instance
audio                  // VEIL.Audio instance
camera                 // VEIL.Camera instance
particles              // global VEIL.Particles instance
state                  // persistent player progress (see below)
go(name, params)       // transition to a scene (fade out/in)
scene                  // current scene instance
```

### `VEIL.engine.state` (player progress, savable)
```
hp, maxHp
abilities: { dash, block, groundSlam, timeSlow, emberShot, glide }   // booleans, unlocked over time
fragments: []          // collected "Fragment of Truth" strings
realmsCleared: []      // 'earth','water','fire','air'
ending: null | 'balance' | 'light'
flags: {}              // misc story flags
```

### Scene interface
Every scene is a class/object registered in `VEIL.scenes[name]`:
```
enter(engine, params)  // setup (called once on entry)
exit(engine)           // cleanup
update(dt)             // logic
draw(ctx)             // render (world space already handled via camera if used)
onKey(e)               // optional raw keydown
```
Use `engine.go('name')` to change scenes. Transitions handled by the engine.

### Helpers
- `VEIL.draw` — `glow(ctx,x,y,r,color,a)`, `vGrad/hGrad`, `roundRect`, `poly`, `text`, `mountains`, `mist`, `star`, `lerpColor`, `vignette`, `grain`.
- `VEIL.sky` — `paint(ctx, palette, t)` per-realm background generators.
- `VEIL.particles.emit(opts)` / `.burst(...)` — shared particle system.
- `VEIL.U` — math utils: `lerp, clamp, rand, randInt, chance, ease.*, dist, aabb, approach`.
- `VEIL.Input` — `down(action)`, `pressed(action)`, actions: left,right,up,down,jump,attack,heavy,dash,block,ability,interact,pause.
- `VEIL.audio` — `tone`, `noise`, `sfx(name)`, `music(theme)`, `setMood`.
- `VEIL.dialogue.play(lines, onDone)` — cinematic dialogue; lines: `{who,text,choices?}`.
- `VEIL.hud` — draws HUD; `VEIL.compass.set(angle/target)`.

### Platformer helper
- `VEIL.Platformer` — reusable side-scroll level: solids, player physics, enemies, pickups, parallax bg, goal. Scenes configure it with a level definition and a `bg` painter.
- `levelDef.interactables: [{ x, y, r?, label?, color?, once?, keepMarker?, sfx?, onInteract(it, player) }]` — when the player is within `r` of an interactable, a floating **E** prompt + `label` appear; pressing **E** (interact) fires `onInteract`. `once` marks it spent; `keepMarker` keeps the rune visible afterward. Used for lore murals, resting shrines, levers, etc.
- `levelDef.zoom` — per-realm camera zoom (default **0.85**, i.e. pulled back ~17% to make each realm read as a vast, open space). `1` = no zoom.

### Player rig (`js/player.js`)
- Fully **procedural articulated character** — no sprites. A small skeletal rig (hip · spine · hood/head · two arms · two legs) is posed every frame in local "forward space" and solved with **2-bone IK** (`ik2`) for knees/elbows, so feet plant and limbs fold naturally.
- Motion principles: velocity-driven **squash & stretch** spring (`this.sq`), **anticipation** stretch on jump launch, **landing** squash scaled by fall speed, **follow-through** on attack swings, a **verlet cloth cape** for secondary motion, dash **afterimages**, breathing/idle sway, body lean, and a head that pitches with vertical velocity.
- Per-state poses: `idle, run, jump, fall, glide, attack (light combo + heavy), block, dash, slam, hurt, dead`. Physics, hitboxes and the public API are unchanged — only the visual/animation layer was rewritten.
- **Dev tool:** open `player_lab.html` to preview every state at large scale (auto-cycles, or `?state=RUN`, or `window.LAB.state`/`.scale`).

### Conventions
- Logical resolution **1280×720**; everything scales. Use `engine.W/H`.
- Classic `<script>` tags (no ES modules) so it runs from `file://` and any static host.
- 60fps target, `dt` clamped to 1/30 to avoid tunneling.
- Keep per-realm code self-contained in its scene file; shared behavior goes in core/Platformer.

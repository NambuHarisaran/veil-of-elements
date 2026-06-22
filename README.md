# Veil of the Elements — The Missing Spirit

A browser-playable **2.5D cinematic action-adventure**, built entirely from
procedural art (Canvas2D / CSS / SVG) — no external image or audio assets, fully
offline, copyright-safe.

A young disciple is sent to discover why the **Dark Element** vanished, breaking
the balance of Earth, Water, Fire, Air, and Dark. Across five realms the disciple
learns that Dark was never evil — only feared — and must choose to **Restore** it
(Path of Balance) or keep it **Sealed** (Path of Light).

## Play

No build step. Just open `index.html` in a modern browser, or serve the folder:

```sh
npx http-server . -p 5180 -c-1
# then open http://localhost:5180
```

## Controls

| Action | Keys |
|--------|------|
| Move | `A` / `D` or `←` / `→` |
| Jump | `Space` / `W` / `↑` |
| Attack / Heavy | `J` (combo) / `K` |
| Dash | `Shift` |
| Block / Parry | `F` (hold; release on time to parry) |
| Ground Slam | `↓` / `S` in the air |
| Ember Shot | `L` |
| Slow Time | `R` |
| Glide | hold `Space` while falling |
| Interact | `E` |
| Pause | `Esc` / `P` |

Abilities unlock as you clear each realm.

## Acts

1. The Lesson — Hall of Balance
2. Descent from the Hall
3. The Spirit Forest
4. Earth Realm — The Weight of Life
5. Water Realm — Echoes of Reflection
6. Fire Realm — Trial of Control
7. Air Realm — The Weightless Path
8. Return to the Hall — revelation & choice
9. Endings — Balance or Light

## Tech

- Single global namespace `window.VEIL`; classic `<script>` tags, no modules.
- Engine, particles, camera, audio, and a reusable `Platformer` live in `js/`.
- Each act is a self-contained scene in `js/scenes/`.
- Procedural articulated player rig (2-bone IK, squash & stretch, verlet cape).
- See [`GAME_DESIGN.md`](GAME_DESIGN.md) for the full architecture and engine contract.

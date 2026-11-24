# PALMERA HEAT — build notes

An original 2D top-down open-world crime game: the coastal city of Palmera at sunset.
No Rockstar names, art, map or music — every name, character and line below is original.

## Status
- [x] Starter read; gate/judge criteria noted (screenshots ≤256 KiB, 1280 long side; dossier text cap ~160 KB)
- [x] Source files (game/src/*.js) — 17 files, all original, all parse clean; 114,924 bytes total (under the cap)
- [x] index.html + shots.json + an authored comment block in main.ts (plumbing otherwise untouched;
      vendor/makefun-game.ts byte-for-byte unchanged)
- [x] Play-test in Playwright — 12/12 checks pass: title → new game → walk → steal with E → drive
      (speed 244) → brake → exit → pistol fire → 1 star → police respond → mission 1 completes at
      Club Sirena ($250 → $400) → pause/resume → zero page errors
- [x] 4 screenshots captured into screenshots/ (1280x800 JPEG, 94–108 KB each)
- [ ] Final check (parent runs `node main.ts` twice at sealing — see the handoff note)

## Bugs found by the play-test and fixed
- Cars ground to a halt on lamp-post/palm-trunk colliders at intersection corners: soft street
  furniture is now driven through by cars, and only a real shove (>1.6 px) costs a car its speed.
- Parked cars could spawn nose-to-tail, trapping a stolen car: spawns now keep 130 px clear.
- Sound effects tried to open the AudioContext before any user gesture: voices now stay silent
  until the first gesture unlocks audio, as browsers require.

## How to run
- Serve game/ with any static server (e.g. `node serve.ts` in this repo) and open index.html.
- Screenshot scenes: `index.html?shot=chase&seed=1` (also `title`, `combat`, `end`); the page
  sets `window.__shotReady = true` when the staged frame is painted.

## Layout (one job per file, loaded in this order by index.html)
config.js (tuning/palette) · random.js (seeded RNG) · input.js · audio.js (WebAudio synth) ·
save.js · city.js (streets, buildings, districts, beach) · cars.js (car physics/drawing) ·
traffic.js (AI drivers, parked cars) · pedestrians.js · police.js (wanted + response) ·
player.js · combat.js (melee, pistol, particles, pickups) · missions.js (story chain) ·
render.js (world painting, day tint, headlights) · hud.js (HUD, minimap, menus) ·
shots.js (staged screenshot scenes) · main.js (state machine, loop, camera)

## Known limits
- Police cars pathfind by pursuit steering, not the road graph (traffic cars do follow lanes).
- One save slot in localStorage.

# Solmarina — an open-world crime game

![make.fun](https://make.fun/badge/gta6-01.svg)
![rank](https://make.fun/badge/gta6-01/Jeytm/gta6-01/rank.svg)
![reward](https://make.fun/badge/gta6-01/Jeytm/gta6-01/reward.svg)

Built for the [gta6-01 bounty on make.fun](https://make.fun/bounty/gta6-01): a playable open-world crime game that runs entirely in a desktop browser, with zero network requests, no libraries, and everything — city, characters, music, sound — drawn and synthesised in code.

## The game

Five years clean, Mara Quinn is back in Solmarina — nine districts of sun-soaked streets, beaches, docks and towers, built from scratch in a 2.5D top-down canvas engine. Run jobs for the fixer Luz Delgado, take on the Vultures gang, and stay ahead of the SCPD.

**What is in the world:**

- **A living city** — 4,800 × 4,800 units, 12 × 12 road grid, nine named districts, parks, beaches, a bay with two piers, docks and warehouses, day-night-free golden-hour light, traffic that brakes and turns, pedestrians who walk, chat and flee gunfire.
- **Driving** — arcade car physics with handbrake slides, skid marks and stunt jumps; steal any parked or traffic car, jack one with a driver in it and watch them run.
- **Wanted system** — 0 to 5 stars for crimes the police see; interceptor cars pursue and ram, foot cops chase, and the heat cools off when they lose sight of you — or a $250 respray at Marina Auto Body clears it.
- **Combat** — fists, pistol, SMG, shotgun and rifle, pickups, cover-free street fights, and gang shootouts.
- **Story** — five sequential missions with dialogue, objectives, a minimap beacon and payouts, from a getaway drive to the final warehouse score.
- **Side activities** — taxi fares, ten hidden packages, three stunt jumps, a safehouse that saves your game, and a hospital that patches you up.
- **HUD and minimap** — live rotating minimap with mission beacon and blips, wanted stars, health and armor bars, cash, weapon and ammo, objective tracker, subtitles, speedometer and district names.
- **Sound** — every sound is synthesised live with WebAudio: engine hum, sirens, gunshots, cash, and a looping synthwave-style score. No audio files, no assets.

Everything is original: no Rockstar / Take-Two assets, names, music or maps, and no third-party code at all.

## Controls

| Keys | Action |
| --- | --- |
| W A S D | Move on foot / drive |
| Mouse | Aim, click to shoot |
| E | Enter / leave a car, start a mission |
| Shift | Sprint |
| Space | Handbrake |
| Q / Tab | Switch weapon |
| F | Punch |
| Esc | Pause |

## Play it

```sh
node serve.ts
```

Then open <http://localhost:8080> in a desktop browser. No build step, no dependencies.

## Screenshots

The four images in `screenshots/` are real renders of this game, staged deterministically by the game's own `?shot=` scenes (`shots.json` lists the queries) and captured in headless Chromium — never edited.

## How the entry is built

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to the output directory and writes `dossier.json` via the vendored `buildDossier` library in `vendor/`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Layout

```
game/
  index.html        Page shell: canvas, HUD, menus
  styles.css        HUD and menu styling
  src/
    main.js         Boot, game loop, screen state machine
    config.js       World, districts, cars, weapons, tuning, story
    city.js         City generation, collision, road helpers
    render.js       Camera and the 2.5D renderer
    player.js       On-foot controller, entering/exiting cars
    vehicles.js     Driving physics, traffic, burning cars
    pedestrians.js  Civilian, gang and cop AI
    police.js       Wanted system and police pursuit
    combat.js       Bullets, melee, enemy fire, pickups
    missions.js     Five story missions and their runner
    activities.js   Taxi fares, packages, stunt jumps
    hud.js          HUD, minimap, subtitles, screens
    save.js         localStorage save/load
    audio.js        WebAudio synthesis: engine, sirens, music
    effects.js      Particles, skids, shake, flashes
    input.js        Keyboard/mouse, scripted input for shots
    random.js       Seeded random helpers
    shots.js        Deterministic ?shot= scene staging
```

License: MIT — see `LICENSE`.

# Basement Grand Prix

A 3D HO slot car raceway that runs in the browser. Two-lane black track with steel rails on a 4 × 8 ft sheet of green-painted plywood on sawhorses, in a dim basement lit by one lamp over the table. Pick a 1970s-style car, squeeze the trigger and keep it in the slot. Built on three.js, with no npm dependencies.

## Playing

- **Drive**: hold the trigger strip on your controller and slide along it to squeeze harder. Let go and the controller brakes. Keys: Space or ↑ for the first player, W for the second.
- **Corners**: the corner meter under the trigger shows how hard the tyres are working. In the yellow the tail steps out; hold it in the red and the guide pin pops out of the slot. The car flies off, spinning and sometimes rolling, and can go off the table onto the floor.
- **Reset**: a car that has come off waits for you. Tap it, press Reset on its controller, or press R, and it's set back in its slot just before where it left. The computer's marshal looks after its own car.
- **Race**: pick practice or a 5, 10 or 25 lap race and press Start. Races wait for three red lights and go on the green. Each lane can have a player, the computer (Rookie, Pro or Ace) or nobody. Laps are counted on the start/finish piece. The lane swap and the crossing are where the two cars can collide.
- **Track**: tap a piece to add it at the glowing open end, or tap any ring to build from that end. Drag pieces and their ends snap together. Rotate, Delete, Undo and the ready-made circuits are on the second row. Pieces: 4½″, 9″ and 15″ straights, the start/finish straight, 6″, 9″, 12″ and 15″ curves, banked 90° and 180° turns, a lane swap and a 90° crossing.
- **Garage**: choose a lane, then a car and its paint: Wedge F1, Can-Am Spyder, Long-tail Coupe, Pony Coupe, Aero Stocker or Street Van, three paint schemes each. Each car has its own top speed, pickup, grip, and its own way of coming off.
- **Keys**: Space/↑ and W triggers · R reset (Race tab) or rotate (Track tab) · F follow cam · V table view · G fast graphics · Delete · Ctrl+Z undo · Enter start · 1 2 3 tabs

## Working on it

You need Node 20 or newer. There is nothing to install.

```sh
npm run dev      # http://localhost:8080 runs the game straight from src/
npm test         # checks the presets, the slots' continuity, and that the computer can lap them all
npm run build    # writes dist/basement-grand-prix.html, the single-file page for the artifact
```

`npm run dev` also serves the built page at http://localhost:8080/dist/basement-grand-prix.html.

## Where things live

| Path | What's in it |
| --- | --- |
| `index.html` | Page markup: the 3D view, the timing board, the control deck and the help card |
| `src/main.js` | Boot, resize and the frame loop |
| `src/state.js` | The live layout, the racing session, sound, and what the controls are doing |
| `src/storage.js` | Saving the layout, cars, drivers and settings in the browser |
| `src/core/` | Everything with no rendering: dimensions, the piece catalogue and their lanes, the layout graph, preset circuits, a car's path along its slot, the driving physics (motor, cornering, deslotting, flying off, being put back), the computer driver, race sessions and timing, each car's specs |
| `src/render/` | Renderer, scene, camera, the lamp and reflections; procedural textures; materials and the livery atlas; the mesh kit |
| `src/world/` | The basement (table, sawhorses, walls, stairs, water heater, workbench, joists, the lamp) and the track pieces (drawn instanced) with the start lights and open-end markers |
| `src/cars/` | The car models: shared parts (body lofts, wheels, chassis, guide pin and braids, drivers, wings), the six cars, their paint schemes and the paint brushes |
| `src/sim/` | A car on the table (model, pose, wheels, sparks) and the session (drivers, lights, laps, crashes, collisions) |
| `src/fx/` | Synthesized motor whine, tyre squeal, crashes and beeps |
| `src/ui/` | Control deck, controllers, timing board, camera, track editor, garage, pointer input, icons |
| `src/styles/` | Colour and font tokens, the overlay on the 3D view, the control deck |
| `tests/` | `node:test` checks that import `src/core/` directly |
| `tools/` | The build script and the local server |

Common changes:

- **A new preset circuit**: add it to `PRESETS` in `src/core/presets.js`. Two identical halves that each turn 180° always close. The tests check that it closes, fits on the table, keeps unrelated track apart, that both slots come back to the start line, and that every car and computer driver can lap it.
- **A new track piece**: define it in `src/core/pieces.js` (its ends, centreline routes and lanes; `makeLane` turns a route, an offset and a bank into a slot), add its palette entries to `APPEND` there, and its button to `ITEMS` in `src/ui/icons.js`. `src/world/track.js` draws any piece from its routes and lanes; add dressing there if it needs some.
- **A new car**: add its specs to `src/core/specs.js`, its builder to `BUILDERS` in `src/cars/models.js`, its paint schemes to `src/cars/liveries.js`, and its silhouette to `SIL` in `src/ui/icons.js`.
- **Handling**: `src/core/racer.js` (motor, grip, slide, deslotting, the flight) and the numbers in `src/core/specs.js`. Run `npm test` after: the computer drivers must still lap every preset cleanly.
- **The basement**: `src/world/room.js`. **Lighting**: `src/render/stage.js`. **Sounds**: `src/fx/sound.js`. **Colours and fonts**: `src/styles/base.css`.

## How the build works

The files in `src/` are plain ES modules. In development the browser loads them as they are, and three.js comes from jsDelivr through the import map in `index.html`.

`npm run build` joins the modules into one inline script, dependencies first, inlines the CSS and writes `dist/basement-grand-prix.html`. The file has no `<!doctype>`, `<head>` or `<body>`, because the claude.ai artifact host adds its own. All modules share one scope in the bundle, so the build also enforces a few rules:

- Top-level names are unique across `src/`.
- Every module imports what it uses from other modules, as `import { a, b } from './x.js'`, with no default, `* as` or `as` renames (three.js is the exception).
- Exports are `export const|let|function|class`, one name per statement.

`dist/` is not committed. GitHub Actions runs the tests and the build on every push to `main`, and the built page can be downloaded from the run's artifacts.

## Publishing

The game is published as the **Basement Grand Prix** artifact on claude.ai. To update it, ask Claude to build the game and publish `dist/basement-grand-prix.html` to that artifact. Saved layouts are kept across republishes as long as the storage key in `src/storage.js` stays the same.

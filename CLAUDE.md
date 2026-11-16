# Basement Grand Prix: notes for Claude

A browser HO slot car game on three.js 0.160 with no npm dependencies. The source in `src/` is ES modules; `npm run build` bundles it into `dist/basement-grand-prix.html`, which is published as the user's "Basement Grand Prix" claude.ai artifact. README.md has the file map. The layout follows the user's train game, Tinplate Junction.

## Commands

- `npm test`: `node:test` checks of `src/core/`: presets close and fit, slots are continuous, every computer driver laps every preset in every lane and car without coming off, flat out does come off, a reset puts the car back, computers never collide at crossings, and after a collision the marshal puts cars back one at a time
- `npm run build`: must pass before publishing. `npm run build:debug` keeps the `window.__bgp` handle for scripted browser checks.
- `npm run dev`: serves `/` (the unbundled modules) and `/dist/` (the built page in an artifact-like skeleton) on port 8080

## Module rules (the build enforces them)

- The bundle puts every module in one scope, so top-level names must be unique across `src/`.
- Import each name you use from another module, as `import { a, b } from '../x/y.js'`. No default, `* as` or `as` imports, except for three.js. Regex literals containing `$` trip the lint: build them with `new RegExp('...')`. A class method named like an export elsewhere also trips it: rename one.
- Export with `export const|let|function|class`, one name per statement.
- `src/core/` stays free of the DOM and three.js, so the tests can import it in Node.
- Lower layers never import higher ones: core, render, world and cars, sim, fx, state, storage, ui, main.
- Each module animates what it owns from a function the frame loop calls (`session.update`, `animateTrack`, `updateRoom`, `updateControllers`, `updateBoard`); `main.js` only calls them in order and draws.

## Track and physics

- Units are inches; heading 0 is +x and positive headings turn right; "right of travel" is (-sin h, cos h).
- Every piece has centreline `routes` (for drawing and bounds), a lane count `nl` (2 or 4), a `width`, and `lanes` (one per slot per route, sampled tables from `makeLane`). A lane's slot index at each end is counted from the left looking out of that end, so slot i meets slot nl - 1 - i across a joint. Pieces only join pieces with the same `nl`; four-lane types start with `w`. `LanePath` in `core/path.js` follows a slot from piece to piece.
- Lane i (red, blue, green, yellow) starts in slot nl - 1 - i looking out of the start piece's back end, i.e. red is the left-hand lane in the racing direction. `layout.laneCount()` is the start piece's lane count.
- `core/heat.js` runs the racing (drivers per lane: 'human', 'rookie', 'pro', 'ace' or 'off'); `sim/session.js` extends it with models, lights and sound. `core/traffic.js` holds collisions, the computers' giving way at crossings and swaps, and `clearToReset` for the marshal.
- `core/racer.js` steps the car at 240 Hz: motor, then cornering ratio = v²·|k| / grip (banking adds grip), slide builds over the limit, deslot past `SLIP_MAX`. The flight is a simple rigid body that settles on wheels, side or roof, on the table or the floor.
- Keep the computer drivers lapping cleanly (`npm test`) after any handling change.

## Models and materials

- Make materials with `stdMat`, `paint`, `glowMat` or `liveryMat` (`src/render/materials.js`). Car bodies use `liveryMat`, a four-band atlas (top, right, left, ends) that `mergeList` box-maps onto the body; painters work in body inches through the brushes in `cars/paintwork.js`, and return early for the `end` band.
- Build models with a `Kit` (`src/render/kit.js`): one mesh per material. Only the axles are separate meshes, so the wheels can turn.
- The room is dim on purpose: the lamp is a spot with a wide soft edge, ambient light is low, and diffuse surfaces in the room keep `envMapIntensity` near 0.05 so the reflection map doesn't flatten the lighting.
- The lamp hides when the camera is above it, and the ceiling when the camera is above the ceiling, so the table can be seen from anywhere.

## Checking a change in a browser

Run the build in debug mode and drive the game through `window.__bgp` (`session`, `loadPreset`, `pickCar`, `startSession`, `setMode` and more; see the end of `src/main.js`). Test `npm run dev`'s `/` page as well as the bundle. In the cloud sandbox jsDelivr is blocked: get three with `npm pack three@0.160.0`, answer the CDN URLs from it with Playwright's `page.route`, and launch Chromium with `--no-proxy-server`. Headless frames are slow, so to test a whole race call `session.update(1/60)` in a loop inside `page.evaluate`.

## Publishing

1. `npm test && npm run build`
2. Publish `dist/basement-grand-prix.html` to the existing artifact, https://claude.ai/artifact/54ss2cMMZ7uhXkUuQoZQeL (title "Basement Grand Prix"): `read` it, then publish with its `url`. Only create a new artifact if the user asks.
3. Keep the localStorage key (`basement-grand-prix-v1` in `src/storage.js`) and the save format compatible.
4. Whenever you publish an update to the artifact, also commit the change and push it to GitHub, without asking first: the user wants every new build pushed to the repository.

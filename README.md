# Spelling Adventure 3D

A browser-based, third-person 3D cartoon spelling adventure for children,
featuring Fern the fox. Targets desktop browsers and Android WebView, with
offline-first gameplay.

The product specification, plan and task list live in
`spelling-adventure-3d-speckit/` and are managed with
[Spec Kit](https://github.com/github/spec-kit) (see `.specify/`).

## Requirements

- Node.js 20.9 or newer (developed on Node 24)
- npm 10 or newer

## Commands

```bash
npm install        # install dependencies
npm run dev        # start the dev server on http://localhost:3000
npm run build      # production build
npm run start      # serve the production build
npm run typecheck  # tsc --noEmit (strict)
npm run lint       # eslint
npm test           # vitest (unit + smoke tests)
npm run check      # typecheck + lint + test
```

If `npm install` fails with `EALLOWSCRIPTS`, an `npm_config_allow_scripts`
environment variable from your shell is being rejected by npm 11. Run
`env -u npm_config_allow_scripts npm install` (bash) instead.

## Project layout

```
src/app/            Next.js App Router routes and global styles (server-safe)
src/components/     Accessible React UI outside the canvas: shell, loading, error, HUD
src/game/           Client-only 3D world
  GameCanvas.tsx    React Three Fiber canvas, WebGL probe, context-loss watchdog
  graphics/         Quality presets, device heuristics, renderer errors (pure TS)
  world/            Meadow layout data (pure TS) and the R3F components that draw it
  character/        Character visual contract, pure controller, placeholder Fern
  camera/           Pure third-person follow camera
  input/            Input hub, keyboard bindings, joystick maths, control-mode detection
  PlayerRig.tsx     Per-frame integrator: input → controller → collisions → camera → proximity
  quest/            Interactable contract, quest state machine + controller, rewards, letter tiles
  audio/            Word prompt (speech synthesis with reveal fallback)
src/learning/       Framework-free learning layer: imported curriculum (content/), puzzles, questions, service, events
src/persistence/    Versioned progress schema, repository interface, IndexedDB + memory implementations
src/offline/        Service worker registration, precache list, offline status
public/sw.js        Hand-written service worker (versioned cache per build)
public/manifest.webmanifest, public/icons/   PWA manifest and placeholder icons
tests/unit/         Pure-logic tests (layout rules, path geometry, quality, WebGL probe)
tests/smoke/        Server-render smoke test and shell state-machine test
```

Art/audio replacement and the performance/release pass are still to come; see
`spelling-adventure-3d-speckit/specs/001-spelling-adventure-3d/tasks.md`.

## Current status

Milestone 2 ("3D meadow with placeholder geometry") is implemented:

- Client-only scene; the server never initialises WebGL.
- Gradient sky, drifting clouds, rolling hills, ground, main path plus one
  branch, a dense instanced conifer forest with bushes, thousands of grass tufts, rocks
  and flowers, warm directional lighting, and a GPU wind wave that rolls across
  trees, bushes and grass (off under reduced motion).
- Placeholder Fern (primitives) with an idle bob; the controller seam is
  `CharacterVisualProps` in `src/game/character/types.ts`.
- Loading screen, friendly recoverable error screen, WebGL context-loss
  recovery via **Try again**.
- Quality presets (low/medium/high) chosen from device hints;
  `prefers-reduced-motion` disables ambient animation.

Milestone 3 ("character controller, camera and inputs") is implemented:

- Fern idles, walks (3.2 m/s) and runs (6.4 m/s) with frame-rate independent
  movement; trunks, rocks and the meadow edge block her.
- Smoothed third-person camera that swings behind Fern while she moves, pulls
  in when a tree is in the way, and can be orbited by dragging on the canvas.
- Keyboard: WASD or arrows, Shift to run, E / Space / Enter to interact.
  Touch: on-screen joystick and a large interact button (auto-detected, or
  force with `?controls=touch` / `?controls=keyboard`).
- `?quality=low|medium|high` overrides the quality heuristic for device tests.
- In development, `window.__spellingAdventureDebug` exposes position, speed
  and animation state for automation and profiling.

Milestone 4 ("interaction and quest") is implemented:

- A signpost by the path shows a prompt when Fern is in range; E, Space, Enter
  or the touch button opens a spelling challenge.
- The challenge dialog builds the word from large letter tiles (or the
  keyboard), gives supportive feedback, allows unlimited retries and can be
  cancelled at any time. A correct answer grants a star, shown in the HUD.
- The game only talks to learning through the `LearningService` interface.
  Rewards never touch the learning layer.

Milestone 5 ("progress and persistence") is implemented:

- Completed quests and stars are saved to IndexedDB (database
  `spelling-adventure-3d`) and restored before the game shows the meadow.
- Learning events are stored durably; failed writes are retried and never
  silently dropped. Corrupted data is moved to a backup key, not deleted.
- When IndexedDB is unavailable the game still runs on an in-memory store
  and says so in the HUD.
- `?reset=progress` clears local progress and events (development aid).

Milestone 6 ("offline / PWA") is implemented:

- A service worker caches the app shell and every build asset the game
  loaded, under a cache named after the build id. Old caches are removed only
  after the new worker has installed. The HUD shows "Ready to play offline"
  only after the worker confirms the cache is complete.
- Registration happens in production builds only (`npm run build && npm start`);
  add `?sw=1` to test it in development, or `?sw=0` to disable it.
- `NEXT_OUTPUT_EXPORT=1 npm run build` produces a static export in `out/` for
  static hosts; the default build runs on any Node host.

## Curriculum content

The spelling content is the owner's validated curriculum, imported from the
sibling project `D:Speeling Game 3` with hashes and update steps recorded in
`src/learning/content/PROVENANCE.md`: 10 levels, 200 target words, each with
three approved foils from a foil codebook, plus a bundled MP3 per word.

- Each curriculum level is its own scene with five signposts and a gate to
  the next level that opens when all five puzzles are done (and a gate back).
- A sign starts one puzzle (five words in curriculum order). The child hears
  the word and picks it among four tiles; wrong tiles are disabled with a
  hint, and the puzzle awards 1 to 3 stars by mistakes. Puzzles unlock in order.
- An on-device adaptive policy (ported from the source project) chooses each
  question: the puzzle's words in order, plus up to three free practice extras
  (focused error-pattern practice, spaced review, transfer checks,
  consolidation, mixed practice). Harder foil tiers are held back until the
  child is ready and choices are reduced when recent answers were hard. Every
  decision records its reasons. Thresholds are provisional; mastery is never
  claimed.

## For grown-ups

Press and hold **For grown-ups** in the top-right corner for about two
seconds to open the progress screen: questions answered, level statuses,
tricky spots, words to practise together, device facts, and a confirmed
reset. Everything is computed on the device; nothing is sent anywhere.

## Graphics and performance

The game picks a preset from device hints (Low/Medium/High) and, in Auto
mode, steps down by itself after a sustained low frame rate. Grown-ups can
pin a preset on their screen, which also shows live frames per second, draw
calls and triangles. `?quality=low|medium|high` overrides everything for
device testing. The render loop pauses while the tab is hidden.

## Deploying

The app has no server-side features, so either shape works:

- **Node host** (any platform that runs `next start`): `npm run build` then
  `npm start`. Serves the app, the service worker and the audio from one
  origin.
- **Static host** (object storage, CDN, GitHub Pages style):
  `NEXT_OUTPUT_EXPORT=1 npm run build` produces `out/`; upload that folder.
  The service worker and manifest must be served from the site root over
  HTTPS (or localhost) for offline play and installation to work.

- **Cloudflare Pages** (current deployment): `npm run deploy:cloudflare`
  builds the static export with a dated build id and uploads `out/` to the
  `spelling-adventure-3d` Pages project (production branch `main`; pass
  `-- --branch preview` for a preview URL). Needs a one-time
  `npx wrangler login`. `public/_headers` keeps `sw.js` and the manifest
  uncached so returning players pick up new builds, and marks hashed build
  assets immutable. Live at https://spelling-adventure-3d.pages.dev/.

Every build gets its own cache via `NEXT_PUBLIC_BUILD_ID` (set it in CI for
reproducible ids). Returning players get the new version on their next
launch; the old cache is removed once the new worker has installed.

### Android host app (WebView)

- Load the game over HTTPS or from a local HTTP server; `file://` has no
  service worker, no IndexedDB in some versions, and blocks audio autoplay.
- Enable JavaScript, DOM storage and media playback without a user gesture
  for the word recordings.
- Keep the WebView on an up-to-date Chromium (WebGL 2 and Service Workers).
- Hardware acceleration must be on for the WebView; without it WebGL is
  software-rendered and the game will fall back to the Low preset.
- The baseline device and WebView version are still undecided; measure
  there before claiming compatibility.

The game talks to the host app only through capabilities it can detect on
`window.Android` (never by user agent), so nothing changes in a browser:

- **Cache complete**: once the service worker has stored the shell, the
  build assets and all 200 word recordings, the page calls
  `window.Android.cachedStatus(true)` (the one container method the earlier
  games already rely on).
- **Exit button**: a door button appears top-left only when the bridge has a
  callable exit method. The candidate names (`closeApp`, `exitApp`,
  `close`, `finish`) are UNCONFIRMED; replace the list in
  `src/platform/containerBridge.ts` once the host's method is known. The
  grown-ups screen's **Container app** card lists the bridge's methods so the
  real name can be read off a device. Leaving always asks first
  ("Leave the forest?"), with **Stay and play** as the focused first choice.

### Updates

The service worker normally looks for a new version only on page load, and a
host app may stay open for days. The page therefore also checks on a 30-minute
timer, when it returns to the foreground and when the device comes back online
(never more than once a minute). When a newer build has installed, an
"A new version is ready!" banner with **Update now** appears in the HUD, but
only while no puzzle or dialog is open. Grown-ups can see the running build
and **Check for updates** on their screen. Applying an update reloads the page;
progress lives in IndexedDB and is unaffected.

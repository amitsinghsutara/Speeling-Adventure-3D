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
  branch, a dense instanced conifer forest with bushes, rocks and flowers, warm directional lighting, and
  GPU wind sway on trees and flowers (off under reduced motion).
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

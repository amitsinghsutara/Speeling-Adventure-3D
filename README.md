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
  character/        Character visual contract + placeholder Fern
tests/unit/         Pure-logic tests (layout rules, path geometry, quality, WebGL probe)
tests/smoke/        Server-render smoke test and shell state-machine test
```

Learning, persistence, quests and input are intentionally absent in this
milestone; see `spelling-adventure-3d-speckit/specs/001-spelling-adventure-3d/tasks.md`.

## Current status

Milestone 2 ("3D meadow with placeholder geometry") is implemented:

- Client-only scene; the server never initialises WebGL.
- Gradient sky, drifting clouds, rolling hills, ground, main path plus one
  branch, instanced trees, rocks and flowers, warm directional lighting.
- Placeholder Fern (primitives) with an idle bob; the controller seam is
  `CharacterVisualProps` in `src/game/character/types.ts`.
- Loading screen, friendly recoverable error screen, WebGL context-loss
  recovery via **Try again**.
- Quality presets (low/medium/high) chosen from device hints;
  `prefers-reduced-motion` disables ambient animation.
- Temporary orbit controls (drag/swipe) for inspecting the scene.

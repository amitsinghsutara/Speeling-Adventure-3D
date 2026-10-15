# Tasks: Spelling Adventure 3D

Tasks are phased. Do not start all phases at once. Mark complete only after verification.

## Phase 0 — Safety and specification
- [x] Confirm working directory is the new project, not an existing game.
- [x] Check Node.js/npm and package manager versions.
- [x] Check installed Spec Kit version and supported commands.
- [ ] Resolve hosting target, baseline Android device/WebView, and asset approach. _(2026-10-15: static export deployed to Cloudflare Pages at https://spelling-adventure-3d.pages.dev/ via `npm run deploy:cloudflare`; device still undecided.)_
- [x] Review open questions in `spec.md`.
- [ ] Record architecture decisions before optional server features.

## Phase 1 — Foundation
- [x] Initialize clean Next.js App Router project with strict TypeScript.
- [x] Add React Three Fiber, Three.js and Drei.
- [x] Add Vitest and test scripts.
- [x] Add lint/typecheck/test scripts and document commands.
- [ ] Create typed boundaries for game, learning, and persistence. _(2026-10-14: `src/game` boundary exists; `learning/` and `persistence/` deferred until the learning contract and dataset are validated — see constitution §9.)_
- [x] Add title/loading/error screen.
- [x] Verify install, local run, typecheck, lint and tests.

## Phase 2 — First scene
- [x] Dynamically load client-only GameCanvas.
- [x] Render sky/background, ground, path, placeholder hills and trees.
- [x] Add simple lighting and low-cost materials.
- [x] Add scene loading and WebGL error fallback.
- [x] Verify no console errors or server-side WebGL access.

## Phase 3 — Character and movement
- [x] Add placeholder Fern using simple geometry or licensed GLB.
- [x] Implement idle/walk/run state transitions.
- [x] Implement frame-rate-independent movement.
- [x] Implement smooth third-person follow camera.
- [x] Add keyboard controls and interaction key.
- [x] Add mobile joystick and interaction button.
- [x] Add bounded collisions with major obstacles.
- [x] Test camera and controls at mobile viewport sizes.

## Phase 4 — Interaction and quest
- [x] Define typed world-interactable contract.
- [x] Add signpost with proximity detection and prompt.
- [x] Add explicit quest state machine.
- [x] Build challenge UI with large accessible controls.
- [x] Connect through a learning interface, not data internals.
- [x] Use development sample content until authoritative data is validated.
- [x] Test correct, incorrect, cancel, retry and invalid-content flows.
- [x] Keep rewards separate from mastery.

## Phase 5 — Progress and persistence
- [x] Define versioned progress and event schemas.
- [x] Implement IndexedDB repository behind an interface.
- [x] Save quest completion and collected rewards.
- [x] Persist learning events using the agreed learning contract.
- [x] Add migration and corrupted-storage recovery tests.
- [x] Verify reload restores valid state.

## Phase 6 — Offline/PWA
- [x] Choose PWA tooling compatible with Next.js version and host.
- [x] Cache app shell and approved essential assets.
- [x] Add explicit offline-ready state.
- [x] Add versioned cache updates and safe cleanup.
- [x] Test install, completed cache, cold offline launch, reload offline and interrupted session. _(2026-10-14: cache completion, reload with server stopped and cold launch with server stopped verified in Chrome; home-screen install and Android WebView not yet tested — needs the baseline device.)_
- [x] Verify core game does not require AI/network.

## Phase 7 — Art and audio
- [ ] Choose licensed rigged Fern model or create a custom model.
- [ ] Verify idle/walk/run clips and asset license.
- [ ] Replace placeholders incrementally.
- [ ] Add forest props with shared materials/instancing where suitable.
- [x] Add bundled target-word audio where available.
- [ ] Test audio in target WebView.
- [ ] Document asset sources and budgets. _(2026-10-14: curriculum + word audio provenance recorded in `src/learning/content/PROVENANCE.md`; MP3 licence/origin still unverified; 3D assets pending.)_

## Phase 8 — Performance and release
- [ ] Define baseline Android device and WebView version.
- [ ] Measure startup, frame time, draw calls, asset size and memory behavior.
- [x] Add low/medium/high quality settings. _(2026-10-15: Auto/Low/Medium/High on the grown-ups screen, persisted; Auto steps down by itself after sustained low frame rate)_
- [x] Reduce expensive shadows/effects on low-end devices. _(2026-10-15: presets drop shadows, antialiasing, pixel ratio and instance counts; the safety net enforces it at runtime)_
- [ ] Test touch, pause/resume, orientation and storage recovery. _(2026-10-15: render loop pauses while the tab is hidden; storage recovery tested in Phase 5; touch and orientation checked at phone viewports in desktop Chrome; real-device pass still pending.)_
- [ ] Verify hosting and API configuration.
- [x] Document build, deployment, PWA installation and Android integration. _(2026-10-15: README "Deploying" section; Android WebView notes pending the host decision)_

## Definition of done
- [ ] Acceptance criteria in `spec.md` are met.
- [ ] Automated tests pass.
- [ ] Browser and target WebView checks are recorded.
- [ ] No API secrets in client assets.
- [ ] Asset sources/licenses are documented.
- [ ] Known limitations are documented.

## Milestone notes

### 2026-10-14 — Milestone 2 (3D meadow) verified
- Spec Kit 1.1.3 (Claude integration, PowerShell scripts) resolves the feature via the git-ignored `.specify/feature.json`, which points at `spelling-adventure-3d-speckit/specs/001-spelling-adventure-3d`. The spec pack was left in place rather than moved.
- Stack pinned: Next 16.4.0, React 19.3.0, three 0.186.1, @react-three/fiber 9.8.1, @react-three/drei 10.7.9, Vitest 5.0.4, TypeScript 5.9.3.
- three r186 removed `PCFSoftShadowMap`; the canvas uses `shadows="percentage"` (PCF). `THREE.Clock` deprecation warning comes from R3F internals, not project code.
- Verified in Chrome: desktop 1114×809, phone portrait 373×839 and landscape 675×355 viewports; WebGL context loss → error card → Try again → recovered. Production build prerenders `/` as static content.
- Not yet done: baseline Android device/WebView, hosting target, learning contract and dataset access, asset licences (spec §10 open questions).

### 2026-10-14 — Milestone 3 (character, camera, input) verified
- Pure modules with unit tests: `src/game/character/controller.ts` (idle/walk/run, exponential acceleration, frame-rate independence checked at 30 Hz vs 144 Hz, latched camera frame so holding a direction walks straight), `src/game/camera/followCamera.ts` (smoothed follow, drag-to-orbit with auto-follow pause, obstacle pull-in against tree canopies), `src/game/world/collision.ts` (circle push-out for trunks/rocks, circular play boundary), `src/game/input/*` (hub, keyboard bindings, joystick geometry, control-mode detection).
- `src/game/PlayerRig.tsx` is the only per-frame integrator; it mutates Three objects directly and sets React state only on animation transitions.
- Keyboard: WASD/arrows, Shift run, E/Space/Enter interact (consumed; no target until Phase 4). Touch: on-screen joystick + 84 px interact button, shown when the device reports a coarse pointer or touch points, or with `?controls=touch`. Drag anywhere on the canvas orbits the camera.
- Verified in Chrome via the dev-only `window.__spellingAdventureDebug` snapshot: walk 3.2 m/s → run 6.4 m/s → idle; joystick at rim runs; drag changes camera yaw; phone portrait and landscape layouts with touch controls. Boundary and tree collisions are unit-tested; the live boundary run could not complete because Chrome's energy saver (laptop on battery) throttled the page to ~1.5 fps during the session.
- Performance observation for Phase 8: on this Intel Iris Xe laptop at ~1276×926 the high preset rendered at ~27–30 fps when unthrottled. `?quality=low|medium|high` overrides the heuristic for device testing.

### 2026-10-14 — Milestone 4 (interaction and quest) verified
- Learning layer (`src/learning/`, no React/Three/DOM/network): `validateContentPack` schema check, `LearningService` interface, `createDevSampleLearningService` with an explicitly PROVISIONAL policy (least-attempted selection, normalised exact match, unlimited retry, no hint/reveal policy, mastery reported as unavailable), typed learning events (schema v1) kept in memory until Phase 5.
- Development sample content (`src/learning/devSampleContent.ts`) is six plain words, marked `provisional: true`, with no skills, foils or difficulty. Letter tiles use only the word's own letters; no distractors are generated.
- Quest layer (`src/game/quest/`): `WorldInteractable` contract (+ `questId`), `findInteractableInRange`, pure `questReducer` (idle → available → active → completed, cancel/error paths) and `createQuestController` that calls the service; rewards (`grantReward`) live in quest state and never touch the learning service.
- World: one signpost (`sign-meadow-1`) beside the main path with a floating marker that brightens in range; the sign has a walk collider. Input hub gains `setSuspended` so the dialog freezes movement and keys pass through.
- UI: `ChallengeDialog` (role=dialog, Escape cancels, 60 px tiles, keyboard letters/Backspace/Enter, supportive text+icon feedback, close + Back buttons), HUD prompt ("Press E / Tap ! to read the sign") and star counter.
- Word prompt: Web Speech API when available (PROVISIONAL, untested in Android WebView), otherwise a 2.5 s reveal fallback. Bundled audio remains an open question (spec §10).
- Verified in Chrome: walk to sign → prompt → E → dialog → wrong answer (retry feedback, tiles reset) → correct answer → "Star collected", HUD ⭐ 1; movement suspended while the dialog is open. 113 automated tests pass.
- Open decisions still needed before Phase 5/6: authoritative dataset schema and import permission, retry/hint/reveal policy and mastery thresholds, audio assets, hosting target.

### 2026-10-14 — Milestone 5 (progress and persistence) verified
- `src/persistence/`: `GameProgress` schema v1 exactly as in data-contracts.md (stars are derived from `collectedRewardIds`), strict parser, migration runner with an empty table (no historical versions exist; the mechanism is tested with injected steps), `ProgressRepository` interface whose methods never throw, IndexedDB implementation (`spelling-adventure-3d` DB, stores `progress` + `learningEvents`), in-memory twin used as fallback and in tests, and `createProgressPersistence` (serialised writes, retry of failed writes, durable learning-event queue, status for the UI).
- Learning events are persisted through the service's `sink` option using the project's own event schema v1. Note: "the agreed learning contract" does not exist yet; the stored shape is provisional and `parseLearningEvent` guards reads.
- Corrupted progress is moved to a `backup:<timestamp>` key rather than deleted; invalid event rows are skipped and counted, not removed. Data newer than the build is treated the same way.
- Shell: restore completes before the game is marked ready; progress is saved only when completed quests or rewards change; pending writes are flushed on `visibilitychange`/`pagehide`; a quiet HUD note appears while a save is retrying or when storage is memory-only. `?reset=progress` clears local data (development aid).
- Dev dependency added: `fake-indexeddb@6.2.5` (Apache-2.0) so the IndexedDB repository runs the same contract suite as the memory one.
- Verified: 147 automated tests including a shell-level complete → remount → star restored test; real-browser reload check recorded below.

### 2026-10-14 — Milestone 6 (offline / PWA) verified
- Tooling decision: no PWA library. The app has a single static route and no server features, so a hand-written service worker (`public/sw.js`, plain JS) is enough and works for both the Node host and static export (`NEXT_OUTPUT_EXPORT=1 next build` verified). Revisit only if route handlers or image optimisation are added.
- Cache versioning: `next.config.ts` fixes a build id (`NEXT_PUBLIC_BUILD_ID`, also used by `generateBuildId`); the worker is registered as `/sw.js?v=<id>` and names its cache `sa3d-<id>`. Install precaches the shell (`/`) and manifest; activate deletes other `sa3d-*` caches only after the new shell is cached, then claims clients.
- Strategies: shell cache-first with background refresh; `/_next/static/*` cache-first (immutable); other same-origin assets stale-while-revalidate; non-GET, cross-origin and `/_next/*` dev endpoints pass through.
- Offline-ready state: once the scene is ready the client sends the worker the list of same-origin build assets this session actually loaded (`performance.getEntriesByType('resource')`) plus the shell; the HUD shows "Ready to play offline ✓" only after the worker confirms every URL is cached, "Couldn't finish…" otherwise, and "Offline — playing from saved copy" when `navigator.onLine` is false.
- Registration only in production builds (or `?sw=1`), secure contexts only; `?sw=0` disables. Manifest + placeholder icons (generated PNGs, 192/512/maskable) added; `layout.tsx` links them.
- Verified in Chrome against `next start -p 3100`: worker active, cache `sa3d-<id>` with shell + manifest + 9 chunks + css; server process killed → reload and cold launch both delivered HTML and chunks from Cache Storage (`deliveryType: cache-storage`) and the meadow rendered with no console errors. Core gameplay makes no network calls at all (no AI, no API).
- Not yet covered: home-screen install prompt, Android WebView service-worker behaviour, storage quota eviction. These need the baseline device and hosting decision (spec §10).

### 2026-10-14 — Authoritative content imported from `D:Speeling Game 3`
- At the owner's request the validated curriculum was imported (constitution §11, intentional and tracked): `src/learning/content/curriculum.generated.json` (10 levels, 18 foil codes, 200 items; contentVersion `68b831aa…`) and 200 word MP3s in `public/audio/words/`. Full provenance, hashes and update steps: `src/learning/content/PROVENANCE.md`. The source project was only read.
- Development sample content and the letter-tile placeholder were removed. The challenge is now the curriculum's format: hear the target, pick it among the target and its own 3 approved foils; a wrong tile is disabled with a codebook-keyed hint; the question ends on the target.
- Ported as pure modules with tests: dataset validation (`curriculum.ts`, no schema library), puzzles/unlocking/stars (`puzzles.ts`), question/answer/hints (`question.ts`), the source's learning-event schema v1 (`events.ts`), bundled-audio → speech provider chain (`game/audio/wordAudio.ts`).
- Learning service: a quest is one puzzle (five words in curriculum order, strategy `CONTINUE_SEQUENCE`, presentation `FULL_SET`); 1–3 stars by mistakes with best-result retention; locked puzzles refuse to start. Mastery remains unavailable: the source's learner model and adaptive policy (both marked provisional there) are **not yet ported**; that is the next milestone.
- World: sign 1 → `level-1/puzzle-1`; sign 2 (branch path) → `level-1/puzzle-2`, locked until puzzle 1 is complete, with a child-friendly locked message.
- Spec §10 open questions now answered by the source: dataset location/schema and import permission (yes, this import), foil definitions (FoilCodebook sheet, tiers 1–4), audio (bundled MP3 per target, licence unverified). Still open: hosting target, baseline device, mastery/retry thresholds (provisional in source), localisation.
- Previously stored learning events used the earlier provisional shape; they are now skipped as invalid rows (counted, never deleted). Only development data existed.

### 2026-10-14 — Adaptive learning engine ported
- Ported from the source project as pure modules with their scenario tests (`tests/unit/learnerModel.test.ts`, `tests/unit/policy.test.ts`): learner model (question grouping, per-skill/foil-type/item stats, error patterns with repeated-evidence rules), presentation rules (hold harder tiers, introduce new challenge, scaffold to two easiest foils), the six-strategy policy with the shared extras budget and per-strategy limits, decision records (schema v1, reason codes v2), both config files with their safety refinements, and the grown-ups report that never says "mastered".
- Left out on purpose: the source's optional Gemini adviser branches (spec FR-12, no AI in this milestone). Reason codes for the adviser stay reserved so stored decisions remain compatible.
- Learning service now asks the policy for every question; extras never cost stars; each event links to its decision; decisions persist in a new IndexedDB store (`adaptiveDecisions`, DB version 2, upgrade in place). The learner model is rebuilt from the stored event history at restore, so adaptivity carries across sessions.
- Thresholds remain PROVISIONAL and every decision/report says so. Mastery is still never declared.

### 2026-10-14 — Grown-ups screen
- `HoldButton` child gate (press-and-hold 1.8 s; tap, early release, slide-off and keyboard cancel are tested) in the HUD opens `GrownUpsScreen`: overview, per-level status with stars earned/max, tricky spots named from the codebook, words to practise, an "about these numbers" note (on-device only, provisional rules, never "mastered"), device facts (durable storage, stored answers, offline readiness, content version, build id) and a confirmed **Reset progress** that clears IndexedDB and rebuilds the service, quest state and persistence without reloading.
- Movement and keys are suspended while the screen is open; touch controls hide. No AI suggestions (spec FR-12).

### 2026-10-14 — Wind
- Vertex-shader wind on the shared tree canopy, trunk, blossom and stem materials (`src/game/world/wind.ts`, applied in `materials.ts`): height-weighted sway with a per-instance phase and a slow gust cycle, driven by one shared clock (`WindDriver`). No per-frame CPU work, no extra draw calls; shadows keep the resting shape to stay cheap. Frozen and calm under `prefers-reduced-motion`. Pure shader patch and clock are unit-tested; compiled without errors in Chrome at the same frame rate as before.

### 2026-10-14 — Conifer forest
- Trees are now mostly conifers (three stacked cone tiers per tree, upper tiers slightly lighter) with some round trees; sizes, lean and colour vary per instance. A dense belt of trees (inner radius 32 to 50) encloses the meadow beyond the playable edge, with the paths kept clear; low bushes cluster near trees and the edge. Fog starts closer so the belt fades naturally.
- Still fully instanced: trunks, round canopies, three cone tiers and bushes are six draw calls in total for 300+ trees on the high preset. Belt trees and out-of-bounds bushes are excluded from collision checks. Counts per preset: low 22+90 trees/20 bushes, medium 34+160/36, high 46+240/56. Frame rate unchanged in Chrome (≈30 fps on the Intel Iris Xe laptop).

### 2026-10-14 — Rhythmic wind and dense grass
- Wind is now a travelling wave: the sway phase comes from each plant's position along a fixed wind direction (wavelength 14 m) with a small per-plant jitter, so gusts visibly roll across the meadow; the clock runs at 1.8× real time. Constants `WIND_SPEED`, `WIND_DIRECTION`, `WIND_WAVELENGTH` in `src/game/world/wind.ts`.
- Dense grass: seeded tufts (three-sided cones, four triangles each) over the meadow and inner belt, off the paths, as one instanced draw call with strong tip sway. Counts per preset: low 1500, medium 3500, high 7000. 60 fps on the Intel Iris Xe laptop at high with everything on.
- Diagnosis note: a tab that had been reloaded many times in one session dropped to 1.5 fps on every preset while a plain page ran at 61 fps and the main thread was idle; the same scene in a fresh tab ran at 60 fps. Treat long-lived dev tabs as suspect before blaming the scene.

### 2026-10-14 — Lawn grass
- Grass tufts halved in height (cone 0.26 high, radius 0.09, scale 0.65–1.15) with matching wind amplitude, and density roughly doubled: low 3500, medium 8000, high 16000. Measured on the Intel Iris Xe laptop in a fresh tab: medium 60 fps, high 30 fps (shadows + 16k tufts). The high preset is for capable desktops; `grassCount` in `src/game/graphics/quality.ts` is the dial.

### 2026-10-15 — One scene per level, five signs, gates between scenes
- The explorable area grew to radius 50 (belt to 68, hills further out) with a main path and four branches. Each scene holds the five signposts of one curriculum level (`sceneInteractables(level)`), an exit gate at the north end of the main path leading to the next level, and (from level 2) an entry gate behind the spawn leading back.
- `src/game/world/scenes.ts`: a `SceneDefinition` per level (name, seed, palette). Four palettes cycle (Sunny Meadow, Autumn Woods, Snowy Pines, Bluebell Glade) with numbered names on later laps; the same generator builds every scene from its palette, so no new assets are needed.
- Sign markers show state (grey locked, yellow available, green sphere done); gates show closed/open. The HUD badge reads `<scene> · done/5`. Interacting with a closed gate explains how many signs remain; an open gate shows a notice with **Go through**, which cancels any quest, resets input, shows the loading screen and rebuilds the canvas for the new level. Returning players start in the furthest unlocked level.
- Grass is drawn in 36 chunks (12 sectors × 3 rings) so the camera frustum culls what it cannot see; counts scaled for the larger area (low 7000, medium 16000, high 30000). High preset measured at ~30 fps on the Intel Iris Xe laptop.
- Verified in Chrome: fresh level 1 with five signs and the far gate; seeded progress started the game in Autumn Woods with ten stars; the entry gate prompted, offered **Go back?**, and travelled to Sunny Meadow showing 5/5.

### 2026-10-15 — Performance safety net (Phase 8, part 1)
- `src/game/graphics/perfMonitor.ts`: pure rolling frame-time monitor (3 s window, 4 s warm-up, suggests a downgrade after 6 s under 24 fps, then a 20 s cooldown). A `PerfProbe` inside the canvas feeds it and keeps live stats (fps, draw calls, triangles) in a module store read by the grown-ups screen.
- `src/game/graphics/qualityPreference.ts`: Auto or a fixed preset, stored in localStorage (a per-browser convenience, never progress); Auto remembers the lowest preset the safety net settled on. Priority: `?quality=` URL override → preference → heuristic capped by the auto floor. Downgrades never happen mid-puzzle and show a brief HUD note.
- Quality and scene changes no longer rebuild the canvas: the renderer stays, the scene children and player rig re-render. Rebuilding a canvas inside one page left the old WebGL context's GPU state behind and dragged later frames down to ~1.5 fps (also the cause of the earlier 'worn tab' mystery). Forcing context loss on unmount is NOT a fix: React strict mode runs effects twice in development and the forced loss killed the live renderer.
- The render loop pauses while the tab is hidden (`frameloop="never"`), so background tabs cost nothing.
- Verified in Chrome (fresh tab): High 60 fps with 116 draw calls / 273k triangles at level 2; switching Low → Auto through the grown-ups screen kept the same canvas element and 60 fps; preference persisted and cleared.
- Still needs a real Android device: measured startup, memory behaviour, touch feel, orientation, WebView audio and service-worker behaviour.

### 2026-10-15 — Android container and app updates (ported from Speeling Game 3)
- `src/platform/containerBridge.ts`: capability-detected bridge on `window.Android`. `notifyContainerCached()` calls `cachedStatus(true)` once the precache (now including all 200 word MP3s) succeeds; `detectExitBridge()` enables the HUD door button only when one of the UNCONFIRMED exit candidates (`closeApp`, `exitApp`, `close`, `finish`) is callable; `describeContainer()` lists bridge methods for the grown-ups "Container app" card so the real exit name can be read off a device.
- Exit always confirms through the notice dialog ("Leave the forest?"; mid-puzzle copy says the puzzle will start again) with **Stay and play** first and focused; Escape stays.
- `src/offline/updates.ts`: `checkRegistration()` (registration.update() + wait for install, up to 20 s) and `scheduleUpdateChecks()` (30 min timer, foreground, online; 60 s minimum gap). `serviceWorkerClient` became a small store (`createOfflineController`) exposing `checkForUpdates`/`applyUpdate` and watching `controllerchange`; the HUD shows "A new version is ready!" with **Update now** only while nothing is open; grown-ups get an "App version" card with **Check for updates**.
- Tests: `tests/unit/container.test.ts` (bridge, precache extras, update checks, scheduler) and `tests/smoke/container.test.tsx` (door button hidden in browsers, confirm flow, grown-ups cards). Still needs a real host app to confirm the exit method and WebView behaviour.

### 2026-10-15 — Cloudflare Pages deployment
- Classic Pages project `spelling-adventure-3d` (created with `wrangler pages project create --force`, since Wrangler 4.151 otherwise delegates new projects to Workers). `scripts/deploy-cloudflare.mjs` builds the static export with a dated build id (`cf-YYYYMMDD-HHMM`) and runs `wrangler pages deploy out`. `public/_headers`: `sw.js` and the manifest `no-cache`, `/_next/static/*` immutable, audio and icons one week.
- Verified live: service worker registered on the HTTPS origin, `sa3d-cf-20261015-1710` cache filled with the shell, build assets and all 200 recordings; headers confirmed with curl.

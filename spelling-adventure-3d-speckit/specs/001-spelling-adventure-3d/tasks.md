# Tasks: Spelling Adventure 3D

Tasks are phased. Do not start all phases at once. Mark complete only after verification.

## Phase 0 — Safety and specification
- [x] Confirm working directory is the new project, not an existing game.
- [x] Check Node.js/npm and package manager versions.
- [x] Check installed Spec Kit version and supported commands.
- [ ] Resolve hosting target, baseline Android device/WebView, and asset approach.
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
- [ ] Add placeholder Fern using simple geometry or licensed GLB.
- [ ] Implement idle/walk/run state transitions.
- [ ] Implement frame-rate-independent movement.
- [ ] Implement smooth third-person follow camera.
- [ ] Add keyboard controls and interaction key.
- [ ] Add mobile joystick and interaction button.
- [ ] Add bounded collisions with major obstacles.
- [ ] Test camera and controls at mobile viewport sizes.

## Phase 4 — Interaction and quest
- [ ] Define typed world-interactable contract.
- [ ] Add signpost with proximity detection and prompt.
- [ ] Add explicit quest state machine.
- [ ] Build challenge UI with large accessible controls.
- [ ] Connect through a learning interface, not data internals.
- [ ] Use development sample content until authoritative data is validated.
- [ ] Test correct, incorrect, cancel, retry and invalid-content flows.
- [ ] Keep rewards separate from mastery.

## Phase 5 — Progress and persistence
- [ ] Define versioned progress and event schemas.
- [ ] Implement IndexedDB repository behind an interface.
- [ ] Save quest completion and collected rewards.
- [ ] Persist learning events using the agreed learning contract.
- [ ] Add migration and corrupted-storage recovery tests.
- [ ] Verify reload restores valid state.

## Phase 6 — Offline/PWA
- [ ] Choose PWA tooling compatible with Next.js version and host.
- [ ] Cache app shell and approved essential assets.
- [ ] Add explicit offline-ready state.
- [ ] Add versioned cache updates and safe cleanup.
- [ ] Test install, completed cache, cold offline launch, reload offline and interrupted session.
- [ ] Verify core game does not require AI/network.

## Phase 7 — Art and audio
- [ ] Choose licensed rigged Fern model or create a custom model.
- [ ] Verify idle/walk/run clips and asset license.
- [ ] Replace placeholders incrementally.
- [ ] Add forest props with shared materials/instancing where suitable.
- [ ] Add bundled target-word audio where available.
- [ ] Test audio in target WebView.
- [ ] Document asset sources and budgets.

## Phase 8 — Performance and release
- [ ] Define baseline Android device and WebView version.
- [ ] Measure startup, frame time, draw calls, asset size and memory behavior.
- [ ] Add low/medium/high quality settings.
- [ ] Reduce expensive shadows/effects on low-end devices.
- [ ] Test touch, pause/resume, orientation and storage recovery.
- [ ] Verify hosting and API configuration.
- [ ] Document build, deployment, PWA installation and Android integration.

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

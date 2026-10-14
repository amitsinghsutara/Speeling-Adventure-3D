# Tasks: Spelling Adventure 3D

Tasks are phased. Do not start all phases at once. Mark complete only after verification.

## Phase 0 — Safety and specification
- [ ] Confirm working directory is the new project, not an existing game.
- [ ] Check Node.js/npm and package manager versions.
- [ ] Check installed Spec Kit version and supported commands.
- [ ] Resolve hosting target, baseline Android device/WebView, and asset approach.
- [ ] Review open questions in `spec.md`.
- [ ] Record architecture decisions before optional server features.

## Phase 1 — Foundation
- [ ] Initialize clean Next.js App Router project with strict TypeScript.
- [ ] Add React Three Fiber, Three.js and Drei.
- [ ] Add Vitest and test scripts.
- [ ] Add lint/typecheck/test scripts and document commands.
- [ ] Create typed boundaries for game, learning, and persistence.
- [ ] Add title/loading/error screen.
- [ ] Verify install, local run, typecheck, lint and tests.

## Phase 2 — First scene
- [ ] Dynamically load client-only GameCanvas.
- [ ] Render sky/background, ground, path, placeholder hills and trees.
- [ ] Add simple lighting and low-cost materials.
- [ ] Add scene loading and WebGL error fallback.
- [ ] Verify no console errors or server-side WebGL access.

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

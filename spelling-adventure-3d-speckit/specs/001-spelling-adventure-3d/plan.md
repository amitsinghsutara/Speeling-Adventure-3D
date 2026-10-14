# Implementation Plan: Spelling Adventure 3D

**Status:** Proposed — verify against repository and target host.

## 1. Stack
- Next.js App Router + strict TypeScript.
- React Three Fiber and Three.js for the client 3D scene.
- Drei for selected helpers.
- GLB/GLTF assets.
- Vitest for unit tests, React Testing Library for UI, Playwright for browser flows.
- IndexedDB behind a typed repository interface.
- PWA service worker and versioned caches for approved assets.
- Optional server-side AI endpoint only if approved and supported by deployment.

## 2. Boundaries
- `app/`: routes, shell, loading/error UI, server endpoints.
- `components/`: accessible UI outside the world canvas.
- `game/`: scene, character controller, camera, interactions, quest state, world objects, performance.
- `learning/`: content schemas, challenge selection, answer validation, learner state, events and adaptive policy.
- `persistence/`: versioned local repositories and event queue.
- `public/`: licensed/versioned models, textures, audio and icons.
- `tests/`: unit, component, integration and browser tests.

Learning modules depend only on injected interfaces or pure functions. The 3D loop owns high-frequency movement state; React state is for meaningful UI changes.

## 3. Runtime design
- Dynamically load the 3D scene in a client-only component.
- Keep scene objects/controllers stable and avoid recreating the world on unrelated renders.
- Start with simple kinematic movement and bounded collision checks. Add physics only if gameplay needs it.
- Separate input intent, movement, animation, and interaction.
- Use explicit quest states such as `idle -> available -> active -> completed`, with cancel/error paths.
- Keep learning mastery and game rewards separate.
- Persist meaningful changes, not every rendered frame.

## 4. Content and learning
- Begin with clearly marked development-only sample content.
- Import authoritative data only after confirming schema and taxonomy definitions.
- Validate content at build/test time and runtime boundaries.
- Prefer bundled audio where available; document and test fallback behavior in actual WebView.
- AI must never be required for the challenge loop.

## 5. Offline and hosting
- Choose deployment model before implementing server-only features.
- Static export cannot run Next.js Route Handlers; optional AI/sync must be hosted separately.
- For server rendering/Route Handlers, choose a compatible deployment and verify PWA behavior.
- Cache app shell and content assets; show explicit cache completion state.
- Avoid updates that remove the last working cache prematurely.

## 6. Quality strategy
- Unit: content schema, challenge validation, learner policy, quest transitions, reward separation, migrations.
- Component: loading/error UI, challenge UI, keyboard/touch controls.
- Browser: launch, movement, interaction, challenge completion, reload, offline.
- Device: baseline Android WebView, touch, pause/resume, low-memory behavior, audio.
- Performance: measure frame time, draw calls, asset size and startup on named devices.

## 7. Milestones
1. New project skeleton and passing tests.
2. 3D meadow with placeholder geometry.
3. Character controller, camera and inputs.
4. Collision and interaction prompt.
5. Spelling quest vertical slice.
6. Local persistence and offline cache.
7. Art/audio replacement and polish.
8. Android WebView and browser release verification.

## 8. Main risks
- Availability of rigged character/animation assets.
- GPU/memory variation in Android WebView.
- Audio autoplay and speech synthesis differences.
- Static-host constraints for Next.js server features.
- Incomplete/ambiguous source learning data.
- Offline cache updates and storage quota.
- Scope creep beyond the compact meadow.

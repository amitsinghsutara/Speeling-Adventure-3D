# Spelling Adventure 3D Constitution

## 1. Child-first learning
The product must be welcoming, age-appropriate, non-punitive, and focused on learning. Mistakes produce helpful feedback, not shame or loss of essential access.

## 2. Deterministic learning authority
Content validation, answer correctness, learning-event interpretation, skill progression, and challenge selection belong to a testable local TypeScript learning layer. AI may offer optional suggestions but cannot silently override correctness, mastery, or validated content.

## 3. Separation of concerns
The 3D scene, React UI, quest system, persistence, and learning engine must have explicit boundaries. Learning logic must not depend on React, Three.js, browser rendering, or remote services.

## 4. Offline-first core
After required assets and content are cached, the learner must be able to launch the game and complete available activities without a network connection. Network failure must not corrupt local progress.

## 5. Performance as a feature
Design for entry-level Android phones and Android WebView as well as desktop browsers. Prefer low-poly geometry, shared materials, instancing, compressed assets, bounded draw calls, scalable quality settings, and measured performance.

## 6. Accessible, forgiving interaction
Support keyboard and touch input, large readable controls, clear focus states, audio controls, reduced-motion considerations, and alternatives to precise timing. Never rely on color alone to communicate correctness.

## 7. Privacy by default
Collect only events needed for learning/debugging. Avoid unnecessary personal data. Keep secrets out of client bundles. Online AI endpoints must be server-side and use data minimization.

## 8. Tested changes
Learning logic, content validation, progression, persistence, and fallback behavior require automated tests. Verify each milestone before moving on.

## 9. Data integrity
Never invent missing words, curriculum mappings, foil definitions, dialect rules, mastery thresholds, or learning policies. Preserve source data and validate imports against a documented schema.

## 10. Small vertical slices
Build one complete experience first: enter meadow, move Fern, interact with one sign, complete one spelling challenge, receive feedback, save progress, reload, and continue.

## 11. New project boundary
This repository is a clean implementation. Do not modify, overwrite, or silently import code from another Spelling Adventure project. Reuse of visual references or validated data must be intentional and tracked.

## 12. Deployment portability
Do not assume all Next.js features work in every static host. Document and test the deployment target, server endpoints, PWA service worker, and Android WebView constraints.

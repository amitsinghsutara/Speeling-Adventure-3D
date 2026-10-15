# Curriculum content provenance

Imported intentionally on 2026-10-14 at the project owner's request, from the
sibling project `D:\Speeling Game 3` (constitution §11: reuse of validated
data must be intentional and tracked). Nothing in the source project was
modified.

| Field | Value |
|---|---|
| Source project | `D:\Speeling Game 3` (git commit `c2074742b507a237959ddfaba30972b14b1e527e`) |
| Authoritative spreadsheet | `English_Spelling_Words_and_Foils.xlsx` (not copied; stays with the source project) |
| Spreadsheet SHA-256 | `4e5adbb73619797a2f9e7d370b7e2dc04130d36f00c0cf47addb632c9fc76926` |
| Generated dataset copied | `src/content/content.generated.json` → `curriculum.generated.json` |
| Dataset file SHA-256 | `8153265383d6804f0a9536aa24185dd544ff46614d1b923255d64de17ef683ff` |
| `contentVersion` (hash of levels + codebook + items) | `68b831aa0a923e6931cd4420b9c126553ee9d801bd4fe6af61178666266363cf` |
| Contents | 10 levels, 18 foil codes, 200 items, 35 research notes |
| Word audio copied | `public/audio/words/<target>.mp3`, 200 files, 4.8 MB, one per target |

## How the dataset was produced

The source project's `scripts/import-content.ts` reads the spreadsheet
(WordList, LevelGuide, FoilCodebook, Summary, ResearchBasis) and fails on any
shape, value, code, duplicate, sequence or tally problem before writing the
JSON. Foil-code meanings and difficulty tiers come from the FoilCodebook sheet
only. See `docs/content.md` in the source project.

## Rules carried over (source `docs/`, `CONTEXT.md`)

- The spreadsheet is the curriculum: never invent, fix or drop words, foils,
  codes or levels. Foils shown to a child are only the item's own foils.
- A question: the child hears the target and picks its spelling among the
  target and its approved foils. A wrong tile is disabled; the question ends
  on the target.
- Levels are split into 5 puzzles in sequence order; puzzles unlock one after
  another and a level unlocks once the previous level's puzzles are complete.
- Stars per puzzle: 0 mistakes → 3, 1–3 → 2, 4+ → 1; a replay never lowers a
  stored result. Extras chosen by adaptive strategies never cost stars.
- The source's learner model, presentation rules, adaptive policy, decision
  record, configs and grown-ups report were ported on 2026-10-14 (without the
  optional AI-adviser branches). Their thresholds are **provisional** (not
  confirmed by a curriculum owner) and are flagged on every decision.
- The data calls itself an unpiloted, research-informed draft assuming General
  American pronunciation.

## Platform code ported (not content)

- 2026-10-15: the Android container bridge (`src/platform/containerBridge.ts`)
  and the update-check helpers (`src/offline/updates.ts`) were re-implemented
  from the source project's `src/platform/containerBridge.ts`, `src/pwa/*`
  and `docs/container.md` / `docs/operations.md`. The exit method names are
  the source's unconfirmed candidates; `cachedStatus(true)` is the one call
  the source documents as in use.

## Not documented in the source

- Licence and origin of the word MP3s (voice/TTS provider) are not recorded in
  the source project. Treat as **unverified** until the owner confirms.

## Updating

1. Edit the spreadsheet in the source project and run `npm run gen:content`
   there.
2. Copy the regenerated JSON here and update the hashes and date above.
3. Re-copy `public/audio/words/` if targets changed; the audio coverage test
   must pass.

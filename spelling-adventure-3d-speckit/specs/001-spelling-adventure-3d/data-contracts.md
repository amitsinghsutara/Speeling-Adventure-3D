# Initial Data Contracts

These examples are for discussion, not claims about an existing learning API. Adapt them after source-data inspection.

## World interaction
```ts
export interface WorldInteractable {
  id: string;
  kind: "spelling-sign" | "collectible" | "landmark";
  promptKey: string;
  position: readonly [number, number, number];
  interactionRadius: number;
}
```

## Challenge boundary
```ts
export interface SpellingChallenge {
  id: string;
  targetAudioId?: string;
  targetWord: string;
  skillId?: string;
  answerOptions?: readonly string[];
}
```
Only use answer options if the validated content model supports them. Do not generate distractors from assumptions or infer meanings of existing taxonomy labels.

## Answer result
```ts
export interface AnswerResult {
  correct: boolean;
  feedbackKey: string;
  nextAction: "continue" | "retry" | "hint";
}
```
The actual result must follow the learning contract if source code/data is later intentionally imported. Correctness and next-challenge decisions belong to the learning layer.

## Game progress
```ts
export interface GameProgress {
  schemaVersion: number;
  completedQuestIds: string[];
  collectedRewardIds: string[];
  updatedAt: string;
}
```
Learning progress/events use a separate schema. A star or collectible must never imply mastery.

## Data import guardrails
- Keep authoritative source files unchanged and track provenance.
- Validate all imported rows.
- Never guess missing fields or educational content.
- Do not interpret foil labels until documented definitions are available.
- Avoid child names or other personal data unless required and explicitly approved.

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createDefaultAudioProvider, type PlayOutcome } from "@/game/audio/wordAudio";
import type { QuestState } from "@/game/quest/questController";

export interface ChallengeDialogProps {
  quest: QuestState;
  onSubmit: (word: string) => void;
  onAdvance: () => void;
  onCancel: () => void;
  onDismiss: () => void;
}

const LOCKED_COPY = {
  title: "This sign is waiting",
  message: "Finish the other sign first, then come back here!",
};
const ERROR_COPY = {
  title: "This sign is still asleep",
  message: "There is no spelling puzzle here yet. Let's explore somewhere else!",
};

/**
 * Hear-and-pick spelling question (the curriculum's format): the child hears
 * the target and chooses it among the word and its own approved foils. Wrong
 * tiles are disabled with a hint; the question ends on the target. Large
 * controls, text plus icons for feedback, cancel at any time.
 */
export function ChallengeDialog({
  quest,
  onSubmit,
  onAdvance,
  onCancel,
  onDismiss,
}: ChallengeDialogProps) {
  const challenge = quest.challenge;
  const dialog = useRef<HTMLDivElement>(null);
  const audio = useMemo(
    () => createDefaultAudioProvider(typeof window === "undefined" ? undefined : window),
    [],
  );
  const [audioOutcome, setAudioOutcome] = useState<PlayOutcome | "idle">("idle");
  const [revealed, setRevealed] = useState<string | null>(null);

  const hear = useCallback(() => {
    if (!challenge) return;
    void audio
      .play({ itemId: challenge.itemId, target: challenge.targetWord })
      .then((outcome) => {
        setAudioOutcome(outcome);
        if (outcome !== "played") setRevealed(challenge.targetWord);
      });
  }, [audio, challenge]);

  // Play the word whenever a new question appears; stop audio on unmount.
  useEffect(() => {
    dialog.current?.focus();
    if (quest.phase === "active" && challenge && !quest.celebrating) hear();
    return () => audio.stop();
  }, [audio, challenge, hear, quest.phase, quest.celebrating]);

  useEffect(() => {
    if (revealed === null) return;
    const timer = setTimeout(() => setRevealed(null), 3000);
    return () => clearTimeout(timer);
  }, [revealed]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (quest.phase === "completed") onDismiss();
      else onCancel();
    } else if (event.key === "Enter" && quest.phase === "active" && quest.celebrating) {
      event.preventDefault();
      onAdvance();
    }
  };

  if (quest.phase === "error") {
    const copy = quest.errorCode === "locked" ? LOCKED_COPY : ERROR_COPY;
    return (
      <div className="overlay overlay--dialog">
        <div
          ref={dialog}
          className="card card--challenge"
          role="alertdialog"
          aria-labelledby="challenge-title"
          aria-modal="true"
          tabIndex={-1}
          onKeyDown={onKeyDown}
        >
          <div className="card__icon" aria-hidden="true">
            {quest.errorCode === "locked" ? "🔒" : "😴"}
          </div>
          <h1 id="challenge-title">{copy.title}</h1>
          <p>{copy.message}</p>
          <button type="button" className="button" onClick={onCancel}>
            Back to the meadow
          </button>
          {quest.errorCode !== "locked" ? (
            <details>
              <summary>Details for grown-ups</summary>
              <code>{quest.error}</code>
            </details>
          ) : null}
        </div>
      </div>
    );
  }

  if (!challenge) return null;
  const completed = quest.phase === "completed";
  const disabled = new Set(quest.lastResult?.correct ? [] : (quest.lastResult?.disabledWords ?? []));
  const hint = !quest.lastResult?.correct ? (quest.lastResult?.hint ?? null) : null;
  const progressLabel = `Word ${challenge.questionIndex + 1} of ${challenge.questionCount}`;

  return (
    <div className="overlay overlay--dialog">
      <div
        ref={dialog}
        className="card card--challenge"
        role="dialog"
        aria-labelledby="challenge-title"
        aria-modal="true"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        data-testid="challenge-dialog"
        data-question={challenge.id}
      >
        <button
          type="button"
          className="card__close"
          aria-label="Close and go back to the meadow"
          onClick={completed ? onDismiss : onCancel}
        >
          ×
        </button>

        {completed ? (
          <>
            <h1 id="challenge-title">Puzzle finished!</h1>
            <p className="challenge__stars" aria-label={`${quest.starsEarned} stars`}>
              {"⭐".repeat(quest.starsEarned)}
              <span className="challenge__stars--dim" aria-hidden="true">
                {"☆".repeat(Math.max(0, 3 - quest.starsEarned))}
              </span>
            </p>
            <p className="challenge__reward" role="status">
              {quest.newStars > 0
                ? `You earned ${quest.newStars} new ${quest.newStars === 1 ? "star" : "stars"}!`
                : "Great practice! You already have these stars."}
            </p>
            <div className="challenge__actions">
              <button type="button" className="button" onClick={onDismiss} autoFocus>
                Back to the meadow
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 id="challenge-title">Listen and pick the word</h1>
            <p className="challenge__progress" aria-live="polite">
              {progressLabel}
            </p>
            <button type="button" className="button button--secondary" onClick={hear}>
              🔊 Hear it again
            </button>
            {revealed ? (
              <p className="challenge__reveal" role="status">
                {audioOutcome === "unavailable"
                  ? "No sound on this device. The word is "
                  : "The sound didn't play. The word is "}
                <strong>{revealed}</strong>
              </p>
            ) : null}

            <div className="challenge__choices" role="group" aria-label="Choices">
              {challenge.choices.map((choice) => (
                <button
                  key={choice.word}
                  type="button"
                  className="tile tile--word"
                  disabled={quest.celebrating || disabled.has(choice.word)}
                  aria-pressed={quest.celebrating && choice.word === challenge.targetWord}
                  onClick={() => onSubmit(choice.word)}
                >
                  {choice.word}
                </button>
              ))}
            </div>

            {quest.celebrating ? (
              <>
                <p className="challenge__feedback challenge__feedback--good" role="status">
                  <span aria-hidden="true">⭐</span> Yes! That&apos;s {challenge.targetWord}!
                </p>
                <div className="challenge__actions">
                  <button type="button" className="button" onClick={onAdvance} autoFocus>
                    Next word
                  </button>
                </div>
              </>
            ) : hint ? (
              <p className="challenge__feedback challenge__feedback--retry" role="status">
                <span aria-hidden="true">💪</span> {hint}
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { STATUS_TEXT, percent, type ProgressReport } from "@/learning/report";

export interface LevelStars {
  readonly level: number;
  readonly earned: number;
  readonly max: number;
}

export interface GrownUpsFacts {
  readonly buildId: string;
  readonly contentVersion: string;
  readonly contentSource: string;
  readonly provisionalRules: boolean;
  /** Progress is in durable storage (IndexedDB) rather than memory only. */
  readonly persistent: boolean;
  readonly offlinePhase: string;
  readonly storedEvents: number;
}

export interface GrownUpsScreenProps {
  report: ProgressReport;
  stars: readonly LevelStars[];
  facts: GrownUpsFacts;
  onBack: () => void;
  onReset: () => void;
}

/**
 * The grown-ups' progress screen: plain-language progress from this device's
 * learner model, device facts, and a confirmed reset. Reached from the HUD by
 * press-and-hold. Nothing on this page is sent anywhere. Ported in spirit from
 * the source project; this build has no AI suggestions.
 */
export function GrownUpsScreen({ report, stars, facts, onBack, onReset }: GrownUpsScreenProps) {
  const [confirmingReset, setConfirmingReset] = useState(false);
  const started = report.levels.filter((l) => l.status !== "not-started");
  const starsFor = (level: number) => stars.find((s) => s.level === level) ?? { level, earned: 0, max: 0 };

  return (
    <div className="overlay overlay--grownups">
      <div className="grownups" role="dialog" aria-labelledby="grownups-title" aria-modal="true" data-testid="grownups">
        <div className="grownups__top">
          <button type="button" className="button button--secondary" onClick={onBack}>
            ← Back to the meadow
          </button>
          <h1 id="grownups-title">For grown-ups</h1>
        </div>

        <section className="grownups__card" aria-labelledby="overview">
          <h2 id="overview">Overview</h2>
          {report.questions === 0 ? (
            <p>No answers yet on this device. Progress appears here as your child plays.</p>
          ) : (
            <dl className="grownups__stats">
              <div>
                <dt>Questions answered</dt>
                <dd>{report.questions}</dd>
              </div>
              <div>
                <dt>Different words practised</dt>
                <dd>{report.wordsPractised}</dd>
              </div>
              <div>
                <dt>Right first time</dt>
                <dd>{percent(report.firstTryAccuracy)}</dd>
              </div>
            </dl>
          )}
        </section>

        {started.length > 0 ? (
          <section className="grownups__card" aria-labelledby="levels">
            <h2 id="levels">Levels</h2>
            <ul className="grownups__list">
              {started.map((l) => {
                const s = starsFor(l.level);
                return (
                  <li key={l.level} className="grownups__level">
                    <div className="grownups__level-title">
                      <strong>Level {l.level}</strong> <span className="grownups__muted">{l.skillPattern}</span>
                      <span className="grownups__stars" aria-label={`${s.earned} of ${s.max} stars`}>
                        ⭐ {s.earned}/{s.max}
                      </span>
                    </div>
                    <p className="grownups__status">{STATUS_TEXT[l.status]}</p>
                    <p className="grownups__muted">
                      {l.questions} questions · right first time {percent(l.firstTryAccuracy)} overall,{" "}
                      {percent(l.recentAccuracy)} recently
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <section className="grownups__card" aria-labelledby="tricky">
          <h2 id="tricky">Tricky spots</h2>
          {report.trickySpots.length === 0 ? (
            <p>No repeated mistakes spotted. A single slip is never counted as a pattern.</p>
          ) : (
            <>
              <ul className="grownups__list">
                {report.trickySpots.map((t) => (
                  <li key={t.code}>
                    <strong>{t.name}</strong>{" "}
                    <span className="grownups__muted">(for example {t.example.replace(">", "›")})</span>: picked{" "}
                    {t.chosen} of the {t.presentedIn} times it was a choice.
                  </li>
                ))}
              </ul>
              <p className="grownups__muted">The game is already giving extra practice on these.</p>
            </>
          )}
        </section>

        {report.practiseWords.length > 0 ? (
          <section className="grownups__card" aria-labelledby="words">
            <h2 id="words">Words to practise together</h2>
            <p className="grownups__words">{report.practiseWords.join(", ")}</p>
            <p className="grownups__muted">Not right first time on their most recent try.</p>
          </section>
        ) : null}

        <section className="grownups__card" aria-labelledby="about">
          <h2 id="about">About these numbers</h2>
          <p className="grownups__muted">
            Everything on this page is worked out on this device from your child&apos;s answers. Nothing is sent
            anywhere to make this page.
            {facts.provisionalRules
              ? " The rules behind the labels are still provisional and may change once a teacher reviews them."
              : ""}{" "}
            The game never claims a word or level is finished for good.
          </p>
          <dl className="grownups__facts">
            <div>
              <dt>Saved on this device</dt>
              <dd>{facts.persistent ? "Yes" : "Only until this page closes"}</dd>
            </div>
            <div>
              <dt>Answers stored</dt>
              <dd>{facts.storedEvents}</dd>
            </div>
            <div>
              <dt>Offline play</dt>
              <dd>{facts.offlinePhase === "ready" ? "Ready" : facts.offlinePhase}</dd>
            </div>
            <div>
              <dt>Word list</dt>
              <dd>
                {facts.contentSource} · {facts.contentVersion.slice(0, 12)}
              </dd>
            </div>
            <div>
              <dt>Game build</dt>
              <dd>{facts.buildId}</dd>
            </div>
          </dl>
        </section>

        <section className="grownups__card" aria-labelledby="reset">
          <h2 id="reset">Start over</h2>
          <p className="grownups__muted">Removes all stars, unlocked puzzles and answer history on this device.</p>
          <button type="button" className="button button--danger" onClick={() => setConfirmingReset(true)}>
            Reset progress
          </button>
        </section>

        {confirmingReset ? (
          <div className="overlay overlay--dialog">
            <div className="card" role="alertdialog" aria-labelledby="reset-title" aria-modal="true">
              <h1 id="reset-title">Reset all progress?</h1>
              <p>Stars, unlocked puzzles and answer history on this device will be removed. This cannot be undone.</p>
              <div className="challenge__actions">
                <button type="button" className="button button--secondary" onClick={() => setConfirmingReset(false)} autoFocus>
                  Keep progress
                </button>
                <button
                  type="button"
                  className="button button--danger"
                  onClick={() => {
                    setConfirmingReset(false);
                    onReset();
                  }}
                >
                  Yes, reset
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

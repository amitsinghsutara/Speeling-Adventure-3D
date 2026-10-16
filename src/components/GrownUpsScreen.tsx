"use client";

import { useState } from "react";
import type { QualityLevel } from "@/game/graphics/quality";
import type { QualityPreference } from "@/game/graphics/qualityPreference";
import { STATUS_TEXT, percent, type ProgressReport } from "@/learning/report";
import type { OfflineStatus } from "@/offline/serviceWorkerClient";
import type { ContainerReport } from "@/platform/containerBridge";
import { describeAttempt, type OrientationReport } from "@/platform/orientation";

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

export interface GraphicsSettings {
  readonly preference: QualityPreference;
  readonly effective: QualityLevel;
  /** True when a ?quality= URL parameter is forcing the preset. */
  readonly urlOverride: boolean;
  readonly stats: { readonly averageFps: number; readonly drawCalls: number; readonly triangles: number };
  readonly onChange: (value: QualityPreference) => void;
}

export interface UpdateSettings {
  readonly buildId: string;
  readonly offline: OfflineStatus;
  readonly onCheck: () => void;
  readonly onApply: () => void;
}

export interface GrownUpsScreenProps {
  report: ProgressReport;
  stars: readonly LevelStars[];
  facts: GrownUpsFacts;
  graphics?: GraphicsSettings;
  container?: ContainerReport;
  /** What the last landscape attempt achieved (touch devices). */
  orientation?: OrientationReport | null;
  updates?: UpdateSettings;
  onBack: () => void;
  onReset: () => void;
}

/**
 * The grown-ups' progress screen: plain-language progress from this device's
 * learner model, device facts, and a confirmed reset. Reached from the HUD by
 * press-and-hold. Nothing on this page is sent anywhere. Ported in spirit from
 * the source project; this build has no AI suggestions.
 */
const QUALITY_CHOICES: readonly { value: QualityPreference; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const CHECK_TEXT: Record<string, string> = {
  "update-ready": "A new version is ready.",
  "up-to-date": "You have the latest version.",
  offline: "No connection right now; the game keeps working offline.",
  error: "Could not check right now. Try again later.",
  unsupported: "Updates are handled by your browser on this device.",
};

export function GrownUpsScreen({ report, stars, facts, graphics, container, orientation, updates, onBack, onReset }: GrownUpsScreenProps) {
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

        {graphics ? (
          <section className="grownups__card" aria-labelledby="graphics">
            <h2 id="graphics">Graphics</h2>
            <p className="grownups__muted">
              Auto picks a preset for this device and steps down by itself if the game runs slowly.
              {graphics.urlOverride ? " A test setting in the address bar is overriding this choice." : ""}
            </p>
            <div className="grownups__choices" role="group" aria-label="Graphics quality">
              {QUALITY_CHOICES.map((choice) => (
                <button
                  key={choice.value}
                  type="button"
                  className={`button button--secondary ${graphics.preference === choice.value ? "button--selected" : ""}`}
                  aria-pressed={graphics.preference === choice.value}
                  onClick={() => graphics.onChange(choice.value)}
                >
                  {choice.label}
                </button>
              ))}
            </div>
            <dl className="grownups__facts">
              <div>
                <dt>Running now</dt>
                <dd>{graphics.effective}</dd>
              </div>
              <div>
                <dt>Frames per second</dt>
                <dd data-testid="fps">{Math.round(graphics.stats.averageFps)}</dd>
              </div>
              <div>
                <dt>Draw calls</dt>
                <dd>{graphics.stats.drawCalls}</dd>
              </div>
              <div>
                <dt>Triangles</dt>
                <dd>{graphics.stats.triangles.toLocaleString()}</dd>
              </div>
            </dl>
          </section>
        ) : null}

        {updates ? (
          <section className="grownups__card" aria-labelledby="version">
            <h2 id="version">App version</h2>
            <p className="grownups__muted">
              Build {updates.buildId}
              {updates.offline.version ? ` · offline copy ${updates.offline.version}` : ""}
              {updates.offline.phase === "ready" ? " · ready to play offline" : ""}
            </p>
            <div className="challenge__actions" style={{ justifyContent: "flex-start" }}>
              <button type="button" className="button button--secondary" onClick={updates.onCheck} disabled={updates.offline.checking}>
                {updates.offline.checking ? "Checking…" : "Check for updates"}
              </button>
              {updates.offline.updateReady ? (
                <button type="button" className="button" onClick={updates.onApply}>
                  Update now
                </button>
              ) : null}
            </div>
            {updates.offline.lastCheck ? (
              <p className="grownups__muted" role="status">
                {CHECK_TEXT[updates.offline.lastCheck.result] ?? updates.offline.lastCheck.result}
              </p>
            ) : updates.offline.updateReady ? (
              <p className="grownups__muted" role="status">A new version is ready.</p>
            ) : null}
          </section>
        ) : null}

        {container ? (
          <section className="grownups__card" aria-labelledby="container">
            <h2 id="container">Container app</h2>
            {container.bridges.length === 0 ? (
              <p className="grownups__muted">
                No container app found. In a normal browser this is expected, and there is no exit button.
              </p>
            ) : (
              <>
                {container.bridges.map((bridge) => (
                  <p key={bridge.name} className="grownups__muted">
                    <strong>window.{bridge.name}</strong>:{" "}
                    {bridge.methods.length > 0 ? bridge.methods.join(", ") : "no methods listed"}
                  </p>
                ))}
                <p className="grownups__muted">
                  {container.exitMethod
                    ? `Exit button: on (uses ${container.exitMethod}).`
                    : "Exit button: off. None of these is a known exit method."}
                </p>
              </>
            )}
            {orientation ? (
              <p className="grownups__muted" data-testid="orientation-report">
                Landscape ({orientation.trigger}): container asked — {describeAttempt(orientation.container)}; fullscreen —{" "}
                {describeAttempt(orientation.fullscreen)}; browser lock — {describeAttempt(orientation.lock)}.
              </p>
            ) : (
              <p className="grownups__muted">Landscape: not requested on this device (keyboard controls).</p>
            )}
          </section>
        ) : null}

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

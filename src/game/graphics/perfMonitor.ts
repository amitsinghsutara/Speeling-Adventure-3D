/**
 * Frame-time monitor for the automatic quality safety net. Pure and
 * deterministic: feed it frame deltas, read back a rolling average and a
 * verdict. It asks for a downgrade only after frame rate stays below the
 * threshold for a sustained period, and then waits before asking again, so a
 * single stutter (tab switch, GC pause) never changes settings.
 */
export interface PerfMonitorOptions {
  /** Rolling window length for the average, in seconds. */
  readonly windowSeconds?: number;
  /** Average fps below this counts as "slow". */
  readonly lowFpsThreshold?: number;
  /** How long fps must stay slow before a downgrade is suggested. */
  readonly sustainSeconds?: number;
  /** Ignore the first seconds after start/resume (shader warm-up, loading). */
  readonly warmupSeconds?: number;
  /** Minimum gap between two suggestions. */
  readonly cooldownSeconds?: number;
}

export interface PerfSample {
  readonly averageFps: number;
  readonly slowFor: number;
  readonly suggestDowngrade: boolean;
}

export interface PerfMonitor {
  /** Records one frame of `delta` seconds and returns the current reading. */
  sample(delta: number): PerfSample;
  /** Forgets history, e.g. after a scene or quality change. */
  reset(): void;
  readonly averageFps: number;
}

export function createPerfMonitor(options: PerfMonitorOptions = {}): PerfMonitor {
  const windowSeconds = options.windowSeconds ?? 3;
  const lowFps = options.lowFpsThreshold ?? 24;
  const sustain = options.sustainSeconds ?? 6;
  const warmup = options.warmupSeconds ?? 4;
  const cooldown = options.cooldownSeconds ?? 20;

  let frames: number[] = [];
  let windowTotal = 0;
  let elapsed = 0;
  let slowFor = 0;
  let lastSuggestionAt = Number.NEGATIVE_INFINITY;
  let average = 0;

  const reset = () => {
    frames = [];
    windowTotal = 0;
    elapsed = 0;
    slowFor = 0;
    lastSuggestionAt = Number.NEGATIVE_INFINITY;
    average = 0;
  };

  return {
    sample(delta) {
      const dt = Math.max(0.0001, Math.min(delta, 1));
      elapsed += dt;
      frames.push(dt);
      windowTotal += dt;
      while (windowTotal > windowSeconds && frames.length > 1) {
        windowTotal -= frames.shift() ?? 0;
      }
      average = frames.length / windowTotal;

      let suggest = false;
      if (elapsed > warmup) {
        if (average < lowFps) slowFor += dt;
        else slowFor = 0;
        if (slowFor >= sustain && elapsed - lastSuggestionAt >= cooldown) {
          suggest = true;
          lastSuggestionAt = elapsed;
          slowFor = 0;
        }
      }
      return { averageFps: average, slowFor, suggestDowngrade: suggest };
    },
    reset,
    get averageFps() {
      return average;
    },
  };
}

export const QUALITY_ORDER = ["low", "medium", "high"] as const;

/** The next preset down, or null when already at the lowest. */
export function lowerQuality(level: "low" | "medium" | "high"): "low" | "medium" | null {
  if (level === "high") return "medium";
  if (level === "medium") return "low";
  return null;
}

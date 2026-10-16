/**
 * The game is designed for landscape. Several layers try to keep phones and
 * tablets sideways, each harmless where it does not apply:
 *
 * 1. The Android container, when present, is asked to fix its orientation
 *    through `window.Android.setContainerAppOrientation("landscape")`, the
 *    call the earlier Spelling Adventure games use. The root layout also
 *    makes this call inline at page start, before React loads.
 * 2. The web manifest asks for landscape when the app is installed.
 * 3. The Screen Orientation API lock. Mobile browsers only grant it to a
 *    fullscreen (or installed) page and only after a user gesture, so the
 *    "turn your device" screen offers a tap that goes fullscreen and locks.
 *
 * Every attempt is recorded in an `OrientationReport` for the grown-ups
 * screen, so what a particular device did can be read off it.
 */
export type ContainerOrientation = "landscape" | "portrait";

interface OrientationScreen {
  orientation?: { lock?: (orientation: string) => Promise<void>; type?: string };
}

interface OrientationDocument {
  fullscreenElement?: Element | null;
  documentElement?: { requestFullscreen?: (options?: { navigationUI?: string }) => Promise<void> };
}

export interface OrientationWindow {
  Android?: Record<string, unknown>;
  screen?: OrientationScreen;
  document?: OrientationDocument;
  matchMedia?: (query: string) => {
    matches: boolean;
    addEventListener?: (type: "change", fn: () => void) => void;
    removeEventListener?: (type: "change", fn: () => void) => void;
  };
  innerWidth?: number;
  innerHeight?: number;
}

const currentWindow = (): OrientationWindow | undefined =>
  typeof window === "undefined" ? undefined : (window as unknown as OrientationWindow);

export type AttemptResult =
  | { readonly outcome: "ok" }
  | { readonly outcome: "unavailable" }
  | { readonly outcome: "refused"; readonly reason: string };

export interface OrientationReport {
  /** Did the native container expose and accept setContainerAppOrientation? */
  readonly container: AttemptResult;
  readonly fullscreen: AttemptResult;
  readonly lock: AttemptResult;
  /** What triggered this attempt. */
  readonly trigger: "start" | "gesture" | "tap";
  readonly at: number;
}

const errorReason = (error: unknown): string =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);

/** Asks the native container to fix its orientation. */
export function requestContainerOrientation(
  orientation: ContainerOrientation,
  win: OrientationWindow | undefined = currentWindow(),
): AttemptResult {
  const bridge = win?.Android;
  const method = bridge?.["setContainerAppOrientation"];
  if (typeof method !== "function") return { outcome: "unavailable" };
  try {
    (method as (value: string) => void).call(bridge, orientation);
    return { outcome: "ok" };
  } catch (error) {
    return { outcome: "refused", reason: errorReason(error) };
  }
}

/** Puts the page in fullscreen (needs a user gesture in every browser). */
export async function requestFullscreen(win: OrientationWindow | undefined = currentWindow()): Promise<AttemptResult> {
  const doc = win?.document;
  if (doc?.fullscreenElement) return { outcome: "ok" };
  const request = doc?.documentElement?.requestFullscreen;
  if (typeof request !== "function") return { outcome: "unavailable" };
  try {
    await request.call(doc?.documentElement, { navigationUI: "hide" });
    return { outcome: "ok" };
  } catch (error) {
    return { outcome: "refused", reason: errorReason(error) };
  }
}

/** Tries the Screen Orientation API lock. */
export async function lockScreenOrientation(
  orientation: "landscape" | "portrait",
  win: OrientationWindow | undefined = currentWindow(),
): Promise<AttemptResult> {
  const lock = win?.screen?.orientation?.lock;
  if (typeof lock !== "function") return { outcome: "unavailable" };
  try {
    await lock.call(win?.screen?.orientation, orientation);
    return { outcome: "ok" };
  } catch (error) {
    return { outcome: "refused", reason: errorReason(error) };
  }
}

export interface EnforceOptions {
  /** Go fullscreen first (only possible inside a user gesture). */
  readonly fullscreen?: boolean;
  readonly trigger?: OrientationReport["trigger"];
  readonly now?: () => number;
}

/** Container first, then (optionally) fullscreen, then the browser lock. Safe to call repeatedly. */
export async function enforceLandscape(
  win: OrientationWindow | undefined = currentWindow(),
  options: EnforceOptions = {},
): Promise<OrientationReport> {
  const container = requestContainerOrientation("landscape", win);
  const fullscreen: AttemptResult = options.fullscreen ? await requestFullscreen(win) : { outcome: "unavailable" };
  const lock = await lockScreenOrientation("landscape", win);
  return { container, fullscreen, lock, trigger: options.trigger ?? "start", at: (options.now ?? Date.now)() };
}

/** True when the viewport is taller than it is wide. */
export function isPortrait(win: OrientationWindow | undefined = currentWindow()): boolean {
  if (!win) return false;
  if (typeof win.matchMedia === "function") return win.matchMedia("(orientation: portrait)").matches;
  return (win.innerHeight ?? 0) > (win.innerWidth ?? 0);
}

/** Calls `onChange` whenever the device turns; returns a function that stops watching. */
export function watchOrientation(onChange: () => void, win: OrientationWindow | undefined = currentWindow()): () => void {
  if (!win || typeof win.matchMedia !== "function") return () => {};
  const query = win.matchMedia("(orientation: portrait)");
  query.addEventListener?.("change", onChange);
  return () => query.removeEventListener?.("change", onChange);
}

/** One line per attempt, for the grown-ups screen. */
export function describeAttempt(result: AttemptResult): string {
  switch (result.outcome) {
    case "ok":
      return "yes";
    case "unavailable":
      return "not available here";
    case "refused":
      return `refused (${result.reason})`;
  }
}

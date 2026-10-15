/**
 * The game is designed for landscape. Three layers try to keep phones and
 * tablets sideways, each harmless where it does not apply:
 *
 * 1. The Android container, when present, is asked to fix its orientation
 *    through `window.Android.setContainerAppOrientation("landscape")`, the
 *    call the earlier Spelling Adventure games use.
 * 2. The web manifest asks for landscape when the app is installed.
 * 3. The Screen Orientation API lock is attempted (browsers only honour it in
 *    fullscreen or installed apps, so failures are expected and ignored).
 *
 * When none of that works and a touch device is still upright, the shell
 * shows a "turn your device" screen instead (see `isPortrait`).
 */
export type ContainerOrientation = "landscape" | "portrait";

interface OrientationWindow {
  Android?: Record<string, unknown>;
  screen?: { orientation?: { lock?: (orientation: string) => Promise<void>; type?: string } };
  matchMedia?: (query: string) => { matches: boolean; addEventListener?: (type: "change", fn: () => void) => void; removeEventListener?: (type: "change", fn: () => void) => void };
  innerWidth?: number;
  innerHeight?: number;
}

const currentWindow = (): OrientationWindow | undefined =>
  typeof window === "undefined" ? undefined : (window as unknown as OrientationWindow);

/** Asks the native container to fix its orientation. Returns true if the container heard. */
export function requestContainerOrientation(
  orientation: ContainerOrientation,
  win: OrientationWindow | undefined = currentWindow(),
): boolean {
  const bridge = win?.Android;
  const method = bridge?.["setContainerAppOrientation"];
  if (typeof method !== "function") return false;
  try {
    (method as (value: string) => void).call(bridge, orientation);
    return true;
  } catch {
    return false;
  }
}

/** Tries the Screen Orientation API lock; resolves true only if the browser accepted. */
export async function lockScreenOrientation(
  orientation: "landscape" | "portrait",
  win: OrientationWindow | undefined = currentWindow(),
): Promise<boolean> {
  const lock = win?.screen?.orientation?.lock;
  if (typeof lock !== "function") return false;
  try {
    await lock.call(win?.screen?.orientation, orientation);
    return true;
  } catch {
    return false;
  }
}

/** Container first, then the browser lock. Safe to call more than once. */
export async function enforceLandscape(win: OrientationWindow | undefined = currentWindow()): Promise<{
  container: boolean;
  locked: boolean;
}> {
  const container = requestContainerOrientation("landscape", win);
  const locked = await lockScreenOrientation("landscape", win);
  return { container, locked };
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

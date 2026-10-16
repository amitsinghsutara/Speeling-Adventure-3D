/**
 * Client side of the offline story (FR-09). Registers the service worker,
 * asks it to precache the assets this session loaded plus every word
 * recording, reports readiness (and tells the Android container), and keeps
 * the app up to date with periodic checks. Pure helpers are exported for
 * unit tests; the controller is a small external store for React.
 */
import { notifyContainerCached } from "@/platform/containerBridge";
import { checkRegistration, scheduleUpdateChecks, type UpdateCheckResult } from "./updates";

export type OfflinePhase = "unsupported" | "disabled" | "registering" | "caching" | "ready" | "failed";

export interface OfflineStatus {
  readonly phase: OfflinePhase;
  readonly online: boolean;
  readonly version: string | null;
  readonly cached: number;
  readonly failed: readonly string[];
  readonly error: string | null;
  /** A newer build has taken over the service worker; reload to use it. */
  readonly updateReady: boolean;
  readonly checking: boolean;
  readonly lastCheck: { readonly at: number; readonly result: UpdateCheckResult } | null;
}

export const INITIAL_OFFLINE_STATUS: OfflineStatus = {
  phase: "disabled",
  online: true,
  version: null,
  cached: 0,
  failed: [],
  error: null,
  updateReady: false,
  checking: false,
  lastCheck: null,
};

export interface RegistrationDecisionInput {
  readonly hasServiceWorker: boolean;
  readonly isSecureContext: boolean;
  readonly nodeEnv: string | undefined;
  readonly search: string;
}

/**
 * Register in production builds (or with `?sw=1` in development) on secure
 * origins only. `?sw=0` disables it for debugging.
 */
export function shouldRegisterServiceWorker(input: RegistrationDecisionInput): boolean {
  if (!input.hasServiceWorker || !input.isSecureContext) return false;
  const flag = new URLSearchParams(input.search).get("sw");
  if (flag === "0") return false;
  if (flag === "1") return true;
  return input.nodeEnv === "production";
}

/** Required app shell entries that must be cached for an offline launch. */
export const SHELL_URLS: readonly string[] = ["/", "/manifest.webmanifest"];

/**
 * Picks the same-origin build assets that this page loaded, plus any extra
 * URLs the game needs offline (every word recording), so the precache list
 * reflects what the game really needs instead of a guessed manifest.
 */
export function selectPrecacheUrls(
  resources: ReadonlyArray<{ readonly name: string }>,
  origin: string,
  extraUrls: readonly string[] = [],
): string[] {
  const urls = new Set<string>(SHELL_URLS);
  for (const entry of resources) {
    let url: URL;
    try {
      url = new URL(entry.name);
    } catch {
      continue;
    }
    if (url.origin !== origin) continue;
    if (url.pathname === "/sw.js") continue;
    if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
      urls.add(url.pathname + url.search);
    }
  }
  for (const extra of extraUrls) urls.add(extra);
  return Array.from(urls);
}

export function offlineLabel(status: OfflineStatus): string | null {
  if (!status.online) return "Offline — playing from saved copy";
  switch (status.phase) {
    case "caching":
      return "Getting ready to play offline…";
    case "ready":
      return "Ready to play offline ✓";
    case "failed":
      return "Couldn't finish saving for offline play";
    default:
      return null;
  }
}

interface PrecacheResult {
  readonly type: "precache-result";
  readonly version: string;
  readonly ok: boolean;
  readonly cached: number;
  readonly failed: readonly string[];
  readonly error?: string;
}

function postWithReply<T>(worker: ServiceWorker, message: unknown, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => reject(new Error("service worker did not reply")), timeoutMs);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      resolve(event.data as T);
    };
    worker.postMessage(message, [channel.port2]);
  });
}

/**
 * Resolves with the worker from THIS build. If a newer script is installing
 * (returning player after a deploy), wait for it rather than talking to the
 * old worker, which would precache into the old cache.
 */
function waitForActiveWorker(registration: ServiceWorkerRegistration): Promise<ServiceWorker> {
  const pending = registration.installing ?? registration.waiting;
  if (!pending) {
    if (registration.active) return Promise.resolve(registration.active);
    return Promise.reject(new Error("service worker failed to install"));
  }
  return new Promise((resolve, reject) => {
    const check = () => {
      if (pending.state === "activated") {
        pending.removeEventListener("statechange", check);
        resolve(pending);
      } else if (pending.state === "redundant") {
        pending.removeEventListener("statechange", check);
        if (registration.active) resolve(registration.active);
        else reject(new Error("service worker failed to activate"));
      }
    };
    pending.addEventListener("statechange", check);
    check();
  });
}

export interface OfflineController {
  getSnapshot(): OfflineStatus;
  subscribe(listener: () => void): () => void;
  /** Registers, precaches and starts update checks. Safe to call once. */
  start(): Promise<OfflineStatus>;
  /** Asks the server for a new version now. */
  checkForUpdates(): Promise<UpdateCheckResult>;
  /** Loads the new version (reloads the page). Only call when it cannot interrupt play. */
  applyUpdate(): void;
  stop(): void;
}

export interface OfflineControllerOptions {
  readonly buildId: string;
  /** Extra URLs to precache, e.g. every word recording. */
  readonly extraUrls?: readonly string[];
  readonly timeoutMs?: number;
  readonly now?: () => number;
}

export function createOfflineController(win: Window, options: OfflineControllerOptions): OfflineController {
  const now = options.now ?? Date.now;
  let status: OfflineStatus = { ...INITIAL_OFFLINE_STATUS, online: win.navigator.onLine };
  const listeners = new Set<() => void>();
  const update = (patch: Partial<OfflineStatus>) => {
    status = { ...status, ...patch };
    listeners.forEach((l) => l());
    return status;
  };
  let registration: ServiceWorkerRegistration | null = null;
  let stopChecks: (() => void) | null = null;
  let running: Promise<UpdateCheckResult> | null = null;
  let reloading = false;

  const onOnline = () => update({ online: true });
  const onOffline = () => update({ online: false });
  win.addEventListener("online", onOnline);
  win.addEventListener("offline", onOffline);

  const checkForUpdates = async (): Promise<UpdateCheckResult> => {
    if (!registration) {
      update({ lastCheck: { at: now(), result: "unsupported" } });
      return "unsupported";
    }
    if (running) return running;
    update({ checking: true });
    running = checkRegistration(registration, () => win.navigator.onLine !== false)
      .catch((): UpdateCheckResult => "error")
      .then((result) => {
        update({
          checking: false,
          lastCheck: { at: now(), result },
          ...(result === "update-ready" ? { updateReady: true } : {}),
        });
        running = null;
        return result;
      });
    return running;
  };

  return {
    getSnapshot: () => status,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async start() {
      const decision = shouldRegisterServiceWorker({
        hasServiceWorker: "serviceWorker" in win.navigator,
        isSecureContext: win.isSecureContext,
        nodeEnv: process.env.NODE_ENV,
        search: win.location.search,
      });
      if (!("serviceWorker" in win.navigator)) return update({ phase: "unsupported" });
      if (!decision) return update({ phase: "disabled" });

      update({ phase: "registering" });
      try {
        const container = win.navigator.serviceWorker;
        const hadController = !!container.controller;
        // A newer worker taking over while this page runs old code means an
        // update is ready. Ask the new worker which build it is first: a worker
        // of this page's own build (e.g. after a registration URL change)
        // is not an update.
        container.addEventListener("controllerchange", () => {
          if (reloading) {
            win.location.reload();
            return;
          }
          if (!hadController) return;
          const controller = container.controller;
          if (!controller) return;
          postWithReply<{ version?: string }>(controller, { type: "get-version" }, 3000)
            .then((reply) => {
              if (reply.version !== options.buildId) update({ updateReady: true });
            })
            .catch(() => update({ updateReady: true }));
        });
        // The script itself carries the build id (see src/app/sw.js/route.ts),
        // so one URL serves every build and update checks see each deploy.
        registration = await container.register("/sw.js", { scope: "/", updateViaCache: "none" });
        const worker = await waitForActiveWorker(registration);
        // A newer worker may have taken over before this listener existed
        // (browsers check for updates on navigation, and offline preparation
        // only starts once the scene is ready). Compare builds directly.
        const active = await postWithReply<{ version?: string }>(worker, { type: "get-version" }, 3000).catch(() => null);
        if (hadController && active?.version && active.version !== options.buildId) update({ updateReady: true });
        update({ phase: "caching" });
        const resources = win.performance.getEntriesByType("resource");
        const urls = selectPrecacheUrls(resources, win.location.origin, options.extraUrls ?? []);
        const result = await postWithReply<PrecacheResult>(
          worker,
          { type: "precache", urls },
          options.timeoutMs ?? 120_000,
        );
        const next = update({
          phase: result.ok ? "ready" : "failed",
          version: result.version,
          cached: result.cached,
          failed: result.failed,
          error: result.error ?? (result.ok ? null : `${result.failed.length} asset(s) not cached`),
        });
        if (result.ok) notifyContainerCached(win);
        stopChecks = scheduleUpdateChecks({ check: checkForUpdates, now, doc: win.document, win });
        // A stale shell may have been served from cache: look for a newer build now.
        void checkForUpdates();
        return next;
      } catch (error) {
        return update({ phase: "failed", error: error instanceof Error ? error.message : String(error) });
      }
    },

    checkForUpdates,

    applyUpdate() {
      if (reloading) return;
      reloading = true;
      win.location.reload();
    },

    stop() {
      stopChecks?.();
      win.removeEventListener("online", onOnline);
      win.removeEventListener("offline", onOffline);
    },
  };
}

/**
 * Compatibility entry point used by tests and simple callers: runs the
 * controller once and reports the final status through `onChange`.
 */
export async function prepareOffline(
  win: Window,
  options: { readonly buildId: string; readonly onChange: (status: OfflineStatus) => void; readonly extraUrls?: readonly string[] },
): Promise<OfflineStatus> {
  const controller = createOfflineController(win, { buildId: options.buildId, extraUrls: options.extraUrls });
  controller.subscribe(() => options.onChange(controller.getSnapshot()));
  return controller.start();
}

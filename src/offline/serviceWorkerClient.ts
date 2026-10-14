/**
 * Client side of the offline story (FR-09). Registers the service worker,
 * asks it to precache the assets this session actually loaded, and reports a
 * small readiness status. Pure helpers are exported for unit tests.
 */
export type OfflinePhase =
  | "unsupported"
  | "disabled"
  | "registering"
  | "caching"
  | "ready"
  | "failed";

export interface OfflineStatus {
  readonly phase: OfflinePhase;
  readonly online: boolean;
  readonly version: string | null;
  readonly cached: number;
  readonly failed: readonly string[];
  readonly error: string | null;
}

export const INITIAL_OFFLINE_STATUS: OfflineStatus = {
  phase: "disabled",
  online: true,
  version: null,
  cached: 0,
  failed: [],
  error: null,
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
 * Picks the same-origin build assets that this page loaded, so the precache
 * list reflects what the game really needs instead of a guessed manifest.
 */
export function selectPrecacheUrls(
  resources: ReadonlyArray<{ readonly name: string }>,
  origin: string,
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

function postWithReply<T>(
  worker: ServiceWorker,
  message: unknown,
  timeoutMs: number,
): Promise<T> {
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

async function waitForActiveWorker(
  registration: ServiceWorkerRegistration,
  container: ServiceWorkerContainer,
): Promise<ServiceWorker> {
  if (registration.active) return registration.active;
  await container.ready;
  if (registration.active) return registration.active;
  throw new Error("service worker failed to activate");
}

export interface PrepareOfflineOptions {
  readonly buildId: string;
  readonly onChange: (status: OfflineStatus) => void;
  readonly timeoutMs?: number;
}

/**
 * Full flow: register → wait for activation → precache this session's assets
 * → report. Never throws; failures end in the `failed` phase.
 */
export async function prepareOffline(
  win: Window,
  options: PrepareOfflineOptions,
): Promise<OfflineStatus> {
  let status: OfflineStatus = { ...INITIAL_OFFLINE_STATUS, online: win.navigator.onLine };
  const update = (patch: Partial<OfflineStatus>) => {
    status = { ...status, ...patch };
    options.onChange(status);
    return status;
  };

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
    const registration = await container.register(`/sw.js?v=${encodeURIComponent(options.buildId)}`, {
      scope: "/",
      updateViaCache: "none",
    });
    const worker = await waitForActiveWorker(registration, container);
    update({ phase: "caching" });
    const resources = win.performance.getEntriesByType("resource");
    const urls = selectPrecacheUrls(resources, win.location.origin);
    const result = await postWithReply<PrecacheResult>(
      worker,
      { type: "precache", urls },
      options.timeoutMs ?? 60_000,
    );
    return update({
      phase: result.ok ? "ready" : "failed",
      version: result.version,
      cached: result.cached,
      failed: result.failed,
      error: result.error ?? (result.ok ? null : `${result.failed.length} asset(s) not cached`),
    });
  } catch (error) {
    return update({
      phase: "failed",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

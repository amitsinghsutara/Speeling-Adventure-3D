import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import {
  INITIAL_OFFLINE_STATUS,
  offlineLabel,
  selectPrecacheUrls,
  shouldRegisterServiceWorker,
} from "@/offline/serviceWorkerClient";

describe("shouldRegisterServiceWorker", () => {
  const base = { hasServiceWorker: true, isSecureContext: true, nodeEnv: "production", search: "" };

  it("registers in production on secure origins", () => {
    expect(shouldRegisterServiceWorker(base)).toBe(true);
  });

  it("stays off in development unless ?sw=1", () => {
    expect(shouldRegisterServiceWorker({ ...base, nodeEnv: "development" })).toBe(false);
    expect(shouldRegisterServiceWorker({ ...base, nodeEnv: "development", search: "?sw=1" })).toBe(true);
  });

  it("respects ?sw=0 and missing support", () => {
    expect(shouldRegisterServiceWorker({ ...base, search: "?sw=0" })).toBe(false);
    expect(shouldRegisterServiceWorker({ ...base, hasServiceWorker: false })).toBe(false);
    expect(shouldRegisterServiceWorker({ ...base, isSecureContext: false })).toBe(false);
  });
});

describe("selectPrecacheUrls", () => {
  it("keeps the shell plus same-origin build assets and icons, once each", () => {
    const urls = selectPrecacheUrls(
      [
        { name: "https://app.test/_next/static/chunks/a.js" },
        { name: "https://app.test/_next/static/chunks/a.js" },
        { name: "https://app.test/_next/static/css/b.css?x=1" },
        { name: "https://app.test/icons/icon-192.png" },
        { name: "https://app.test/sw.js?v=1" },
        { name: "https://cdn.other/font.woff2" },
        { name: "https://app.test/_next/image?url=x" },
        { name: "not a url" },
      ],
      "https://app.test",
    );
    expect(urls).toEqual([
      "/",
      "/manifest.webmanifest",
      "/_next/static/chunks/a.js",
      "/_next/static/css/b.css?x=1",
      "/icons/icon-192.png",
    ]);
  });
});

describe("offlineLabel", () => {
  it("describes each visible phase and prefers the offline notice", () => {
    expect(offlineLabel(INITIAL_OFFLINE_STATUS)).toBeNull();
    expect(offlineLabel({ ...INITIAL_OFFLINE_STATUS, phase: "caching" })).toMatch(/getting ready/i);
    expect(offlineLabel({ ...INITIAL_OFFLINE_STATUS, phase: "ready" })).toMatch(/ready to play offline/i);
    expect(offlineLabel({ ...INITIAL_OFFLINE_STATUS, phase: "failed" })).toMatch(/couldn't/i);
    expect(offlineLabel({ ...INITIAL_OFFLINE_STATUS, phase: "ready", online: false })).toMatch(/offline/i);
  });
});

describe("public/sw.js", () => {
  function loadWorker(version: string | null) {
    const source = fs.readFileSync(path.resolve(process.cwd(), "public/sw.js"), "utf8");
    const listeners = new Map<string, (event: unknown) => void>();
    const self = {
      location: { href: `https://app.test/sw.js${version ? `?v=${version}` : ""}`, origin: "https://app.test" },
      addEventListener: (type: string, fn: (event: unknown) => void) => listeners.set(type, fn),
      skipWaiting: async () => undefined,
      clients: { matchAll: async () => [], claim: async () => undefined },
      __sa3dServiceWorker: undefined as unknown,
    };
    const context = vm.createContext({ self, URL, Response, console });
    vm.runInContext(source, context);
    const api = self.__sa3dServiceWorker as {
      classifyRequest: (request: unknown, origin: string) => string;
      cacheNameFor: (v: string) => string;
      VERSION: string;
      CACHE_NAME: string;
    };
    return { api, listeners };
  }

  it("derives the cache name from the registration version", () => {
    expect(loadWorker("abc").api.CACHE_NAME).toBe("sa3d-abc");
    expect(loadWorker(null).api.VERSION).toBe("dev");
    expect(loadWorker("x").api.cacheNameFor("y")).toBe("sa3d-y");
  });

  it("installs install, activate, fetch and message handlers", () => {
    const { listeners } = loadWorker("1");
    expect([...listeners.keys()].sort()).toEqual(["activate", "fetch", "install", "message"]);
  });

  it("classifies requests by caching strategy", () => {
    const { api } = loadWorker("1");
    const origin = "https://app.test";
    const req = (url: string, mode = "cors", method = "GET") => ({ url, mode, method });
    expect(api.classifyRequest(req("https://app.test/", "navigate"), origin)).toBe("shell");
    expect(api.classifyRequest(req("https://app.test/?controls=touch", "navigate"), origin)).toBe("shell");
    expect(api.classifyRequest(req("https://app.test/other", "navigate"), origin)).toBe("ignore");
    expect(api.classifyRequest(req("https://app.test/_next/static/chunks/a.js"), origin)).toBe("static");
    expect(api.classifyRequest(req("https://app.test/_next/webpack-hmr"), origin)).toBe("ignore");
    expect(api.classifyRequest(req("https://app.test/icons/icon-192.png"), origin)).toBe("asset");
    expect(api.classifyRequest(req("https://app.test/sw.js"), origin)).toBe("ignore");
    expect(api.classifyRequest(req("https://cdn.other/x.js"), origin)).toBe("ignore");
    expect(api.classifyRequest(req("https://app.test/api", "cors", "POST"), origin)).toBe("ignore");
  });
});

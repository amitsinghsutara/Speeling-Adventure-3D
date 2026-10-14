import type { NextConfig } from "next";

/**
 * A build id shared by the server, the client bundle and the service worker
 * registration URL (`/sw.js?v=<id>`), so every build gets its own cache.
 */
const buildId = process.env.NEXT_PUBLIC_BUILD_ID ?? Date.now().toString(36);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  generateBuildId: () => buildId,
  env: { NEXT_PUBLIC_BUILD_ID: buildId },
  // The game has no server-only features, so it can also be exported as a
  // static site (set NEXT_OUTPUT_EXPORT=1). The hosting target is still an
  // open decision (spec §10); both modes are kept working.
  ...(process.env.NEXT_OUTPUT_EXPORT === "1" ? { output: "export" as const } : {}),
};

export default nextConfig;

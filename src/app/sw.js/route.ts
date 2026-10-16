import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Serves the service worker with the build id stamped into its source, so a
 * new deploy is a byte-different script and browsers install it on their
 * next update check. Pre-rendered to a static file in export builds.
 */
export const dynamic = "force-static";

export async function GET(): Promise<Response> {
  const source = await readFile(path.join(process.cwd(), "src/sw/worker.js"), "utf8");
  const buildId = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
  return new Response(`self.__SA3D_BUILD__ = ${JSON.stringify(buildId)};
${source}`, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache",
      "Service-Worker-Allowed": "/",
    },
  });
}

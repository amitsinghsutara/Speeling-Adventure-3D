// Builds the static export with a dated build id and uploads it to the
// Cloudflare Pages project. Run `npx wrangler login` once beforehand.
// Usage: npm run deploy:cloudflare [-- --branch preview]
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

const PROJECT = "spelling-adventure-3d";
const branchIndex = process.argv.indexOf("--branch");
const branch = branchIndex > -1 ? process.argv[branchIndex + 1] : "main";
const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 13).replace("T", "-");
const buildId = `cf-${stamp}`;

const run = (cmd, args, env = {}) => {
  const result = spawnSync(cmd, args, { stdio: "inherit", shell: true, env: { ...process.env, ...env } });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

rmSync("out", { recursive: true, force: true });
run("npx", ["next", "build"], { NEXT_OUTPUT_EXPORT: "1", NEXT_PUBLIC_BUILD_ID: buildId });
run("npx", ["--yes", "wrangler", "pages", "deploy", "out", "--project-name", PROJECT, "--branch", branch, "--commit-dirty=true"]);
console.log(`\nDeployed build ${buildId} to ${PROJECT} (${branch}).`);

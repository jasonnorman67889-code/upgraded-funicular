import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function run(command, args) {
  return spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}

const probe = run("git", ["rev-parse", "--is-inside-work-tree"]);
if (probe.status !== 0) {
  console.log("Git repository not detected. Skipping hook installation.");
  process.exit(0);
}

const result = run("git", ["config", "core.hooksPath", ".githooks"]);
if (result.status !== 0) {
  console.error("Failed to configure git hooks path.");
  process.exit(result.status ?? 1);
}

console.log("Git hooks installed. Pre-commit now runs scripts/quality-gate.mjs.");

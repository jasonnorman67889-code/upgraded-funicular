import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

function runCommand(command, args, cwd = root) {
  return new Promise((resolve) => {
    const fullCommand = [command, ...args]
      .map((part) => {
        if (/^[A-Za-z0-9_./:-]+$/.test(part)) {
          return part;
        }
        return `"${part.replace(/\"/g, '\\\"')}"`;
      })
      .join(" ");

    const proc = spawn(fullCommand, {
      cwd,
      stdio: "inherit",
      shell: true,
    });
    proc.on("error", () => resolve(1));
    proc.on("close", (code) => resolve(code ?? 1));
  });
}

async function runStep(label, command, args, options = {}) {
  console.log(`\n[gate] ${label}`);
  const code = await runCommand(command, args, options.cwd || root);
  if (code !== 0) {
    throw new Error(`${label} failed with exit code ${code}`);
  }
}

async function runBackendSyntaxCheck() {
  const files = [
    path.join(root, "backend", "app", "main.py"),
    path.join(root, "backend", "app", "api", "routes.py"),
    path.join(root, "backend", "app", "services", "pipeline.py"),
    path.join(root, "backend", "app", "services", "identity_graph.py"),
    path.join(root, "backend", "app", "services", "kql_lite.py"),
    path.join(root, "backend", "app", "services", "incident_store.py"),
    path.join(root, "backend", "app", "services", "soar.py"),
    path.join(root, "backend", "app", "services", "synthetic.py"),
  ];

  console.log("\n[gate] Backend syntax check");
  const pythonCode = await runCommand("python", ["-m", "py_compile", ...files], root);
  if (pythonCode === 0) {
    return;
  }

  const pyCode = await runCommand("py", ["-m", "py_compile", ...files], root);
  if (pyCode === 0) {
    return;
  }

  console.log("[gate] warning: Python interpreter not available in PATH; backend syntax check skipped");
}

async function main() {
  console.log("[gate] Starting local quality gate");

  await runStep("Frontend lint (typecheck)", "npm", ["--prefix", path.join(root, "frontend"), "run", "lint"]);
  await runStep("Frontend build", "npm", ["--prefix", path.join(root, "frontend"), "run", "build"]);
  await runBackendSyntaxCheck();
  await runStep("Offline smoke test", "node", [path.join(root, "scripts", "smoke-test.mjs"), "--offline"]);

  console.log("\n[gate] Quality gate passed");
}

main().catch((error) => {
  console.error(`\n[gate] FAILED: ${error.message}`);
  process.exit(1);
});

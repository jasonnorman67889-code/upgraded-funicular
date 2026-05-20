# Local Quality Gate

Run one command to validate local code quality and core workflow correctness.

## Command
- `node scripts/quality-gate.mjs`

PowerShell helper:
- `./scripts/run-quality-gate.ps1`

## Pre-commit Hook
Install tracked git hooks so every commit runs the same quality gate:
- `node scripts/install-git-hooks.mjs`

PowerShell helper:
- `./scripts/install-git-hooks.ps1`

## Included Checks
1. Frontend lint/type check (`tsc --noEmit`)
2. Frontend production build
3. Backend Python syntax compile (`py_compile`) when Python is available
4. Offline smoke test (`node scripts/smoke-test.mjs --offline`)

The backend syntax step is skipped with a warning when no Python interpreter is available in PATH.

## CI Enforcement
GitHub Actions runs the same command on every push and pull request:
- `node scripts/quality-gate.mjs`

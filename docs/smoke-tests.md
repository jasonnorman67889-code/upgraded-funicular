# Local Smoke Tests

## Purpose
Validate end-to-end local SOC flow:
- Attack chain simulation
- Incident creation
- SOAR task creation
- Assignment, approval, and execution
- Audit trail verification

## Run
1. Start local stack:
   - `docker compose up -d --build`
2. Execute smoke test:
   - `node scripts/smoke-test.mjs`
   - or `python scripts/smoke_test.py` if Python is available in PATH

## Offline Mode (No Docker Required)
Run with an in-process mock backend when container pulls or local services are unavailable:
- `node scripts/smoke-test.mjs --offline`

This mode validates the exact smoke flow contract without external services.

Optional environment overrides:
- `SMOKE_BASE_URL` (default: `http://localhost:8000`)
- `SMOKE_TENANT_ID` (default: `tenant-a`)
- `SMOKE_ENTITY_ID` (default: `smoke-user`)

PowerShell helper:
- `./scripts/run-smoke.ps1`

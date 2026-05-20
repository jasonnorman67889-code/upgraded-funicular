# Sovereign Identity Fusion (Local-First)

Local SOC/Identity Threat platform designed to run fully offline with mock telemetry and cloud adapter abstractions.

## Stack
- Frontend: React + TypeScript + Tailwind
- Backend: FastAPI + SQLModel
- ML Engine: FastAPI + scikit-learn style baseline scoring
- Streaming: WebSocket gateway
- Data: PostgreSQL + Redis
- Orchestration: Docker Compose

## Quick Start
1. Copy environment file:
   - `cp .env.example .env` (PowerShell: `Copy-Item .env.example .env`)
2. Start services:
   - `docker compose up --build`
3. Open:
   - Frontend: http://localhost:5173
   - Backend API docs: http://localhost:8000/docs
   - ML engine docs: http://localhost:8010/docs

## Smoke Test
Run the automated local flow validation after services are up:
- `python scripts/smoke_test.py`

If Docker or backend services are unavailable, run offline mode (in-process mock backend):
- `node scripts/smoke-test.mjs --offline`

This validates:
- Attack chain simulation
- Incident creation
- SOAR task assignment, approval, and execution
- Audit trail integrity

## Quality Gate
Run one command for local validation (lint + build + offline smoke):
- `node scripts/quality-gate.mjs`

PowerShell helper:
- `./scripts/run-quality-gate.ps1`

Install pre-commit hook enforcement:
- `node scripts/install-git-hooks.mjs`

## Top-Level Structure
- frontend/
- backend/
- detections/
- ml-engine/
- mock-data/
- websocket-gateway/
- analytics/
- infrastructure/
- workbooks/
- docs/

## Current Status
Phase 1 setup scaffolded for local-first development; adapters and engines are stubbed with realistic interfaces for future Azure integration.
# upgraded-funicular

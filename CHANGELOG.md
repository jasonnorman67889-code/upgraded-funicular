# Changelog

All notable changes to this project are documented in this file.

## [1.0.1] - 2026-05-20

### Changed
- Replaced `recharts` in the live risk dashboard with a lightweight native SVG chart component to reduce frontend bundle size.
- Updated Vite chunk settings to remove charting vendor split that is no longer needed.
- Kept UX parity for risk trend visualization while improving first-load performance.

## [1.0.0] - 2026-05-20

### Added
- Local-first SOC/Identity Fusion monorepo with frontend, backend, ML engine, websocket gateway, detections, workbooks, docs, and infrastructure placeholders.
- Provider adapter contract with mocked integrations for Sentinel, Azure Monitor, Microsoft Graph, Entra ID, Okta, CrowdStrike, Defender XDR, Splunk, Elastic, Google Workspace, and AWS CloudTrail.
- End-to-end identity pipeline: ingest, normalize, correlate, score, respond.
- Identity graph enrichment and tenant isolation in pipeline execution.
- SOAR workflow engine with queue ownership, assignment, approval/reject/execute actions, SLA escalation, and audit trail.
- React command-center UX with dashboard views, incident command controls, entity investigation workspace, workbook renderer, and live websocket timeline.
- Detection packs with MITRE ATT&CK mappings and playbooks for core identity attack patterns.
- Offline smoke testing with in-process mock backend plus one-command local quality gate.
- CI workflow aligned to run the same quality gate command as local development.

### Changed
- CI simplified and standardized around `node scripts/quality-gate.mjs` for push and pull_request validation.
- Documentation updated with quick start, smoke test modes, quality gate, and hook setup guidance.

# SOC Workflow (Local Simulation)

1. Ingest events via /pipeline/ingest or /pipeline/mock-run.
2. Review graphEdges for multi-step behavior chains.
3. Open incident queue via /incidents?tenantId=tenant-a.
4. SOAR queue and approval workflow:
- List queues: /soar/queues?tenantId=tenant-a
- List tasks: /soar/tasks?tenantId=tenant-a
- Assign: POST /soar/tasks/{task_id}/assign
- Approve or reject: POST /soar/tasks/{task_id}/approve or /reject
- Execute: POST /soar/tasks/{task_id}/execute
5. Run escalation checks for SLA breaches:
- POST /soar/escalations/run?tenantId=tenant-a
6. Review immutable action trail:
- GET /soar/audit?tenantId=tenant-a
7. Transition incident status:
- new -> triage
- triage -> in_progress
- in_progress -> contained
- contained -> closed
8. Run local analytics via /analytics/query with KQL-lite query and tenant-scoped rows.

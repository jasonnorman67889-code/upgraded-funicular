# KQL-Lite Local Spec

Supported locally in MVP:
- `where EventType == 'X'`
- `where Field == 'X'` (generic single-equality filter)
- `summarize count()`
- `project field1, field2`

Example:

```
IdentityEvents
| where tenantId == 'tenant-a'
| where eventType == 'ImpossibleTravel'
| project eventId, entityId, eventType
```

Behavior notes:
- Query execution is deterministic and in-memory.
- Tenant isolation should be applied before query evaluation.
- Designed for workbook previews and local SOC workflows, not full Kusto parity.

This parser is intentionally lightweight and deterministic for offline workbook rendering.

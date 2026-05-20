# Provider Adapter Contracts

All providers implement:
- ingest(payload)
- normalize(events)
- correlate(events)
- score(correlated)
- respond(scores)

Mock adapters currently included for:
Microsoft Sentinel, Azure Monitor, Microsoft Graph, Entra ID, Okta, CrowdStrike, Defender XDR, Splunk, Elastic, Google Workspace, AWS CloudTrail.

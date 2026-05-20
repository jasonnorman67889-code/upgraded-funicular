import type { WorkbookConfig } from "../lib/workbook";

export const workbookConfig: WorkbookConfig = {
  name: "Sovereign-Identity-Fusion-Workbook",
  version: "1.0.0",
  description: "Local workbook simulation",
  sections: [
    {
      id: "overview",
      title: "Executive Overview",
      widgets: [
        {
          id: "kpi-impossible-travel",
          type: "kpi",
          title: "Impossible Travel Events",
          query: "IdentityEvents | where eventType == 'ImpossibleTravel' | summarize count()",
        },
        {
          id: "kpi-mfa-fatigue",
          type: "kpi",
          title: "MFA Fatigue Events",
          query: "IdentityEvents | where eventType == 'MfaFatigue' | summarize count()",
        },
      ],
    },
    {
      id: "incidents",
      title: "Incident Command",
      widgets: [
        {
          id: "table-recent-incidents",
          type: "table",
          title: "Recent Incidents",
          query: "MlIncidents | project incidentId, entityId, riskLabel, action",
        },
      ],
    },
  ],
};

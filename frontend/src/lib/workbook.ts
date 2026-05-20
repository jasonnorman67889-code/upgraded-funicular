export type WorkbookWidget = {
  id: string;
  type: "kpi" | "table" | "timechart" | "heatmap" | "timeline";
  title: string;
  query: string;
};

export type WorkbookSection = {
  id: string;
  title: string;
  widgets: WorkbookWidget[];
};

export type WorkbookConfig = {
  name: string;
  version: string;
  description: string;
  sections: WorkbookSection[];
};

export function runKqlLikeQuery(query: string, rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const lower = query.toLowerCase();
  if (lower.includes("eventtype == 'impossibletravel'")) {
    return rows.filter((r) => r.eventType === "ImpossibleTravel");
  }
  if (lower.includes("eventtype == 'mfafatigue'")) {
    return rows.filter((r) => r.eventType === "MfaFatigue");
  }
  if (lower.includes("eventtype == 'newdevicelogon'")) {
    return rows.filter((r) => r.eventType === "NewDeviceLogon");
  }
  return rows;
}

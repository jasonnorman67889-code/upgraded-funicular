import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type StreamEvent = {
  eventId: string;
  riskScore: number;
  timeGenerated: string;
};

export function LiveRiskChart({ events }: { events: StreamEvent[] }) {
  const data = events
    .slice(0, 20)
    .reverse()
    .map((event) => ({
      t: new Date(event.timeGenerated).toLocaleTimeString(),
      risk: event.riskScore,
    }));

  return (
    <div className="h-56 rounded-xl border border-white/10 bg-slate-950/40 p-3">
      <div className="mb-2 text-sm font-medium">Live Risk Stream</div>
      <ResponsiveContainer width="100%" height="85%">
        <AreaChart data={data}>
          <XAxis dataKey="t" tick={{ fill: "#a3b2cc", fontSize: 11 }} />
          <YAxis domain={[0, 1]} tick={{ fill: "#a3b2cc", fontSize: 11 }} />
          <Tooltip />
          <Area type="monotone" dataKey="risk" stroke="#28c7c1" fill="#28c7c166" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

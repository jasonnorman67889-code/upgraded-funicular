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

  const width = 640;
  const height = 220;
  const paddingX = 28;
  const paddingY = 18;
  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingY * 2;

  const points = data.map((item, idx) => {
    const x = data.length <= 1 ? paddingX : paddingX + (idx / (data.length - 1)) * innerWidth;
    const y = paddingY + (1 - Math.max(0, Math.min(1, item.risk))) * innerHeight;
    return { x, y, label: item.t, risk: item.risk };
  });

  const linePath = points
    .map((point, idx) => `${idx === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");

  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${(height - paddingY).toFixed(2)} L ${
        points[0].x.toFixed(2)
      } ${(height - paddingY).toFixed(2)} Z`
    : "";

  return (
    <div className="h-56 rounded-xl border border-white/10 bg-slate-950/40 p-3">
      <div className="mb-2 flex items-center justify-between text-sm font-medium">
        <span>Live Risk Stream</span>
        <span className="text-xs text-slate-400">Range 0.00 - 1.00</span>
      </div>

      {points.length < 2 ? (
        <div className="flex h-[85%] items-center justify-center text-xs text-slate-400">Waiting for stream data...</div>
      ) : (
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[85%] w-full" role="img" aria-label="Live risk chart">
          <defs>
            <linearGradient id="riskFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#28c7c1" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#28c7c1" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {[0, 0.25, 0.5, 0.75, 1].map((mark) => {
            const y = paddingY + (1 - mark) * innerHeight;
            return (
              <g key={mark}>
                <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="#1d2a44" strokeWidth="1" />
                <text x={4} y={y + 4} fontSize="10" fill="#8ea0bf">
                  {mark.toFixed(2)}
                </text>
              </g>
            );
          })}

          <path d={areaPath} fill="url(#riskFill)" />
          <path d={linePath} fill="none" stroke="#28c7c1" strokeWidth="2" />

          {points.map((point) => (
            <circle key={`${point.x}-${point.y}`} cx={point.x} cy={point.y} r="2.4" fill="#28c7c1" />
          ))}

          <text x={paddingX} y={height - 2} fontSize="10" fill="#8ea0bf">
            {points[0].label}
          </text>
          <text x={width - paddingX - 52} y={height - 2} fontSize="10" fill="#8ea0bf">
            {points[points.length - 1].label}
          </text>
        </svg>
      )}
    </div>
  );
}

import { MUTED } from "../../theme/tokens";

type CashFlowPoint = { date: string; label?: string; amount?: number; value?: number };
type CashFlowSeries = { key: string; label: string; color: string; points: CashFlowPoint[] };

function compactAmount(amount: number) {
  const sign = amount >= 0 ? "+" : "-";
  const absolute = Math.abs(amount);
  const value = absolute >= 1000 ? `${Math.round(absolute / 1000)}k` : absolute.toFixed(0);
  return `${sign}GHS ${value}`;
}

export default function LineChart({ data }: { data: CashFlowSeries[] }) {
  if (!data || data.length === 0) {
    return <p style={{ color: MUTED, fontSize: 13 }}>No cash flow data yet.</p>;
  }

  const width = 600;
  const height = 200;
  const pointsBySeries = data.map((series) => series.points.map((point) => Number(point.amount ?? point.value) || 0));
  const values = pointsBySeries.flat();
  const maxAmount = Math.max(...values, 0);
  const yMax = Math.max(Math.ceil(maxAmount / 10000) * 10000, 10000);
  const pointCount = Math.max(...data.map((series) => series.points.length), 1);
  const xForIndex = (index: number) => 70 + index * ((560 - 70) / Math.max(pointCount - 1, 1));
  const yForValue = (value: number) => 160 - (value / yMax) * 120;
  const formatAmount = (amount: number) => `GHS ${Math.abs(amount).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <svg
      viewBox="0 0 600 200"
      role="img"
      aria-label="Cash flow for the last six movements"
      style={{ width: "100%", height: "auto", minHeight: 150 }}
    >
      {[40, 80, 120, 160].map((y) => <line key={y} x1="40" x2="590" y1={y} y2={y} stroke="var(--rule)" strokeWidth="1" />)}
      {[yMax, yMax * 2 / 3, yMax / 3, 0].map((value, index) => (
        <text key={index} x="34" y={44 + index * 40} textAnchor="end" fill="var(--ink)" fontSize="11">{Math.round(value / 1000)}k</text>
      ))}
      <line x1="40" x2="590" y1="160" y2="160" stroke="var(--rule)" strokeWidth="1.5" strokeDasharray="4 4" />
      {data.map((series) => {
        const points = series.points.map((point, index) => ({ x: xForIndex(index), y: yForValue(Number(point.amount ?? point.value) || 0), point, value: Number(point.amount ?? point.value) || 0 }));
        const linePath = points.map(({ x, y }) => `${x} ${y}`).join(" L ");
        const areaPath = `M ${linePath} L ${points[points.length - 1].x} 160 L ${points[0].x} 160 Z`;
        const latest = points[points.length - 1];
        return (
          <g key={series.key}>
            <defs>
              <linearGradient id={`cashFlowArea-${series.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={series.color} stopOpacity="0.22" />
                <stop offset="100%" stopColor={series.color} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={areaPath} fill={`url(#cashFlowArea-${series.key})`} />
            <path d={`M ${linePath}`} fill="none" stroke={series.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {points.map(({ x, y, point, value }, index) => (
              <g
                key={`${series.key}-${point.date}`}
                tabIndex={0}
                role="img"
                aria-label={`${series.label}, ${point.label || point.date}, ${value < 0 ? "outflow" : "inflow"} ${formatAmount(value)}`}
                style={{ cursor: "pointer", outline: "none" }}
              >
                <title>{`${series.label} · ${point.label || point.date} · ${value < 0 ? "Outflow" : "Inflow"}: ${formatAmount(value)}`}</title>
                <circle cx={x} cy={y} r="10" fill="transparent" pointerEvents="all" />
                {index === points.length - 1 && latest.value !== 0 ? (
                  <>
                    <circle cx={x} cy={y} r="6" fill="var(--paper)" stroke={series.color} strokeWidth="2.5" />
                    <circle cx={x} cy={y} r="2.5" fill={series.color} />
                    <g transform={`translate(${Math.max(42, x - 40)} ${Math.max(10, y - 31)})`}>
                      <rect width="80" height="22" rx="4" fill={series.color} />
                      <text x="40" y="15" textAnchor="middle" fill="var(--paper)" fontSize="11" fontWeight="700">{compactAmount(value)}</text>
                    </g>
                  </>
                ) : <circle cx={x} cy={y} r="3.5" fill={series.color} />}
                {series.key === data[0].key && <text x={x} y="190" textAnchor="middle" fill="var(--ink)" fontSize="11">{point.label || point.date.slice(5)}</text>}
              </g>
            ))}
          </g>
        );
      })}
    </svg>
  );
}


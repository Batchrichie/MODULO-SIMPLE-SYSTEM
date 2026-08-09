import { INK, RULE, MUTED } from "../../theme/tokens";
export default function BarChart({ data }) {
  if (!data || data.length === 0) {
    return <p style={{ color: MUTED, fontSize: 13 }}>No revenue/expense data yet.</p>;
  }

  const width = 500;
  const height = 150;
  const maxVal = Math.max(...data.flatMap((d) => [d.revenue, d.expense]), 1);
  const barWidth = width / data.length / 3;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: "100%", height: "100%", minHeight: 150 }}
    >
      {data.map((d, i) => {
        const groupX = (i / data.length) * width + width / data.length / 4;
        const revHeight = (d.revenue / maxVal) * (height - 20);
        const expHeight = (d.expense / maxVal) * (height - 20);

        return (
          <g key={i}>
            <rect
              x={groupX}
              y={height - revHeight - 10}
              width={barWidth}
              height={revHeight}
              fill="var(--green)"
              opacity="0.8"
              rx="2"
            />
            <rect
              x={groupX + barWidth + 2}
              y={height - expHeight - 10}
              width={barWidth}
              height={expHeight}
              fill="var(--alert)"
              opacity="0.8"
              rx="2"
            />
            <text
              x={groupX + barWidth}
              y={height - 2}
              fill="var(--muted)"
              fontSize="8"
              textAnchor="middle"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}


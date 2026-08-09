import { INK, RULE, MUTED } from "../../theme/tokens";
export default function LineChart({ data }) {
  if (!data || data.length === 0) {
    return <p style={{ color: MUTED, fontSize: 13 }}>No cash flow data yet.</p>;
  }

  const width = 500;
  const height = 150;
  const maxVal = Math.max(...data.map((d) => d.value), 1);

  const points = data
    .map((d, i) => {
      const x = (i / (data.length - 1 || 1)) * width;
      const y = height - (d.value / maxVal) * (height - 20) - 10;
      return `${x},${y}`;
    })
    .join(" ");

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: "100%", height: "100%", minHeight: 150 }}
    >
      <polygon fill="var(--green)" points={areaPoints} opacity="0.1" />
      <polyline
        fill="none"
        stroke="var(--green)"
        strokeWidth="2"
        points={points}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {data.map((d, i) => {
        const x = (i / (data.length - 1 || 1)) * width;
        const y = height - (d.value / maxVal) * (height - 20) - 10;
        return <circle key={i} cx={x} cy={y} r="3" fill="var(--green)" />;
      })}
    </svg>
  );
}


import { INK, MUTED, FONT_BODY } from "../../theme/tokens";
export default function DonutChart({ data }) {
  if (!data || data.length === 0) {
    return <p style={{ color: MUTED, fontSize: 13 }}>No active projects.</p>;
  }

  const total = data.reduce((s, d) => s + d.value, 0);
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const colors = ["var(--green)", "var(--gold)", "var(--alert)", "var(--ink)", "var(--muted)"];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <svg width="120" height="120" viewBox="0 0 150 150">
        <circle
          cx="75"
          cy="75"
          r={radius}
          fill="none"
          stroke="var(--paper)"
          strokeWidth="20"
        />
        {data.map((d, i) => {
          const pct = d.value / total;
          const dash = pct * circumference;
          const stroke = colors[i % colors.length];
          const circle = (
            <circle
              key={i}
              cx="75"
              cy="75"
              r={radius}
              fill="none"
              stroke={stroke}
              strokeWidth="20"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 75 75)"
            />
          );
          offset += dash;
          return circle;
        })}
        <text
          x="75"
          y="80"
          textAnchor="middle"
          fill="var(--ink)"
          fontSize="12"
          fontWeight="700"
        >
          {data.length} Projects
        </text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {data.map((d, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              color: MUTED,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                background: colors[i % colors.length],
                borderRadius: 2,
              }}
            ></span>
            {d.name}{" "}
            <span style={{ color: INK, fontWeight: 600 }}>
              ({((d.value / total) * 100).toFixed(0)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}


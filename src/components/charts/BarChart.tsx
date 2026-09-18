import { MUTED } from "../../theme/tokens";

type RevenueExpenseMonth = { month: string; label?: string; revenue: number; expenses?: number; expense?: number; isCurrent?: boolean };

export default function BarChart({ data }: { data: RevenueExpenseMonth[] }) {
  if (!data || data.length === 0) {
    return <p style={{ color: MUTED, fontSize: 13 }}>No revenue/expense data yet.</p>;
  }

  const maxValue = Math.max(...data.flatMap((point) => [point.revenue, point.expenses ?? point.expense ?? 0]), 0);
  const yMax = Math.max(Math.ceil(maxValue / 5000) * 5000, 5000);
  const yForValue = (value: number) => 180 - (value / yMax) * 140;
  const groupCenters = data.map((_, index) => 91 + index * 120);
  const barWidth = 26;

  return (
    <svg
      viewBox="0 0 600 200"
      role="img"
      aria-label="Revenue versus expenses for five months"
      style={{ width: "100%", height: "auto", minHeight: 150 }}
    >
      {[40, 80, 120, 160].map((y) => <line key={y} x1="40" x2="590" y1={y} y2={y} stroke="var(--rule)" strokeWidth="1" />)}
      {[yMax, yMax * 2 / 3, yMax / 3, 0].map((value, index) => (
        <text key={index} x="34" y={44 + index * 40} textAnchor="end" fill="var(--ink)" fontSize="11">{Math.round(value / 1000)}k</text>
      ))}
      <line x1="40" x2="590" y1="180" y2="180" stroke="var(--rule)" strokeWidth="1.5" />
      {data.map((point, index) => {
        const groupCenter = groupCenters[index];
        const expense = point.expenses ?? point.expense ?? 0;
        const revenueY = yForValue(point.revenue);
        const expenseY = yForValue(expense);

        return (
          <g key={point.month}>
            <rect
              x={groupCenter - barWidth}
              y={revenueY}
              width={barWidth}
              height={180 - revenueY}
              fill="var(--green)"
              rx="2"
            />
            <rect
              x={groupCenter}
              y={expenseY}
              width={barWidth}
              height={180 - expenseY}
              fill="var(--alert)"
              rx="2"
            />
            {point.isCurrent && <circle cx={groupCenter - barWidth / 2} cy={Math.max(30, revenueY - 8)} r="3" fill="#60a5fa" />}
            <title>{`${point.month} · Rev: GHS ${point.revenue.toFixed(2)} · Exp: GHS ${expense.toFixed(2)} · Net: GHS ${(point.revenue - expense).toFixed(2)}`}</title>
            <text
              x={groupCenter}
              y="195"
              fill="var(--ink)"
              fontSize="11"
              textAnchor="middle"
            >
              {point.month || point.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}


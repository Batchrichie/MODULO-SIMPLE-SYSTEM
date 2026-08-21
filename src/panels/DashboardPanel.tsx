import React, { useMemo } from "react";
import type { ComponentType } from "react";
import {
  Banknote, ArrowDownRight, ArrowUpRight, Briefcase, TrendingUp, Scale,
  AlertTriangle, LayoutDashboard, BookOpen, CheckCircle2, FileText, Users,
} from "lucide-react";
import {
  INK, PAPER_RAISED, RULE, GREEN, GOLD, ALERT, MUTED,
  FONT_DISPLAY, FONT_BODY, FONT_MONO,
} from "../theme/tokens";
import Card from "../components/ui/Card";
import SectionTitle from "../components/ui/SectionTitle";
import TableScroll from "../components/ui/TableScroll";
import Th from "../components/ui/Th";
import Td from "../components/ui/Td";
import LineChart from "../components/charts/LineChart";
import BarChart from "../components/charts/BarChart";
import DonutChart from "../components/charts/DonutChart";
import useIsMobile from "../hooks/useIsMobile";
import { fmt, projectName } from "../utils/format";
import { getDashboardMetrics, getComplianceNotifications, getPrioritizedProjects, projectStatsFn } from "../utils/dashboardUtils";
import type { AppData, UserProfile } from "../types";

interface DashboardPanelProps {
  data: AppData;
  setTab: (tab: string) => void;
  profile?: UserProfile | null;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatToday() {
  return new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function budgetBarColor(pct: number) {
  if (pct > 90) return ALERT;
  if (pct > 75) return GOLD;
  return GREEN;
}

function ProgressBar({ pct, label }: { pct: number; label?: string }) {
  return (
    <div>
      {label && (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: MUTED, marginBottom: 4 }}>
          <span>{label}</span>
          <span>{pct.toFixed(1)}%</span>
        </div>
      )}
      <div style={{ background: "var(--paper)", borderRadius: 4, height: 8, overflow: "hidden", border: `1px solid ${RULE}` }}>
        <div style={{
          width: `${Math.min(pct, 100)}%`, height: "100%",
          background: budgetBarColor(pct), borderRadius: 4, transition: "width 0.3s ease",
        }} />
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon, title, subtitle,
}: {
  icon: ComponentType<{ size?: number; style?: React.CSSProperties }>;
  title: string;
  subtitle?: string;
}) {
  return (
    <div style={{ textAlign: "center", padding: "28px 12px" }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12, margin: "0 auto 12px",
        background: "rgba(47,82,51,0.06)", display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={20} style={{ color: "var(--green)", opacity: 0.85 }} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: INK, marginBottom: 4 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: MUTED, maxWidth: 300, margin: "0 auto", lineHeight: 1.5 }}>{subtitle}</div>}
    </div>
  );
}

function StatCard({
  label, value, sub, accent, icon: Icon, compact,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: string;
  icon: ComponentType<{ size?: number; style?: React.CSSProperties }>;
  compact?: boolean;
}) {
  return (
    <Card style={{ padding: compact ? "14px 16px" : "16px 18px", borderTop: `3px solid ${accent}`, height: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
        <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, lineHeight: 1.4 }}>
          {label}
        </div>
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: "var(--nav-hover)", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={15} style={{ color: accent }} />
        </div>
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: compact ? 17 : 20, fontWeight: 700, color: INK, lineHeight: 1.2, wordBreak: "break-word" }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: MUTED, marginTop: 6, lineHeight: 1.4 }}>{sub}</div>}
    </Card>
  );
}

function MetricPill({ label, value, tone }: { label: string; value: string; tone?: "green" | "gold" | "alert" | "neutral" }) {
  const colors = {
    green: { bg: "rgba(47,82,51,0.08)", color: GREEN },
    gold: { bg: "rgba(168,118,26,0.1)", color: GOLD },
    alert: { bg: "var(--alert-bg)", color: ALERT },
    neutral: { bg: "var(--paper)", color: MUTED },
  };
  const c = colors[tone || "neutral"];
  return (
    <div style={{
      padding: "10px 14px", borderRadius: 10, background: c.bg,
      border: `1px solid ${RULE}`, minWidth: 0, flex: "1 1 120px",
    }}>
      <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 14, fontWeight: 700, color: c.color }}>{value}</div>
    </div>
  );
}

export default function DashboardPanel({ data, setTab, profile }: DashboardPanelProps) {
  const isMobile = useIsMobile();
  const metrics = useMemo(() => getDashboardMetrics(data), [data]);
  const stats = useMemo(() => projectStatsFn(data), [data]);
  const alerts = getComplianceNotifications();
  const prioritizedProjects = useMemo(() => getPrioritizedProjects(data, stats), [data, stats]);

  const today = new Date().toISOString().slice(0, 10);
  const monthPrefix = today.slice(0, 7);

  const outstandingInvoices = useMemo(() =>
    data.invoices
      .map((inv) => {
        const paid = inv.payments.reduce((s, p) => s + p.amountGHS, 0);
        const total = inv.totals?.total_ghs ?? inv.totals?.grandTotalGHS ?? inv.totals?.total ?? inv.totals?.grandTotal ?? 0;
        const balance = total - paid;
        return { ...inv, balance, isOverdue: balance > 0.01 && inv.dueDate < today };
      })
      .filter((inv) => inv.balance > 0.01)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, isMobile ? 4 : 6),
  [data.invoices, today, isMobile]);

  const recentEntries = useMemo(
    () => [...data.journal].sort((a, b) => b.date.localeCompare(a.date)).slice(0, isMobile ? 5 : 8),
    [data.journal, isMobile],
  );

  const activeProjects = prioritizedProjects.slice(0, isMobile ? 2 : 4);
  const overdueCount = outstandingInvoices.filter((i) => i.isOverdue).length;
  const totalOutstandingAr = outstandingInvoices.reduce((s, i) => s + i.balance, 0);

  const paymentAccountBalances = useMemo(() => {
    const paymentAccounts = data.accounts.filter((a) => a.isPaymentAccount);
    if (paymentAccounts.length === 0) return [];
    const balances: Record<string, number> = {};
    paymentAccounts.forEach((a) => { balances[a.code] = 0; });
    data.journal.forEach((e) => e.lines.forEach((l) => {
      if (balances[l.account] !== undefined) balances[l.account] += l.debit - l.credit;
    }));
    return paymentAccounts.map((a) => ({ code: a.code, name: a.name, balance: balances[a.code] || 0 }));
  }, [data.accounts, data.journal]);

  const entriesThisMonth = useMemo(
    () => data.journal.filter((e) => e.date.startsWith(monthPrefix)).length,
    [data.journal, monthPrefix],
  );

  const firstName = profile?.employeeName?.split(" ")[0];
  const headerTitle = firstName ? `${greeting()}, ${firstName}` : greeting();
  const headerSub = `${data.companyName || "Modulo"} · ${formatToday()}`;

  const budgetUsedPct = metrics.totalEstimatedCost > 0
    ? (metrics.totalActualCost / metrics.totalEstimatedCost) * 100
    : 0;

  const positiveIncome = metrics.netIncome >= 0;
  const grid2 = isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))";
  const grid4 = isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(4, minmax(0, 1fr))";
  const grid3 = isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))";

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto" }}>
      <SectionTitle sub={headerSub}>
        {headerTitle}
      </SectionTitle>

      {alerts.length > 0 && (
        <div style={{ marginBottom: isMobile ? 16 : 20, display: "flex", flexDirection: "column", gap: 8 }}>
          {alerts.map((alert, i) => (
            <div
              key={i}
              style={{
                display: "flex", alignItems: "flex-start", gap: 10,
                background: PAPER_RAISED, border: `1px solid ${alert.color}`,
                borderLeft: `4px solid ${alert.color}`, padding: isMobile ? "10px 12px" : "12px 16px",
                borderRadius: 8,
              }}
            >
              <AlertTriangle size={15} style={{ color: alert.color, flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontFamily: FONT_BODY, fontSize: isMobile ? 13 : 13.5, color: INK, fontWeight: 500, lineHeight: 1.5 }}>
                {alert.text}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Hero: net income + context pills */}
      <Card style={{
        marginBottom: isMobile ? 16 : 20,
        padding: isMobile ? "16px 18px" : "20px 24px",
        borderLeft: `4px solid ${positiveIncome ? GREEN : ALERT}`,
        background: positiveIncome ? "rgba(47,82,51,0.03)" : "var(--alert-bg)",
      }}>
        <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
          Net income · year to date
        </div>
        <div style={{
          fontFamily: FONT_MONO, fontWeight: 700, lineHeight: 1.1, marginBottom: 16,
          fontSize: isMobile ? 24 : 32, color: positiveIncome ? GREEN : ALERT,
        }}>
          GHS {fmt(metrics.netIncome)}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: isMobile ? 8 : 10 }}>
          <MetricPill label="Revenue" value={`GHS ${fmt(metrics.totalRevenue)}`} tone="green" />
          <MetricPill label="Expenses" value={`GHS ${fmt(metrics.totalExpenses)}`} tone="alert" />
          <MetricPill label="Journal entries" value={String(data.journal.length)} tone="neutral" />
          <MetricPill label="This month" value={String(entriesThisMonth)} tone="neutral" />
        </div>
      </Card>

      {/* Financial position — always visible, no hover */}
      <SectionTitle sub="Balances from the live ledger.">Financial Position</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: grid3, gap: 12, marginBottom: isMobile ? 16 : 20 }}>
        <StatCard
          label="Cash & equivalents"
          value={`GHS ${fmt(metrics.cash)}`}
          sub={paymentAccountBalances.length > 0
            ? `${paymentAccountBalances.length} payment account${paymentAccountBalances.length > 1 ? "s" : ""}`
            : "No payment accounts configured"}
          accent={GREEN}
          icon={Banknote}
          compact={isMobile}
        />
        <StatCard
          label="Receivables"
          value={`GHS ${fmt(metrics.ar)}`}
          sub={overdueCount > 0
            ? `${overdueCount} overdue · GHS ${fmt(totalOutstandingAr)} due`
            : outstandingInvoices.length > 0 ? `${outstandingInvoices.length} open invoice(s)` : "All collected"}
          accent={GOLD}
          icon={ArrowDownRight}
          compact={isMobile}
        />
        <StatCard
          label="Payables"
          value={`GHS ${fmt(metrics.ap)}`}
          sub={metrics.ap > 0 ? "Unpaid vendor bills" : "Nothing outstanding"}
          accent={ALERT}
          icon={ArrowUpRight}
          compact={isMobile}
        />
      </div>

      {paymentAccountBalances.length > 0 && (
        <Card style={{ marginBottom: isMobile ? 16 : 20, padding: isMobile ? 14 : 18 }}>
          <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12, fontWeight: 600 }}>
            Cash breakdown
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            {paymentAccountBalances.map((acc) => (
              <div
                key={acc.code}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 12px", borderRadius: 8, background: "var(--paper)", border: `1px solid ${RULE}`,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{acc.name}</div>
                  <div style={{ fontSize: 10, color: MUTED, fontFamily: FONT_MONO }}>{acc.code}</div>
                </div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 700, color: acc.balance < 0 ? ALERT : INK, flexShrink: 0, marginLeft: 8 }}>
                  GHS {fmt(acc.balance)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Operations summary */}
      <SectionTitle sub={`${prioritizedProjects.length} active project${prioritizedProjects.length !== 1 ? "s" : ""} · portfolio performance.`}>
        Operations
      </SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: grid4, gap: 12, marginBottom: isMobile ? 16 : 20 }}>
        <StatCard label="Contract value" value={`GHS ${fmt(metrics.totalContractValue)}`} accent={GREEN} icon={Briefcase} compact />
        <StatCard label="Est. cost" value={`GHS ${fmt(metrics.totalEstimatedCost)}`} accent={INK} icon={LayoutDashboard} compact />
        <StatCard
          label="Actual cost"
          value={`GHS ${fmt(metrics.totalActualCost)}`}
          sub={metrics.totalEstimatedCost > 0 ? `${budgetUsedPct.toFixed(0)}% of budget` : undefined}
          accent={GOLD}
          icon={TrendingUp}
          compact
        />
        <StatCard
          label="Projected margin"
          value={`GHS ${fmt(metrics.projectedGrossMargin)}`}
          sub={`${metrics.projectedMarginPct.toFixed(1)}% gross`}
          accent={metrics.projectedGrossMargin >= 0 ? GREEN : ALERT}
          icon={Scale}
          compact
        />
      </div>

      {metrics.totalEstimatedCost > 0 && (
        <Card style={{ marginBottom: isMobile ? 16 : 20, padding: isMobile ? 14 : 18 }}>
          <ProgressBar pct={budgetUsedPct} label="Portfolio budget consumed" />
        </Card>
      )}

      {/* Trends — side by side on desktop */}
      <SectionTitle sub="Cash movement and monthly P&amp;L.">Trends</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: grid2, gap: 16, marginBottom: isMobile ? 16 : 20 }}>
        <Card style={{ padding: isMobile ? 14 : 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14, flexWrap: "wrap", gap: 6 }}>
            <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: isMobile ? 14 : 15, color: INK, margin: 0, fontWeight: 700 }}>Cash flow</h3>
            <span style={{ fontSize: 10, color: MUTED }}>Last 6 movements</span>
          </div>
          {metrics.cashFlowData.length > 0 ? (
            <LineChart data={metrics.cashFlowData} />
          ) : (
            <EmptyState icon={Banknote} title="No cash movements" subtitle="Activity on payment accounts will chart here." />
          )}
        </Card>

        <Card style={{ padding: isMobile ? 14 : 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14, flexWrap: "wrap", gap: 6 }}>
            <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: isMobile ? 14 : 15, color: INK, margin: 0, fontWeight: 700 }}>Revenue vs expenses</h3>
            <div style={{ display: "flex", gap: 10, fontSize: 10, color: MUTED }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 7, height: 7, background: GREEN, borderRadius: 2 }} />Rev
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 7, height: 7, background: ALERT, borderRadius: 2 }} />Exp
              </span>
            </div>
          </div>
          {metrics.barChartData.length > 0 ? (
            <BarChart data={metrics.barChartData} />
          ) : (
            <EmptyState icon={TrendingUp} title="No monthly data" subtitle="Journal activity builds this chart over time." />
          )}
        </Card>
      </div>

      {/* Invoices + contract mix */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.2fr 0.8fr", gap: 16, marginBottom: isMobile ? 16 : 20, alignItems: "start" }}>
        <div>
          <SectionTitle sub={overdueCount > 0 ? `${overdueCount} overdue · sorted by due date` : "Open client balances"}>
            Outstanding Invoices
          </SectionTitle>
          <Card style={{ padding: isMobile ? 0 : undefined }}>
            {outstandingInvoices.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="All caught up" subtitle="No outstanding receivables." />
            ) : (
              <TableScroll>
                <table className="table-card" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <Th>Inv #</Th>
                      {!isMobile && <Th>Client</Th>}
                      <Th>Due</Th>
                      <Th right>Balance</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {outstandingInvoices.map((inv) => (
                      <tr key={inv.id} className="row-hover" style={{ cursor: "pointer" }} onClick={() => setTab("invoicing")}>
                        <Td mono label="Inv #">{inv.invoiceNumber}</Td>
                        {!isMobile && <Td label="Client">{inv.billTo}</Td>}
                        <Td mono label="Due" style={{ fontSize: 12, color: inv.isOverdue ? ALERT : MUTED }}>{inv.dueDate}</Td>
                        <Td right mono bold label="Balance" style={{ color: inv.isOverdue ? ALERT : INK }}>
                          {isMobile ? fmt(inv.balance) : `GHS ${fmt(inv.balance)}`}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            )}
          </Card>
        </div>

        <div>
          <SectionTitle sub="Active contract share.">Portfolio Mix</SectionTitle>
          <Card>
            {metrics.donutData.length > 0 ? (
              <>
                <DonutChart data={metrics.donutData} />
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                  {metrics.donutData.slice(0, isMobile ? 4 : 5).map((d) => (
                    <div key={d.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, gap: 8 }}>
                      <span style={{ color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
                      <span style={{ fontFamily: FONT_MONO, fontWeight: 600, flexShrink: 0 }}>GHS {fmt(d.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState icon={Briefcase} title="No contracts" subtitle="Active projects with values appear here." />
            )}
          </Card>
        </div>
      </div>

      {/* Active projects */}
      <SectionTitle sub="Highest activity first — tap a project for details.">Active Projects</SectionTitle>
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(260px, 1fr))",
        gap: 12,
        marginBottom: isMobile ? 16 : 20,
      }}>
        {activeProjects.map((p) => {
          const costPct = p.estimatedCost > 0 ? (p.actualCost / p.estimatedCost) * 100 : 0;
          const marginPct = p.contractValue > 0 ? (p.wipMargin / p.contractValue) * 100 : 0;
          return (
            <div
              key={p.id}
              style={{ cursor: "pointer" }}
              onClick={() => setTab("projects")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter") setTab("projects"); }}
            >
              <Card style={{
                padding: isMobile ? 14 : 18,
                borderLeft: p.isCurrentFocus ? `4px solid ${GREEN}` : undefined,
                height: "100%",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
                  <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: INK, lineHeight: 1.3 }}>{p.name}</div>
                  {p.isCurrentFocus && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, color: GREEN, textTransform: "uppercase",
                      background: "rgba(47,82,51,0.08)", padding: "2px 7px", borderRadius: 10, flexShrink: 0,
                    }}>
                      Focus
                    </span>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10, fontSize: 11 }}>
                  <div>
                    <div style={{ color: MUTED, marginBottom: 2 }}>Contract</div>
                    <div style={{ fontFamily: FONT_MONO, fontWeight: 600 }}>GHS {fmt(p.contractValue)}</div>
                  </div>
                  <div>
                    <div style={{ color: MUTED, marginBottom: 2 }}>Margin</div>
                    <div style={{ fontFamily: FONT_MONO, fontWeight: 600, color: p.wipMargin >= 0 ? GREEN : ALERT }}>{marginPct.toFixed(0)}%</div>
                  </div>
                </div>
                <ProgressBar pct={costPct} label="Budget used" />
                <div style={{ fontSize: 10, color: MUTED, marginTop: 6 }}>
                  Spent GHS {fmt(p.actualCost)} of GHS {fmt(p.estimatedCost)}
                </div>
              </Card>
            </div>
          );
        })}
        {activeProjects.length === 0 && (
          <Card>
            <EmptyState icon={Briefcase} title="No active projects" subtitle="Activate projects to track portfolio health." />
          </Card>
        )}
      </div>

      {/* Recent activity */}
      <SectionTitle sub={`${entriesThisMonth} entries posted this month.`}>Recent Activity</SectionTitle>
      <Card style={{ padding: isMobile ? 0 : undefined }}>
        {recentEntries.length === 0 ? (
          <EmptyState icon={BookOpen} title="No journal entries" subtitle="Posted transactions appear here." />
        ) : (
          <TableScroll>
            <table className="table-card" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <Th>Date</Th>
                  {!isMobile && <Th>Entry #</Th>}
                  <Th>Description</Th>
                  {!isMobile && <Th>Project</Th>}
                  <Th right>Amount</Th>
                </tr>
              </thead>
              <tbody>
                {recentEntries.map((e) => (
                  <tr key={e.id} className="row-hover" style={{ cursor: "pointer" }} onClick={() => setTab("journal")}>
                    <Td mono label="Date" style={{ fontSize: 12 }}>{e.date}</Td>
                    {!isMobile && <Td mono label="Entry #">{e.entryNumber}</Td>}
                    <Td label="Description">{e.description || "—"}</Td>
                    {!isMobile && (
                      <Td label="Project" style={{ fontSize: 12, color: MUTED }}>
                        {projectName(data.projects, e.project)}
                      </Td>
                    )}
                    <Td right mono label="Amount">{isMobile ? fmt(e.lines.reduce((s, l) => s + l.debit, 0)) : `GHS ${fmt(e.lines.reduce((s, l) => s + l.debit, 0))}`}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Card>

      {/* Footer snapshot — desktop only extra context */}
      {!isMobile && (
        <div style={{
          marginTop: 20, padding: "14px 18px", borderRadius: 10,
          background: "var(--paper)", border: `1px solid ${RULE}`,
          display: "flex", flexWrap: "wrap", gap: 24, fontSize: 12, color: MUTED,
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <FileText size={14} /> {data.invoices.filter((i) => i.status !== "Void").length} invoices
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <BookOpen size={14} /> {data.journal.length} journal entries
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Briefcase size={14} /> {prioritizedProjects.length} active projects
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Users size={14} /> {data.employees.filter((e) => e.active).length} active employees
          </span>
        </div>
      )}
    </div>
  );
}

import React, { useMemo } from "react";
import type { ComponentType } from "react";
import {
  Banknote, ArrowDownRight, ArrowUpRight, Briefcase, TrendingUp, Scale,
  AlertTriangle, PenLine, FileText, LayoutDashboard, BookOpen,
  CheckCircle2,
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
import Button from "../components/ui/Button";
import KpiCard from "../components/charts/KpiCard";
import LineChart from "../components/charts/LineChart";
import BarChart from "../components/charts/BarChart";
import DonutChart from "../components/charts/DonutChart";
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
    <div style={{ textAlign: "center", padding: "32px 16px" }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12, margin: "0 auto 14px",
        background: "rgba(47,82,51,0.06)", display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={22} style={{ color: "var(--green)", opacity: 0.85 }} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: INK, marginBottom: 4 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: MUTED, maxWidth: 320, margin: "0 auto" }}>{subtitle}</div>}
    </div>
  );
}

function QuickNav({ setTab }: { setTab: (tab: string) => void }) {
  const links: { key: string; label: string; icon: ComponentType<{ size?: number }> }[] = [
    { key: "journal", label: "Journal", icon: PenLine },
    { key: "invoicing", label: "Invoicing", icon: FileText },
    { key: "ledger", label: "Trial Balance", icon: Scale },
    { key: "financials", label: "Financials", icon: TrendingUp },
  ];

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {links.map(({ key, label, icon: Icon }) => (
        <Button key={key} variant="ghost" size="sm" icon={Icon} onClick={() => setTab(key)}>
          {label}
        </Button>
      ))}
    </div>
  );
}

function NetIncomeBanner({
  netIncome, revenue, expenses,
}: {
  netIncome: number; revenue: number; expenses: number;
}) {
  const positive = netIncome >= 0;
  return (
    <Card style={{
      marginBottom: 24, padding: "18px 24px",
      borderLeft: `4px solid ${positive ? GREEN : ALERT}`,
      background: positive ? "rgba(47,82,51,0.03)" : "var(--alert-bg)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
            Net income (YTD from ledger)
          </div>
          <div style={{
            fontFamily: FONT_MONO, fontSize: 28, fontWeight: 700,
            color: positive ? GREEN : ALERT,
          }}>
            GHS {fmt(netIncome)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4 }}>Revenue</div>
            <div style={{ fontFamily: FONT_MONO, fontWeight: 600, fontSize: 15, color: GREEN }}>GHS {fmt(revenue)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4 }}>Expenses</div>
            <div style={{ fontFamily: FONT_MONO, fontWeight: 600, fontSize: 15, color: ALERT }}>GHS {fmt(expenses)}</div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function DashboardPanel({ data, setTab, profile }: DashboardPanelProps) {
  const metrics = useMemo(() => getDashboardMetrics(data), [data]);
  const stats = useMemo(() => projectStatsFn(data), [data]);
  const alerts = getComplianceNotifications();
  const prioritizedProjects = useMemo(() => getPrioritizedProjects(data, stats), [data, stats]);

  const today = new Date().toISOString().slice(0, 10);

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
      .slice(0, 5),
  [data.invoices, today]);

  const recentEntries = useMemo(
    () => [...data.journal].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6),
    [data.journal],
  );

  const activeProjects = prioritizedProjects.slice(0, 3);
  const overdueCount = outstandingInvoices.filter((i) => i.isOverdue).length;

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

  const firstName = profile?.employeeName?.split(" ")[0];
  const headerTitle = firstName ? `${greeting()}, ${firstName}` : greeting();
  const headerSub = `${data.companyName || "Modulo"} · ${formatToday()} · Financial & operational overview`;

  const budgetUsedPct = metrics.totalEstimatedCost > 0
    ? (metrics.totalActualCost / metrics.totalEstimatedCost) * 100
    : 0;

  return (
    <div>
      <SectionTitle sub={headerSub} action={<QuickNav setTab={setTab} />}>
        {headerTitle}
      </SectionTitle>

      {alerts.length > 0 && (
        <div style={{ marginBottom: 24, display: "flex", flexDirection: "column", gap: 8 }}>
          {alerts.map((alert, i) => (
            <div
              key={i}
              style={{
                display: "flex", alignItems: "flex-start", gap: 12,
                background: PAPER_RAISED, border: `1px solid ${alert.color}`,
                borderLeft: `4px solid ${alert.color}`, padding: "12px 16px",
                borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              }}
            >
              <AlertTriangle size={16} style={{ color: alert.color, flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: INK, fontWeight: 500, lineHeight: 1.5 }}>
                {alert.text}
              </span>
            </div>
          ))}
        </div>
      )}

      <NetIncomeBanner
        netIncome={metrics.netIncome}
        revenue={metrics.totalRevenue}
        expenses={metrics.totalExpenses}
      />

      <SectionTitle sub="Cash, receivables, and payables at a glance.">Financial Position</SectionTitle>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
        <KpiCard
          title="Cash & Equivalents"
          value={metrics.cash}
          icon={Banknote}
          accent={GREEN}
          sub="Payment accounts"
          detail={(
            <>
              <p style={{ margin: "0 0 10px 0" }}>Sum of all payment account balances (cash, mobile money, bank).</p>
              {paymentAccountBalances.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {paymentAccountBalances.map((acc) => (
                    <div key={acc.code} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                      <span style={{ color: "#94A3B8" }}>{acc.name}</span>
                      <span style={{ fontWeight: 600 }}>GHS {fmt(acc.balance)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        />
        <KpiCard
          title="Receivables"
          value={metrics.ar}
          icon={ArrowDownRight}
          accent={GOLD}
          sub={overdueCount > 0 ? `${overdueCount} overdue invoice${overdueCount > 1 ? "s" : ""}` : "Owed by clients"}
          detail={(
            <>
              <p style={{ margin: "0 0 6px 0" }}>Total unpaid client invoices.</p>
              <div style={{ fontSize: 11, color: "#94A3B8" }}>
                {outstandingInvoices.length > 0
                  ? `${overdueCount} overdue · ${outstandingInvoices.length} outstanding`
                  : "All invoices paid up."}
              </div>
            </>
          )}
        />
        <KpiCard
          title="Payables"
          value={metrics.ap}
          icon={ArrowUpRight}
          accent={ALERT}
          sub="Owed to vendors"
          detail={<p style={{ margin: 0 }}>Total unpaid bills to vendors and suppliers.</p>}
        />
      </div>

      <SectionTitle sub="Active project portfolio and budget consumption.">Operations</SectionTitle>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
        <KpiCard
          title="Active Contracts"
          value={metrics.totalContractValue}
          icon={Briefcase}
          accent={GREEN}
          sub={`${prioritizedProjects.length} ongoing project${prioritizedProjects.length !== 1 ? "s" : ""}`}
          detail={(
            <>
              <p style={{ margin: "0 0 8px 0" }}>Combined contract value across active projects.</p>
              {prioritizedProjects.slice(0, 3).map((p) => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                  <span style={{ color: "#CBD5E1" }}>{p.name}</span>
                  <span style={{ fontWeight: 600 }}>GHS {fmt(Number(p.contractValue) || 0)}</span>
                </div>
              ))}
            </>
          )}
        />
        <KpiCard
          title="Est. Portfolio Cost"
          value={metrics.totalEstimatedCost}
          icon={LayoutDashboard}
          accent={INK}
          sub="Total budgeted"
          detail={<p style={{ margin: 0 }}>Sum of estimated costs for all active projects.</p>}
        />
        <KpiCard
          title="Actual Cost to Date"
          value={metrics.totalActualCost}
          icon={TrendingUp}
          accent={GOLD}
          sub={metrics.totalEstimatedCost > 0 ? `${budgetUsedPct.toFixed(0)}% of budget used` : "Posted expenses"}
          detail={(
            <>
              <p style={{ margin: "0 0 8px 0" }}>Journal expenses posted to active projects.</p>
              {metrics.totalEstimatedCost > 0 && (
                <ProgressBar pct={budgetUsedPct} label="Budget consumed" />
              )}
            </>
          )}
        />
        <KpiCard
          title="Projected Margin"
          value={metrics.projectedGrossMargin}
          icon={Scale}
          accent={metrics.projectedGrossMargin >= 0 ? GREEN : ALERT}
          sub={`${metrics.projectedMarginPct.toFixed(1)}% gross margin`}
          detail={(
            <div style={{ display: "flex", gap: 16 }}>
              <div>
                <div style={{ color: "#94A3B8", fontSize: 10, textTransform: "uppercase" }}>Contracts</div>
                <div style={{ fontWeight: 600 }}>GHS {fmt(metrics.totalContractValue)}</div>
              </div>
              <div>
                <div style={{ color: "#94A3B8", fontSize: 10, textTransform: "uppercase" }}>Est. costs</div>
                <div style={{ fontWeight: 600 }}>GHS {fmt(metrics.totalEstimatedCost)}</div>
              </div>
            </div>
          )}
        />
      </div>

      <SectionTitle sub="Cash movement and monthly revenue vs expenses.">Trends</SectionTitle>
      <div className="grid-fin" style={{ marginBottom: 28 }}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
            <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 15, color: INK, margin: 0, fontWeight: 700 }}>Cash Flow Trend</h3>
            <span style={{ fontSize: 11, color: MUTED }}>Last 6 movements</span>
          </div>
          {metrics.cashFlowData.length > 0 ? (
            <LineChart data={metrics.cashFlowData} />
          ) : (
            <EmptyState icon={Banknote} title="No cash movements yet" subtitle="Payment account activity will appear here." />
          )}
        </Card>

        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
            <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 15, color: INK, margin: 0, fontWeight: 700 }}>Revenue vs Expenses</h3>
            <div style={{ display: "flex", gap: 12, fontSize: 11, color: MUTED }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 8, height: 8, background: GREEN, borderRadius: 2 }} />Rev
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 8, height: 8, background: ALERT, borderRadius: 2 }} />Exp
              </span>
            </div>
          </div>
          {metrics.barChartData.length > 0 ? (
            <BarChart data={metrics.barChartData} />
          ) : (
            <EmptyState icon={TrendingUp} title="No monthly data yet" subtitle="Post journal entries to see revenue and expense trends." />
          )}
        </Card>
      </div>

      <div className="grid-fin" style={{ marginBottom: 28 }}>
        <div>
          <SectionTitle
            sub="Sorted by due date."
            action={outstandingInvoices.length > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => setTab("invoicing")}>
                View all
              </Button>
            ) : undefined}
          >
            Outstanding Invoices
          </SectionTitle>
          <Card>
            {outstandingInvoices.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="All caught up"
                subtitle="No outstanding invoices — receivables are fully collected."
              />
            ) : (
              <TableScroll>
                <table className="table-card" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <Th>Inv #</Th>
                      <Th>Client</Th>
                      <Th>Due</Th>
                      <Th right>Balance</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {outstandingInvoices.map((inv) => (
                      <tr key={inv.id} className="row-hover" style={{ cursor: "pointer" }} onClick={() => setTab("invoicing")}>
                        <Td mono label="Inv #">{inv.invoiceNumber}</Td>
                        <Td label="Client">{inv.billTo}</Td>
                        <Td mono label="Due" style={{ fontSize: 12, color: MUTED }}>{inv.dueDate}</Td>
                        <Td right mono bold label="Balance" style={{ color: ALERT }}>GHS {fmt(inv.balance)}</Td>
                        <Td label="Status">
                          {inv.isOverdue ? (
                            <span style={{
                              color: ALERT, fontWeight: 700, fontSize: 10,
                              background: "var(--alert-bg)", padding: "3px 8px", borderRadius: 4,
                              textTransform: "uppercase", letterSpacing: 0.4,
                            }}>
                              Overdue
                            </span>
                          ) : (
                            <span style={{ color: MUTED, fontSize: 11 }}>Due soon</span>
                          )}
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
          <SectionTitle sub="Share of active contract value.">Contract Distribution</SectionTitle>
          <Card>
            {metrics.donutData.length > 0 ? (
              <DonutChart data={metrics.donutData} />
            ) : (
              <EmptyState icon={Briefcase} title="No active contracts" subtitle="Add projects with contract values to see distribution." />
            )}
          </Card>
        </div>
      </div>

      <SectionTitle sub="Current working projects shown first.">Active Projects</SectionTitle>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
        {activeProjects.map((p) => {
          const costPct = p.estimatedCost > 0 ? (p.actualCost / p.estimatedCost) * 100 : 0;
          const marginPct = p.contractValue > 0 ? (p.wipMargin / p.contractValue) * 100 : 0;
          return (
            <div
              key={p.id}
              style={{ flex: "1 1 280px", cursor: "pointer" }}
              onClick={() => setTab("projects")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter") setTab("projects"); }}
            >
              <Card style={{ borderLeft: p.isCurrentFocus ? `4px solid ${GREEN}` : undefined, height: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: "flex-start", gap: 8 }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: INK, lineHeight: 1.3 }}>{p.name}</div>
                {p.isCurrentFocus ? (
                  <span style={{
                    display: "flex", alignItems: "center", gap: 4, flexShrink: 0,
                    fontSize: 9, fontWeight: 700, color: GREEN, textTransform: "uppercase",
                    background: "rgba(47,82,51,0.08)", padding: "3px 8px", borderRadius: 12, letterSpacing: 0.4,
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: GREEN }} />
                    Active
                  </span>
                ) : (
                  <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: p.wipMargin >= 0 ? GREEN : ALERT, flexShrink: 0 }}>
                    {marginPct.toFixed(0)}% margin
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: MUTED, marginBottom: 10 }}>
                Contract GHS {fmt(p.contractValue)} · Budget GHS {fmt(p.estimatedCost)}
              </div>
              <ProgressBar pct={costPct} label="Cost incurred" />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: MUTED, marginTop: 6 }}>
                <span>Spent GHS {fmt(p.actualCost)}</span>
                <span>{costPct.toFixed(0)}% of budget</span>
              </div>
            </Card>
            </div>
          );
        })}
        {activeProjects.length === 0 && (
          <Card style={{ flex: "1 1 280px" }}>
            <EmptyState icon={Briefcase} title="No active projects" subtitle="Create or activate projects to track portfolio health here." />
          </Card>
        )}
      </div>

      <SectionTitle
        sub="Latest posted journal entries."
        action={recentEntries.length > 0 ? (
          <Button variant="ghost" size="sm" onClick={() => setTab("journal")}>
            View journal
          </Button>
        ) : undefined}
      >
        Recent Activity
      </SectionTitle>
      <Card>
        {recentEntries.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No journal entries yet"
            subtitle="Transactions posted to the journal will appear here."
          />
        ) : (
          <TableScroll>
            <table className="table-card" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Entry #</Th>
                  <Th>Description</Th>
                  <Th>Project</Th>
                  <Th right>Amount</Th>
                </tr>
              </thead>
              <tbody>
                {recentEntries.map((e) => (
                  <tr key={e.id} className="row-hover" style={{ cursor: "pointer" }} onClick={() => setTab("journal")}>
                    <Td mono label="Date" style={{ fontSize: 12 }}>{e.date}</Td>
                    <Td mono label="Entry #">{e.entryNumber}</Td>
                    <Td label="Description">{e.description || "—"}</Td>
                    <Td label="Project" style={{ fontSize: 12, color: MUTED }}>
                      {projectName(data.projects, e.project)}
                    </Td>
                    <Td right mono label="Amount">GHS {fmt(e.lines.reduce((s, l) => s + l.debit, 0))}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Card>
    </div>
  );
}

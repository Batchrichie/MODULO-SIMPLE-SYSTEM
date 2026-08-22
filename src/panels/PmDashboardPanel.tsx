import React, { useMemo } from "react";
import {
  Briefcase, TrendingUp, Clock, CheckCircle2, AlertTriangle,
  ArrowRight, Circle, FileText, Users,
} from "lucide-react";
import { INK, PAPER, PAPER_RAISED, RULE, GREEN, GREEN_DEEP, GOLD, ALERT, MUTED,
         FONT_DISPLAY, FONT_BODY, FONT_MONO } from "../../theme/tokens";
import Card from "../../components/ui/Card";
import SectionTitle from "../../components/ui/SectionTitle";
import TableScroll from "../../components/ui/TableScroll";
import Th from "../../components/ui/Th";
import Td from "../../components/ui/Td";
import { fmt } from "../../utils/format";
import type { AppData, UserProfile } from "../../types";

interface PmDashboardPanelProps {
  data: AppData;
  profile: UserProfile;
}

/** Status badge colors */
function statusBadge(status: string | null | undefined) {
  if (!status) return { color: MUTED, bg: PAPER, label: "Unknown" };
  switch (status) {
    case "Active": return { color: GREEN, bg: "var(--success-bg)", label: "Active" };
    case "Completed": return { color: "#3B82F6", bg: "#EFF6FF", label: "Completed" };
    case "On Hold": return { color: GOLD, bg: "#FFFBEB", label: "On Hold" };
    case "Pending": return { color: MUTED, bg: PAPER, label: "Pending" };
    default: return { color: MUTED, bg: PAPER, label: status };
  }
}

export default function PmDashboardPanel({ data, profile }: PmDashboardPanelProps) {
  const activeProjects = useMemo(
    () => data.projects.filter(p => p.status === "Active" && p.id !== "GEN"),
    [data.projects]
  );

  const onHoldProjects = useMemo(
    () => data.projects.filter(p => p.status === "On Hold" && p.id !== "GEN"),
    [data.projects]
  );

  const completedProjects = useMemo(
    () => data.projects.filter(p => p.status === "Completed" && p.id !== "GEN"),
    [data.projects]
  );

  // Compute per-project cost from journal
  const projectCosts = useMemo(() => {
    const costs: Record<string, number> = {};
    data.journal.forEach(e => {
      if (!e.project || e.project === "GEN") return;
      e.lines.forEach(l => {
        const acc = data.accounts.find(a => a.code === l.account);
        if (acc && acc.type === "Expense") {
          costs[e.project] = (costs[e.project] || 0) + l.debit;
        }
      });
    });
    return costs;
  }, [data.journal, data.accounts]);

  // Revenue billed per project from journal (credit on Revenue/Income accounts — matches actualCost ledger pattern)
  const projectRevenue = useMemo(() => {
    const rev: Record<string, number> = {};
    data.journal.forEach(e => {
      if (!e.project || e.project === "GEN") return;
      e.lines.forEach(l => {
        const acc = data.accounts.find(a => a.code === l.account);
        if (acc && acc.type === "Income") {
          rev[e.project] = (rev[e.project] || 0) + (l.credit - l.debit);
        }
      });
    });
    return rev;
  }, [data.journal, data.accounts]);

  // Recent journal entries across all active projects
  const recentEntries = useMemo(() => {
    const activeIds = new Set(activeProjects.map(p => p.id));
    return data.journal
      .filter(e => e.project && activeIds.has(e.project))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 8);
  }, [data.journal, activeProjects]);

  // Unpaid invoices related to active projects
  const unpaidInvoices = useMemo(() => {
    const activeIds = new Set(activeProjects.map(p => p.id));
    return data.invoices
      .filter(inv => inv.project && activeIds.has(inv.project) && inv.status !== "Void" && inv.status !== "Paid")
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [data.invoices, activeProjects]);

  // Summary KPIs
  const totalContract = activeProjects.reduce((s, p) => s + (parseFloat(String(p.contractValue)) || 0), 0);
  const totalEstCost = activeProjects.reduce((s, p) => s + (parseFloat(String(p.estimatedCost)) || 0), 0);
  const totalActualCost = activeProjects.reduce((s, p) => s + (projectCosts[p.id] || 0), 0);
  const totalRevenue = activeProjects.reduce((s, p) => s + (projectRevenue[p.id] || 0), 0);
  const costPct = totalEstCost > 0 ? (totalActualCost / totalEstCost) * 100 : 0;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div>
      <SectionTitle sub={`Welcome back, ${profile.employeeName}. Here is your project portfolio overview.`}>
        {greeting()}, {profile.employeeName.split(" ")[0]}
      </SectionTitle>

      {/* KPI Row */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <Card style={{ flex: "1 1 200px", padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--success-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Briefcase size={18} style={{ color: GREEN }} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>Active Projects</div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 700, color: INK }}>{activeProjects.length}</div>
            </div>
          </div>
        </Card>

        <Card style={{ flex: "1 1 200px", padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <TrendingUp size={18} style={{ color: "#3B82F6" }} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>Contract Value</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 16, fontWeight: 700, color: INK }}>GHS {fmt(totalContract)}</div>
            </div>
          </div>
        </Card>

        <Card style={{ flex: "1 1 200px", padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "#FFFBEB", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Clock size={18} style={{ color: GOLD }} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>On Hold</div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 700, color: INK }}>{onHoldProjects.length}</div>
            </div>
          </div>
        </Card>

        <Card style={{ flex: "1 1 200px", padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--success-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle2 size={18} style={{ color: GREEN }} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>Completed</div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 700, color: INK }}>{completedProjects.length}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Portfolio Cost Overview */}
      {activeProjects.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <SectionTitle sub="Aggregate cost and revenue across all active projects.">
            Portfolio Overview
          </SectionTitle>
          <Card>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 16 }}>
              <div style={{ flex: "1 1 140px" }}>
                <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Total Contracts</div>
                <div style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 16 }}>GHS {fmt(totalContract)}</div>
              </div>
              <div style={{ flex: "1 1 140px" }}>
                <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Billed to Date</div>
                <div style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 16, color: GREEN }}>GHS {fmt(totalRevenue)}</div>
              </div>
              <div style={{ flex: "1 1 140px" }}>
                <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Estimated Cost</div>
                <div style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 16 }}>GHS {fmt(totalEstCost)}</div>
              </div>
              <div style={{ flex: "1 1 140px" }}>
                <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Actual Cost</div>
                <div style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 16, color: costPct > 90 ? ALERT : INK }}>GHS {fmt(totalActualCost)}</div>
              </div>
            </div>
            {totalEstCost > 0 && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: MUTED, marginBottom: 4 }}>
                  <span>Budget Consumption</span>
                  <span>{costPct.toFixed(1)}%</span>
                </div>
                <div style={{ background: "var(--paper)", borderRadius: 4, height: 8, overflow: "hidden", border: `1px solid ${RULE}` }}>
                  <div style={{
                    width: `${Math.min(costPct, 100)}%`, height: "100%",
                    background: costPct > 90 ? ALERT : costPct > 75 ? GOLD : GREEN,
                    borderRadius: 4, transition: "width 0.3s ease",
                  }} />
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Active Projects Grid */}
      <div style={{ marginBottom: 24 }}>
        <SectionTitle sub="All your ongoing projects with cost and billing status.">
          Active Projects
        </SectionTitle>
        {activeProjects.length === 0 ? (
          <Card>
            <div style={{ textAlign: "center", padding: "24px 0", color: MUTED }}>
              <Briefcase size={32} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
              <p style={{ margin: 0, fontSize: 14 }}>No active projects assigned to you yet.</p>
              <p style={{ margin: "4px 0 0", fontSize: 12 }}>Projects assigned by your administrator will appear here.</p>
            </div>
          </Card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {activeProjects.map(p => {
              const cost = projectCosts[p.id] || 0;
              const est = parseFloat(String(p.estimatedCost)) || 0;
              const contract = parseFloat(String(p.contractValue)) || 0;
              const revenue = projectRevenue[p.id] || 0;
              const costPct = est > 0 ? (cost / est) * 100 : 0;
              const badge = statusBadge(p.status);
              const margin = contract > 0 ? ((contract - est) / contract * 100) : 0;

              return (
                <Card key={p.id} style={{ borderLeft: `4px solid ${GREEN}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: INK, marginBottom: 4 }}>{p.name}</div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: badge.color, background: badge.bg, padding: "2px 8px", borderRadius: 10, textTransform: "uppercase", letterSpacing: 0.4 }}>{badge.label}</span>
                        {p.projectType && <span style={{ fontSize: 11, color: MUTED }}>{p.projectType}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>Contract</div>
                      <div style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 16, color: INK }}>GHS {fmt(contract)}</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Billed</div>
                      <div style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 600, color: GREEN }}>GHS {fmt(revenue)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Actual Cost</div>
                      <div style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 600, color: costPct > 90 ? ALERT : INK }}>GHS {fmt(cost)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Est. Cost</div>
                      <div style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 600 }}>GHS {fmt(est)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Proj. Margin</div>
                      <div style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 600, color: margin >= 0 ? GREEN : ALERT }}>{margin.toFixed(1)}%</div>
                    </div>
                  </div>

                  {est > 0 && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: MUTED, marginBottom: 3 }}>
                        <span>Budget used</span>
                        <span>{costPct.toFixed(1)}%</span>
                      </div>
                      <div style={{ background: "var(--paper)", borderRadius: 3, height: 6, overflow: "hidden", border: `1px solid ${RULE}` }}>
                        <div style={{
                          width: `${Math.min(costPct, 100)}%`, height: "100%",
                          background: costPct > 90 ? ALERT : costPct > 75 ? GOLD : GREEN,
                          borderRadius: 3, transition: "width 0.3s ease",
                        }} />
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Two-column grid: Recent Activity + Unpaid Invoices */}
      <div className="grid-fin" style={{ marginBottom: 24 }}>
        {/* Recent Project Activity */}
        <div>
          <SectionTitle sub="Latest journal entries on your projects.">
            Recent Activity
          </SectionTitle>
          <Card>
            {recentEntries.length === 0 ? (
              <p style={{ color: MUTED, fontSize: 13.5, margin: 0 }}>No recent project activity to show.</p>
            ) : (
              <TableScroll>
                <table className="table-card" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <Th>Date</Th>
                      <Th>Project</Th>
                      <Th>Description</Th>
                      <Th right>Amount</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentEntries.map(e => {
                      const proj = data.projects.find(p => p.id === e.project);
                      return (
                        <tr key={e.id} className="row-hover">
                          <Td label="Date" mono>{e.date}</Td>
                          <Td label="Project">{proj?.name || "General"}</Td>
                          <Td label="Description">{e.description || "—"}</Td>
                          <Td right mono label="Amount" bold>GHS {fmt(e.lines.reduce((s, l) => s + l.debit, 0))}</Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableScroll>
            )}
          </Card>
        </div>

        {/* Unpaid Project Invoices */}
        <div>
          <SectionTitle sub="Outstanding invoices on your projects.">
            Outstanding Invoices
          </SectionTitle>
          <Card>
            {unpaidInvoices.length === 0 ? (
              <p style={{ color: MUTED, fontSize: 13.5, margin: 0 }}>All project invoices are fully paid.</p>
            ) : (
              <TableScroll>
                <table className="table-card" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <Th>Inv #</Th>
                      <Th>Project</Th>
                      <Th right>Balance</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {unpaidInvoices.map(inv => {
                      const paid = inv.payments.reduce((s, p) => s + p.amountGHS, 0);
                      const balance = (inv.totals?.total_ghs ?? inv.totals?.grandTotalGHS ?? inv.totals?.total ?? inv.totals?.grandTotal ?? 0) - paid;
                      const today = new Date().toISOString().slice(0, 10);
                      const overdue = balance > 0.01 && inv.dueDate && inv.dueDate < today;
                      const proj = data.projects.find(p => p.id === inv.project);
                      return (
                        <tr key={inv.id} className="row-hover">
                          <Td label="Inv #" mono>{inv.invoiceNumber}</Td>
                          <Td label="Project">{proj?.name || "General"}</Td>
                          <Td right mono label="Balance" bold style={{ color: ALERT }}>GHS {fmt(balance)}</Td>
                          <Td label="Status">
                            {overdue ? (
                              <span style={{ color: ALERT, fontWeight: 700, fontSize: 11, background: "var(--alert-bg)", padding: "2px 6px", borderRadius: 4 }}>OVERDUE</span>
                            ) : (
                              <span style={{ color: MUTED, fontSize: 11 }}>Due {inv.dueDate || "—"}</span>
                            )}
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableScroll>
            )}
          </Card>
        </div>
      </div>

      {/* On Hold & Completed Projects (collapsed summary) */}
      {(onHoldProjects.length > 0 || completedProjects.length > 0) && (
        <div className="grid-fin">
          {onHoldProjects.length > 0 && (
            <div>
              <SectionTitle sub="Projects currently paused.">On Hold</SectionTitle>
              <Card>
                {onHoldProjects.map(p => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${RULE}` }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: INK }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: MUTED }}>{p.projectType || ""}</div>
                    </div>
                    <div style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 600 }}>GHS {fmt(parseFloat(String(p.contractValue)) || 0)}</div>
                  </div>
                ))}
              </Card>
            </div>
          )}
          {completedProjects.length > 0 && (
            <div>
              <SectionTitle sub="Successfully delivered projects.">Completed</SectionTitle>
              <Card>
                {completedProjects.map(p => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${RULE}` }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: INK }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: MUTED }}>{p.projectType || ""}</div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#3B82F6", background: "#EFF6FF", padding: "2px 8px", borderRadius: 10 }}>DONE</span>
                  </div>
                ))}
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

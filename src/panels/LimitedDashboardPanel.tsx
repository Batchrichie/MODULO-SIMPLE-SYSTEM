import React, { useMemo } from "react";
import {
  LayoutDashboard, Briefcase, Banknote, FileText, Calendar,
  Clock, ArrowRight, CheckCircle2, AlertTriangle, TrendingUp,
  Users, Landmark,
} from "lucide-react";
import { INK, PAPER, PAPER_RAISED, RULE, GREEN, GREEN_DEEP, GOLD, ALERT, MUTED,
         FONT_DISPLAY, FONT_BODY, FONT_MONO } from "../../theme/tokens";
import Card from "../../components/ui/Card";
import SectionTitle from "../../components/ui/SectionTitle";
import Th from "../../components/ui/Th";
import Td from "../../components/ui/Td";
import TableScroll from "../../components/ui/TableScroll";
import { fmt } from "../../utils/format";
import type { AppData, UserProfile } from "../../types";

interface LimitedDashboardPanelProps {
  data: AppData;
  profile: UserProfile;
  setTab: (tab: string) => void;
}

export default function LimitedDashboardPanel({ data, profile, setTab }: LimitedDashboardPanelProps) {
  const employee = useMemo(
    () => data.employees.find(e => e.id === profile.employeeId),
    [data.employees, profile.employeeId]
  );

  // Latest payslip for this employee
  const latestPayslip = useMemo(() => {
    let found: { period: string; gross: number; net: number; ssnitEmployee: number; paye: number } | null = null;
    for (let i = data.payrollRuns.length - 1; i >= 0; i--) {
      const run = data.payrollRuns[i];
      const match = run.rows.find(r => r.employeeId === profile.employeeId);
      if (match) {
        found = { period: run.period, gross: match.gross, net: match.net, ssnitEmployee: match.ssnitEmployee, paye: match.paye };
        break;
      }
    }
    return found;
  }, [data.payrollRuns, profile.employeeId]);

  // YTD totals
  const ytd = useMemo(() => {
    const currentYear = String(new Date().getFullYear());
    let gross = 0, net = 0, count = 0;
    data.payrollRuns.forEach(run => {
      if (!run.period.startsWith(currentYear)) return;
      const match = run.rows.find(r => r.employeeId === profile.employeeId);
      if (match) { gross += match.gross; net += match.net; count++; }
    });
    return { gross, net, count };
  }, [data.payrollRuns, profile.employeeId]);

  // Active projects (relevant for PM role)
  const activeProjects = useMemo(
    () => data.projects.filter(p => p.status === "Active" && p.id !== "GEN"),
    [data.projects]
  );

  // Upcoming deadlines (unpaid invoices on active projects)
  const upcomingDeadlines = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return data.invoices
      .filter(inv => inv.status !== "Void" && inv.status !== "Paid" && inv.dueDate && inv.dueDate >= today)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 5);
  }, [data.invoices]);

  // Count of active employees
  const activeEmployeeCount = useMemo(
    () => data.employees.filter(e => e.active).length,
    [data.employees]
  );

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const firstName = profile.employeeName.split(" ")[0];
  const positionLabel = profile.positionTitle || "Team Member";
  const todayStr = new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div>
      {/* Welcome Banner */}
      <div style={{
        background: `linear-gradient(135deg, ${GREEN_DEEP}, ${GREEN})`,
        borderRadius: 16, padding: "28px 32px", marginBottom: 24,
        color: "#fff", position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -20, right: -20, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
        <div style={{ position: "absolute", bottom: -40, right: 40, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 11, opacity: 0.8, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{todayStr}</div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{greeting()}, {firstName}</div>
          <div style={{ fontSize: 14, opacity: 0.85 }}>{positionLabel} · {data.companyName || "Modulo"}</div>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <Card style={{ flex: "1 1 180px", padding: "16px 20px", cursor: "pointer" }} onClick={() => setTab("my-payslips")}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--success-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Banknote size={18} style={{ color: GREEN }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>Last Net Pay</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 16, fontWeight: 700, color: INK }}>
                {latestPayslip ? `GHS ${fmt(latestPayslip.net)}` : "N/A"}
              </div>
            </div>
            <ArrowRight size={14} style={{ color: MUTED }} />
          </div>
          {latestPayslip && <div style={{ fontSize: 11, color: MUTED }}>Period: {latestPayslip.period}</div>}
        </Card>

        <Card style={{ flex: "1 1 180px", padding: "16px 20px", cursor: "pointer" }} onClick={() => setTab("my-statement")}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <TrendingUp size={18} style={{ color: "#3B82F6" }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>YTD Net Income</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 16, fontWeight: 700, color: INK }}>GHS {fmt(ytd.net)}</div>
            </div>
            <ArrowRight size={14} style={{ color: MUTED }} />
          </div>
          <div style={{ fontSize: 11, color: MUTED }}>{ytd.count} month{ytd.count !== 1 ? "s" : ""} processed this year</div>
        </Card>

        <Card style={{ flex: "1 1 180px", padding: "16px 20px", cursor: "pointer" }} onClick={() => setTab("pm-dashboard")}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "#FFFBEB", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Briefcase size={18} style={{ color: GOLD }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>Active Projects</div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 700, color: INK }}>{activeProjects.length}</div>
            </div>
            <ArrowRight size={14} style={{ color: MUTED }} />
          </div>
          <div style={{ fontSize: 11, color: MUTED }}>{activeEmployeeCount} team members</div>
        </Card>
      </div>

      <div className="grid-fin" style={{ marginBottom: 24 }}>
        {/* Latest Payslip Summary */}
        <div>
          <SectionTitle sub="Your most recent payslip at a glance.">
            Latest Payslip
          </SectionTitle>
          <Card>
            {latestPayslip ? (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16 }}>{latestPayslip.period}</div>
                    <div style={{ fontSize: 11, color: MUTED }}>Most recent payroll</div>
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: GREEN, background: "var(--success-bg)", padding: "3px 10px", borderRadius: 10 }}>PROCESSED</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${RULE}` }}>
                    <span style={{ color: MUTED, fontSize: 13 }}>Gross Pay</span>
                    <span style={{ fontFamily: FONT_MONO, fontWeight: 600 }}>GHS {fmt(latestPayslip.gross)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${RULE}` }}>
                    <span style={{ color: MUTED, fontSize: 13 }}>SSNIT Deduction</span>
                    <span style={{ fontFamily: FONT_MONO, fontWeight: 600, color: ALERT }}>- GHS {fmt(latestPayslip.ssnitEmployee)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${RULE}` }}>
                    <span style={{ color: MUTED, fontSize: 13 }}>PAYE</span>
                    <span style={{ fontFamily: FONT_MONO, fontWeight: 600, color: ALERT }}>- GHS {fmt(latestPayslip.paye)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", background: "var(--success-bg)", margin: "4px -20px 0", paddingLeft: 20, paddingRight: 20, borderRadius: "0 0 12px 12px" }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>Net Take-Home</span>
                    <span style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 16, color: GREEN }}>GHS {fmt(latestPayslip.net)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "24px 0", color: MUTED }}>
                <Banknote size={28} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
                <p style={{ margin: 0, fontSize: 13 }}>No payslip available yet.</p>
              </div>
            )}
          </Card>
        </div>

        {/* Quick Links / Navigation Cards */}
        <div>
          <SectionTitle sub="Quick access to your portal pages.">
            Quick Access
          </SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Card
              style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 14, padding: "14px 20px" }}
              onClick={() => setTab("my-payslips")}
            >
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--success-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Banknote size={20} style={{ color: GREEN }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>My Payslips</div>
                <div style={{ fontSize: 12, color: MUTED }}>View and download your payslip history</div>
              </div>
              <ArrowRight size={16} style={{ color: MUTED }} />
            </Card>

            <Card
              style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 14, padding: "14px 20px" }}
              onClick={() => setTab("my-statement")}
            >
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FileText size={20} style={{ color: "#3B82F6" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>My Statement</div>
                <div style={{ fontSize: 12, color: MUTED }}>Year-to-date earnings and tax summary</div>
              </div>
              <ArrowRight size={16} style={{ color: MUTED }} />
            </Card>

            <Card
              style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 14, padding: "14px 20px" }}
              onClick={() => setTab("pm-dashboard")}
            >
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#FFFBEB", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Briefcase size={20} style={{ color: GOLD }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>My Projects</div>
                <div style={{ fontSize: 12, color: MUTED }}>{activeProjects.length} active project{activeProjects.length !== 1 ? "s" : ""} with status updates</div>
              </div>
              <ArrowRight size={16} style={{ color: MUTED }} />
            </Card>
          </div>
        </div>
      </div>

      {/* Upcoming Deadlines (if any) */}
      {upcomingDeadlines.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <SectionTitle sub="Pending invoices approaching their due dates.">
            Upcoming Deadlines
          </SectionTitle>
          <Card>
            <TableScroll>
              <table className="table-card" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <Th>Invoice</Th>
                    <Th>Client</Th>
                    <Th right>Amount</Th>
                    <Th>Due Date</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingDeadlines.map(inv => {
                    const paid = inv.payments.reduce((s, p) => s + p.amountGHS, 0);
                    const balance = (inv.totals?.total_ghs ?? inv.totals?.grandTotalGHS ?? inv.totals?.total ?? inv.totals?.grandTotal ?? 0) - paid;
                    const daysUntilDue = Math.ceil((new Date(inv.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    return (
                      <tr key={inv.id} className="row-hover">
                        <Td label="Invoice" mono>{inv.invoiceNumber}</Td>
                        <Td label="Client">{inv.billTo}</Td>
                        <Td right mono label="Amount" bold>GHS {fmt(balance)}</Td>
                        <Td label="Due Date">
                          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <Calendar size={12} style={{ color: daysUntilDue <= 7 ? ALERT : MUTED }} />
                            {inv.dueDate}
                          </span>
                        </Td>
                        <Td label="Status">
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10,
                            color: daysUntilDue <= 7 ? ALERT : daysUntilDue <= 14 ? GOLD : GREEN,
                            background: daysUntilDue <= 7 ? "var(--alert-bg)" : daysUntilDue <= 14 ? "#FFFBEB" : "var(--success-bg)",
                          }}>
                            {daysUntilDue <= 0 ? "DUE" : `${daysUntilDue}d left`}
                          </span>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableScroll>
          </Card>
        </div>
      )}

      {/* Active Projects Summary */}
      {activeProjects.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <SectionTitle sub="Projects currently in progress." action={
            <span style={{ fontSize: 12, color: GREEN, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }} onClick={() => setTab("pm-dashboard")}>
              View all <ArrowRight size={12} />
            </span>
          }>
            Projects Overview
          </SectionTitle>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {activeProjects.slice(0, 4).map(p => {
              const contract = parseFloat(String(p.contractValue)) || 0;
              const est = parseFloat(String(p.estimatedCost)) || 0;
              const margin = contract > 0 ? ((contract - est) / contract * 100) : 0;
              return (
                <Card key={p.id} style={{ flex: "1 1 200px", borderLeft: `4px solid ${GREEN}` }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: MUTED, marginBottom: 8 }}>{p.projectType || ""}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <div>
                      <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase" }}>Contract</div>
                      <div style={{ fontFamily: FONT_MONO, fontWeight: 600 }}>GHS {fmt(contract)}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase" }}>Margin</div>
                      <div style={{ fontFamily: FONT_MONO, fontWeight: 600, color: margin >= 0 ? GREEN : ALERT }}>{margin.toFixed(1)}%</div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

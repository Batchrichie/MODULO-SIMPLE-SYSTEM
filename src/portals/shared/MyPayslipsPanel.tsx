import React, { useMemo, useState } from "react";
import {
  Banknote, Download, ChevronDown, ChevronUp, FileText, Calendar,
  CheckCircle2, AlertCircle,
} from "lucide-react";
import { INK, PAPER, PAPER_RAISED, RULE, GREEN, GREEN_DEEP, GOLD, ALERT, MUTED,
         FONT_DISPLAY, FONT_BODY, FONT_MONO } from "../../theme/tokens";
import Card from "../../components/ui/Card";
import SectionTitle from "../../components/ui/SectionTitle";
import TableScroll from "../../components/ui/TableScroll";
import Th from "../../components/ui/Th";
import Td from "../../components/ui/Td";
import Button from "../../components/ui/Button";
import { fmt } from "../../utils/format";
import type { AppData, UserProfile, PayrollRun, PayrollLine } from "../../types";

interface MyPayslipsPanelProps {
  data: AppData;
  profile: UserProfile;
}

interface PayslipRow extends PayrollLine {
  period: string;
  runId: string;
  entryNumber?: string | null;
  postedAt?: string | null;
  ssnitEmployer: number;
}

export default function MyPayslipsPanel({ data, profile }: MyPayslipsPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Extract this employee's payslips from all payroll runs
  const payslips = useMemo<PayslipRow[]>(() => {
    const rows: PayslipRow[] = [];
    data.payrollRuns.forEach(run => {
      const match = run.rows.find(r => r.employeeId === profile.employeeId);
      if (match) {
        rows.push({
          ...match,
          period: run.period,
          runId: run.id,
          entryNumber: run.entryNumber,
          postedAt: run.postedAt,
        });
      }
    });
    // Sort by period descending (most recent first)
    return rows.sort((a, b) => b.period.localeCompare(a.period));
  }, [data.payrollRuns, profile.employeeId]);

  // Summary totals across all payslips
  const totals = useMemo(() => {
    return payslips.reduce(
      (acc, p) => ({
        gross: acc.gross + p.gross,
        ssnitEmployee: acc.ssnitEmployee + p.ssnitEmployee,
        ssnitEmployer: acc.ssnitEmployer + p.ssnitEmployer,
        paye: acc.paye + p.paye,
        net: acc.net + p.net,
      }),
      { gross: 0, ssnitEmployee: 0, ssnitEmployer: 0, paye: 0, net: 0 }
    );
  }, [payslips]);

  // Find the employee record for additional details
  const employee = useMemo(
    () => data.employees.find(e => e.id === profile.employeeId),
    [data.employees, profile.employeeId]
  );

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <div>
      <SectionTitle sub={`Payslip history for ${profile.employeeName}.`}>My Payslips</SectionTitle>

      {/* Summary KPIs */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <Card style={{ flex: "1 1 180px", padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--success-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Banknote size={18} style={{ color: GREEN }} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>Total Net Paid</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 16, fontWeight: 700, color: INK }}>GHS {fmt(totals.net)}</div>
            </div>
          </div>
        </Card>

        <Card style={{ flex: "1 1 180px", padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FileText size={18} style={{ color: "#3B82F6" }} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>Total Gross</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 16, fontWeight: 700, color: INK }}>GHS {fmt(totals.gross)}</div>
            </div>
          </div>
        </Card>

        <Card style={{ flex: "1 1 180px", padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "#FFFBEB", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Calendar size={18} style={{ color: GOLD }} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>Payslips</div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 700, color: INK }}>{payslips.length}</div>
            </div>
          </div>
        </Card>

        <Card style={{ flex: "1 1 180px", padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--alert-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <AlertCircle size={18} style={{ color: ALERT }} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>Total Deductions</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 16, fontWeight: 700, color: ALERT }}>GHS {fmt(totals.ssnitEmployee + totals.paye)}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Employee Info Card */}
      {employee && (
        <Card style={{ marginBottom: 24, padding: "16px 20px" }}>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 13 }}>
            <div>
              <span style={{ color: MUTED, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 2 }}>Name</span>
              <span style={{ fontWeight: 600 }}>{employee.name}</span>
            </div>
            {employee.designation && (
              <div>
                <span style={{ color: MUTED, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 2 }}>Designation</span>
                <span>{employee.designation}</span>
              </div>
            )}
            {employee.ssnitNo && (
              <div>
                <span style={{ color: MUTED, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 2 }}>SSNIT No.</span>
                <span style={{ fontFamily: FONT_MONO }}>{employee.ssnitNo}</span>
              </div>
            )}
            <div>
              <span style={{ color: MUTED, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 2 }}>Base Salary</span>
              <span style={{ fontFamily: FONT_MONO, fontWeight: 600 }}>GHS {fmt(employee.baseSalary)}</span>
            </div>
          </div>
        </Card>
      )}

      {/* Payslip List */}
      <SectionTitle sub="All processed payroll periods. Tap to expand details.">
        Payslip History
      </SectionTitle>

      {payslips.length === 0 ? (
        <Card>
          <div style={{ textAlign: "center", padding: "32px 0", color: MUTED }}>
            <Banknote size={32} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
            <p style={{ margin: 0, fontSize: 14 }}>No payslips found for your account.</p>
            <p style={{ margin: "4px 0 0", fontSize: 12 }}>Payslips will appear here once payroll has been processed for your name.</p>
          </div>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {payslips.map((p) => {
            const isExpanded = expandedId === p.runId;
            const isPosted = !!p.postedAt;

            return (
              <Card key={p.runId} style={{ padding: 0, overflow: "hidden" }}>
                {/* Header Row */}
                <button
                  onClick={() => toggleExpand(p.runId)}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "14px 20px", border: "none", background: "transparent",
                    cursor: "pointer", width: "100%", textAlign: "left",
                    fontFamily: FONT_BODY, color: INK, transition: "background 0.15s ease",
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--nav-hover)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: isPosted ? GREEN : GOLD, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{p.period}</div>
                      <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                        {isPosted ? `Posted ${p.postedAt}` : "Not yet posted"}
                        {p.entryNumber && ` · ${p.entryNumber}`}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 15 }}>GHS {fmt(p.net)}</div>
                      <div style={{ fontSize: 10, color: MUTED }}>Net Pay</div>
                    </div>
                    {isExpanded ? <ChevronUp size={16} style={{ color: MUTED }} /> : <ChevronDown size={16} style={{ color: MUTED }} />}
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div style={{ borderTop: `1px solid ${RULE}`, padding: "16px 20px", background: "var(--paper)" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 16 }}>
                      <div style={{ padding: "12px 16px", background: PAPER_RAISED, borderRadius: 8, border: `1px solid ${RULE}` }}>
                        <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Gross Pay</div>
                        <div style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 16, color: INK }}>GHS {fmt(p.gross)}</div>
                      </div>
                      <div style={{ padding: "12px 16px", background: PAPER_RAISED, borderRadius: 8, border: `1px solid ${RULE}` }}>
                        <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>SSNIT (Employee)</div>
                        <div style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 16, color: ALERT }}>- GHS {fmt(p.ssnitEmployee)}</div>
                      </div>
                      <div style={{ padding: "12px 16px", background: PAPER_RAISED, borderRadius: 8, border: `1px solid ${RULE}` }}>
                        <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>PAYE</div>
                        <div style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 16, color: ALERT }}>- GHS {fmt(p.paye)}</div>
                      </div>
                      <div style={{ padding: "12px 16px", background: PAPER_RAISED, borderRadius: 8, border: `1px solid ${RULE}` }}>
                        <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>SSNIT (Employer)</div>
                        <div style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 16, color: MUTED }}>GHS {fmt(p.ssnitEmployer)}</div>
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: PAPER_RAISED, borderRadius: 8, border: `2px solid ${GREEN}` }}>
                      <div>
                        <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Total Deductions</div>
                        <div style={{ fontFamily: FONT_MONO, fontWeight: 600, fontSize: 14, color: ALERT }}>
                          - GHS {fmt(p.ssnitEmployee + p.paye)}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Net Take-Home</div>
                        <div style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 18, color: GREEN }}>
                          GHS {fmt(p.net)}
                        </div>
                      </div>
                    </div>

                    {/* Deduction breakdown bar */}
                    <div style={{ marginTop: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: MUTED, marginBottom: 4 }}>
                        <span>Deduction Breakdown</span>
                        <span>{p.gross > 0 ? (((p.ssnitEmployee + p.paye) / p.gross) * 100).toFixed(1) : 0}% of gross</span>
                      </div>
                      <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", border: `1px solid ${RULE}` }}>
                        {p.gross > 0 && (
                          <>
                            <div style={{ width: `${(p.ssnitEmployee / p.gross) * 100}%`, background: GOLD }} />
                            <div style={{ width: `${(p.paye / p.gross) * 100}%", background: ALERT }} />
                            <div style={{ flex: 1, background: GREEN }} />
                          </>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 10, color: MUTED }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: GOLD, display: "inline-block" }}></span> SSNIT</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: ALERT, display: "inline-block" }}></span> PAYE</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: GREEN, display: "inline-block" }}></span> Take-Home</span>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

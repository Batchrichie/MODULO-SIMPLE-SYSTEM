import React, { useMemo } from "react";
import {
  FileText, TrendingUp, TrendingDown, Wallet, PiggyBank,
  ArrowUpRight, ArrowDownRight, Calendar,
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

interface MyStatementPanelProps {
  data: AppData;
  profile: UserProfile;
}

export default function MyStatementPanel({ data, profile }: MyStatementPanelProps) {
  const currentYear = new Date().getFullYear();

  // Get this employee's payslips for the current year
  const yearPayslips = useMemo(() => {
    const rows: Array<{
      period: string;
      gross: number;
      ssnitEmployee: number;
      ssnitEmployer: number;
      paye: number;
      net: number;
      month: number;
    }> = [];
    data.payrollRuns.forEach(run => {
      // Filter by current year (period format: "YYYY-MM")
      if (!run.period.startsWith(String(currentYear))) return;
      const match = run.rows.find(r => r.employeeId === profile.employeeId);
      if (match) {
        rows.push({
          ...match,
          period: run.period,
          month: parseInt(run.period.split("-")[1], 10),
        });
      }
    });
    return rows.sort((a, b) => a.month - b.month);
  }, [data.payrollRuns, profile.employeeId, currentYear]);

  // All-time payslips for comparison
  const allTimePayslips = useMemo(() => {
    const rows: Array<{ period: string; gross: number; net: number; year: number }> = [];
    data.payrollRuns.forEach(run => {
      const match = run.rows.find(r => r.employeeId === profile.employeeId);
      if (match) {
        rows.push({
          period: run.period,
          gross: match.gross,
          net: match.net,
          year: parseInt(run.period.split("-")[0], 10),
        });
      }
    });
    return rows.sort((a, b) => a.period.localeCompare(b.period));
  }, [data.payrollRuns, profile.employeeId]);

  // YTD Totals
  const ytd = useMemo(() => {
    return yearPayslips.reduce(
      (acc, p) => ({
        gross: acc.gross + p.gross,
        ssnitEmployee: acc.ssnitEmployee + p.ssnitEmployee,
        ssnitEmployer: acc.ssnitEmployer + p.ssnitEmployer,
        paye: acc.paye + p.paye,
        net: acc.net + p.net,
      }),
      { gross: 0, ssnitEmployee: 0, ssnitEmployer: 0, paye: 0, net: 0 }
    );
  }, [yearPayslips]);

  // All-time totals
  const allTime = useMemo(() => {
    return allTimePayslips.reduce(
      (acc, p) => ({ gross: acc.gross + p.gross, net: acc.net + p.net }),
      { gross: 0, net: 0 }
    );
  }, [allTimePayslips]);

  // Effective tax rate
  const effectiveTaxRate = ytd.gross > 0 ? ((ytd.ssnitEmployee + ytd.paye) / ytd.gross) * 100 : 0;

  // Average monthly net
  const avgMonthlyNet = yearPayslips.length > 0 ? ytd.net / yearPayslips.length : 0;

  // Employer contribution total
  const employerContributions = ytd.ssnitEmployer;

  // Group all-time by year for yearly comparison
  const yearlySummary = useMemo(() => {
    const map: Record<number, { gross: number; net: number; count: number }> = {};
    allTimePayslips.forEach(p => {
      if (!map[p.year]) map[p.year] = { gross: 0, net: 0, count: 0 };
      map[p.year].gross += p.gross;
      map[p.year].net += p.net;
      map[p.year].count += 1;
    });
    return Object.entries(map)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([year, d]) => ({ year: parseInt(year), ...d }));
  }, [allTimePayslips]);

  // Employee details
  const employee = useMemo(
    () => data.employees.find(e => e.id === profile.employeeId),
    [data.employees, profile.employeeId]
  );

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <div>
      <SectionTitle sub={`Year-to-date earnings and deduction summary for ${currentYear}.`}>
        My Statement — {currentYear}
      </SectionTitle>

      {/* Employee Info */}
      {employee && (
        <Card style={{ marginBottom: 24, padding: "16px 20px" }}>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 13 }}>
            <div style={{ flex: "1 1 140px" }}>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Employee</div>
              <div style={{ fontWeight: 600 }}>{employee.name}</div>
            </div>
            {employee.designation && (
              <div style={{ flex: "1 1 140px" }}>
                <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Designation</div>
                <div>{employee.designation}</div>
              </div>
            )}
            {employee.ssnitNo && (
              <div style={{ flex: "1 1 140px" }}>
                <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>SSNIT No.</div>
                <div style={{ fontFamily: FONT_MONO }}>{employee.ssnitNo}</div>
              </div>
            )}
            <div style={{ flex: "1 1 140px" }}>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Base Salary (Monthly)</div>
              <div style={{ fontFamily: FONT_MONO, fontWeight: 600 }}>GHS {fmt(employee.baseSalary)}</div>
            </div>
          </div>
        </Card>
      )}

      {/* YTD Summary Cards */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <Card style={{ flex: "1 1 200px", padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--success-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <TrendingUp size={18} style={{ color: GREEN }} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>YTD Gross Income</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 18, fontWeight: 700, color: INK }}>GHS {fmt(ytd.gross)}</div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: MUTED }}>{yearPayslips.length} month{yearPayslips.length !== 1 ? "s" : ""} processed</div>
        </Card>

        <Card style={{ flex: "1 1 200px", padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--alert-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ArrowDownRight size={18} style={{ color: ALERT }} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>YTD Deductions</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 18, fontWeight: 700, color: ALERT }}>GHS {fmt(ytd.ssnitEmployee + ytd.paye)}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, fontSize: 11, color: MUTED }}>
            <span>SSNIT: GHS {fmt(ytd.ssnitEmployee)}</span>
            <span>PAYE: GHS {fmt(ytd.paye)}</span>
          </div>
        </Card>

        <Card style={{ flex: "1 1 200px", padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--success-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Wallet size={18} style={{ color: GREEN }} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>YTD Net Pay</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 18, fontWeight: 700, color: GREEN }}>GHS {fmt(ytd.net)}</div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: MUTED }}>Avg. monthly: GHS {fmt(avgMonthlyNet)}</div>
        </Card>

        <Card style={{ flex: "1 1 200px", padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "#FFFBEB", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <PiggyBank size={18} style={{ color: GOLD }} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>Employer SSNIT</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 18, fontWeight: 700, color: GOLD }}>GHS {fmt(employerContributions)}</div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: MUTED }}>Paid on your behalf to SSNIT</div>
        </Card>
      </div>

      {/* Effective Tax Rate + Take-Home Ratio */}
      <div style={{ marginBottom: 24 }}>
        <SectionTitle sub="Your effective tax rate and take-home percentage for {currentYear}.">
          Tax Summary
        </SectionTitle>
        <Card>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 16 }}>
            <div style={{ flex: "1 1 200px" }}>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Effective Deduction Rate</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 700, color: ALERT }}>{effectiveTaxRate.toFixed(1)}</span>
                <span style={{ fontSize: 16, color: MUTED }}>%</span>
              </div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>Of gross income goes to SSNIT + PAYE</div>
            </div>
            <div style={{ flex: "1 1 200px" }}>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Take-Home Ratio</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 700, color: GREEN }}>{(100 - effectiveTaxRate).toFixed(1)}</span>
                <span style={{ fontSize: 16, color: MUTED }}>%</span>
              </div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>Of gross income reaches your pocket</div>
            </div>
          </div>

          {/* Visual bar */}
          {ytd.gross > 0 && (
            <div>
              <div style={{ height: 12, borderRadius: 6, overflow: "hidden", display: "flex", border: `1px solid ${RULE}` }}>
                <div
                  style={{
                    width: `${effectiveTaxRate}%`,
                    background: `linear-gradient(90deg, ${ALERT}, ${GOLD})`,
                    transition: "width 0.3s ease",
                  }}
                />
                <div
                  style={{
                    flex: 1,
                    background: GREEN,
                    transition: "flex 0.3s ease",
                  }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: MUTED, marginTop: 4 }}>
                <span>Deductions: GHS {fmt(ytd.ssnitEmployee + ytd.paye)}</span>
                <span>Net: GHS {fmt(ytd.net)}</span>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Monthly Breakdown Table */}
      <div style={{ marginBottom: 24 }}>
        <SectionTitle sub="Month-by-month earnings and deductions for {currentYear}.">
          Monthly Breakdown
        </SectionTitle>
        <Card>
          {yearPayslips.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: MUTED }}>
              <Calendar size={32} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
              <p style={{ margin: 0, fontSize: 14 }}>No payroll has been processed for {currentYear} yet.</p>
            </div>
          ) : (
            <TableScroll>
              <table className="table-card" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <Th>Month</Th>
                    <Th right>Gross Pay</Th>
                    <Th right>SSNIT</Th>
                    <Th right>PAYE</Th>
                    <Th right>Total Ded.</Th>
                    <Th right>Net Pay</Th>
                  </tr>
                </thead>
                <tbody>
                  {yearPayslips.map((p) => {
                    const totalDed = p.ssnitEmployee + p.paye;
                    return (
                      <tr key={p.period} className="row-hover">
                        <Td label="Month" bold>{monthNames[p.month - 1]} {currentYear}</Td>
                        <Td right mono label="Gross Pay">GHS {fmt(p.gross)}</Td>
                        <Td right mono label="SSNIT" style={{ color: ALERT }}>- GHS {fmt(p.ssnitEmployee)}</Td>
                        <Td right mono label="PAYE" style={{ color: ALERT }}>- GHS {fmt(p.paye)}</Td>
                        <Td right mono label="Total Ded." bold style={{ color: ALERT }}>- GHS {fmt(totalDed)}</Td>
                        <Td right mono label="Net Pay" bold style={{ color: GREEN }}>GHS {fmt(p.net)}</Td>
                      </tr>
                    );
                  })}
                </tbody>
                {yearPayslips.length > 0 && (
                  <tfoot>
                    <tr style={{ borderTop: `2px solid ${RULE}`, background: "var(--paper)" }}>
                      <Td label="Total" bold>YTD Total</Td>
                      <Td right mono label="Gross Pay" bold>GHS {fmt(ytd.gross)}</Td>
                      <Td right mono label="SSNIT" bold style={{ color: ALERT }}>- GHS {fmt(ytd.ssnitEmployee)}</Td>
                      <Td right mono label="PAYE" bold style={{ color: ALERT }}>- GHS {fmt(ytd.paye)}</Td>
                      <Td right mono label="Total Ded." bold style={{ color: ALERT }}>- GHS {fmt(ytd.ssnitEmployee + ytd.paye)}</Td>
                      <Td right mono label="Net Pay" bold style={{ color: GREEN }}>GHS {fmt(ytd.net)}</Td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </TableScroll>
          )}
        </Card>
      </div>

      {/* Year-over-Year Comparison */}
      {yearlySummary.length > 1 && (
        <div>
          <SectionTitle sub="Compare your earnings across years.">
            Yearly Comparison
          </SectionTitle>
          <Card>
            <TableScroll>
              <table className="table-card" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <Th>Year</Th>
                    <Th right>Months</Th>
                    <Th right>Gross Income</Th>
                    <Th right>Net Pay</Th>
                    <Th right>Take-Home %</Th>
                  </tr>
                </thead>
                <tbody>
                  {yearlySummary.map(y => {
                    const pct = y.gross > 0 ? (y.net / y.gross) * 100 : 0;
                    return (
                      <tr key={y.year} className="row-hover">
                        <Td label="Year" bold style={{ color: y.year === currentYear ? GREEN : INK }}>
                          {y.year} {y.year === currentYear && "(current)"}
                        </Td>
                        <Td right label="Months">{y.count}</Td>
                        <Td right mono label="Gross">GHS {fmt(y.gross)}</Td>
                        <Td right mono label="Net" bold>GHS {fmt(y.net)}</Td>
                        <Td right label="Take-Home" style={{ color: pct >= 70 ? GREEN : GOLD, fontWeight: 600 }}>{pct.toFixed(1)}%</Td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: `2px solid ${RULE}`, background: "var(--paper)" }}>
                    <Td label="Total" bold>All Time</Td>
                    <Td right label="Months" bold>{allTimePayslips.length}</Td>
                    <Td right mono label="Gross" bold>GHS {fmt(allTime.gross)}</Td>
                    <Td right mono label="Net" bold style={{ color: GREEN }}>GHS {fmt(allTime.net)}</Td>
                    <Td right label="Take-Home" bold style={{ color: allTime.gross > 0 ? GREEN : MUTED }}>
                      {allTime.gross > 0 ? ((allTime.net / allTime.gross) * 100).toFixed(1) : 0}%
                    </Td>
                  </tr>
                </tfoot>
              </table>
            </TableScroll>
          </Card>
        </div>
      )}
    </div>
  );
}

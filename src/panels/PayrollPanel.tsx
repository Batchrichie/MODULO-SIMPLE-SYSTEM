import React, { useEffect, useState } from "react";
import { Banknote, Printer, Settings2 } from "lucide-react";
import { INK, RULE, GREEN, ALERT, MUTED, FONT_DISPLAY, FONT_BODY, FONT_MONO } from "../theme/tokens";
import Card from "../components/ui/Card";
import SectionTitle from "../components/ui/SectionTitle";
import TableScroll from "../components/ui/TableScroll";
import Th from "../components/ui/Th";
import Td from "../components/ui/Td";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import { inputStyle, labelStyle } from "../components/ui/styles";
import { fmt } from "../utils/format";
import Payslip from "../documents/Payslip";
import { findPeriodByDate, loadPayrollTaxConfiguration, runPayrollAndFetch, fetchPayslip } from "../supabaseClient";
import type { AppData, PayrollPanelProps } from "../types";

function payrollErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const message = raw.toLowerCase();
  if (message.includes("already been posted") || message.includes("duplicate")) return "Payroll for this period has already been posted.";
  if (message.includes("closed period") || message.includes("period is closed")) return "Payroll cannot be posted because the accounting period is closed.";
  if (message.includes("future period") || message.includes("not opened") || message.includes("not open")) return "Payroll cannot be posted because this accounting period has not opened yet.";
  if (message.includes("tax") || message.includes("paye_brackets") || message.includes("pension rate") || message.includes("app_tax_rates")) return "Payroll cannot be processed because the payroll tax configuration is incomplete.";
  if (message.includes("employee") || message.includes("salary") || message.includes("no active employees")) return "Payroll cannot be processed because one or more employees have invalid payroll information.";
  if (message.includes("results_unavailable")) return "Payroll may have posted, but the run or journal could not be verified. Refresh payroll history before trying again.";
  return "Payroll could not be processed. Check the payroll setup or contact an administrator.";
}

function payrollMoney(value: number | null | undefined): string {
  return value == null || !Number.isFinite(Number(value)) ? "—" : `GHS ${fmt(Number(value))}`;
}

function postedDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function PayrollPanel({ data, mutate, setPrintContent }: PayrollPanelProps) {
  const now = new Date();
  const [period, setPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [posting, setPosting] = useState(false);
  const [postStatus, setPostStatus] = useState<"draft" | "processing" | "posted" | "failed">("draft");
  const [postError, setPostError] = useState("");
  const [postMessage, setPostMessage] = useState("");
  const [showTaxModal, setShowTaxModal] = useState(false);
  const [payrollTaxConfig, setPayrollTaxConfig] = useState<Awaited<ReturnType<typeof loadPayrollTaxConfiguration>> | null>(null);
  const [taxConfigLoading, setTaxConfigLoading] = useState(true);
  const [taxConfigError, setTaxConfigError] = useState("");
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null);
  const [payslipError, setPayslipError] = useState("");

  async function refreshPayrollTaxConfiguration() {
    setTaxConfigLoading(true);
    setTaxConfigError("");
    try {
      setPayrollTaxConfig(await loadPayrollTaxConfiguration());
    } catch (err) {
      console.error("Failed to load payroll tax configuration:", err);
      setTaxConfigError("Unable to read payroll tax configuration from the database.");
    } finally { setTaxConfigLoading(false); }
  }

  function openTaxSettings() {
    setShowTaxModal(true);
  }

  useEffect(() => {
    let active = true;
    loadPayrollTaxConfiguration().then((config) => {
      if (active) setPayrollTaxConfig(config);
    }).catch((error) => {
      console.error("Failed to load payroll tax configuration:", error);
      if (active) setTaxConfigError("Unable to read payroll tax configuration from the database.");
    }).finally(() => {
      if (active) setTaxConfigLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function handlePostPayroll() {
    if (!period) return;
    if (data.payrollRuns.some((r) => r.period === period)) {
      setPostStatus("posted");
      setPostError("Payroll for this period has already been posted.");
      return;
    }
    if (period > `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`) {
      setPostStatus("failed");
      setPostError("Payroll cannot be posted because this accounting period has not opened yet.");
      return;
    }
    const accountingPeriod = findPeriodByDate(data.accountingPeriods, `${period}-01`);
    if (accountingPeriod?.status === "closed") {
      setPostStatus("failed");
      setPostError("Payroll cannot be posted because the accounting period is closed.");
      return;
    }
    if (accountingPeriod?.status === "future" || accountingPeriod?.status === "not_open") {
      setPostStatus("failed");
      setPostError("Payroll cannot be posted because this accounting period has not opened yet.");
      return;
    }
    if (taxConfigLoading) {
      setPostStatus("failed");
      setPostError("Payroll tax configuration is still loading. Try again shortly.");
      return;
    }
    if (taxConfigError || !payrollTaxConfig || payrollTaxConfig.employeeTier1Rate == null || payrollTaxConfig.employeeTier2Rate == null || payrollTaxConfig.employerSsnitRate == null || payrollTaxConfig.brackets.length === 0) {
      setPostStatus("failed");
      setPostError("Payroll cannot be processed because the payroll tax configuration is incomplete.");
      return;
    }
    const activeEmployees = data.employees.filter((employee) => employee.active);
    const invalidEmployees = activeEmployees.filter((employee) =>
      !Number.isFinite(Number(employee.baseSalary)) || Number(employee.baseSalary) <= 0
    );
    if (activeEmployees.length === 0 || invalidEmployees.length > 0) {
      setPostStatus("failed");
      setPostError(activeEmployees.length === 0
        ? "Payroll cannot be processed because there are no active employees."
        : `Payroll cannot be processed because these active employees need a valid base salary: ${invalidEmployees.map((employee) => employee.name).join(", ")}.`);
      return;
    }
    setPosting(true);
    setPostStatus("processing");
    setPostError("");
    setPostMessage("");
    try {
      const { run, journalEntry } = await runPayrollAndFetch(period);
      if (run.period !== period || run.rows.length === 0 || journalEntry.lines.length === 0) {
        throw new Error("PAYROLL_RESULTS_UNAVAILABLE");
      }
      mutate((d) => ({
        ...d,
        payrollRuns: [run, ...d.payrollRuns.filter((existing) => existing.period !== run.period)],
        journal: [journalEntry, ...d.journal.filter((entry) => entry.id !== journalEntry.id)],
      }));
      setPostStatus("posted");
      setPostMessage(`Payroll posted for ${run.period}. Journal entry ${journalEntry.entryNumber} was loaded from the database.`);
    } catch (err) {
      console.error("Failed to post payroll:", err);
      setPostStatus("failed");
      setPostError(payrollErrorMessage(err));
    } finally { setPosting(false); }
  }

  async function printPayslip(run, row) {
    setPayslipError("");
    try {
      const payslip = await fetchPayslip(run.id, row.employeeId);
      if (!payslip) {
        setPayslipError("Payslip not available.");
        return;
      }
      document.title = `Payslip_${payslip.employee.name.replace(/\s+/g, "_")}_${payslip.period}`;
      setPrintContent(<div><Payslip key={row.employeeId} data={data} payslip={payslip} /></div>);
    } catch (err) {
      console.error("Failed to fetch payslip:", err);
      setPayslipError("Payslip not available.");
    }
  }

  async function printAllPayslips(run) {
    setPayslipError("");
    try {
      const slips = await Promise.all(run.rows.map(async (row) => ({
        employeeId: row.employeeId,
        payslip: await fetchPayslip(run.id, row.employeeId),
      })));
      document.title = `Payslips_${run.period}`;
      setPrintContent(<div>{slips.map(({ employeeId, payslip }) => (
        <Payslip key={employeeId} data={data} payslip={payslip} />
      ))}</div>);
    } catch (err) {
      console.error("Failed to fetch payslips:", err);
      setPayslipError("Payslip not available.");
    }
  }

  const alreadyPosted = data.payrollRuns.some((r) => r.period === period);
  const selectedPeriodStatus = alreadyPosted ? "posted" : posting ? "processing" : postStatus;

  return (
    <div>
      <SectionTitle sub="Bracket-based PAYE, plus SSNIT employee and employer contributions. Payslips match your standard format.">
        Payroll
      </SectionTitle>
      {payslipError && <div role="alert" style={{ color: ALERT, marginBottom: 12 }}>{payslipError}</div>}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 150px" }}>
            <label style={labelStyle}>Period</label>
            <input type="month" style={inputStyle} value={period} onChange={(e) => {
              setPeriod(e.target.value);
              setPostError("");
              setPostMessage("");
              setPostStatus(data.payrollRuns.some((run) => run.period === e.target.value) ? "posted" : "draft");
            }} />
          </div>
          <div role="status" style={{ flex: "1 1 150px", color: selectedPeriodStatus === "failed" ? ALERT : selectedPeriodStatus === "posted" ? GREEN : MUTED, fontFamily: FONT_BODY, fontSize: 13, paddingBottom: 8 }}>
            Status: <b>{selectedPeriodStatus.charAt(0).toUpperCase() + selectedPeriodStatus.slice(1)}</b>
          </div>
          {mutate && (
            <>
              <Button onClick={handlePostPayroll} icon={Banknote} disabled={posting || alreadyPosted || !period}>
                {posting ? "Posting..." : alreadyPosted ? "Already Posted" : "Run & Post Payroll"}
              </Button>
              <Button variant="ghost" onClick={openTaxSettings} icon={Settings2}>
                Tax settings
              </Button>
            </>
          )}
          {alreadyPosted && (
            <span style={{ color: MUTED, fontFamily: FONT_BODY, fontSize: 13 }}>Already posted for this period.</span>
          )}
          {postError && (
            <span style={{ color: ALERT, fontFamily: FONT_BODY, fontSize: 13 }}>{postError}</span>
          )}
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: MUTED, lineHeight: 1.5 }}>
          Payroll amounts are calculated and posted by the database. This backend currently does not expose a pre-post preview; posted figures appear after the run and journal have both been retrieved.
        </div>
        {postMessage && <div role="status" style={{ color: GREEN, marginTop: 10, fontSize: 12.5 }}>{postMessage}</div>}
      </Card>

      <SectionTitle>Past payroll runs</SectionTitle>
      <Card>
        {data.payrollRuns.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.3 }}><Banknote size={28} style={{ margin: '0 auto', display: 'block' }} /></div>
            <p style={{ fontFamily: FONT_BODY, color: MUTED, fontSize: 13.5 }}>
              No payroll posted yet. Select a period above and click <b>Run & Post Payroll</b>.
            </p>
          </div>
        )}
        <div style={{ display: "grid", gap: 12 }}>
          {data.payrollRuns.map((run) => {
            const isOpen = expandedPeriod === run.period;
            const totals = run.rows.reduce((sum, row) => ({
              gross: sum.gross + (Number(row.gross) || 0),
              ssnitEmployee: sum.ssnitEmployee + (Number(row.ssnitEmployee) || 0),
              tier1: sum.tier1 + (Number(row.ssnitTier1) || 0),
              tier2: sum.tier2 + (Number(row.ssnitTier2) || 0),
              paye: sum.paye + (Number(row.paye) || 0),
              employer: sum.employer + (Number(row.ssnitEmployer) || 0),
              net: sum.net + (Number(row.net) || 0),
            }), { gross: 0, ssnitEmployee: 0, tier1: 0, tier2: 0, paye: 0, employer: 0, net: 0 });
            const journalEntry = data.journal.find((entry) =>
              entry.id === (run.entryNumber || `JE-PAY-${run.period}`) || entry.entryNumber === run.entryNumber
            );
            return (
              <div
                key={run.id}
                style={{
                  border: "1px solid var(--rule, #DCD5C4)",
                  borderRadius: 12,
                  background: "var(--paper-raised, #FFFFFF)",
                  overflow: "hidden",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setExpandedPeriod(isOpen ? null : run.period)}
                  style={{
                    width: "100%",
                    border: "none",
                    background: isOpen ? "var(--nav-active, rgba(212,175,55,0.08))" : "transparent",
                    padding: "16px 18px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    cursor: "pointer",
                    textAlign: "left",
                    color: "var(--ink, #1F2A24)",
                    fontFamily: FONT_BODY,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        width: 38,
                        height: 48,
                        borderRadius: 8,
                        background: "linear-gradient(180deg, rgba(212,175,55,0.18), rgba(212,175,55,0.08))",
                        border: "1px solid var(--gold, #A8761A)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--ink, #1F2A24)",
                        fontWeight: 700,
                        flexShrink: 0,
                        fontSize: 12,
                      }}
                    >
                      PDF
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, lineHeight: 1.2, color: "var(--ink, #1F2A24)" }}>{run.period}</div>
                      <div style={{ fontSize: 12, color: "var(--muted, #6B6255)", marginTop: 4 }}>
                        {postedDate(run.postedAt)} · {run.rows.length} employee{run.rows.length === 1 ? "" : "s"}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <span style={{ color: GREEN, fontSize: 11, fontWeight: 700 }}>Posted</span>
                    <Button variant="ghost" icon={Printer} onClick={(e) => { e.stopPropagation(); printAllPayslips(run); }}>
                      Print all
                    </Button>
                    <span style={{ fontSize: 18, color: "var(--muted, #6B6255)", lineHeight: 1 }}>{isOpen ? "▾" : "▸"}</span>
                  </div>
                </button>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(115px, 1fr))", gap: 8, padding: "0 16px 14px" }}>
                  {[
                    ["Gross payroll", totals.gross],
                    ["PAYE", totals.paye],
                    ["Employee pension", totals.ssnitEmployee],
                    ["Tier 1", totals.tier1],
                    ["Tier 2", totals.tier2],
                    ["Employer SSNIT", totals.employer],
                    ["Net payroll", totals.net],
                  ].map(([label, value]) => (
                    <div key={String(label)} style={{ borderTop: `1px solid ${RULE}`, paddingTop: 8 }}>
                      <div style={{ fontSize: 10, color: MUTED }}>{label}</div>
                      <div style={{ fontFamily: FONT_MONO, fontSize: 11, fontWeight: 600, color: INK }}>{payrollMoney(Number(value))}</div>
                    </div>
                  ))}
                </div>

                {isOpen && (
                  <div style={{ padding: "0 16px 16px" }}>
                    <div style={{ margin: "0 0 10px", fontSize: 12, color: MUTED }}>
                      Accounting journal: {journalEntry ? `${journalEntry.entryNumber} · ${postedDate(journalEntry.date)}` : "Journal entry not found in loaded database history."}
                    </div>
                    {journalEntry && (
                      <TableScroll>
                        <table className="table-card" style={{ width: "100%", borderCollapse: "collapse", marginBottom: 14 }}>
                          <thead><tr><Th>Account</Th><Th right>Debit</Th><Th right>Credit</Th></tr></thead>
                          <tbody>{journalEntry.lines.map((line, index) => {
                            const account = data.accounts.find((item) => item.code === line.account);
                            return <tr key={`${line.account}-${index}`}>
                              <Td label="Account">{line.account} · {account?.name || "—"}</Td>
                              <Td right mono label="Debit">{payrollMoney(line.debit)}</Td>
                              <Td right mono label="Credit">{payrollMoney(line.credit)}</Td>
                            </tr>;
                          })}</tbody>
                        </table>
                      </TableScroll>
                    )}
                    <TableScroll>
                      <table className="table-card" style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr><Th>Employee</Th><Th right>Gross</Th><Th right>Tier 1</Th><Th right>Tier 2</Th><Th right>PAYE</Th><Th right>Net Pay</Th><Th right>&nbsp;</Th></tr>
                        </thead>
                        <tbody>
                          {run.rows.map((r) => (
                            <tr key={r.employeeId} className="row-hover">
                              <Td label="Employee">{r.name}</Td>
                              <Td right mono label="Gross">{payrollMoney(r.gross)}</Td>
                              <Td right mono label="Tier 1">{payrollMoney(r.ssnitTier1)}</Td>
                              <Td right mono label="Tier 2">{payrollMoney(r.ssnitTier2)}</Td>
                              <Td right mono label="PAYE">{payrollMoney(r.paye)}</Td>
                              <Td right mono label="Net Pay">{payrollMoney(r.net)}</Td>
                              <Td right><Button variant="ghost" icon={Printer} onClick={() => printPayslip(run, r)}>Print</Button></Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </TableScroll>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Tax Settings Modal */}
      {showTaxModal && (
        <Modal title="Payroll tax configuration" sub="Read-only values currently used by the database payroll calculation." onClose={() => setShowTaxModal(false)} wide>
          <div style={{ display: "grid", gap: 16 }}>
            {taxConfigLoading && <div style={{ color: MUTED }}>Loading payroll tax configuration…</div>}
            {taxConfigError && (
              <div role="alert" style={{ color: ALERT, display: "flex", alignItems: "center", gap: 12 }}>
                <span>{taxConfigError}</span>
                <Button variant="ghost" onClick={refreshPayrollTaxConfiguration} disabled={taxConfigLoading}>Retry</Button>
              </div>
            )}
            {payrollTaxConfig && !taxConfigLoading && (
              <>
                <div style={{ fontSize: 13, color: MUTED }}>
                  Effective date: <b style={{ color: INK }}>{payrollTaxConfig.effectiveDate || "Not provided by the database"}</b>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                  <div><div style={{ color: MUTED, fontSize: 11 }}>Employee SSNIT Tier 1</div><b>{payrollTaxConfig.employeeTier1Rate == null ? "—" : `${(payrollTaxConfig.employeeTier1Rate * 100).toFixed(2)}%`}</b></div>
                  <div><div style={{ color: MUTED, fontSize: 11 }}>Employee SSNIT Tier 2</div><b>{payrollTaxConfig.employeeTier2Rate == null ? "—" : `${(payrollTaxConfig.employeeTier2Rate * 100).toFixed(2)}%`}</b></div>
                  <div><div style={{ color: MUTED, fontSize: 11 }}>Employer SSNIT</div><b>{payrollTaxConfig.employerSsnitRate == null ? "—" : `${(payrollTaxConfig.employerSsnitRate * 100).toFixed(2)}%`}</b></div>
                </div>
                <div>
                  <h4 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: INK, margin: "0 0 8px" }}>PAYE brackets</h4>
                  {payrollTaxConfig.brackets.length === 0 ? <div style={{ color: MUTED }}>No PAYE brackets were returned.</div> : (
                    <TableScroll>
                      <table className="table-card" style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead><tr><Th>Up to (GHS)</Th><Th right>Rate</Th></tr></thead>
                        <tbody>{payrollTaxConfig.brackets.map((bracket, index) => (
                          <tr key={`${bracket.upto}-${index}`}>
                            <Td mono label="Up to">{Number.isFinite(bracket.upto) ? fmt(bracket.upto) : "No upper limit"}</Td>
                            <Td right mono label="Rate">{(bracket.rate * 100).toFixed(2)}%</Td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </TableScroll>
                  )}
                </div>
                <p style={{ margin: 0, color: MUTED, fontSize: 12, lineHeight: 1.5 }}>
                  This frontend has no verified payroll-tax write RPC. Configuration changes must be made through the approved database workflow.
                </p>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
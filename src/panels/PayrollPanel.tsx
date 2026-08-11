import React, { useState } from "react";
import { Trash2, Banknote, Printer, Check, Settings2, Plus } from "lucide-react";
import { INK, PAPER, PAPER_RAISED, RULE, GREEN, GOLD, ALERT, MUTED, FONT_DISPLAY, FONT_BODY, FONT_MONO } from "../theme/tokens";
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
import { saveTaxRates, savePayeBrackets, runPayrollAndFetch } from "../supabaseClient";
import type { AppData, PayrollPanelProps } from "../types";

export default function PayrollPanel({ data, mutate, setPrintContent }: PayrollPanelProps) {
  const now = new Date();
  const [period, setPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState("");
  const [showTaxModal, setShowTaxModal] = useState(false);
  const [savingTaxSettings, setSavingTaxSettings] = useState(false);
  const [taxSaveMessage, setTaxSaveMessage] = useState("");
  const [taxSaveError, setTaxSaveError] = useState("");

  function updateTaxRate(field, value) {
    const percent = Number(value);
    mutate((prev) => ({ ...prev, [field]: isNaN(percent) ? 0 : percent / 100 }));
  }

  function updateBracket(index, field, value) {
    mutate((prev) => {
      const brackets = [...(prev.brackets || [])];
      const current = brackets[index] || { upto: 0, rate: 0 };
      const next = { ...current };
      if (field === "rate") {
        const parsed = Number(value);
        next.rate = isNaN(parsed) ? 0 : parsed / 100;
      } else {
        const raw = String(value).trim();
        next.upto = raw.toLowerCase() === "infinity" ? Infinity : Number(raw);
        if (isNaN(next.upto)) next.upto = current.upto;
      }
      brackets[index] = next;
      return { ...prev, brackets };
    });
  }

  function addBracket() {
    mutate((prev) => {
      const brackets = [...(prev.brackets || [])];
      const existingUptos = brackets.filter((b) => b.upto !== Infinity).map((b) => Number(b.upto) || 0);
      const highestUpto = existingUptos.length > 0 ? Math.max(...existingUptos) : 0;
      const nextUpto = Math.max(1000, highestUpto + 1);
      const infinityIndex = brackets.findIndex((b) => b.upto === Infinity);
      const newBracket = { upto: nextUpto, rate: 0.1 };
      if (infinityIndex === -1) brackets.push(newBracket);
      else brackets.splice(infinityIndex, 0, newBracket);
      return { ...prev, brackets };
    });
  }

  function removeBracket(index) {
    mutate((prev) => ({ ...prev, brackets: (prev.brackets || []).filter((_, i) => i !== index) }));
  }

  async function saveTaxSettings() {
    setSavingTaxSettings(true);
    setTaxSaveMessage("");
    setTaxSaveError("");
    try {
      await saveTaxRates({ ssnitEmployeeRate: data.ssnitEmployeeRate, ssnitEmployerRate: data.ssnitEmployerRate, nhilGetfundRate: data.nhilGetfundRate, vatRate: data.vatRate });
      await savePayeBrackets(data.brackets);
      setTaxSaveMessage("Tax settings saved to the database.");
    } catch (err) {
      console.error("Failed to save tax settings:", err);
      setTaxSaveError("Unable to persist tax settings. Try again.");
    } finally { setSavingTaxSettings(false); }
  }

  async function handlePostPayroll() {
    if (!period) return;
    if (data.payrollRuns.some((r) => r.period === period)) { setPostError("Payroll for this period has already been posted."); return; }
    setPosting(true);
    setPostError("");
    try {
      const { run, journalEntry } = await runPayrollAndFetch(period);
      mutate((d) => ({ ...d, payrollRuns: [run, ...d.payrollRuns], journal: [journalEntry, ...d.journal] }));
    } catch (err) {
      console.error("Failed to post payroll:", err);
      setPostError(err?.message || "Failed to post payroll. Check console for details.");
    } finally { setPosting(false); }
  }

  function printPayslip(run, row) {
    const empName = row.name.replace(/\s+/g, "_");
    document.title = `Payslip_${empName}_${run.period}`;
    setPrintContent(<div><Payslip key={row.employeeId} data={data} run={run} r={row} /></div>);
    setTimeout(() => { window.print(); document.title = "Modulo Ledger"; }, 100);
  }

  function printAllPayslips(run) {
    document.title = `Payslips_${run.period}`;
    setPrintContent(<div>{run.rows.map((r) => <Payslip key={r.employeeId} data={data} run={run} r={r} />)}</div>);
    setTimeout(() => { window.print(); document.title = "Modulo Ledger"; }, 100);
  }

  const alreadyPosted = data.payrollRuns.some((r) => r.period === period);

  return (
    <div>
      <SectionTitle sub="Bracket-based PAYE, plus SSNIT employee and employer contributions. Payslips match your standard format.">
        Payroll
      </SectionTitle>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 150px" }}>
            <label style={labelStyle}>Period</label>
            <input type="month" style={inputStyle} value={period} onChange={(e) => { setPeriod(e.target.value); setPostError(""); }} />
          </div>
          {mutate && (
            <>
              <Button onClick={handlePostPayroll} icon={Banknote} disabled={posting || alreadyPosted || !period}>
                {posting ? "Posting..." : alreadyPosted ? "Already Posted" : "Run & Post Payroll"}
              </Button>
              <Button variant="ghost" onClick={() => setShowTaxModal(true)} icon={Settings2}>
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
        {data.payrollRuns.map((run) => (
          <div key={run.id} style={{ marginBottom: 24, paddingBottom: 24, borderBottom: `1px solid ${RULE}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, color: INK, fontSize: 16 }}>{run.period}</span>
              <Button variant="ghost" icon={Printer} onClick={() => printAllPayslips(run)}>Print all payslips</Button>
            </div>
            <TableScroll>
              <table className="table-card" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr><Th>Employee</Th><Th right>Net Pay</Th><Th right>&nbsp;</Th></tr>
                </thead>
                <tbody>
                  {run.rows.map((r) => (
                    <tr key={r.employeeId} className="row-hover">
                      <Td label="Employee">{r.name}</Td>
                      <Td right mono label="Net Pay">GHS {fmt(r.net)}</Td>
                      <Td right><Button variant="ghost" icon={Printer} onClick={() => printPayslip(run, r)}>Print</Button></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </div>
        ))}
      </Card>

      {/* Tax Settings Modal */}
      {showTaxModal && (
        <Modal title="Tax Settings" sub="Configure PAYE brackets, SSNIT rates, NHIL/GETFund, and VAT." onClose={() => { setShowTaxModal(false); setTaxSaveMessage(""); setTaxSaveError(""); }} wide>
          <div style={{ display: 'grid', gap: 16 }}>
            <p style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: MUTED, margin: 0 }}>
              Monthly PAYE bands (GHS) — estimated from 2026 GRA annual bands.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <div>
                <label style={labelStyle}>SSNIT employee rate (%)</label>
                <input style={inputStyle} type="number" step="0.1" min="0" value={(data.ssnitEmployeeRate * 100).toFixed(2)} onChange={(e) => updateTaxRate("ssnitEmployeeRate", e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>SSNIT employer rate (%)</label>
                <input style={inputStyle} type="number" step="0.1" min="0" value={(data.ssnitEmployerRate * 100).toFixed(2)} onChange={(e) => updateTaxRate("ssnitEmployerRate", e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>NHIL / GETFund rate (%)</label>
                <input style={inputStyle} type="number" step="0.1" min="0" value={(data.nhilGetfundRate * 100).toFixed(2)} onChange={(e) => updateTaxRate("nhilGetfundRate", e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>VAT rate (%)</label>
                <input style={inputStyle} type="number" step="0.1" min="0" value={(data.vatRate * 100).toFixed(2)} onChange={(e) => updateTaxRate("vatRate", e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <h4 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: INK, margin: 0 }}>PAYE Brackets</h4>
              <Button onClick={addBracket} icon={Plus} variant="ghost">Add bracket</Button>
            </div>

            <TableScroll>
              <table className="table-card" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr><Th>Up to (GHS)</Th><Th right>Rate (%)</Th><Th right>Actions</Th></tr>
                </thead>
                <tbody>
                  {data.brackets.map((b, i) => (
                    <tr key={i} className="row-hover">
                      <Td mono label="Up to (GHS)">
                        <input style={{ ...inputStyle, width: "100%" }} type="text" value={b.upto === Infinity ? "Infinity" : b.upto} onChange={(e) => updateBracket(i, "upto", e.target.value)} />
                      </Td>
                      <Td right mono label="Rate">
                        <input style={{ ...inputStyle, width: "100%" }} type="number" step="0.1" min="0" value={(b.rate * 100).toFixed(2)} onChange={(e) => updateBracket(i, "rate", e.target.value)} />
                      </Td>
                      <Td right mono>
                        <Button variant="ghost" onClick={() => removeBracket(i)} icon={Trash2} disabled={b.upto === Infinity}>Remove</Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', paddingTop: 8, borderTop: `1px solid ${RULE}` }}>
              <Button onClick={saveTaxSettings} icon={Check} disabled={savingTaxSettings}>
                {savingTaxSettings ? "Saving..." : "Save tax settings"}
              </Button>
              {taxSaveMessage && <span style={{ color: GREEN, fontFamily: FONT_BODY, fontSize: 13 }}>{taxSaveMessage}</span>}
              {taxSaveError && <span style={{ color: ALERT, fontFamily: FONT_BODY, fontSize: 13 }}>{taxSaveError}</span>}
            </div>

            <div style={{ display: 'flex', gap: 20, fontFamily: FONT_BODY, fontSize: 13, flexWrap: 'wrap', color: MUTED }}>
              <span>SSNIT employee (Tier 1+2): <b style={{ color: INK }}>{(data.ssnitEmployeeRate * 100).toFixed(1)}%</b></span>
              <span>SSNIT employer (Tier 1): <b style={{ color: INK }}>{(data.ssnitEmployerRate * 100).toFixed(1)}%</b></span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
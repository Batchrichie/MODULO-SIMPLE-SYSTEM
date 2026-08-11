import React from "react";
import { PageHeader, Footer, PrintPageWrapper, finStyles } from "./FinancialShared";
import { fmt } from "../utils/format";

interface TBRow { code: string; name: string; debit: number; credit: number; }

export default function TrialBalanceDocument({ company, genDate, tbData }: { company: any; genDate: string; tbData: TBRow[] }) {
  const tblWidth = "calc(100% - 64px)";
  const totalDebit = tbData.reduce((s, r) => s + (Number(r.debit) || 0), 0);
  const totalCredit = tbData.reduce((s, r) => s + (Number(r.credit) || 0), 0);

  return (
    <PrintPageWrapper>
      <div style={finStyles.pageWrap}>
        <PageHeader title="TRIAL BALANCE" subtitle={`As at ${genDate}`} company={company} />
        <table style={{ width: tblWidth, margin: "0 32px", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={finStyles.thBg}>Code</th>
            <th style={finStyles.thBg}>Account Name</th>
            <th style={{...finStyles.thBg, textAlign: "right"}}>Debit (GHS)</th>
            <th style={{...finStyles.thBg, textAlign: "right"}}>Credit (GHS)</th>
          </tr></thead>
          <tbody>
            {tbData.map((r, i) => (
              <tr key={i}>
                <td style={finStyles.td}>{r.code}</td>
                <td style={finStyles.td}>{r.name}</td>
                <td style={finStyles.tdR}>{r.debit > 0 ? fmt(r.debit) : "—"}</td>
                <td style={finStyles.tdR}>{r.credit > 0 ? fmt(r.credit) : "—"}</td>
              </tr>
            ))}
            <tr style={finStyles.grandRow}>
              <td style={{ padding: "12px 14px" }} colSpan={2}>TOTALS</td>
              <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: "'Courier New', Courier, monospace" }}>{fmt(totalDebit)}</td>
              <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: "'Courier New', Courier, monospace" }}>{fmt(totalCredit)}</td>
            </tr>
          </tbody>
        </table>
        <Footer company={company} />
      </div>
    </PrintPageWrapper>
  );
}
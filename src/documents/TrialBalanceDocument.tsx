import React from "react";
import { PageHeader, Footer, PrintPageWrapper, finStyles } from "./FinancialShared";
import { fmt } from "../utils/format";

interface TBRow { code: string; name: string; debit: number; credit: number; }

export default function TrialBalanceDocument({ company, genDate, tbData }: { company: any; genDate: string; tbData: TBRow[] }) {
  const tblWidth = "calc(100% - 64px)";

  // Trial Balance presentation uses the net balance per account.
  // Debit balance = total debits - total credits.
  // Credit balance = total credits - total debits.
  // Only the side with the resulting balance is displayed.
  const rows = tbData.map((r) => {
    const debit = Number(r.debit) || 0;
    const credit = Number(r.credit) || 0;
    const net = debit - credit;

    return {
      ...r,
      debitBalance: net > 0 ? net : 0,
      creditBalance: net < 0 ? Math.abs(net) : 0,
    };
  });

  const totalDebit = rows.reduce((s, r) => s + r.debitBalance, 0);
  const totalCredit = rows.reduce((s, r) => s + r.creditBalance, 0);

  return (
    <PrintPageWrapper firstPage>
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
            {rows.map((r, i) => (
              <tr key={i}>
                <td style={finStyles.td}>{r.code}</td>
                <td style={finStyles.td}>{r.name}</td>
                <td style={finStyles.tdR}>{r.debitBalance > 0 ? fmt(r.debitBalance) : "—"}</td>
                <td style={finStyles.tdR}>{r.creditBalance > 0 ? fmt(r.creditBalance) : "—"}</td>
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
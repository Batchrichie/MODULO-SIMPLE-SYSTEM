import React from "react";
import { PageHeader, Footer, PrintPageWrapper, finStyles } from "./FinancialShared";
import { fmt } from "../utils/format";

interface CFRow { date: string; description: string; entryNumber: string; net: number; running: number; }

export default function CashFlowDocument({ company, projName, cf }: { company: any; projName: string; cf: CFRow[] }) {
  const tblWidth = "calc(100% - 64px)";
  return (
    <PrintPageWrapper>
      <div style={finStyles.pageWrap}>
        <PageHeader title="CASH FLOWS" subtitle={projName.toUpperCase()} company={company} />
        <table style={{ width: tblWidth, margin: "0 32px", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={finStyles.thBg}>Date</th>
            <th style={finStyles.thBg}>Description</th>
            <th style={{...finStyles.thBg, textAlign: "right"}}>Net Movement</th>
            <th style={{...finStyles.thBg, textAlign: "right"}}>Running Balance</th>
          </tr></thead>
          <tbody>
            {cf.length === 0 && <tr><td colSpan={4} style={{ ...finStyles.td, textAlign: "center", color: "#888" }}>No cash movements recorded yet.</td></tr>}
            {cf.map((r, i) => (
              <tr key={i}>
                <td style={finStyles.td}>{r.date}</td>
                <td style={finStyles.td}>{r.description || "—"}</td>
                <td style={{ ...finStyles.tdR, color: r.net >= 0 ? "#1B6B3A" : "#B03030", fontWeight: 600 }}>{r.net >= 0 ? "+" : ""}{fmt(r.net)}</td>
                <td style={{ ...finStyles.tdR, fontWeight: 700 }}>{fmt(r.running)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Footer company={company} />
      </div>
    </PrintPageWrapper>
  );
}
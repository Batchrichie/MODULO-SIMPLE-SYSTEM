import React from "react";
import { PageHeader, Footer, PrintPageWrapper, finStyles } from "./FinancialShared";
import { fmt } from "../utils/format";
import type { LedgerRow } from "../supabaseClient";

interface AccountLedgerDocumentProps {
  company: { name?: string; [key: string]: unknown };
  genDate: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  periodLabel: string;
  rows: LedgerRow[];
  totalDebit: number;
  totalCredit: number;
  closingBalance: number | null;
}

export default function AccountLedgerDocument({
  company,
  genDate,
  accountCode,
  accountName,
  accountType,
  periodLabel,
  rows,
  totalDebit,
  totalCredit,
  closingBalance,
}: AccountLedgerDocumentProps) {
  const tblWidth = "calc(100% - 64px)";

  return (
    <PrintPageWrapper firstPage>
      <div style={finStyles.pageWrap}>
        <PageHeader
          title="ACCOUNT LEDGER"
          subtitle={`${accountCode} · ${accountName} · ${periodLabel}`}
          company={company}
        />
        <div style={{ margin: "0 32px 12px", fontSize: "9pt", color: "#555" }}>
          {accountType} account · Generated {genDate}
        </div>
        <table style={{ width: tblWidth, margin: "0 32px", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={finStyles.thBg}>Date</th>
              <th style={finStyles.thBg}>Entry #</th>
              <th style={finStyles.thBg}>Description</th>
              <th style={finStyles.thBg}>Project</th>
              <th style={{ ...finStyles.thBg, textAlign: "right" }}>Debit (GHS)</th>
              <th style={{ ...finStyles.thBg, textAlign: "right" }}>Credit (GHS)</th>
              <th style={{ ...finStyles.thBg, textAlign: "right" }}>Balance (GHS)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const isOpening = row.is_opening_balance;
              const desc = row.reversal_of
                ? `Reversal of ${row.reversal_of}`
                : (row.description || "—");
              return (
                <tr key={row.entry_id ?? `ob-${i}`}>
                  <td style={{ ...finStyles.td, fontStyle: isOpening ? "italic" : "normal" }}>
                    {isOpening ? "Opening balance" : row.entry_date}
                  </td>
                  <td style={finStyles.td}>{row.entry_number || "—"}</td>
                  <td style={{
                    ...finStyles.td,
                    textDecoration: row.reversed ? "line-through" : "none",
                    color: row.reversed ? "#888" : finStyles.td.color,
                  }}>
                    {desc}
                  </td>
                  <td style={finStyles.td}>{row.project || "—"}</td>
                  <td style={finStyles.tdR}>{!isOpening && row.debit > 0 ? fmt(row.debit) : "—"}</td>
                  <td style={finStyles.tdR}>{!isOpening && row.credit > 0 ? fmt(row.credit) : "—"}</td>
                  <td style={finStyles.tdR}>{fmt(row.running_balance)}</td>
                </tr>
              );
            })}
            <tr style={finStyles.grandRow}>
              <td style={{ padding: "12px 14px" }} colSpan={4}>PERIOD TOTALS</td>
              <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: "'Courier New', Courier, monospace" }}>{fmt(totalDebit)}</td>
              <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: "'Courier New', Courier, monospace" }}>{fmt(totalCredit)}</td>
              <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: "'Courier New', Courier, monospace" }}>
                {closingBalance !== null ? fmt(closingBalance) : "—"}
              </td>
            </tr>
          </tbody>
        </table>
        <Footer company={company} />
      </div>
    </PrintPageWrapper>
  );
}

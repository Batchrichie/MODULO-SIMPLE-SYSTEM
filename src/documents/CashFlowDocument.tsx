import React from "react";
import { PageHeader, Footer, LR, GL, SR, TR, finStyles, PrintPageWrapper } from "./FinancialShared";
import { fmt } from "../utils/format";
import type { AppData } from "../types";
import { computeCashFlowStatement, type CashFlowStatement } from "../utils/dashboardUtils";

interface CashFlowDocumentProps {
  company: any;
  projName: string;
  data?: AppData;
  startDate?: string;
  endDate?: string;
}

export default function CashFlowDocument({ company, projName, data, startDate, endDate }: CashFlowDocumentProps) {
  const statement: CashFlowStatement = data
    ? computeCashFlowStatement(data, startDate, endDate)
    : {
        operating: { title: "CASH FLOWS FROM OPERATING ACTIVITIES", lines: [], subtotal: 0 },
        investing: { title: "CASH FLOWS FROM INVESTING ACTIVITIES", lines: [], subtotal: 0 },
        financing: { title: "CASH FLOWS FROM FINANCING ACTIVITIES", lines: [], subtotal: 0 },
        netChange: 0,
        openingBalance: 0,
        closingBalance: 0,
      };

  const sections = [statement.operating, statement.investing, statement.financing];

  return (
    <PrintPageWrapper>
      <div style={finStyles.pageWrap}>
        <PageHeader title="CASH FLOW STATEMENT" subtitle={`${projName} · Year ended 31 December`} company={company} />

        <div style={{ margin: "0 32px", width: "calc(100% - 64px)" }}>
          {sections.map((section, sIdx) => (
            <div key={sIdx} style={{ marginBottom: 24 }}>
              <div style={{ fontSize: "11pt", fontWeight: 700, color: "#1a1a1a", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {section.title}
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
                <tbody>
                  {section.lines.length === 0 && (
                    <tr>
                      <td style={{ padding: "8px 0", fontSize: "10pt", color: "#888", fontStyle: "italic" }}>No cash movements in this category.</td>
                      <td style={{ padding: "8px 0", paddingLeft: "20px", textAlign: "right", fontSize: "10pt", color: "#888" }}>—</td>
                    </tr>
                  )}
                  {section.lines.map((line, lIdx) => (
                    <tr key={lIdx} style={{ borderBottom: "none" }}>
                      <td style={{
                        padding: "6px 0",
                        paddingLeft: line.indent ? "32px" : "0",
                        fontSize: "10pt",
                        fontWeight: line.bold ? 600 : 400,
                        color: "#1a1a1a",
                      }}>
                        {line.description}
                      </td>
                      <td style={{
                        padding: "6px 0",
                        paddingLeft: "20px",
                        textAlign: "right",
                        fontSize: "10pt",
                        fontWeight: line.bold ? 600 : 400,
                        color: "#1a1a1a",
                        minWidth: "100px",
                        fontFamily: "'Courier New', Courier, monospace",
                      }}>
                        {line.amount !== 0 ? fmt(Math.abs(line.amount)) : "—"}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: "1px solid #ccc" }}>
                    <td style={{ padding: "8px 0", fontSize: "10pt", fontWeight: 600, color: "#1a1a1a" }}>
                      Net cash {sIdx === 0 ? "from" : sIdx === 1 ? "used in" : "from"} {sIdx === 0 ? "operating" : sIdx === 1 ? "investing" : "financing"} activities
                    </td>
                    <td style={{ padding: "8px 0", paddingLeft: "20px", textAlign: "right", fontSize: "10pt", fontWeight: 600, color: "#1a1a1a", minWidth: "100px", fontFamily: "'Courier New', Courier, monospace" }}>
                      {fmt(Math.abs(section.subtotal))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}

          {/* Reconciliation section */}
          <div style={{ marginTop: 32, borderTop: "2px solid #1a1a1a", paddingTop: 16 }}>
            <div style={{ fontSize: "11pt", fontWeight: 700, color: "#1a1a1a", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              RECONCILIATION OF CASH AND CASH EQUIVALENTS
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td style={{ padding: "8px 0", fontSize: "10pt", color: "#1a1a1a", fontStyle: "italic" }}>(Cash on Hand, Mobile Money, Bank Accounts)</td>
                  <td style={{ padding: "8px 0", paddingLeft: "20px", textAlign: "right", fontSize: "10pt", color: "#888", minWidth: "100px" }}></td>
                </tr>
                <tr>
                  <td style={{ padding: "8px 0", fontSize: "10pt", color: "#1a1a1a" }}>Net increase/(decrease) in cash and cash equivalents</td>
                  <td style={{ padding: "8px 0", paddingLeft: "20px", textAlign: "right", fontSize: "10pt", color: "#1a1a1a", minWidth: "100px", fontFamily: "'Courier New', Courier, monospace", fontWeight: 600 }}>
                    {fmt(Math.abs(statement.netChange))}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "8px 0", fontSize: "10pt", color: "#1a1a1a" }}>Cash and cash equivalents at beginning of period</td>
                  <td style={{ padding: "8px 0", paddingLeft: "20px", textAlign: "right", fontSize: "10pt", color: "#1a1a1a", minWidth: "100px", fontFamily: "'Courier New', Courier, monospace" }}>
                    {fmt(Math.abs(statement.openingBalance))}
                  </td>
                </tr>
                <tr style={{ borderTop: "1px solid #ccc" }}>
                  <td style={{ padding: "8px 0", fontSize: "10pt", fontWeight: 600, color: "#1a1a1a" }}>Cash and cash equivalents at end of period</td>
                  <td style={{ padding: "8px 0", paddingLeft: "20px", textAlign: "right", fontSize: "10pt", fontWeight: 600, color: "#1a1a1a", minWidth: "100px", fontFamily: "'Courier New', Courier, monospace" }}>
                    {fmt(Math.abs(statement.closingBalance))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <Footer company={company} />
      </div>
    </PrintPageWrapper>
  );
}

import React from "react";
import { PageHeader, Footer, PrintPageWrapper, finStyles } from "./FinancialShared";
import { fmt } from "../utils/format";

interface CFLine { description: string; amount: number; indent?: boolean; bold?: boolean; isSubtotal?: boolean; }
interface CFSection { title: string; lines: CFLine[]; subtotal: number; }

export default function CashFlowDocument({ company, projName, cf }: { company: any; projName: string; cf: any[] }) {
  // Group journal entries by activity type (Operating/Investing/Financing)
  const categorizeActivity = (accountType: string, isExpense: boolean): string => {
    if (accountType === 'Expense') return isExpense ? 'operating' : 'operating';
    if (accountType === 'Revenue' || accountType === 'Income') return 'operating';
    if (accountType === 'Asset') return 'investing';
    if (accountType === 'Liability' || accountType === 'Equity') return 'financing';
    return 'operating';
  };

  // Sample structured cash flow (in real scenario, this would come from aggregated journal data)
  const operatingLines: CFLine[] = [
    { description: 'Profit before working capital changes', amount: 0, bold: true },
    { description: 'Depreciation of property, plant & equipment', amount: 0, indent: true },
    { description: 'Amortisation of intangible assets', amount: 0, indent: true },
    { description: 'Loss on disposal of equipment', amount: 0, indent: true },
    { description: 'Finance costs', amount: 0, indent: true },
    { description: 'Operating profit before working capital changes', amount: 0, isSubtotal: true, bold: true },
    { description: 'Increase/(decrease) in trade receivables', amount: 0, indent: true },
    { description: 'Increase/(decrease) in trade payables', amount: 0, indent: true },
    { description: 'Increase/(decrease) in other payables', amount: 0, indent: true },
    { description: 'Cash generated from operations', amount: 0, isSubtotal: true, bold: true },
    { description: 'Income tax paid', amount: 0, indent: true },
    { description: 'Net cash from operating activities', amount: 0, isSubtotal: true, bold: true },
  ];

  const investingLines: CFLine[] = [
    { description: 'Purchase of property, plant & equipment', amount: 0, indent: true },
    { description: 'Proceeds from sale of equipment', amount: 0, indent: true },
    { description: 'Loan to related party', amount: 0, indent: true },
    { description: 'Interest received from investments', amount: 0, indent: true },
    { description: 'Net cash used in investing activities', amount: 0, isSubtotal: true, bold: true },
  ];

  const financingLines: CFLine[] = [
    { description: 'Proceeds from issue of share capital', amount: 0, indent: true },
    { description: 'Loan drawdowns', amount: 0, indent: true },
    { description: 'Repayment of borrowings', amount: 0, indent: true },
    { description: 'Dividends paid', amount: 0, indent: true },
    { description: 'Net cash used in financing activities', amount: 0, isSubtotal: true, bold: true },
  ];

  const operatingSubtotal = operatingLines.reduce((s, l) => s + (l.isSubtotal ? 0 : l.amount), 0);
  const investingSubtotal = investingLines.reduce((s, l) => s + (l.isSubtotal ? 0 : l.amount), 0);
  const financingSubtotal = financingLines.reduce((s, l) => s + (l.isSubtotal ? 0 : l.amount), 0);

  const sections: CFSection[] = [
    { title: 'CASH FLOWS FROM OPERATING ACTIVITIES', lines: operatingLines, subtotal: operatingSubtotal },
    { title: 'CASH FLOWS FROM INVESTING ACTIVITIES', lines: investingLines, subtotal: investingSubtotal },
    { title: 'CASH FLOWS FROM FINANCING ACTIVITIES', lines: financingLines, subtotal: financingSubtotal },
  ];

  const netCashIncrease = operatingSubtotal + investingSubtotal + financingSubtotal;

  return (
    <PrintPageWrapper>
      <div style={finStyles.pageWrap}>
        <PageHeader title="CASH FLOW STATEMENT" subtitle={`Year ended 31 December`} company={company} />
        
        <div style={{ margin: "0 32px", width: "calc(100% - 64px)" }}>
          {sections.map((section, sIdx) => (
            <div key={sIdx} style={{ marginBottom: 24 }}>
              <div style={{ fontSize: "11pt", fontWeight: 700, color: "#1a1a1a", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {section.title}
              </div>
              
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
                <tbody>
                  {section.lines.map((line, lIdx) => (
                    <tr key={lIdx} style={{ borderBottom: line.isSubtotal ? "1px solid #ccc" : "none" }}>
                      <td style={{
                        padding: "8px 0",
                        paddingLeft: line.indent ? "40px" : "0",
                        fontSize: "10pt",
                        fontWeight: line.bold ? 600 : 400,
                        color: "#1a1a1a",
                      }}>
                        {line.description}
                      </td>
                      <td style={{
                        padding: "8px 0",
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
                  <td style={{ padding: "8px 0", fontSize: "10pt", color: "#1a1a1a" }}>Net increase in cash and cash equivalents</td>
                  <td style={{ padding: "8px 0", paddingLeft: "20px", textAlign: "right", fontSize: "10pt", color: "#1a1a1a", minWidth: "100px", fontFamily: "'Courier New', Courier, monospace", fontWeight: 600 }}>
                    {fmt(Math.abs(netCashIncrease))}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "8px 0", fontSize: "10pt", color: "#1a1a1a" }}>Cash and cash equivalents at beginning of year</td>
                  <td style={{ padding: "8px 0", paddingLeft: "20px", textAlign: "right", fontSize: "10pt", color: "#1a1a1a", minWidth: "100px", fontFamily: "'Courier New', Courier, monospace" }}>
                    —
                  </td>
                </tr>
                <tr style={{ borderTop: "1px solid #ccc" }}>
                  <td style={{ padding: "8px 0", fontSize: "10pt", fontWeight: 600, color: "#1a1a1a" }}>Cash and cash equivalents at end of year</td>
                  <td style={{ padding: "8px 0", paddingLeft: "20px", textAlign: "right", fontSize: "10pt", fontWeight: 600, color: "#1a1a1a", minWidth: "100px", fontFamily: "'Courier New', Courier, monospace" }}>
                    {fmt(Math.abs(netCashIncrease))}
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
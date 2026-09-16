import React, { useState, useEffect, useMemo } from "react";
import { FileText } from "lucide-react";
import { INK, RULE, GREEN, ALERT, MUTED, FONT_MONO } from "../theme/tokens";
import Card from "../components/ui/Card";
import SectionTitle from "../components/ui/SectionTitle";
import TableScroll from "../components/ui/TableScroll";
import Th from "../components/ui/Th";
import Td from "../components/ui/Td";
import Button from "../components/ui/Button";
import { inputStyle, labelStyle } from "../components/ui/styles";
import MiniTable from "../components/ui/MiniTable";
import { fmt } from "../utils/format";
import { COMPANY_TEMPLATE } from "../constants/defaults";

import { getTrialBalance, getBalanceSheet, getProfitAndLoss, getCashFlow, getCurrentAssets, getProjectPoc } from "../supabaseClient";
import { computeCashFlowStatement } from "../utils/dashboardUtils";
import IncomeStatementDocument from "../documents/IncomeStatementDocument";
import BalanceSheetDocument from "../documents/BalanceSheetDocument";
import CashFlowDocument from "../documents/CashFlowDocument";
import TrialBalanceDocument from "../documents/TrialBalanceDocument";
import type { AppData, ProjectPoc } from "../types";

export default function FinancialsPanel({ data, setPrintContent }: { data: AppData; setPrintContent: (c: any) => void }) {
  const [view, setView] = useState("company");

  // State for database-fetched financials
  const [tbData, setTbData] = useState([]);
  const [bsData, setBsData] = useState([]);
  const [plData, setPlData] = useState([]);
  const [cashFlowRows, setCashFlowRows] = useState<any[]>([]);
  const [pocData, setPocData] = useState<ProjectPoc | null>(null);
  const [loadingFin, setLoadingFin] = useState(true);

  const startDate = "2026-01-01";
  const endDate = "2026-12-31";

  const cashFlow = useMemo(
    () => computeCashFlowStatement(data, startDate, endDate),
    [data]
  );

  const isProjectView = view !== "company";
  const selectedProject = isProjectView
    ? data.projects.find(p => p.id === view) || null
    : null;

  useEffect(() => {
    async function fetchFinancials() {
      setLoadingFin(true);
      setPocData(null);
      setCashFlowRows([]);
      try {
        const fetches: Promise<unknown>[] = [];

        // When a project is selected, filter P&L by that project.
        // TB / BS / CF are company-wide only (they only render for view==='company').
        const plPromise = getProfitAndLoss(startDate, endDate, isProjectView ? view : null);
        fetches.push(plPromise);

        if (view === "company") {
          fetches.push(getTrialBalance(), getBalanceSheet(), getCashFlow(startDate, endDate));
        }

        // Fetch POC data for project views only.
        const pocPromise = isProjectView ? getProjectPoc(view) : Promise.resolve(null);
        fetches.push(pocPromise);

        const results = await Promise.all(fetches);

        // Resolve in same order as pushed above.
        const pl = (results[0] ?? []) as any[];
        setPlData(pl);

        if (view === "company") {
          const tb = results[1] as any[];
          const bs = results[2] as any[];
          setCashFlowRows((results[3] ?? []) as any[]);
          setTbData(
            (tb || []).map((r) => ({
              code: r.code,
              name: r.name,
              debit: Number(r.total_debit) || 0,
              credit: Number(r.total_credit) || 0,
            }))
          );
          setBsData(bs || []);
          const poc = (results[4] ?? null) as ProjectPoc | null;
          setPocData(poc);
        } else {
          const poc = (results[1] ?? null) as ProjectPoc | null;
          setPocData(poc);
        }
      } catch (err) {
        console.error("Error loading financials:", err);
      } finally {
        setLoadingFin(false);
      }
    }
    fetchFinancials();
  }, [view, isProjectView, data.projects, data.journal.length]);

  if (loadingFin) {
    return <Card><p>Loading financial data...</p></Card>;
  }

  // Map plData to the `pl` shape used by the UI
  const revenue = (plData || []).filter(r => r.type === 'Income').map(r => ({ code: r.code, name: r.name, amount: Number(r.amount) }));
  const expensesAll = (plData || []).filter(r => r.type === 'Expense').map(r => ({ code: r.code, name: r.name, amount: Number(r.amount) }));
  const costOfSales = expensesAll.filter(e => { const c = parseInt(e.code,10); return c >= 5000 && c < 6000; });
  const adminExpenses = expensesAll.filter(e => { const c = parseInt(e.code,10); return c >= 6000 || c < 5000; });
  const totalRevenue = revenue.reduce((s,r) => s + r.amount, 0);
  const totalCostOfSales = costOfSales.reduce((s,r) => s + r.amount, 0);
  const totalAdminExpenses = adminExpenses.reduce((s,r) => s + r.amount, 0);
  const grossProfit = totalRevenue - totalCostOfSales;
  const totalOtherIncome = 0;
  const operatingProfit = grossProfit + totalOtherIncome - totalAdminExpenses;
  const netProfit = operatingProfit;

  const pl = {
    revenue,
    costOfSales,
    otherIncome: [],
    adminExpenses,
    totalRevenue,
    totalCostOfSales,
    grossProfit,
    totalOtherIncome,
    totalAdminExpenses,
    operatingProfit,
    netProfit,
  };

  // Map bsData to the `bs` shape used by the UI
  const assets = (bsData || []).filter(r => r.type === 'Asset' || r.type === 'Contra-Asset').map(r => ({ code: r.code, name: r.name, amount: Number(r.amount) }));
  let currentAssetCodes: string[] = [];
  try {
    currentAssetCodes = getCurrentAssets(data.accounts).map(a => a.code);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Current asset accounts are not configured. Please contact your admin.';
    window.alert(message);
    return <Card><p>{message}</p></Card>;
  }
  const currentAssets = assets.filter(a => currentAssetCodes.includes(a.code));
  const nonCurrentAssets = assets.filter(a => !currentAssets.find(ca => ca.code === a.code));
  const liabilities = (bsData || []).filter(r => r.type === 'Liability').map(r => ({ code: r.code, name: r.name, amount: Number(r.amount) }));
  const equity = (bsData || []).filter(r => r.type === 'Equity').map(r => ({ code: r.code, name: r.name, amount: Number(r.amount) }));

  const totalNonCurrentAssets = nonCurrentAssets.reduce((s,r)=>s+r.amount,0);
  const totalCurrentAssets = currentAssets.reduce((s,r)=>s+r.amount,0);
  const totalAssets = totalNonCurrentAssets + totalCurrentAssets;
  const totalCurrentLiabilities = liabilities.reduce((s,r)=>s+r.amount,0);
  const totalEquity = equity.reduce((s,r)=>s+r.amount,0) + netProfit;
  const totalLiabilitiesAndEquity = totalCurrentLiabilities + totalEquity;

  const bs = {
    nonCurrentAssets,
    currentAssets,
    currentLiabilities: liabilities,
    equity,
    totalNonCurrentAssets,
    totalCurrentAssets,
    totalAssets,
    totalCurrentLiabilities,
    totalEquity,
    totalLiabilitiesAndEquity,
    netProfit,
  };

  const projectOptions = [
    { id: "company", name: "Company-wide" },
    ...data.projects,
  ];

  const cashFlowNetChange = cashFlowRows.reduce((sum, row) => sum + Number(row.net || 0), 0);
  const cashIn = cashFlowRows.reduce((total, row) => total + Math.max(Number(row.net || 0), 0), 0);
  const cashOut = cashFlowRows.reduce((total, row) => total + Math.min(Number(row.net || 0), 0), 0);
  const cashFlowSections = [{
    title: "CASH FLOWS FROM OPERATING ACTIVITIES",
    lines: cashFlowRows.map((row) => ({
      description: row.description || "Unspecified cash movement",
      amount: Number(row.net || 0),
      indent: true,
      entryNumber: row.entry_number,
      date: row.date,
    })),
    subtotal: cashFlowNetChange,
  }];
  const formatCashFlowAmount = (amount: number) => {
    if (amount === 0) return "—";
    return amount < 0 ? `(${fmt(Math.abs(amount))})` : fmt(amount);
  };

  function exportPdf() {
    const projName =
      projectOptions.find((p) => p.id === view)?.name || "Company";
    const company = data.company || COMPANY_TEMPLATE;
    const genDate = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    document.title = `Financials_${projName.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}`;

    setPrintContent(
      <>
        <IncomeStatementDocument company={company} projName={projName} genDate={genDate} pl={pl} />
        {view === "company" && (
          <>
            <BalanceSheetDocument company={company} genDate={genDate} bs={bs} />
            <CashFlowDocument company={company} projName={projName} data={data} startDate={startDate} endDate={endDate} />
            <TrialBalanceDocument company={company} genDate={genDate} tbData={tbData} />
          </>
        )}
      </>
    );

  }


  return (
    <div>
      <SectionTitle
        sub="IFRS-compliant Statement of Profit or Loss, Financial Position, and Cash Flows."
        action={
          <Button onClick={exportPdf} icon={FileText} variant="ghost">
            Export PDF
          </Button>
        }
      >
        Financials
      </SectionTitle>

      <Card style={{ marginBottom: 16 }}>
        <label style={labelStyle}>View</label>
        <select
          style={{ ...inputStyle, maxWidth: 280 }}
          value={view}
          onChange={(e) => setView(e.target.value)}
        >
          {projectOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Card>

      <SectionTitle
        sub={
          view === "company"
            ? "All revenue and expenses."
            : "Revenue billed and costs booked against this project only."
        }
      >
        Statement of Profit or Loss
      </SectionTitle>
      <Card style={{ marginBottom: 16 }}>
        <MiniTable rows={pl.revenue} label="Revenue" />
        <MiniTable rows={pl.costOfSales} label="Cost of Sales" />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: FONT_MONO,
            fontSize: 15,
            fontWeight: 700,
            paddingTop: 8,
            borderTop: `2px solid ${RULE}`,
            color: INK,
            marginBottom: 16,
          }}
        >
          <span>Gross Profit</span>
          <span>GHS {fmt(pl.grossProfit)}</span>
        </div>
        <MiniTable rows={pl.otherIncome} label="Other Income" />
        <MiniTable rows={pl.adminExpenses} label="Administrative Expenses" />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: FONT_MONO,
            fontSize: 15,
            fontWeight: 700,
            paddingTop: 8,
            borderTop: `2px solid ${RULE}`,
            color: INK,
            marginBottom: 8,
          }}
        >
          <span>Operating Profit</span>
          <span>GHS {fmt(pl.operatingProfit)}</span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: FONT_MONO,
            fontSize: 17,
            fontWeight: 700,
            paddingTop: 8,
            borderTop: `2px solid ${RULE}`,
            color: pl.netProfit >= 0 ? GREEN : ALERT,
          }}
        >
          <span>Net Profit</span>
          <span>GHS {fmt(pl.netProfit)}</span>
        </div>
      </Card>

      {isProjectView && selectedProject && (
        <>
          <SectionTitle
            sub={
              pocData?.poc_computable
                ? "Percentage-of-Completion figures computed by the backend posting engine."
                : "POC figures are not available for this project until estimated cost and contract value are configured."
            }
          >
            Percentage of Completion
          </SectionTitle>
          <Card style={{ marginBottom: 16 }}>
            {(() => {
              const recognitionLabel =
                (!pocData?.recognition_method
                  ? selectedProject.recognitionMethod
                  : pocData.recognition_method) || "Not set";
              const prettyRecognition: Record<string, string> = {
                percentage_of_completion: "Percentage of Completion (POC)",
                point_in_time: "Point in Time",
                completed_contract: "Completed Contract",
                not_set: "Not set",
              };
              const recDisplay = prettyRecognition[recognitionLabel] || recognitionLabel;
              const isPocMethod =
                (pocData?.recognition_method || selectedProject.recognitionMethod) ===
                "percentage_of_completion";
              const computable = Boolean(pocData?.poc_computable) && isPocMethod;
              const statStyle = (bg: string, color: string): React.CSSProperties => ({
                display: "inline-block",
                padding: "2px 10px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                background: bg,
                color,
              });
              const kpiRow = (label: string, value: string, meta?: React.CSSProperties): React.ReactNode => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 0",
                    borderBottom: `1px dashed ${RULE}`,
                    ...meta,
                  }}
                >
                  <span style={{ color: MUTED, fontSize: 13 }}>{label}</span>
                  <span style={{ fontFamily: FONT_MONO, fontWeight: 700, color: INK }}>{value}</span>
                </div>
              );
              return (
                <>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 12,
                      justifyContent: "space-between",
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>
                        Recognition method
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>
                        {recDisplay}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>
                        POC status
                      </div>
                      {computable ? (
                        <span style={statStyle("rgba(22,163,74,0.10)", GREEN)}>
                          Computable
                        </span>
                      ) : (
                        <span
                          style={statStyle(
                            "rgba(234,179,8,0.12)",
                            "rgb(161,98,7)"
                          )}
                        >
                          Not configured
                        </span>
                      )}
                    </div>
                  </div>

                  {!isPocMethod && (
                    <div
                      style={{
                        background: "rgba(234,179,8,0.08)",
                        border: `1px solid rgba(234,179,8,0.30)`,
                        borderRadius: 6,
                        padding: "10px 12px",
                        fontSize: 13,
                        color: "rgb(133,77,14)",
                        marginBottom: 12,
                      }}
                    >
                      This project uses <strong>{recDisplay}</strong> — no POC-based revenue
                      recognition calculation applies. Figures below reflect the project-level
                      contract configuration only.
                    </div>
                  )}

                  {isPocMethod && !computable && (
                    <div
                      style={{
                        background: "rgba(239,68,68,0.06)",
                        border: `1px solid rgba(239,68,68,0.25)`,
                        borderRadius: 6,
                        padding: "10px 12px",
                        fontSize: 13,
                        color: "rgb(153,27,27)",
                        marginBottom: 12,
                      }}
                    >
                      {pocData?.not_configured_reason
                        ? `POC not configured: ${pocData.not_configured_reason}`
                        : "POC is not computable because the project does not have both a contract value and a positive estimated cost configured. Contact the project administrator to complete project setup before recognising POC revenue."}
                    </div>
                  )}

                  <div style={{ marginTop: 4 }}>
                    {computable && typeof pocData?.poc_percent === "number" && (
                      <>
                        {kpiRow("POC %", `${(pocData!.poc_percent! * 100).toFixed(2)}%`)}
                      </>
                    )}
                    {kpiRow(
                      "Contract value",
                      pocData?.contract_value != null
                        ? `GHS ${fmt(pocData.contract_value)}`
                        : "— Not configured"
                    )}
                    {kpiRow(
                      "Estimated cost",
                      pocData?.estimated_cost != null
                        ? `GHS ${fmt(pocData.estimated_cost)}`
                        : "— Not configured"
                    )}
                    {kpiRow(
                      "Actual project cost",
                      pocData?.actual_cost != null
                        ? `GHS ${fmt(pocData.actual_cost)}`
                        : "— Not configured"
                    )}
                    {kpiRow(
                      "Revenue billed",
                      pocData?.revenue_billed != null
                        ? `GHS ${fmt(pocData.revenue_billed)}`
                        : "— Not configured"
                    )}
                    {computable && (
                      <>
                        {kpiRow(
                          "Revenue recognized (POC)",
                          pocData?.revenue_recognized != null
                            ? `GHS ${fmt(pocData.revenue_recognized)}`
                            : "— Not configured"
                        )}
                        {kpiRow(
                          "Gross profit recognized",
                          pocData?.gross_profit_recognized != null
                            ? `GHS ${fmt(pocData.gross_profit_recognized)}`
                            : "— Not configured",
                          { borderBottom: "none" }
                        )}
                      </>
                    )}
                  </div>
                </>
              );
            })()}
          </Card>
        </>
      )}

      {view === "company" && (
        <>
          <SectionTitle sub="Assets, liabilities, and equity — company-wide (projects share one balance sheet, they aren't separate legal entities).">
            Statement of Financial Position
          </SectionTitle>
          <Card style={{ marginBottom: 16 }}>
            <MiniTable rows={bs.nonCurrentAssets} label="Non-Current Assets" />
            <MiniTable rows={bs.currentAssets} label="Current Assets" />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontFamily: FONT_MONO,
                fontSize: 15,
                fontWeight: 700,
                paddingTop: 8,
                borderTop: `2px solid ${RULE}`,
                color: INK,
                marginBottom: 16,
              }}
            >
              <span>Total Assets</span>
              <span>GHS {fmt(bs.totalAssets)}</span>
            </div>
            <MiniTable
              rows={bs.currentLiabilities}
              label="Current Liabilities"
            />
            <MiniTable
              rows={[
                ...bs.equity,
                {
                  code: "NI",
                  name: "Current Year Earnings",
                  amount: bs.netProfit,
                },
              ]}
              label="Equity"
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontFamily: FONT_MONO,
                fontSize: 15,
                fontWeight: 700,
                paddingTop: 8,
                borderTop: `2px solid ${RULE}`,
                color: INK,
                marginBottom: 8,
              }}
            >
              <span>Total Liabilities & Equity</span>
              <span>GHS {fmt(bs.totalLiabilitiesAndEquity)}</span>
            </div>
          </Card>

          <SectionTitle sub="All Cash and Bank accounts for the reporting period, grouped by operating, investing, and financing activity.">
            Statement of Cash Flows
          </SectionTitle>
          <Card>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16, padding: "4px 0 20px", borderBottom: `1px solid ${RULE}`, marginBottom: 18 }}>
              {[
                { label: "Opening Balance", value: cashFlow.openingBalance },
                { label: "Total Cash In", value: cashIn },
                { label: "Total Cash Out", value: cashOut },
                { label: "Net Change", value: cashFlowNetChange },
                { label: "Closing Balance", value: cashFlow.openingBalance + cashFlowNetChange },
              ].map((item) => (
                <div key={item.label}>
                  <div style={{ color: MUTED, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>{item.label}</div>
                  <div style={{ color: item.value < 0 ? ALERT : INK, fontFamily: FONT_MONO, fontSize: 16, fontWeight: 700 }}>GHS {formatCashFlowAmount(item.value)}</div>
                </div>
              ))}
            </div>

            <TableScroll>
              <table className="table-card" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <Th>Description</Th>
                    <Th right>Amount (GHS)</Th>
                  </tr>
                </thead>
                <tbody>
                  {cashFlowSections.map((section) => (
                    <React.Fragment key={section.title}>
                      <tr>
                        <td colSpan={2} style={{ padding: "14px 10px 7px", color: INK, background: "var(--nav-active, rgba(212,175,55,0.08))", fontSize: 12, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}>
                          {section.title}
                        </td>
                      </tr>
                      {section.lines.length === 0 ? (
                        <tr><td colSpan={2} style={{ color: MUTED, padding: "9px 10px", fontStyle: "italic" }}>No cash movements in this category.</td></tr>
                      ) : section.lines.map((line) => (
                        <tr key={`${section.title}-${line.description}`} className="row-hover">
                          <Td label="Description" style={{ paddingLeft: line.indent ? 28 : undefined }}>
                            <div style={{ color: INK }}>{line.description}</div>
                            {line.entryNumber && <div style={{ color: MUTED, fontSize: 11, marginTop: 3 }}>{line.date} · {line.entryNumber}</div>}
                          </Td>
                          <Td right mono label="Amount (GHS)" style={{ color: line.amount < 0 ? ALERT : INK }}>{formatCashFlowAmount(line.amount)}</Td>
                        </tr>
                      ))}
                      <tr style={{ borderTop: `2px solid ${RULE}` }}>
                        <Td bold>Net cash {section.title.toLowerCase().replace("cash flows ", "").replace(" activities", "")}</Td>
                        <Td right mono bold style={{ color: section.subtotal < 0 ? ALERT : INK }}>{formatCashFlowAmount(section.subtotal)}</Td>
                      </tr>
                    </React.Fragment>
                  ))}
                  <tr style={{ borderTop: `2px solid ${INK}` }}>
                    <Td bold>Net change in cash and cash equivalents</Td>
                    <Td right mono bold style={{ color: cashFlowNetChange < 0 ? ALERT : INK }}>{formatCashFlowAmount(cashFlowNetChange)}</Td>
                  </tr>
                </tbody>
              </table>
            </TableScroll>

            <div style={{ marginTop: 22, paddingTop: 16, borderTop: `2px solid ${INK}` }}>
              <div style={{ color: INK, fontSize: 12, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 8 }}>Reconciliation of Cash and Cash Equivalents</div>
              <div style={{ color: MUTED, fontSize: 12, marginBottom: 12 }}>All Cash and Bank accounts</div>
              <div style={{ display: "grid", gap: 8, maxWidth: 560 }}>
                {[
                  { label: `Opening Balance (as of ${startDate})`, value: cashFlow.openingBalance },
                  { label: "Net increase/(decrease) in cash and cash equivalents", value: cashFlowNetChange },
                  { label: "Closing Balance", value: cashFlow.openingBalance + cashFlowNetChange },
                ].map((item, index) => (
                  <div key={item.label} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "7px 0", borderTop: index === 2 ? `2px solid ${RULE}` : undefined, fontWeight: index === 2 ? 700 : 400 }}>
                    <span>{item.label}</span>
                    <span style={{ fontFamily: FONT_MONO, color: item.value < 0 ? ALERT : INK }}>GHS {formatCashFlowAmount(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}


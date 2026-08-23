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

import { getTrialBalance, getBalanceSheet, getProfitAndLoss, getCurrentAssets, getProjectPoc } from "../supabaseClient";
import { computeCashFlow } from "../utils/dashboardUtils";
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
  const [pocData, setPocData] = useState<ProjectPoc | null>(null);
  const [loadingFin, setLoadingFin] = useState(true);

  const startDate = "2026-01-01";
  const endDate = "2026-12-31";

  const cf = useMemo(() => computeCashFlow(data), [data.journal]);

  const isProjectView = view !== "company";
  const selectedProject = isProjectView
    ? data.projects.find(p => p.id === view) || null
    : null;

  useEffect(() => {
    async function fetchFinancials() {
      setLoadingFin(true);
      setPocData(null);
      try {
        const fetches: Promise<unknown>[] = [];

        // When a project is selected, filter P&L by that project.
        // TB / BS / CF are company-wide only (they only render for view==='company').
        const plPromise = getProfitAndLoss(startDate, endDate, isProjectView ? view : null);
        fetches.push(plPromise);

        if (view === "company") {
          fetches.push(getTrialBalance(), getBalanceSheet());
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
          setTbData(
            (tb || []).map((r) => ({
              code: r.code,
              name: r.name,
              debit: Number(r.total_debit) || 0,
              credit: Number(r.total_credit) || 0,
            }))
          );
          setBsData(bs || []);
          const poc = (results[3] ?? null) as ProjectPoc | null;
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
  }, [view, isProjectView, data.projects]);

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
                      pocData?.actual_project_cost != null
                        ? `GHS ${fmt(pocData.actual_project_cost)}`
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

          <SectionTitle sub="Movements through Cash and Bank (account 1000), in date order. A simplified direct-method view.">
            Statement of Cash Flows
          </SectionTitle>
          <Card>
            <TableScroll>
              <table
                className="table-card"
                style={{ width: "100%", borderCollapse: "collapse" }}
              >
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Entry</Th>
                    <Th>Description</Th>
                    <Th right>Net Movement</Th>
                    <Th right>Running Balance</Th>
                  </tr>
                </thead>
                <tbody>
                  {cf.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ color: MUTED, padding: 10 }}>
                        No cash movements yet.
                      </td>
                    </tr>
                  )}
                  {cf.map((r, i) => (
                    <tr key={i} className="row-hover">
                      <Td label="Date">{r.date}</Td>
                      <Td mono label="Entry">
                        {r.entryNumber}
                      </Td>
                      <Td label="Description">{r.description || "—"}</Td>
                      <Td
                        right
                        mono
                        label="Net Movement"
                        style={{ color: r.net >= 0 ? GREEN : ALERT }}
                      >
                        {r.net >= 0 ? "+" : ""}
                        {fmt(r.net)}
                      </Td>
                      <Td right mono bold label="Running Balance">
                        {fmt(r.running)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </Card>
        </>
      )}
    </div>
  );
}


import React, { useState, useEffect, useMemo, useCallback } from "react";
import { FileText } from "lucide-react";
import { INK, PAPER, PAPER_RAISED, RULE, GREEN, GREEN_DEEP, GOLD, ALERT, MUTED,
         FONT_DISPLAY, FONT_BODY, FONT_MONO, LOGO_SRC } from "../theme/tokens";
import Card from "../components/ui/Card";
import SectionTitle from "../components/ui/SectionTitle";
import TableScroll from "../components/ui/TableScroll";
import Th from "../components/ui/Th";
import Td from "../components/ui/Td";
import Button from "../components/ui/Button";
import { inputStyle, labelStyle } from "../components/ui/styles";
import MiniTable from "../components/ui/MiniTable";
import { fmt, projectName } from "../utils/format";
import { COMPANY_TEMPLATE, GENERAL_PROJECT } from "../constants/defaults";

import { getTrialBalance, getBalanceSheet, getProfitAndLoss } from "../supabaseClient";
import { computeCashFlow } from "../utils/dashboardUtils";
import type { AppData } from "../types";

export default function FinancialsPanel({ data, setPrintContent }: { data: AppData; setPrintContent: (c: any) => void }) {
  const [view, setView] = useState("company");

  // State for database-fetched financials
  const [tbData, setTbData] = useState([]);
  const [bsData, setBsData] = useState([]);
  const [plData, setPlData] = useState([]);
  const [loadingFin, setLoadingFin] = useState(true);

  const cf = useMemo(() => computeCashFlow(data), [data.journal]);

  useEffect(() => {
    async function fetchFinancials() {
      setLoadingFin(true);
      try {
        const startDate = "2026-01-01";
        const endDate = "2026-12-31";

        const [tb, bs, pl] = await Promise.all([
          getTrialBalance(),
          getBalanceSheet(),
          getProfitAndLoss(startDate, endDate),
        ]);

        setTbData(tb || []);
        setBsData(bs || []);
        setPlData(pl || []);
      } catch (err) {
        console.error("Error loading financials:", err);
      } finally {
        setLoadingFin(false);
      }
    }
    fetchFinancials();
  }, [view]);

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
  const currentAssets = assets.filter(a => ['1000','1100','1200','1300','1400'].includes(a.code));
  const nonCurrentAssets = assets.filter(a => !['1000','1100','1200','1300','1400'].includes(a.code));
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

    // --- shared style fragments ---
    const S = {
      goldBar: { height: 4, background: "linear-gradient(90deg, #B8860B 0%, #D4AF37 40%, #B8860B 100%)" },
      thBg: { background: "#1B2A4A", color: "#FFFFFF", padding: "9px 14px", fontSize: "8pt", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", borderBottom: "2px solid #B8860B" },
      td: { padding: "6px 14px", borderBottom: "1px solid #D5CEBD", verticalAlign: "top", fontSize: "9.5pt", color: "#222222" },
      tdR: { padding: "6px 14px", borderBottom: "1px solid #D5CEBD", verticalAlign: "top", fontSize: "9.5pt", color: "#222222", textAlign: "right", fontFamily: FONT_MONO },
      groupLabel: { fontWeight: 700, color: "#1B2A4A", padding: "12px 14px 4px", fontSize: "8.5pt", textTransform: "uppercase", letterSpacing: "0.8px", background: "#EDF2FA" },
      subtotalRow: { fontWeight: 700, background: "#F5F0E6" },
      totalRow: { fontWeight: 800, background: "#E8E0CC", color: "#1A1A1A" },
      grandRow: { fontWeight: 800, background: "#1B2A4A", color: "#D4AF37", fontSize: "11pt" },
    };

    // Mini page header repeated on each page-break section
    const PageHeader = ({ title, subtitle }) => (
      <div>
        <div style={S.goldBar} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 32px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <img src={LOGO_SRC} alt="logo" style={{ height: 48, width: "auto" }} />
            <div>
              <div style={{ fontSize: "15pt", fontWeight: 800, color: "#1A1A1A", letterSpacing: "-0.5px" }}>{company.name}</div>
              <div style={{ fontSize: "7.5pt", color: "#888", textTransform: "uppercase", letterSpacing: "1.5px" }}>Design · Build · Deliver</div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "18pt", fontWeight: 800, color: "#1B2A4A", letterSpacing: "2px", lineHeight: 1 }}>{title}</div>
            {subtitle && <div style={{ fontSize: "8.5pt", color: "#888", marginTop: 4, fontFamily: FONT_MONO }}>{subtitle}</div>}
          </div>
        </div>
      </div>
    );

    const SectionHeading = ({ children }) => (
      <div style={{ fontSize: "9pt", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "#B8860B", padding: "0 32px", margin: "18px 0 10px", display: "flex", alignItems: "center", gap: 10 }}>
        <span>{children}</span>
        <span style={{ flex: 1, height: 1, background: "#D5CEBD" }} />
      </div>
    );

    const LR = ({ code, name, amount, negative }) => (
      <tr key={code}><td style={S.td}>{name}</td><td style={S.tdR}>{negative ? `(${fmt(amount)})` : fmt(amount)}</td></tr>
    );
    const GL = ({ children }) => <tr><td colSpan={2} style={S.groupLabel}>{children}</td></tr>;
    const SR = ({ label, amount, negative }) => (
      <tr style={S.subtotalRow}><td style={S.td}>{label}</td><td style={S.tdR}>{negative ? `(${fmt(amount)})` : fmt(amount)}</td></tr>
    );
    const TR = ({ label, amount, variant }) => (
      <tr style={variant === "grand" ? S.grandRow : S.totalRow}>
        <td style={{ padding: variant === "grand" ? "12px 14px" : "8px 14px", fontWeight: 800, fontSize: variant === "grand" ? "11pt" : "9.5pt" }}>{label}</td>
        <td style={{ padding: variant === "grand" ? "12px 14px" : "8px 14px", fontWeight: 800, fontSize: variant === "grand" ? "11pt" : "9.5pt", textAlign: "right", fontFamily: FONT_MONO }}>{fmt(amount)}</td>
      </tr>
    );

    const Footer = () => (
      <div style={{ padding: "14px 32px 20px", marginTop: 16, borderTop: "2px solid #B8860B", textAlign: "center", fontSize: "7.5pt", color: "#888", textTransform: "uppercase", letterSpacing: "1px", lineHeight: 1.8 }}>
        {company.name} · {company.addressLine} · {company.cityLine} · {company.poBox} · Phone: {company.phone} · {company.email}
      </div>
    );

    const tblWidth = "calc(100% - 64px)";

    // ---- PAGE 1: P&L ----
    const plPage = (
      <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", fontSize: "10pt", lineHeight: 1.5, color: "#222" }}>
        <PageHeader title="PROFIT & LOSS" subtitle={projName.toUpperCase()} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, padding: "0 32px 18px" }}>
          <div style={{ background: "#F7F5F0", border: "1px solid #D5CEBD", borderRadius: 6, padding: "14px 18px" }}>
            <div style={{ fontSize: "7.5pt", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.2px", color: "#B8860B", marginBottom: 8 }}>Statement Details</div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: "9pt" }}><span style={{ color: "#666" }}>Scope</span><span style={{ fontWeight: 600 }}>{projName}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: "9pt" }}><span style={{ color: "#666" }}>Currency</span><span style={{ fontWeight: 600 }}>GHS</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: "9pt" }}><span style={{ color: "#666" }}>Generated</span><span style={{ fontWeight: 600 }}>{genDate}</span></div>
          </div>
          <div style={{ background: "#F7F5F0", border: "1px solid #D5CEBD", borderRadius: 6, padding: "14px 18px" }}>
            <div style={{ fontSize: "7.5pt", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.2px", color: "#B8860B", marginBottom: 8 }}>Basis of Preparation</div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: "9pt" }}><span style={{ color: "#666" }}>Framework</span><span style={{ fontWeight: 600 }}>IFRS-aligned</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: "9pt" }}><span style={{ color: "#666" }}>Prepared By</span><span style={{ fontWeight: 600 }}>{company.preparedByName}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: "9pt" }}><span style={{ color: "#666" }}>Authorised By</span><span style={{ fontWeight: 600 }}>{company.authorisedByName}</span></div>
          </div>
        </div>
        <table style={{ width: tblWidth, margin: "0 32px", borderCollapse: "collapse" }}>
          <thead><tr><th style={{ ...S.thBg, textAlign: "left" }}>Description</th><th style={{ ...S.thBg, textAlign: "right" }}>Amount (GHS)</th></tr></thead>
          <tbody>
            <GL>Revenue</GL>
            {pl.revenue.map(r => <LR key={r.code} code={r.code} name={r.name} amount={r.amount} />)}
            <SR label="Total Revenue" amount={pl.totalRevenue} />
            <GL>Cost of Sales</GL>
            {pl.costOfSales.map(r => <LR key={r.code} code={r.code} name={r.name} amount={r.amount} negative />)}
            <SR label="Total Cost of Sales" amount={pl.totalCostOfSales} negative />
            <TR label="Gross Profit" amount={pl.grossProfit} />
            <GL>Other Income</GL>
            {pl.otherIncome.map(r => <LR key={r.code} code={r.code} name={r.name} amount={r.amount} />)}
            <GL>Administrative Expenses</GL>
            {pl.adminExpenses.map(r => <LR key={r.code} code={r.code} name={r.name} amount={r.amount} negative />)}
            <SR label="Total Admin Expenses" amount={pl.totalAdminExpenses} negative />
            <TR label="Operating Profit" amount={pl.operatingProfit} />
            <TR label="Net Profit For The Period" amount={pl.netProfit} variant="grand" />
          </tbody>
        </table>
        <Footer />
      </div>
    );

    // ---- PAGE 2: BALANCE SHEET ----
    const bsPage = (
      <div style={{ pageBreakBefore: "always", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", fontSize: "10pt", lineHeight: 1.5, color: "#222" }}>
        <PageHeader title="BALANCE SHEET" subtitle={`As at ${genDate}`} />
        <table style={{ width: tblWidth, margin: "0 32px", borderCollapse: "collapse" }}>
          <thead><tr><th style={{ ...S.thBg, textAlign: "left" }}>Description</th><th style={{ ...S.thBg, textAlign: "right" }}>Amount (GHS)</th></tr></thead>
          <tbody>
            <GL>Non-Current Assets</GL>
            {bs.nonCurrentAssets.map(r => <LR key={r.code} code={r.code} name={r.name} amount={r.amount} />)}
            <SR label="Total Non-Current Assets" amount={bs.totalNonCurrentAssets} />
            <GL>Current Assets</GL>
            {bs.currentAssets.map(r => <LR key={r.code} code={r.code} name={r.name} amount={r.amount} />)}
            <SR label="Total Current Assets" amount={bs.totalCurrentAssets} />
            <TR label="Total Assets" amount={bs.totalAssets} />
            <GL>Current Liabilities</GL>
            {bs.currentLiabilities.map(r => <LR key={r.code} code={r.code} name={r.name} amount={r.amount} />)}
            <SR label="Total Current Liabilities" amount={bs.totalCurrentLiabilities} />
            <GL>Equity</GL>
            {bs.equity.map(r => <LR key={r.code} code={r.code} name={r.name} amount={r.amount} />)}
            <LR code="NI" name="Current Year Earnings" amount={bs.netProfit} />
            <SR label="Total Equity" amount={bs.totalEquity} />
            <TR label="Total Liabilities & Equity" amount={bs.totalLiabilitiesAndEquity} variant="grand" />
          </tbody>
        </table>
        <Footer />
      </div>
    );

    // ---- PAGE 3: CASH FLOWS ----
    const cfPage = (
      <div style={{ pageBreakBefore: "always", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", fontSize: "10pt", lineHeight: 1.5, color: "#222" }}>
        <PageHeader title="CASH FLOWS" subtitle={projName.toUpperCase()} />
        <table style={{ width: tblWidth, margin: "0 32px", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={{ ...S.thBg, textAlign: "left" }}>Date</th>
            <th style={{ ...S.thBg, textAlign: "left" }}>Description</th>
            <th style={{ ...S.thBg, textAlign: "right" }}>Net Movement</th>
            <th style={{ ...S.thBg, textAlign: "right" }}>Running Balance</th>
          </tr></thead>
          <tbody>
            {cf.length === 0 && <tr><td colSpan={4} style={{ ...S.td, textAlign: "center", color: "#888" }}>No cash movements recorded yet.</td></tr>}
            {cf.map((r, i) => (
              <tr key={i}>
                <td style={S.td}>{r.date}</td>
                <td style={S.td}>{r.description || "—"}</td>
                <td style={{ ...S.tdR, color: r.net >= 0 ? "#1B6B3A" : "#B03030", fontWeight: 600 }}>{r.net >= 0 ? "+" : ""}{fmt(r.net)}</td>
                <td style={{ ...S.tdR, fontWeight: 700 }}>{fmt(r.running)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Footer />
      </div>
    );

    setPrintContent(<>{plPage}{view === "company" ? <>{bsPage}{cfPage}</> : null}</>);
    setTimeout(() => { window.print(); document.title = "Modulo Ledger"; }, 150);
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


import React from "react";
import { PageHeader, Footer, LR, GL, SR, TR, finStyles, PrintPageWrapper } from "./FinancialShared";

interface Row { code: string; name: string; amount: number; }
interface PLData {
  revenue: Row[]; costOfSales: Row[]; otherIncome: Row[]; adminExpenses: Row[];
  totalRevenue: number; totalCostOfSales: number; grossProfit: number;
  totalOtherIncome: number; totalAdminExpenses: number; operatingProfit: number; netProfit: number;
}

export default function IncomeStatementDocument({ company, projName, genDate, pl }: { company: any; projName: string; genDate: string; pl: PLData }) {
  const tblWidth = "calc(100% - 64px)";
  return (
    <PrintPageWrapper firstPage>
      <div style={finStyles.pageWrap}>
        <PageHeader title="PROFIT & LOSS" subtitle={projName.toUpperCase()} company={company} />
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
          <thead><tr><th style={finStyles.thBg}>Description</th><th style={{...finStyles.thBg, textAlign: "right"}}>Amount (GHS)</th></tr></thead>
          <tbody>
            <GL>Revenue</GL>
            {pl.revenue.map(r => <LR key={r.code} {...r} />)}
            <SR label="Total Revenue" amount={pl.totalRevenue} />
            <GL>Cost of Sales</GL>
            {pl.costOfSales.map(r => <LR key={r.code} {...r} negative />)}
            <SR label="Total Cost of Sales" amount={pl.totalCostOfSales} negative />
            <TR label="Gross Profit" amount={pl.grossProfit} />
            <GL>Other Income</GL>
            {pl.otherIncome.map(r => <LR key={r.code} {...r} />)}
            <GL>Administrative Expenses</GL>
            {pl.adminExpenses.map(r => <LR key={r.code} {...r} negative />)}
            <SR label="Total Admin Expenses" amount={pl.totalAdminExpenses} negative />
            <TR label="Operating Profit" amount={pl.operatingProfit} />
            <TR label="Net Profit For The Period" amount={pl.netProfit} variant="grand" />
          </tbody>
        </table>
        <Footer company={company} />
      </div>
    </PrintPageWrapper>
  );
}
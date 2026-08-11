import React from "react";
import { PageHeader, Footer, LR, GL, SR, TR, finStyles, PrintPageWrapper } from "./FinancialShared";

interface Row { code: string; name: string; amount: number; }
interface BSData {
  nonCurrentAssets: Row[]; currentAssets: Row[]; currentLiabilities: Row[]; equity: Row[];
  totalNonCurrentAssets: number; totalCurrentAssets: number; totalAssets: number;
  totalCurrentLiabilities: number; totalEquity: number; totalLiabilitiesAndEquity: number; netProfit: number;
}

export default function BalanceSheetDocument({ company, genDate, bs }: { company: any; genDate: string; bs: BSData }) {
  const tblWidth = "calc(100% - 64px)";
  return (
    <PrintPageWrapper>
      <div style={finStyles.pageWrap}>
        <PageHeader title="BALANCE SHEET" subtitle={`As at ${genDate}`} company={company} />
        <table style={{ width: tblWidth, margin: "0 32px", borderCollapse: "collapse" }}>
          <thead><tr><th style={finStyles.thBg}>Description</th><th style={{...finStyles.thBg, textAlign: "right"}}>Amount (GHS)</th></tr></thead>
          <tbody>
            <GL>Non-Current Assets</GL>
            {bs.nonCurrentAssets.map(r => <LR key={r.code} {...r} />)}
            <SR label="Total Non-Current Assets" amount={bs.totalNonCurrentAssets} />
            <GL>Current Assets</GL>
            {bs.currentAssets.map(r => <LR key={r.code} {...r} />)}
            <SR label="Total Current Assets" amount={bs.totalCurrentAssets} />
            <TR label="Total Assets" amount={bs.totalAssets} />
            <GL>Current Liabilities</GL>
            {bs.currentLiabilities.map(r => <LR key={r.code} {...r} />)}
            <SR label="Total Current Liabilities" amount={bs.totalCurrentLiabilities} />
            <GL>Equity</GL>
            {bs.equity.map(r => <LR key={r.code} {...r} />)}
            <LR code="NI" name="Current Year Earnings" amount={bs.netProfit} />
            <SR label="Total Equity" amount={bs.totalEquity} />
            <TR label="Total Liabilities & Equity" amount={bs.totalLiabilitiesAndEquity} variant="grand" />
          </tbody>
        </table>
        <Footer company={company} />
      </div>
    </PrintPageWrapper>
  );
}
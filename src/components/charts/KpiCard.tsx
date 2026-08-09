import { useState } from "react";
import type { ComponentType } from "react";
import Card from "../ui/Card";
import { fmt } from "../../utils/format";
import { GREEN, GOLD, ALERT } from "../../theme/tokens";
import { PAPER, PAPER_RAISED, RULE, INK, MUTED, FONT_BODY, FONT_DISPLAY, FONT_MONO } from "../../theme/tokens";
export default function KpiCard({ title, value, icon: Icon, accent, sub, detail }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{ position: "relative", flex: 1, minWidth: 220 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Card style={{ borderTop: `3px solid ${accent}`, cursor: "default" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontFamily: FONT_BODY, fontSize: 12, color: MUTED, fontWeight: 600, textTransform: "uppercase" }}>
            {title}
          </span>
          <span style={{ color: accent, display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 6, background: "var(--nav-hover)" }}>
            <Icon size={16} />
          </span>
        </div>
        <h3 style={{ fontFamily: FONT_MONO, fontSize: 24, color: INK, margin: 0 }}>
          GHS {fmt(value)}
        </h3>
        {sub && <p style={{ fontSize: 11, color: MUTED, margin: "4px 0 0 0" }}>{sub}</p>}
      </Card>

      {hovered && detail && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 10px)",
            left: 0,
            right: 0,
            background: "#1F2937",
            color: "#F1F5F9",
            borderRadius: 10,
            padding: "14px 16px",
            fontSize: 12,
            lineHeight: 1.6,
            zIndex: 100,
            boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              position: "absolute",
              bottom: -6,
              left: 24,
              width: 12,
              height: 12,
              background: "#1F2937",
              transform: "rotate(45deg)",
              borderRadius: 2,
            }}
          />
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: accent === GREEN ? "#4ADE80" : accent === GOLD ? "#D4AF37" : accent === ALERT ? "#F87171" : "#94A3B8" }}>
            {title}
          </div>
          {detail}
        </div>
      )}
    </div>
  );
}

function getComplianceNotifications() {
  const today = new Date();
  const day = today.getDate();
  const alerts = [];
  
  // SSNIT & PAYE due by 15th
  if (day >= 10 && day <= 14) {
    alerts.push({ text: "PAYE & SSNIT due in 1-5 days (15th). Prepare remittances.", color: GOLD });
  }
  // VAT due by 30th/31st
  if (day >= 25 && day <= 29) {
    alerts.push({ text: "VAT due soon (end of month). Prepare remittance.", color: ALERT });
  }
  // Grace period past 15th
  if (day > 15 && day < 25) {
    alerts.push({ text: "PAYE & SSNIT were due on the 15th. Verify compliance.", color: ALERT });
  }
  
  return alerts;
}

// ---------- Helper: Identify & Sort Current Working Projects ----------
function getPrioritizedProjects(data, stats) {
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM
  
  // Enrich projects with activity scores
  const enriched = stats
    .filter(p => p.status === "Active" && p.id !== "GEN")
    .map(p => {
      // Find recent journal entries for this project (last 30 days)
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const recentEntries = data.journal.filter(e => 
        (e.project || "GEN") === p.id && e.date >= thirtyDaysAgo
      );
      
      // Find recent invoices for this project (last 30 days)
      const recentInvoices = data.invoices.filter(inv => 
        (inv.project || "GEN") === p.id && inv.date >= thirtyDaysAgo && inv.status !== "Void"
      );
      
      // Calculate activity score
      const entryScore = recentEntries.length * 10;
      const invoiceScore = recentInvoices.length * 15;
      const costActivity = p.actualCost > 0 ? 20 : 0; // Has actual costs incurred
      const revenueActivity = p.revenueBilled > 0 ? 15 : 0; // Has billed revenue
      
      const totalScore = entryScore + invoiceScore + costActivity + revenueActivity;
      
      // Determine if this is a "current focus" project
      const isCurrentFocus = totalScore >= 20 || p.actualCost > 0;
      
      return {
        ...p,
        activityScore: totalScore,
        isCurrentFocus,
        recentEntryCount: recentEntries.length,
        recentInvoiceCount: recentInvoices.length,
        lastActivityDate: [...recentEntries.map(e => e.date), ...recentInvoices.map(i => i.date)].sort().pop() || null,
      };
    });
  
  // Sort: Current Focus first (by score descending), then others by contract value
  return enriched.sort((a, b) => {
    if (a.isCurrentFocus && !b.isCurrentFocus) return -1;
    if (!a.isCurrentFocus && b.isCurrentFocus) return 1;
    return b.activityScore - a.activityScore || b.contractValue - a.contractValue;
  });
}

function getDashboardMetrics(data) {
  const balanceFor = (code) => {
    let debit = 0, credit = 0;
    data.journal.forEach(e => e.lines.forEach(l => {
      if (l.account === code) { debit += l.debit; credit += l.credit; }
    }));
    return debit - credit; 
  };
  
  const cash = balanceFor("1000");
  const ar = balanceFor("1100");
  const ap = Math.abs(balanceFor("2000"));
  
  // Derive P&L totals directly from journal entries (server-backed views are used in FinancialsPanel)
  let totalRevenue = 0;
  let totalCostOfSales = 0;
  let totalAdminExpenses = 0;
  data.journal.forEach(e => e.lines.forEach(l => {
    const acc = data.accounts.find(a => a.code === l.account);
    if (!acc) return;
    if (acc.type === "Revenue" || acc.type === "Income") {
      totalRevenue += (l.credit - l.debit);
    }
    if (acc.type === "Expense") {
      const codeNum = parseInt(l.account, 10) || 0;
      const amt = l.debit - l.credit;
      if (codeNum >= 5000 && codeNum < 6000) totalCostOfSales += amt;
      else totalAdminExpenses += amt;
    }
  }));
  const totalExpenses = totalCostOfSales + totalAdminExpenses;
  const netIncome = totalRevenue - totalExpenses;
  
  let totalContractValue = 0;
  let totalEstimatedCost = 0;
  let totalActualCost = 0;
  
  const activeProjects = data.projects.filter(p => p.status === "Active" && p.id !== "GEN");
  
  activeProjects.forEach(p => {
    totalContractValue += parseFloat(p.contractValue) || 0;
    totalEstimatedCost += parseFloat(p.estimatedCost) || 0;
  });
  
  data.journal.forEach(e => {
    if (e.project && e.project !== "GEN") {
      const proj = activeProjects.find(p => p.id === e.project);
      if (proj) {
        e.lines.forEach(l => {
          const acc = data.accounts.find(a => a.code === l.account);
          if (acc && acc.type === "Expense") totalActualCost += (l.debit - l.credit);
        });
      }
    }
  });
  
  const projectedGrossMargin = totalContractValue - totalEstimatedCost;
  const projectedMarginPct = totalContractValue > 0 ? (projectedGrossMargin / totalContractValue) * 100 : 0;
  
  // Chart Data Prep
  const cashFlowData = computeCashFlow(data).slice(-6).map(c => ({ date: c.date, value: c.running }));
  
  const monthlyData = {};
  data.journal.forEach(e => {
    const month = e.period; 
    if (!month) return;
    if (!monthlyData[month]) monthlyData[month] = { revenue: 0, expense: 0 };
    e.lines.forEach(l => {
      const acc = data.accounts.find(a => a.code === l.account);
      if (!acc) return;
      if (acc.type === "Revenue" || acc.type === "Income") monthlyData[month].revenue += (l.credit - l.debit);
      if (acc.type === "Expense") monthlyData[month].expense += (l.debit - l.credit);
    });
  });
  const barChartData = Object.keys(monthlyData).slice(-6).map(m => ({
    label: m.split('-')[1] + '/' + m.split('-')[0].slice(2), 
    revenue: monthlyData[m].revenue,
    expense: monthlyData[m].expense
  }));

  const donutData = activeProjects.map(p => ({ name: p.name, value: parseFloat(p.contractValue) || 0 })).filter(d => d.value > 0);
  
  return { 
    cash, ar, ap, netIncome, totalRevenue, totalExpenses,
    totalContractValue, totalEstimatedCost, totalActualCost,
    projectedGrossMargin, projectedMarginPct,
    cashFlowData, barChartData, donutData
  };
}

// ---------- Custom SVG Charts ----------

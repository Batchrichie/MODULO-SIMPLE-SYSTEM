import React, { useState, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  BookOpen, PenLine, Scale, Users, Banknote, FileSpreadsheet,
  Plus, Trash2, Printer, Check, AlertTriangle, Settings2, Briefcase,
  Receipt, TrendingUp, X, Sun, Moon, LayoutDashboard,
  ArrowUpRight, ArrowDownRight, FileText, MoreHorizontal, Landmark,
} from "lucide-react";
import { INK, PAPER, PAPER_RAISED, RULE, GREEN, GREEN_DEEP, GOLD, ALERT, MUTED,
         FONT_DISPLAY, FONT_BODY, FONT_MONO, LOGO_SRC } from "../theme/tokens";
import Card from "../components/ui/Card";
import SectionTitle from "../components/ui/SectionTitle";
import TableScroll from "../components/ui/TableScroll";
import Th from "../components/ui/Th";
import Td from "../components/ui/Td";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import { inputStyle, labelStyle } from "../components/ui/styles";
import MiniTable from "../components/ui/MiniTable";
import ProjectSelect from "../components/ui/ProjectSelect";
import KpiCard from "../components/charts/KpiCard";
import LineChart from "../components/charts/LineChart";
import BarChart from "../components/charts/BarChart";
import DonutChart from "../components/charts/DonutChart";
import { fmt, projectName } from "../utils/format";
import { amountInWords } from "../utils/numberToWords";
import { computeInvoiceTotals, NAVY, INVOICE_GOLD, invTdLabel, invTdVal } from "../utils/invoiceUtils";
import { getDashboardMetrics, getComplianceNotifications, getPrioritizedProjects, projectStatsFn } from "../utils/dashboardUtils";
import { COMPANY_TEMPLATE, GENERAL_PROJECT } from "../constants/defaults";
import {
  assertJournalEntry, assertInvoice, assertAccount, assertEmployee,
  assertProject, assertPayment
} from "../validation";
import {
  db, loadLedgerState, loadTaxConfig, saveSettings, saveTaxRates,
  savePayeBrackets, getTrialBalance, getBalanceSheet, getProfitAndLoss,
  getSession, onAuthStateChange, signOut, runPayrollAndFetch
} from "../supabaseClient";
import type { AppData, MutateFn, PanelProps, InvoicingPanelProps, PayrollPanelProps,
             NewInvoiceFormProps, RecordPaymentFormProps, InvoiceDocumentProps,
             ReceiptDocumentProps, PayslipProps, ProjectStats } from "../types";

export default function DashboardPanel({ data, setTab }) {
  const metrics = useMemo(() => getDashboardMetrics(data), [data]);
  const stats = useMemo(() => projectStatsFn(data), [data]); 
  const recentEntries = data.journal.slice(0, 5);
  const alerts = getComplianceNotifications();
  
  // Get prioritized projects (current/active projects FIRST!)
  const prioritizedProjects = useMemo(() => getPrioritizedProjects(data, stats), [data, stats]);
  
  const today = new Date().toISOString().slice(0, 10);
  const outstandingInvoices = data.invoices
    .map(inv => {
      const paid = inv.payments.reduce((s, p) => s + p.amountGHS, 0);
      const balance = (inv.totals?.total_ghs ?? inv.totals?.grandTotalGHS ?? inv.totals?.total ?? inv.totals?.grandTotal ?? 0) - paid;
      const isOverdue = balance > 0.01 && inv.dueDate < today;
      return { ...inv, balance, isOverdue };
    })
    .filter(inv => inv.balance > 0.01)
    .sort((a,b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);

  // Use prioritized projects (active/current first, up to 3)
  const activeProjects = prioritizedProjects.slice(0, 3);

  const paymentAccountBalances = useMemo(() => {
    const paymentAccounts = data.accounts.filter(a => a.isPaymentAccount);
    if (paymentAccounts.length === 0) return [];
    const balances: Record<string, number> = {};
    paymentAccounts.forEach(a => { balances[a.code] = 0; });
    data.journal.forEach(e => e.lines.forEach(l => {
      if (balances[l.account] !== undefined) {
        balances[l.account] += l.debit - l.credit;
      }
    }));
    return paymentAccounts.map(a => ({
      code: a.code,
      name: a.name,
      balance: balances[a.code] || 0,
    }));
  }, [data.accounts, data.journal]);

  return (
    <div>
      <SectionTitle sub="A comprehensive snapshot of your firm's financial and operational health.">
        Dashboard
      </SectionTitle>

      {/* Compliance Notifications */}
      {alerts.length > 0 && (
        <div style={{ marginBottom: 24, display: "flex", flexDirection: "column", gap: 8 }}>
          {alerts.map((alert, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: PAPER_RAISED, border: `1px solid ${alert.color}`, borderLeft: `5px solid ${alert.color}`, padding: "12px 16px", borderRadius: 6, boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
              <AlertTriangle size={16} style={{ color: alert.color }} />
              <span style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: INK, fontWeight: 500 }}>{alert.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* 1. Core Financial KPIs */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <KpiCard
          title="Cash & Cash Equivalents"
          value={metrics.cash}
          icon={Banknote}
          accent={GREEN}
          sub={`Cash on Hand, Mobile Money & Bank`}
          detail={
            <>
              <p style={{ margin: "0 0 10px 0" }}>
                Sum of all payment account balances (Cash on Hand, Mobile Money, Bank).
              </p>
              {paymentAccountBalances.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                  {paymentAccountBalances.map(acc => (
                    <div key={acc.code} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                      <span style={{ color: "#94A3B8" }}>{acc.name}</span>
                      <span style={{ fontWeight: 600 }}>GHS {fmt(acc.balance)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 20 }}>
                <div>
                  <div style={{ color: "#94A3B8", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Revenue YTD</div>
                  <div style={{ fontWeight: 600, color: "#4ADE80" }}>GHS {fmt(metrics.totalRevenue)}</div>
                </div>
                <div>
                  <div style={{ color: "#94A3B8", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Expenses YTD</div>
                  <div style={{ fontWeight: 600, color: "#F87171" }}>GHS {fmt(metrics.totalExpenses)}</div>
                </div>
                <div>
                  <div style={{ color: "#94A3B8", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Net Income</div>
                  <div style={{ fontWeight: 600, color: metrics.netIncome >= 0 ? "#4ADE80" : "#F87171" }}>GHS {fmt(metrics.netIncome)}</div>
                </div>
              </div>
            </>
          }
        />
        <KpiCard
          title="Receivables"
          value={metrics.ar}
          icon={ArrowDownRight}
          accent={GOLD}
          sub="Owed by clients"
          detail={
            <>
              <p style={{ margin: "0 0 6px 0" }}>
                Total unpaid invoices from clients. Money expected to flow in.
              </p>
              <div style={{ fontSize: 11, color: "#94A3B8" }}>
                {outstandingInvoices.length > 0 ? (
                  <>
                    <strong style={{ color: "#F87171" }}>{outstandingInvoices.filter(i => i.isOverdue).length} overdue</strong> · {outstandingInvoices.length} outstanding invoices
                  </>
                ) : (
                  "No outstanding invoices — all paid up!"
                )}
              </div>
            </>
          }
        />
        <KpiCard
          title="Payables"
          value={metrics.ap}
          icon={ArrowUpRight}
          accent={ALERT}
          sub="Owed to vendors"
          detail={
            <p style={{ margin: 0 }}>
              Total unpaid bills to vendors and suppliers. Money you owe.
            </p>
          }
        />
      </div>

      {/* 2. Operational Drivers (The Real Engine) */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <KpiCard
          title="Active Contracts"
          value={metrics.totalContractValue}
          icon={Briefcase}
          accent={GREEN}
          sub={`${prioritizedProjects.length} ongoing projects`}
          detail={
            <>
              <p style={{ margin: "0 0 8px 0" }}>
                Combined contract value across all {prioritizedProjects.length} active projects.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {prioritizedProjects.slice(0, 3).map(p => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                    <span style={{ color: "#CBD5E1" }}>{p.name}</span>
                    <span style={{ fontWeight: 600 }}>GHS {fmt(parseFloat(p.contractValue) || 0)}</span>
                  </div>
                ))}
                {prioritizedProjects.length > 3 && (
                  <div style={{ fontSize: 10, color: "#64748B", textAlign: "center" }}>
                    +{prioritizedProjects.length - 3} more projects
                  </div>
                )}
              </div>
            </>
          }
        />
        <KpiCard
          title="Est. Cost (Portfolio)"
          value={metrics.totalEstimatedCost}
          icon={Briefcase}
          accent={INK}
          sub="Total budgeted"
          detail={
            <p style={{ margin: 0 }}>
              Sum of estimated costs for all active projects. This is your planned/budgeted spend.
            </p>
          }
        />
        <KpiCard
          title="Actual Cost to Date"
          value={metrics.totalActualCost}
          icon={TrendingUp}
          accent={GOLD}
          sub={`${metrics.totalEstimatedCost > 0 ? ((metrics.totalActualCost / metrics.totalEstimatedCost) * 100).toFixed(0) : 0}% of budget used`}
          detail={
            <>
              <p style={{ margin: "0 0 8px 0" }}>
                Real expenses posted to journal for active projects. Tracks how much budget has been consumed.
              </p>
              <div style={{ display: "flex", gap: 16 }}>
                <div>
                  <div style={{ color: "#94A3B8", fontSize: 10, textTransform: "uppercase" }}>Budgeted</div>
                  <div style={{ fontWeight: 600 }}>GHS {fmt(metrics.totalEstimatedCost)}</div>
                </div>
                <div>
                  <div style={{ color: "#94A3B8", fontSize: 10, textTransform: "uppercase" }}>Actual</div>
                  <div style={{ fontWeight: 600, color: metrics.totalActualCost > metrics.totalEstimatedCost ? "#F87171" : "#4ADE80" }}>
                    GHS {fmt(metrics.totalActualCost)}
                  </div>
                </div>
              </div>
              {metrics.totalEstimatedCost > 0 && (
                <div style={{ marginTop: 8, height: 4, background: "#374151", borderRadius: 2 }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min((metrics.totalActualCost / metrics.totalEstimatedCost) * 100, 100)}%`,
                      background: metrics.totalActualCost / metrics.totalEstimatedCost > 0.9 ? "#F87171" : metrics.totalActualCost / metrics.totalEstimatedCost > 0.75 ? "#D4AF37" : "#4ADE80",
                      borderRadius: 2,
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
              )}
            </>
          }
        />
        <KpiCard
          title="Projected Margin"
          value={metrics.projectedGrossMargin}
          icon={Scale}
          accent={metrics.projectedGrossMargin >= 0 ? GREEN : ALERT}
          sub={`${metrics.projectedMarginPct.toFixed(1)}% gross margin`}
          detail={
            <>
              <p style={{ margin: "0 0 8px 0" }}>
                Estimated profit after all project costs. Contract value minus estimated cost.
              </p>
              <div style={{ display: "flex", gap: 16 }}>
                <div>
                  <div style={{ color: "#94A3B8", fontSize: 10, textTransform: "uppercase" }}>Contracts</div>
                  <div style={{ fontWeight: 600 }}>GHS {fmt(metrics.totalContractValue)}</div>
                </div>
                <div>
                  <div style={{ color: "#94A3B8", fontSize: 10, textTransform: "uppercase" }}>Est. Costs</div>
                  <div style={{ fontWeight: 600 }}>GHS {fmt(metrics.totalEstimatedCost)}</div>
                </div>
                <div>
                  <div style={{ color: "#94A3B8", fontSize: 10, textTransform: "uppercase" }}>Margin</div>
                  <div style={{ fontWeight: 700, color: metrics.projectedGrossMargin >= 0 ? "#4ADE80" : "#F87171" }}>
                    {metrics.projectedMarginPct.toFixed(1)}%
                  </div>
                </div>
              </div>
            </>
          }
        />
      </div>

      {/* 3. Charts Row */}
      <div className="grid-fin" style={{ marginBottom: 24 }}>
        <Card style={{ flex: "1 1 400px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 16, color: INK, margin: 0 }}>Cash Flow Trend</h3>
            <span style={{ fontSize: 11, color: MUTED }}>Last 6 Movements</span>
          </div>
          <LineChart data={metrics.cashFlowData} />
        </Card>
        
        <Card style={{ flex: "1 1 400px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 16, color: INK, margin: 0 }}>Revenue vs Expenses</h3>
            <div style={{ display: "flex", gap: 12, fontSize: 11, color: MUTED }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, background: GREEN, borderRadius: 2 }}></span>Rev</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, background: ALERT, borderRadius: 2 }}></span>Exp</span>
            </div>
          </div>
          <BarChart data={metrics.barChartData} />
        </Card>
      </div>

      {/* 4. Bottom Grid: Portfolio, Invoices, Projects */}
      <div className="grid-fin" style={{ marginBottom: 24 }}>
        <Card style={{ flex: "1 1 300px" }}>
          <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 16, color: INK, margin: "0 0 16px 0" }}>Contract Value Distribution</h3>
          <DonutChart data={metrics.donutData} />
        </Card>

        <div style={{ flex: "1 1 300px" }}>
          <SectionTitle sub="Sorted by due date.">Outstanding Invoices</SectionTitle>
          <Card>
            {outstandingInvoices.length === 0 ? (
              <p style={{ color: MUTED, fontSize: 13.5 }}>No outstanding invoices. All paid up!</p>
            ) : (
              <TableScroll>
                <table className="table-card" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <Th>Inv #</Th>
                      <Th>Client</Th>
                      <Th right>Balance</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {outstandingInvoices.map(inv => (
                      <tr key={inv.id} className="row-hover" style={{ cursor: "pointer" }} onClick={() => setTab("invoicing")}>
                        <Td mono label="Inv #">{inv.invoiceNumber}</Td>
                        <Td label="Client">{inv.billTo}</Td>
                        <Td right mono bold label="Balance" style={{ color: ALERT }}>GHS {fmt(inv.balance)}</Td>
                        <Td label="Status">
                          {inv.isOverdue ? (
                            <span style={{ color: ALERT, fontWeight: 700, fontSize: 11, background: "var(--alert-bg)", padding: "2px 6px", borderRadius: 4 }}>OVERDUE</span>
                          ) : (
                            <span style={{ color: MUTED, fontSize: 11 }}>Due {inv.dueDate}</span>
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            )}
          </Card>
        </div>
      </div>
      
      {/* 5. Active Projects Health & Recent Activity - SORTED BY ACTIVITY */}
      <div className="grid-fin">
        <div style={{ gridColumn: "1 / -1" }}>
          <SectionTitle sub="Current working projects shown first.">
            Active Projects Health
          </SectionTitle>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {activeProjects.map(p => {
              const costPct = p.estimatedCost > 0 ? (p.actualCost / p.estimatedCost) * 100 : 0;
              const marginPct = p.contractValue > 0 ? (p.wipMargin / p.contractValue) * 100 : 0;
              const isActiveProject = p.isCurrentFocus;
              return (
                <Card key={p.id} style={{ 
                  flex: "1 1 280px",
                  borderLeft: isActiveProject ? `4px solid ${GREEN}` : undefined,
                  boxShadow: isActiveProject ? "0 2px 12px rgba(16,185,129,0.15)" : undefined
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: "center" }}>
                    <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: INK }}>{p.name}</div>
                    {isActiveProject ? (
                      <span style={{ 
                        display: "flex", alignItems: "center", gap: 4,
                        fontSize: 10, fontWeight: 600, color: GREEN, 
                        background: "rgba(16,185,129,0.1)", padding: "3px 8px", borderRadius: 12 
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: GREEN }}></span>
                        CURRENT
                      </span>
                    ) : (
                      <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: p.wipMargin >= 0 ? GREEN : ALERT }}>
                        Margin: {marginPct.toFixed(0)}%
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: MUTED, marginBottom: 8 }}>
                    Contract: GHS {fmt(p.contractValue)} | Est. Cost: GHS {fmt(p.estimatedCost)}
                  </div>
                  <div style={{ background: "var(--paper)", borderRadius: 4, height: 8, overflow: "hidden", border: `1px solid ${RULE}` }}>
                    <div style={{ 
                      width: `${Math.min(costPct, 100)}%`, height: "100%", 
                      background: costPct > 90 ? ALERT : costPct > 75 ? GOLD : GREEN, 
                      transition: "width 0.3s ease" 
                    }}></div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: MUTED, marginTop: 4 }}>
                    <span>Cost Incurred: GHS {fmt(p.actualCost)}</span>
                    <span>{costPct.toFixed(0)}% of Est.</span>
                  </div>
                </Card>
              );
            })}
            {activeProjects.length === 0 && (
              <Card style={{ flex: "1 1 280px" }}>
                <p style={{ color: MUTED, fontSize: 13.5 }}>No active projects to display.</p>
              </Card>
            )}
          </div>
        </div>

        <div style={{ gridColumn: "1 / -1", marginTop: 24 }}>
          <SectionTitle sub="Latest transactions posted.">Recent Activity</SectionTitle>
          <Card>
            {recentEntries.length === 0 ? (
              <p style={{ color: MUTED, fontSize: 13.5 }}>No journal entries posted yet.</p>
            ) : (
              <TableScroll>
                <table className="table-card" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <Th>Date</Th>
                      <Th>Description</Th>
                      <Th right>Amount</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentEntries.map(e => (
                      <tr key={e.id} className="row-hover" style={{ cursor: "pointer" }} onClick={() => setTab("journal")}>
                        <Td label="Date">{e.date}</Td>
                        <Td label="Description">{e.description || "—"}</Td>
                        <Td right mono label="Amount">GHS {fmt(e.lines.reduce((s, l) => s + l.debit, 0))}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
// ---------- Panels ----------

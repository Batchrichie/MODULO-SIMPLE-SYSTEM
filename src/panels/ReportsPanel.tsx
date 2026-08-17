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

export default function ReportsPanel({ data }: { data: AppData }) {
  const today = new Date().toISOString().slice(0, 10);

  /* ---------- Aged Receivables ---------- */
  const aged = useMemo(() => {
    const buckets = {
      current: [] as Invoice[],
      d30: [] as Invoice[],
      d60: [] as Invoice[],
      d90: [] as Invoice[],
      d90plus: [] as Invoice[],
    };
    const totals = { current: 0, d30: 0, d60: 0, d90: 0, d90plus: 0 };

    data.invoices.forEach((inv) => {
      const paid = inv.payments.reduce((s, p) => s + p.amountGHS, 0);
      const balance = (inv.totals?.total_ghs ?? inv.totals?.grandTotalGHS ?? inv.totals?.total ?? inv.totals?.grandTotal ?? 0) - paid;
      if (balance <= 0.01) return;

      const daysOverdue = Math.floor(
        (new Date(today).getTime() - new Date(inv.dueDate || inv.date).getTime()) /
          (1000 * 60 * 60 * 24)
      );

      if (daysOverdue <= 0) {
        buckets.current.push(inv);
        totals.current += balance;
      } else if (daysOverdue <= 30) {
        buckets.d30.push(inv);
        totals.d30 += balance;
      } else if (daysOverdue <= 60) {
        buckets.d60.push(inv);
        totals.d60 += balance;
      } else if (daysOverdue <= 90) {
        buckets.d90.push(inv);
        totals.d90 += balance;
      } else {
        buckets.d90plus.push(inv);
        totals.d90plus += balance;
      }
    });

    return { buckets, totals };
  }, [data, today]);

  const bucketMeta = [
    { key: 'current' as const, label: 'Current (Not yet due)', color: GREEN },
    { key: 'd30' as const, label: '1 – 30 days overdue', color: GOLD },
    { key: 'd60' as const, label: '31 – 60 days overdue', color: '#E67E22' },
    { key: 'd90' as const, label: '61 – 90 days overdue', color: ALERT },
    { key: 'd90plus' as const, label: '90+ days overdue', color: '#7B241C' },
  ];

  const totalOutstanding =
    aged.totals.current +
    aged.totals.d30 +
    aged.totals.d60 +
    aged.totals.d90 +
    aged.totals.d90plus;

  /* ---------- Project Profitability ---------- */
  const projReport = useMemo(() => {
    return data.projects.map((p) => {
      const revenue = data.invoices
        .filter((inv) => inv.project === p.id && inv.status !== 'Void')
        .reduce((s, inv) => s + (inv.totals?.total_ghs ?? inv.totals?.grandTotalGHS ?? inv.totals?.total ?? inv.totals?.grandTotal ?? 0), 0);
      const costs = data.journal
        .filter((je) => je.project === p.id)
        .flatMap((je) => je.lines)
        .filter((l) => {
          const acc = data.accounts.find((a) => a.code === l.account);
          return acc && acc.type === 'Expense';
        })
        .reduce((s, l) => s + l.debit, 0);
      const margin = revenue - costs;
      const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;
      return {
        id: p.id,
        name: p.name,
        status: p.status,
        contractValue: p.contractValue ?? 0,
        revenue,
        costs,
        margin,
        marginPct,
      };
    });
  }, [data]);

  return (
    <div>
      {/* ---- Aged Receivables ---- */}
      <SectionTitle sub="Outstanding client balances grouped by how long they have been overdue.">
        Aged Receivables
      </SectionTitle>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        {bucketMeta.map((b) => (
          <Card key={b.key} style={{ flex: '1 1 160px', borderTop: `3px solid ${b.color}` }}>
            <div style={{ fontSize: 11, color: MUTED, fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>
              {b.label}
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 20, fontWeight: 700, color: INK }}>
              GHS {fmt(aged.totals[b.key])}
            </div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
              {aged.buckets[b.key].length} invoice{aged.buckets[b.key].length === 1 ? '' : 's'}
            </div>
          </Card>
        ))}
        <Card style={{ flex: '1 1 160px', borderTop: `3px solid ${INK}` }}>
          <div style={{ fontSize: 11, color: MUTED, fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>
            Total Outstanding
          </div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 20, fontWeight: 700, color: INK }}>
            GHS {fmt(totalOutstanding)}
          </div>
        </Card>
      </div>

      <Card style={{ marginBottom: 32 }}>
        <TableScroll>
          <table className="table-card" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <Th>Client</Th>
                <Th>Invoice #</Th>
                <Th>Date</Th>
                <Th>Due Date</Th>
                <Th right>Days Overdue</Th>
                <Th right>Balance (GHS)</Th>
                <Th>Bucket</Th>
              </tr>
            </thead>
            <tbody>
              {bucketMeta.flatMap((b) =>
                aged.buckets[b.key].map((inv) => {
                  const paid = inv.payments.reduce((s, p) => s + p.amountGHS, 0);
                  const balance = (inv.totals.grandTotalGHS ?? inv.totals.grandTotal) - paid;
                  const days = Math.floor(
                    (new Date(today).getTime() - new Date(inv.dueDate || inv.date).getTime()) /
                      (1000 * 60 * 60 * 24)
                  );
                  return (
                    <tr key={inv.id} className="row-hover">
                      <Td label="Client">{inv.billTo}</Td>
                      <Td mono label="Invoice #">{inv.invoiceNumber}</Td>
                      <Td label="Date">{inv.date}</Td>
                      <Td label="Due Date">{inv.dueDate || '—'}</Td>
                      <Td right mono label="Days Overdue" style={{ color: days > 0 ? ALERT : MUTED }}>
                        {days > 0 ? `+${days}` : '0'}
                      </Td>
                      <Td right mono bold label="Balance">GHS {fmt(balance)}</Td>
                      <Td label="Bucket">
                        <span style={{ color: b.color, fontWeight: 700, fontSize: 11 }}>{b.label}</span>
                      </Td>
                    </tr>
                  );
                })
              )}
              {totalOutstanding === 0 && (
                <tr>
                  <td colSpan={7} style={{ color: MUTED, padding: 14, textAlign: 'center' }}>
                    No outstanding invoices. All paid up!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableScroll>
      </Card>

      {/* ---- Project Profitability ---- */}
      <SectionTitle sub="Revenue billed versus costs booked per project.">Project Profitability</SectionTitle>
      <Card>
        <TableScroll>
          <table className="table-card" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <Th>Project</Th>
                <Th>Status</Th>
                <Th right>Contract Value</Th>
                <Th right>Revenue Billed</Th>
                <Th right>Actual Cost</Th>
                <Th right>Gross Margin</Th>
                <Th right>Margin %</Th>
              </tr>
            </thead>
            <tbody>
              {projReport.map((p) => (
                <tr key={p.id} className="row-hover">
                  <Td label="Project">{p.name}</Td>
                  <Td label="Status">{p.status || '—'}</Td>
                  <Td right mono label="Contract Value">GHS {fmt(p.contractValue)}</Td>
                  <Td right mono label="Revenue Billed">GHS {fmt(p.revenue)}</Td>
                  <Td right mono label="Actual Cost">GHS {fmt(p.costs)}</Td>
                  <Td right mono bold label="Gross Margin" style={{ color: p.margin >= 0 ? GREEN : ALERT }}>
                    GHS {fmt(p.margin)}
                  </Td>
                  <Td right mono bold label="Margin %" style={{ color: p.marginPct >= 0 ? GREEN : ALERT }}>
                    {p.marginPct.toFixed(1)}%
                  </Td>
                </tr>
              ))}
              {projReport.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ color: MUTED, padding: 14, textAlign: 'center' }}>
                    No projects to report.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableScroll>
      </Card>
    </div>
  );
}


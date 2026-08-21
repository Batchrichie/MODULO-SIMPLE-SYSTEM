import React, { useState, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  BookOpen, PenLine, Scale, Users, Banknote, FileSpreadsheet,
  Plus, Trash2, Printer, Check, AlertTriangle, Settings2, Briefcase,
  Receipt, TrendingUp, X, Sun, Moon, LayoutDashboard,
  ArrowUpRight, ArrowDownRight, FileText, MoreHorizontal, Landmark,
} from "lucide-react";
import { INK, PAPER, PAPER_RAISED, RULE, GREEN, GREEN_DEEP, GOLD, ALERT, MUTED,
         FONT_DISPLAY, FONT_BODY, FONT_MONO } from "../theme/tokens";
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

export default function AgedPayablesPanel({ data }: { data: AppData }) {
  const today = new Date().toISOString().slice(0, 10);

  const aged = useMemo(() => {
    const buckets = {
      current: [] as Bill[],
      d30: [] as Bill[],
      d60: [] as Bill[],
      d90: [] as Bill[],
      d90plus: [] as Bill[],
    };
    const totals = { current: 0, d30: 0, d60: 0, d90: 0, d90plus: 0 };

    data.bills.forEach((bill) => {
      const paid = bill.payments.reduce((s, p) => s + p.amount, 0);
      const balance = bill.amount - paid;
      if (balance <= 0.01) return;

      const daysOverdue = Math.floor(
        (new Date(today).getTime() - new Date(bill.dueDate || bill.date).getTime()) /
          (1000 * 60 * 60 * 24)
      );

      if (daysOverdue <= 0) {
        buckets.current.push(bill);
        totals.current += balance;
      } else if (daysOverdue <= 30) {
        buckets.d30.push(bill);
        totals.d30 += balance;
      } else if (daysOverdue <= 60) {
        buckets.d60.push(bill);
        totals.d60 += balance;
      } else if (daysOverdue <= 90) {
        buckets.d90.push(bill);
        totals.d90 += balance;
      } else {
        buckets.d90plus.push(bill);
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

  return (
    <div>
      <SectionTitle sub="Outstanding vendor balances grouped by how long they have been overdue.">
        Aged Payables
      </SectionTitle>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        {bucketMeta.map((b) => (
          <Card key={b.key} style={{ flex: '1 1 160px', borderTop: `3px solid ${b.color}` }}>
            <div style={{ fontSize: 11, color: MUTED, fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>
              {b.label}
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 20, fontWeight: 700, color: INK }}>
              GHS {fmt(aged.totals[b.key])}
            </div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
              {aged.buckets[b.key].length} bill{aged.buckets[b.key].length === 1 ? '' : 's'}
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

      <Card>
        <TableScroll>
          <table className="table-card" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <Th>Vendor</Th>
                <Th>Bill #</Th>
                <Th>Date</Th>
                <Th>Due Date</Th>
                <Th right>Days Overdue</Th>
                <Th right>Balance (GHS)</Th>
                <Th>Bucket</Th>
              </tr>
            </thead>
            <tbody>
              {bucketMeta.flatMap((b) =>
                aged.buckets[b.key].map((bill) => {
                  const paid = bill.payments.reduce((s, p) => s + p.amount, 0);
                  const balance = bill.amount - paid;
                  const days = Math.floor(
                    (new Date(today).getTime() - new Date(bill.dueDate || bill.date).getTime()) /
                      (1000 * 60 * 60 * 24)
                  );
                  return (
                    <tr key={bill.id} className="row-hover">
                      <Td label="Vendor">{bill.vendor}</Td>
                      <Td mono label="Bill #">{bill.billNumber}</Td>
                      <Td label="Date">{bill.date}</Td>
                      <Td label="Due Date">{bill.dueDate || '—'}</Td>
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
                    No outstanding payables. All bills paid!
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

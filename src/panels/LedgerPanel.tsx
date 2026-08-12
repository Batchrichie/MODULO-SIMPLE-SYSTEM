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

export default function LedgerPanel({ data }) {
  const rows = useMemo(() => {
    return data.accounts.map((a) => {
      let debit = 0,
        credit = 0;
      data.journal.forEach((e) =>
        e.lines.forEach((l) => {
          if (l.account === a.code) {
            debit += l.debit;
            credit += l.credit;
          }
        })
      );
      const rawBalance = a.normal === "Debit" ? debit - credit : credit - debit;
      const signedBalance = Math.abs(rawBalance);
      const isPaymentAbnormal = Boolean(a.isPaymentAccount) && rawBalance < 0;
      const balanceSide = rawBalance >= 0
        ? (a.normal === "Debit" ? "Dr" : "Cr")
        : (a.normal === "Debit" ? "Cr" : "Dr");
      return { ...a, debit, credit, rawBalance, balance: signedBalance, balanceSide, isPaymentAbnormal };
    });
  }, [data]);

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <div>
      <SectionTitle sub="Live totals from every posted journal entry.">
        Trial Balance
      </SectionTitle>
      <Card>
        <TableScroll>
          <table
            className="table-card"
            style={{ width: "100%", borderCollapse: "collapse" }}
          >
            <thead>
              <tr>
                <Th>Code</Th>
                <Th>Account</Th>
                <Th right>Total Debit</Th>
                <Th right>Total Credit</Th>
                <Th right>Balance</Th>
              </tr>
            </thead>
            <tbody>
              {rows
                .filter((r) => r.debit || r.credit)
                .map((r) => (
                  <tr key={r.code} className="row-hover">
                    <Td mono label="Code">
                      {r.code}
                    </Td>
                    <Td label="Account">{r.name}</Td>
                    <Td right mono label="Total Debit">
                      {fmt(r.debit)}
                    </Td>
                    <Td right mono label="Total Credit">
                      {fmt(r.credit)}
                    </Td>
                    <Td right mono bold label="Balance" style={{ color: r.isPaymentAbnormal ? ALERT : r.rawBalance >= 0 ? INK : ALERT }}>
                      {r.balance > 0 ? `${r.balanceSide} ${fmt(r.balance)}` : "—"}
                    </Td>
                  </tr>
                ))}
              {rows.every((r) => !r.debit && !r.credit) && (
                <tr>
                  <td colSpan={5} style={{ color: MUTED, padding: 10 }}>
                    No activity yet.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <Td bold label="Total">
                  Total
                </Td>
                <Td label="Account"></Td>
                <Td right mono bold label="Total Debit">
                  {fmt(totalDebit)}
                </Td>
                <Td right mono bold label="Total Credit">
                  {fmt(totalCredit)}
                </Td>
                <Td
                  right
                  mono
                  bold
                  label="Balance"
                  style={{ color: isBalanced ? GREEN : ALERT }}
                >
                  {isBalanced ? "Balanced ✓" : "Out of balance"}
                </Td>
              </tr>
            </tfoot>
          </table>
        </TableScroll>
      </Card>
    </div>
  );
}

// NOTE: Financial calculations are now provided by database views/RPC.
// Local computePL and computeBalanceSheet were removed in Stage 1 and
// FinancialsPanel is wired to fetch the pre-calculated results.

function computeCashFlow(data) {
  const rows = [];
  let running = 0;
  const sorted = [...data.journal].sort((a, b) => (a.date > b.date ? 1 : -1));
  sorted.forEach((e) => {
    const net = e.lines.reduce(
      (s, l) => s + (l.account === "1000" ? l.debit - l.credit : 0),
      0
    );
    if (net !== 0) {
      running += net;
      rows.push({
        date: e.date,
        description: e.description,
        entryNumber: e.entryNumber,
        net,
        running,
      });
    }
  });
  return rows;
}


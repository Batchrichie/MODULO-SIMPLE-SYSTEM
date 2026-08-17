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
import { projectStatsFn } from "../utils/dashboardUtils";
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

export default function ExportPanel({ data, isMobile }) {
  function exportExcel() {
    const wb = XLSX.utils.book_new();
    const coaSheet = XLSX.utils.json_to_sheet(
      data.accounts.map((a) => ({
        Code: a.code,
        Name: a.name,
        Type: a.type,
        "Normal Balance": a.normal,
      }))
    );
    XLSX.utils.book_append_sheet(wb, coaSheet, "Chart of Accounts");

    const journalRows = [];
    data.journal.forEach((e) =>
      e.lines.forEach((l) => {
        const acc = data.accounts.find((a) => a.code === l.account);
        journalRows.push({
          Entry: e.entryNumber,
          Date: e.date,
          Description: e.description,
          Project: projectName(data.projects, e.project),
          Account: `${l.account} — ${acc ? acc.name : ""}`,
          Debit: l.debit || "",
          Credit: l.credit || "",
        });
      })
    );
    const jSheet = XLSX.utils.json_to_sheet(journalRows);
    XLSX.utils.book_append_sheet(wb, jSheet, "Journal Entries");

    const tbRows = data.accounts
      .map((a) => {
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
        const isPaymentAbnormal = Boolean(a.isPaymentAccount) && rawBalance < 0;
        const balanceSide = rawBalance >= 0
          ? (a.normal === "Debit" ? "Dr" : "Cr")
          : (a.normal === "Debit" ? "Cr" : "Dr");
        return {
          Code: a.code,
          Account: a.name,
          "Total Debit": debit,
          "Total Credit": credit,
          Balance: Math.abs(rawBalance),
          "Balance Side": balanceSide,
          "Abnormal": isPaymentAbnormal ? "Yes" : "No",
        };
      })
      .filter((r) => r["Total Debit"] || r["Total Credit"]);
    const tbSheet = XLSX.utils.json_to_sheet(tbRows);
    XLSX.utils.book_append_sheet(wb, tbSheet, "Trial Balance");

    const projRows = projectStatsFn(data).map((p) => ({
      Project: p.name,
      Status: p.status || "",
      "Contract Value": p.contractValue,
      "Revenue Billed": p.revenueBilled,
      "Actual Cost": p.actualCost,
      "Estimated Cost": p.estimatedCost,
      "Remaining Cost": p.remainingCost,
      "Projected Margin": p.projectedMargin,
    }));
    const prjSheet = XLSX.utils.json_to_sheet(projRows);
    XLSX.utils.book_append_sheet(wb, prjSheet, "Projects");

    const invRows = [];
    data.invoices.forEach((inv) => {
      const paid = inv.payments.reduce((s, p) => s + p.amountGHS, 0);
      invRows.push({
        "Invoice #": inv.invoiceNumber,
        Date: inv.date,
        "Bill To": inv.billTo,
        Project: inv.projectLabel,
        Currency: inv.currency,
        "Grand Total": inv.totals?.total ?? inv.totals?.grandTotal ?? 0,
        "Grand Total (GHS)": inv.totals?.total_ghs ?? inv.totals?.grandTotalGHS ?? inv.totals?.total ?? inv.totals?.grandTotal ?? 0,
        "Paid (GHS)": paid,
        "Balance (GHS)": (inv.totals?.total_ghs ?? inv.totals?.grandTotalGHS ?? inv.totals?.total ?? inv.totals?.grandTotal ?? 0) - paid,
        Status: inv.status,
      });
    });
    const invSheet = XLSX.utils.json_to_sheet(invRows);
    XLSX.utils.book_append_sheet(wb, invSheet, "Invoices");

    const payrollRows = [];
    data.payrollRuns.forEach((run) =>
      run.rows.forEach((r) => {
        payrollRows.push({
          Period: run.period,
          Employee: r.name,
          Gross: r.gross,
          "SSNIT (Employee)": r.ssnitEmployee,
          "SSNIT (Employer)": r.ssnitEmployer,
          PAYE: r.paye,
          "Net Pay": r.net,
        });
      })
    );
    const pSheet = XLSX.utils.json_to_sheet(payrollRows);
    XLSX.utils.book_append_sheet(wb, pSheet, "Payroll");

    XLSX.writeFile(
      wb,
      `${data.companyName.replace(/\s+/g, "_")}_ledger_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`
    );
  }

  return (
    <div>
      <SectionTitle sub="One workbook with your chart of accounts, journal, trial balance, projects, invoices, and payroll.">
        Export
      </SectionTitle>
      <Card style={{ textAlign: "center" }}>
        <p
          style={{
            fontFamily: FONT_BODY,
            fontSize: 13.5,
            color: INK,
            marginBottom: 16,
          }}
        >
          Download everything as an Excel file, ready whenever you need it for
          your records or your accountant.
        </p>
        <Button
          onClick={exportExcel}
          icon={FileSpreadsheet}
          fullWidth={isMobile}
        >
          Export to Excel
        </Button>
      </Card>
    </div>
  );
}

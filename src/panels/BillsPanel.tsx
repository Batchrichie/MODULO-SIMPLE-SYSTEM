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
import AccountSelect from "../components/ui/AccountSelect";
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
  getSession, onAuthStateChange, signOut, runPayrollAndFetch,
  findAccountByRole, postJournalEntry
} from "../supabaseClient";
import type { AppData, MutateFn, PanelProps, InvoicingPanelProps, PayrollPanelProps,
             NewInvoiceFormProps, RecordPaymentFormProps, InvoiceDocumentProps,
             ReceiptDocumentProps, PayslipProps, ProjectStats } from "../types";

export default function BillsPanel({ data, mutate }: PanelProps) {
  const [showNew, setShowNew] = useState(false);
  const [payingBill, setPayingBill] = useState<Bill | null>(null);
  const [vendor, setVendor] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [project, setProject] = useState("GEN");
  const [expenseAccount, setExpenseAccount] = useState("");

  const expenseAccounts = data.accounts.filter((a) => a.type === "Expense");
  const makeTempId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  async function createBill() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      window.alert("Please enter a valid amount.");
      return;
    }
    if (!vendor.trim()) {
      window.alert("Please enter a vendor name.");
      return;
    }
    if (!expenseAccount) {
      window.alert("Please select an expense account.");
      return;
    }

    const billNumber = makeTempId("BL");
    const bill: Bill = {
      id: billNumber,
      billNumber,
      date,
      dueDate: dueDate || date,
      vendor: vendor.trim(),
      description: description.trim() || null,
      project: project === "GEN" ? null : project,
      amount: amt,
      status: "Unpaid",
      payments: [],
    };

    const apAccount = findAccountByRole(data.accounts, "ap");
    if (!apAccount) {
      window.alert("Accounts Payable account not configured. Please contact your admin.");
      return;
    }

    const entryNumber = makeTempId("JE");
    const entry: JournalEntry = {
      id: entryNumber,
      entryNumber,
      date,
      description: `Bill ${billNumber} — ${vendor.trim()}`,
      period: date.slice(0, 7),
      project: project === "GEN" ? null : project,
      lines: [
        { account: expenseAccount, debit: amt, credit: 0 },
        { account: apAccount.code, debit: 0, credit: amt },
      ],
    };

    mutate((d) => ({
      ...d,
      bills: [bill, ...d.bills],
      journal: [entry, ...d.journal],
    }));

    try {
      await db.saveBill(bill);
      await postJournalEntry(
        entry.date,
        entry.description ?? null,
        entry.project ?? null,
        entry.lines.map((line) => ({
          account: line.account,
          debit: Number(line.debit) || 0,
          credit: Number(line.credit) || 0,
        }))
      );
    } catch (err: any) {
      console.error("Failed to save bill:", err);
      const errorMsg = err?.message || err?.toString?.() || "Unknown error occurred";
      window.alert(`Failed to save bill: ${errorMsg}`);
      return;
    }

    setVendor("");
    setDescription("");
    setAmount("");
    setDueDate("");
    setExpenseAccount("");
    setShowNew(false);
  }

  async function recordPayment(bill: Bill) {
    if (!payingBill) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      window.alert("Please enter a valid payment amount.");
      return;
    }

    const paymentId = "BPT-" + Date.now();
    const payment: BillPayment = {
      id: paymentId,
      date,
      amount: amt,
      method: "Bank",
      reference: "",
    };

    const paidSoFar = bill.payments.reduce((s, p) => s + p.amount, 0) + amt;
    const newStatus: Bill['status'] =
      paidSoFar >= bill.amount - 0.01 ? "Paid" : "Partially Paid";

    const updatedBill = { ...bill, payments: [...bill.payments, payment], status: newStatus };

    const apAccount = findAccountByRole(data.accounts, "ap");
    const cashAccount = findAccountByRole(data.accounts, "cash");
    if (!apAccount || !cashAccount) {
      window.alert("Accounts Payable or Cash account not configured. Please contact your admin.");
      return;
    }

    const entryNumber = makeTempId("JE");
    const entry: JournalEntry = {
      id: entryNumber,
      entryNumber,
      date,
      description: `Payment — ${bill.billNumber} (${bill.vendor})`,
      period: date.slice(0, 7),
      project: bill.project,
      lines: [
        { account: apAccount.code, debit: amt, credit: 0 },
        { account: cashAccount.code, debit: 0, credit: amt },
      ],
    };

    mutate((d) => ({
      ...d,
      bills: d.bills.map((b) => (b.id === bill.id ? updatedBill : b)),
      journal: [entry, ...d.journal],
    }));

    try {
      await db.saveBill(updatedBill);
      await postJournalEntry(
        entry.date,
        entry.description ?? null,
        entry.project ?? null,
        entry.lines.map((line) => ({
          account: line.account,
          debit: Number(line.debit) || 0,
          credit: Number(line.credit) || 0,
        }))
      );
    } catch (err: any) {
      console.error("Failed to record bill payment:", err);
      const errorMsg = err?.message || err?.toString?.() || "Unknown error occurred";
      window.alert(`Failed to record payment: ${errorMsg}`);
      return;
    }

    setPayingBill(null);
    setAmount("");
  }

  return (
    <div>
      <SectionTitle
        sub="Record vendor bills and track what you owe. Payments post automatically to the ledger."
        action={
          mutate ? (
            <Button onClick={() => setShowNew(true)} icon={Plus}>
              New bill
            </Button>
          ) : undefined
        }
      >
        Bills & Payables
      </SectionTitle>

      <Card>
        <TableScroll>
          <table className="table-card" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <Th>Bill #</Th>
                <Th>Vendor</Th>
                <Th>Due Date</Th>
                <Th right>Amount</Th>
                <Th right>Paid</Th>
                <Th right>Balance</Th>
                <Th>Status</Th>
                <Th right>&nbsp;</Th>
              </tr>
            </thead>
            <tbody>
              {data.bills.map((bill) => {
                const paid = bill.payments.reduce((s, p) => s + p.amount, 0);
                const balance = bill.amount - paid;
                return (
                  <tr key={bill.id} className="row-hover">
                    <Td mono label="Bill #">{bill.billNumber}</Td>
                    <Td label="Vendor">{bill.vendor}</Td>
                    <Td label="Due Date">{bill.dueDate || "—"}</Td>
                    <Td right mono label="Amount">GHS {fmt(bill.amount)}</Td>
                    <Td right mono label="Paid">GHS {fmt(paid)}</Td>
                    <Td right mono bold label="Balance" style={{ color: balance > 0.01 ? ALERT : GREEN }}>
                      GHS {fmt(balance)}
                    </Td>
                    <Td label="Status">{bill.status}</Td>
                    <Td right label="Action">
                      {mutate && balance > 0.01 && (
                        <Button variant="ghost" icon={Banknote} onClick={() => { setPayingBill(bill); setDate(new Date().toISOString().slice(0, 10)); }}>
                          Pay
                        </Button>
                      )}
                    </Td>
                  </tr>
                );
              })}
              {data.bills.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ color: MUTED, padding: 10 }}>
                    No bills recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableScroll>
      </Card>

      {showNew && (
        <Modal title="New Vendor Bill" sub="Record what you owe a vendor." onClose={() => setShowNew(false)}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <div style={{ flex: "1 1 150px" }}>
              <label style={labelStyle}>Vendor</label>
              <input style={inputStyle} value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="e.g. Shell Ghana" />
            </div>
            <div style={{ flex: "2 1 200px" }}>
              <label style={labelStyle}>Description</label>
              <input style={inputStyle} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Diesel for generators" />
            </div>
            <div style={{ flex: "1 1 120px" }}>
              <label style={labelStyle}>Amount (GHS)</label>
              <input style={inputStyle} value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.00" />
            </div>
            <div style={{ flex: "1 1 120px" }}>
              <label style={labelStyle}>Date</label>
              <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div style={{ flex: "1 1 120px" }}>
              <label style={labelStyle}>Due Date</label>
              <input type="date" style={inputStyle} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div style={{ flex: "1 1 150px" }}>
              <label style={labelStyle}>Expense Account</label>
              <AccountSelect
                value={expenseAccount}
                onChange={setExpenseAccount}
                accounts={expenseAccounts}
                placeholder="Search expense account…"
              />
            </div>
            <div style={{ flex: "1 1 150px" }}>
              <label style={labelStyle}>Project</label>
              <ProjectSelect value={project} onChange={setProject} projects={data.projects} />
            </div>
            <Button onClick={createBill} icon={Plus} fullWidth>Post bill</Button>
          </div>
        </Modal>
      )}

      {payingBill && (
        <Modal title={`Pay bill — ${payingBill.billNumber}`} onClose={() => setPayingBill(null)}>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: MUTED }}>
              Outstanding: <b style={{ color: INK }}>GHS {fmt(payingBill.amount - payingBill.payments.reduce((s, p) => s + p.amount, 0))}</b>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <div style={{ flex: "1 1 150px" }}>
                <label style={labelStyle}>Payment Date</label>
                <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div style={{ flex: "1 1 150px" }}>
                <label style={labelStyle}>Amount (GHS)</label>
                <input style={inputStyle} value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.00" />
              </div>
            </div>
            <Button onClick={() => recordPayment(payingBill)} icon={Check} fullWidth>Record payment</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* App-level overrides — layout is handled inline in App.tsx */

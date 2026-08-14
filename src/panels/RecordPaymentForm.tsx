import React, { useState } from "react";
import { Check } from "lucide-react";
import { INK, MUTED, FONT_BODY } from "../theme/tokens";
import Button from "../components/ui/Button";
import { inputStyle, labelStyle } from "../components/ui/styles";
import AccountSelect from "../components/ui/AccountSelect";
import { fmt } from "../utils/format";
import { getInvoiceBalance, getInvoicePaidAmount } from "../utils/invoiceUtils";
import { db } from "../supabaseClient";
import ReceiptDocument from "../documents/ReceiptDocument";
import { assertPayment } from "../validation";
import type { RecordPaymentFormProps } from "../types";

export default function RecordPaymentForm({ data, mutate, inv, onDone, setPrintContent }: RecordPaymentFormProps) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [paymentAccount, setPaymentAccount] = useState("");
  const [reference, setReference] = useState("");

  const paymentAccounts = data.accounts.filter(a => a.isPaymentAccount);

  async function record() {
    const amt = parseFloat(amount);
    const err = assertPayment(amt);
    if (err) { window.alert(err); return; }
    if (!paymentAccount) { window.alert("Please select a payment account."); return; }

    const paymentId = "PYT-" + Date.now();
    const payment = { id: paymentId, date, amountGHS: amt, method: paymentAccount, reference };
    const totalGhs = Number(inv.totals?.grandTotalGHS ?? inv.totals?.grandTotal ?? 0) || 0;
    const paidSoFar = getInvoicePaidAmount(inv) + amt;
    const newStatus = paidSoFar >= totalGhs - 0.01 ? "Paid" : "Partially Paid";

    const entryNumber = `JE-${String(data.nextEntryNum).padStart(4, "0")}`;
    const entry = {
      id: entryNumber,
      entryNumber,
      date,
      description: `Payment received — ${inv.invoiceNumber} (${inv.billTo})`,
      period: date.slice(0, 7),
      project: inv.project,
      lines: [
        { account: paymentAccount, debit: amt, credit: 0 },
        { account: "1130", debit: 0, credit: amt },
      ],
    };

    const updatedInvoice = {
      ...inv,
      payments: [...inv.payments, payment],
      status: newStatus,
    };

    const receiptNo = `PYT${String(
      data.invoices.findIndex((i) => i.id === inv.id) * 10 +
        inv.payments.length + 1
    ).padStart(3, "0")}`;

    mutate((d) => ({
      ...d,
      invoices: d.invoices.map((i) => i.id === inv.id ? updatedInvoice : i),
      journal: [entry, ...d.journal],
      nextEntryNum: d.nextEntryNum + 1,
    }));

    try {
      await db.saveInvoice(updatedInvoice);
      await db.saveJournalEntry(entry);
    } catch (err) {
      console.error("Failed to persist payment or journal entry:", err);
      window.alert("Failed to record payment to server. Check console for details.");
    }

    const receiptInvoice = updatedInvoice;
    const receiptData = {
      ...data,
      invoices: data.invoices.map((i) => i.id === inv.id ? receiptInvoice : i),
    };

    document.title = `Receipt_${receiptNo}_${(inv.billTo || "Client").replace(/\s+/g, "_")}`;
    setPrintContent(
      <ReceiptDocument data={receiptData} inv={receiptInvoice} payment={payment} receiptNo={receiptNo} />
    );
    onDone && onDone();
  }

  const balance = getInvoiceBalance(inv, data);
  const balanceBackground = `GHS ${fmt(balance)}`;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: MUTED }}>
        Outstanding balance: <b style={{ color: INK }}>GHS {fmt(balance)}</b>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <div style={{ flex: "1 1 150px" }}>
          <label style={labelStyle}>Date</label>
          <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div style={{ flex: "1 1 150px" }}>
          <label style={labelStyle}>Amount (GHS)</label>
          <div style={{ position: "relative" }}>
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                padding: "0 12px",
                color: "rgba(148, 163, 184, 0.72)",
                fontWeight: 600,
                fontSize: 14,
                pointerEvents: "none",
                whiteSpace: "nowrap",
                overflow: "hidden",
                opacity: amount ? 0 : 1,
              }}
            >
              {balanceBackground}
            </span>
            <input
              style={{
                ...inputStyle,
                color: amount ? INK : "transparent",
                caretColor: INK,
              }}
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            />
          </div>
        </div>
        <div style={{ flex: "1 1 200px" }}>
          <label style={labelStyle}>Paid into *</label>
          <AccountSelect
            value={paymentAccount}
            onChange={setPaymentAccount}
            accounts={paymentAccounts}
            placeholder="Search payment account…"
          />
          {paymentAccounts.length === 0 && (
            <div style={{ fontSize: 11, color: "var(--alert, #A63D40)", marginTop: 4 }}>No payment accounts. Mark accounts in Chart of Accounts first.</div>
          )}
        </div>
        <div style={{ flex: "1 1 150px" }}>
          <label style={labelStyle}>Reference No.</label>
          <input style={inputStyle} value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
      </div>
      <Button onClick={record} icon={Check} fullWidth>
        Record payment & Print Receipt
      </Button>
    </div>
  );
}
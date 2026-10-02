import React, { useState } from "react";
import { Check, AlertTriangle } from "lucide-react";
import { INK, MUTED, FONT_BODY, ALERT } from "../theme/tokens";
import Button from "../components/ui/Button";
import { inputStyle, labelStyle } from "../components/ui/styles";
import AccountSelect from "../components/ui/AccountSelect";
import { fmt } from "../utils/format";
import { getInvoiceBalance } from "../utils/invoiceUtils";
import { recordInvoicePayment, findDefaultPaymentAccount, findPeriodByDate } from "../supabaseClient";
import ReceiptDocument from "../documents/ReceiptDocument";
import { assertPayment } from "../validation";
import type { RecordPaymentFormProps } from "../types";

const PAYMENT_ERROR_MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: "Please sign in before recording a payment.",
  EMPLOYEE_REQUIRED: "Your employee record is required to record a payment.",
  NOT_AUTHORIZED: "You are not authorized to record this invoice payment.",
  INVOICE_NOT_FOUND: "The invoice could not be found.",
  INVOICE_VOID: "A payment cannot be recorded for a void invoice.",
  INVOICE_NOT_POSTED: "This invoice must be posted before receiving payment.",
  INVOICE_TOTALS_INVALID: "The invoice total is invalid. Please contact an administrator.",
  OVERPAYMENT: "This payment exceeds the invoice's outstanding balance.",
  ACCOUNT_NOT_FOUND: "The selected payment account could not be found.",
  ACCOUNT_INVALID: "Select a valid payment account.",
  ACCOUNT_INACTIVE: "The selected payment account is inactive.",
};

function paymentErrorMessage(error: unknown) {
  const backendMessage = error instanceof Error ? error.message : String(error ?? "");
  const knownCode = Object.keys(PAYMENT_ERROR_MESSAGES).find((code) => backendMessage.includes(code));
  return knownCode ? `${PAYMENT_ERROR_MESSAGES[knownCode]} (${knownCode})` : backendMessage || "Payment could not be recorded.";
}

export default function RecordPaymentForm({ data, mutate, inv, onDone, setPrintContent }: RecordPaymentFormProps) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [paymentAccount, setPaymentAccount] = useState(() => {
    const def = findDefaultPaymentAccount(data.accounts);
    return def?.code || "";
  });
  const [reference, setReference] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const paymentAccounts = data.accounts.filter(a => a.isPaymentAccount);

  const closedPayDatePeriod = findPeriodByDate(data.accountingPeriods, date);
  const showPayDateClosedWarn = closedPayDatePeriod?.status === "closed";

  async function record() {
    const amt = parseFloat(amount);
    const err = assertPayment(amt);
    if (err) { setErrorMessage(err); return; }
    if (!paymentAccount) { setErrorMessage("Please select a payment account."); return; }

    setSubmitting(true);
    setErrorMessage("");
    try {
      const result = await recordInvoicePayment({
        invoiceId: inv.id,
        date,
        amount: amt,
        paymentAccountCode: paymentAccount,
        method: null,
        reference: reference.trim() || null,
      });
      const payment = {
        id: result.payment_id,
        date,
        amountGHS: amt,
        method: "Not specified",
        reference: reference.trim() || null,
      };
      const updatedInvoice = {
        ...inv,
        payments: [...inv.payments, payment],
        status: result.invoice_status,
      };
      const receiptNo = result.payment_id;
      const receiptData = {
        ...data,
        invoices: data.invoices.map((invoice) => invoice.id === inv.id ? updatedInvoice : invoice),
      };

      mutate((current) => ({
        ...current,
        invoices: current.invoices.map((invoice) => invoice.id === inv.id ? updatedInvoice : invoice),
      }));

      document.title = `Receipt_${receiptNo}_${(inv.billTo || "Client").replace(/\s+/g, "_")}`;
      setPrintContent(
        <ReceiptDocument
          data={receiptData}
          inv={updatedInvoice}
          payment={payment}
          receiptNo={receiptNo}
          paymentAccountCode={result.payment_account_code}
          journalEntryId={result.journal_entry_id}
          invoiceStatus={result.invoice_status}
          invoiceOutstanding={result.invoice_outstanding}
        />
      );
      onDone && onDone();
    } catch (error) {
      console.error("Failed to record invoice payment:", error);
      setErrorMessage(paymentErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  const balance = getInvoiceBalance(inv, data);
  const balanceBackground = `GHS ${fmt(balance)}`;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: MUTED }}>
        Outstanding balance: <b style={{ color: INK }}>GHS {fmt(balance)}</b>
      </div>
      {errorMessage && <div role="alert" style={{ color: ALERT, fontSize: 12.5 }}>{errorMessage}</div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <div style={{ flex: "1 1 150px" }}>
          <label style={labelStyle}>Date</label>
          <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
          {showPayDateClosedWarn && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, padding: "8px 12px", borderRadius: 8, background: "var(--alert-bg)", border: `1px dashed ${ALERT}`, color: ALERT, fontSize: 12, fontFamily: FONT_BODY }}>
              <AlertTriangle size={14} />
              <span><b>{closedPayDatePeriod!.name}</b> is closed. Transactions cannot be posted to this period.</span>
            </div>
          )}
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
      <Button onClick={record} icon={Check} fullWidth disabled={submitting}>
        {submitting ? "Recording payment..." : "Record payment & Print Receipt"}
      </Button>
    </div>
  );
}
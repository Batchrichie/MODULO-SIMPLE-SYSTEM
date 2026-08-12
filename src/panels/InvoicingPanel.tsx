import React, { useState } from "react";
import { Plus, Trash2, Printer, Banknote } from "lucide-react";
import { INK, GREEN, ALERT, MUTED } from "../theme/tokens";
import Card from "../components/ui/Card";
import SectionTitle from "../components/ui/SectionTitle";
import TableScroll from "../components/ui/TableScroll";
import Th from "../components/ui/Th";
import Td from "../components/ui/Td";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import { inputStyle } from "../components/ui/styles";
import { fmt } from "../utils/format";
import { db } from "../supabaseClient";
import NewInvoiceForm from "./NewInvoiceForm";
import RecordPaymentForm from "./RecordPaymentForm";
import InvoiceDocument from "../documents/InvoiceDocument";
import ReceiptDocument from "../documents/ReceiptDocument";
import type { InvoicingPanelProps, Invoice, InvoiceStatus } from "../types";

export default function InvoicingPanel({ data, mutate, setPrintContent }: InvoicingPanelProps) {
  const [showNew, setShowNew] = useState(false);
  const [payingInv, setPayingInv] = useState<Invoice | null>(null);
  const [cloneSource, setCloneSource] = useState<Invoice | null>(null);
  const [showVoided, setShowVoided] = useState(false);

  async function voidInvoice(inv: Invoice) {
    if (!confirm(`Void invoice ${inv.invoiceNumber}? This will reverse the ledger posting.`)) return;

    const entryNumber = `JE-VOID-${String(data.nextEntryNum).padStart(4, "0")}`;
    const reversalEntry = {
      id: entryNumber,
      entryNumber,
      date: new Date().toISOString().slice(0, 10),
      description: `Void of invoice ${inv.invoiceNumber} — ${inv.billTo}`,
      period: new Date().toISOString().slice(0, 7),
      project: inv.project,
      lines: [
        { account: "1130", debit: 0, credit: inv.totals.grandTotalGHS ?? inv.totals.grandTotal },
        { account: inv.revenueAccount || "4100", debit: inv.totals.newSubtotalGHS ?? inv.totals.newSubtotal, credit: 0 },
        ...(inv.totals.chargeNhil ? [{ account: "2205", debit: inv.totals.nhilGetfundGHS ?? inv.totals.nhilGetfund, credit: 0 }] : []),
        ...(inv.totals.chargeVat ? [{ account: "2220", debit: inv.totals.vatGHS ?? inv.totals.vat, credit: 0 }] : []),
      ],
    };

    const updatedInv = { ...inv, status: "Void" as InvoiceStatus };

    mutate((d) => ({
      ...d,
      invoices: d.invoices.map((i) => (i.id === inv.id ? updatedInv : i)),
      journal: [reversalEntry, ...d.journal],
      nextEntryNum: d.nextEntryNum + 1,
    }));

    try {
      await db.saveInvoice(updatedInv);
      await db.saveJournalEntry(reversalEntry);
    } catch (err) {
      console.error("Failed to void invoice:", err);
      alert("Failed to void invoice on server. Check console for details.");
    }
  }

  const visibleInvoices = showVoided
    ? data.invoices
    : data.invoices.filter((inv) => inv.status !== "Void");

  function doPrint(target) {
    const inv = data.invoices.find((i) => i.id === target.invId);
    if (!inv) return;
    let title = "Document";
    let content = null;

    if (target.type === "invoice") {
      title = `Invoice_${inv.invoiceNumber}_${(inv.billTo || "Client").replace(/\s+/g, "_")}`;
      content = <InvoiceDocument data={data} inv={inv} />;
    } else {
      const payment = inv.payments.find((p) => p.id === target.paymentId);
      if (!payment) return;
      const receiptNo = `PYT${String(
        data.invoices.findIndex((i) => i.id === inv.id) * 10 +
          inv.payments.findIndex((p) => p.id === payment.id) +
          1
      ).padStart(3, "0")}`;
      title = `Receipt_${receiptNo}_${(inv.billTo || "Client").replace(/\s+/g, "_")}`;
      content = (
        <ReceiptDocument
          data={data}
          inv={inv}
          payment={payment}
          receiptNo={receiptNo}
        />
      );
    }

    document.title = title;
    setPrintContent(content);
  }

  return (
    <div>
      <SectionTitle
        sub="Create client invoices with your letterhead, VAT/NHIL/GETFund auto-calculated, and post straight to the ledger."
        action={
          mutate ? (
            <Button onClick={() => setShowNew(true)} icon={Plus}>
              New invoice
            </Button>
          ) : undefined
        }
      >
        Invoicing
      </SectionTitle>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: INK, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={showVoided}
              onChange={(e) => setShowVoided(e.target.checked)}
              style={{ width: 16, height: 16, cursor: "pointer" }}
            />
            Show voided invoices
          </label>
        </div>
        <TableScroll>
          <table
            className="table-card"
            style={{ width: "100%", borderCollapse: "collapse" }}
          >
            <thead>
              <tr>
                <Th>Invoice #</Th>
                <Th>Bill To</Th>
                <Th>Project</Th>
                <Th right>Grand Total</Th>
                <Th right>Paid</Th>
                <Th right>Balance</Th>
                <Th>Status</Th>
                <Th right>&nbsp;</Th>
              </tr>
            </thead>
            <tbody>
              {visibleInvoices.map((inv) => {
                const paid = inv.payments.reduce((s, p) => s + p.amountGHS, 0);
                const balance = inv.totals.grandTotalGHS - paid;
                return (
                  <tr key={inv.id} className="row-hover">
                    <Td mono label="Invoice #">
                      {inv.invoiceNumber}
                    </Td>
                    <Td label="Bill To">{inv.billTo}</Td>
                    <Td label="Project">{inv.projectLabel}</Td>
                    <Td right mono label="Grand Total">
                      {inv.currency} {fmt(inv.totals.grandTotal)}
                    </Td>
                    <Td right mono label="Paid">
                      GHS {fmt(paid)}
                    </Td>
                    <Td
                      right
                      mono
                      bold
                      label="Balance"
                      style={{ color: balance > 0.01 ? ALERT : GREEN }}
                    >
                      {fmt(balance)}
                    </Td>
                    <Td label="Status">{inv.status}</Td>
                    <Td right label="Actions">
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          justifyContent: "flex-end",
                          flexWrap: "wrap",
                        }}
                      >
                        <Button
                          variant="ghost"
                          icon={Printer}
                          onClick={() =>
                            doPrint({ type: "invoice", invId: inv.id })
                          }
                        >
                          Print
                        </Button>
                        {mutate && (
                          <>
                            <Button
                              variant="ghost"
                              icon={Plus}
                              onClick={() => {
                                setCloneSource(inv);
                                setShowNew(true);
                              }}
                            >
                              Clone
                            </Button>
                            {inv.status !== "Void" && (
                              <Button
                                variant="ghost"
                                icon={Trash2}
                                onClick={() => voidInvoice(inv)}
                              >
                                Void
                              </Button>
                            )}
                            {balance > 0.01 && inv.status !== "Void" && (
                              <Button
                                variant="ghost"
                                icon={Banknote}
                                onClick={() => setPayingInv(inv)}
                              >
                                Payment
                              </Button>
                            )}
                          </>
                        )}
                        {inv.payments.length > 0 && (
                          <select
                            style={{
                              ...inputStyle,
                              width: "auto",
                              fontSize: 12,
                              padding: "4px 8px",
                            }}
                            value=""
                            onChange={(e) => {
                              if (e.target.value)
                                doPrint({
                                  type: "receipt",
                                  invId: inv.id,
                                  paymentId: e.target.value,
                                });
                            }}
                          >
                            <option value="">Reprint Receipt…</option>
                            {inv.payments.map((p, i) => (
                              <option key={p.id} value={p.id}>
                                Receipt {i + 1} — GHS {fmt(p.amountGHS)}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
              {data.invoices.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ color: MUTED, padding: 10 }}>
                    No invoices yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableScroll>
      </Card>

      {showNew && (
        <Modal
          title="New invoice"
          sub="VAT, NHIL & GETFund calculate automatically from your line items."
          onClose={() => setShowNew(false)}
          wide
        >
          <NewInvoiceForm
            data={data}
            mutate={mutate}
            onDone={() => {
              setShowNew(false);
              setCloneSource(null);
            }}
            cloneSource={cloneSource}
          />
        </Modal>
      )}
      {payingInv && (
        <Modal
          title={`Record payment — ${payingInv.invoiceNumber}`}
          onClose={() => setPayingInv(null)}
        >
          <RecordPaymentForm
            data={data}
            mutate={mutate}
            inv={payingInv}
            setPrintContent={setPrintContent}
            onDone={() => setPayingInv(null)}
          />
        </Modal>
      )}
    </div>
  );
}


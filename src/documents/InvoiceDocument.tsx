import React from "react";
import { COMPANY_TEMPLATE } from "../constants/defaults";
import { LOGO_SRC } from "../theme/tokens";
import { NAVY, INVOICE_GOLD, computeInvoiceTotals } from "../utils/invoiceUtils";
import { amountInWords } from "../utils/numberToWords";
import { fmt } from "../utils/format";
import { FONT_BODY, FONT_DISPLAY, FONT_MONO } from "../theme/tokens";
import type { AppData, Invoice } from "../types";

// Shared with ReceiptDocument's palette — worth promoting to theme/tokens.ts
// once both documents have settled.
const SUCCESS = "#2F6B4F";
const WARN = "#B8860B";
const ALERT = "#A63D40";
const CREAM = "#F5F2EC";
const RULE = "#D5CEBD";
const INK = "#1A1A1A";
const MUTED = "#6B6B6B";

interface InvoiceDocumentProps {
  data: AppData;
  inv: Invoice;
}

// Build reliable totals ALWAYS by recalculating from line items.
// Stored inv.totals may contain corrupted values from legacy save bugs.
function resolveTotalsGHS(inv: Invoice, data: AppData) {
  const stored = inv.totals;
  const chargeNhil = stored?.chargeNhil ?? false;
  const chargeVat = stored?.chargeVat ?? false;

  const recalc = computeInvoiceTotals(
    inv.items,
    inv.discountPct ?? 0,
    data.nhilGetfundRate ?? 0.025,
    data.vatRate ?? 0.15,
    chargeNhil,
    chargeVat
  );

  const rate = inv.exchangeRate && inv.exchangeRate > 0 ? inv.exchangeRate : 1;

  return {
    subtotal: recalc.subtotal,
    discount: recalc.discount,
    newSubtotal: recalc.newSubtotal,
    nhilGetfund: recalc.nhilGetfund,
    vat: recalc.vat,
    grandTotal: recalc.grandTotal,
    chargeNhil,
    chargeVat,
    _raw: recalc,
    _rate: rate,
  };
}

function getDueStatus(inv: Invoice, grandTotalGHS: number) {
  const paid = (inv.payments || []).reduce((s, p) => s + p.amountGHS, 0);
  const balance = Math.max(grandTotalGHS - paid, 0);

  if (inv.status === "Void") {
    return { label: "Void", color: MUTED, balance };
  }
  if (balance < 0.01) {
    return { label: "Paid in Full", color: SUCCESS, balance: 0 };
  }
  if (!inv.dueDate) {
    return { label: paid > 0 ? "Partially Paid" : "Awaiting Payment", color: WARN, balance };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(inv.dueDate);
  due.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86400000);

  if (days < 0) return { label: `Overdue ${Math.abs(days)}d`, color: ALERT, balance };
  if (days === 0) return { label: "Due Today", color: WARN, balance };
  return { label: `Due in ${days}d`, color: paid > 0 ? WARN : NAVY, balance };
}

export default function InvoiceDocument({ data, inv }: InvoiceDocumentProps) {
  const t = resolveTotalsGHS(inv, data);
  const cur = inv.currency;
  const sym = "GHS";
  const company = data.company || COMPANY_TEMPLATE;
  const due = getDueStatus(inv, t.grandTotal);

  const formatDate = (value?: string | null) => {
    if (!value) return "—";
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const s = {
    container: {
      background: "#fff",
      color: "#333",
      fontFamily: `${FONT_BODY}, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,
      fontSize: "10pt",
      lineHeight: 1.5,
      padding: 0,
      boxSizing: "border-box" as const,
    },
    goldBar: {
      height: 4,
      background: `linear-gradient(90deg, #B8860B 0%, ${INVOICE_GOLD} 40%, #B8860B 100%)`,
      width: "100%",
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "26px 32px 20px",
      gap: 16,
    },
    headerLeft: { display: "flex", alignItems: "center", gap: 16 },
    logo: { height: 58, width: "auto", objectFit: "contain" as const },
    company: {
      fontFamily: FONT_DISPLAY,
      fontSize: "17pt",
      fontWeight: 700,
      color: INK,
      letterSpacing: "-0.3px",
      lineHeight: 1.2,
    },
    tagline: {
      fontSize: "8pt",
      color: MUTED,
      textTransform: "uppercase" as const,
      letterSpacing: "1.5px",
      marginTop: 2,
    },
    docTitle: {
      fontSize: "11pt",
      fontWeight: 700,
      color: NAVY,
      letterSpacing: "3px",
      textTransform: "uppercase" as const,
    },
    docSub: { fontSize: "9.5pt", color: MUTED, marginTop: 4, fontFamily: FONT_MONO },

    // ---- Hero: what's owed, and how urgently ----
    hero: {
      margin: "0 32px 22px",
      display: "flex",
      alignItems: "stretch",
      borderRadius: 8,
      overflow: "hidden",
      border: `1px solid ${RULE}`,
    },
    heroStripe: { width: 6, background: due.color, flexShrink: 0 },
    heroBody: {
      flex: 1,
      background: `linear-gradient(135deg, ${CREAM} 0%, #FFFDF8 100%)`,
      padding: "18px 24px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      flexWrap: "wrap" as const,
      gap: 12,
    },
    heroLabel: {
      fontSize: "8pt",
      fontWeight: 700,
      textTransform: "uppercase" as const,
      letterSpacing: "1.8px",
      color: NAVY,
      marginBottom: 6,
    },
    heroFigure: { fontFamily: FONT_MONO, fontSize: "24pt", fontWeight: 700, color: NAVY },
    heroChip: {
      fontSize: "9pt",
      fontWeight: 800,
      letterSpacing: "0.6px",
      color: "#fff",
      background: due.color,
      padding: "7px 16px",
      borderRadius: 20,
      whiteSpace: "nowrap" as const,
    },

    card: { background: CREAM, border: `1px solid ${RULE}`, borderRadius: 6, padding: "16px 20px" },
    cardTitle: {
      fontSize: "8pt",
      fontWeight: 700,
      textTransform: "uppercase" as const,
      letterSpacing: "1.2px",
      color: NAVY,
      marginBottom: 10,
    },
    cardRow: { display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: "9.5pt" },

    sectionLabel: {
      fontSize: "9pt",
      fontWeight: 700,
      textTransform: "uppercase" as const,
      letterSpacing: "1.5px",
      color: NAVY,
      display: "flex",
      alignItems: "center",
      gap: 10,
      margin: "8px 0 10px",
    },
    sectionLine: { flex: 1, height: 1, background: RULE },

    th: {
      textAlign: "left" as const,
      padding: "10px 12px",
      fontSize: "8pt",
      fontWeight: 700,
      textTransform: "uppercase" as const,
      letterSpacing: "0.8px",
      color: "#FFFFFF",
      background: NAVY,
      borderBottom: `2px solid ${INVOICE_GOLD}`,
    },
  };

  return (
    <div style={s.container}>
      <div style={s.goldBar} />

      <div style={{ padding: "0 32px" }}>
        <div style={s.header}>
          <div style={s.headerLeft}>
            <img src={LOGO_SRC} alt={`${company.name} logo`} style={s.logo} />
            <div>
              <div style={s.company}>{company.name}</div>
              <div style={s.tagline}>Design · Build · Deliver</div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={s.docTitle}>Invoice</div>
            <div style={s.docSub}>{inv.invoiceNumber}</div>
          </div>
        </div>
      </div>

      {/* Hero — the amount owed and its urgency lead the document */}
      <div style={s.hero}>
        <div style={s.heroStripe} />
        <div style={s.heroBody}>
          <div>
            <div style={s.heroLabel}>
              {due.balance > 0 ? "Balance Due" : "Grand Total"}
            </div>
            <div style={s.heroFigure}>
              {sym} {fmt(due.balance > 0 ? due.balance : t.grandTotal)}
            </div>
          </div>
          <div style={s.heroChip}>{due.label}</div>
        </div>
      </div>

      <div style={{ padding: "0 32px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          <div style={s.card}>
            <div style={s.cardTitle}>Bill To</div>
            <div style={{ fontSize: "12pt", fontWeight: 700, color: INK, marginBottom: 4 }}>
              {inv.billTo}
            </div>
            <div style={{ fontSize: "9pt", color: MUTED, lineHeight: 1.6 }}>
              {inv.forText ? <div>{inv.forText}</div> : null}
              {inv.location ? <div>{inv.location}</div> : null}
              {inv.projectLabel ? <div>{inv.projectLabel}</div> : null}
            </div>
          </div>

          <div style={s.card}>
            <div style={s.cardTitle}>Invoice Details</div>
            {[
              ["Date", formatDate(inv.date)],
              ["Due Date", formatDate(inv.dueDate)],
              ["Location", inv.location || "—"],
              ["Currency", cur],
            ].map(([label, value]) => (
              <div style={s.cardRow} key={label}>
                <span style={{ color: MUTED }}>{label}</span>
                <span style={{ fontWeight: 600, color: "#2D2D2D" }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={s.sectionLabel}>
          <span>Line Items</span>
          <span style={s.sectionLine} />
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5pt", marginBottom: 4 }}>
          <thead>
            <tr>
              <th style={s.th}>Description</th>
              <th style={{ ...s.th, textAlign: "center" }}>Unit</th>
              <th style={{ ...s.th, textAlign: "center" }}>Qty</th>
              <th style={{ ...s.th, textAlign: "right" }}>Rate</th>
              <th style={{ ...s.th, textAlign: "right" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((it) => {
              if (it.lineType === "header") {
                return (
                  <tr key={it.id}>
                    <td
                      colSpan={5}
                      style={{
                        fontWeight: 700,
                        color: NAVY,
                        padding: "14px 12px 8px",
                        borderBottom: `2px solid ${RULE}`,
                      }}
                    >
                      {it.description}
                    </td>
                  </tr>
                );
              }
              if (it.lineType === "sub-detail") {
                return (
                  <tr key={it.id}>
                    <td
                      colSpan={5}
                      style={{
                        padding: "6px 12px 6px 24px",
                        color: MUTED,
                        fontStyle: "italic",
                        borderBottom: "1px solid #E8E4DC",
                      }}
                    >
                      {it.description}
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={it.id}>
                  <td style={{ padding: "8px 12px", borderBottom: "1px solid #E8E4DC", verticalAlign: "top", wordBreak: "break-word" as const }}>
                    {it.description}
                  </td>
                  <td style={{ padding: "8px 12px", borderBottom: "1px solid #E8E4DC", textAlign: "center", verticalAlign: "top" }}>
                    {it.unit || "—"}
                  </td>
                  <td style={{ padding: "8px 12px", borderBottom: "1px solid #E8E4DC", textAlign: "center", verticalAlign: "top" }}>
                    {it.qty}
                  </td>
                  <td style={{ padding: "8px 12px", borderBottom: "1px solid #E8E4DC", textAlign: "right", verticalAlign: "top", fontFamily: FONT_MONO }}>
                    {it.rate ? `${sym} ${fmt(it.rate)}` : ""}
                  </td>
                  <td style={{ padding: "8px 12px", borderBottom: "1px solid #E8E4DC", textAlign: "right", verticalAlign: "top", fontFamily: FONT_MONO }}>
                    {sym} {fmt((parseFloat(String(it.qty)) || 0) * (parseFloat(String(it.rate)) || 0))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ display: "flex", justifyContent: "flex-end", margin: "16px 0" }}>
          <div style={{ width: 320, background: CREAM, border: `1px solid ${RULE}`, borderRadius: 6, padding: "16px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: "9.5pt", color: MUTED }}>
              <span>Subtotal</span>
              <span>{sym} {fmt(t.subtotal)}</span>
            </div>
            {parseFloat(String(t.discount)) > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: "9.5pt", color: MUTED }}>
                <span>Discount ({inv.discountPct || 0}%)</span>
                <span style={{ color: ALERT }}>-{sym} {fmt(t.discount)}</span>
              </div>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "5px 0",
                fontSize: "9.5pt",
                color: "#2D2D2D",
                fontWeight: 700,
                background: "#F5F0E6",
                margin: "0 -20px",
                paddingLeft: 20,
                paddingRight: 20,
              }}
            >
              <span>New Subtotal</span>
              <span>{sym} {fmt(t.newSubtotal)}</span>
            </div>
            {t.chargeNhil && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: "9.5pt", color: MUTED }}>
                <span>NHIL & GETFund</span>
                <span>{sym} {fmt(t.nhilGetfund)}</span>
              </div>
            )}
            {t.chargeVat && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: "9.5pt", color: MUTED }}>
                <span>VAT ({(data.vatRate * 100).toFixed(1)}%)</span>
                <span>{sym} {fmt(t.vat)}</span>
              </div>
            )}
            <div
              style={{
                background: NAVY,
                color: INVOICE_GOLD,
                fontWeight: 800,
                fontSize: "11pt",
                margin: "8px -20px -16px",
                padding: "12px 20px",
                borderRadius: "0 0 6px 6px",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>GRAND TOTAL</span>
              <span>{sym} {fmt(t.grandTotal)}</span>
            </div>
          </div>
        </div>

        <div style={{ paddingTop: 4, fontStyle: "italic", color: MUTED, fontSize: "9.5pt", maxWidth: "55%" }}>
          <b style={{ fontStyle: "normal" }}>Amount in words:</b>
          <br />
          {amountInWords(t.grandTotal, "GHS")}
        </div>

        {cur === "USD" && (
          <div style={{ margin: "10px 0 0", fontSize: "8.5pt", color: ALERT, fontStyle: "italic" }}>
            Exchange Rate: All figures shown in GHS. Source invoice currency USD at reference rate USD 1 = GHS {inv.exchangeRate}.
          </div>
        )}
      </div>

      <div
        style={{
          padding: "16px 32px 24px",
          marginTop: 20,
          borderTop: `2px solid ${INVOICE_GOLD}`,
          textAlign: "center",
          fontSize: "8.5pt",
          color: MUTED,
          textTransform: "uppercase" as const,
          letterSpacing: "1px",
          lineHeight: 1.8,
        }}
      >
        We execute the best designs with utmost empathy and professionalism.
        <br />
        Thank you for entrusting to us your dreams — we will help make it a reality.
        <br />
        <br />
        <span style={{ color: RULE }}>—</span>
        <br />
        {company.addressLine} · {company.cityLine} · {company.poBox}
        <br />
        Phone: {company.phone} · Telephone: {company.telephone} · {company.email}
      </div>
    </div>
  );
}
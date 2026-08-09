import React from "react";
import { COMPANY_TEMPLATE } from "../constants/defaults";
import { LOGO_SRC } from "../theme/tokens";
import { NAVY, INVOICE_GOLD } from "../utils/invoiceUtils";
import { amountInWords } from "../utils/numberToWords";
import { fmt } from "../utils/format";
import { FONT_BODY, FONT_DISPLAY, FONT_MONO } from "../theme/tokens";
import type { AppData, Invoice, Payment } from "../types";

const SUCCESS = "#2F6B4F"; // reserved only for the paid-stamp — nowhere else
const CREAM = "#F5F2EC";
const RULE = "#D5CEBD";
const INK = "#1A1A1A";
const MUTED = "#6B6B6B";

interface ReceiptDocumentProps {
  data: AppData;
  inv: Invoice;
  payment: Payment;
  receiptNo: string;
}

/** Rotated ink-stamp seal — the one signature element on this document. */
function PaidStamp() {
  return (
    <div
      style={{
        position: "absolute",
        top: 14,
        right: 28,
        width: 108,
        height: 108,
        transform: "rotate(-9deg)",
        opacity: 0.92,
        mixBlendMode: "multiply",
        pointerEvents: "none",
      }}
    >
      <svg viewBox="0 0 200 200" width="108" height="108">
        <defs>
          <path id="stampArcTop" d="M 24,100 A 76,76 0 0 1 176,100" fill="none" />
        </defs>
        <circle cx="100" cy="100" r="92" fill="none" stroke={SUCCESS} strokeWidth="3" />
        <circle
          cx="100"
          cy="100"
          r="78"
          fill="none"
          stroke={SUCCESS}
          strokeWidth="2"
          strokeDasharray="4 5"
        />
        <text fill={SUCCESS} fontSize="14" fontWeight="800" letterSpacing="2.5">
          <textPath href="#stampArcTop" startOffset="50%" textAnchor="middle">
            PAYMENT RECEIVED
          </textPath>
        </text>
        <line x1="52" y1="126" x2="148" y2="126" stroke={SUCCESS} strokeWidth="1.5" />
        <text
          x="100"
          y="118"
          fill={SUCCESS}
          fontSize="30"
          fontWeight="800"
          textAnchor="middle"
          fontFamily="Georgia, serif"
          fontStyle="italic"
        >
          Paid
        </text>
        <text
          x="100"
          y="146"
          fill={SUCCESS}
          fontSize="9"
          fontWeight="700"
          textAnchor="middle"
          letterSpacing="1.5"
        >
          MODULO · GHANA
        </text>
      </svg>
    </div>
  );
}

export default function ReceiptDocument({ data, inv, payment, receiptNo }: ReceiptDocumentProps) {
  const company = data.company || COMPANY_TEMPLATE;
  const idx = inv.payments.findIndex((p) => p.id === payment.id);
  const paidThrough = inv.payments
    .slice(0, idx + 1)
    .reduce((s, p) => s + p.amountGHS, 0);
  const outstanding = Math.max(inv.totals.grandTotalGHS - paidThrough, 0);
  const isSettled = outstanding < 0.01;

  const s = {
    container: {
      background: "#FFFFFF",
      color: "#333333",
      fontFamily: `${FONT_BODY}, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,
      fontSize: "10pt",
      lineHeight: 1.5,
      boxSizing: "border-box" as const,
    },
    goldBar: {
      height: 4,
      background: `linear-gradient(90deg, #B8860B 0%, ${INVOICE_GOLD} 40%, #B8860B 100%)`,
      width: "100%",
    },
    header: {
      position: "relative" as const,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "26px 32px 22px",
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
    docSub: {
      fontSize: "9.5pt",
      color: MUTED,
      marginTop: 4,
      fontFamily: FONT_MONO,
    },

    // ---- Hero: the amount is the thesis of a receipt, so it leads ----
    hero: {
      margin: "0 32px 24px",
      display: "flex",
      alignItems: "stretch",
      borderRadius: 8,
      overflow: "hidden",
      border: `1px solid ${RULE}`,
    },
    heroStripe: { width: 6, background: NAVY, flexShrink: 0 },
    heroBody: {
      flex: 1,
      background: `linear-gradient(135deg, ${CREAM} 0%, #FFFDF8 100%)`,
      padding: "22px 26px",
    },
    heroLabel: {
      fontSize: "8pt",
      fontWeight: 700,
      textTransform: "uppercase" as const,
      letterSpacing: "1.8px",
      color: NAVY,
      marginBottom: 8,
    },
    heroWords: {
      fontFamily: "Georgia, serif",
      fontStyle: "italic" as const,
      fontSize: "13.5pt",
      fontWeight: 700,
      color: INK,
      lineHeight: 1.35,
    },
    heroFigureRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginTop: 14,
      paddingTop: 14,
      borderTop: `1px dashed ${RULE}`,
    },
    heroFigure: {
      fontFamily: FONT_MONO,
      fontSize: "22pt",
      fontWeight: 700,
      color: NAVY,
    },
    heroStatus: {
      fontSize: "8.5pt",
      fontWeight: 700,
      letterSpacing: "1px",
      textTransform: "uppercase" as const,
      color: isSettled ? SUCCESS : "#A63D40",
    },

    metaRow: {
      display: "flex",
      gap: 16,
      padding: "0 32px 22px",
      flexWrap: "wrap" as const,
    },
    card: {
      flex: "1 1 220px",
      background: CREAM,
      border: `1px solid ${RULE}`,
      borderRadius: 6,
      padding: "14px 18px",
    },
    cardTitle: {
      fontSize: "7.5pt",
      fontWeight: 700,
      textTransform: "uppercase" as const,
      letterSpacing: "1.2px",
      color: NAVY,
      marginBottom: 8,
    },
    infoRow: {
      display: "flex",
      justifyContent: "space-between",
      padding: "3px 0",
      fontSize: "9.5pt",
      gap: 12,
    },
    infoLabel: { color: MUTED },
    infoValue: { color: "#2D2D2D", fontWeight: 600, textAlign: "right" as const },
    contactLine: { fontSize: "9pt", color: MUTED, lineHeight: 1.7 },

    sectionTitle: {
      fontSize: "8pt",
      fontWeight: 700,
      textTransform: "uppercase" as const,
      letterSpacing: "1.5px",
      color: NAVY,
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "0 32px",
      margin: "4px 0 10px",
    },
    sectionLine: { flex: 1, height: 1, background: RULE },

    table: {
      width: "calc(100% - 64px)",
      margin: "0 32px 22px",
      borderCollapse: "collapse" as const,
      fontSize: "9.5pt",
      borderRadius: 6,
      overflow: "hidden",
    },
    th: {
      textAlign: "left" as const,
      padding: "9px 12px",
      fontSize: "7.5pt",
      fontWeight: 700,
      textTransform: "uppercase" as const,
      letterSpacing: "0.8px",
      color: "#FFFFFF",
      background: NAVY,
    },
    thRight: { textAlign: "right" as const },
    td: { padding: "9px 12px", borderBottom: `1px solid ${RULE}`, verticalAlign: "top" as const },
    tdRight: { textAlign: "right" as const, fontFamily: FONT_MONO },

    summaryBox: {
      margin: "0 32px 24px",
      background: CREAM,
      border: `1px solid ${RULE}`,
      borderRadius: 6,
      overflow: "hidden",
    },
    summaryRow: {
      display: "flex",
      justifyContent: "space-between",
      padding: "9px 18px",
      fontSize: "9.5pt",
      borderBottom: `1px solid ${RULE}`,
      color: "#333333",
    },
    summaryHighlight: {
      display: "flex",
      justifyContent: "space-between",
      padding: "13px 18px",
      fontSize: "10pt",
      background: NAVY,
      color: INVOICE_GOLD,
      fontWeight: 800,
    },

    footerNote: {
      padding: "18px 32px 26px",
      borderTop: `2px solid ${INVOICE_GOLD}`,
      textAlign: "center" as const,
      fontSize: "8pt",
      color: MUTED,
      textTransform: "uppercase" as const,
      letterSpacing: "1px",
      lineHeight: 1.9,
    },
  };

  return (
    <div style={s.container}>
      <div style={s.goldBar} />

      <div style={s.header}>
        <PaidStamp />
        <div style={s.headerLeft}>
          <img src={LOGO_SRC} alt={`${company.name} logo`} style={s.logo} />
          <div>
            <div style={s.company}>{company.name}</div>
            <div style={s.tagline}>Design · Build · Deliver</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={s.docTitle}>Official Receipt</div>
          <div style={s.docSub}>{receiptNo}</div>
        </div>
      </div>

      {/* Hero — amount is the thesis of a receipt, so it comes first */}
      <div style={s.hero}>
        <div style={s.heroStripe} />
        <div style={s.heroBody}>
          <div style={s.heroLabel}>Received the sum of</div>
          <div style={s.heroWords}>
            {amountInWords(payment.amountGHS, "GHS")}
          </div>
          <div style={s.heroFigureRow}>
            <div style={s.heroFigure}>GHS {fmt(payment.amountGHS)}</div>
            <div style={s.heroStatus}>
              {isSettled ? "Invoice Settled" : `Balance GHS ${fmt(outstanding)} Remains`}
            </div>
          </div>
        </div>
      </div>

      <div style={s.metaRow}>
        <div style={s.card}>
          <div style={s.cardTitle}>Received From</div>
          <div style={{ fontSize: "11.5pt", fontWeight: 700, color: INK, marginBottom: 4 }}>
            {inv.billTo}
          </div>
          <div style={s.contactLine}>{inv.forText || inv.projectLabel || "—"}</div>
        </div>
        <div style={s.card}>
          <div style={s.cardTitle}>Receipt Details</div>
          <div style={s.infoRow}>
            <span style={s.infoLabel}>Date</span>
            <span style={s.infoValue}>{payment.date}</span>
          </div>
          <div style={s.infoRow}>
            <span style={s.infoLabel}>Invoice No.</span>
            <span style={s.infoValue}>{inv.invoiceNumber}</span>
          </div>
          <div style={s.infoRow}>
            <span style={s.infoLabel}>Receipt No.</span>
            <span style={s.infoValue}>{receiptNo}</span>
          </div>
        </div>
      </div>

      <div style={s.sectionTitle}>
        <span>Payment Details</span>
        <span style={s.sectionLine} />
      </div>
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>Payment By</th>
            <th style={s.th}>Reference No.</th>
            <th style={{ ...s.th, ...s.thRight }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={s.td}>{payment.method}</td>
            <td style={s.td}>{payment.reference || "—"}</td>
            <td style={{ ...s.td, ...s.tdRight, fontWeight: 700 }}>
              GHS {fmt(payment.amountGHS)}
            </td>
          </tr>
        </tbody>
      </table>

      <div style={s.sectionTitle}>
        <span>Invoice Reference</span>
        <span style={s.sectionLine} />
      </div>
      <div style={s.summaryBox}>
        <div style={s.summaryRow}>
          <span>Invoice Total</span>
          <span>GHS {fmt(inv.totals.grandTotalGHS)}</span>
        </div>
        <div style={s.summaryRow}>
          <span>Amount Received to Date</span>
          <span>GHS {fmt(paidThrough)}</span>
        </div>
        <div style={s.summaryHighlight}>
          <span>Outstanding Balance</span>
          <span>GHS {fmt(outstanding)}</span>
        </div>
      </div>

      <div style={s.footerNote}>
        Thank you for your business.
        <br />
        {company.name} · {company.addressLine} · {company.cityLine}
        <br />
        Phone: {company.phone} · Telephone: {company.telephone} · Mail: {company.email}
      </div>
    </div>
  );
}
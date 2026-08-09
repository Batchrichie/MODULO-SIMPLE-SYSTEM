import React from "react";
import { COMPANY_TEMPLATE } from "../constants/defaults";
import { LOGO_SRC } from "../theme/tokens";
import { NAVY, INVOICE_GOLD, invTdLabel, invTdVal } from "../utils/invoiceUtils";
import { amountInWords } from "../utils/numberToWords";
import { fmt } from "../utils/format";
import { FONT_BODY, FONT_DISPLAY, FONT_MONO } from "../theme/tokens";
import type { AppData, Invoice, Payment, PayrollRun, PayrollLine } from "../types";

export default function InvoiceDocument({ data, inv }) {
  const t = inv.totals;
  const cur = inv.currency;
  const sym = cur === "USD" ? "$" : "GHS";
  const company = data.company || COMPANY_TEMPLATE;

  const formatDate = (value) => {
    if (!value) return "—";
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const cardStyle = {
    background: "#F5F2EC",
    border: "1px solid #D5CEBD",
    borderRadius: 6,
    padding: "16px 20px",
  };

  const cardTitleStyle = {
    fontSize: "8pt",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "1.2px",
    color: "#B8860B",
    marginBottom: 10,
  };

  const cardRowStyle = {
    display: "flex",
    justifyContent: "space-between",
    padding: "4px 0",
    fontSize: "9.5pt",
  };

  return (
    <div
      style={{
        background: "#fff",
        color: "#333",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        fontSize: "10pt",
        lineHeight: 1.5,
        padding: 32,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          height: 4,
          background:
            "linear-gradient(90deg, #B8860B 0%, #D4AF37 40%, #B8860B 100%)",
          width: "100%",
        }}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "24px 0 20px",
          borderBottom: "1px solid #E8E4DC",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <img
            src={LOGO_SRC}
            alt="logo"
            style={{ height: 64, width: "auto", objectFit: "contain" }}
          />
          <div>
            <div
              style={{
                fontSize: "18pt",
                fontWeight: 800,
                color: "#1A1A1A",
                letterSpacing: "-0.5px",
                lineHeight: 1.2,
              }}
            >
              {company.name}
            </div>
            <div
              style={{
                fontSize: "8.5pt",
                color: "#6B6B6B",
                textTransform: "uppercase",
                letterSpacing: "1.5px",
                marginTop: 2,
              }}
            >
              Design · Build · Deliver
            </div>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: "28pt",
              fontWeight: 800,
              color: "#1B2A4A",
              letterSpacing: "2px",
              lineHeight: 1,
            }}
          >
            INVOICE
          </div>
          <div
            style={{
              fontSize: "10pt",
              color: "#6B6B6B",
              marginTop: 6,
              fontFamily: FONT_MONO,
            }}
          >
            {inv.invoiceNumber}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          padding: "20px 0",
        }}
      >
        <div style={cardStyle}>
          <div style={cardTitleStyle}>Bill To</div>
          <div
            style={{
              fontSize: "12pt",
              fontWeight: 700,
              color: "#1A1A1A",
              marginBottom: 4,
            }}
          >
            {inv.billTo}
          </div>
          <div style={{ fontSize: "9pt", color: "#6B6B6B", lineHeight: 1.6 }}>
            {inv.forText ? <div>{inv.forText}</div> : null}
            {inv.location ? <div>{inv.location}</div> : null}
            {inv.projectLabel ? <div>{inv.projectLabel}</div> : null}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={cardTitleStyle}>Invoice Details</div>
          <div style={cardRowStyle}>
            <span style={{ color: "#6B6B6B" }}>Date</span>
            <span style={{ fontWeight: 600, color: "#2D2D2D" }}>
              {formatDate(inv.date)}
            </span>
          </div>
          <div style={cardRowStyle}>
            <span style={{ color: "#6B6B6B" }}>Due Date</span>
            <span style={{ fontWeight: 600, color: "#2D2D2D" }}>
              {formatDate(inv.dueDate)}
            </span>
          </div>
          <div style={cardRowStyle}>
            <span style={{ color: "#6B6B6B" }}>Location</span>
            <span style={{ fontWeight: 600, color: "#2D2D2D" }}>
              {inv.location || "—"}
            </span>
          </div>
          <div style={cardRowStyle}>
            <span style={{ color: "#6B6B6B" }}>For</span>
            <span style={{ fontWeight: 600, color: "#2D2D2D" }}>
              {inv.forText || "—"}
            </span>
          </div>
          <div style={cardRowStyle}>
            <span style={{ color: "#6B6B6B" }}>Currency</span>
            <span style={{ fontWeight: 600, color: "#2D2D2D" }}>
              {cur}
            </span>
          </div>
        </div>
      </div>

      <div
        style={{
          fontSize: "9pt",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "1.5px",
          color: "#B8860B",
          display: "flex",
          alignItems: "center",
          gap: 10,
          margin: "8px 0 10px",
        }}
      >
        Line Items
        <span style={{ flex: 1, height: 1, background: "#D5CEBD" }} />
      </div>

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "9.5pt",
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                textAlign: "left",
                padding: "10px 12px",
                fontSize: "8pt",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.8px",
                color: "#FFFFFF",
                background: "#1B2A4A",
                borderBottom: "2px solid #B8860B",
              }}
            >
              Description
            </th>
            <th
              style={{
                textAlign: "center",
                padding: "10px 12px",
                fontSize: "8pt",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.8px",
                color: "#FFFFFF",
                background: "#1B2A4A",
                borderBottom: "2px solid #B8860B",
              }}
            >
              Unit
            </th>
            <th
              style={{
                textAlign: "center",
                padding: "10px 12px",
                fontSize: "8pt",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.8px",
                color: "#FFFFFF",
                background: "#1B2A4A",
                borderBottom: "2px solid #B8860B",
              }}
            >
              Qty
            </th>
            <th
              style={{
                textAlign: "right",
                padding: "10px 12px",
                fontSize: "8pt",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.8px",
                color: "#FFFFFF",
                background: "#1B2A4A",
                borderBottom: "2px solid #B8860B",
              }}
            >
              Rate
            </th>
            <th
              style={{
                textAlign: "right",
                padding: "10px 12px",
                fontSize: "8pt",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.8px",
                color: "#FFFFFF",
                background: "#1B2A4A",
                borderBottom: "2px solid #B8860B",
              }}
            >
              Amount
            </th>
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
                      color: "#1B2A4A",
                      padding: "14px 12px 8px",
                      borderBottom: "2px solid #D5CEBD",
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
                      color: "#6B6B6B",
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
                <td
                  style={{
                    padding: "8px 12px",
                    borderBottom: "1px solid #E8E4DC",
                    verticalAlign: "top",
                    wordBreak: "break-word",
                  }}
                >
                  {it.description}
                </td>
                <td
                  style={{
                    padding: "8px 12px",
                    borderBottom: "1px solid #E8E4DC",
                    textAlign: "center",
                    verticalAlign: "top",
                  }}
                >
                  {it.unit || "—"}
                </td>
                <td
                  style={{
                    padding: "8px 12px",
                    borderBottom: "1px solid #E8E4DC",
                    textAlign: "center",
                    verticalAlign: "top",
                  }}
                >
                  {it.qty}
                </td>
                <td
                  style={{
                    padding: "8px 12px",
                    borderBottom: "1px solid #E8E4DC",
                    textAlign: "right",
                    verticalAlign: "top",
                    fontFamily: FONT_MONO,
                  }}
                >
                  {it.rate ? `${sym} ${fmt(it.rate)}` : ""}
                </td>
                <td
                  style={{
                    padding: "8px 12px",
                    borderBottom: "1px solid #E8E4DC",
                    textAlign: "right",
                    verticalAlign: "top",
                    fontFamily: FONT_MONO,
                  }}
                >
                  {sym} {fmt((parseFloat(it.qty) || 0) * (parseFloat(it.rate) || 0))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <div
          style={{
            width: 320,
            background: "#FAFAF8",
            border: "1px solid #E8E4DC",
            borderRadius: 6,
            padding: "16px 20px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "5px 0",
              fontSize: "9.5pt",
              color: "#6B6B6B",
            }}
          >
            <span>Subtotal</span>
            <span>{sym} {fmt(t.subtotal)}</span>
          </div>
          {parseFloat(t.discount) > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "5px 0",
                fontSize: "9.5pt",
                color: "#6B6B6B",
              }}
            >
              <span>Discount ({inv.discountPct || 0}%)</span>
              <span style={{ color: "#A63D40" }}>-{sym} {fmt(t.discount)}</span>
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
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "5px 0",
                fontSize: "9.5pt",
                color: "#6B6B6B",
              }}
            >
              <span>NHIL & GETFund</span>
              <span>{sym} {fmt(t.nhilGetfund)}</span>
            </div>
          )}
          {t.chargeVat && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "5px 0",
                fontSize: "9.5pt",
                color: "#6B6B6B",
              }}
            >
              <span>VAT ({(data.vatRate * 100).toFixed(1)}%)</span>
              <span>{sym} {fmt(t.vat)}</span>
            </div>
          )}
          <div
            style={{
              background: "#1B2A4A",
              color: "#D4AF37",
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

      <div
        style={{
          paddingTop: 16,
          marginTop: 16,
          fontStyle: "italic",
          color: "#6B6B6B",
          fontSize: "9.5pt",
          maxWidth: "55%",
        }}
      >
        <b>Amount in words:</b>
        <br />
        {amountInWords(t.grandTotal, cur)}
      </div>

      {cur === "USD" && (
        <div
          style={{
            margin: "8px 0 16px",
            fontSize: "8.5pt",
            color: "#A63D40",
            fontStyle: "italic",
          }}
        >
          Exchange Rate: Payments preferably in USD. If settled in GHS, reference rate is USD 1 = GHC {inv.exchangeRate}.
        </div>
      )}

      <div
        style={{
          padding: "16px 0 0",
          marginTop: 20,
          borderTop: "2px solid #B8860B",
          textAlign: "center",
          fontSize: "8.5pt",
          color: "#6B6B6B",
          textTransform: "uppercase",
          letterSpacing: "1px",
          lineHeight: 1.8,
        }}
      >
        We execute the best designs with utmost empathy and professionalism.
        <br />
        Thank you for entrusting to us your dreams — we will help make it a reality.
        <br />
        <br />
        <span style={{ color: "#E8E4DC" }}>—</span>
        <br />
        {company.addressLine} · {company.cityLine} · {company.poBox}
        <br />
        Phone: {company.phone} · Telephone: {company.telephone} · {company.email}
      </div>
    </div>
  );
}


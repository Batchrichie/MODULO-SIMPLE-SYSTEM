import React, { useState, useMemo } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { INK, RULE, MUTED, FONT_MONO, FONT_BODY } from "../theme/tokens";
import TableScroll from "../components/ui/TableScroll";
import Th from "../components/ui/Th";
import Td from "../components/ui/Td";
import Button from "../components/ui/Button";
import { inputStyle, labelStyle } from "../components/ui/styles";
import ProjectSelect from "../components/ui/ProjectSelect";
import AccountSelect from "../components/ui/AccountSelect";
import { fmt, projectName } from "../utils/format";
import { computeInvoiceTotals, resolveTaxRate } from "../utils/invoiceUtils";
import { assertInvoice } from "../validation";
import { db } from "../supabaseClient";
import type { NewInvoiceFormProps } from "../types";

/* ─── layout primitives ─── */
const card: React.CSSProperties = {
  background: "var(--paper)",
  border: `1px solid ${RULE}`,
  borderRadius: 10,
  padding: "18px 20px",
  marginBottom: 16,
};

const sectionTitle: React.CSSProperties = {
  fontFamily: FONT_BODY,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.5px",
  textTransform: "uppercase" as const,
  color: MUTED,
  marginBottom: 14,
};

const row: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 12,
};

const field: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

/* ─── custom toggle switch (system colours) ─── */
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
      onClick={() => onChange(!checked)}
    >
      <div
        style={{
          width: 44,
          height: 24,
          borderRadius: 12,
          background: checked
            ? "linear-gradient(135deg, rgba(76, 175, 80, 0.92), rgba(34, 197, 94, 0.8))"
            : "rgba(148, 163, 184, 0.18)",
          border: checked ? "1px solid rgba(134, 239, 172, 0.6)" : `1px solid ${RULE}`,
          position: "relative",
          flexShrink: 0,
          transition: "background 0.2s ease",
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "var(--paper)",
            position: "absolute",
            top: 3,
            left: checked ? 23 : 3,
            transition: "left 0.2s ease",
            boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
          }}
        />
      </div>
      <span style={{ fontFamily: FONT_BODY, fontSize: 14, color: INK, userSelect: "none" }}>
        {label}
      </span>
    </div>
  );
}

export default function NewInvoiceForm({
  data,
  mutate,
  onDone,
  cloneSource,
}: NewInvoiceFormProps) {
  const [billTo, setBillTo] = useState(cloneSource?.billTo || "");
  const [forText, setForText] = useState(cloneSource?.forText || "");
  const [location, setLocation] = useState(
    cloneSource?.location || "GREATER ACCRA"
  );
  const [project, setProject] = useState(cloneSource?.project || "GEN");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [currency, setCurrency] = useState(cloneSource?.currency || "GHS");
  const [exchangeRate, setExchangeRate] = useState(
    String(cloneSource?.exchangeRate || "11.2")
  );
  const [discountPct, setDiscountPct] = useState(
    String(cloneSource?.discountPct || "0")
  );
  const [chargeNhil, setChargeNhil] = useState(
    cloneSource?.totals?.chargeNhil ?? true
  );
  const [chargeVat, setChargeVat] = useState(
    cloneSource?.totals?.chargeVat ?? true
  );
  const [revenueAccount, setRevenueAccount] = useState(
    cloneSource?.revenueAccount || "4100"
  );

  const [items, setItems] = useState(
    cloneSource?.items?.length
      ? cloneSource.items.map((it) => ({
          id:
            String(Date.now()) +
            Math.random().toString(36).slice(2, 6),
          description: it.description,
          unit: it.unit || "",
          qty: String(it.qty),
          rate: String(it.rate),
          lineType: it.lineType,
        }))
      : [
          {
            id: "1",
            description: "",
            unit: "",
            qty: "1",
            rate: "",
            lineType: "item",
          },
        ]
  );

  const invoiceTaxRates = useMemo(
    () => ({
      nhil: resolveTaxRate(data.nhilGetfundRate, 0.025),
      vat: resolveTaxRate(data.vatRate, 0.15),
    }),
    [data.nhilGetfundRate, data.vatRate]
  );

  const totals = useMemo(
    () =>
      computeInvoiceTotals(
        items,
        discountPct,
        invoiceTaxRates.nhil,
        invoiceTaxRates.vat,
        chargeNhil,
        chargeVat
      ),
    [items, discountPct, invoiceTaxRates, chargeNhil, chargeVat]
  );

  function updateItem(i: number, field: string, val: string) {
    setItems((its) =>
      its.map((it, idx) => (idx === i ? { ...it, [field]: val } : it))
    );
  }
  function addItem() {
    setItems((its) => [
      ...its,
      {
        id: String(Date.now()),
        description: "",
        unit: "",
        qty: "1",
        rate: "",
        lineType: "item",
      },
    ]);
  }
  function removeItem(i: number) {
    setItems((its) => its.filter((_, idx) => idx !== i));
  }

  async function create() {
    const err = assertInvoice({ billTo, items, dueDate, date });
    if (err) {
      window.alert(err);
      return;
    }
    const year = date.slice(0, 4);
    const invoiceNumber = `SP/${year}/${String(data.nextInvoiceNum).padStart(
      4,
      "0"
    )}`;
    const cleanItems = items
      .filter((it) => it.description.trim())
      .map((it) => ({
        ...it,
        qty: it.lineType === "item" ? parseFloat(it.qty) || 0 : 0,
        rate: it.lineType === "item" ? parseFloat(it.rate) || 0 : 0,
      }));
    const t = computeInvoiceTotals(
      cleanItems,
      discountPct,
      data.nhilGetfundRate,
      data.vatRate,
      chargeNhil,
      chargeVat
    );
    const rate = currency === "USD" ? parseFloat(exchangeRate) || 1 : 1;
    const totals = {
      ...t,
      grandTotalGHS:
        currency === "USD" ? t.grandTotal * rate : t.grandTotal,
      newSubtotalGHS:
        currency === "USD" ? t.newSubtotal * rate : t.newSubtotal,
      nhilGetfundGHS:
        currency === "USD" ? t.nhilGetfund * rate : t.nhilGetfund,
      vatGHS: currency === "USD" ? t.vat * rate : t.vat,
      chargeNhil,
      chargeVat,
    };
    const inv = {
      id: invoiceNumber,
      invoiceNumber,
      date,
      dueDate: dueDate || date,
      billTo: billTo.trim(),
      forText: forText.trim(),
      location,
      project,
      projectLabel: projectName(data.projects, project),
      currency,
      exchangeRate: rate,
      items: cleanItems,
      discountPct: parseFloat(discountPct) || 0,
      revenueAccount,
      totals,
      status: "Sent",
      payments: [],
    };
    const entryNumber = `JE-${String(data.nextEntryNum).padStart(4, "0")}`;
    const entry = {
      id: entryNumber,
      entryNumber,
      date,
      description: `Invoice ${invoiceNumber} — ${billTo.trim()}`,
      period: date.slice(0, 7),
      project,
      lines: [
        { account: "1130", debit: totals.grandTotalGHS, credit: 0 },
        {
          account: revenueAccount,
          debit: 0,
          credit: totals.newSubtotalGHS,
        },
        ...(chargeNhil
          ? [
              {
                account: "2205",
                debit: 0,
                credit: totals.nhilGetfundGHS,
              },
            ]
          : []),
        ...(chargeVat
          ? [
              {
                account: "2220",
                debit: 0,
                credit: totals.vatGHS,
              },
            ]
          : []),
      ],
    };
    mutate((d) => ({
      ...d,
      invoices: [inv, ...d.invoices],
      journal: [entry, ...d.journal],
      nextEntryNum: d.nextEntryNum + 1,
      nextInvoiceNum: d.nextInvoiceNum + 1,
    }));
    try {
      await db.saveInvoice(inv);
      await db.saveJournalEntry(entry);
    } catch (err) {
      console.error("Failed to persist invoice or journal entry:", err);
      alert("Failed to save invoice to server. Check console for details.");
    }
    onDone && onDone();
  }

  return (
    <div style={{ fontFamily: FONT_BODY, color: INK, paddingBottom: 40 }}>
      {/* ═════ Invoice Details ═════ */}
      <div style={card}>
        <div style={sectionTitle}>Invoice Details</div>
        <div style={row}>
          <div style={{ ...field, flex: "2 1 260px" }}>
            <label style={labelStyle}>Bill to</label>
            <input
              style={inputStyle}
              value={billTo}
              onChange={(e) => setBillTo(e.target.value)}
              placeholder="Mr. Ken and Mr. Kasim"
            />
          </div>
          <div style={{ ...field, flex: "1 1 160px" }}>
            <label style={labelStyle}>Project</label>
            <ProjectSelect
              value={project}
              onChange={setProject}
              projects={data.projects}
            />
          </div>
          <div style={{ ...field, flex: "1 1 160px" }}>
            <label style={labelStyle}>Location</label>
            <input
              style={inputStyle}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div style={{ ...field, flex: "3 1 320px" }}>
            <label style={labelStyle}>
              What&apos;s this for (appears on receipts)
            </label>
            <input
              style={inputStyle}
              value={forText}
              onChange={(e) => setForText(e.target.value)}
              placeholder="Construction of Four (4) Bedroom Residential Facility"
            />
          </div>
        </div>

        <div style={{ ...row, marginTop: 12 }}>
          <div style={{ ...field, flex: "1 1 130px" }}>
            <label style={labelStyle}>Date</label>
            <input
              type="date"
              style={inputStyle}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div style={{ ...field, flex: "1 1 130px" }}>
            <label style={labelStyle}>Due date</label>
            <input
              type="date"
              style={inputStyle}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div style={{ ...field, flex: "0 0 100px" }}>
            <label style={labelStyle}>Currency</label>
            <select
              style={inputStyle}
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="GHS">GHS</option>
              <option value="USD">USD</option>
            </select>
          </div>
          {currency === "USD" && (
            <div style={{ ...field, flex: "1 1 120px" }}>
              <label style={labelStyle}>Exchange rate</label>
              <input
                style={inputStyle}
                value={exchangeRate}
                onChange={(e) =>
                  setExchangeRate(e.target.value.replace(/[^0-9.]/g, ""))
                }
                placeholder="GHS per USD"
              />
            </div>
          )}
          <div style={{ ...field, flex: "2 1 220px" }}>
            <label style={labelStyle}>Revenue account</label>
            <AccountSelect
              value={revenueAccount}
              onChange={setRevenueAccount}
              accounts={data.accounts}
              filterFn={(a) => {
                const type = (a.type || "").toLowerCase();
                return type === "revenue" || type === "income";
              }}
              placeholder="Search revenue account…"
            />
          </div>
          <div style={{ ...field, flex: "0 0 90px" }}>
            <label style={labelStyle}>Discount %</label>
            <input
              style={{ ...inputStyle, textAlign: "right" }}
              value={discountPct}
              onChange={(e) =>
                setDiscountPct(e.target.value.replace(/[^0-9.]/g, ""))
              }
            />
          </div>
        </div>
      </div>

      {/* ═════ Line Items ═════ */}
      <div style={card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <div style={sectionTitle}>Line Items</div>
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 12,
              color: MUTED,
            }}
          >
            {items.length} item{items.length !== 1 ? "s" : ""}
          </span>
        </div>

        <TableScroll>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 14,
            }}
          >
            <thead>
              <tr style={{ borderBottom: `2px solid ${RULE}` }}>
                <Th style={{ width: 96, padding: "8px 6px" }}>Type</Th>
                <Th style={{ padding: "8px 6px" }}>Description</Th>
                <Th style={{ width: 72, padding: "8px 6px" }}>Unit</Th>
                <Th style={{ width: 86, padding: "8px 6px", textAlign: "right" }}>
                  Qty / Days
                </Th>
                <Th style={{ width: 106, padding: "8px 6px", textAlign: "right" }}>
                  Rate
                </Th>
                <Th style={{ width: 110, padding: "8px 6px", textAlign: "right" }}>
                  Amount
                </Th>
                <Th style={{ width: 36, padding: "8px 6px" }} />
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => {
                const amount =
                  it.lineType === "item"
                    ? (parseFloat(it.qty) || 0) *
                      (parseFloat(it.rate) || 0)
                    : 0;
                return (
                  <tr
                    key={it.id}
                    style={{ borderBottom: `1px solid ${RULE}` }}
                  >
                    <Td style={{ padding: "6px" }}>
                      <select
                        style={{
                          ...inputStyle,
                          padding: "5px 6px",
                          fontSize: 13,
                        }}
                        value={it.lineType}
                        onChange={(e) =>
                          updateItem(i, "lineType", e.target.value)
                        }
                      >
                        <option value="item">Item</option>
                        <option value="header">Header</option>
                        <option value="sub-detail">Sub-detail</option>
                      </select>
                    </Td>
                    <Td style={{ padding: "6px" }}>
                      <input
                        style={{ ...inputStyle, minWidth: 180 }}
                        value={it.description}
                        onChange={(e) =>
                          updateItem(i, "description", e.target.value)
                        }
                        placeholder={
                          it.lineType === "header"
                            ? "Section header…"
                            : "Item description…"
                        }
                      />
                    </Td>
                    <Td style={{ padding: "6px" }}>
                      <input
                        style={{
                          ...inputStyle,
                          width: 64,
                          padding: "6px 8px",
                        }}
                        value={it.lineType === "item" ? it.unit : ""}
                        onChange={(e) =>
                          updateItem(i, "unit", e.target.value)
                        }
                        disabled={it.lineType !== "item"}
                        placeholder="ea"
                      />
                    </Td>
                    <Td style={{ padding: "6px", textAlign: "right" }}>
                      <input
                        style={{
                          ...inputStyle,
                          width: 76,
                          textAlign: "right",
                          padding: "6px 8px",
                        }}
                        value={it.lineType === "item" ? it.qty : ""}
                        onChange={(e) =>
                          updateItem(
                            i,
                            "qty",
                            e.target.value.replace(/[^0-9.]/g, "")
                          )
                        }
                        disabled={it.lineType !== "item"}
                      />
                    </Td>
                    <Td style={{ padding: "6px", textAlign: "right" }}>
                      <input
                        style={{
                          ...inputStyle,
                          width: 96,
                          textAlign: "right",
                          fontFamily: FONT_MONO,
                          padding: "6px 8px",
                        }}
                        value={it.lineType === "item" ? it.rate : ""}
                        onChange={(e) =>
                          updateItem(
                            i,
                            "rate",
                            e.target.value.replace(/[^0-9.]/g, "")
                          )
                        }
                        disabled={it.lineType !== "item"}
                      />
                    </Td>
                    <Td
                      style={{
                        padding: "6px",
                        textAlign: "right",
                        fontFamily: FONT_MONO,
                        fontSize: 13,
                        fontWeight: 600,
                        color:
                          it.lineType === "item" ? INK : MUTED,
                      }}
                    >
                      {it.lineType === "item" ? fmt(amount) : "—"}
                    </Td>
                    <Td style={{ padding: "6px", textAlign: "center" }}>
                      <button
                        onClick={() => removeItem(i)}
                        title="Remove line"
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: MUTED,
                          padding: 4,
                          borderRadius: 4,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.color = "#dc2626")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.color = MUTED)
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableScroll>

        <div style={{ marginTop: 10 }}>
          <Button variant="ghost" onClick={addItem} icon={Plus}>
            Add line item
          </Button>
        </div>
      </div>

      {/* ═════ Taxes ═════ */}
      <div style={card}>
        <div style={sectionTitle}>Taxes &amp; Charges</div>
        <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
          <Toggle
            checked={chargeNhil}
            onChange={setChargeNhil}
            label="Charge NHIL / GETFund"
          />
          <Toggle
            checked={chargeVat}
            onChange={setChargeVat}
            label="Charge VAT"
          />
        </div>
      </div>

      {/* ═════ Totals (inverted) ═════ */}
      <div
        style={{
          ...card,
          background: "var(--paper)",
          border: `1px solid ${RULE}`,
          color: "var(--ink)",
        }}
      >
        <div
          style={{
            ...sectionTitle,
            color: MUTED,
            marginBottom: 10,
          }}
        >
          Summary
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            fontFamily: FONT_MONO,
            fontSize: 13,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span style={{ color: MUTED }}>Sub-total</span>
            <span style={{ color: INK }}>{fmt(totals.subtotal)}</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span style={{ color: MUTED }}>Discount ({discountPct || 0}%)</span>
            <span style={{ color: "#d95d5d" }}>-{fmt(totals.discount)}</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span style={{ color: MUTED }}>New Sub-total</span>
            <span style={{ color: INK }}>{fmt(totals.newSubtotal)}</span>
          </div>
          {chargeNhil && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span style={{ color: MUTED }}>
                NHIL &amp; GETFund ({(invoiceTaxRates.nhil * 100).toFixed(1)}%)
              </span>
              <span style={{ color: INK }}>{fmt(totals.nhilGetfund)}</span>
            </div>
          )}
          {chargeVat && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span style={{ color: MUTED }}>
                VAT ({(invoiceTaxRates.vat * 100).toFixed(0)}%)
              </span>
              <span style={{ color: INK }}>{fmt(totals.vat)}</span>
            </div>
          )}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              borderTop: `1px solid ${RULE}`,
              marginTop: 6,
              paddingTop: 10,
            }}
          >
            <span style={{ fontWeight: 700, fontSize: 15, color: INK }}>
              Grand Total
            </span>
            <span
              style={{
                fontWeight: 800,
                fontSize: 22,
                letterSpacing: "-0.3px",
                color: INK,
              }}
            >
              {currency} {fmt(totals.grandTotal)}
            </span>
          </div>
        </div>
      </div>

      {/* ═════ Actions ═════ */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 10,
          marginTop: 4,
        }}
      >
        <Button onClick={create} icon={Check}>
          Create &amp; post invoice
        </Button>
      </div>
    </div>
  );
}
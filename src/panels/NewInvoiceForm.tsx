import React, { useState, useMemo } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { INK, RULE, MUTED, FONT_MONO, FONT_BODY } from "../theme/tokens";
import TableScroll from "../components/ui/TableScroll";
import Th from "../components/ui/Th";
import Td from "../components/ui/Td";
import Button from "../components/ui/Button";
import { inputStyle, labelStyle } from "../components/ui/styles";
import ProjectSelect from "../components/ui/ProjectSelect";
import { fmt, projectName } from "../utils/format";
import { computeInvoiceTotals } from "../utils/invoiceUtils";
import { assertInvoice } from "../validation";
import { db } from "../supabaseClient";
import type { NewInvoiceFormProps } from "../types";

export default function NewInvoiceForm({ data, mutate, onDone, cloneSource }: NewInvoiceFormProps) {
  const [billTo, setBillTo] = useState(cloneSource?.billTo || "");
  const [forText, setForText] = useState(cloneSource?.forText || "");
  const [location, setLocation] = useState(cloneSource?.location || "GREATER ACCRA");
  const [project, setProject] = useState(cloneSource?.project || "GEN");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [currency, setCurrency] = useState(cloneSource?.currency || "GHS");
  const [exchangeRate, setExchangeRate] = useState(String(cloneSource?.exchangeRate || "11.2"));
  const [discountPct, setDiscountPct] = useState(String(cloneSource?.discountPct || "0"));
  const [chargeNhil, setChargeNhil] = useState(cloneSource?.totals?.chargeNhil ?? true);
  const [chargeVat, setChargeVat] = useState(cloneSource?.totals?.chargeVat ?? true);
  const [revenueAccount, setRevenueAccount] = useState(cloneSource?.revenueAccount || "4100");
  const [items, setItems] = useState(
    cloneSource?.items?.length
      ? cloneSource.items.map((it) => ({
          id: String(Date.now()) + Math.random().toString(36).slice(2, 6),
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

  // Filter revenue/income accounts (case-insensitive to match DB values like "income", "Revenue", "Income")
  const revenueOptions = data.accounts.filter((a) => {
    const type = (a.type || "").toLowerCase();
    return type === "revenue" || type === "income";
  });
  const totals = useMemo(
    () =>
      computeInvoiceTotals(
        items,
        discountPct,
        data.nhilGetfundRate,
        data.vatRate,
        chargeNhil,
        chargeVat
      ),
    [items, discountPct, data, chargeNhil, chargeVat]
  );

  function updateItem(i, field, val) {
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
  function removeItem(i) {
    setItems((its) => its.filter((_, idx) => idx !== i));
  }

  async function create() {
    const err = assertInvoice({ billTo, items, dueDate, date });
    if (err) {
      alert(err);
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
      grandTotalGHS: currency === "USD" ? t.grandTotal * rate : t.grandTotal,
      newSubtotalGHS: currency === "USD" ? t.newSubtotal * rate : t.newSubtotal,
      nhilGetfundGHS: currency === "USD" ? t.nhilGetfund * rate : t.nhilGetfund,
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
        { account: revenueAccount, debit: 0, credit: totals.newSubtotalGHS },
        ...(chargeNhil
          ? [{ account: "2205", debit: 0, credit: totals.nhilGetfundGHS }]
          : []),
        ...(chargeVat
          ? [{ account: "2220", debit: 0, credit: totals.vatGHS }]
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
    <div>
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 14 }}
      >
        <div style={{ flex: "1 1 200px" }}>
          <label style={labelStyle}>Bill to</label>
          <input
            style={inputStyle}
            value={billTo}
            onChange={(e) => setBillTo(e.target.value)}
            placeholder="Mr. Ken and Mr. Kasim"
          />
        </div>
        <div style={{ flex: "1 1 200px" }}>
          <label style={labelStyle}>Project</label>
          <ProjectSelect
            value={project}
            onChange={setProject}
            projects={data.projects}
          />
        </div>
        <div style={{ flex: "1 1 200px" }}>
          <label style={labelStyle}>Location</label>
          <input
            style={inputStyle}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
        <div style={{ flex: "2 1 300px" }}>
          <label style={labelStyle}>
            What's this for (appears on receipts)
          </label>
          <input
            style={inputStyle}
            value={forText}
            onChange={(e) => setForText(e.target.value)}
            placeholder="Construction of Four (4) Bedroom Residential Facility"
          />
        </div>
        <div style={{ flex: "1 1 120px" }}>
          <label style={labelStyle}>Date</label>
          <input
            type="date"
            style={inputStyle}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div style={{ flex: "1 1 120px" }}>
          <label style={labelStyle}>Due date</label>
          <input
            type="date"
            style={inputStyle}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        <div style={{ flex: "1 1 100px" }}>
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
          <div style={{ flex: "1 1 120px" }}>
            <label style={labelStyle}>Exchange rate (GHS per USD)</label>
            <input
              style={inputStyle}
              value={exchangeRate}
              onChange={(e) =>
                setExchangeRate(e.target.value.replace(/[^0-9.]/g, ""))
              }
            />
          </div>
        )}
        <div style={{ flex: "1 1 200px" }}>
          <label style={labelStyle}>Revenue account</label>
          <select
            style={inputStyle}
            value={revenueAccount}
            onChange={(e) => setRevenueAccount(e.target.value)}
          >
            {revenueOptions.map((a) => (
              <option key={a.code} value={a.code}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: "1 1 100px" }}>
          <label style={labelStyle}>Discount %</label>
          <input
            style={inputStyle}
            value={discountPct}
            onChange={(e) =>
              setDiscountPct(e.target.value.replace(/[^0-9.]/g, ""))
            }
          />
        </div>
      </div>

      <TableScroll>
        <table
          style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8 }}
        >
          <thead>
            <tr>
              <Th style={{ width: "120px" }}>Type</Th>
              <Th>Description</Th>
              <Th>Unit</Th>
              <Th right>Qty/Days</Th>
              <Th right>Rate</Th>
              <Th right>Amount</Th>
              <Th right>&nbsp;</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.id}>
                <Td>
                  <select
                    style={{ ...inputStyle, padding: "5px" }}
                    value={it.lineType}
                    onChange={(e) => updateItem(i, "lineType", e.target.value)}
                  >
                    <option value="item">Item</option>
                    <option value="header">Header</option>
                    <option value="sub-detail">Sub-detail</option>
                  </select>
                </Td>
                <Td>
                  <input
                    style={inputStyle}
                    value={it.description}
                    onChange={(e) =>
                      updateItem(i, "description", e.target.value)
                    }
                    placeholder="Item description..."
                  />
                </Td>
                <Td>
                  <input
                    style={{ ...inputStyle, width: 70 }}
                    value={it.lineType === "item" ? it.unit : ""}
                    onChange={(e) => updateItem(i, "unit", e.target.value)}
                    disabled={it.lineType !== "item"}
                  />
                </Td>
                <Td right>
                  <input
                    style={{ ...inputStyle, width: 70, textAlign: "right" }}
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
                <Td right>
                  <input
                    style={{
                      ...inputStyle,
                      width: 100,
                      textAlign: "right",
                      fontFamily: FONT_MONO,
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
                <Td right mono>
                  {it.lineType === "item"
                    ? fmt(
                        (parseFloat(it.qty) || 0) * (parseFloat(it.rate) || 0)
                      )
                    : "—"}
                </Td>
                <Td right>
                  <button
                    onClick={() => removeItem(i)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: MUTED,
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
      <Button variant="ghost" onClick={addItem} icon={Plus}>
        Add line item
      </Button>

      <div
        style={{
          marginTop: 16,
          display: "flex",
          gap: 24,
          flexWrap: "wrap",
          padding: 14,
          background: "var(--paper)",
          border: `1px solid ${RULE}`,
          borderRadius: 6,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            id="chargeNhil"
            checked={chargeNhil}
            onChange={(e) => setChargeNhil(e.target.checked)}
            style={{ width: 16, height: 16, cursor: "pointer" }}
          />
          <label
            htmlFor="chargeNhil"
            style={{
              fontFamily: FONT_BODY,
              fontSize: 13,
              color: INK,
              cursor: "pointer",
            }}
          >
            Charge NHIL/GETFund
          </label>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            id="chargeVat"
            checked={chargeVat}
            onChange={(e) => setChargeVat(e.target.checked)}
            style={{ width: 16, height: 16, cursor: "pointer" }}
          />
          <label
            htmlFor="chargeVat"
            style={{
              fontFamily: FONT_BODY,
              fontSize: 13,
              color: INK,
              cursor: "pointer",
            }}
          >
            Charge VAT
          </label>
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          padding: 14,
          background: "var(--paper)",
          border: `1px solid ${RULE}`,
          borderRadius: 6,
          fontFamily: FONT_MONO,
          fontSize: 13,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Sub-total</span>
          <span>{fmt(totals.subtotal)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Discount ({discountPct || 0}%)</span>
          <span>-{fmt(totals.discount)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>New Sub-total</span>
          <span>{fmt(totals.newSubtotal)}</span>
        </div>
        {chargeNhil && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>
              NHIL &amp; GETFund ({(data.nhilGetfundRate * 100).toFixed(1)}%)
            </span>
            <span>{fmt(totals.nhilGetfund)}</span>
          </div>
        )}
        {chargeVat && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>VAT ({(data.vatRate * 100).toFixed(0)}%)</span>
            <span>{fmt(totals.vat)}</span>
          </div>
        )}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontWeight: 700,
            fontSize: 15,
            borderTop: `1px solid ${RULE}`,
            marginTop: 6,
            paddingTop: 6,
          }}
        >
          <span>Grand Total</span>
          <span>
            {currency} {fmt(totals.grandTotal)}
          </span>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <Button onClick={create} icon={Check}>
          Create &amp; post invoice
        </Button>
      </div>
    </div>
  );
}


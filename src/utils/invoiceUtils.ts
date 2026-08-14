export function normalizeTaxRate(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return n > 1 ? n / 100 : n;
}

export function resolveTaxRate(value: number | string | null | undefined, fallback: number): number {
  const normalized = normalizeTaxRate(value);
  return normalized > 0 ? normalized : fallback;
}

export function computeInvoiceTotals(
  items: Array<{ lineType: string; qty: number | string; rate: number | string }>,
  discountPct: number,
  nhilGetfundRate: number,
  vatRate: number,
  chargeNhil: boolean,
  chargeVat: boolean
) {
  const subtotal = items
    .filter((it) => it.lineType === "item")
    .reduce(
      (s, it) => s + parseFloat(String(it.qty || 0)) * parseFloat(String(it.rate || 0)),
      0
    );
  const discount = subtotal * ((parseFloat(String(discountPct)) || 0) / 100);
  const newSubtotal = subtotal - discount;
  const safeNhilRate = resolveTaxRate(nhilGetfundRate, 0.025);
  const safeVatRate = resolveTaxRate(vatRate, 0.15);
  const nhilGetfund = chargeNhil ? newSubtotal * safeNhilRate : 0;
  const vat = chargeVat ? newSubtotal * safeVatRate : 0;
  const grandTotal = newSubtotal + nhilGetfund + vat;
  return {
    subtotal,
    discount,
    newSubtotal,
    nhilGetfund,
    vat,
    grandTotal,
    chargeNhil,
    chargeVat,
  };
}

export const NAVY = "#1F3864";
export const INVOICE_GOLD = "#D4AF37";

export const invTdLabel = {
  border: "1px solid #ccc",
  padding: "6px 8px",
  fontWeight: 700,
  fontSize: 12.5,
};

export const invTdVal = {
  border: "1px solid #ccc",
  padding: "6px 8px",
  textAlign: "right",
  fontSize: 12.5,
};

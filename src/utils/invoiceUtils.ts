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

export function getInvoicePaidAmount(invoice: { payments?: Array<{ amountGHS?: number | null }> | null } | null | undefined): number {
  if (!invoice?.payments) return 0;
  return invoice.payments.reduce((sum, payment) => sum + (Number(payment?.amountGHS) || 0), 0);
}

export function getInvoiceGrandTotalGHS(
  invoice: {
    totals?: Partial<{
      total_ghs: number;
      total: number;
      grandTotalGHS: number;
      grandTotal: number;
      chargeNhil?: boolean;
      chargeVat?: boolean;
    }> | null;
    items?: Array<{ lineType?: string; qty?: number | string; rate?: number | string }>;
    discountPct?: number | string | null;
    currency?: string;
    exchangeRate?: number | string | null;
  } | null | undefined,
  data?: { nhilGetfundRate?: number | string | null; vatRate?: number | string | null } | null
): number {
  if (!invoice) return 0;
  const stored = Number(invoice.totals?.total_ghs ?? invoice.totals?.grandTotalGHS ?? invoice.totals?.total ?? invoice.totals?.grandTotal ?? 0);
  if (Number.isFinite(stored) && stored > 0) return stored;

  const items = invoice.items ?? [];
  const computed = computeInvoiceTotals(
    items,
    Number(invoice.discountPct ?? 0),
    Number(data?.nhilGetfundRate ?? 0.025),
    Number(data?.vatRate ?? 0.15),
    !!invoice.totals?.chargeNhil,
    !!invoice.totals?.chargeVat
  );

  const rawGrandTotal = Number(invoice.totals?.total ?? invoice.totals?.grandTotal ?? computed.grandTotal ?? 0);
  const currency = String(invoice.currency ?? "GHS").toUpperCase();
  const exchangeRate = Number(invoice.exchangeRate ?? 1) || 1;

  if (currency !== "GHS") {
    return rawGrandTotal * exchangeRate;
  }

  return Number(computed.grandTotal) || 0;
}

export function getInvoiceBalance(
  invoice: {
    totals?: Partial<{ total_ghs?: number; grandTotalGHS: number; total?: number; grandTotal?: number; chargeNhil?: boolean; chargeVat?: boolean }> | null;
    items?: Array<{ lineType?: string; qty?: number | string; rate?: number | string }>;
    discountPct?: number | string | null;
    currency?: string;
    exchangeRate?: number | string | null;
    payments?: Array<{ amountGHS?: number | null }> | null;
  } | null | undefined,
  data?: { nhilGetfundRate?: number | string | null; vatRate?: number | string | null } | null
): number {
  if (!invoice) return 0;

  const totalGhs = Number(
    invoice.totals?.total_ghs ??
    invoice.totals?.grandTotalGHS ??
    (String(invoice.currency ?? "GHS").toUpperCase() !== "GHS"
      ? (Number(invoice.totals?.total ?? invoice.totals?.grandTotal ?? 0) * (Number(invoice.exchangeRate ?? 1) || 1))
      : Number(invoice.totals?.total ?? invoice.totals?.grandTotal ?? 0))
  ) || 0;

  const paid = getInvoicePaidAmount(invoice);
  return Math.max(totalGhs - paid, 0);
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

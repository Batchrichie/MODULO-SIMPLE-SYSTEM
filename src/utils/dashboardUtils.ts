import type { AppData, ProjectStats } from '../types';

/** Get all account codes flagged as payment/bank accounts from the DB chart of accounts */
function getPaymentAccountCodes(data: AppData): string[] {
  return data.accounts
    .filter(a => a.isPaymentAccount)
    .map(a => a.code);
}

/** Compute running payment-account cash balance from journal entries for all cash-like accounts. */
export function computeCashFlow(data: AppData) {
  const paymentCodes = getPaymentAccountCodes(data);
  // Fallback to any asset account in the 1xxx range if no payment accounts are flagged.
  const cashCodes = paymentCodes.length > 0
    ? paymentCodes
    : data.accounts.filter(a => a.type === 'Asset' && /^1\d{3}$/.test(a.code)).map(a => a.code);

  if (cashCodes.length === 0) return [];

  const codeSet = new Set(cashCodes);
  const rows: Array<{ date: string; description: string; entryNumber: string; net: number; running: number }> = [];
  let running = 0;
  const sorted = [...data.journal].sort((a, b) => (a.date > b.date ? 1 : -1));
  sorted.forEach((e) => {
    const net = e.lines.reduce(
      (s, l) => s + (codeSet.has(l.account) ? l.debit - l.credit : 0),
      0
    );
    if (net !== 0) {
      running += net;
      rows.push({ date: e.date, description: e.description || '', entryNumber: e.entryNumber, net, running });
    }
  });
  return rows;
}

/** Derive KPI metrics from raw app data — linked to DB accounts, invoices & bills */
export function getDashboardMetrics(data: AppData) {
  const balanceFor = (codes: string[]) => {
    const codeSet = new Set(codes);
    let debit = 0, credit = 0;
    data.journal.forEach(e => e.lines.forEach(l => {
      if (codeSet.has(l.account)) { debit += l.debit; credit += l.credit; }
    }));
    return debit - credit;
  };

  // --- Cash & cash equivalents: sum payment/bank account balances from the ledger ---
  const paymentCodes = data.accounts
    .filter(a => a.isPaymentAccount)
    .map(a => a.code);
  // Fallback: asset accounts in the 1xxx range if none are explicitly flagged.
  const cashCodes = paymentCodes.length > 0
    ? paymentCodes
    : data.accounts.filter(a => a.type === 'Asset' && /^1\d{3}$/.test(a.code)).map(a => a.code);
  const cash = balanceFor(cashCodes);

  // --- AR: sum of unpaid invoice balances ---
  const ar = data.invoices
    .filter(inv => inv.status !== 'Void')
    .reduce((sum, inv) => {
      const paid = inv.payments.reduce((s, p) => s + p.amountGHS, 0);
      const totalGhs = inv.totals?.total_ghs ?? inv.totals?.grandTotalGHS ?? inv.totals?.total ?? inv.totals?.grandTotal ?? 0;
      return sum + Math.max(totalGhs - paid, 0);
    }, 0);

  // --- AP: sum of unpaid bill balances ---
  const ap = data.bills
    .reduce((sum, bill) => {
      const paid = bill.payments.reduce((s, p) => s + p.amount, 0);
      return sum + Math.max(bill.amount - paid, 0);
    }, 0);

  let totalRevenue = 0;
  let totalCostOfSales = 0;
  let totalAdminExpenses = 0;
  data.journal.forEach(e => e.lines.forEach(l => {
    const acc = data.accounts.find(a => a.code === l.account);
    if (!acc) return;
    if (acc.type === 'Income') {
      totalRevenue += (l.credit - l.debit);
    }
    if (acc.type === 'Expense') {
      const codeNum = parseInt(l.account, 10) || 0;
      const amt = l.debit - l.credit;
      if (codeNum >= 5000 && codeNum < 6000) totalCostOfSales += amt;
      else totalAdminExpenses += amt;
    }
  }));
  const totalExpenses = totalCostOfSales + totalAdminExpenses;
  const netIncome = totalRevenue - totalExpenses;

  let totalContractValue = 0;
  let totalEstimatedCost = 0;
  let totalActualCost = 0;

  const activeProjects = data.projects.filter(p => p.status === 'Active' && p.id !== 'GEN');

  activeProjects.forEach(p => {
    totalContractValue += parseFloat(p.contractValue) || 0;
    totalEstimatedCost += parseFloat(p.estimatedCost) || 0;
  });

  data.journal.forEach(e => {
    if (e.project && e.project !== 'GEN') {
      const proj = activeProjects.find(p => p.id === e.project);
      if (proj) {
        e.lines.forEach(l => {
          const acc = data.accounts.find(a => a.code === l.account);
          if (acc && acc.type === 'Expense') totalActualCost += (l.debit - l.credit);
        });
      }
    }
  });

  const projectedGrossMargin = totalContractValue - totalEstimatedCost;
  const projectedMarginPct = totalContractValue > 0 ? (projectedGrossMargin / totalContractValue) * 100 : 0;

  const cashFlowData = computeCashFlow(data).slice(-6).map(c => ({ date: c.date, value: c.running }));

  const monthlyData: Record<string, { revenue: number; expense: number }> = {};
  data.journal.forEach(e => {
    const month = e.period;
    if (!month) return;
    if (!monthlyData[month]) monthlyData[month] = { revenue: 0, expense: 0 };
    e.lines.forEach(l => {
      const acc = data.accounts.find(a => a.code === l.account);
      if (!acc) return;
      if (acc.type === 'Income') monthlyData[month].revenue += (l.credit - l.debit);
      if (acc.type === 'Expense') monthlyData[month].expense += (l.debit - l.credit);
    });
  });
  const barChartData = Object.keys(monthlyData).slice(-6).map(m => ({
    label: m.split('-')[1] + '/' + m.split('-')[0].slice(2),
    revenue: monthlyData[m].revenue,
    expense: monthlyData[m].expense,
  }));

  const donutData = activeProjects.map(p => ({ name: p.name, value: parseFloat(p.contractValue) || 0 })).filter(d => d.value > 0);

  return {
    cash, ar, ap, netIncome, totalRevenue, totalExpenses,
    totalContractValue, totalEstimatedCost, totalActualCost,
    projectedGrossMargin, projectedMarginPct,
    cashFlowData, barChartData, donutData,
  };
}

/** Tax/remittance deadline alerts based on current date */
export function getComplianceNotifications() {
  const today = new Date();
  const day = today.getDate();
  const alerts: Array<{ text: string; color: string }> = [];

  if (day >= 10 && day <= 14) {
    alerts.push({ text: 'PAYE & SSNIT due in 1-5 days (15th). Prepare remittances.', color: 'var(--gold)' });
  }
  if (day >= 25 && day <= 29) {
    alerts.push({ text: 'VAT due soon (end of month). Prepare remittance.', color: 'var(--alert)' });
  }
  if (day > 15 && day < 25) {
    alerts.push({ text: 'PAYE & SSNIT were due on the 15th. Verify compliance.', color: 'var(--alert)' });
  }

  return alerts;
}

/** Sort & enrich active projects by recent activity score */
export function getPrioritizedProjects(data: AppData, stats: ProjectStats[]) {
  const now = new Date();

  const enriched = stats
    .filter(p => p.status === 'Active' && p.id !== 'GEN')
    .map(p => {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const recentEntries = data.journal.filter(e =>
        (e.project || 'GEN') === p.id && e.date >= thirtyDaysAgo
      );
      const recentInvoices = data.invoices.filter(inv =>
        (inv.project || 'GEN') === p.id && inv.date >= thirtyDaysAgo && inv.status !== 'Void'
      );

      const entryScore = recentEntries.length * 10;
      const invoiceScore = recentInvoices.length * 15;
      const costActivity = p.actualCost > 0 ? 20 : 0;
      const revenueActivity = p.revenueBilled > 0 ? 15 : 0;
      const totalScore = entryScore + invoiceScore + costActivity + revenueActivity;
      const isCurrentFocus = totalScore >= 20 || p.actualCost > 0;

      return {
        ...p,
        activityScore: totalScore,
        isCurrentFocus,
        recentEntryCount: recentEntries.length,
        recentInvoiceCount: recentInvoices.length,
        lastActivityDate: [...recentEntries.map(e => e.date), ...recentInvoices.map(i => i.date)].sort().pop() || null,
      };
    });

  return enriched.sort((a, b) => {
    if (a.isCurrentFocus && !b.isCurrentFocus) return -1;
    if (!a.isCurrentFocus && b.isCurrentFocus) return 1;
    return b.activityScore - a.activityScore || b.contractValue - a.contractValue;
  });
}

export function extractRevenueBilledGHS(inv: {
  totals?: {
    subtotal_ghs?: number; taxable_value_ghs?: number;
    newSubtotalGHS?: number; newSubtotal?: number;
    total_ghs?: number; grandTotalGHS?: number; total?: number; grandTotal?: number;
    vat_ghs?: number; nhil_ghs?: number; getfund_ghs?: number;
    charge_vat?: boolean; charge_nhil?: boolean;
    chargeVat?: boolean; chargeNhil?: boolean;
    vat_rate?: number | string; nhil_getfund_rate?: number | string; getfund_rate?: number | string;
    vatRate?: number | string; nhilGetfundRate?: number | string;
  } | null;
  currency?: string; exchangeRate?: number;
  fallbackVatRate?: number; fallbackNhilGetfundRate?: number;
}): number {
  const t = inv.totals ?? ({} as NonNullable<typeof inv.totals>);

  // -- Tier 1: direct pre-tax fields (snake_case DB-backed first; camelCase legacy after) --
  // PRODUCTION NOTE: newSubtotalGHS/newSubtotal are dead for RPC-persisted invoices;
  // subtotal_ghs and taxable_value_ghs are the canonical keys from post_invoice RPC.
  const direct = t.subtotal_ghs ?? t.taxable_value_ghs ?? t.newSubtotalGHS ?? t.newSubtotal;
  if (typeof direct === 'number' && Number.isFinite(direct) && direct >= 0) return direct;

  // -- Tier 2: recover pre-tax from grand total by reversing tax application. --
  // This is the de-facto primary path if Tier 1 fields are missing for any reason,
  // so it MUST use real stored keys/snake_case and not silently fall to hardcoded constants.
  const grand = t.total_ghs ?? t.grandTotalGHS ?? t.total ?? t.grandTotal;
  if (typeof grand !== 'number' || !Number.isFinite(grand) || grand <= 0) return 0;

  // Pull ACTUAL charge flags from stored totals.
  // PRODUCTION CASING (verified against real persisted invoice totals JSONB, SP/2026/0001):
  //   chargeVat / chargeNhil = camelCase  (NOT charge_vat / charge_nhil snake_case)
  //   vat_rate  / nhil_getfund_rate = snake_case
  // We ??-check both casings for safety but the documented live format is camelCase flags + snake_case rates.
  const cv = Boolean(t.chargeVat ?? (t as Record<string, unknown>).charge_vat);
  const cn = Boolean(t.chargeNhil ?? (t as Record<string, unknown>).charge_nhil);

  // Pull ACTUAL recorded rates from THIS INVOICE'S stored totals (snake_case confirmed in prod).
  // Only fall to the caller-provided global/fallback rate if the invoice truly stored none.
  const vatR_raw: unknown = (t as Record<string, unknown>).vat_rate
    ?? (t as Record<string, unknown>).vatRate
    ?? inv.fallbackVatRate;
  // nhil_getfund_rate is the COMBINED NHIL 2.5% + GETFund 2.5% = 5% rate (see computeInvoiceTotals).
  const nhilR_raw: unknown = (t as Record<string, unknown>).nhil_getfund_rate
    ?? (t as Record<string, unknown>).nhilGetfundRate
    ?? inv.fallbackNhilGetfundRate;

  const vatR = resolveTaxRate(vatR_raw, 0.15);
  const nhilR = resolveTaxRate(nhilR_raw, 0.025);

  // If NO tax flags are set, grand total is already pre-tax.
  if (!cv && !cn) return grand;

  const divisor = 1 + (cv ? vatR : 0) + (cn ? nhilR : 0);
  if (divisor <= 1 || !Number.isFinite(divisor)) return grand;

  const reversed = grand / divisor;
  if (Number.isFinite(reversed) && reversed > 0) return reversed;
  return grand;
}

export function resolveTaxRate(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return n > 1 ? n / 100 : n;
}

/** Per-project financial summary */
export function projectStatsFn(data: AppData): ProjectStats[] {
  return data.projects.map((p) => {
    const revenueBilled = data.journal
      .filter((je) => je.project === p.id)
      .flatMap((je) => je.lines)
      .filter((l) => {
        const acc = data.accounts.find((a) => a.code === l.account);
        return acc && acc.type === 'Income';
      })
      .reduce((s, l) => s + (l.credit - l.debit), 0);
    const actualCost = data.journal
      .filter((je) => je.project === p.id)
      .flatMap((je) => je.lines)
      .filter((l) => {
        const acc = data.accounts.find((a) => a.code === l.account);
        return acc && acc.type === 'Expense';
      })
      .reduce((s, l) => s + l.debit, 0);
    const estimatedCost = p.estimatedCost ?? 0;
    const remainingCost = Math.max(estimatedCost - actualCost, 0);
  const projectedMargin = (p.contractValue ?? 0) - estimatedCost;
  const wipMargin = revenueBilled - actualCost;
  return {
    id: p.id,
    name: p.name,
    status: p.status,
    recognitionMethod: p.recognitionMethod,
    contractValue: p.contractValue ?? 0,
    revenueBilled,
    actualCost,
    estimatedCost,
    remainingCost,
    projectedMargin,
    wipMargin,
  };
  });
}

/* ------------------------------------------------------------------ */
/*  Cash Flow Statement computation                                    */
/* ------------------------------------------------------------------ */

interface CashFlowLine {
  description: string;
  amount: number;
  indent?: boolean;
  bold?: boolean;
  isSubtotal?: boolean;
}

interface CashFlowSection {
  title: string;
  lines: CashFlowLine[];
  subtotal: number;
}

export interface CashFlowStatement {
  operating: CashFlowSection;
  investing: CashFlowSection;
  financing: CashFlowSection;
  netChange: number;
  openingBalance: number;
  closingBalance: number;
}

function getAccountByCode(data: AppData, code: string) {
  return data.accounts.find(a => a.code === code);
}

function classifyActivity(accountType: string | undefined, role: string | undefined): 'operating' | 'investing' | 'financing' {
  if (!accountType) return 'operating';
  const r = (role || '').toLowerCase();
  if (r === 'ar' || r === 'ap' || r === 'vat-payable' || r === 'nhil-payable' || r === 'current-liability') return 'operating';
  if (r === 'non-current-asset') return 'investing';
  if (r === 'equity' || r === 'non-current-liability') return 'financing';
  switch (accountType) {
    case 'Revenue':
    case 'Income':
    case 'Expense':
      return 'operating';
    case 'Asset':
      return 'investing';
    case 'Liability':
    case 'Equity':
      return 'financing';
    default:
      return 'operating';
  }
}

function formatAccountName(data: AppData, code: string): string {
  const acc = getAccountByCode(data, code);
  return acc ? acc.name : code;
}

export function computeCashFlowStatement(data: AppData, startDate?: string, endDate?: string): CashFlowStatement {
  const paymentCodes = getPaymentAccountCodes(data);
  const cashCodeSet = new Set(paymentCodes);

  const entries = data.journal.filter(e => {
    if (startDate && e.date < startDate) return false;
    if (endDate && e.date > endDate) return false;
    return true;
  });

  const operatingMap = new Map<string, number>();
  const investingMap = new Map<string, number>();
  const financingMap = new Map<string, number>();

  entries.forEach(entry => {
    const hasCashLine = entry.lines.some(l => cashCodeSet.has(l.account));
    if (!hasCashLine) return;

    const cashNet = entry.lines.reduce((s, l) => s + (cashCodeSet.has(l.account) ? l.debit - l.credit : 0), 0);
    if (cashNet === 0) return;

    const nonCashLines = entry.lines.filter(l => !cashCodeSet.has(l.account));
    if (nonCashLines.length === 0) return;

    const primaryLine = nonCashLines[0];
    const account = getAccountByCode(data, primaryLine.account);
    const activity = classifyActivity(account?.type, account?.role);

    const description = formatAccountName(data, primaryLine.account);
    const targetMap = activity === 'operating' ? operatingMap : activity === 'investing' ? investingMap : financingMap;
    const existing = targetMap.get(description) || 0;
    targetMap.set(description, existing + cashNet);
  });

  const buildSection = (title: string, map: Map<string, number>, invertSign: boolean): CashFlowSection => {
    const lines: CashFlowLine[] = [];
    let subtotal = 0;
    map.forEach((amount, desc) => {
      const val = invertSign ? -amount : amount;
      subtotal += val;
      lines.push({ description: desc, amount: val, indent: true });
    });
    return { title, lines, subtotal };
  };

  const operating = buildSection('CASH FLOWS FROM OPERATING ACTIVITIES', operatingMap, false);
  const investing = buildSection('CASH FLOWS FROM INVESTING ACTIVITIES', investingMap, false);
  const financing = buildSection('CASH FLOWS FROM FINANCING ACTIVITIES', financingMap, false);

  const netChange = operating.subtotal + investing.subtotal + financing.subtotal;

  const sortedAll = [...data.journal].sort((a, b) => (a.date > b.date ? 1 : -1));
  const filteredForBalance = startDate ? sortedAll.filter(e => e.date < startDate) : sortedAll;
  const openingBalance = filteredForBalance.reduce((s, e) => {
    return s + e.lines.reduce((s2, l) => s2 + (cashCodeSet.has(l.account) ? l.debit - l.credit : 0), 0);
  }, 0);
  const closingBalance = openingBalance + netChange;

  return {
    operating,
    investing,
    financing,
    netChange,
    openingBalance,
    closingBalance,
  };
}
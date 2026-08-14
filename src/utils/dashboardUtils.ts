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
      return sum + Math.max((inv.totals.grandTotalGHS ?? inv.totals.grandTotal) - paid, 0);
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
    if (acc.type === 'Revenue' || acc.type === 'Income') {
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
      if (acc.type === 'Revenue' || acc.type === 'Income') monthlyData[month].revenue += (l.credit - l.debit);
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

/** Per-project financial summary */
export function projectStatsFn(data: AppData): ProjectStats[] {
  return data.projects.map((p) => {
    const revenueBilled = data.invoices
      .filter((inv) => inv.project === p.id && inv.status !== 'Void')
      .reduce((s, inv) => s + (inv.totals.newSubtotalGHS ?? inv.totals.newSubtotal), 0);
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
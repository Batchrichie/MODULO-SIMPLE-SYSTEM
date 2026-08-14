import { createClient, Session } from '@supabase/supabase-js';
import { normalizeTaxRate } from './utils/invoiceUtils';
import type {
  Account,
  Project,
  Employee,
  JournalEntry,
  JournalLine,
  Invoice,
  InvoiceItem,
  Payment,
  PayrollRun,
  PayrollLine,
  TaxConfig,
  TaxRates,
  PayeBracket,
  AppData,
  AppSettingsData,
  Db,
  Bill,
  BillPayment,
  BankReconciliation,
  BankReconciliationItem,
} from './types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase environment variables. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);

/* ------------------------------------------------------------------ */
/*  Row mappers (snake_case ↔ camelCase)                                */
/* ------------------------------------------------------------------ */

interface AccountRow {
  code: string;
  name: string;
  type: string;
  reporting_group?: string | null;
  normal?: string | null;
  is_payment_account?: boolean | null;
}

function accountFromRow(r: AccountRow): Account {
  return {
    code: r.code,
    name: r.name,
    type: r.type,
    reportingGroup: r.reporting_group,
    normal: r.normal,
    isPaymentAccount: r.is_payment_account ?? false,
  };
}

function accountToRow(a: Account): AccountRow {
  return {
    code: a.code,
    name: a.name,
    type: a.type,
    reporting_group: a.reportingGroup ?? null,
    normal: a.normal ?? null,
    is_payment_account: a.isPaymentAccount ?? false,
  };
}

interface ProjectRow {
  id: string;
  name: string;
  status?: string | null;
  project_type?: string | null;
  recognition_method?: string | null;
  contract_value?: number | null;
  estimated_cost?: number | null;
}

function projectFromRow(r: ProjectRow): Project {
  return {
    id: r.id,
    name: r.name,
    status: r.status,
    projectType: r.project_type,
    recognitionMethod: r.recognition_method,
    contractValue: r.contract_value,
    estimatedCost: r.estimated_cost,
  };
}

function projectToRow(p: Project): ProjectRow {
  return {
    id: p.id,
    name: p.name,
    status: p.status ?? null,
    project_type: p.projectType ?? null,
    recognition_method: p.recognitionMethod ?? null,
    contract_value: p.contractValue ?? null,
    estimated_cost: p.estimatedCost ?? null,
  };
}

interface EmployeeRow {
  id: string;
  name: string;
  base_salary?: number | null;
  active?: boolean | null;
  ssnit_no?: string | null;
  nia_card?: string | null;
  designation?: string | null;
  exempt_paye?: boolean | null;
  exempt_ssnit?: boolean | null;
  position_id?: string | null;
  portal_access?: boolean | null;
  email?: string | null;
  phone?: string | null;
  auth_user_id?: string | null;
  onboarding_status?: Employee['onboardingStatus'] | null;
  invited_at?: string | null;
}

function employeeFromRow(r: EmployeeRow): Employee {
  return {
    id: r.id,
    name: r.name,
    baseSalary: r.base_salary ?? 0,
    active: r.active ?? true,
    ssnitNo: r.ssnit_no,
    niaCard: r.nia_card,
    designation: r.designation,
    exemptPaye: r.exempt_paye ?? false,
    exemptSsnit: r.exempt_ssnit ?? false,
    positionId: r.position_id ?? null,
    portalAccess: r.portal_access ?? false,
      email: r.email ?? null,
      phone: r.phone ?? null,
      authUserId: r.auth_user_id ?? null,
      onboardingStatus: r.onboarding_status ?? 'not_invited',
      invitedAt: r.invited_at ?? null,
  };
}

function employeeToRow(e: Employee): EmployeeRow {
  return {
    id: e.id,
    name: e.name,
    base_salary: e.baseSalary ?? null,
    active: e.active ?? true,
    ssnit_no: e.ssnitNo ?? null,
    nia_card: e.niaCard ?? null,
    designation: e.designation ?? null,
    position_id: e.positionId ?? null,
    portal_access: e.portalAccess ?? false,
    exempt_paye: e.exemptPaye ?? false,
    exempt_ssnit: e.exemptSsnit ?? false,
    email: e.email ?? null,
    phone: e.phone ?? null,
      // Intentionally omitted: auth_user_id, onboarding_status, invited_at.
      // Those are only ever written by inviteEmployee() / the self-service password
      // flow — never by the generic "save employee" form — so we don't risk
      // clobbering onboarding state on an unrelated edit.
  };
}

interface JournalLineRow {
  account_code: string;
  debit: number;
  credit: number;
}

function journalLineFromRow(r: JournalLineRow): JournalLine {
  return {
    account: r.account_code,
    debit: Number(r.debit) || 0,
    credit: Number(r.credit) || 0,
  };
}

function journalLineToRow(l: JournalLine, entryId: string): JournalLineRow & { entry_id: string } {
  return { entry_id: entryId, account_code: l.account, debit: l.debit ?? 0, credit: l.credit ?? 0 };
}

interface InvoiceItemRow {
  id: string;
  line_type?: string | null;
  description?: string | null;
  unit?: string | null;
  qty?: number | null;
  rate?: number | null;
}

function invoiceItemFromRow(r: InvoiceItemRow): InvoiceItem {
  return {
    id: r.id,
    lineType: (r.line_type as InvoiceItem['lineType']) ?? 'item',
    description: r.description ?? '',
    unit: r.unit,
    qty: r.qty ?? 0,
    rate: r.rate ?? 0,
  };
}

function invoiceItemToRow(it: InvoiceItem, invoiceId: string): InvoiceItemRow & { invoice_id: string } {
  return {
    id: it.id,
    invoice_id: invoiceId,
    line_type: it.lineType ?? null,
    description: it.description ?? null,
    unit: it.unit ?? null,
    qty: it.qty ?? null,
    rate: it.rate ?? null,
  };
}

interface PaymentRow {
  id: string;
  date: string;
  amount_ghs?: number | null;
  method?: string | null;
  reference?: string | null;
}

function paymentFromRow(r: PaymentRow): Payment {
  return {
    id: r.id,
    date: r.date,
    amountGHS: r.amount_ghs ?? 0,
    method: r.method ?? '',
    reference: r.reference,
  };
}

function paymentToRow(p: Payment, invoiceId: string): PaymentRow & { invoice_id: string } {
  return {
    id: p.id,
    invoice_id: invoiceId,
    date: p.date,
    amount_ghs: p.amountGHS ?? null,
    method: p.method ?? null,
    reference: p.reference ?? null,
  };
}

interface InvoiceRow {
  id: string;
  invoice_number: string;
  date: string;
  due_date?: string | null;
  bill_to?: string | null;
  for_text?: string | null;
  location?: string | null;
  project?: string | null;
  project_label?: string | null;
  currency?: string | null;
  exchange_rate?: number | null;
  discount_pct?: number | null;
  revenue_account?: string | null;
  status?: string | null;
  totals?: Invoice['totals'] | null;
  journal_entry_id?: string | null;
  reversal_entry_id?: string | null;
}

function invoiceFromRow(r: InvoiceRow): Invoice {
  return {
    id: r.id,
    invoiceNumber: r.invoice_number,
    date: r.date,
    dueDate: r.due_date,
    billTo: r.bill_to ?? '',
    forText: r.for_text,
    location: r.location,
    project: r.project,
    projectLabel: r.project_label,
    currency: (r.currency as import('./types').Currency) ?? 'GHS',
    exchangeRate: r.exchange_rate ?? 1,
    discountPct: r.discount_pct ?? 0,
    revenueAccount: r.revenue_account,
    status: (r.status as import('./types').InvoiceStatus) ?? 'Sent',
    totals: r.totals ?? ({} as Invoice['totals']),
    journalEntryId: r.journal_entry_id ?? null,
    reversalJournalEntryId: r.reversal_entry_id ?? null,
  };
}

function invoiceToRow(inv: Invoice): InvoiceRow {
  return {
    id: inv.id,
    invoice_number: inv.invoiceNumber,
    date: inv.date,
    due_date: inv.dueDate ?? null,
    bill_to: inv.billTo ?? null,
    for_text: inv.forText ?? null,
    location: inv.location ?? null,
    project: inv.project ?? null,
    project_label: inv.projectLabel ?? null,
    currency: inv.currency ?? null,
    exchange_rate: inv.exchangeRate ?? null,
    discount_pct: inv.discountPct ?? null,
    revenue_account: inv.revenueAccount ?? null,
    status: inv.status ?? null,
    totals: inv.totals ?? null,
    journal_entry_id: inv.journalEntryId ?? null,
    reversal_entry_id: inv.reversalJournalEntryId ?? null,
  };
}

interface PayrollLineRow {
  employee_id: string;
  name?: string | null;
  gross?: number | null;
  ssnit_employee?: number | null;
  ssnit_employer?: number | null;
  paye?: number | null;
  net?: number | null;
}

function payrollLineFromRow(r: PayrollLineRow): PayrollLine {
  return {
    employeeId: r.employee_id,
    name: r.name ?? '',
    gross: r.gross ?? 0,
    ssnitEmployee: r.ssnit_employee ?? 0,
    ssnitEmployer: r.ssnit_employer ?? 0,
    paye: r.paye ?? 0,
    net: r.net ?? 0,
  };
}

function payrollLineToRow(l: PayrollLine, runId: string): PayrollLineRow & { run_id: string } {
  return {
    run_id: runId,
    employee_id: l.employeeId,
    name: l.name ?? null,
    gross: l.gross ?? null,
    ssnit_employee: l.ssnitEmployee ?? null,
    ssnit_employer: l.ssnitEmployer ?? null,
    paye: l.paye ?? null,
    net: l.net ?? null,
  };
}

/* ------------------------------------------------------------------ */
/*  Bill mappers                                                        */
/* ------------------------------------------------------------------ */

interface BillRow {
  id: string;
  bill_number: string;
  date: string;
  due_date?: string | null;
  vendor: string;
  description?: string | null;
  project?: string | null;
  amount?: number | null;
  status?: string | null;
}

interface BillPaymentRow {
  id: string;
  bill_id: string;
  date: string;
  amount?: number | null;
  method?: string | null;
  reference?: string | null;
}

function billFromRow(r: BillRow): Bill {
  return {
    id: r.id,
    billNumber: r.bill_number,
    date: r.date,
    dueDate: r.due_date,
    vendor: r.vendor,
    description: r.description,
    project: r.project,
    amount: r.amount ?? 0,
    status: (r.status as Bill['status']) ?? 'Unpaid',
    payments: [],
  };
}

function billToRow(b: Bill): BillRow {
  return {
    id: b.id,
    bill_number: b.billNumber,
    date: b.date,
    due_date: b.dueDate ?? null,
    vendor: b.vendor,
    description: b.description ?? null,
    project: b.project ?? null,
    amount: b.amount ?? null,
    status: b.status ?? null,
  };
}

function billPaymentFromRow(r: BillPaymentRow): BillPayment {
  return {
    id: r.id,
    date: r.date,
    amount: r.amount ?? 0,
    method: r.method ?? '',
    reference: r.reference,
  };
}

function billPaymentToRow(p: BillPayment, billId: string): BillPaymentRow {
  return {
    id: p.id,
    bill_id: billId,
    date: p.date,
    amount: p.amount ?? null,
    method: p.method ?? null,
    reference: p.reference ?? null,
  };
}
/* ------------------------------------------------------------------ */
/* Bank Reconciliation mappers                                         */
/* ------------------------------------------------------------------ */

interface BankReconciliationRow {
  id: string;
  account_code: string;
  statement_date: string;
  statement_balance: number;
  status: string;
}

function bankReconciliationFromRow(r: BankReconciliationRow): BankReconciliation {
  return {
    id: r.id,
    accountCode: r.account_code,
    statementDate: r.statement_date,
    statementBalance: r.statement_balance ?? 0,
    status: (r.status as BankReconciliation['status']) ?? 'Draft',
    items: [],
  };
}

function bankReconciliationToRow(r: BankReconciliation): BankReconciliationRow {
  return {
    id: r.id,
    account_code: r.accountCode,
    statement_date: r.statementDate,
    statement_balance: r.statementBalance,
    status: r.status,
  };
}

interface BankReconciliationItemRow {
  id: string;
  reconciliation_id: string;
  journal_entry_id: string;
  account_code: string;
  amount: number;
}

function bankRecItemFromRow(r: BankReconciliationItemRow): BankReconciliationItem {
  return {
    id: r.id,
    reconciliationId: r.reconciliation_id,
    journalEntryId: r.journal_entry_id,
    accountCode: r.account_code,
    amount: r.amount ?? 0,
  };
}

function bankRecItemToRow(i: BankReconciliationItem): BankReconciliationItemRow {
  return {
    id: i.id,
    reconciliation_id: i.reconciliationId,
    journal_entry_id: i.journalEntryId,
    account_code: i.accountCode,
    amount: i.amount,
  };
}
/* ------------------------------------------------------------------ */
/*  Auth                                                                */
/* ------------------------------------------------------------------ */

export async function signIn(email: string, password: string): Promise<NonNullable<Session>> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.session) throw new Error('No session returned after sign-in');
  return data.session;
}

export async function signUp(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

/* ------------------------------------------------------------------ */
/*  Financial views / RPC                                               */
/* ------------------------------------------------------------------ */

export interface TrialBalanceRow {
  code: string;
  name: string;
  type: string;
  total_debit: number;
  total_credit: number;
  balance: number;
}

export async function getTrialBalance(): Promise<TrialBalanceRow[]> {
  const { data, error } = await supabase.from('vw_trial_balance').select('*');
  if (error) {
    console.error('Error fetching Trial Balance:', error);
    return [];
  }
  return (data ?? []) as TrialBalanceRow[];
}

export async function getBalanceSheet(): Promise<TrialBalanceRow[]> {
  const { data, error } = await supabase.from('vw_balance_sheet').select('*');
  if (error) {
    console.error('Error fetching Balance Sheet:', error);
    return [];
  }
  return (data ?? []) as TrialBalanceRow[];
}

export interface ProfitLossRow {
  code: string;
  name: string;
  type: string;
  total_debit: number;
  total_credit: number;
  balance: number;
}

export async function getProfitAndLoss(startDate: string, endDate: string): Promise<ProfitLossRow[]> {
  const { data, error } = await supabase.rpc('get_profit_and_loss', {
    p_start_date: startDate,
    p_end_date: endDate,
  });
  if (error) {
    console.error('Error fetching P&L:', error);
    return [];
  }
  return (data ?? []) as ProfitLossRow[];
}

/* ------------------------------------------------------------------ */
/*  Payroll automation                                                  */
/* ------------------------------------------------------------------ */

export async function runPayrollAndFetch(period: string): Promise<{ run: PayrollRun; journalEntry: JournalEntry }> {
  const { error: rpcError } = await supabase.rpc('run_payroll', { p_period: period });
  if (rpcError) {
    console.error('Error running payroll:', rpcError);
    throw rpcError;
  }

  const entryId = `JE-PAY-${period}`;

  const [runResult, entryResult] = await Promise.all([
    supabase.from('payroll_runs').select('*, payroll_lines(*)').eq('period', period).single(),
    supabase.from('journal_entries').select('*, journal_lines(*)').eq('id', entryId).single(),
  ]);

  if (runResult.error) {
    console.error('Error fetching posted payroll run:', runResult.error);
    throw runResult.error;
  }
  if (entryResult.error) {
    console.error('Error fetching posted payroll journal entry:', entryResult.error);
    throw entryResult.error;
  }

  const runData = runResult.data as Record<string, unknown> & {
    payroll_lines?: PayrollLineRow[];
  };
  const entryData = entryResult.data as Record<string, unknown> & {
    journal_lines?: JournalLineRow[];
  };

  const run: PayrollRun = {
    id: String(runData.id),
    period: String(runData.period),
    entryNumber: runData.entry_number ? String(runData.entry_number) : null,
    postedAt: runData.posted_at ? String(runData.posted_at) : null,
    rows: (runData.payroll_lines ?? []).map(payrollLineFromRow),
  };

  const journalEntry: JournalEntry = {
    id: String(entryData.id),
    entryNumber: String(entryData.entry_number),
    date: String(entryData.date),
    description: entryData.description ? String(entryData.description) : null,
    period: entryData.period ? String(entryData.period) : null,
    project: entryData.project ? String(entryData.project) : null,
    lines: (entryData.journal_lines ?? []).map(journalLineFromRow),
  };

  return { run, journalEntry };
}

/* ------------------------------------------------------------------ */
/*  Settings & tax config                                               */
/* ------------------------------------------------------------------ */

async function loadAppSettings(): Promise<AppSettingsData> {
  const { data, error } = await supabase.from('app_settings').select('data').eq('id', 1).maybeSingle();
  if (error) {
    console.error('Error loading app settings:', error);
    return {};
  }
  return (data?.data as AppSettingsData) ?? {};
}

async function mergeAppSettings(updates: AppSettingsData): Promise<AppSettingsData> {
  const existing = await loadAppSettings();
  const merged = { ...existing, ...updates };
  const { error } = await supabase.from('app_settings').upsert({ id: 1, data: merged });
  if (error) {
    console.error('Error saving app settings:', error);
    throw error;
  }
  return merged;
}

export async function loadTaxConfig(): Promise<TaxConfig> {
  const settings = await loadAppSettings();
  const hasOwn = (key: string) => Object.prototype.hasOwnProperty.call(settings, key);
  const fallback = {
    ssnitEmployeeRate: 0.055,
    ssnitEmployerRate: 0.135,
    nhilGetfundRate: 0.05,
    vatRate: 0.15,
  };

  return {
    rates: {
      ssnitEmployeeRate: normalizeTaxRate(hasOwn('ssnitEmployeeRate') ? settings.ssnitEmployeeRate : fallback.ssnitEmployeeRate),
      ssnitEmployerRate: normalizeTaxRate(hasOwn('ssnitEmployerRate') ? settings.ssnitEmployerRate : fallback.ssnitEmployerRate),
      nhilGetfundRate: normalizeTaxRate(hasOwn('nhilGetfundRate') ? settings.nhilGetfundRate : fallback.nhilGetfundRate),
      vatRate: normalizeTaxRate(hasOwn('vatRate') ? settings.vatRate : fallback.vatRate),
    },
    brackets: Array.isArray(settings.brackets) ? (settings.brackets as PayeBracket[]) : [],
  };
}

export async function saveTaxRates(rates: TaxRates): Promise<AppSettingsData> {
  return mergeAppSettings(rates);
}

export async function savePayeBrackets(brackets: PayeBracket[]): Promise<AppSettingsData> {
  return mergeAppSettings({ brackets });
}

export function onAuthStateChange(callback: (session: Session | null) => void): () => void {
  const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => listener.subscription.unsubscribe();
}

/* ------------------------------------------------------------------ */
/*  Load full ledger state                                              */
/* ------------------------------------------------------------------ */

interface JournalEntryRow {
  id: string;
  entry_number: string;
  date: string;
  description?: string | null;
  period?: string | null;
  project?: string | null;
  reversed?: boolean | null;
  reversal_of?: string | null;
}

interface PayrollRunRow {
  id: string;
  period: string;
  entry_number?: string | null;
  posted_at?: string | null;
}

export async function loadLedgerState(): Promise<AppData | null> {
  try {
    const [
      { data: settingsData, error: settingsErr },
      { data: accounts, error: accountsErr },
      { data: projects, error: projectsErr },
      { data: journalEntries, error: journalEntriesErr },
      { data: journalLines, error: journalLinesErr },
      { data: invoices, error: invoicesErr },
      { data: invoiceItems, error: invoiceItemsErr },
      { data: payments, error: paymentsErr },
      { data: employees, error: employeesErr },
      { data: payrollRuns, error: payrollRunsErr },
      { data: payrollLines, error: payrollLinesErr },
      { data: billsData, error: billsErr },
      { data: billPaymentsData, error: billPaymentsErr },
  { data: bankRecsData, error: bankRecsErr },
  { data: bankRecItemsData, error: bankRecItemsErr },
] = await Promise.all([
      supabase.from('app_settings').select('data').eq('id', 1).maybeSingle(),
      supabase.from('accounts').select('*'),
      supabase.from('projects').select('*'),
      supabase.from('journal_entries').select('*').order('date', { ascending: false }),
      supabase.from('journal_lines').select('*'),
      supabase.from('invoices').select('*').order('date', { ascending: false }),
      supabase.from('invoice_items').select('*'),
      supabase.from('payments').select('*'),
      supabase.from('employees').select('*'),
      supabase.from('payroll_runs').select('*').order('period', { ascending: false }),
      supabase.from('payroll_lines').select('*'),
      supabase.from('bills').select('*').order('date', { ascending: false }),
      supabase.from('bill_payments').select('*'),
  supabase.from('bank_reconciliations').select('*').order('statement_date', { ascending: false }),
  supabase.from('bank_reconciliation_items').select('*'),
])

    const firstError =
      settingsErr || accountsErr || projectsErr || journalEntriesErr || journalLinesErr ||
      invoicesErr || invoiceItemsErr || paymentsErr || employeesErr || payrollRunsErr || payrollLinesErr ||
      billsErr || billPaymentsErr || bankRecsErr || bankRecItemsErr;
    if (firstError) throw firstError;

    const journal: JournalEntry[] = (journalEntries ?? []).map((e: JournalEntryRow) => ({
      id: e.id,
      entryNumber: e.entry_number,
      date: e.date,
      description: e.description,
      period: e.period,
      project: e.project,
      lines: (journalLines ?? []).filter((l: JournalLineRow & { entry_id: string }) => l.entry_id === e.id).map(journalLineFromRow),
      reversed: (e as any).reversed ?? false,
      reversalOf: (e as any).reversal_of ?? null,
    }));

    const invoicedInvoices: Invoice[] = (invoices ?? []).map((inv: InvoiceRow) => ({
      ...invoiceFromRow(inv),
      items: (invoiceItems ?? []).filter((it: InvoiceItemRow & { invoice_id: string }) => it.invoice_id === inv.id).map(invoiceItemFromRow),
      payments: (payments ?? []).filter((p: PaymentRow & { invoice_id: string }) => p.invoice_id === inv.id).map(paymentFromRow),
    }));

    const payrollRunsWithLines: PayrollRun[] = (payrollRuns ?? []).map((run: PayrollRunRow) => ({
      id: run.id,
      period: run.period,
      entryNumber: run.entry_number,
      postedAt: run.posted_at,
      rows: (payrollLines ?? []).filter((l: PayrollLineRow & { run_id: string }) => l.run_id === run.id).map(payrollLineFromRow),
    }));

    const billsWithPayments: Bill[] = (billsData ?? []).map((b: BillRow) => ({
      ...billFromRow(b),
      payments: (billPaymentsData ?? []).filter((p: BillPaymentRow & { bill_id: string }) => p.bill_id === b.id).map(billPaymentFromRow),
    }));

    const bankReconciliations: BankReconciliation[] = (bankRecsData ?? []).map((r: BankReconciliationRow) => ({
    ...bankReconciliationFromRow(r),
    items: (bankRecItemsData ?? [])
      .filter((i: BankReconciliationItemRow & { reconciliation_id: string }) => i.reconciliation_id === r.id)
      .map(bankRecItemFromRow),
  }));

  const settings = (settingsData?.data ?? {}) as AppSettingsData;

  return {
    ...settings,
    accounts: (accounts ?? []).map(accountFromRow),
    projects: (projects ?? []).map(projectFromRow),
    journal,
    invoices: invoicedInvoices,
    employees: (employees ?? []).map(employeeFromRow),
    payrollRuns: payrollRunsWithLines,
    bills: billsWithPayments,
    bankReconciliations,
  } as AppData;
  } catch (err) {
    console.error('Error loading relational data:', err);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Save settings                                                       */
/* ------------------------------------------------------------------ */

export async function saveSettings(settingsData: Partial<AppData>): Promise<void> {
  const { accounts, projects, journal, invoices, employees, payrollRuns, bills, ...rest } = settingsData;
  const { error } = await supabase.from('app_settings').upsert({ id: 1, data: rest });
  if (error) {
    console.error('Error saving settings:', error);
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/*  Granular DB operations                                              */
/* ------------------------------------------------------------------ */

async function upsertTable<T>(tableName: string, rows: T[]): Promise<void> {
  if (!rows || rows.length === 0) return;
  const { error } = await supabase.from(tableName).upsert(rows as Record<string, unknown>[]);
  if (error) {
    console.error(`Error upserting ${tableName}:`, error);
    throw error;
  }
}

async function deleteFromTable(tableName: string, column: string, value: string): Promise<void> {
  const { error } = await supabase.from(tableName).delete().eq(column, value);
  if (error) {
    console.error(`Error deleting from ${tableName}:`, error);
    throw error;
  }
}

export const db: Db = {
  saveAccounts: (accounts) => upsertTable('accounts', (accounts ?? []).map(accountToRow)),
  saveProjects: (projects) => upsertTable('projects', (projects ?? []).map(projectToRow)),
  saveEmployees: (employees) => upsertTable('employees', (employees ?? []).map(employeeToRow)),

  saveJournalEntry: async (entry) => {
    await upsertTable('journal_entries', [
      {
        id: entry.id,
        entry_number: entry.entryNumber,
        date: entry.date,
        description: entry.description ?? null,
        period: entry.period ?? null,
        project: entry.project ?? null,
        reversed: (entry as any).reversed ?? null,
        reversal_of: (entry as any).reversalOf ?? null,
      },
    ]);
    await deleteFromTable('journal_lines', 'entry_id', entry.id);
    if (entry.lines && entry.lines.length > 0) {
      await upsertTable('journal_lines', entry.lines.map((l) => journalLineToRow(l, entry.id)));
    }
  },

  deleteJournalEntry: async (entryId: string) => {
    if (!entryId) return;
    const { error: delLinesErr } = await supabase.from('journal_lines').delete().eq('entry_id', entryId);
    if (delLinesErr) {
      console.error('Error deleting journal_lines for entry:', delLinesErr);
      throw delLinesErr;
    }
    const { error: delEntryErr } = await supabase.from('journal_entries').delete().eq('id', entryId);
    if (delEntryErr) {
      console.error('Error deleting journal_entry:', delEntryErr);
      throw delEntryErr;
    }
  },

  deleteJournalEntriesByInvoiceNumber: async (invoiceNumber: string) => {
    if (!invoiceNumber) return;
    // Find journal entries whose description mentions the invoice number, but ignore void reversal entries
    const { data: entries, error: selectErr } = await supabase
      .from('journal_entries')
      .select('id, entry_number, description')
      .ilike('description', `%${invoiceNumber}%`)
      .not('entry_number', 'like', 'JE-VOID-%');
    if (selectErr) {
      console.error('Error selecting journal entries for deletion:', selectErr);
      throw selectErr;
    }
    const ids = (entries ?? []).map((e: any) => e.id).filter(Boolean);
    if (ids.length === 0) return;
    // Delete journal_lines for these entries
    const { error: delLinesErr } = await supabase.from('journal_lines').delete().in('entry_id', ids);
    if (delLinesErr) {
      console.error('Error deleting journal_lines for invoice:', delLinesErr);
      throw delLinesErr;
    }
    // Delete the entries themselves
    const { error: delEntriesErr } = await supabase.from('journal_entries').delete().in('id', ids);
    if (delEntriesErr) {
      console.error('Error deleting journal_entries for invoice:', delEntriesErr);
      throw delEntriesErr;
    }
  },

  saveInvoice: async (invoice) => {
    const row = invoiceToRow(invoice);
    console.log('[saveInvoice] Upserting invoice row:', JSON.stringify(row, null, 2));
    let step = 'upsert invoices';
    try {
      await upsertTable('invoices', [row]);
    } catch (err) {
      throw new Error(`${step}: ${(err as Error).message}`);
    }
    step = 'delete old invoice_items';
    try {
      await deleteFromTable('invoice_items', 'invoice_id', invoice.id);
    } catch (err) {
      throw new Error(`${step}: ${(err as Error).message}`);
    }
    step = 'delete old payments';
    try {
      await deleteFromTable('payments', 'invoice_id', invoice.id);
    } catch (err) {
      throw new Error(`${step}: ${(err as Error).message}`);
    }
    if (invoice.items && invoice.items.length > 0) {
      step = 'upsert invoice_items';
      const itemRows = invoice.items.map((it) => invoiceItemToRow(it, invoice.id));
      console.log('[saveInvoice] Item rows:', JSON.stringify(itemRows, null, 2));
      try {
        await upsertTable('invoice_items', itemRows);
      } catch (err) {
        throw new Error(`${step}: ${(err as Error).message}`);
      }
    }
    if (invoice.payments && invoice.payments.length > 0) {
      step = 'upsert payments';
      try {
        await upsertTable('payments', invoice.payments.map((p) => paymentToRow(p, invoice.id)));
      } catch (err) {
        throw new Error(`${step}: ${(err as Error).message}`);
      }
    }
  },

  savePayrollRun: async (run) => {
    await upsertTable('payroll_runs', [
      {
        id: run.id,
        period: run.period,
        entry_number: run.entryNumber ?? null,
        posted_at: run.postedAt ?? new Date().toISOString(),
      },
    ]);
    await deleteFromTable('payroll_lines', 'run_id', run.id);
    if (run.rows && run.rows.length > 0) {
      await upsertTable('payroll_lines', run.rows.map((r) => payrollLineToRow(r, run.id)));
    }
  },

  saveBill: async (bill) => {
    await upsertTable('bills', [billToRow(bill)]);
    await deleteFromTable('bill_payments', 'bill_id', bill.id);
    if (bill.payments && bill.payments.length > 0) {
      await upsertTable('bill_payments', bill.payments.map((p) => billPaymentToRow(p, bill.id)));
    }
  },

  deleteAccount: (code) => deleteFromTable('accounts', 'code', code),
  deleteProject: (id) => deleteFromTable('projects', 'id', id),
  deleteEmployee: (id) => deleteFromTable('employees', 'id', id),
  deleteBill: (id) => deleteFromTable('bills', 'id', id),

  saveBankReconciliation: async (rec) => {
    await upsertTable('bank_reconciliations', [bankReconciliationToRow(rec)]);
    await deleteFromTable('bank_reconciliation_items', 'reconciliation_id', rec.id);
    if (rec.items && rec.items.length > 0) {
      await upsertTable('bank_reconciliation_items', rec.items.map(bankRecItemToRow));
    }
  },
  
  inviteEmployee: async (employeeId, email) => {
    const body: Record<string, unknown> = { employeeId };
    if (email) body.email = email;
    const { data, error } = await supabase.functions.invoke('invite-employee', {
      body,
    });
    if (error) {
      let message = error.message || 'Failed to send invite.';
      try {
        const body = await error.context?.json?.();
        if (body?.error) message = body.error;
      } catch {
        // ignore
      }
      throw new Error(message);
    }
    return data as { mode: 'invited' | 'resent'; authUserId: string };
  },

  completeOnboarding: async (employeeId, password) => {
    const { data, error } = await supabase.functions.invoke('complete-onboarding', {
      body: { employeeId, password },
    });
    if (error) {
      let message = error.message || 'Failed to complete onboarding.';
      try {
        const body = await error.context?.json?.();
        if (body?.error) message = body.error;
      } catch {
        // ignore
      }
      throw new Error(message);
    }
    return data;
  },

  deleteBankReconciliation: (id) => deleteFromTable('bank_reconciliations', 'id', id),
};
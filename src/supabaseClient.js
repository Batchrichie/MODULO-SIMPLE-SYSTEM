import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabaseUrl = "https://shcqywteckisqddmxvei.supabase.co"; // Replace with your URL
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoY3F5d3RlY2tpc3FkZG14dmVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMzE5NDQsImV4cCI6MjA4NzcwNzk0NH0.GgYGGx_e6KpnHrhRHzvF5nDv8D6x335LGl-9i_i7Pdg"; // Replace with your Anon Key
export const supabase = createClient(supabaseUrl, supabaseKey);

// ---------------------------------------------------------------------------
// Field-name mapping helpers
// Postgres columns are snake_case; the React app expects the original
// camelCase shape from the old ledger_state JSON blob. These helpers convert
// each direction so App.jsx doesn't need to change.
// ---------------------------------------------------------------------------

function accountFromRow(r) {
  return {
    code: r.code,
    name: r.name,
    type: r.type,
    reportingGroup: r.reporting_group,
    normal: r.normal, // new field, additive - safe for App.jsx to ignore
  };
}
function accountToRow(a) {
  return {
    code: a.code,
    name: a.name,
    type: a.type,
    reporting_group: a.reportingGroup ?? null,
    normal: a.normal ?? null,
  };
}

function projectFromRow(r) {
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
function projectToRow(p) {
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

function employeeFromRow(r) {
  return {
    id: r.id,
    name: r.name,
    baseSalary: r.base_salary,
    active: r.active,
    ssnitNo: r.ssnit_no,
    niaCard: r.nia_card,
    designation: r.designation,
    exemptPaye: r.exempt_paye ?? false,
    exemptSsnit: r.exempt_ssnit ?? false,
  };
}
function employeeToRow(e) {
  return {
    id: e.id,
    name: e.name,
    base_salary: e.baseSalary ?? null,
    active: e.active ?? true,
    ssnit_no: e.ssnitNo ?? null,
    nia_card: e.niaCard ?? null,
    designation: e.designation ?? null,
    // exempt_paye and exempt_ssnit are omitted because the current remote
    // employees table schema does not expose those columns yet.
  };
}

function journalLineFromRow(r) {
  return { account: r.account_code, debit: Number(r.debit) || 0, credit: Number(r.credit) || 0 };
}
function journalLineToRow(l, entryId) {
  return { entry_id: entryId, account_code: l.account, debit: l.debit ?? 0, credit: l.credit ?? 0 };
}

function invoiceItemFromRow(r) {
  return { id: r.id, lineType: r.line_type, description: r.description, unit: r.unit, qty: r.qty, rate: r.rate };
}
function invoiceItemToRow(it, invoiceId) {
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

function paymentFromRow(r) {
  return { id: r.id, date: r.date, amountGHS: r.amount_ghs, method: r.method, reference: r.reference };
}
function paymentToRow(p, invoiceId) {
  return {
    id: p.id,
    invoice_id: invoiceId,
    date: p.date,
    amount_ghs: p.amountGHS ?? null,
    method: p.method ?? null,
    reference: p.reference ?? null,
  };
}

function invoiceFromRow(r) {
  return {
    id: r.id,
    invoiceNumber: r.invoice_number,
    date: r.date,
    dueDate: r.due_date,
    billTo: r.bill_to,
    forText: r.for_text,
    location: r.location,
    project: r.project,
    projectLabel: r.project_label,
    currency: r.currency,
    exchangeRate: r.exchange_rate,
    discountPct: r.discount_pct,
    revenueAccount: r.revenue_account,
    status: r.status,
    totals: r.totals,
  };
}
function invoiceToRow(inv) {
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
  };
}

function payrollLineFromRow(r) {
  return {
    employeeId: r.employee_id,
    name: r.name,
    gross: r.gross,
    ssnitEmployee: r.ssnit_employee,
    ssnitEmployer: r.ssnit_employer,
    paye: r.paye,
    net: r.net,
  };
}
function payrollLineToRow(l, runId) {
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

// ---------------------------------------------------------------------------
// Auth: email/password sign-in. Once a user is logged in, Supabase attaches
// their JWT to every request, so RLS treats them as "authenticated" instead
// of "anon" and the authenticated-role policies from Ticket 1 apply.
// ---------------------------------------------------------------------------

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

// ---------------------------------------------------------------------------
// New: Fetch pre-calculated financial views / RPC (Stage 1 frontend handoff)
// ---------------------------------------------------------------------------
export async function getTrialBalance() {
  const { data, error } = await supabase.from("vw_trial_balance").select("*");
  if (error) {
    console.error("Error fetching Trial Balance:", error);
    return [];
  }
  return data;
}

export async function getBalanceSheet() {
  const { data, error } = await supabase.from("vw_balance_sheet").select("*");
  if (error) {
    console.error("Error fetching Balance Sheet:", error);
    return [];
  }
  return data;
}

export async function getProfitAndLoss(startDate, endDate) {
  const { data, error } = await supabase.rpc("get_profit_and_loss", {
    p_start_date: startDate,
    p_end_date: endDate,
  });
  if (error) {
    console.error("Error fetching P&L:", error);
    return [];
  }
  return data;
}

async function loadAppSettings() {
  const { data, error } = await supabase.from("app_settings").select("data").eq("id", 1).maybeSingle();
  if (error) {
    console.error("Error loading app settings:", error);
    return {};
  }
  return data?.data || {};
}

async function mergeAppSettings(updates) {
  const existing = await loadAppSettings();
  const merged = { ...existing, ...updates };
  const { error } = await supabase.from("app_settings").upsert({ id: 1, data: merged });
  if (error) {
    console.error("Error saving tax settings:", error);
    throw error;
  }
  return merged;
}

export async function loadTaxConfig() {
  const settings = await loadAppSettings();
  return {
    rates: {
      ssnitEmployeeRate: settings.ssnitEmployeeRate ?? 0,
      ssnitEmployerRate: settings.ssnitEmployerRate ?? 0,
      nhilGetfundRate: settings.nhilGetfundRate ?? 0,
      vatRate: settings.vatRate ?? 0,
    },
    brackets: Array.isArray(settings.brackets) ? settings.brackets : [],
  };
}

export async function saveTaxRates(rates) {
  return mergeAppSettings(rates);
}

export async function savePayeBrackets(brackets) {
  return mergeAppSettings({ brackets });
}

// Call once (e.g. in App.jsx) to react to login/logout events.
// Returns an unsubscribe function - call it on unmount.
export function onAuthStateChange(callback) {
  const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => listener.subscription.unsubscribe();
}

// ---------------------------------------------------------------------------
// Load: fetch all 11 tables and assemble the nested structure App.jsx expects
// ---------------------------------------------------------------------------

export async function loadLedgerState() {
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
    ] = await Promise.all([
      supabase.from("app_settings").select("data").eq("id", 1).maybeSingle(),
      supabase.from("accounts").select("*"),
      supabase.from("projects").select("*"),
      supabase.from("journal_entries").select("*").order("date", { ascending: false }),
      supabase.from("journal_lines").select("*"),
      supabase.from("invoices").select("*").order("date", { ascending: false }),
      supabase.from("invoice_items").select("*"),
      supabase.from("payments").select("*"),
      supabase.from("employees").select("*"),
      supabase.from("payroll_runs").select("*").order("period", { ascending: false }),
      supabase.from("payroll_lines").select("*"),
    ]);

    const firstError =
      settingsErr || accountsErr || projectsErr || journalEntriesErr || journalLinesErr ||
      invoicesErr || invoiceItemsErr || paymentsErr || employeesErr || payrollRunsErr || payrollLinesErr;
    if (firstError) throw firstError;

    const journal = (journalEntries || []).map((e) => ({
      id: e.id,
      entryNumber: e.entry_number,
      date: e.date,
      description: e.description,
      period: e.period,
      project: e.project,
      lines: (journalLines || []).filter((l) => l.entry_id === e.id).map(journalLineFromRow),
    }));

    const invoicedInvoices = (invoices || []).map((inv) => ({
      ...invoiceFromRow(inv),
      items: (invoiceItems || []).filter((it) => it.invoice_id === inv.id).map(invoiceItemFromRow),
      payments: (payments || []).filter((p) => p.invoice_id === inv.id).map(paymentFromRow),
    }));

    const payrollRunsWithLines = (payrollRuns || []).map((run) => ({
      id: run.id,
      period: run.period,
      entryNumber: run.entry_number,
      postedAt: run.posted_at,
      rows: (payrollLines || []).filter((l) => l.run_id === run.id).map(payrollLineFromRow),
    }));

    return {
      ...(settingsData?.data || {}),
      accounts: (accounts || []).map(accountFromRow),
      projects: (projects || []).map(projectFromRow),
      journal,
      invoices: invoicedInvoices,
      employees: (employees || []).map(employeeFromRow),
      payrollRuns: payrollRunsWithLines,
    };
  } catch (err) {
    console.error("Error loading relational data:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Save: company settings / rates / counters (everything that isn't one of
// the 6 array collections above)
// ---------------------------------------------------------------------------

export async function saveSettings(settingsData) {
  const { accounts, projects, journal, invoices, employees, payrollRuns, ...rest } = settingsData || {};
  const { data, error } = await supabase.from("app_settings").upsert({ id: 1, data: rest });
  if (error) {
    console.error("Error saving settings:", error);
    throw error;
  }
  return data;
}

// ---------------------------------------------------------------------------
// Granular save functions
// ---------------------------------------------------------------------------

async function upsertTable(tableName, rows) {
  if (!rows || rows.length === 0) return;
  const { data, error } = await supabase.from(tableName).upsert(rows);
  if (error) {
    console.error(`Error upserting ${tableName}:`, error);
    throw error;
  }
  return data;
}

async function deleteFromTable(tableName, column, value) {
  const { data, error } = await supabase.from(tableName).delete().eq(column, value);
  if (error) {
    console.error(`Error deleting from ${tableName}:`, error);
    throw error;
  }
  return data;
}

export const db = {
  saveAccounts: (accounts) => upsertTable("accounts", (accounts || []).map(accountToRow)),
  saveProjects: (projects) => upsertTable("projects", (projects || []).map(projectToRow)),
  saveEmployees: (employees) => upsertTable("employees", (employees || []).map(employeeToRow)),

  // Journal entries are upserted; lines are fully replaced
  saveJournalEntry: async (entry) => {
    await upsertTable("journal_entries", [
      {
        id: entry.id,
        entry_number: entry.entryNumber,
        date: entry.date,
        description: entry.description ?? null,
        period: entry.period ?? null,
        project: entry.project ?? null,
      },
    ]);
    await deleteFromTable("journal_lines", "entry_id", entry.id);
    if (entry.lines && entry.lines.length > 0) {
      await upsertTable("journal_lines", entry.lines.map((l) => journalLineToRow(l, entry.id)));
    }
  },

  // Invoices are upserted; items and payments are fully replaced
  saveInvoice: async (invoice) => {
    await upsertTable("invoices", [invoiceToRow(invoice)]);
    await deleteFromTable("invoice_items", "invoice_id", invoice.id);
    await deleteFromTable("payments", "invoice_id", invoice.id);
    if (invoice.items && invoice.items.length > 0) {
      await upsertTable("invoice_items", invoice.items.map((it) => invoiceItemToRow(it, invoice.id)));
    }
    if (invoice.payments && invoice.payments.length > 0) {
      await upsertTable("payments", invoice.payments.map((p) => paymentToRow(p, invoice.id)));
    }
  },

  // Payroll runs are upserted; lines are fully replaced
  savePayrollRun: async (run) => {
    await upsertTable("payroll_runs", [
      { id: run.id, period: run.period, entry_number: run.entryNumber ?? null, posted_at: run.postedAt ?? new Date().toISOString() },
    ]);
    await deleteFromTable("payroll_lines", "run_id", run.id);
    if (run.rows && run.rows.length > 0) {
      await upsertTable("payroll_lines", run.rows.map((r) => payrollLineToRow(r, run.id)));
    }
  },

  deleteAccount: (code) => deleteFromTable("accounts", "code", code),
  deleteProject: (id) => deleteFromTable("projects", "id", id),
  deleteEmployee: (id) => deleteFromTable("employees", "id", id),
};
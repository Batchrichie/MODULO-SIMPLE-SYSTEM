import { useEffect, useState, type CSSProperties } from 'react';
import { AlertTriangle, Receipt } from 'lucide-react';
import { INK, RULE, GREEN, ALERT, MUTED, FONT_DISPLAY, FONT_MONO } from '../theme/tokens';
import Card from '../components/ui/Card';
import SectionTitle from '../components/ui/SectionTitle';
import TableScroll from '../components/ui/TableScroll';
import Th from '../components/ui/Th';
import Td from '../components/ui/Td';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { inputStyle, labelStyle } from '../components/ui/styles';
import ProjectSelect from '../components/ui/ProjectSelect';
import AccountSelect from '../components/ui/AccountSelect';
import { fmt, projectName } from '../utils/format';
import { findPeriodByDate } from '../supabaseClient';
import {
  cancelExpense,
  createExpenseDraft,
  listExpenseAccounts,
  listExpenses,
  loadLedgerState,
  postExpenseTransaction,
} from '../supabaseClient';
import type { Account, AppData, MutateFn } from '../types';

type ExpenseRecord = {
  id: string;
  date: string;
  vendor: string;
  description: string;
  amount: number;
  project: string | null;
  status: 'Draft' | 'Posted' | 'Cancelled';
  suggestedExpenseAccountCode: string | null;
  suggestedPaymentAccountCode: string | null;
  expenseAccountCode: string | null;
  paymentAccountCode: string | null;
  journalEntryId: string | null;
};

type PanelProps = {
  data: AppData;
  mutate: MutateFn;
  canCreate: boolean;
  canPost: boolean;
};

function valueFrom(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) if (row[key] !== undefined && row[key] !== null) return row[key];
  return undefined;
}

function normalizeExpense(value: unknown, fallback: Partial<ExpenseRecord> = {}): ExpenseRecord {
  const wrapped = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const nested = (wrapped.expense && typeof wrapped.expense === 'object')
    ? wrapped.expense as Record<string, unknown>
    : wrapped;
  const statusValue = String(valueFrom(nested, 'status') ?? fallback.status ?? 'Draft').toLowerCase();
  const status: ExpenseRecord['status'] = statusValue === 'posted'
    ? 'Posted'
    : statusValue === 'cancelled' || statusValue === 'canceled'
      ? 'Cancelled'
      : 'Draft';
  return {
    id: String(valueFrom(nested, 'id', 'expense_id') ?? fallback.id ?? ''),
    date: String(valueFrom(nested, 'date', 'expense_date') ?? fallback.date ?? ''),
    vendor: String(valueFrom(nested, 'vendor', 'payee') ?? fallback.vendor ?? ''),
    description: String(valueFrom(nested, 'description') ?? fallback.description ?? ''),
    amount: Number(valueFrom(nested, 'amount', 'amount_ghs') ?? fallback.amount ?? 0),
    project: (valueFrom(nested, 'project', 'project_id') ?? fallback.project ?? null) as string | null,
    status,
    suggestedExpenseAccountCode: String(valueFrom(nested, 'suggested_expense_account_code', 'expense_account_suggestion', 'suggested_expense_account') ?? fallback.suggestedExpenseAccountCode ?? '') || null,
    suggestedPaymentAccountCode: String(valueFrom(nested, 'suggested_payment_account_code', 'payment_account_suggestion', 'suggested_payment_account') ?? fallback.suggestedPaymentAccountCode ?? '') || null,
    expenseAccountCode: String(valueFrom(nested, 'expense_account_code') ?? fallback.expenseAccountCode ?? '') || null,
    paymentAccountCode: String(valueFrom(nested, 'payment_account_code') ?? fallback.paymentAccountCode ?? '') || null,
    journalEntryId: String(valueFrom(nested, 'journal_entry_id') ?? fallback.journalEntryId ?? '') || null,
  };
}

function accountChoices(raw: unknown): { expense: Account[]; payment: Account[] } {
  const object = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const expenseRows = Array.isArray(object.expense_accounts) ? object.expense_accounts : [];
  const paymentRows = Array.isArray(object.payment_accounts) ? object.payment_accounts : [];
  const rows = Array.isArray(raw) ? raw : [...expenseRows, ...paymentRows, ...(Array.isArray(object.accounts) ? object.accounts : [])];
  const expense: Account[] = [];
  const payment: Account[] = [];
  for (const value of rows) {
    if (!value || typeof value !== 'object') continue;
    const row = value as Record<string, unknown>;
    const code = String(valueFrom(row, 'code', 'account_code') ?? '');
    if (!code) continue;
    const name = String(valueFrom(row, 'name', 'account_name') ?? code);
    const type = String(valueFrom(row, 'type', 'account_type', 'category') ?? '');
    const account: Account = {
      code,
      name,
      type,
      isPaymentAccount: Boolean(valueFrom(row, 'is_payment_account', 'isPaymentAccount')),
      role: String(valueFrom(row, 'role', 'account_role') ?? '') || null,
    };
    const normalizedType = type.toLowerCase();
    const isPayment = account.isPaymentAccount || /payment|cash|bank/.test(normalizedType) || /cash|bank/.test((account.role ?? '').toLowerCase()) || paymentRows.includes(value);
    if (isPayment) payment.push(account);
    else expense.push(account);
  }
  return { expense, payment };
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? 'Unknown error');
}

export default function ExpensesPanel({ data, mutate, canCreate, canPost }: PanelProps) {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [expenseAccounts, setExpenseAccounts] = useState<Account[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [activeExpense, setActiveExpense] = useState<ExpenseRecord | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [vendor, setVendor] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentAccount, setPaymentAccount] = useState('');
  const [account, setAccount] = useState('');
  const [project, setProject] = useState('GEN');

  async function reloadExpenses() {
    const rows = await listExpenses();
    setExpenses(rows.map((row) => normalizeExpense(row)).filter((expense) => expense.id));
  }

  useEffect(() => {
    let mounted = true;
    Promise.all([listExpenseAccounts(), listExpenses()])
      .then(([accountsResult, expensesResult]) => {
        if (!mounted) return;
        const choices = accountChoices(accountsResult);
        setExpenseAccounts(choices.expense);
        setPaymentAccounts(choices.payment);
        setExpenses(expensesResult.map((row) => normalizeExpense(row)).filter((expense) => expense.id));
      })
      .catch((loadError) => {
        if (mounted) setError(`Could not load expense setup: ${errorText(loadError)}`);
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  function resetForm() {
    setDate(new Date().toISOString().slice(0, 10));
    setVendor('');
    setDescription('');
    setAmount('');
    setPaymentAccount('');
    setAccount('');
    setProject('GEN');
    setActiveExpense(null);
    setError('');
  }

  function openReview(expense: ExpenseRecord) {
    setActiveExpense(expense);
    setAccount(expense.expenseAccountCode ?? expense.suggestedExpenseAccountCode ?? '');
    setPaymentAccount(expense.paymentAccountCode ?? expense.suggestedPaymentAccountCode ?? '');
    setError('');
    setShowNewModal(true);
  }

  async function createDraft() {
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) { setError('Enter a valid amount greater than zero.'); return; }
    if (!description.trim()) { setError('Enter a description.'); return; }
    setBusy(true);
    setError('');
    try {
      const result = await createExpenseDraft({
        date,
        vendor: vendor.trim(),
        description: description.trim(),
        amount: parsedAmount,
        project: project === 'GEN' ? null : project,
      });
      const created = normalizeExpense(Array.isArray(result) ? result[0] : result, {
        id: typeof result === 'string' ? result : '',
        date,
        vendor: vendor.trim(),
        description: description.trim(),
        amount: parsedAmount,
        project: project === 'GEN' ? null : project,
        status: 'Draft',
      });
      if (!created.id) throw new Error('The backend created a draft but returned no expense ID.');
      setExpenses((current) => [created, ...current.filter((expense) => expense.id !== created.id)]);
      setActiveExpense(created);
      setAccount(created.suggestedExpenseAccountCode ?? '');
      setPaymentAccount(created.suggestedPaymentAccountCode ?? '');
      setError('');
    } catch (createError) {
      setError(`Could not create expense draft: ${errorText(createError)}`);
    } finally {
      setBusy(false);
    }
  }

  async function approveAndPost() {
    if (!activeExpense || activeExpense.status !== 'Draft') return;
    if (!account || !paymentAccount) { setError('Choose both the expense and payment accounts before posting.'); return; }
    setBusy(true);
    setError('');
    try {
      const result = await postExpenseTransaction(activeExpense.id, account, paymentAccount);
      if (result && typeof result === 'object' && (result as Record<string, unknown>).success === false) {
        throw new Error(String((result as Record<string, unknown>).message ?? 'The backend did not confirm posting.'));
      }
      setExpenses((current) => current.map((expense) => expense.id === activeExpense.id
        ? { ...expense, status: 'Posted', expenseAccountCode: account, paymentAccountCode: paymentAccount }
        : expense));
      const refreshed = await loadLedgerState();
      if (refreshed) mutate((current) => ({ ...current, journal: refreshed.journal }));
      try { await reloadExpenses(); } catch { /* RPC success remains authoritative for the status shown here. */ }
      setShowNewModal(false);
      setActiveExpense(null);
    } catch (postError) {
      setError(`Could not post expense: ${errorText(postError)}`);
    } finally {
      setBusy(false);
    }
  }

  async function cancelDraft() {
    if (!activeExpense || activeExpense.status !== 'Draft') return;
    setBusy(true);
    setError('');
    try {
      await cancelExpense(activeExpense.id);
      setExpenses((current) => current.map((expense) => expense.id === activeExpense.id
        ? { ...expense, status: 'Cancelled' }
        : expense));
      try { await reloadExpenses(); } catch { /* Keep the confirmed local cancellation visible. */ }
      setShowNewModal(false);
      setActiveExpense(null);
    } catch (cancelError) {
      setError(`Could not cancel draft: ${errorText(cancelError)}`);
    } finally {
      setBusy(false);
    }
  }

  const postedTotal = expenses.filter((expense) => expense.status === 'Posted').reduce((sum, expense) => sum + expense.amount, 0);
  const draftCount = expenses.filter((expense) => expense.status === 'Draft').length;
  const expenseAccountName = expenseAccounts.find((item) => item.code === account)?.name ?? account;
  const paymentAccountName = paymentAccounts.find((item) => item.code === paymentAccount)?.name ?? paymentAccount;
  const closedPeriod = findPeriodByDate(data.accountingPeriods, date);

  return (
    <div>
      <SectionTitle
        sub="Create expense drafts, review the suggested accounts, then approve posting."
        action={canCreate ? <Button onClick={() => { resetForm(); setShowNewModal(true); }}>New Expense</Button> : undefined}
      >
        Expenses
      </SectionTitle>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <Card style={{ borderTop: `3px solid ${INK}` }}>
          <div style={{ fontSize: 10, color: MUTED, fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Posted expenses</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 18, fontWeight: 700, color: INK }}>GHS {fmt(postedTotal)}</div>
        </Card>
        <Card style={{ borderTop: `3px solid ${GREEN}` }}>
          <div style={{ fontSize: 10, color: MUTED, fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Drafts awaiting review</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 18, fontWeight: 700, color: INK }}>{draftCount}</div>
        </Card>
      </div>

      <SectionTitle sub="Drafts and posted expenses are shown from the backend record." >Expense Register</SectionTitle>
      {error && !showNewModal && <div role="alert" style={{ color: ALERT, margin: '0 0 12px', fontSize: 13 }}>{error}</div>}
      <Card>
        <TableScroll>
          <table className="table-card" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><Th>Date</Th><Th>Description</Th><Th>Vendor</Th><Th>Project</Th><Th>Status</Th><Th right>Amount</Th><Th right>Action</Th></tr></thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id} className="row-hover">
                  <Td label="Date">{expense.date}</Td>
                  <Td label="Description">{expense.description}</Td>
                  <Td label="Vendor">{expense.vendor || '—'}</Td>
                  <Td label="Project">{projectName(data.projects, expense.project)}</Td>
                  <Td label="Status"><span style={{ color: expense.status === 'Posted' ? GREEN : expense.status === 'Cancelled' ? MUTED : ALERT, fontWeight: 600 }}>{expense.status}</span></Td>
                  <Td right mono label="Amount">GHS {fmt(expense.amount)}</Td>
                  <Td right label="Action">{expense.status === 'Draft' && (
                    <Button variant="ghost" onClick={() => openReview(expense)}>Review</Button>
                  )}</Td>
                </tr>
              ))}
              {!loading && expenses.length === 0 && <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: MUTED }}>
                <Receipt size={26} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.45 }} />
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14 }}>No expenses yet</div>
              </td></tr>}
              {loading && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: MUTED }}>Loading expenses…</td></tr>}
            </tbody>
          </table>
        </TableScroll>
      </Card>

      {showNewModal && (
        <Modal
          title={activeExpense ? 'Review Expense Draft' : 'New Expense Draft'}
          sub={activeExpense ? 'Confirm the suggested accounts and inspect the journal preview before posting.' : 'Saving creates a draft only. No journal entry is created until approval.'}
          onClose={() => { setShowNewModal(false); setActiveExpense(null); setError(''); }}
          wide={Boolean(activeExpense)}
        >
          {activeExpense ? (
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                <div><div style={labelStyle}>Date</div><div>{activeExpense.date}</div></div>
                <div><div style={labelStyle}>Amount</div><div style={{ fontFamily: FONT_MONO }}>GHS {fmt(activeExpense.amount)}</div></div>
                <div><div style={labelStyle}>Vendor</div><div>{activeExpense.vendor || '—'}</div></div>
                <div><div style={labelStyle}>Project</div><div>{projectName(data.projects, activeExpense.project)}</div></div>
              </div>
              <div><div style={labelStyle}>Description</div><div>{activeExpense.description}</div></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Expense account *</label>
                  <AccountSelect value={account} onChange={setAccount} accounts={expenseAccounts} placeholder="Choose expense account…" />
                  <div style={{ marginTop: 5, color: MUTED, fontSize: 11 }}>Backend suggestion: {activeExpense.suggestedExpenseAccountCode ?? 'None returned'}</div>
                </div>
                <div>
                  <label style={labelStyle}>Payment account *</label>
                  <AccountSelect value={paymentAccount} onChange={setPaymentAccount} accounts={paymentAccounts} placeholder="Choose payment account…" />
                  <div style={{ marginTop: 5, color: MUTED, fontSize: 11 }}>Backend suggestion: {activeExpense.suggestedPaymentAccountCode ?? 'None returned'}</div>
                </div>
              </div>
              <div style={{ borderTop: `1px solid ${RULE}`, paddingTop: 12 }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, marginBottom: 8 }}>Journal Preview</div>
                <TableScroll>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr><Th>Account</Th><Th right>Debit</Th><Th right>Credit</Th></tr></thead>
                    <tbody>
                      <tr><Td>{account ? `${account} - ${expenseAccountName}` : 'Select expense account'}</Td><Td right mono>GHS {fmt(activeExpense.amount)}</Td><Td right mono>—</Td></tr>
                      <tr><Td>{paymentAccount ? `${paymentAccount} - ${paymentAccountName}` : 'Select payment account'}</Td><Td right mono>—</Td><Td right mono>GHS {fmt(activeExpense.amount)}</Td></tr>
                    </tbody>
                  </table>
                </TableScroll>
              </div>
              {error && <div role="alert" style={{ color: ALERT, fontSize: 13 }}>{error}</div>}
              {canPost && activeExpense.status === 'Draft' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  {canCreate && <Button variant="ghost" onClick={cancelDraft} disabled={busy}>Cancel Draft</Button>}
                  <Button onClick={approveAndPost} disabled={busy || !account || !paymentAccount} fullWidth={!canCreate}>
                    {busy ? 'Processing…' : 'Approve & Post'}
                  </Button>
                </div>
              )}
              {!canPost && <div style={{ color: MUTED, fontSize: 12 }}>You can review this draft, but do not have permission to post it.</div>}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 140px' }}>
                  <label style={labelStyle}>Date *</label>
                  <input type="date" style={inputStyle as CSSProperties} value={date} onChange={(event) => setDate(event.target.value)} />
                  {closedPeriod && <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, color: ALERT, fontSize: 12 }}><AlertTriangle size={14} />{closedPeriod.name} is closed.</div>}
                </div>
                <div style={{ flex: '1 1 120px' }}>
                  <label style={labelStyle}>Amount (GHS) *</label>
                  <input style={inputStyle as CSSProperties} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.00" />
                </div>
              </div>
              <div><label style={labelStyle}>Description *</label><input style={inputStyle as CSSProperties} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="e.g. Fuel for site visit" /></div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 180px' }}><label style={labelStyle}>Vendor / Payee</label><input style={inputStyle as CSSProperties} value={vendor} onChange={(event) => setVendor(event.target.value)} placeholder="e.g. Shell Ghana" /></div>
                <div style={{ flex: '1 1 180px' }}><label style={labelStyle}>Project</label><ProjectSelect value={project} onChange={setProject} projects={data.projects} /></div>
              </div>
              {error && <div role="alert" style={{ color: ALERT, fontSize: 13 }}>{error}</div>}
              <Button onClick={createDraft} fullWidth disabled={busy || !canCreate}>{busy ? 'Saving Draft…' : 'Save Draft'}</Button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
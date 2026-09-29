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
import type { ExpenseAccountRow, ExpenseRow, ExpenseSuggestion } from '../supabaseClient';
import type { Account, AppData, MutateFn } from '../types';

type ExpenseRecord = Pick<ExpenseRow,
  | 'id'
  | 'expense_number'
  | 'vendor_payee'
  | 'description'
  | 'amount'
  | 'transaction_date'
  | 'project'
  | 'status'
  | 'expense_account_code'
  | 'payment_account_code'
  | 'suggested_expense_account_code'
  | 'suggested_payment_account_code'
  | 'suggestion_reason'
  | 'suggestion_match_count'
  | 'posted_journal_entry_id'
  | 'posted_by'
  | 'posted_at'
> & {
  suggestionTier?: ExpenseSuggestion['tier'] | null;
  postedEntryNumber?: string | null;
};

type PanelProps = {
  data: AppData;
  mutate: MutateFn;
  canCreate: boolean;
  canPost: boolean;
};

function accountChoices(rows: ExpenseAccountRow[]): { expense: Account[]; payment: Account[] } {
  const toAccount = (row: ExpenseAccountRow): Account => ({
    code: row.code,
    name: row.name,
    type: row.kind === 'expense' ? 'Expense' : 'Asset',
    isPaymentAccount: row.kind === 'payment',
    role: row.reporting_group,
  });
  return {
    expense: rows.filter((row) => row.kind === 'expense').map(toAccount),
    payment: rows.filter((row) => row.kind === 'payment').map(toAccount),
  };
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
  const [notice, setNotice] = useState('');
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
    setExpenses(rows);
  }

  useEffect(() => {
    let mounted = true;
    Promise.all([listExpenseAccounts(), listExpenses()])
      .then(([accountsResult, expensesResult]) => {
        if (!mounted) return;
        const choices = accountChoices(accountsResult);
        setExpenseAccounts(choices.expense);
        setPaymentAccounts(choices.payment);
        setExpenses(expensesResult);
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
    setAccount(expense.expense_account_code ?? expense.suggested_expense_account_code ?? '');
    setPaymentAccount(expense.payment_account_code ?? expense.suggested_payment_account_code ?? '');
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
      const created: ExpenseRecord = {
        id: result.expense_id,
        expense_number: result.expense_number,
        transaction_date: date,
        vendor_payee: vendor.trim(),
        description: description.trim(),
        amount: parsedAmount,
        project: project === 'GEN' ? null : project,
        status: result.status,
        expense_account_code: null,
        payment_account_code: null,
        suggested_expense_account_code: result.suggestion?.expense_account_code ?? null,
        suggested_payment_account_code: result.suggestion?.payment_account_code ?? null,
        suggestion_reason: result.suggestion?.reason ?? null,
        suggestion_match_count: result.suggestion?.match_count ?? null,
        posted_journal_entry_id: null,
        posted_by: null,
        posted_at: null,
        suggestionTier: result.suggestion?.tier ?? null,
      };
      setExpenses((current) => [created, ...current.filter((expense) => expense.id !== created.id)]);
      setActiveExpense(created);
      setAccount(created.suggested_expense_account_code ?? '');
      setPaymentAccount(created.suggested_payment_account_code ?? '');
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
      setExpenses((current) => current.map((expense) => expense.id === result.expense_id
        ? {
            ...expense,
            status: result.status,
            expense_account_code: result.expense_account_code,
            payment_account_code: result.payment_account_code,
            posted_journal_entry_id: result.journal_entry_id,
            postedEntryNumber: result.entry_number,
          }
        : expense));
      const refreshed = await loadLedgerState();
      if (refreshed) mutate((current) => ({ ...current, journal: refreshed.journal }));
      try { await reloadExpenses(); } catch { /* RPC success remains authoritative for the status shown here. */ }
      setNotice(result.already_posted ? `Expense ${result.expense_id} was already posted; its existing journal entry is confirmed.` : '');
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
      const result = await cancelExpense(activeExpense.id);
      setExpenses((current) => current.map((expense) => expense.id === result.expense_id
        ? { ...expense, status: result.status }
        : expense));
      try { await reloadExpenses(); } catch { /* Keep the confirmed local cancellation visible. */ }
      setNotice(result.already_cancelled ? `Expense ${result.expense_id} was already cancelled.` : '');
      setShowNewModal(false);
      setActiveExpense(null);
    } catch (cancelError) {
      setError(`Could not cancel draft: ${errorText(cancelError)}`);
    } finally {
      setBusy(false);
    }
  }

  const postedTotal = expenses.filter((expense) => expense.status === 'Posted').reduce((sum, expense) => sum + Number(expense.amount), 0);
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
      {notice && <div role="status" style={{ color: GREEN, margin: '0 0 12px', fontSize: 13 }}>{notice}</div>}
      {error && !showNewModal && <div role="alert" style={{ color: ALERT, margin: '0 0 12px', fontSize: 13 }}>{error}</div>}
      <Card>
        <TableScroll>
          <table className="table-card" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><Th>Expense</Th><Th>Date</Th><Th>Description</Th><Th>Vendor</Th><Th>Project</Th><Th>Status</Th><Th right>Amount</Th><Th right>Action</Th></tr></thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id} className="row-hover">
                  <Td mono label="Expense">{expense.expense_number}</Td>
                  <Td label="Date">{expense.transaction_date}</Td>
                  <Td label="Description">
                    {expense.description}
                    {expense.status === 'Posted' && (
                      <div style={{ color: MUTED, fontSize: 11, marginTop: 3 }}>
                        Dr {expense.expense_account_code} · Cr {expense.payment_account_code}
                        {expense.postedEntryNumber || expense.posted_journal_entry_id
                          ? ` · Journal ${expense.postedEntryNumber ?? expense.posted_journal_entry_id}`
                          : ''}
                        {expense.posted_at ? ` · ${expense.posted_at}` : ''}
                        {expense.posted_by ? ` · ${expense.posted_by}` : ''}
                      </div>
                    )}
                  </Td>
                  <Td label="Vendor">{expense.vendor_payee || '—'}</Td>
                  <Td label="Project">{projectName(data.projects, expense.project)}</Td>
                  <Td label="Status"><span style={{ color: expense.status === 'Posted' ? GREEN : expense.status === 'Cancelled' ? MUTED : ALERT, fontWeight: 600 }}>{expense.status}</span></Td>
                  <Td right mono label="Amount">GHS {fmt(expense.amount)}</Td>
                  <Td right label="Action">{expense.status === 'Draft' && (
                    <Button variant="ghost" onClick={() => openReview(expense)}>Review</Button>
                  )}</Td>
                </tr>
              ))}
              {!loading && expenses.length === 0 && <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: MUTED }}>
                <Receipt size={26} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.45 }} />
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14 }}>No expenses yet</div>
              </td></tr>}
              {loading && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: MUTED }}>Loading expenses…</td></tr>}
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
                <div><div style={labelStyle}>Date</div><div>{activeExpense.transaction_date}</div></div>
                <div><div style={labelStyle}>Amount</div><div style={{ fontFamily: FONT_MONO }}>GHS {fmt(activeExpense.amount)}</div></div>
                <div><div style={labelStyle}>Vendor</div><div>{activeExpense.vendor_payee || '—'}</div></div>
                <div><div style={labelStyle}>Project</div><div>{projectName(data.projects, activeExpense.project)}</div></div>
              </div>
              <div><div style={labelStyle}>Description</div><div>{activeExpense.description}</div></div>
              <div style={{ color: MUTED, fontSize: 12 }}>
                Suggested accounts: {activeExpense.suggested_expense_account_code ?? 'None'} / {activeExpense.suggested_payment_account_code ?? 'None'}
                {activeExpense.suggestion_reason && <> · {activeExpense.suggestion_reason}</>}
                {activeExpense.suggestion_match_count !== null && <> · {activeExpense.suggestion_match_count} match(es)</>}
                {activeExpense.suggestionTier && <> · {activeExpense.suggestionTier === 'vendor_and_description' ? 'Vendor and description match' : 'Vendor match'}</>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Expense account *</label>
                  <AccountSelect value={account} onChange={setAccount} accounts={expenseAccounts} placeholder="Choose expense account…" />
                  <div style={{ marginTop: 5, color: MUTED, fontSize: 11 }}>Backend suggestion: {activeExpense.suggested_expense_account_code ?? 'None'}</div>
                </div>
                <div>
                  <label style={labelStyle}>Payment account *</label>
                  <AccountSelect value={paymentAccount} onChange={setPaymentAccount} accounts={paymentAccounts} placeholder="Choose payment account…" />
                  <div style={{ marginTop: 5, color: MUTED, fontSize: 11 }}>Backend suggestion: {activeExpense.suggested_payment_account_code ?? 'None'}</div>
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
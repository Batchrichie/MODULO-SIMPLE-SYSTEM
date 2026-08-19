import React, { useEffect, useState } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import SectionTitle from '../components/ui/SectionTitle';
import { inputStyle } from '../components/ui/styles';
import { loadAllLoans, loadLoanRepayments, type Loan, type LoanRepayment } from '../supabase/loans';
import { callRpc } from '../lib/rpc/accountant';
import { INK, MUTED, ALERT, GOLD, FONT_MONO } from '../theme/tokens';

export default function LoansPanel() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [repayments, setRepayments] = useState<LoanRepayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoan, setActionLoan] = useState<Loan | null>(null);
  const [repaymentType, setRepaymentType] = useState<'auto' | 'manual'>('auto');
  const [installmentAmount, setInstallmentAmount] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      setLoans(await loadAllLoans());
      setRepayments(await loadLoanRepayments());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load loans.');
    } finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, []);

  async function approveLoan() {
    if (!actionLoan) return;
    const installment = Number(installmentAmount);
    if (repaymentType === 'auto' && (!installment || installment <= 0)) {
      setActionError('Enter an installment amount for automatic repayment.');
      return;
    }
    setSaving(true);
    setActionError('');
    try {
      await callRpc('approve_loan', {
        p_loan_id: actionLoan.id,
        p_repayment_type: repaymentType,
        p_installment_amount: repaymentType === 'auto' ? installment : null,
      });
      setActionLoan(null);
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to approve loan.');
    } finally { setSaving(false); }
  }

  async function rejectLoan() {
    if (!actionLoan) return;
    setSaving(true);
    setActionError('');
    try {
      await callRpc('reject_loan', { p_loan_id: actionLoan.id, p_reason: rejectionReason.trim() || null });
      setActionLoan(null);
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to reject loan.');
    } finally { setSaving(false); }
  }

  return <div>
    <SectionTitle sub="Review company loan requests and repayment history.">Loans</SectionTitle>
    {loading ? <div style={{ color: MUTED, padding: 30 }}><Loader2 size={16} /> Loading loans...</div> : error ? <Card><div style={{ color: ALERT }}>Unable to load loan data: {error}</div></Card> : <>
      <Card style={{ marginBottom: 18 }}><h3 style={{ marginTop: 0, color: INK }}>Pending queue</h3>{loans.filter((loan) => loan.status === 'Pending').length === 0 ? <div style={{ color: MUTED }}>No pending loan requests.</div> : loans.filter((loan) => loan.status === 'Pending').map((loan) => <div key={loan.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: '1px solid var(--rule)', flexWrap: 'wrap' }}><div><strong>{loan.employee?.name || loan.employee_id}</strong><div style={{ color: MUTED, fontSize: 12 }}>{loan.purpose || 'No purpose'} · {loan.term_months || '—'} months</div></div><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontFamily: FONT_MONO }}>GHS {Number(loan.amount || 0).toFixed(2)}</span><Button size="sm" icon={Check} onClick={() => { setActionLoan(loan); setActionError(''); setRepaymentType('auto'); setInstallmentAmount(''); }}>Approve</Button><Button size="sm" variant="danger" icon={X} onClick={() => { setActionLoan(loan); setActionError(''); setRejectionReason(''); }}>Reject</Button></div></div>)}</Card>
      {actionLoan && <Card style={{ marginBottom: 18, border: '1px solid var(--green)' }}><h3 style={{ marginTop: 0, color: INK }}>{actionLoan.status === 'Pending' ? 'Process loan request' : 'Loan action'}</h3><div style={{ color: MUTED, fontSize: 13, marginBottom: 12 }}>{actionLoan.employee?.name || actionLoan.employee_id} · GHS {Number(actionLoan.amount || 0).toFixed(2)}</div><div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><Button size="sm" variant={repaymentType === 'auto' ? 'primary' : 'ghost'} onClick={() => setRepaymentType('auto')}>Automatic repayment</Button><Button size="sm" variant={repaymentType === 'manual' ? 'primary' : 'ghost'} onClick={() => setRepaymentType('manual')}>Manual repayment</Button></div>{repaymentType === 'auto' && <input style={{ ...inputStyle, marginTop: 12 }} type="number" min="0" placeholder="Installment amount" value={installmentAmount} onChange={(event) => setInstallmentAmount(event.target.value)} />}<input style={{ ...inputStyle, marginTop: 12 }} placeholder="Rejection reason (optional)" value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} />{actionLoan.status === 'Pending' && repaymentType === 'manual' && <div style={{ color: MUTED, fontSize: 12, marginTop: 10 }}>Repayments can be recorded manually after approval.</div>}{actionError && <div style={{ color: ALERT, fontSize: 12, marginTop: 10 }}>{actionError}</div>}<div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}><Button variant="ghost" onClick={() => setActionLoan(null)}>Cancel</Button>{actionLoan.status === 'Pending' && <Button disabled={saving} onClick={approveLoan}>{saving ? 'Saving...' : 'Confirm approval'}</Button>}{actionLoan.status === 'Pending' && <Button variant="danger" disabled={saving} onClick={rejectLoan}>{saving ? 'Saving...' : 'Confirm rejection'}</Button>}</div></Card>}
      <Card><h3 style={{ marginTop: 0, color: INK }}>All loans</h3>{loans.length === 0 ? <div style={{ color: MUTED }}>No loans found.</div> : loans.map((loan) => { const paid = repayments.filter((repayment) => repayment.loan_id === loan.id).reduce((sum, repayment) => sum + Number(repayment.amount || 0), 0); return <div key={loan.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderTop: '1px solid var(--rule)', flexWrap: 'wrap' }}><span>{loan.employee?.name || loan.employee_id} · {loan.status}</span><span style={{ fontFamily: FONT_MONO }}>GHS {Number(loan.amount || 0).toFixed(2)} <small style={{ color: GOLD }}>({paid.toFixed(2)} repaid)</small></span></div>; })}</Card>
    </>}
  </div>;
}

import React, { useEffect, useState } from 'react';
import { Banknote, Loader2, Plus } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import SectionTitle from '../../components/ui/SectionTitle';
import { inputStyle, labelStyle } from '../../components/ui/styles';
import { INK, MUTED, GREEN, ALERT, FONT_BODY, FONT_MONO } from '../../theme/tokens';
import { loadMyLoanRepayments, loadMyLoans, recordLoanRepayment, requestLoan, type Loan, type LoanRepayment } from '../../supabase/loans';
import type { UserProfile } from '../../supabase/profile';

export default function MyLoansPanel({ profile }: { profile: UserProfile }) {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [repayments, setRepayments] = useState<LoanRepayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('');
  const [termMonths, setTermMonths] = useState('');
  const [error, setError] = useState('');
  const [repaymentLoan, setRepaymentLoan] = useState<Loan | null>(null);
  const [repaymentAmount, setRepaymentAmount] = useState('');

  async function refresh() {
    setLoading(true);
    try {
      const rows = await loadMyLoans(profile.employeeId);
      setLoans(rows);
      setRepayments(await loadMyLoanRepayments(rows.map((loan) => loan.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load loans.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, [profile.employeeId]);

  async function submitRequest() {
    const parsedAmount = Number(amount);
    const parsedTerm = termMonths ? Number(termMonths) : null;
    if (!parsedAmount || parsedAmount <= 0) return setError('Enter a valid loan amount.');
    if (parsedTerm !== null && (!Number.isInteger(parsedTerm) || parsedTerm <= 0)) return setError('Enter a valid term in months.');
    setSaving(true);
    setError('');
    try {
      await requestLoan({ amount: parsedAmount, reason: purpose.trim() || null });
      setAmount(''); setPurpose(''); setTermMonths(''); setShowForm(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit loan request.');
    } finally { setSaving(false); }
  }

  async function submitRepayment() {
    if (!repaymentLoan) return;
    const amountValue = Number(repaymentAmount);
    if (!amountValue || amountValue <= 0) {
      setError('Enter a valid repayment amount.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await recordLoanRepayment(repaymentLoan.id, amountValue);
      setRepaymentLoan(null);
      setRepaymentAmount('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record repayment.');
    } finally { setSaving(false); }
  }

  return <div>
    <SectionTitle sub="View your loan requests and repayments." action={<Button icon={Plus} onClick={() => setShowForm((value) => !value)}>Request loan</Button>}>My Loans</SectionTitle>
    {showForm && <Card style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 180px' }}><label style={labelStyle}>Amount</label><input style={inputStyle} type="number" min="0" value={amount} onChange={(event) => setAmount(event.target.value)} /></div>
        <div style={{ flex: '1 1 180px' }}><label style={labelStyle}>Term (months)</label><input style={inputStyle} type="number" min="1" value={termMonths} onChange={(event) => setTermMonths(event.target.value)} /></div>
        <div style={{ flex: '2 1 260px' }}><label style={labelStyle}>Purpose</label><input style={inputStyle} value={purpose} onChange={(event) => setPurpose(event.target.value)} /></div>
      </div>
      {error && <div style={{ color: ALERT, fontSize: 12, marginTop: 10 }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}><Button disabled={saving} onClick={submitRequest}>{saving ? 'Submitting...' : 'Submit request'}</Button></div>
    </Card>}
    {repaymentLoan && <Card style={{ marginBottom: 18 }}><div style={{ color: INK, fontWeight: 700, marginBottom: 10 }}>Record repayment</div><div style={{ color: MUTED, fontSize: 12, marginBottom: 8 }}>Loan amount: GHS {Number(repaymentLoan.amount || 0).toFixed(2)}</div><input style={inputStyle} type="number" min="0" placeholder="Repayment amount" value={repaymentAmount} onChange={(event) => setRepaymentAmount(event.target.value)} /><div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}><Button variant="ghost" onClick={() => setRepaymentLoan(null)}>Cancel</Button><Button disabled={saving} onClick={submitRepayment}>{saving ? 'Saving...' : 'Record repayment'}</Button></div></Card>}
    {loading ? <div style={{ color: MUTED, padding: 30 }}><Loader2 size={16} /> Loading loans...</div> : loans.length === 0 ? <Card><div style={{ color: MUTED, textAlign: 'center' }}><Banknote size={24} /><p>No loan requests found.</p></div></Card> : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{loans.map((loan) => {
      const paid = repayments.filter((repayment) => repayment.loan_id === loan.id).reduce((sum, repayment) => sum + Number(repayment.amount || 0), 0);
      return <Card key={loan.id} style={{ padding: '14px 18px' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><div><div style={{ color: INK, fontFamily: FONT_BODY, fontWeight: 700 }}>{loan.purpose || 'Loan request'}</div><div style={{ color: loan.status === 'Voided' ? ALERT : MUTED, fontSize: 12, fontWeight: loan.status === 'Voided' ? 700 : 400 }}>{loan.status}{loan.void_reason ? ` · ${loan.void_reason}` : ''} · {loan.created_at ? new Date(loan.created_at).toLocaleDateString('en-GB') : ''}</div></div><div style={{ textAlign: 'right', fontFamily: FONT_MONO, color: loan.status === 'Voided' ? ALERT : GREEN }}>GHS {Number(loan.amount || 0).toFixed(2)}<div style={{ color: MUTED, fontSize: 11, fontFamily: FONT_BODY }}>Repaid: GHS {paid.toFixed(2)}</div>{loan.status === 'Approved' && <Button size="sm" onClick={() => { setRepaymentLoan(loan); setError(''); }}>Record repayment</Button>}</div></div></Card>;
    })}</div>}
  </div>;
}

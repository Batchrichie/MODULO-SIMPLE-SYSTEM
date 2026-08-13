import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Check, AlertTriangle, ArrowLeft, CheckCircle2, Clock, X, Landmark, Search, Scale } from 'lucide-react';
import { INK, PAPER, PAPER_RAISED, RULE, GREEN, GREEN_DEEP, GOLD, ALERT, MUTED,
         FONT_DISPLAY, FONT_BODY, FONT_MONO } from '../theme/tokens';
import Card from '../components/ui/Card';
import SectionTitle from '../components/ui/SectionTitle';
import TableScroll from '../components/ui/TableScroll';
import Th from '../components/ui/Th';
import Td from '../components/ui/Td';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { inputStyle, labelStyle } from '../components/ui/styles';
import { fmt } from '../utils/format';
import { db } from '../supabaseClient';
import type { AppData, MutateFn, PanelProps, BankReconciliation, BankReconciliationItem } from '../types';

export default function BankReconciliationPanel({ data, mutate }: PanelProps) {
  const [showNewModal, setShowNewModal] = useState(false);
  const [accountCode, setAccountCode] = useState('');
  const [statementDate, setStatementDate] = useState(new Date().toISOString().slice(0, 10));
  const [statementBalance, setStatementBalance] = useState('');
  const [activeRecId, setActiveRecId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const paymentAccounts = data.accounts.filter(a => a.isPaymentAccount);
  const filteredAccounts = paymentAccounts.length > 0 ? paymentAccounts : data.accounts.filter(a => a.type === 'Asset');

  const activeRec = activeRecId ? data.bankReconciliations.find(r => r.id === activeRecId) : null;

  const finalizedEntryIds = useMemo(() => {
    const ids = new Set<string>();
    data.bankReconciliations.forEach(r => {
      if (r.accountCode === accountCode && r.status === 'Reconciled') {
        r.items.forEach(i => ids.add(i.journalEntryId));
      }
    });
    return ids;
  }, [data.bankReconciliations, accountCode]);

  const candidateEntries = useMemo(() => {
    if (!activeRec) return [];
    return data.journal
      .filter(e => e.date <= activeRec.statementDate && !finalizedEntryIds.has(e.id))
      .map(e => {
        const bankLines = e.lines.filter(l => l.account === activeRec.accountCode);
        const netAmount = bankLines.reduce((s, l) => s + l.debit - l.credit, 0);
        return { entry: e, netAmount, bankLines };
      })
      .filter(e => e.netAmount !== 0);
  }, [data.journal, activeRec, finalizedEntryIds]);

  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return candidateEntries;
    const q = searchQuery.toLowerCase();
    return candidateEntries.filter(e =>
      e.entry.entryNumber.toLowerCase().includes(q) ||
      (e.entry.description || '').toLowerCase().includes(q) ||
      e.entry.date.includes(q)
    );
  }, [candidateEntries, searchQuery]);

  const clearedEntryIds = useMemo(() => {
    if (!activeRec) return new Set<string>();
    return new Set(activeRec.items.map(i => i.journalEntryId));
  }, [activeRec]);

  const bookBalance = candidateEntries.reduce((s, e) => s + e.netAmount, 0);
  const clearedBalance = activeRec?.items.reduce((s, i) => s + i.amount, 0) || 0;
  const difference = (activeRec?.statementBalance || 0) - clearedBalance;
  const outstanding = bookBalance - clearedBalance;
  const progress = activeRec ? (candidateEntries.length > 0 ? (clearedEntryIds.size / candidateEntries.length) * 100 : 0) : 0;

  function toggleEntry(entryId: string, amount: number) {
    if (!activeRec) return;
    const isCleared = clearedEntryIds.has(entryId);
    let newItems: BankReconciliationItem[];
    if (isCleared) {
      newItems = activeRec.items.filter(i => i.journalEntryId !== entryId);
    } else {
      newItems = [...activeRec.items, {
        id: `BRI-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        reconciliationId: activeRec.id,
        journalEntryId: entryId,
        accountCode: activeRec.accountCode,
        amount,
      }];
    }
    const updatedRec = { ...activeRec, items: newItems };
    mutate(d => ({ ...d, bankReconciliations: d.bankReconciliations.map(r => r.id === activeRec.id ? updatedRec : r) }));
  }

  async function createReconciliation() {
    if (!accountCode || !statementDate || !statementBalance) { alert('Please select an account, statement date, and enter a statement balance.'); return; }
      if (!accountCode || !statementDate || !statementBalance) { window.alert('Please select an account, statement date, and enter a statement balance.'); return; }
    const id = `BR-${Date.now()}`;
    const rec: BankReconciliation = { id, accountCode, statementDate, statementBalance: parseFloat(statementBalance) || 0, status: 'Draft', items: [] };
    mutate(d => ({ ...d, bankReconciliations: [rec, ...d.bankReconciliations] }));
    try {
      await db.saveBankReconciliation(rec);
      setActiveRecId(id);
      setShowNewModal(false);
    } catch (err) { console.error('Failed to create reconciliation:', err); alert('Failed to save reconciliation.'); }
  }

  async function saveReconciliation() {
    if (!activeRec) return;
    setSaving(true);
    try { await db.saveBankReconciliation(activeRec); }
    catch (err) { console.error('Failed to save:', err); alert('Failed to save.'); }
    finally { setSaving(false); }
  }

  async function finalizeReconciliation() {
    if (!activeRec) return;
    if (Math.abs(difference) > 0.01) { alert(`Difference of GHS ${fmt(difference)} remains. Cannot finalize until balanced.`); return; }
      if (Math.abs(difference) > 0.01) { window.alert(`Difference of GHS ${fmt(difference)} remains. Cannot finalize until balanced.`); return; }
    const updated = { ...activeRec, status: 'Reconciled' as const };
    mutate(d => ({ ...d, bankReconciliations: d.bankReconciliations.map(r => r.id === activeRec.id ? updated : r) }));
    try {
      await db.saveBankReconciliation(updated);
      setActiveRecId(null);
    } catch (err) { console.error('Failed to finalize:', err); alert('Failed to finalize reconciliation.'); }
  }

  async function deleteReconciliation(id: string) {
    const confirmed = await confirmAsync('Delete this reconciliation?');
    if (!confirmed) return;
    const prev = data.bankReconciliations;
    mutate(d => ({ ...d, bankReconciliations: d.bankReconciliations.filter(r => r.id !== id) }));
    try {
      await db.deleteBankReconciliation(id);
      if (activeRecId === id) setActiveRecId(null);
    } catch (err) {
      console.error('Failed to delete:', err); alert('Failed to delete reconciliation.');
        console.error('Failed to delete:', err); window.alert('Failed to delete reconciliation.');
      mutate(d => ({ ...d, bankReconciliations: prev }));
    }
  }

  // Active reconciliation view
  if (activeRec) {
    const acct = data.accounts.find(a => a.code === activeRec.accountCode);
    const isBalanced = Math.abs(difference) < 0.01;

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button onClick={() => setActiveRecId(null)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: `1px solid ${RULE}`, borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: INK, fontFamily: FONT_BODY, fontSize: 13, fontWeight: 500, transition: 'background 0.15s' }}>
            <ArrowLeft size={15} /> Back
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: INK, display: 'flex', alignItems: 'center', gap: 10 }}>
              {acct?.name || activeRec.accountCode}
              <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                background: activeRec.status === 'Reconciled' ? 'var(--success-bg)' : 'var(--alert-bg)',
                color: activeRec.status === 'Reconciled' ? GREEN : GOLD,
                display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {activeRec.status === 'Reconciled' ? <><CheckCircle2 size={12} /> Reconciled</> : <><Clock size={12} /> Draft</>}
              </span>
            </div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>Statement: {activeRec.statementDate}</div>
          </div>
        </div>

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Book Balance', value: bookBalance, color: INK },
            { label: 'Statement Balance', value: activeRec.statementBalance, color: INK },
            { label: 'Cleared', value: clearedBalance, color: GREEN },
            { label: 'Outstanding', value: outstanding, color: GOLD },
            { label: 'Difference', value: difference, color: isBalanced ? GREEN : ALERT },
          ].map(k => (
            <Card key={k.label} style={{ borderTop: `3px solid ${k.color}`, padding: '16px' }}>
              <div style={{ fontSize: 10, color: MUTED, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{k.label}</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 18, fontWeight: 700, color: k.color }}>GHS {fmt(k.value)}</div>
            </Card>
          ))}
        </div>

        {/* Progress bar */}
        <Card style={{ marginBottom: 20, padding: '12px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: INK }}>Reconciliation Progress</span>
            <span style={{ fontSize: 12, color: MUTED, fontFamily: FONT_MONO }}>{clearedEntryIds.size} / {candidateEntries.length} entries</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--rule)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 3, background: isBalanced ? GREEN : GOLD, width: `${Math.min(progress, 100)}%`, transition: 'width 0.3s ease' }} />
          </div>
        </Card>

        {/* Search bar */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: MUTED, pointerEvents: 'none' }} />
            <input style={{ ...inputStyle, paddingLeft: 36 }} placeholder='Search by entry #, description, or date...' value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </div>

        {/* Transaction table */}
        <Card>
          <TableScroll>
            <table className='table-card' style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <Th style={{ width: 44 }}></Th>
                  <Th>Date</Th>
                  <Th>Entry #</Th>
                  <Th>Description</Th>
                  <Th right>Amount (GHS)</Th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map(({ entry, netAmount }) => {
                  const isCleared = clearedEntryIds.has(entry.id);
                  return (
                    <tr key={entry.id} className='row-hover' style={{ background: isCleared ? 'var(--success-bg)' : undefined }}>
                      <td>
                        <input type='checkbox' checked={isCleared} onChange={() => toggleEntry(entry.id, netAmount)} style={{ width: 16, height: 16, cursor: 'pointer', accent: GREEN as string }} />
                      </td>
                      <Td>{entry.date}</Td>
                      <Td mono>{entry.entryNumber}</Td>
                      <Td>{entry.description || '—'}</Td>
                      <Td right mono bold style={{ color: netAmount > 0 ? GREEN : ALERT }}>
                        {netAmount > 0 ? '+' : ''}{fmt(netAmount)}
                      </Td>
                    </tr>
                  );
                })}
                {filteredEntries.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 28, textAlign: 'center', color: MUTED, fontSize: 13 }}>
                    {searchQuery ? 'No matching entries found.' : `No unreconciled transactions found for this account up to ${activeRec.statementDate}.`}
                  </td></tr>
                )}
              </tbody>
            </table>
          </TableScroll>
        </Card>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <Button onClick={saveReconciliation} disabled={saving} variant='secondary'>{saving ? 'Saving...' : 'Save Draft'}</Button>
          <Button onClick={finalizeReconciliation} disabled={!isBalanced} icon={Check}>Finalize</Button>
        </div>
      </div>
    );
  }

  // List view
  const totalRecs = data.bankReconciliations.length;
  const reconciledCount = data.bankReconciliations.filter(r => r.status === 'Reconciled').length;
  const draftCount = totalRecs - reconciledCount;

  return (
    <div>
      <SectionTitle sub='Match your bank statements against your ledger entries for each payment account.'
        action={<Button onClick={() => setShowNewModal(true)} icon={Plus}>New Reconciliation</Button>}>
        Bank Reconciliation
      </SectionTitle>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        <Card style={{ borderTop: `3px solid ${INK}` }}>
          <div style={{ fontSize: 10, color: MUTED, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Total Reconciliations</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 20, fontWeight: 700, color: INK }}>{totalRecs}</div>
        </Card>
        <Card style={{ borderTop: `3px solid ${GREEN}` }}>
          <div style={{ fontSize: 10, color: MUTED, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Reconciled</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 20, fontWeight: 700, color: GREEN }}>{reconciledCount}</div>
        </Card>
        <Card style={{ borderTop: `3px solid ${GOLD}` }}>
          <div style={{ fontSize: 10, color: MUTED, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Drafts</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 20, fontWeight: 700, color: GOLD }}>{draftCount}</div>
        </Card>
      </div>

      {filteredAccounts.length === 0 && (
        <Card style={{ marginBottom: 20, borderLeft: `4px solid ${GOLD}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={18} color={GOLD} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: INK }}>No payment accounts found</div>
              <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>Go to Chart of Accounts and mark your bank accounts as "Payment Account" to enable reconciliation.</div>
            </div>
          </div>
        </Card>
      )}

      {data.bankReconciliations.length === 0 && !showNewModal && (
        <Card style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--nav-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Landmark size={24} color={MUTED} />
          </div>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: INK, marginBottom: 6 }}>No reconciliations yet</div>
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 20, maxWidth: 360, margin: '0 auto 20px', lineHeight: 1.5 }}>Start by matching your bank statement to the ledger. Select a payment account and enter your statement balance.</div>
          <Button onClick={() => setShowNewModal(true)} icon={Plus}>New Reconciliation</Button>
        </Card>
      )}

      {/* Past reconciliations */}
      {data.bankReconciliations.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.bankReconciliations.map(rec => {
            const recCleared = rec.items.reduce((s, i) => s + i.amount, 0);
            const acct = data.accounts.find(a => a.code === rec.accountCode);
            const isReconciled = rec.status === 'Reconciled';
            const diff = rec.statementBalance - recCleared;
            return (
              <Card key={rec.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, borderLeft: `4px solid ${isReconciled ? GREEN : GOLD}` }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: INK }}>{acct?.name || rec.accountCode}</span>
                    <span style={{ padding: '2px 8px', borderRadius: 5, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, background: isReconciled ? 'var(--success-bg)' : 'var(--alert-bg)', color: isReconciled ? GREEN : GOLD }}>
                      {rec.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: MUTED, marginTop: 4, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <span>Date: {rec.statementDate}</span>
                    <span>Statement: <b style={{ fontFamily: FONT_MONO }}>GHS {fmt(rec.statementBalance)}</b></span>
                    <span>Cleared: <b style={{ fontFamily: FONT_MONO }}>GHS {fmt(recCleared)}</b></span>
                    <span style={{ color: Math.abs(diff) < 0.01 ? GREEN : ALERT }}>Diff: <b style={{ fontFamily: FONT_MONO }}>GHS {fmt(diff)}</b></span>
                    <span>Items: {rec.items.length}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  {rec.status === 'Draft' && (
                    <Button onClick={() => setActiveRecId(rec.id)} variant='secondary' style={{ padding: '6px 14px', fontSize: 12 }}>Continue</Button>
                  )}
                  {isReconciled && (
                    <Button onClick={() => setActiveRecId(rec.id)} variant='secondary' style={{ padding: '6px 14px', fontSize: 12 }}>View</Button>
                  )}
                  <button onClick={() => deleteReconciliation(rec.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', fontSize: 12, cursor: 'pointer', color: ALERT, background: 'none', border: `1px solid ${ALERT}`, borderRadius: 8, fontFamily: FONT_BODY }}>
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* New Reconciliation Modal */}
      {showNewModal && (
        <Modal title='New Bank Reconciliation' sub='Select the bank account and enter your statement details.' onClose={() => setShowNewModal(false)}>
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <label style={labelStyle}>Bank Account</label>
              <select style={inputStyle} value={accountCode} onChange={e => setAccountCode(e.target.value)}>
                <option value=''>Select payment account...</option>
                {filteredAccounts.map(a => (
                  <option key={a.code} value={a.code}>{a.code} — {a.name}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 180px' }}>
                <label style={labelStyle}>Statement Date</label>
                <input type='date' style={inputStyle} value={statementDate} onChange={e => setStatementDate(e.target.value)} />
              </div>
              <div style={{ flex: '1 1 180px' }}>
                <label style={labelStyle}>Statement Balance (GHS)</label>
                <input type='text' style={inputStyle} value={statementBalance}
                  onChange={e => setStatementBalance(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder='0.00' />
              </div>
            </div>
            <Button onClick={createReconciliation} icon={Plus} fullWidth>Start Reconciliation</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

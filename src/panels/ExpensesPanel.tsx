import React, { useState, useMemo } from "react";
import { Plus, Receipt, AlertTriangle } from 'lucide-react';
import { INK, PAPER, PAPER_RAISED, RULE, GREEN, GOLD, ALERT, MUTED, FONT_DISPLAY, FONT_BODY, FONT_MONO } from '../theme/tokens';
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
import { postJournalEntry, findDefaultPaymentAccount, findPeriodByDate } from '../supabaseClient';
import type { AppData, PanelProps, JournalEntry } from '../types';

export default function ExpensesPanel({ data, mutate }: PanelProps) {
  const [showNewModal, setShowNewModal] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [vendor, setVendor] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentAccount, setPaymentAccount] = useState("");
  const [account, setAccount] = useState("");
  const [project, setProject] = useState("GEN");
  const [showHistory, setShowHistory] = useState(true);

  const expenseAccounts = data.accounts.filter((a) => a.type === "Expense");
  const paymentAccounts = data.accounts.filter(a => a.isPaymentAccount);
  const makeTempId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const closedExpDatePeriod = findPeriodByDate(data.accountingPeriods, date);
  const showExpDateClosedWarn = closedExpDatePeriod?.status === "closed";

  function resetForm() {
    setDate(new Date().toISOString().slice(0, 10));
    setVendor(""); setDescription(""); setAmount("");
    const def = findDefaultPaymentAccount(data.accounts);
    setPaymentAccount(def?.code || "");
    setAccount(""); setProject("GEN");
  }

  async function postExpense() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { window.alert("Please enter a valid amount."); return; }
    if (!account) { window.alert("Please select an expense account."); return; }
    if (!paymentAccount) { window.alert("Please select a payment account."); return; }
    if (!description.trim()) { window.alert("Please enter a description."); return; }

    // Note: RPC will handle description — vendor concatenation, so send them separately
    const entryNumber = makeTempId("JE-EXP");

    // Construct temporary entry for optimistic UI update (will be replaced when journal reloads)
    const entry: JournalEntry = {
      id: entryNumber,
      entryNumber,
      date,
      description: `${description.trim()} — ${vendor.trim() || "Cash expense"}`,
      period: date.slice(0, 7),
      project: project === "GEN" ? null : project,
      lines: [
        { account, debit: amt, credit: 0 },
        { account: paymentAccount, debit: 0, credit: amt },
      ],
    };

    mutate((d) => ({
      ...d,
      journal: [entry, ...d.journal],
    }));

    try {
      const postedEntryId = await postJournalEntry(
        entry.date,
        entry.description ?? null,
        entry.project ?? null,
        entry.lines.map((line) => ({
          account: line.account,
          debit: Number(line.debit) || 0,
          credit: Number(line.credit) || 0,
        }))
      );

      mutate((d) => ({
        ...d,
        journal: d.journal.map((item) =>
          item.id === entry.id ? { ...item, id: postedEntryId } : item
        ),
      }));
    } catch (err: any) {
      mutate((d) => ({
        ...d,
        journal: d.journal.filter((item: JournalEntry) => item.id !== entry.id),
      }));
      console.error("Failed to post expense:", err);
      const errorMsg = err?.message || err?.toString?.() || "Unknown error occurred";
      window.alert(`Failed to post expense: ${errorMsg}`);
      return;
    }

    resetForm();
    setShowNewModal(false);
  }

  const recentExpenses = data.journal
    .filter((e) => {
      if (!e.lines || e.lines.length < 2) return false;
      const debitLine = e.lines.find((line) => line.debit > 0);
      const creditLine = e.lines.find((line) => line.credit > 0);
      if (!debitLine || !creditLine) return false;
      const expenseAccount = data.accounts.find((a) => a.code === debitLine.account);
      const paymentAccount = data.accounts.find((a) => a.code === creditLine.account);
      return Boolean(
        expenseAccount &&
        expenseAccount.type?.toLowerCase() === "expense" &&
        paymentAccount &&
        paymentAccount.isPaymentAccount
      );
    })
    .slice(0, 20);

  const totalExpenses = recentExpenses.reduce(
    (s, e) => s + (e.lines.find((l) => l.debit > 0)?.debit || 0), 0
  );

  return (
    <div>
      <SectionTitle
        sub="Record day-to-day costs without touching the double-entry journal."
        action={
          mutate ? (
            <Button onClick={() => { resetForm(); setShowNewModal(true); }} icon={Plus}>
              New Expense
            </Button>
          ) : undefined
        }
      >
        Quick Expenses
      </SectionTitle>

      {/* Summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <Card style={{ borderTop: `3px solid ${INK}` }}>
          <div style={{ fontSize: 10, color: MUTED, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Recent Expenses ({recentExpenses.length})</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 18, fontWeight: 700, color: INK }}>GHS {fmt(totalExpenses)}</div>
        </Card>
      </div>

      <SectionTitle
        sub="Recently posted through this quick-entry panel."
        action={
          <Button variant="ghost" onClick={() => setShowHistory((s) => !s)}>
            {showHistory ? "Hide" : "Show"} history
          </Button>
        }
      >
        Expense History
      </SectionTitle>

      {showHistory && (
        <Card>
          <TableScroll>
            <table className="table-card" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <Th>Entry</Th>
                  <Th>Date</Th>
                  <Th>Description</Th>
                  <Th>Project</Th>
                  <Th right>Amount</Th>
                </tr>
              </thead>
              <tbody>
                {recentExpenses.map((e) => (
                  <tr key={e.id} className="row-hover">
                    <Td mono label="Entry">{e.entryNumber}</Td>
                    <Td label="Date">{e.date}</Td>
                    <Td label="Description">{e.description}</Td>
                    <Td label="Project">{projectName(data.projects, e.project)}</Td>
                    <Td right mono label="Amount">
                      GHS {fmt(e.lines.find((l) => l.debit > 0)?.debit || 0)}
                    </Td>
                  </tr>
                ))}
                {recentExpenses.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: MUTED }}>
                      <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.3 }}><Receipt size={28} style={{ margin: '0 auto', display: 'block' }} /></div>
                      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, marginBottom: 4 }}>No expenses posted yet</div>
                      <div style={{ fontSize: 13 }}>Click <b>New Expense</b> to record your first quick expense.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableScroll>
        </Card>
      )}

      {/* New Expense Modal */}
      {showNewModal && (
        <Modal title="New Quick Expense" sub="Posts a debit to the expense account and credit to your payment account." onClose={() => { resetForm(); setShowNewModal(false); }}>
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 140px' }}>
                <label style={labelStyle}>Date *</label>
                <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
                {showExpDateClosedWarn && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, padding: "8px 12px", borderRadius: 8, background: "var(--alert-bg)", border: `1px dashed ${ALERT}`, color: ALERT, fontSize: 12, fontFamily: FONT_BODY }}>
                    <AlertTriangle size={14} />
                    <span><b>{closedExpDatePeriod!.name}</b> is closed. Transactions cannot be posted to this period.</span>
                  </div>
                )}
              </div>
              <div style={{ flex: '1 1 120px' }}>
                <label style={labelStyle}>Amount (GHS) *</label>
                <input style={inputStyle} value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.00" />
              </div>
            </div>
            <div style={{ flex: '1 1 100%' }}>
              <label style={labelStyle}>Description *</label>
              <input style={inputStyle} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Fuel for site visit" />
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 180px' }}>
                <label style={labelStyle}>Vendor / Payee</label>
                <input style={inputStyle} value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="e.g. Shell Ghana" />
              </div>
              <div style={{ flex: '1 1 180px' }}>
                <label style={labelStyle}>Paid via *</label>
                <AccountSelect
                  value={paymentAccount}
                  onChange={setPaymentAccount}
                  accounts={paymentAccounts}
                  placeholder="Search payment account…"
                />
                {paymentAccounts.length === 0 && (
                  <div style={{ fontSize: 11, color: ALERT, marginTop: 4 }}>No payment accounts found. Go to Chart of Accounts and mark accounts as "Payment Account".</div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px' }}>
                <label style={labelStyle}>Expense account *</label>
                <AccountSelect
                  value={account}
                  onChange={setAccount}
                  accounts={expenseAccounts}
                  placeholder="Search expense account…"
                />
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <label style={labelStyle}>Project</label>
                <ProjectSelect value={project} onChange={setProject} projects={data.projects} />
              </div>
            </div>
            <Button onClick={postExpense} icon={Plus} fullWidth>
              Post Expense
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
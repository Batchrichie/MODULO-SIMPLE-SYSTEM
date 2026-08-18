import React, { useState, useMemo } from "react";
import { Plus, Trash2, PenLine, Check, Landmark } from "lucide-react";
import { INK, PAPER, PAPER_RAISED, RULE, GREEN, GOLD, ALERT, MUTED,
         FONT_DISPLAY, FONT_BODY, FONT_MONO } from "../theme/tokens";
import Card from "../components/ui/Card";
import SectionTitle from "../components/ui/SectionTitle";
import TableScroll from "../components/ui/TableScroll";
import Th from "../components/ui/Th";
import Td from "../components/ui/Td";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import { inputStyle, labelStyle } from "../components/ui/styles";
import { fmt } from "../utils/format";
import { db } from "../supabaseClient";
import { confirmAsync } from "../components/ui/Notifications";
import { assertAccount } from "../validation";
import type { AppData } from "../types";

export default function AccountsPanel({ data, mutate }) {
  const [showModal, setShowModal] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", name: "", type: "Asset", normal: "Debit", isPaymentAccount: false, role: null as string | null });
  const usedCodes = editingCode
    ? new Set(data.accounts.filter(a => a.code !== editingCode).map(a => a.code))
    : new Set(data.accounts.map(a => a.code));

  function resetForm() {
    setForm({ code: "", name: "", type: "Asset", normal: "Debit", isPaymentAccount: false, role: null });
    setEditingCode(null);
  }

  function openNew() { resetForm(); setShowModal(true); }

  function openEdit(acct) {
    setEditingCode(acct.code);
    setForm({ code: acct.code, name: acct.name, type: acct.type, normal: acct.normal || "Debit", isPaymentAccount: acct.isPaymentAccount || false, role: acct.role ?? null });
    setShowModal(true);
  }

  function closeModal() { setShowModal(false); resetForm(); }

  function saveAccount() {
    const err = assertAccount(form, usedCodes);
    if (err) { window.alert(err); return; }
    const newAccount = { ...form, code: form.code.trim(), reportingGroup: null, role: form.role ?? null };
    if (editingCode) {
      mutate(d => ({ ...d, accounts: d.accounts.map(a => a.code === editingCode ? newAccount : a) }));
    } else {
      mutate(d => ({ ...d, accounts: [...d.accounts, newAccount] }));
    }
    db.saveAccounts([newAccount]).catch(err => {
      console.error("Failed to save account:", err);
      window.alert("Failed to persist account to server.");
    });
    closeModal();
  }

  async function removeAccount(code) {
    const inUse = data.journal.some(e => e.lines.some(l => l.account === code));
    if (inUse) { window.alert("This account has posted entries and can't be removed."); return; }
    const confirmed = await confirmAsync(`Delete account ${code}?`);
    if (!confirmed) return;
    mutate(d => ({ ...d, accounts: d.accounts.filter(a => a.code !== code) }));
    db.deleteAccount(code).catch(err => {
      console.error("Failed to delete account:", err);
      window.alert("Failed to delete account on server.");
    });
  }

  const grouped = useMemo(() => {
    const order = ["Asset", "Liability", "Equity", "Income", "Expense"];
    return order
      .filter(type => data.accounts.some(a => a.type === type))
      .map(type => ({ type, accounts: data.accounts.filter(a => a.type === type) }));
  }, [data.accounts]);

  return (
    <div>
      <SectionTitle sub="Every entry you post routes through one of these accounts. Mark bank accounts as Payment Accounts for reconciliation."
        action={<Button onClick={openNew} icon={Plus}>New Account</Button>}>
        Chart of Accounts
      </SectionTitle>

      {grouped.map(g => (
        <div key={g.type} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8, paddingLeft: 4 }}>
            {g.type} Accounts ({g.accounts.length})
          </div>
          <Card>
            <TableScroll>
              <table className="table-card" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <Th>Code</Th>
                    <Th>Name</Th>
                    <Th>Normal</Th>
                    <Th>Role</Th>
                    <Th>Payment Acct</Th>
                    <Th right>Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {g.accounts.map(a => (
                    <tr key={a.code} className="row-hover">
                      <Td mono label="Code" style={{ fontWeight: 600 }}>{a.code}</Td>
                      <Td label="Name">{a.name}</Td>
                      <Td label="Normal Balance" style={{ fontSize: 12, color: MUTED }}>{a.normal}</Td>
                      <Td label="Role" style={{ fontSize: 12, color: MUTED }}>{a.role || "—"}</Td>
                      <Td label="Payment">
                        {a.isPaymentAccount ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: GREEN, background: 'var(--success-bg)', padding: '2px 8px', borderRadius: 6 }}>
                            <Landmark size={11} /> Yes
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, color: MUTED }}>—</span>
                        )}
                      </Td>
                      <Td right label="Actions">
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <button onClick={() => openEdit(a)} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 8px', fontSize: 12, cursor: 'pointer', color: INK, background: 'none', border: `1px solid ${RULE}`, borderRadius: 6, fontFamily: FONT_BODY }}>
                            <PenLine size={12} /> Edit
                          </button>
                          <button onClick={() => removeAccount(a.code)} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 8px', fontSize: 12, cursor: 'pointer', color: ALERT, background: 'none', border: `1px solid ${ALERT}`, borderRadius: 6, fontFamily: FONT_BODY }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </Card>
        </div>
      ))}

      {data.accounts.length === 0 && (
        <Card style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: INK, marginBottom: 6 }}>No accounts yet</div>
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>Add your chart of accounts to get started.</div>
          <Button onClick={openNew} icon={Plus}>New Account</Button>
        </Card>
      )}

      {showModal && (
        <Modal title={editingCode ? "Edit Account" : "New Account"}
          sub={editingCode ? `Editing ${editingCode}` : 'Add a new account to your chart of accounts.'}
          onClose={closeModal}>
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 100px' }}>
                <label style={labelStyle}>Account Code</label>
                <input style={inputStyle} value={form.code}
                  onChange={e => setForm({ ...form, code: e.target.value })}
                  placeholder="6600" disabled={!!editingCode} />
              </div>
              <div style={{ flex: '2 1 200px' }}>
                <label style={labelStyle}>Account Name</label>
                <input style={inputStyle} value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Marketing Expense" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 140px' }}>
                <label style={labelStyle}>Type</label>
                <select style={inputStyle} value={form.type}
                  onChange={e => setForm({ ...form, type: e.target.value })}>
                  {["Asset", "Liability", "Equity", "Income", "Expense"].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ flex: '1 1 140px' }}>
                <label style={labelStyle}>Normal Balance</label>
                <select style={inputStyle} value={form.normal}
                  onChange={e => setForm({ ...form, normal: e.target.value })}>
                  <option>Debit</option>
                  <option>Credit</option>
                </select>
              </div>
              <div style={{ flex: '1 1 180px' }}>
                <label style={labelStyle}>Role</label>
                <select
                  style={inputStyle}
                  value={form.role ?? "none"}
                  onChange={e => setForm({ ...form, role: e.target.value === "none" ? null : e.target.value })}
                >
                  <option value="none">None</option>
                  <option value="current-asset">current-asset</option>
                  <option value="non-current-asset">non-current-asset</option>
                  <option value="cash">cash</option>
                  <option value="ar">ar (Accounts Receivable)</option>
                  <option value="ap">ap (Accounts Payable)</option>
                  <option value="current-liability">current-liability</option>
                  <option value="non-current-liability">non-current-liability</option>
                  <option value="equity">equity</option>
                  <option value="revenue">revenue</option>
                  <option value="vat-payable">vat-payable</option>
                  <option value="nhil-payable">nhil-payable</option>
                </select>
              </div>
            </div>
            {form.type === 'Asset' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, fontFamily: FONT_BODY }}>
                <input type='checkbox' checked={form.isPaymentAccount}
                  onChange={e => setForm({ ...form, isPaymentAccount: e.target.checked })}
                  style={{ width: 18, height: 18, accent: GREEN as string }} />
                <span>Mark as <b>Payment / Bank Account</b></span>
                <span style={{ fontSize: 12, color: MUTED }}>(enables bank reconciliation)</span>
              </label>
            )}
            <Button onClick={saveAccount} icon={editingCode ? Check : Plus} fullWidth>
              {editingCode ? 'Save Changes' : 'Add Account'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

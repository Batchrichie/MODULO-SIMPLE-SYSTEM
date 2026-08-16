import React, { useState, useMemo } from "react";
import { Plus, Trash2, Check, AlertTriangle } from "lucide-react";
import {
  INK,
  PAPER,
  RULE,
  GREEN,
  GREEN_DEEP,
  ALERT,
  MUTED,
  FONT_BODY,
  FONT_MONO,
} from "../theme/tokens";
import TableScroll from "../components/ui/TableScroll";
import Th from "../components/ui/Th";
import Td from "../components/ui/Td";
import Button from "../components/ui/Button";
import { inputStyle, labelStyle } from "../components/ui/styles";
import ProjectSelect from "../components/ui/ProjectSelect";
import AccountSelect from "../components/ui/AccountSelect";
import { fmt } from "../utils/format";
import { assertJournalEntry } from "../validation";
import { postJournalEntry } from "../supabaseClient";

/* ---------- helpers ---------- */

// Returns { debit, credit } totals accumulated for an account across all journal entries.
function computeAccountTotals(journal: any[], accountCode: string) {
  let debit = 0;
  let credit = 0;
  if (!accountCode) return { debit, credit };
  for (const entry of journal || []) {
    for (const line of entry.lines || []) {
      if (line.account === accountCode) {
        debit += line.debit || 0;
        credit += line.credit || 0;
      }
    }
  }
  return { debit, credit };
}

// Normal balance side, based on account.type (asset/expense → debit; liability/equity/revenue → credit)
function accountNormalSide(account: any) {
  if (!account || !account.type) return null;
  const t = String(account.type).toLowerCase();
  if (t === "asset" || t === "expense") return "debit";
  if (t === "liability" || t === "equity" || t === "revenue" || t === "income")
    return "credit";
  return null;
}

// Signed balance according to normal side (positive = normal, negative = contra)
function signedBalance(totals: { debit: number; credit: number }, normalSide: string | null) {
  if (normalSide === "debit") return totals.debit - totals.credit;
  if (normalSide === "credit") return totals.credit - totals.debit;
  return totals.debit - totals.credit;
}

export default function JournalEntryForm({ data, mutate, onDone }: any) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [project, setProject] = useState("GEN");
  const [lines, setLines] = useState([
    { account: "", debit: "", credit: "" },
    { account: "", debit: "", credit: "" },
  ]);

  // Pre-compute balances keyed by account code so we don't recompute per render per row.
  const balanceMap = useMemo(() => {
    const map = new Map();
    for (const acc of data.accounts || []) {
      map.set(acc.code, computeAccountTotals(data.journal, acc.code));
    }
    return map;
  }, [data.accounts, data.journal]);

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const diff = Math.round((totalDebit - totalCredit) * 100) / 100;
  const balanced = diff === 0 && totalDebit > 0;

  function updateLine(i: number, field: string, value: string) {
    setLines((ls) =>
      ls.map((l, idx) => (idx === i ? { ...l, [field]: value } : l))
    );
  }
  function addLine() {
    setLines((ls) => [...ls, { account: "", debit: "", credit: "" }]);
  }
  function removeLine(i: number) {
    setLines((ls) => ls.filter((_, idx) => idx !== i));
  }

  async function post() {
    const err = assertJournalEntry({ date, description, lines });
    if (err) {
      alert(err);
      return;
    }
    const validLines = lines.filter(
      (l) =>
        l.account && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0)
    );
    if (!balanced || validLines.length < 2) return;
    const entryNumber = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const period = date.slice(0, 7);
    const normalizedProject = project === "GEN" ? null : project;
    const entry = {
      id: entryNumber,
      entryNumber,
      date,
      description,
      period,
      project: normalizedProject,
      lines: validLines.map((l) => ({
        account: l.account,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
      })),
    };
    mutate((d: any) => ({
      ...d,
      journal: [entry, ...d.journal],
    }));
    try {
      const postedEntryId = await postJournalEntry(
        entry.date,
        entry.description ?? null,
        normalizedProject,
        entry.lines.map((line) => ({
          account: line.account,
          debit: Number(line.debit) || 0,
          credit: Number(line.credit) || 0,
        }))
      );

      mutate((d: any) => ({
        ...d,
        journal: d.journal.map((item: any) =>
          item.id === entry.id ? { ...item, id: postedEntryId, entryNumber: postedEntryId } : item
        ),
      }));
    } catch (err: any) {
      mutate((d: any) => ({
        ...d,
        journal: d.journal.filter((item: any) => item.id !== entry.id),
      }));
      console.error("Failed to save journal entry:", err);
      const errorMsg = err?.message || err?.toString?.() || "Unknown error occurred";
      alert(
        `Failed to save journal entry: ${errorMsg}`
      );
    }
    onDone && onDone();
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div style={{ flex: "1 1 120px" }}>
          <label style={labelStyle}>Date</label>
          <input
            type="date"
            style={inputStyle}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div style={{ flex: "3 1 250px" }}>
          <label style={labelStyle}>Description</label>
          <input
            style={inputStyle}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Paid office rent for July"
          />
        </div>
        <div style={{ flex: "1 1 150px" }}>
          <label style={labelStyle}>Project</label>
          <ProjectSelect
            value={project}
            onChange={setProject}
            projects={data.projects}
          />
        </div>
      </div>

      <TableScroll>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginBottom: 10,
          }}
        >
          <thead>
            <tr>
              <Th>Account</Th>
              <Th right>Debit</Th>
              <Th right>Credit</Th>
              <Th right>Balance</Th>
              <Th right>&nbsp;</Th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const acc = (data.accounts || []).find(
                (a: any) => a.code === l.account
              );
              const totals = l.account
                ? balanceMap.get(l.account) || { debit: 0, credit: 0 }
                : null;
              const normalSide = accountNormalSide(acc);

              const enteredDebit = parseFloat(l.debit) || 0;
              const enteredCredit = parseFloat(l.credit) || 0;

              // Running balance *before* this line is posted.
              const currentSigned = totals
                ? signedBalance(totals, normalSide)
                : 0;
              // Effect of this line on the normal-side balance:
              //   debit entry → + on debit-normal accounts, − on credit-normal
              //   credit entry → − on debit-normal, + on credit-normal
              const effect =
                normalSide === "credit"
                  ? enteredCredit - enteredDebit
                  : enteredDebit - enteredCredit;
              const newSigned = currentSigned + effect;

              const willChange = enteredDebit > 0 || enteredCredit > 0;

              return (
                <tr key={i}>
                  <Td>
                      <AccountSelect
                        value={l.account}
                        onChange={(v) => updateLine(i, "account", v)}
                        accounts={data.accounts}
                        style={inputStyle}
                        autoFocus={i === 0}
                      />
                  </Td>
                  <Td right>
                    <input
                      style={{
                        ...inputStyle,
                        textAlign: "right",
                        fontFamily: FONT_MONO,
                      }}
                      value={l.debit}
                      onChange={(e) =>
                        updateLine(
                          i,
                          "debit",
                          e.target.value.replace(/[^0-9.]/g, "")
                        )
                      }
                      placeholder="0.00"
                    />
                    {enteredDebit > 0 && totals && (
                      <div
                        style={{
                          fontSize: 10.5,
                          color: MUTED,
                          marginTop: 3,
                          fontFamily: FONT_MONO,
                          textAlign: "right",
                        }}
                      >
                        Dr total: GHS {fmt(totals.debit)} →{" "}
                        <span style={{ color: GREEN_DEEP, fontWeight: 600 }}>
                          {fmt(totals.debit + enteredDebit)}
                        </span>
                      </div>
                    )}
                  </Td>
                  <Td right>
                    <input
                      style={{
                        ...inputStyle,
                        textAlign: "right",
                        fontFamily: FONT_MONO,
                      }}
                      value={l.credit}
                      onChange={(e) =>
                        updateLine(
                          i,
                          "credit",
                          e.target.value.replace(/[^0-9.]/g, "")
                        )
                      }
                      placeholder="0.00"
                    />
                    {enteredCredit > 0 && totals && (
                      <div
                        style={{
                          fontSize: 10.5,
                          color: MUTED,
                          marginTop: 3,
                          fontFamily: FONT_MONO,
                          textAlign: "right",
                        }}
                      >
                        Cr total: GHS {fmt(totals.credit)} →{" "}
                        <span style={{ color: GREEN_DEEP, fontWeight: 600 }}>
                          {fmt(totals.credit + enteredCredit)}
                        </span>
                      </div>
                    )}
                  </Td>
                  <Td right mono>
                    {!totals && (
                      <span style={{ color: MUTED, fontSize: 12 }}>—</span>
                    )}
                    {totals && (
                      <div
                        style={{
                          fontSize: 11.5,
                          fontFamily: FONT_MONO,
                          color: INK,
                          textAlign: "right",
                          lineHeight: 1.4,
                        }}
                      >
                        <div style={{ color: MUTED, fontSize: 10.5 }}>
                          Now: {normalSide === "credit" ? "Cr" : "Dr"} GHS{" "}
                          {fmt(Math.abs(currentSigned))}
                          {!normalSide && ` (Dr)`}
                        </div>
                        <div
                          style={{
                            color: willChange ? GREEN_DEEP : INK,
                            fontWeight: willChange ? 700 : 500,
                          }}
                        >
                          {willChange
                            ? `→ ${normalSide === "credit" ? "Cr" : "Dr"} GHS ${fmt(
                                Math.abs(newSigned)
                              )}${
                                newSigned < 0
                                  ? " (contra)"
                                  : ""
                              }`
                            : `GHS ${fmt(Math.abs(currentSigned))}`}
                        </div>
                      </div>
                    )}
                  </Td>
                  <Td right>
                    <button
                      onClick={() => removeLine(i)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: MUTED,
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableScroll>
      <Button variant="ghost" onClick={addLine} icon={Plus}>
        Add line
      </Button>

      <div
        style={{
          marginTop: 18,
          padding: "12px 16px",
          borderRadius: 6,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
          background: balanced
            ? "var(--success-bg)"
            : diff === 0
            ? PAPER
            : "var(--alert-bg)",
          border: `1px solid ${
            balanced ? GREEN : diff === 0 ? RULE : ALERT
          }`,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 24,
            fontFamily: FONT_MONO,
            fontSize: 13.5,
            color: INK,
            flexWrap: "wrap",
          }}
        >
          <span>Debits: GHS {fmt(totalDebit)}</span>
          <span>Credits: GHS {fmt(totalCredit)}</span>
          <span
            style={{
              fontWeight: 700,
              color: balanced ? GREEN : diff !== 0 ? ALERT : MUTED,
            }}
          >
            Difference: GHS {fmt(Math.abs(diff))}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: FONT_BODY,
            fontSize: 13,
            fontWeight: 600,
            color: balanced ? GREEN_DEEP : ALERT,
          }}
        >
          {balanced ? <Check size={16} /> : <AlertTriangle size={16} />}
          {balanced ? "Balanced — ready to post" : "Not balanced yet"}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <Button onClick={post} disabled={!balanced}>
          Post entry
        </Button>
      </div>
    </div>
  );
}

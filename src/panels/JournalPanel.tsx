import React, { useState, useMemo } from "react";
import { Plus } from "lucide-react";
import { MUTED } from "../theme/tokens";
import Card from "../components/ui/Card";
import SectionTitle from "../components/ui/SectionTitle";
import TableScroll from "../components/ui/TableScroll";
import Th from "../components/ui/Th";
import Td from "../components/ui/Td";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import { fmt, projectName } from "../utils/format";
import JournalEntryForm from "./JournalEntryForm";

import { PrintPageWrapper, PageHeader, Footer, finStyles } from "../documents/FinancialShared";
import JournalDocument from "../documents/TrialBalanceDocument";

export default function JournalPanel({ data, mutate, readOnly, setPrintContent }: { data: any; mutate?: any; readOnly?: boolean; setPrintContent?: (c: any) => void }) {
  const [showModal, setShowModal] = useState(false);
  const [viewingEntry, setViewingEntry] = useState(null);
  const [filter, setFilter] = useState("all");
  const [groupBy, setGroupBy] = useState("none");

  const filteredJournal = useMemo(() => {
    const now = new Date();
    return data.journal.filter((e) => {
      if (filter === "all") return true;
      const d = new Date(e.date);
      if (filter === "today") return d.toDateString() === now.toDateString();
      if (filter === "this_month") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (filter === "this_year") return d.getFullYear() === now.getFullYear();
      if (filter === "last_30") return (now.getTime() - d.getTime()) <= 30 * 24 * 3600 * 1000;
      return true;
    });
  }, [data.journal, filter]);

  const totals = useMemo(() => {
    const entries = filteredJournal.length;
    const totalDebits = filteredJournal.reduce((s, e) => s + e.lines.reduce((ss, l) => ss + (l.debit || 0), 0), 0);
    const totalCredits = filteredJournal.reduce((s, e) => s + e.lines.reduce((ss, l) => ss + (l.credit || 0), 0), 0);
    const accounts = new Set<string>();
    filteredJournal.forEach(e => e.lines.forEach(l => accounts.add(l.account)));
    return { entries, totalDebits, totalCredits, accountsTouched: accounts.size };
  }, [filteredJournal]);

  function exportPdf() {
    if (!setPrintContent) return;
    const company = data.company;
    const genDate = new Date().toLocaleDateString();
    setPrintContent(
      <>
        <PrintPageWrapper firstPage>
          <div style={finStyles.pageWrap}>
            <PageHeader title="JOURNAL" subtitle="Recent entries" company={company} />
            <div style={{ padding: "12px 32px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={finStyles.thBg}>Entry</th><th style={finStyles.thBg}>Date</th><th style={finStyles.thBg}>Description</th><th style={finStyles.thBg}>Amount (GHS)</th></tr></thead>
                <tbody>
                  {filteredJournal.map(e => (
                    <tr key={e.id}><td style={finStyles.td}>{e.entryNumber}</td><td style={finStyles.td}>{e.date}</td><td style={finStyles.td}>{e.description}</td><td style={finStyles.tdR}>{(e.lines.reduce((s,l) => s + (l.debit||0),0)).toFixed(2)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Footer company={company} />
          </div>
        </PrintPageWrapper>
      </>
    );
  }

  return (
    <div>
      <SectionTitle
        sub={readOnly ? "Read-only view. Contact your accountant to post entries." : "Debits and credits must match before an entry can post."}
        action={
          !readOnly && mutate ? (
            <Button onClick={() => setShowModal(true)} icon={Plus}>
              New journal entry
            </Button>
          ) : undefined
        }
      >
        Journal
      </SectionTitle>

      <SectionTitle>
        Recent entries
      </SectionTitle>
      <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}>
        <Card style={{ padding: 12, flex: "0 0 180px" }}>
          <div style={{ fontSize: 11, color: MUTED }}>ENTRIES</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{totals.entries}</div>
        </Card>
        <Card style={{ padding: 12, flex: "0 0 180px" }}>
          <div style={{ fontSize: 11, color: MUTED }}>TOTAL DEBITS</div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>GHS {fmt(totals.totalDebits)}</div>
        </Card>
        <Card style={{ padding: 12, flex: "0 0 180px" }}>
          <div style={{ fontSize: 11, color: MUTED }}>TOTAL CREDITS</div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>GHS {fmt(totals.totalCredits)}</div>
        </Card>
        <Card style={{ padding: 12, flex: "1 1 220px" }}>
          <div style={{ fontSize: 11, color: MUTED }}>ACCOUNTS TOUCHED</div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{totals.accountsTouched}</div>
        </Card>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <Button onClick={() => setFilter("all")} variant={filter === "all" ? undefined : "ghost"}>All time</Button>
          <Button onClick={() => setFilter("today")} variant={filter === "today" ? undefined : "ghost"}>Today</Button>
          <Button onClick={() => setFilter("this_month")} variant={filter === "this_month" ? undefined : "ghost"}>This month</Button>
          <Button onClick={() => setFilter("this_year")} variant={filter === "this_year" ? undefined : "ghost"}>This year</Button>
          <Button onClick={() => setFilter("last_30")} variant={filter === "last_30" ? undefined : "ghost"}>Last 30 days</Button>
          <select style={{ marginLeft: 8 }} value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
            <option value="none">Group by: None</option>
            <option value="project">Project</option>
            <option value="account">Account</option>
          </select>
          <Button onClick={exportPdf} icon={Plus}>Export PDF</Button>
        </div>
      </div>
      <Card>
        <TableScroll>
          <table
            className="table-card"
            style={{ width: "100%", borderCollapse: "collapse" }}
          >
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
              {data.journal.slice(0, 20).map((e) => (
                <tr
                  key={e.id}
                  className="row-hover"
                  style={{ cursor: "pointer" }}
                  onClick={() => setViewingEntry(e)}
                >
                  <Td mono label="Entry">
                    {e.entryNumber}
                  </Td>
                  <Td label="Date">{e.date}</Td>
                  <Td label="Description">
                    {e.description || <span style={{ color: MUTED }}>—</span>}
                  </Td>
                  <Td label="Project">
                    {projectName(data.projects, e.project)}
                  </Td>
                  <Td right mono label="Amount">
                    GHS {fmt(e.lines.reduce((s, l) => s + l.debit, 0))}
                  </Td>
                </tr>
              ))}
              {data.journal.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ color: MUTED, padding: 10 }}>
                    No entries posted yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableScroll>
      </Card>

      {showModal && (
        <Modal
          title="New journal entry"
          sub="Debits and credits must match before it can post."
          onClose={() => setShowModal(false)}
          wide
        >
          <JournalEntryForm
            data={data}
            mutate={mutate}
            onDone={() => setShowModal(false)}
          />
        </Modal>
      )}

      {viewingEntry && (
        <Modal
          title={`Entry Details: ${viewingEntry.entryNumber}`}
          sub={`${viewingEntry.date} — ${
            viewingEntry.description || "No description"
          }`}
          onClose={() => setViewingEntry(null)}
          wide
        >
          <div style={{ marginBottom: 16 }}>
            <strong>Project:</strong>{" "}
            {projectName(data.projects, viewingEntry.project)}
          </div>
          <TableScroll>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <Th>Account</Th>
                  <Th right>Debit (GHS)</Th>
                  <Th right>Credit (GHS)</Th>
                </tr>
              </thead>
              <tbody>
                {viewingEntry.lines.map((l, i) => {
                  const acc = data.accounts.find((a) => a.code === l.account);
                  return (
                    <tr key={i} className="row-hover">
                      <Td>{acc ? `${acc.code} — ${acc.name}` : l.account}</Td>
                      <Td right mono>
                        {l.debit > 0 ? fmt(l.debit) : ""}
                      </Td>
                      <Td right mono>
                        {l.credit > 0 ? fmt(l.credit) : ""}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableScroll>
        </Modal>
      )}
    </div>
  );
}

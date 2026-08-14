import React, { useState, useMemo } from "react";
import { Plus } from "lucide-react";
import {
  MUTED,
  INK,
  PAPER,
  RULE,
  GREEN,
  GREEN_DEEP,
  FONT_BODY,
  FONT_MONO,
} from "../theme/tokens";
import Card from "../components/ui/Card";
import SectionTitle from "../components/ui/SectionTitle";
import TableScroll from "../components/ui/TableScroll";
import Th from "../components/ui/Th";
import Td from "../components/ui/Td";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import { inputStyle } from "../components/ui/styles";
import { fmt, projectName } from "../utils/format";
import { PrintPageWrapper, PageHeader, Footer, finStyles } from "../documents/FinancialShared";
import JournalEntryForm from "./JournalEntryForm";

/* ---------- filter presets ---------- */

const FILTERS = [
  { key: "all", label: "All time" },
  { key: "today", label: "Today" },
  { key: "month", label: "This month" },
  { key: "year", label: "This year" },
  { key: "ytd", label: "Year to date" },
  { key: "30d", label: "Last 30 days" },
  { key: "custom", label: "Custom range" },
];

function inRange(dateStr, range, customStart, customEnd) {
  if (range === "all") return true;
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();

  if (range === "today") {
    return dateStr === now.toISOString().slice(0, 10);
  }
  if (range === "month") {
    return (
      dateStr.slice(0, 7) ===
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    );
  }
  if (range === "year" || range === "ytd") {
    if (dateStr.slice(0, 4) !== String(now.getFullYear())) return false;
    if (range === "ytd" && dateStr > now.toISOString().slice(0, 10))
      return false;
    return true;
  }
  if (range === "30d") {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    return d >= cutoff;
  }
  if (range === "custom") {
    if (customStart && dateStr < customStart) return false;
    if (customEnd && dateStr > customEnd) return false;
    return true;
  }
  return true;
}

function prettyGroupKey(key, groupBy) {
  if (groupBy === "day") return key;
  if (groupBy === "month") {
    const [y, m] = key.split("-");
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${months[parseInt(m, 10) - 1] || m} ${y}`;
  }
  if (groupBy === "year") return key;
  return key;
}

export default function JournalPanel({ data, mutate, readOnly, setPrintContent }: { data: any; mutate?: any; readOnly?: boolean; setPrintContent?: (c: any) => void }) {
  const [showModal, setShowModal] = useState(false);
  const [viewingEntry, setViewingEntry] = useState(null);
  const [filter, setFilter] = useState("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [groupBy, setGroupBy] = useState("none");

  function exportPdf() {
    if (!setPrintContent) return;
    const company = data.company;
    setPrintContent(
      <>
        <PrintPageWrapper firstPage>
          <div style={finStyles.pageWrap}>
            <PageHeader title="JOURNAL" subtitle="Recent entries" company={company} />
            <div style={{ padding: "12px 32px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={finStyles.thBg}>Entry</th>
                    <th style={finStyles.thBg}>Date</th>
                    <th style={finStyles.thBg}>Description</th>
                    <th style={finStyles.thBg}>Project</th>
                    <th style={finStyles.thBg}>Amount (GHS)</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => (
                    <tr key={e.id}>
                      <td style={finStyles.td}>{e.entryNumber}</td>
                      <td style={finStyles.td}>{e.date}</td>
                      <td style={finStyles.td}>{e.description || "—"}</td>
                      <td style={finStyles.td}>{projectName(data.projects, e.project)}</td>
                      <td style={finStyles.tdR}>{fmt(e.lines.reduce((s, l) => s + (l.debit || 0), 0))}</td>
                    </tr>
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

  const filtered = useMemo(
    () =>
      (data.journal || []).filter((e) =>
        inRange(e.date, filter, customStart, customEnd)
      ),
    [data.journal, filter, customStart, customEnd]
  );

  const summary = useMemo(() => {
    const count = filtered.length;
    const totalDebits = filtered.reduce(
      (s, e) => s + e.lines.reduce((a, l) => a + (l.debit || 0), 0),
      0
    );
    const totalCredits = filtered.reduce(
      (s, e) => s + e.lines.reduce((a, l) => a + (l.credit || 0), 0),
      0
    );
    const uniqueAccounts = new Set();
    filtered.forEach((e) =>
      e.lines.forEach((l) => l.account && uniqueAccounts.add(l.account))
    );

    let first = null;
    let last = null;
    filtered.forEach((e) => {
      if (!first || e.date < first) first = e.date;
      if (!last || e.date > last) last = e.date;
    });

    return {
      count,
      totalDebits,
      totalCredits,
      uniqueAccounts: uniqueAccounts.size,
      first,
      last,
    };
  }, [filtered]);

  const groups = useMemo(() => {
    if (groupBy === "none") return null;
    const map = new Map();
    filtered.forEach((e) => {
      let key;
      if (groupBy === "day") key = e.date;
      else if (groupBy === "month") key = e.date.slice(0, 7);
      else if (groupBy === "year") key = e.date.slice(0, 4);
      else return;

      if (!map.has(key))
        map.set(key, { key, entries: [], total: 0, debits: 0, credits: 0 });
      const g = map.get(key);
      g.entries.push(e);
      g.debits += e.lines.reduce((a, l) => a + (l.debit || 0), 0);
      g.credits += e.lines.reduce((a, l) => a + (l.credit || 0), 0);
      g.total += e.lines.reduce((a, l) => a + (l.debit || 0), 0);
    });
    return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key));
  }, [filtered, groupBy]);

  const pillStyle = (active) => ({
    padding: "7px 12px",
    borderRadius: 8,
    border: `1px solid ${active ? GREEN : RULE}`,
    background: active
      ? "linear-gradient(135deg, var(--green), var(--green-deep))"
      : "rgba(148, 163, 184, 0.04)",
    color: active ? "#FFFFFF" : INK,
    cursor: "pointer",
    fontSize: 12.5,
    fontFamily: FONT_BODY,
    fontWeight: active ? 700 : 600,
    boxShadow: active ? "0 0 0 1px rgba(76, 175, 80, 0.18)" : "none",
    transition: "all 0.2s ease",
  });

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

      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <Card style={{ flex: "1 1 160px", padding: 14 }}>
          <div
            style={{
              fontSize: 11,
              color: MUTED,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Entries
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              fontFamily: FONT_MONO,
              color: INK,
              marginTop: 4,
            }}
          >
            {summary.count}
          </div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
            {summary.first && summary.last
              ? `${summary.first} → ${summary.last}`
              : "—"}
          </div>
        </Card>

        <Card style={{ flex: "1 1 180px", padding: 14 }}>
          <div
            style={{
              fontSize: 11,
              color: MUTED,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Total Debits
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              fontFamily: FONT_MONO,
              color: INK,
              marginTop: 4,
            }}
          >
            GHS {fmt(summary.totalDebits)}
          </div>
        </Card>

        <Card style={{ flex: "1 1 180px", padding: 14 }}>
          <div
            style={{
              fontSize: 11,
              color: MUTED,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Total Credits
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              fontFamily: FONT_MONO,
              color: INK,
              marginTop: 4,
            }}
          >
            GHS {fmt(summary.totalCredits)}
          </div>
        </Card>

        <Card style={{ flex: "1 1 160px", padding: 14 }}>
          <div
            style={{
              fontSize: 11,
              color: MUTED,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Accounts Touched
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              fontFamily: FONT_MONO,
              color: INK,
              marginTop: 4,
            }}
          >
            {summary.uniqueAccounts}
          </div>
          <div
            style={{
              fontSize: 11,
              color:
                Math.abs(summary.totalDebits - summary.totalCredits) < 0.01
                  ? GREEN
                  : MUTED,
              marginTop: 4,
            }}
          >
            {Math.abs(summary.totalDebits - summary.totalCredits) < 0.01
              ? "Balanced"
              : `Dr − Cr = GHS ${fmt(
                  Math.abs(summary.totalDebits - summary.totalCredits)
                )}`}
          </div>
        </Card>
      </div>

      <Card style={{ padding: 12, marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={pillStyle(filter === f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filter === "custom" && (
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
              }}
            >
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                style={{ ...inputStyle, fontSize: 12 }}
              />
              <span style={{ color: MUTED, fontSize: 12 }}>to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                style={{ ...inputStyle, fontSize: 12 }}
              />
            </div>
          )}

          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 12, color: MUTED }}>Group by:</span>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              style={{
                ...inputStyle,
                fontSize: 12,
                width: 120,
                background: "#101826",
                borderColor: "rgba(148, 163, 184, 0.5)",
                color: "#E5E7EB",
                appearance: "none",
                WebkitAppearance: "none",
                MozAppearance: "none",
              }}
            >
              <option value="none" style={{ background: "#101826", color: "#E5E7EB" }}>None</option>
              <option value="day" style={{ background: "#101826", color: "#E5E7EB" }}>Day</option>
              <option value="month" style={{ background: "#101826", color: "#E5E7EB" }}>Month</option>
              <option value="year" style={{ background: "#101826", color: "#E5E7EB" }}>Year</option>
            </select>
            <button
              type="button"
              onClick={exportPdf}
              style={{
                border: "none",
                background: GREEN,
                color: PAPER,
                padding: "8px 12px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 2px 10px rgba(34, 197, 94, 0.22)",
                fontFamily: FONT_BODY,
              }}
            >
              Export
            </button>
          </div>
        </div>
      </Card>

      <SectionTitle>Recent entries</SectionTitle>
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
              {filtered.slice(0, 50).map((e) => (
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
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ color: MUTED, padding: 10 }}>
                    No entries match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableScroll>
        {filtered.length > 50 && (
          <div
            style={{
              padding: "8px 12px",
              fontSize: 12,
              color: MUTED,
              fontFamily: FONT_BODY,
            }}
          >
            Showing 50 of {filtered.length} entries. Refine your filter to see more.
          </div>
        )}
      </Card>

      {groups && (
        <div style={{ marginTop: 16 }}>
          <SectionTitle>
            Breakdown by{" "}
            {groupBy === "day"
              ? "day"
              : groupBy === "month"
              ? "month"
              : "year"}
          </SectionTitle>
          <Card>
            <TableScroll>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <Th>
                      {groupBy === "day"
                        ? "Date"
                        : groupBy === "month"
                        ? "Month"
                        : "Year"}
                    </Th>
                    <Th right>Entries</Th>
                    <Th right>Debits</Th>
                    <Th right>Credits</Th>
                    <Th right>Total</Th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <tr key={g.key} className="row-hover">
                      <Td mono>{prettyGroupKey(g.key, groupBy)}</Td>
                      <Td right mono>{g.entries.length}</Td>
                      <Td right mono>GHS {fmt(g.debits)}</Td>
                      <Td right mono>GHS {fmt(g.credits)}</Td>
                      <Td right mono>GHS {fmt(g.total)}</Td>
                    </tr>
                  ))}
                  {groups.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ color: MUTED, padding: 10 }}>
                        Nothing to group.
                      </td>
                    </tr>
                  )}
                </tbody>
                {groups.length > 0 && (
                  <tfoot>
                    <tr
                      style={{
                        borderTop: `1px solid ${RULE}`,
                        fontWeight: 700,
                      }}
                    >
                      <Td>
                        <strong>Total</strong>
                      </Td>
                      <Td right mono>
                        {groups.reduce((s, g) => s + g.entries.length, 0)}
                      </Td>
                      <Td right mono>
                        GHS {fmt(groups.reduce((s, g) => s + g.debits, 0))}
                      </Td>
                      <Td right mono>
                        GHS {fmt(groups.reduce((s, g) => s + g.credits, 0))}
                      </Td>
                      <Td right mono>
                        GHS {fmt(groups.reduce((s, g) => s + g.total, 0))}
                      </Td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </TableScroll>
          </Card>
        </div>
      )}

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

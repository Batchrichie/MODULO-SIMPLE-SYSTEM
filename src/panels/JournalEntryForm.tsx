import React, { useState, useMemo } from "react";
import { Plus, Search, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { MUTED, INK, GREEN, RULE } from "../theme/tokens";
import Card from "../components/ui/Card";
import SectionTitle from "../components/ui/SectionTitle";
import TableScroll from "../components/ui/TableScroll";
import Th from "../components/ui/Th";
import Td from "../components/ui/Td";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import { inputStyle } from "../components/ui/styles";
import { fmt, projectName } from "../utils/format";
import JournalEntryForm from "./JournalEntryForm";

const PAGE_SIZE = 25;

const DATE_PRESETS = [
  { key: "all", label: "All time" },
  { key: "today", label: "Today" },
  { key: "month", label: "This month" },
  { key: "year", label: "This year" },
  { key: "ytd", label: "Year to date" },
  { key: "last30", label: "Last 30 days" },
  { key: "custom", label: "Custom range" },
];

function entryAmount(e) {
  return e.lines.reduce((s, l) => s + l.debit, 0);
}

function isInRange(dateStr, preset, customStart, customEnd) {
  if (preset === "all") return true;
  if (!dateStr) return false;

  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case "today":
      return d.getTime() === today.getTime();
    case "month":
      return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
    case "year":
      return d.getFullYear() === today.getFullYear();
    case "ytd":
      return d.getFullYear() === today.getFullYear() && d.getTime() <= today.getTime();
    case "last30": {
      const cutoff = new Date(today);
      cutoff.setDate(cutoff.getDate() - 30);
      return d.getTime() >= cutoff.getTime() && d.getTime() <= today.getTime();
    }
    case "custom": {
      if (!customStart && !customEnd) return true;
      const startOk = customStart ? dateStr >= customStart : true;
      const endOk = customEnd ? dateStr <= customEnd : true;
      return startOk && endOk;
    }
    default:
      return true;
  }
}

function matchesSearch(e, accountsByCode, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  if (String(e.entryNumber).toLowerCase().includes(q)) return true;
  if ((e.description || "").toLowerCase().includes(q)) return true;
  return e.lines.some((l) => {
    const acc = accountsByCode[l.account];
    const label = acc ? `${acc.code} ${acc.name}` : l.account;
    return String(label).toLowerCase().includes(q);
  });
}

export default function JournalPanel({ data, mutate, readOnly }: { data: any; mutate?: any; readOnly?: boolean }) {
  const [showModal, setShowModal] = useState(false);
  const [viewingEntry, setViewingEntry] = useState(null);

  const [search, setSearch] = useState("");
  const [datePreset, setDatePreset] = useState("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [groupBy, setGroupBy] = useState("none");
  const [sortField, setSortField] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const accountsByCode = useMemo(() => {
    const map = {};
    (data.accounts || []).forEach((a) => { map[a.code] = a; });
    return map;
  }, [data.accounts]);

  const filtered = useMemo(() => {
    let rows = (data.journal || []).filter(
      (e) =>
        isInRange(e.date, datePreset, customStart, customEnd) &&
        matchesSearch(e, accountsByCode, search) &&
        (projectFilter === "all" || String(e.project) === String(projectFilter))
    );

    rows = rows.slice().sort((a, b) => {
      let av, bv;
      switch (sortField) {
        case "entryNumber":
          av = a.entryNumber;
          bv = b.entryNumber;
          break;
        case "amount":
          av = entryAmount(a);
          bv = entryAmount(b);
          break;
        case "description":
          av = (a.description || "").toLowerCase();
          bv = (b.description || "").toLowerCase();
          break;
        case "project":
          av = projectName(data.projects, a.project).toLowerCase();
          bv = projectName(data.projects, b.project).toLowerCase();
          break;
        case "date":
        default:
          av = a.date;
          bv = b.date;
          break;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return rows;
  }, [
    data.journal,
    data.projects,
    accountsByCode,
    search,
    datePreset,
    customStart,
    customEnd,
    projectFilter,
    sortField,
    sortDir,
  ]);

  const stats = useMemo(() => {
    let debits = 0;
    let credits = 0;
    const accountsTouched = new Set();
    filtered.forEach((e) => {
      e.lines.forEach((l) => {
        debits += l.debit || 0;
        credits += l.credit || 0;
        if (l.debit || l.credit) accountsTouched.add(l.account);
      });
    });
    return {
      count: filtered.length,
      debits,
      credits,
      accountsTouched: accountsTouched.size,
      balanced: Math.abs(debits - credits) < 0.005,
    };
  }, [filtered]);

  const grouped = useMemo(() => {
    if (groupBy === "none") return [{ key: null, label: null, rows: filtered }];
    const map = new Map();
    filtered.forEach((e) => {
      let key, label;
      if (groupBy === "project") {
        key = e.project || "none";
        label = projectName(data.projects, e.project) || "No project";
      } else if (groupBy === "month") {
        key = (e.date || "").slice(0, 7);
        label = key
          ? new Date(key + "-01T00:00:00").toLocaleDateString(undefined, { month: "long", year: "numeric" })
          : "Unknown date";
      } else {
        key = "all";
        label = "All entries";
      }
      if (!map.has(key)) map.set(key, { key, label, rows: [] });
      map.get(key).rows.push(e);
    });
    return Array.from(map.values());
  }, [filtered, groupBy, data.projects]);

  const visibleRows = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  function toggleSort(field) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "date" ? "desc" : "asc");
    }
  }

  function SortIcon({ field }) {
    if (sortField !== field) return <ArrowUpDown size={12} style={{ opacity: 0.35, marginLeft: 4 }} />;
    return sortDir === "asc" ? (
      <ArrowUp size={12} style={{ marginLeft: 4 }} />
    ) : (
      <ArrowDown size={12} style={{ marginLeft: 4 }} />
    );
  }

  function resetFilters() {
    setSearch("");
    setDatePreset("all");
    setCustomStart("");
    setCustomEnd("");
    setProjectFilter("all");
    setGroupBy("none");
    setVisibleCount(PAGE_SIZE);
  }

  return (
    <div>
      <SectionTitle
        sub={
          readOnly
            ? "Read-only view. Contact your accountant to post entries."
            : "Debits and credits must match before an entry can post."
        }
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

      {/* Summary */}
      <div className="grid-fin" style={{ marginBottom: 20 }}>
        <Card>
          <div style={{ fontSize: 10.5, color: MUTED, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6 }}>
            Entries
          </div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.count}</div>
        </Card>
        <Card>
          <div style={{ fontSize: 10.5, color: MUTED, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6 }}>
            Total debits
          </div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>GHS {fmt(stats.debits)}</div>
        </Card>
        <Card>
          <div style={{ fontSize: 10.5, color: MUTED, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6 }}>
            Total credits
          </div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>GHS {fmt(stats.credits)}</div>
        </Card>
        <Card>
          <div style={{ fontSize: 10.5, color: MUTED, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6 }}>
            Accounts touched
          </div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.accountsTouched}</div>
          <div style={{ fontSize: 11, color: stats.balanced ? GREEN : "#A63D40", marginTop: 4, fontWeight: 600 }}>
            {stats.balanced ? "Balanced" : "Out of balance"}
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {DATE_PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => {
                setDatePreset(p.key);
                setVisibleCount(PAGE_SIZE);
              }}
              style={{
                padding: "7px 14px",
                borderRadius: 20,
                border: `1px solid ${datePreset === p.key ? GREEN : RULE}`,
                background: datePreset === p.key ? GREEN : "transparent",
                color: datePreset === p.key ? "#fff" : INK,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {datePreset === "custom" && (
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <div>
              <label style={{ fontSize: 11, color: MUTED, display: "block", marginBottom: 4 }}>From</label>
              <input
                type="date"
                style={inputStyle}
                value={customStart}
                onChange={(e) => {
                  setCustomStart(e.target.value);
                  setVisibleCount(PAGE_SIZE);
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: MUTED, display: "block", marginBottom: 4 }}>To</label>
              <input
                type="date"
                style={inputStyle}
                value={customEnd}
                onChange={(e) => {
                  setCustomEnd(e.target.value);
                  setVisibleCount(PAGE_SIZE);
                }}
              />
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ position: "relative", flex: "1 1 260px", minWidth: 220 }}>
            <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: MUTED }} />
            <input
              placeholder="Search entry #, description, or account…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              style={{ ...inputStyle, width: "100%", paddingLeft: 34, boxSizing: "border-box" }}
            />
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {data.projects?.length > 0 && (
              <div>
                <label style={{ fontSize: 11, color: MUTED, display: "block", marginBottom: 4 }}>Project</label>
                <select
                  value={projectFilter}
                  onChange={(e) => {
                    setProjectFilter(e.target.value);
                    setVisibleCount(PAGE_SIZE);
                  }}
                  style={{ ...inputStyle }}
                >
                  <option value="all">All projects</option>
                  {data.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label style={{ fontSize: 11, color: MUTED, display: "block", marginBottom: 4 }}>Group by</label>
              <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} style={{ ...inputStyle }}>
                <option value="none">None</option>
                <option value="project">Project</option>
                <option value="month">Month</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "transparent", display: "block", marginBottom: 4 }}>_</label>
              <Button variant="ghost" onClick={resetFilters}>
                Reset
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <SectionTitle>Recent entries</SectionTitle>
      {grouped.map((g) => (
        <Card key={g.key ?? "flat"} style={{ marginBottom: 16 }}>
          {g.label && (
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: INK }}>
              {g.label} <span style={{ color: MUTED, fontWeight: 400 }}>({g.rows.length})</span>
            </div>
          )}
          <TableScroll>
            <table className="table-card" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <Th onClick={() => toggleSort("entryNumber")} style={{ cursor: "pointer" }}>
                    <span style={{ display: "flex", alignItems: "center" }}>
                      Entry <SortIcon field="entryNumber" />
                    </span>
                  </Th>
                  <Th onClick={() => toggleSort("date")} style={{ cursor: "pointer" }}>
                    <span style={{ display: "flex", alignItems: "center" }}>
                      Date <SortIcon field="date" />
                    </span>
                  </Th>
                  <Th onClick={() => toggleSort("description")} style={{ cursor: "pointer" }}>
                    <span style={{ display: "flex", alignItems: "center" }}>
                      Description <SortIcon field="description" />
                    </span>
                  </Th>
                  <Th onClick={() => toggleSort("project")} style={{ cursor: "pointer" }}>
                    <span style={{ display: "flex", alignItems: "center" }}>
                      Project <SortIcon field="project" />
                    </span>
                  </Th>
                  <Th right onClick={() => toggleSort("amount")} style={{ cursor: "pointer" }}>
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                      Amount <SortIcon field="amount" />
                    </span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {(groupBy === "none" ? visibleRows : g.rows).map((e) => (
                  <tr key={e.id} className="row-hover" style={{ cursor: "pointer" }} onClick={() => setViewingEntry(e)}>
                    <Td mono label="Entry">
                      {e.entryNumber}
                    </Td>
                    <Td label="Date">{e.date}</Td>
                    <Td label="Description">{e.description || <span style={{ color: MUTED }}>—</span>}</Td>
                    <Td label="Project">{projectName(data.projects, e.project)}</Td>
                    <Td right mono label="Amount">
                      GHS {fmt(entryAmount(e))}
                    </Td>
                  </tr>
                ))}
                {(groupBy === "none" ? visibleRows.length : g.rows.length) === 0 && (
                  <tr>
                    <td colSpan={5} style={{ color: MUTED, padding: 14 }}>
                      No entries match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableScroll>
        </Card>
      ))}

      {groupBy === "none" && filtered.length > visibleRows.length && (
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <Button variant="ghost" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
            Show more ({filtered.length - visibleRows.length} remaining)
          </Button>
        </div>
      )}

      {showModal && (
        <Modal
          title="New journal entry"
          sub="Debits and credits must match before it can post."
          onClose={() => setShowModal(false)}
          wide
        >
          <JournalEntryForm data={data} mutate={mutate} onDone={() => setShowModal(false)} />
        </Modal>
      )}

      {viewingEntry && (
        <Modal
          title={`Entry Details: ${viewingEntry.entryNumber}`}
          sub={`${viewingEntry.date} — ${viewingEntry.description || "No description"}`}
          onClose={() => setViewingEntry(null)}
          wide
        >
          <div style={{ marginBottom: 16 }}>
            <strong>Project:</strong> {projectName(data.projects, viewingEntry.project)}
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
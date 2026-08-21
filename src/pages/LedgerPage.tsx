import React, { useState, useEffect, useMemo, useCallback } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, Printer, RefreshCw, AlertTriangle, BookOpen } from "lucide-react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { getAccountLedger, type LedgerRow } from "../supabaseClient";
import {
  INK, PAPER, RULE, GREEN, ALERT, MUTED, FONT_BODY, FONT_MONO,
} from "../theme/tokens";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import SectionTitle from "../components/ui/SectionTitle";
import TableScroll from "../components/ui/TableScroll";
import Th from "../components/ui/Th";
import Td from "../components/ui/Td";
import { inputStyle } from "../components/ui/styles";
import { fmt, projectName } from "../utils/format";
import AccountLedgerDocument from "../documents/AccountLedgerDocument";
import type { Account, AppData } from "../types";

export interface LedgerPageProps {
  data: AppData;
  setTab: (tab: string) => void;
  setPrintContent?: (content: ReactNode) => void;
}

type PeriodPreset = "all" | "month" | "year" | "custom";

const PERIOD_PRESETS: { key: PeriodPreset; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "month", label: "This month" },
  { key: "year", label: "This year" },
  { key: "custom", label: "Custom range" },
];

function parseAccountCode(pathname: string): string | null {
  const match = pathname.match(/^\/ledger\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function yearStartIso() {
  return `${new Date().getFullYear()}-01-01`;
}

function detectPreset(from: string, to: string): PeriodPreset {
  if (!from && !to) return "all";
  if (from === monthStartIso() && (!to || to === todayIso())) return "month";
  if (from === yearStartIso() && (!to || to === todayIso())) return "year";
  return "custom";
}

function datesForPreset(preset: PeriodPreset): { from: string; to: string } {
  if (preset === "all") return { from: "", to: "" };
  if (preset === "month") return { from: monthStartIso(), to: todayIso() };
  if (preset === "year") return { from: yearStartIso(), to: todayIso() };
  return { from: "", to: "" };
}

function formatBalance(balance: number, normal?: string | null, isPaymentAbnormal?: boolean) {
  const signed = Math.abs(balance);
  if (signed < 0.005) return { text: "—", color: INK };
  const side = balance >= 0
    ? (normal === "Debit" ? "Dr" : "Cr")
    : (normal === "Debit" ? "Cr" : "Dr");
  const color = isPaymentAbnormal || balance < 0 ? ALERT : INK;
  return { text: `${side} ${fmt(signed)}`, color };
}

function periodLabel(from: string, to: string) {
  if (!from && !to) return "All time";
  if (from && to) return `${from} to ${to}`;
  if (from) return `From ${from}`;
  return `To ${to}`;
}

function pillStyle(active: boolean): React.CSSProperties {
  return {
    padding: "7px 12px",
    borderRadius: 8,
    border: `1px solid ${active ? GREEN : RULE}`,
    background: active
      ? "linear-gradient(135deg, var(--green), var(--green-deep))"
      : "rgba(148, 163, 184, 0.04)",
    color: active ? PAPER : INK,
    cursor: "pointer",
    fontSize: 12.5,
    fontFamily: FONT_BODY,
    fontWeight: active ? 700 : 600,
    boxShadow: active ? "0 0 0 1px rgba(76, 175, 80, 0.18)" : "none",
    transition: "all 0.2s ease",
  };
}

function ReversedBadge() {
  return (
    <span style={{
      marginLeft: 8, fontSize: 9, fontWeight: 700, textTransform: "uppercase",
      letterSpacing: 0.5, padding: "2px 6px", borderRadius: 4,
      background: "var(--alert-bg)", color: ALERT, verticalAlign: "middle",
    }}>
      Reversed
    </span>
  );
}

function LedgerSummary({
  account,
  summary,
  loading,
}: {
  account: Account | null;
  summary: {
    count: number;
    totalDebit: number;
    totalCredit: number;
    balance: number | null;
    firstDate: string | null;
    lastDate: string | null;
  };
  loading: boolean;
}) {
  if (!account) return null;

  const isPaymentAbnormal = Boolean(account.isPaymentAccount) && (summary.balance ?? 0) < 0;
  const balanceFmt = summary.balance !== null ? formatBalance(summary.balance, account.normal, isPaymentAbnormal) : null;

  const cards = [
    {
      label: "Transactions",
      value: loading ? "—" : String(summary.count),
      sub: summary.firstDate && summary.lastDate ? `${summary.firstDate} → ${summary.lastDate}` : "No activity",
      mono: false,
    },
    {
      label: "Total Debits",
      value: loading ? "—" : `GHS ${fmt(summary.totalDebit)}`,
      sub: "Period movement",
      mono: true,
    },
    {
      label: "Total Credits",
      value: loading ? "—" : `GHS ${fmt(summary.totalCredit)}`,
      sub: "Period movement",
      mono: true,
    },
    {
      label: "Closing Balance",
      value: loading || !balanceFmt ? "—" : balanceFmt.text,
      sub: isPaymentAbnormal ? "Below zero — review" : `${account.normal} normal`,
      mono: true,
      color: balanceFmt?.color ?? INK,
    },
  ];

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
      {cards.map((c) => (
        <Card key={c.label} style={{ flex: "1 1 160px", padding: 14 }}>
          <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>{c.label}</div>
          <div style={{
            fontSize: c.mono ? 20 : 24,
            fontWeight: 700,
            fontFamily: c.mono ? FONT_MONO : FONT_BODY,
            color: c.color ?? INK,
            marginTop: 4,
          }}>
            {c.value}
          </div>
          <div style={{ fontSize: 11, color: c.sub.includes("review") ? ALERT : MUTED, marginTop: 4 }}>{c.sub}</div>
        </Card>
      ))}
    </div>
  );
}

function LedgerRowComponent({
  row,
  projects,
  accountNormal,
  onViewEntry,
}: {
  row: LedgerRow;
  projects: AppData["projects"];
  accountNormal?: string | null;
  onViewEntry?: (entryId: string) => void;
}) {
  const isOpening = row.is_opening_balance;
  const isReversed = row.reversed;
  const isReversal = !!row.reversal_of;

  const description = isReversal && row.reversal_of
    ? `Reversal of ${row.reversal_of}`
    : (row.description || "—");

  const balanceFmt = formatBalance(row.running_balance, accountNormal);

  const rowStyle: React.CSSProperties = isOpening
    ? { background: "rgba(47,82,51,0.04)", borderTop: `1px solid ${RULE}`, borderBottom: `1px solid ${RULE}` }
    : isReversed
      ? { background: "rgba(166, 61, 64, 0.03)" }
      : {};

  return (
    <tr style={rowStyle} className={isOpening ? undefined : "row-hover"}>
      <Td
        mono
        label="Date"
        style={{
          fontSize: 12,
          color: isOpening ? "var(--green)" : INK,
          fontWeight: isOpening ? 600 : 400,
          fontStyle: isOpening ? "italic" : "normal",
        }}
      >
        {isOpening ? "Opening Balance" : row.entry_date}
      </Td>
      <Td mono label="Entry #">
        {row.entry_number && row.entry_id ? (
          <button
            type="button"
            onClick={() => onViewEntry?.(row.entry_id!)}
            style={{
              background: "none", border: "none", padding: 0, cursor: "pointer",
              color: "var(--green)", fontWeight: 500, fontFamily: FONT_MONO, fontSize: "inherit",
              textDecoration: "underline", textUnderlineOffset: "3px",
            }}
          >
            {row.entry_number}
          </button>
        ) : (
          <span style={{ color: MUTED }}>—</span>
        )}
      </Td>
      <Td
        label="Description"
        style={{ color: isReversed ? MUTED : INK, textDecoration: isReversed ? "line-through" : "none" }}
      >
        {description}
        {isReversed && <ReversedBadge />}
      </Td>
      <Td label="Project" style={{ fontSize: 12, color: MUTED }}>
        {row.project ? projectName(projects, row.project) : "—"}
      </Td>
      <Td
        right mono label="Debit"
        style={{ color: isReversed ? MUTED : INK, textDecoration: isReversed ? "line-through" : "none" }}
      >
        {!isOpening && row.debit > 0 ? fmt(row.debit) : "—"}
      </Td>
      <Td
        right mono label="Credit"
        style={{ color: isReversed ? MUTED : INK, textDecoration: isReversed ? "line-through" : "none" }}
      >
        {!isOpening && row.credit > 0 ? fmt(row.credit) : "—"}
      </Td>
      <Td
        right mono bold label="Running Balance"
        style={{
          fontSize: 13,
          color: isOpening ? "var(--green)" : balanceFmt.color,
          fontWeight: isOpening ? 700 : 600,
          fontStyle: isOpening ? "italic" : "normal",
        }}
      >
        {balanceFmt.text === "—" ? "—" : balanceFmt.text}
      </Td>
    </tr>
  );
}

export default function LedgerPage({ data, setTab, setPrintContent }: LedgerPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const accountCode = useMemo(() => parseAccountCode(location.pathname), [location.pathname]);
  const fromDate = searchParams.get("from") ?? "";
  const toDate = searchParams.get("to") ?? "";
  const [customMode, setCustomMode] = useState(() => detectPreset(fromDate, toDate) === "custom");
  const periodPreset: PeriodPreset = customMode ? "custom" : detectPreset(fromDate, toDate);

  const account = useMemo(
    () => (accountCode ? data.accounts.find((a) => a.code === accountCode) ?? null : null),
    [data.accounts, accountCode],
  );

  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activityRows = useMemo(
    () => rows.filter((r) => !r.is_opening_balance),
    [rows],
  );

  const summary = useMemo(() => {
    const dates = activityRows.map((r) => r.entry_date).filter(Boolean);
    return {
      count: activityRows.length,
      totalDebit: activityRows.reduce((s, r) => s + Number(r.debit || 0), 0),
      totalCredit: activityRows.reduce((s, r) => s + Number(r.credit || 0), 0),
      balance: rows.length > 0 ? rows[rows.length - 1].running_balance : null,
      firstDate: dates.length > 0 ? dates[0] : null,
      lastDate: dates.length > 0 ? dates[dates.length - 1] : null,
    };
  }, [rows, activityRows]);

  useEffect(() => {
    if (!accountCode) {
      setError("No account code in URL.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function fetchLedger() {
      setLoading(true);
      setError(null);
      try {
        const ledgerRows = await getAccountLedger(accountCode, fromDate || null, toDate || null);
        if (!cancelled) setRows(ledgerRows);
      } catch (err) {
        if (!cancelled) {
          setRows([]);
          setError(err instanceof Error ? err.message : "Failed to load ledger.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchLedger();
    return () => { cancelled = true; };
  }, [accountCode, fromDate, toDate]);

  const updateDates = useCallback((from: string, to: string) => {
    const next = new URLSearchParams(searchParams);
    if (from) next.set("from", from); else next.delete("from");
    if (to) next.set("to", to); else next.delete("to");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  function handlePreset(preset: PeriodPreset) {
    if (preset === "custom") {
      setCustomMode(true);
      return;
    }
    setCustomMode(false);
    const { from, to } = datesForPreset(preset);
    updateDates(from, to);
  }

  function handleBack() {
    setTab("ledger");
    navigate("/");
  }

  function handleViewEntry(entryId: string) {
    if (!data.journal.find((e) => e.id === entryId)) return;
    setTab("journal");
    navigate("/", { state: { openJournalEntry: entryId } });
  }

  function handlePrint() {
    if (!setPrintContent || !account) return;
    const genDate = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    setPrintContent(
      <AccountLedgerDocument
        company={data.company}
        genDate={genDate}
        accountCode={account.code}
        accountName={account.name}
        accountType={account.type}
        periodLabel={periodLabel(fromDate, toDate)}
        rows={rows}
        totalDebit={summary.totalDebit}
        totalCredit={summary.totalCredit}
        closingBalance={summary.balance}
      />,
    );
  }

  const hasFilters = Boolean(fromDate || toDate);
  const isEmpty = !loading && rows.length === 0;
  const unknownAccount = accountCode && !account && !loading && !error;

  return (
    <div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } .spin-icon { animation: spin 1s linear infinite; }`}</style>

      <SectionTitle
        sub={account
          ? `${account.type} · ${account.normal} normal · ${periodLabel(fromDate, toDate)}`
          : "Posted journal lines with running balance."}
        action={(
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={handleBack}>
              Trial Balance
            </Button>
            {setPrintContent && account && rows.length > 0 && (
              <Button variant="primary" size="sm" icon={Printer} onClick={handlePrint} disabled={loading}>
                Print
              </Button>
            )}
          </div>
        )}
      >
        {account ? `${account.code} · ${account.name}` : "Account Ledger"}
      </SectionTitle>

      <LedgerSummary account={account} summary={summary} loading={loading} />

      <Card style={{ padding: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {PERIOD_PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => handlePreset(p.key)}
                style={pillStyle(periodPreset === p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
          {periodPreset === "custom" && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input type="date" value={fromDate} onChange={(e) => updateDates(e.target.value, toDate)} style={{ ...inputStyle, fontSize: 12, width: "auto" }} />
              <span style={{ color: MUTED, fontSize: 12 }}>to</span>
              <input type="date" value={toDate} onChange={(e) => updateDates(fromDate, e.target.value)} style={{ ...inputStyle, fontSize: 12, width: "auto" }} />
            </div>
          )}
          {hasFilters && periodPreset !== "all" && (
            <button type="button" onClick={() => { setCustomMode(false); updateDates("", ""); }} style={{ ...pillStyle(false), marginLeft: "auto" }}>
              Clear filters
            </button>
          )}
        </div>
      </Card>

      {error && (
        <Card style={{ marginBottom: 18, padding: "14px 18px", background: "var(--alert-bg)", border: `1px solid ${ALERT}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: ALERT, fontSize: 14 }}>
            <AlertTriangle size={16} />
            {error}
          </div>
        </Card>
      )}

      {unknownAccount && !error && (
        <Card style={{ marginBottom: 18, padding: "14px 18px", background: "var(--alert-bg)", border: `1px solid ${ALERT}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: ALERT, fontSize: 14 }}>
            <AlertTriangle size={16} />
            Account {accountCode} was not found in your chart of accounts.
          </div>
        </Card>
      )}

      {loading && (
        <Card style={{ padding: "32px 20px", textAlign: "center", color: MUTED, fontSize: 14 }}>
          <RefreshCw size={18} className="spin-icon" style={{ marginBottom: 10 }} />
          <div>Loading ledger entries…</div>
        </Card>
      )}

      {isEmpty && !error && !loading && (
        <Card style={{ padding: "48px 24px", textAlign: "center" }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, margin: "0 auto 14px",
            background: "rgba(47,82,51,0.06)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <BookOpen size={22} color="var(--green)" />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: INK, marginBottom: 6 }}>
            {hasFilters ? "No transactions in this period" : "No activity yet"}
          </div>
          <div style={{ fontSize: 13, color: MUTED, maxWidth: 360, margin: "0 auto" }}>
            {hasFilters
              ? "Try a wider date range or switch to All time to see the full account history."
              : "Journal entries posted to this account will appear here with a running balance."}
          </div>
        </Card>
      )}

      {!isEmpty && !error && !loading && (
        <Card>
          <TableScroll>
            <table className="table-card" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Entry #</Th>
                  <Th>Description</Th>
                  <Th>Project</Th>
                  <Th right>Debit</Th>
                  <Th right>Credit</Th>
                  <Th right>Running Balance</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <LedgerRowComponent
                    key={row.entry_id ?? `opening-${idx}`}
                    row={row}
                    projects={data.projects}
                    accountNormal={account?.normal}
                    onViewEntry={handleViewEntry}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "var(--paper)", borderTop: `2px solid ${RULE}` }}>
                  <td colSpan={4} style={{ padding: "14px 16px", fontWeight: 700, fontFamily: FONT_BODY, color: INK }}>Period totals</td>
                  <Td right mono bold label="Debit">{fmt(summary.totalDebit)}</Td>
                  <Td right mono bold label="Credit">{fmt(summary.totalCredit)}</Td>
                  <Td right mono bold label="Running Balance">
                    {summary.balance !== null ? formatBalance(summary.balance, account?.normal).text : "—"}
                  </Td>
                </tr>
              </tfoot>
            </table>
          </TableScroll>
        </Card>
      )}
    </div>
  );
}

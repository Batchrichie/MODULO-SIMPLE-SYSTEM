import React, { useState, useMemo } from "react";
import { CalendarDays, Lock, Unlock, AlertTriangle } from "lucide-react";
import {
  INK, PAPER, PAPER_RAISED, RULE, GREEN, GREEN_DEEP,
  ALERT, MUTED, GOLD, FONT_DISPLAY, FONT_BODY,
} from "../theme/tokens";
import Card from "../components/ui/Card";
import SectionTitle from "../components/ui/SectionTitle";
import TableScroll from "../components/ui/TableScroll";
import Th from "../components/ui/Th";
import Td from "../components/ui/Td";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import { inputStyle, labelStyle } from "../components/ui/styles";
import {
  closeAccountingPeriodRpc,
  reopenAccountingPeriodRpc,
  getAccountingPeriods,
} from "../supabaseClient";
import type { AccountingPeriod, AppData, MutateFn } from "../types";

interface PeriodsPanelProps {
  data: AppData;
  mutate: MutateFn;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function statusPill(status: string): React.ReactNode {
  const s = String(status).toLowerCase();
  if (s === "open") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "3px 10px",
          borderRadius: 999,
          background: "var(--success-bg)",
          color: GREEN_DEEP,
          fontWeight: 700,
          fontSize: 11,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          border: `1px solid ${GREEN}33`,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: GREEN_DEEP,
          }}
        />
        OPEN
      </span>
    );
  }
  if (s === "closed") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "3px 10px",
          borderRadius: 999,
          background: "var(--alert-bg)",
          color: ALERT,
          fontWeight: 700,
          fontSize: 11,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          border: `1px solid ${ALERT}33`,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: ALERT,
          }}
        />
        CLOSED
      </span>
    );
  }
  if (s === "future") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "3px 10px",
          borderRadius: 999,
          background: GOLD ? `${GOLD}22` : "rgba(212,175,55,0.14)",
          color: GOLD || "#A8761A",
          fontWeight: 700,
          fontSize: 11,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          border: `1px solid ${GOLD || "#A8761A"}44`,
        }}
      >
        FUTURE
      </span>
    );
  }
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 10px",
        borderRadius: 999,
        background: "rgba(107,98,85,0.10)",
        color: MUTED,
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: 0.6,
        textTransform: "uppercase",
        border: `1px solid ${RULE}`,
      }}
    >
      NOT OPEN
    </span>
  );
}

function translatePeriodRpcError(err: unknown, period: AccountingPeriod): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const low = msg.toLowerCase();
  const name = period.name || period.period || "This period";

  if (low.includes("already closed") || low.includes("period is closed")) {
    return `${name} is already closed.`;
  }
  if (low.includes("already open")) {
    return `${name} is already open and cannot be reopened.`;
  }
  if (
    low.includes("permission") ||
    low.includes("unauthorized") ||
    low.includes("not authorized") ||
    low.includes("forbidden") ||
    low.includes("42501")
  ) {
    return "You do not have permission to modify accounting periods. Contact an administrator.";
  }
  if (
    low.includes("could not be found") ||
    low.includes("does not exist") ||
    low.includes("not found")
  ) {
    return "The accounting period could not be found. Refresh the page.";
  }
  if (low.includes("reason")) {
    return "A reason is required to reopen a closed period.";
  }
  return "The accounting period could not be updated at this time. Contact your administrator.";
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

export default function PeriodsPanel({ data, mutate }: PeriodsPanelProps) {
  const [closePeriod, setClosePeriod] = useState<AccountingPeriod | null>(null);
  const [reopenPeriod, setReopenPeriod] = useState<AccountingPeriod | null>(null);
  const [closeReason, setCloseReason] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [jeCounts] = useState(() => new Map<string, number>());

  // Compute JE counts per period (optional column, derived from AppData.journal)
  const jeCountByPeriodId = useMemo(() => {
    const m = new Map<string, number>();
    const journal = data.journal || [];
    const periods = data.accountingPeriods || [];
    if (periods.length === 0 || journal.length === 0) return m;
    for (const je of journal) {
      const d = je.date?.slice(0, 10);
      if (!d) continue;
      for (const p of periods) {
        const s = p.start_date?.slice(0, 10);
        const e = p.end_date?.slice(0, 10);
        if (s && e && d >= s && d <= e) {
          m.set(p.id, (m.get(p.id) || 0) + 1);
          break;
        }
      }
    }
    return m;
  }, [data.journal, data.accountingPeriods]);

  // Group periods by financial_year (descending — latest FY first)
  const grouped = useMemo(() => {
    const periods = data.accountingPeriods || [];
    const byFy = new Map<string | number, AccountingPeriod[]>();
    for (const p of periods) {
      const fy = p.financial_year;
      const key = typeof fy === "number" ? fy : String(fy || "Unknown");
      if (!byFy.has(key)) byFy.set(key, []);
      byFy.get(key)!.push(p);
    }
    // Sort each FY's periods by month ascending
    for (const arr of byFy.values()) {
      arr.sort((a, b) => a.month - b.month);
    }
    // Sort FY keys descending (numeric first, then string)
    const keys = Array.from(byFy.keys()).sort((a, b) => {
      const an = typeof a === "number" ? a : NaN;
      const bn = typeof b === "number" ? b : NaN;
      if (!Number.isNaN(an) && !Number.isNaN(bn)) return bn - an;
      return String(a).localeCompare(String(b));
    });
    return keys.map((fy) => ({
      fy,
      periods: byFy.get(fy)!,
      hasCurrent: byFy.get(fy)!.some((p) => p.is_current),
    }));
  }, [data.accountingPeriods]);

  async function refreshPeriods() {
    const fresh = await getAccountingPeriods();
    mutate((prev) => ({ ...prev, accountingPeriods: fresh }));
  }

  /* -- Close flow -- */

  function openClose(p: AccountingPeriod) {
    setClosePeriod(p);
    setCloseReason("");
  }

  async function confirmClose() {
    if (!closePeriod || submitting) return;
    setSubmitting(true);
    try {
      await closeAccountingPeriodRpc({
        periodId: closePeriod.id,
        reason: closeReason.trim() || null,
      });
      await refreshPeriods();
      window.alert(`${closePeriod.name || closePeriod.period} has been closed successfully.`);
      setClosePeriod(null);
      setCloseReason("");
    } catch (err) {
      console.error("[PeriodsPanel] closeAccountingPeriodRpc error:", err);
      const userMsg = translatePeriodRpcError(err, closePeriod);
      window.alert(userMsg);
    } finally {
      setSubmitting(false);
    }
  }

  /* -- Reopen flow -- */

  function openReopen(p: AccountingPeriod) {
    setReopenPeriod(p);
    setReopenReason("");
  }

  async function confirmReopen() {
    if (!reopenPeriod || submitting) return;
    const reason = reopenReason.trim();
    if (!reason) return;
    setSubmitting(true);
    try {
      await reopenAccountingPeriodRpc({
        periodId: reopenPeriod.id,
        reason,
      });
      await refreshPeriods();
      window.alert(`${reopenPeriod.name || reopenPeriod.period} has been reopened successfully.`);
      setReopenPeriod(null);
      setReopenReason("");
    } catch (err) {
      console.error("[PeriodsPanel] reopenAccountingPeriodRpc error:", err);
      const userMsg = translatePeriodRpcError(err, reopenPeriod);
      window.alert(userMsg);
    } finally {
      setSubmitting(false);
    }
  }

  /* -- Render -- */

  if ((data.accountingPeriods || []).length === 0) {
    return (
      <div>
        <SectionTitle
          sub="Financial year → period calendar; view OPEN / CLOSED / FUTURE status and close or reopen accounting periods."
        >
          Accounting Periods
        </SectionTitle>
        <Card
          style={{
            textAlign: "center",
            padding: "48px 24px",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "rgba(107,98,85,0.10)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <CalendarDays size={26} color={MUTED as string} />
          </div>
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              fontSize: 16,
              color: INK,
              marginBottom: 8,
            }}
          >
            No accounting periods found
          </div>
          <div style={{ fontSize: 13, color: MUTED, maxWidth: 520, margin: "0 auto" }}>
            Contact an administrator to create accounting periods in the database.
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <SectionTitle
        sub="Financial year → period calendar; view OPEN / CLOSED / FUTURE status and close or reopen accounting periods."
      >
        Accounting Periods
      </SectionTitle>

      {grouped.map((g) => (
        <div key={String(g.fy)} style={{ marginBottom: 22 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 10,
              marginBottom: 10,
              paddingLeft: 4,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: MUTED,
                textTransform: "uppercase",
                letterSpacing: 0.8,
              }}
            >
              Financial Year
            </div>
            <div
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 700,
                fontSize: 17,
                color: INK,
              }}
            >
              {g.fy}
            </div>
            {g.hasCurrent && (
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                  color: GREEN_DEEP,
                  background: "var(--success-bg)",
                  padding: "2px 8px",
                  borderRadius: 6,
                  border: `1px solid ${GREEN}33`,
                }}
              >
                Current
              </span>
            )}
          </div>
          <Card>
            <TableScroll>
              <table
                className="table-card"
                style={{ width: "100%", borderCollapse: "collapse" }}
              >
                <thead>
                  <tr>
                    <Th>Period</Th>
                    <Th>Start Date</Th>
                    <Th>End Date</Th>
                    <Th>Status</Th>
                    <Th>Current</Th>
                    <Th>FY</Th>
                    <Th>Journal Entries</Th>
                    <Th>Closed By</Th>
                    <Th right>Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {g.periods.map((p) => {
                    const status = String(p.status).toLowerCase();
                    const isOpen = status === "open";
                    const isClosed = status === "closed";
                    const showActions = isOpen || isClosed;
                    return (
                      <tr key={p.id} className="row-hover">
                        <Td label="Period" style={{ fontWeight: 600 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <CalendarDays size={14} color={MUTED as string} />
                            <div>
                              <div style={{ color: INK }}>{p.name}</div>
                              <div
                                style={{
                                  fontSize: 11,
                                  color: MUTED,
                                  fontFamily: "ui-monospace, monospace",
                                  marginTop: 1,
                                }}
                              >
                                {p.period}
                              </div>
                            </div>
                          </div>
                        </Td>
                        <Td label="Start Date" style={{ fontFamily: FONT_BODY, color: MUTED }}>
                          {p.start_date?.slice(0, 10) || "—"}
                        </Td>
                        <Td label="End Date" style={{ fontFamily: FONT_BODY, color: MUTED }}>
                          {p.end_date?.slice(0, 10) || "—"}
                        </Td>
                        <Td label="Status">{statusPill(p.status)}</Td>
                        <Td label="Current">
                          {p.is_current ? (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                fontSize: 11,
                                fontWeight: 700,
                                color: GREEN_DEEP,
                                background: "var(--success-bg)",
                                padding: "2px 8px",
                                borderRadius: 6,
                              }}
                            >
                              YES
                            </span>
                          ) : (
                            <span style={{ fontSize: 12, color: MUTED }}>—</span>
                          )}
                        </Td>
                        <Td label="FY" style={{ color: MUTED }}>
                          {String(p.financial_year)}
                        </Td>
                        <Td label="Journal Entries" style={{ color: MUTED }}>
                          {jeCountByPeriodId.get(p.id) ?? 0}
                        </Td>
                        <Td label="Closed By" style={{ color: MUTED, fontSize: 12 }}>
                          {p.closed_at
                            ? (
                              <div>
                                <div>{p.closed_by || "Unknown"}</div>
                                <div style={{ fontSize: 10.5, opacity: 0.75 }}>
                                  {p.closed_at.slice(0, 10)}
                                </div>
                              </div>
                            )
                            : "—"}
                        </Td>
                        <Td right label="Actions">
                          {showActions && (
                            <div
                              style={{
                                display: "flex",
                                gap: 6,
                                justifyContent: "flex-end",
                                flexWrap: "wrap",
                              }}
                            >
                              {isOpen && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  icon={Lock}
                                  onClick={() => openClose(p)}
                                >
                                  Close Period
                                </Button>
                              )}
                              {isClosed && (
                                <Button
                                  size="sm"
                                  variant="danger"
                                  icon={Unlock}
                                  onClick={() => openReopen(p)}
                                >
                                  Reopen
                                </Button>
                              )}
                            </div>
                          )}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableScroll>
          </Card>
        </div>
      ))}

      {/* ── Close Period Modal ── */}
      {closePeriod && (
        <Modal
          title={`Close ${closePeriod.name || closePeriod.period}?`}
          sub={
            closePeriod.start_date && closePeriod.end_date
              ? `${closePeriod.start_date.slice(0, 10)} to ${closePeriod.end_date.slice(0, 10)}`
              : undefined
          }
          onClose={() => !submitting && setClosePeriod(null)}
        >
          <div style={{ display: "grid", gap: 14 }}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: 12,
                borderRadius: 10,
                background: "var(--alert-bg, #F6E8E8)",
                border: `1px solid ${ALERT}44`,
              }}
            >
              <AlertTriangle
                size={18}
                color={ALERT as string}
                style={{ flexShrink: 0, marginTop: 1 }}
              />
              <div style={{ fontSize: 13, color: INK, lineHeight: 1.55 }}>
                You are about to close{" "}
                <b>{closePeriod.name || closePeriod.period}</b>. Transactions dated within this
                period will no longer be posted until the period is reopened.
              </div>
            </div>

            <div>
              <label style={labelStyle}>
                Reason <span style={{ color: MUTED, fontWeight: 400 }}>(optional)</span>
              </label>
              <textarea
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
                rows={3}
                placeholder="Why are you closing this period? (optional)"
                style={{
                  ...inputStyle,
                  resize: "vertical",
                  minHeight: 72,
                  fontFamily: FONT_BODY,
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
              }}
            >
              <Button
                variant="ghost"
                onClick={() => setClosePeriod(null)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={confirmClose}
                icon={Lock}
                disabled={submitting}
              >
                {submitting ? "Closing…" : "Confirm Close"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Reopen Period Modal ── */}
      {reopenPeriod && (
        <Modal
          title={`Reopen ${reopenPeriod.name || reopenPeriod.period}?`}
          onClose={() => !submitting && setReopenPeriod(null)}
        >
          <div style={{ display: "grid", gap: 14 }}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: 12,
                borderRadius: 10,
                background: "var(--alert-bg, #F6E8E8)",
                border: `1px solid ${ALERT}44`,
              }}
            >
              <Unlock
                size={18}
                color={ALERT as string}
                style={{ flexShrink: 0, marginTop: 1 }}
              />
              <div style={{ fontSize: 13, color: INK, lineHeight: 1.55 }}>
                You are about to reopen a closed accounting period. Posting to this period will
                be allowed again.
              </div>
            </div>

            <div>
              <label style={labelStyle}>
                Reason <span style={{ color: ALERT }}>* required</span>
              </label>
              <textarea
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                rows={3}
                placeholder="Why are you reopening this period?"
                style={{
                  ...inputStyle,
                  resize: "vertical",
                  minHeight: 72,
                  fontFamily: FONT_BODY,
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
              }}
            >
              <Button
                variant="ghost"
                onClick={() => setReopenPeriod(null)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={confirmReopen}
                icon={Unlock}
                disabled={submitting || !reopenReason.trim()}
              >
                {submitting ? "Reopening…" : "Confirm Reopen"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

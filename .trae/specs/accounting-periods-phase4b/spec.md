# MODULO-SIMPLE-SYSTEM — Accounting Periods Frontend (Phase 4 Part B) — Product Requirements Document

## Overview
- **Summary**: Frontend wiring for the Accounting Periods subsystem. Deliverables include: (a) a dedicated Accounting Periods management page accessible through the existing nav, (b) atomic Close Period / Reopen Period actions that route exclusively through `close_accounting_period()` and `reopen_accounting_period()` RPCs (no direct table writes), (c) UX help on posting screens (JournalEntryForm, NewInvoiceForm, BillsPanel, ExpensesPanel, RecordPaymentForm) that warns users when the chosen date lands in a CLOSED period, (d) pre-load of `accounting_periods` rows into AppData so any panel can look up a period by date or by id without hitting the DB twice.
- **Purpose**: Give the accountant a single, obvious view of the period calendar (FY → months → OPEN/CLOSED/FUTURE), allow authorized close/reopen with confirmation, and block the most common user error (posting to a closed month by accident). Backend remains the authority for period enforcement.
- **Target Users**: Admin/accountant (permission token `all`) views + executes close/reopen. CEO (permission token `ceo:access`) views the calendar if existing policy permits, but never sees close/reopen controls. Non-admin portal users never see the page at all.

## Goals
- G1: Admin can view all accounting periods grouped by their Financial Year, with each period's status (OPEN / CLOSED / FUTURE / NOT OPEN) and period metadata from the database, no hardcoded months.
- G2: Admin can close an OPEN period via an explicit confirmation dialog → RPC `close_accounting_period()` → success notification → refreshed status and actions, with no direct `accounting_periods` table write.
- G3: Admin can reopen a CLOSED period via confirmation dialog + required reason → RPC `reopen_accounting_period()` → success notification → refreshed status and actions, with no direct table write.
- G4: Backend errors from the RPCs are surfaced as accounting-friendly messages (not raw Postgres), covering already-closed, permission, not-found, missing-reason, etc.
- G5: Posting screens (JournalEntryForm, NewInvoiceForm, BillsPanel bill creation + bill payment, ExpensesPanel new expense, RecordPaymentForm invoice payment) show a non-blocking UX warning when the chosen date maps to a CLOSED period. Backend enforcement remains authoritative and must still block the write.
- G6: Post-page-refresh status correctness — all period status comes from a fresh backend fetch; the UI never "remembers" a close/reopen result after F5.
- G7: Posting screens and LedgerPage filter hooks are prepared to consume `accounting_periods.id` as the canonical period identifier (not `journal_entries.period`) while keeping the legacy text field in place for a later migration.

## Non-Goals
(Explicitly not built in this phase. Per task requirements #15-26.)
- NG1: Automatic year-end closing, automatic monthly closing, automatic reopening.
- NG2: Complex multi-step close-check workflows (pre-close report, pre-close validation wizard, retained earnings closing, year-end journals).
- NG3: Financial statement locking beyond the period-level post-block that the backend already enforces.
- NG4: Period deletion, financial year deletion.
- NG5: New permission tokens for period management without explicit sign-off. Close/reopen are gated exclusively on the existing `all` (Admin) token for this phase. CEO is view-only if `ceo_hidden_keys` policy allows the Setup group.
- NG6: Population of contract values, estimated costs, JE creation, revenue posting, invoice/bill/payroll modification, bypassing of existing backend posting functions (out of scope for this PRD by task #18, #21).
- NG7: Ledger page UI redesign (task #23 — only prepare the data hook, do not redesign Ledger).

## Background & Context
- **Backend Phase 4 completed and verified.** Database objects available for frontend use:
  - `public.accounting_periods` table: id (uuid/pk), period (e.g. "2026-01"), year (int), month (int 1-12), name ("Jan 2026"), start_date, end_date, status text enum ('open'|'closed'|'future'|'not_open'), is_current boolean, financial_year text/int, closed_at timestamptz, closed_by uuid, close_reason text, reopen_reason text, updated_at, created_at, and whatever additional columns the backend places on the row.
  - `public.vw_accounting_periods` (view, optional fallback if direct SELECT is needed).
  - `public.close_accounting_period(p_period_id, p_reason?)` RPC: returns the period row or throws; enforces authorization, row lock, status transition, audit.
  - `public.reopen_accounting_period(p_period_id, p_reason)` RPC: requires reason, returns row or throws; same guards.
- **Current frontend state (Phase 4 Part B start):** No `accounting_period` reference anywhere in the frontend (0 grep matches for `accounting_period`, `period_id`, `AccountingPeriod`). Period filtering in LedgerPage uses text-based `period.slice(0,7)` / ytd / mtd / custom date ranges; `journal_entries.period` column (YYYY-MM text) is currently the only period identifier shown on posting screens.
- **Existing design system:** `src/components/ui/*` (`Button`, `Card`, `Modal`, `SectionTitle`, `Notifications`, `MiniTable`, `Td`, `Th`, styles.ts) + tokens.ts (`INK`, `MUTED`, `RULE`, `SUCCESS`, `ALERT`, `WARN`, `FONT_MONO`, etc.). New period page MUST use these primitives (task #17 — no new visual language).
- **Navigation architecture:** Single `NAV_CONFIG[]` source in `src/lib/permissions.ts`. Groups: Overview / Operations / Setup / Portal / Account. Accounting Periods belongs in the Setup group alongside Chart of Accounts and Export.
- **Permissions:** Token `all` = Admin sees Setup group items by default. Token `ceo:access` = Setup items are stripped by `CEO_HIDDEN_KEYS` already, so Accounting Periods (Setup group, token `all`) is invisible to CEO automatically without new permissions (task #24). Non-admin portal never gets Setup group.
- **AppData pattern:** `src/types.ts` `AppData` interface + `src/App.tsx` centralized data load. Periods will be added to AppData as `accountingPeriods: AccountingPeriod[]` so every panel sees a consistent list.

## Functional Requirements
- **FR-1 (Navigation):** Add `accounting-periods` nav key to NAV_CONFIG Setup group, token `all`, label "Accounting Periods", existing lucide icon (Calendar / CalendarDays). Import the matching PeriodsPanel component in App.tsx, add a `case "accounting-periods"` panel switch case alongside other Setup pages.
- **FR-2 (Data model):** Define `AccountingPeriod` interface in `types.ts` matching `public.accounting_periods` columns. Also add `accountingPeriods: AccountingPeriod[]` to AppData interface. Add a supabaseClient helper `getAccountingPeriods()` that performs a SELECT (either from the view or table) ordered by year, month. Add optional wrappers `closeAccountingPeriodRpc({periodId, reason?})` and `reopenAccountingPeriodRpc({periodId, reason})` to call the respective RPCs.
- **FR-3 (AppData load):** In `App.tsx` central `loadAll()`/initial load sequence, after profile load and before ledger state load, call `getAccountingPeriods()` for ALL users only (skip for non-Admin/non-CEO since they cannot see the page and do not post). Mutate into `data.accountingPeriods`. The exact sequence position: follow same constraints as existing App.tsx load order rules (loadTaxConfig and auth before loadLedgerState) — period load is independent of ledger state so it can run in a parallel Promise.
- **FR-4 (Periods Panel structure):** `src/panels/PeriodsPanel.tsx` displays periods as an FY hierarchy. For every distinct `financial_year` in `accountingPeriods`, render a section titled "Financial Year — {year}". Inside each FY, list periods in month order as rows (no hardcoded months, only rows actually present in `data.accountingPeriods` filtered to that FY). Use `MiniTable` or equivalent existing table primitive. Period row columns at minimum: Period (name, e.g. "Jan 2026"), Start Date, End Date, Status, Current Period, Financial Year. Optional columns ONLY if backend exposes them: Number of journal entries (sum of JE counts), Last activity (max updated_at / closed_at), Closed by, Closed date. Do not manufacture these columns.
- **FR-5 (Status display — task #17):** Status is rendered as a coloured pill using existing tokens.ts colours:
  - OPEN → green pill (`SUCCESS` colour + light green bg, same style as other status chips seen in Ledger/Journal panels). Text: OPEN.
  - CLOSED → red pill. Text: CLOSED.
  - FUTURE / NOT_OPEN → neutral grey or muted amber pill. Text: FUTURE if status === 'future' else NOT OPEN.
  Style classes MUST come from existing `styles.ts` chips or from the existing small rounded border + fontWeight pattern used by other status chips — no custom CSS framework.
- **FR-6 (Close action — task #18):** For each OPEN period row, render one primary button "Close Period" (disabled / hidden for non-Admin — see FR-11). Click opens the existing `Modal` with:
  - Title: `Close {period.name}?`
  - Body: "You are about to close {period.name} ({period.start_date} to {period.end_date}). Transactions dated within this period will no longer be posted until the period is reopened."
  - Optional reason text field (textarea, required only if the backend enforces it — per spec: "If the system requires a reason, collect it". A client-side required indicator is applied if the UI opts-in; backend errors surface the "reason required" message per FR-8).
  - Buttons: Cancel (secondary) / Confirm Close (primary, disabled until any required fields have content).
  - On confirm: call `closeAccountingPeriodRpc({periodId: period.id, reason})`.
- **FR-7 (Reopen action — task #19):** For each CLOSED period row, render one secondary button "Reopen Period" (hidden for non-Admin). Click opens a Modal with:
  - Title: `Reopen {period.name}?`
  - Body: "You are about to reopen a closed accounting period. Posting to this period will be allowed again."
  - Reason textarea: **always required** for reopen (task #19 explicit: require reason). Confirm button disabled until reason text is non-empty trimmed.
  - Buttons: Cancel / Confirm Reopen (primary danger style or secondary — match existing destructive actions in the app).
  - On confirm: call `reopenAccountingPeriodRpc({periodId: period.id, reason})`.
- **FR-8 (Error presentation — task #20):** RPC promise rejection → translate the thrown Postgres error message or SQLSTATE / hint to a human accounting message. Translation rules (map `error.message` substring case-insensitively to user text; fallback to "The accounting period could not be updated at this time. Contact your administrator."):
  - "already closed" / "period is closed" → `"{period.name} is already closed."`
  - "already open" → `"{period.name} is already open and cannot be reopened."`
  - "permission" / "unauthorized" / "not authorized" / "forbidden" → `"You do not have permission to modify accounting periods. Contact an administrator."`
  - "could not be found" / "does not exist" / "not found" → `"The accounting period could not be found. Refresh the page."`
  - "reason" (from reopen validation) → `"A reason is required to reopen a closed period."` (close reason only when backend demands it)
  - Any 42501 / RLS-related → same permission message above.
  - Never surface raw P0/Pxx/Postgres DETAIL lines to the user in production UI (log them to `console.error` with the full error for support only).
- **FR-9 (Refresh after action — task #21):** After successful RPC promise resolve:
  1. Call `mutate` (or App-level refetch helper) to refresh `data.accountingPeriods` from the database — do NOT patch the row in place, because the backend updates closed_at / closed_by / reopen_reason / updated_at columns that the UI must display accurately.
  2. Call the existing Notifications system to show a success toast. Examples: `"September 2026 has been closed successfully."` / `"September 2026 has been reopened successfully."`
  3. Close the confirmation modal.
  4. The OPEN/CLOSED pill, and the action buttons' visibility, reflect the refreshed row on screen (task #21 refresh + action-update requirement).
- **FR-10 (Period-id plumbing — task #23):** Implement in `types.ts` + supabaseClient `getAccountingPeriods()` a pure helper `findPeriodByDate(accountingPeriods: AccountingPeriod[], date: string): AccountingPeriod | null` that performs interval containment against start_date / end_date. This helper is used by FR-11 posting screens. Also ensure the `AccountingPeriod` interface exports `id`, and `JournalEntry` type still keeps its `period` text field (legacy column, not removed — task #23 dual-wire not yet migrate).
- **FR-11 (Posting screen closed-period UX aid — task #22):** For the following posting screens, whenever the user picks a date and the date matches a CLOSED accounting period (via `findPeriodByDate` + `status === 'closed'`), render a one-line warning banner directly above or below the date input using the app's existing ALERT colour + dashed-border warning banner style, with text: `"{period.name} is closed. Transactions cannot be posted to this period."`. The submit / save button is **not disabled** and the RPC remains authoritative — task #22 UX aid only, not security. Affected screens:
  - JournalEntryForm (`type="date"` input that controls JE `date` state)
  - NewInvoiceForm — two date inputs (date, due date): warn for **both** `date` and `dueDate`, each independently.
  - BillsPanel — bill creation form (date, due date): warn for both.
  - BillsPanel — bill Pay modal (payment date): warn for the payment `date`.
  - ExpensesPanel — new expense (date): warn.
  - RecordPaymentForm — invoice payment (date): warn.
  If `data.accountingPeriods` is empty (non-admin CEO/portal), or no period row contains the date, skip warning (no false negatives or errors thrown).
- **FR-12 (Unauthorized UI gating — task #24):** Close button, Reopen button, and any action that calls an RPC must be invisible when the current user lacks the `all` permission token. Read-only view of the period page is allowed if the nav item renders for the permissions set; actions simply never render. CEO is typically excluded from Setup group by `CEO_HIDDEN_KEYS` already, so they never reach it; the page-level gating inside PeriodsPanel additionally hides actions for safety.

## Non-Functional Requirements
- **NFR-1 (F5-correct):** After browser refresh, period status pills and action buttons are populated solely from the new App-level `data.accountingPeriods` (fresh backend fetch). No localStorage / in-memory-only state for status.
- **NFR-2 (No direct write):** `accounting_periods` table (and its view) is only read from the client. All state transitions route through the two RPC wrappers defined in FR-2. Grep for `.from('accounting_periods')` and `.upsert` / `.delete` / `.update` must find only SELECT-type calls or RPCs, never a mutation directly against `accounting_periods` rows.
- **NFR-3 (Build + diagnostics):** TypeScript 0 diagnostics errors. `npm run build` exit code 0. No new files introduce ESLint warnings beyond pre-existing levels.
- **NFR-4 (Design system only):** All new components use existing `components/ui/*` + tokens. No new CSS files, no new third-party icon library, no new datepicker library, no new modal component, no global injection.
- **NFR-5 (Backwards compat):** Existing behaviour of FinancialsPanel, LedgerPage, JournalPanel, ExportPanel, ReportsPanel, ProjectsPanel, InvoicingPanel, PayrollPanel is byte-identical when no project changes. Closing a period in the UI does not alter any existing JE's displayed period text. The legacy `journal_entries.period` field (YYYY-MM text) is never written or read differently during this phase.

## Constraints
- **Technical:**
  - Backend tables/RPCs delivered — frontend must not modify them; use exactly their public signatures (`close_accounting_period(p_period_id, p_reason?)`, `reopen_accounting_period(p_period_id, p_reason)`). If backend signature differs from assumption (e.g., `p_period_id` is a string period-code not uuid), the `closeAccountingPeriodRpc` wrapper is adjusted to match — panel code unchanged.
  - App.tsx load order constraints (from project_memory): `loadTaxConfig` and auth resolution before `loadLedgerState`. Periods list load must not break this invariant.
  - Supabase client call pattern must match `supabaseClient.ts` style (async wrappers, `console.error` on error, typed return, no `any` leaks into components).
  - No new runtime dependencies.
- **Business (task #26):** NO auto-close / auto-reopen / complex close wizard / retained earnings / deletion of periods or FYs. All are separate accounting-control decisions.
- **Dependencies:** Phase 4 Backend Task 4 (periods + close_accounting_period / reopen_accounting_period RPCs) is complete and verified on the current database. (Task instruction: "Only start this section after [BACKEND] passes its tests" — assumed satisfied by the user triggering this task.)
- **Role visibility:** Existing `CEO_HIDDEN_KEYS` Setup group exclusion applies. No new permission tokens created. CEO is read-only and cannot view the page by default.

## Assumptions
- A-1: `public.accounting_periods` contains at least the 12 months for the current financial year and has `start_date`, `end_date` as DATE columns, `status` as text/enum, `is_current` as boolean, `financial_year` as int/text. If any of these columns are absent or named differently, the `AccountingPeriod` interface and `getAccountingPeriods()` SELECT list are adjusted at implementation time without changing this spec.
- A-2: `close_accounting_period` accepts one positional or named parameter for period identification (either uuid `id` or string `period` text code); the wrapper function handles the correct one. Reopen RPC additionally REQUIRES `reason`. Close RPC optionally requires reason — the wrapper passes whatever the backend accepts, and the translation layer handles the "reason required" error.
- A-3: `data.journal` already loaded in AppData — if an "Number of journal entries" column is added, it is computed client-side as `data.journal.filter(je => je.date between start and end).length`; no new RPC count is introduced (keeps FR-4 contract of "display info actually available, no manufacture").
- A-4: `Notifications` component in `components/ui/Notifications.tsx` has a simple `notify.success(msg)` style interface exposed already, or via App-level callback — if it's toast-only, we use the same pattern as any other existing success notification in the app (the build step will catch any interface mismatch).
- A-5: Close Period reason requirement is ultimately enforced by the RPC. The client-side marks it required if the UI flag or the backend error pattern indicates it (task #18 conditional).

## Open Questions
(Resolved before Plan.)
- [ ] **Q1:** What is the exact function signature of `close_accounting_period` and `reopen_accounting_period`? Specifically: (a) are parameters named `p_period_id` (uuid) or `p_period` (text "2026-09") or both; (b) is `p_reason` a required param of close, or only reopen? Answered by direct inspection of RPC at implementation time or user clarification. If backend passes both signatures, the wrapper prefers the uuid id path.
- [ ] **Q2:** Does CEO role actually require read-only view of the page? The task #24 says: "Users without period-management authority should be able to view periods if the existing policy permits it". Existing policy via `CEO_HIDDEN_KEYS` strips Setup group from CEO entirely. If CEO needs read-only view, the nav item key would need to be removed from `CEO_HIDDEN_KEYS` AND the Setup group filter would need adjustment. DEFAULT in this spec is to follow existing policy (CEO does NOT see the page, consistent with the existing Setup group exclusions). If the user wants CEO read-only, it is handled as a spec change.
- [ ] **Q3:** Are `Number of journal entries / Last activity / Closed by / Closed date` actually present on the vw/table as ready-to-read columns (e.g., computed columns or stored columns) vs requiring aggregation joins? Spec default (FR-4): treat these as OPTIONAL — displayed only if the interface row exposes them without client-side joins/aggregation beyond what's trivial from AppData (A-3 for JE count).

## Acceptance Criteria

### AC-1: Period list renders from backend, grouped by Financial Year
- **Type**: `rule`
- **Given**: Backend returns a list of `accounting_periods` rows with distinct `financial_year` values (e.g., 2026) and `month` 1-12 per FY.
- **When**: The user navigates to the Accounting Periods page.
- **Then**: Every FY that appears in the returned rows renders a titled section "Financial Year — {year}". Within each FY section, period rows appear in ascending month order. No month is rendered that is not actually present in the returned period rows (no hardcoded Jan–Dec skeleton).
- **Pass Condition**: For a test database with 1 FY × 12 periods and a second FY × 1 or 2 periods, exactly that count + group structure appears. Validated by a reviewer reading the PeriodsPanel code to confirm no hardcoded month arrays.
- **Evidence**: Source code inspection of PeriodsPanel.tsx group iteration; build log clean; screenshot of the page against the real database.

### AC-2: Period metadata columns visible, correct values only from backend
- **Type**: `rule`
- **Given**: A valid `accounting_periods` row.
- **When**: Period row card or table row is rendered.
- **Then**: The following fields display (as columns or info row) with values exactly equal to the DB row: Period (name) / Start Date / End Date / Status / Current Period (is_current boolean shown as YES badge or empty) / Financial Year. Optional fields (JE count, last activity, closed by, closed date) appear IF and ONLY IF the backend data actually exposes them or they are trivially computable from AppData (see A-3). No fields show fabricated or guessed defaults.
- **Pass Condition**: For a known test period row (start_date=2026-09-01, end_date=2026-09-30, name=Sep 2026, is_current=true), the rendered page shows exactly those values.
- **Evidence**: Source code inspection confirming column values come from the period prop; screenshot diff vs known DB row.

### AC-3: Status visual distinction using existing design tokens
- **Type**: `rule`
- **Given**: Three periods with status 'open', 'closed', and 'future'/'not_open'.
- **When**: Status pills render on the three rows.
- **Then**:
  - OPEN pill uses SUCCESS colour palette (green-like) from existing tokens.
  - CLOSED pill uses ALERT / danger palette (red-like).
  - FUTURE / NOT OPEN pill uses MUTED / WARN palette or neutral grey.
  - Text labels match exactly: "OPEN" / "CLOSED" / "FUTURE" or "NOT OPEN".
- **Pass Condition**: Visual inspection plus code references to tokens in styles.ts.
- **Evidence**: Screenshot; source-code reference of the status-chip conditional code.

### AC-4: Close Period flow (confirmation + RPC only + success state)
- **Type**: `rule`
- **Given**: Admin user viewing an OPEN period row (status=OPEN, action rendered).
- **When**: The user clicks "Close Period".
- **Then**:
  1. A confirmation modal appears with the exact concept body: "You are about to close <Period>. Transactions dated within this period will no longer be posted until the period is reopened."
  2. Cancel button dismisses modal with no RPC call and no state change.
  3. Confirm button calls `closeAccountingPeriodRpc({periodId, reason?})` ONLY — no direct `.from('accounting_periods').update()` or upsert anywhere in the traceable code path.
  4. After resolved promise, `data.accountingPeriods` is refreshed from the DB (not client-side patched), success notification fires, modal closes, the pill now shows CLOSED, the Close button disappears and a Reopen button appears where applicable.
- **Pass Condition**: Grep of `.from('accounting_periods')` in frontend code shows 0 mutation calls; only the RPC wrapper calls `.rpc('close_accounting_period')`. Manual UI test: close a period, confirm pill + actions update, confirm success toast.
- **Evidence**: Code audit (`grep -n "accounting_period"` showing only SELECT / rpc calls); manual click-through result recorded in task completion evidence.

### AC-5: Reopen Period flow (confirmation + required reason + RPC only)
- **Type**: `rule`
- **Given**: Admin viewing a CLOSED period.
- **When**: The user clicks "Reopen Period".
- **Then**:
  1. Confirmation modal appears; reason textarea is present; Confirm is DISABLED when reason is empty/whitespace-only.
  2. Confirm calls `reopenAccountingPeriodRpc({periodId, reason})` ONLY — no direct table mutation.
  3. Success → refresh periods list, success notification fires, status shows OPEN + Close button back.
  4. If backend returns "reason required" (should not happen given client guard), error translation per FR-8 is shown.
- **Pass Condition**: Reason-required client guard prevents RPC call when blank; RPC grep confirms reopen route only uses `.rpc('reopen_accounting_period')`.
- **Evidence**: Unit-style UI test: click reopen with empty reason → Confirm button remains disabled; fill reason → confirm triggers RPC call. Source-code audit.

### AC-6: Backend-error translation never exposes raw Postgres to user
- **Type**: `rule`
- **Given**: Backend deliberately returns a representative error (e.g., "already closed", "permission denied", "not found", "reason required").
- **When**: User clicks confirm and the RPC promise rejects.
- **Then**: The user-facing alert / notification shows only the accounting-friendly translations from FR-8. `console.error` receives the full original error object for diagnostics. No `P0001`, DETAIL lines, or SQLSTATEs appear in the visible dialog.
- **Pass Condition**: Manually force each error (or stub mock RPC return) at implementation time; capture the shown string against the list.
- **Evidence**: Manual recorded results of the 4-5 error scenarios; source-code reference of the translation function.

### AC-7: Posting screens show closed-period UX aid for date inputs without disabling submit
- **Type**: `rule`
- **Given**: User navigates to any of the 6 posting screens (JournalEntryForm, NewInvoiceForm bill date + due, BillsPanel create + pay, ExpensesPanel, RecordPaymentForm). User selects a date whose period is CLOSED.
- **When**: Date change handler fires and `findPeriodByDate(accountingPeriods, date).status === 'closed'`.
- **Then**: An ALERT-coloured warning banner appears adjacent to the date input with the message "<Period> is closed. Transactions cannot be posted to this period." The submit/save button remains enabled (backend RPC is the authoritative guard). If the user changes the date to an OPEN-period date, the warning disappears. If accountingPeriods list is empty, no warning renders and no console error appears.
- **Pass Condition**: Manual test on two dates (Sept 2026 closed → warning shown; Oct 2026 open → warning hidden). Code audit confirms button disable prop remains unchanged.
- **Evidence**: Screenshots of each screen with both dates. Source-code audit of each form.

### AC-8: Browser refresh returns correct status from fresh backend fetch
- **Type**: `rule`
- **Given**: The user closes September 2026 on the page. Page now shows CLOSED + Reopen button.
- **When**: User presses F5.
- **Then**: After reload, the period still shows CLOSED + Reopen button. The state is sourced purely from the App-level fresh `getAccountingPeriods()` call (not from a React state persisted after the prior RPC resolve). Equivalently, reopening a period, F5 → still OPEN with Close button.
- **Pass Condition**: Two manual checks: close → F5 → still closed; reopen → F5 → still open.
- **Evidence**: Manual reproduction screenshots; App.tsx code that reloads `accountingPeriods` on every initial page load.

### AC-9: Authorized action visibility + unauthorized cannot execute close/reopen
- **Type**: `rule`
- **Given**: Two logged-in accounts: (a) Admin/accountant with token `all`, (b) CEO with `ceo:access` only, (c) portal user (no admin tokens).
- **When**: Each user views the app.
- **Then**:
  - Admin sees the Accounting Periods nav item in the Setup group; Admin sees Close / Reopen buttons on applicable rows.
  - CEO does not see the nav item (existing Setup group exclusion via `CEO_HIDDEN_KEYS`). If CEO deep-links to the route, the page either does not render or shows no action buttons.
  - Portal user: nav item absent; direct route does not expose actions.
  - Attempting to call the close/reopen RPCs manually from the DevTools console from a non-admin session MUST return the backend permission error (the frontend UI is not the security boundary), and the error presents per FR-8 translation, not as raw Postgres.
- **Pass Condition**: All three role views manually verified.
- **Evidence**: Screenshots of each view; manual DevTools console call attempt captured with the friendly translated error.

### AC-10: Period id plumbing prepared (dual-wire, legacy field preserved)
- **Type**: `rule`
- **Given**: AppData contains `accountingPeriods: AccountingPeriod[]` with `.id` fields.
- **When**: Any `findPeriodByDate(date)` call returns a period.
- **Then**: Returned object has an `.id` that uniquely identifies it, ready for future posting screens to use as `period_id`. The existing `JournalEntry.period` string field (YYYY-MM text) is NOT removed from types.ts, NOT dropped from AppData, NOT written differently — preserved untouched for a future migration (task #23 instruction).
- **Pass Condition**: `grep "period_id"` references in posting screens may still be zero after this phase; the type + helper exist and are tested against a date input.
- **Evidence**: Source code of AccountingPeriod interface + findPeriodByDate; manual test that a date returns a matching id.

### AC-11: No direct table mutations of `accounting_periods`
- **Type**: `rule`
- **Given**: Entire frontend codebase after implementation.
- **When**: Run a full-project grep for patterns that write to `accounting_periods` directly.
- **Then**:
  - 0 occurrences of `.from('accounting_periods').insert(`, `.update(`, `.delete(`, `.upsert(`, or equivalent `db.*` store wrappers that mutate the table.
  - 2 occurrences of `.rpc('close_accounting_period'` and `.rpc('reopen_accounting_period'` or more (wrapped + inline safe calls).
- **Pass Condition**: grep returns only SELECT-type calls and the RPC calls.
- **Evidence**: Captured grep output at task completion time, before final build, after implementation.

### AC-12: Zero build / TS diagnostics errors, no new deps
- **Type**: `rule`
- **Given**: Implementation complete.
- **When**: `npx tsc --noEmit` + `npm run build` both run in CI.
- **Then**: Both commands exit code 0. `package.json` has zero added dependencies compared to git baseline.
- **Pass Condition**: `GetDiagnostics` reports 0 errors. `npm run build` final exit code is 0. `git diff -- package.json package-lock.json` is empty (or contains only unrelated pre-existing changes).
- **Evidence**: Captured stdout of both commands.

### AC-13: Existing financial / operations panels remain byte-identical for no-periods scenario
- **Type**: `rubric`
- **Dimension**: Regression-free behaviour of existing panels.
- **Scale**: 1-5
- **Anchors**:
  - 1 = Major regression: posting screens or financial reports visibly broken (JS errors, blank panels, wrong numbers).
  - 3 = Minor cosmetic-only regression (no functional impact) visible to users in daily flow.
  - 5 = No observable functional or cosmetic change outside of the new Accounting Periods page and the explicitly-added closed-period UX warning banners on posting screens.
- **Pass Threshold**: >= 4
- **Evidence**: Manual smoke test run-through of Dashboard, Journal (new JE), Financials (company vs project view), NewInvoice, Bills (create + pay), Expense create, Record Payment, Bank Rec, Export, Reports. All flows produce byte-identical or visually-identical results to baseline, except for the new closed-period banner when dates hit a CLOSED period.

### AC-14: Codebase adherence to repository conventions
- **Type**: `rubric`
- **Dimension**: Consistency with the existing frontend architecture (AppData pattern, nav, panels, components, RPC wrappers).
- **Scale**: 1-5
- **Anchors**:
  - 1 = Ad-hoc: separate nav, separate global state, separate fetch pattern, custom CSS, own modal code.
  - 3 = Uses existing patterns in some spots; duplicates in others; inconsistent styling.
  - 5 = Strictly consistent: NAV_CONFIG entry + App import + case switch; AppData carries the new collection; supabaseClient.ts exports the RPC wrappers following the same style as `postJournalEntry` / `postBillPayment`; PeriodsPanel uses SectionTitle, Card, MiniTable, Td/Th from components/ui; Notifications use the existing component's interface; tokens.ts for all colours.
- **Pass Threshold**: >= 4
- **Evidence**: Source-code cross-reference between the new components and representative existing panels (e.g., AccountsPanel.tsx for admin-setup page structure; BillsPanel.tsx for Modal + confirm pattern).

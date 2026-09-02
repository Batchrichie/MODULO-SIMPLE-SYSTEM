# MODULO-SIMPLE-SYSTEM — Accounting Periods Frontend (Phase 4 Part B) — Product Requirements Document

## Overview
- **Summary**: Frontend wiring for the Accounting Periods subsystem. Deliverables include: (a) a dedicated Accounting Periods management page accessible through the existing nav, (b) atomic Close Period / Reopen Period actions that route exclusively through `close_accounting_period()` and `reopen_accounting_period()` RPCs (no direct table writes), (c) UX help on posting screens (JournalEntryForm, NewInvoiceForm, BillsPanel, ExpensesPanel, RecordPaymentForm) that warns users when the chosen date lands in a CLOSED period, (d) pre-load of `accounting_periods` rows into AppData so any panel can look up a period by date or by id without hitting the DB twice.
- **Purpose**: Give the accountant a single, obvious view of the period calendar (FY → months → OPEN/CLOSED/FUTURE), allow authorized close/reopen with confirmation, and block the most common user error (posting to a closed month by accident). Backend remains the authority for period enforcement.
- **Target Users**: Admin/accountant (permission token `all`) views + executes close/reopen. CEO (permission token `ceo:access`) does NOT see the Accounting Periods page — existing `CEO_HIDDEN_KEYS` policy removes the entire Setup group. Non-admin portal users never see the page at all.

## Goals
- G1: Admin can view all accounting periods grouped by their Financial Year, with each period's status (OPEN / CLOSED / FUTURE / NOT OPEN) and period metadata from the database, no hardcoded months.
- G2: Admin can close an OPEN period via an explicit confirmation dialog → RPC `close_accounting_period()` → success notification → refreshed status and actions, with no direct `accounting_periods` table write.
- G3: Admin can reopen a CLOSED period via confirmation dialog + required reason → RPC `reopen_accounting_period()` → success notification → refreshed status and actions, with no direct table write.
- G4: Backend errors from the RPCs are surfaced as accounting-friendly messages (not raw Postgres), covering already-closed, permission, not-found, missing-reason, etc.
- G5: Posting screens (JournalEntryForm, NewInvoiceForm, BillsPanel bill creation + bill payment, ExpensesPanel new expense, RecordPaymentForm invoice payment) show a non-blocking UX warning when the chosen date maps to a CLOSED period. Backend enforcement remains authoritative and must still block the write.
- G6: Post-page-refresh status correctness — all period status comes from a fresh backend fetch; the UI never "remembers" a close/reopen result after F5.
- G7: Posting screens and LedgerPage data hooks are prepared to consume `accounting_periods.id` as the canonical period identifier (not the legacy `journal_entries.period` text field) — but this phase only adds the data hook. NO Ledger UI or filtering changes are made in this phase; the migration away from the legacy field happens separately.

## Non-Goals
(Explicitly not built in this phase. Per task requirements #15-26.)
- NG1: Automatic year-end closing, automatic monthly closing, automatic reopening.
- NG2: Complex multi-step close-check workflows (pre-close report, pre-close validation wizard, retained earnings closing, year-end journals).
- NG3: Financial statement locking beyond the period-level post-block that the backend already enforces.
- NG4: Period deletion, financial year deletion.
- NG5: New permission tokens for period management without explicit sign-off. Close/reopen are gated exclusively on the existing `all` (Admin) token for this phase. CEO does NOT have access to the Accounting Periods page (Setup group excluded from CEO view by existing policy — see task #24 correction).
- NG6: Population of contract values, estimated costs, JE creation, revenue posting, invoice/bill/payroll modification, bypassing of existing backend posting functions (out of scope for this PRD by task #18, #21).
- NG7: Ledger page UI redesign (task #23 — only prepare the data hook, do not redesign Ledger).

## Background & Context
- **Backend Phase 4 completed and verified.** Live Supabase database state (confirmed by direct runtime probe against the production Supabase endpoint on 2026-08-23):
  - `public.accounting_periods` table **exists** (schema cache returned hint to use it instead of the non-existent view). Table is **currently empty (0 rows)** in the live DB probe — the column-level schema is therefore **not guessable from a sample row**. The frontend adapter must map DB columns to UI fields via a `normalizePeriodRow(rawRow)` function with a fallback chain (see FR-2 correction below).
  - `public.vw_accounting_periods` view **does not exist** (confirmed: `PGRST205 "Could not find the table 'public.vw_accounting_periods'"`). The spec previously referenced this view — **reference removed**. All reads come from `public.accounting_periods` directly.
  - `public.close_accounting_period(p_period_id uuid, p_reason text?)` RPC **exists with uuid id param** (probe with zero-id returned `Accounting period 00000000-0000-0000-0000-000000000000 not found` — semantic error, not schema error). Attempts to call it with `p_period_code` / `p_period` text params returned **function not found**, confirming only the uuid-id signature is exposed.
  - `public.reopen_accounting_period(p_period_id uuid, p_reason text)` RPC **exists with uuid id param + required reason** (probe returned the same not-found semantic error; wrong-param variants returned function-not-found).
- **Explicitly unsupported assumptions removed from original spec draft** after this audit:
  - ❌ There is no `vw_accounting_periods` view.
  - ❌ Column names `period`, `year`, `month`, `name`, `financial_year` were NOT verified against live data. Implementation MUST use the normalizePeriodRow adapter with fallback chains for these columns.
  - ❌ CEO visibility: previously "CEO may view the page". Corrected to match the user's task #24 verdict + existing `CEO_HIDDEN_KEYS` policy: CEO does NOT see the page.
- **Current frontend state (Phase 4 Part B start):** No `accounting_period` reference anywhere in the frontend (0 grep matches for `accounting_period`, `period_id`, `AccountingPeriod`). Period filtering in LedgerPage uses text-based `period.slice(0,7)` / ytd / mtd / custom date ranges; `journal_entries.period` column (YYYY-MM text) is currently the only period identifier shown on posting screens.
- **Existing design system:** `src/components/ui/*` (`Button`, `Card`, `Modal`, `SectionTitle`, `Notifications`, `MiniTable`, `Td`, `Th`, styles.ts) + tokens.ts (`INK`, `MUTED`, `RULE`, `SUCCESS`, `ALERT`, `WARN`, `FONT_MONO`, etc.). New period page MUST use these primitives (task #17 — no new visual language).
- **Navigation architecture:** Single `NAV_CONFIG[]` source in `src/lib/permissions.ts`. Groups: Overview / Operations / Setup / Portal / Account. Accounting Periods belongs in the Setup group alongside Chart of Accounts and Export.
- **Permissions:** Token `all` = Admin sees Setup group items by default. Token `ceo:access` = Setup items are stripped by `CEO_HIDDEN_KEYS` already, so Accounting Periods (Setup group, token `all`) is invisible to CEO automatically without new permissions (task #24). Non-admin portal never gets Setup group.
- **AppData pattern:** `src/types.ts` `AppData` interface + `src/App.tsx` centralized data load. Periods will be added to AppData as `accountingPeriods: AccountingPeriod[]` so every panel sees a consistent list.

## Functional Requirements
- **FR-1 (Navigation):** Add `accounting-periods` nav key to NAV_CONFIG Setup group, token `all`, label "Accounting Periods", existing lucide icon (Calendar / CalendarDays). Import the matching PeriodsPanel component in App.tsx, add a `case "accounting-periods"` panel switch case alongside other Setup pages.
- **FR-2 (Data model + adapter pattern — CORRECTED SPEC per live backend audit):**
  - Define `AccountingPeriod` interface in `types.ts` with the UI-side canonical field names (no database assumptions). This canonical UI record MUST have these fields so the rest of the frontend can rely on them:
    - `id: string` — the UUID primary key (used for all RPC calls).
    - `period: string` — canonical YYYY-MM text code (e.g. "2026-09").
    - `year: number` — integer year (for grouping by FY).
    - `month: number` — 1–12 integer (for sort order within FY).
    - `name: string` — display label (e.g. "Sep 2026").
    - `start_date: string` — ISO date (YYYY-MM-DD).
    - `end_date: string` — ISO date.
    - `status: string` — one of `"open" | "closed" | "future" | "not_open"` (literal values or any broader string; status pills will match case-insensitively against these keywords + fallback to NOT OPEN for unknowns).
    - `is_current: boolean` — indicates the current period.
    - `financial_year: number | string` — the FY column for grouping.
    - Optional nullable fields for audit metadata: `closed_at?: string | null`, `closed_by?: string | null` (UUID or user identifier), `close_reason?: string | null`, `reopen_reason?: string | null`, `updated_at?: string | null`, `created_at?: string | null`.
    - Add any extra columns the backend exposes as `[key: string]: unknown` index signature or optional fields so row normalization never drops data.
  - Add `accountingPeriods: AccountingPeriod[]` to AppData interface.
  - In supabaseClient.ts, add **two** adapters that guard against the unknown live DB column names (since the live table is empty and names were not verifiable from the probe):
    1. `normalizePeriodRow(raw: Record<string, unknown>): AccountingPeriod` — pure function with a fallback chain for each canonical UI field:
       - `id` → `raw.id ?? raw.period_id ?? raw.uuid ?? raw.pk`
       - `period` → `raw.period_code ?? raw.period ?? raw.period_key ?? raw.period_month`
       - `year` → `raw.year ?? raw.calendar_year ?? raw.fy_year ?? (derived: if period starts with YYYY-, slice that)`
       - `month` → `raw.month ?? raw.calendar_month ?? (derived: period.slice(-2))`
       - `name` → `raw.period_name ?? raw.name ?? raw.display_name ?? raw.label`
       - `start_date` → `raw.start_date ?? raw.start ?? raw.period_start ?? raw.from_date`
       - `end_date` → `raw.end_date ?? raw.end ?? raw.period_end ?? raw.to_date`
       - `status` → lowercased `raw.status ?? raw.period_status ?? raw.state ?? "not_open"`
       - `is_current` → `raw.is_current ?? raw.current_period ?? raw.current ?? false`
       - `financial_year` → `raw.financial_year ?? raw.financial_year_id ?? raw.fy ?? raw.year` (coerce safely to string or number)
       - Audit fields fall back on their camelCase / snake_case variants and stay null if absent.
    2. `getAccountingPeriods(): Promise<AccountingPeriod[]>` — SELECT from `public.accounting_periods` (NOT the now-confirmed-nonexistent vw_accounting_periods). Apply `.order` by any column combo we can detect, or sort client-side with `(a,b) => a.year - b.year || a.month - b.month` as a belt-and-suspenders step, since the DB sort column is unknown.
  - In supabaseClient.ts, add the now-confirmed-UUID RPC wrappers matching the exact backend signatures from probe:
    1. `closeAccountingPeriodRpc(params: { periodId: string; reason?: string | null }): Promise<AccountingPeriod | null>` — calls `supabase.rpc('close_accounting_period', { p_period_id: params.periodId, p_reason: params.reason ?? null })` and returns `normalizePeriodRow(data[0] ?? data)` if truthy.
    2. `reopenAccountingPeriodRpc(params: { periodId: string; reason: string }): Promise<AccountingPeriod | null>` — calls `supabase.rpc('reopen_accounting_period', { p_period_id: params.periodId, p_reason: params.reason })` (reason is mandatory).
  - IMPORTANT: The frontend is NOT implementing assumed column names. Any time the live schema uses different names, only `normalizePeriodRow` needs to be edited; the rest of the application is insulated.
- **FR-3 (AppData load — CORRECTED rule per user instruction #3):** In `App.tsx` central `loadAll()`/initial load sequence, after profile load and before ledger state load, call `getAccountingPeriods()` for **authenticated users who have access to financial posting screens or the Accounting Periods page**. Practically, this means: run the load for any user who has the `ALL` token OR any of the posting-related write tokens (`CEO_JOURNAL_WRITE`, `CEO_INVOICING_WRITE`, `CEO_BILLS_WRITE`, `CEO_PAYROLL_WRITE`, `CEO_EMPLOYEES_WRITE`, `CEO_PROJECTS_WRITE`, `ceo:access`) — so posting-screen warnings fire for anyone who posts to the ledger. Skip it ONLY for pure non-posting portal users (permissions limited to DASHBOARD_OPS/DASHBOARD_LIMITED/PROJECTS_VIEW/PAYROLL_SELF/PAYROLL_STATEMENT/FIELD_ACTIVITY_VIEW/LOANS_SELF/…). Mutate the result into `data.accountingPeriods`. Follow the existing App.tsx load-order constraint (loadTaxConfig and auth resolution complete before loadLedgerState). Periods list load can happen in parallel with other non-dependent fetches; it does not block ledger state load. If the backend returns an empty list (as the probe did), the list stays empty, banners show "No periods" where appropriate, and no error surfaces to the user.
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
  - Backend tables/RPCs delivered — frontend must not modify them; use exactly their public signatures as verified by runtime probe: `close_accounting_period(p_period_id uuid, p_reason text?)`, `reopen_accounting_period(p_period_id uuid, p_reason text)`. p_period_code / p_period text param variants DO NOT EXIST (function not found from probe). The RPC wrapper signatures in FR-2 therefore MUST use the uuid-id form; if backend changes later, only the wrapper is updated, panel code unchanged.
  - App.tsx load order constraints (from project_memory): `loadTaxConfig` and auth resolution before `loadLedgerState`. Periods list load must not break this invariant.
  - Supabase client call pattern must match `supabaseClient.ts` style (async wrappers, `console.error` on error, typed return, no `any` leaks into components).
  - No new runtime dependencies.
  - Live `public.accounting_periods` table is empty in the probed DB. The empty state must render gracefully ("No periods found. Contact an administrator to create accounting periods in the database.") — no null reference errors.
- **Business (task #26):** NO auto-close / auto-reopen / complex close wizard / retained earnings / deletion of periods or FYs. All are separate accounting-control decisions.
- **Dependencies:** Phase 4 Backend Task 4 (periods + close_accounting_period / reopen_accounting_period RPCs) is complete and verified on the current database. (Task instruction: "Only start this section after [BACKEND] passes its tests" — satisfied per user's message.)
- **Role visibility:** Existing `CEO_HIDDEN_KEYS` Setup group exclusion applies. No new permission tokens created. CEO does NOT have access to the Accounting Periods nav or page. Non-admin portal users have no access.

## Assumptions
- A-1: The live `accounting_periods` table will be seeded with at least 12 months before the accountant actually starts using the page. The empty-state banner is the correct presentation until the seed is done.
- A-2: `public.accounting_periods` columns contain the semantic fields that the `normalizePeriodRow` fallback chain can discover (id/period/year/month/name/start_date/end_date/status/is_current/financial_year + audit cols). If additional columns exist outside the fallback chains, `normalizePeriodRow` is extended with new fallbacks ONLY at T1 implementation time (cheap, single edit) — no broader refactor of panels required.
- A-3: `data.journal` already loaded in AppData. If a "Number of journal entries" optional column is shown, compute it from `data.journal` client-side (trivial filter between start_date/end_date). Do not add new backend count RPC.
- A-4: `Notifications` component in `components/ui/Notifications.tsx` exposes the same pattern used elsewhere; if it needs a callback from the page, the pattern used by the existing Journal save / Export success / BillsPanel save is reused, not rebuilt.
- A-5: Close RPC `p_reason` is optional in the Postgres signature (probe with reason passed → not-found semantic error, not missing-param error). If the backend later enforces it, the FR-8 error message translation for "reason required" catches it.

## Open Questions
(All resolved per live probe / user instruction #1-#4.)
- [x] **Q1 (RPC signature):** `close_accounting_period(p_period_id uuid, p_reason?)` and `reopen_accounting_period(p_period_id uuid, p_reason text required)` CONFIRMED by live probe (zero-id returned "not found"; wrong-param variants returned "function not found").
- [x] **Q2 (CEO visibility):** CEO does NOT see the Accounting Periods page (per user instruction #2 / task #24 — keep existing Setup group exclusion via CEO_HIDDEN_KEYS).
- [x] **Q3 (Optional meta columns):** Display only where trivially available (JE count from AppData.journal, other audit fields via normalizePeriodRow fallback chain). No joins/new RPCs.
- [x] **Q4 (vw_accounting_periods):** Does NOT exist (PGRST205). All reads via public.accounting_periods directly.

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

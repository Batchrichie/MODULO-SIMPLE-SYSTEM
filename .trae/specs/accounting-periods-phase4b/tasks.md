# MODULO-SIMPLE-SYSTEM — Accounting Periods Frontend (Phase 4 Part B) — Implementation Plan

Note: Task order represents the dependency graph. Do not run Task 6 (error-message smoke) before Task 3/4 are complete. Do not run Task 7 (posting screen aid banners) until the data structure Task 2 produces `findPeriodByDate`.

## Task 1: Type contract, RPC wrappers, and AccountingPeriod import plumbing
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Add `AccountingPeriod` interface to `src/types.ts`. Fields at minimum: `id`, `period` (YYYY-MM), `year`, `month`, `name` ("Jan 2026"), `start_date`, `end_date`, `status` (literal `"open" | "closed" | "future" | "not_open"` or broader `string`), `is_current`, `financial_year`, `closed_at?`, `closed_by?`, `close_reason?`, `reopen_reason?`, `updated_at?`, `created_at?`. Add any extra columns the backend exposes via optional nullable fields so we never lose data.
  - Append `accountingPeriods: AccountingPeriod[]` to `AppData` interface.
  - In `src/supabaseClient.ts`: add `AccountingPeriod` to the type import. Add three new exported functions:
    - `async function getAccountingPeriods(): Promise<AccountingPeriod[]>` — SELECT via `supabase.from('accounting_periods').select('*')` (or view vw_accounting_periods if the RPC requires it) and order by year, month. Error log → [].
    - `async function closeAccountingPeriodRpc(params: { periodId: string; reason?: string | null }): Promise<AccountingPeriod | null>` — call `supabase.rpc('close_accounting_period', {...})` with `p_period_id` (uuid) and optional `p_reason`. The parameter naming is the ONLY place adjusted if the backend signature differs (wrap in the adapter; never change the panel call site).
    - `async function reopenAccountingPeriodRpc(params: { periodId: string; reason: string }): Promise<AccountingPeriod | null>` — required reason, calls `reopen_accounting_period` RPC.
  - Export a pure helper `findPeriodByDate(periods: AccountingPeriod[], date: string | null | undefined): AccountingPeriod | null` that does interval containment using `start_date` and `end_date`. Returns null for missing input or no match.
- **Acceptance Criteria Addressed**: AC-10, AC-11, AC-12
- **Test Requirements**:
  - `rule` TR-1.1: `getAccountingPeriods` returns an array; the first row has all required fields non-null for the returned data shape. Evidence: `console.log` first row + types compile (`tsc --noEmit` 0 errors).
  - `rule` TR-1.2: For a known 2026-09-15 date, `findPeriodByDate(periods, '2026-09-15')?.period === '2026-09'`. For `null` input or `'1999-01-01'` → returns null. Evidence: quick Node script / debug output captured.
  - `rule` TR-1.3: `grep -n "\.from('accounting_periods')"` in supabaseClient.ts returns at most 1 hit (the SELECT wrapper). No `.upsert`/`.update`/`.delete`. Evidence: captured grep output.
  - `rubric` TR-1.4: RPC wrapper style consistency with postBillPayment / postBill. Dimension: wrapper code style vs existing; scale 1-5; anchors 1=different patterns, 3=mostly similar, 5=identical conventions (console.error, typed return, null fallback for error case); threshold >= 4; evidence: side-by-side code snippet diff.

## Task 2: Navigation entry + App-level data load + Panel switch in App.tsx
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - In `src/lib/permissions.ts` NAV_CONFIG, add a new Setup-group entry: `{ key: 'accounting-periods', label: 'Accounting Periods', icon: Calendar / CalendarDays, token: ALL, group: 'Setup' }`. Import Calendar icon from lucide-react. Do NOT add this key to CEO_HIDDEN_KEYS explicitly (it is already excluded because the Setup group is — but verify the existing strip behaviour: if any Setup key leaks, add 'accounting-periods' to CEO_HIDDEN_KEYS as a belt-and-suspenders fix).
  - In `src/App.tsx`:
    - Import `Calendar`-like lucide icon is NOT required by App.tsx; only import the new `PeriodsPanel` component (see Task 3) at the panel-import block.
    - Add a `case 'accounting-periods':` branch in the panel switch / panel-var logic to render PeriodsPanel with the standard props `{ data, mutate, user, profile, permissions }`.
    - Add `accountingPeriods: []` to the initial SWR fallbackData state (initial AppData shape).
    - In the central data-loading function (the `useEffect` that calls db.loadAll / loads profile / loads ledger state): run `getAccountingPeriods()` in a parallel promise, but ONLY for users that have permission to view the page or that can post to a screen where FR-11 warning is useful. Minimal guard: load for `ALL` or `ceo:access`; skip for non-admin portal users (their nav never opens posting screens in most cases, and the banner gracefully skips if list empty). If the load sequence has an existing parallel `Promise.all` bucket, add periods to that bucket so it does not extend critical path. Ensure `loadTaxConfig` and auth resolution still complete before `loadLedgerState` (App.tsx invariant from project_memory — don't break it).
  - On success of the periods list call, mutate `data.accountingPeriods` into the SWR data so all panels receive it.
- **Acceptance Criteria Addressed**: AC-8 (F5 fetch source), AC-9, AC-12
- **Test Requirements**:
  - `rule` TR-2.1: Admin (`ALL`) user session renders nav item "Accounting Periods" in the Setup group of the sidebar; clicking it does not throw a runtime error and loads PeriodsPanel. Evidence: screenshot / no console error log.
  - `rule` TR-2.2: CEO (`ceo:access`) user session does NOT see the nav item; if they deep-link by URL or local state edit, the page either hides actions or doesn't render (task #24). Evidence: screenshot of CEO nav without item, and attempted navigation outcome.
  - `rule` TR-2.3: `AppData.accountingPeriods` after successful initial load has nonzero length for Admin and 0 or expected rows for others. Evidence: `console.log(data.accountingPeriods.length)` captured after mount.
  - `rule` TR-2.4: Pressing F5 while on the page, the pill status of the latest closed/reopened period is sourced from the backend (not client-patched state). Evidence: manual reproduction captured in task completion evidence.

## Task 3: PeriodsPanel — list structure, group-by-FY, status pills, no-action buttons (read-only)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 2
- **Description**:
  - Create `src/panels/PeriodsPanel.tsx` (new file).
  - Follow the existing admin-setup panel structure (reference AccountsPanel.tsx for SectionTitle + Card + MiniTable or plain table + Td/Th pattern).
  - Header SectionTitle with sub description "Financial year → period calendar; view OPEN / CLOSED / FUTURE status and close or reopen accounting periods."
  - Group `data.accountingPeriods` by `financial_year` (descending order so latest FY first). Inside each group, sort periods by month ascending.
  - Render each FY as a separate card block titled "Financial Year — {financialYear}". If is_current has any true period in the FY, consider a "(Current)" label next to FY title (nice-to-have).
  - Render each period as a table row or a keyed list. Minimum columns: Period (name), Start Date, End Date, Status (pill), Current Period (YES badge or empty if false), Actions (blank for now; Task 4 populates).
  - Add a `<Modal>` wrapper and state placeholders for `closeModalPeriod` and `reopenModalPeriod` (set to null for now until Task 4 uses them).
  - Status pill rendering per FR-5: reusable helper function `periodStatusPill(status, isCurrent)` returning JSX with styled chip, tokens from constants or tokens/UI styles. Do NOT introduce a brand-new colour palette.
  - Optional meta columns (JEs / last activity / closed by / closed date) render only if the corresponding row field is non-null and meaningful (for JEs count: compute from `data.journal` via `je.date between row.start_date and row.end_date`; do not add new backend RPC call).
  - For a CLOSED period whose `closed_by` exists but user-profile name not in data, show "User {uuid.slice(0,8)}" only if uuid accessible; otherwise skip and show "Unknown" — never invent names.
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3, AC-12, AC-14
- **Test Requirements**:
  - `rule` TR-3.1: No hardcoded months. Evidence: PeriodsPanel.tsx has no `['Jan','Feb',...]` arrays; rendering is purely iteration of `data.accountingPeriods`. If there is a 13th period in the DB, it renders as the 13th row (no off-by-one limit).
  - `rule` TR-3.2: For known rows, start_date / end_date / status / is_current badge display exactly their values. Evidence: screenshot + DB SELECT result diff.
  - `rule` TR-3.3: OPEN / CLOSED / FUTURE pills have visually distinct colours and the text "OPEN", "CLOSED", "FUTURE" / "NOT OPEN" respectively. Evidence: screenshot; cross-reference to tokens.ts constants.
  - `rubric` TR-3.4: PeriodsPanel consistency with existing admin-setup pages (AccountsPanel, ExportPanel). Scale 1-5; anchors 1=completely different, 3=similar style but new primitives, 5=identical component set; threshold >= 4. Evidence: side-by-side screenshot of PeriodsPanel + AccountsPanel.

## Task 4: PeriodsPanel — Close/Reopen modals, RPC wiring, success refresh, error translation
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 3, Task 1
- **Description**:
  - Add action buttons per row:
    - If period.status === 'open' AND admin: render `<Button>Close Period</Button>`.
    - If period.status === 'closed' AND admin: render `<Button variant="secondary" or danger variant>Reopen Period</Button>`.
    - For future/not_open status: no action buttons (cannot close until it opens; cannot reopen because it's not closed).
    - Non-admin users: no buttons ever rendered even if row status qualifies.
  - onClick handlers set `showCloseModal = period` / `showReopenModal = period`.
  - Close modal body: "You are about to close {name} ({startDate} to {endDate}). Transactions dated within this period will no longer be posted until the period is reopened." Reason textarea present (optional on client side — allow empty; backend RPC decides whether required). Confirm Close button primary.
  - Reopen modal body: "You are about to reopen a closed accounting period. Posting to this period will be allowed again." Reason textarea REQUIRED (client-side disable-confirm until non-empty trimmed). Confirm Reopen button secondary or danger style.
  - Confirm handlers call `closeAccountingPeriodRpc` / `reopenAccountingPeriodRpc` from supabaseClient.ts.
  - Post-success flow (both actions):
    1. Re-call `getAccountingPeriods()` to REFRESH the list.
    2. Call `mutate()` / `mutate(prev => ({ ...prev, accountingPeriods: fresh }))` so the list updates immediately.
    3. Fire a success notification: `{period.name} has been closed/reopened successfully.` via the app's existing Notifications call site (mirror the pattern used elsewhere).
    4. Close the modal.
  - Error handler (FR-8): Create a module-level pure function `translatePeriodRpcError(err, period): string` that maps the 5-6 error substrings to the accounting-friendly user messages. Call `console.error` with the full error object for support. Then `window.alert` or notification.warning with the translated string. Confirm the modal remains open if an error occurs (user can fix input / reconfirm after fixing).
- **Acceptance Criteria Addressed**: AC-4, AC-5, AC-6, AC-9, AC-11
- **Test Requirements**:
  - `rule` TR-4.1: Close flow end-to-end. Evidence: open → click Close → Confirm → success toast → row CLOSED pill + Reopen button appears.
  - `rule` TR-4.2: Reopen flow with blank reason disables confirm button; after 1+ non-whitespace characters, confirm enables. Evidence: two screenshots of modal + disabled/enabled button states.
  - `rule` TR-4.3: Force-simulate permission error, already-closed error, not-found error, missing-reason error for reopen, and generic unknown error. Each shows the FR-8 translated message (no raw Postgres). `console.error` has the raw error. Evidence: for each, a captured alert/notification message + console output.
  - `rule` TR-4.4: Direct-write grep is clean. Evidence: post-Task-4 grep for `".from('accounting_periods')." in *.ts *.tsx` returns only the SELECT in getAccountingPeriods.

## Task 5: Notifications integration + status refresh verification
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 4
- **Description**:
  - This is a light-touch verification task, not a code-writing task unless the Notifications call site needs adapting.
  - Verify that Notifications component is actually wired to show the success message (if the app uses a `notificationRef`/`useNotifications` hook — use the same pattern used by JournalPanel save success or ExportPanel success). If the app currently uses `window.alert`, adapt the success messages to Notifications only where the existing app-wide pattern uses Notifications.
  - Manual double-check: close a period → reopen it → close it again. Each step the pill changes, the button set changes, the toast appears.
- **Acceptance Criteria Addressed**: AC-4, AC-5, AC-8
- **Test Requirements**:
  - `rule` TR-5.1: Three-step cycle works (close → reopen → close) with 3 distinct success toasts; 0 stale pills. Evidence: screenshots or screen recording log entries.
  - `rule` TR-5.2: After F5, state persists as expected (same 3-step cycle survives refresh). Evidence: F5 screenshot captured after step 3.

## Task 6: Error-path + edge-case manual checklist run-through
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 5
- **Description**:
  - Run the task #25 frontend testing checklist end to end where feasible from the UI (some "unauthorized cannot execute" require a second user account, the reviewer can re-verify independently):
    - Period list loads ✓ / Fails gracefully with error message if DB empty → handled by 0 rows ("No periods found") banner or empty state.
    - Financial year displays ✓.
    - All 12 periods display ✓.
    - Status correct ✓.
    - OPEN → Close button visible ✓.
    - CLOSED → Reopen button visible ✓.
    - Unauthorized user: buttons not rendered ✓ (and for manual DevTools RPC call, the backend returns permission error translated by FR-8).
    - Close confirmation works ✓; Reopen confirmation works ✓.
    - Reason is required where applicable (reopen: client-side enforced + backend).
    - Status refreshes after action ✓.
    - Backend errors display correctly ✓ (Task 4 evidence already captured).
    - Closed period prevents posting via backend RPC enforcement ✓ — already true because backend enforces it; the closed-period banner aid in Task 7 provides UX only.
    - Reopened period permits posting ✓ — same, backend is authoritative.
  - Add a PeriodsPanel inline empty-state banner if `data.accountingPeriods.length === 0`: "No accounting periods found. Contact an administrator to create accounting periods in the database."
- **Acceptance Criteria Addressed**: AC-1 through AC-9 partial coverage
- **Test Requirements**:
  - `rule` TR-6.1: Manual checklist passes for all 14 items where a single Admin session can execute; mark "unauthorized execute" items as Pending Independent Review for the Review phase. Evidence: task completion evidence with pass/fail per item.

## Task 7: Posting screens — closed-period UX aid banners
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 1 (helper exists), Task 2 (data.accountingPeriods is loaded on AppData)
- **Description**:
  - Touch each of the 6 posting-form locations below. For each date input that posts (or for due dates, additionally warn), when the date changes, compute `const p = findPeriodByDate(data.accountingPeriods, date)`. If `p && p.status === 'closed'`, render a banner below/above the input with message: `"{p.name} is closed. Transactions cannot be posted to this period."` Use the existing ALERT-coloured warning banner style (reuse the same `<div style={{ background: ... }}>` pattern that appears in BillsPanel.tsx paymentAccounts length-0 inline warning or FinancialsPanel.tsx POC not-configured banner; do NOT create a new component).
  - Banner must NOT disable the submit button — backend RPC remains authority.
  - Banner must NOT appear when `accountingPeriods` array is empty (skip silently; no undefined error).
  - Banner must NOT appear when date is empty.
  - Exact screens:
    a. `JournalEntryForm.tsx` → only `date` field.
    b. `NewInvoiceForm.tsx` → both `date` and `dueDate`.
    c. `BillsPanel.tsx` → (1) Bill create form: `date` and `dueDate`. (2) Pay Bill modal: `date`.
    d. `ExpensesPanel.tsx` → new-expense `date`.
    e. `RecordPaymentForm.tsx` → invoice payment `date`.
  - No behavioural changes to any other part of the form (validation, submit, RPCs). Submit / Save button continues to operate exactly as before. Backend RPC error for closed period is translated the same way any other posting RPC error is handled (it is usually thrown by the post RPC, not by a period check; the banner is only a proactive hint not a replacement).
- **Acceptance Criteria Addressed**: AC-7, AC-13
- **Test Requirements**:
  - `rule` TR-7.1: Each of the 6 screens shows the banner when selecting a known-closed date; the banner disappears when switching to an open date. Evidence: screenshot per screen of both states.
  - `rule` TR-7.2: Submit button is clickable even with closed-date banner shown (backend takes authoritative decision). Evidence: no disabled attribute change in any of the 6 screens; onClick of submit fires (either succeeds or shows backend RPC error message accordingly).
  - `rule` TR-7.3: Empty accountingPeriods list → no banner, no runtime error. Evidence: simulate by blanking list in devtools.
  - `rubric` TR-7.4: Regression-free posting screens for an OPEN month. Scale 1-5; anchors 1=broken, 3=minor cosmetic only, 5=no observable difference except new banner when closed period selected; threshold >= 4. Evidence: smoke-test invoice creation, expense creation, JE creation, bill create + pay, invoice payment on an open period — match baseline behaviours.

## Task 8: Final build + TS diagnostics + pre-review pass (implementer self-check)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Tasks 1–7 complete
- **Description**:
  - Run:
    1. `GetDiagnostics` for 0 TS errors.
    2. `npm run build` capture last 40 lines; exit code 0 required.
    3. Full repo grep audits (save output as evidence):
       a. `grep -R "\.from(['\"]accounting_periods['\"])" src` — must show getAccountingPeriods wrapper only.
       b. `grep -R "accounting_periods.*\.(upsert|update|insert|delete)" src` — must show 0 matches (AC-11).
       c. `grep -R "\.rpc\(['\"]close_accounting_period['\"]"` src` — exactly 1 match (the wrapper).
       d. `grep -R "\.rpc\(['\"]reopen_accounting_period['\"]"` src` — exactly 1 match (the wrapper).
       e. `git diff --name-only` to enumerate changed files for Reviewer's benefit.
  - Capture all outputs as the Task completion evidence for Review phase.
- **Acceptance Criteria Addressed**: AC-11, AC-12, AC-14
- **Test Requirements**:
  - `rule` TR-8.1: GetDiagnostics returns 0 errors. Evidence: captured tool output.
  - `rule` TR-8.2: `npm run build` exit code 0. Evidence: captured stdout showing 0 failures + exit code.
  - `rule` TR-8.3: Each of the three grep audits (a/b/c+d) passes. Evidence: captured grep outputs.
  - `rubric` TR-8.4: Overall change set follows code conventions. Scale 1-5; anchors 1=several style anomalies, 3=few, 5=no anomalies vs surrounding code; threshold >= 4.

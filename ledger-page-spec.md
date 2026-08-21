# Account Ledger Page — Implementation Spec

## Backend — DONE
Migration `add_get_account_ledger` is live on the `MODULO DEMO` project.

```sql
get_account_ledger(p_account_code text, p_start_date date DEFAULT NULL, p_end_date date DEFAULT NULL)
RETURNS TABLE(
  entry_id text, entry_number text, entry_date date, description text,
  project text, reversed boolean, reversal_of text,
  debit numeric, credit numeric, running_balance numeric, is_opening_balance boolean
)
```

Behavior:
- No dates passed → returns **all-time** ledger (matches `vw_trial_balance`, which is also all-time — TB has no date filter today, so the ledger must default the same way or the tapped number and the ledger total won't reconcile).
- Dates passed → returns a synthetic first row (`is_opening_balance = true`, `entry_id = null`) carrying the balance of everything before `p_start_date`, then the in-range lines with `running_balance` continuing from that opening figure.
- `running_balance` already accounts for the account's `normal` (Debit/Credit) side — don't re-sign it client-side.
- Not `SECURITY DEFINER` — runs as the caller, so it's already gated by the existing RLS on `journal_entries`/`journal_lines`/`accounts` (`'all'` or `'ceo:access'` permission — same as Trial Balance today). No new permission needed.
- Call it as any other Supabase RPC: `supabase.rpc('get_account_ledger', { p_account_code, p_start_date, p_end_date })`.

Tested against account `5100` (Building Materials): all-time running balance matched `vw_trial_balance.balance` exactly (32,306.00), and a date-scoped call correctly rolled prior activity into the opening balance row.

---

## Frontend — TODO

### Route
`/ledger/:accountCode` — e.g. `/ledger/5100`. Query params for optional filtering: `?from=2026-06-01&to=2026-08-31`.

### Entry point
On the Trial Balance page, wrap each account row (or just the balance cell) in a link/button:
```
onClick={() => navigate(`/ledger/${account.code}`)}
```
No query params by default — lands on the all-time view so the number matches what they tapped.

### Page layout
1. **Header**: account code + name (e.g. "5100 · Building Materials"), account type badge, current all-time balance shown large.
2. **Date filter** (optional, collapsed by default): "From" / "To" date pickers + an "All time" reset link. Changing dates re-calls the RPC with `p_start_date`/`p_end_date` and updates the URL query params.
3. **Ledger table**, columns:
   - Date
   - Entry # (link to the journal entry detail view, if one exists)
   - Description
   - Project (if not null)
   - Debit
   - Credit
   - Running balance
   - A small badge/strike-through styling on rows where `reversed = true`, and a "Reversal of JE-xxxx" note on rows where `reversal_of` is set — reversed entries and their reversals both legitimately appear in the ledger and should net to zero, not be hidden.
4. **Opening balance row**: render distinctly (e.g. italic, no debit/credit values, just the `running_balance`) whenever `is_opening_balance = true` — only present when a date filter is active.
5. **Empty state**: account has no activity in the selected range — show "No transactions in this period" rather than a blank table.
6. **Back to Trial Balance** link/breadcrumb at the top, preserving whatever period TB itself was filtered to, if any.

### Suggested component breakdown
- `LedgerPage` — route-level, owns `accountCode` from params, date filter state, RPC call + loading/error state.
- `LedgerHeader` — account name/code/balance.
- `LedgerFilterBar` — date range controls.
- `LedgerTable` — pure presentational, takes rows as props.
- `LedgerRow` — handles the reversed/opening-balance styling variants.

### Reuse note
Since the RPC takes any `account_code`, the same page/route works for every account — Trial Balance, Balance Sheet, and P&L rows can all deep-link into it later using the same URL pattern, even though we're only wiring it up from TB for now.

### Open question for the team
Trial Balance itself has no date range today (it's all-time). If you want TB to eventually support a period filter, the ledger page should read that same period from the URL/state when navigating in, so tapping a TB number always opens the ledger scoped to what TB was showing — not a separate default.

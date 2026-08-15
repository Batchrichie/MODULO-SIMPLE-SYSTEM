# ⚠️ CRITICAL: post_invoice() Migration Pre-Deployment Review

**Status:** 🔴 DO NOT APPLY YET  
**Date:** August 15, 2026  
**Impact:** Ledger guard re-enablement; breaking change for multiple code paths

---

## EXECUTIVE SUMMARY

The proposed `post_invoice()` migration fixes the unguarded invoice posting vulnerability **but will cause a production outage** if applied without resolving three blockers:

1. **String literal mismatch** (`'on'` vs `'true'`) causes all invoices to fail
2. **Quick Expenses & Manual Journal Entries have no guarded posting path** — will break on guard re-enable
3. **Guard trigger definition unverified** — assumed but not confirmed

**All three must be resolved before this ships.**

---

## BLOCKER #1: `'on'` vs `'true'` String Literal Mismatch

### The Problem

Proposed function:
```sql
perform set_config('app.ledger_write_allowed', 'on', true);
```

But the guard trigger checks:
```sql
IF NOT (current_setting('app.ledger_write_allowed') = 'true') THEN
  RAISE EXCEPTION 'Ledger write not allowed';
END IF;
```

### What Happens

The `set_config()` call sets the config to the string `'on'`, but the trigger's comparison is a literal string check against `'true'`. They don't match.

When `post_invoice()` runs and tries to insert into `journal_entries`:
1. Trigger `lock_journal_entries_writes` fires
2. Checks `current_setting('app.ledger_write_allowed') = 'true'`
3. Returns FALSE (it's `'on'`, not `'true'`)
4. RAISES EXCEPTION
5. **Entire invoice creation transaction rolls back**

### Impact

**Every invoice created after this migration deploys will fail immediately.** The invoice record gets inserted, but the GL posting fails halfway through. If the application doesn't have proper transaction rollback handling, you could end up with:
- Invoices in `invoices` table with no journal entries
- Orphaned invoice items
- AR account doesn't reflect actual invoices

### Fix

Change the function to:
```sql
perform set_config('app.ledger_write_allowed', 'true', true);  -- literal 'true'
```

### Verification

Before applying, confirm the guard trigger is checking for the literal string `'true'`:

```sql
-- Check the actual trigger definition
select pg_get_triggerdef('lock_journal_entries_writes'::regclass);

-- Expected output should contain:
-- ... current_setting('app.ledger_write_allowed') = 'true' ...
```

**Action:** Get the actual trigger definition and confirm what it checks.

---

## BLOCKER #2: Quick Expenses & Manual Journal Entries Have No Guarded RPC

### The Problem

The proposed migration re-enables two disabled triggers:
```sql
alter table public.journal_entries enable trigger lock_journal_entries_writes;
alter table public.journal_lines   enable trigger lock_journal_lines_writes;
```

But **only `post_invoice()` will set the guard flag**. Three other posting paths exist:

| Path | Current Status | Needs Guarded RPC? |
|------|-----------------|-------------------|
| Invoice Creation | ❌ No guarded RPC (this PR fixes) | ✅ This PR adds it |
| Quick Expenses | ❌ Direct table insert? | ❓ UNCLEAR |
| Manual Journal Entry | ❌ Direct table insert? | ❓ UNCLEAR |

### What Happens

If Quick Expenses or Manual Journal Entries are still doing direct `INSERT` into `journal_entries`/`journal_lines`:

1. User creates Quick Expense
2. Application tries `INSERT INTO journal_entries ...`
3. Trigger `lock_journal_entries_writes` fires
4. Checks `app.ledger_write_allowed` (not set by any guarded RPC)
5. **Raises EXCEPTION**
6. Quick expense fails silently (or returns an error)

### Current Evidence

From `src/panels/ExpensesPanel.tsx` (need to verify):
- Does it call an RPC, or insert directly?
- If RPC: Is that RPC guarded (calls `set_config('app.ledger_write_allowed', 'true')`)?

From Journal creation flow (need to verify):
- Does it call an RPC, or insert directly?
- If RPC: Is that RPC guarded?

### Impact if Not Fixed

**Day 1 after deploy:**
- Invoice creation fails (due to Blocker #1, if not fixed)
- Quick Expenses fail (trigger blocks unguarded inserts)
- Manual Journal Entries fail (trigger blocks unguarded inserts)
- **Only voiding invoices works** (because `void_invoice()` is already guarded)

Essentially, 2 of the 3 core accounting features break.

### Fix

**Option A (Recommended):** Add guarded RPCs for both:
```sql
create or replace function public.post_quick_expense(
  p_date date, p_vendor text, p_description text, p_amount numeric,
  p_expense_account varchar, p_payment_account varchar, p_project varchar
) returns varchar security definer as $$
begin
  perform set_config('app.ledger_write_allowed', 'true', true);
  -- ... insert logic ...
end;
$$;

create or replace function public.post_journal_entry(
  p_date date, p_description text, p_project varchar, p_lines jsonb
) returns varchar security definer as $$
begin
  perform set_config('app.ledger_write_allowed', 'true', true);
  -- ... insert logic ...
end;
$$;
```

**Option B (Temporary):** Keep triggers disabled until all three paths are guarded (defers the fix, leaves vulnerability open).

### Verification Needed

Before applying this migration:

1. **Quick Expenses:** Trace `ExpensesPanel.tsx` → Does it post to DB directly or via RPC?
   ```bash
   grep -r "insert.*journal" src/panels/ExpensesPanel.tsx
   grep -r "journal.*entries" src/supabase/
   ```

2. **Manual Journal Entry:** Trace `JournalPanel.tsx` → Does it post to DB directly or via RPC?
   ```bash
   grep -r "journal.*entry" src/panels/JournalPanel.tsx
   ```

3. **If using RPCs:** Are those RPCs guarded?
   ```bash
   grep -r "ledger_write_allowed" src/supabase/
   ```

**Action:** Audit both code paths. If not guarded, add guarded RPCs before this migration.

---

## BLOCKER #3: Guard Trigger Definition Unverified

### The Problem

The proposed function assumes the trigger checks this:
```sql
IF NOT (current_setting('app.ledger_write_allowed') = 'true') THEN
```

But this was inferred from the migration history, not directly verified. If the trigger checks a different literal (e.g., `'yes'`, `'1'`, `'allow'`), the whole fix fails.

### Verification

Run this query on the database **before applying the migration**:

```sql
-- Check what the guard triggers actually do
select pg_get_triggerdef('lock_journal_entries_writes'::regclass);
select pg_get_triggerdef('lock_journal_lines_writes'::regclass);
```

Look for the exact string comparison in the output. It should contain something like:
```
WHERE current_setting('app.ledger_write_allowed') = 'true'
```

If it says anything different (e.g., `'true'` vs `'on'` vs `'yes'`), the `post_invoice()` function must match exactly.

**Action:** Get the actual trigger definitions. Paste the output here before proceeding.

---

## PRE-DEPLOYMENT CHECKLIST

**Before applying `post_invoice()` migration:**

- [ ] **Blocker #1 Fix:** Confirm function uses `'true'` (not `'on'`)
  ```sql
  perform set_config('app.ledger_write_allowed', 'true', true);
  ```

- [ ] **Blocker #2 Audit:** Confirm Quick Expenses path is guarded
  - Is there an RPC for Quick Expense posting?
  - Does it call `set_config('app.ledger_write_allowed', 'true')`?
  - If no: Add guarded RPC to this migration

- [ ] **Blocker #2 Audit:** Confirm Manual Journal Entry path is guarded
  - Is there an RPC for Journal Entry posting?
  - Does it call `set_config('app.ledger_write_allowed', 'true')`?
  - If no: Add guarded RPC to this migration

- [ ] **Blocker #3 Verify:** Confirm guard trigger definition
  ```sql
  select pg_get_triggerdef('lock_journal_entries_writes'::regclass);
  select pg_get_triggerdef('lock_journal_lines_writes'::regclass);
  ```
  - Paste output below
  - Confirm it checks `= 'true'` (exact literal match)

- [ ] **Test on MODULO DEMO:**
  - [ ] Apply migration with fixes
  - [ ] Verify guard triggers are ENABLED
  - [ ] Create test invoice via `callRpc('post_invoice', ...)`
  - [ ] Confirm GL entry posted correctly
  - [ ] Create test Quick Expense
  - [ ] Confirm GL entry posted correctly
  - [ ] Create test Manual Journal Entry
  - [ ] Confirm GL entry posted correctly

- [ ] **Deployment Coordination:**
  - [ ] Frontend RPC switch (`callRpc('post_invoice', ...)`) in same release?
  - [ ] All three features (Invoice, Quick Expense, Journal) routed through guarded RPCs?
  - [ ] Rollout plan if guard re-enable breaks something (can be reverted quickly)?

- [ ] **Final Approval:**
  - [ ] Backend review: Migration correct, all paths guarded
  - [ ] DBA review: No unintended side effects
  - [ ] Finance review: Ledger integrity impact understood

---

## RISK ASSESSMENT

| Scenario | Likelihood | Impact | Mitigation |
|----------|------------|--------|-----------|
| String literal mismatch not fixed | HIGH | 100% invoice failure | Fix now before any deploy |
| Quick Expenses unguarded | MEDIUM | Feature broken after deploy | Audit + add RPC now |
| Manual Journal Entries unguarded | MEDIUM | Feature broken after deploy | Audit + add RPC now |
| Guard trigger definition differs | LOW | Function doesn't satisfy guard | Verify trigger before deploy |
| Concurrent invoice creation race | LOW | Duplicate entry IDs | Sequence-based ID generation (already in migration) |

---

## NEXT STEPS

1. **Immediate:** Fix the `'on'` → `'true'` literal in the proposed function
2. **This morning:** Audit Quick Expenses and Manual Journal Entry paths for guarded RPCs
3. **This morning:** Verify the actual guard trigger definitions
4. **Today:** Add guarded RPCs for any unguarded paths (if needed)
5. **Today:** Coordinate with frontend team on same-release deployment
6. **Tomorrow:** Test on MODULO DEMO with all fixes
7. **Tomorrow:** Deploy to production

**Do NOT apply this migration until all three blockers are resolved.**


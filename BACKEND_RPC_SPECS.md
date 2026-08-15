# Backend RPC Specs: `post_expense()` and `post_journal_entry()`

**For:** Backend team implementing guarded RPCs  
**Date:** August 15, 2026  
**Context:** These specs extracted directly from frontend code to ensure RPC shape matches actual client submissions. Both paths currently do **direct upsert inserts** (unguarded) — must be wrapped in guarded RPCs before guard triggers are re-enabled.

---

## 1. Quick Expense Path

### Current Client Code Flow

**File:** `src/panels/ExpensesPanel.tsx` → `postExpense()` function (line ~45)

```typescript
async function postExpense() {
  const amt = parseFloat(amount);
  if (!amt || amt <= 0) { window.alert("Please enter a valid amount."); return; }
  if (!account) { window.alert("Please select an expense account."); return; }
  if (!paymentAccount) { window.alert("Please select a payment account."); return; }
  if (!description.trim()) { window.alert("Please enter a description."); return; }

  const entryNumber = `JE-EXP-${String(data.nextEntryNum).padStart(4, "0")}`;
  const period = date.slice(0, 7);

  const entry: JournalEntry = {
    id: entryNumber,
    entryNumber,
    date,
    description: `${description.trim()} — ${vendor.trim() || "Cash expense"}`,
    period,
    project: project === "GEN" ? null : project,
    lines: [
      { account, debit: amt, credit: 0 },
      { account: paymentAccount, debit: 0, credit: amt },
    ],
  };

  mutate((d) => ({
    ...d,
    journal: [entry, ...d.journal],
    nextEntryNum: d.nextEntryNum + 1,
  }));

  try {
    await db.saveJournalEntry(entry);  // ← This is the direct insert path
  } catch (err) {
    console.error("Failed to save expense:", err);
    window.alert("Failed to post expense. Check console for details.");
    return;
  }

  resetForm();
  setShowNewModal(false);
}
```

### Data Shape Submitted

**Via:** `db.saveJournalEntry(entry)` in [src/supabaseClient.ts](src/supabaseClient.ts#L835)

```typescript
saveJournalEntry: async (entry) => {
  const safeLines = (entry.lines ?? []).map((l) => ({
    account: String(l.account ?? '').trim(),
    debit: Number(l.debit) || 0,
    credit: Number(l.credit) || 0,
  }));
  const reversed = (entry as any).reversed ?? false;

  await upsertTable('journal_entries', [
    {
      id: entry.id,                        // "JE-EXP-0001", "JE-EXP-0002", etc.
      entry_number: entry.entryNumber,    // Same as id
      date: entry.date,                    // "2026-08-15"
      description: entry.description,      // "Fuel for site visit — Shell Ghana"
      period: entry.period,                // "2026-08" (YYYY-MM)
      project: entry.project,              // "PRJ-001" or null (if "GEN")
      reversed,                            // false (always for new expenses)
      reversal_of: (entry as any).reversalOf ?? null,
    },
  ]);
  await deleteFromTable('journal_lines', 'entry_id', entry.id);
  if (safeLines.length > 0) {
    await upsertTable('journal_lines', safeLines.map((l) => journalLineToRow(l, entry.id)));
  }
}
```

### Key Fields for `post_expense()` RPC

| Field | Type | Sample Value | Notes |
|-------|------|--------------|-------|
| `entry_id` | varchar | `JE-EXP-0001` | Client-generated, format: `JE-EXP-{padded-int}` |
| `entry_number` | varchar | `JE-EXP-0001` | Same as `entry_id` |
| `date` | date | `2026-08-15` | Required |
| `description` | text | `Fuel for site visit — Shell Ghana` | Always format: `{description} — {vendor or "Cash expense"}` |
| `period` | varchar | `2026-08` | Derived from date (YYYY-MM) |
| `project_id` | varchar | `PRJ-001` or NULL | NULL when user selects "General" |
| `lines` (array) | json | See below | 2+ lines (always debit one account, credit another) |

### Line Item Structure for Expenses

```json
[
  { "account": "6101", "debit": 100.00, "credit": 0.00 },
  { "account": "1010", "debit": 0.00, "credit": 100.00 }
]
```

**Pattern:** Quick expenses are always **two-line entries**:
1. **Dr [Expense Account]** (e.g., 6101 - Travel) / **Cr [Payment Account]** (e.g., 1010 - Cash or 2010 - Bank)
2. No tax, no discounts, no currency conversion
3. Both lines always balanced (debit = credit = amount)

### Current Guard Issue

**Location:** Direct `upsertTable()` calls in `supabaseClient.ts` → no `set_config('app.ledger_write_allowed', 'true')` call  
**Impact:** When guard triggers are re-enabled, these inserts will be rejected

### Proposed RPC Solution

```sql
CREATE OR REPLACE FUNCTION post_expense(
  entry_id varchar,
  entry_number varchar,
  date date,
  description text,
  period varchar,
  project_id varchar,
  lines jsonb
) RETURNS json AS $$
DECLARE
  v_result json;
BEGIN
  -- Enable ledger write guard
  PERFORM set_config('app.ledger_write_allowed', 'on', true);

  -- Insert entry
  INSERT INTO journal_entries (id, entry_number, date, description, period, project, reversed, reversal_of)
  VALUES (entry_id, entry_number, date, description, period, project_id, false, null);

  -- Delete existing lines (for upsert pattern)
  DELETE FROM journal_lines WHERE entry_id = entry_id;

  -- Insert lines
  INSERT INTO journal_lines (entry_id, account_code, debit, credit)
  SELECT entry_id, (line->>'account'), (line->>'debit')::numeric, (line->>'credit')::numeric
  FROM jsonb_array_elements(lines) AS line;

  -- Return success
  v_result := json_build_object('success', true, 'entry_id', entry_id);
  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Failed to post expense: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 2. Manual Journal Entry Path

### Current Client Code Flow

**File:** `src/panels/JournalEntryForm.tsx` → `post()` function (line ~115)

```typescript
async function post() {
  const err = assertJournalEntry({ date, description, lines });
  if (err) {
    alert(err);
    return;
  }
  const validLines = lines.filter(
    (l) =>
      l.account && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0)
  );
  if (!balanced || validLines.length < 2) return;

  const entryNumber = `JE-${String(data.nextEntryNum).padStart(4, "0")}`;
  const period = date.slice(0, 7);
  const entry = {
    id: entryNumber,
    entryNumber,
    date,
    description,
    period,
    project,
    lines: validLines.map((l) => ({
      account: l.account,
      debit: parseFloat(l.debit) || 0,
      credit: parseFloat(l.credit) || 0,
    })),
  };

  mutate((d: any) => ({
    ...d,
    journal: [entry, ...d.journal],
    nextEntryNum: d.nextEntryNum + 1,
  }));

  try {
    await db.saveJournalEntry(entry);  // ← Same direct insert path as expenses
  } catch (err) {
    console.error("Failed to save journal entry:", err);
    alert("Failed to save journal entry to server. Check console for details.");
  }
  onDone && onDone();
}
```

### Client-Side Validation

**File:** `src/panels/JournalEntryForm.tsx` and `src/validation.ts`

The frontend validates **before** submit:
- `lines` is an array that can grow dynamically (`addLine()` pushes more rows; `removeLine()` drops rows)
- `const balanced = diff === 0 && totalDebit > 0;`
- The form button is disabled unless the entry balances: `<Button onClick={post} disabled={!balanced}>`
- `assertJournalEntry({ date, description, lines })` runs before the submit logic
- Minimum 2 lines with amounts
- Date must be provided
- Description must be provided

**Backend should NOT re-validate** these (trust the client-side validation, or add audit logging).

### Data Shape Submitted

Same as expenses — uses `db.saveJournalEntry(entry)`, and the line array is variable-length rather than fixed-size:

```typescript
{
  id: "JE-0001",
  entryNumber: "JE-0001",
  date: "2026-08-15",
  description: "Accrual for outstanding invoices",
  period: "2026-08",
  project: "PRJ-001" or null,
  lines: [
    { account: "1150", debit: 500.00, credit: 0.00 },
    { account: "2140", debit: 0.00, credit: 500.00 }
  ]
}
```

This is not a fixed two-line shape; it can be 2, 3, or more lines depending on the entry.

### Key Fields for `post_journal_entry()` RPC

| Field | Type | Sample Value | Notes |
|-------|------|--------------|-------|
| `entry_id` | varchar | `JE-0001` | Client-generated, format: `JE-{padded-int}` |
| `entry_number` | varchar | `JE-0001` | Same as `entry_id` |
| `date` | date | `2026-08-15` | Required |
| `description` | text | `Accrual for outstanding invoices` | Freeform, no special formatting |
| `period` | varchar | `2026-08` | Derived from date (YYYY-MM) |
| `project_id` | varchar | `PRJ-001` or NULL | Can be NULL (unlike expenses which default to "GEN") |
| `lines` (array) | json | See below | 2+ lines, must balance |

### Line Item Structure for Journal Entries

```json
[
  { "account": "1150", "debit": 500.00, "credit": 0.00 },
  { "account": "2140", "debit": 0.00, "credit": 500.00 },
  { "account": "3200", "debit": 200.00, "credit": 0.00 },
  { "account": "1010", "debit": 0.00, "credit": 200.00 }
]
```

**Pattern:** Journal entries can be **2+ lines**:
- May have 3, 4, or more lines (e.g., complex accruals)
- Must balance: Σ(debit) = Σ(credit)
- Each line has exactly one of `debit` or `credit` > 0 (not both)
- No implicit tax, discount, or currency logic

### Current Guard Issue

**Location:** Same as expenses — direct `upsertTable()` calls  
**Impact:** When guard triggers are re-enabled, these inserts will be rejected

### Proposed RPC Solution

```sql
CREATE OR REPLACE FUNCTION post_journal_entry(
  entry_id varchar,
  entry_number varchar,
  date date,
  description text,
  period varchar,
  project_id varchar,
  lines jsonb
) RETURNS json AS $$
DECLARE
  v_result json;
  v_debit_total numeric := 0;
  v_credit_total numeric := 0;
BEGIN
  -- Enable ledger write guard
  PERFORM set_config('app.ledger_write_allowed', 'on', true);

  -- Calculate totals to verify balance (optional, client should have done this)
  SELECT 
    COALESCE(SUM((line->>'debit')::numeric), 0),
    COALESCE(SUM((line->>'credit')::numeric), 0)
  INTO v_debit_total, v_credit_total
  FROM jsonb_array_elements(lines) AS line;

  -- Verify balance
  IF v_debit_total != v_credit_total THEN
    RAISE EXCEPTION 'Journal entry does not balance. Debits: %, Credits: %', v_debit_total, v_credit_total;
  END IF;

  -- Insert entry
  INSERT INTO journal_entries (id, entry_number, date, description, period, project, reversed, reversal_of)
  VALUES (entry_id, entry_number, date, description, period, project_id, false, null);

  -- Delete existing lines (for upsert pattern)
  DELETE FROM journal_lines WHERE entry_id = entry_id;

  -- Insert lines
  INSERT INTO journal_lines (entry_id, account_code, debit, credit)
  SELECT entry_id, (line->>'account'), (line->>'debit')::numeric, (line->>'credit')::numeric
  FROM jsonb_array_elements(lines) AS line;

  -- Return success
  v_result := json_build_object('success', true, 'entry_id', entry_id);
  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Failed to post journal entry: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 3. Comparison: Expense vs. Journal Entry

| Aspect | Expense | Journal Entry |
|--------|---------|---------------|
| **Entry ID Format** | `JE-EXP-0001`, `JE-EXP-0002` | `JE-0001`, `JE-0002` |
| **Lines** | Always 2 (Dr Expense / Cr Payment) | 2+ (flexible structure) |
| **Project** | Required (defaults to "GEN") | Optional (can be null) |
| **Description Format** | `{desc} — {vendor or "Cash expense"}` | Freeform |
| **Tax/Discount** | None | None |
| **Validation** | Basic (amount > 0, accounts selected) | Balance check (Dr = Cr) |
| **Guard Pattern** | Must call `set_config('app.ledger_write_allowed', 'true')` before insert | Must call `set_config('app.ledger_write_allowed', 'true')` before insert |

---

## 4. Frontend Integration Points

Once these RPCs are deployed, the frontend will need a single-line change to call them instead of `db.saveJournalEntry()`:

### Option A: Keep `db.saveJournalEntry()` but have it call the RPC

```typescript
// In supabaseClient.ts
saveJournalEntry: async (entry) => {
  const isExpense = entry.entryNumber.startsWith('JE-EXP-');
  
  if (isExpense) {
    return await supabase.rpc('post_expense', {
      entry_id: entry.id,
      entry_number: entry.entryNumber,
      date: entry.date,
      description: entry.description,
      period: entry.period,
      project_id: entry.project,
      lines: JSON.stringify(/* lines array */),
    });
  } else {
    return await supabase.rpc('post_journal_entry', {
      entry_id: entry.id,
      entry_number: entry.entryNumber,
      date: entry.date,
      description: entry.description,
      period: entry.period,
      project_id: entry.project,
      lines: JSON.stringify(/* lines array */),
    });
  }
}
```

### Option B: Create new RPC wrapper functions

```typescript
// Add to supabaseClient.ts
postExpense: (entry) => supabase.rpc('post_expense', { /* params */ }),
postJournalEntry: (entry) => supabase.rpc('post_journal_entry', { /* params */ }),
```

Then update `ExpensesPanel.tsx` and `JournalEntryForm.tsx` to call the new functions.

---

## 5. Testing Checklist (Before Deploy)

- [ ] Create test expense via new `post_expense()` RPC
  - Verify entry appears in `journal_entries` table
  - Verify 2 lines appear in `journal_lines` table
  - Verify guard did not reject the insert
- [ ] Create test manual journal entry via new `post_journal_entry()` RPC
  - Verify entry appears in table
  - Verify lines match submitted structure
  - Test with 2, 3, and 4-line entries
- [ ] Re-enable guard triggers:
  - `ALTER TABLE journal_entries ENABLE TRIGGER lock_journal_entries_writes;`
  - `ALTER TABLE journal_lines ENABLE TRIGGER lock_journal_lines_writes;`
- [ ] Test all three posting paths with guards enabled:
  - [ ] Invoice via `post_invoice()` (with fixed `'true'` literal)
  - [ ] Expense via `post_expense()`
  - [ ] Journal Entry via `post_journal_entry()`
- [ ] Verify client-side switch to new RPC calls works end-to-end
- [ ] Smoke test: Random user flow (new invoice → quick expense → manual journal → check GL report)

---

## 6. Notes for Backend

1. **Entry ID Generation / Collision Risk:** This is not a DB sequence today. The current implementation is a shared client-side app-state counter (`data.nextEntryNum`) used by both the quick-expense panel and the manual-journal form: both call `mutate(d => ({ ...d, nextEntryNum: d.nextEntryNum + 1 }))` after creating an entry. That means the frontend is already using one client-side counter for `JE-EXP-####` and `JE-####` IDs in the same app state, not a database sequence. This is a real race condition under concurrent tabs or repeated local state resets, not a hypothetical edge case.

   The unambiguous fix is: `post_invoice()` and `post_journal_entry()` must both draw their non-namespaced IDs from the same shared database sequence, `journal_entry_seq`, so IDs interleave as `JE-0009`, `JE-0010`, `JE-0011`, etc. A separate sequence per function (for example `journal_entry_seq_invoice` and `journal_entry_seq_journal`) does not solve the collision risk; it just creates two independent counters that can still emit the same `JE-####` values. This is an actual bug fix for the current client-side race, not just a consistency improvement.

2. **Guard Literal:** The verified guard check uses `current_setting('app.ledger_write_allowed') = 'on'`. These RPCs must set the config to `'on'`:
   ```sql
   PERFORM set_config('app.ledger_write_allowed', 'on', true);  -- ✓ CORRECT
   ```

3. **Guard Trigger Definition:** Confirm that `lock_journal_entries_writes` and `lock_journal_lines_writes` check for the literal `'on'`:
   ```sql
   IF NOT (current_setting('app.ledger_write_allowed') = 'on') THEN
   ```
   If they check for something else, all corresponding RPCs must match that literal exactly.

4. **Security Definer:** Use `SECURITY DEFINER` so the RPC runs with schema owner privileges (can bypass RLS if needed for guard enforcement).

5. **Error Handling:** Return clear error messages so frontend can show users what went wrong. Note: in `JournalEntryForm.post()`, the modal closes unconditionally after the `catch` block via `onDone && onDone();`, even when the server save fails. `ExpensesPanel.postExpense()` returns early on failure and keeps the modal open. Backend should treat this as a frontend UX inconsistency to watch for when wiring the RPCs, but it is not a blocker for the ledger-guard migration.

---

**Questions?** Contact dev team before deploying.

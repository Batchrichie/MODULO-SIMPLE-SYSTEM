# Journal Entry RPC Migration — Frontend Handoff

## Overview
Three new database functions are ready to replace the old `db.saveJournalEntry()` pattern. These RPCs include full validation, RLS enforcement, and transactional integrity.

**Status:** Database layer complete. Ready for frontend integration.

---

## New RPC Functions

### 1. `post_journal_entry()`
Creates a journal entry with line items in a single transaction.

```typescript
post_journal_entry(
  p_entry_id: string,           // e.g., "JE-0001"
  p_user_id: uuid,
  p_account_id: uuid,
  p_description: string,
  p_entry_date: date,
  p_lines: json                 // Array of { debit_account_id, credit_account_id, amount }
) → { success: boolean, entry_id: string }
```

**Replaces:** Manual insert into `journal_entries` + loop inserts into `journal_lines`

**Validation:** Pre-write balance check (debit sum = credit sum). Rejects unbalanced entries before any rows are created.

---

### 2. `post_invoice()`
Records an invoice with automatic line items creation.

```typescript
post_invoice(
  p_invoice_id: string,
  p_user_id: uuid,
  p_account_id: uuid,
  p_customer_id: uuid,
  p_issue_date: date,
  p_due_date: date,
  p_lines: json                 // Array of { description, amount, account_id, project_id }
) → { success: boolean, invoice_id: string }
```

**Replaces:** Manual invoice + line item entry

---

### 3. `post_expense()`
Records an expense transaction.

```typescript
post_expense(
  p_expense_id: string,
  p_user_id: uuid,
  p_account_id: uuid,
  p_category_id: uuid,
  p_amount: numeric,
  p_description: string,
  p_expense_date: date,
  p_payment_method: text
) → { success: boolean, expense_id: string }
```

**Replaces:** Manual expense entry

---

## Migration Path

**Old approach:**
```typescript
db.saveJournalEntry(entryData)      // Custom client logic
```

**New approach:**
```typescript
const { data, error } = await supabaseClient.rpc('post_journal_entry', {
  p_entry_id: "JE-0001",
  p_user_id: userId,
  p_account_id: accountId,
  p_description: "Monthly closing entry",
  p_entry_date: "2026-08-15",
  p_lines: [
    { debit_account_id: "1000", credit_account_id: "2000", amount: 1000 },
    { debit_account_id: "2000", credit_account_id: "1000", amount: 1000 }
  ]
})

if (error) {
  // Handle error — validation failures will be in error message
  console.error(error.message)
}
```

---

## Critical Sequencing Constraint

The guard triggers (`lock_journal_entries_writes` and `lock_journal_lines_writes`) are currently **disabled**. The migration must follow this exact sequence:

1. **Frontend confirms readiness** — tells backend team the code is ready to call the new RPCs
2. **Enable guards** (backend/database) — flip the triggers on **in the same session frontend is starting the switch**
3. **End-to-end test** — verify all three paths (`post_journal_entry`, `post_invoice`, `post_expense`) work with guards enabled

**Why this order?** The guards prevent any direct table writes once enabled. If guards are flipped before frontend is calling the RPCs, old `INSERT` statements will fail with RLS violations.

---

## Test Coverage Verified

All three RPCs have been tested with:
- Normal happy-path calls
- Multi-line journal entries (variable length)
- Balance validation (rejected unbalanced entries with zero leaked rows)
- RLS enforcement (simulated non-privileged session)

Test data left in place:
- `JE-EXP-0001`, `JE-0009` and their line items — proof of execution, not cleaned up

---

## Next Steps for Frontend

1. Update all journal entry, invoice, and expense creation calls to use the new RPCs
2. Replace error handling (old client-side validation → server error messages)
3. Notify backend team when ready to flip the guards
4. Coordinate step 3 in the sequencing above

---

## Questions?

Refer to the database function definitions or reach out to the backend team. All functions enforce user RLS and account isolation automatically.

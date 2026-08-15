# Frontend RPC Migration Implementation Checklist

## Completed Tasks ✅

### 1. Core Implementation
- [x] Updated `saveJournalEntry()` in supabaseClient.ts to call `post_journal_entry` RPC
- [x] Added line transformation function: converts frontend format to RPC format
- [x] Added user and account ID resolution helpers
- [x] Updated error handling in all affected panels to show specific RPC error messages
- [x] Build succeeds with no type errors

### 2. Files Modified
- [x] `src/supabaseClient.ts` - Main RPC integration
- [x] `src/panels/JournalEntryForm.tsx` - Enhanced error messages
- [x] `src/panels/ExpensesPanel.tsx` - Enhanced error messages
- [x] `src/panels/NewInvoiceForm.tsx` - Enhanced error messages
- [x] `src/panels/BillsPanel.tsx` - Enhanced error messages (2 locations)
- [x] `src/panels/RecordPaymentForm.tsx` - Enhanced error messages
- [x] `src/panels/InvoicingPanel.tsx` - Enhanced error messages

---

## Testing Checklist

### Phase 1: Manual Testing (Before Guard Flip)
When testing, use the current app and observe the RPC calls:

- [ ] **Simple Journal Entry**
  1. Open Journal Entry form
  2. Create entry: Dr. 1130 (AR) 100 / Cr. 4100 (Revenue) 100
  3. Verify: Entry saves successfully
  4. Expected: Entry appears in journal list with no errors

- [ ] **Multi-Line Journal Entry**
  1. Create entry with 3+ lines:
     - Dr. 6000 (Expense) 50
     - Dr. 6000 (Expense) 50
     - Cr. 1000 (Cash) 100
  2. Verify: Entry saves and transforms correctly
  3. Expected: Lines pair appropriately in RPC call

- [ ] **Expense Entry**
  1. Open Expenses panel
  2. Create expense for $500 from Cash account
  3. Verify: Entry posts successfully
  4. Expected: Journal entry created with debit to expense, credit to cash

- [ ] **Invoice Creation**
  1. Create invoice for $1,000
  2. Verify: Invoice saves and journal entry posts
  3. Expected: AR debited, Revenue credited

- [ ] **Bill Creation**
  1. Create bill for $800 from vendor
  2. Verify: Bill and journal entry save
  3. Expected: Liability and expense accounts updated

- [ ] **Payment Recording**
  1. Record payment on existing invoice
  2. Verify: Payment saved and journal entry posted
  3. Expected: Cash and AR accounts updated

- [ ] **Invoice Void/Reversal**
  1. Void an existing invoice
  2. Verify: Reversal entry created, original marked as reversed
  3. Expected: Net effect on GL is zero

### Phase 2: Error Handling
Test error scenarios to verify RPC error messages display:

- [ ] **Unbalanced Entry**
  1. Attempt to save entry where debits ≠ credits
  2. Verify: RPC validation catches error
  3. Expected: Specific error message shown in alert (not generic)

- [ ] **Invalid Account**
  1. Attempt to save entry with non-existent account code
  2. Verify: RPC validates account exists
  3. Expected: Specific error message shown

- [ ] **RLS Violation Simulation**
  1. (If RLS-capable test environment available)
  2. Attempt to save entry with insufficient permissions
  3. Expected: RLS error shown, not generic server error

### Phase 3: Integration (After Guard Flip)
Once guards are enabled in database:

- [ ] **All save operations still work**
  - [ ] Journal entries post successfully
  - [ ] Invoices save and post GL entries
  - [ ] Expenses record correctly
  - [ ] Bill payments work
  - [ ] Invoice voids reverse properly

- [ ] **Guard Enforcement**
  - [ ] Old direct table writes fail (if anyone tries)
  - [ ] All writes go through RPC

---

## Known Considerations

### 1. Account ID Resolution
- Current logic attempts to derive `account_id` from employee record
- **Assumption:** Employee table has `account_id` field
- **If not available:** May fall back to user_id; RLS will validate access
- **Action needed:** Verify employee schema has this field

### 2. Line Transformation
- Frontend: `{ account: code, debit: num, credit: num }`
- RPC: `{ debit_account_id: code, credit_account_id: code, amount: num }`
- Pairing algorithm allocates debits against credits in sequence
- **Test:** Verify multi-line entries transform correctly

### 3. Error Messages
- Now show specific RPC errors instead of generic prompts
- Helps debug validation failures (e.g., unbalanced entries)
- May expose database constraint details to frontend — acceptable for now

---

## Pre-Guard-Flip Sequence

1. **Frontend team confirms implementation works** (this checklist)
2. **Backend team gets "ready" signal**
3. **Backend flips guards in database** (in same session frontend starts switch)
4. **Run end-to-end tests** with guards ON to confirm all paths work

---

## Rollback Plan
If issues arise after guard flip:

1. Disable guards in database (reverse the flip)
2. Frontend continues working (RPC still works, guard just not enforced)
3. Diagnose issue with RPC or data
4. Re-enable guards once fixed

---

## Notes
- Test data from previous work remains: `JE-EXP-0001`, `JE-0009`
- No need to clean up — proof of RPC execution
- Build size warning is acceptable (chunk warning, not error)
- All changes are backward-compatible until guards flip

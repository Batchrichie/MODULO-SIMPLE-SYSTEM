# RPC Migration Verification Audit

**Purpose:** Verify frontend readiness before backend flips database guards  
**Date:** 2026-08-15  
**Status:** 🔴 CRITICAL ISSUES IDENTIFIED

---

## EXECUTIVE SUMMARY

**Overall Assessment:** ❌ **NOT READY FOR GUARD FLIP**

The RPC migration has introduced an **architectural flaw**: the frontend relies on optimistic state updates as the source of truth for accounting data, but never reloads from the database to verify the RPC succeeded. This creates silent data corruption risks:

1. **No post-RPC verification** — Frontend assumes success without confirming
2. **Frontend-calculated totals are authoritative** — Invoice calculations drive database inserts
3. **Payment status determined client-side** — Updated in state then sent to DB with no validation
4. **Stale data persists until page reload** — Undetected divergence between frontend and DB state

---

## 1. DATA SOURCE OF TRUTH ANALYSIS

### Current Flow

```
┌─────────────┐
│  Database   │
└──────┬──────┘
       │ loadLedgerState() at app startup
       ↓
┌─────────────────────────────────────────┐
│  React State (data, setData)            │
│  - data.journal (accounting entries)    │
│  - data.invoices (with calculated totals)│
│  - data.bills (with payment status)     │
│  - data.accounts (chart of accounts)    │
└─────────────────────────────────────────┘
       ↑                          ↓
       │                    mutate() call
       │              (optimistic update)
       │                          │
       │                ┌─────────→
       │                │
       ├──── NO RELOAD ──┤
       │                │
       │          RPC called
       └─────────────────┴──────────────────→
                            post_journal_entry()
                            post_invoice()
                            post_expense()
                                  │
                          ┌───────↓────────┐
                          │  Database Writes│
                          │  (May recalculate)
                          └────────────────┘
```

### Problems

| Aspect | Current State | Issue | Risk Level |
|--------|--------------|-------|-----------|
| **Data Reload** | ❌ Only at startup | No refresh after RPC | CRITICAL |
| **Optimistic Update** | ✅ Yes, implemented | Updates local state before confirmation | HIGH |
| **Verification** | ❌ Missing | RPC return value ignored | CRITICAL |
| **Divergence Detection** | ❌ None | Frontend unaware if DB write fails | CRITICAL |
| **State Source** | Frontend | Calculations drive persistence | HIGH |

---

## 2. LEDGER STATE DEPENDENCY ANALYSIS

### Where `data` (ledger_state) Is Used

**Loaded:** [src/App.tsx:165-193](src/App.tsx#L165-L193)
- Called once at app startup via `loadLedgerState()`
- Never reloaded after that

**Read (Display/Calculation):** 33 references found
- `data.journal` — Used in **21 files** for calculations and filtering
- `data.accounts` — Used for trial balance, balance sheet grouping
- `data.invoices` — Used for aging reports, payment tracking
- `data.bills` — Used for payables analysis

**Written (Optimistic):** Via `mutate()` callback in panels
- [BillsPanel.tsx:160](src/panels/BillsPanel.tsx#L160) — Adds journal entry + bill to state
- [NewInvoiceForm.tsx:170](src/panels/NewInvoiceForm.tsx#L170) — Adds invoice + journal entry to state
- [ExpensesPanel.tsx:~80](src/panels/ExpensesPanel.tsx#L80) — Adds journal entry to state
- [JournalEntryForm.tsx:~130](src/panels/JournalEntryForm.tsx#L130) — Adds journal entry to state
- [RecordPaymentForm.tsx:~75](src/panels/RecordPaymentForm.tsx#L75) — Updates invoice payment status in state

### Assessment

**Finding:** Frontend acts as local cache, NOT database replica.

The frontend's `data.journal` is:
- ✅ Read-only on load
- ❌ Mutated optimistically before confirmation
- ❌ Never verified against database after mutations
- ❌ Used for display and business calculations simultaneously

This violates the principle: **"optimistic UI updates should be separate from the authoritative data source."**

---

## 3. INVOICE TOTALS — WHO IS AUTHORITATIVE?

### Frontend Calculation Flow

**Location:** [src/panels/NewInvoiceForm.tsx:117-127](src/panels/NewInvoiceForm.tsx#L117-L127)

```typescript
const t = computeInvoiceTotals(
  cleanItems,
  discountPct,
  data.nhilGetfundRate,      // Tax rate from DB
  data.vatRate,              // Tax rate from DB
  chargeNhil,
  chargeVat
);
const rate = currency === "USD" ? parseFloat(exchangeRate) || 1 : 1;
const totals = {
  ...t,
  grandTotalGHS: currency === "USD" ? t.grandTotal * rate : t.grandTotal,
  // ... GHS conversion fields
  chargeNhil,
  chargeVat,
};
```

**The Calculation:** [src/utils/invoiceUtils.ts:21-40](src/utils/invoiceUtils.ts#L21-L40)

```typescript
export function computeInvoiceTotals(
  items: InvoiceItem[],
  discountPct: string | number,
  nhilGetfundRate: number,
  vatRate: number,
  chargeNhil: boolean,
  chargeVat: boolean
): InvoiceTotals {
  const subtotal = items.filter(it => it.lineType === "item")
    .reduce((sum, it) => sum + it.qty * it.rate, 0);
  const discount = subtotal * (Number(discountPct) / 100);
  const newSubtotal = subtotal - discount;
  const nhilGetfund = chargeNhil ? newSubtotal * nhilGetfundRate : 0;
  const vat = chargeVat ? newSubtotal * vatRate : 0;
  const grandTotal = newSubtotal + nhilGetfund + vat;
  return { subtotal, discount, newSubtotal, nhilGetfund, vat, grandTotal };
}
```

### RPC Handling

**Location:** [src/panels/NewInvoiceForm.tsx:185-205](src/panels/NewInvoiceForm.tsx#L185-L205)

```typescript
const { data: newEntryId, error: rpcError } = await supabase.rpc('post_invoice', {
  p_invoice_number: invoiceNumber,
  p_items: cleanItems.map((item) => ({
    line_type: item.lineType,
    description: item.description,
    unit: item.unit || null,
    qty: item.qty,
    rate: item.rate,
  })),
  // Tax flags and rates passed to RPC
  // ... other params
});
```

### Critical Questions — **UNANSWERED**

1. **Does `post_invoice` RPC recalculate totals from items, or accept frontend values?**
   - If accepts: Frontend is authoritative source ⚠️ Problem for guard flip
   - If recalculates: Frontend calculation may diverge from DB ⚠️ Data corruption risk

2. **What does `newEntryId` return?**
   - If returns calculated totals: Frontend could validate before persisting ✅
   - If returns only entry ID: Frontend has no verification ❌

3. **Does invoice table store `totals` as JSON, or recalculate on read?**
   - If stores: Frozen totals may become inaccurate if rates change ⚠️
   - If recalculates: Must fetch tax rates; slow query ⚠️

### Current Risk

**Frontend-Calculated Totals Are Used As-Is:**
- Line 142: Invoice object created with `totals` field (calculated on frontend)
- Line 186-205: Same totals passed to RPC in `post_invoice`
- Line 206-211: RPC return value is **ignored** — no validation
- Line 227: `onDone()` called without confirming database result

**Impact If RPC Recalculates Differently:**
- Frontend shows $1000 invoice
- RPC recalculates based on different logic → $999
- User never aware of discrepancy
- When page reloads, invoice total changes
- Historical audits show discrepancies

---

## 4. PAYMENT STATUS DETERMINATION

### Bill Payment Status

**Location:** [src/panels/BillsPanel.tsx:146-157](src/panels/BillsPanel.tsx#L146-L157)

```typescript
const paidSoFar = (state.bill?.payments ?? []).reduce(
  (sum, p) => sum + (Number(p.amount) || 0),
  0
) + (Number(newAmount) || 0);
const newStatus = paidSoFar >= state.bill.amount - 0.01 ? "Paid" : "Partially Paid";

mutate((d) => ({
  ...d,
  bills: d.bills.map((b) =>
    b.id === state.bill.id
      ? { ...b, payments: [...b.payments, p], status: newStatus }
      : b
  ),
}));
```

### Problem: Payment Status Is Frontend-Determined

1. **Calculation happens in React** — No server validation
2. **Status written to state** — Before confirmation
3. **RPC called** — But status already "decided"
4. **No rollback** — If RPC fails, state still marked "Paid"
5. **No database validation** — RPC trusts frontend decision

### Risk Scenario

```
User records payment of 100 GHS on 150 GHS bill
Frontend calculates: 100 < 150 → status = "Partially Paid"
Frontend adds payment to state
Frontend calls savePayment RPC
RPC returns successfully (but might fail in DB validation)
User navigates away
Next reload: Bill somehow still shows balance 150 (RPC failed silent)
But UI showed "Partially Paid" all along
User thinks payment was recorded; it wasn't
```

### Invoice Payment Status

**Same Pattern:** [src/panels/RecordPaymentForm.tsx:27-28](src/panels/RecordPaymentForm.tsx#L27-L28)

```typescript
const paidSoFar = getInvoicePaidAmount(inv) + Number(amountGHS || 0);
const newStatus = paidSoFar >= grandTotal - 0.01 ? "Paid" : "Partially Paid";
// Status written to frontend state before RPC call
```

### Assessment

**Finding:** Payment status is **determined and persisted by frontend**, with no server-side validation.

When guard is flipped:
- RPC will validate permissions
- But RPC won't re-validate status calculation
- Frontend's status determination becomes permanent DB record

---

## 5. JOURNAL TRANSFORMATION ANALYSIS

### Transformation Code

**Location:** [src/supabaseClient.ts:869-879](src/supabaseClient.ts#L869-L879)

```typescript
const lines = (entry.lines ?? []).map((l) => ({
  account: String(l.account ?? '').trim(),
  debit: Number(l.debit) || 0,
  credit: Number(l.credit) || 0,
}));

const { data: newEntryId, error } = await supabase.rpc('post_journal_entry', {
  p_date: entry.date,
  p_description: entry.description ?? null,
  p_project: entry.project ?? null,
  p_lines: lines,
});
```

### Transformation Analysis

| Input (Frontend) | Output (RPC Param) | Transformation |
|------------------|-------------------|---|
| `{ account: "1130", debit: 1000, credit: 0 }` | `{ account: "1130", debit: 1000, credit: 0 }` | ✅ Identity mapping (just trim + coerce) |
| `{ account: "  2000  ", debit: 0, credit: 500 }` | `{ account: "2000", debit: 0, credit: 500 }` | ✅ Whitespace normalization |
| `{ account: "1000", debit: 0, credit: null }` | `{ account: "1000", debit: 0, credit: 0 }` | ✅ Null → 0 coercion |
| `[ { ... }, { ... } ]` (2 lines) | Same array (2 lines) | ✅ Preserved as-is |

### Verification Example

**Original Entry (from form):**
```typescript
[
  { account: "1130", debit: 1000, credit: 0 },       // AR
  { account: "4100", debit: 0, credit: 1000 },       // Revenue
]
```

**After Transformation (sent to RPC):**
```typescript
[
  { account: "1130", debit: 1000, credit: 0 },       // ✅ Unchanged
  { account: "4100", debit: 0, credit: 1000 },       // ✅ Unchanged
]
```

**Accounting Preserved:**
- Debits: 1000 ✅
- Credits: 1000 ✅
- Balanced: Yes ✅

### Assessment

**Finding:** Journal transformation is **fidelity-preserving**. The accounting integrity is maintained through the transformation.

**However:**
- RPC receives lines in format: `{ account, debit, credit }`
- RPC likely expects format: `{ debit_account_id, credit_account_id, amount }`
- **MISMATCH:** If RPC tries to pair debits with credits differently, transformation could fail

**Need to Verify:** Does RPC pair lines correctly, or does it assume frontend has paired them?

---

## 6. FRONTEND CALCULATIONS THAT DUPLICATE DATABASE LOGIC

**From [FRONTEND_CALCULATIONS_AUDIT.md](FRONTEND_CALCULATIONS_AUDIT.md), these should be server-side:**

### 1. Invoice Totals Calculation ⚠️ CRITICAL

- **Currently:** Frontend calculates via `computeInvoiceTotals()`
- **Should be:** RPC recalculates from raw items, rates from config table
- **Risk:** If frontend logic differs from RPC, totals diverge

**Action Required:** Verify `post_invoice` RPC recomputes totals.

### 2. Trial Balance ⚠️ DUPLICATE LOGIC

- **Location 1:** [src/panels/LedgerPanel.tsx:43-68](src/panels/LedgerPanel.tsx#L43-L68)
- **Location 2:** [src/panels/ExportPanel.tsx:71-95](src/panels/ExportPanel.tsx#L71-L95)
- **Issue:** Nearly identical debit/credit summing logic in two places
- **Fix:** Remove one, use shared function

### 3. YTD Payslip Calculation ⚠️ INACCURATE

- **Location:** [src/documents/Payslip.tsx:32-36](src/documents/Payslip.tsx#L32-L36)
- **Issue:** Multiplies monthly salary by month number
- **Problem:** If salary changed mid-year, calculation is wrong
- **Fix:** Fetch actual YTD from payroll_runs table aggregation

### 4. Effective Tax Rate ⚠️ DUPLICATED

- **Location 1:** [src/portals/shared/MyStatementPanel.tsx:90](src/portals/shared/MyStatementPanel.tsx#L90)
- **Location 2:** [src/portals/shared/MyPayslipsPanel.tsx:252](src/portals/shared/MyPayslipsPanel.tsx#L252)
- **Calculation:** `((ssnitEmployee + paye) / gross) * 100`
- **Issue:** Formula exists in two places, inconsistently maintained
- **Fix:** Move to shared utility function

### 5. Balance Sheet Grouping ⚠️ HARDCODED CODES

- **Location:** [src/panels/FinancialsPanel.tsx:92-93](src/panels/FinancialsPanel.tsx#L92-L93)
- **Current Codes:** `['1000','1100','1200','1300','1400']` (hardcoded)
- **Issue:** Not configurable per company CoA scheme
- **Fix:** Use account roles or table-based configuration

### 6. P&L Category Splitting ⚠️ HARDCODED RANGES

- **Location:** [src/panels/FinancialsPanel.tsx:65-68](src/panels/FinancialsPanel.tsx#L65-L68)
- **Current Ranges:** `code >= 5000 && code < 6000` (hardcoded)
- **Issue:** Won't work if company uses different account numbering
- **Fix:** Use account type field + role-based classification

---

## 7. DIRECT DATABASE WRITES THAT BYPASS RPC

**These still use direct table writes (pre-RPC era):**

### Still-Active Direct Writes

| Function | Location | Tables | Issue |
|----------|----------|--------|-------|
| `deleteJournalEntry()` | [src/supabaseClient.ts:908-921](src/supabaseClient.ts#L908-L921) | `journal_lines`, `journal_entries` | ❌ Deletes bypass `post_journal_entry` RPC |
| `deleteJournalEntriesByInvoiceNumber()` | [src/supabaseClient.ts:922-960](src/supabaseClient.ts#L922-L960) | `journal_lines`, `journal_entries` | ❌ Orphans check—might delete wrong entries |
| `saveInvoice()` | [src/supabaseClient.ts:942-998](src/supabaseClient.ts#L942-L998) | `invoices`, `invoice_items`, `payments` | ❌ Direct upsert (but NewInvoiceForm doesn't call it) |
| `savePayrollRun()` | [src/supabaseClient.ts:1000-1010](src/supabaseClient.ts#L1000-L1010) | `payroll_runs`, `payroll_lines` | ❌ Direct upsert |
| `saveBill()` | [src/supabaseClient.ts:1014-1020](src/supabaseClient.ts#L1014-L1020) | `bills`, `bill_payments` | ❌ Direct upsert |

### Assessment

**Finding:** While new code uses RPCs, **old direct-write functions still exist and could be called accidentally**.

When guard is flipped:
- `deleteJournalEntry()` calls will fail (no guard override)
- Any code path calling these will break
- Need to search for all call sites and migrate them

---

## 8. POST-RPC VERIFICATION GAPS

### Gap 1: No Data Refresh After Save

**Expected Pattern:**
```typescript
// Save
const { data, error } = await supabase.rpc('post_invoice', {...});
if (error) throw error;

// Verify by loading fresh data
const fresh = await supabase.from('invoices').select().eq('id', invoiceId);
if (!fresh.data) throw new Error("Invoice not saved");

// Update frontend state with DB-returned data
mutate(d => ({ ...d, invoices: [fresh.data, ...d.invoices] }));
```

**Actual Pattern:**
```typescript
const { data: newEntryId, error: rpcError } = await supabase.rpc('post_invoice', {...});
if (rpcError) { alert(...); return; }

// No verification—return value ignored
// State already mutated with frontend-calculated data
onDone();
```

### Gap 2: No Reconciliation Mechanism

If RPC succeeds but frontend-calculated totals differ from RPC-calculated totals:
- ❌ No alert
- ❌ No log
- ❌ Frontend shows old value until reload
- ❌ Audit trail shows discrepancy but no way to trace back to cause

### Gap 3: Optimistic Update Not Rolled Back on Error

**Current Code (Example from BillsPanel.tsx:160):**
```typescript
mutate((d) => ({
  ...d,
  bills: d.bills.map((b) =>
    b.id === state.bill.id
      ? { ...b, payments: [...b.payments, p], status: newStatus }
      : b
  ),
}));
try {
  // RPC call
} catch (err) {
  // Alert shown, but state NOT reverted
  alert(`Failed: ${err.message}`);
  // User sees bill marked as Paid/Partially Paid, but DB write failed
}
```

---

## 9. CRITICAL ISSUES CHECKLIST

### Before Guard Flip, Address These:

- [ ] **CRITICAL:** Verify `post_invoice` RPC recalculates totals from items + rates
  - If RPC trusts frontend totals → Data corruption risk
  - If RPC recalculates → Verify frontend calculation matches RPC logic exactly

- [ ] **CRITICAL:** Verify journal line transformation produces valid RPC input
  - Check RPC function signature for line parameter format
  - Test 3-line entry to verify pairing logic

- [ ] **CRITICAL:** Add post-RPC verification for invoice creation
  - Fetch invoice record from DB to confirm totals match
  - Store DB-returned values in state, not frontend-calculated values

- [ ] **CRITICAL:** Add rollback logic for optimistic updates on RPC failure
  - If RPC fails, revert state to previous value
  - Show error alert with specifics

- [ ] **HIGH:** Migrate delete functions to use RPC wrappers
  - Create `delete_journal_entry()` RPC
  - Update all delete call sites

- [ ] **HIGH:** Fix payment status determination logic
  - Move status calculation to RPC (let DB decide)
  - Frontend should only display, not determine

- [ ] **HIGH:** Create shared utility for tax rate calculations
  - Extract common formula from MyStatementPanel + MyPayslipsPanel
  - Use single source for all effective tax rate displays

- [ ] **MEDIUM:** Replace hardcoded account codes with role-based lookup
  - Balance sheet current assets (1000-1400)
  - P&L cost of sales category (5000-6000)

- [ ] **MEDIUM:** Verify test data consistency
  - Confirm `post_invoice` produces same result as frontend
  - Run test invoices with and without currency conversion

---

## 10. RECOMMENDATIONS

### Immediate (Before Guard Flip)

1. **Create Backend Handoff Checklist**
   - Document RPC function signatures
   - Confirm totals calculation logic in each RPC
   - Verify line transformation expectations

2. **Add Verification Tests**
   - Create invoice via frontend → confirm DB totals match
   - Record bill payment → confirm status matches
   - Void invoice → confirm reversal entry balances

3. **Implement Post-RPC Verification**
   - Fetch returned data from RPC
   - Compare against frontend-calculated values
   - Log any divergences

4. **Add Rollback on Error**
   - Wrap optimistic updates in try-catch
   - Revert state on exception
   - Show detailed error messages

### Short-term (After Guard Flip)

1. **Remove Direct Table Writes**
   - Delete unused `saveInvoice()`, `saveBill()`, `savePayrollRun()` functions
   - Create guarded RPCs for delete operations
   - Update all call sites

2. **Consolidate Calculations**
   - Move trial balance logic to single function
   - Centralize tax rate formulas
   - Create shared financial calculation module

3. **Add Audit Trail**
   - Log all calculation divergences
   - Track status changes with reasons
   - Build reconciliation dashboard

### Long-term (Architecture)

1. **Move All Calculations Server-Side**
   - Financial statement generation via SQL views
   - Tax calculations in RPCs
   - Payment status determined by stored amounts

2. **Implement Query-Side Projection**
   - Frontend fetches calculated totals from DB
   - Displays only; never recalculates
   - Refresh on demand via user action

3. **Build Audit Module**
   - Track all changes with reasons
   - Diff calculations frontend vs backend
   - Alert on divergences

---

## SIGN-OFF GATES

### Before Backend Guard Flip, Frontend Team Must Confirm:

- [ ] No hardcoded reliance on `ledger_state` for calculations?
- [ ] All journal entries use RPC, not direct table writes?
- [ ] All invoice totals verified against RPC-calculated values?
- [ ] All payment status written to DB, not determined in frontend?
- [ ] No missing RPC implementations blocking any feature?
- [ ] Error handling covers all failure modes?

**If any box unchecked → DO NOT FLIP GUARD**

---

## APPENDIX: File Dependencies

### Files That Must Update Before Guard Flip

- `src/supabaseClient.ts` — Add RPC wrappers for delete operations
- `src/panels/NewInvoiceForm.tsx` — Add post-RPC verification
- `src/panels/BillsPanel.tsx` — Add rollback logic, move status calc to RPC
- `src/panels/RecordPaymentForm.tsx` — Add rollback logic
- `src/utils/invoiceUtils.ts` — Verify calculation matches RPC implementation
- `src/panels/FinancialsPanel.tsx` — Replace hardcoded codes with roles

### Files That Must NOT Change (Read-Only)

- `src/panels/LedgerPanel.tsx` — Trial balance display only
- `src/panels/JournalPanel.tsx` — Journal display only
- `src/documents/*.tsx` — Financial report documents display only


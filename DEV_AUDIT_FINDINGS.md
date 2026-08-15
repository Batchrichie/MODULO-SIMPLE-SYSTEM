# MODULO Database Audit — Development Findings
## Based on Supabase Schema + Live Data Analysis (MODULO DEMO)

**Date:** August 15, 2026  
**Requestor:** Finance/Accounting Team  
**Data Source:** Direct schema inspection + queries on production instance

---

## EXECUTIVE SUMMARY

Three **critical/high-priority** gaps found between workflow documentation and actual implementation:

1. ⚠️ **Invoice posting not guarded** — Unlike `void_invoice()`, no ledger guard verification  
2. ⚠️ **Milestone confirmations have no audit trail** — Silent updates possible, no reversal log  
3. 🔴 **POC is display-only** — GL accounts exist (1150, 2140) but no posting logic exists  

Plus 9 medium/low-priority clarifications detailed below.

---

## CRITICAL FINDINGS

### 1. Invoice Posting Security Gap

**Status:** UNGUARDED  
**Impact:** Ledger integrity at risk

The database has a `ledger_write_guard` trigger that prevents journal writes unless `app.ledger_write_allowed = 'true'`. The `void_invoice()` RPC **explicitly enables this flag** before posting the reversal entry.

**Problem:** Invoice posting (when new invoices are created) is not verified to use the same guarded RPC approach. The posting logic appears to be in application code or triggers, but there's no evidence it's:
- Setting the ledger guard flag
- Running atomically with the invoice record
- Rolling back if posting fails

**Recommendation:**
- Audit the invoice creation flow (likely `NewInvoiceForm.tsx` or a Supabase trigger)
- Ensure posting uses a guarded RPC function like `post_invoice()` (create if doesn't exist)
- Verify atomicity: invoice + GL entry in one transaction, or rollback both on failure

**Timeline:** ASAP — this is a ledger audit risk.

---

### 2. Milestone Reversal Has No Audit Trail

**Status:** UNLOGGED  
**Impact:** Cannot trace who confirmed/reverted stages; "cannot un-confirm" rule is UI-only

Database observations:
- `project_milestones.status` allows transitions back to `Pending` at the DB level (no check constraint preventing it)
- **No audit/history table** exists for milestone status changes (contrast: `invoice_void_audit` exists for void tracking)
- No trigger logs the change event
- No RPC function wraps the reversal

**Current risk:** A PM or admin can silently revert a confirmed milestone, and there's no log of who/when. Completion % changes without trace.

**Recommendation:**
- Add `project_milestones_audit` table (similar to `invoice_void_audit`):
  ```
  project_milestones_audit:
    - id, milestone_id, old_status, new_status, changed_by, changed_at, reason
  ```
- Create `revert_milestone_confirmation()` RPC that enforces audit logging
- Or: Add trigger to block `Confirmed` → non-Confirmed, forcing explicit reversal function

**Timeline:** This sprint (1-2 hours).

---

### 3. POC Revenue Recognition Not Implemented

**Status:** DISPLAY-ONLY / ROADMAP UNCLEAR  
**Impact:** Recognition method field exists but does nothing in GL postings

Database evidence:
- `projects.recognition_method` stores "POC" or "POINT_IN_TIME" ✓
- **Zero functions or triggers branch on this field** ✗
- Test invoice for POC project posts identically to PIT project (straight AR / Revenue / Tax, no WIP accrual)
- GL accounts 1150 (Contract Assets) and 2140 (Unearned Revenue) exist but are never posted to

**What's built:** Storage + display  
**What's missing:** Posting logic, completion % integration, reversal on milestone un-confirmation

**Questions for Product/Architecture:**
1. **Timeline:** Is POC in the backlog? What sprint/quarter?
2. **GL Strategy:** Will we use:
   - **Deferred Revenue approach** (ASC 606): Post earned revenue accruals on milestone confirmation, reduce on invoice
   - **Reporting adjustment approach**: Revenue = invoiced (as-is), add WIP/Earned adjustment in reports
3. **Completion % Method:** Milestone-count only, or add cost-to-cost option?
4. **Trigger:** Automatic on milestone confirmation, or manual "calculate earned revenue" button?

**Recommendation:**
- File RFC for POC design decision
- Until built, consider removing `recognition_method` field from UI or marking it "[Future - POC in backlog]"
- Document current behavior: "All projects recognize revenue on invoice date, regardless of method selected"

**Timeline:** Depends on product roadmap decision.

---

## HIGH-PRIORITY FINDINGS

### 4. Estimated Cost Not Locked

**Status:** UPDATABLE  
**Impact:** Historical cost revisions silently alter margin calculations

Database observation:
- `projects.estimated_cost` is a plain numeric column
- No check constraint, no immutability rule, no audit history
- Direct UPDATE allowed; if UI prevents editing, that's UI-layer only

**Question:** Should estimated cost be:
- (A) **Locked at first invoice** — no changes allowed after billing starts?
- (B) **Editable throughout** — with audit trail?
- (C) **Immutable forever** — locked at creation?

**Recommendation:**
- Define immutability policy
- If locked: Add trigger to prevent updates after first invoice posted, or always:
  ```sql
  ALTER TABLE projects
  ADD CONSTRAINT ck_estimated_cost_immutable
  CHECK (estimated_cost = (SELECT estimated_cost FROM projects_history LIMIT 1));
  ```
- Add `projects_audit` table if (B) option chosen

**Timeline:** Next sprint (1 hour).

---

### 5. Milestone Creation Flow Unclear

**Status:** APP-CODE ONLY  
**Impact:** Documentation contradicts with actual flow

Database observation:
- No trigger on `projects` auto-creates milestones
- No RPC function enforces atomic creation
- Zero milestones in test instance despite projects existing

**Question:** Does the "New Project" modal:
- (A) Include a stage builder that saves milestones atomically with the project, OR
- (B) Redirect post-save to a separate milestone manager page?

**Impact on users:**
- Option A: Milestones always exist (can't have orphan projects)
- Option B: Can create projects without stages (incomplete setup risk)

**Recommendation:** Check `src/panels/ProjectsPanel.tsx` and document the actual flow in the workflow guide.

**Timeline:** This sprint (0.5 hours, documentation only).

---

## MEDIUM-PRIORITY FINDINGS

### 6. Tax Computation — Verified ✓

Live data confirmed: VAT (15%) and NHIL (2.5%) are computed independently on the discounted subtotal (per Ghana VAT Act 1151 comment in code). **No action needed.**

**Note:** In GL posting, NHIL and GETFund are combined into 2205 (NHIL Payable). If tax filing requires them separated, flag this during GRA reconciliation.

---

### 7. Discount Application — Verified ✓

Invoice-level discount confirmed (not per-line). `invoices.discount_pct` applied once to subtotal. **No action needed.**

---

### 8. Exchange Rate Staleness Warning Missing

**Status:** NICE-TO-HAVE  
**Impact:** Accountant may use outdated FX rate without warning

Database observation:
- `invoices.exchange_rate` is manual entry per invoice (default 11.2, editable)
- No rate history table, no external API, no `updated_at` timestamp
- Test data shows different rates with no visibility into currency of rates

**Recommendation:**
- Add UI hint to Invoice form:
  ```
  Exchange Rate (USD→GHS): [11.20]
  Last rate update: 2 days ago
  [ Fetch current rate ] [ Use this rate ]
  ```
- Requires integration with BOG or market data source (or manual admin workflow)

**Timeline:** Backlog, ~2 hours.

---

### 9. WIP Margin Is Cash/Billing-Based (Not Progress-Based)

**Status:** BY DESIGN  
**Impact:** Can mislead if using POC method

Database observation:
- WIP Margin = Revenue Billed − Actual Cost (frontend calculation)
- This is accurate for **cash flow tracking** but not for **economic profitability** if using POC

**Example scenario:**
```
Contract: 100k, Completion: 50%
Revenue Billed: 30k (under-billed)
Actual Cost: 60k (over-spent)
WIP Margin: -30k (negative)

But economically (POC basis):
Earned Revenue: 50k (50% × 100k contract)
WIP Margin (economic): -10k (50k − 60k)
```

**Recommendation:**
- Document that WIP Margin is **billing-based, not progress-based**
- Once POC is implemented, add "Economic Margin (POC Basis)" metric for comparison
- Add note to Project card: "WIP Margin shows cash profit. Use [Earned Revenue Report] for POC-based economic margin."

**Timeline:** Documentation now, metric addition with POC implementation.

---

### 10. Void Invoices Net Correctly in Journal-Based Reports ✓

Verified: Reversals are posted correctly and automatically net out in journal sums. **No action needed.**

**Caveat:** If any report filters by `invoices.status <> 'Void'` directly (instead of summing journals), verify it's consistent with this journal-netting logic.

---

## SUMMARY TABLE

| Issue | Type | Status | Owner | Effort | Sprint |
|-------|------|--------|-------|--------|--------|
| Invoice posting guard | 🔴 Critical | Verify needed | Backend | 2-3h | ASAP |
| Milestone audit trail | 🔴 Critical | Build required | DB / Backend | 1-2h | This |
| POC implementation | 🟡 Roadmap | Decision needed | Product | - | TBD |
| Estimated cost lock | 🟡 High | Define + build | DB / Backend | 1h | Next |
| Milestone creation flow | 🟡 High | Clarify | Frontend | 0.5h | Docs |
| Exchange rate warning | 🟢 Medium | Nice-to-have | Frontend | 2h | Backlog |
| WIP margin clarity | 🟢 Medium | Document | Docs | 0.5h | Now |

---

## NEXT STEPS

1. **Immediate:** Run trace on invoice posting flow to confirm ledger guard usage
2. **This Sprint:** Add milestone audit table + reversal RPC
3. **Backlog:** Clarify POC roadmap + decision
4. **Documentation:** Update workflow guide with findings

**Questions?** Refer to `/memories/repo/database-findings-vs-workflow-doc.md` for detailed analysis.

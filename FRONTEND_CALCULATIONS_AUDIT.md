# Frontend Business Calculations Audit

**Scope:** All JavaScript/TypeScript business logic calculations in the frontend that operate on data, regardless of whether output is display-only or persisted.

**Date:** 2026-08-15

---

## 1. INVOICE CALCULATIONS

### 1.1 computeInvoiceTotals()
- **File:** `src/utils/invoiceUtils.ts:21-40`
- **Calculation:** 
  - `subtotal = sum(qty * rate)` for items with lineType="item"
  - `discount = subtotal * (discountPct / 100)`
  - `newSubtotal = subtotal - discount`
  - `nhilGetfund = chargeNhil ? newSubtotal * nhilGetfundRate : 0`
  - `vat = chargeVat ? newSubtotal * vatRate : 0`
  - `grandTotal = newSubtotal + nhilGetfund + vat`
- **DB Fields Used:** `items[].qty`, `items[].rate`, `discountPct`, `nhilGetfundRate`, `vatRate`, `chargeNhil`, `chargeVat`
- **Output Type:** **PERSISTED** — result stored in `invoice.totals` and written to database
- **Call Sites:** 
  - `NewInvoiceForm.tsx:117` (useMemo during form)
  - `NewInvoiceForm.tsx:120` (during create())
  - `InvoicingPanel.tsx:289` (recompute for display)
  - `InvoiceDocument.tsx:32` (resolveTotalsGHS via recalc)
- **Duplicate Risk:** ⚠️ **HIGH** — Called 4+ places, logic not centralized for persistence vs display

### 1.2 getInvoiceGrandTotalGHS()
- **File:** `src/utils/invoiceUtils.ts:61-77`
- **Calculation:** 
  - Returns stored `invoice.totals.grandTotalGHS` if finite and > 0
  - Else recomputes via `computeInvoiceTotals()` and applies exchange rate
- **DB Fields Used:** `invoice.totals.grandTotalGHS`, `invoice.totals.grandTotal`, `invoice.items`, `invoice.discountPct`, `invoice.currency`, `invoice.exchangeRate`, `data.nhilGetfundRate`, `data.vatRate`
- **Output Type:** **DISPLAY ONLY** — used for UI rendering, not persisted directly (totals already persisted)
- **Call Sites:**
  - `InvoicingPanel.tsx:291` (table display)
  - `getInvoiceBalance()` (which is used widely)
  - `InvoiceDocument.tsx` (PDF rendering)
  - `ReceiptDocument.tsx` (implied)
- **Dependency:** Calls `computeInvoiceTotals()` as fallback if stored value missing

### 1.3 getInvoicePaidAmount()
- **File:** `src/utils/invoiceUtils.ts:51-58`
- **Calculation:** Sum of `invoice.payments[].amountGHS`
- **DB Fields Used:** `invoice.payments[].amountGHS`
- **Output Type:** **DISPLAY ONLY**
- **Call Sites:**
  - `InvoicingPanel.tsx:292` (table display)
  - `getInvoiceBalance()` (dependency)
  - `RecordPaymentForm.tsx` (balance calculation before/after payment)

### 1.4 getInvoiceBalance()
- **File:** `src/utils/invoiceUtils.ts:78-85`
- **Calculation:** `balance = max(grandTotal - paid, 0)`
- **DB Fields Used:** Derived from above (grandTotal, paid)
- **Output Type:** **DISPLAY ONLY**
- **Call Sites:**
  - `InvoicingPanel.tsx:293` (table display)
  - `RecordPaymentForm.tsx:22` (balance before recording payment)
  - `InvoiceDocument.tsx:213` (getDueStatus)

### 1.5 getDueStatus()
- **File:** `src/documents/InvoiceDocument.tsx:215-225`
- **Calculation:** 
  - Compares invoice date + dueDate vs today to determine "Overdue", "Due soon", "Not due"
  - Computes days until/past due
- **DB Fields Used:** `invoice.date`, `invoice.dueDate`
- **Output Type:** **DISPLAY ONLY** (invoice hero status badge)
- **Call Sites:** `InvoiceDocument.tsx:88` (PDF rendering)

### 1.6 resolveTotalsGHS()
- **File:** `src/documents/InvoiceDocument.tsx:28-48`
- **Calculation:** 
  - Recomputes all invoice totals from line items to work around legacy storage bugs
  - Applies exchange rate conversion (USD → GHS)
- **DB Fields Used:** `invoice.items`, `invoice.discountPct`, `data.nhilGetfundRate`, `data.vatRate`, `invoice.exchangeRate`, `invoice.totals.chargeNhil`, `invoice.totals.chargeVat`
- **Output Type:** **DISPLAY ONLY** — used only for PDF rendering to ensure accuracy
- **Rationale:** Comment says "Stored inv.totals may contain corrupted values from legacy save bugs"
- **Dependency:** Calls `computeInvoiceTotals()` and applies rate conversion

### 1.7 Line item amount (qty × rate)
- **File:** `src/documents/InvoiceDocument.tsx:351`
- **Calculation:** `qty * rate` for each invoice item line
- **DB Fields Used:** `item.qty`, `item.rate`
- **Output Type:** **DISPLAY ONLY** (PDF table cell)

### 1.8 Currency conversion multiplier
- **File:** `NewInvoiceForm.tsx:117-130`
- **Calculation:** 
  ```
  rate = currency === "USD" ? parseFloat(exchangeRate) || 1 : 1
  then multiply all totals by rate for GHS columns
  ```
- **DB Fields Used:** `currency`, `exchangeRate`
- **Output Type:** **PERSISTED** — stored as separate `*GHS` fields in `invoice.totals`
- **Duplicate:** Same logic in `InvoiceDocument.tsx:47`

---

## 2. PAYROLL CALCULATIONS

### 2.1 YTD Totals Aggregation
- **File:** `src/portals/shared/MyStatementPanel.tsx:67-82`
- **Calculation:** 
  ```
  sum(gross, ssnitEmployee, ssnitEmployer, paye, net)
  across all yearPayslips (filtered to current year)
  ```
- **DB Fields Used:** `data.payrollRuns[].rows[].gross/ssnitEmployee/ssnitEmployer/paye/net`
- **Output Type:** **DISPLAY ONLY** (dashboard cards, YTD summary table)
- **Call Sites:**
  - `MyStatementPanel.tsx:90+` (multiple cards)
  - `MyStatementPanel.tsx:349` (yearly summary table)

### 2.2 Effective Tax Rate
- **File:** `src/portals/shared/MyStatementPanel.tsx:90`
- **Calculation:** `((ytd.ssnitEmployee + ytd.paye) / ytd.gross) * 100` if `ytd.gross > 0` else 0
- **DB Fields Used:** Derived (ytd.ssnitEmployee, ytd.paye, ytd.gross)
- **Output Type:** **DISPLAY ONLY** (dashboard card, breakdown bar)
- **Duplicate:** ⚠️ Similar logic in `MyPayslipsPanel.tsx:252`

### 2.3 Take-Home Ratio
- **File:** `src/portals/shared/MyStatementPanel.tsx:235`
- **Calculation:** `100 - effectiveTaxRate`
- **DB Fields Used:** Derived
- **Output Type:** **DISPLAY ONLY**

### 2.4 Average Monthly Net
- **File:** `src/portals/shared/MyStatementPanel.tsx:93`
- **Calculation:** `ytd.net / yearPayslips.length` if `length > 0` else 0
- **DB Fields Used:** Derived (ytd.net)
- **Output Type:** **DISPLAY ONLY** (dashboard card)

### 2.5 Employer Contributions Total
- **File:** `src/portals/shared/MyStatementPanel.tsx:96`
- **Calculation:** `ytd.ssnitEmployer`
- **DB Fields Used:** Derived (payroll run rows)
- **Output Type:** **DISPLAY ONLY** (dashboard card)

### 2.6 All-Time Payslip Aggregation
- **File:** `src/portals/shared/MyStatementPanel.tsx:72-83`
- **Calculation:** 
  ```
  group payslips by year
  sum gross and net per year
  ```
- **DB Fields Used:** `data.payrollRuns[].rows[].gross/net`
- **Output Type:** **DISPLAY ONLY** (yearly comparison table)

### 2.7 Total Deductions (Monthly Breakdown)
- **File:** `src/portals/shared/MyStatementPanel.tsx:291`
- **Calculation:** `p.ssnitEmployee + p.paye`
- **DB Fields Used:** `payslip.ssnitEmployee`, `payslip.paye`
- **Output Type:** **DISPLAY ONLY**
- **Duplicate:** ⚠️ Also in `MyPayslipsPanel.tsx:234`, `Payslip.tsx:32`

### 2.8 Payslip YTD Amounts
- **File:** `src/documents/Payslip.tsx:32-36`
- **Calculation:**
  ```
  ytdGross = r.gross * Number(month)
  ytdTax = r.paye * Number(month)
  ytdSsnit = r.ssnitEmployee * Number(month)
  ytdNet = ytdGross - ytdTax - ytdSsnit
  ```
- **DB Fields Used:** `payrollLine.gross/paye/ssnitEmployee`, run period month
- **Output Type:** **DISPLAY ONLY** (payslip document, YTD section)
- **Assumption:** Assumes salary and taxes are uniform per month (multiplies by month number)
- **Risk:** ⚠️ If an employee's rate changed mid-year, this will be inaccurate

### 2.9 Employer Cost to Company
- **File:** `src/documents/Payslip.tsx:393`
- **Calculation:** `r.gross + r.ssnitEmployer`
- **DB Fields Used:** `payrollLine.gross`, `payrollLine.ssnitEmployer`
- **Output Type:** **DISPLAY ONLY** (payslip employer section)

### 2.10 Deduction Breakdown Percentage
- **File:** `src/portals/shared/MyPayslipsPanel.tsx:252`
- **Calculation:** `((p.ssnitEmployee + p.paye) / p.gross) * 100` if `p.gross > 0` else 0
- **DB Fields Used:** Derived
- **Output Type:** **DISPLAY ONLY** (deduction bar visualization)
- **Duplicate:** ⚠️ Same as effective tax rate in MyStatementPanel

---

## 3. JOURNAL & ACCOUNT BALANCE CALCULATIONS

### 3.1 computeAccountTotals()
- **File:** `src/panels/JournalEntryForm.tsx:27-41`
- **Calculation:** 
  ```
  sum debit and credit across all journal entries
  for a specific account code
  ```
- **DB Fields Used:** `data.journal[].lines[].account/debit/credit`
- **Output Type:** **DISPLAY ONLY** (shows running balance in entry form)
- **Call Sites:** `JournalEntryForm.tsx:75` (useMemo pre-computation)

### 3.2 Journal Entry Balance Validation
- **File:** `src/panels/JournalEntryForm.tsx:77-79`
- **Calculation:** 
  ```
  totalDebit = sum(line.debit)
  totalCredit = sum(line.credit)
  diff = totalDebit - totalCredit
  balanced = (diff === 0 && totalDebit > 0)
  ```
- **DB Fields Used:** Entered line values (debit/credit)
- **Output Type:** **VALIDATION** (prevents unbalanced entry from posting) + display
- **Call Sites:** `validation.ts` (assertJournalEntry also does this)

### 3.3 Trial Balance per Account
- **File:** `src/panels/LedgerPanel.tsx:43-68`
- **Calculation:** 
  ```
  For each account:
    debit = sum(line.debit where account matches)
    credit = sum(line.credit where account matches)
    rawBalance = (account.normal === "Debit" ? debit - credit : credit - debit)
    balance = abs(rawBalance)
    balanceSide = (rawBalance >= 0 ? normal : opposite)
  ```
- **DB Fields Used:** `data.accounts[].normal`, `data.journal[].lines[].account/debit/credit`
- **Output Type:** **DISPLAY ONLY** (trial balance table, KPI cards)
- **Duplicate:** ⚠️ Nearly identical logic in `ExportPanel.tsx:71-95` for Excel export

### 3.4 Trial Balance Totals & Balancing Check
- **File:** `src/panels/LedgerPanel.tsx:65-66`
- **Calculation:** 
  ```
  totalDebit = sum all row.debit
  totalCredit = sum all row.credit
  isBalanced = abs(totalDebit - totalCredit) < 0.01
  ```
- **DB Fields Used:** Derived from above
- **Output Type:** **DISPLAY ONLY** (footer status indicator)

### 3.5 accountNormalSide()
- **File:** `src/panels/JournalEntryForm.tsx:43-50`
- **Calculation:** 
  ```
  If account.type is "asset" or "expense" → "debit"
  If account.type is "liability", "equity", "revenue", "income" → "credit"
  ```
- **DB Fields Used:** `account.type`
- **Output Type:** **DISPLAY ONLY** (used for balance visualization logic)

### 3.6 signedBalance()
- **File:** `src/panels/JournalEntryForm.tsx:52-57`
- **Calculation:** 
  ```
  If normalSide === "debit" → debit - credit
  If normalSide === "credit" → credit - debit
  Else → debit - credit
  ```
- **DB Fields Used:** Derived (totals + normal side)
- **Output Type:** **DISPLAY ONLY** (running balance display)

### 3.7 Journal Summary Stats
- **File:** `src/panels/JournalPanel.tsx:152-182`
- **Calculation:**
  ```
  count = number of entries (filtered)
  totalDebits = sum all lines.debit
  totalCredits = sum all lines.credit
  uniqueAccounts = set(account codes touched)
  first, last = min/max dates
  ```
- **DB Fields Used:** `data.journal[].date/lines[].account/debit/credit`
- **Output Type:** **DISPLAY ONLY** (summary cards in panel)

### 3.8 Journal Entry Balanced Status
- **File:** `src/documents/TrialBalanceDocument.tsx:8`
- **Calculation:**
  ```
  totalDebit = sum all debit
  totalCredit = sum all credit
  ```
- **DB Fields Used:** `tbData[].debit/credit` (from database view)
- **Output Type:** **DISPLAY ONLY** (printed trial balance totals)

---

## 4. CASH FLOW & DASHBOARD CALCULATIONS

### 4.1 computeCashFlow()
- **File:** `src/utils/dashboardUtils.ts:12-35`
- **Calculation:**
  ```
  1. Identify cash account codes (by isPaymentAccount flag or Asset 1xxx range)
  2. For each journal entry (sorted by date):
     - net = sum(debit - credit) for lines touching cash accounts
     - running = cumulative net
     - build chart data row
  ```
- **DB Fields Used:** `data.accounts[].isPaymentAccount/type/code`, `data.journal[].date/lines[].account/debit/credit`
- **Output Type:** **DISPLAY ONLY** (cash flow chart data)
- **Call Sites:** `FinancialsPanel.tsx:24` (useMemo)

### 4.2 getDashboardMetrics()
- **File:** `src/utils/dashboardUtils.ts:39-130`
- **Calculations:**
  1. **Cash balance:** Sum net for payment/asset accounts
  2. **AR balance:** Sum debit for AR codes
  3. **AP balance:** Sum credit for AP codes
  4. **Net income:** Revenue - Expenses from journal
  5. **Revenue/Expenses:** Sum by account type
  6. **Project metrics:** Contract value, estimated/actual cost, gross margin
  7. **Monthly revenue/expense:** Breakdown by month (last 6 months)
  8. **Donut chart:** Project contract values
- **DB Fields Used:** 
  - `data.accounts[].type/code/isPaymentAccount`
  - `data.journal[].lines[].account/debit/credit/date`
  - `data.invoices[].project/totals.grandTotal`
  - `data.bills[].project/amount`
  - `data.projects[].contractValue/estimatedCost`
- **Output Type:** **DISPLAY ONLY** (KPI cards, charts)
- **Duplicate:** ⚠️ Some logic (cash balance, account summation) overlaps with LedgerPanel

### 4.3 Monthly Revenue/Expense Aggregation
- **File:** `src/utils/dashboardUtils.ts:85-109`
- **Calculation:**
  ```
  For each month in last 6:
    revenue += sum(debit where account.type === "Revenue")
    expense += sum(debit where account.type === "Expense")
  Create bar chart data: [month, revenue, expense]
  ```
- **DB Fields Used:** `data.journal[].lines[].account/debit/date`, `data.accounts[].type`
- **Output Type:** **DISPLAY ONLY** (bar chart)

### 4.4 Project Gross Margin
- **File:** `src/utils/dashboardUtils.ts:117-124`
- **Calculation:**
  ```
  projectedGrossMargin = totalContractValue - totalActualCost
  projectedMarginPct = (grossMargin / totalContractValue) * 100
  ```
- **DB Fields Used:** Derived from project metrics
- **Output Type:** **DISPLAY ONLY** (KPI card)

---

## 5. BILL & PAYABLE CALCULATIONS

### 5.1 Bill Payment Status Update
- **File:** `src/panels/BillsPanel.tsx:146-157`
- **Calculation:**
  ```
  paidSoFar = sum(bill.payments) + new payment amount
  newStatus = (paidSoFar >= bill.amount - 0.01) ? "Paid" : "Partially Paid"
  ```
- **DB Fields Used:** `bill.amount`, `bill.payments[].amount`
- **Output Type:** **PERSISTED** — updates `bill.status` which is written to database
- **Risk:** ⚠️ Status determination happens in frontend, not enforced server-side

### 5.2 Bill Balance
- **File:** `src/panels/BillsPanel.tsx:203` (loop), and generally:
- **Calculation:** `balance = bill.amount - paidSoFar`
- **DB Fields Used:** `bill.amount`, `bill.payments[].amount`
- **Output Type:** **DISPLAY ONLY** (table balance column)

### 5.3 Invoice Payment Status
- **File:** `src/panels/RecordPaymentForm.tsx:27-28`
- **Calculation:**
  ```
  paidSoFar = getInvoicePaidAmount(inv) + new payment
  newStatus = (paidSoFar >= grandTotal - 0.01) ? "Paid" : "Partially Paid"
  ```
- **DB Fields Used:** `invoice.payments[].amountGHS`, `invoice.totals.grandTotalGHS`
- **Output Type:** **PERSISTED** — updates `invoice.status` written to database
- **Risk:** ⚠️ Same as bill status; frontend-side determination

---

## 6. VALIDATION CALCULATIONS

### 6.1 assertJournalEntry()
- **File:** `src/validation.ts:10-35`
- **Calculation:**
  ```
  1. Check: date is not empty
  2. Check: description is not empty/whitespace
  3. Filter lines: account exists AND (debit > 0 OR credit > 0)
  4. Check: at least 2 valid lines
  5. totalDebit = sum debit
  6. totalCredit = sum credit
  7. Check: abs(totalDebit - totalCredit) < 0.01 (balanced)
  ```
- **DB Fields Used:** Form input values (date, description, lines)
- **Output Type:** **VALIDATION** (blocks posting if fails)

### 6.2 Journal Entry Form Balance Display
- **File:** `src/panels/JournalEntryForm.tsx:376-397`
- **Calculation:** 
  ```
  Display: Debits, Credits, Difference
  Color code based on balance status
  ```
- **DB Fields Used:** Entry lines being edited
- **Output Type:** **DISPLAY ONLY** (form feedback)

---

## 7. FINANCIAL REPORT GROUPING (DATABASE-SIDE CATEGORY)

### 7.1 Balance Sheet Current Assets Filter
- **File:** `src/panels/FinancialsPanel.tsx:92-93`
- **Calculation:** Filter `bsData` rows where `code IN ['1000','1100','1200','1300','1400']`
- **DB Fields Used:** `account.code` (from DB view result)
- **Output Type:** **DISPLAY ONLY** (financial statement grouping)
- **Hardcoded Risk:** ⚠️ Codes are hardcoded, not from account roles
- **Alternative:** Now attempting role-based via `getCurrentAssets()` helper

### 7.2 Profit & Loss Category Splitting
- **File:** `src/panels/FinancialsPanel.tsx:65-68`
- **Calculation:**
  ```
  costOfSales = expenses where (code >= 5000 && code < 6000)
  adminExpenses = expenses where NOT in costOfSales range
  ```
- **DB Fields Used:** `account.code`
- **Output Type:** **DISPLAY ONLY** (financial statement sections)
- **Hardcoded Risk:** ⚠️ Code range hardcoded, not configurable

### 7.3 P&L Totals
- **File:** `src/panels/FinancialsPanel.tsx:70-80`
- **Calculation:**
  ```
  totalRevenue = sum(revenue amounts)
  totalCostOfSales = sum(COGS)
  grossProfit = totalRevenue - totalCostOfSales
  totalAdminExpenses = sum(admin)
  operatingProfit = grossProfit - totalAdminExpenses
  netProfit = operatingProfit
  ```
- **DB Fields Used:** Derived from account grouping
- **Output Type:** **DISPLAY ONLY** (financial statement totals)

### 7.4 Balance Sheet Totals
- **File:** `src/panels/FinancialsPanel.tsx:98-109`
- **Calculation:**
  ```
  totalCurrentAssets = sum(currentAssets)
  totalNonCurrentAssets = sum(nonCurrentAssets)
  totalAssets = current + nonCurrent
  totalCurrentLiabilities = sum(liabilities)
  totalEquity = sum(equity) + netProfit
  totalLiabilitiesAndEquity = liabilities + equity
  ```
- **DB Fields Used:** Derived from account groupings
- **Output Type:** **DISPLAY ONLY** (financial statement totals)
- **Balance Check:** totalAssets should equal totalLiabilitiesAndEquity (implicit validation)

---

## SUMMARY TABLE

| Domain | Count | Persisted | Display-Only | Duplicates | Risk Level |
|--------|-------|-----------|--------------|------------|------------|
| Invoice | 8 | 2 | 6 | ⚠️ HIGH (4+ call sites) | MEDIUM |
| Payroll | 10 | 0 | 10 | ⚠️ MEDIUM (tax rate recalc) | LOW |
| Journal/Balance | 8 | 0 | 8 | ⚠️ MEDIUM (Trial balance) | LOW |
| Cash Flow/Dashboard | 4 | 0 | 4 | ⚠️ LOW (some overlap) | MEDIUM |
| Bills/Payables | 4 | 2 | 2 | ⚠️ LOW | MEDIUM |
| Validation | 2 | 0 | 1 (block) | None | LOW |
| Financial Reports | 4 | 0 | 4 | ⚠️ MEDIUM (hardcoded codes) | **HIGH** |
| **TOTAL** | **40** | **4** | **35** | | |

---

## KEY FINDINGS

### Calculations That Affect Business State (Persisted)
1. **Invoice totals** — stored in `invoice.totals`, used for invoicing
2. **Invoice status** — updated based on payment tracking
3. **Bill status** — updated based on payment tracking
4. **Currency conversion** — separate GHS columns in totals

### High-Risk Areas
1. **Duplicate Payroll Tax Rate Calculation** — effective tax rate computed in at least 2 places (MyStatementPanel, MyPayslipsPanel)
2. **Trial Balance Duplication** — nearly identical logic in LedgerPanel and ExportPanel
3. **YTD Payslip Assumption** — assumes uniform monthly salary/taxes; will be inaccurate if rates change mid-year
4. **Hardcoded Account Code Ranges** — Balance sheet (1000-1400) and P&L (5000-6000) groupings use fixed codes
5. **Frontend Payment Status Determination** — bill/invoice status updated in frontend without server-side enforcement
6. **Cash Balance Fallback Logic** — tries isPaymentAccount flag, then falls back to regex on code (1xxx); potential for confusion

### Calculations NOT Found in Frontend (Server-Side Only)
- PAYE bracket application (payroll run posted via RPC)
- SSNIT employee/employer rate application (via RPC)
- Journal entry posting logic
- Invoice posting & reversal (via RPC as of recent changes)
- Trial Balance / Balance Sheet / P&L (now fetched from database views/RPC)

### Missing Verifications
- No validation that payment dates are <= invoice/bill date
- No validation that payment amounts don't exceed outstanding balance (frontend displays only, RPC may enforce)
- No validation that currency conversion rates are positive
- No audit trail for status changes (bill/invoice paid → marked Paid)

---

## NEXT STEPS FOR REVIEW

1. **Verify** which calculations should be moved server-side vs. frontend display
2. **Consolidate** duplicate tax rate calculations into single utility
3. **Extract** hardcoded account codes to configuration or account roles
4. **Test** edge cases in bill/invoice payment status (partial, overpayment, reversal)
5. **Check** RPC implementations for matching logic (ensure frontend ≠ server calculations)

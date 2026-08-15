# MODULO-SIMPLE-SYSTEM: Complete Project Accounting Workflow
## Comprehensive Guide for Accountants & Finance Teams

**Document Version:** 1.0  
**Last Updated:** August 2026  
**System:** MODULO-SIMPLE-SYSTEM (Supabase + React + TypeScript)

---

## TABLE OF CONTENTS

1. [System Overview](#system-overview)
2. [Project Creation Workflow](#project-creation-workflow)
3. [Cost Tracking & Expense Recording](#cost-tracking--expense-recording)
4. [Revenue Recognition Methods](#revenue-recognition-methods)
5. [Milestone/Stage Tracking](#milestonestage-tracking)
6. [Invoice Creation & Revenue Posting](#invoice-creation--revenue-posting)
7. [Financial Reporting & Analysis](#financial-reporting--analysis)
8. [Project Closure & Final Accounting](#project-closure--final-accounting)
9. [Key Formulas & Calculations](#key-formulas--calculations)
10. [User Workflows by Role](#user-workflows-by-role)
11. [Integration Points & Data Flow](#integration-points--data-flow)
12. [Database Schema & Data Types](#database-schema--data-types)
13. [Common Scenarios & Examples](#common-scenarios--examples)

---

## SYSTEM OVERVIEW

### Purpose
MODULO-SIMPLE-SYSTEM is a project-based accounting system designed for construction and services companies. It tracks:
- **Project financials** (contracts, budgets, actual costs)
- **Revenue recognition** using two methods: Point-in-Time (PIT) or Percentage of Completion (POC)
- **Milestone progress** for project stages
- **Cost tracking** via journal entries and quick-expense entry
- **Invoicing** for customer billing
- **Financial statements** (Income Statement, Balance Sheet, Cash Flow, Trial Balance)

### Key Entities
1. **Projects** — Main engagement/contract unit
2. **Invoices** — Customer billings for revenue
3. **Journal Entries** — Double-entry accounting postings
4. **Expenses** — Quick cost recording tied to projects
5. **Milestones/Stages** — Project progress tracking
6. **Financial Statements** — Generated GL reports

### User Roles & Portal Access
| Role | Portal | Primary Functions |
|------|--------|-------------------|
| **Finance/Accountant** | CEO Dashboard | Create projects, post expenses, invoice, monitor reports |
| **Project Manager** | PM Portal | Confirm project milestones, upload site reports, track issues |
| **Payroll Manager** | CEO Dashboard | Run payroll, manage employees |
| **Employee** | My Portal | View payslips, timesheets |
| **Admin** | CEO Dashboard | Configure accounts, tax rates, settings |

---

## PROJECT CREATION WORKFLOW

### Step 1: Navigate to Projects Panel
**Location:** CEO Dashboard → "Projects" section  
**Permission Required:** Finance or Admin role

### Step 2: Click "New Project" Button
Opens modal: "New Project Engagement"

### Step 3: Fill in Project Details

#### Required Fields:
| Field | Type | Description | Example |
|-------|------|-------------|---------|
| **Project Name** | Text | Unique project identifier | "East Legon Villa Construction" |
| **Project Type** | Select | Category of work | "Construction", "Renovation", "Design" |
| **Status** | Select | Project state | "Active" or "Complete" |
| **Recognition Method** | Select | Revenue recognition approach | **POC** (default) or **POINT_IN_TIME** |
| **Contract Value (GHS)** | Number | Total contract amount | 250,000 |
| **Estimated Cost (GHS)** | Number | Budgeted project cost | 180,000 |

#### Financial Parameters Explained:
- **Contract Value**: The agreed fee/revenue from the client
- **Estimated Cost**: Your budgeted total expense (labor, materials, overhead)
- **Projected Margin = Contract Value - Estimated Cost**
  - Example: 250,000 - 180,000 = 70,000 (gross profit target)

### Step 4: Define Project Milestones/Stages
**Sub-component:** Stage Builder (appears after selecting project type)

#### Milestone Setup:
1. Click **"Add Stage"** button
2. Enter stage name (e.g., "Foundation", "Framing", "Finishing")
3. **Drag to reorder** stages (order determines progress calculation)
4. **Remove** any unwanted stages
5. Click **"Save Stages"**

#### Important Notes:
- Milestones must be created AFTER saving the project (not in creation modal)
- **Stage Order matters**: Order 1, 2, 3, etc. determines % completion calculation
- Minimum 1 milestone required for meaningful progress tracking
- Example stage sequence:
  - Stage 1: Design & Permits
  - Stage 2: Foundation
  - Stage 3: Structural Work
  - Stage 4: Finishing
  - Stage 5: Handover

### Step 5: Save Project
Click **"Save Project Engagement"** button
- New projects created with ID: `PRJ-<TIMESTAMP>`
- Initial status: **Active**
- All stages created with status: **pending** (not confirmed)

### Post-Creation Actions:
1. **Assign team members** (optional, in PM Portal)
2. **Document creation** (designs, permits, etc.)
3. **Begin milestone tracking** (PM Portal confirms stages)
4. **Start cost recording** (Expenses Panel)

---

## COST TRACKING & EXPENSE RECORDING

### Overview
Costs are recorded via two methods:
1. **Quick Expenses** (simplified entry via Expenses Panel)
2. **Journal Entries** (full double-entry accounting)

---

### Method 1: Quick Expense Entry (Recommended for Day-to-Day Costs)

**Location:** CEO Dashboard → "Quick Expenses" section

#### Step-by-Step:

1. **Click "New Expense" button**
   - Opens: "Record Quick Expense" modal

2. **Fill in expense details:**

| Field | Description | Required? | Example |
|-------|-------------|-----------|---------|
| Date | Expense date | Yes | 2026-08-15 |
| Vendor | Supplier/vendor name | No | "ABC Materials Ltd" |
| Description | What was purchased/service | Yes | "Cement and sand for foundation" |
| Amount (GHS) | Cost | Yes | 5,000 |
| Expense Account | GL account category | Yes | "6100 - Materials & Supplies" |
| Payment Account | Cash/bank account paid from | Yes | "1100 - Cash at Bank" |
| Project | Assign to project | Yes | "East Legon Villa" (or "General" if not project-specific) |

3. **Post Expense**
   - System automatically creates journal entry:
     - **Debit:** Expense Account (6100) ... 5,000
     - **Credit:** Payment Account (1100) ... 5,000
   - Entry Number: `JE-EXP-0001`, `JE-EXP-0002`, etc.
   - **Project field** populated if selected

4. **Review in Expense History**
   - Shows recent 20 expenses
   - Total expenses calculated
   - Can filter by date, project

#### Cost Tracking for Projects:
- Every expense linked to a project via journal entry `.project` field
- **Actual Cost for Project = Sum of all expense debits for that project**
- Example calculation:
  ```
  Project "East Legon Villa" Expenses:
  - JE-EXP-0001: Materials (5,000)
  - JE-EXP-0002: Labor (8,000)
  - JE-EXP-0003: Transport (2,000)
  ─────────────────────
  Actual Cost to Date: 15,000
  ```

---

### Method 2: Full Journal Entry (For Complex Transactions)

**Location:** CEO Dashboard → "Journal" section

#### When to Use:
- Multi-account transactions
- Allocations, accruals, adjustments
- Intercompany transactions
- Cost reversals

#### Step-by-Step:
1. Click **"New Entry"**
2. Fill in:
   - **Date**: Transaction date
   - **Description**: Detailed description
   - **Project**: (Optional) Assign to project
3. **Add Lines:**
   - Account, Debit, Credit
   - Must balance (Total Debits = Total Credits)
4. **Post Entry**
   - Entry Number auto-assigned: `JE-0001`, `JE-0002`, etc.
   - Stored in `journal` table

#### Example: Labor Cost Allocation
```
JE-0042: Wages for Foundation (25-Aug-2026)
Dr. 6200 - Wages & Salaries          12,000
   Cr. 1100 - Cash at Bank                      12,000
   
Project: "East Legon Villa"
```

---

### Remaining Cost Calculation

```
Remaining Cost = Estimated Cost - Actual Cost to Date

Example:
  Estimated Cost: 180,000 (from project form)
  Actual Cost:     15,000 (sum of JE-EXP entries)
  Remaining Cost:  165,000 (work still to do)
```

---

## REVENUE RECOGNITION METHODS

### Overview

MODULO-SIMPLE-SYSTEM supports **two revenue recognition approaches**:

1. **Percentage of Completion (POC)** — Revenue recognized as project progresses
2. **Point-in-Time (PIT)** — Revenue recognized upon project completion

**Status: Recognition method is selected & stored, but automatic POC-based revenue entries are NOT YET IMPLEMENTED.**

Currently, all revenue is recognized when invoiced (cash/accrual method), regardless of method selected.

---

### POC vs PIT: Theory

#### Point-in-Time (PIT)
- Revenue recognized entirely when project is **marked Complete**
- Matches milestone-based or event-driven project delivery
- Simpler for one-off engagements

#### Percentage of Completion (POC)
- Revenue recognized continuously as project progresses
- Based on: `Earned Revenue = Contract Value × (Completion % / 100)`
- Completion % = (Confirmed Milestones / Total Milestones) × 100
- Better matches revenue to effort/risk

### Current Implementation Status

**✅ Implemented:**
- Selection of recognition method during project creation/edit
- Calculation of completion % from milestone status
- Display of method on project cards
- Project stats tracking (contract value, revenue billed, costs)

**⚠️ NOT YET IMPLEMENTED:**
- Automatic journal entries for POC-based revenue accrual
- "Earned Revenue" or "Accrued Revenue" GL postings
- Adjustments when completion % changes
- Cumulative revenue tracking to prevent double-recognition

### How Recognition Method is Set

**During Project Creation:**
```
[Dropdown: "Recognition Method"]
  ☑ Point-in-Time (PIT)
  ☑ Percentage of Completion (POC) ← DEFAULT
```

**Field Location:**
- Database: `projects.recognition_method`
- Application: `Project.recognitionMethod`
- Type: String ("POC" | "POINT_IN_TIME")

### Completion % Calculation

**Formula:**
```
Completion % = (Confirmed Milestones / Total Milestones) × 100
```

**Example:**
- Total Stages: 5 (Design, Foundation, Framing, Finishing, Handover)
- Confirmed: 3 (Design ✓, Foundation ✓, Framing ✓)
- **Completion % = (3/5) × 100 = 60%**

**Future POC Revenue Entry (When Implemented):**
```
If Contract Value = 250,000 and Completion = 60%
Earned Revenue = 250,000 × 0.60 = 150,000

Dr. 1130 - Accounts Receivable          150,000
   Cr. 4100 - Revenue (POC)                        150,000
   
(Only if this is the first/incremental recognition)
```

### Invoicing vs. Revenue Recognition

**Important Distinction:**
- **Invoicing** = Billing customer for work done (creates AR)
- **Revenue Recognition** = Recording revenue in GL per accounting method

**Current Flow:**
1. Accountant creates invoice (regardless of recognition method)
2. Invoice posts to GL immediately:
   - Dr. 1130 - Accounts Receivable ... Amount
   - Cr. 4100 - Revenue ... Amount
3. Invoice status tracked (Sent, Partially Paid, Paid, Void)
4. Payments recorded against invoice

**Completion % tracked but not yet driving automatic revenue entries.**

---

## MILESTONE/STAGE TRACKING

### Overview

Project milestones represent discrete completion points. They track:
- **When work is physically complete** (for POC calculation)
- **Project progress** (for PM reporting)
- **Basis for revenue recognition** (when implemented)

---

### Milestone Data Structure

**Database Table:** `project_milestones` (Supabase)

```
{
  id: "UUID",                    // Auto-generated
  project_id: "PRJ-xxxxx",       // Links to project
  name: "Foundation",            // Stage name
  stage_order: 1,                // Sequence (1, 2, 3...)
  status: "pending" | "confirmed", // Completion status
  confirmed_at: "2026-08-15T10:30:00Z", // When marked done
  confirmed_by: "user-uuid",     // Who confirmed
  notes: "Optional completion notes",
  created_at: "2026-08-10T14:00:00Z"
}
```

### Milestone Lifecycle

#### 1. **Creation (Admin)**
- Defined during project creation via Stage Builder
- Initial status: **pending**
- Assigned sequence order (1, 2, 3, etc.)

#### 2. **Pending State** (Waiting for Confirmation)
- PM can view in PM Portal
- Shows as empty circle ◯
- PM has option to "Confirm" when stage complete

#### 3. **Confirmation by Project Manager**
- PM Portal → Project → Stages section
- Click "Confirm" button on pending stage
- Modal opens with:
  - Stage name & number
  - Optional completion notes field
  - Confirmation button
  
- **Automatic Actions Upon Confirmation:**
  - `status` → "confirmed"
  - `confirmed_at` → Current timestamp
  - `confirmed_by` → Current user ID
  - `notes` → Saved completion notes

#### 4. **Confirmed State**
- Shows checkmark ✓ in green
- Stage struck through in UI
- Contributes to completion %
- Feeds POC calculation (when implemented)

---

### Completion % Used In

#### 1. **PM Portal Dashboard**
- Shows progress bar (0-100%)
- Displays confirmed/total count
- Example: "3 of 5 stages complete = 60%"

#### 2. **Project Cards (Admin Dashboard)**
- Visual indicator of project maturity
- Supports PMs in tracking progress

#### 3. **Financial Reporting** (Future)
- Basis for POC revenue recognition
- Input to earned revenue calculations

---

### Milestone Confirmation Workflow (PM Portal)

**Location:** PM Portal → "Stage Progress" tab (per project)

**Step-by-Step:**

1. **View Project Milestones**
   - See progress bar showing % complete
   - List all stages with status icons
   - Pending stages: ◯ (empty circle)
   - Confirmed stages: ✓ (green checkmark)

2. **Confirm a Milestone**
   - Click **"Confirm"** button on pending stage
   - **Modal appears:**
     ```
     [Title] Confirm Stage Completion
     
     Stage 2: Foundation Construction
     
     [Optional Notes] (textarea)
     "Foundation completed with quality certification"
     
     [Cancel] [Confirm Stage]
     ```

3. **Enter Completion Notes** (Optional)
   - Document any issues, quality notes, sign-offs
   - Helpful for audit trail

4. **Submit Confirmation**
   - Confirmation date/time recorded
   - PM ID recorded
   - Completion % updated immediately
   - Progress bar advances

5. **View Confirmation Details**
   - Confirmed stages show date confirmed
   - Notes display under stage
   - Cannot un-confirm (audit integrity)

---

### Example: 5-Stage Project Tracking

**Initial State (Day 1):**
```
Progress: 0% (0/5 stages)

◯ Stage 1: Design & Permits
◯ Stage 2: Foundation
◯ Stage 3: Framing
◯ Stage 4: Finishing
◯ Stage 5: Handover
```

**After 3 Weeks (Day 21):**
```
Progress: 40% (2/5 stages)

✓ Stage 1: Design & Permits (Confirmed Aug 10)
✓ Stage 2: Foundation (Confirmed Aug 18)
◯ Stage 3: Framing
◯ Stage 4: Finishing
◯ Stage 5: Handover
```

**After 8 Weeks (Day 56):**
```
Progress: 100% (5/5 stages)

✓ Stage 1: Design & Permits (Aug 10)
✓ Stage 2: Foundation (Aug 18)
✓ Stage 3: Framing (Aug 25)
✓ Stage 4: Finishing (Sep 01)
✓ Stage 5: Handover (Sep 08) ← Final confirmation
```

---

## INVOICE CREATION & REVENUE POSTING

### Overview

Invoices are customer billing documents that:
- Record revenue from the client
- Create accounts receivable (AR)
- Automatically post to the general ledger

**Location:** CEO Dashboard → "Invoicing" section

---

### Invoice Creation Workflow

#### Step 1: Click "New Invoice"
- Opens: "New Invoice Form"

#### Step 2: Fill in Invoice Header

| Field | Type | Required? | Description | Example |
|-------|------|-----------|-------------|---------|
| **Bill To** | Text | Yes | Client/customer name | "Mr. Ken and Mr. Kasim" |
| **For Text** | Text | No | Additional billing info | "East Legon Villa Project" |
| **Location** | Text | No | Project site location | "GREATER ACCRA" |
| **Project** | Select | Yes | Link to project | "East Legon Villa Construction" |
| **Date** | Date | Yes | Invoice issue date | 2026-08-15 |
| **Due Date** | Date | No | Payment deadline | 2026-09-15 (if blank, defaults to invoice date) |

#### Step 3: Select Currency & Exchange Rate

| Field | Description | Options |
|-------|-------------|---------|
| **Currency** | Billing currency | GHS (Ghana Cedis) or USD |
| **Exchange Rate** | USD to GHS conversion | Auto-fills (default 11.2), editable |

**Note:** If USD selected, all GHS amounts calculated as: `USD Amount × Exchange Rate`

#### Step 4: Configure Taxes & Discounts

| Field | Description | Default |
|-------|-------------|---------|
| **Charge NHIL** | National Health Insurance Levy (2.5%) | ✓ Enabled |
| **Charge VAT** | Value-Added Tax (15%) | ✓ Enabled |
| **Discount %** | Line item discount | 0% |

**GL Accounts for Taxes:**
- NHIL → Liability 2205
- VAT → Liability 2220

#### Step 5: Add Invoice Items

**Add Item Line:**
1. Enter **Description** (what's being billed)
2. Enter **Unit** (optional, e.g., "days", "ea", "sqm")
3. Enter **Quantity** 
4. Enter **Rate/Unit Price**
5. System calculates: **Line Amount = Qty × Rate**

**Line Types (Optional):**
- **item** (default) — Regular line item (qty × rate)
- **header** — Section header (no amount)
- **sub-detail** — Breakdown detail (no amount)

**Example Invoice Items:**
```
Description              Unit    Qty    Rate      Amount
─────────────────────────────────────────────────────────
Design & Drawings       Flat      1     30,000    30,000
Foundation Work         sqm       200   250       50,000
Framing Labor          days       20    800       16,000
Materials (Cement)     bags       200   45        9,000
─────────────────────────────────────────────────────────
Subtotal:                                        105,000
```

#### Step 6: Select Revenue Account

**Field:** Revenue Account (dropdown)  
**Options:** All GL accounts with type "Revenue" or "Income"  
**Default:** 4100 (Primary Revenue)  

**Multiple Revenue Accounts:**
- If company has different revenue streams (e.g., Service Revenue, Product Sales)
- Accountant can select appropriate account
- Single account per invoice (for simplicity)

#### Step 7: Calculate Totals

**System Automatically Calculates:**

```
Subtotal = Sum of all (Qty × Rate) for item lines
Discount = Subtotal × (Discount % / 100)
New Subtotal = Subtotal - Discount

If Charge NHIL:
  NHIL (2.5%) = New Subtotal × 0.025
Else:
  NHIL = 0

If Charge VAT:
  VAT (15%) = New Subtotal × 0.15
Else:
  VAT = 0

Grand Total = New Subtotal + NHIL + VAT
Grand Total GHS = Grand Total (if GHS) OR Grand Total × Exchange Rate (if USD)
```

**Example Calculation:**
```
Subtotal:         105,000
Discount (0%):         -0
New Subtotal:     105,000
NHIL (2.5%):       2,625
VAT (15%):        15,750
───────────────────────
Grand Total:     123,375 GHS
```

#### Step 8: Review & Create Invoice

- System displays totals preview
- Click **"Create Invoice"**

---

### Automatic GL Posting When Invoice Created

When invoice is submitted, system creates **Journal Entry** automatically:

```
Entry Number: JE-0001 (auto-assigned)
Date: Invoice date
Description: "Invoice SP/2026/0001 — Mr. Ken and Mr. Kasim"
Project: Project ID (if selected)

Dr. 1130 - Accounts Receivable        123,375
   Cr. 4100 - Revenue (selected)                  105,000
   Cr. 2205 - NHIL Payable                          2,625
   Cr. 2220 - VAT Payable                          15,750
                                    ────────────────────
                                      Total: 123,375
```

**Key Points:**
- Invoice linked to journal entry (`.journalEntryId`)
- Project field populated from invoice
- AR account (1130) always used
- Revenue accounts per invoice account selection
- Taxes (NHIL, VAT) posted as liabilities

---

### Invoice Status Lifecycle

#### 1. **Sent** (Initial)
- Invoice issued to client
- AR created
- Balance = Grand Total GHS

#### 2. **Partially Paid**
- Some payments received
- Balance = Grand Total GHS - Sum of Payments
- Shown in Aged Receivables (overdue tracking)

#### 3. **Paid**
- All payments received
- Balance ≤ 0.01 (considered zero after rounding)
- Removed from aged receivables

#### 4. **Void**
- Invoice cancelled (e.g., issued in error)
- Reversal journal entry created
- Original entry marked as "reversed"
- Revenue/AR reversed
- Payments cleared

---

### Recording Payments Against Invoice

**Location:** Invoicing Panel → Invoice row → **"Record Payment"** button

#### Payment Entry:
1. **Date** — When payment received
2. **Method** — Payment type (Check, Bank Transfer, Cash, etc.)
3. **Reference** — Bank reference/check number
4. **Amount (GHS)** — Payment amount

#### Automatic GL Posting:
```
Dr. 1100 - Cash at Bank         [Payment Amount]
   Cr. 1130 - Accounts Receivable          [Amount]
```

#### Payment Tracking:
- Multiple payments per invoice supported
- Partial payments allowed
- Payments stored in `invoice.payments[]` array
- Invoice status auto-updates based on total paid

---

### Invoice Reconciliation Example

**Invoice SP/2026/0025:**
- Issued: Aug 15, 2026
- Bill To: East Legon Development Ltd
- Grand Total: 123,375 GHS

**Payment History:**
```
Pmt 1: Sep 01 — 50,000 (Check #1234) → Status: "Partially Paid"
       Balance: 73,375

Pmt 2: Sep 15 — 73,375 (Bank Xfer) → Status: "Paid"
       Balance: 0
```

**GL Entries Created:**
1. Original Invoice Posting (Aug 15)
2. Payment 1 Posting (Sep 01)
3. Payment 2 Posting (Sep 15)

---

## FINANCIAL REPORTING & ANALYSIS

### Overview

MODULO reports provide visibility into:
- **Project Profitability** — Revenue vs. costs per project
- **Cash Position** — AR aging, cash flow
- **GL-based Reports** — Income statement, balance sheet, trial balance

---

### 1. Project Profitability Report

**Location:** CEO Dashboard → "Reports" section → "Project Profitability"

**Metrics Calculated Per Project:**

| Metric | Calculation | Purpose |
|--------|-------------|---------|
| **Contract Value** | From project record | Total agreed revenue |
| **Revenue Billed** | Sum of invoice grand totals (non-void) | Actual invoiced amount |
| **Actual Cost** | Sum of expense journal line debits | Money spent to date |
| **Estimated Cost** | From project record | Budgeted cost |
| **Margin (Absolute)** | Revenue Billed - Actual Cost | $ profit to date |
| **Margin %** | (Margin / Revenue Billed) × 100 | Profitability % |

**Example Project Report:**

```
Project: East Legon Villa Construction

Contract Value:          250,000 GHS
Revenue Billed:          123,375 GHS (49% of contract)
Actual Cost:              45,000 GHS
Estimated Cost:          180,000 GHS
Margin (Revenue - Cost):  78,375 GHS
Margin %:                 63.5% (78,375 / 123,375)

Status: POSITIVE
(Revenue exceeds costs to date)
```

**Interpretation:**
- Company has billed 49% of contract value
- Spent only 18% of estimated budget (45k of 180k)
- Current margin is healthy at 63.5%
- But project only 25% complete (rough estimate)

---

### 2. Project Summary Cards (Dashboard View)

**Location:** CEO Dashboard → "Projects" section (card view)

Each project card displays (for quick overview):

```
┌─────────────────────────────────┐
│ East Legon Villa Construction   │  ← Project Name
│ Status: Active                  │  ← Current status
├─────────────────────────────────┤
│ Contract Value:   GHS 250,000   │
│ Revenue Billed:   GHS 123,375   │  ← From invoices
│ Actual Cost:       GHS 45,000   │  ← From journal
│ Estimated Cost:   GHS 180,000   │
│ Remaining Cost:   GHS 135,000   │  ← 180k - 45k
├─────────────────────────────────┤
│ Projected Margin: GHS 70,000    │  ← 250k - 180k (green)
│ WIP Margin:       GHS 78,375    │  ← 123,375 - 45k (red/green)
└─────────────────────────────────┘
```

**Key Metrics Explained:**

- **Projected Margin** = Contract Value - Estimated Cost
  - Expected profit if project completes on budget
  - Green if positive, red if negative
  - Example: 250,000 - 180,000 = 70,000 ✓

- **WIP Margin** = Revenue Billed - Actual Cost
  - Current profit on work done
  - "Work In Progress" margin (what you've made so far)
  - Example: 123,375 - 45,000 = 78,375 ✓

---

### 3. Aged Receivables Report

**Location:** Reports → "Aged Receivables"

**Purpose:** Identify overdue customer payments

**Aging Buckets:**

| Bucket | Criteria | Color | Example |
|--------|----------|-------|---------|
| **Current** | Not yet due | 🟢 Green | 25,000 GHS |
| **1-30 Days Overdue** | 1-30 days past due date | 🟡 Gold | 15,000 GHS |
| **31-60 Days** | 31-60 days past due | 🟠 Orange | 8,000 GHS |
| **61-90 Days** | 61-90 days past due | 🔴 Red | 3,000 GHS |
| **90+ Days** | Over 90 days past due | 🔴 Dark Red | 2,000 GHS |

**Calculation:**
```
For each invoice with status ≠ "Void":
  Outstanding Balance = Grand Total GHS - Payments
  
  If Balance > 0:
    Days Overdue = TODAY - Due Date
    
    Assign to appropriate bucket
    Add to bucket total
```

**Report Display:**
```
┌────────────────────────────────────┐
│ Aged Receivables Summary           │
├────────────────────────────────────┤
│ Current (Not yet due)       25,000 │ (1 invoice)
│ 1-30 days overdue           15,000 │ (2 invoices)
│ 31-60 days overdue           8,000 │ (1 invoice)
│ 61-90 days overdue           3,000 │ (1 invoice)
│ 90+ days overdue             2,000 │ (1 invoice)
├────────────────────────────────────┤
│ TOTAL OUTSTANDING           53,000 │
└────────────────────────────────────┘
```

**User Action:**
- Identify overdue invoices for collection
- Follow up on red-flagged items
- Forecast cash timing

---

### 4. Financial Statements

**Location:** CEO Dashboard → "Reports" → Financial Documents

#### 4.1 Trial Balance
**Purpose:** Verify GL balances and audit trail

**Content:**
- All GL accounts with debit/credit balances
- Grouped by type (Asset, Liability, Equity, Revenue, Expense)
- Total debits must equal total credits

**Example Row:**
```
Account    Type        Debit        Credit
─────────────────────────────────────────
1100       Asset       150,000
1130       Asset        78,375
2205       Liability                 2,625
2220       Liability                15,750
4100       Revenue                 105,000
6100       Expense      45,000
─────────────────────────────────────────
```

#### 4.2 Income Statement (P&L)
**Purpose:** Show profit/loss for period

**Structure:**
```
INCOME STATEMENT
For Period: Jan 1 - Dec 31, 2026

REVENUE
  4100 - Primary Revenue          105,000
  ─────────────────────────────
  Total Revenue                   105,000

LESS: COSTS OF GOODS SOLD
  6100 - Materials & Supplies      25,000
  6200 - Wages & Salaries          15,000
  6300 - Subcontractor Fees         5,000
  ─────────────────────────────
  Total COGS                        45,000

GROSS PROFIT                        60,000  (57% margin)

LESS: OPERATING EXPENSES
  6400 - Admin Salaries             8,000
  6500 - Rent                       4,000
  6600 - Utilities                  2,000
  ─────────────────────────────
  Total Operating Expenses          14,000

NET PROFIT                          46,000  (44% net margin)
```

#### 4.3 Balance Sheet
**Purpose:** Show financial position at period-end

**Structure:**
```
BALANCE SHEET
As of: Dec 31, 2026

ASSETS
  Cash at Bank (1100)                  150,000
  Accounts Receivable (1130)            78,375
  ─────────────────────────────────────
  Total Assets                        228,375

LIABILITIES
  NHIL Payable (2205)                   2,625
  VAT Payable (2220)                   15,750
  Accounts Payable (2100)              35,000
  ─────────────────────────────────────
  Total Liabilities                    53,375

EQUITY
  Retained Earnings                   175,000
  ─────────────────────────────────────
  Total Liabilities & Equity          228,375
```

#### 4.4 Cash Flow Statement
**Purpose:** Track movement of cash in/out

**Calculation:**
```
For each date in period:
  Net Flow = Sum of (Debits - Credits) for cash/bank accounts
  Running Balance = Previous Balance + Net Flow
  
Cash accounts tracked:
  - 1100 (Cash at Bank)
  - Other accounts marked "isPaymentAccount: true"
```

**Example Table:**
```
Date        Description       Entry      Amount    Running Balance
─────────────────────────────────────────────────────────────────
2026-01-01  Opening Balance                            100,000
2026-01-15  Invoice SP/26/01   JE-0001   +123,375    223,375
2026-01-20  Expense JE-EXP-01  JE-0002    -5,000     218,375
2026-02-01  Payment on INV     JE-0003   +50,000     268,375
```

---

## PROJECT CLOSURE & FINAL ACCOUNTING

### Overview

Project closure involves finalizing all accounts and transitioning project from "Active" to "Complete".

---

### Pre-Closure Checklist

#### ✓ Financial Reconciliation
1. **All invoices issued** for work completed
2. **All expenses recorded** (materials, labor, overhead)
3. **All payments received** (or AR aging acceptable)
4. **GL balances reviewed** for accuracy
5. **Project margin verified** (final P&L)

#### ✓ Documentation
1. Final project drawings/specs
2. Completion certificate/sign-off
3. Warranty documentation
4. Client acceptance letter

#### ✓ Post-Implementation
1. All milestones confirmed
2. Site reports finalized
3. Photo documentation complete
4. Lessons learned documented

---

### Step 1: Finalize All Invoices

**Action:** CEO Dashboard → Invoicing → Verify all invoices created

```
Ensure all deliverables billed:
- Design fees
- Materials supplied
- Labor/services
- Change orders
- Retention (if applicable)

Final Invoice Total ≈ Contract Value (or per agreement)
```

**If shortfall exists:**
- Create final invoice for remainder
- Or obtain client waiver/change order

---

### Step 2: Confirm All Milestones

**Location:** PM Portal → Project → Stages

**Verify:** All milestones marked "Confirmed"
- Final stage (e.g., "Handover") confirmed
- Completion % = 100%
- All notes documented

---

### Step 3: Record Final Cost Entries

**Action:** Expenses Panel → Record any final costs

Examples:
- Final cleanup/restoration
- Punch list items
- Warranty provisions
- Final supplier invoices

**Process:**
1. Post all outstanding vendor bills
2. Record accrued expenses (if not yet paid)
3. Verify `Estimated Cost` ≈ `Actual Cost` (or note variance)

---

### Step 4: Reconcile Project Profit

**Calculate Final Margin:**

```
Final Revenue Billed = Sum of all invoices for project (non-void)
Final Actual Cost = Sum of all expenses for project
Final Margin = Revenue - Cost

Compare to:
Projected Margin = Contract Value - Estimated Cost
```

**Variance Analysis:**
```
Example:
  Projected Margin:        70,000 GHS
  Final Actual Margin:     75,000 GHS
  Variance (Favorable):     5,000 GHS (+7%)
  
Reason: Efficient labor utilization, material savings
```

**Document variance:**
- If unfavorable: Why did costs exceed estimate?
- If favorable: How did team add value?
- Feed lessons learned

---

### Step 5: Close Project in System

**Location:** CEO Dashboard → Projects → Project Card

1. Click **Edit** on project
2. Change **Status** from "Active" to "Complete"
3. Click **Save**

**System Effects:**
- Project no longer appears in active projects list
- Still visible in reports/historical view
- All data retained for audit trail
- No further edits allowed (read-only)

---

### Step 6: Final Reporting & Archive

**Generate Final Reports:**

1. **Project Profitability Report**
   - Verify final margin %
   - Export to PDF for archive

2. **Trial Balance** (as of project close date)
   - GL state at completion
   - Audit trail evidence

3. **Income Statement**
   - Show project contribution to P&L

**Archive:**
- Store in project folder
- Link to project record
- Reference for future audits

---

### Post-Project Follow-Up

#### Long-term Warranty Provisions
- If warranty obligation exists, create provision:
  ```
  Dr. 6700 - Warranty Expense
    Cr. 2300 - Warranty Provision
  ```

#### Revenue Adjustments
- If retainage held by client, defer recognition:
  ```
  Dr. 1140 - Retainage Receivable
    Cr. 4100 - Revenue (deferred portion)
  ```

#### Lessons Learned
- Document in project file
- Feed into cost estimation for similar future projects
- Update "Estimated Cost" templates

---

## KEY FORMULAS & CALCULATIONS

### 1. Project Financial Metrics

#### Contract Value
```
Source: Project record
Purpose: Total agreed revenue for project
Example: 250,000 GHS
```

#### Estimated Cost
```
Source: Project record (from creation/edit)
Purpose: Budgeted total project cost
Example: 180,000 GHS
```

#### Projected Margin
```
Formula: Contract Value - Estimated Cost
Purpose: Expected profit if on budget
Example: 250,000 - 180,000 = 70,000 GHS

Color: Green if ≥ 0, Red if < 0
```

#### Actual Cost to Date
```
Formula: Sum of all expense journal lines where:
  - je.project === project.id
  - account type === "Expense"
  - Sum of line.debit values
  
Calculation:
  SELECT SUM(line.debit)
  FROM journal_entries je
  JOIN journal_lines line ON je.id = line.entry_id
  WHERE je.project_id = 'PRJ-12345'
  AND account_type = 'Expense'
  
Example: 45,000 GHS
```

#### Remaining Cost
```
Formula: Estimated Cost - Actual Cost to Date
Purpose: Budget remaining for project
Example: 180,000 - 45,000 = 135,000 GHS

Note: MIN(result, 0) = Never negative
```

#### Revenue Billed
```
Formula: Sum of invoice grand totals where:
  - invoice.project === project.id
  - invoice.status !== "Void"
  - Sum of invoice.totals.newSubtotalGHS
  
Calculation:
  SELECT SUM(totals.new_subtotal_ghs)
  FROM invoices
  WHERE project_id = 'PRJ-12345'
  AND status != 'Void'
  
Example: 123,375 GHS
```

#### WIP Margin (Work-In-Progress Margin)
```
Formula: Revenue Billed - Actual Cost
Purpose: Current profit on work invoiced
Example: 123,375 - 45,000 = 78,375 GHS

Interpretation:
  - Positive: Company ahead (revenue > cost)
  - Negative: Company behind (cost > revenue)
  
Color: Green if ≥ 0, Red if < 0
```

#### Profit Margin %
```
Formula: (Actual Margin / Revenue Billed) × 100
Purpose: Profitability percentage
Example: (78,375 / 123,375) × 100 = 63.5%

Interpretation: For every GHS 1 billed, 0.635 is profit
```

---

### 2. Completion % Calculation (POC Basis)

#### Formula
```
Completion % = (Confirmed Milestones / Total Milestones) × 100
Rounded to nearest whole %

Calculation:
  confirmedCount = milestones.filter(m => m.status === 'confirmed').length
  progressPct = milestones.length > 0 
    ? Math.round((confirmedCount / milestones.length) * 100)
    : 0
```

#### Example Progression
```
Day 1:  0/5 confirmed = 0%
Day 10: 1/5 confirmed = 20%
Day 20: 2/5 confirmed = 40%
Day 30: 3/5 confirmed = 60%
Day 40: 4/5 confirmed = 80%
Day 50: 5/5 confirmed = 100%
```

---

### 3. Invoice Totals Calculation

#### Gross Subtotal
```
Formula: Sum of (Qty × Rate) for all "item" line types
Example:
  Line 1: 1 × 30,000 = 30,000
  Line 2: 200 × 250 = 50,000
  Line 3: 20 × 800 = 16,000
  ────────────────────────
  Subtotal: 96,000
```

#### Discount
```
Formula: Subtotal × (Discount % / 100)
Example: 96,000 × (5 / 100) = 4,800
```

#### New Subtotal (After Discount)
```
Formula: Subtotal - Discount
Example: 96,000 - 4,800 = 91,200
```

#### NHIL (If Charged)
```
Formula: New Subtotal × 0.025 (2.5% rate)
Example: 91,200 × 0.025 = 2,280
GL Account: 2205 (Liability)
```

#### VAT (If Charged)
```
Formula: New Subtotal × 0.15 (15% rate)
Example: 91,200 × 0.15 = 13,680
GL Account: 2220 (Liability)
```

#### Grand Total (Invoice Currency)
```
Formula: New Subtotal + NHIL + VAT
Example: 91,200 + 2,280 + 13,680 = 107,160
Currency: GHS or USD as selected
```

#### Grand Total GHS (Always)
```
If currency = "GHS":
  Grand Total GHS = Grand Total
  
If currency = "USD":
  Grand Total GHS = Grand Total × Exchange Rate
  
Example (USD invoice):
  Grand Total (USD): 9,500
  Exchange Rate: 11.8
  Grand Total GHS: 9,500 × 11.8 = 112,100
```

---

### 4. Aged Receivables Calculation

#### Days Outstanding
```
Formula: TODAY - Invoice Due Date
Example: 2026-09-15 - 2026-09-01 = 14 days
```

#### Outstanding Balance
```
Formula: Grand Total GHS - Sum of Payments
Example: 107,160 - 50,000 = 57,160 GHS
```

#### Aging Bucket Assignment
```
IF Days Outstanding ≤ 0:
  Bucket = "Current"
ELSE IF Days Outstanding ≤ 30:
  Bucket = "1-30 days overdue"
ELSE IF Days Outstanding ≤ 60:
  Bucket = "31-60 days"
ELSE IF Days Outstanding ≤ 90:
  Bucket = "61-90 days"
ELSE:
  Bucket = "90+ days"
```

---

### 5. Double-Entry Journal Posting Examples

#### Invoice Creation
```
Entry: JE-0001
Date: 2026-08-15
Description: "Invoice SP/2026/0001 — East Legon Dev Ltd"
Project: PRJ-ELV-001

Dr. 1130 - Accounts Receivable        107,160
  Cr. 4100 - Revenue (if GHS invoice)            91,200
  Cr. 2205 - NHIL Payable                         2,280
  Cr. 2220 - VAT Payable                         13,680
                                    ─────────────────
                                      123,160 GHS
```

#### Expense Posting
```
Entry: JE-EXP-0001
Date: 2026-08-18
Description: "Cement and sand — ABC Materials Ltd"
Project: PRJ-ELV-001

Dr. 6100 - Materials & Supplies        5,000
  Cr. 1100 - Cash at Bank                        5,000
```

#### Payment Posting
```
Entry: JE-0002
Date: 2026-09-01
Description: "Payment for Invoice SP/2026/0001"
Project: PRJ-ELV-001

Dr. 1100 - Cash at Bank               50,000
  Cr. 1130 - Accounts Receivable               50,000
```

#### Invoice Void/Reversal
```
Original Entry: JE-0001 (marked as reversed)
Reversal Entry: JE-VOID-0001

Dr. 4100 - Revenue                    91,200
Dr. 2205 - NHIL Payable                2,280
Dr. 2220 - VAT Payable                13,680
  Cr. 1130 - Accounts Receivable            107,160
```

---

## USER WORKFLOWS BY ROLE

### 1. Finance Manager / Accountant Workflow

#### Morning Routine (Daily)

**Task 1: Review Previous Day's Transactions**
1. Login to CEO Dashboard
2. Check "Cash at Bank" balance on dashboard KPIs
3. Review "Recent Expenses" card
4. Check invoices for any new "Sent" status

**Task 2: Create Daily Expenses** (if any)
1. Navigate to "Quick Expenses"
2. For each daily cost:
   - Enter date, vendor, description, amount
   - Select expense account (Materials, Wages, etc.)
   - Link to project
   - Post
3. Review "Expense History" table

**Task 3: Review Project Profitability**
1. Navigate to "Reports" → "Project Profitability"
2. Scan for:
   - Projects approaching 100% billed
   - Projects with negative margins (investigation needed)
   - WIP margins vs. projected margins
3. Flag issues for project manager

#### Week Routine

**Task 1: Create Customer Invoices**
1. Receive billing schedule from Project Manager
2. Navigate to "Invoicing" → "New Invoice"
3. Fill in:
   - Bill To (client name)
   - Project
   - Items (work performed, milestones, change orders)
   - Due date (typically 30 days out)
4. Review totals (taxes, discounts)
5. Select revenue account
6. Create invoice
7. Print/send to client

**Task 2: Record Payments**
1. Check email/bank for invoice payments
2. For each payment:
   - Find invoice in Invoicing Panel
   - Click "Record Payment"
   - Enter amount, date, method, reference
   - Confirm
3. Monitor aging report
4. Follow up on overdue items

**Task 3: Reconcile GL to Sub-Ledgers**
1. Generate Trial Balance report
2. Verify:
   - AR (sum of unpaid invoices) matches 1130 balance
   - AP (sum of unpaid bills) matches 2100 balance
   - Cash accounts match bank statement
3. Investigate variances

#### Month Routine

**Task 1: Financial Close**
1. Ensure all transactions posted for the month
2. Verify no outstanding expenses pending
3. Review Project Profitability Report
   - Check if project margins align with budgets
   - Adjust estimates if needed

**Task 2: Generate Financial Statements**
1. Navigate to Reports
2. Generate:
   - Trial Balance
   - Income Statement
   - Balance Sheet
3. Print and review for accuracy
4. Investigate any unusual balances

**Task 3: Project Review Meeting**
1. Present profitability report to management
2. Discuss:
   - On-budget projects vs. variances
   - Cash collection status
   - Aging receivables
   - Forecasted completion dates

---

### 2. Project Manager Workflow

#### Daily Routine

**Task 1: Monitor Project Progress**
1. Login to PM Portal
2. For each assigned project:
   - View "Stage Progress" section
   - Check current completion % (progress bar)
   - See which stages are pending vs. confirmed
3. Coordinate with site team on stage completion status

**Task 2: Confirm Milestones (When Stage Complete)**
1. When on-site work for a stage is complete:
   - Navigate to "Stage Progress"
   - Review stage name (e.g., "Foundation Complete")
   - Click "Confirm" button
   - Enter completion notes:
     - Actual work completed
     - Quality check results
     - Any issues/deferrals
     - Photo references
   - Confirm
2. Progress bar updates in real-time
3. Accountant notified (completion % updated in dashboard)

**Task 3: Document Site Activity**
1. Upload site reports
2. Upload photos (Media Library)
3. Log any issues/change orders

#### Weekly Routine

**Task 1: Site Report**
1. Navigate to "Site Reports"
2. Fill in:
   - Weather conditions
   - Workers present
   - Work completed
   - Issues encountered
3. Submit (auto-timestamps)

**Task 2: Project Update**
1. Review milestones progress chart
2. Compare to schedule
3. If behind:
   - Document reasons
   - Flag for accountant (affects revenue recognition if using POC)
4. If ahead:
   - Coordinate accelerated invoicing if appropriate

#### When Project Complete

**Task 1: Final Milestone Confirmation**
1. Confirm final milestone (e.g., "Handover")
2. Enter extensive completion notes:
   - Client sign-off status
   - Outstanding punch list items (if any)
   - Quality assurance results
   - Warranty/guarantee terms
3. Confirm
4. Completion % = 100%

**Task 2: Handoff to Finance**
1. Notify Accountant:
   - Project is complete
   - Final invoice needed (if any remaining scope)
   - All site documentation uploaded
2. Provide:
   - Final project photos
   - Certificate of completion
   - Warranties
   - Lessons learned document

---

### 3. CEO/Finance Manager (Strategic)

#### Weekly Routine

**Task 1: Dashboard Review**
1. Check KPI cards:
   - Total Revenue (YTD)
   - Total Costs
   - Net Income
   - Cash Balance
2. Identify trends

**Task 2: Project Portfolio Review**
1. View all project cards
2. Scan for:
   - Projects with negative projected margins (investigate)
   - Projects 90%+ complete (nearing close)
   - High WIP margins (good performance)
3. Hold brief with Finance/PM on concerns

#### Monthly Routine

**Task 1: Financial Results Review**
1. Review Income Statement
   - Compare revenue to forecast
   - Compare expenses to budget
   - Calculate net margin %
2. Review Balance Sheet
   - Check AR aging
   - Verify sufficient cash
   - Monitor debt levels
3. Review Cash Flow
   - Identify cash squeeze points
   - Plan financing if needed

**Task 2: Strategic Analysis**
1. Project profitability trends
   - Which project types most profitable?
   - Which consistently underperform?
   - Adjust pricing/estimation?
2. Resource utilization
   - Are teams sized appropriately?
   - Where is waste happening?
3. Forecast 12-month outlook
   - Pipeline of projects
   - Expected revenue
   - Expected costs
   - Expected cash position

---

## INTEGRATION POINTS & DATA FLOW

### 1. Data Flow: Project → Invoices → GL → Reporting

```
┌─────────────────┐
│ PROJECT CREATED │
│ • Contract: 250k│
│ • Est. Cost: 180k│
└────────┬────────┘
         │
         ├─→ PM Portal: Milestone Tracking
         │   • Stages: 1-5 (pending)
         │   • Completion %: 0%
         │
         ├─→ Expense Recording
         │   • Materials: 5,000 (JE-EXP-0001)
         │   • Labor: 8,000 (JE-EXP-0002)
         │   • Actual Cost: 13,000
         │
         ├─→ Milestone Confirmation
         │   • Stage 1 ✓ (Confirmed)
         │   • Completion %: 20%
         │
         ├─→ Invoice Creation
         │   • Invoice SP/2026/0001
         │   • Amount: 50,000 (AR + Revenue)
         │   • Posted to GL
         │
         ├─→ Payment Recording
         │   • Payment: 50,000
         │   • Cash + AR updated
         │
         └─→ Financial Reports
             • Profitability: 50k - 13k = 37k margin
             • Cash Flow: +50k payment
             • AR Aging: Updated

```

### 2. Project Stats Calculation Pipeline

```
projectStatsFn(data: AppData) → ProjectStats[]

For each Project:
  1. revenueBilled = SUM(invoices where project_id=P.id AND status!='Void')
  2. actualCost = SUM(journal lines where project_id=P.id AND account.type='Expense')
  3. estimatedCost = P.estimatedCost (from form)
  4. remainingCost = MAX(estimatedCost - actualCost, 0)
  5. projectedMargin = contractValue - estimatedCost
  6. wipMargin = revenueBilled - actualCost
  
  Return: {id, name, status, contractValue, revenueBilled, actualCost, 
           estimatedCost, remainingCost, projectedMargin, wipMargin}

Consumed by:
  • Project Cards (Dashboard display)
  • Project Profitability Report
  • Accountant monitoring
```

### 3. Journal Entry Posting Points

#### Automatic GL Postings (No Manual Entry):
1. **Invoice Creation** → AR + Revenue + Taxes
2. **Payment Recording** → Cash + AR reduction
3. **Expense Quick-Entry** → Expense + Cash reduction

#### Manual GL Postings (Journal Panel):
1. Adjustments, accruals
2. Allocations, transfers
3. Non-standard transactions

#### All Postings Include:
- Entry Number (JE-xxxxx format)
- Date (transaction date)
- Description (narrative)
- Period (YYYY-MM)
- Project (optional, for cost allocation)
- Balanced lines (debit = credit)

---

### 4. GL Account Mapping (Key Accounts)

| Account | Type | Description | Used For |
|---------|------|-------------|----------|
| **1100** | Asset | Cash at Bank | Payment source, cash balance |
| **1130** | Asset | Accounts Receivable | Invoice amounts (customer balances) |
| **1140** | Asset | Retainage Receivable | Held payments (future recovery) |
| **2100** | Liability | Accounts Payable | Vendor bills unpaid |
| **2205** | Liability | NHIL Payable | Tax liability (2.5%) |
| **2220** | Liability | VAT Payable | Tax liability (15%) |
| **2300** | Liability | Warranty Provision | Warranty obligation (contingent) |
| **4100** | Revenue | Primary Revenue | Service/product revenue |
| **4200** | Revenue | Service Revenue | Alternative revenue account |
| **6100** | Expense | Materials & Supplies | Material costs |
| **6200** | Expense | Wages & Salaries | Labor costs |
| **6300** | Expense | Subcontractor Fees | Outsourced labor |
| **6400** | Expense | Admin Salaries | Indirect labor |
| **6500** | Expense | Rent | Facility costs |
| **6600** | Expense | Utilities | Utility costs |
| **6700** | Expense | Warranty Expense | Warranty cost recognition |

---

## DATABASE SCHEMA & DATA TYPES

### 1. Projects Table

```typescript
interface Project {
  id: string;                    // "PRJ-ELV-001" (unique identifier)
  name: string;                  // "East Legon Villa Construction"
  status?: string | null;        // "Active" | "Complete" | "On Hold"
  projectType?: string | null;   // "Construction" | "Renovation" | "Design"
  recognitionMethod?: string | null;  // "POC" | "POINT_IN_TIME"
  contractValue?: number | null; // 250000 (total contract amount)
  estimatedCost?: number | null; // 180000 (budgeted cost)
}
```

**Key Fields Explained:**
- `contractValue` — Used in Projected Margin calculation
- `estimatedCost` — Used in Remaining Cost & Projected Margin
- `recognitionMethod` — Stored but not yet driving GL entries
- `status` — Defaults to "Active"; set to "Complete" at project closure

---

### 2. Project Milestones Table

```typescript
interface MilestoneRow {
  id: string;                    // UUID (auto-generated)
  project_id: string;            // "PRJ-ELV-001" (links to project)
  name: string;                  // "Foundation" | "Framing" | etc.
  stage_order: number;           // 1, 2, 3, ... (sequence order)
  status: 'pending' | 'confirmed'; // Completion status
  confirmed_at: string | null;   // "2026-08-18T10:30:00Z" (ISO timestamp)
  confirmed_by: string | null;   // user_id who confirmed
  notes: string | null;          // "Work completed with approval"
  created_at: string;            // "2026-08-10T14:00:00Z" (ISO timestamp)
}
```

**Key Fields Explained:**
- `stage_order` — Determines order in progress calculation
- `status` — Tracks completion; used in % calculation
- `confirmed_at` — Audit trail (when was work marked complete?)
- `notes` — Free-text documentation of completion

---

### 3. Journal Entry Table

```typescript
interface JournalEntry {
  id: string;                    // "JE-0001" | "JE-EXP-0042" | "JE-VOID-0003"
  entryNumber: string;           // Same as id (for display)
  date: string;                  // "2026-08-15" (transaction date)
  description?: string | null;   // "Invoice SP/2026/0001 — Client Name"
  period?: string | null;        // "2026-08" (YYYY-MM for reporting)
  project?: string | null;       // "PRJ-ELV-001" or null (if general)
  lines: JournalLine[];          // Array of debits/credits (see below)
  reversed?: boolean;            // true if voided (marks as reversed)
  reversalOf?: string | null;    // "JE-VOID-0001" (links to reversal entry)
}

interface JournalLine {
  account: string;               // "1130" (GL account code)
  debit: number;                 // 107160 (debit amount)
  credit: number;                // 0 (credit amount)
}
```

**Key Fields Explained:**
- `entryNumber` — Formatted for GL journal (JE-xxxx)
- `project` — Enables project-level cost allocation
- `period` — Used for period-based reporting
- `lines` — Double-entry pairs (debits always = credits)
- `reversed` — Marks void-related entries as reversed

---

### 4. Invoice Table

```typescript
interface Invoice {
  id: string;                    // "SP/2026/0001" (invoice number, unique)
  invoiceNumber: string;         // Same as id
  date: string;                  // "2026-08-15" (invoice issue date)
  dueDate?: string | null;       // "2026-09-15" (payment deadline)
  billTo: string;                // "Mr. Ken and Mr. Kasim" (customer name)
  forText?: string | null;       // "East Legon Villa Project"
  location?: string | null;      // "GREATER ACCRA"
  project?: string | null;       // "PRJ-ELV-001" (links to project)
  projectLabel?: string | null;  // "East Legon Villa Construction" (denormalized)
  currency: Currency;            // "GHS" | "USD"
  exchangeRate: number;          // 11.2 (USD to GHS conversion)
  discountPct: number;           // 5 (discount percentage, 0-100)
  revenueAccount?: string | null;// "4100" (GL revenue account)
  status: InvoiceStatus;         // "Sent" | "Partially Paid" | "Paid" | "Void"
  totals: InvoiceTotals;         // See below
  items: InvoiceItem[];          // Line items (see below)
  payments: Payment[];           // Array of payment records
  journalEntryId?: string | null;// "JE-0001" (links to GL posting)
  reversalJournalEntryId?: string | null; // "JE-VOID-0001" (void entry)
}

interface InvoiceTotals {
  subtotal: number;              // 96000 (sum of qty × rate)
  discount: number;              // 4800 (subtotal × discount%)
  newSubtotal: number;           // 91200 (subtotal - discount)
  nhilGetfund: number;           // 2280 (2.5% of newSubtotal)
  vat: number;                   // 13680 (15% of newSubtotal)
  grandTotal: number;            // 107160 (invoice currency total)
  chargeNhil: boolean;           // true if NHIL charged
  chargeVat: boolean;            // true if VAT charged
  grandTotalGHS?: number;        // 107160 (always in GHS for storage)
  newSubtotalGHS?: number;       // 91200 (used in project revenue calc)
  nhilGetfundGHS?: number;       // 2280 (tax in GHS)
  vatGHS?: number;               // 13680 (tax in GHS)
}

interface InvoiceItem {
  id: string;                    // UUID
  lineType: LineType;            // "item" | "header" | "sub-detail"
  description: string;           // "Design & Drawings"
  unit?: string | null;          // "days" | "sqm" | "ea"
  qty: number;                   // 20 (quantity)
  rate: number;                  // 800 (unit price)
}

interface Payment {
  id: string;                    // UUID
  date: string;                  // "2026-09-01" (payment date)
  amountGHS: number;             // 50000 (payment amount)
  method: string;                // "Check" | "Bank Transfer" | "Cash"
  reference?: string | null;     // "Check #1234" or bank reference
}
```

**Key Fields Explained:**
- `totals.newSubtotalGHS` — Used in project revenue calculation
- `projectLabel` — Denormalized for performance (avoid FK join)
- `journalEntryId` — Enables reversal lookups (void invoice)
- `status` — Auto-updated based on payments vs. total
- `currency` — Supports multi-currency invoicing (with exchange rate)

---

### 5. Project Stats (Calculated Type)

```typescript
interface ProjectStats {
  id: string;                    // Project ID
  name: string;                  // Project name
  status?: string | null;
  contractValue: number;         // Total contract
  revenueBilled: number;         // Sum of invoice newSubtotalGHS
  actualCost: number;            // Sum of expense debits
  estimatedCost: number;         // From project record
  remainingCost: number;         // Estimated - Actual
  projectedMargin: number;       // Contract - Estimated
  wipMargin: number;             // Revenue - Actual
}
```

**Not Stored in DB** — Calculated on-demand from:
- `projects` table
- `invoices` table
- `journal` table

---

## COMMON SCENARIOS & EXAMPLES

### Scenario 1: Residential Construction Project (POC)

**Project Setup:**
```
Name: "Tema Residential Development"
Type: "Construction"
Status: Active
Recognition Method: POC
Contract Value: 400,000 GHS
Estimated Cost: 280,000 GHS
Projected Margin: 120,000 (30%)
```

**Milestones:**
```
1. Site Preparation & Permits
2. Foundation & Excavation
3. Structural Work (Columns, Beams)
4. Walls & Roofing
5. Interior Finishing
6. Landscaping & Handover
```

**Timeline & Costs:**

| Week | Milestone Confirmed? | Completion % | Expenses Posted | Revenue Billed |
|------|---------------------|--------------|-----------------|----------------|
| 1-2 | No | 0% | 20,000 (materials) | 0 |
| 3-4 | Permits ✓ | 17% | 50,000 (labor) | 70,000 (stage 1 invoice) |
| 5-6 | Foundation ✓ | 33% | 80,000 (materials) | 140,000 (stage 2 invoice) |
| 7-8 | Structural ✓ | 50% | 120,000 (labor) | 180,000 (stage 3 invoice) |
| 9-10 | Walls ✓ | 67% | 150,000 (materials) | 240,000 (stage 4 invoice) |
| 11-12 | Finishing ✓ | 83% | 170,000 (labor) | 300,000 (stage 5 invoice) |
| 13-14 | Handover ✓ | 100% | 180,000 (final) | 400,000 (final invoice) |

**Final Project Stats:**
```
Contract Value:        400,000
Revenue Billed:        400,000 (100% of contract)
Actual Cost:           180,000 (on budget!)
Estimated Cost:        280,000
Remaining Cost:        0 (project complete)
Projected Margin:      120,000
WIP Margin:            220,000 (55% margin!)
Status:                COMPLETE

Profit Variance Analysis:
  Estimated Profit: 120,000
  Actual Profit:    220,000
  Favorable Variance: 100,000 (83% better than estimate!)
  
Reason: Team used modular construction techniques,
reducing labor costs and schedule
```

---

### Scenario 2: Point-in-Time Consulting Project

**Project Setup:**
```
Name: "ABC Ltd Business Systems Review"
Type: "Consulting"
Status: Active
Recognition Method: POINT_IN_TIME
Contract Value: 50,000 GHS
Estimated Cost: 30,000 GHS
Projected Margin: 20,000 (40%)
```

**Milestones:**
```
1. Research & Analysis
2. Gap Assessment
3. Solution Design
4. Report Delivery (Final)
```

**Timeline:**

| Month | Activity | Actual Cost | Invoices Billed |
|-------|----------|-------------|-----------------|
| 1 | Research phase ongoing | 8,000 | 0 (no invoices yet - PIT) |
| 2 | Analysis ongoing | 12,000 | 0 (no invoices yet - PIT) |
| 3 | Design complete | 6,000 | 0 (no invoices yet - PIT) |
| 4 | Report delivered, project complete | 4,000 | 50,000 (full invoice at completion) |

**Final Project Stats at Completion:**
```
Contract Value:        50,000
Revenue Billed:        50,000 (posted when project marked Complete)
Actual Cost:           30,000 (actual spend)
Estimated Cost:        30,000 (on budget)
Remaining Cost:        0
Projected Margin:      20,000
WIP Margin:            20,000 (40% margin)
Status:                COMPLETE

GL Entries:
  Month 1-3: Only expense entries (no revenue)
  Month 4:   
    Dr. 1130 - AR           50,000
      Cr. 4100 - Revenue              50,000
    
  Resulting P&L for Month 4:
    Revenue: 50,000
    Expense: 4,000 (final month only)
    Gross Profit: 46,000 (92%!)
```

**Why PIT Here?**
- Consulting typically billed in full upon delivery of report
- Little interim value to bill (customer doesn't benefit until done)
- Single-stage delivery vs. phased construction

---

### Scenario 3: Multi-Currency Invoice (USD)

**Invoice Creation:**

```
Bill To: "International Client Corp"
Project: "Software Development"
Date: 2026-08-15
Due Date: 2026-09-15

Items:
  • Design Services: 5 days @ $200/day = $1,000
  • Development: 40 hours @ $60/hour = $2,400
  • Testing & QA: 3 days @ $200/day = $600
  ───────────────────────────────────
  Subtotal: $4,000

Currency: USD
Exchange Rate: 11.5 (USD to GHS)
Discount: 0%
Charge NHIL: Yes (2.5%)
Charge VAT: Yes (15%)

Calculations (in USD):
  Subtotal: 4,000
  Discount: 0
  New Subtotal: 4,000
  NHIL (2.5%): 100
  VAT (15%): 600
  ─────────
  Grand Total (USD): 4,700

Conversion to GHS:
  Grand Total (USD): 4,700
  Exchange Rate: 11.5
  Grand Total GHS: 54,050
```

**GL Posting:**
```
Entry: JE-0042
Date: 2026-08-15
Description: "Invoice SP/2026/0042 — International Client"

Dr. 1130 - Accounts Receivable        54,050
  Cr. 4100 - Revenue                             46,000 (4,000 USD × 11.5)
  Cr. 2205 - NHIL Payable                        1,150 (100 × 11.5)
  Cr. 2220 - VAT Payable                         6,900 (600 × 11.5)
                                    ─────────────────
                                       54,050 GHS
```

**Payment Recording** (when payment arrives in USD):

```
Payment Received: $4,700 USD
Deposit Amount (GHS): $4,700 × 11.5 = 54,050 GHS

GL Posting:
Dr. 1100 - Cash at Bank                54,050
  Cr. 1130 - Accounts Receivable              54,050

Invoice Status: PAID ✓
```

---

### Scenario 4: Handling Over-Budget Project (With Variance)

**Project Setup:**
```
Name: "Office Renovation — Ghana Capital"
Type: "Renovation"
Status: Active
Contract Value: 150,000 GHS
Estimated Cost: 100,000 GHS
Projected Margin: 50,000 GHS
```

**Progress & Costs:**

| Stage | Est. Cost | Actual Cost | Notes |
|-------|-----------|-------------|-------|
| Design | 10,000 | 12,000 | Design approval delays +2k |
| Materials Purchase | 40,000 | 48,000 | Price increases +8k |
| Labor | 30,000 | 42,000 | Additional labor for rework +12k |
| Finishing | 20,000 | 25,000 | Quality upgrades +5k |
| **TOTAL** | **100,000** | **127,000** | **Over by 27,000** |

**GL Account at Variance Detection:**

```
Estimated Cost (Budget):  100,000
Actual Cost to Date:      127,000
Variance:                 -27,000 (UNFAVORABLE)
Remaining Cost Budget:    -27,000 (Over budget!)
```

**Accountant Action:**

1. **Alert Project Manager**
   - "Project over budget by 27k (27%)"
   - "Remaining estimated cost: 0k (already exceeded)"

2. **Options to Address:**
   - **Increase Contract Value** (change order)
     - Negotiate with client for 27k additional
     - Post additional invoice
     - New Revenue Billed = 177,000 (150k + 27k)
   - **Absorb Overrun** (if desired)
     - Accept reduced margin
     - New WIP Margin = 177,000 - 127,000 = 50,000 (still OK)
   - **Reduce Scope**
     - Remove non-essential finishing work
     - Reduce Actual Cost target

3. **GL Adjustment** (if change order issued):
   ```
   Entry: JE-0098
   Description: "Change Order — Office Renovation"
   
   Dr. 1130 - Accounts Receivable          27,000
     Cr. 4100 - Revenue                              27,000
   ```

**Final Project Stats:**
```
With Change Order:
  Contract Value:          177,000 (original 150k + 27k CO)
  Revenue Billed:          177,000
  Actual Cost:             127,000
  Projected Margin:        50,000 (original estimate)
  WIP Margin:              50,000 (revenue - cost)
  Margin %:                28.2%
```

---

### Scenario 5: Invoice Void & Reversal

**Original Invoice:**
```
Invoice: SP/2026/0035
Date: 2026-08-10
Bill To: "Client XYZ Ltd"
Amount: 45,000 GHS

GL Posting (JE-0025):
  Dr. 1130 - Accounts Receivable       45,000
    Cr. 4100 - Revenue                         45,000

Status: SENT

[Next day, discovered duplicate invoice was issued]
```

**Void Process:**

1. **Accountant Action:**
   - Navigate to Invoice SP/2026/0035
   - Click "Void Invoice"
   - System creates reversal entry

2. **GL Reversal Posting (JE-VOID-0005):**
   ```
   Entry: JE-VOID-0005
   Date: 2026-08-11
   Description: "Void of Invoice SP/2026/0035 — Client XYZ Ltd"
   Project: (same project as original)
   
   Dr. 4100 - Revenue                   45,000
     Cr. 1130 - Accounts Receivable             45,000
   
   Flags:
   - JE-0025 marked as reversed: true
   - JE-0025 reversalOf: JE-VOID-0005
   - Invoice SP/2026/0035 status: "Void"
   - Invoice SP/2026/0035 journalEntryId: JE-0025
   - Invoice SP/2026/0035 reversalJournalEntryId: JE-VOID-0005
   ```

3. **Financial Impact:**
   ```
   Before Void:
     Revenue: 45,000
     AR: 45,000
   
   After Void:
     Revenue: 0 (reversed)
     AR: 0 (reversed)
   
   In Trial Balance:
     4100: 45,000 (Dr) + 45,000 (Cr) = Offset to 0
   ```

4. **Aged Receivables:**
   - Invoice SP/2026/0035 excluded (status = "Void")
   - Not counted in total outstanding
   - Audit trail preserved (both entries in journal)

---

## CONCLUSION

The MODULO-SIMPLE-SYSTEM provides a comprehensive framework for project-based accounting that:

1. **Tracks complete project lifecycle** from creation through closure
2. **Integrates cost tracking** with revenue recognition
3. **Supports two revenue methods** (POC & PIT) with milestone-based progress
4. **Automates GL posting** to prevent manual errors
5. **Provides real-time profitability** visibility per project
6. **Generates financial statements** for reporting and analysis
7. **Maintains audit trail** through journal entries and reversals

### Key Success Factors:
- **Accurate milestone tracking** — Ensures completion % reflects real progress
- **Timely expense posting** — Keeps actual costs current for decision-making
- **Regular invoice issuance** — Matches revenue recognition method
- **Project reconciliation** — Monthly variance analysis and adjustment
- **GL maintenance** — Regular trial balance review and year-end close

### For Accountants:
Use this workflow to manage project profitability, monitor cash flow, and ensure GL accuracy. The system automates posting but requires human judgment for:
- Project creation (financial parameters)
- Revenue recognition method selection
- Accrual/adjustment entries
- Financial close procedures

### Next Steps (Future Enhancements):
- **Automatic POC revenue accrual** — Generate entries based on completion %
- **Budget vs. Actual reports** — Detailed variance analysis
- **Forecasting module** — Project cash flow at completion
- **Multi-project accounting** — Consolidate portfolio metrics
- **Integration with HR/Payroll** — Link labor costs to employee records

---

**End of Document**

*For questions or updates to this documentation, contact the Finance Department.*

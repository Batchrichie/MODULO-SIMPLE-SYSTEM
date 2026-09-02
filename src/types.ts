// src/types.ts
import type { ReactNode, Dispatch, SetStateAction, ComponentType } from 'react';

/* ------------------------------------------------------------------ */
/*  Domain primitives                                                   */
/* ------------------------------------------------------------------ */

export type Currency = 'GHS' | 'USD' | 'EUR' | 'GBP' | 'ZAR' | 'NGN';

export type InvoiceStatus = 'Sent' | 'Partially Paid' | 'Paid' | 'Void';

export type LineType = 'item' | 'header' | 'sub-detail';

export type AuthMode = 'login' | 'signup';

/* ------------------------------------------------------------------ */
/*  Core entities                                                       */
/* ------------------------------------------------------------------ */

export interface Company {
  name: string;
  addressLine: string;
  cityLine: string;
  poBox: string;
  phone: string;
  telephone: string;
  email: string;
  website?: string | null;
  preparedByName?: string | null;
  preparedByTitle?: string | null;
  authorisedByName?: string | null;
  authorisedByTitle?: string | null;
}

export interface Account {
  code: string;
  name: string;
  type: string;
  reportingGroup?: string | null;
  normal?: 'Debit' | 'Credit' | null;
  isPaymentAccount?: boolean;
  isDefault?: boolean;
  role?: string | null; // Functional role: "cash", "ar", "ap", "revenue", "vat-payable", "nhil-payable", "current-asset"
}

export interface Project {
  id: string;
  name: string;
  status?: string | null;
  projectType?: string | null;
  recognitionMethod?: string | null;
  contractValue?: number | null;
  estimatedCost?: number | null;
}

export type OnboardingStatus = 'not_invited' | 'invited' | 'active' | 'inactive';

export interface Employee {
  id: string;
  name: string;
  baseSalary: number;
  active: boolean;
  ssnitNo?: string | null;
  niaCard?: string | null;
  designation?: string | null;
  exemptPaye: boolean;
  exemptSsnit: boolean;
  positionId?: string | null;
  portalAccess?: boolean;
  email?: string | null;
  phone?: string | null;
  authUserId?: string | null;
  onboardingStatus?: OnboardingStatus;
  invitedAt?: string | null;
}

export interface JournalLine {
  account: string;
  debit: number;
  credit: number;
}

export interface JournalEntry {
  id: string;
  entryNumber: string;
  date: string;
  description?: string | null;
  period?: string | null;
  project?: string | null;
  lines: JournalLine[];
  reversed?: boolean;
  reversalOf?: string | null;
}

export interface InvoiceItem {
  id: string;
  lineType: LineType;
  description: string;
  unit?: string | null;
  qty: number;
  rate: number;
}

export interface Payment {
  id: string;
  date: string;
  amountGHS: number;
  method: string;
  reference?: string | null;
}

export interface InvoiceTotals {
  subtotal?: number;
  taxableValue?: number;
  discount?: number;
  newSubtotal?: number;
  nhilGetfund?: number;
  vat?: number;
  getfund?: number;
  total?: number;
  subtotal_ghs?: number;
  taxable_value_ghs?: number;
  vat_ghs?: number;
  nhil_ghs?: number;
  getfund_ghs?: number;
  total_ghs?: number;
  exchange_rate?: number;
  chargeNhil?: boolean;
  chargeVat?: boolean;
  grandTotal?: number;
  grandTotalGHS?: number;
  newSubtotalGHS?: number;
  nhilGetfundGHS?: number;
  vatGHS?: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  dueDate?: string | null;
  billTo: string;
  clientPhone?: string | null;
  forText?: string | null;
  location?: string | null;
  project?: string | null;
  projectLabel?: string | null;
  currency: Currency;
  exchangeRate: number;
  discountPct: number;
  revenueAccount?: string | null;
  status: InvoiceStatus;
  totals: InvoiceTotals;
  items: InvoiceItem[];
  payments: Payment[];
  journalEntryId?: string | null;
  reversalJournalEntryId?: string | null;
}

export interface PayrollLine {
  employeeId: string;
  name: string;
  gross: number;
  ssnitEmployee: number;
  ssnitEmployer: number;
  paye: number;
  net: number;
}

export interface PayrollRun {
  id: string;
  period: string;
  entryNumber?: string | null;
  postedAt?: string | null;
  rows: PayrollLine[];
}

export interface BillPayment {
  id: string;
  date: string;
  amount: number;
  method: string;
  reference?: string | null;
}

export interface Bill {
  id: string;
  billNumber: string;
  date: string;
  dueDate?: string | null;
  vendor: string;
  description?: string | null;
  project?: string | null;
  amount: number;
  status: 'Unpaid' | 'Partially Paid' | 'Paid';
  payments: BillPayment[];
}

export interface PayeBracket {
  upto: number;
  rate: number;
}

export interface TaxRates {
  ssnitEmployeeRate: number;
  ssnitEmployerRate: number;
  nhilGetfundRate: number;
  vatRate: number;
}

export interface TaxConfig {
  rates: TaxRates;
  brackets: PayeBracket[];
}

/* ------------------------------------------------------------------ */
/*  App-level state                                                     */
export interface BankReconciliationItem {
  id: string;
  reconciliationId: string;
  journalEntryId: string;
  accountCode: string;
  amount: number;
}

export interface BankReconciliation {
  id: string;
  accountCode: string;
  statementDate: string;
  statementBalance: number;
  status: 'Draft' | 'Reconciled';
  items: BankReconciliationItem[];
}
export interface AppData {
  companyName: string;
  company: Company;
  accounts: Account[];
  projects: Project[];
  journal: JournalEntry[];
  invoices: Invoice[];
  employees: Employee[];
  payrollRuns: PayrollRun[];
  bills: Bill[];
  bankReconciliations: BankReconciliation[];
  accountingPeriods: AccountingPeriod[];
  nextEntryNum: number;
  nextInvoiceNum: number;
  ssnitEmployeeRate: number;
  ssnitEmployerRate: number;
  nhilGetfundRate: number;
  vatRate: number;
  brackets: PayeBracket[];
}

export type MutateFn = (fn: (prev: AppData) => AppData) => void;

/* ------------------------------------------------------------------ */
/*  Component props                                                     */
/* ------------------------------------------------------------------ */

export interface PanelProps {
  data: AppData;
  mutate: MutateFn;
}

export interface InvoicingPanelProps extends PanelProps {
  setPrintContent: Dispatch<SetStateAction<ReactNode | null>>;
}

export interface PayrollPanelProps extends PanelProps {
  setPrintContent: Dispatch<SetStateAction<ReactNode | null>>;
}

export interface EmployeesPanelProps extends PanelProps {
  // no extra props
}

export interface ExportPanelProps {
  data: AppData;
  isMobile: boolean;
}

export interface NewInvoiceFormProps extends PanelProps {
  onDone?: () => void;
  cloneSource?: Invoice | null;
}

export interface RecordPaymentFormProps extends InvoicingPanelProps {
  inv: Invoice;
  onDone?: () => void;
}

export interface InvoiceDocumentProps {
  data: AppData;
  inv: Invoice;
}

export interface ReceiptDocumentProps {
  data: AppData;
  inv: Invoice;
  payment: Payment;
  receiptNo: string;
}

export interface PayslipProps {
  data: AppData;
  run: PayrollRun;
  r: PayrollLine;
}

export interface LedgerRow {
  entry_id: string | null;
  entry_number: string | null;
  entry_date: string;
  description: string | null;
  project: string | null;
  reversed: boolean;
  reversal_of: string | null;
  debit: number;
  credit: number;
  running_balance: number;
  is_opening_balance: boolean;
}

export interface ProjectStats {
  id: string;
  name: string;
  status?: string | null;
  recognitionMethod?: string | null;
  contractValue: number;
  revenueBilled: number;
  actualCost: number;
  estimatedCost: number;
  remainingCost: number;
  projectedMargin: number;
  wipMargin: number;
}

export interface ProjectPoc {
  project_id: string;
  project_name: string;
  recognition_method: string | null;
  poc_computable: boolean;
  poc_percent: number | null;
  contract_value: number | null;
  estimated_cost: number | null;
  actual_project_cost: number | null;
  revenue_billed: number | null;
  revenue_recognized: number | null;
  gross_profit_recognized: number | null;
  not_configured_reason: string | null;
}

export interface AccountingPeriod {
  id: string;
  period: string;
  year: number;
  month: number;
  name: string;
  start_date: string;
  end_date: string;
  status: 'open' | 'closed' | 'future' | 'not_open' | string;
  is_current: boolean;
  financial_year: number | string;
  financial_year_id?: string | null;
  opened_at?: string | null;
  opened_by?: string | null;
  closed_at?: string | null;
  closed_by?: string | null;
  reopened_at?: string | null;
  reopened_by?: string | null;
  reopen_reason?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
}

export interface NavItem {
  key: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
}

/* ------------------------------------------------------------------ */
/*  DB layer types                                                      */
/* ------------------------------------------------------------------ */

export interface Db {
  saveAccounts: (accounts: Account[]) => Promise<unknown>;
  saveProjects: (projects: Project[]) => Promise<unknown>;
  saveEmployees: (employees: Employee[]) => Promise<unknown>;
  saveJournalEntry: (entry: JournalEntry) => Promise<void>;
  deleteJournalEntry?: (entryId: string) => Promise<void>;
  deleteJournalEntriesByInvoiceNumber?: (invoiceNumber: string) => Promise<void>;
  saveInvoice: (invoice: Invoice) => Promise<void>;
  savePayrollRun: (run: PayrollRun) => Promise<void>;
  saveBill: (bill: Bill) => Promise<void>;
  deleteAccount: (code: string) => Promise<unknown>;
  deleteProject: (id: string) => Promise<unknown>;
  deleteEmployee: (id: string) => Promise<void>;
  inviteEmployee: (employeeId: string, email?: string, redirectTo?: string) => Promise<{ mode: 'invited' | 'resent'; authUserId: string }>;
  completeOnboarding?: (employeeId: string, password: string) => Promise<void>;
  deleteBill: (id: string) => Promise<void>;
  saveBankReconciliation: (rec: BankReconciliation) => Promise<void>;
  deleteBankReconciliation: (id: string) => Promise<void>;
}
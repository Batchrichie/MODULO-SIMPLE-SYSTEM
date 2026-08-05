// src/types.ts
import type { ReactNode, Dispatch, SetStateAction, ComponentType } from 'react';

/* ------------------------------------------------------------------ */
/*  Domain primitives                                                   */
/* ------------------------------------------------------------------ */

export type Currency = 'GHS' | 'USD';

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
}

export interface Account {
  code: string;
  name: string;
  type: string;
  reportingGroup?: string | null;
  normal?: 'Debit' | 'Credit' | null;
}

export interface ProjectStats {
  id: string;
  name: string;
  status?: string | null;
  contractValue: number;
  revenueBilled: number;
  actualCost: number;
  estimatedCost: number;
  remainingCost: number;
  projectedMargin: number;
  wipMargin: number;
}

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
  subtotal: number;
  discount: number;
  newSubtotal: number;
  nhilGetfund: number;
  vat: number;
  grandTotal: number;
  chargeNhil: boolean;
  chargeVat: boolean;
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

export interface PayeBracket {
  upto: number; // use Infinity for the top band
  rate: number; // e.g. 0.1 for 10%
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

export interface ProjectStats {
  name: string;
  status?: string | null;
  contractValue: number;
  revenueBilled: number;
  actualCost: number;
  estimatedCost: number;
  remainingCost: number;
  projectedMargin: number;
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
  saveInvoice: (invoice: Invoice) => Promise<void>;
  savePayrollRun: (run: PayrollRun) => Promise<void>;
  deleteAccount: (code: string) => Promise<unknown>;
  deleteProject: (id: string) => Promise<unknown>;
  deleteEmployee: (id: string) => Promise<unknown>;
}

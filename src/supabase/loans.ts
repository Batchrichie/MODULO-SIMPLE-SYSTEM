import { getRecords } from '../lib/data';
import { callRpc } from '../lib/rpc/accountant';

export interface Loan {
  id: string;
  employee_id: string;
  amount: number;
  purpose: string | null;
  term_months: number | null;
  interest_rate: number | null;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Settled' | string;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string | null;
  employee?: { name: string } | null;
  approver?: { name: string } | null;
}

export interface LoanRepayment {
  id: string;
  loan_id: string;
  amount: number;
  repayment_date: string;
  created_at: string;
}

export async function loadMyLoans(employeeId: string): Promise<Loan[]> {
  return getRecords<Loan>('loans', { filters: { employee_id: employeeId } });
}

export async function loadMyLoanRepayments(loanIds: string[]): Promise<LoanRepayment[]> {
  if (loanIds.length === 0) return [];
  return getRecords<LoanRepayment>('loan_repayments', { filters: { loan_id: loanIds } });
}

export async function loadAllLoans(): Promise<Loan[]> {
  return getRecords<Loan>('loans', {
    select: '*, employee:employees!loans_employee_id_fkey(name), approver:employees!loans_approved_by_fkey(name)',
  });
}

export async function loadLoanRepayments(): Promise<LoanRepayment[]> {
  return getRecords<LoanRepayment>('loan_repayments');
}

export async function requestLoan(input: {
  amount: number;
  reason: string | null;
}): Promise<Loan> {
  return callRpc<Loan>('request_loan', { p_amount: input.amount, p_reason: input.reason });
}

export async function recordLoanRepayment(loanId: string, amount: number): Promise<LoanRepayment> {
  return callRpc<LoanRepayment>('record_loan_repayment', { p_loan_id: loanId, p_amount: amount });
}

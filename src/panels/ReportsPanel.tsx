import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import * as XLSX from 'xlsx';
import { AlertTriangle, Download, Printer, X } from 'lucide-react';
import Card from '../components/ui/Card';
import SectionTitle from '../components/ui/SectionTitle';
import TableScroll from '../components/ui/TableScroll';
import Th from '../components/ui/Th';
import Td from '../components/ui/Td';
import Button from '../components/ui/Button';
import AccountSelect from '../components/ui/AccountSelect';
import { inputStyle, labelStyle } from '../components/ui/styles';
import { ALERT, FONT_MONO, GREEN, INK, MUTED, RULE } from '../theme/tokens';
import { fmt } from '../utils/format';
import type { Account, AppData, Invoice } from '../types';
import {
  getReportAccountActivity,
  getExpenseReportPage,
  getReportAccountSummary,
  getReportJournalEntry,
  getReportJournalPage,
  getReportProjectTransactions,
  getReportProfitAndLoss,
} from '../supabaseClient';
import type {
  ReportAccountActivityRow,
  ReportJournalRow,
  ExpenseReportFilters,
  ExpenseReportPage,
  ExpenseRow,
  ReportAccountSummaryRow,
  ReportProjectTransactionRow,
  ReportProfitLossRow,
} from '../supabaseClient';

type ReportKey = 'aged' | 'account' | 'project' | 'expenses' | 'summary' | 'journal';
type SortDirection = 'asc' | 'desc';

const ACCOUNT_ACTIVITY_PAGE_SIZE = 100;
const PROJECT_TRANSACTION_PAGE_SIZE = 100;
const EXPENSE_PAGE_SIZE = 100;
const JOURNAL_PAGE_SIZE = 50;
const SUMMARY_PAGE_SIZE = 200;
const reportInputStyle: CSSProperties = { ...inputStyle, boxSizing: 'border-box' };

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block', minWidth: 150, flex: '1 1 180px' }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </label>
  );
}

function dateRangeIsValid(start: string, end: string): boolean {
  return !start || !end || start <= end;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? 'Unknown error');
}

function reportFileName(report: ReportKey): string {
  return `modulo-${report}-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
}

async function loadReportPages<T>(
  pageSize: number,
  loadPage: (offset: number, limit: number) => Promise<{ rows: T[]; hasMore: boolean }>,
  advanceOffset: (rows: T[]) => number = (rows) => rows.length
): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const pageResult = await loadPage(offset, pageSize);
    if (pageResult.hasMore && pageResult.rows.length === 0) {
      throw new Error('The report API indicated more rows but returned an empty page.');
    }
    rows.push(...pageResult.rows);
    hasMore = pageResult.hasMore;
    offset += advanceOffset(pageResult.rows);
  }
  return rows;
}

export default function ReportsPanel({ data }: { data: AppData }) {
  const today = new Date().toISOString().slice(0, 10);
  const [report, setReport] = useState<ReportKey>('aged');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [project, setProject] = useState('');
  const [account, setAccount] = useState('');
  const [expenseAccount, setExpenseAccount] = useState('');
  const [paymentAccount, setPaymentAccount] = useState('');
  const [vendor, setVendor] = useState('');
  const [status, setStatus] = useState<ExpenseRow['status'] | ''>('');
  const [reference, setReference] = useState('');
  const [accountType, setAccountType] = useState('');
  const [reportingGroup, setReportingGroup] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [ledgerRows, setLedgerRows] = useState<ReportAccountActivityRow[]>([]);
  const [ledgerTotalCount, setLedgerTotalCount] = useState(0);
  const [ledgerLoaded, setLedgerLoaded] = useState(false);
  const [projectSummary, setProjectSummary] = useState<ReportProfitLossRow[]>([]);
  const [projectEntries, setProjectEntries] = useState<ReportProjectTransactionRow[]>([]);
  const [projectLoaded, setProjectLoaded] = useState(false);
  const [expensePage, setExpensePage] = useState<ExpenseReportPage | null>(null);
  const [journalEntries, setJournalEntries] = useState<ReportJournalRow[]>([]);
  const [journalLoaded, setJournalLoaded] = useState(false);
  const [accountSummaryRows, setAccountSummaryRows] = useState<ReportAccountSummaryRow[]>([]);
  const [summaryLoaded, setSummaryLoaded] = useState(false);
  const [openedJournal, setOpenedJournal] = useState<{
    id: string;
    entry_number: string;
    date: string;
    description: string | null;
    project: string | null;
    reversed: boolean;
    reversal_of: string | null;
    lines: Array<{ id: string; account_code: string; debit: number; credit: number }>;
  } | null>(null);

  const allAccounts = data.accounts;
  const accountTypes = useMemo(() => [...new Set(allAccounts.map((item) => item.type).filter(Boolean))].sort(), [allAccounts]);
  const reportingGroups = useMemo(
    () => [...new Set(allAccounts.map((item) => item.reportingGroup).filter((value): value is string => Boolean(value)))].sort(),
    [allAccounts]
  );

  /* ---------- Aged Receivables ---------- */
  const aged = useMemo(() => {
    const buckets = {
      current: [] as Invoice[],
      d30: [] as Invoice[],
      d60: [] as Invoice[],
      d90: [] as Invoice[],
      d90plus: [] as Invoice[],
    };
    const totals = { current: 0, d30: 0, d60: 0, d90: 0, d90plus: 0 };

    data.invoices.forEach((inv) => {
      const paid = inv.payments.reduce((sum, payment) => sum + payment.amountGHS, 0);
      const balance = (inv.totals?.total_ghs ?? inv.totals?.grandTotalGHS ?? inv.totals?.total ?? inv.totals?.grandTotal ?? 0) - paid;
      if (balance <= 0.01) return;
      const daysOverdue = Math.floor(
        (new Date(today).getTime() - new Date(inv.dueDate || inv.date).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysOverdue <= 0) {
        buckets.current.push(inv);
        totals.current += balance;
      } else if (daysOverdue <= 30) {
        buckets.d30.push(inv);
        totals.d30 += balance;
      } else if (daysOverdue <= 60) {
        buckets.d60.push(inv);
        totals.d60 += balance;
      } else if (daysOverdue <= 90) {
        buckets.d90.push(inv);
        totals.d90 += balance;
      } else {
        buckets.d90plus.push(inv);
        totals.d90plus += balance;
      }
    });
    return { buckets, totals };
  }, [data.invoices, today]);

  const bucketMeta = [
    { key: 'current' as const, label: 'Current (Not yet due)', color: GREEN },
    { key: 'd30' as const, label: '1 – 30 days overdue', color: '#B58A2A' },
    { key: 'd60' as const, label: '31 – 60 days overdue', color: '#E67E22' },
    { key: 'd90' as const, label: '61 – 90 days overdue', color: ALERT },
    { key: 'd90plus' as const, label: '90+ days overdue', color: '#7B241C' },
  ];
  const totalOutstanding = Object.values(aged.totals).reduce((sum, value) => sum + value, 0);

  function clearReportData() {
    setPage(0);
    setHasMore(false);
    setLedgerRows([]);
    setLedgerTotalCount(0);
    setLedgerLoaded(false);
    setProjectSummary([]);
    setProjectEntries([]);
    setProjectLoaded(false);
    setExpensePage(null);
    setJournalEntries([]);
    setJournalLoaded(false);
    setAccountSummaryRows([]);
    setSummaryLoaded(false);
    setOpenedJournal(null);
    setError('');
    setNotice('');
  }

  function selectReport(next: ReportKey) {
    setReport(next);
    clearReportData();
    setSortBy(next === 'project' || next === 'journal' || next === 'expenses' || next === 'account' ? 'date' : 'account');
    setSortDirection('asc');
  }

  function clearFilters() {
    setStartDate('');
    setEndDate('');
    setProject('');
    setAccount('');
    setExpenseAccount('');
    setPaymentAccount('');
    setVendor('');
    setStatus('');
    setReference('');
    setAccountType('');
    setReportingGroup('');
    setSortBy('date');
    setSortDirection('asc');
    clearReportData();
  }

  function currentExpenseFilters(): ExpenseReportFilters {
    return {
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      project: project || undefined,
      expenseAccount: expenseAccount || undefined,
      paymentAccount: paymentAccount || undefined,
      vendor: vendor.trim() || undefined,
      status,
      sortBy: sortBy === 'vendor' ? 'vendor_payee'
        : sortBy === 'amount' ? 'amount'
          : sortBy === 'account' ? 'expense_account_code'
            : sortBy === 'status' ? 'status'
              : 'transaction_date',
      sortDirection,
    };
  }

  function journalSortBy() {
    return sortBy === 'journal' ? 'entry_number' as const : 'entry_date' as const;
  }

  function accountActivitySortBy() {
    return sortBy === 'journal' ? 'entry_number' as const
      : sortBy === 'debit' ? 'debit' as const
        : sortBy === 'credit' ? 'credit' as const
          : 'entry_date' as const;
  }

  function loadAccountActivityPage(offset: number, limit: number) {
    if (!account) throw new Error('Select an account to view its activity.');
    return getReportAccountActivity({
      accountCode: account,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      project: project || undefined,
      sortBy: accountActivitySortBy(),
      sortDirection,
    }, offset, limit);
  }

  function loadProjectTransactionPage(offset: number, limit: number) {
    if (!project) throw new Error('Select a project to view its financial report.');
    return getReportProjectTransactions({
      project,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      accountCode: account || undefined,
      sortBy: sortBy === 'projectAccount' ? 'account_code' : sortBy === 'amount' ? 'amount' : 'entry_date',
      sortDirection,
    }, offset, limit);
  }

  function loadAccountSummaryPage(offset: number, limit: number) {
    return getReportAccountSummary({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      accountType: accountType || undefined,
      reportingGroup: reportingGroup || undefined,
      includeZero: true,
      sortBy: sortBy === 'name' ? 'account_name'
        : sortBy === 'type' ? 'account_type'
          : sortBy === 'group' ? 'reporting_group'
            : sortBy === 'debit' ? 'period_debit'
              : sortBy === 'credit' ? 'period_credit'
                : sortBy === 'balance' ? 'closing_balance'
                  : 'account_code',
      sortDirection,
    }, offset, limit);
  }

  function loadJournalPage(offset: number, limit: number) {
    return getReportJournalPage({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      accountCode: account || undefined,
      project: project || undefined,
      reference: reference.trim() || undefined,
      sortBy: journalSortBy(),
      sortDirection,
    }, offset, limit);
  }

  async function applyFilters(nextPage = 0) {
    setError('');
    setNotice('');
    setLoading(true);
    setPage(nextPage);
    setOpenedJournal(null);
    if (nextPage === 0) {
      if (report === 'account') {
        setLedgerRows([]);
        setLedgerLoaded(false);
      } else if (report === 'project') {
        setProjectSummary([]);
        setProjectEntries([]);
        setProjectLoaded(false);
      } else if (report === 'expenses') {
        setExpensePage(null);
      } else if (report === 'summary') {
        setAccountSummaryRows([]);
        setSummaryLoaded(false);
      } else if (report === 'journal') {
        setJournalEntries([]);
        setJournalLoaded(false);
      }
    }
    try {
      if (report !== 'aged' && !dateRangeIsValid(startDate, endDate)) {
        throw new Error('The start date must be on or before the end date.');
      }

      if (report === 'aged') return;

      if (report === 'account') {
        const result = await loadAccountActivityPage(nextPage * ACCOUNT_ACTIVITY_PAGE_SIZE, ACCOUNT_ACTIVITY_PAGE_SIZE);
        setLedgerRows(result.rows);
        setLedgerTotalCount(result.totalCount);
        setHasMore(result.hasMore);
        setLedgerLoaded(true);
        return;
      }

      if (report === 'project') {
        if (!project) throw new Error('Select a project to view its financial report.');
        if (!startDate || !endDate) throw new Error('Select both a start date and an end date for the project financial report.');
        const [summary, pageResult] = await Promise.all([
          getReportProfitAndLoss(startDate, endDate, project),
          loadProjectTransactionPage(nextPage * PROJECT_TRANSACTION_PAGE_SIZE, PROJECT_TRANSACTION_PAGE_SIZE),
        ]);
        setProjectSummary(summary);
        setProjectEntries(pageResult.rows);
        setProjectLoaded(true);
        setHasMore(pageResult.hasMore);
        return;
      }

      if (report === 'expenses') {
        const result = await getExpenseReportPage(currentExpenseFilters(), nextPage * EXPENSE_PAGE_SIZE, EXPENSE_PAGE_SIZE);
        setExpensePage(result);
        setHasMore(result.hasMore);
        return;
      }

      if (report === 'summary') {
        const result = await loadAccountSummaryPage(nextPage * SUMMARY_PAGE_SIZE, SUMMARY_PAGE_SIZE);
        setAccountSummaryRows(result.rows);
        setSummaryLoaded(true);
        setHasMore(result.hasMore);
        return;
      }

      const result = await loadJournalPage(nextPage * JOURNAL_PAGE_SIZE, JOURNAL_PAGE_SIZE);
      setJournalEntries(result.rows);
      setJournalLoaded(true);
      setHasMore(result.hasMore);
    } catch (loadError) {
      setError(errorText(loadError));
    } finally {
      setLoading(false);
    }
  }

  async function openJournal(entryId: string | null) {
    if (!entryId) return;
    setLoading(true);
    setError('');
    try {
      const entry = await getReportJournalEntry(entryId);
      if (!entry) throw new Error('The journal entry could not be found or is not visible to your account.');
      setOpenedJournal(entry);
    } catch (loadError) {
      setError(errorText(loadError));
    } finally {
      setLoading(false);
    }
  }

  async function openAccountActivity(code: string) {
    setAccount(code);
    setProject('');
    setStartDate('');
    setEndDate('');
    selectReport('account');
    setLoading(true);
    try {
      const result = await getReportAccountActivity({
        accountCode: code,
        sortBy: 'entry_date',
        sortDirection,
      }, 0, ACCOUNT_ACTIVITY_PAGE_SIZE);
      setLedgerRows(result.rows);
      setLedgerTotalCount(result.totalCount);
      setHasMore(result.hasMore);
      setLedgerLoaded(true);
    } catch (loadError) {
      setError(errorText(loadError));
    } finally {
      setLoading(false);
    }
  }

  function accountFor(code: string): Account | undefined {
    return allAccounts.find((item) => item.code === code);
  }

  function projectName(projectId: string | null): string {
    if (!projectId || projectId === 'GEN') return 'General';
    return data.projects.find((item) => item.id === projectId)?.name ?? projectId;
  }

  function downloadWorkbook(sheets: Array<{ name: string; rows: Record<string, string | number | null>[] }>) {
    const workbook = XLSX.utils.book_new();
    for (const sheet of sheets) {
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(sheet.rows),
        sheet.name.slice(0, 31)
      );
    }
    XLSX.writeFile(workbook, reportFileName(report));
  }

  async function exportReport() {
    setError('');
    setLoading(true);
    try {
      if (report === 'aged') {
        const rows = bucketMeta.flatMap((bucket) => aged.buckets[bucket.key].map((invoice) => ({
          Client: invoice.billTo,
          'Invoice Number': invoice.invoiceNumber,
          Date: invoice.date,
          'Due Date': invoice.dueDate ?? '',
          Balance: (invoice.totals?.total_ghs ?? invoice.totals?.grandTotalGHS ?? invoice.totals?.total ?? invoice.totals?.grandTotal ?? 0) -
            invoice.payments.reduce((sum, payment) => sum + payment.amountGHS, 0),
          Bucket: bucket.label,
        })));
        downloadWorkbook([{ name: 'Aged Receivables', rows }]);
        return;
      }
      if (report === 'account') {
        const allRows = await loadReportPages(
          ACCOUNT_ACTIVITY_PAGE_SIZE,
          loadAccountActivityPage,
          (rows) => rows.filter((row) => row.line_id !== null).length
        );
        const rows = allRows.map((row) => ({
          'Row Type': row.row_type,
          Date: row.entry_date ?? '',
          'Journal Number': row.entry_number ?? '',
          Description: row.description ?? '',
          Project: projectName(row.project),
          'Reversal Role': row.reversal_role ?? '',
          'Linked Journal Number': row.linked_entry_number ?? '',
          Debit: Number(row.debit ?? 0),
          Credit: Number(row.credit ?? 0),
          'Running Balance': Number(row.running_balance ?? 0),
          'Opening Balance': Number(row.opening_balance ?? 0),
          'Closing Balance': Number(row.closing_balance ?? 0),
        }));
        downloadWorkbook([{ name: 'Account Activity', rows }]);
        return;
      }
      if (report === 'summary') {
        const allRows = await loadReportPages(SUMMARY_PAGE_SIZE, loadAccountSummaryPage);
        downloadWorkbook([{
          name: 'Account Summary',
          rows: allRows.map((row) => ({
            'Account Code': row.account_code,
            'Account Name': row.account_name,
            'Account Type': row.account_type,
            'Normal Balance': row.normal_balance,
            'Reporting Group': row.reporting_group ?? '',
            'Opening Balance': Number(row.opening_balance || 0),
            'Period Debit': Number(row.period_debit || 0),
            'Period Credit': Number(row.period_credit || 0),
            'Closing Balance': Number(row.closing_balance || 0),
          })),
        }]);
        return;
      }
      if (report === 'project') {
        if (!project || !startDate || !endDate) throw new Error('Apply a project and date range before exporting this report.');
        const [summary, allRows] = await Promise.all([
          getReportProfitAndLoss(startDate, endDate, project),
          loadReportPages(PROJECT_TRANSACTION_PAGE_SIZE, loadProjectTransactionPage),
        ]);
        const income = summary.filter((row) => row.type === 'Income').reduce((sum, row) => sum + Number(row.amount || 0), 0);
        const expenses = summary.filter((row) => row.type === 'Expense').reduce((sum, row) => sum + Number(row.amount || 0), 0);
        const detailRows = allRows.map((row) => ({
          Date: row.entry_date,
          'Journal Number': row.entry_number,
          Account: `${row.account_code} - ${row.account_name}`,
          Type: row.account_type,
          'Reporting Group': row.reporting_group ?? '',
          Description: row.description ?? '',
          Debit: Number(row.debit || 0),
          Credit: Number(row.credit || 0),
          Amount: Number(row.amount || 0),
          'Reversal Role': row.reversal_role ?? '',
          'Linked Journal Number': row.linked_entry_number ?? '',
        }));
        const summaryRows = [{
          Project: projectName(project),
          'Start Date': startDate,
          'End Date': endDate,
          Income: income,
          Expenses: expenses,
          Margin: income - expenses,
        }];
        downloadWorkbook([
          { name: 'Project Summary', rows: summaryRows },
          { name: 'Transactions', rows: detailRows },
        ]);
        return;
      }

      if (report === 'journal') {
        const allRows: ReportJournalRow[] = [];
        let offset = 0;
        let more = true;
        while (more) {
          const result = await loadJournalPage(offset, JOURNAL_PAGE_SIZE);
          if (result.hasMore && result.entryCount === 0) {
            throw new Error('The journal report API indicated more entries but returned an empty page.');
          }
          allRows.push(...result.rows);
          more = result.hasMore;
          offset += result.entryCount;
        }
        downloadWorkbook([{
          name: 'Journal Transactions',
          rows: allRows.map((row) => ({
            Date: row.entry_date,
            'Journal Number': row.entry_number,
            Description: row.description ?? '',
            Project: projectName(row.project),
            'Reversal Role': row.reversal_role ?? '',
            'Linked Journal Number': row.linked_entry_number ?? '',
            Account: `${row.account_code} - ${row.account_name}`,
            Debit: Number(row.debit || 0),
            Credit: Number(row.credit || 0),
            'Entry Total Debit': Number(row.entry_total_debit || 0),
            'Entry Total Credit': Number(row.entry_total_credit || 0),
            'Filter Match': row.is_filter_match ? 'Yes' : 'No',
          })),
        }]);
        return;
      }

      const allExpenseRows = await loadReportPages(EXPENSE_PAGE_SIZE, (offset, limit) => (
        getExpenseReportPage(currentExpenseFilters(), offset, limit)
      ));
      downloadWorkbook([{
        name: 'Expense Register',
        rows: allExpenseRows.map((expense) => ({
          'Expense Number': expense.expense_number,
          Date: expense.transaction_date,
          Vendor: expense.vendor_payee,
          Description: expense.description,
          Project: projectName(expense.project),
          'Expense Account': expense.expense_account_code ?? '',
          'Payment Account': expense.payment_account_code ?? '',
          Amount: Number(expense.amount || 0),
          'Posted Amount': expense.posted_amount == null ? '' : Number(expense.posted_amount),
          'Posted Amount Matches': expense.posted_amount_matches == null ? '' : expense.posted_amount_matches ? 'Yes' : 'No',
          Status: expense.status,
          'Journal Number': expense.journal_entry_number ?? '',
          'Journal Date': expense.journal_date ?? '',
        })),
      }]);
    } catch (exportError) {
      setError(`Could not export report: ${errorText(exportError)}`);
    } finally {
      setLoading(false);
    }
  }

  const projectIncome = projectSummary
    .filter((row) => row.type === 'Income')
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const projectExpenses = projectSummary
    .filter((row) => row.type === 'Expense')
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const groupedJournalEntries = useMemo(() => {
    const groups = new Map<string, {
      id: string;
      entry_number: string;
      date: string;
      description: string | null;
      project: string | null;
      reversal_role: string | null;
      linked_entry_id: string | null;
      linked_entry_number: string | null;
      total_debit: number;
      total_credit: number;
      lines: ReportJournalRow[];
    }>();
    for (const row of journalEntries) {
      let group = groups.get(row.entry_id);
      if (!group) {
        group = {
          id: row.entry_id,
          entry_number: row.entry_number,
          date: row.entry_date,
          description: row.description,
          project: row.project,
          reversal_role: row.reversal_role,
          linked_entry_id: row.linked_entry_id,
          linked_entry_number: row.linked_entry_number,
          total_debit: Number(row.entry_total_debit || 0),
          total_credit: Number(row.entry_total_credit || 0),
          lines: [],
        };
        groups.set(row.entry_id, group);
      }
      group.lines.push(row);
    }
    return [...groups.values()];
  }, [journalEntries]);

  const reportOptions: Array<{ key: ReportKey; label: string }> = [
    { key: 'aged', label: 'Aged Receivables' },
    { key: 'account', label: 'Account Activity / General Ledger' },
    { key: 'project', label: 'Project Profitability' },
    { key: 'expenses', label: 'Expense Register' },
    { key: 'summary', label: 'Account Summary' },
    { key: 'journal', label: 'Journal Transactions' },
  ];
  const supportsDates = report === 'account' || report === 'project' || report === 'expenses' || report === 'journal' || report === 'summary';

  const activePageSize = report === 'account' ? ACCOUNT_ACTIVITY_PAGE_SIZE
    : report === 'project' ? PROJECT_TRANSACTION_PAGE_SIZE
      : report === 'expenses' ? EXPENSE_PAGE_SIZE
        : report === 'summary' ? SUMMARY_PAGE_SIZE
          : JOURNAL_PAGE_SIZE;

  function pageControls() {
    const totalCount = report === 'account' ? ledgerTotalCount
      : report === 'project' ? Number(projectEntries[0]?.total_count ?? 0)
        : report === 'expenses' ? Number(expensePage?.rows[0]?.total_count ?? 0)
          : report === 'summary' ? Number(accountSummaryRows[0]?.total_count ?? 0)
            : Number(journalEntries[0]?.total_count ?? 0);
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 0 2px' }}>
        <span style={{ fontSize: 12, color: MUTED }}>
          {`Page ${page + 1}${totalCount ? ` of ${Math.ceil(totalCount / activePageSize)}` : ''} · ${activePageSize} ${report === 'journal' ? 'entries' : 'rows'} per page · server-sorted`}
        </span>
        {report !== 'aged' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" size="sm" disabled={loading || page === 0} onClick={() => void applyFilters(page - 1)}>Previous</Button>
            <Button variant="ghost" size="sm" disabled={loading || !hasMore} onClick={() => void applyFilters(page + 1)}>Next</Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <SectionTitle sub="Date-filtered financial and operational reports sourced from the accounting records.">
        Report Centre
      </SectionTitle>

      <Card style={{ marginBottom: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, alignItems: 'end' }}>
          <Field label="Report">
            <select style={reportInputStyle} value={report} onChange={(event) => selectReport(event.target.value as ReportKey)}>
              {reportOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
            </select>
          </Field>
          {supportsDates && (
            <>
              <Field label="Start date">
                <input type="date" style={reportInputStyle} value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </Field>
              <Field label="End date">
                <input type="date" style={reportInputStyle} value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              </Field>
            </>
          )}
          {(report === 'account' || report === 'project' || report === 'expenses' || report === 'journal') && (
            <Field label="Project">
              <select style={reportInputStyle} value={project} onChange={(event) => setProject(event.target.value)}>
                <option value="">{report === 'project' ? 'Select project' : 'All projects'}</option>
                {report !== 'project' && <option value="GEN">General / unassigned</option>}
                {data.projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </Field>
          )}
          {(report === 'account' || report === 'project' || report === 'journal') && (
            <Field label={report === 'account' ? 'Account (required)' : 'Account'}>
              <AccountSelect value={account} onChange={setAccount} accounts={allAccounts} />
            </Field>
          )}
          {report === 'expenses' && (
            <>
              <Field label="Expense account">
                <AccountSelect value={expenseAccount} onChange={setExpenseAccount} accounts={allAccounts} filterTypes={['Expense']} placeholder="Any expense account" />
              </Field>
              <Field label="Payment account">
                <AccountSelect value={paymentAccount} onChange={setPaymentAccount} accounts={allAccounts} filterFn={(item) => Boolean(item.isPaymentAccount)} placeholder="Any payment account" />
              </Field>
              <Field label="Vendor / payee">
                <input style={reportInputStyle} value={vendor} onChange={(event) => setVendor(event.target.value)} placeholder="Search vendor" />
              </Field>
              <Field label="Status">
                <select style={reportInputStyle} value={status} onChange={(event) => setStatus(event.target.value as ExpenseRow['status'] | '')}>
                  <option value="">All statuses</option>
                  <option value="Draft">Draft</option>
                  <option value="Posted">Posted</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </Field>
            </>
          )}
          {report === 'journal' && (
            <Field label="Journal number / reference">
              <input style={reportInputStyle} value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Search journal number" />
            </Field>
          )}
          {report === 'summary' && (
            <>
              <Field label="Account type">
                <select style={reportInputStyle} value={accountType} onChange={(event) => setAccountType(event.target.value)}>
                  <option value="">All types</option>
                  {accountTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </Field>
              <Field label="Reporting group">
                <select style={reportInputStyle} value={reportingGroup} onChange={(event) => setReportingGroup(event.target.value)}>
                  <option value="">All reporting groups</option>
                  {reportingGroups.map((group) => <option key={group} value={group}>{group}</option>)}
                </select>
              </Field>
            </>
          )}
          {(report === 'account' || report === 'project' || report === 'expenses' || report === 'journal' || report === 'summary') && (
            <Field label="Sort by">
              <select style={reportInputStyle} value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                {report === 'account' && <>
                  <option value="date">Date</option><option value="journal">Journal number</option><option value="debit">Debit</option><option value="credit">Credit</option>
                </>}
                {report === 'project' && <>
                  <option value="date">Date</option><option value="projectAccount">Account</option><option value="amount">Amount</option>
                </>}
                {report === 'expenses' && <>
                  <option value="date">Date</option><option value="account">Expense account</option><option value="amount">Amount</option><option value="vendor">Vendor</option>
                </>}
                {report === 'journal' && <>
                  <option value="date">Date</option><option value="journal">Journal number</option>
                </>}
                {report === 'summary' && <>
                  <option value="account">Account code</option><option value="name">Account name</option><option value="type">Account type</option><option value="group">Reporting group</option><option value="debit">Debit</option><option value="credit">Credit</option><option value="balance">Closing balance</option>
                </>}
              </select>
            </Field>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
            <Button onClick={() => void applyFilters()} disabled={loading}>Apply Filters</Button>
            <Button variant="ghost" onClick={clearFilters} disabled={loading}>Clear Filters</Button>
          </div>
        </div>
        {(report === 'account' || report === 'project' || report === 'expenses' || report === 'journal' || report === 'summary') && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
            <span style={{ fontSize: 12, color: MUTED }}>Sort direction</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSortDirection((value) => value === 'asc' ? 'desc' : 'asc')}
            >
              {sortDirection === 'asc' ? 'Ascending' : 'Descending'}
            </Button>
          </div>
        )}
      </Card>

      {loading && <Card style={{ marginBottom: 16 }}><p role="status" style={{ margin: 0 }}>Loading report…</p></Card>}
      {error && (
        <Card style={{ marginBottom: 16, border: `1px solid ${ALERT}` }}>
          <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, color: ALERT }}>
            <AlertTriangle size={17} /> <span>{error}</span>
          </div>
        </Card>
      )}
      {notice && (
        <Card style={{ marginBottom: 16, border: `1px solid ${RULE}` }}>
          <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, color: MUTED }}>
            <AlertTriangle size={17} /> <span>{notice}</span>
          </div>
        </Card>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <Button variant="ghost" size="sm" disabled={loading} onClick={() => void exportReport()}><Download size={14} /> Export to Excel</Button>
        <Button variant="ghost" size="sm" onClick={() => window.print()}><Printer size={14} /> Print / Save PDF</Button>
      </div>

      {report === 'aged' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            {bucketMeta.map((bucket) => (
              <Card key={bucket.key} style={{ flex: '1 1 160px', borderTop: `3px solid ${bucket.color}` }}>
                <div style={{ fontSize: 11, color: MUTED, fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>{bucket.label}</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 20, fontWeight: 700, color: INK }}>GHS {fmt(aged.totals[bucket.key])}</div>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
                  {aged.buckets[bucket.key].length} invoice{aged.buckets[bucket.key].length === 1 ? '' : 's'}
                </div>
              </Card>
            ))}
            <Card style={{ flex: '1 1 160px', borderTop: `3px solid ${INK}` }}>
              <div style={{ fontSize: 11, color: MUTED, fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Total Outstanding</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 20, fontWeight: 700, color: INK }}>GHS {fmt(totalOutstanding)}</div>
            </Card>
          </div>
          <Card>
            <TableScroll>
              <table className="table-card" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><Th>Client</Th><Th>Invoice #</Th><Th>Date</Th><Th>Due Date</Th><Th right>Days Overdue</Th><Th right>Balance (GHS)</Th><Th>Bucket</Th></tr></thead>
                <tbody>
                  {bucketMeta.flatMap((bucket) => aged.buckets[bucket.key].map((invoice) => {
                    const paid = invoice.payments.reduce((sum, payment) => sum + payment.amountGHS, 0);
                    const balance = (invoice.totals?.total_ghs ?? invoice.totals?.grandTotalGHS ?? invoice.totals?.total ?? invoice.totals?.grandTotal ?? 0) - paid;
                    const days = Math.floor((new Date(today).getTime() - new Date(invoice.dueDate || invoice.date).getTime()) / (1000 * 60 * 60 * 24));
                    return (
                      <tr key={invoice.id} className="row-hover">
                        <Td label="Client">{invoice.billTo}</Td><Td mono label="Invoice #">{invoice.invoiceNumber}</Td>
                        <Td label="Date">{invoice.date}</Td><Td label="Due Date">{invoice.dueDate || '—'}</Td>
                        <Td right mono label="Days Overdue" style={{ color: days > 0 ? ALERT : MUTED }}>{days > 0 ? `+${days}` : '0'}</Td>
                        <Td right mono bold label="Balance">GHS {fmt(balance)}</Td>
                        <Td label="Bucket"><span style={{ color: bucket.color, fontWeight: 700, fontSize: 11 }}>{bucket.label}</span></Td>
                      </tr>
                    );
                  }))}
                  {totalOutstanding === 0 && <tr><td colSpan={7} style={{ color: MUTED, padding: 14, textAlign: 'center' }}>No outstanding invoices. All paid up!</td></tr>}
                </tbody>
              </table>
            </TableScroll>
          </Card>
        </>
      )}

      {report === 'account' && (
        <>
          <SectionTitle sub="Opening balance, activity and running balances returned by rpt_account_activity.">Account Activity / General Ledger</SectionTitle>
          {sortBy !== 'date' && (
            <Card style={{ marginBottom: 12 }}>
              <p style={{ margin: 0, color: MUTED, fontSize: 13 }}>
                Results are sorted by the selected field. Running balances remain the values supplied by the backend; use Date ascending to follow them chronologically.
              </p>
            </Card>
          )}
          <Card>
            {!ledgerLoaded && !loading
              ? <p style={{ margin: 0, color: MUTED }}>Select an account and apply filters to load activity.</p>
              : (
                <>
                  {ledgerRows[0] && (
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
                      <Card style={{ flex: '1 1 180px' }}>
                        <div style={{ color: MUTED, textTransform: 'uppercase', fontSize: 11, fontWeight: 600 }}>Opening Balance</div>
                        <div style={{ fontFamily: FONT_MONO, fontSize: 19, fontWeight: 700, marginTop: 6 }}>GHS {fmt(Number(ledgerRows[0].opening_balance || 0))}</div>
                      </Card>
                      <Card style={{ flex: '1 1 180px' }}>
                        <div style={{ color: MUTED, textTransform: 'uppercase', fontSize: 11, fontWeight: 600 }}>Closing Balance</div>
                        <div style={{ fontFamily: FONT_MONO, fontSize: 19, fontWeight: 700, marginTop: 6 }}>GHS {fmt(Number(ledgerRows[0].closing_balance || 0))}</div>
                      </Card>
                    </div>
                  )}
                  <TableScroll>
                    <table className="table-card" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr><Th>Type</Th><Th>Date</Th><Th>Journal #</Th><Th>Description</Th><Th>Project</Th><Th>Reversal</Th><Th>Linked Journal</Th><Th right>Debit</Th><Th right>Credit</Th><Th right>Running Balance</Th><Th>Entry</Th></tr></thead>
                      <tbody>
                        {ledgerRows.map((row) => (
                          <tr key={row.line_id ?? `opening-${page}`} className="row-hover">
                            <Td label="Type">{row.row_type}</Td>
                            <Td label="Date">{row.entry_date ?? '—'}</Td>
                            <Td mono label="Journal #">{row.entry_number ?? '—'}</Td>
                            <Td label="Description">{row.description ?? '—'}</Td>
                            <Td label="Project">{projectName(row.project)}</Td>
                            <Td label="Reversal">{row.reversal_role ?? '—'}</Td>
                            <Td mono label="Linked Journal">{row.linked_entry_number ?? '—'}</Td>
                            <Td right mono label="Debit">{row.debit == null ? '—' : fmt(Number(row.debit))}</Td>
                            <Td right mono label="Credit">{row.credit == null ? '—' : fmt(Number(row.credit))}</Td>
                            <Td right mono bold label="Running Balance">{fmt(Number(row.running_balance || 0))}</Td>
                            <Td label="Entry">{row.entry_id ? <Button size="sm" variant="ghost" onClick={() => void openJournal(row.entry_id)}>Open</Button> : '—'}</Td>
                          </tr>
                        ))}
                        {ledgerLoaded && ledgerRows.length === 0 && <tr><td colSpan={11} style={{ padding: 14, color: MUTED, textAlign: 'center' }}>No activity or balance row was returned for these filters; opening and closing balances are unavailable in this response.</td></tr>}
                      </tbody>
                    </table>
                  </TableScroll>
                  {pageControls()}
                </>
              )}
          </Card>
        </>
      )}

      {report === 'project' && (
        <>
          <SectionTitle sub="Summary from the three-argument get_profit_and_loss function; detail from posted journal entries.">Project Profitability</SectionTitle>
          {projectLoaded && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
              {[
                { label: 'Project Income', value: projectIncome },
                { label: 'Project Expenses', value: projectExpenses },
                { label: 'Project Margin', value: projectIncome - projectExpenses },
              ].map((item) => (
                <Card key={item.label} style={{ flex: '1 1 180px' }}>
                  <div style={{ color: MUTED, textTransform: 'uppercase', fontSize: 11, fontWeight: 600 }}>{item.label}</div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 20, fontWeight: 700, marginTop: 6 }}>GHS {fmt(item.value)}</div>
                </Card>
              ))}
            </div>
          )}
          <Card>
            {!projectLoaded && !loading
              ? <p style={{ margin: 0, color: MUTED }}>Select a project and date range, then apply filters.</p>
              : (
                <>
                  <TableScroll>
                    <table className="table-card" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr><Th>Date</Th><Th>Journal #</Th><Th>Account</Th><Th>Description</Th><Th right>Amount</Th><Th right>Debit</Th><Th right>Credit</Th><Th>Reversal</Th><Th>Entry</Th></tr></thead>
                      <tbody>
                        {projectEntries.map((row) => (
                          <tr key={row.line_id} className="row-hover">
                            <Td label="Date">{row.entry_date}</Td><Td mono label="Journal #">{row.entry_number}</Td>
                            <Td label="Account">{row.account_code} · {row.account_name}</Td>
                            <Td label="Description">{row.description ?? '—'}</Td>
                            <Td right mono label="Amount">{fmt(Number(row.amount || 0))}</Td>
                            <Td right mono label="Debit">{fmt(Number(row.debit || 0))}</Td><Td right mono label="Credit">{fmt(Number(row.credit || 0))}</Td>
                            <Td label="Reversal">{row.reversal_role ?? '—'}{row.linked_entry_number ? ` · ${row.linked_entry_number}` : ''}</Td>
                            <Td label="Entry"><Button size="sm" variant="ghost" onClick={() => void openJournal(row.entry_id)}>Open</Button></Td>
                          </tr>
                        ))}
                        {projectEntries.length === 0 && <tr><td colSpan={9} style={{ padding: 14, color: MUTED, textAlign: 'center' }}>No transactions match the account filter.</td></tr>}
                      </tbody>
                    </table>
                  </TableScroll>
                  {pageControls()}
                </>
              )}
          </Card>
        </>
      )}

      {report === 'expenses' && (
        <>
          <SectionTitle sub="Rows, posting values and linked journal references returned by rpt_expense_register.">Expense Register</SectionTitle>
          <Card>
            {!expensePage && !loading
              ? <p style={{ margin: 0, color: MUTED }}>Apply filters to load the expense register.</p>
              : (
                <>
                  {expensePage && (
                    <div style={{ marginBottom: 10, color: MUTED, fontSize: 12 }}>
                      Total posted expenses matching filters: GHS {fmt(expensePage.totalPostedAmount)}
                    </div>
                  )}
                  <TableScroll>
                    <table className="table-card" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr><Th>Expense #</Th><Th>Date</Th><Th>Vendor / Payee</Th><Th>Description</Th><Th>Project</Th><Th>Expense Account</Th><Th>Payment Account</Th><Th right>Amount</Th><Th right>Posted Amount</Th><Th>Status</Th><Th>Journal #</Th></tr></thead>
                      <tbody>
                        {(expensePage?.rows ?? []).map((expense) => (
                            <tr key={expense.expense_id} className="row-hover">
                              <Td mono label="Expense #">{expense.expense_number}</Td><Td label="Date">{expense.transaction_date}</Td>
                              <Td label="Vendor / Payee">{expense.vendor_payee}</Td><Td label="Description">{expense.description}</Td>
                              <Td label="Project">{projectName(expense.project)}</Td>
                              <Td label="Expense Account">{expense.expense_account_code ? `${expense.expense_account_code} · ${expense.expense_account_name ?? ''}` : '—'}</Td>
                              <Td label="Payment Account">{expense.payment_account_code ? `${expense.payment_account_code} · ${expense.payment_account_name ?? ''}` : '—'}</Td>
                              <Td right mono label="Amount">{`GHS ${fmt(Number(expense.amount || 0))}`}</Td>
                              <Td right mono label="Posted Amount">
                                {expense.posted_amount == null ? '—' : `GHS ${fmt(Number(expense.posted_amount))}`}
                                {expense.posted_amount_matches === false && <strong style={{ color: ALERT }}> · Mismatch</strong>}
                              </Td>
                              <Td label="Status">{expense.status}</Td>
                              <Td mono label="Journal #">{expense.journal_entry_number ?? '—'}</Td>
                            </tr>
                        ))}
                        {expensePage?.rows.length === 0 && <tr><td colSpan={11} style={{ padding: 14, color: MUTED, textAlign: 'center' }}>No expenses match these filters.</td></tr>}
                      </tbody>
                    </table>
                  </TableScroll>
                  {pageControls()}
                </>
              )}
          </Card>
        </>
      )}

      {report === 'summary' && (
        <>
          <SectionTitle sub="Opening balance, period activity and closing balance returned by rpt_account_summary.">Account Summary</SectionTitle>
          <Card>
            {!summaryLoaded && !loading
              ? <p style={{ margin: 0, color: MUTED }}>Apply filters to load the account summary.</p>
              : (
                <>
                  <TableScroll>
                    <table className="table-card" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr><Th>Account Code</Th><Th>Account Name</Th><Th>Account Type</Th><Th>Reporting Group</Th><Th right>Opening Balance</Th><Th right>Period Debit</Th><Th right>Period Credit</Th><Th right>Closing Balance</Th></tr></thead>
                      <tbody>
                        {accountSummaryRows.map((row) => (
                          <tr key={row.account_code} className="row-hover">
                            <Td mono label="Account Code">{row.account_code}</Td><Td label="Account Name">{row.account_name}</Td>
                            <Td label="Account Type">{row.account_type}</Td><Td label="Reporting Group">{row.reporting_group ?? '—'}</Td>
                            <Td right mono label="Opening Balance">{fmt(Number(row.opening_balance || 0))}</Td>
                            <Td right mono label="Period Debit">{fmt(Number(row.period_debit || 0))}</Td>
                            <Td right mono label="Period Credit">{fmt(Number(row.period_credit || 0))}</Td>
                            <Td right mono bold label="Closing Balance">
                              <button
                                type="button"
                                onClick={() => void openAccountActivity(row.account_code)}
                                style={{ border: 0, padding: 0, background: 'transparent', color: GREEN, font: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}
                                title={`Open account activity for ${row.account_code}`}
                              >
                                {fmt(Number(row.closing_balance || 0))}
                              </button>
                            </Td>
                          </tr>
                        ))}
                        {summaryLoaded && accountSummaryRows.length === 0 && <tr><td colSpan={8} style={{ padding: 14, color: MUTED, textAlign: 'center' }}>No accounts match these filters.</td></tr>}
                      </tbody>
                    </table>
                  </TableScroll>
                  {pageControls()}
                </>
              )}
          </Card>
        </>
      )}

      {report === 'journal' && (
        <>
          <SectionTitle sub="Journal headers and every debit/credit line, including reversals.">Journal Transaction Report</SectionTitle>
          <Card>
            {!journalLoaded && !loading
              ? <p style={{ margin: 0, color: MUTED }}>Apply filters to load journal entries.</p>
              : (
                <>
                  <TableScroll>
                    <table className="table-card" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr><Th>Date</Th><Th>Journal #</Th><Th>Description</Th><Th>Project</Th><Th>Reversal Status</Th><Th>Account</Th><Th right>Debit</Th><Th right>Credit</Th><Th right>Entry Debit</Th><Th right>Entry Credit</Th><Th>Filter Match</Th><Th>Entry</Th></tr></thead>
                      <tbody>
                        {groupedJournalEntries.flatMap((entry) => entry.lines.map((line) => (
                          <tr key={line.line_id} className="row-hover">
                            <Td label="Date">{entry.date}</Td><Td mono label="Journal #">{entry.entry_number}</Td>
                            <Td label="Description">{entry.description ?? '—'}</Td><Td label="Project">{projectName(entry.project)}</Td>
                            <Td label="Reversal Status">{entry.reversal_role ?? '—'}{entry.linked_entry_number ? ` · ${entry.linked_entry_number}` : ''}</Td>
                            <Td label="Account">{line.account_code} · {line.account_name}</Td>
                            <Td right mono label="Debit">{fmt(Number(line.debit || 0))}</Td><Td right mono label="Credit">{fmt(Number(line.credit || 0))}</Td>
                            <Td right mono label="Entry Debit">{fmt(entry.total_debit)}</Td><Td right mono label="Entry Credit">{fmt(entry.total_credit)}</Td>
                            <Td label="Filter Match">{line.is_filter_match ? 'Yes' : 'No'}</Td>
                            <Td label="Entry"><Button size="sm" variant="ghost" onClick={() => void openJournal(entry.id)}>Open</Button></Td>
                          </tr>
                        )))}
                        {journalLoaded && journalEntries.length === 0 && <tr><td colSpan={12} style={{ padding: 14, color: MUTED, textAlign: 'center' }}>No journal entries match these filters.</td></tr>}
                      </tbody>
                    </table>
                  </TableScroll>
                  {pageControls()}
                  {pageControls()}
                </>
              )}
          </Card>
        </>
      )}

      {openedJournal && (
        <Card style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
            <div>
              <SectionTitle sub={`${openedJournal.date} · ${projectName(openedJournal.project)}${openedJournal.reversed ? ' · Reversed' : ''}${openedJournal.reversal_of ? ` · Reversal of ${openedJournal.reversal_of}` : ''}`}>
                Journal {openedJournal.entry_number}
              </SectionTitle>
              <p style={{ margin: '0 0 12px', color: MUTED }}>{openedJournal.description || 'No description'}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setOpenedJournal(null)}><X size={14} /> Close</Button>
          </div>
          <TableScroll>
            <table className="table-card" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Account</Th><Th>Account Name</Th><Th right>Debit</Th><Th right>Credit</Th></tr></thead>
              <tbody>
                {openedJournal.lines.map((line) => <tr key={line.id}><Td mono label="Account">{line.account_code}</Td><Td label="Account Name">{accountFor(line.account_code)?.name ?? '—'}</Td><Td right mono label="Debit">{fmt(Number(line.debit || 0))}</Td><Td right mono label="Credit">{fmt(Number(line.credit || 0))}</Td></tr>)}
                {openedJournal.lines.length === 0 && <tr><td colSpan={4} style={{ padding: 12, color: MUTED, textAlign: 'center' }}>No journal lines available.</td></tr>}
              </tbody>
            </table>
          </TableScroll>
        </Card>
      )}

    </div>
  );
}

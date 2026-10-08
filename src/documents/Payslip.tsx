import React from "react";
import { COMPANY_TEMPLATE } from "../constants/defaults";
import { normalizePrintCompany } from "./FinancialShared";
import DocumentHeader from "./DocumentHeader";
import { NAVY } from "../utils/invoiceUtils";
import { amountInWords } from "../utils/numberToWords";
import { fmt } from "../utils/format";
import { FONT_BODY, FONT_MONO } from "../theme/tokens";
import type { AppData, PayslipDetails } from "../types";

interface PayslipProps {
  data: AppData;
  payslip: PayslipDetails | null;
}

const money = (value: number) => `GH₵ ${fmt(value)}`;
const provided = (value: string | null | undefined) => value?.trim() || "Not provided";

function periodLabel(period: string) {
  const [year, month] = period.slice(0, 7).split("-").map(Number);
  if (!year || !month) return period;
  return new Date(year, month - 1, 1).toLocaleString("en-GB", { month: "long", year: "numeric" });
}

export default function Payslip({ data, payslip }: PayslipProps) {
  if (!payslip) {
    return <div className="payslip-root ps-unavailable">Payslip not available</div>;
  }

  const company = normalizePrintCompany(data.company || COMPANY_TEMPLATE, data.companyName);
  const employee = payslip.employee;
  const [year, month] = payslip.period.split("-").map(Number);
  const paymentDate = new Date(year, month, 5).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });
  const slipPeriod = periodLabel(payslip.period);
  const ytdPeriod = periodLabel(payslip.ytd.through_period);
  const ytdYear = payslip.ytd.through_period.slice(0, 4);
  const ytdMonth = ytdPeriod.replace(` ${ytdYear}`, "");
  const employeeSuffix = employee.id.slice(-4);
  const suffixCollision = data.employees.some((other) =>
    other.id !== employee.id && other.id.slice(-4) === employeeSuffix
  );
  const payslipNumber = `PS-${payslip.period}-${suffixCollision ? employee.id : employeeSuffix}`;
  const deductions = payslip.deductions;
  const hasTierBreakdown = deductions.ssnit_tier1 > 0 || deductions.ssnit_tier2 > 0;
  const hasAnyDeduction = deductions.ssnit_employee > 0 || deductions.paye > 0 || deductions.loan > 0;
  const generatedAt = new Date().toLocaleString("en-GB", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const address = [company.addressLine, company.cityLine, company.poBox].filter(Boolean).join(", ");

  return (
    <div className="payslip-root">
      <style>{`
        @page { size: A4; margin: 12mm; }
        .payslip-root {
          box-sizing: border-box; width: 100%; max-width: 210mm; min-height: 273mm;
          margin: 0 auto; background: #fff; color: #171a1d;
          font-family: ${FONT_BODY}, sans-serif; font-size: 9pt; line-height: 1.35;
          -webkit-print-color-adjust: exact; print-color-adjust: exact;
        }
        .payslip-root * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .ps-company-contact { display: grid; gap: 3pt; padding: 0 16pt 8pt; background: ${NAVY}; color: #fff; text-align: right; font-size: 7.5pt; }
        .ps-meta-banner {
          display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 12pt; align-items: center;
          padding: 8pt 16pt; background: #f0f1f2; border-bottom: 1px solid #c8cdd1;
        }
        .ps-meta-label, .ps-field-label { color: #454b50; font-size: 6.8pt; font-weight: 700; text-transform: uppercase; letter-spacing: .5pt; }
        .ps-meta-value { margin-top: 2pt; font-weight: 700; font-size: 8.5pt; }
        .ps-status { color: #25384c; font-size: 7.5pt; font-weight: 700; white-space: nowrap; }
        .ps-employee, .ps-tables, .ps-paye, .ps-net, .ps-employer, .ps-ytd, .ps-footer { break-inside: avoid; page-break-inside: avoid; }
        .ps-employee { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10pt 16pt; padding: 11pt 16pt; border-bottom: 1px solid #d9dcde; }
        .ps-field-value { margin-top: 2pt; font-size: 8.5pt; font-weight: 600; overflow-wrap: anywhere; }
        .ps-field-value.mono { font-family: ${FONT_MONO}; font-variant-numeric: tabular-nums; }
        .ps-tables { display: grid; grid-template-columns: 1fr 1fr; gap: 18pt; padding: 11pt 16pt; }
        .ps-table-title, .ps-section-title { margin: 0 0 5pt; padding-bottom: 4pt; border-bottom: 1.5px solid #31465d; color: #24374a; font-size: 7.3pt; font-weight: 800; text-transform: uppercase; letter-spacing: .7pt; }
        .ps-table { width: 100%; border-collapse: collapse; }
        .ps-table td { padding: 3.5pt 0; vertical-align: top; }
        .ps-table td:last-child { width: 42%; text-align: right; white-space: nowrap; font-family: ${FONT_MONO}; font-variant-numeric: tabular-nums; font-weight: 600; }
        .ps-table tr.total td { border-top: 1px solid #7d858b; padding-top: 5pt; font-weight: 800; }
        .ps-empty-deductions { padding: 8pt 0; font-weight: 600; color: #343a40; }
        .ps-paye { margin: 0 16pt 10pt; padding: 8pt 10pt; border: 1px solid #aeb6bc; background: #f5f6f7; }
        .ps-paye-lines { display: grid; grid-template-columns: 1fr auto; gap: 4pt 12pt; }
        .ps-paye-lines span:nth-child(even) { text-align: right; font-family: ${FONT_MONO}; font-variant-numeric: tabular-nums; font-weight: 600; }
        .ps-net { margin: 0 16pt 9pt; padding: 10pt 12pt; background: ${NAVY}; color: #fff; display: grid; grid-template-columns: 1fr auto; gap: 12pt; align-items: center; }
        .ps-net-label { color: #fff; font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: .8pt; }
        .ps-net-value { margin-top: 2pt; font: 800 20pt ${FONT_MONO}; font-variant-numeric: tabular-nums; }
        .ps-net-words { margin-top: 3pt; color: #fff; font-size: 7.5pt; }
        .ps-summary { min-width: 150pt; }
        .ps-summary-row { display: flex; justify-content: space-between; gap: 14pt; padding: 2pt 0; font-size: 7.7pt; }
        .ps-summary-row span:last-child { font-family: ${FONT_MONO}; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .ps-employer, .ps-ytd { margin: 0 16pt 9pt; padding: 8pt 10pt; border: 1px solid #c8cdd1; }
        .ps-employer-values { display: flex; flex-wrap: wrap; gap: 24pt; }
        .ps-contribution-label, .ps-ytd-label { color: #454b50; font-size: 7pt; }
        .ps-contribution-value, .ps-ytd-value { margin-top: 2pt; font: 700 9pt ${FONT_MONO}; font-variant-numeric: tabular-nums; text-align: right; }
        .ps-ytd-title { border-color: #c8cdd1; }
        .ps-ytd-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10pt; }
        .ps-ytd-value { font-size: 8.5pt; }
        .ps-footer { margin-top: 7pt; padding: 8pt 16pt 0; border-top: 1px solid #c8cdd1; text-align: center; }
        .ps-footer-note { font-size: 7pt; font-weight: 700; color: #343a40; }
        .ps-footer-time { margin-top: 3pt; color: #454b50; font-size: 7pt; }
        .ps-unavailable { min-height: 0; padding: 20pt; font-size: 12pt; font-weight: 700; }
        @media screen { .payslip-root { min-height: 297mm; box-shadow: 0 4px 24px rgba(0,0,0,.08); } }
        @media print { .payslip-root { width: 100%; max-width: none; min-height: 0; margin: 0; } }
        @media (max-width: 700px) {
          .ps-meta-banner { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .ps-employee { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .ps-tables { gap: 10pt; }
        }
      `}</style>

      <DocumentHeader docTitle="Payslip" subtitle={slipPeriod} company={company} variant="navy" />
      <div className="ps-company-contact">
        <div>Registered address: {provided(address)}</div>
        <div>Phone: {provided(company.phone || company.telephone)} · Email: {provided(company.email)}</div>
      </div>

      <div className="ps-meta-banner">
        <div><div className="ps-meta-label">Pay period</div><div className="ps-meta-value">{slipPeriod}</div></div>
        <div><div className="ps-meta-label">Payment date</div><div className="ps-meta-value">{paymentDate}</div></div>
        <div><div className="ps-meta-label">Payslip number</div><div className="ps-meta-value" style={{ fontFamily: FONT_MONO }}>{payslipNumber}</div></div>
        <div className="ps-status">Computer generated</div>
      </div>

      <section className="ps-employee">
        <div><div className="ps-field-label">Employee name</div><div className="ps-field-value">{provided(employee.name)}</div></div>
        <div><div className="ps-field-label">Employee ID</div><div className="ps-field-value mono">{provided(employee.id)}</div></div>
        <div><div className="ps-field-label">Designation</div><div className="ps-field-value">{provided(employee.designation || employee.position_title)}</div></div>
        <div><div className="ps-field-label">Department</div><div className="ps-field-value">{provided(employee.department)}</div></div>
        <div><div className="ps-field-label">SSNIT number</div><div className="ps-field-value mono">{provided(employee.ssnit_no)}</div></div>
        <div><div className="ps-field-label">Ghana card number</div><div className="ps-field-value mono">{provided(employee.nia_card)}</div></div>
      </section>

      <section className="ps-tables">
        <div>
          <h2 className="ps-table-title">Earnings</h2>
          <table className="ps-table"><tbody>
            {payslip.earnings.type === "salary" ? (
              <tr><td>Basic salary</td><td>{money(payslip.earnings.basic_salary)}</td></tr>
            ) : (
              <tr><td>Probation allowance</td><td>{money(payslip.earnings.allowance)}</td></tr>
            )}
            {(payslip.earnings.overtime ?? 0) > 0 && <tr><td>Overtime</td><td>{money(payslip.earnings.overtime!)}</td></tr>}
            {(payslip.earnings.bonuses ?? 0) > 0 && <tr><td>Bonuses</td><td>{money(payslip.earnings.bonuses!)}</td></tr>}
            <tr className="total"><td>Total earnings</td><td>{money(payslip.earnings.total)}</td></tr>
          </tbody></table>
        </div>
        <div>
          <h2 className="ps-table-title">Deductions</h2>
          {hasAnyDeduction ? (
            <table className="ps-table"><tbody>
              {hasTierBreakdown ? (
                <>
                  {deductions.ssnit_tier1 > 0 && <tr><td>SSNIT Tier 1</td><td>{money(deductions.ssnit_tier1)}</td></tr>}
                  {deductions.ssnit_tier2 > 0 && <tr><td>SSNIT Tier 2</td><td>{money(deductions.ssnit_tier2)}</td></tr>}
                </>
              ) : deductions.ssnit_employee > 0 && <tr><td>SSNIT employee</td><td>{money(deductions.ssnit_employee)}</td></tr>}
              {deductions.paye > 0 && <tr><td>PAYE</td><td>{money(deductions.paye)}</td></tr>}
              {deductions.loan > 0 && <tr><td>Loan repayment</td><td>{money(deductions.loan)}</td></tr>}
              <tr className="total"><td>Total deductions</td><td>{money(deductions.total)}</td></tr>
            </tbody></table>
          ) : <div className="ps-empty-deductions">No statutory deductions during probation</div>}
        </div>
      </section>

      {deductions.paye > 0 && (
        <section className="ps-paye">
          <h2 className="ps-section-title">How your PAYE was worked out</h2>
          <div className="ps-paye-lines">
            <span>Gross pay</span><span>{money(payslip.earnings.total)}</span>
            <span>Less SSNIT employee contribution</span><span>{money(deductions.ssnit_employee)}</span>
            <strong>Chargeable income, on which PAYE is charged</strong><strong>{money(payslip.chargeable_income)}</strong>
          </div>
        </section>
      )}

      <section className="ps-net">
        <div>
          <div className="ps-net-label">Net pay</div>
          <div className="ps-net-value">{money(payslip.net_pay)}</div>
          <div className="ps-net-words">{amountInWords(payslip.net_pay, "GHS")}</div>
        </div>
        <div className="ps-summary">
          <div className="ps-summary-row"><span>Gross</span><span>{money(payslip.earnings.total)}</span></div>
          <div className="ps-summary-row"><span>Deductions</span><span>{money(deductions.total)}</span></div>
          <div className="ps-summary-row"><strong>Net</strong><strong>{money(payslip.net_pay)}</strong></div>
        </div>
      </section>

      <section className="ps-employer">
        <h2 className="ps-section-title">Employer contributions</h2>
        <div className="ps-employer-values">
          {payslip.employer.ssnit_employer > 0 && (
            <div><div className="ps-contribution-label">SSNIT employer</div><div className="ps-contribution-value">{money(payslip.employer.ssnit_employer)}</div></div>
          )}
          <div><div className="ps-contribution-label">Total cost to employer</div><div className="ps-contribution-value">{money(payslip.employer.total_cost)}</div></div>
        </div>
      </section>

      <section className="ps-ytd">
        <h2 className="ps-section-title ps-ytd-title">Year to date: January to {ytdMonth} {ytdYear}</h2>
        <div className="ps-ytd-grid">
          <div><div className="ps-ytd-label">Gross</div><div className="ps-ytd-value">{money(payslip.ytd.gross)}</div></div>
          <div><div className="ps-ytd-label">PAYE</div><div className="ps-ytd-value">{money(payslip.ytd.paye)}</div></div>
          <div><div className="ps-ytd-label">SSNIT employee</div><div className="ps-ytd-value">{money(payslip.ytd.ssnit_employee)}</div></div>
          <div><div className="ps-ytd-label">Net</div><div className="ps-ytd-value">{money(payslip.ytd.net)}</div></div>
        </div>
      </section>

      <footer className="ps-footer">
        <div className="ps-footer-note">Confidential. Computer generated, no signature required</div>
        <div className="ps-footer-time">Generated {generatedAt}</div>
      </footer>
    </div>
  );
}
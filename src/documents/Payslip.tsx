import React from "react";
import { COMPANY_TEMPLATE } from "../constants/defaults";
import { normalizePrintCompany, printCompanyName } from "./FinancialShared";
import DocumentHeader from "./DocumentHeader";
import { NAVY, INVOICE_GOLD } from "../utils/invoiceUtils";
import { amountInWords } from "../utils/numberToWords";
import { fmt } from "../utils/format";
import { FONT_BODY, FONT_DISPLAY, FONT_MONO } from "../theme/tokens";
import type { AppData, PayrollRun, PayrollLine } from "../types";

/* ─── A4-Optimized Professional Payslip ─── */

interface PayslipProps {
  data: AppData;
  run: PayrollRun;
  r: PayrollLine;
}

export default function Payslip({ data, run, r }: PayslipProps) {
  const company = normalizePrintCompany(data.company || COMPANY_TEMPLATE, data.companyName);
  const emp = data.employees.find((e) => e.id === r.employeeId) || ({} as any);
  const [year, month] = run.period.split("-");
  const monthName = new Date(Number(year), Number(month) - 1, 1)
    .toLocaleString("en-US", { month: "long" })
    .toUpperCase();

  const payDate = new Date(Number(year), Number(month), 5).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const totalDeductions = r.paye + r.ssnitEmployee;
  const ytdGross = r.gross * Number(month);
  const ytdTax = r.paye * Number(month);
  const ytdSsnit = r.ssnitEmployee * Number(month);
  const ytdNet = ytdGross - ytdTax - ytdSsnit;

  return (
    <div className="payslip-root">
      <style>{`
        .payslip-root {
          background: #fff;
          color: #1a1a1a;
          font-family: ${FONT_BODY}, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 10pt;
          line-height: 1.45;
          width: 210mm;
          min-height: 297mm;
          margin: 0 auto;
          box-sizing: border-box;
          padding: 0 0 55pt 0;
          position: relative;
        }
        .ps-gold-bar { height: 4pt; background: #B8860B; }
        .ps-header {
          background: ${NAVY};
          color: #fff;
          padding: 14pt 24pt 16pt;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16pt;
        }
        .ps-header-left { display: flex; align-items: center; gap: 8pt; min-width: 0; }
        .ps-logo { height: 46pt; width: auto; object-fit: contain; flex-shrink: 0; }
        .ps-company-name {
          font-family: ${FONT_DISPLAY};
          font-size: 16pt;
          font-weight: 700;
          letter-spacing: -0.3px;
          line-height: 1.1;
        }
        .ps-company-rule { width: 32pt; height: 2pt; background: #D4AF37; margin: 5pt 0 4pt; }
        .ps-tagline {
          font-size: 7pt;
          color: #C9A84C;
          text-transform: uppercase;
          letter-spacing: 1.4pt;
          font-weight: 600;
        }
        .ps-header-right { text-align: right; }
        .ps-title {
          font-family: ${FONT_DISPLAY};
          font-size: 18pt;
          font-weight: 700;
          color: #B8860B;
          letter-spacing: 3pt;
          text-transform: uppercase;
          line-height: 1;
        }
        .ps-period { font-size: 8pt; color: #8A9BB8; margin-top: 4pt; font-family: ${FONT_MONO}; }
        .ps-meta-banner {
          background: #F7F4EE;
          border-bottom: 1px solid #D5CEBD;
          padding: 10pt 24pt;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .ps-meta-group { display: flex; gap: 24pt; }
        .ps-meta-item-label {
          font-size: 7pt; color: #6B6B6B; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.8pt;
        }
        .ps-meta-item-value { font-size: 10pt; font-weight: 700; color: #1a1a1a; margin-top: 1pt; }
        .ps-employee-section {
          padding: 14pt 24pt;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16pt 24pt;
          border-bottom: 1px solid #E8E2D6;
        }
        .ps-emp-field-label {
          font-size: 7pt; color: #6B6B6B; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.8pt;
        }
        .ps-emp-field-value { font-size: 10pt; font-weight: 600; color: #1a1a1a; margin-top: 1pt; }
        .ps-tables-section {
          padding: 14pt 24pt;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20pt;
          border-bottom: 1px solid #E8E2D6;
          page-break-inside: avoid;
        }
        .ps-table-header {
          font-size: 7.5pt; font-weight: 800; text-transform: uppercase;
          letter-spacing: 1.2pt; padding-bottom: 6pt; margin-bottom: 8pt; border-bottom: 2px solid;
        }
        .ps-table-header.earnings { color: #B8860B; border-color: #B8860B; }
        .ps-table-header.deductions { color: #A63D40; border-color: #A63D40; }
        .ps-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
        .ps-table td { padding: 5pt 0; vertical-align: top; }
        .ps-table td:last-child { text-align: right; font-family: ${FONT_MONO}; font-weight: 600; }
        .ps-table tr.total td { font-weight: 800; padding-top: 6pt; border-top: 1.5px solid; }
        .ps-table tr.total.earnings-total td { color: ${NAVY}; border-color: ${NAVY}; background: #F7F4EE; }
        .ps-table tr.total.deductions-total td { color: #A63D40; border-color: #A63D40; background: #FDF5F5; }
        .ps-net-section {
          margin: 14pt 24pt 0;
          background: ${NAVY};
          border-radius: 5pt 5pt 0 0;
          padding: 16pt 20pt;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16pt;
          page-break-inside: avoid;
        }
        .ps-net-label {
          font-size: 7.5pt; font-weight: 700; color: #D4A843;
          text-transform: uppercase; letter-spacing: 1.5pt; margin-bottom: 4pt;
        }
        .ps-net-amount {
          font-size: 22pt; font-weight: 800; color: #fff;
          font-family: ${FONT_MONO}; letter-spacing: -0.5px;
        }
        .ps-net-words { font-size: 8pt; color: #8A9BB8; margin-top: 3pt; font-style: italic; }
        .ps-net-breakdown {
          background: rgba(255,255,255,0.07);
          border-radius: 4pt;
          padding: 10pt 14pt;
          min-width: 140pt;
        }
        .ps-net-breakdown-row { display: flex; justify-content: space-between; margin-bottom: 3pt; }
        .ps-net-breakdown-row:last-child {
          margin-bottom: 0; padding-top: 4pt; border-top: 1px solid rgba(255,255,255,0.15);
        }
        .ps-net-breakdown-label { font-size: 8pt; color: #8A9BB8; }
        .ps-net-breakdown-value { font-size: 8pt; color: #fff; font-family: ${FONT_MONO}; font-weight: 600; }

        /* Counterfoil — a payslip's own signature: a tear-off stub, like a
           real cheque/payroll counterfoil, reinforcing this is the
           employee's personal record to keep. */
        .ps-counterfoil {
          margin: 0 24pt 14pt;
          border: 1px dashed #B9AE93;
          border-top: none;
          border-radius: 0 0 5pt 5pt;
          background: #FFFDF8;
          padding: 8pt 20pt 10pt;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 7.5pt;
          color: #8A8478;
          letter-spacing: 0.6pt;
          text-transform: uppercase;
        }

        .ps-employer-section {
          margin: 0 24pt 10pt;
          padding: 10pt 14pt;
          background: #F7F4EE;
          border: 1px solid #D5CEBD;
          border-radius: 4pt;
          page-break-inside: avoid;
        }
        .ps-section-title {
          font-size: 7.5pt; font-weight: 700; color: #B8860B;
          text-transform: uppercase; letter-spacing: 1pt; margin-bottom: 6pt;
        }
        .ps-employer-grid { display: flex; gap: 32pt; }
        .ps-employer-item-label { font-size: 8.5pt; color: #6B6B6B; }
        .ps-employer-item-value {
          font-size: 11pt; font-weight: 700; font-family: ${FONT_MONO};
          color: #1a1a1a; margin-top: 1pt;
        }
        .ps-ytd-section {
          margin: 0 24pt 16pt;
          padding: 10pt 14pt;
          background: #fff;
          border: 1px solid #E8E2D6;
          border-radius: 4pt;
          page-break-inside: avoid;
        }
        .ps-ytd-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12pt; }
        .ps-ytd-item-label { font-size: 7.5pt; color: #6B6B6B; }
        .ps-ytd-item-value {
          font-size: 10pt; font-weight: 700; font-family: ${FONT_MONO};
          color: #1a1a1a; margin-top: 1pt; word-break: break-word;
        }
        .ps-footer {
          padding: 12pt 24pt 16pt;
          border-top: 1px solid #E8E2D6;
          text-align: center;
          position: absolute;
          bottom: 0; left: 0; right: 0;
        }
        .ps-footer-disclaimer {
          font-size: 7.5pt; color: #6B6B6B;
          text-transform: uppercase; letter-spacing: 0.6pt; line-height: 1.6;
        }
        .ps-footer-contact { font-size: 8pt; color: #6B6B6B; margin-top: 6pt; line-height: 1.5; }

        @media print {
          .payslip-root { width: 210mm; min-height: auto; margin: 0; box-shadow: none; border: none; }
          body { margin: 0; padding: 0; background: #fff; }
        }
        @media screen {
          .payslip-root { box-shadow: 0 4px 24px rgba(0,0,0,0.08); border: 1px solid #D5CEBD; margin: 20px auto; }
        }
      `}</style>

      <DocumentHeader docTitle="Payslip" subtitle={`${monthName} ${year}`} company={company} variant="navy" />

      <div className="ps-meta-banner">
        <div className="ps-meta-group">
          <div>
            <div className="ps-meta-item-label">Pay Period</div>
            <div className="ps-meta-item-value">{monthName} {year}</div>
          </div>
          <div>
            <div className="ps-meta-item-label">Payment Date</div>
            <div className="ps-meta-item-value">{payDate}</div>
          </div>
          <div>
            <div className="ps-meta-item-label">Payslip No.</div>
            <div className="ps-meta-item-value" style={{ fontFamily: FONT_MONO }}>
              PS-{run.period}-{r.employeeId.slice(-4)}
            </div>
          </div>
        </div>
      </div>

      <div className="ps-employee-section">
        <div>
          <div className="ps-emp-field-label">Employee Name</div>
          <div className="ps-emp-field-value" style={{ fontSize: "11pt" }}>
            {(emp.name || "—").toUpperCase()}
          </div>
        </div>
        <div>
          <div className="ps-emp-field-label">Designation</div>
          <div className="ps-emp-field-value">{(emp.designation || "—").toUpperCase()}</div>
        </div>
        <div>
          <div className="ps-emp-field-label">SSNIT Number</div>
          <div className="ps-emp-field-value" style={{ fontFamily: FONT_MONO }}>
            {emp.ssnitNo || "—"}
          </div>
        </div>
        <div>
          <div className="ps-emp-field-label">Department</div>
          <div className="ps-emp-field-value">PROJECTS</div>
        </div>
        <div>
          <div className="ps-emp-field-label">NIA Card</div>
          <div className="ps-emp-field-value" style={{ fontFamily: FONT_MONO }}>
            {emp.niaCard || "—"}
          </div>
        </div>
        <div>
          <div className="ps-emp-field-label">Employee ID</div>
          <div className="ps-emp-field-value" style={{ fontFamily: FONT_MONO }}>
            {r.employeeId}
          </div>
        </div>
      </div>

      <div className="ps-tables-section">
        <div>
          <div className="ps-table-header earnings">Earnings</div>
          <table className="ps-table">
            <tbody>
              <tr>
                <td>Basic Salary</td>
                <td>GH₵ {fmt(r.gross)}</td>
              </tr>
              <tr>
                <td style={{ color: "#6B6B6B" }}>Overtime</td>
                <td style={{ color: "#6B6B6B" }}>—</td>
              </tr>
              <tr>
                <td style={{ color: "#6B6B6B" }}>Bonuses / Allowances</td>
                <td style={{ color: "#6B6B6B" }}>—</td>
              </tr>
              <tr className="total earnings-total">
                <td>Total Earnings</td>
                <td>GH₵ {fmt(r.gross)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <div className="ps-table-header deductions">Deductions</div>
          <table className="ps-table">
            <tbody>
              <tr>
                <td>P.A.Y.E</td>
                <td>GH₵ {fmt(r.paye)}</td>
              </tr>
              <tr>
                <td>SSNIT Employee ({(data.ssnitEmployeeRate * 100).toFixed(1)}%)</td>
                <td>GH₵ {fmt(r.ssnitEmployee)}</td>
              </tr>
              <tr>
                <td style={{ color: "#6B6B6B" }}>Other Deductions</td>
                <td style={{ color: "#6B6B6B" }}>—</td>
              </tr>
              <tr className="total deductions-total">
                <td>Total Deductions</td>
                <td>GH₵ {fmt(totalDeductions)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Net Pay + counterfoil — the hero, and its tear-off record */}
      <div className="ps-net-section">
        <div>
          <div className="ps-net-label">Net Pay</div>
          <div className="ps-net-amount">GH₵ {fmt(r.net)}</div>
          <div className="ps-net-words">{amountInWords(r.net, "GHS")}</div>
        </div>
        <div className="ps-net-breakdown">
          <div className="ps-net-breakdown-row">
            <span className="ps-net-breakdown-label">Gross</span>
            <span className="ps-net-breakdown-value">GH₵ {fmt(r.gross)}</span>
          </div>
          <div className="ps-net-breakdown-row">
            <span className="ps-net-breakdown-label">Deductions</span>
            <span className="ps-net-breakdown-value" style={{ color: "#EF9A9A" }}>
              –GH₵ {fmt(totalDeductions)}
            </span>
          </div>
          <div className="ps-net-breakdown-row">
            <span className="ps-net-breakdown-label" style={{ color: "#D4A843", fontWeight: 700 }}>Net</span>
            <span className="ps-net-breakdown-value" style={{ fontWeight: 700 }}>GH₵ {fmt(r.net)}</span>
          </div>
        </div>
      </div>
      <div className="ps-counterfoil">
        <span>✂ Retain this slip for your records</span>
        <span style={{ fontFamily: FONT_MONO }}>PS-{run.period}-{r.employeeId.slice(-4)}</span>
      </div>

      <div className="ps-employer-section">
        <div className="ps-section-title">Employer Contributions</div>
        <div className="ps-employer-grid">
          <div>
            <div className="ps-employer-item-label">
              SSNIT Employer ({(data.ssnitEmployerRate * 100).toFixed(0)}%)
            </div>
            <div className="ps-employer-item-value">GH₵ {fmt(r.ssnitEmployer)}</div>
          </div>
          <div>
            <div className="ps-employer-item-label">Total Cost to Employer</div>
            <div className="ps-employer-item-value">GH₵ {fmt(r.gross + r.ssnitEmployer)}</div>
          </div>
        </div>
      </div>

      <div className="ps-ytd-section">
        <div className="ps-section-title">Year-to-Date Summary (Jan – {monthName} {year})</div>
        <div className="ps-ytd-grid">
          <div>
            <div className="ps-ytd-item-label">Gross Earnings</div>
            <div className="ps-ytd-item-value">GH₵ {fmt(ytdGross)}</div>
          </div>
          <div>
            <div className="ps-ytd-item-label">P.A.Y.E</div>
            <div className="ps-ytd-item-value" style={{ color: "#A63D40" }}>GH₵ {fmt(ytdTax)}</div>
          </div>
          <div>
            <div className="ps-ytd-item-label">SSNIT Employee</div>
            <div className="ps-ytd-item-value">GH₵ {fmt(ytdSsnit)}</div>
          </div>
          <div>
            <div className="ps-ytd-item-label">Net Pay YTD</div>
            <div className="ps-ytd-item-value" style={{ color: "#2F5233" }}>GH₵ {fmt(ytdNet)}</div>
          </div>
        </div>
      </div>

      <div className="ps-footer">
        <div className="ps-footer-disclaimer">
          This is a computer-generated payslip and does not require a physical signature.
        </div>
        <div className="ps-footer-contact">
          {[company.name, company.addressLine, company.cityLine, company.poBox].filter(Boolean).join(" · ")}
          <br />
          {[company.phone && `Phone: ${company.phone}`, company.email && `Email: ${company.email}`].filter(Boolean).join(" · ")}
        </div>
      </div>
    </div>
  );
}
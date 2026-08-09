import React from "react";
import { LOGO_SRC } from "../theme/tokens";
import { fmt } from "../utils/format";
import { FONT_DISPLAY, FONT_MONO } from "../theme/tokens";
import type { AppData, PayrollRun } from "../types";

/* ─── A4-Optimized Professional Payslip ─── */

export default function Payslip({ data, run, r }) {
  const emp = data.employees.find((e) => e.id === r.employeeId) || {};
  const [year, month] = run.period.split("-");
  const monthName = new Date(Number(year), Number(month) - 1, 1)
    .toLocaleString("en-US", { month: "long" })
    .toUpperCase();

  const payDate = new Date(Number(year), Number(month), 5)
    .toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

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
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 10pt;
          line-height: 1.45;
          width: 210mm;
          min-height: 297mm;
          margin: 0 auto;
          box-sizing: border-box;
          padding: 0;
          position: relative;
        }
        .ps-gold-bar {
          height: 4pt;
          background: #B8860B;
        }
        .ps-header {
          background: #1B2A4A;
          color: #fff;
          padding: 18pt 24pt;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16pt;
        }
        .ps-header-left {
          display: flex;
          align-items: center;
          gap: 12pt;
        }
        .ps-logo {
          height: 42pt;
          width: auto;
          object-fit: contain;
        }
        .ps-company-name {
          font-family: 'Roboto Slab', serif;
          font-size: 14pt;
          font-weight: 800;
          letter-spacing: -0.3px;
          line-height: 1.2;
        }
        .ps-tagline {
          font-size: 7pt;
          color: #C9A84C;
          text-transform: uppercase;
          letter-spacing: 1.4pt;
          font-weight: 600;
        }
        .ps-header-right {
          text-align: right;
        }
        .ps-title {
          font-family: 'Roboto Slab', serif;
          font-size: 20pt;
          font-weight: 800;
          color: #B8860B;
          letter-spacing: 2pt;
          line-height: 1;
        }
        .ps-period {
          font-size: 8pt;
          color: #8A9BB8;
          margin-top: 4pt;
          font-family: 'IBM Plex Mono', monospace;
        }
        .ps-meta-banner {
          background: #F7F4EE;
          border-bottom: 1px solid #D5CEBD;
          padding: 10pt 24pt;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .ps-meta-group {
          display: flex;
          gap: 24pt;
        }
        .ps-meta-item-label {
          font-size: 7pt;
          color: #6B6B6B;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.8pt;
        }
        .ps-meta-item-value {
          font-size: 10pt;
          font-weight: 700;
          color: #1a1a1a;
          margin-top: 1pt;
        }
        .ps-employee-section {
          padding: 14pt 24pt;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16pt 24pt;
          border-bottom: 1px solid #E8E2D6;
        }
        .ps-emp-field-label {
          font-size: 7pt;
          color: #6B6B6B;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.8pt;
        }
        .ps-emp-field-value {
          font-size: 10pt;
          font-weight: 600;
          color: #1a1a1a;
          margin-top: 1pt;
        }
        .ps-tables-section {
          padding: 14pt 24pt;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20pt;
          border-bottom: 1px solid #E8E2D6;
          page-break-inside: avoid;
        }
        .ps-table-header {
          font-size: 7.5pt;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 1.2pt;
          padding-bottom: 6pt;
          margin-bottom: 8pt;
          border-bottom: 2px solid;
        }
        .ps-table-header.earnings {
          color: #B8860B;
          border-color: #B8860B;
        }
        .ps-table-header.deductions {
          color: #A63D40;
          border-color: #A63D40;
        }
        .ps-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 9.5pt;
        }
        .ps-table td {
          padding: 5pt 0;
          vertical-align: top;
        }
        .ps-table td:last-child {
          text-align: right;
          font-family: 'IBM Plex Mono', monospace;
          font-weight: 600;
        }
        .ps-table tr.total td {
          font-weight: 800;
          padding-top: 6pt;
          border-top: 1.5px solid;
        }
        .ps-table tr.total.earnings-total td {
          color: #1B2A4A;
          border-color: #1B2A4A;
          background: #F7F4EE;
        }
        .ps-table tr.total.deductions-total td {
          color: #A63D40;
          border-color: #A63D40;
          background: #FDF5F5;
        }
        .ps-net-section {
          margin: 14pt 24pt;
          background: #1B2A4A;
          border-radius: 5pt;
          padding: 16pt 20pt;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16pt;
          page-break-inside: avoid;
        }
        .ps-net-label {
          font-size: 7.5pt;
          font-weight: 700;
          color: #D4A843;
          text-transform: uppercase;
          letter-spacing: 1.5pt;
          margin-bottom: 4pt;
        }
        .ps-net-amount {
          font-size: 22pt;
          font-weight: 800;
          color: #fff;
          font-family: 'IBM Plex Mono', monospace;
          letter-spacing: -0.5px;
        }
        .ps-net-words {
          font-size: 8pt;
          color: #8A9BB8;
          margin-top: 3pt;
          font-style: italic;
        }
        .ps-net-breakdown {
          background: rgba(255,255,255,0.07);
          border-radius: 4pt;
          padding: 10pt 14pt;
          min-width: 140pt;
        }
        .ps-net-breakdown-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 3pt;
        }
        .ps-net-breakdown-row:last-child {
          margin-bottom: 0;
          padding-top: 4pt;
          border-top: 1px solid rgba(255,255,255,0.15);
        }
        .ps-net-breakdown-label {
          font-size: 8pt;
          color: #8A9BB8;
        }
        .ps-net-breakdown-value {
          font-size: 8pt;
          color: #fff;
          font-family: 'IBM Plex Mono', monospace;
          font-weight: 600;
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
          font-size: 7.5pt;
          font-weight: 700;
          color: #B8860B;
          text-transform: uppercase;
          letter-spacing: 1pt;
          margin-bottom: 6pt;
        }
        .ps-employer-grid {
          display: flex;
          gap: 32pt;
        }
        .ps-employer-item-label {
          font-size: 8.5pt;
          color: #6B6B6B;
        }
        .ps-employer-item-value {
          font-size: 11pt;
          font-weight: 700;
          font-family: 'IBM Plex Mono', monospace;
          color: #1a1a1a;
          margin-top: 1pt;
        }
        .ps-ytd-section {
          margin: 0 24pt 12pt;
          padding: 10pt 14pt;
          background: #fff;
          border: 1px solid #E8E2D6;
          border-radius: 4pt;
          page-break-inside: avoid;
        }
        .ps-ytd-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12pt;
        }
        .ps-ytd-item-label {
          font-size: 7.5pt;
          color: #6B6B6B;
        }
        .ps-ytd-item-value {
          font-size: 10pt;
          font-weight: 700;
          font-family: 'IBM Plex Mono', monospace;
          color: #1a1a1a;
          margin-top: 1pt;
        }
        .ps-footer {
          padding: 12pt 24pt 16pt;
          border-top: 1px solid #E8E2D6;
          text-align: center;
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
        }
        .ps-footer-disclaimer {
          font-size: 7.5pt;
          color: #6B6B6B;
          text-transform: uppercase;
          letter-spacing: 0.6pt;
          line-height: 1.6;
        }
        .ps-footer-contact {
          font-size: 8pt;
          color: #6B6B6B;
          margin-top: 6pt;
          line-height: 1.5;
        }

        @media print {
          .payslip-root {
            width: 210mm;
            min-height: auto;
            margin: 0;
            box-shadow: none;
            border: none;
          }
          body {
            margin: 0;
            padding: 0;
            background: #fff;
          }
        }

        @media screen {
          .payslip-root {
            box-shadow: 0 4px 24px rgba(0,0,0,0.08);
            border: 1px solid #D5CEBD;
            margin: 20px auto;
          }
        }
      `}</style>

      <div className="ps-gold-bar" />

      {/* ── Header ── */}
      <div className="ps-header">
        <div className="ps-header-left">
          <img src={LOGO_SRC} alt="logo" className="ps-logo" />
          <div>
            <div className="ps-company-name">
              {data.company.name || "MODULO DEVELOPMENT"}
            </div>
            <div className="ps-tagline">Design · Build · Deliver</div>
          </div>
        </div>
        <div className="ps-header-right">
          <div className="ps-title">PAYSLIP</div>
          <div className="ps-period">{monthName} {year}</div>
        </div>
      </div>

      {/* ── Meta Banner ── */}
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

      {/* ── Employee Details ── */}
      <div className="ps-employee-section">
        <div>
          <div className="ps-emp-field-label">Employee Name</div>
          <div className="ps-emp-field-value" style={{ fontSize: "11pt" }}>
            {(emp.name || "—").toUpperCase()}
          </div>
        </div>
        <div>
          <div className="ps-emp-field-label">Designation</div>
          <div className="ps-emp-field-value">
            {(emp.designation || "—").toUpperCase()}
          </div>
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

      {/* ── Earnings & Deductions ── */}
      <div className="ps-tables-section">
        {/* Earnings */}
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

        {/* Deductions */}
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

      {/* ── Net Pay ── */}
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
            <span className="ps-net-breakdown-value" style={{ fontWeight: 700 }}>
              GH₵ {fmt(r.net)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Employer Contributions ── */}
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

      {/* ── YTD Summary ── */}
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

      {/* ── Footer ── */}
      <div className="ps-footer">
        <div className="ps-footer-disclaimer">
          This is a computer-generated payslip and does not require a physical signature.
        </div>
        <div className="ps-footer-contact">
          {data.company.name} · {data.company.addressLine} · {data.company.cityLine} · {data.company.poBox}
          <br />
          Phone: {data.company.phone} · Email: {data.company.email}
        </div>
      </div>
    </div>
  );
}

/* ─── Amount in words helpers ─── */
const ONES = [
  "","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten",
  "Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen",
];
const TENS = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];

function threeDigitsToWords(n: number): string {
  let s = "";
  if (n >= 100) { s += ONES[Math.floor(n / 100)] + " Hundred "; n %= 100; }
  if (n >= 20) { s += TENS[Math.floor(n / 10)] + " "; n %= 10; }
  if (n > 0) s += ONES[n] + " ";
  return s.trim();
}

function numberToWords(num: number): string {
  num = Math.round(num);
  if (num === 0) return "Zero";
  const units = ["","Thousand","Million","Billion"];
  const groups: number[] = [];
  let n = num;
  while (n > 0) { groups.push(n % 1000); n = Math.floor(n / 1000); }
  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] > 0)
      parts.push(threeDigitsToWords(groups[i]) + (units[i] ? " " + units[i] : ""));
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function amountInWords(amount: number, currency: string): string {
  const whole = Math.floor(amount);
  const cents = Math.round((amount - whole) * 100);
  const currencyName = currency === "USD" ? "US Dollars" : "Ghana Cedis";
  let words = numberToWords(whole) + " " + currencyName;
  if (cents > 0) words += " and " + numberToWords(cents) + " Pesewas";
  return words + " Only";
}
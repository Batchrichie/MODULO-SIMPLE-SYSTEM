import React, { useState, useEffect } from 'react';
import { FileText, Loader2, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { INK, MUTED, GREEN, ALERT, GOLD, FONT_DISPLAY, FONT_BODY, FONT_MONO, RULE, PAPER } from '../../theme/tokens';
import Card from '../../components/ui/Card';
import { loadMyProfile } from '../../supabase/profile';
import { supabase } from '../../supabaseClient';

interface PayrollRow {
  id: string;
  period: string;
  employee_id: string;
  gross: number;
  ssnit_employee: number;
  ssnit_employer: number;
  paye: number;
  net: number;
}

export default function MyStatementPanel() {
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [employeeName, setEmployeeName] = useState('');
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  useEffect(() => {
    (async () => {
      try {
        const profile = await loadMyProfile();
        if (!profile) { setLoading(false); return; }
        setEmployeeName(profile.employeeName);

        const { data, error } = await supabase
          .from('payroll_lines')
          .select('*')
          .eq('employee_id', profile.employeeId)
          .order('period', { ascending: true });

        if (!error && data) setRows(data as PayrollRow[]);
      } catch (err) {
        console.error('Failed to load statement:', err);
      }
      setLoading(false);
    })();
  }, []);

  // Filter to selected year (extract year from period string like "March 2025")
  const yearRows = rows.filter((r) => {
    const match = r.period.match(/\d{4}/);
    return match && parseInt(match[0]) === currentYear;
  });

  // Aggregations
  const totalGross = yearRows.reduce((s, r) => s + (r.gross || 0), 0);
  const totalNet = yearRows.reduce((s, r) => s + (r.net || 0), 0);
  const totalSsnitEmp = yearRows.reduce((s, r) => s + (r.ssnit_employee || 0), 0);
  const totalSsnitEr = yearRows.reduce((s, r) => s + (r.ssnit_employer || 0), 0);
  const totalPaye = yearRows.reduce((s, r) => s + (r.paye || 0), 0);
  const totalDeductions = totalSsnitEmp + totalPaye;
  const avgMonthlyNet = yearRows.length > 0 ? totalNet / yearRows.length : 0;

  // Available years for the filter
  const years = [...new Set(rows.map((r) => {
    const m = r.period.match(/\d{4}/);
    return m ? parseInt(m[0]) : null;
  }).filter(Boolean))].sort((a, b) => b - a) as number[];

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 40, color: MUTED, fontFamily: FONT_BODY }}>
        <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
        Loading your statement…
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: INK }}>Year-to-Date Statement</div>
          <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>{employeeName}</div>
        </div>
        {years.length > 1 && (
          <div style={{ display: 'flex', gap: 6 }}>
            {years.map((y) => (
              <button
                key={y}
                onClick={() => setCurrentYear(y)}
                style={{
                  padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontFamily: FONT_BODY, fontSize: 13, fontWeight: currentYear === y ? 700 : 500,
                  background: currentYear === y ? 'var(--nav-active)' : 'transparent',
                  color: currentYear === y ? GREEN : MUTED,
                  transition: 'all 0.15s ease',
                }}
              >
                {y}
              </button>
            ))}
          </div>
        )}
      </div>

      {yearRows.length === 0 ? (
        <Card style={{ padding: 40, textAlign: 'center' }}>
          <FileText size={24} style={{ color: MUTED, marginBottom: 8 }} />
          <div style={{ fontSize: 14, color: MUTED }}>No payslip data for {currentYear}.</div>
        </Card>
      ) : (
        <>
          {/* Summary cards */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
            <Card style={{ flex: '1 1 150px', padding: '14px 18px' }}>
              <div style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>YTD Gross</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 20, fontWeight: 700, color: INK }}>
                GHS {totalGross.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
              </div>
            </Card>
            <Card style={{ flex: '1 1 150px', padding: '14px 18px' }}>
              <div style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>YTD Net</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 20, fontWeight: 700, color: GREEN }}>
                GHS {totalNet.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
              </div>
            </Card>
            <Card style={{ flex: '1 1 150px', padding: '14px 18px' }}>
              <div style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Total Deductions</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 20, fontWeight: 700, color: ALERT }}>
                GHS {totalDeductions.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
              </div>
            </Card>
            <Card style={{ flex: '1 1 150px', padding: '14px 18px' }}>
              <div style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Avg Monthly Net</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 20, fontWeight: 700, color: INK }}>
                GHS {avgMonthlyNet.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
              </div>
            </Card>
          </div>

          {/* Deduction breakdown */}
          <Card style={{ marginBottom: 20, padding: '16px 18px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: FONT_BODY, color: INK, marginBottom: 12 }}>Deduction Breakdown (YTD)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: INK, fontFamily: FONT_BODY }}>SSNIT Employee ({((totalSsnitEmp / (totalGross || 1)) * 100).toFixed(1)}%)</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: INK }}>GHS {totalSsnitEmp.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: INK, fontFamily: FONT_BODY }}>PAYE Income Tax ({((totalPaye / (totalGross || 1)) * 100).toFixed(1)}%)</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: INK }}>GHS {totalPaye.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ borderTop: `1px solid ${RULE}`, paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: INK, fontFamily: FONT_BODY }}>Total Deductions</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 700, color: ALERT }}>- GHS {totalDeductions.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: INK, fontFamily: FONT_BODY }}>Take-Home (Net)</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: 14, fontWeight: 700, color: GREEN }}>GHS {totalNet.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                Effective tax rate: {((totalDeductions / (totalGross || 1)) * 100).toFixed(1)}% of gross
              </div>
            </div>
          </Card>

          {/* Monthly table */}
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }} className='table-card'>
              <thead>
                <tr style={{ background: 'var(--paper)' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, borderBottom: `1px solid ${RULE}` }}>Period</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, borderBottom: `1px solid ${RULE}` }}>Gross</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, borderBottom: `1px solid ${RULE}` }}>SSNIT</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, borderBottom: `1px solid ${RULE}` }}>PAYE</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, borderBottom: `1px solid ${RULE}` }}>Net</th>
                </tr>
              </thead>
              <tbody>
                {yearRows.map((r) => (
                  <tr key={r.id} className='row-hover'>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: FONT_BODY, color: INK, borderBottom: `1px solid ${RULE}`, fontWeight: 600 }}>{r.period}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: FONT_MONO, textAlign: 'right', borderBottom: `1px solid ${RULE}` }}>{(r.gross || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: FONT_MONO, textAlign: 'right', color: MUTED, borderBottom: `1px solid ${RULE}` }}>-{(r.ssnit_employee || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: FONT_MONO, textAlign: 'right', color: MUTED, borderBottom: `1px solid ${RULE}` }}>-{(r.paye || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: FONT_MONO, textAlign: 'right', fontWeight: 700, color: GREEN, borderBottom: `1px solid ${RULE}` }}>{(r.net || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--paper)' }}>
                  <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, fontFamily: FONT_BODY, color: INK, borderBottom: `1px solid ${RULE}` }}>Total</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: FONT_MONO, fontWeight: 700, textAlign: 'right', borderBottom: `1px solid ${RULE}` }}>{totalGross.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: FONT_MONO, textAlign: 'right', color: MUTED, borderBottom: `1px solid ${RULE}` }}>-{totalSsnitEmp.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: FONT_MONO, textAlign: 'right', color: MUTED, borderBottom: `1px solid ${RULE}` }}>-{totalPaye.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: FONT_MONO, fontWeight: 700, textAlign: 'right', color: GREEN, borderBottom: `1px solid ${RULE}` }}>{totalNet.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                </tr>
              </tfoot>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

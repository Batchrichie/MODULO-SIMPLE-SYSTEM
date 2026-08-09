import React, { useState, useEffect } from 'react';
import { Banknote, Loader2, Download } from 'lucide-react';
import { INK, MUTED, GREEN, GREEN_DEEP, FONT_DISPLAY, FONT_BODY, FONT_MONO, RULE } from '../../theme/tokens';
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
  posted_at: string | null;
}

export default function MyPayslipsPanel() {
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [employeeName, setEmployeeName] = useState('');

  useEffect(() => {
    (async () => {
      try {
        // 1. Get employee record for this user
        const profile = await loadMyProfile();
        if (!profile) { setLoading(false); return; }
        setEmployeeName(profile.employeeName);

        // 2. Fetch own payroll lines (RLS restricts to own rows)
        const { data, error } = await supabase
          .from('payroll_lines')
          .select('*')
          .eq('employee_id', profile.employeeId)
          .order('period', { ascending: false });

        if (!error && data) setRows(data as PayrollRow[]);
      } catch (err) {
        console.error('Failed to load payslips:', err);
      }
      setLoading(false);
    })();
  }, []);

  const totalGross = rows.reduce((s, r) => s + (r.gross || 0), 0);
  const totalNet = rows.reduce((s, r) => s + (r.net || 0), 0);
  const totalSsnit = rows.reduce((s, r) => s + (r.ssnit_employee || 0), 0);
  const totalPaye = rows.reduce((s, r) => s + (r.paye || 0), 0);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 40, color: MUTED, fontFamily: FONT_BODY }}>
        <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
        Loading your payslips…
      </div>
    );
  }

  return (
    <div>
      {/* Summary KPIs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <Card style={{ flex: '1 1 140px', padding: '14px 18px' }}>
          <div style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Total Payslips</div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 700, color: INK }}>{rows.length}</div>
        </Card>
        <Card style={{ flex: '1 1 140px', padding: '14px 18px' }}>
          <div style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Total Gross</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 20, fontWeight: 700, color: INK }}>GHS {totalGross.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
        </Card>
        <Card style={{ flex: '1 1 140px', padding: '14px 18px' }}>
          <div style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Total Net</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 20, fontWeight: 700, color: GREEN }}>GHS {totalNet.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
        </Card>
      </div>

      {rows.length === 0 && (
        <Card style={{ padding: 40, textAlign: 'center' }}>
          <Banknote size={24} style={{ color: MUTED, marginBottom: 8 }} />
          <div style={{ fontSize: 14, color: MUTED }}>No payslips found for your account.</div>
        </Card>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((r) => (
          <Card key={r.id} style={{ padding: '14px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div>
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: INK }}>{r.period}</div>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{employeeName}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: FONT_MONO, fontSize: 18, fontWeight: 700, color: GREEN }}>
                  GHS {(r.net || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: 11, color: MUTED }}>Net Pay</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, borderTop: `1px solid ${RULE}`, paddingTop: 8 }}>
              <div>
                <div style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase' }}>Gross</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: INK, fontWeight: 600 }}>GHS {(r.gross || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase' }}>SSNIT</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: INK }}>- GHS {(r.ssnit_employee || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase' }}>PAYE</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: INK }}>- GHS {(r.paye || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase' }}>Net</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: GREEN, fontWeight: 700 }}>GHS {(r.net || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

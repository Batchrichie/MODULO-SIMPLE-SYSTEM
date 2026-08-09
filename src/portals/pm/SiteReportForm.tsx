import React, { useState } from 'react';
import { FileText, Send, Loader2 } from 'lucide-react';
import { INK, MUTED, ALERT, FONT_BODY } from '../../theme/tokens';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { inputStyle, labelStyle } from '../../components/ui/styles';
import { insertSiteReport } from '../../supabase/fieldOps';
import { supabase } from '../../supabaseClient';

interface Props {
  projectId: string;
  onSubmitted: () => Promise<void>;
}

export default function SiteReportForm({ projectId, onSubmitted }: Props) {
  const [form, setForm] = useState({
    reportDate: new Date().toISOString().slice(0, 10),
    weather: '',
    workersPresent: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit() {
    if (!form.notes.trim()) {
      setError('Please enter daily notes / activities.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await insertSiteReport({
        project_id: projectId,
        report_date: form.reportDate,
        weather: form.weather.trim() || null,
        workers_present: parseInt(form.workersPresent, 10) || null,
        notes: form.notes.trim(),
        created_by: user?.id ?? null,
      });
      setForm({
        reportDate: new Date().toISOString().slice(0, 10),
        weather: '',
        workersPresent: '',
        notes: '',
      });
      setSuccess(true);
      await onSubmitted();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err?.message || 'Failed to save site report.');
    }
    setSaving(false);
  }

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <FileText size={16} style={{ color: 'var(--green)' }} />
        <span style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>New Site Report</span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ flex: '1 1 150px' }}>
          <label style={labelStyle}>Date</label>
          <input
            type="date"
            style={inputStyle}
            value={form.reportDate}
            onChange={(e) => setForm({ ...form, reportDate: e.target.value })}
          />
        </div>
        <div style={{ flex: '1 1 150px' }}>
          <label style={labelStyle}>Weather</label>
          <input
            style={inputStyle}
            value={form.weather}
            onChange={(e) => setForm({ ...form, weather: e.target.value })}
            placeholder="e.g. Sunny, 32C"
          />
        </div>
        <div style={{ flex: '1 1 120px' }}>
          <label style={labelStyle}>Workers On-Site</label>
          <input
            type="number"
            style={inputStyle}
            value={form.workersPresent}
            onChange={(e) => setForm({ ...form, workersPresent: e.target.value })}
            placeholder="e.g. 12"
          />
        </div>
        <div style={{ flex: '1 1 100%' }}>
          <label style={labelStyle}>Daily Notes / Activities</label>
          <textarea
            style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Describe work done, materials used, visitors, observations..."
          />
        </div>

        {error && (
          <div style={{ flex: '1 1 100%', background: 'var(--alert-bg)', color: ALERT, padding: 10, borderRadius: 8, fontSize: 13 }}>{error}</div>
        )}
        {success && (
          <div style={{ flex: '1 1 100%', background: 'var(--success-bg)', color: 'var(--green)', padding: 10, borderRadius: 8, fontSize: 13, fontWeight: 600 }}>Report submitted successfully.</div>
        )}

        <div style={{ flex: '1 1 100%' }}>
          <Button onClick={handleSubmit} icon={saving ? Loader2 : Send} disabled={saving} fullWidth>
            {saving ? 'Submitting…' : 'Submit Report'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
import React, { useState, useEffect } from 'react';
import { FileText, Loader2, CloudSun, Users } from 'lucide-react';
import { INK, MUTED, GREEN, FONT_BODY, FONT_DISPLAY } from '../../theme/tokens';
import Card from '../../components/ui/Card';
import { loadSiteReports, type SiteReportRow } from '../../supabase/fieldOps';

interface Props {
  projectId: string;
}

export default function SiteReportsList({ projectId }: Props) {
  const [reports, setReports] = useState<SiteReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await loadSiteReports(projectId);
      setReports(data);
      setLoading(false);
    })();
  }, [projectId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 30, color: MUTED, fontFamily: FONT_BODY }}>
        <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
        Loading reports…
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <Card style={{ padding: 30, textAlign: 'center' }}>
        <FileText size={24} style={{ color: MUTED, marginBottom: 8 }} />
        <div style={{ fontSize: 13, color: MUTED }}>No site reports submitted yet.</div>
      </Card>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, fontFamily: FONT_BODY, color: INK, marginBottom: 10 }}>
        {reports.length} Report{reports.length !== 1 ? 's' : ''}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {reports.map((r) => (
          <Card key={r.id} style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: INK }}>
                {new Date(r.report_date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 11, color: MUTED }}>
                {r.weather && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <CloudSun size={11} /> {r.weather}
                  </span>
                )}
                {r.workers_present != null && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Users size={11} /> {r.workers_present} workers
                  </span>
                )}
              </div>
            </div>
            <div style={{ fontSize: 13, color: INK, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{r.notes}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
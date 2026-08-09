import React, { useState, useEffect } from 'react';
import { Briefcase, Loader2, CheckCircle2, Clock } from 'lucide-react';
import { INK, MUTED, GREEN, GOLD, FONT_DISPLAY, FONT_BODY, RULE } from '../../theme/tokens';
import Card from '../../components/ui/Card';
import { supabase } from '../../supabaseClient';

interface ProjectRow {
  id: string;
  name: string;
  status: string | null;
  project_type?: string | null;
  contract_value?: number | null;
}

export default function ProjectsBasicList() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, status, project_type, contract_value')
        .order('name');
      if (!error && data) setProjects(data as ProjectRow[]);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 40, color: MUTED, fontFamily: FONT_BODY }}>
        <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
        Loading projects…
      </div>
    );
  }

  const active = projects.filter((p) => p.status === 'Active');
  const completed = projects.filter((p) => p.status === 'Complete');

  return (
    <div>
      {active.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, marginBottom: 8 }}>Active Projects ({active.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {active.map((p) => (
              <Card key={p.id} style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Briefcase size={16} style={{ color: GREEN, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: INK }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                      {p.project_type || 'Project'}
                      {p.contract_value ? ` · GHS ${p.contract_value.toLocaleString()}` : ''}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                    color: GREEN, background: 'var(--success-bg)', padding: '3px 8px', borderRadius: 4,
                  }}>
                    Active
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {completed.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, marginBottom: 8 }}>Completed ({completed.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {completed.map((p) => (
              <Card key={p.id} style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CheckCircle2 size={16} style={{ color: MUTED, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: FONT_BODY, fontSize: 14, fontWeight: 600, color: MUTED }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{p.project_type || 'Project'}</div>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                    color: MUTED, background: 'var(--paper)', padding: '3px 8px', borderRadius: 4,
                    border: `1px solid ${RULE}`,
                  }}>
                    Complete
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {projects.length === 0 && (
        <Card style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: MUTED }}>No projects found.</div>
        </Card>
      )}
    </div>
  );
}

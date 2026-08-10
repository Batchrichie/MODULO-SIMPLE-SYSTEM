import React, { useState, useEffect } from 'react';
import { INK, MUTED, RULE, FONT_BODY, PAPER_RAISED } from '../../theme/tokens';
import SectionTitle from '../../components/ui/SectionTitle';
import MediaLibraryPanel from './MediaLibraryPanel';
import { loadMyAssignments, type AssignmentRow } from '../../supabase/fieldOps';
import { supabase } from '../../supabaseClient';

interface ProjectOption {
  id: string;
  name: string;
}

export default function MediaLibraryWrapper() {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const assignments = await loadMyAssignments();
        if (assignments.length === 0) {
          setLoading(false);
          return;
        }

        const ids = [...new Set(assignments.map((a: AssignmentRow) => a.project_id))];
        const { data, error } = await supabase
          .from('projects')
          .select('id, name')
          .in('id', ids);

        if (error) throw error;
        const list = (data ?? []) as ProjectOption[];
        setProjects(list);
        if (list.length > 0) setSelectedId(list[0].id);
      } catch (err) {
        console.error('MediaLibraryWrapper load error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 40, color: MUTED, fontFamily: FONT_BODY, fontSize: 13 }}>
        Loading your projects...
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div>
        <SectionTitle sub="Upload and browse project media.">Media Library</SectionTitle>
        <div style={{ padding: 40, color: MUTED, fontFamily: FONT_BODY, fontSize: 13 }}>
          You are not assigned to any projects yet. Contact your administrator.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <SectionTitle sub="Upload and browse project media.">Media Library</SectionTitle>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          style={{
            fontFamily: FONT_BODY,
            fontSize: 13,
            color: INK,
            background: PAPER_RAISED,
            border: `1px solid ${RULE}`,
            borderRadius: 8,
            padding: '6px 12px',
            cursor: 'pointer',
          }}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      {selectedId && <MediaLibraryPanel projectId={selectedId} />}
    </div>
  );
}

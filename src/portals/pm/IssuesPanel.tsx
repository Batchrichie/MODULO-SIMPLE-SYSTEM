import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Plus, CheckCircle2, Clock, Loader2, X } from 'lucide-react';
import { INK, MUTED, ALERT, GREEN, GOLD, FONT_BODY, FONT_DISPLAY, RULE } from '../../theme/tokens';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { inputStyle, labelStyle } from '../../components/ui/styles';
import { loadIssues, insertIssue, updateIssueStatus, type IssueRow } from '../../supabase/fieldOps';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface Props {
  projectId: string;
  onRefresh: () => Promise<void>;
}

const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'critical'] as const;
const STATUS_OPTIONS: { value: IssueRow['status']; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
];

const PRIORITY_COLORS: Record<string, string> = {
  low: GREEN,
  medium: GOLD,
  high: '#E67E22',
  critical: ALERT,
};

const STATUS_ICONS: Record<string, typeof AlertTriangle> = {
  open: AlertTriangle,
  in_progress: Clock,
  resolved: CheckCircle2,
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function IssuesPanel({ projectId, onRefresh }: Props) {
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | IssueRow['status']>('all');

  // New issue form
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium' as IssueRow['priority'],
  });

  const load = useCallback(async () => {
    setLoading(true);
    const data = await loadIssues(projectId);
    setIssues(data);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  function resetForm() {
    setForm({ title: '', description: '', priority: 'medium' });
    setError('');
  }

  async function handleSubmit() {
    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await insertIssue({
        project_id: projectId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        priority: form.priority,
        status: 'open',
        resolved_at: null,
      });
      setShowModal(false);
      resetForm();
      await load();
      await onRefresh();
    } catch (err: any) {
      setError(err?.message || 'Failed to create issue.');
    }
    setSaving(false);
  }

  async function handleStatusChange(issueId: string, newStatus: IssueRow['status']) {
    try {
      await updateIssueStatus(issueId, newStatus);
      await load();
      await onRefresh();
    } catch (err: any) {
      console.error('Failed to update issue:', err);
    }
  }

  const filteredIssues = filter === 'all' ? issues : issues.filter((i) => i.status === filter);
  const openCount = issues.filter((i) => i.status !== 'resolved').length;

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 40, color: MUTED, fontFamily: FONT_BODY }}>
        <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
        Loading issues…
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, color: INK }}>Issues</span>
          <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 10, background: openCount > 0 ? 'var(--alert-bg)' : 'var(--success-bg)', color: openCount > 0 ? ALERT : GREEN, fontWeight: 700 }}>
            {openCount} open
          </span>
        </div>
        <Button onClick={() => { resetForm(); setShowModal(true); }} icon={Plus} size="sm">
          Log Issue
        </Button>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {(['all', 'open', 'in_progress', 'resolved'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            style={{
              padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontFamily: FONT_BODY, fontSize: 12, fontWeight: filter === s ? 700 : 500,
              background: filter === s ? 'var(--nav-active)' : 'transparent',
              color: filter === s ? GREEN : MUTED,
              transition: 'all 0.15s ease',
            }}
          >
            {s === 'all' ? 'All' : s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Issue list */}
      {filteredIssues.length === 0 && (
        <Card style={{ padding: 30, textAlign: 'center' }}>
          <AlertTriangle size={24} style={{ color: MUTED, marginBottom: 8 }} />
          <div style={{ fontSize: 13, color: MUTED }}>
            {filter === 'all' ? 'No issues logged yet.' : `No ${filter} issues.`}
          </div>
        </Card>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filteredIssues.map((issue) => {
          const StatusIcon = STATUS_ICONS[issue.status] ?? AlertTriangle;
          const priorityColor = PRIORITY_COLORS[issue.priority] ?? MUTED;

          return (
            <Card key={issue.id} style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <StatusIcon size={16} style={{ color: issue.status === 'resolved' ? GREEN : issue.status === 'in_progress' ? GOLD : ALERT, marginTop: 2, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{
                      fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, color: INK,
                      textDecoration: issue.status === 'resolved' ? 'line-through' : 'none',
                    }}>
                      {issue.title}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                      color: priorityColor, background: `${priorityColor}15`,
                      padding: '1px 6px', borderRadius: 3,
                    }}>
                      {issue.priority}
                    </span>
                  </div>
                  {issue.description && (
                    <div style={{ fontSize: 12, color: MUTED, marginTop: 3, lineHeight: 1.4 }}>{issue.description}</div>
                  )}
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
                    Created {new Date(issue.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    {issue.resolved_at && ` · Resolved ${new Date(issue.resolved_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`}
                  </div>
                </div>

                {/* Status dropdown */}
                {issue.status !== 'resolved' && (
                  <select
                    value={issue.status}
                    onChange={(e) => handleStatusChange(issue.id, e.target.value as IssueRow['status'])}
                    style={{
                      ...inputStyle, width: 'auto', fontSize: 11, padding: '4px 8px',
                      cursor: 'pointer', fontFamily: FONT_BODY,
                    }}
                  >
                    {STATUS_OPTIONS.filter((o) => o.value !== 'resolved' || issue.status === 'resolved').map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                    <option value="resolved">Resolve</option>
                  </select>
                )}
                {issue.status === 'resolved' && (
                  <select
                    value="resolved"
                    onChange={(e) => { if (e.target.value === 'open') handleStatusChange(issue.id, 'open'); }}
                    style={{
                      ...inputStyle, width: 'auto', fontSize: 11, padding: '4px 8px',
                      cursor: 'pointer', fontFamily: FONT_BODY,
                    }}
                  >
                    <option value="resolved">Resolved</option>
                    <option value="open">Reopen</option>
                  </select>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* New issue modal */}
      {showModal && (
        <Modal
          title="Log New Issue"
          sub="Report a problem or risk on this project."
          onClose={() => { setShowModal(false); resetForm(); }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle}>Title *</label>
              <input
                style={inputStyle}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Delayed cement delivery"
              />
            </div>
            <div>
              <label style={labelStyle}>Priority</label>
              <select
                style={inputStyle}
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as IssueRow['priority'] })}
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Description</label>
              <textarea
                style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Provide context, impact, and any suggested actions..."
              />
            </div>
            {error && (
              <div style={{ background: 'var(--alert-bg)', color: ALERT, padding: 10, borderRadius: 8, fontSize: 13 }}>{error}</div>
            )}
            <Button onClick={handleSubmit} icon={Plus} disabled={saving} fullWidth>
              {saving ? 'Saving…' : 'Log Issue'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

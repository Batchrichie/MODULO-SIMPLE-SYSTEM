import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CheckCircle2,
  FileText,
  AlertTriangle,
  Image,
  Filter,
  Clock,
  Loader2,
} from 'lucide-react';
import {
  INK,
  PAPER,
  PAPER_RAISED,
  RULE,
  GREEN,
  GREEN_DEEP,
  GOLD,
  ALERT,
  MUTED,
  FONT_DISPLAY,
  FONT_BODY,
  FONT_MONO,
} from '../../theme/tokens';
import SectionTitle from '../../components/ui/SectionTitle';
import Card from '../../components/ui/Card';
import {
  loadMilestonesForProjects,
  loadSiteReports,
  loadIssues,
  loadMedia,
  type MilestoneRow,
  type SiteReportRow,
  type IssueRow,
  type MediaRow,
} from '../../supabase/fieldOps';
import { supabase } from '../../supabaseClient';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type FeedCategory = 'all' | 'milestones' | 'reports' | 'issues' | 'media';

type FeedItem =
  | { kind: 'milestone_confirmed'; project: string; milestone: string; date: string; notes: string | null; _ts: string }
  | { kind: 'site_report'; project: string; reportDate: string; workers: number | null; weather: string | null; notes: string | null; _ts: string }
  | { kind: 'issue_logged'; project: string; title: string; priority: IssueRow['priority']; status: IssueRow['status']; _ts: string }
  | { kind: 'issue_resolved'; project: string; title: string; priority: IssueRow['priority']; resolvedAt: string; _ts: string }
  | { kind: 'media_uploaded'; project: string; fileName: string; _ts: string };

interface ProjectRow {
  id: string;
  name: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) !== 1 ? 's' : ''} ago`;
  if (days < 365) return `${Math.floor(days / 30)} month${Math.floor(days / 30) !== 1 ? 's' : ''} ago`;
  return `${Math.floor(days / 365)} year${Math.floor(days / 365) !== 1 ? 's' : ''} ago`;
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function priorityColor(p: IssueRow['priority']): string {
  switch (p) {
    case 'critical': return '#dc2626';
    case 'high': return '#ea580c';
    case 'medium': return '#ca8a04';
    case 'low': return '#9ca3af';
  }
}

function priorityLabel(p: IssueRow['priority']): string {
  return p.charAt(0).toUpperCase() + p.slice(1);
}

type StatusColor = { bg: string; fg: string };

function statusStyle(s: IssueRow['status']): StatusColor {
  switch (s) {
    case 'open': return { bg: 'rgba(234,88,12,0.10)', fg: '#ea580c' };
    case 'in_progress': return { bg: 'rgba(59,130,246,0.10)', fg: '#2563eb' };
    case 'resolved': return { bg: 'rgba(22,163,74,0.10)', fg: GREEN_DEEP };
  }
}

/* ------------------------------------------------------------------ */
/*  Filter pills                                                       */
/* ------------------------------------------------------------------ */

const FILTER_OPTIONS: { key: FeedCategory; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'milestones', label: 'Milestones' },
  { key: 'reports', label: 'Reports' },
  { key: 'issues', label: 'Issues' },
  { key: 'media', label: 'Media' },
];

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

function SkeletonRow() {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 18px' }}>
      <div style={{ width: 18, height: 18, borderRadius: '50%', background: RULE, flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ height: 13, width: '55%', borderRadius: 4, background: RULE }} />
        <div style={{ height: 11, width: '35%', borderRadius: 4, background: RULE }} />
        <div style={{ height: 11, width: '75%', borderRadius: 4, background: RULE }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Feed item renderer                                                 */
/* ------------------------------------------------------------------ */

function FeedItemCard({ item }: { item: FeedItem }) {
  // Determine left border color and icon
  let borderColor: string;
  let icon: React.ReactNode;

  switch (item.kind) {
    case 'milestone_confirmed':
      borderColor = GREEN;
      icon = <CheckCircle2 size={18} style={{ color: GREEN, flexShrink: 0, marginTop: 1 }} />;
      break;
    case 'site_report':
      borderColor = '#0891b2';
      icon = <FileText size={18} style={{ color: '#0891b2', flexShrink: 0, marginTop: 1 }} />;
      break;
    case 'issue_logged':
      borderColor = '#ea580c';
      icon = <AlertTriangle size={18} style={{ color: '#ea580c', flexShrink: 0, marginTop: 1 }} />;
      break;
    case 'issue_resolved':
      borderColor = GREEN;
      icon = <CheckCircle2 size={18} style={{ color: GREEN, flexShrink: 0, marginTop: 1 }} />;
      break;
    case 'media_uploaded':
      borderColor = '#7c3aed';
      icon = <Image size={18} style={{ color: '#7c3aed', flexShrink: 0, marginTop: 1 }} />;
      break;
  }

  const timeStr = relativeTime(item._ts);

  return (
    <div
      style={{
        borderLeft: `4px solid ${borderColor}`,
        background: PAPER_RAISED,
        borderRadius: 8,
        padding: '14px 18px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}
    >
      {/* Top row: icon + project + time */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {icon}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Project name */}
          <div style={{ fontSize: 11, color: MUTED, fontFamily: FONT_BODY, marginBottom: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>
            {item.project}
          </div>

          {/* Item-specific content */}
          {item.kind === 'milestone_confirmed' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: INK, fontFamily: FONT_BODY }}>{item.milestone}</span>
                <span style={{
                  fontSize: 10, fontWeight: 700, fontFamily: FONT_MONO,
                  background: 'rgba(22,163,74,0.12)', color: GREEN_DEEP,
                  padding: '2px 8px', borderRadius: 10, textTransform: 'uppercase', letterSpacing: 0.4,
                }}>Confirmed</span>
              </div>
              {item.notes && (
                <div style={{ fontSize: 12, color: MUTED, fontFamily: FONT_BODY, lineHeight: 1.5, marginTop: 2 }}>
                  {item.notes}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
                <Clock size={11} style={{ color: MUTED }} />
                <span style={{ fontSize: 11, color: MUTED, fontFamily: FONT_BODY }}>{formatDateShort(item.date)}</span>
              </div>
            </div>
          )}

          {item.kind === 'site_report' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: INK, fontFamily: FONT_BODY }}>Site Report</span>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: MUTED, fontFamily: FONT_BODY }}>
                  <strong style={{ color: INK }}>{item.reportDate}</strong>
                </span>
                {item.workers != null && (
                  <span style={{ fontSize: 12, color: MUTED, fontFamily: FONT_BODY }}>
                    {item.workers} worker{item.workers !== 1 ? 's' : ''} on site
                  </span>
                )}
                {item.weather && (
                  <span style={{ fontSize: 12, color: MUTED, fontFamily: FONT_BODY }}>
                    Weather: {item.weather}
                  </span>
                )}
              </div>
              {item.notes && (
                <div style={{ fontSize: 12, color: MUTED, fontFamily: FONT_BODY, lineHeight: 1.5, marginTop: 2 }}>
                  {item.notes.length > 120 ? item.notes.slice(0, 120) + '…' : item.notes}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
                <Clock size={11} style={{ color: MUTED }} />
                <span style={{ fontSize: 11, color: MUTED, fontFamily: FONT_BODY }}>{timeStr}</span>
              </div>
            </div>
          )}

          {item.kind === 'issue_logged' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: INK, fontFamily: FONT_BODY }}>{item.title}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, fontFamily: FONT_MONO,
                  background: `${priorityColor(item.priority)}18`,
                  color: priorityColor(item.priority),
                  padding: '2px 8px', borderRadius: 10, textTransform: 'uppercase', letterSpacing: 0.4,
                }}>
                  {priorityLabel(item.priority)}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 600, fontFamily: FONT_MONO,
                  background: statusStyle(item.status).bg,
                  color: statusStyle(item.status).fg,
                  padding: '2px 8px', borderRadius: 10, textTransform: 'capitalize', letterSpacing: 0.3,
                }}>
                  {item.status.replace('_', ' ')}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
                <Clock size={11} style={{ color: MUTED }} />
                <span style={{ fontSize: 11, color: MUTED, fontFamily: FONT_BODY }}>{timeStr}</span>
              </div>
            </div>
          )}

          {item.kind === 'issue_resolved' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: INK, fontFamily: FONT_BODY }}>{item.title}</span>
                <span style={{
                  fontSize: 10, fontWeight: 700, fontFamily: FONT_MONO,
                  background: 'rgba(22,163,74,0.12)', color: GREEN_DEEP,
                  padding: '2px 8px', borderRadius: 10, textTransform: 'uppercase', letterSpacing: 0.4,
                }}>Resolved</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
                <Clock size={11} style={{ color: MUTED }} />
                <span style={{ fontSize: 11, color: MUTED, fontFamily: FONT_BODY }}>{formatDateShort(item.resolvedAt)}</span>
              </div>
            </div>
          )}

          {item.kind === 'media_uploaded' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: INK, fontFamily: FONT_BODY }}>{item.fileName}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
                <Clock size={11} style={{ color: MUTED }} />
                <span style={{ fontSize: 11, color: MUTED, fontFamily: FONT_BODY }}>{timeStr}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function FieldActivityFeed() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [category, setCategory] = useState<FeedCategory>('all');
  const [projectFilter, setProjectFilter] = useState<string>('__all__');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Load ALL projects
      const { data: projData, error: projErr } = await supabase
        .from('projects')
        .select('*');

      if (projErr) throw projErr;
      const projList = (projData ?? []) as ProjectRow[];
      setProjects(projList);

      const projectIds = projList.map((p) => p.id);
      if (projectIds.length === 0) {
        setFeedItems([]);
        setLoading(false);
        return;
      }

      // 2. Load all data in parallel
      const projectMap = new Map(projList.map((p) => [p.id, p.name]));

      const [milestones, ...perProjectData] = await Promise.all([
        loadMilestonesForProjects(projectIds),
        ...projectIds.map(async (pid) => {
          const [reports, issues, media] = await Promise.all([
            loadSiteReports(pid),
            loadIssues(pid),
            loadMedia(pid),
          ]);
          return { pid, reports, issues, media };
        }),
      ]);

      // 3. Build feed items
      const items: FeedItem[] = [];

      // Milestones (only confirmed ones)
      for (const m of milestones) {
        if (m.status === 'confirmed' && m.confirmed_at) {
          items.push({
            kind: 'milestone_confirmed',
            project: projectMap.get(m.project_id) ?? m.project_id,
            milestone: m.name,
            date: m.confirmed_at,
            notes: m.notes,
            _ts: m.confirmed_at,
          });
        }
      }

      // Per-project data
      for (const { pid, reports, issues, media } of perProjectData) {
        const pName = projectMap.get(pid) ?? pid;

        for (const r of reports) {
          items.push({
            kind: 'site_report',
            project: pName,
            reportDate: r.report_date,
            workers: r.workers_present,
            weather: r.weather,
            notes: r.notes,
            _ts: r.created_at,
          });
        }

        for (const i of issues) {
          if (i.status === 'resolved' && i.resolved_at) {
            items.push({
              kind: 'issue_resolved',
              project: pName,
              title: i.title,
              priority: i.priority,
              resolvedAt: i.resolved_at,
              _ts: i.resolved_at,
            });
          } else {
            items.push({
              kind: 'issue_logged',
              project: pName,
              title: i.title,
              priority: i.priority,
              status: i.status,
              _ts: i.created_at,
            });
          }
        }

        for (const m of media) {
          items.push({
            kind: 'media_uploaded',
            project: pName,
            fileName: m.file_name,
            _ts: m.created_at,
          });
        }
      }

      // 4. Sort chronologically desc
      items.sort((a, b) => new Date(b._ts).getTime() - new Date(a._ts).getTime());

      setFeedItems(items);
    } catch (err) {
      console.error('FieldActivityFeed load error:', err);
      setError('Failed to load field activity. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered items
  const filteredItems = useMemo(() => {
    let result = feedItems;

    if (category !== 'all') {
      switch (category) {
        case 'milestones':
          result = result.filter((i) => i.kind === 'milestone_confirmed');
          break;
        case 'reports':
          result = result.filter((i) => i.kind === 'site_report');
          break;
        case 'issues':
          result = result.filter((i) => i.kind === 'issue_logged' || i.kind === 'issue_resolved');
          break;
        case 'media':
          result = result.filter((i) => i.kind === 'media_uploaded');
          break;
      }
    }

    if (projectFilter !== '__all__') {
      result = result.filter((i) => {
        const proj = projects.find((p) => p.id === projectFilter);
        return proj && i.project === proj.name;
      });
    }

    return result;
  }, [feedItems, category, projectFilter, projects]);

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div>
      <SectionTitle sub="Live field operations across all projects.">
        Field Activity Feed
      </SectionTitle>

      {/* Filter bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        marginBottom: 18,
      }}>
        {/* Category pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Filter size={14} style={{ color: MUTED, marginRight: 6, flexShrink: 0 }} />
          {FILTER_OPTIONS.map((opt) => {
            const active = category === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => setCategory(opt.key)}
                style={{
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: FONT_BODY,
                  fontSize: 12,
                  fontWeight: active ? 700 : 500,
                  color: active ? PAPER : MUTED,
                  background: active ? GREEN : 'transparent',
                  padding: '5px 14px',
                  borderRadius: 20,
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Project dropdown */}
        {projects.length > 0 && (
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            style={{
              fontFamily: FONT_BODY,
              fontSize: 12,
              color: INK,
              background: PAPER_RAISED,
              border: `1px solid ${RULE}`,
              borderRadius: 8,
              padding: '5px 10px',
              cursor: 'pointer',
              marginLeft: 'auto',
            }}
          >
            <option value="__all__">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Feed area */}
      <div style={{ maxWidth: 900, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Loading skeleton */}
        {loading && (
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <SkeletonRow />
            <div style={{ height: 1, background: RULE }} />
            <SkeletonRow />
            <div style={{ height: 1, background: RULE }} />
            <SkeletonRow />
            <div style={{ height: 1, background: RULE }} />
            <SkeletonRow />
            <div style={{ height: 1, background: RULE }} />
            <SkeletonRow />
          </Card>
        )}

        {/* Error state */}
        {!loading && error && (
          <Card style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 14, color: ALERT, fontFamily: FONT_BODY }}>{error}</div>
            <button
              onClick={loadData}
              style={{
                marginTop: 14,
                border: 'none',
                cursor: 'pointer',
                fontFamily: FONT_BODY,
                fontSize: 13,
                fontWeight: 600,
                color: PAPER,
                background: GREEN,
                padding: '8px 20px',
                borderRadius: 8,
              }}
            >
              Retry
            </button>
          </Card>
        )}

        {/* Empty state */}
        {!loading && !error && filteredItems.length === 0 && (
          <Card style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: MUTED, fontFamily: FONT_BODY, marginBottom: 6 }}>
              No field activity yet
            </div>
            <div style={{ fontSize: 13, color: MUTED, fontFamily: FONT_BODY }}>
              Activity will appear here once projects start logging milestones, reports, issues, or media.
            </div>
          </Card>
        )}

        {/* Feed items */}
        {!loading && !error && filteredItems.map((item, idx) => (
          <FeedItemCard key={`${item.kind}-${idx}`} item={item} />
        ))}
      </div>
    </div>
  );
}

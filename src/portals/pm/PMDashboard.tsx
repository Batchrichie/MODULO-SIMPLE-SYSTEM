import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Briefcase, CheckCircle2, Circle, AlertTriangle,
  FileText, Camera, ListChecks, ChevronRight, Loader2,
} from 'lucide-react';
import { INK, PAPER, PAPER_RAISED, RULE, GREEN, GREEN_DEEP, GOLD, ALERT, MUTED,
         FONT_DISPLAY, FONT_BODY, FONT_MONO } from '../../theme/tokens';
import Card from '../../components/ui/Card';
import SectionTitle from '../../components/ui/SectionTitle';
import Button from '../../components/ui/Button';
import { inputStyle, labelStyle } from '../../components/ui/styles';
import { loadMyAssignments, loadMilestonesForProjects, loadIssues, type AssignmentRow, type MilestoneRow, type IssueRow } from '../../supabase/fieldOps';
import { supabase } from '../../supabaseClient';
import StageConfirmationPanel from './StageConfirmationPanel';
import SiteReportForm from './SiteReportForm';
import SiteReportsList from './SiteReportsList';
import IssuesPanel from './IssuesPanel';

/* ------------------------------------------------------------------ */
/*  Sub-tab config                                                      */
/* ------------------------------------------------------------------ */

const SUB_TABS = [
  { key: 'overview',   label: 'Overview',        icon: Briefcase },
  { key: 'milestones', label: 'Milestones',       icon: ListChecks },
  { key: 'reports',    label: 'Site Reports',     icon: FileText },
  { key: 'issues',     label: 'Issues',           icon: AlertTriangle },
] as const;

type SubTab = (typeof SUB_TABS)[number]['key'];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysAgo(iso: string): number {
  const now = Date.now();
  const then = new Date(iso).getTime();
  return Math.floor((now - then) / 86_400_000);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PMDashboard() {
  const [subTab, setSubTab] = useState<SubTab>('overview');
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string; status: string | null }[]>([]);
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [allIssues, setAllIssues] = useState<IssueRow[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load assignments + projects + milestones on mount
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [assigns, { data: { user } }] = await Promise.all([
        loadMyAssignments(),
        supabase.auth.getUser(),
      ]);
      setAssignments(assigns);

      // Get employee id for this user
      if (!user) return;
      const { data: emp } = await supabase
        .from('employees')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();
      if (!emp) return;

      // Load projects (any authenticated can read projects)
      const projectIds = assigns.map((a) => a.project_id);
      if (projectIds.length === 0) { setLoading(false); return; }

      const { data: projData } = await supabase
        .from('projects')
        .select('id, name, status')
        .in('id', projectIds);
      const projList = (projData ?? []) as { id: string; name: string; status: string | null }[];
      setProjects(projList);
      if (!selectedProjectId && projList.length > 0) {
        setSelectedProjectId(projList[0].id);
      }

      // Load milestones for all assigned projects
      const ms = await loadMilestonesForProjects(projectIds);
      setMilestones(ms);

      // Load issues for all assigned projects
      const issuePromises = projectIds.map((pid) => loadIssues(pid));
      const issueResults = await Promise.all(issuePromises);
      setAllIssues(issueResults.flat());
    } catch (err) {
      console.error('PMDashboard load error:', err);
    }
    setLoading(false);
  }, [selectedProjectId]);

  useEffect(() => { refresh(); }, []);

  // Derived stats
  const pendingMilestones = useMemo(
    () => milestones.filter((m) => m.status === 'pending'),
    [milestones]
  );
  const openIssues = useMemo(
    () => allIssues.filter((i) => i.status !== 'resolved'),
    [allIssues]
  );
  const confirmedCount = useMemo(
    () => milestones.filter((m) => m.status === 'confirmed').length,
    [milestones]
  );

  const projectName = useMemo(
    () => projects.find((p) => p.id === selectedProjectId)?.name ?? '—',
    [projects, selectedProjectId]
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 40, color: MUTED, fontFamily: FONT_BODY }}>
        <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
        Loading your projects…
      </div>
    );
  }

  return (
    <div>
      <SectionTitle sub={`${assignments.length} project${assignments.length !== 1 ? 's' : ''} assigned to you.`}>
        My Projects
      </SectionTitle>

      {projects.length === 0 && (
        <Card style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: MUTED }}>
            No projects assigned to you yet. Contact your administrator.
          </div>
        </Card>
      )}

      {projects.length > 0 && (
        <>
          {/* Project selector */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Select Project</label>
            <select
              style={inputStyle}
              value={selectedProjectId ?? ''}
              onChange={(e) => setSelectedProjectId(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.status === 'Complete' ? '(Complete)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Sub-tab bar */}
          <div style={{
            display: 'flex',
            gap: 2,
            borderBottom: `1px solid ${RULE}`,
            marginBottom: 20,
          }}>
            {SUB_TABS.map((t) => {
              const Icon = t.icon;
              const active = subTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setSubTab(t.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '10px 14px', border: 'none', cursor: 'pointer',
                    fontFamily: FONT_BODY, fontSize: 13, fontWeight: active ? 700 : 500,
                    color: active ? GREEN : MUTED,
                    borderBottom: active ? `2px solid ${GREEN}` : '2px solid transparent',
                    background: 'none', transition: 'all 0.15s ease',
                  }}
                >
                  <Icon size={15} />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Sub-tab content */}
          {subTab === 'overview' && selectedProjectId && (
            <OverviewTab
              projects={projects}
              milestones={milestones}
              issues={allIssues}
              pendingMilestones={pendingMilestones}
              openIssues={openIssues}
              confirmedCount={confirmedCount}
              onGoMilestones={() => setSubTab('milestones')}
              onGoIssues={() => setSubTab('issues')}
            />
          )}

          {subTab === 'milestones' && selectedProjectId && (
            <StageConfirmationPanel
              projectId={selectedProjectId}
              projectName={projectName}
              onRefresh={refresh}
            />
          )}

          {subTab === 'reports' && selectedProjectId && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <SiteReportForm projectId={selectedProjectId} onSubmitted={refresh} />
              <SiteReportsList projectId={selectedProjectId} />
            </div>
          )}

          {subTab === 'issues' && selectedProjectId && (
            <IssuesPanel
              projectId={selectedProjectId}
              onRefresh={refresh}
            />
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Overview sub-tab                                                    */
/* ------------------------------------------------------------------ */

interface OverviewProps {
  projects: { id: string; name: string; status: string | null }[];
  milestones: MilestoneRow[];
  issues: IssueRow[];
  pendingMilestones: MilestoneRow[];
  openIssues: IssueRow[];
  confirmedCount: number;
  onGoMilestones: () => void;
  onGoIssues: () => void;
}

function OverviewTab({
  projects, milestones, issues, pendingMilestones, openIssues,
  confirmedCount, onGoMilestones, onGoIssues,
}: OverviewProps) {
  const totalMilestones = milestones.length;
  const progressPct = totalMilestones > 0 ? Math.round((confirmedCount / totalMilestones) * 100) : 0;

  // Group milestones by project for per-project progress
  const projectProgress = useMemo(() => {
    return projects.map((p) => {
      const pMs = milestones.filter((m) => m.project_id === p.id);
      const pConfirmed = pMs.filter((m) => m.status === 'confirmed').length;
      const pTotal = pMs.length;
      const pIssues = issues.filter((i) => i.project_id === p.id && i.status !== 'resolved').length;
      return { ...p, confirmed: pConfirmed, total: pTotal, openIssueCount: pIssues, pct: pTotal > 0 ? Math.round((pConfirmed / pTotal) * 100) : 0 };
    });
  }, [projects, milestones, issues]);

  // Recent activity — last 5 items across milestones and issues
  const recentActivity = useMemo(() => {
    const items: { type: 'milestone' | 'issue'; title: string; date: string; project: string }[] = [];
    for (const m of milestones) {
      items.push({
        type: 'milestone',
        title: m.status === 'confirmed' ? `Confirmed: ${m.name}` : `Pending: ${m.name}`,
        date: m.confirmed_at ?? m.created_at,
        project: projects.find((p) => p.id === m.project_id)?.name ?? m.project_id,
      });
    }
    for (const i of issues) {
      items.push({
        type: 'issue',
        title: `[${i.priority}] ${i.title}`,
        date: i.resolved_at ?? i.created_at,
        project: projects.find((p) => p.id === i.project_id)?.name ?? i.project_id,
      });
    }
    return items
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6);
  }, [milestones, issues, projects]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI cards */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <Card style={{ flex: '1 1 160px', padding: '16px 18px' }}>
          <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Assigned Projects</div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 700, color: INK }}>{projects.length}</div>
        </Card>
        <Card style={{ flex: '1 1 160px', padding: '16px 18px' }}>
          <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Overall Progress</div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 700, color: GREEN }}>{progressPct}%</div>
          <div style={{ height: 4, background: RULE, borderRadius: 2, marginTop: 8 }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: GREEN, borderRadius: 2, transition: 'width 0.3s ease' }} />
          </div>
        </Card>
        <Card
          style={{ flex: '1 1 160px', padding: '16px 18px', cursor: 'pointer' }}
          onClick={onGoMilestones}
        >
          <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Pending Milestones</div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 700, color: GOLD }}>{pendingMilestones.length}</div>
        </Card>
        <Card
          style={{ flex: '1 1 160px', padding: '16px 18px', cursor: 'pointer' }}
          onClick={onGoIssues}
        >
          <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Open Issues</div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 700, color: openIssues.length > 0 ? ALERT : GREEN }}>{openIssues.length}</div>
        </Card>
      </div>

      {/* Per-project progress */}
      <Card>
        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: FONT_BODY, color: INK, marginBottom: 14 }}>Project Progress</div>
        {projectProgress.map((p) => (
          <div key={p.id} style={{ marginBottom: p.id === projectProgress[projectProgress.length - 1]?.id ? 0 : 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span style={{ fontSize: 13, fontFamily: FONT_BODY, color: INK, fontWeight: 600 }}>{p.name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {p.openIssueCount > 0 && (
                  <span style={{ fontSize: 11, color: ALERT, fontWeight: 600 }}>{p.openIssueCount} issue{p.openIssueCount > 1 ? 's' : ''}</span>
                )}
                <span style={{ fontSize: 12, fontFamily: FONT_MONO, color: MUTED }}>{p.confirmed}/{p.total}</span>
              </div>
            </div>
            <div style={{ height: 6, background: RULE, borderRadius: 3 }}>
              <div style={{ height: '100%', width: `${p.pct}%`, background: p.pct >= 80 ? GREEN : p.pct >= 40 ? GOLD : ALERT, borderRadius: 3, transition: 'width 0.3s ease' }} />
            </div>
          </div>
        ))}
      </Card>

      {/* Recent activity */}
      <Card>
        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: FONT_BODY, color: INK, marginBottom: 14 }}>Recent Activity</div>
        {recentActivity.length === 0 && (
          <div style={{ fontSize: 13, color: MUTED }}>No activity yet. Start by confirming milestones or logging issues.</div>
        )}
        {recentActivity.map((item, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 0',
              borderTop: idx > 0 ? `1px solid ${RULE}` : 'none',
            }}
          >
            {item.type === 'milestone' ? (
              <CheckCircle2 size={15} style={{ color: GREEN, flexShrink: 0 }} />
            ) : (
              <AlertTriangle size={15} style={{ color: item.title.startsWith('[critical]') ? ALERT : GOLD, flexShrink: 0 }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: INK, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
              <div style={{ fontSize: 11, color: MUTED }}>{item.project}</div>
            </div>
            <div style={{ fontSize: 11, color: MUTED, whiteSpace: 'nowrap' }}>
              {daysAgo(item.date) === 0 ? 'Today' : `${daysAgo(item.date)}d ago`}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

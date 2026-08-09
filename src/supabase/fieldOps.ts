import { supabase } from '../supabaseClient';

/* ------------------------------------------------------------------ */
/*  Types (snake_case — matches DB columns)                            */
/* ------------------------------------------------------------------ */

export interface AssignmentRow {
  id: string;
  project_id: string;
  employee_id: string;
  role_on_project: string;
}

export interface MilestoneRow {
  id: string;
  project_id: string;
  name: string;
  stage_order: number;
  status: 'pending' | 'confirmed';
  confirmed_at: string | null;
  confirmed_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface SiteReportRow {
  id: string;
  project_id: string;
  report_date: string;
  weather: string | null;
  workers_present: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface IssueRow {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved';
  created_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface MediaRow {
  id: string;
  project_id: string;
  storage_path: string;
  file_name: string;
  uploaded_by: string | null;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/*  Project Assignments                                                */
/* ------------------------------------------------------------------ */

export async function loadMyAssignments(): Promise<AssignmentRow[]> {
  const { data, error } = await supabase
    .from('project_assignments')
    .select('*')
    .order('project_id');
  if (error) { console.error('loadMyAssignments:', error); return []; }
  return (data ?? []) as AssignmentRow[];
}

/* ------------------------------------------------------------------ */
/*  Milestones                                                         */
/* ------------------------------------------------------------------ */

export async function loadMilestones(projectId: string): Promise<MilestoneRow[]> {
  const { data, error } = await supabase
    .from('project_milestones')
    .select('*')
    .eq('project_id', projectId)
    .order('stage_order');
  if (error) { console.error('loadMilestones:', error); return []; }
  return (data ?? []) as MilestoneRow[];
}

export async function loadMilestonesForProjects(projectIds: string[]): Promise<MilestoneRow[]> {
  if (projectIds.length === 0) return [];
  const { data, error } = await supabase
    .from('project_milestones')
    .select('*')
    .in('project_id', projectIds)
    .order('stage_order');
  if (error) { console.error('loadMilestonesForProjects:', error); return []; }
  return (data ?? []) as MilestoneRow[];
}

export async function confirmMilestone(
  milestoneId: string,
  notes: string
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('project_milestones')
    .update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      confirmed_by: user?.id ?? null,
      notes: notes || null,
    })
    .eq('id', milestoneId);
  if (error) throw error;
}

export async function insertMilestones(rows: Omit<MilestoneRow, 'id' | 'created_at'>[]): Promise<void> {
  const { error } = await supabase.from('project_milestones').insert(rows);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/*  Site Reports                                                       */
/* ------------------------------------------------------------------ */

export async function loadSiteReports(projectId: string): Promise<SiteReportRow[]> {
  const { data, error } = await supabase
    .from('site_reports')
    .select('*')
    .eq('project_id', projectId)
    .order('report_date', { ascending: false });
  if (error) { console.error('loadSiteReports:', error); return []; }
  return (data ?? []) as SiteReportRow[];
}

export async function insertSiteReport(row: Omit<SiteReportRow, 'id' | 'created_at'>): Promise<SiteReportRow> {
  const { data, error } = await supabase
    .from('site_reports')
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data as SiteReportRow;
}

/* ------------------------------------------------------------------ */
/*  Issues                                                             */
/* ------------------------------------------------------------------ */

export async function loadIssues(projectId: string): Promise<IssueRow[]> {
  const { data, error } = await supabase
    .from('project_issues')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) { console.error('loadIssues:', error); return []; }
  return (data ?? []) as IssueRow[];
}

export async function insertIssue(row: Omit<IssueRow, 'id' | 'created_at' | 'created_by'>): Promise<IssueRow> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('project_issues')
    .insert({ ...row, created_by: user?.id ?? null })
    .select()
    .single();
  if (error) throw error;
  return data as IssueRow;
}

export async function updateIssueStatus(
  issueId: string,
  status: IssueRow['status']
): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (status === 'resolved') patch.resolved_at = new Date().toISOString();
  const { error } = await supabase
    .from('project_issues')
    .update(patch)
    .eq('id', issueId);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/*  Media                                                              */
/* ------------------------------------------------------------------ */

export async function loadMedia(projectId: string): Promise<MediaRow[]> {
  const { data, error } = await supabase
    .from('project_media')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) { console.error('loadMedia:', error); return []; }
  return (data ?? []) as MediaRow[];
}

export async function uploadMedia(
  projectId: string,
  file: File
): Promise<MediaRow> {
  const { data: { user } } = await supabase.auth.getUser();
  const ext = file.name.split('.').pop();
  const storagePath = `${projectId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  // Upload file to storage bucket
  const { error: uploadErr } = await supabase.storage
    .from('project-media')
    .upload(storagePath, file);
  if (uploadErr) throw uploadErr;

  // Insert metadata row
  const { data, error } = await supabase
    .from('project_media')
    .insert({
      project_id: projectId,
      storage_path: storagePath,
      file_name: file.name,
      uploaded_by: user?.id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as MediaRow;
}

export function getPublicMediaUrl(storagePath: string): string {
  const { data } = supabase.storage
    .from('project-media')
    .getPublicUrl(storagePath);
  return data.publicUrl;
}

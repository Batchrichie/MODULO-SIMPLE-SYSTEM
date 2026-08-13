import { supabase } from "../supabaseClient";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export interface UserProfile {
  employeeId: string;
  employeeName: string;
  positionId: string | null;
  positionTitle: string | null;
  portalAccess: boolean;
  permissions: string[];
  onboardingStatus: 'not_invited' | 'invited' | 'active' | 'inactive';
}

interface PositionRow {
  id: string;
  title: string;
  permissions: string[];
}

interface EmployeeRow {
  id: string;
  name: string;
  position_id: string | null;
  portal_access: boolean;
  auth_user_id: string | null;
  onboarding_status: 'not_invited' | 'invited' | 'active' | 'inactive' | null;
}

/* ------------------------------------------------------------------ */
/*  loadMyProfile — called once after login                             */
/* ------------------------------------------------------------------ */

/**
 * Resolves the logged-in user's employee record, position, and permissions.
 * Returns null if no employee is linked to this auth user.
 */
export async function loadMyProfile(): Promise<UserProfile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: employee, error } = await supabase
    .from("employees")
    .select(
      `id, name, position_id, portal_access, auth_user_id, onboarding_status, positions:position_id (id, title, permissions)`
    )
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Failed to load user profile:", error);
    return null;
  }
  if (!employee) return null;

  const emp = employee as unknown as EmployeeRow & {
    positions: PositionRow | null;
  };

  return {
    employeeId: emp.id,
    employeeName: emp.name,
    positionId: emp.position_id,
    positionTitle: emp.positions?.title ?? null,
    portalAccess: emp.portal_access ?? false,
    permissions: emp.positions?.permissions ?? [],
    onboardingStatus: emp.onboarding_status ?? 'not_invited',
  };
}

/* ------------------------------------------------------------------ */
/*  loadPositions — for the Position dropdown in EmployeesPanel         */
/* ------------------------------------------------------------------ */

export interface PositionOption {
  id: string;
  title: string;
}

export async function loadPositions(): Promise<PositionOption[]> {
  const { data, error } = await supabase
    .from("positions")
    .select("id, title")
    .order("title");

  if (error) {
    console.error("Failed to load positions:", error);
    return [];
  }
  return ((data ?? []) as PositionRow[]).map((p) => ({
    id: p.id,
    title: p.title,
  }));
}

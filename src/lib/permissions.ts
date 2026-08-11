import type { ComponentType } from "react";
import {
  BookOpen, PenLine, Scale, Users, Banknote, FileSpreadsheet,
  Plus, X, Sun, Moon, LayoutDashboard,
  ArrowUpRight, FileText, Landmark,
  Briefcase, Receipt, Radio, Camera,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Permission tokens — must match positions.permissions in the DB    */
/* ------------------------------------------------------------------ */

// Full admin (accountant/owner)
export const ALL = "all";

// CEO scoped tokens
export const CEO = "ceo:access";
export const CEO_JOURNAL_READ = "ceo:journal:read";
export const CEO_JOURNAL_WRITE = "ceo:journal:write";
export const CEO_PROJECTS_WRITE = "ceo:projects:write";
export const CEO_INVOICING_WRITE = "ceo:invoicing:write";
export const CEO_BILLS_WRITE = "ceo:bills:write";
export const CEO_EMPLOYEES_WRITE = "ceo:employees:write";
export const CEO_PAYROLL_WRITE = "ceo:payroll:write";

// Non-admin portal tokens
export const DASHBOARD_OPS = "dashboard:ops";
export const DASHBOARD_LIMITED = "dashboard:limited";
export const PROJECTS_VIEW = "projects:view";
export const PROGRESS_WRITE = "progress:write";
export const SITE_REPORTS_WRITE = "site-reports:write";
export const ISSUES_WRITE = "issues:write";
export const MEDIA_WRITE = "media:write";
export const PAYROLL_SELF = "payroll:self";
export const PAYROLL_STATEMENT = "payroll:statement";
export const FIELD_ACTIVITY_VIEW = "field-activity:view";

/** Tokens exclusive to non-admin portal users (hidden from CEO) */
const PORTAL_ONLY_TOKENS: ReadonlySet<string> = new Set([
  DASHBOARD_OPS, DASHBOARD_LIMITED,
  MEDIA_WRITE, PAYROLL_SELF, PAYROLL_STATEMENT,
  FIELD_ACTIVITY_VIEW,
]);

/** Every scoped token (excludes ALL and CEO base) */
export const SCOPED_TOKENS = [
  CEO_JOURNAL_READ, CEO_JOURNAL_WRITE,
  CEO_PROJECTS_WRITE, CEO_INVOICING_WRITE, CEO_BILLS_WRITE,
  CEO_EMPLOYEES_WRITE, CEO_PAYROLL_WRITE,
  DASHBOARD_OPS, DASHBOARD_LIMITED, PROJECTS_VIEW,
  PROGRESS_WRITE, SITE_REPORTS_WRITE, ISSUES_WRITE, MEDIA_WRITE,
  PAYROLL_SELF, PAYROLL_STATEMENT, FIELD_ACTIVITY_VIEW,
] as const;

/* ------------------------------------------------------------------ */
/*  Permission helpers                                                  */
/* ------------------------------------------------------------------ */

/** True if user has the ALL (admin) token */
export function isAdmin(permissions: string[]): boolean {
  return permissions.includes(ALL);
}

/** True if user has the CEO base token */
export function isCeo(permissions: string[]): boolean {
  return permissions.includes(CEO);
}

function isPortalOnlyToken(token: string) {
  return PORTAL_ONLY_TOKENS.has(token);
}

/**
 * Returns true if the user's permission array contains the required token.
 *
 * Access rules by role:
 *  - Admin (ALL): sees all admin pages but not portal-only pages.
 *  - CEO (ceo:access): sees CEO pages but not non-admin portal pages.
 *  - Non-admin (PM/WD/Employee): sees portal-only pages and any token they explicitly have.
 */
export function canAccess(
  permissions: string[],
  requiredToken: string
): boolean {
  if (isPortalOnlyToken(requiredToken)) {
    return !permissions.includes(ALL) && !permissions.includes(CEO);
  }

  // Admin sees all non-portal pages.
  if (permissions.includes(ALL)) return true;

  // CEO sees all non-portal pages.
  if (permissions.includes(CEO)) return true;

  return permissions.includes(requiredToken);
}

/**
 * Returns true if the user can WRITE (not just view).
 * Admin (ALL) always has write access.
 * CEO must have the specific write token.
 */
export function canWrite(
  permissions: string[],
  writeToken: string
): boolean {
  if (permissions.includes(ALL)) return true;
  return permissions.includes(writeToken);
}

/* ------------------------------------------------------------------ */
/*  Nav config — single source of truth for sidebar & bottom nav      */
/* ------------------------------------------------------------------ */

export interface NavItemConfig {
  key: string;
  label: string;
  icon: ComponentType<{ size?: number; style?: any }>;
  token: string;           // token required to SEE this tab (ALL sees all, CEO sees CEO-tagged)
  writeToken?: string;     // token required to WRITE (defaults to token if unset)
  group: string;
  mobileOnly?: boolean;
  mobileAlways?: boolean;
}

export const NAV_CONFIG: NavItemConfig[] = [
  // ── Overview ──
  { key: "journal",              label: "Journal",           icon: PenLine,         token: ALL,               writeToken: ALL,                   group: "Overview" },
  { key: "dashboard",            label: "Dashboard",         icon: LayoutDashboard, token: ALL,                                         group: "Overview" },
  { key: "ledger",               label: "Trial Balance",     icon: Scale,           token: ALL,                                         group: "Overview" },
  { key: "financials",           label: "Financials",        icon: ArrowUpRight,     token: ALL,                                         group: "Overview" },

  // ── Operations ──
  { key: "projects",             label: "Projects",          icon: Briefcase,       token: PROJECTS_VIEW,     writeToken: CEO_PROJECTS_WRITE,   group: "Operations" },
  { key: "invoicing",            label: "Invoicing",         icon: Receipt,         token: ALL,               writeToken: CEO_INVOICING_WRITE,  group: "Operations" },
  { key: "employees",            label: "Employees",         icon: Users,           token: ALL,               writeToken: CEO_EMPLOYEES_WRITE,  group: "Operations" },
  { key: "payroll",              label: "Payroll",           icon: Banknote,        token: ALL,               writeToken: CEO_PAYROLL_WRITE,    group: "Operations" },
  { key: "bills",                label: "Bills",             icon: Receipt,         token: ALL,               writeToken: CEO_BILLS_WRITE,      group: "Operations" },
  { key: "expenses",             label: "Expenses",          icon: Receipt,         token: ALL,                                         group: "Operations" },
  { key: "aged-payables",        label: "Aged Payables",     icon: ArrowUpRight,     token: ALL,                                         group: "Operations" },
  { key: "bank-reconciliation",  label: "Bank Rec",          icon: Landmark,        token: ALL,                                         group: "Operations" },
  { key: "reports",              label: "Reports",           icon: FileText,        token: ALL,                                         group: "Operations" },
  { key: "field-activity",       label: "Field Activity",    icon: Radio,           token: FIELD_ACTIVITY_VIEW,                         group: "Operations" },

  // ── Setup (admin only — hidden from CEO) ──
  { key: "accounts",             label: "Chart of Accounts", icon: BookOpen,        token: ALL,                                         group: "Setup" },
  { key: "export",               label: "Export",            icon: FileSpreadsheet,  token: ALL,                                         group: "Setup" },

  // ── Portal tabs (non-admin) ──
  { key: "pm-dashboard",         label: "My Projects",       icon: Briefcase,       token: DASHBOARD_OPS,     group: "Portal" },
  { key: "my-payslips",          label: "My Payslips",       icon: Banknote,        token: PAYROLL_SELF,      group: "Portal" },
  { key: "my-statement",         label: "My Statement",      icon: FileText,        token: PAYROLL_STATEMENT, group: "Portal" },
  { key: "media-library",        label: "Media Library",     icon: Camera,          token: MEDIA_WRITE,       group: "Portal" },

  // ── Logout (always available, handled separately) ──
  { key: "logout",               label: "Logout",            icon: X,               token: "",                  group: "" },
];

/**
 * Nav keys that are hidden from the CEO role.
 * These include admin-only pages (Expenses, Bank Rec, Chart of Accounts, Export)
 * and all non-admin portal pages (My Payslips, My Statement, My Projects,
 * Media Library, Field Activity).
 */
const CEO_HIDDEN_KEYS = new Set([
  "expenses", "bank-reconciliation", "accounts", "export",
  "pm-dashboard", "my-payslips", "my-statement", "media-library", "field-activity",
]);

/**
 * Filter nav items based on the user's permissions.
 * Returns items grouped by their `group` field, preserving order.
 * CEO-hidden keys are stripped out even though canAccess passes for them.
 */
export function getNavGroups(permissions: string[]) {
  const ceo = isCeo(permissions);
  const accessible = NAV_CONFIG.filter((n) => {
    if (n.key === "logout") return false;
    if (!canAccess(permissions, n.token)) return false;
    if (ceo && CEO_HIDDEN_KEYS.has(n.key)) return false;
    return true;
  });

  const groups: { label: string; keys: string[] }[] = [];
  for (const item of accessible) {
    const existing = groups.find((g) => g.label === item.group);
    if (existing) {
      existing.keys.push(item.key);
    } else {
      groups.push({ label: item.group, keys: [item.key] });
    }
  }
  return groups;
}

/**
 * Get the 4 items for the mobile bottom nav bar.
 */
export function getMobileBottomNav(permissions: string[]): NavItemConfig[] {
  if (isAdmin(permissions)) {
    return NAV_CONFIG.filter((n) =>
      ["invoicing", "journal", "dashboard", "payroll"].includes(n.key)
    );
  }
  if (isCeo(permissions)) {
    return NAV_CONFIG.filter((n) =>
    ["invoicing", "dashboard", "projects", "bills"].includes(n.key)
    );
  }
  // Non-admin: show their most relevant tabs
  const accessible = NAV_CONFIG.filter(
    (n) => n.key !== "logout" && canAccess(permissions, n.token)
  );
  const primary = accessible.filter((n) => !n.mobileOnly).slice(0, 3);
  return primary;
}

/**
 * Get items for the mobile "More" popup.
 */
export function getMobileMoreItems(permissions: string[]): NavItemConfig[] {
  const bottomKeys = new Set(getMobileBottomNav(permissions).map((n) => n.key));
  const ceo = isCeo(permissions);
  return NAV_CONFIG.filter(
    (n) =>
      n.key !== "logout" &&
      !bottomKeys.has(n.key) &&
      canAccess(permissions, n.token) &&
      !(ceo && CEO_HIDDEN_KEYS.has(n.key))
  );
}

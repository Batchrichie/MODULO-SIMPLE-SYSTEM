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
export const LOANS_SELF = "loans:self";

/** Tokens exclusive to non-admin portal users (hidden from CEO) */
const PORTAL_ONLY_TOKENS: ReadonlySet<string> = new Set([
  DASHBOARD_OPS, DASHBOARD_LIMITED,
  MEDIA_WRITE, PAYROLL_SELF, PAYROLL_STATEMENT,
  FIELD_ACTIVITY_VIEW, LOANS_SELF,
]);

/** Every scoped token (excludes ALL and CEO base) */
export const SCOPED_TOKENS = [
  CEO_JOURNAL_READ, CEO_JOURNAL_WRITE,
  CEO_PROJECTS_WRITE, CEO_INVOICING_WRITE, CEO_BILLS_WRITE,
  CEO_EMPLOYEES_WRITE, CEO_PAYROLL_WRITE,
  DASHBOARD_OPS, DASHBOARD_LIMITED, PROJECTS_VIEW,
  PROGRESS_WRITE, SITE_REPORTS_WRITE, ISSUES_WRITE, MEDIA_WRITE,
  PAYROLL_SELF, PAYROLL_STATEMENT, FIELD_ACTIVITY_VIEW, LOANS_SELF,
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

/**
 * Returns true if the user's permission array contains the required token.
 *
 * Access rules by role:
 *  - Admin (ALL): sees everything.
 *  - CEO (ceo:access): passes token check here; specific nav keys are
 *    filtered out in getNavGroups / getMobileMoreItems via CEO_HIDDEN_KEYS.
 *  - Non-admin (PM/WD/Employee): portal items (PORTAL_ONLY_TOKENS) are
 *    auto-visible; other items require the specific token in their permissions.
 */
export function canAccess(
  permissions: string[],
  requiredToken: string
): boolean {
  // Empty token = always accessible (e.g. logout)
  if (!requiredToken) return true;

  // Admin sees everything
  if (permissions.includes(ALL)) return true;

  // CEO: passes for all tokens (CEO_HIDDEN_KEYS handles visibility filtering)
  if (permissions.includes(CEO)) return true;

  // Non-admin portal users: portal pages auto-visible
  if (PORTAL_ONLY_TOKENS.has(requiredToken)) return true;

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
  { key: "dashboard",            label: "Dashboard",         icon: LayoutDashboard, token: ALL,                                         group: "Overview" },
  { key: "journal",              label: "Journal",           icon: PenLine,         token: ALL,               writeToken: ALL,                   group: "Overview" },
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
  { key: "loans",                label: "Loans",             icon: Banknote,         token: CEO,                                         group: "Operations" },

  // ── Setup (admin only — hidden from CEO) ──
  { key: "accounts",             label: "Chart of Accounts", icon: BookOpen,        token: ALL,                                         group: "Setup" },
  { key: "export",               label: "Export",            icon: FileSpreadsheet,  token: ALL,                                         group: "Setup" },

  // ── Portal tabs (non-admin) ──
  { key: "pm-dashboard",         label: "My Projects",       icon: Briefcase,       token: DASHBOARD_OPS,     group: "Portal",         mobileOnly: true },
  { key: "my-payslips",          label: "My Payslips",       icon: Banknote,        token: PAYROLL_SELF,      group: "My Pay",         mobileOnly: true },
  { key: "my-statement",         label: "My Statement",      icon: FileText,        token: PAYROLL_STATEMENT, group: "My Pay",         mobileOnly: true },
  { key: "media-library",        label: "Media Library",     icon: Camera,          token: MEDIA_WRITE,       group: "Resources",       mobileOnly: true },
  { key: "my-loans",             label: "My Loans",           icon: Banknote,         token: LOANS_SELF,         group: "My Pay",          mobileOnly: true },

  // ── Account ──
  { key: "logout",               label: "Logout",            icon: X,               token: "",                  group: "Account" },
];

/**
 * Nav keys hidden from admin — portal-only pages whose render guards
 * use `!adminFlag && !ceoFlag` in App.tsx.
 */
const ADMIN_HIDDEN_KEYS = new Set([
  "pm-dashboard", "my-payslips", "my-statement", "media-library", "my-loans",
]);

/**
 * Nav keys that are hidden from the CEO role.
 * These include admin-only pages (Expenses, Bank Rec, Chart of Accounts, Export)
 * and all non-admin portal pages (My Payslips, My Statement, My Projects,
 * Media Library, Field Activity).
 */
const CEO_HIDDEN_KEYS = new Set([
  "expenses", "bank-reconciliation", "accounts", "export",
  "pm-dashboard", "my-payslips", "my-statement", "media-library", "my-loans", "field-activity",
]);

/**
 * Filter nav items based on the user's permissions.
 * Returns items grouped by their `group` field, preserving order.
 * Admin-hidden and CEO-hidden keys are stripped out even though canAccess passes.
 */
export function getNavGroups(permissions: string[]) {
  const admin = isAdmin(permissions);
  const ceo = isCeo(permissions);
  const accessible = NAV_CONFIG.filter((n) => {
    if (!canAccess(permissions, n.token)) return false;
    if (admin && ADMIN_HIDDEN_KEYS.has(n.key)) return false;
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
 * Get the items for the mobile bottom nav bar.
 * Admin: invoicing, journal, dashboard, payroll
 * CEO: invoicing, dashboard, projects, bills
 * PM: pm-dashboard, my-payslips, projects
 * WD/Employee: projects, media-library, my-payslips
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
  // Non-admin: show their most relevant tabs (including mobileOnly ones)
  const accessible = NAV_CONFIG.filter(
    (n) => n.key !== "logout" && canAccess(permissions, n.token)
  );
  // PM gets pm-dashboard first, then payslips and projects
  if (permissions.includes(DASHBOARD_OPS)) {
    const keys = ["pm-dashboard", "my-payslips", "projects"];
    return keys
      .map((k) => accessible.find((n) => n.key === k))
      .filter(Boolean) as NavItemConfig[];
  }
  // WD / Employee: projects, media-library, my-payslips
  const keys = ["projects", "media-library", "my-payslips"];
  return keys
    .map((k) => accessible.find((n) => n.key === k))
    .filter(Boolean) as NavItemConfig[];
}

export function getMobileMoreItems(permissions: string[]): NavItemConfig[] {
  const bottomKeys = new Set(getMobileBottomNav(permissions).map((n) => n.key));
  const admin = isAdmin(permissions);
  const ceo = isCeo(permissions);

  return NAV_CONFIG.filter((n) => {
    if (n.key === "logout") return true;
    if (bottomKeys.has(n.key)) return false;
    if (!canAccess(permissions, n.token)) return false;
    if (admin && ADMIN_HIDDEN_KEYS.has(n.key)) return false;
    if (ceo && CEO_HIDDEN_KEYS.has(n.key)) return false;
    return true;
  });
}

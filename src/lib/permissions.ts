import type { ComponentType } from "react";
import {
  BookOpen, PenLine, Scale, Users, Banknote, FileSpreadsheet,
  Plus, X, Sun, Moon, LayoutDashboard,
  ArrowUpRight, FileText, Landmark,
  Briefcase, Receipt,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Permission tokens — must match positions.permissions in the DB    */
/* ------------------------------------------------------------------ */

export const ALL = "all";
export const DASHBOARD_OPS = "dashboard:ops";
export const DASHBOARD_LIMITED = "dashboard:limited";
export const PROJECTS_VIEW = "projects:view";
export const PROGRESS_WRITE = "progress:write";
export const SITE_REPORTS_WRITE = "site-reports:write";
export const ISSUES_WRITE = "issues:write";
export const MEDIA_WRITE = "media:write";
export const PAYROLL_SELF = "payroll:self";
export const PAYROLL_STATEMENT = "payroll:statement";

/** Every token except 'all' */
export const SCOPED_TOKENS = [
  DASHBOARD_OPS,
  DASHBOARD_LIMITED,
  PROJECTS_VIEW,
  PROGRESS_WRITE,
  SITE_REPORTS_WRITE,
  ISSUES_WRITE,
  MEDIA_WRITE,
  PAYROLL_SELF,
  PAYROLL_STATEMENT,
] as const;

/* ------------------------------------------------------------------ */
/*  Permission check                                                   */
/* ------------------------------------------------------------------ */

/**
 * Returns true if the user's permission array contains the required token.
 * Users with 'all' in their permissions have access to everything.
 */
export function canAccess(
  permissions: string[],
  requiredToken: string
): boolean {
  return permissions.includes(ALL) || permissions.includes(requiredToken);
}

/* ------------------------------------------------------------------ */
/*  Nav config — single source of truth for sidebar & bottom nav      */
/* ------------------------------------------------------------------ */

export interface NavItemConfig {
  key: string;
  label: string;
  icon: ComponentType<{ size?: number; style?: any }>;
  token: string;          // permission token required to see this tab
  group: string;          // sidebar group label
  mobileOnly?: boolean;   // only show in mobile bottom-nav
  mobileAlways?: boolean; // always visible in bottom-nav (even in "more" menu)
}

export const NAV_CONFIG: NavItemConfig[] = [
  // ── Overview ──
  { key: "dashboard",          label: "Dashboard",        icon: LayoutDashboard, token: ALL,               group: "Overview" },
  { key: "journal",            label: "Journal",          icon: PenLine,         token: ALL,               group: "Overview" },
  { key: "ledger",             label: "Trial Balance",    icon: Scale,           token: ALL,               group: "Overview" },
  { key: "financials",         label: "Financials",       icon: ArrowUpRight,     token: ALL,               group: "Overview" },

  // ── Operations ──
  { key: "projects",           label: "Projects",         icon: Briefcase,       token: PROJECTS_VIEW,     group: "Operations" },
  { key: "invoicing",          label: "Invoicing",        icon: Receipt,         token: ALL,               group: "Operations" },
  { key: "employees",          label: "Employees",        icon: Users,           token: ALL,               group: "Operations" },
  { key: "payroll",            label: "Payroll",          icon: Banknote,        token: ALL,               group: "Operations" },
  { key: "bills",              label: "Bills",            icon: Receipt,         token: ALL,               group: "Operations" },
  { key: "expenses",           label: "Expenses",         icon: Receipt,         token: ALL,               group: "Operations" },
  { key: "aged-payables",      label: "Aged Payables",    icon: ArrowUpRight,     token: ALL,               group: "Operations" },
  { key: "bank-reconciliation", label: "Bank Rec",        icon: Landmark,        token: ALL,               group: "Operations" },
  { key: "reports",            label: "Reports",          icon: FileText,        token: ALL,               group: "Operations" },

  // ── Setup ──
  { key: "accounts",           label: "Chart of Accounts",icon: BookOpen,        token: ALL,               group: "Setup" },
  { key: "export",             label: "Export",           icon: FileSpreadsheet,  token: ALL,               group: "Setup" },

  // ── Portal tabs (non-admin) ──
  { key: "pm-dashboard",       label: "My Projects",      icon: Briefcase,       token: DASHBOARD_OPS,     group: "Overview",        mobileOnly: true },
  { key: "my-payslips",        label: "My Payslips",      icon: Banknote,        token: PAYROLL_SELF,      group: "Overview",        mobileOnly: true },
  { key: "my-statement",       label: "My Statement",     icon: FileText,        token: PAYROLL_STATEMENT, group: "Overview",        mobileOnly: true },

  // ── Logout (always available, handled separately) ──
  { key: "logout",             label: "Logout",           icon: X,               token: "",                 group: "" },
];

/**
 * Filter nav items based on the user's permissions.
 * Returns items grouped by their `group` field, preserving order.
 */
export function getNavGroups(permissions: string[]) {
  const accessible = NAV_CONFIG.filter(
    (n) => n.token === "" || canAccess(permissions, n.token)
  );

  const groups: { label: string; keys: string[] }[] = [];
  for (const item of accessible) {
    if (item.key === "logout") continue;
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
 * Admin gets: invoicing, journal, dashboard, payroll
 * PM gets: pm-dashboard, (center dashboard), my-payslips, (more)
 */
export function getMobileBottomNav(permissions: string[]): NavItemConfig[] {
  const isAdmin = permissions.includes(ALL);
  if (isAdmin) {
    return NAV_CONFIG.filter((n) =>
      ["invoicing", "journal", "dashboard", "payroll"].includes(n.key)
    );
  }
  // Non-admin: show their most relevant tabs
  const accessible = NAV_CONFIG.filter(
    (n) => n.key !== "logout" && canAccess(permissions, n.token)
  );
  // First 3 that aren't mobileOnly, plus dashboard equivalent
  const primary = accessible.filter((n) => !n.mobileOnly).slice(0, 3);
  return primary;
}

/**
 * Get items for the mobile "More" popup (excludes bottom-nav items + logout).
 */
export function getMobileMoreItems(permissions: string[]): NavItemConfig[] {
  const bottomKeys = new Set(getMobileBottomNav(permissions).map((n) => n.key));
  return NAV_CONFIG.filter(
    (n) => n.key !== "logout" && !bottomKeys.has(n.key) && canAccess(permissions, n.token)
  );
}

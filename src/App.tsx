import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import type { CSSProperties, ComponentType, ReactNode } from "react";
import * as XLSX from "xlsx";
import {
  BookOpen,
  PenLine,
  Scale,
  Users,
  Banknote,
  FileSpreadsheet,
  Plus,
  Trash2,
  Printer,
  Check,
  AlertTriangle,
  Settings2,
  Briefcase,
  Receipt,
  TrendingUp,
  X,
  Sun,
  Moon,
  LayoutDashboard,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
} from "lucide-react";
import {
  assertJournalEntry,
  assertInvoice,
  assertAccount,
  assertEmployee,
  assertProject,
  assertPayment,
} from "./validation";
import Login from "./Login.jsx";
import { loadLedgerState, loadTaxConfig, saveSettings, saveTaxRates, savePayeBrackets, db, getTrialBalance, getBalanceSheet, getProfitAndLoss, getSession, onAuthStateChange, signOut, runPayrollAndFetch } from "./supabaseClient";

// ---------- Design Tokens (CSS Variables for Theming) ----------
const INK = "var(--ink)";
const PAPER = "var(--paper)";
const PAPER_RAISED = "var(--paper-raised)";
const RULE = "var(--rule)";
const GREEN = "var(--green)";
const GREEN_DEEP = "var(--green-deep)";
const GOLD = "var(--gold)";
const ALERT = "var(--alert)";
const MUTED = "var(--muted)";

const FONT_DISPLAY = "'Roboto Slab', serif";
const FONT_BODY = "'Inter', sans-serif";
const FONT_MONO = "'IBM Plex Mono', monospace";

function useGoogleFonts() {
  useEffect(() => {
    const id = "ledger-app-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@400;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap";
    document.head.appendChild(link);
  }, []);
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 860 : false
  );
  useEffect(() => {
    function onResize() {
      setIsMobile(window.innerWidth < 860);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return isMobile;
}

// ---------- Letterhead ----------
const LOGO_SRC =
  "https://z-cdn-media.chatglm.cn/files/c4df6667-2cb5-44bd-9e8c-084ed2a10aef.png?auth_key=1885240175-d071a696811b4023895eec2f8f72bcdc-0-f1149165f857bcfa6db14fa029bb57fd";

// ---------- Company Defaults ----------
// MINIMAL FALLBACK ONLY - Real company data must come from database.
// This empty template ensures the app doesn't crash before DB loads.
// All actual values should be seeded in app_settings.data.company

const COMPANY_TEMPLATE = {
  name: "",
  addressLine: "",
  poBox: "",
  cityLine: "",
  phone: "",
  telephone: "",
  email: "",
  website: "",
  preparedByName: "",
  preparedByTitle: "",
  authorisedByName: "",
  authorisedByTitle: "",
};

// ---------- Defaults ----------
// Chart of Accounts is now loaded entirely from the database.
// No hardcoded accounts - the database is the single source of truth.
// This prevents FK violations and ensures consistency between app and DB.

const DEFAULT_PROJECTS = [
  {
    id: "PRJ-MANET",
    name: "Manet Estate Villa",
    status: "Active",
    projectType: "Construction Contract",
    recognitionMethod: "POC",
    contractValue: 150000,
    estimatedCost: 120000,
  },
  {
    id: "PRJ-TSEADDO",
    name: "Tse Addo Permit",
    status: "Active",
    projectType: "Permit Processing",
    recognitionMethod: "POINT_IN_TIME",
    contractValue: 5000,
    estimatedCost: 1000,
  },
  {
    id: "PRJ-TAMALE",
    name: "Tamale Design",
    status: "Active",
    projectType: "Architectural Design",
    recognitionMethod: "POC",
    contractValue: 25000,
    estimatedCost: 12000,
  },
];

const GENERAL_PROJECT = { id: "GEN", name: "General / Office" };

const DEFAULT_DATA = {
  companyName: "",  // Loaded from database
  company: COMPANY_TEMPLATE,  // Loaded from database - empty until DB loads
  accounts: [], // Loaded from database - no hardcoded defaults
  journal: [],
  employees: [],
  payrollRuns: [],
  projects: DEFAULT_PROJECTS,
  invoices: [],
  nextEntryNum: 1,
  nextInvoiceNum: 7,
  ssnitEmployeeRate: 0,
  ssnitEmployerRate: 0,
  brackets: [],
  nhilGetfundRate: 0,
  vatRate: 0,
};

function fmt(n: number | string | null | undefined) {
  const v = Number(n) || 0;
  return v.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function projectName(
  projects: Array<{ id: string; name: string }>,
  id?: string | null
) {
  if (!id || id === "GEN") return GENERAL_PROJECT.name;
  const p = projects.find((p) => p.id === id);
  return p ? p.name : "General / Office";
}

// ---------- Small UI atoms ----------
type NavItemProps = {
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  active?: boolean;
  onClick?: () => void;
};

function NavItem({ icon: Icon, label, active = false, onClick }: NavItemProps) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "8px 10px 8px 9px",
        borderRadius: 7,
        border: "none",
        borderLeft: active ? `3px solid ${GREEN}` : "3px solid transparent",
        background: active
          ? "var(--nav-active)"
          : hover
          ? "var(--nav-hover)"
          : "transparent",
        color: active ? GREEN_DEEP : INK,
        fontFamily: FONT_BODY,
        fontSize: 13.5,
        fontWeight: active ? 700 : 500,
        cursor: "pointer",
        textAlign: "left",
        transition: "background 0.12s ease, color 0.12s ease",
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 26,
          height: 26,
          borderRadius: 6,
          flexShrink: 0,
          background: active ? GREEN : "transparent",
          color: active ? PAPER : MUTED,
        }}
      >
        <Icon size={14} strokeWidth={2.2} />
      </span>
      {label}
    </button>
  );
}

type BottomNavItemProps = {
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  active?: boolean;
  onClick?: () => void;
};

function BottomNavItem({ icon: Icon, label, active = false, onClick }: BottomNavItemProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        minWidth: 66,
        flex: "0 0 auto",
        padding: "8px 8px 7px",
        border: "none",
        background: "none",
        cursor: "pointer",
        color: active ? GREEN : MUTED,
      }}
    >
      <Icon size={19} strokeWidth={active ? 2.4 : 2} />
      <span
        style={{
          fontFamily: FONT_BODY,
          fontSize: 10,
          fontWeight: active ? 700 : 500,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </button>
  );
}

type CardProps = {
  children: ReactNode;
  style?: CSSProperties;
};

function Card({ children, style }: CardProps) {
  return (
    <div
      style={{
        background: PAPER_RAISED,
        border: `1px solid ${RULE}`,
        borderRadius: 8,
        padding: 20,
        boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

type SectionTitleProps = {
  children: ReactNode;
  sub?: string;
  action?: ReactNode;
};

function SectionTitle({ children, sub, action }: SectionTitleProps) {
  return (
    <div
      style={{
        marginBottom: 18,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        flexWrap: "wrap",
        gap: 10,
      }}
    >
      <div>
        <h2
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 22,
            fontWeight: 700,
            color: INK,
            margin: 0,
          }}
        >
          {children}
        </h2>
        {sub && (
          <p
            style={{
              fontFamily: FONT_BODY,
              fontSize: 13,
              color: MUTED,
              margin: "4px 0 0",
            }}
          >
            {sub}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

type TableScrollProps = {
  children: ReactNode;
};

function TableScroll({ children }: TableScrollProps) {
  return (
    <div
      style={{
        width: "100%",
        overflowX: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {children}
    </div>
  );
}

type ThProps = {
  children: ReactNode;
  right?: boolean;
};

function Th({ children, right = false }: ThProps) {
  return (
    <th
      style={{
        textAlign: right ? "right" : "left",
        fontFamily: FONT_BODY,
        fontSize: 11,
        letterSpacing: 0.5,
        textTransform: "uppercase",
        color: MUTED,
        fontWeight: 600,
        padding: "8px 10px",
        borderBottom: `2px solid ${RULE}`,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

type TdProps = {
  children: ReactNode;
  right?: boolean;
  mono?: boolean;
  bold?: boolean;
  style?: CSSProperties;
  label?: string;
};

function Td({ children, right = false, mono = false, bold = false, style, label }: TdProps) {
  return (
    <td
      data-label={label}
      style={{
        textAlign: right ? "right" : "left",
        padding: "8px 10px",
        borderBottom: `1px solid ${RULE}`,
        fontFamily: mono ? FONT_MONO : FONT_BODY,
        fontSize: 13.5,
        color: INK,
        fontWeight: bold ? 600 : 400,
        ...style,
      }}
    >
      {children}
    </td>
  );
}

const inputStyle = {
  fontFamily: FONT_BODY,
  fontSize: 13.5,
  padding: "7px 9px",
  borderRadius: 5,
  border: `1px solid ${RULE}`,
  background: "var(--input-bg)",
  color: INK,
  width: "100%",
  boxSizing: "border-box",
  transition: "border-color 0.15s, box-shadow 0.15s",
};

const labelStyle = {
  fontFamily: FONT_BODY,
  fontSize: 11,
  color: MUTED,
  fontWeight: 600,
  display: "block",
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  icon?: ComponentType<{ size?: number; strokeWidth?: number }>;
  type?: "button" | "submit" | "reset";
  fullWidth?: boolean;
};

function Button({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  icon: Icon,
  type,
  fullWidth = false,
}: ButtonProps) {
  const styles = {
    primary: { background: GREEN, color: PAPER, border: `1px solid ${GREEN}` },
    ghost: {
      background: "transparent",
      color: INK,
      border: `1px solid ${RULE}`,
    },
    danger: {
      background: "transparent",
      color: ALERT,
      border: `1px solid ${ALERT}`,
    },
  };
  return (
    <button
      type={type || "button"}
      onClick={onClick}
      disabled={disabled}
      className="btn-hover"
      style={{
        ...styles[variant],
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "8px 14px",
        borderRadius: 6,
        fontFamily: FONT_BODY,
        fontSize: 13.5,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        whiteSpace: "nowrap",
        width: fullWidth ? "100%" : "auto",
        transition: "opacity 0.15s, box-shadow 0.15s",
      }}
    >
      {Icon && <Icon size={14} />}
      {children}
    </button>
  );
}

type ModalProps = {
  title: string;
  sub?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
};

function Modal({ title, sub, onClose, children, wide = false }: ModalProps) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 1000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        overflowY: "auto",
        padding: "24px 12px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-card"
        style={{
          background: PAPER_RAISED,
          borderRadius: 10,
          border: `1px solid ${RULE}`,
          width: "100%",
          maxWidth: wide ? 780 : 560,
          padding: 24,
          boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
          margin: "auto 0",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 16,
          }}
        >
          <div>
            <h3
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 19,
                fontWeight: 700,
                color: INK,
                margin: 0,
              }}
            >
              {title}
            </h3>
            {sub && (
              <p
                style={{
                  fontFamily: FONT_BODY,
                  fontSize: 12.5,
                  color: MUTED,
                  margin: "4px 0 0",
                }}
              >
                {sub}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: MUTED,
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------- Dashboard Panel ----------
function KpiCard({ title, value, icon: Icon, accent, sub }) {
  return (
    <Card style={{ flex: 1, minWidth: 220, borderTop: `3px solid ${accent}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontFamily: FONT_BODY, fontSize: 12, color: MUTED, fontWeight: 600, textTransform: "uppercase" }}>
          {title}
        </span>
        <span style={{ color: accent, display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 6, background: "var(--nav-hover)" }}>
          <Icon size={16} />
        </span>
      </div>
      <h3 style={{ fontFamily: FONT_MONO, fontSize: 24, color: INK, margin: 0 }}>
        GHS {fmt(value)}
      </h3>
      {sub && <p style={{ fontSize: 11, color: MUTED, margin: "4px 0 0 0" }}>{sub}</p>}
    </Card>
  );
}

function getComplianceNotifications() {
  const today = new Date();
  const day = today.getDate();
  const alerts = [];
  
  // SSNIT & PAYE due by 15th
  if (day >= 10 && day <= 14) {
    alerts.push({ text: "PAYE & SSNIT due in 1-5 days (15th). Prepare remittances.", color: GOLD });
  }
  // VAT due by 30th/31st
  if (day >= 25 && day <= 29) {
    alerts.push({ text: "VAT due soon (end of month). Prepare remittance.", color: ALERT });
  }
  // Grace period past 15th
  if (day > 15 && day < 25) {
    alerts.push({ text: "PAYE & SSNIT were due on the 15th. Verify compliance.", color: ALERT });
  }
  
  return alerts;
}

// ---------- Helper: Identify & Sort Current Working Projects ----------
function getPrioritizedProjects(data, stats) {
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM
  
  // Enrich projects with activity scores
  const enriched = stats
    .filter(p => p.status === "Active" && p.id !== "GEN")
    .map(p => {
      // Find recent journal entries for this project (last 30 days)
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const recentEntries = data.journal.filter(e => 
        (e.project || "GEN") === p.id && e.date >= thirtyDaysAgo
      );
      
      // Find recent invoices for this project (last 30 days)
      const recentInvoices = data.invoices.filter(inv => 
        (inv.project || "GEN") === p.id && inv.date >= thirtyDaysAgo && inv.status !== "Void"
      );
      
      // Calculate activity score
      const entryScore = recentEntries.length * 10;
      const invoiceScore = recentInvoices.length * 15;
      const costActivity = p.actualCost > 0 ? 20 : 0; // Has actual costs incurred
      const revenueActivity = p.revenueBilled > 0 ? 15 : 0; // Has billed revenue
      
      const totalScore = entryScore + invoiceScore + costActivity + revenueActivity;
      
      // Determine if this is a "current focus" project
      const isCurrentFocus = totalScore >= 20 || p.actualCost > 0;
      
      return {
        ...p,
        activityScore: totalScore,
        isCurrentFocus,
        recentEntryCount: recentEntries.length,
        recentInvoiceCount: recentInvoices.length,
        lastActivityDate: [...recentEntries.map(e => e.date), ...recentInvoices.map(i => i.date)].sort().pop() || null,
      };
    });
  
  // Sort: Current Focus first (by score descending), then others by contract value
  return enriched.sort((a, b) => {
    if (a.isCurrentFocus && !b.isCurrentFocus) return -1;
    if (!a.isCurrentFocus && b.isCurrentFocus) return 1;
    return b.activityScore - a.activityScore || b.contractValue - a.contractValue;
  });
}

function getDashboardMetrics(data) {
  const balanceFor = (code) => {
    let debit = 0, credit = 0;
    data.journal.forEach(e => e.lines.forEach(l => {
      if (l.account === code) { debit += l.debit; credit += l.credit; }
    }));
    return debit - credit; 
  };
  
  const cash = balanceFor("1000");
  const ar = balanceFor("1100");
  const ap = Math.abs(balanceFor("2000"));
  
  // Derive P&L totals directly from journal entries (server-backed views are used in FinancialsPanel)
  let totalRevenue = 0;
  let totalCostOfSales = 0;
  let totalAdminExpenses = 0;
  data.journal.forEach(e => e.lines.forEach(l => {
    const acc = data.accounts.find(a => a.code === l.account);
    if (!acc) return;
    if (acc.type === "Revenue" || acc.type === "Income") {
      totalRevenue += (l.credit - l.debit);
    }
    if (acc.type === "Expense") {
      const codeNum = parseInt(l.account, 10) || 0;
      const amt = l.debit - l.credit;
      if (codeNum >= 5000 && codeNum < 6000) totalCostOfSales += amt;
      else totalAdminExpenses += amt;
    }
  }));
  const totalExpenses = totalCostOfSales + totalAdminExpenses;
  const netIncome = totalRevenue - totalExpenses;
  
  let totalContractValue = 0;
  let totalEstimatedCost = 0;
  let totalActualCost = 0;
  
  const activeProjects = data.projects.filter(p => p.status === "Active" && p.id !== "GEN");
  
  activeProjects.forEach(p => {
    totalContractValue += parseFloat(p.contractValue) || 0;
    totalEstimatedCost += parseFloat(p.estimatedCost) || 0;
  });
  
  data.journal.forEach(e => {
    if (e.project && e.project !== "GEN") {
      const proj = activeProjects.find(p => p.id === e.project);
      if (proj) {
        e.lines.forEach(l => {
          const acc = data.accounts.find(a => a.code === l.account);
          if (acc && acc.type === "Expense") totalActualCost += (l.debit - l.credit);
        });
      }
    }
  });
  
  const projectedGrossMargin = totalContractValue - totalEstimatedCost;
  const projectedMarginPct = totalContractValue > 0 ? (projectedGrossMargin / totalContractValue) * 100 : 0;
  
  // Chart Data Prep
  const cashFlowData = computeCashFlow(data).slice(-6).map(c => ({ date: c.date, value: c.running }));
  
  const monthlyData = {};
  data.journal.forEach(e => {
    const month = e.period; 
    if (!month) return;
    if (!monthlyData[month]) monthlyData[month] = { revenue: 0, expense: 0 };
    e.lines.forEach(l => {
      const acc = data.accounts.find(a => a.code === l.account);
      if (!acc) return;
      if (acc.type === "Revenue" || acc.type === "Income") monthlyData[month].revenue += (l.credit - l.debit);
      if (acc.type === "Expense") monthlyData[month].expense += (l.debit - l.credit);
    });
  });
  const barChartData = Object.keys(monthlyData).slice(-6).map(m => ({
    label: m.split('-')[1] + '/' + m.split('-')[0].slice(2), 
    revenue: monthlyData[m].revenue,
    expense: monthlyData[m].expense
  }));

  const donutData = activeProjects.map(p => ({ name: p.name, value: parseFloat(p.contractValue) || 0 })).filter(d => d.value > 0);
  
  return { 
    cash, ar, ap, netIncome, totalRevenue, totalExpenses,
    totalContractValue, totalEstimatedCost, totalActualCost,
    projectedGrossMargin, projectedMarginPct,
    cashFlowData, barChartData, donutData
  };
}

// ---------- Custom SVG Charts ----------
function LineChart({ data }) {
  if (!data || data.length === 0) {
    return <p style={{ color: MUTED, fontSize: 13 }}>No cash flow data yet.</p>;
  }

  const width = 500;
  const height = 150;
  const maxVal = Math.max(...data.map((d) => d.value), 1);

  const points = data
    .map((d, i) => {
      const x = (i / (data.length - 1 || 1)) * width;
      const y = height - (d.value / maxVal) * (height - 20) - 10;
      return `${x},${y}`;
    })
    .join(" ");

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: "100%", height: "100%", minHeight: 150 }}
    >
      <polygon fill="var(--green)" points={areaPoints} opacity="0.1" />
      <polyline
        fill="none"
        stroke="var(--green)"
        strokeWidth="2"
        points={points}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {data.map((d, i) => {
        const x = (i / (data.length - 1 || 1)) * width;
        const y = height - (d.value / maxVal) * (height - 20) - 10;
        return <circle key={i} cx={x} cy={y} r="3" fill="var(--green)" />;
      })}
    </svg>
  );
}

function BarChart({ data }) {
  if (!data || data.length === 0) {
    return <p style={{ color: MUTED, fontSize: 13 }}>No revenue/expense data yet.</p>;
  }

  const width = 500;
  const height = 150;
  const maxVal = Math.max(...data.flatMap((d) => [d.revenue, d.expense]), 1);
  const barWidth = width / data.length / 3;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: "100%", height: "100%", minHeight: 150 }}
    >
      {data.map((d, i) => {
        const groupX = (i / data.length) * width + width / data.length / 4;
        const revHeight = (d.revenue / maxVal) * (height - 20);
        const expHeight = (d.expense / maxVal) * (height - 20);

        return (
          <g key={i}>
            <rect
              x={groupX}
              y={height - revHeight - 10}
              width={barWidth}
              height={revHeight}
              fill="var(--green)"
              opacity="0.8"
              rx="2"
            />
            <rect
              x={groupX + barWidth + 2}
              y={height - expHeight - 10}
              width={barWidth}
              height={expHeight}
              fill="var(--alert)"
              opacity="0.8"
              rx="2"
            />
            <text
              x={groupX + barWidth}
              y={height - 2}
              fill="var(--muted)"
              fontSize="8"
              textAnchor="middle"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function DonutChart({ data }) {
  if (!data || data.length === 0) {
    return <p style={{ color: MUTED, fontSize: 13 }}>No active projects.</p>;
  }

  const total = data.reduce((s, d) => s + d.value, 0);
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const colors = ["var(--green)", "var(--gold)", "var(--alert)", "var(--ink)", "var(--muted)"];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <svg width="120" height="120" viewBox="0 0 150 150">
        <circle
          cx="75"
          cy="75"
          r={radius}
          fill="none"
          stroke="var(--paper)"
          strokeWidth="20"
        />
        {data.map((d, i) => {
          const pct = d.value / total;
          const dash = pct * circumference;
          const stroke = colors[i % colors.length];
          const circle = (
            <circle
              key={i}
              cx="75"
              cy="75"
              r={radius}
              fill="none"
              stroke={stroke}
              strokeWidth="20"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 75 75)"
            />
          );
          offset += dash;
          return circle;
        })}
        <text
          x="75"
          y="80"
          textAnchor="middle"
          fill="var(--ink)"
          fontSize="12"
          fontWeight="700"
        >
          {data.length} Projects
        </text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {data.map((d, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              color: MUTED,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                background: colors[i % colors.length],
                borderRadius: 2,
              }}
            ></span>
            {d.name}{" "}
            <span style={{ color: INK, fontWeight: 600 }}>
              ({((d.value / total) * 100).toFixed(0)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardPanel({ data, setTab }) {
  const metrics = useMemo(() => getDashboardMetrics(data), [data]);
  const stats = useMemo(() => projectStats(data), [data]); 
  const recentEntries = data.journal.slice(0, 5);
  const alerts = getComplianceNotifications();
  
  // Get prioritized projects (current/active projects FIRST!)
  const prioritizedProjects = useMemo(() => getPrioritizedProjects(data, stats), [data, stats]);
  
  const today = new Date().toISOString().slice(0, 10);
  const outstandingInvoices = data.invoices
    .map(inv => {
      const paid = inv.payments.reduce((s, p) => s + p.amountGHS, 0);
      const balance = inv.totals.grandTotalGHS - paid;
      const isOverdue = balance > 0.01 && inv.dueDate < today;
      return { ...inv, balance, isOverdue };
    })
    .filter(inv => inv.balance > 0.01)
    .sort((a,b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);

  // Use prioritized projects (active/current first, up to 3)
  const activeProjects = prioritizedProjects.slice(0, 3);

  return (
    <div>
      <SectionTitle sub="A comprehensive snapshot of your firm's financial and operational health.">
        Dashboard
      </SectionTitle>

      {/* Compliance Notifications */}
      {alerts.length > 0 && (
        <div style={{ marginBottom: 24, display: "flex", flexDirection: "column", gap: 8 }}>
          {alerts.map((alert, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: PAPER_RAISED, border: `1px solid ${alert.color}`, borderLeft: `5px solid ${alert.color}`, padding: "12px 16px", borderRadius: 6, boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
              <AlertTriangle size={16} style={{ color: alert.color }} />
              <span style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: INK, fontWeight: 500 }}>{alert.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* 1. Core Financial KPIs */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <KpiCard title="Cash Balance" value={metrics.cash} icon={Banknote} accent={GREEN} sub={`Net Income: GHS ${fmt(metrics.netIncome)}`} />
        <KpiCard title="Receivables" value={metrics.ar} icon={ArrowDownRight} accent={GOLD} sub="Owed by clients" />
        <KpiCard title="Payables" value={metrics.ap} icon={ArrowUpRight} accent={ALERT} sub="Owed to vendors" />
      </div>

      {/* 2. Operational Drivers (The Real Engine) */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <KpiCard title="Active Contracts" value={metrics.totalContractValue} icon={Briefcase} accent={GREEN} sub={`${prioritizedProjects.length} ongoing projects`} />
        <KpiCard title="Est. Cost (Portfolio)" value={metrics.totalEstimatedCost} icon={Briefcase} accent={INK} sub="Total budgeted" />
        <KpiCard title="Actual Cost to Date" value={metrics.totalActualCost} icon={TrendingUp} accent={GOLD} sub={`${metrics.totalEstimatedCost > 0 ? ((metrics.totalActualCost / metrics.totalEstimatedCost) * 100).toFixed(0) : 0}% of budget used`} />
        <KpiCard 
          title="Projected Margin" 
          value={metrics.projectedGrossMargin} 
          icon={Scale} 
          accent={metrics.projectedGrossMargin >= 0 ? GREEN : ALERT} 
          sub={`${metrics.projectedMarginPct.toFixed(1)}% gross margin`} 
        />
      </div>

      {/* 3. Charts Row */}
      <div className="grid-fin" style={{ marginBottom: 24 }}>
        <Card style={{ flex: "1 1 400px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 16, color: INK, margin: 0 }}>Cash Flow Trend</h3>
            <span style={{ fontSize: 11, color: MUTED }}>Last 6 Movements</span>
          </div>
          <LineChart data={metrics.cashFlowData} />
        </Card>
        
        <Card style={{ flex: "1 1 400px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 16, color: INK, margin: 0 }}>Revenue vs Expenses</h3>
            <div style={{ display: "flex", gap: 12, fontSize: 11, color: MUTED }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, background: GREEN, borderRadius: 2 }}></span>Rev</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, background: ALERT, borderRadius: 2 }}></span>Exp</span>
            </div>
          </div>
          <BarChart data={metrics.barChartData} />
        </Card>
      </div>

      {/* 4. Bottom Grid: Portfolio, Invoices, Projects */}
      <div className="grid-fin" style={{ marginBottom: 24 }}>
        <Card style={{ flex: "1 1 300px" }}>
          <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 16, color: INK, margin: "0 0 16px 0" }}>Contract Value Distribution</h3>
          <DonutChart data={metrics.donutData} />
        </Card>

        <div style={{ flex: "1 1 300px" }}>
          <SectionTitle sub="Sorted by due date.">Outstanding Invoices</SectionTitle>
          <Card>
            {outstandingInvoices.length === 0 ? (
              <p style={{ color: MUTED, fontSize: 13.5 }}>No outstanding invoices. All paid up!</p>
            ) : (
              <TableScroll>
                <table className="table-card" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <Th>Inv #</Th>
                      <Th>Client</Th>
                      <Th right>Balance</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {outstandingInvoices.map(inv => (
                      <tr key={inv.id} className="row-hover" style={{ cursor: "pointer" }} onClick={() => setTab("invoicing")}>
                        <Td mono label="Inv #">{inv.invoiceNumber}</Td>
                        <Td label="Client">{inv.billTo}</Td>
                        <Td right mono bold label="Balance" style={{ color: ALERT }}>GHS {fmt(inv.balance)}</Td>
                        <Td label="Status">
                          {inv.isOverdue ? (
                            <span style={{ color: ALERT, fontWeight: 700, fontSize: 11, background: "var(--alert-bg)", padding: "2px 6px", borderRadius: 4 }}>OVERDUE</span>
                          ) : (
                            <span style={{ color: MUTED, fontSize: 11 }}>Due {inv.dueDate}</span>
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            )}
          </Card>
        </div>
      </div>
      
      {/* 5. Active Projects Health & Recent Activity - SORTED BY ACTIVITY */}
      <div className="grid-fin">
        <div style={{ gridColumn: "1 / -1" }}>
          <SectionTitle sub="Current working projects shown first.">
            Active Projects Health
          </SectionTitle>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {activeProjects.map(p => {
              const costPct = p.estimatedCost > 0 ? (p.actualCost / p.estimatedCost) * 100 : 0;
              const marginPct = p.contractValue > 0 ? (p.wipMargin / p.contractValue) * 100 : 0;
              const isActiveProject = p.isCurrentFocus;
              return (
                <Card key={p.id} style={{ 
                  flex: "1 1 280px",
                  borderLeft: isActiveProject ? `4px solid ${GREEN}` : undefined,
                  boxShadow: isActiveProject ? "0 2px 12px rgba(16,185,129,0.15)" : undefined
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: "center" }}>
                    <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: INK }}>{p.name}</div>
                    {isActiveProject ? (
                      <span style={{ 
                        display: "flex", alignItems: "center", gap: 4,
                        fontSize: 10, fontWeight: 600, color: GREEN, 
                        background: "rgba(16,185,129,0.1)", padding: "3px 8px", borderRadius: 12 
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: GREEN }}></span>
                        CURRENT
                      </span>
                    ) : (
                      <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: p.wipMargin >= 0 ? GREEN : ALERT }}>
                        Margin: {marginPct.toFixed(0)}%
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: MUTED, marginBottom: 8 }}>
                    Contract: GHS {fmt(p.contractValue)} | Est. Cost: GHS {fmt(p.estimatedCost)}
                  </div>
                  <div style={{ background: "var(--paper)", borderRadius: 4, height: 8, overflow: "hidden", border: `1px solid ${RULE}` }}>
                    <div style={{ 
                      width: `${Math.min(costPct, 100)}%`, height: "100%", 
                      background: costPct > 90 ? ALERT : costPct > 75 ? GOLD : GREEN, 
                      transition: "width 0.3s ease" 
                    }}></div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: MUTED, marginTop: 4 }}>
                    <span>Cost Incurred: GHS {fmt(p.actualCost)}</span>
                    <span>{costPct.toFixed(0)}% of Est.</span>
                  </div>
                </Card>
              );
            })}
            {activeProjects.length === 0 && (
              <Card style={{ flex: "1 1 280px" }}>
                <p style={{ color: MUTED, fontSize: 13.5 }}>No active projects to display.</p>
              </Card>
            )}
          </div>
        </div>

        <div style={{ gridColumn: "1 / -1", marginTop: 24 }}>
          <SectionTitle sub="Latest transactions posted.">Recent Activity</SectionTitle>
          <Card>
            {recentEntries.length === 0 ? (
              <p style={{ color: MUTED, fontSize: 13.5 }}>No journal entries posted yet.</p>
            ) : (
              <TableScroll>
                <table className="table-card" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <Th>Date</Th>
                      <Th>Description</Th>
                      <Th right>Amount</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentEntries.map(e => (
                      <tr key={e.id} className="row-hover" style={{ cursor: "pointer" }} onClick={() => setTab("journal")}>
                        <Td label="Date">{e.date}</Td>
                        <Td label="Description">{e.description || "—"}</Td>
                        <Td right mono label="Amount">GHS {fmt(e.lines.reduce((s, l) => s + l.debit, 0))}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
// ---------- Panels ----------
function AccountsPanel({ data, mutate }) {
  const [form, setForm] = useState({
    code: "",
    name: "",
    type: "Asset",
    normal: "Debit",
  });
  const usedCodes = new Set(data.accounts.map((a) => a.code));

  function addAccount() {
    const err = assertAccount(form, usedCodes);
    if (err) {
      alert(err);
      return;
    }
    const newAccount = { ...form, code: form.code.trim() };
    mutate((d) => ({
      ...d,
      accounts: [...d.accounts, newAccount],
    }));
    db.saveAccounts([newAccount]).catch((err) => {
      console.error("Failed to save account:", err);
      alert("Failed to persist account to server. Check console for details.");
    });
    setForm({ code: "", name: "", type: "Asset", normal: "Debit" });
  }

  function removeAccount(code) {
    const inUse = data.journal.some((e) =>
      e.lines.some((l) => l.account === code)
    );
    if (inUse) {
      alert("This account has posted entries and can't be removed.");
      return;
    }
    mutate((d) => ({
      ...d,
      accounts: d.accounts.filter((a) => a.code !== code),
    }));
    db.deleteAccount(code).catch((err) => {
      console.error("Failed to delete account:", err);
      alert("Failed to delete account on server. Check console for details.");
    });
  }

  return (
    <div>
      <SectionTitle sub="Every entry you post routes through one of these accounts.">
        Chart of Accounts
      </SectionTitle>
      <Card style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "end",
          }}
        >
          <div style={{ flex: "1 1 100px" }}>
            <label style={labelStyle}>Code</label>
            <input
              style={inputStyle}
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="6600"
            />
          </div>
          <div style={{ flex: "2 1 200px" }}>
            <label style={labelStyle}>Name</label>
            <input
              style={inputStyle}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Marketing Expense"
            />
          </div>
          <div style={{ flex: "1 1 120px" }}>
            <label style={labelStyle}>Type</label>
            <select
              style={inputStyle}
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              {["Asset", "Liability", "Equity", "Income", "Expense"].map(
                (t) => (
                  <option key={t}>{t}</option>
                )
              )}
            </select>
          </div>
          <div style={{ flex: "1 1 120px" }}>
            <label style={labelStyle}>Normal Balance</label>
            <select
              style={inputStyle}
              value={form.normal}
              onChange={(e) => setForm({ ...form, normal: e.target.value })}
            >
              <option>Debit</option>
              <option>Credit</option>
            </select>
          </div>
          <Button onClick={addAccount} icon={Plus}>
            Add
          </Button>
        </div>
      </Card>
      <Card>
        <TableScroll>
          <table
            className="table-card"
            style={{ width: "100%", borderCollapse: "collapse" }}
          >
            <thead>
              <tr>
                <Th>Code</Th>
                <Th>Name</Th>
                <Th>Type</Th>
                <Th>Normal Balance</Th>
                <Th right>&nbsp;</Th>
              </tr>
            </thead>
            <tbody>
              {data.accounts.map((a) => (
                <tr key={a.code} className="row-hover">
                  <Td mono label="Code">
                    {a.code}
                  </Td>
                  <Td label="Name">{a.name}</Td>
                  <Td label="Type">{a.type}</Td>
                  <Td label="Normal Balance">{a.normal}</Td>
                  <Td right label="Action">
                    <button
                      onClick={() => removeAccount(a.code)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: MUTED,
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </Card>
    </div>
  );
}

function projectStats(data) {
  const list = [GENERAL_PROJECT, ...data.projects];
  return list.map((p) => {
    let actualCost = 0;
    let revenueBilled = 0;

    data.journal.forEach((e) => {
      if ((e.project || "GEN") !== p.id) return;
      e.lines.forEach((l) => {
        const acc = data.accounts.find((a) => a.code === l.account);
        if (acc && acc.type === "Expense") actualCost += l.debit - l.credit;
      });
    });

    data.invoices.forEach((inv) => {
      if ((inv.project || "GEN") !== p.id) return;
      if (inv.status === "Void") return;
      revenueBilled += inv.totals.grandTotalGHS;
    });

    const contractValue = parseFloat(p.contractValue) || 0;
    const estimatedCost = parseFloat(p.estimatedCost) || 0;
    const remainingCost = Math.max(0, estimatedCost - actualCost);
    const projectedMargin = contractValue - estimatedCost;
    const wipMargin = revenueBilled - actualCost;

    return {
      ...p,
      actualCost,
      revenueBilled,
      contractValue,
      estimatedCost,
      remainingCost,
      projectedMargin,
      wipMargin,
    };
  });
}

function ProjectsPanel({ data, mutate }) {
  const [showModal, setShowModal] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [form, setForm] = useState({
    name: "",
    status: "Active",
    projectType: "Construction Contract",
    recognitionMethod: "POC",
    contractValue: "",
    estimatedCost: "",
  });
  const stats = useMemo(() => projectStats(data), [data]);

  function resetForm() {
    setForm({
      name: "",
      status: "Active",
      projectType: "Construction Contract",
      recognitionMethod: "POC",
      contractValue: "",
      estimatedCost: "",
    });
  }

  function openNewProjectModal() {
    setEditingProjectId(null);
    resetForm();
    setShowModal(true);
  }

  function openEditProjectModal(project) {
    setEditingProjectId(project.id);
    setForm({
      name: project.name,
      status: project.status,
      projectType: project.projectType,
      recognitionMethod: project.recognitionMethod,
      contractValue: project.contractValue?.toString() || "",
      estimatedCost: project.estimatedCost?.toString() || "",
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingProjectId(null);
    resetForm();
  }

  function saveProject() {
    const err = assertProject({
      name: form.name,
      contractValue: parseFloat(form.contractValue) || 0,
      estimatedCost: parseFloat(form.estimatedCost) || 0,
    });
    if (err) {
      alert(err);
      return;
    }
    const baseProject = {
      id: editingProjectId ||
        "PRJ-" +
          form.name
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, "-"),
      name: form.name.trim(),
      status: form.status,
      projectType: form.projectType,
      recognitionMethod: form.recognitionMethod,
      contractValue: parseFloat(form.contractValue) || 0,
      estimatedCost: parseFloat(form.estimatedCost) || 0,
    };

    if (editingProjectId) {
      mutate((d) => ({
        ...d,
        projects: d.projects.map((p) =>
          p.id === editingProjectId ? baseProject : p
        ),
      }));
      db.saveProjects([baseProject]).catch((err) => {
        console.error("Failed to save project:", err);
        alert("Failed to persist project to server. Check console for details.");
      });
    } else {
      mutate((d) => ({
        ...d,
        projects: [...d.projects, baseProject],
      }));
      db.saveProjects([baseProject]).catch((err) => {
        console.error("Failed to save project:", err);
        alert("Failed to persist project to server. Check console for details.");
      });
    }

    closeModal();
  }

  function deleteProject(id) {
    mutate((d) => ({
      ...d,
      projects: d.projects.filter((p) => p.id !== id),
    }));
    db.deleteProject(id).catch((err) => {
      console.error("Failed to delete project:", err);
      alert("Failed to delete project on server. Check console for details.");
    });
  }

  function toggleStatus(id) {
    mutate((d) => {
      const updatedProjects = d.projects.map((p) =>
        p.id === id
          ? { ...p, status: p.status === "Active" ? "Complete" : "Active" }
          : p
      );
      const updatedProj = updatedProjects.find((p) => p.id === id);
      if (updatedProj) db.saveProjects([updatedProj]).catch((err) => {
        console.error("Failed to save project:", err);
        alert("Failed to persist project to server. Check console for details.");
      });
      return { ...d, projects: updatedProjects };
    });
  }

  return (
    <div>
      <SectionTitle
        sub="One engagement = One project. Track permits, designs, and construction under one unified register."
        action={
          <Button onClick={openNewProjectModal} icon={Plus}>
            New project
          </Button>
        }
      >
        Projects
      </SectionTitle>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {stats.map((p) => (
          <Card key={p.id} style={{ flex: "1 1 320px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 12,
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: FONT_DISPLAY,
                    fontWeight: 700,
                    fontSize: 16,
                    color: INK,
                  }}
                >
                  {p.name}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: MUTED,
                    marginTop: 4,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {p.projectType} •{" "}
                  {p.recognitionMethod === "POC"
                    ? "Percentage of Completion"
                    : "Point-in-Time"}
                </div>
              </div>
              {p.id !== "GEN" && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button
                    onClick={() => openEditProjectModal(p)}
                    style={{
                      ...inputStyle,
                      width: "auto",
                      padding: "3px 8px",
                      cursor: "pointer",
                      fontSize: 11,
                      color: INK,
                      border: `1px solid ${RULE}`,
                      background: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <PenLine size={12} /> Edit
                  </button>
                  <button
                    onClick={() => deleteProject(p.id)}
                    style={{
                      ...inputStyle,
                      width: "auto",
                      padding: "3px 8px",
                      cursor: "pointer",
                      fontSize: 11,
                      color: ALERT,
                      border: `1px solid ${ALERT}`,
                      background: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                  <button
                    onClick={() => toggleStatus(p.id)}
                    style={{
                      ...inputStyle,
                      width: "auto",
                      padding: "3px 8px",
                      cursor: "pointer",
                      fontSize: 11,
                      color: p.status === "Active" ? GREEN : MUTED,
                      border: `1px solid ${p.status === "Active" ? GREEN : RULE}`,
                      background: "none",
                    }}
                  >
                    {p.status}
                  </button>
                </div>
              )}
            </div>

            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: 13,
                color: INK,
                lineHeight: 1.9,
                borderTop: `1px solid ${RULE}`,
                paddingTop: 12,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: MUTED, fontFamily: FONT_BODY }}>
                  Contract Value
                </span>
                <span>GHS {fmt(p.contractValue)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: MUTED, fontFamily: FONT_BODY }}>
                  Revenue Billed
                </span>
                <span>GHS {fmt(p.revenueBilled)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: MUTED, fontFamily: FONT_BODY }}>
                  Actual Cost to Date
                </span>
                <span>GHS {fmt(p.actualCost)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: MUTED, fontFamily: FONT_BODY }}>
                  Estimated Cost
                </span>
                <span>GHS {fmt(p.estimatedCost)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: MUTED, fontFamily: FONT_BODY }}>
                  Remaining Cost
                </span>
                <span>GHS {fmt(p.remainingCost)}</span>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  borderTop: `1px solid ${RULE}`,
                  paddingTop: 4,
                  marginTop: 4,
                  fontWeight: 700,
                }}
              >
                <span style={{ color: MUTED, fontFamily: FONT_BODY }}>
                  Projected Margin
                </span>
                <span style={{ color: p.projectedMargin >= 0 ? GREEN : ALERT }}>
                  GHS {fmt(p.projectedMargin)}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontWeight: 700,
                }}
              >
                <span style={{ color: MUTED, fontFamily: FONT_BODY }}>
                  WIP Margin (Billed - Cost)
                </span>
                <span style={{ color: p.wipMargin >= 0 ? GREEN : ALERT }}>
                  GHS {fmt(p.wipMargin)}
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {showModal && (
        <Modal
          title={editingProjectId ? "Edit Project Engagement" : "New Project Engagement"}
          sub="All services (permits, designs, construction) go here."
          onClose={closeModal}
        >
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <div style={{ flex: "1 1 200px" }}>
                <label style={labelStyle}>Project Name</label>
                <input
                  style={inputStyle}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. East Legon Villa"
                />
              </div>
              <div style={{ flex: "1 1 150px" }}>
                <label style={labelStyle}>Project Type</label>
                <select
                  style={inputStyle}
                  value={form.projectType}
                  onChange={(e) =>
                    setForm({ ...form, projectType: e.target.value })
                  }
                >
                  <option>Permit Processing</option>
                  <option>Architectural Drawing</option>
                  <option>Architectural Design</option>
                  <option>Consultancy Project</option>
                  <option>Construction Contract</option>
                </select>
              </div>
              <div style={{ flex: "1 1 150px" }}>
                <label style={labelStyle}>Recognition Method</label>
                <select
                  style={inputStyle}
                  value={form.recognitionMethod}
                  onChange={(e) =>
                    setForm({ ...form, recognitionMethod: e.target.value })
                  }
                >
                  <option value="POINT_IN_TIME">Point-in-Time</option>
                  <option value="POC">Percentage of Completion</option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <div style={{ flex: "1 1 150px" }}>
                <label style={labelStyle}>Contract Value (GHS)</label>
                <input
                  style={inputStyle}
                  type="number"
                  value={form.contractValue}
                  onChange={(e) =>
                    setForm({ ...form, contractValue: e.target.value })
                  }
                  placeholder="50000"
                />
              </div>
              <div style={{ flex: "1 1 150px" }}>
                <label style={labelStyle}>Estimated Cost (GHS)</label>
                <input
                  style={inputStyle}
                  type="number"
                  value={form.estimatedCost}
                  onChange={(e) =>
                    setForm({ ...form, estimatedCost: e.target.value })
                  }
                  placeholder="35000"
                />
              </div>
            </div>

            <Button onClick={saveProject} icon={Plus} fullWidth>
              {editingProjectId ? "Save project" : "Add project"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

type ProjectSelectProps = {
  value: string;
  onChange: (value: string) => void;
  projects: Array<{ id: string; name: string }>;
  style?: CSSProperties;
};

function ProjectSelect({ value, onChange, projects, style }: ProjectSelectProps) {
  return (
    <select
      style={style || inputStyle}
      value={value || "GEN"}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="GEN">{GENERAL_PROJECT.name}</option>
      {projects.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

function JournalEntryForm({ data, mutate, onDone }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [project, setProject] = useState("GEN");
  const [lines, setLines] = useState([
    { account: "", debit: "", credit: "" },
    { account: "", debit: "", credit: "" },
  ]);

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce(
    (s, l) => s + (parseFloat(l.credit) || 0),
    0
  );
  const diff = Math.round((totalDebit - totalCredit) * 100) / 100;
  const balanced = diff === 0 && totalDebit > 0;

  function updateLine(i, field, value) {
    setLines((ls) =>
      ls.map((l, idx) => (idx === i ? { ...l, [field]: value } : l))
    );
  }
  function addLine() {
    setLines((ls) => [...ls, { account: "", debit: "", credit: "" }]);
  }
  function removeLine(i) {
    setLines((ls) => ls.filter((_, idx) => idx !== i));
  }

  async function post() {
    const err = assertJournalEntry({ date, description, lines });
    if (err) {
      alert(err);
      return;
    }
    const validLines = lines.filter(
      (l) => l.account && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0)
    );
    if (!balanced || validLines.length < 2) return;
    const entryNumber = `JE-${String(data.nextEntryNum).padStart(4, "0")}`;
    const period = date.slice(0, 7);
    const entry = {
      id: entryNumber,
      entryNumber,
      date,
      description,
      period,
      project,
      lines: validLines.map((l) => ({
        account: l.account,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
      })),
    };
    mutate((d) => ({
      ...d,
      journal: [entry, ...d.journal],
      nextEntryNum: d.nextEntryNum + 1,
    }));
    try {
      await db.saveJournalEntry(entry);
    } catch (err) {
      console.error("Failed to save journal entry:", err);
      alert("Failed to save journal entry to server. Check console for details.");
    }
    onDone && onDone();
  }

  return (
    <div>
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 14 }}
      >
        <div style={{ flex: "1 1 120px" }}>
          <label style={labelStyle}>Date</label>
          <input
            type="date"
            style={inputStyle}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div style={{ flex: "3 1 250px" }}>
          <label style={labelStyle}>Description</label>
          <input
            style={inputStyle}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Paid office rent for July"
          />
        </div>
        <div style={{ flex: "1 1 150px" }}>
          <label style={labelStyle}>Project</label>
          <ProjectSelect
            value={project}
            onChange={setProject}
            projects={data.projects}
          />
        </div>
      </div>

      <TableScroll>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginBottom: 10,
          }}
        >
          <thead>
            <tr>
              <Th>Account</Th>
              <Th right>Debit</Th>
              <Th right>Credit</Th>
              <Th right>&nbsp;</Th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <Td>
                  <select
                    style={inputStyle}
                    value={l.account}
                    onChange={(e) => updateLine(i, "account", e.target.value)}
                  >
                    <option value="">Select account…</option>
                    {data.accounts.map((a) => (
                      <option key={a.code} value={a.code}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                  </select>
                </Td>
                <Td right>
                  <input
                    style={{
                      ...inputStyle,
                      textAlign: "right",
                      fontFamily: FONT_MONO,
                    }}
                    value={l.debit}
                    onChange={(e) =>
                      updateLine(
                        i,
                        "debit",
                        e.target.value.replace(/[^0-9.]/g, "")
                      )
                    }
                    placeholder="0.00"
                  />
                </Td>
                <Td right>
                  <input
                    style={{
                      ...inputStyle,
                      textAlign: "right",
                      fontFamily: FONT_MONO,
                    }}
                    value={l.credit}
                    onChange={(e) =>
                      updateLine(
                        i,
                        "credit",
                        e.target.value.replace(/[^0-9.]/g, "")
                      )
                    }
                    placeholder="0.00"
                  />
                </Td>
                <Td right>
                  <button
                    onClick={() => removeLine(i)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: MUTED,
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
      <Button variant="ghost" onClick={addLine} icon={Plus}>
        Add line
      </Button>

      <div
        style={{
          marginTop: 18,
          padding: "12px 16px",
          borderRadius: 6,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
          background: balanced
            ? "var(--success-bg)"
            : diff === 0
            ? PAPER
            : "var(--alert-bg)",
          border: `1px solid ${balanced ? GREEN : diff === 0 ? RULE : ALERT}`,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 24,
            fontFamily: FONT_MONO,
            fontSize: 13.5,
            color: INK,
            flexWrap: "wrap",
          }}
        >
          <span>Debits: GHS {fmt(totalDebit)}</span>
          <span>Credits: GHS {fmt(totalCredit)}</span>
          <span
            style={{
              fontWeight: 700,
              color: balanced ? GREEN : diff !== 0 ? ALERT : MUTED,
            }}
          >
            Difference: GHS {fmt(Math.abs(diff))}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: FONT_BODY,
            fontSize: 13,
            fontWeight: 600,
            color: balanced ? GREEN_DEEP : ALERT,
          }}
        >
          {balanced ? <Check size={16} /> : <AlertTriangle size={16} />}
          {balanced ? "Balanced — ready to post" : "Not balanced yet"}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <Button onClick={post} disabled={!balanced}>
          Post entry
        </Button>
      </div>
    </div>
  );
}

function JournalPanel({ data, mutate }) {
  const [showModal, setShowModal] = useState(false);
  const [viewingEntry, setViewingEntry] = useState(null);

  return (
    <div>
      <SectionTitle
        sub="Debits and credits must match before an entry can post."
        action={
          <Button onClick={() => setShowModal(true)} icon={Plus}>
            New journal entry
          </Button>
        }
      >
        Journal
      </SectionTitle>

      <SectionTitle>Recent entries</SectionTitle>
      <Card>
        <TableScroll>
          <table
            className="table-card"
            style={{ width: "100%", borderCollapse: "collapse" }}
          >
            <thead>
              <tr>
                <Th>Entry</Th>
                <Th>Date</Th>
                <Th>Description</Th>
                <Th>Project</Th>
                <Th right>Amount</Th>
              </tr>
            </thead>
            <tbody>
              {data.journal.slice(0, 20).map((e) => (
                <tr
                  key={e.id}
                  className="row-hover"
                  style={{ cursor: "pointer" }}
                  onClick={() => setViewingEntry(e)}
                >
                  <Td mono label="Entry">
                    {e.entryNumber}
                  </Td>
                  <Td label="Date">{e.date}</Td>
                  <Td label="Description">
                    {e.description || <span style={{ color: MUTED }}>—</span>}
                  </Td>
                  <Td label="Project">
                    {projectName(data.projects, e.project)}
                  </Td>
                  <Td right mono label="Amount">
                    GHS {fmt(e.lines.reduce((s, l) => s + l.debit, 0))}
                  </Td>
                </tr>
              ))}
              {data.journal.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ color: MUTED, padding: 10 }}>
                    No entries posted yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableScroll>
      </Card>

      {showModal && (
        <Modal
          title="New journal entry"
          sub="Debits and credits must match before it can post."
          onClose={() => setShowModal(false)}
          wide
        >
          <JournalEntryForm
            data={data}
            mutate={mutate}
            onDone={() => setShowModal(false)}
          />
        </Modal>
      )}

      {viewingEntry && (
        <Modal
          title={`Entry Details: ${viewingEntry.entryNumber}`}
          sub={`${viewingEntry.date} — ${
            viewingEntry.description || "No description"
          }`}
          onClose={() => setViewingEntry(null)}
          wide
        >
          <div style={{ marginBottom: 16 }}>
            <strong>Project:</strong>{" "}
            {projectName(data.projects, viewingEntry.project)}
          </div>
          <TableScroll>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <Th>Account</Th>
                  <Th right>Debit (GHS)</Th>
                  <Th right>Credit (GHS)</Th>
                </tr>
              </thead>
              <tbody>
                {viewingEntry.lines.map((l, i) => {
                  const acc = data.accounts.find((a) => a.code === l.account);
                  return (
                    <tr key={i} className="row-hover">
                      <Td>{acc ? `${acc.code} — ${acc.name}` : l.account}</Td>
                      <Td right mono>
                        {l.debit > 0 ? fmt(l.debit) : ""}
                      </Td>
                      <Td right mono>
                        {l.credit > 0 ? fmt(l.credit) : ""}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableScroll>
        </Modal>
      )}
    </div>
  );
}

function LedgerPanel({ data }) {
  const rows = useMemo(() => {
    return data.accounts.map((a) => {
      let debit = 0,
        credit = 0;
      data.journal.forEach((e) =>
        e.lines.forEach((l) => {
          if (l.account === a.code) {
            debit += l.debit;
            credit += l.credit;
          }
        })
      );
      const balance = a.normal === "Debit" ? debit - credit : credit - debit;
      return { ...a, debit, credit, balance };
    });
  }, [data]);

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <div>
      <SectionTitle sub="Live totals from every posted journal entry.">
        Trial Balance
      </SectionTitle>
      <Card>
        <TableScroll>
          <table
            className="table-card"
            style={{ width: "100%", borderCollapse: "collapse" }}
          >
            <thead>
              <tr>
                <Th>Code</Th>
                <Th>Account</Th>
                <Th right>Total Debit</Th>
                <Th right>Total Credit</Th>
                <Th right>Balance</Th>
              </tr>
            </thead>
            <tbody>
              {rows
                .filter((r) => r.debit || r.credit)
                .map((r) => (
                  <tr key={r.code} className="row-hover">
                    <Td mono label="Code">
                      {r.code}
                    </Td>
                    <Td label="Account">{r.name}</Td>
                    <Td right mono label="Total Debit">
                      {fmt(r.debit)}
                    </Td>
                    <Td right mono label="Total Credit">
                      {fmt(r.credit)}
                    </Td>
                    <Td right mono bold label="Balance">
                      {fmt(r.balance)}
                    </Td>
                  </tr>
                ))}
              {rows.every((r) => !r.debit && !r.credit) && (
                <tr>
                  <td colSpan={5} style={{ color: MUTED, padding: 10 }}>
                    No activity yet.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <Td bold label="Total">
                  Total
                </Td>
                <Td label="Account"></Td>
                <Td right mono bold label="Total Debit">
                  {fmt(totalDebit)}
                </Td>
                <Td right mono bold label="Total Credit">
                  {fmt(totalCredit)}
                </Td>
                <Td
                  right
                  mono
                  bold
                  label="Balance"
                  style={{ color: isBalanced ? GREEN : ALERT }}
                >
                  {isBalanced ? "Balanced ✓" : "Out of balance"}
                </Td>
              </tr>
            </tfoot>
          </table>
        </TableScroll>
      </Card>
    </div>
  );
}

// NOTE: Financial calculations are now provided by database views/RPC.
// Local computePL and computeBalanceSheet were removed in Stage 1 and
// FinancialsPanel is wired to fetch the pre-calculated results.

function computeCashFlow(data) {
  const rows = [];
  let running = 0;
  const sorted = [...data.journal].sort((a, b) => (a.date > b.date ? 1 : -1));
  sorted.forEach((e) => {
    const net = e.lines.reduce(
      (s, l) => s + (l.account === "1000" ? l.debit - l.credit : 0),
      0
    );
    if (net !== 0) {
      running += net;
      rows.push({
        date: e.date,
        description: e.description,
        entryNumber: e.entryNumber,
        net,
        running,
      });
    }
  });
  return rows;
}

function MiniTable({ rows, label }) {
  const total = rows.reduce((s, r) => s + r.amount, 0);
  return (
    <TableScroll>
      <table
        className="table-card"
        style={{ width: "100%", borderCollapse: "collapse", marginBottom: 14 }}
      >
        <thead>
          <tr>
            <Th>{label}</Th>
            <Th right>Amount (GHS)</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td style={{ color: MUTED, padding: 10 }}>No activity.</td>
              <td></td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.code} className="row-hover">
              <Td label={label}>{r.name}</Td>
              <Td right mono label="Amount (GHS)">
                {fmt(r.amount)}
              </Td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <Td bold label="Total">
              Total {label}
            </Td>
            <Td right mono bold label="Amount (GHS)">
              {fmt(total)}
            </Td>
          </tr>
        </tfoot>
      </table>
    </TableScroll>
  );
}

function FinancialsPanel({ data, setPrintContent }) {
  const [view, setView] = useState("company");

  // State for database-fetched financials
  const [tbData, setTbData] = useState([]);
  const [bsData, setBsData] = useState([]);
  const [plData, setPlData] = useState([]);
  const [loadingFin, setLoadingFin] = useState(true);

  const cf = useMemo(() => computeCashFlow(data), [data]);

  useEffect(() => {
    async function fetchFinancials() {
      setLoadingFin(true);
      try {
        const startDate = "2026-01-01";
        const endDate = "2026-12-31";

        const [tb, bs, pl] = await Promise.all([
          getTrialBalance(),
          getBalanceSheet(),
          getProfitAndLoss(startDate, endDate),
        ]);

        setTbData(tb || []);
        setBsData(bs || []);
        setPlData(pl || []);
      } catch (err) {
        console.error("Error loading financials:", err);
      } finally {
        setLoadingFin(false);
      }
    }
    fetchFinancials();
  }, [view]);

  if (loadingFin) {
    return <Card><p>Loading financial data...</p></Card>;
  }

  // Map plData to the `pl` shape used by the UI
  const revenue = (plData || []).filter(r => r.type === 'Income').map(r => ({ code: r.code, name: r.name, amount: Number(r.amount) }));
  const expensesAll = (plData || []).filter(r => r.type === 'Expense').map(r => ({ code: r.code, name: r.name, amount: Number(r.amount) }));
  const costOfSales = expensesAll.filter(e => { const c = parseInt(e.code,10); return c >= 5000 && c < 6000; });
  const adminExpenses = expensesAll.filter(e => { const c = parseInt(e.code,10); return c >= 6000 || c < 5000; });
  const totalRevenue = revenue.reduce((s,r) => s + r.amount, 0);
  const totalCostOfSales = costOfSales.reduce((s,r) => s + r.amount, 0);
  const totalAdminExpenses = adminExpenses.reduce((s,r) => s + r.amount, 0);
  const grossProfit = totalRevenue - totalCostOfSales;
  const totalOtherIncome = 0;
  const operatingProfit = grossProfit + totalOtherIncome - totalAdminExpenses;
  const netProfit = operatingProfit;

  const pl = {
    revenue,
    costOfSales,
    otherIncome: [],
    adminExpenses,
    totalRevenue,
    totalCostOfSales,
    grossProfit,
    totalOtherIncome,
    totalAdminExpenses,
    operatingProfit,
    netProfit,
  };

  // Map bsData to the `bs` shape used by the UI
  const assets = (bsData || []).filter(r => r.type === 'Asset' || r.type === 'Contra-Asset').map(r => ({ code: r.code, name: r.name, amount: Number(r.amount) }));
  const currentAssets = assets.filter(a => ['1000','1100','1200','1300','1400'].includes(a.code));
  const nonCurrentAssets = assets.filter(a => !['1000','1100','1200','1300','1400'].includes(a.code));
  const liabilities = (bsData || []).filter(r => r.type === 'Liability').map(r => ({ code: r.code, name: r.name, amount: Number(r.amount) }));
  const equity = (bsData || []).filter(r => r.type === 'Equity').map(r => ({ code: r.code, name: r.name, amount: Number(r.amount) }));

  const totalNonCurrentAssets = nonCurrentAssets.reduce((s,r)=>s+r.amount,0);
  const totalCurrentAssets = currentAssets.reduce((s,r)=>s+r.amount,0);
  const totalAssets = totalNonCurrentAssets + totalCurrentAssets;
  const totalCurrentLiabilities = liabilities.reduce((s,r)=>s+r.amount,0);
  const totalEquity = equity.reduce((s,r)=>s+r.amount,0) + netProfit;
  const totalLiabilitiesAndEquity = totalCurrentLiabilities + totalEquity;

  const bs = {
    nonCurrentAssets,
    currentAssets,
    currentLiabilities: liabilities,
    equity,
    totalNonCurrentAssets,
    totalCurrentAssets,
    totalAssets,
    totalCurrentLiabilities,
    totalEquity,
    totalLiabilitiesAndEquity,
    netProfit,
  };

  const projectOptions = [
    { id: "company", name: "Company-wide" },
    ...data.projects,
  ];

  function exportPdf() {
    const projectName =
      projectOptions.find((p) => p.id === view)?.name || "Company";
    const safeProjectName = projectName.replace(/\s+/g, "_");
    const company = data.company || COMPANY_TEMPLATE;
    const genDate = new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    document.title = `Financials_${safeProjectName}_${new Date()
      .toISOString()
      .slice(0, 10)}`;

    const finStyles = {
      container: {
        background: "#FFFFFF",
        color: "#333333",
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        fontSize: "10pt",
        lineHeight: 1.5,
        boxSizing: "border-box",
      },
      goldBar: {
        height: "4px",
        background:
          "linear-gradient(90deg, #C9A84C 0%, #D4B86A 50%, #C9A84C 100%)",
        width: "100%",
      },
      header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "24px 32px",
        gap: 16,
      },
      headerLeft: { display: "flex", alignItems: "center", gap: 16 },
      logo: { height: 64, width: "auto", objectFit: "contain" },
      company: {
        fontSize: "18pt",
        fontWeight: 800,
        color: "#1A1A1A",
        letterSpacing: "-0.5px",
        lineHeight: 1.2,
      },
      tagline: {
        fontSize: "8.5pt",
        color: "#6B6B6B",
        textTransform: "uppercase",
        letterSpacing: "1.5px",
        marginTop: 2,
      },
      headerRight: { textAlign: "right" },
      docTitle: {
        fontSize: "24pt",
        fontWeight: 800,
        color: "#C9A84C",
        letterSpacing: "2px",
        lineHeight: 1,
      },
      docSub: {
        fontSize: "10pt",
        color: "#6B6B6B",
        marginTop: 6,
        fontFamily: FONT_MONO,
      },
      metaGrid: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 16,
        padding: "0 32px 20px",
      },
      card: {
        background: "#FAFAF8",
        border: "1px solid #E8E4DC",
        borderRadius: 6,
        padding: "16px 20px",
      },
      cardTitle: {
        fontSize: "8pt",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "1.2px",
        color: "#C9A84C",
        marginBottom: 10,
      },
      cardRow: {
        display: "flex",
        justifyContent: "space-between",
        padding: "4px 0",
        fontSize: "9.5pt",
      },
      cardLabel: { color: "#6B6B6B" },
      cardValue: { fontWeight: 600, color: "#2D2D2D", textAlign: "right" },
      sectionTitle: {
        fontSize: "9pt",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "1.5px",
        color: "#C9A84C",
        padding: "0 32px",
        margin: "22px 0 10px",
        display: "flex",
        alignItems: "center",
        gap: 10,
      },
      sectionLine: { flex: 1, height: 1, background: "#E8E4DC" },
      table: {
        width: "calc(100% - 64px)",
        margin: "0 32px",
        borderCollapse: "collapse",
        fontSize: "9.5pt",
      },
      th: {
        textAlign: "left",
        padding: "8px 12px",
        fontSize: "8pt",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.8px",
        color: "#6B6B6B",
        borderBottom: "2px solid #C9A84C",
      },
      thRight: { textAlign: "right" },
      groupLabel: {
        fontWeight: 700,
        color: "#2D2D2D",
        padding: "12px 12px 4px",
        fontSize: "8.5pt",
        textTransform: "uppercase",
        letterSpacing: "0.8px",
      },
      td: {
        padding: "5px 12px",
        borderBottom: "1px solid #F0EDE4",
        verticalAlign: "top",
      },
      tdRight: { textAlign: "right", fontFamily: FONT_MONO },
      subtotalRow: { fontWeight: 700, background: "#FAFAF8" },
      totalRow: { fontWeight: 800, background: "#F5F0E6", color: "#1A1A1A" },
      grandRow: {
        fontWeight: 800,
        background: "#1A1A1A",
        color: "#C9A84C",
        fontSize: "11pt",
      },
      footerNote: {
        padding: "16px 32px 24px",
        marginTop: 20,
        borderTop: "1px solid #E8E4DC",
        textAlign: "center",
        fontSize: "8.5pt",
        color: "#6B6B6B",
        textTransform: "uppercase",
        letterSpacing: "1px",
        lineHeight: 1.8,
      },
      signatures: {
        display: "flex",
        justifyContent: "space-between",
        padding: "32px",
        marginTop: 10,
        gap: 40,
      },
      sigBlock: { flex: 1, textAlign: "center" },
      sigLine: {
        borderTop: "1.5px solid #1A1A1A",
        paddingTop: 8,
        marginTop: 40,
        fontWeight: 700,
        fontSize: "10pt",
        color: "#1A1A1A",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
      },
      sigRole: {
        fontSize: "8.5pt",
        color: "#6B6B6B",
        marginTop: 2,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
      },
    };

    const LineRow = ({ code, name, amount, negative }) => (
      <tr key={code}>
        <td style={finStyles.td}>{name}</td>
        <td style={{ ...finStyles.td, ...finStyles.tdRight }}>
          {negative ? `(${fmt(amount)})` : fmt(amount)}
        </td>
      </tr>
    );

    const GroupLabel = ({ children }) => (
      <tr>
        <td colSpan={2} style={finStyles.groupLabel}>
          {children}
        </td>
      </tr>
    );

    const SubtotalRow = ({ label, amount, negative }) => (
      <tr style={finStyles.subtotalRow}>
        <td style={finStyles.td}>{label}</td>
        <td style={{ ...finStyles.td, ...finStyles.tdRight }}>
          {negative ? `(${fmt(amount)})` : fmt(amount)}
        </td>
      </tr>
    );

    const TotalRow = ({ label, amount, variant }) => (
      <tr
        style={variant === "grand" ? finStyles.grandRow : finStyles.totalRow}
      >
        <td
          style={{
            padding: variant === "grand" ? "12px 12px" : "8px 12px",
            fontWeight: 800,
            fontSize: variant === "grand" ? "11pt" : "9.5pt",
          }}
        >
          {label}
        </td>
        <td
          style={{
            padding: variant === "grand" ? "12px 12px" : "8px 12px",
            fontWeight: 800,
            fontSize: variant === "grand" ? "11pt" : "9.5pt",
            textAlign: "right",
            fontFamily: FONT_MONO,
          }}
        >
          {fmt(amount)}
        </td>
      </tr>
    );

    const SectionTitle = ({ children, pageBreak }) => (
      <div
        style={{
          ...finStyles.sectionTitle,
          ...(pageBreak ? { pageBreakBefore: "always", paddingTop: 24 } : {}),
        }}
      >
        <span>{children}</span>
        <span style={finStyles.sectionLine} />
      </div>
    );

    setPrintContent(
      <div style={finStyles.container}>
        <div style={finStyles.goldBar} />

        <div style={finStyles.header}>
          <div style={finStyles.headerLeft}>
            <img src={LOGO_SRC} alt="logo" style={finStyles.logo} />
            <div>
              <div style={finStyles.company}>{company.name}</div>
              <div style={finStyles.tagline}>Design · Build · Deliver</div>
            </div>
          </div>
          <div style={finStyles.headerRight}>
            <div style={finStyles.docTitle}>FINANCIALS</div>
            <div style={finStyles.docSub}>{projectName.toUpperCase()}</div>
          </div>
        </div>

        <div style={finStyles.metaGrid}>
          <div style={finStyles.card}>
            <div style={finStyles.cardTitle}>Statement Details</div>
            <div style={finStyles.cardRow}>
              <span style={finStyles.cardLabel}>Scope</span>
              <span style={finStyles.cardValue}>{projectName}</span>
            </div>
            <div style={finStyles.cardRow}>
              <span style={finStyles.cardLabel}>Reporting Currency</span>
              <span style={finStyles.cardValue}>GHS</span>
            </div>
            <div style={finStyles.cardRow}>
              <span style={finStyles.cardLabel}>Generated</span>
              <span style={finStyles.cardValue}>{genDate}</span>
            </div>
          </div>
          <div style={finStyles.card}>
            <div style={finStyles.cardTitle}>Basis of Preparation</div>
            <div style={finStyles.cardRow}>
              <span style={finStyles.cardLabel}>Framework</span>
              <span style={finStyles.cardValue}>IFRS-aligned</span>
            </div>
            <div style={finStyles.cardRow}>
              <span style={finStyles.cardLabel}>Prepared By</span>
              <span style={finStyles.cardValue}>{company.preparedByName}</span>
            </div>
            <div style={finStyles.cardRow}>
              <span style={finStyles.cardLabel}>Authorised By</span>
              <span style={finStyles.cardValue}>{company.authorisedByName}</span>
            </div>
          </div>
        </div>

        <SectionTitle>Statement of Profit or Loss</SectionTitle>
        <table style={finStyles.table}>
          <thead>
            <tr>
              <th style={finStyles.th}>Description</th>
              <th style={{ ...finStyles.th, ...finStyles.thRight }}>
                Amount (GHS)
              </th>
            </tr>
          </thead>
          <tbody>
            <GroupLabel>Revenue</GroupLabel>
            {pl.revenue.map((r) => (
              <LineRow key={r.code} code={r.code} name={r.name} amount={r.amount} />
            ))}
            <SubtotalRow label="Total Revenue" amount={pl.totalRevenue} />

            <GroupLabel>Cost of Sales</GroupLabel>
            {pl.costOfSales.map((r) => (
              <LineRow
                key={r.code}
                code={r.code}
                name={r.name}
                amount={r.amount}
                negative
              />
            ))}
            <SubtotalRow
              label="Total Cost of Sales"
              amount={pl.totalCostOfSales}
              negative
            />

            <TotalRow label="Gross Profit" amount={pl.grossProfit} />

            <GroupLabel>Other Income</GroupLabel>
            {pl.otherIncome.map((r) => (
              <LineRow key={r.code} code={r.code} name={r.name} amount={r.amount} />
            ))}

            <GroupLabel>Administrative Expenses</GroupLabel>
            {pl.adminExpenses.map((r) => (
              <LineRow
                key={r.code}
                code={r.code}
                name={r.name}
                amount={r.amount}
                negative
              />
            ))}
            <SubtotalRow
              label="Total Admin Expenses"
              amount={pl.totalAdminExpenses}
              negative
            />

            <TotalRow label="Operating Profit" amount={pl.operatingProfit} />
            <TotalRow
              label="Net Profit For The Period"
              amount={pl.netProfit}
              variant="grand"
            />
          </tbody>
        </table>

        {view === "company" && (
          <>
            <SectionTitle pageBreak>
              Statement of Financial Position
            </SectionTitle>
            <table style={finStyles.table}>
              <thead>
                <tr>
                  <th style={finStyles.th}>Description</th>
                  <th style={{ ...finStyles.th, ...finStyles.thRight }}>
                    Amount (GHS)
                  </th>
                </tr>
              </thead>
              <tbody>
                <GroupLabel>Non-Current Assets</GroupLabel>
                {bs.nonCurrentAssets.map((r) => (
                  <LineRow key={r.code} code={r.code} name={r.name} amount={r.amount} />
                ))}
                <SubtotalRow
                  label="Total Non-Current Assets"
                  amount={bs.totalNonCurrentAssets}
                />

                <GroupLabel>Current Assets</GroupLabel>
                {bs.currentAssets.map((r) => (
                  <LineRow key={r.code} code={r.code} name={r.name} amount={r.amount} />
                ))}
                <SubtotalRow
                  label="Total Current Assets"
                  amount={bs.totalCurrentAssets}
                />

                <TotalRow label="Total Assets" amount={bs.totalAssets} />

                <GroupLabel>Current Liabilities</GroupLabel>
                {bs.currentLiabilities.map((r) => (
                  <LineRow key={r.code} code={r.code} name={r.name} amount={r.amount} />
                ))}
                <SubtotalRow
                  label="Total Current Liabilities"
                  amount={bs.totalCurrentLiabilities}
                />

                <GroupLabel>Equity</GroupLabel>
                {bs.equity.map((r) => (
                  <LineRow key={r.code} code={r.code} name={r.name} amount={r.amount} />
                ))}
                <LineRow
                  code="NI"
                  name="Current Year Earnings"
                  amount={bs.netProfit}
                />
                <SubtotalRow label="Total Equity" amount={bs.totalEquity} />

                <TotalRow
                  label="Total Liabilities & Equity"
                  amount={bs.totalLiabilitiesAndEquity}
                  variant="grand"
                />
              </tbody>
            </table>

            <SectionTitle pageBreak>Statement of Cash Flows</SectionTitle>
            <table style={finStyles.table}>
              <thead>
                <tr>
                  <th style={finStyles.th}>Date</th>
                  <th style={finStyles.th}>Description</th>
                  <th style={{ ...finStyles.th, ...finStyles.thRight }}>
                    Net Movement
                  </th>
                  <th style={{ ...finStyles.th, ...finStyles.thRight }}>
                    Running Balance
                  </th>
                </tr>
              </thead>
              <tbody>
                {cf.map((r, i) => (
                  <tr key={i}>
                    <td style={finStyles.td}>{r.date}</td>
                    <td style={finStyles.td}>{r.description || "—"}</td>
                    <td
                      style={{
                        ...finStyles.td,
                        ...finStyles.tdRight,
                        color: r.net >= 0 ? "#2D5A3D" : "#A63D40",
                        fontWeight: 600,
                      }}
                    >
                      {r.net >= 0 ? "+" : ""}
                      {fmt(r.net)}
                    </td>
                    <td style={{ ...finStyles.td, ...finStyles.tdRight, fontWeight: 700 }}>
                      {fmt(r.running)}
                    </td>
                  </tr>
                ))}
                {cf.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      style={{ ...finStyles.td, color: "#6B6B6B", textAlign: "center" }}
                    >
                      No cash movements recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}

        {/* Signatures removed from financial printout per request */}

        <div style={finStyles.footerNote}>
          Prepared from the general ledger for internal management review.
          <br />
          {company.name} · {company.addressLine} · {company.cityLine} ·{" "}
          {company.poBox}
          <br />
          Phone: {company.phone} · Telephone: {company.telephone} ·{" "}
          {company.email}
        </div>
      </div>
    );
    setTimeout(() => {
      window.print();
      document.title = "Modulo Ledger";
    }, 100);
  }


  return (
    <div>
      <SectionTitle
        sub="IFRS-compliant Statement of Profit or Loss, Financial Position, and Cash Flows."
        action={
          <Button onClick={exportPdf} icon={FileText} variant="ghost">
            Export PDF
          </Button>
        }
      >
        Financials
      </SectionTitle>

      <Card style={{ marginBottom: 16 }}>
        <label style={labelStyle}>View</label>
        <select
          style={{ ...inputStyle, maxWidth: 280 }}
          value={view}
          onChange={(e) => setView(e.target.value)}
        >
          {projectOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Card>

      <SectionTitle
        sub={
          view === "company"
            ? "All revenue and expenses."
            : "Revenue billed and costs booked against this project only."
        }
      >
        Statement of Profit or Loss
      </SectionTitle>
      <Card style={{ marginBottom: 16 }}>
        <MiniTable rows={pl.revenue} label="Revenue" />
        <MiniTable rows={pl.costOfSales} label="Cost of Sales" />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: FONT_MONO,
            fontSize: 15,
            fontWeight: 700,
            paddingTop: 8,
            borderTop: `2px solid ${RULE}`,
            color: INK,
            marginBottom: 16,
          }}
        >
          <span>Gross Profit</span>
          <span>GHS {fmt(pl.grossProfit)}</span>
        </div>
        <MiniTable rows={pl.otherIncome} label="Other Income" />
        <MiniTable rows={pl.adminExpenses} label="Administrative Expenses" />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: FONT_MONO,
            fontSize: 15,
            fontWeight: 700,
            paddingTop: 8,
            borderTop: `2px solid ${RULE}`,
            color: INK,
            marginBottom: 8,
          }}
        >
          <span>Operating Profit</span>
          <span>GHS {fmt(pl.operatingProfit)}</span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: FONT_MONO,
            fontSize: 17,
            fontWeight: 700,
            paddingTop: 8,
            borderTop: `2px solid ${RULE}`,
            color: pl.netProfit >= 0 ? GREEN : ALERT,
          }}
        >
          <span>Net Profit</span>
          <span>GHS {fmt(pl.netProfit)}</span>
        </div>
      </Card>

      {view === "company" && (
        <>
          <SectionTitle sub="Assets, liabilities, and equity — company-wide (projects share one balance sheet, they aren't separate legal entities).">
            Statement of Financial Position
          </SectionTitle>
          <Card style={{ marginBottom: 16 }}>
            <MiniTable rows={bs.nonCurrentAssets} label="Non-Current Assets" />
            <MiniTable rows={bs.currentAssets} label="Current Assets" />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontFamily: FONT_MONO,
                fontSize: 15,
                fontWeight: 700,
                paddingTop: 8,
                borderTop: `2px solid ${RULE}`,
                color: INK,
                marginBottom: 16,
              }}
            >
              <span>Total Assets</span>
              <span>GHS {fmt(bs.totalAssets)}</span>
            </div>
            <MiniTable
              rows={bs.currentLiabilities}
              label="Current Liabilities"
            />
            <MiniTable
              rows={[
                ...bs.equity,
                {
                  code: "NI",
                  name: "Current Year Earnings",
                  amount: bs.netProfit,
                },
              ]}
              label="Equity"
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontFamily: FONT_MONO,
                fontSize: 15,
                fontWeight: 700,
                paddingTop: 8,
                borderTop: `2px solid ${RULE}`,
                color: INK,
                marginBottom: 8,
              }}
            >
              <span>Total Liabilities & Equity</span>
              <span>GHS {fmt(bs.totalLiabilitiesAndEquity)}</span>
            </div>
          </Card>

          <SectionTitle sub="Movements through Cash and Bank (account 1000), in date order. A simplified direct-method view.">
            Statement of Cash Flows
          </SectionTitle>
          <Card>
            <TableScroll>
              <table
                className="table-card"
                style={{ width: "100%", borderCollapse: "collapse" }}
              >
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Entry</Th>
                    <Th>Description</Th>
                    <Th right>Net Movement</Th>
                    <Th right>Running Balance</Th>
                  </tr>
                </thead>
                <tbody>
                  {cf.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ color: MUTED, padding: 10 }}>
                        No cash movements yet.
                      </td>
                    </tr>
                  )}
                  {cf.map((r, i) => (
                    <tr key={i} className="row-hover">
                      <Td label="Date">{r.date}</Td>
                      <Td mono label="Entry">
                        {r.entryNumber}
                      </Td>
                      <Td label="Description">{r.description || "—"}</Td>
                      <Td
                        right
                        mono
                        label="Net Movement"
                        style={{ color: r.net >= 0 ? GREEN : ALERT }}
                      >
                        {r.net >= 0 ? "+" : ""}
                        {fmt(r.net)}
                      </Td>
                      <Td right mono bold label="Running Balance">
                        {fmt(r.running)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </Card>
        </>
      )}
    </div>
  );
}

function EmployeesPanel({ data, mutate }) {
  const [showModal, setShowModal] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState(null);
  const [form, setForm] = useState({
    name: "",
    baseSalary: "",
    ssnitNo: "",
    niaCard: "",
    designation: "",
    exemptPaye: false,
    exemptSsnit: false,
  });

  function resetForm() {
    setForm({
      name: "",
      baseSalary: "",
      ssnitNo: "",
      niaCard: "",
      designation: "",
      exemptPaye: false,
      exemptSsnit: false,
    });
  }

  function openAddModal() {
    setEditingEmployeeId(null);
    resetForm();
    setShowModal(true);
  }

  function openEditModal(employee) {
    setEditingEmployeeId(employee.id);
    setForm({
      name: employee.name || "",
      baseSalary: String(employee.baseSalary || ""),
      ssnitNo: employee.ssnitNo || "",
      niaCard: employee.niaCard || "",
      designation: employee.designation || "",
      exemptPaye: employee.exemptPaye || false,
      exemptSsnit: employee.exemptSsnit || false,
    });
    setShowModal(true);
  }

  function saveEmployee() {
    const err = assertEmployee({
      name: form.name,
      baseSalary: parseFloat(form.baseSalary) || 0,
    });
    if (err) {
      alert(err);
      return;
    }

    const employeePayload = {
      id: editingEmployeeId || "EMP-" + Date.now(),
      name: form.name.trim(),
      baseSalary: parseFloat(form.baseSalary),
      active: editingEmployeeId
        ? data.employees.find((e) => e.id === editingEmployeeId)?.active ?? true
        : true,
      ssnitNo: form.ssnitNo.trim(),
      niaCard: form.niaCard.trim(),
      designation: form.designation.trim(),
      exemptPaye: form.exemptPaye,
      exemptSsnit: form.exemptSsnit,
    };

    const prevEmployees = data.employees;
    if (editingEmployeeId) {
      mutate((d) => ({
        ...d,
        employees: d.employees.map((e) =>
          e.id === editingEmployeeId ? employeePayload : e
        ),
      }));
      (async () => {
        try {
          await db.saveEmployees([employeePayload]);
        } catch (err) {
          console.error("Failed to save employee:", err);
          alert("Failed to persist employee to server. Changes reverted.");
          mutate((d) => ({ ...d, employees: prevEmployees }));
        }
      })();
    } else {
      mutate((d) => ({
        ...d,
        employees: [...d.employees, employeePayload],
      }));
      (async () => {
        try {
          await db.saveEmployees([employeePayload]);
        } catch (err) {
          console.error("Failed to save employee:", err);
          alert("Failed to persist employee to server. Changes reverted.");
          mutate((d) => ({ ...d, employees: prevEmployees }));
        }
      })();
    }

    resetForm();
    setEditingEmployeeId(null);
    setShowModal(false);
  }

  function toggleActive(id) {
    const prevEmployees = data.employees;
    const updatedEmployees = data.employees.map((e) =>
      e.id === id ? { ...e, active: !e.active } : e
    );
    const updatedEmp = updatedEmployees.find((e) => e.id === id);
    mutate((d) => ({ ...d, employees: updatedEmployees }));
    if (updatedEmp) {
      (async () => {
        try {
          await db.saveEmployees([updatedEmp]);
        } catch (err) {
          console.error("Failed to toggle employee active:", err);
          alert("Failed to update employee on server. Reverting.");
          mutate((d) => ({ ...d, employees: prevEmployees }));
        }
      })();
    }
  }

  function removeEmployee(id) {
    const prevEmployees = data.employees;
    mutate((d) => ({ ...d, employees: d.employees.filter((e) => e.id !== id) }));
    (async () => {
      try {
        await db.deleteEmployee(id);
      } catch (err) {
        console.error("Failed to delete employee:", err);
        alert("Failed to delete employee on server. Reverting.");
        mutate((d) => ({ ...d, employees: prevEmployees }));
      }
    })();
  }

  return (
    <div>
      <SectionTitle
        sub="Base monthly salary before deductions. Exempt employees from PAYE or SSNIT as needed."
        action={
          <Button onClick={openAddModal} icon={Plus}>
            Add employee
          </Button>
        }
      >
        Employees
      </SectionTitle>
      <Card>
        <TableScroll>
          <table
            className="table-card"
            style={{ width: "100%", borderCollapse: "collapse" }}
          >
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Designation</Th>
                <Th>SSNIT No.</Th>
                <Th right>Base Salary</Th>
                <Th>Exemptions</Th>
                <Th>Status</Th>
                <Th right>&nbsp;</Th>
              </tr>
            </thead>
            <tbody>
              {(data.employees || []).map((e) => (
                <tr key={e.id} className="row-hover">
                  <Td label="Name">{e.name}</Td>
                  <Td label="Designation">
                    {e.designation || <span style={{ color: MUTED }}>—</span>}
                  </Td>
                  <Td mono label="SSNIT No.">
                    {e.ssnitNo || <span style={{ color: MUTED }}>—</span>}
                  </Td>
                  <Td right mono label="Base Salary">
                    GHS {fmt(e.baseSalary)}
                  </Td>
                  <Td label="Exemptions">
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {e.exemptPaye && (
                        <span
                          style={{
                            fontSize: 10,
                            color: ALERT,
                            background: "var(--alert-bg)",
                            padding: "2px 6px",
                            borderRadius: 3,
                            fontWeight: 700,
                          }}
                        >
                          PAYE
                        </span>
                      )}
                      {e.exemptSsnit && (
                        <span
                          style={{
                            fontSize: 10,
                            color: ALERT,
                            background: "var(--alert-bg)",
                            padding: "2px 6px",
                            borderRadius: 3,
                            fontWeight: 700,
                          }}
                        >
                          SSNIT
                        </span>
                      )}
                      {!e.exemptPaye && !e.exemptSsnit && (
                        <span style={{ fontSize: 11, color: MUTED }}>None</span>
                      )}
                    </div>
                  </Td>
                  <Td label="Status">
                    <button
                      onClick={() => toggleActive(e.id)}
                      style={{
                        ...inputStyle,
                        width: "auto",
                        cursor: "pointer",
                        color: e.active ? GREEN : MUTED,
                        border: `1px solid ${e.active ? GREEN : RULE}`,
                        background: "none",
                      }}
                    >
                      {e.active ? "Active" : "Inactive"}
                    </button>
                  </Td>
                  <Td right label="Action">
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                      <button
                        onClick={() => openEditModal(e)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: MUTED,
                        }}
                        title="Edit employee"
                      >
                        <PenLine size={14} />
                      </button>
                      <button
                        onClick={() => removeEmployee(e.id)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: MUTED,
                        }}
                        title="Remove employee"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
              {(data.employees || []).length === 0 && (
                <tr>
                  <td colSpan={7} style={{ color: MUTED, padding: 10 }}>
                    No employees added yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableScroll>
      </Card>

      {showModal && (
        <Modal
          title={editingEmployeeId ? "Edit employee" : "Add employee"}
          onClose={() => {
            resetForm();
            setEditingEmployeeId(null);
            setShowModal(false);
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <div style={{ flex: "1 1 100%" }}>
              <label style={labelStyle}>Full name</label>
              <input
                style={inputStyle}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ama Owusu"
              />
            </div>
            <div style={{ flex: "1 1 200px" }}>
              <label style={labelStyle}>Designation</label>
              <input
                style={inputStyle}
                value={form.designation}
                onChange={(e) =>
                  setForm({ ...form, designation: e.target.value })
                }
                placeholder="Site Engineer"
              />
            </div>
            <div style={{ flex: "1 1 150px" }}>
              <label style={labelStyle}>Base salary (GHS)</label>
              <input
                style={inputStyle}
                value={form.baseSalary}
                onChange={(e) =>
                  setForm({
                    ...form,
                    baseSalary: e.target.value.replace(/[^0-9.]/g, ""),
                  })
                }
                placeholder="3500"
              />
            </div>
            <div style={{ flex: "1 1 150px" }}>
              <label style={labelStyle}>SSNIT No.</label>
              <input
                style={inputStyle}
                value={form.ssnitNo}
                onChange={(e) => setForm({ ...form, ssnitNo: e.target.value })}
                placeholder="F019506120374"
              />
            </div>
            <div style={{ flex: "1 1 150px" }}>
              <label style={labelStyle}>NIA Card</label>
              <input
                style={inputStyle}
                value={form.niaCard}
                onChange={(e) => setForm({ ...form, niaCard: e.target.value })}
                placeholder="GHA-XXXXXXXXX-X"
              />
            </div>

            <div
              style={{
                flex: "1 1 100%",
                display: "flex",
                gap: 24,
                padding: "8px 0",
                borderTop: `1px solid ${RULE}`,
                marginTop: 8,
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontFamily: FONT_BODY,
                  fontSize: 13,
                  color: INK,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={form.exemptPaye}
                  onChange={(e) => setForm({ ...form, exemptPaye: e.target.checked })}
                  style={{ width: 16, height: 16, cursor: "pointer" }}
                />
                Exempt from PAYE (e.g. Second Job)
              </label>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontFamily: FONT_BODY,
                  fontSize: 13,
                  color: INK,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={form.exemptSsnit}
                  onChange={(e) => setForm({ ...form, exemptSsnit: e.target.checked })}
                  style={{ width: 16, height: 16, cursor: "pointer" }}
                />
                Exempt from SSNIT (e.g. Not Registered)
              </label>
            </div>

            <div style={{ flex: "1 1 100%" }}>
              <Button onClick={saveEmployee} icon={editingEmployeeId ? PenLine : Plus} fullWidth>
                {editingEmployeeId ? "Save changes" : "Add employee"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------- Amount in words ----------
const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];
function threeDigitsToWords(n) {
  let s = "";
  if (n >= 100) {
    s += ONES[Math.floor(n / 100)] + " Hundred ";
    n %= 100;
  }
  if (n >= 20) {
    s += TENS[Math.floor(n / 10)] + " ";
    n %= 10;
  }
  if (n > 0) s += ONES[n] + " ";
  return s.trim();
}
function numberToWords(num) {
  num = Math.round(num);
  if (num === 0) return "Zero";
  const units = ["", "Thousand", "Million", "Billion"];
  let groups = [];
  let n = num;
  while (n > 0) {
    groups.push(n % 1000);
    n = Math.floor(n / 1000);
  }
  let parts = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] > 0)
      parts.push(
        threeDigitsToWords(groups[i]) + (units[i] ? " " + units[i] : "")
      );
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}
function amountInWords(amount, currency) {
  const whole = Math.floor(amount);
  const cents = Math.round((amount - whole) * 100);
  const currencyName = currency === "USD" ? "US Dollars" : "Ghana Cedis";
  let words = numberToWords(whole) + " " + currencyName;
  if (cents > 0) words += " and " + numberToWords(cents) + " Pesewas";
  return words + " Only";
}

function computeInvoiceTotals(
  items,
  discountPct,
  nhilGetfundRate,
  vatRate,
  chargeNhil,
  chargeVat
) {
  // Only sum up 'item' types for the financial total
  const subtotal = items
    .filter((it) => it.lineType === "item")
    .reduce(
      (s, it) => s + parseFloat(it.qty || 0) * parseFloat(it.rate || 0),
      0
    );
  const discount = subtotal * ((parseFloat(discountPct) || 0) / 100);
  const newSubtotal = subtotal - discount;
  const nhilGetfund = chargeNhil ? newSubtotal * nhilGetfundRate : 0;
  const vat = chargeVat ? newSubtotal * vatRate : 0;
  const grandTotal = newSubtotal + nhilGetfund + vat;
  return {
    subtotal,
    discount,
    newSubtotal,
    nhilGetfund,
    vat,
    grandTotal,
    chargeNhil,
    chargeVat,
  };
}

const NAVY = "#1F3864";
const INVOICE_GOLD = "#D4AF37";

const invTdLabel = {
  border: "1px solid #ccc",
  padding: "6px 8px",
  fontWeight: 700,
  fontSize: 12.5,
};
const invTdVal = {
  border: "1px solid #ccc",
  padding: "6px 8px",
  textAlign: "right",
  fontSize: 12.5,
};

function InvoiceDocument({ data, inv }) {
  const t = inv.totals;
  const cur = inv.currency;
  const sym = cur === "USD" ? "$" : "GHS";
  const company = data.company || COMPANY_TEMPLATE;

  const formatDate = (value) => {
    if (!value) return "—";
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const cardStyle = {
    background: "#FAFAF8",
    border: "1px solid #E8E4DC",
    borderRadius: 6,
    padding: "16px 20px",
  };

  const cardTitleStyle = {
    fontSize: "8pt",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "1.2px",
    color: "#C9A84C",
    marginBottom: 10,
  };

  const cardRowStyle = {
    display: "flex",
    justifyContent: "space-between",
    padding: "4px 0",
    fontSize: "9.5pt",
  };

  return (
    <div
      style={{
        background: "#fff",
        color: "#333",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        fontSize: "10pt",
        lineHeight: 1.5,
        padding: 32,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          height: 4,
          background:
            "linear-gradient(90deg, #C9A84C 0%, #D4B86A 50%, #C9A84C 100%)",
          width: "100%",
        }}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "24px 0 20px",
          borderBottom: "1px solid #E8E4DC",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <img
            src={LOGO_SRC}
            alt="logo"
            style={{ height: 64, width: "auto", objectFit: "contain" }}
          />
          <div>
            <div
              style={{
                fontSize: "18pt",
                fontWeight: 800,
                color: "#1A1A1A",
                letterSpacing: "-0.5px",
                lineHeight: 1.2,
              }}
            >
              {company.name}
            </div>
            <div
              style={{
                fontSize: "8.5pt",
                color: "#6B6B6B",
                textTransform: "uppercase",
                letterSpacing: "1.5px",
                marginTop: 2,
              }}
            >
              Design · Build · Deliver
            </div>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: "28pt",
              fontWeight: 800,
              color: "#C9A84C",
              letterSpacing: "2px",
              lineHeight: 1,
            }}
          >
            INVOICE
          </div>
          <div
            style={{
              fontSize: "10pt",
              color: "#6B6B6B",
              marginTop: 6,
              fontFamily: FONT_MONO,
            }}
          >
            {inv.invoiceNumber}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          padding: "20px 0",
        }}
      >
        <div style={cardStyle}>
          <div style={cardTitleStyle}>Bill To</div>
          <div
            style={{
              fontSize: "12pt",
              fontWeight: 700,
              color: "#1A1A1A",
              marginBottom: 4,
            }}
          >
            {inv.billTo}
          </div>
          <div style={{ fontSize: "9pt", color: "#6B6B6B", lineHeight: 1.6 }}>
            {inv.forText ? <div>{inv.forText}</div> : null}
            {inv.location ? <div>{inv.location}</div> : null}
            {inv.projectLabel ? <div>{inv.projectLabel}</div> : null}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={cardTitleStyle}>Invoice Details</div>
          <div style={cardRowStyle}>
            <span style={{ color: "#6B6B6B" }}>Date</span>
            <span style={{ fontWeight: 600, color: "#2D2D2D" }}>
              {formatDate(inv.date)}
            </span>
          </div>
          <div style={cardRowStyle}>
            <span style={{ color: "#6B6B6B" }}>Due Date</span>
            <span style={{ fontWeight: 600, color: "#2D2D2D" }}>
              {formatDate(inv.dueDate)}
            </span>
          </div>
          <div style={cardRowStyle}>
            <span style={{ color: "#6B6B6B" }}>Location</span>
            <span style={{ fontWeight: 600, color: "#2D2D2D" }}>
              {inv.location || "—"}
            </span>
          </div>
          <div style={cardRowStyle}>
            <span style={{ color: "#6B6B6B" }}>For</span>
            <span style={{ fontWeight: 600, color: "#2D2D2D" }}>
              {inv.forText || "—"}
            </span>
          </div>
          <div style={cardRowStyle}>
            <span style={{ color: "#6B6B6B" }}>Currency</span>
            <span style={{ fontWeight: 600, color: "#2D2D2D" }}>
              {cur}
            </span>
          </div>
        </div>
      </div>

      <div
        style={{
          fontSize: "9pt",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "1.5px",
          color: "#C9A84C",
          display: "flex",
          alignItems: "center",
          gap: 10,
          margin: "8px 0 10px",
        }}
      >
        Line Items
        <span style={{ flex: 1, height: 1, background: "#E8E4DC" }} />
      </div>

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "9.5pt",
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                textAlign: "left",
                padding: "10px 12px",
                fontSize: "8pt",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.8px",
                color: "#6B6B6B",
                borderBottom: "2px solid #C9A84C",
              }}
            >
              Description
            </th>
            <th
              style={{
                textAlign: "center",
                padding: "10px 12px",
                fontSize: "8pt",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.8px",
                color: "#6B6B6B",
                borderBottom: "2px solid #C9A84C",
              }}
            >
              Unit
            </th>
            <th
              style={{
                textAlign: "center",
                padding: "10px 12px",
                fontSize: "8pt",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.8px",
                color: "#6B6B6B",
                borderBottom: "2px solid #C9A84C",
              }}
            >
              Qty
            </th>
            <th
              style={{
                textAlign: "right",
                padding: "10px 12px",
                fontSize: "8pt",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.8px",
                color: "#6B6B6B",
                borderBottom: "2px solid #C9A84C",
              }}
            >
              Rate
            </th>
            <th
              style={{
                textAlign: "right",
                padding: "10px 12px",
                fontSize: "8pt",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.8px",
                color: "#6B6B6B",
                borderBottom: "2px solid #C9A84C",
              }}
            >
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {inv.items.map((it) => {
            if (it.lineType === "header") {
              return (
                <tr key={it.id}>
                  <td
                    colSpan={5}
                    style={{
                      fontWeight: 700,
                      color: "#2D2D2D",
                      padding: "14px 12px 8px",
                      borderBottom: "1px solid #E8E4DC",
                    }}
                  >
                    {it.description}
                  </td>
                </tr>
              );
            }
            if (it.lineType === "sub-detail") {
              return (
                <tr key={it.id}>
                  <td
                    colSpan={5}
                    style={{
                      padding: "6px 12px 6px 24px",
                      color: "#6B6B6B",
                      fontStyle: "italic",
                      borderBottom: "1px solid #E8E4DC",
                    }}
                  >
                    {it.description}
                  </td>
                </tr>
              );
            }
            return (
              <tr key={it.id}>
                <td
                  style={{
                    padding: "8px 12px",
                    borderBottom: "1px solid #E8E4DC",
                    verticalAlign: "top",
                    wordBreak: "break-word",
                  }}
                >
                  {it.description}
                </td>
                <td
                  style={{
                    padding: "8px 12px",
                    borderBottom: "1px solid #E8E4DC",
                    textAlign: "center",
                    verticalAlign: "top",
                  }}
                >
                  {it.unit || "—"}
                </td>
                <td
                  style={{
                    padding: "8px 12px",
                    borderBottom: "1px solid #E8E4DC",
                    textAlign: "center",
                    verticalAlign: "top",
                  }}
                >
                  {it.qty}
                </td>
                <td
                  style={{
                    padding: "8px 12px",
                    borderBottom: "1px solid #E8E4DC",
                    textAlign: "right",
                    verticalAlign: "top",
                    fontFamily: FONT_MONO,
                  }}
                >
                  {it.rate ? `${sym} ${fmt(it.rate)}` : ""}
                </td>
                <td
                  style={{
                    padding: "8px 12px",
                    borderBottom: "1px solid #E8E4DC",
                    textAlign: "right",
                    verticalAlign: "top",
                    fontFamily: FONT_MONO,
                  }}
                >
                  {sym} {fmt((parseFloat(it.qty) || 0) * (parseFloat(it.rate) || 0))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <div
          style={{
            width: 320,
            background: "#FAFAF8",
            border: "1px solid #E8E4DC",
            borderRadius: 6,
            padding: "16px 20px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "5px 0",
              fontSize: "9.5pt",
              color: "#6B6B6B",
            }}
          >
            <span>Subtotal</span>
            <span>{sym} {fmt(t.subtotal)}</span>
          </div>
          {parseFloat(t.discount) > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "5px 0",
                fontSize: "9.5pt",
                color: "#6B6B6B",
              }}
            >
              <span>Discount ({inv.discountPct || 0}%)</span>
              <span style={{ color: "#A63D40" }}>-{sym} {fmt(t.discount)}</span>
            </div>
          )}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "5px 0",
              fontSize: "9.5pt",
              color: "#2D2D2D",
              fontWeight: 700,
              background: "#F5F0E6",
              margin: "0 -20px",
              paddingLeft: 20,
              paddingRight: 20,
            }}
          >
            <span>New Subtotal</span>
            <span>{sym} {fmt(t.newSubtotal)}</span>
          </div>
          {t.chargeNhil && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "5px 0",
                fontSize: "9.5pt",
                color: "#6B6B6B",
              }}
            >
              <span>NHIL & GETFund</span>
              <span>{sym} {fmt(t.nhilGetfund)}</span>
            </div>
          )}
          {t.chargeVat && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "5px 0",
                fontSize: "9.5pt",
                color: "#6B6B6B",
              }}
            >
              <span>VAT ({(data.vatRate * 100).toFixed(1)}%)</span>
              <span>{sym} {fmt(t.vat)}</span>
            </div>
          )}
          <div
            style={{
              background: "#1A1A1A",
              color: "#C9A84C",
              fontWeight: 800,
              fontSize: "11pt",
              margin: "8px -20px -16px",
              padding: "12px 20px",
              borderRadius: "0 0 6px 6px",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>GRAND TOTAL</span>
            <span>{sym} {fmt(t.grandTotal)}</span>
          </div>
        </div>
      </div>

      <div
        style={{
          paddingTop: 16,
          marginTop: 16,
          fontStyle: "italic",
          color: "#6B6B6B",
          fontSize: "9.5pt",
          maxWidth: "55%",
        }}
      >
        <b>Amount in words:</b>
        <br />
        {amountInWords(t.grandTotal, cur)}
      </div>

      {cur === "USD" && (
        <div
          style={{
            margin: "8px 0 16px",
            fontSize: "8.5pt",
            color: "#A63D40",
            fontStyle: "italic",
          }}
        >
          Exchange Rate: Payments preferably in USD. If settled in GHS, reference rate is USD 1 = GHC {inv.exchangeRate}.
        </div>
      )}

      <div
        style={{
          padding: "16px 0 0",
          marginTop: 20,
          borderTop: "1px solid #E8E4DC",
          textAlign: "center",
          fontSize: "8.5pt",
          color: "#6B6B6B",
          textTransform: "uppercase",
          letterSpacing: "1px",
          lineHeight: 1.8,
        }}
      >
        We execute the best designs with utmost empathy and professionalism.
        <br />
        Thank you for entrusting to us your dreams — we will help make it a reality.
        <br />
        <br />
        <span style={{ color: "#E8E4DC" }}>—</span>
        <br />
        {company.addressLine} · {company.cityLine} · {company.poBox}
        <br />
        Phone: {company.phone} · Telephone: {company.telephone} · {company.email}
      </div>
    </div>
  );
}

function ReceiptDocument({ data, inv, payment, receiptNo }) {
  const idx = inv.payments.findIndex((p) => p.id === payment.id);
  const paidThrough = inv.payments
    .slice(0, idx + 1)
    .reduce((s, p) => s + p.amountGHS, 0);
  const outstanding = inv.totals.grandTotalGHS - paidThrough;

  const receiptStyles = {
    container: {
      background: "#FFFFFF",
      color: "#333333",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontSize: "10pt",
      lineHeight: 1.5,
      boxSizing: "border-box",
      padding: 0,
    },
    goldBar: {
      height: "4px",
      background: "linear-gradient(90deg, #C9A84C 0%, #D4B86A 50%, #C9A84C 100%)",
      width: "100%",
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "24px 32px",
      background: "#FFFFFF",
      gap: 16,
    },
    headerLeft: { display: "flex", alignItems: "center", gap: "16px" },
    logo: { height: "64px", width: "auto", objectFit: "contain" },
    company: {
      fontSize: "18pt",
      fontWeight: 800,
      color: "#1A1A1A",
      letterSpacing: "-0.5px",
      lineHeight: 1.2,
    },
    tagline: {
      fontSize: "8.5pt",
      color: "#6B6B6B",
      textTransform: "uppercase",
      letterSpacing: "1.5px",
      marginTop: "2px",
    },
    headerRight: { textAlign: "right" },
    docTitle: {
      fontSize: "28pt",
      fontWeight: 800,
      color: "#C9A84C",
      letterSpacing: "2px",
      lineHeight: 1,
    },
    docSub: {
      fontSize: "10pt",
      color: "#6B6B6B",
      marginTop: "4px",
      fontFamily: FONT_MONO,
    },
    metaRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 20,
      padding: "0 32px 20px",
      flexWrap: "wrap",
    },
    contactCard: {
      flex: 1,
      minWidth: 220,
      background: "#FAFAF8",
      border: "1px solid #E8E4DC",
      borderRadius: "6px",
      padding: "16px 20px",
      fontSize: "9.5pt",
      color: "#6B6B6B",
      lineHeight: 1.6,
    },
    infoCard: {
      width: "300px",
      background: "#FAFAF8",
      border: "1px solid #E8E4DC",
      borderRadius: "6px",
      padding: "16px 20px",
    },
    infoRow: {
      display: "flex",
      justifyContent: "space-between",
      padding: "4px 0",
      fontSize: "9.5pt",
      gap: 12,
    },
    infoLabel: { color: "#6B6B6B", fontWeight: 600 },
    infoValue: { color: "#2D2D2D", fontWeight: 600, textAlign: "right" },
    sectionTitle: {
      fontSize: "9pt",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "1.5px",
      color: "#C9A84C",
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "0 32px",
      margin: "20px 0 10px",
    },
    sectionLine: { flex: 1, height: "1px", background: "#E8E4DC" },
    amountBox: {
      margin: "8px 32px 16px",
      padding: "18px 20px",
      background: "linear-gradient(135deg, #F5F0E6 0%, #FFF8E7 100%)",
      border: "1px solid #E8D9A8",
      borderRadius: "6px",
    },
    amountLabel: {
      fontSize: "8pt",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "1.5px",
      color: "#C9A84C",
      marginBottom: "6px",
    },
    amountText: {
      fontSize: "14pt",
      fontWeight: 800,
      color: "#1A1A1A",
      lineHeight: 1.3,
      fontStyle: "italic",
    },
    amountFigure: {
      fontFamily: FONT_MONO,
      fontSize: "11pt",
      color: "#6B6B6B",
      marginTop: "6px",
    },
    table: {
      width: "calc(100% - 64px)",
      margin: "0 32px",
      borderCollapse: "collapse",
      fontSize: "9.5pt",
    },
    th: {
      textAlign: "left",
      padding: "10px 12px",
      fontSize: "8pt",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.8px",
      color: "#6B6B6B",
      borderBottom: "2px solid #C9A84C",
      background: "transparent",
    },
    thRight: { textAlign: "right" },
    td: { padding: "8px 12px", borderBottom: "1px solid #E8E4DC", verticalAlign: "top" },
    tdRight: { textAlign: "right", fontFamily: FONT_MONO },
    summaryBox: {
      margin: "16px 32px 0",
      background: "#FAFAF8",
      border: "1px solid #E8E4DC",
      borderRadius: "6px",
      overflow: "hidden",
    },
    summaryRow: {
      display: "flex",
      justifyContent: "space-between",
      padding: "8px 16px",
      fontSize: "9.5pt",
      borderBottom: "1px solid #E8E4DC",
      color: "#333333",
    },
    summaryHighlight: {
      display: "flex",
      justifyContent: "space-between",
      padding: "12px 16px",
      fontSize: "10pt",
      background: "#1A1A1A",
      color: "#C9A84C",
      fontWeight: 800,
    },
    signatures: {
      display: "flex",
      justifyContent: "space-between",
      padding: "32px",
      marginTop: "20px",
      gap: "40px",
    },
    sigBlock: { flex: 1, textAlign: "center" },
    sigLine: {
      borderTop: "1.5px solid #1A1A1A",
      paddingTop: "8px",
      marginTop: "40px",
      fontWeight: 700,
      fontSize: "10pt",
      color: "#1A1A1A",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
    },
    sigRole: {
      fontSize: "8.5pt",
      color: "#6B6B6B",
      marginTop: "2px",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
    },
    footerNote: {
      padding: "16px 32px 24px",
      borderTop: "1px solid #E8E4DC",
      textAlign: "center",
      fontSize: "8.5pt",
      color: "#6B6B6B",
      textTransform: "uppercase",
      letterSpacing: "1px",
      lineHeight: 1.8,
    },
  };

  return (
    <div style={receiptStyles.container}>
      <div style={receiptStyles.goldBar} />
      <div style={receiptStyles.header}>
        <div style={receiptStyles.headerLeft}>
          <img src={LOGO_SRC} alt="Modulo Development Logo" style={receiptStyles.logo} />
          <div>
            <div style={receiptStyles.company}>{data.company.name}</div>
            <div style={receiptStyles.tagline}>Design · Build · Deliver</div>
          </div>
        </div>
        <div style={receiptStyles.headerRight}>
          <div style={receiptStyles.docTitle}>OFFICIAL RECEIPT</div>
          <div style={receiptStyles.docSub}>{receiptNo}</div>
        </div>
      </div>

      <div style={receiptStyles.metaRow}>
        <div style={receiptStyles.contactCard}>
          <div style={{ fontWeight: 700, color: "#1A1A1A", marginBottom: "4px" }}>Company Details</div>
          <div>{data.company.addressLine}</div>
          <div>{data.company.cityLine}</div>
          <div>{data.company.poBox}</div>
          <div>Phone: {data.company.phone}</div>
          <div>Telephone: {data.company.telephone}</div>
          <div>Email: {data.company.email}</div>
        </div>
        <div style={receiptStyles.infoCard}>
          <div style={receiptStyles.infoRow}>
            <span style={receiptStyles.infoLabel}>Receipt No.</span>
            <span style={receiptStyles.infoValue}>{receiptNo}</span>
          </div>
          <div style={receiptStyles.infoRow}>
            <span style={receiptStyles.infoLabel}>Date</span>
            <span style={receiptStyles.infoValue}>{payment.date}</span>
          </div>
          <div style={receiptStyles.infoRow}>
            <span style={receiptStyles.infoLabel}>Invoice No.</span>
            <span style={receiptStyles.infoValue}>{inv.invoiceNumber}</span>
          </div>
        </div>
      </div>

      <div style={receiptStyles.sectionTitle}>
        <span>Received From</span>
        <span style={receiptStyles.sectionLine} />
      </div>
      <div style={{ padding: "0 32px 4px", fontSize: "12pt", fontWeight: 700, color: "#1A1A1A" }}>
        {inv.billTo}
      </div>

      <div style={receiptStyles.amountBox}>
        <div style={receiptStyles.amountLabel}>Received the sum of</div>
        <div style={receiptStyles.amountText}>{amountInWords(payment.amountGHS, "GHS").toUpperCase()}</div>
        <div style={receiptStyles.amountFigure}>GHS {fmt(payment.amountGHS)}</div>
      </div>

      <div style={receiptStyles.sectionTitle}>
        <span>Payment Details</span>
        <span style={receiptStyles.sectionLine} />
      </div>
      <table style={receiptStyles.table}>
        <thead>
          <tr>
            <th style={receiptStyles.th}>Payment By</th>
            <th style={receiptStyles.th}>Reference No.</th>
            <th style={{ ...receiptStyles.th, ...receiptStyles.thRight }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={receiptStyles.td}>{payment.method}</td>
            <td style={receiptStyles.td}>{payment.reference || "—"}</td>
            <td style={{ ...receiptStyles.td, ...receiptStyles.tdRight, fontWeight: 700 }}>GHS {fmt(payment.amountGHS)}</td>
          </tr>
        </tbody>
      </table>

      <div style={receiptStyles.sectionTitle}>
        <span>Invoice Reference</span>
        <span style={receiptStyles.sectionLine} />
      </div>
      <div style={receiptStyles.summaryBox}>
        <div style={receiptStyles.summaryRow}>
          <span>Invoice Total</span>
          <span>GHS {fmt(inv.totals.grandTotalGHS)}</span>
        </div>
        <div style={receiptStyles.summaryRow}>
          <span>Amount Received</span>
          <span>GHS {fmt(paidThrough)}</span>
        </div>
        <div style={receiptStyles.summaryRow}>
          <span>Paid For</span>
          <span>{inv.forText || inv.projectLabel || "—"}</span>
        </div>
        <div style={receiptStyles.summaryHighlight}>
          <span>Outstanding Balance</span>
          <span>GHS {fmt(Math.max(outstanding, 0))}</span>
        </div>
      </div>

      {/* Signatures removed from printable receipt per request */}

      <div style={receiptStyles.footerNote}>
        Thank you for your business.<br />
        {data.company.name} · {data.company.addressLine} · {data.company.cityLine}
        <br />
        Phone: {data.company.phone} · Telephone: {data.company.telephone} · Mail: {data.company.email}
      </div>
    </div>
  );
}

function Payslip({ data, run, r }) {
  const emp = data.employees.find((e) => e.id === r.employeeId) || {};
  const [year, month] = run.period.split("-");
  const monthName = new Date(Number(year), Number(month) - 1, 1)
    .toLocaleString("en-US", { month: "long" })
    .toUpperCase();

  const payslipStyles = {
    container: {
      background: "#FFFFFF",
      color: "#333333",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontSize: "10pt",
      lineHeight: 1.5,
      boxSizing: "border-box",
      border: "1px solid #E8E4DC",
      marginBottom: "24px",
      overflow: "hidden",
    },
    darkHeader: {
      background: "#1A1A1A",
      padding: "24px 32px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },
    darkHeaderLeft: { display: "flex", alignItems: "center", gap: "16px" },
    darkLogo: { height: "56px", width: "auto", filter: "brightness(1.1)" },
    darkCompany: {
      fontSize: "16pt",
      fontWeight: 800,
      color: "#FFFFFF",
      letterSpacing: "-0.5px",
      lineHeight: 1.2,
    },
    darkTagline: {
      fontSize: "8.5pt",
      color: "#E8D9A8",
      textTransform: "uppercase",
      letterSpacing: "1.5px",
      marginTop: "2px",
    },
    headerRight: { textAlign: "right" },
    docTitle: {
      fontSize: "22pt",
      fontWeight: 800,
      color: "#C9A84C",
      letterSpacing: "3px",
      lineHeight: 1,
    },
    docSub: {
      fontSize: "9pt",
      color: "#8A8A8A",
      marginTop: "4px",
      fontFamily: FONT_MONO,
      textAlign: "right",
    },
    employeeCard: {
      display: "grid",
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      gap: "12px",
      padding: "20px 32px",
      background: "#FAFAF8",
      borderBottom: "1px solid #E8E4DC",
    },
    field: { display: "flex", flexDirection: "column", gap: "2px" },
    fieldLabel: {
      fontSize: "7.5pt",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "1px",
      color: "#C9A84C",
    },
    fieldValue: { fontSize: "10.5pt", fontWeight: 600, color: "#2D2D2D" },
    twoCol: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "16px",
      padding: "0 32px",
      marginTop: "16px",
    },
    colCard: {
      background: "#FFFFFF",
      border: "1px solid #E8E4DC",
      borderRadius: "6px",
      overflow: "hidden",
    },
    colHeader: {
      background: "#FAFAF8",
      padding: "10px 16px",
      fontSize: "8pt",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "1.2px",
      color: "#C9A84C",
      borderBottom: "1px solid #E8E4DC",
    },
    colRow: {
      display: "flex",
      justifyContent: "space-between",
      padding: "8px 16px",
      fontSize: "9.5pt",
      borderBottom: "1px solid #E8E4DC",
    },
    colLabel: { color: "#333333" },
    colValue: { fontWeight: 600, fontFamily: FONT_MONO },
    colTotal: { background: "#FAFAF8", fontWeight: 700 },
    netHighlight: {
      margin: "20px 32px",
      background: "linear-gradient(135deg, #1A1A1A 0%, #2D2D2D 100%)",
      borderRadius: "6px",
      padding: "24px 32px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },
    netLabel: {
      color: "#E8D9A8",
      fontSize: "9pt",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "2px",
    },
    netAmount: {
      color: "#C9A84C",
      fontSize: "24pt",
      fontWeight: 800,
      fontFamily: FONT_MONO,
    },
    employerSection: {
      margin: "16px 32px",
      padding: "16px 20px",
      background: "#FAFAF8",
      border: "1px solid #E8E4DC",
      borderRadius: "6px",
    },
    empTitle: {
      fontSize: "8pt",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "1.2px",
      color: "#C9A84C",
      marginBottom: "10px",
    },
    empRow: {
      display: "flex",
      justifyContent: "space-between",
      padding: "5px 0",
      fontSize: "9.5pt",
    },
    signatures: {
      display: "flex",
      justifyContent: "space-between",
      padding: "32px",
      marginTop: "10px",
      gap: "40px",
    },
    sigBlock: { flex: 1, textAlign: "center" },
    sigLine: {
      borderTop: "1.5px solid #1A1A1A",
      paddingTop: "8px",
      marginTop: "40px",
      fontWeight: 700,
      fontSize: "10pt",
      color: "#1A1A1A",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
    },
    sigRole: {
      fontSize: "8.5pt",
      color: "#6B6B6B",
      marginTop: "2px",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
    },
    footerNote: {
      padding: "16px 32px 24px",
      borderTop: "1px solid #E8E4DC",
      textAlign: "center",
      fontSize: "8.5pt",
      color: "#6B6B6B",
      textTransform: "uppercase",
      letterSpacing: "1px",
      lineHeight: 1.8,
    },
  };

  return (
    <div style={payslipStyles.container}>
      <div style={payslipStyles.darkHeader}>
        <div style={payslipStyles.darkHeaderLeft}>
          <img src={LOGO_SRC} alt="Modulo Development Logo" style={payslipStyles.darkLogo} />
          <div>
            <div style={payslipStyles.darkCompany}>{data.company.name}</div>
            <div style={payslipStyles.darkTagline}>Design · Build · Deliver</div>
          </div>
        </div>
        <div style={payslipStyles.headerRight}>
          <div style={payslipStyles.docTitle}>PAYSLIP</div>
          <div style={payslipStyles.docSub}>{monthName} {year}</div>
        </div>
      </div>

      <div style={payslipStyles.employeeCard}>
        <div style={payslipStyles.field}>
          <div style={payslipStyles.fieldLabel}>Employee Name</div>
          <div style={payslipStyles.fieldValue}>{(emp.name || "").toUpperCase()}</div>
        </div>
        <div style={payslipStyles.field}>
          <div style={payslipStyles.fieldLabel}>SSNIT Number</div>
          <div style={payslipStyles.fieldValue}>{emp.ssnitNo || "—"}</div>
        </div>
        <div style={payslipStyles.field}>
          <div style={payslipStyles.fieldLabel}>Designation</div>
          <div style={payslipStyles.fieldValue}>{(emp.designation || "—").toUpperCase()}</div>
        </div>
        <div style={payslipStyles.field}>
          <div style={payslipStyles.fieldLabel}>Month / Year</div>
          <div style={payslipStyles.fieldValue}>{monthName}, {year}</div>
        </div>
        <div style={payslipStyles.field}>
          <div style={payslipStyles.fieldLabel}>NIA Card</div>
          <div style={payslipStyles.fieldValue}>{emp.niaCard || "—"}</div>
        </div>
        <div style={payslipStyles.field}>
          <div style={payslipStyles.fieldLabel}>Department</div>
          <div style={payslipStyles.fieldValue}>PROJECTS</div>
        </div>
      </div>

      <div style={payslipStyles.twoCol}>
        <div style={payslipStyles.colCard}>
          <div style={payslipStyles.colHeader}>Earnings</div>
          <div style={payslipStyles.colRow}>
            <span style={payslipStyles.colLabel}>Basic Salary</span>
            <span style={payslipStyles.colValue}>GH₵ {fmt(r.gross)}</span>
          </div>
          <div style={{ ...payslipStyles.colRow, ...payslipStyles.colTotal }}>
            <span style={{ ...payslipStyles.colLabel, color: "#2D2D2D" }}>Total Earnings</span>
            <span style={{ ...payslipStyles.colValue, color: "#2D2D2D" }}>GH₵ {fmt(r.gross)}</span>
          </div>
        </div>
        <div style={payslipStyles.colCard}>
          <div style={payslipStyles.colHeader}>Deductions</div>
          <div style={payslipStyles.colRow}>
            <span style={payslipStyles.colLabel}>P.A.Y.E</span>
            <span style={payslipStyles.colValue}>GH₵ {fmt(r.paye)}</span>
          </div>
          <div style={payslipStyles.colRow}>
            <span style={payslipStyles.colLabel}>
              Tier 1 + 2 (QFTL) {(data.ssnitEmployeeRate * 100).toFixed(1)}%
            </span>
            <span style={payslipStyles.colValue}>GH₵ {fmt(r.ssnitEmployee)}</span>
          </div>
          <div style={{ ...payslipStyles.colRow, ...payslipStyles.colTotal }}>
            <span style={{ ...payslipStyles.colLabel, color: "#2D2D2D" }}>Total Deductions</span>
            <span style={{ ...payslipStyles.colValue, color: "#A63D40" }}>GH₵ {fmt(r.paye + r.ssnitEmployee)}</span>
          </div>
        </div>
      </div>

      <div style={payslipStyles.netHighlight}>
        <div style={payslipStyles.netLabel}>Net Pay</div>
        <div style={payslipStyles.netAmount}>GH₵ {fmt(r.net)}</div>
      </div>

      <div style={payslipStyles.employerSection}>
        <div style={payslipStyles.empTitle}>Employer Contributions</div>
        <div style={payslipStyles.empRow}>
          <span style={payslipStyles.colLabel}>Tier 1 (SSNIT) — {(data.ssnitEmployerRate * 100).toFixed(0)}%</span>
          <span style={payslipStyles.colValue}>GH₵ {fmt(r.ssnitEmployer)}</span>
        </div>
      </div>

      {/* Signatures removed from payslip per request */}

      <div style={payslipStyles.footerNote}>
        This is a computer-generated payslip and does not require a physical signature.<br />
        {data.company.name} · {data.company.addressLine}, {data.company.cityLine} · {data.company.poBox}
      </div>
    </div>
  );
}

function PayrollPanel({ data, mutate, setPrintContent }) {
  const now = new Date();
  const [period, setPeriod] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  );
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState("");
  const [showBrackets, setShowBrackets] = useState(false);
  const [savingTaxSettings, setSavingTaxSettings] = useState(false);
  const [taxSaveMessage, setTaxSaveMessage] = useState("");
  const [taxSaveError, setTaxSaveError] = useState("");

  function updateTaxRate(field, value) {
    const percent = Number(value);
    mutate((prev) => ({
      ...prev,
      [field]: isNaN(percent) ? 0 : percent / 100,
    }));
  }

  function updateBracket(index, field, value) {
    mutate((prev) => {
      const brackets = [...(prev.brackets || [])];
      const current = brackets[index] || { upto: 0, rate: 0 };
      const next = { ...current };

      if (field === "rate") {
        const parsed = Number(value);
        next.rate = isNaN(parsed) ? 0 : parsed / 100;
      } else {
        const raw = String(value).trim();
        next.upto = raw.toLowerCase() === "infinity" ? Infinity : Number(raw);
        if (isNaN(next.upto)) next.upto = current.upto;
      }

      brackets[index] = next;
      return { ...prev, brackets };
    });
  }

  function addBracket() {
    mutate((prev) => {
      const brackets = [...(prev.brackets || [])];
      const existingUptos = brackets
        .filter((b) => b.upto !== Infinity)
        .map((b) => Number(b.upto) || 0);
      const highestUpto = existingUptos.length > 0 ? Math.max(...existingUptos) : 0;
      const nextUpto = Math.max(1000, highestUpto + 1);
      const infinityIndex = brackets.findIndex((b) => b.upto === Infinity);
      const newBracket = { upto: nextUpto, rate: 0.1 };
      if (infinityIndex === -1) {
        brackets.push(newBracket);
      } else {
        brackets.splice(infinityIndex, 0, newBracket);
      }
      return { ...prev, brackets };
    });
  }

  function removeBracket(index) {
    mutate((prev) => ({
      ...prev,
      brackets: (prev.brackets || []).filter((_, i) => i !== index),
    }));
  }

  async function saveTaxSettings() {
    setSavingTaxSettings(true);
    setTaxSaveMessage("");
    setTaxSaveError("");
    try {
      await saveTaxRates({
        ssnitEmployeeRate: data.ssnitEmployeeRate,
        ssnitEmployerRate: data.ssnitEmployerRate,
        nhilGetfundRate: data.nhilGetfundRate,
        vatRate: data.vatRate,
      });
      await savePayeBrackets(data.brackets);
      setTaxSaveMessage("Tax settings saved to the database.");
    } catch (err) {
      console.error("Failed to save tax settings:", err);
      setTaxSaveError("Unable to persist tax settings. Try again.");
    } finally {
      setSavingTaxSettings(false);
    }
  }

  async function handlePostPayroll() {
    if (!period) return;
    if (data.payrollRuns.some((r) => r.period === period)) {
      setPostError("Payroll for this period has already been posted.");
      return;
    }
    setPosting(true);
    setPostError("");
    try {
      // The run_payroll() Postgres function does all the tax math
      // (respecting exempt_paye / exempt_ssnit), writes the payroll_lines,
      // and posts the balanced journal entry — all server-side, in one
      // transaction. We just trigger it and pull back both results so the
      // UI updates immediately, same as every other posting action.
      const { run, journalEntry } = await runPayrollAndFetch(period);
      mutate((d) => ({
        ...d,
        payrollRuns: [run, ...d.payrollRuns],
        journal: [journalEntry, ...d.journal],
      }));
    } catch (err) {
      console.error("Failed to post payroll:", err);
      setPostError(err?.message || "Failed to post payroll. Check console for details.");
    } finally {
      setPosting(false);
    }
  }

  function printPayslip(run, row) {
    const empName = row.name.replace(/\s+/g, "_");
    document.title = `Payslip_${empName}_${run.period}`;

    setPrintContent(
      <div>
        <Payslip key={row.employeeId} data={data} run={run} r={row} />
      </div>
    );

    setTimeout(() => {
      window.print();
      document.title = "Modulo Ledger";
    }, 100);
  }

  const alreadyPosted = data.payrollRuns.some((r) => r.period === period);

  return (
    <div>
      <SectionTitle sub="Bracket-based PAYE, plus SSNIT employee and employer contributions. Payslips match your standard format.">
        Payroll
      </SectionTitle>
      <Card style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "end",
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: "1 1 150px" }}>
            <label style={labelStyle}>Period</label>
            <input
              type="month"
              style={inputStyle}
              value={period}
              onChange={(e) => {
                setPeriod(e.target.value);
                setPostError("");
              }}
            />
          </div>
          <Button
            onClick={handlePostPayroll}
            icon={Banknote}
            disabled={posting || alreadyPosted || !period}
          >
            {posting ? "Posting…" : alreadyPosted ? "Already Posted" : "Run & Post Payroll"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => setShowBrackets((s) => !s)}
            icon={Settings2}
          >
            Tax settings
          </Button>
          {alreadyPosted && (
            <span style={{ color: MUTED, fontFamily: FONT_BODY, fontSize: 13 }}>
              Already posted for this period.
            </span>
          )}
          {postError && (
            <span style={{ color: ALERT, fontFamily: FONT_BODY, fontSize: 13 }}>
              {postError}
            </span>
          )}
        </div>
        {showBrackets && (
          <div
            style={{
              marginTop: 16,
              paddingTop: 16,
              borderTop: `1px solid ${RULE}`,
            }}
          >
            <p
              style={{
                fontFamily: FONT_BODY,
                fontSize: 12.5,
                color: MUTED,
                marginBottom: 10,
              }}
            >
              Monthly PAYE bands (GHS) — estimated from 2026 GRA annual bands.
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div>
                <label style={labelStyle}>SSNIT employee rate</label>
                <input
                  style={inputStyle}
                  type="number"
                  step="0.1"
                  min="0"
                  value={(data.ssnitEmployeeRate * 100).toFixed(2)}
                  onChange={(e) => updateTaxRate("ssnitEmployeeRate", e.target.value)}
                />
              </div>
              <div>
                <label style={labelStyle}>SSNIT employer rate</label>
                <input
                  style={inputStyle}
                  type="number"
                  step="0.1"
                  min="0"
                  value={(data.ssnitEmployerRate * 100).toFixed(2)}
                  onChange={(e) => updateTaxRate("ssnitEmployerRate", e.target.value)}
                />
              </div>
              <div>
                <label style={labelStyle}>NHIL / GETFund rate</label>
                <input
                  style={inputStyle}
                  type="number"
                  step="0.1"
                  min="0"
                  value={(data.nhilGetfundRate * 100).toFixed(2)}
                  onChange={(e) => updateTaxRate("nhilGetfundRate", e.target.value)}
                />
              </div>
              <div>
                <label style={labelStyle}>VAT rate</label>
                <input
                  style={inputStyle}
                  type="number"
                  step="0.1"
                  min="0"
                  value={(data.vatRate * 100).toFixed(2)}
                  onChange={(e) => updateTaxRate("vatRate", e.target.value)}
                />
              </div>
            </div>

            <TableScroll>
              <table
                className="table-card"
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  marginBottom: 10,
                }}
              >
                <thead>
                  <tr>
                    <Th>Up to (GHS)</Th>
                    <Th right>Rate</Th>
                    <Th right>Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.brackets.map((b, i) => (
                    <tr key={i} className="row-hover">
                      <Td mono label="Up to (GHS)">
                        <input
                          style={{ ...inputStyle, width: "100%" }}
                          type="text"
                          value={b.upto === Infinity ? "Infinity" : b.upto}
                          onChange={(e) => updateBracket(i, "upto", e.target.value)}
                        />
                      </Td>
                      <Td right mono label="Rate">
                        <input
                          style={{ ...inputStyle, width: "100%" }}
                          type="number"
                          step="0.1"
                          min="0"
                          value={(b.rate * 100).toFixed(2)}
                          onChange={(e) => updateBracket(i, "rate", e.target.value)}
                        />
                      </Td>
                      <Td right mono>
                        <Button
                          variant="ghost"
                          onClick={() => removeBracket(i)}
                          icon={Trash2}
                          disabled={b.upto === Infinity}
                        >
                          Remove
                        </Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>

            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <Button onClick={addBracket} icon={Plus} variant="ghost">
                Add bracket
              </Button>
              <Button onClick={saveTaxSettings} icon={Check} disabled={savingTaxSettings}>
                {savingTaxSettings ? "Saving…" : "Save tax settings"}
              </Button>
              {taxSaveMessage && (
                <span style={{ color: GREEN, fontFamily: FONT_BODY, fontSize: 13 }}>
                  {taxSaveMessage}
                </span>
              )}
              {taxSaveError && (
                <span style={{ color: ALERT, fontFamily: FONT_BODY, fontSize: 13 }}>
                  {taxSaveError}
                </span>
              )}
            </div>

            <div
              style={{
                display: "flex",
                gap: 20,
                fontFamily: FONT_BODY,
                fontSize: 13,
                flexWrap: "wrap",
              }}
            >
              <span>
                SSNIT employee (Tier 1+2): <b>{(data.ssnitEmployeeRate * 100).toFixed(1)}%</b>
              </span>
              <span>
                SSNIT employer (Tier 1): <b>{(data.ssnitEmployerRate * 100).toFixed(1)}%</b>
              </span>
            </div>
          </div>
        )}
      </Card>
      <SectionTitle>Past payroll runs</SectionTitle>
      <Card>
        {data.payrollRuns.length === 0 && (
          <p style={{ fontFamily: FONT_BODY, color: MUTED, fontSize: 13.5 }}>
            No payroll posted yet.
          </p>
        )}
        {data.payrollRuns.map((run) => (
          <div
            key={run.id}
            style={{
              marginBottom: 24,
              paddingBottom: 24,
              borderBottom: `1px solid ${RULE}`,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <span
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 700,
                  color: INK,
                  fontSize: 16,
                }}
              >
                {run.period}
              </span>
            </div>

            <TableScroll>
              <table className="table-card" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <Th>Employee</Th>
                    <Th right>Net Pay</Th>
                    <Th right>&nbsp;</Th>
                  </tr>
                </thead>
                <tbody>
                  {run.rows.map((r) => (
                    <tr key={r.employeeId} className="row-hover">
                      <Td label="Employee">{r.name}</Td>
                      <Td right mono label="Net Pay">GHS {fmt(r.net)}</Td>
                      <Td right>
                        <Button
                          variant="ghost"
                          icon={Printer}
                          onClick={() => printPayslip(run, r)}
                        >
                          Print
                        </Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </div>
        ))}
      </Card>
    </div>
  );
}

function NewInvoiceForm({ data, mutate, onDone, cloneSource }: NewInvoiceFormProps) {
  const [billTo, setBillTo] = useState(cloneSource?.billTo || "");
  const [forText, setForText] = useState(cloneSource?.forText || "");
  const [location, setLocation] = useState(cloneSource?.location || "GREATER ACCRA");
  const [project, setProject] = useState(cloneSource?.project || "GEN");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [currency, setCurrency] = useState(cloneSource?.currency || "GHS");
  const [exchangeRate, setExchangeRate] = useState(String(cloneSource?.exchangeRate || "11.2"));
  const [discountPct, setDiscountPct] = useState(String(cloneSource?.discountPct || "0"));
  const [chargeNhil, setChargeNhil] = useState(cloneSource?.totals?.chargeNhil ?? true);
  const [chargeVat, setChargeVat] = useState(cloneSource?.totals?.chargeVat ?? true);
  const [revenueAccount, setRevenueAccount] = useState(cloneSource?.revenueAccount || "4100");
  const [items, setItems] = useState(
    cloneSource?.items?.length
      ? cloneSource.items.map((it) => ({
          id: String(Date.now()) + Math.random().toString(36).slice(2, 6),
          description: it.description,
          unit: it.unit || "",
          qty: String(it.qty),
          rate: String(it.rate),
          lineType: it.lineType,
        }))
      : [
          {
            id: "1",
            description: "",
            unit: "",
            qty: "1",
            rate: "",
            lineType: "item",
          },
        ]
  );

  // Filter revenue/income accounts (case-insensitive to match DB values like "income", "Revenue", "Income")
  const revenueOptions = data.accounts.filter((a) => {
    const type = (a.type || "").toLowerCase();
    return type === "revenue" || type === "income";
  });
  const totals = useMemo(
    () =>
      computeInvoiceTotals(
        items,
        discountPct,
        data.nhilGetfundRate,
        data.vatRate,
        chargeNhil,
        chargeVat
      ),
    [items, discountPct, data, chargeNhil, chargeVat]
  );

  function updateItem(i, field, val) {
    setItems((its) =>
      its.map((it, idx) => (idx === i ? { ...it, [field]: val } : it))
    );
  }
  function addItem() {
    setItems((its) => [
      ...its,
      {
        id: String(Date.now()),
        description: "",
        unit: "",
        qty: "1",
        rate: "",
        lineType: "item",
      },
    ]);
  }
  function removeItem(i) {
    setItems((its) => its.filter((_, idx) => idx !== i));
  }

  async function create() {
    const err = assertInvoice({ billTo, items, dueDate, date });
    if (err) {
      alert(err);
      return;
    }
    const year = date.slice(0, 4);
    const invoiceNumber = `SP/${year}/${String(data.nextInvoiceNum).padStart(
      4,
      "0"
    )}`;
    const cleanItems = items
      .filter((it) => it.description.trim())
      .map((it) => ({
        ...it,
        qty: it.lineType === "item" ? parseFloat(it.qty) || 0 : 0,
        rate: it.lineType === "item" ? parseFloat(it.rate) || 0 : 0,
      }));
    const t = computeInvoiceTotals(
      cleanItems,
      discountPct,
      data.nhilGetfundRate,
      data.vatRate,
      chargeNhil,
      chargeVat
    );
    const rate = currency === "USD" ? parseFloat(exchangeRate) || 1 : 1;
    const totals = {
      ...t,
      grandTotalGHS: currency === "USD" ? t.grandTotal * rate : t.grandTotal,
      newSubtotalGHS: currency === "USD" ? t.newSubtotal * rate : t.newSubtotal,
      nhilGetfundGHS: currency === "USD" ? t.nhilGetfund * rate : t.nhilGetfund,
      vatGHS: currency === "USD" ? t.vat * rate : t.vat,
      chargeNhil,
      chargeVat,
    };
    const inv = {
      id: invoiceNumber,
      invoiceNumber,
      date,
      dueDate: dueDate || date,
      billTo: billTo.trim(),
      forText: forText.trim(),
      location,
      project,
      projectLabel: projectName(data.projects, project),
      currency,
      exchangeRate: rate,
      items: cleanItems,
      discountPct: parseFloat(discountPct) || 0,
      revenueAccount,
      totals,
      status: "Sent",
      payments: [],
    };
    const entryNumber = `JE-${String(data.nextEntryNum).padStart(4, "0")}`;
    const entry = {
      id: entryNumber,
      entryNumber,
      date,
      description: `Invoice ${invoiceNumber} — ${billTo.trim()}`,
      period: date.slice(0, 7),
      project,
      lines: [
        { account: "1130", debit: totals.grandTotalGHS, credit: 0 },
        { account: revenueAccount, debit: 0, credit: totals.newSubtotalGHS },
        ...(chargeNhil
          ? [{ account: "2205", debit: 0, credit: totals.nhilGetfundGHS }]
          : []),
        ...(chargeVat
          ? [{ account: "2220", debit: 0, credit: totals.vatGHS }]
          : []),
      ],
    };
    mutate((d) => ({
      ...d,
      invoices: [inv, ...d.invoices],
      journal: [entry, ...d.journal],
      nextEntryNum: d.nextEntryNum + 1,
      nextInvoiceNum: d.nextInvoiceNum + 1,
    }));
    try {
      await db.saveInvoice(inv);
      await db.saveJournalEntry(entry);
    } catch (err) {
      console.error("Failed to persist invoice or journal entry:", err);
      alert("Failed to save invoice to server. Check console for details.");
    }
    onDone && onDone();
  }

  return (
    <div>
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 14 }}
      >
        <div style={{ flex: "1 1 200px" }}>
          <label style={labelStyle}>Bill to</label>
          <input
            style={inputStyle}
            value={billTo}
            onChange={(e) => setBillTo(e.target.value)}
            placeholder="Mr. Ken and Mr. Kasim"
          />
        </div>
        <div style={{ flex: "1 1 200px" }}>
          <label style={labelStyle}>Project</label>
          <ProjectSelect
            value={project}
            onChange={setProject}
            projects={data.projects}
          />
        </div>
        <div style={{ flex: "1 1 200px" }}>
          <label style={labelStyle}>Location</label>
          <input
            style={inputStyle}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
        <div style={{ flex: "2 1 300px" }}>
          <label style={labelStyle}>
            What's this for (appears on receipts)
          </label>
          <input
            style={inputStyle}
            value={forText}
            onChange={(e) => setForText(e.target.value)}
            placeholder="Construction of Four (4) Bedroom Residential Facility"
          />
        </div>
        <div style={{ flex: "1 1 120px" }}>
          <label style={labelStyle}>Date</label>
          <input
            type="date"
            style={inputStyle}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div style={{ flex: "1 1 120px" }}>
          <label style={labelStyle}>Due date</label>
          <input
            type="date"
            style={inputStyle}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        <div style={{ flex: "1 1 100px" }}>
          <label style={labelStyle}>Currency</label>
          <select
            style={inputStyle}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            <option value="GHS">GHS</option>
            <option value="USD">USD</option>
          </select>
        </div>
        {currency === "USD" && (
          <div style={{ flex: "1 1 120px" }}>
            <label style={labelStyle}>Exchange rate (GHS per USD)</label>
            <input
              style={inputStyle}
              value={exchangeRate}
              onChange={(e) =>
                setExchangeRate(e.target.value.replace(/[^0-9.]/g, ""))
              }
            />
          </div>
        )}
        <div style={{ flex: "1 1 200px" }}>
          <label style={labelStyle}>Revenue account</label>
          <select
            style={inputStyle}
            value={revenueAccount}
            onChange={(e) => setRevenueAccount(e.target.value)}
          >
            {revenueOptions.map((a) => (
              <option key={a.code} value={a.code}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: "1 1 100px" }}>
          <label style={labelStyle}>Discount %</label>
          <input
            style={inputStyle}
            value={discountPct}
            onChange={(e) =>
              setDiscountPct(e.target.value.replace(/[^0-9.]/g, ""))
            }
          />
        </div>
      </div>

      <TableScroll>
        <table
          style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8 }}
        >
          <thead>
            <tr>
              <Th style={{ width: "120px" }}>Type</Th>
              <Th>Description</Th>
              <Th>Unit</Th>
              <Th right>Qty/Days</Th>
              <Th right>Rate</Th>
              <Th right>Amount</Th>
              <Th right>&nbsp;</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.id}>
                <Td>
                  <select
                    style={{ ...inputStyle, padding: "5px" }}
                    value={it.lineType}
                    onChange={(e) => updateItem(i, "lineType", e.target.value)}
                  >
                    <option value="item">Item</option>
                    <option value="header">Header</option>
                    <option value="sub-detail">Sub-detail</option>
                  </select>
                </Td>
                <Td>
                  <input
                    style={inputStyle}
                    value={it.description}
                    onChange={(e) =>
                      updateItem(i, "description", e.target.value)
                    }
                    placeholder="Item description..."
                  />
                </Td>
                <Td>
                  <input
                    style={{ ...inputStyle, width: 70 }}
                    value={it.lineType === "item" ? it.unit : ""}
                    onChange={(e) => updateItem(i, "unit", e.target.value)}
                    disabled={it.lineType !== "item"}
                  />
                </Td>
                <Td right>
                  <input
                    style={{ ...inputStyle, width: 70, textAlign: "right" }}
                    value={it.lineType === "item" ? it.qty : ""}
                    onChange={(e) =>
                      updateItem(
                        i,
                        "qty",
                        e.target.value.replace(/[^0-9.]/g, "")
                      )
                    }
                    disabled={it.lineType !== "item"}
                  />
                </Td>
                <Td right>
                  <input
                    style={{
                      ...inputStyle,
                      width: 100,
                      textAlign: "right",
                      fontFamily: FONT_MONO,
                    }}
                    value={it.lineType === "item" ? it.rate : ""}
                    onChange={(e) =>
                      updateItem(
                        i,
                        "rate",
                        e.target.value.replace(/[^0-9.]/g, "")
                      )
                    }
                    disabled={it.lineType !== "item"}
                  />
                </Td>
                <Td right mono>
                  {it.lineType === "item"
                    ? fmt(
                        (parseFloat(it.qty) || 0) * (parseFloat(it.rate) || 0)
                      )
                    : "—"}
                </Td>
                <Td right>
                  <button
                    onClick={() => removeItem(i)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: MUTED,
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
      <Button variant="ghost" onClick={addItem} icon={Plus}>
        Add line item
      </Button>

      <div
        style={{
          marginTop: 16,
          display: "flex",
          gap: 24,
          flexWrap: "wrap",
          padding: 14,
          background: "var(--paper)",
          border: `1px solid ${RULE}`,
          borderRadius: 6,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            id="chargeNhil"
            checked={chargeNhil}
            onChange={(e) => setChargeNhil(e.target.checked)}
            style={{ width: 16, height: 16, cursor: "pointer" }}
          />
          <label
            htmlFor="chargeNhil"
            style={{
              fontFamily: FONT_BODY,
              fontSize: 13,
              color: INK,
              cursor: "pointer",
            }}
          >
            Charge NHIL/GETFund
          </label>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            id="chargeVat"
            checked={chargeVat}
            onChange={(e) => setChargeVat(e.target.checked)}
            style={{ width: 16, height: 16, cursor: "pointer" }}
          />
          <label
            htmlFor="chargeVat"
            style={{
              fontFamily: FONT_BODY,
              fontSize: 13,
              color: INK,
              cursor: "pointer",
            }}
          >
            Charge VAT
          </label>
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          padding: 14,
          background: "var(--paper)",
          border: `1px solid ${RULE}`,
          borderRadius: 6,
          fontFamily: FONT_MONO,
          fontSize: 13,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Sub-total</span>
          <span>{fmt(totals.subtotal)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Discount ({discountPct || 0}%)</span>
          <span>-{fmt(totals.discount)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>New Sub-total</span>
          <span>{fmt(totals.newSubtotal)}</span>
        </div>
        {chargeNhil && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>
              NHIL &amp; GETFund ({(data.nhilGetfundRate * 100).toFixed(1)}%)
            </span>
            <span>{fmt(totals.nhilGetfund)}</span>
          </div>
        )}
        {chargeVat && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>VAT ({(data.vatRate * 100).toFixed(0)}%)</span>
            <span>{fmt(totals.vat)}</span>
          </div>
        )}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontWeight: 700,
            fontSize: 15,
            borderTop: `1px solid ${RULE}`,
            marginTop: 6,
            paddingTop: 6,
          }}
        >
          <span>Grand Total</span>
          <span>
            {currency} {fmt(totals.grandTotal)}
          </span>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <Button onClick={create} icon={Check}>
          Create &amp; post invoice
        </Button>
      </div>
    </div>
  );
}

function RecordPaymentForm({ data, mutate, inv, onDone, setPrintContent }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Bank");
  const [reference, setReference] = useState("");

  async function record() {
    const amt = parseFloat(amount);
    const err = assertPayment(amt);
    if (err) {
      alert(err);
      return;
    }
    const paymentId = "PYT-" + Date.now();
    const payment = { id: paymentId, date, amountGHS: amt, method, reference };
    const paidSoFar = inv.payments.reduce((s, p) => s + p.amountGHS, 0) + amt;
    const newStatus =
      paidSoFar >= inv.totals.grandTotalGHS - 0.01 ? "Paid" : "Partially Paid";
    const entryNumber = `JE-${String(data.nextEntryNum).padStart(4, "0")}`;
    const entry = {
      id: entryNumber,
      entryNumber,
      date,
      description: `Payment received — ${inv.invoiceNumber} (${inv.billTo})`,
      period: date.slice(0, 7),
      project: inv.project,
      lines: [
        { account: "1110", debit: amt, credit: 0 },
        { account: "1130", debit: 0, credit: amt },
      ],
    };
    const updatedInvoice = {
      ...inv,
      payments: [...inv.payments, payment],
      status: newStatus,
    };
    const receiptNo = `PYT${String(
      data.invoices.findIndex((i) => i.id === inv.id) * 10 +
        inv.payments.length +
        1
    ).padStart(3, "0")}`;
    mutate((d) => ({
      ...d,
      invoices: d.invoices.map((i) =>
        i.id === inv.id ? updatedInvoice : i
      ),
      journal: [entry, ...d.journal],
      nextEntryNum: d.nextEntryNum + 1,
    }));
    try {
      await db.saveInvoice(updatedInvoice);
      await db.saveJournalEntry(entry);
    } catch (err) {
      console.error("Failed to persist payment or journal entry:", err);
      alert("Failed to record payment to server. Check console for details.");
    }
    document.title = `Receipt_${receiptNo}_${(inv.billTo || "Client").replace(/\s+/g, "_")}`;
    setPrintContent(
      <ReceiptDocument
        data={data}
        inv={inv}
        payment={payment}
        receiptNo={receiptNo}
      />
    );
    setTimeout(() => {
      window.print();
      document.title = "Modulo Ledger";
    }, 100);
    onDone && onDone();
  }

  const balance =
    inv.totals.grandTotalGHS -
    inv.payments.reduce((s, p) => s + p.amountGHS, 0);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: MUTED }}>
        Outstanding balance: <b style={{ color: INK }}>GHS {fmt(balance)}</b>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <div style={{ flex: "1 1 150px" }}>
          <label style={labelStyle}>Date</label>
          <input
            type="date"
            style={inputStyle}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div style={{ flex: "1 1 150px" }}>
          <label style={labelStyle}>Amount (GHS)</label>
          <input
            style={inputStyle}
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder={fmt(balance)}
          />
        </div>
        <div style={{ flex: "1 1 150px" }}>
          <label style={labelStyle}>Payment by</label>
          <select
            style={inputStyle}
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            <option>Bank</option>
            <option>Cash</option>
            <option>Mobile Money</option>
            <option>Cheque</option>
          </select>
        </div>
        <div style={{ flex: "1 1 150px" }}>
          <label style={labelStyle}>Reference No.</label>
          <input
            style={inputStyle}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </div>
      </div>
      <Button onClick={record} icon={Check} fullWidth>
        Record payment & Print Receipt
      </Button>
    </div>
  );
}

function InvoicingPanel({ data, mutate, setPrintContent }: InvoicingPanelProps) {
  const [showNew, setShowNew] = useState(false);
  const [payingInv, setPayingInv] = useState<Invoice | null>(null);
  const [cloneSource, setCloneSource] = useState<Invoice | null>(null);

  function doPrint(target) {
    const inv = data.invoices.find((i) => i.id === target.invId);
    if (!inv) return;
    let title = "Document";
    let content = null;

    if (target.type === "invoice") {
      title = `Invoice_${inv.invoiceNumber}_${(inv.billTo || "Client").replace(/\s+/g, "_")}`;
      content = <InvoiceDocument data={data} inv={inv} />;
    } else {
      const payment = inv.payments.find((p) => p.id === target.paymentId);
      if (!payment) return;
      const receiptNo = `PYT${String(
        data.invoices.findIndex((i) => i.id === inv.id) * 10 +
          inv.payments.findIndex((p) => p.id === payment.id) +
          1
      ).padStart(3, "0")}`;
      title = `Receipt_${receiptNo}_${(inv.billTo || "Client").replace(/\s+/g, "_")}`;
      content = (
        <ReceiptDocument
          data={data}
          inv={inv}
          payment={payment}
          receiptNo={receiptNo}
        />
      );
    }

    document.title = title;
    setPrintContent(content);
    setTimeout(() => {
      window.print();
      document.title = "Modulo Ledger";
    }, 100);
  }

  return (
    <div>
      <SectionTitle
        sub="Create client invoices with your letterhead, VAT/NHIL/GETFund auto-calculated, and post straight to the ledger."
        action={
          <Button onClick={() => setShowNew(true)} icon={Plus}>
            New invoice
          </Button>
        }
      >
        Invoicing
      </SectionTitle>
      <Card>
        <TableScroll>
          <table
            className="table-card"
            style={{ width: "100%", borderCollapse: "collapse" }}
          >
            <thead>
              <tr>
                <Th>Invoice #</Th>
                <Th>Bill To</Th>
                <Th>Project</Th>
                <Th right>Grand Total</Th>
                <Th right>Paid</Th>
                <Th right>Balance</Th>
                <Th>Status</Th>
                <Th right>&nbsp;</Th>
              </tr>
            </thead>
            <tbody>
              {data.invoices.map((inv) => {
                const paid = inv.payments.reduce((s, p) => s + p.amountGHS, 0);
                const balance = inv.totals.grandTotalGHS - paid;
                return (
                  <tr key={inv.id} className="row-hover">
                    <Td mono label="Invoice #">
                      {inv.invoiceNumber}
                    </Td>
                    <Td label="Bill To">{inv.billTo}</Td>
                    <Td label="Project">{inv.projectLabel}</Td>
                    <Td right mono label="Grand Total">
                      {inv.currency} {fmt(inv.totals.grandTotal)}
                    </Td>
                    <Td right mono label="Paid">
                      GHS {fmt(paid)}
                    </Td>
                    <Td
                      right
                      mono
                      bold
                      label="Balance"
                      style={{ color: balance > 0.01 ? ALERT : GREEN }}
                    >
                      {fmt(balance)}
                    </Td>
                    <Td label="Status">{inv.status}</Td>
                    <Td right label="Actions">
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          justifyContent: "flex-end",
                          flexWrap: "wrap",
                        }}
                      >
                        <Button
                          variant="ghost"
                          icon={Printer}
                          onClick={() =>
                            doPrint({ type: "invoice", invId: inv.id })
                          }
                        >
                          Print
                        </Button>
                        <Button
                          variant="ghost"
                          icon={Plus}
                          onClick={() => {
                            setCloneSource(inv);
                            setShowNew(true);
                          }}
                        >
                          Clone
                        </Button>
                        {balance > 0.01 && (
                          <Button
                            variant="ghost"
                            icon={Banknote}
                            onClick={() => setPayingInv(inv)}
                          >
                            Payment
                          </Button>
                        )}
                        {inv.payments.length > 0 && (
                          <select
                            style={{
                              ...inputStyle,
                              width: "auto",
                              fontSize: 12,
                              padding: "4px 8px",
                            }}
                            value=""
                            onChange={(e) => {
                              if (e.target.value)
                                doPrint({
                                  type: "receipt",
                                  invId: inv.id,
                                  paymentId: e.target.value,
                                });
                            }}
                          >
                            <option value="">Reprint Receipt…</option>
                            {inv.payments.map((p, i) => (
                              <option key={p.id} value={p.id}>
                                Receipt {i + 1} — GHS {fmt(p.amountGHS)}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
              {data.invoices.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ color: MUTED, padding: 10 }}>
                    No invoices yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableScroll>
      </Card>

      {showNew && (
        <Modal
          title="New invoice"
          sub="VAT, NHIL & GETFund calculate automatically from your line items."
          onClose={() => setShowNew(false)}
          wide
        >
          <NewInvoiceForm
            data={data}
            mutate={mutate}
            onDone={() => {
              setShowNew(false);
              setCloneSource(null);
            }}
            cloneSource={cloneSource}
          />
        </Modal>
      )}
      {payingInv && (
        <Modal
          title={`Record payment — ${payingInv.invoiceNumber}`}
          onClose={() => setPayingInv(null)}
        >
          <RecordPaymentForm
            data={data}
            mutate={mutate}
            inv={payingInv}
            setPrintContent={setPrintContent}
            onDone={() => setPayingInv(null)}
          />
        </Modal>
      )}
    </div>
  );
}

function ExportPanel({ data, isMobile }) {
  function exportExcel() {
    const wb = XLSX.utils.book_new();
    const coaSheet = XLSX.utils.json_to_sheet(
      data.accounts.map((a) => ({
        Code: a.code,
        Name: a.name,
        Type: a.type,
        "Normal Balance": a.normal,
      }))
    );
    XLSX.utils.book_append_sheet(wb, coaSheet, "Chart of Accounts");

    const journalRows = [];
    data.journal.forEach((e) =>
      e.lines.forEach((l) => {
        const acc = data.accounts.find((a) => a.code === l.account);
        journalRows.push({
          Entry: e.entryNumber,
          Date: e.date,
          Description: e.description,
          Project: projectName(data.projects, e.project),
          Account: `${l.account} — ${acc ? acc.name : ""}`,
          Debit: l.debit || "",
          Credit: l.credit || "",
        });
      })
    );
    const jSheet = XLSX.utils.json_to_sheet(journalRows);
    XLSX.utils.book_append_sheet(wb, jSheet, "Journal Entries");

    const tbRows = data.accounts
      .map((a) => {
        let debit = 0,
          credit = 0;
        data.journal.forEach((e) =>
          e.lines.forEach((l) => {
            if (l.account === a.code) {
              debit += l.debit;
              credit += l.credit;
            }
          })
        );
        const balance = a.normal === "Debit" ? debit - credit : credit - debit;
        return {
          Code: a.code,
          Account: a.name,
          "Total Debit": debit,
          "Total Credit": credit,
          Balance: balance,
        };
      })
      .filter((r) => r["Total Debit"] || r["Total Credit"]);
    const tbSheet = XLSX.utils.json_to_sheet(tbRows);
    XLSX.utils.book_append_sheet(wb, tbSheet, "Trial Balance");

    const projRows = projectStats(data).map((p) => ({
      Project: p.name,
      Status: p.status || "",
      "Contract Value": p.contractValue,
      "Revenue Billed": p.revenueBilled,
      "Actual Cost": p.actualCost,
      "Estimated Cost": p.estimatedCost,
      "Remaining Cost": p.remainingCost,
      "Projected Margin": p.projectedMargin,
    }));
    const prjSheet = XLSX.utils.json_to_sheet(projRows);
    XLSX.utils.book_append_sheet(wb, prjSheet, "Projects");

    const invRows = [];
    data.invoices.forEach((inv) => {
      const paid = inv.payments.reduce((s, p) => s + p.amountGHS, 0);
      invRows.push({
        "Invoice #": inv.invoiceNumber,
        Date: inv.date,
        "Bill To": inv.billTo,
        Project: inv.projectLabel,
        Currency: inv.currency,
        "Grand Total": inv.totals.grandTotal,
        "Grand Total (GHS)": inv.totals.grandTotalGHS,
        "Paid (GHS)": paid,
        "Balance (GHS)": inv.totals.grandTotalGHS - paid,
        Status: inv.status,
      });
    });
    const invSheet = XLSX.utils.json_to_sheet(invRows);
    XLSX.utils.book_append_sheet(wb, invSheet, "Invoices");

    const payrollRows = [];
    data.payrollRuns.forEach((run) =>
      run.rows.forEach((r) => {
        payrollRows.push({
          Period: run.period,
          Employee: r.name,
          Gross: r.gross,
          "SSNIT (Employee)": r.ssnitEmployee,
          "SSNIT (Employer)": r.ssnitEmployer,
          PAYE: r.paye,
          "Net Pay": r.net,
        });
      })
    );
    const pSheet = XLSX.utils.json_to_sheet(payrollRows);
    XLSX.utils.book_append_sheet(wb, pSheet, "Payroll");

    XLSX.writeFile(
      wb,
      `${data.companyName.replace(/\s+/g, "_")}_ledger_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`
    );
  }

  return (
    <div>
      <SectionTitle sub="One workbook with your chart of accounts, journal, trial balance, projects, invoices, and payroll.">
        Export
      </SectionTitle>
      <Card style={{ textAlign: "center" }}>
        <p
          style={{
            fontFamily: FONT_BODY,
            fontSize: 13.5,
            color: INK,
            marginBottom: 16,
          }}
        >
          Download everything as an Excel file, ready whenever you need it for
          your records or your accountant.
        </p>
        <Button
          onClick={exportExcel}
          icon={FileSpreadsheet}
          fullWidth={isMobile}
        >
          Export to Excel
        </Button>
      </Card>
    </div>
  );
}
function ReportsPanel({ data }: { data: AppData }) {
  const today = new Date().toISOString().slice(0, 10);

  /* ---------- Aged Receivables ---------- */
  const aged = useMemo(() => {
    const buckets = {
      current: [] as Invoice[],
      d30: [] as Invoice[],
      d60: [] as Invoice[],
      d90: [] as Invoice[],
      d90plus: [] as Invoice[],
    };
    const totals = { current: 0, d30: 0, d60: 0, d90: 0, d90plus: 0 };

    data.invoices.forEach((inv) => {
      const paid = inv.payments.reduce((s, p) => s + p.amountGHS, 0);
      const balance = (inv.totals.grandTotalGHS ?? inv.totals.grandTotal) - paid;
      if (balance <= 0.01) return;

      const daysOverdue = Math.floor(
        (new Date(today).getTime() - new Date(inv.dueDate || inv.date).getTime()) /
          (1000 * 60 * 60 * 24)
      );

      if (daysOverdue <= 0) {
        buckets.current.push(inv);
        totals.current += balance;
      } else if (daysOverdue <= 30) {
        buckets.d30.push(inv);
        totals.d30 += balance;
      } else if (daysOverdue <= 60) {
        buckets.d60.push(inv);
        totals.d60 += balance;
      } else if (daysOverdue <= 90) {
        buckets.d90.push(inv);
        totals.d90 += balance;
      } else {
        buckets.d90plus.push(inv);
        totals.d90plus += balance;
      }
    });

    return { buckets, totals };
  }, [data, today]);

  const bucketMeta = [
    { key: 'current' as const, label: 'Current (Not yet due)', color: GREEN },
    { key: 'd30' as const, label: '1 – 30 days overdue', color: GOLD },
    { key: 'd60' as const, label: '31 – 60 days overdue', color: '#E67E22' },
    { key: 'd90' as const, label: '61 – 90 days overdue', color: ALERT },
    { key: 'd90plus' as const, label: '90+ days overdue', color: '#7B241C' },
  ];

  const totalOutstanding =
    aged.totals.current +
    aged.totals.d30 +
    aged.totals.d60 +
    aged.totals.d90 +
    aged.totals.d90plus;

  /* ---------- Project Profitability ---------- */
  const projReport = useMemo(() => {
    return data.projects.map((p) => {
      const revenue = data.invoices
        .filter((inv) => inv.project === p.id && inv.status !== 'Void')
        .reduce((s, inv) => s + (inv.totals.grandTotalGHS ?? inv.totals.grandTotal), 0);
      const costs = data.journal
        .filter((je) => je.project === p.id)
        .flatMap((je) => je.lines)
        .filter((l) => {
          const acc = data.accounts.find((a) => a.code === l.account);
          return acc && acc.type === 'Expense';
        })
        .reduce((s, l) => s + l.debit, 0);
      const margin = revenue - costs;
      const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;
      return {
        id: p.id,
        name: p.name,
        status: p.status,
        contractValue: p.contractValue ?? 0,
        revenue,
        costs,
        margin,
        marginPct,
      };
    });
  }, [data]);

  return (
    <div>
      {/* ---- Aged Receivables ---- */}
      <SectionTitle sub="Outstanding client balances grouped by how long they have been overdue.">
        Aged Receivables
      </SectionTitle>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        {bucketMeta.map((b) => (
          <Card key={b.key} style={{ flex: '1 1 160px', borderTop: `3px solid ${b.color}` }}>
            <div style={{ fontSize: 11, color: MUTED, fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>
              {b.label}
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 20, fontWeight: 700, color: INK }}>
              GHS {fmt(aged.totals[b.key])}
            </div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
              {aged.buckets[b.key].length} invoice{aged.buckets[b.key].length === 1 ? '' : 's'}
            </div>
          </Card>
        ))}
        <Card style={{ flex: '1 1 160px', borderTop: `3px solid ${INK}` }}>
          <div style={{ fontSize: 11, color: MUTED, fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>
            Total Outstanding
          </div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 20, fontWeight: 700, color: INK }}>
            GHS {fmt(totalOutstanding)}
          </div>
        </Card>
      </div>

      <Card style={{ marginBottom: 32 }}>
        <TableScroll>
          <table className="table-card" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <Th>Client</Th>
                <Th>Invoice #</Th>
                <Th>Date</Th>
                <Th>Due Date</Th>
                <Th right>Days Overdue</Th>
                <Th right>Balance (GHS)</Th>
                <Th>Bucket</Th>
              </tr>
            </thead>
            <tbody>
              {bucketMeta.flatMap((b) =>
                aged.buckets[b.key].map((inv) => {
                  const paid = inv.payments.reduce((s, p) => s + p.amountGHS, 0);
                  const balance = (inv.totals.grandTotalGHS ?? inv.totals.grandTotal) - paid;
                  const days = Math.floor(
                    (new Date(today).getTime() - new Date(inv.dueDate || inv.date).getTime()) /
                      (1000 * 60 * 60 * 24)
                  );
                  return (
                    <tr key={inv.id} className="row-hover">
                      <Td label="Client">{inv.billTo}</Td>
                      <Td mono label="Invoice #">{inv.invoiceNumber}</Td>
                      <Td label="Date">{inv.date}</Td>
                      <Td label="Due Date">{inv.dueDate || '—'}</Td>
                      <Td right mono label="Days Overdue" style={{ color: days > 0 ? ALERT : MUTED }}>
                        {days > 0 ? `+${days}` : '0'}
                      </Td>
                      <Td right mono bold label="Balance">GHS {fmt(balance)}</Td>
                      <Td label="Bucket">
                        <span style={{ color: b.color, fontWeight: 700, fontSize: 11 }}>{b.label}</span>
                      </Td>
                    </tr>
                  );
                })
              )}
              {totalOutstanding === 0 && (
                <tr>
                  <td colSpan={7} style={{ color: MUTED, padding: 14, textAlign: 'center' }}>
                    No outstanding invoices. All paid up!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableScroll>
      </Card>

      {/* ---- Project Profitability ---- */}
      <SectionTitle sub="Revenue billed versus costs booked per project.">Project Profitability</SectionTitle>
      <Card>
        <TableScroll>
          <table className="table-card" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <Th>Project</Th>
                <Th>Status</Th>
                <Th right>Contract Value</Th>
                <Th right>Revenue Billed</Th>
                <Th right>Actual Cost</Th>
                <Th right>Gross Margin</Th>
                <Th right>Margin %</Th>
              </tr>
            </thead>
            <tbody>
              {projReport.map((p) => (
                <tr key={p.id} className="row-hover">
                  <Td label="Project">{p.name}</Td>
                  <Td label="Status">{p.status || '—'}</Td>
                  <Td right mono label="Contract Value">GHS {fmt(p.contractValue)}</Td>
                  <Td right mono label="Revenue Billed">GHS {fmt(p.revenue)}</Td>
                  <Td right mono label="Actual Cost">GHS {fmt(p.costs)}</Td>
                  <Td right mono bold label="Gross Margin" style={{ color: p.margin >= 0 ? GREEN : ALERT }}>
                    GHS {fmt(p.margin)}
                  </Td>
                  <Td right mono bold label="Margin %" style={{ color: p.marginPct >= 0 ? GREEN : ALERT }}>
                    {p.marginPct.toFixed(1)}%
                  </Td>
                </tr>
              ))}
              {projReport.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ color: MUTED, padding: 14, textAlign: 'center' }}>
                    No projects to report.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableScroll>
      </Card>
    </div>
  );
}

// ---------- App ----------
export default function App() {
  useGoogleFonts();
  const isMobile = useIsMobile();
  const [data, setData] = useState(DEFAULT_DATA);
  const [loaded, setLoaded] = useState(false);
  const [authSession, setAuthSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [tab, setTab] = useState(() => {
    if (typeof window === "undefined") return "dashboard";
    const validTabs = [
      "dashboard",
      "accounts",
      "journal",
      "ledger",
      "financials",
      "projects",
      "invoicing",
      "employees",
      "payroll",
      "export",
      "logout",
    ];
    try {
      const saved = window.localStorage.getItem("modulo_tab");
      return validTabs.includes(saved) ? saved : "dashboard";
    } catch {
      return "dashboard";
    }
  });
  const [companyNameDraft, setCompanyNameDraft] = useState("");
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "light";
    try {
      return window.localStorage.getItem("modulo_theme") || "light";
    } catch {
      return "light";
    }
  });
  const [printContent, setPrintContent] = useState(null);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    try {
      window.localStorage.setItem("modulo_theme", theme);
    } catch {
      // localStorage unavailable — theme just won't persist
    }
  }, [theme]);

  useEffect(() => {
    try {
      window.localStorage.setItem("modulo_tab", tab);
    } catch {
      // localStorage unavailable — last tab just won't persist
    }
  }, [tab]);

  useEffect(() => {
    const unsubscribe = onAuthStateChange((session) => {
      setAuthSession(session);
    });

    getSession()
      .then((session) => setAuthSession(session))
      .catch((err) => {
        console.error("Failed to confirm auth session:", err);
      })
      .finally(() => setAuthChecked(true));

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    if (!authSession) return;

    (async () => {
      try {
        const [remote, tax] = await Promise.all([loadLedgerState(), loadTaxConfig()]);

        if (remote) {
          // Use accounts directly from database - no hardcoded fallback.
          // The database is the single source of truth for the chart of accounts.
          const accounts = remote.accounts || [];

          setData({
            ...DEFAULT_DATA,
            ...remote,
            accounts,
            // Company comes entirely from database - no hardcoded fallback
            company: remote.company || COMPANY_TEMPLATE,
            companyName: remote.companyName || "",
            ssnitEmployeeRate: tax.rates.ssnitEmployeeRate,
            ssnitEmployerRate: tax.rates.ssnitEmployerRate,
            nhilGetfundRate: tax.rates.nhilGetfundRate,
            vatRate: tax.rates.vatRate,
            brackets: tax.brackets,
          });
          // companyNameDraft already set above
        } else {
          setCompanyNameDraft("");
          setData((prev) => ({
            ...prev,
            ssnitEmployeeRate: tax.rates.ssnitEmployeeRate,
            ssnitEmployerRate: tax.rates.ssnitEmployerRate,
            nhilGetfundRate: tax.rates.nhilGetfundRate,
            vatRate: tax.rates.vatRate,
            brackets: tax.brackets,
          }));
        }
      } catch (err) {
        console.error("Failed to load ledger data:", err);
        setCompanyNameDraft("");
      }
      setLoaded(true);
    })();
  }, [authChecked, authSession]);

  const mutate = useCallback((fn) => {
    setData((prev) => fn(prev));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        await saveSettings({
          companyName: data.companyName,
          company: data.company,
          nextEntryNum: data.nextEntryNum,
          nextInvoiceNum: data.nextInvoiceNum,
          ssnitEmployeeRate: data.ssnitEmployeeRate,
          ssnitEmployerRate: data.ssnitEmployerRate,
          nhilGetfundRate: data.nhilGetfundRate,
          vatRate: data.vatRate,
        });
      } catch (err) {
        console.error("Failed to save settings:", err);
      }
    })();
  }, [
    loaded,
    data.companyName,
    data.company,
    data.nextEntryNum,
    data.nextInvoiceNum,
    data.ssnitEmployeeRate,
    data.ssnitEmployerRate,
    data.nhilGetfundRate,
    data.vatRate,
  ]);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    setLogoutError("");
    try {
      await signOut();
    } catch (err) {
      console.error("Logout failed:", err);
      setLogoutError(err?.message || "Failed to sign out. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  }, []);

  const LogoutPanel = () => (
    <div>
      <SectionTitle sub="End your session securely.">Logout</SectionTitle>
      <Card style={{ marginBottom: 16, maxWidth: 560 }}>
        <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: MUTED, marginBottom: 18 }}>
          When you log out, your Supabase session will be cleared and you will return to the login screen.
        </p>
        {logoutError && (
          <div style={{ background: "#FFEBEE", color: "#A63D40", padding: 14, borderRadius: 8, marginBottom: 18 }}>
            {logoutError}
          </div>
        )}
        <Button
          onClick={handleLogout}
          icon={X}
          variant="danger"
          disabled={loggingOut}
        >
          {loggingOut ? "Signing out…" : "Sign out"}
        </Button>
      </Card>
    </div>
  );

  function saveCompanyName() {
    mutate((d) => ({ ...d, companyName: companyNameDraft || d.companyName }));
  }

  if (!authChecked) {
    return (
      <div style={{ padding: 40, fontFamily: FONT_BODY, color: MUTED }}>
        Checking authentication…
      </div>
    );
  }

  if (!authSession) {
    return <Login />;
  }

  if (!loaded) {
    return (
      <div style={{ padding: 40, fontFamily: FONT_BODY, color: MUTED }}>
        Loading your ledger…
      </div>
    );
  }

  const nav = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "journal", label: "Journal", icon: PenLine },
    { key: "ledger", label: "Trial Balance", icon: Scale },
    { key: "financials", label: "Financials", icon: TrendingUp },
    { key: "projects", label: "Projects", icon: Briefcase },
    { key: "invoicing", label: "Invoicing", icon: Receipt },
    { key: "employees", label: "Employees", icon: Users },
    { key: "payroll", label: "Payroll", icon: Banknote },
    { key: "reports", label: "Reports", icon: FileText },
    { key: "accounts", label: "Chart of Accounts", icon: BookOpen },
    { key: "export", label: "Export", icon: FileSpreadsheet },
    { key: "logout", label: "Logout", icon: X },
  ];

  const navGroups = [
    {
      label: "Overview",
      keys: ["dashboard", "journal", "ledger", "financials"],
    },
    {
      label: "Operations",
      keys: ["projects", "invoicing", "employees", "payroll"],
    },
    { label: "Setup", keys: ["accounts", "export", "logout"] },
  ];

  const brandInitial = (companyNameDraft || data.companyName || "M")
    .trim()
    .charAt(0)
    .toUpperCase();

  const sidebarContent = (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 22,
          paddingBottom: 18,
          borderBottom: `1px solid ${RULE}`,
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 8,
            background: GREEN,
            color: PAPER,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: 15,
            flexShrink: 0,
          }}
        >
          {brandInitial}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <input
            style={{
              ...inputStyle,
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              fontSize: 15,
              border: "none",
              padding: "2px 0",
              background: "transparent",
            }}
            value={companyNameDraft}
            onChange={(e) => setCompanyNameDraft(e.target.value)}
            onBlur={saveCompanyName}
          />
          <div
            style={{
              fontSize: 10.5,
              color: MUTED,
              letterSpacing: 0.6,
              textTransform: "uppercase",
            }}
          >
            Ledger · GHS
          </div>
        </div>
        <button
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          title="Toggle Theme"
          aria-label="Toggle theme"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: 8,
            border: `1px solid ${RULE}`,
            background: PAPER_RAISED,
            color: INK,
            cursor: "pointer",
            flexShrink: 0,
            transition: "all 0.2s ease",
          }}
        >
          {theme === "light" ? (
            <Sun size={16} color={INK} strokeWidth={2} style={{ display: "block" }} />
          ) : (
            <Moon size={16} color={INK} strokeWidth={2} style={{ display: "block" }} />
          )}
        </button>
      </div>
      {navGroups.map((group) => (
        <div key={group.label} style={{ marginBottom: 18 }}>
          <div
            style={{
              fontSize: 10.5,
              color: MUTED,
              fontWeight: 700,
              letterSpacing: 0.8,
              textTransform: "uppercase",
              padding: "0 9px",
              marginBottom: 6,
            }}
          >
            {group.label}
          </div>
          <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {group.keys.map((k) => {
              const n = nav.find((x) => x.key === k);
              if (!n) return null;
              return (
                <NavItem
                  key={n.key}
                  icon={n.icon}
                  label={n.label}
                  active={tab === n.key}
                  onClick={() => setTab(n.key)}
                />
              );
            })}
          </nav>
        </div>
      ))}
    </>
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        minHeight: "100vh",
        background: PAPER,
        fontFamily: FONT_BODY,
        color: INK,
      }}
    >
      <style>{`
        :root {
          --ink: #1F2A24; --paper: #F7F4EE; --paper-raised: #FFFFFF; --rule: #DCD5C4; --green: #2F5233; --green-deep: #1E3A21; --gold: #A8761A; --alert: #A63D40; --muted: #6B6255; --input-bg: #FFFFFF; --nav-hover: #F1EEE4; --nav-active: #EAF1EA; --success-bg: #EAF1EA; --alert-bg: #F6E8E8;
        }
        .dark {
          --ink: #EAE6DF; --paper: #121615; --paper-raised: #1A2120; --rule: #2E3735; --green: #4CAF50; --green-deep: #1E3A21; --gold: #D4AF37; --alert: #EF5350; --muted: #8A9A91; --input-bg: #121615; --nav-hover: #242B2A; --nav-active: #1E2A24; --success-bg: #1E2A24; --alert-bg: #2A1C1D;
        }
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; padding: 0 !important; margin: 0 !important; background: #fff !important; }
          body { background: white !important; }
          :root { --ink: #000; --paper: #fff; --paper-raised: #fff; --rule: #ccc; --muted: #333; }
        }
        .print-only { display: none; }
        .grid-fin { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; }
        @media (max-width: 768px) { .grid-fin { grid-template-columns: 1fr !important; } }
        .table-card { width: 100%; border-collapse: collapse; background: var(--paper-raised); border-radius: 12px; overflow: hidden; box-shadow: 0 1px 6px rgba(0,0,0,0.06); }
        .table-card th, .table-card td { padding: 14px 16px; }
        .table-card thead tr { background: var(--paper); }
        @media (max-width: 700px) {
          .table-card thead { display: none; }
          .table-card, .table-card tbody, .table-card tr, .table-card td { display: block; width: 100%; box-sizing: border-box; }
          .table-card tr { margin-bottom: 16px; border: 1px solid var(--rule); border-radius: 8px; background: var(--paper-raised); box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
          .table-card td { display: flex; justify-content: space-between; align-items: center; border: none; border-bottom: 1px solid var(--rule); padding: 10px 12px; text-align: right; }
          .table-card td:last-child { border-bottom: none; }
          .table-card td::before { content: attr(data-label); font-weight: 700; font-family: 'Inter', sans-serif; font-size: 11px; color: var(--muted); margin-right: 16px; text-align: left; }
          .table-card tfoot tr { background: var(--paper); border-style: dashed; box-shadow: none; margin-top: 8px; }
          .table-card tfoot td { border-bottom: 1px solid var(--rule); }
        }
        input:focus, select:focus, textarea:focus { outline: none; border-color: var(--green) !important; box-shadow: 0 0 0 2px rgba(75, 175, 80, 0.15); }
        .row-hover:hover { background: var(--nav-hover); }
        .btn-hover:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        @media (max-width: 600px) { .modal-card { padding: 16px !important; } }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: var(--paper); }
        ::-webkit-scrollbar-thumb { background: var(--rule); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--muted); }
      `}</style>

      <div className="no-print" style={{ display: "contents" }}>
        {isMobile ? (
          <div
            style={{
              borderBottom: `1px solid ${RULE}`,
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: PAPER_RAISED,
              position: "sticky",
              top: 0,
              zIndex: 10,
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 7,
                background: GREEN,
                color: PAPER,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: FONT_DISPLAY,
                fontWeight: 700,
                fontSize: 13,
                flexShrink: 0,
              }}
            >
              {brandInitial}
            </div>
            <div
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 700,
                fontSize: 15,
                color: INK,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flex: 1,
              }}
            >
              {data.companyName}
            </div>
            <button
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              title="Toggle Theme"
              aria-label="Toggle dark mode"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                borderRadius: 8,
                border: `1px solid ${RULE}`,
                background: PAPER_RAISED,
                color: INK,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              {theme === "light" ? (
                <Moon size={18} color={INK} strokeWidth={2} style={{ display: "block" }} />
              ) : (
                <Sun size={18} color={INK} strokeWidth={2} style={{ display: "block" }} />
              )}
            </button>
          </div>
        ) : (
          <aside
            style={{
              width: 240,
              borderRight: `1px solid ${RULE}`,
              padding: "24px 14px",
              flexShrink: 0,
              background: PAPER_RAISED,
              boxShadow: "1px 0 20px rgba(0,0,0,0.04)",
              position: "sticky",
              top: 0,
              height: "100vh",
              overflowY: "auto",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {sidebarContent}
          </aside>
        )}

        <main
          style={{
            flex: 1,
            padding: isMobile ? "20px 16px 88px" : "32px 40px",
            maxWidth: isMobile ? "100%" : 1100,
            width: "100%",
            margin: "0 auto",
            minHeight: "100vh",
            boxSizing: "border-box",
            position: "relative",
          }}
        >
          {tab === "dashboard" && (
            <DashboardPanel data={data} setTab={setTab} />
          )}
          {tab === "accounts" && <AccountsPanel data={data} mutate={mutate} />}
          {tab === "journal" && <JournalPanel data={data} mutate={mutate} />}
          {tab === "ledger" && <LedgerPanel data={data} />}
          {tab === "financials" && (
            <FinancialsPanel data={data} setPrintContent={setPrintContent} />
          )}
          {tab === "projects" && <ProjectsPanel data={data} mutate={mutate} />}
          {tab === "invoicing" && (
            <InvoicingPanel
              data={data}
              mutate={mutate}
              setPrintContent={setPrintContent}
            />
          )}
          {tab === "employees" && (
            <EmployeesPanel data={data} mutate={mutate} />
          )}
          {tab === "payroll" && (
            <PayrollPanel
              data={data}
              mutate={mutate}
              setPrintContent={setPrintContent}
            />
          )}
              {tab === "reports" && <ReportsPanel data={data} />}
          {tab === "export" && <ExportPanel data={data} isMobile={isMobile} />}
          {tab === "logout" && <LogoutPanel />}
        </main>

        {isMobile && (
          <nav
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 20,
              background: PAPER_RAISED,
              borderTop: `1px solid ${RULE}`,
              display: "flex",
              overflowX: "auto",
              boxShadow: "0 -2px 10px rgba(0,0,0,0.06)",
            }}
          >
            {nav.map((n) => (
              <BottomNavItem
                key={n.key}
                icon={n.icon}
                label={n.label}
                active={tab === n.key}
                onClick={() => setTab(n.key)}
              />
            ))}
          </nav>
        )}
      </div>

      <div className="print-only">{printContent}</div>
    </div>
  );
}

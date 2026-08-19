import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import {
  BookOpen, PenLine, Scale, Users, Banknote, FileSpreadsheet,
  Briefcase, Receipt, TrendingUp, X, Sun, Moon, LayoutDashboard,
  ArrowUpRight, FileText, MoreHorizontal, Landmark, LogOut,
} from "lucide-react";
import {
  loadLedgerState, loadTaxConfig, saveSettings,
  getSession, onAuthStateChange, signOut
} from "./supabaseClient";
import { loadMyProfile, type UserProfile } from "./supabase/profile";
import { NAV_CONFIG, getNavGroups, getMobileBottomNav, getMobileMoreItems, isAdmin, isCeo, canWrite, ALL } from "./lib/permissions";
import PMDashboard from "./portals/pm/PMDashboard";
import ProjectsBasicList from "./portals/shared/ProjectsBasicList";
import MyPayslipsPanel from "./portals/shared/MyPayslipsPanel";
import MyStatementPanel from "./portals/shared/MyStatementPanel";
import MediaLibraryWrapper from "./portals/shared/MediaLibraryWrapper";
import FieldActivityFeed from "./portals/ceo/FieldActivityFeed";
import Login from "./Login";
import PasswordChangeModal from "./components/PasswordChangeModal";

import { INK, PAPER, PAPER_RAISED, RULE, GREEN, GREEN_DEEP, GOLD, ALERT, MUTED,
         FONT_DISPLAY, FONT_BODY, LOGO_SRC } from "./theme/tokens";
import { COMPANY_TEMPLATE, DEFAULT_DATA } from "./constants/defaults";
import useGoogleFonts from "./hooks/useGoogleFonts";
import useIsMobile from "./hooks/useIsMobile";
import NavItem from "./components/ui/NavItem";
import SectionTitle from "./components/ui/SectionTitle";
import Card from "./components/ui/Card";
import Button from "./components/ui/Button";
import { inputStyle } from "./components/ui/styles";

import DashboardPanel from "./panels/DashboardPanel";
import AccountsPanel from "./panels/AccountsPanel";
import ProjectsPanel from "./panels/ProjectsPanel";
import JournalPanel from "./panels/JournalPanel";
import LedgerPanel from "./panels/LedgerPanel";
import FinancialsPanel from "./panels/FinancialsPanel";
import EmployeesPanel from "./panels/EmployeesPanel";
import NotificationsProvider from "./components/ui/Notifications";
import InvoicingPanel from "./panels/InvoicingPanel";
import PayrollPanel from "./panels/PayrollPanel";
import BillsPanel from "./panels/BillsPanel";
import ExpensesPanel from "./panels/ExpensesPanel";
import AgedPayablesPanel from "./panels/AgedPayablesPanel";
import BankReconciliationPanel from "./panels/BankReconciliationPanel";
import ReportsPanel from "./panels/ReportsPanel";
import ExportPanel from "./panels/ExportPanel";

import type { AppData } from "./types";

export default function App() {
  useGoogleFonts();
  const isMobile = useIsMobile();
  const [data, setData] = useState<AppData>(DEFAULT_DATA);
  const [loaded, setLoaded] = useState(false);
  const [authSession, setAuthSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  // Derive permissions from profile (default to [] = no access)
  const permissions = useMemo(() => profile?.permissions ?? [], [profile]);
  const adminFlag = useMemo(() => isAdmin(permissions), [permissions]);
  const ceoFlag = useMemo(() => isCeo(permissions), [permissions]);
  const canEdit = adminFlag && !ceoFlag; // CEO is never allowed to write

  const [tab, setTab] = useState(() => {
    if (typeof window === "undefined") return "dashboard";
    const validTabs = NAV_CONFIG.map((n) => n.key);
    try {
      const saved = window.localStorage.getItem("modulo_tab");
      return validTabs.includes(saved) ? saved : "dashboard";
    } catch {
      return "dashboard";
    }
  });
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "light";
    try {
      return window.localStorage.getItem("modulo_theme") || "light";
    } catch {
      return "light";
    }
  });
  const [showMenu, setShowMenu] = useState(false);
  const [printContent, setPrintContent] = useState<ReactNode>(null);
  const [printRequest, setPrintRequest] = useState(0);

  const queuePrint = useCallback((content: ReactNode) => {
    setPrintContent(content);
    setPrintRequest((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!printRequest) return;
    const frame = window.requestAnimationFrame(() => {
      try {
        window.print();
      } finally {
        document.title = "Modulo Ledger";
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [printRequest]);

  // Dynamic nav derived from permissions
  const navGroups = useMemo(() => getNavGroups(permissions), [permissions]);
  const mobileBottomKeys = useMemo(() => getMobileBottomNav(permissions).map((n) => n.key), [permissions]);
  const mobileMoreItems = useMemo(() => getMobileMoreItems(permissions), [permissions]);

  // Auto-redirect to first available tab if current tab isn't accessible
  const accessibleKeys = useMemo(
    () => new Set([...navGroups.flatMap((g) => g.keys), "logout"]),
    [navGroups]
  );
  const effectiveTab = accessibleKeys.has(tab) ? tab : (navGroups[0]?.keys[0] || "dashboard");

  // Resolve icon for a nav key
  function navIcon(key: string) {
    return NAV_CONFIG.find((n) => n.key === key)?.icon ?? LayoutDashboard;
  }
  function navLabel(key: string) {
    return NAV_CONFIG.find((n) => n.key === key)?.label ?? key;
  }

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    try { window.localStorage.setItem("modulo_theme", theme); } catch {}
  }, [theme]);

  useEffect(() => {
    try { window.localStorage.setItem("modulo_tab", tab); } catch {}
  }, [tab]);

  // Auth: check session
  useEffect(() => {
    const unsubscribe = onAuthStateChange((session) => setAuthSession(session));
    getSession()
      .then((session) => setAuthSession(session))
      .catch((err) => console.error("Failed to confirm auth session:", err))
      .finally(() => setAuthChecked(true));
    return unsubscribe;
  }, []);

  // After auth confirmed: load profile, then load data
  useEffect(() => {
    if (!authChecked || !authSession) return;
    (async () => {
      try {
        // 1. Load user profile (position + permissions)
        const p = await loadMyProfile();
        setProfile(p);

        // 2. Load data based on permissions
        const tax = await loadTaxConfig();

        if (p && (p.permissions.includes(ALL) || p.permissions.includes("ceo:access"))) {
          // Admin or CEO: full data load
          const remote = await loadLedgerState();
          if (remote) {
            setData({
              ...DEFAULT_DATA,
              ...remote,
              accounts: remote.accounts || [],
              company: remote.company || COMPANY_TEMPLATE,
              companyName: remote.companyName || "",
              ssnitEmployeeRate: tax.rates.ssnitEmployeeRate,
              ssnitEmployerRate: tax.rates.ssnitEmployerRate,
              nhilGetfundRate: tax.rates.nhilGetfundRate,
              vatRate: tax.rates.vatRate,
              brackets: tax.brackets,
            });
          } else {
            setData((prev) => ({ ...prev,
              ssnitEmployeeRate: tax.rates.ssnitEmployeeRate,
              ssnitEmployerRate: tax.rates.ssnitEmployerRate,
              nhilGetfundRate: tax.rates.nhilGetfundRate,
              vatRate: tax.rates.vatRate,
              brackets: tax.brackets,
            }));
          }
        } else {
          // Non-admin: load read-only data needed for portal panels
          try {
            const remote = await loadLedgerState();
            if (remote) {
              setData((prev) => ({ ...prev,
                companyName: remote.companyName || "",
                company: remote.company || COMPANY_TEMPLATE,
                projects: remote.projects || [],
                employees: remote.employees || [],
                payrollRuns: remote.payrollRuns || [],
                ssnitEmployeeRate: tax.rates.ssnitEmployeeRate,
                ssnitEmployerRate: tax.rates.ssnitEmployerRate,
                nhilGetfundRate: tax.rates.nhilGetfundRate,
                vatRate: tax.rates.vatRate,
                brackets: tax.brackets,
              }));
            } else {
              setData((prev) => ({ ...prev,
                ssnitEmployeeRate: tax.rates.ssnitEmployeeRate,
                ssnitEmployerRate: tax.rates.ssnitEmployerRate,
                nhilGetfundRate: tax.rates.nhilGetfundRate,
                vatRate: tax.rates.vatRate,
                brackets: tax.brackets,
              }));
            }
          } catch (err) {
            console.error("Failed to load portal data:", err);
            setData((prev) => ({ ...prev,
              ssnitEmployeeRate: tax.rates.ssnitEmployeeRate,
              ssnitEmployerRate: tax.rates.ssnitEmployerRate,
              nhilGetfundRate: tax.rates.nhilGetfundRate,
              vatRate: tax.rates.vatRate,
              brackets: tax.brackets,
            }));
          }
        }
      } catch (err) {
        const msg = err instanceof Error
          ? `${err.name}: ${err.message}\n${err.stack ?? ''}`
          : `Non-Error thrown: ${JSON.stringify(err, null, 2)}`;
        console.error("Failed to load profile/data — " + msg);
      }
      setLoaded(true);
    })();
  }, [authChecked, authSession]);

  const mutate = useCallback((fn: (prev: AppData) => AppData) => {
    setData((prev) => fn(prev));
  }, []);

  useEffect(() => {
    if (!loaded || !canEdit) return;
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
    loaded, canEdit, data.companyName, data.company, data.nextEntryNum, data.nextInvoiceNum,
    data.ssnitEmployeeRate, data.ssnitEmployerRate, data.nhilGetfundRate, data.vatRate,
  ]);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    setLogoutError("");
    try { await signOut(); }
    catch (err) { setLogoutError(err?.message || "Failed to sign out. Please try again."); }
    finally { setLoggingOut(false); }
  }, []);

  if (!authChecked) {
    return <div style={{ padding: 40, fontFamily: FONT_BODY, color: MUTED }}>Checking authentication…</div>;
  }
  if (!authSession) return <Login />;
  if (!loaded) {
    return <div style={{ padding: 40, fontFamily: FONT_BODY, color: MUTED }}>Loading your ledger…</div>;
  }
  if (profile?.onboardingStatus === "invited") {
    window.location.href = "/complete-onboarding";
    return <div style={{ padding: 40, fontFamily: FONT_BODY, color: MUTED }}>Redirecting to set up your account…</div>;
  }

  const brandInitial = (data.companyName || "M").trim().charAt(0).toUpperCase();

  const sidebarContent = (
    <>
      {/* TOP: Brand header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${RULE}`, flexShrink: 0 }}>
        <div style={{ position: 'relative', width: 40, height: 40, borderRadius: 10, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'linear-gradient(135deg, var(--green), var(--green-deep))', boxShadow: '0 2px 6px rgba(47,82,51,0.2)' }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 17, color: '#FFFFFF', zIndex: 0 }}>{brandInitial}</div>
          <img src={LOGO_SRC} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'relative', zIndex: 1 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>{data.companyName || "Modulo"}</div>
            <div style={{ fontSize: 10.5, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 2, fontWeight: 500 }}>{profile?.positionTitle || "Ledger"} · GHS</div>
          </div>
        <button onClick={() => setTheme(theme === "light" ? "dark" : "light")} title="Toggle Theme" aria-label="Toggle theme" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 8, border: `1px solid ${RULE}`, background: PAPER_RAISED, color: INK, cursor: "pointer", flexShrink: 0, transition: "all 0.2s ease" }}>
          {theme === "light" ? <Sun size={15} color={INK as any} strokeWidth={2} /> : <Moon size={15} color={INK as any} strokeWidth={2} />}
        </button>
      </div>

      {/* User Profile Card */}
      {profile && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", marginBottom: 16, borderRadius: 10, background: PAPER, border: `1px solid ${RULE}`, flexShrink: 0 }}>
          <div style={{ position: 'relative', width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg, var(--green), var(--green-deep))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: '#FFFFFF', flexShrink: 0 }}>
            {(profile.employeeName || "?").charAt(0).toUpperCase()}
            <span style={{ position: 'absolute', bottom: -1, right: -1, width: 10, height: 10, borderRadius: "50%", background: '#4CAF50', border: "2px solid " + PAPER }} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 13, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>{profile.employeeName}</div>
            <div style={{ fontSize: 10.5, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 1, fontWeight: 500 }}>{profile.positionTitle || "User"}</div>
          </div>
          <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: 'rgba(47,82,51,0.06)', color: 'var(--green)' }}>Online</div>
        </div>
      )}

      {/* MIDDLE: Scrollable navigation items */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        {navGroups.map((group, gi) => (
          <div key={group.label} style={{ marginBottom: gi < navGroups.length - 1 ? 20 : 0 }}>
            <div style={{ fontSize: 10.5, color: MUTED, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", padding: "0 9px", marginBottom: 6 }}>{group.label}</div>
            <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {group.keys.filter((k) => k !== "logout").map((k) => {
                const Icon = navIcon(k);
                return <NavItem key={k} icon={Icon} label={navLabel(k)} active={effectiveTab === k} onClick={() => setTab(k)} />;
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* BOTTOM: Modern logout button */}
      <div style={{ paddingTop: 12, borderTop: `1px solid ${RULE}`, flexShrink: 0, marginTop: 16 }}>
        {navGroups.flatMap((group) => group.keys).includes("logout") && (
          <button onClick={() => setTab("logout")} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${RULE}`, background: PAPER, color: ALERT, fontFamily: FONT_BODY, fontSize: 13, fontWeight: 500, cursor: "pointer", textAlign: "left", transition: "all 0.2s ease" }}>
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 8, background: 'rgba(166, 61, 64, 0.08)' }}>
              <LogOut size={15} strokeWidth={2} />
            </span>
            <span>Logout</span>
          </button>
        )}
      </div>
    </>
  );

  return (
    <NotificationsProvider>
    <div className="app-root" style={{ display: "flex", flexDirection: isMobile ? "column" : "row", height: "100vh", overflow: isMobile ? "auto" : "hidden", background: PAPER, fontFamily: FONT_BODY, color: INK }}>
      <style>{`
        :root {
          --ink: #1F2A24; --paper: #F7F4EE; --paper-raised: #FFFFFF; --rule: #DCD5C4;
          --green: #2F5233; --green-deep: #1E3A21; --gold: #A8761A; --alert: #A63D40;
          --muted: #6B6255; --input-bg: #FFFFFF; --nav-hover: #F1EEE4;
          --nav-active: #EAF1EA; --success-bg: #EAF1EA; --alert-bg: #F6E8E8;
        }
        .dark {
          --ink: #EAE6DF; --paper: #121615; --paper-raised: #1A2120; --rule: #2E3735;
          --green: #4CAF50; --green-deep: #1E3A21; --gold: #D4AF37; --alert: #EF5350;
          --muted: #8A9A91; --input-bg: #121615; --nav-hover: #242B2A;
          --nav-active: #1E2A24; --success-bg: #1E2A24; --alert-bg: #2A1C1D;
        }
        @media print {
          @page { size: A4; margin: 14mm 12mm; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          html, body, #root { overflow: visible !important; height: auto !important; max-height: none !important; }
          .no-print { display: none !important; }
          .print-only {
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #fff !important;
            overflow: visible !important;
            position: static !important;
            height: auto !important;
            max-height: none !important;
          }
          body { background: white !important; margin: 0; padding: 0; }
          :root { --ink: #000; --paper: #fff; --paper-raised: #fff; --rule: #ccc; --muted: #333; }
          .fin-page { page-break-after: always; page-break-inside: avoid; display: block; width: 100%; }
          .fin-page:last-child { page-break-after: auto; }
          .fin-page + .fin-page { page-break-before: always; }
          .fin-page tr { page-break-inside: avoid; }
          .fin-page thead { display: table-header-group; }
          /* Ensure the app container doesn't reserve a full viewport height during print */
          .app-root { height: auto !important; min-height: auto !important; overflow: visible !important; }
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
        @keyframes modMenuIn { from { opacity: 0; transform: translateY(12px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>

      <div className="no-print" style={{ display: "contents" }}>
        {isMobile ? (
          <div style={{ borderBottom: `1px solid ${RULE}`, padding: "8px 14px", display: "flex", alignItems: "center", gap: 10, background: PAPER_RAISED, position: "sticky", top: 0, zIndex: 10 }}>
            {/* Logo — left */}
            <div style={{ position: 'relative', flexShrink: 0, width: 30, height: 30, borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, var(--green), var(--green-deep))' }}>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: '#FFFFFF' }}>{brandInitial}</div>
              <img src={LOGO_SRC} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'relative', zIndex: 1 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
            {/* Company name and user — center */}
            <div style={{ flex: 1, minWidth: 0, textAlign: "center", overflow: "hidden" }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>{data.companyName || "Modulo"}</div>
              {profile?.employeeName && (
                <div style={{ fontSize: 9.5, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 1, fontWeight: 500 }}>{profile.employeeName}</div>
              )}
            </div>
            {/* Theme toggle — right */}
            <button onClick={() => setTheme(theme === "light" ? "dark" : "light")} title="Toggle Theme" aria-label="Toggle dark mode" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 8, border: `1px solid ${RULE}`, background: PAPER_RAISED, color: INK, cursor: "pointer", flexShrink: 0 }}>
              {theme === "light" ? <Moon size={17} color={INK as any} strokeWidth={2} /> : <Sun size={17} color={INK as any} strokeWidth={2} />}
            </button>
          </div>
        ) : (
          <aside style={{ width: 250, borderRight: `1px solid ${RULE}`, padding: "22px 12px", flexShrink: 0, background: PAPER_RAISED, boxShadow: "1px 0 24px rgba(0,0,0,0.05)", position: "sticky", top: 0, height: "100vh", overflowY: "hidden", boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
            {sidebarContent}
          </aside>
        )}

        <main style={{ flex: 1, padding: isMobile ? "20px 16px 20px" : "32px 40px", width: "100%", margin: 0, height: isMobile ? "auto" : "100vh", overflowY: isMobile ? "visible" : "auto", overflowX: "hidden", minWidth: 0, boxSizing: "border-box", position: "relative" }}>
          {/* Admin panels */}
          {effectiveTab === "dashboard" && (adminFlag || ceoFlag) && <DashboardPanel data={data} setTab={setTab} />}
          {effectiveTab === "accounts" && canEdit && <AccountsPanel data={data} mutate={mutate} />}
          {effectiveTab === "journal" && (adminFlag || ceoFlag) && <JournalPanel data={data} mutate={canEdit ? mutate : undefined} readOnly={ceoFlag} />}
          {effectiveTab === "ledger" && (adminFlag || ceoFlag) && <LedgerPanel data={data} />}
          {effectiveTab === "financials" && (adminFlag || ceoFlag) && <FinancialsPanel data={data} setPrintContent={queuePrint} />}
          {effectiveTab === "projects" && <ProjectsPanel data={data} mutate={canEdit ? mutate : undefined} />}
          {effectiveTab === "invoicing" && (adminFlag || ceoFlag) && <InvoicingPanel data={data} mutate={canEdit ? mutate : undefined} setPrintContent={queuePrint} />}
          {effectiveTab === "employees" && (adminFlag || ceoFlag) && <EmployeesPanel data={data} mutate={canEdit ? mutate : undefined} />}
          {effectiveTab === "payroll" && (adminFlag || ceoFlag) && <PayrollPanel data={data} mutate={canEdit ? mutate : undefined} setPrintContent={queuePrint} />}
          {effectiveTab === "bills" && (adminFlag || ceoFlag) && <BillsPanel data={data} mutate={canEdit ? mutate : undefined} />}
          {effectiveTab === "expenses" && canEdit && <ExpensesPanel data={data} mutate={mutate} />}
          {effectiveTab === "aged-payables" && (adminFlag || ceoFlag) && <AgedPayablesPanel data={data} />}
          {effectiveTab === "bank-reconciliation" && canEdit && <BankReconciliationPanel data={data} mutate={mutate} />}
          {effectiveTab === "reports" && (adminFlag || ceoFlag) && <ReportsPanel data={data} />}
          {effectiveTab === "field-activity" && <FieldActivityFeed />}
          {effectiveTab === "export" && canEdit && <ExportPanel data={data} isMobile={isMobile} />}

          {/* PM Portal */}
          {effectiveTab === "pm-dashboard" && !adminFlag && !ceoFlag && <PMDashboard />}

          {/* Shared portal panels — visible to non-admin with relevant tokens */}
          {effectiveTab === "my-payslips" && !adminFlag && !ceoFlag && profile && <MyPayslipsPanel data={data} profile={profile} />}
          {effectiveTab === "my-statement" && !adminFlag && !ceoFlag && profile && <MyStatementPanel data={data} profile={profile} />}
          {effectiveTab === "media-library" && !adminFlag && !ceoFlag && <MediaLibraryWrapper />}

          {/* Non-admin limited dashboard — shows projects list */}
          {effectiveTab === "dashboard" && !adminFlag && !ceoFlag && <ProjectsBasicList />}

          {effectiveTab === "logout" && (
            <div style={{ maxWidth: 520 }}>
              <SectionTitle sub="End your session securely.">Logout</SectionTitle>
              <Card style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 18 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(166, 61, 64, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    <LogOut size={20} color={ALERT} strokeWidth={2} />
                  </div>
                  <div>
                    <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: MUTED, margin: 0, lineHeight: 1.6 }}>When you log out, your Supabase session will be cleared and you will return to the login screen.</p>
                    {logoutError && <div style={{ background: "#FFEBEE", color: "#A63D40", padding: 12, borderRadius: 8, marginTop: 12, fontSize: 13 }}>{logoutError}</div>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button onClick={() => setTab("dashboard")} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${RULE}`, background: PAPER_RAISED, color: INK, fontFamily: FONT_BODY, fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "all 0.2s ease" }}>Cancel</button>
                  <Button onClick={handleLogout} variant="danger" disabled={loggingOut}>{loggingOut ? "Signing out…" : "Sign out"}</Button>
                </div>
              </Card>
            </div>
          )}
        </main>

        {isMobile && (
          <>
            <div style={{ height: 90 }} />
            {showMenu && (
              <div onClick={() => setShowMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 55 }}>
                <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", bottom: 96, right: 16, left: 16, maxWidth: 360, marginLeft: "auto", background: "rgba(31,41,55,0.92)", backdropFilter: "blur(24px) saturate(1.4)", WebkitBackdropFilter: "blur(24px) saturate(1.4)", borderRadius: 20, boxShadow: "0 -4px 40px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06)", padding: "8px 0", maxHeight: "60vh", overflowY: "auto", animation: "modMenuIn 0.28s cubic-bezier(0.16,1,0.3,1) forwards" }}>
                  {mobileMoreItems.length > 0 && mobileMoreItems.map((item) => {
                    const NavIcon = item.icon;
                    const active = effectiveTab === item.key;
                    return (
                      <button key={item.key} onClick={() => { setTab(item.key); setShowMenu(false); }} style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", padding: "11px 20px", border: "none", cursor: "pointer", textAlign: "left", background: active ? "rgba(212,175,55,0.1)" : "transparent", color: active ? "#D4AF37" : "rgba(255,255,255,0.75)", fontFamily: FONT_BODY, fontSize: 14, fontWeight: active ? 600 : 400, transition: "background 0.15s ease, color 0.15s ease" }}>
                        <NavIcon size={17} style={{ flexShrink: 0, opacity: active ? 1 : 0.7 }} />
                        <span>{item.label}</span>
                        {active && <span style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: "#D4AF37" }} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div style={{ position: "fixed", bottom: 16, left: 16, right: 16, height: 68, background: "rgba(31,41,55,0.78)", backdropFilter: "blur(20px) saturate(1.3)", WebkitBackdropFilter: "blur(20px) saturate(1.3)", borderRadius: 34, display: "flex", alignItems: "center", justifyContent: "space-around", zIndex: 50, boxShadow: "0 8px 32px rgba(31,41,55,0.4), 0 0 0 1px rgba(255,255,255,0.05)", padding: "0 2px" }}>
              {mobileBottomKeys.map((key, idx) => {
                const Icon = navIcon(key);
                const active = effectiveTab === key;
                const isCenter = idx === Math.floor(mobileBottomKeys.length / 2);
                return (
                  <button key={key} onClick={() => setTab(key)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", cursor: "pointer", padding: isCenter ? "0 2px" : "4px 6px", borderRadius: 20, transition: "all 0.25s ease" }}>
                    <div style={{ width: isCenter ? 46 : 36, height: isCenter ? 46 : 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: active ? "2px solid #D4AF37" : "2px solid transparent", background: isCenter ? (active ? "linear-gradient(135deg, #D4AF37, #B8962E)" : "linear-gradient(135deg, rgba(212,175,55,0.25), rgba(184,150,46,0.15))") : "transparent", boxShadow: isCenter && active ? "0 4px 20px rgba(212,175,55,0.45), 0 0 0 3px rgba(212,175,55,0.2)" : "0 2px 8px rgba(0,0,0,0.15)", transition: "all 0.3s cubic-bezier(0.16,1,0.3,1)", marginTop: isCenter ? -8 : 0 }}>
                      <Icon size={isCenter ? 21 : 18} style={{ color: isCenter ? (active ? "#1F2937" : "#D4AF37") : (active ? "#D4AF37" : "#9CA3AF"), transition: "color 0.25s ease" }} />
                    </div>
                    <span style={{ fontSize: 8.5, fontWeight: active ? (isCenter ? 700 : 600) : 500, lineHeight: 1, color: active ? "#D4AF37" : "#9CA3AF", transition: "color 0.25s ease", marginTop: isCenter ? 1 : 0 }}>{navLabel(key)}</span>
                  </button>
                );
              })}
              {mobileMoreItems.length > 0 && (
                <button onClick={() => setShowMenu((s) => !s)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", cursor: "pointer", padding: "4px 6px", borderRadius: 20, transition: "all 0.25s ease" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: showMenu ? "2px solid #D4AF37" : "2px solid transparent", transition: "all 0.25s ease" }}>
                    <MoreHorizontal size={18} style={{ color: showMenu ? "#D4AF37" : "#9CA3AF", transition: "color 0.25s ease" }} />
                  </div>
                  <span style={{ fontSize: 8.5, fontWeight: showMenu ? 600 : 500, lineHeight: 1, color: showMenu ? "#D4AF37" : "#9CA3AF", transition: "color 0.25s ease" }}>More</span>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
    <div className="print-only">{printContent}</div>
    </NotificationsProvider>
  );
}

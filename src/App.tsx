import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import {
  BookOpen, PenLine, Scale, Users, Banknote, FileSpreadsheet,
  Briefcase, Receipt, TrendingUp, X, Sun, Moon, LayoutDashboard,
  ArrowUpRight, FileText, MoreHorizontal, Landmark,
} from "lucide-react";
import {
  loadLedgerState, loadTaxConfig, saveSettings,
  getSession, onAuthStateChange, signOut
} from "./supabaseClient";
import { loadMyProfile, type UserProfile } from "./supabase/profile";
import { NAV_CONFIG, getNavGroups, getMobileBottomNav, getMobileMoreItems, ALL } from "./lib/permissions";
import Login from "./Login.jsx";

import { INK, PAPER, PAPER_RAISED, RULE, GREEN, GREEN_DEEP, GOLD, ALERT, MUTED,
         FONT_DISPLAY, FONT_BODY } from "./theme/tokens";
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
  const isAdmin = useMemo(() => permissions.includes(ALL), [permissions]);

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
  const [companyNameDraft, setCompanyNameDraft] = useState("");
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

  // Dynamic nav derived from permissions
  const navGroups = useMemo(() => getNavGroups(permissions), [permissions]);
  const mobileBottomKeys = useMemo(() => getMobileBottomNav(permissions).map((n) => n.key), [permissions]);
  const mobileMoreItems = useMemo(() => getMobileMoreItems(permissions), [permissions]);

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

        if (p && p.permissions.includes(ALL)) {
          // Admin: full data load
          const remote = await loadLedgerState();
          if (remote) {
            setCompanyNameDraft(remote.companyName || "");
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
            setCompanyNameDraft("");
            setData((prev) => ({ ...prev,
              ssnitEmployeeRate: tax.rates.ssnitEmployeeRate,
              ssnitEmployerRate: tax.rates.ssnitEmployerRate,
              nhilGetfundRate: tax.rates.nhilGetfundRate,
              vatRate: tax.rates.vatRate,
              brackets: tax.brackets,
            }));
          }
        } else {
          // Non-admin: minimal data (projects list loaded on-demand by portal panels)
          setCompanyNameDraft("");
          setData((prev) => ({ ...prev,
            ssnitEmployeeRate: tax.rates.ssnitEmployeeRate,
            ssnitEmployerRate: tax.rates.ssnitEmployerRate,
            nhilGetfundRate: tax.rates.nhilGetfundRate,
            vatRate: tax.rates.vatRate,
            brackets: tax.brackets,
          }));
        }
      } catch (err) {
        console.error("Failed to load profile/data:", err);
        setCompanyNameDraft("");
      }
      setLoaded(true);
    })();
  }, [authChecked, authSession]);

  const mutate = useCallback((fn: (prev: AppData) => AppData) => {
    setData((prev) => fn(prev));
  }, []);

  useEffect(() => {
    if (!loaded || !isAdmin) return;
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
    loaded, isAdmin, data.companyName, data.company, data.nextEntryNum, data.nextInvoiceNum,
    data.ssnitEmployeeRate, data.ssnitEmployerRate, data.nhilGetfundRate, data.vatRate,
  ]);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    setLogoutError("");
    try { await signOut(); }
    catch (err) { setLogoutError(err?.message || "Failed to sign out. Please try again."); }
    finally { setLoggingOut(false); }
  }, []);

  function saveCompanyName() {
    mutate((d) => ({ ...d, companyName: companyNameDraft || d.companyName }));
  }

  if (!authChecked) {
    return <div style={{ padding: 40, fontFamily: FONT_BODY, color: MUTED }}>Checking authentication…</div>;
  }
  if (!authSession) return <Login />;
  if (!loaded) {
    return <div style={{ padding: 40, fontFamily: FONT_BODY, color: MUTED }}>Loading your ledger…</div>;
  }

  // Auto-redirect to first available tab if current tab isn't accessible
  const accessibleKeys = useMemo(
    () => new Set([...navGroups.flatMap((g) => g.keys), "logout"]),
    [navGroups]
  );
  const effectiveTab = accessibleKeys.has(tab) ? tab : (navGroups[0]?.keys[0] || "dashboard");

  const brandInitial = (companyNameDraft || data.companyName || "M").trim().charAt(0).toUpperCase();

  const sidebarContent = (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22, paddingBottom: 18, borderBottom: `1px solid ${RULE}` }}>
        <div style={{ width: 38, height: 38, borderRadius: 8, background: GREEN, color: PAPER, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, flexShrink: 0 }}>{brandInitial}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          {isAdmin && (
            <input style={{ ...inputStyle, fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, border: "none", padding: "2px 0", background: "transparent" }} value={companyNameDraft} onChange={(e) => setCompanyNameDraft(e.target.value)} onBlur={saveCompanyName} />
          )}
          {!isAdmin && <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15 }}>{data.companyName}</div>}
          <div style={{ fontSize: 10.5, color: MUTED, letterSpacing: 0.6, textTransform: "uppercase" }}>
            {profile?.positionTitle || "Ledger"} · GHS
          </div>
        </div>
        <button onClick={() => setTheme(theme === "light" ? "dark" : "light")} title="Toggle Theme" aria-label="Toggle theme" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 8, border: `1px solid ${RULE}`, background: PAPER_RAISED, color: INK, cursor: "pointer", flexShrink: 0, transition: "all 0.2s ease" }}>
          {theme === "light" ? <Sun size={16} color={INK as any} strokeWidth={2} /> : <Moon size={16} color={INK as any} strokeWidth={2} />}
        </button>
      </div>
      {navGroups.map((group) => (
        <div key={group.label} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 10.5, color: MUTED, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", padding: "0 9px", marginBottom: 6 }}>{group.label}</div>
          <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {group.keys.map((k) => {
              const Icon = navIcon(k);
              return <NavItem key={k} icon={Icon} label={navLabel(k)} active={effectiveTab === k} onClick={() => setTab(k)} />;
            })}
          </nav>
        </div>
      ))}
      <div style={{ marginTop: "auto", paddingTop: 12, borderTop: `1px solid ${RULE}` }}>
        <NavItem icon={X} label="Logout" active={effectiveTab === "logout"} onClick={() => setTab("logout")} />
      </div>
    </>
  );

  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", height: "100vh", overflow: "hidden", background: PAPER, fontFamily: FONT_BODY, color: INK }}>
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
        @keyframes modMenuIn { from { opacity: 0; transform: translateY(12px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>

      <div className="no-print" style={{ display: "contents" }}>
        {isMobile ? (
          <div style={{ borderBottom: `1px solid ${RULE}`, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, background: PAPER_RAISED, position: "sticky", top: 0, zIndex: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 7, background: GREEN, color: PAPER, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{brandInitial}</div>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{data.companyName}</div>
            <button onClick={() => setTheme(theme === "light" ? "dark" : "light")} title="Toggle Theme" aria-label="Toggle dark mode" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 8, border: `1px solid ${RULE}`, background: PAPER_RAISED, color: INK, cursor: "pointer", flexShrink: 0 }}>
              {theme === "light" ? <Moon size={18} color={INK as any} strokeWidth={2} /> : <Sun size={18} color={INK as any} strokeWidth={2} />}
            </button>
          </div>
        ) : (
          <aside style={{ width: 240, borderRight: `1px solid ${RULE}`, padding: "24px 14px", flexShrink: 0, background: PAPER_RAISED, boxShadow: "1px 0 20px rgba(0,0,0,0.04)", position: "sticky", top: 0, height: "100vh", overflowY: "auto", boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
            {sidebarContent}
          </aside>
        )}

        <main style={{ flex: 1, padding: isMobile ? "20px 16px 20px" : "32px 40px", width: "100%", margin: 0, height: isMobile ? "auto" : "100vh", overflowY: isMobile ? "visible" : "auto", boxSizing: "border-box", position: "relative" }}>
          {/* Admin panels */}
          {effectiveTab === "dashboard" && isAdmin && <DashboardPanel data={data} setTab={setTab} />}
          {effectiveTab === "accounts" && isAdmin && <AccountsPanel data={data} mutate={mutate} />}
          {effectiveTab === "journal" && isAdmin && <JournalPanel data={data} mutate={mutate} />}
          {effectiveTab === "ledger" && isAdmin && <LedgerPanel data={data} />}
          {effectiveTab === "financials" && isAdmin && <FinancialsPanel data={data} setPrintContent={setPrintContent} />}
          {effectiveTab === "projects" && <ProjectsPanel data={data} mutate={mutate} />}
          {effectiveTab === "invoicing" && isAdmin && <InvoicingPanel data={data} mutate={mutate} setPrintContent={setPrintContent} />}
          {effectiveTab === "employees" && isAdmin && <EmployeesPanel data={data} mutate={mutate} />}
          {effectiveTab === "payroll" && isAdmin && <PayrollPanel data={data} mutate={mutate} setPrintContent={setPrintContent} />}
          {effectiveTab === "bills" && isAdmin && <BillsPanel data={data} mutate={mutate} />}
          {effectiveTab === "expenses" && isAdmin && <ExpensesPanel data={data} mutate={mutate} />}
          {effectiveTab === "aged-payables" && isAdmin && <AgedPayablesPanel data={data} />}
          {effectiveTab === "bank-reconciliation" && isAdmin && <BankReconciliationPanel data={data} mutate={mutate} />}
          {effectiveTab === "reports" && isAdmin && <ReportsPanel data={data} />}
          {effectiveTab === "export" && isAdmin && <ExportPanel data={data} isMobile={isMobile} />}

          {/* Non-admin portal panels — placeholder for now, built in Phase 2-3 */}
          {effectiveTab === "pm-dashboard" && !isAdmin && (
            <div>
              <SectionTitle sub="Your assigned projects and pending tasks.">My Projects</SectionTitle>
              <Card style={{ padding: 40, textAlign: "center" }}>
                <div style={{ fontSize: 14, color: MUTED }}>PM Dashboard — coming in Phase 2</div>
              </Card>
            </div>
          )}
          {effectiveTab === "my-payslips" && !isAdmin && (
            <div>
              <SectionTitle sub="View your payslip history.">My Payslips</SectionTitle>
              <Card style={{ padding: 40, textAlign: "center" }}>
                <div style={{ fontSize: 14, color: MUTED }}>My Payslips — coming in Phase 3</div>
              </Card>
            </div>
          )}
          {effectiveTab === "my-statement" && !isAdmin && (
            <div>
              <SectionTitle sub="Your year-to-date earnings summary.">My Statement</SectionTitle>
              <Card style={{ padding: 40, textAlign: "center" }}>
                <div style={{ fontSize: 14, color: MUTED }}>My Statement — coming in Phase 3</div>
              </Card>
            </div>
          )}
          {effectiveTab === "dashboard" && !isAdmin && (
            <div>
              <SectionTitle sub="Welcome back.">Dashboard</SectionTitle>
              <Card style={{ padding: 40, textAlign: "center" }}>
                <div style={{ fontSize: 14, color: MUTED }}>Limited dashboard — coming in Phase 2-3</div>
              </Card>
            </div>
          )}

          {effectiveTab === "logout" && (
            <div>
              <SectionTitle sub="End your session securely.">Logout</SectionTitle>
              <Card style={{ marginBottom: 16, maxWidth: 560 }}>
                <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: MUTED, marginBottom: 18 }}>When you log out, your Supabase session will be cleared and you will return to the login screen.</p>
                {logoutError && <div style={{ background: "#FFEBEE", color: "#A63D40", padding: 14, borderRadius: 8, marginBottom: 18 }}>{logoutError}</div>}
                <Button onClick={handleLogout} icon={X} variant="danger" disabled={loggingOut}>{loggingOut ? "Signing out…" : "Sign out"}</Button>
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
      <div className="print-only">{printContent}</div>
    </div>
  );
}

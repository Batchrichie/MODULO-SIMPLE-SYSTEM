import React, { useEffect } from "react";
import type { ComponentType, ReactNode } from "react";
import { CheckCircle2, Lock } from "lucide-react";
import CompanyLogo from "./CompanyLogo";
import {
  PAPER, PAPER_RAISED, RULE, GREEN, GREEN_DEEP, GOLD, FONT_DISPLAY, FONT_BODY,
} from "../../theme/tokens";

export interface AuthFeature {
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  text: string;
  sub: string;
}

export interface AuthShellProps {
  formTitle: string;
  formSubtitle?: string;
  children: ReactNode;
  features?: AuthFeature[];
  badges?: string[];
  footer?: ReactNode;
}

function useAuthTheme() {
  const isDark = typeof window !== "undefined" && window.localStorage.getItem("modulo_theme") === "dark";
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add("dark");
    else root.classList.remove("dark");
  }, [isDark]);
  return isDark;
}

export function AuthStatusScreen({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  useAuthTheme();
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: PAPER, fontFamily: FONT_BODY, padding: 20,
    }}>
      <div style={{
        background: PAPER_RAISED, borderRadius: 16, padding: "36px 28px",
        border: `1px solid ${RULE}`, maxWidth: 420, width: "100%", textAlign: "center",
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
      }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <CompanyLogo size="lg" />
        </div>
        <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: "1.25rem", fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>
          {title}
        </h2>
        <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6, marginBottom: action ? 24 : 0 }}>
          {message}
        </p>
        {action}
      </div>
    </div>
  );
}

export function AuthPrimaryButton({
  children, onClick, disabled, type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "10px 20px", borderRadius: 10, border: "none",
        background: disabled ? "var(--muted)" : `linear-gradient(135deg, ${GREEN}, ${GREEN_DEEP})`,
        color: "#fff", fontWeight: 600, fontSize: 14, cursor: disabled ? "not-allowed" : "pointer",
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
        boxShadow: disabled ? "none" : "0 4px 16px rgba(47,82,51,0.3)",
        fontFamily: FONT_BODY, opacity: disabled ? 0.8 : 1,
      }}
    >
      {children}
    </button>
  );
}

export default function AuthShell({
  formTitle,
  formSubtitle,
  children,
  features = [],
  badges = ["GRA Compliant", "IFRS Aligned", "GHS Native"],
  footer,
}: AuthShellProps) {
  useAuthTheme();

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: PAPER, fontFamily: FONT_BODY }}>
      {/* Brand panel — desktop */}
      <div
        className="auth-brand-panel"
        style={{
          flex: "0 0 46%",
          background: `linear-gradient(160deg, ${GREEN_DEEP} 0%, #0f2416 50%, #0a1a0f 100%)`,
          color: "#fff",
          display: "flex", flexDirection: "column", justifyContent: "center",
          padding: "3rem 3.5rem",
          position: "relative", overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", top: -80, right: -80, width: 300, height: 300, borderRadius: "50%", background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.04)" }} />
        <div style={{ position: "absolute", bottom: -100, left: -60, width: 360, height: 360, borderRadius: "50%", background: "rgba(201,168,76,0.04)" }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <CompanyLogo size="xl" style={{ marginBottom: 28, boxShadow: "0 8px 28px rgba(0,0,0,0.25)" }} />
          <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: "2.2rem", fontWeight: 800, letterSpacing: -0.5, marginBottom: 10, lineHeight: 1.15 }}>
            Modulo Ledger
          </h1>
          <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "1rem", lineHeight: 1.7, maxWidth: 380, marginBottom: 40 }}>
            Secure financial management for modern construction firms. Track projects, invoices, payroll — all in one place.
          </p>

          {features.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: badges.length > 0 ? 40 : 0 }}>
              {features.map(({ icon: Icon, text, sub }) => (
                <div key={text} style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.05)",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <Icon size={18} color={GOLD} strokeWidth={1.8} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", fontWeight: 500, marginBottom: 2 }}>{text}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>{sub}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {badges.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              {badges.map((label) => (
                <div key={label} style={{
                  fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600,
                  letterSpacing: 0.5, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6,
                }}>
                  <CheckCircle2 size={12} color="rgba(201,168,76,0.5)" />
                  {label}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Form panel */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", justifyContent: "center",
        alignItems: "center", padding: "2.5rem 2rem",
      }}>
        <div style={{ width: "100%", maxWidth: 400 }}>
          <div className="auth-mobile-logo" style={{ display: "none", marginBottom: 28, textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
              <CompanyLogo size="lg" />
            </div>
            <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: "1.5rem", fontWeight: 800, color: "var(--ink)", letterSpacing: -0.3, margin: 0 }}>
              Modulo Ledger
            </h1>
          </div>

          <div style={{
            background: PAPER_RAISED, borderRadius: 16, padding: "32px 28px",
            border: `1px solid ${RULE}`, boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
          }}>
            <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: "1.5rem", fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
              {formTitle}
            </h2>
            {formSubtitle && (
              <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: 24, lineHeight: 1.5 }}>
                {formSubtitle}
              </p>
            )}
            {children}
          </div>

          {footer ?? (
            <p style={{
              marginTop: 24, fontSize: "0.75rem", color: "var(--muted)", textAlign: "center",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              <Lock size={11} /> Secured by Supabase Auth
            </p>
          )}
        </div>
      </div>

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
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .auth-brand-panel { display: none !important; }
          .auth-mobile-logo { display: block !important; }
        }
      `}</style>
    </div>
  );
}

export function authInputStyle(hasError = false): React.CSSProperties {
  return {
    width: "100%",
    padding: "0.75rem 1rem",
    borderRadius: 10,
    border: `1.5px solid ${hasError ? "var(--alert)" : RULE}`,
    fontSize: 15,
    fontFamily: FONT_BODY,
    boxSizing: "border-box",
    background: "var(--input-bg)",
    color: "var(--ink)",
    transition: "border-color 0.2s, box-shadow 0.2s",
  };
}

export function AuthFieldLabel({ children }: { children: ReactNode }) {
  return (
    <label style={{
      display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)",
      marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5,
    }}>
      {children}
    </label>
  );
}

export function AuthErrorBanner({ message }: { message: string }) {
  return (
    <div style={{
      background: "var(--alert-bg)", color: "var(--alert)", padding: "0.7rem 1rem",
      borderRadius: 10, marginBottom: 20, fontSize: "0.85rem",
      border: "1px solid var(--alert)", lineHeight: 1.4,
    }}>
      {message}
    </div>
  );
}

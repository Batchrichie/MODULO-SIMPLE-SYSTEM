import React from "react";
import { LOGO_SRC } from "../theme/tokens";
import { fmt } from "../utils/format";

export const finStyles = {
  goldBar: { height: 4, background: "linear-gradient(90deg, #B8860B 0%, #D4AF37 40%, #B8860B 100%)" },
  thBg: { background: "#1B2A4A", color: "#FFFFFF", padding: "9px 14px", fontSize: "8pt", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", borderBottom: "2px solid #B8860B", textAlign: "left" as const },
  td: { padding: "6px 14px", borderBottom: "1px solid #D5CEBD", verticalAlign: "top" as const, fontSize: "9.5pt", color: "#222222" },
  tdR: { padding: "6px 14px", borderBottom: "1px solid #D5CEBD", verticalAlign: "top" as const, fontSize: "9.5pt", color: "#222222", textAlign: "right" as const, fontFamily: "'Courier New', Courier, monospace" },
  groupLabel: { fontWeight: 700, color: "#1B2A4A", padding: "12px 14px 4px", fontSize: "8.5pt", textTransform: "uppercase", letterSpacing: "0.8px", background: "#EDF2FA" },
  subtotalRow: { fontWeight: 700, background: "#F5F0E6" },
  totalRow: { fontWeight: 800, background: "#E8E0CC", color: "#1A1A1A" },
  grandRow: { fontWeight: 800, background: "#1B2A4A", color: "#D4AF37", fontSize: "11pt" },
  pageWrap: { fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", fontSize: "10pt", lineHeight: 1.5, color: "#222", padding: "0 0 20px", width: "100%" }
};

// This wrapper forces a physical page break in the browser's print dialog.
// Only `page-break-before`/`break-before` is needed: each non-first document
// breaks *before* itself, which is equivalent to breaking *after* the
// previous one. Also setting `page-break-after` on every wrapper was
// redundant and added a trailing blank page after the last document.
export const PrintPageWrapper = ({ children, firstPage }: { children: React.ReactNode; firstPage?: boolean }) => (
  <div style={{ 
    display: "block", 
    width: "100%",
    pageBreakBefore: firstPage ? "auto" : "always", 
    breakBefore: firstPage ? "auto" : "page",
  }}>
    {children}
  </div>
);

export const PageHeader = ({ title, subtitle, company }: { title: string; subtitle?: string; company: any }) => (
  <div>
    <div style={finStyles.goldBar} />
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 32px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {/* Added onError to hide broken image icon if path fails during print */}
        <img 
          src={LOGO_SRC} 
          alt="logo" 
          style={{ height: 48, width: "auto" }} 
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} 
        />
        <div>
          <div style={{ fontSize: "15pt", fontWeight: 800, color: "#1A1A1A", letterSpacing: "-0.5px" }}>{company.name}</div>
          <div style={{ fontSize: "7.5pt", color: "#888", textTransform: "uppercase", letterSpacing: "1.5px" }}>Design · Build · Deliver</div>
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: "18pt", fontWeight: 800, color: "#1B2A4A", letterSpacing: "2px", lineHeight: 1 }}>{title}</div>
        {subtitle && <div style={{ fontSize: "8.5pt", color: "#888", marginTop: 4, fontFamily: "'Courier New', Courier, monospace" }}>{subtitle}</div>}
      </div>
    </div>
  </div>
);

export const Footer = ({ company }: { company: any }) => (
  <div style={{ padding: "14px 32px 20px", marginTop: 16, borderTop: "2px solid #B8860B", textAlign: "center", fontSize: "7.5pt", color: "#888", textTransform: "uppercase", letterSpacing: "1px", lineHeight: 1.8 }}>
    {company.name} · {company.addressLine} · {company.cityLine} · {company.poBox} · Phone: {company.phone} · {company.email}
  </div>
);

export const LR = ({ name, amount, negative }: { code: string; name: string; amount: number; negative?: boolean }) => (
  <tr><td style={finStyles.td}>{name}</td><td style={finStyles.tdR}>{negative ? `(${fmt(amount)})` : fmt(amount)}</td></tr>
);
export const GL = ({ children }: { children: React.ReactNode }) => <tr><td colSpan={2} style={finStyles.groupLabel}>{children}</td></tr>;
export const SR = ({ label, amount, negative }: { label: string; amount: number; negative?: boolean }) => (
  <tr style={finStyles.subtotalRow}><td style={finStyles.td}>{label}</td><td style={finStyles.tdR}>{negative ? `(${fmt(amount)})` : fmt(amount)}</td></tr>
);
export const TR = ({ label, amount, variant }: { label: string; amount: number; variant?: "grand" }) => (
  <tr style={variant === "grand" ? finStyles.grandRow : finStyles.totalRow}>
    <td style={{ padding: variant === "grand" ? "12px 14px" : "8px 14px", fontWeight: 800, fontSize: variant === "grand" ? "11pt" : "9.5pt" }}>{label}</td>
    <td style={{ padding: variant === "grand" ? "12px 14px" : "8px 14px", fontWeight: 800, fontSize: variant === "grand" ? "11pt" : "9.5pt", textAlign: "right", fontFamily: "'Courier New', Courier, monospace" }}>{fmt(amount)}</td>
  </tr>
);
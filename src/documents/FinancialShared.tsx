import React from "react";
import { fmt } from "../utils/format";
import { normalizePrintCompany, printCompanyContact, printCompanyName } from "./printCompany";
import DocumentHeader, { DocumentFooter } from "./DocumentHeader";
import { printTheme } from "./printTheme";

export const finStyles = {
  goldBar: { height: 4, background: printTheme.goldBar },
  thBg: { background: printTheme.navy, color: "#FFFFFF", padding: "9px 14px", fontSize: "8pt", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", borderBottom: `2px solid ${printTheme.accent}`, textAlign: "left" as const },
  td: { padding: "6px 14px", borderBottom: `1px solid ${printTheme.rule}`, verticalAlign: "top" as const, fontSize: "9.5pt", color: printTheme.ink },
  tdR: { padding: "6px 14px", borderBottom: `1px solid ${printTheme.rule}`, verticalAlign: "top" as const, fontSize: "9.5pt", color: printTheme.ink, textAlign: "right" as const, fontFamily: printTheme.fontMono },
  groupLabel: { fontWeight: 700, color: printTheme.navy, padding: "12px 14px 4px", fontSize: "8.5pt", textTransform: "uppercase", letterSpacing: "0.8px", background: "#edf2fa" },
  subtotalRow: { fontWeight: 700, background: "#F5F0E6" },
  totalRow: { fontWeight: 800, background: "#E8E0CC", color: "#1A1A1A" },
  grandRow: { fontWeight: 800, background: printTheme.navy, color: "#d4af37", fontSize: "11pt" },
  pageWrap: { fontFamily: printTheme.fontBody, fontSize: "10pt", lineHeight: 1.5, color: printTheme.ink, padding: "0 0 20px", width: "100%" }
};

export { normalizePrintCompany, printCompanyContact, printCompanyName } from "./printCompany";

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
  <>
    <div style={finStyles.goldBar} />
    <DocumentHeader docTitle={title} subtitle={subtitle} company={company} />
  </>
);

export const Footer = ({ company }: { company: any }) => <DocumentFooter company={company} />;

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
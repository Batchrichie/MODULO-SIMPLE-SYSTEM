/**
 * Shared Design System for Printable Documents
 * ─────────────────────────────────────────────
 * Corporate Navy + Gold palette, A4-optimized typography & spacing.
 * All three documents (Invoice, Payslip, Receipt) import from this file
 * so that visual consistency is guaranteed.
 */

/* ─── Color Palette ─── */
export const C = {
  navy:       "#1B2A4A",
  navyLight:  "#2C3E66",
  gold:       "#B8860B",
  goldBright: "#D4AF37",
  goldMuted:  "#C9A84C",
  ink:        "#1A1A1A",
  body:       "#2D2D2D",
  muted:      "#6B6B6B",
  cream:      "#F5F2EC",
  creamLight: "#FAFAF8",
  rule:       "#D5CEBD",
  ruleLight:  "#E8E4DC",
  white:      "#FFFFFF",
  success:    "#2F6B4F",
  danger:     "#A63D40",
  dangerBg:   "#FDF5F5",
  netGreen:   "#2F5233",
  headerBlue: "#8A9BB8",
  pink:       "#EF9A9A",
} as const;

/* ─── Typography Tokens ─── */
export const FONT = {
  body:    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  display: "'Roboto Slab', Georgia, 'Times New Roman', serif",
  mono:    "'IBM Plex Mono', 'Courier New', monospace",
} as const;

/* ─── A4 Dimensions (mm → pt at 72 dpi) ─── */
export const A4 = {
  width:      "210mm",    // ~595pt
  height:     "297mm",    // ~842pt
  marginSide: "20mm",
  marginTop:  "18mm",
  marginBot:  "18mm",
  /** Convert mm to pt (for inline calculations) */
  mmToPt: (mm: number) => mm * 2.8346,
} as const;

/* ─── Spacing Scale (pt-based for print precision) ─── */
export const SP = {
  xs:  3,   // 3pt  – tight gaps
  sm:  5,   // 5pt  – inner padding
  md:  8,   // 8pt  – standard gap
  lg:  12,  // 12pt – section gap
  xl:  16,  // 16pt – major section gap
  xxl: 24,  // 24pt – page-level padding
} as const;

/* ─── Reusable Style Fragments ─── */

/** Gold accent bar at the top of every document */
export const goldBarStyle: React.CSSProperties = {
  height: 4,
  background: `linear-gradient(90deg, ${C.gold} 0%, ${C.goldBright} 40%, ${C.gold} 100%)`,
  width: "100%",
};

/** Standard card (cream background, rounded) */
export const cardBase: React.CSSProperties = {
  background: C.cream,
  border: `1px solid ${C.rule}`,
  borderRadius: 6,
  padding: `${SP.lg}px ${SP.xl}px`,
};

/** Card section title (small-caps gold label) */
export const cardTitle: React.CSSProperties = {
  fontSize: "7.5pt",
  fontWeight: 700,
  textTransform: "uppercase" as const,
  letterSpacing: "1.2px",
  color: C.gold,
  marginBottom: SP.md,
};

/** Key-value row inside a card */
export const cardRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: `${SP.xs}px 0`,
  fontSize: "9.5pt",
};

/** Section heading with trailing rule line */
export const sectionHeading: React.CSSProperties = {
  fontSize: "8pt",
  fontWeight: 700,
  textTransform: "uppercase" as const,
  letterSpacing: "1.5px",
  color: C.gold,
  display: "flex",
  alignItems: "center",
  gap: 10,
  margin: `${SP.sm}px 0 ${SP.md}px`,
};

/** Navy table header cell */
export const thBase: React.CSSProperties = {
  padding: "9px 12px",
  fontSize: "7.5pt",
  fontWeight: 700,
  textTransform: "uppercase" as const,
  letterSpacing: "0.8px",
  color: C.white,
  background: C.navy,
  borderBottom: `2px solid ${C.gold}`,
};

/** Table body cell */
export const tdBase: React.CSSProperties = {
  padding: "8px 12px",
  borderBottom: `1px solid ${C.ruleLight}`,
  verticalAlign: "top" as const,
};

/** Page footer */
export const footerBase: React.CSSProperties = {
  padding: "16pt 0 0",
  marginTop: SP.xl,
  borderTop: `2px solid ${C.gold}`,
  textAlign: "center" as const,
  fontSize: "8pt",
  color: C.muted,
  textTransform: "uppercase" as const,
  letterSpacing: "1px",
  lineHeight: 1.8,
};

/* ─── Helpers ─── */

/** Format a date string "YYYY-MM-DD" → "DD Month YYYY" */
export function formatDate(value: string | undefined): string {
  if (!value) return "\u2014";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Get currency symbol from currency code */
export function currencySym(cur: string): string {
  return cur === "USD" ? "$" : "GH\u20B5";
}

/* ─── Shared @media print + screen CSS ─── */
export const printScreenCSS = (rootClass: string) => `
  @media print {
    .${rootClass} {
      width: ${A4.width};
      min-height: auto;
      margin: 0;
      box-shadow: none;
      border: none;
    }
    body {
      margin: 0;
      padding: 0;
      background: #fff;
    }
  }

  @media screen {
    .${rootClass} {
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      border: 1px solid ${C.rule};
      margin: 20px auto;
    }
  }
`;

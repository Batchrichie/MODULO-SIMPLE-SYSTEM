import React from 'react';
import { normalizePrintCompany } from './printCompany';
import { printSpacing, printTheme } from './printTheme';

export interface PrintCompanySource {
  company?: any;
  companyName?: string;
}

interface DocumentHeaderProps extends PrintCompanySource {
  docTitle: string;
  docNumber?: string | null;
  subtitle?: string | null;
  variant?: 'light' | 'navy';
}

export default function DocumentHeader({
  docTitle,
  docNumber,
  subtitle,
  company,
  companyName,
  variant = 'light',
}: DocumentHeaderProps) {
  const details = normalizePrintCompany(company, companyName);
  const isNavy = variant === 'navy';
  const foreground = isNavy ? printTheme.paper : printTheme.ink;
  const secondary = isNavy ? '#b8c4d8' : printTheme.muted;

  return (
    <header style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 24,
      padding: `${printSpacing.headerTop}px ${printSpacing.pageX}px ${printSpacing.headerBottom}px`,
      background: isNavy ? printTheme.navy : printTheme.paper,
      color: foreground,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: printSpacing.gap, minWidth: 0 }}>
        <img
          src={printTheme.logoSrc}
          alt={`${details.name} logo`}
          style={{ height: 54, width: 'auto', objectFit: 'contain', flexShrink: 0 }}
          onError={(event) => { (event.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: printTheme.fontDisplay, fontSize: '16pt', fontWeight: 800, lineHeight: 1.1, color: foreground }}>
            {details.name}
          </div>
          <div style={{ width: 42, height: 2, background: isNavy ? '#d4af37' : printTheme.accent, margin: '6px 0 5px' }} />
          <div style={{ fontFamily: printTheme.fontBody, fontSize: '7.5pt', fontWeight: 700, color: isNavy ? '#d4af37' : printTheme.accent, textTransform: 'uppercase', letterSpacing: '1.4px' }}>
            Design · Build · Deliver
          </div>
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0, paddingTop: 3 }}>
        <div style={{ fontFamily: printTheme.fontDisplay, fontSize: '12pt', fontWeight: 800, color: isNavy ? '#d4af37' : printTheme.navy, letterSpacing: '2.4px', textTransform: 'uppercase' }}>
          {docTitle}
        </div>
        {docNumber && <div style={{ fontFamily: printTheme.fontMono, fontSize: '8.5pt', color: secondary, marginTop: 5 }}>{docNumber}</div>}
        {subtitle && <div style={{ fontFamily: printTheme.fontMono, fontSize: '8pt', color: secondary, marginTop: 4 }}>{subtitle}</div>}
      </div>
    </header>
  );
}

export function DocumentFooter({ company, companyName, note }: PrintCompanySource & { note?: string }) {
  const details = normalizePrintCompany(company, companyName);
  const contact = [
    [details.addressLine, details.cityLine, details.poBox].filter(Boolean).join(' · '),
    [details.phone && `Phone: ${details.phone}`, details.telephone && `Telephone: ${details.telephone}`, details.email].filter(Boolean).join(' · '),
    details.website,
  ].filter(Boolean);
  return (
    <footer style={{ padding: '14px 32px 20px', marginTop: 16, borderTop: `2px solid ${printTheme.accent}`, textAlign: 'center', fontFamily: printTheme.fontBody, fontSize: '7.5pt', color: printTheme.muted, lineHeight: 1.7 }}>
      {note && <div style={{ marginBottom: 5 }}>{note}</div>}
      {contact.map((line) => <div key={line}>{line}</div>)}
    </footer>
  );
}

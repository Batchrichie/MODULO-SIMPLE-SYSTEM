import { FONT_BODY, FONT_DISPLAY, FONT_MONO, LOGO_SRC } from '../theme/tokens';

export const printTheme = {
  navy: '#14213d',
  accent: '#8a6a1a',
  ink: '#0f1729',
  muted: '#64748b',
  rule: '#d8dee8',
  paper: '#ffffff',
  soft: '#f6f8fb',
  goldBar: `linear-gradient(90deg, #6f5313 0%, #8a6a1a 45%, #6f5313 100%)`,
  fontBody: FONT_BODY,
  fontDisplay: FONT_DISPLAY,
  fontMono: FONT_MONO,
  logoSrc: LOGO_SRC,
} as const;

export const printSpacing = {
  pageX: 32,
  headerTop: 14,
  headerBottom: 18,
  gap: 10,
} as const;

// Design tokens — CSS variable references used across all components

export const INK = "var(--ink)";
export const PAPER = "var(--paper)";
export const PAPER_RAISED = "var(--paper-raised)";
export const RULE = "var(--rule)";
export const GREEN = "var(--green)";
export const GREEN_DEEP = "var(--green-deep)";
export const GOLD = "var(--gold)";
export const ALERT = "var(--alert)";
export const MUTED = "var(--muted)";

export const FONT_DISPLAY = "'Roboto Slab', serif";
export const FONT_BODY = "'Inter', sans-serif";
export const FONT_MONO = "'IBM Plex Mono', monospace";

// Use local asset for printable documents so prints don't depend on external CDN
export const LOGO_SRC = new URL("../assets/Modulo_Logo.png", import.meta.url).href;


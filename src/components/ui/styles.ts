import { INK, RULE, MUTED, FONT_BODY } from "../../theme/tokens";

export const inputStyle = {
  fontFamily: FONT_BODY,
  fontSize: 13.5,
  padding: "8px 11px",
  borderRadius: 8,
  border: `1px solid ${RULE}`,
  background: "var(--input-bg)",
  color: INK,
  width: "100%",
  boxSizing: "border-box",
  transition: "border-color 0.2s, box-shadow 0.2s, background 0.2s",
};

export const labelStyle = {
  fontFamily: FONT_BODY,
  fontSize: 11,
  color: MUTED,
  fontWeight: 600,
  display: "block",
  marginBottom: 5,
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

import type { ReactNode } from "react";
import { MUTED, RULE, FONT_BODY } from "../../theme/tokens";
type ThProps = {
  children: ReactNode;
  right?: boolean;
};

export default function Th({ children, right = false }: ThProps) {
  return (
    <th
      style={{
        textAlign: right ? "right" : "left",
        fontFamily: FONT_BODY,
        fontSize: 11,
        letterSpacing: 0.5,
        textTransform: "uppercase",
        color: MUTED,
        fontWeight: 600,
        padding: "8px 10px",
        borderBottom: `2px solid ${RULE}`,
        whiteSpace: "normal",
        overflowWrap: "anywhere",
        wordBreak: "break-word",
      }}
    >
      {children}
    </th>
  );
}

import type { ReactNode, CSSProperties } from "react";
import { INK, RULE, FONT_BODY, FONT_MONO } from "../../theme/tokens";
type TdProps = {
  children: ReactNode;
  right?: boolean;
  mono?: boolean;
  bold?: boolean;
  style?: CSSProperties;
  label?: string;
};

export default function Td({ children, right = false, mono = false, bold = false, style, label }: TdProps) {
  return (
    <td
      data-label={label}
      style={{
        textAlign: right ? "right" : "left",
        padding: "8px 10px",
        borderBottom: `1px solid ${RULE}`,
        fontFamily: mono ? FONT_MONO : FONT_BODY,
        fontSize: 13.5,
        color: INK,
        fontWeight: bold ? 600 : 400,
        whiteSpace: "normal",
        overflowWrap: "normal",
        wordBreak: "normal",
        minWidth: 0,
        ...style,
      }}
    >
      {children}
    </td>
  );
}

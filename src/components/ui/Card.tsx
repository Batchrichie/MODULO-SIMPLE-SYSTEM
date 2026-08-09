import type { ReactNode, CSSProperties } from "react";
import { PAPER_RAISED, RULE } from "../../theme/tokens";

type CardProps = {
  children: ReactNode;
  style?: CSSProperties;
};

export default function Card({ children, style }: CardProps) {
  return (
    <div
      style={{
        background: PAPER_RAISED,
        border: `1px solid ${RULE}`,
        borderRadius: 12,
        padding: 20,
        boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
        transition: "box-shadow 0.2s ease",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

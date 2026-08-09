import type { ReactNode } from "react";
import { INK, MUTED, FONT_BODY, FONT_DISPLAY } from "../../theme/tokens";

type SectionTitleProps = {
  children: ReactNode;
  sub?: string;
  action?: ReactNode;
};

export default function SectionTitle({ children, sub, action }: SectionTitleProps) {
  return (
    <div
      style={{
        marginBottom: 20,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        flexWrap: "wrap",
        gap: 10,
      }}
    >
      <div>
        <h2
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 22,
            fontWeight: 700,
            color: INK,
            margin: 0,
            letterSpacing: "-0.3px",
          }}
        >
          {children}
        </h2>
        {sub && (
          <p
            style={{
              fontFamily: FONT_BODY,
              fontSize: 13,
              color: MUTED,
              margin: "5px 0 0",
              lineHeight: 1.5,
            }}
          >
            {sub}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

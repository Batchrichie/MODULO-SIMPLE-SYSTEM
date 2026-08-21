import React from "react";
import { LOGO_SRC, PAPER_RAISED, RULE } from "../../theme/tokens";

const SIZES = { sm: 36, md: 52, lg: 64, xl: 80 } as const;

export interface CompanyLogoProps {
  size?: keyof typeof SIZES;
  /** Light card background around the logo (auth panels, sidebar) */
  framed?: boolean;
  alt?: string;
  style?: React.CSSProperties;
}

export default function CompanyLogo({
  size = "md",
  framed = true,
  alt = "Modulo",
  style,
}: CompanyLogoProps) {
  const px = SIZES[size];
  return (
    <div
      style={{
        width: px,
        height: px,
        borderRadius: size === "sm" ? 10 : 14,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        background: framed ? PAPER_RAISED : "transparent",
        border: framed ? `1px solid ${RULE}` : "none",
        boxShadow: framed ? "0 4px 14px rgba(0,0,0,0.08)" : "none",
        ...style,
      }}
    >
      <img
        src={LOGO_SRC}
        alt={alt}
        style={{ width: "90%", height: "90%", objectFit: "contain", display: "block" }}
      />
    </div>
  );
}

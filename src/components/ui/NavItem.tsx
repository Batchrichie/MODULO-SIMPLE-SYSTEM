import { useState } from "react";
import type { ComponentType } from "react";
import { GREEN, GREEN_DEEP, PAPER, INK, MUTED, FONT_BODY } from "../../theme/tokens";
type NavItemProps = {
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  active?: boolean;
  onClick?: () => void;
};

export default function NavItem({ icon: Icon, label, active = false, onClick }: NavItemProps) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "8px 10px 8px 9px",
        borderRadius: 7,
        border: "none",
        borderLeft: active ? `3px solid ${GREEN}` : "3px solid transparent",
        background: active
          ? "linear-gradient(135deg, var(--green), var(--green-deep))"
          : hover
          ? "var(--nav-hover)"
          : "transparent",
        color: active ? "#FFFFFF" : INK,
        fontFamily: FONT_BODY,
        fontSize: 13.5,
        fontWeight: active ? 700 : 500,
        cursor: "pointer",
        textAlign: "left",
        transition: "background 0.12s ease, color 0.12s ease",
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 26,
          height: 26,
          borderRadius: 6,
          flexShrink: 0,
          background: active ? GREEN : "transparent",
          color: active ? PAPER : MUTED,
        }}
      >
        <Icon size={14} strokeWidth={2.2} />
      </span>
      {label}
    </button>
  );
}

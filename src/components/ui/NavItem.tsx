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
        gap: 12,
        width: "100%",
        padding: "10px 12px 10px 11px",
        borderRadius: 10,
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
        transition: "all 0.2s cubic-bezier(0.16,1,0.3,1)",
        transform: hover && !active ? "translateX(2px)" : "translateX(0)",
        boxShadow: active ? "0 2px 8px rgba(47,82,51,0.25)" : "none",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {hover && !active && (
        <span
          style={{
            position: "absolute",
            left: 0,
            top: "50%",
            transform: "translateY(-50%)",
            width: 3,
            height: 20,
            borderRadius: "0px 3px 3px 0px",
            background: GREEN,
            opacity: 0.5,
            transition: "opacity 0.2s ease",
          }}
        />
      )}
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          borderRadius: 8,
          flexShrink: 0,
          background: active ? "rgba(255,255,255,0.18)" : hover ? "rgba(47,82,51,0.08)" : "transparent",
          color: active ? "#FFFFFF" : hover ? GREEN : MUTED,
          transition: "all 0.2s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <Icon size={15} strokeWidth={active ? 2.4 : 2} />
      </span>
      <span
        style={{
          transition: "all 0.2s cubic-bezier(0.16,1,0.3,1)",
          letterSpacing: "0.01em",
        }}
      >
        {label}
      </span>
    </button>
  );
}

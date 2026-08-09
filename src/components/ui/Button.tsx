import type { ReactNode, ComponentType, CSSProperties } from "react";
import { GREEN, PAPER, INK, ALERT, RULE, FONT_BODY } from "../../theme/tokens";

type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  icon?: ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  type?: "button" | "submit" | "reset";
  fullWidth?: boolean;
  size?: "sm" | "md";
  style?: CSSProperties;
};

export default function Button({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  icon: Icon,
  type,
  fullWidth = false,
  size = "md",
  style,
}: ButtonProps) {
  const isSmall = size === "sm";
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: isSmall ? 5 : 7,
    padding: isSmall ? "5px 10px" : "9px 16px",
    borderRadius: isSmall ? 6 : 8,
    fontFamily: FONT_BODY,
    fontSize: isSmall ? 12 : 13.5,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
    whiteSpace: "nowrap",
    width: fullWidth ? "100%" : "auto",
    transition: "all 0.2s ease",
    border: "none",
  };

  const variants: Record<string, CSSProperties> = {
    primary: { background: GREEN, color: PAPER, boxShadow: "0 2px 8px rgba(47,82,51,0.2)" },
    ghost: { background: "transparent", color: INK, border: `1px solid ${RULE}` },
    danger: { background: "transparent", color: ALERT, border: `1px solid ${ALERT}` },
  };

  const hoverStyles: Record<string, CSSProperties> = {
    primary: { boxShadow: "0 4px 16px rgba(47,82,51,0.3)" },
    ghost: { background: "var(--nav-hover)", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" },
    danger: { background: "var(--alert-bg)", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" },
  };

  return (
    <button
      type={type || "button"}
      onClick={onClick}
      disabled={disabled}
      className="btn-hover"
      style={{ ...base, ...variants[variant], ...style }}
      onMouseEnter={(e) => {
        if (disabled) return;
        const el = e.currentTarget as HTMLButtonElement;
        Object.assign(el.style, hoverStyles[variant]);
        el.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.transform = "translateY(0)";
        if (variant === "ghost" || variant === "danger") {
          el.style.background = "transparent";
          el.style.boxShadow = variant === "primary" ? "0 2px 8px rgba(47,82,51,0.2)" : "none";
        } else {
          el.style.boxShadow = "0 2px 8px rgba(47,82,51,0.2)";
        }
      }}
    >
      {Icon && <Icon size={isSmall ? 12 : 14} />}
      {children}
    </button>
  );
}

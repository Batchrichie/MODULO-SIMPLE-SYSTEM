import type { ComponentType } from "react";
import { GREEN, MUTED, FONT_BODY } from "../../theme/tokens";
type BottomNavItemProps = {
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  active?: boolean;
  onClick?: () => void;
};

export default function BottomNavItem({ icon: Icon, label, active = false, onClick }: BottomNavItemProps) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        minWidth: 66,
        flex: "0 0 auto",
        padding: "10px 10px 8px",
        border: "none",
        background: active ? "rgba(47,82,51,0.1)" : hover ? "rgba(47,82,51,0.05)" : "transparent",
        borderRadius: 12,
        cursor: "pointer",
        color: active ? GREEN : MUTED,
        transition: "all 0.2s cubic-bezier(0.16,1,0.3,1)",
        transform: hover && !active ? "translateY(-2px)" : "translateY(0)",
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          borderRadius: 10,
          background: active ? "linear-gradient(135deg, var(--green), var(--green-deep))" : hover ? "rgba(47,82,51,0.08)" : "transparent",
          color: active ? "#FFFFFF" : hover ? GREEN : MUTED,
          transition: "all 0.2s cubic-bezier(0.16,1,0.3,1)",
          boxShadow: active ? "0 3px 10px rgba(47,82,51,0.3)" : "none",
        }}
      >
        <Icon size={18} strokeWidth={active ? 2.4 : 2} />
      </span>
      <span
        style={{
          fontFamily: FONT_BODY,
          fontSize: 10,
          fontWeight: active ? 700 : 500,
          whiteSpace: "nowrap",
          transition: "all 0.2s cubic-bezier(0.16,1,0.3,1)",
          letterSpacing: "0.01em",
        }}
      >
        {label}
      </span>
    </button>
  );
}

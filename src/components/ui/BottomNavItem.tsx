import type { ComponentType } from "react";
import { GREEN, MUTED, FONT_BODY } from "../../theme/tokens";
type BottomNavItemProps = {
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  active?: boolean;
  onClick?: () => void;
};

export default function BottomNavItem({ icon: Icon, label, active = false, onClick }: BottomNavItemProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        minWidth: 66,
        flex: "0 0 auto",
        padding: "8px 8px 7px",
        border: "none",
        background: "none",
        cursor: "pointer",
        color: active ? GREEN : MUTED,
      }}
    >
      <Icon size={19} strokeWidth={active ? 2.4 : 2} />
      <span
        style={{
          fontFamily: FONT_BODY,
          fontSize: 10,
          fontWeight: active ? 700 : 500,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </button>
  );
}

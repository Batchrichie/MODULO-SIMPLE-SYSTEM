import type { ReactNode } from "react";
import { X } from "lucide-react";
import { INK, RULE, PAPER_RAISED, MUTED, FONT_BODY, FONT_DISPLAY } from "../../theme/tokens";

type ModalProps = {
  title: string;
  sub?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
};

export default function Modal({ title, sub, onClose, children, wide = false }: ModalProps) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflowY: "auto",
        padding: "24px 12px",
        animation: "fadeIn 0.15s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-card"
        style={{
          background: PAPER_RAISED,
          borderRadius: 14,
          border: `1px solid ${RULE}`,
          width: "100%",
          maxWidth: wide ? 780 : 520,
          padding: 28,
          boxShadow: "0 20px 60px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.03)",
          animation: "slideUp 0.25s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 700, color: INK, margin: 0 }}>
              {title}
            </h3>
            {sub && (
              <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: MUTED, margin: "5px 0 0", lineHeight: 1.5 }}>
                {sub}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: MUTED, padding: 4, borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 32, height: 32, flexShrink: 0, marginLeft: 12,
              transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--nav-hover)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.color = MUTED; }}
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

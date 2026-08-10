import { useState } from "react";
import type { ComponentType } from "react";
import Card from "../ui/Card";
import { fmt } from "../../utils/format";
import { GREEN, GOLD, ALERT } from "../../theme/tokens";
import { PAPER, PAPER_RAISED, RULE, INK, MUTED, FONT_BODY, FONT_DISPLAY, FONT_MONO } from "../../theme/tokens";
export default function KpiCard({ title, value, icon: Icon, accent, sub, detail }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{ position: "relative", flex: 1, minWidth: 220 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Card style={{ borderTop: `3px solid ${accent}`, cursor: "default" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontFamily: FONT_BODY, fontSize: 12, color: MUTED, fontWeight: 600, textTransform: "uppercase" }}>
            {title}
          </span>
          <span style={{ color: accent, display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 6, background: "var(--nav-hover)" }}>
            <Icon size={16} />
          </span>
        </div>
        <h3 style={{ fontFamily: FONT_MONO, fontSize: 24, color: INK, margin: 0 }}>
          GHS {fmt(value)}
        </h3>
        {sub && <p style={{ fontSize: 11, color: MUTED, margin: "4px 0 0 0" }}>{sub}</p>}
      </Card>

      {hovered && detail && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 10px)",
            left: 0,
            right: 0,
            background: "#1F2937",
            color: "#F1F5F9",
            borderRadius: 10,
            padding: "14px 16px",
            fontSize: 12,
            lineHeight: 1.6,
            zIndex: 100,
            boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              position: "absolute",
              bottom: -6,
              left: 24,
              width: 12,
              height: 12,
              background: "#1F2937",
              transform: "rotate(45deg)",
              borderRadius: 2,
            }}
          />
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: accent === GREEN ? "#4ADE80" : accent === GOLD ? "#D4AF37" : accent === ALERT ? "#F87171" : "#94A3B8" }}>
            {title}
          </div>
          {detail}
        </div>
      )}
    </div>
  );
}

// ---------- Custom SVG Charts ----------

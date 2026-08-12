import React from 'react';
import { INK, MUTED, RULE, FONT_DISPLAY, FONT_BODY } from '../../theme/tokens';

interface Props {
  children: React.ReactNode;
  sub?: string;
  action?: React.ReactNode;
}

export default function SectionTitle({ children, sub, action }: Props) {
  return (
    <div
      style={{
        marginBottom: 20,
        paddingBottom: 14,
        borderBottom: `1px solid ${RULE}`,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <h2
          style={{
            margin: 0,
            fontFamily: FONT_DISPLAY,
            fontSize: 22,
            fontWeight: 700,
            color: INK,
            letterSpacing: -0.2,
          }}
        >
          {children}
        </h2>
        {sub && (
          <div
            style={{
              marginTop: 4,
              fontFamily: FONT_BODY,
              fontSize: 13,
              color: MUTED,
            }}
          >
            {sub}
          </div>
        )}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}
import { useState, useRef, useEffect, useMemo, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { INK, MUTED, RULE, FONT_BODY, FONT_MONO, GREEN } from "../../theme/tokens";
import { inputStyle } from "./styles";
import type { Account } from "../../types";

interface AccountSelectProps {
  value: string;
  onChange: (code: string) => void;
  accounts: Account[];
  filterTypes?: string[];
  filterFn?: (a: Account) => boolean;
  placeholder?: string;
  style?: CSSProperties;
}

export default function AccountSelect({
  value, onChange, accounts, filterTypes, filterFn,
  placeholder = "Type or select account...",
  style,
}: AccountSelectProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  const pool = useMemo(
    () =>
      filterFn
        ? accounts.filter(filterFn)
        : filterTypes
          ? accounts.filter((a) => filterTypes.includes(a.type))
          : accounts,
    [accounts, filterTypes, filterFn]
  );

  const matches = useMemo(() => {
    if (!query.trim()) return pool;
    const q = query.toLowerCase();
    return pool.filter(
      (a) => a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
    );
  }, [pool, query]);

  const selectedAccount = pool.find((a) => a.code === value);
  const displayValue = !open && selectedAccount
    ? selectedAccount.code + " - " + selectedAccount.name
    : query;

  useEffect(() => { if (!open) setQuery(""); }, [value, open, pool]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;

    function updatePosition() {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const minWidth = Math.max(rect.width, 420);
      setMenuPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: minWidth,
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      const target = e.target as Node;
      const insideContainer = containerRef.current?.contains(target);
      const insideMenu = menuRef.current?.contains(target);

      if (!insideContainer && !insideMenu) {
        setOpen(false); setQuery(""); setHighlighted(-1);
      }
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  useEffect(() => {
    if (highlighted >= 0 && listRef.current) {
      const item = listRef.current.children[highlighted] as HTMLElement | undefined;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [highlighted]);

  function pick(code: string) { onChange(code); setOpen(false); setQuery(""); setHighlighted(-1); }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(true); }
      return;
    }
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); setHighlighted((h) => Math.min(h + 1, matches.length - 1)); break;
      case "ArrowUp": e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)); break;
      case "Enter": e.preventDefault(); if (highlighted >= 0 && matches[highlighted]) pick(matches[highlighted].code); break;
      case "Escape": setOpen(false); setQuery(""); setHighlighted(-1); break;
      case "Tab": setOpen(false); setQuery(""); setHighlighted(-1); break;
    }
  }

  return (
    <div ref={containerRef} style={{ position: "relative", ...style }}>
      <input
        style={inputStyle}
        value={displayValue}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setHighlighted(-1); }}
        onFocus={() => { setOpen(true); if (selectedAccount) setQuery(""); }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-haspopup="listbox"
      />
      <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: MUTED, fontSize: 10, lineHeight: 1 }}>
        {open ? "\u25B2" : "\u25BC"}
      </div>
      {open && typeof document !== "undefined" && createPortal(
        <ul
          ref={(node) => {
            listRef.current = node;
            menuRef.current = node;
          }}
          role="listbox"
          style={{
            position: "fixed",
            left: menuPosition.left,
            top: menuPosition.top,
            width: Math.max(menuPosition.width, 420),
            maxHeight: 220,
            overflowY: "auto",
            background: "var(--paper-raised)",
            border: "1px solid " + RULE,
            borderRadius: 6,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            listStyle: "none",
            margin: 0,
            padding: "4px 0",
            zIndex: 2000,
          }}
        >
          {matches.length === 0 && (
            <li style={{ padding: "8px 12px", fontSize: 12.5, color: MUTED, fontStyle: "italic" }}>No accounts match "{query}"</li>
          )}
          {matches.map((a, idx) => (
            <li
              key={a.code}
              role="option"
              aria-selected={a.code === value}
              onMouseDown={(event) => {
                event.preventDefault();
                pick(a.code);
              }}
              onMouseEnter={() => setHighlighted(idx)}
              style={{ padding: "7px 12px", cursor: "pointer", fontFamily: FONT_BODY, fontSize: 12.5, display: "flex", alignItems: "center", gap: 10, background: idx === highlighted ? "var(--nav-hover)" : a.code === value ? "var(--success-bg)" : "transparent", color: a.code === value ? GREEN : INK, fontWeight: a.code === value ? 600 : 400, transition: "background 0.1s" }}
            >
              <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: MUTED, minWidth: 50, flexShrink: 0 }}>{a.code}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{a.name}</span>
              {a.type && <span style={{ marginLeft: 8, fontSize: 10, color: MUTED, padding: "1px 6px", borderRadius: 3, flexShrink: 0 }}>{a.type}</span>}
            </li>
          ))}
        </ul>,
        document.body
      )}
    </div>
  );
}

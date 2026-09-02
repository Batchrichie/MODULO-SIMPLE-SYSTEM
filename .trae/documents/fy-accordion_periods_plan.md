# FY Accordion for Accounting Periods — Implementation Plan

## Repository Research

### Current state
The Accounting Periods page at [PeriodsPanel.tsx](file:///C:/Users/Richmond/Downloads/MODULO-DEVELOPMENT-LTD-SYSTEM/MODULO-SIMPLE-SYSTEM/src/panels/PeriodsPanel.tsx) already produces a `grouped` structure via `useMemo` (lines 204–229):

```ts
const grouped = useMemo(() => {
  // Map<financial_year, AccountingPeriod[]>
  // Each FY sorted by month ascending
  // FY keys sorted descending (latest first)
  return keys.map((fy) => ({ fy, periods, hasCurrent }));
}, [data.accountingPeriods]);
```

Rendering at lines 351–533 iterates `grouped.map(g => …)` and produces a **permanently-visible** `<Card>` + full `<table>` per FY. Each section shows:
- Header: "Financial Year" label + `g.fy` (e.g. "2026") + optional "Current" green pill
- Body: Card wrapping a 9-column table (Period, Start Date, End Date, Status, Current, FY, Journal Entries, Closed By, Actions)

There is **no collapse state** — every FY's table is always rendered. The data-side primitives are already in place; only the presentation layer needs an accordion toggle.

### Available primitives
- `lucide-react` is installed and used throughout; icons `ChevronRight`, `ChevronDown`, `CalendarDays`, `Lock`, `Unlock`, `AlertTriangle` are all available.
- Inline styles are used throughout `PeriodsPanel.tsx` (no CSS modules / styled-components). Follow existing convention.
- `useState`, `useMemo` already imported (lines 1, 2).

### Constraints / Do NOT touch
- No changes to `supabaseClient.ts`, `types.ts`, `App.tsx`, other posting panels, or RPCS.
- No changes to Close/Reopen modals or RPC call flow.
- No changes to the `grouped` computation — data grouping is correct.
- Do NOT remove any table columns (the redundant `FY` column inside each row is acceptable per current design).
- UI must stay visually consistent with the existing tokens (`INK`, `MUTED`, `GREEN_DEEP`, `GREEN`, `FONT_DISPLAY`, `FONT_BODY`, `ALERT`, `GOLD`).

## Files and Modules

### Single file change
- **[PeriodsPanel.tsx](file:///C:/Users/Richmond/Downloads/MODULO-DEVELOPMENT-LTD-SYSTEM/MODULO-SIMPLE-SYSTEM/src/panels/PeriodsPanel.tsx)**: Add collapsed-state management, turn each FY header into a clickable toggle with a `ChevronRight`/`ChevronDown` that rotates/expands, conditionally render the Card/table inside each FY section.

## Implementation Steps

1. **Add collapsed state.** After existing state hooks (after line 199 approx.), add:
   ```ts
   const [expandedFys, setExpandedFys] = useState<Set<string | number>>(() => {
     // Default: expand the FY that has the "Current" period;
     // if none, expand the most recent FY.
     const currentGroup = grouped.find(g => g.hasCurrent);
     const initial = currentGroup ? currentGroup.fy : grouped[0]?.fy;
     return initial !== undefined ? new Set([initial]) : new Set();
   });
   ```
   Move this below the `grouped` useMemo so it can reference `grouped` at init time, OR compute the initial value inline from `data.accountingPeriods` to avoid reordering (preferred: reorder hooks so `grouped` is declared *before* the expanded-state hook, or compute initial independently without `grouped` dependency — the latter is safer for React hook-order hygiene).

2. **Import Chevron icons.** In the existing lucide-react import at line 3–8, add `ChevronRight, ChevronDown` (or just `ChevronRight` with rotation — the two-icon approach is clearer).

3. **Add the toggle helper.** A small helper:
   ```ts
   function toggleFy(fy: string | number) {
     setExpandedFys((prev) => {
       const next = new Set(prev);
       if (next.has(fy)) next.delete(fy); else next.add(fy);
       return next;
     });
   }
   ```

4. **Refactor the FY header (lines 352–399)** into a clickable row:
   - Wrap the existing header `<div>` in a clickable container (`role="button"`, `tabIndex={0}`, keyboard Enter/Space handler for a11y, `cursor: "pointer"`, hover background).
   - Prepend a `ChevronRight`/`ChevronDown` icon that switches based on `expandedFys.has(g.fy)`.
   - Keep the "Financial Year" label, `g.fy` number, and optional "Current" green pill exactly as-is.
   - Add a count chip showing the number of periods in the FY, e.g. `(12 periods)`, right-aligned or next to the FY number in MUTED style.

5. **Conditionally render the Card+table.** Wrap lines 401–531 (`<Card>…</Card>`) inside:
   ```tsx
   {expandedFys.has(g.fy) && (
     <Card>…</Card>
   )}
   ```
   Consider a CSS `transition` on max-height for smooth expansion; if not feasible, simple show/hide is acceptable.

6. **Remove the redundant `FY` column (optional, low-impact) — leave it in.**
   The column displays `String(p.financial_year)` which is the same for every row inside the section and is already visible in the section header. However, per the constraint "Do NOT remove any table columns", **leave this column as is**. No breaking layout changes.

7. **Preserve all existing row-level logic.** The `.map((p) => { const status = String(p.status).toLowerCase(); … statusPill(p.status); isOpen / isClosed / showActions / Close Period / Reopen buttons … })` render block is copied verbatim. No logic changes.

8. **Preserve modals unchanged.** The `closePeriod` / `reopenPeriod` modals and RPC confirm flows (lines 535+) are outside the grouped render loop and need zero changes.

## Dependencies and Considerations

- **Hook ordering.** If `expandedFys` init needs to reference `grouped`, the `grouped` useMemo must come before the `useState`. Currently `grouped` is declared at line 204 and state hooks are at ~199 — so either:
  (a) Swap order and compute init from grouped (cleaner, but changes hook order — functionally safe since both are primitive hooks), or
  (b) Compute init from `data.accountingPeriods` inline in the useState initializer without touching grouped. This avoids reordering and is the safer approach. Prefer (b).
- **a11y.** The clickable FY header needs `role="button"`, `aria-expanded`, `aria-controls`, and keyboard Enter/Space to pass reasonable standards. Given the rest of the codebase doesn't aggressively enforce a11y, at minimum implement `role="button"` and `tabIndex={0}` + onKeyDown for Enter/Space.
- **Empty state.** Lines 296–341 handle zero periods — keep untouched.
- **Subsequent refresh.** `refreshPeriods()` at line 231 mutates `data.accountingPeriods`. The `grouped` useMemo will recompute automatically. The `expandedFys` Set may reference a FY that no longer exists — that's fine; `expandedFys.has()` will simply be false for defunct keys. No explicit cleanup needed.
- **No schema, RPC, or backend changes.** This is 100% presentation.

## Validation

1. **Visual check (browser or Vite build)** — Each FY section header:
   - Shows a chevron (right when collapsed, down when expanded).
   - Shows "Financial Year 2026" + optional "Current" pill.
   - Is clickable; toggles the months table visibility on click + on Enter/Space.
2. **Default expansion** — The FY containing `is_current = true` period is expanded on first render; all others are collapsed.
3. **Multiple open** — User can expand 2+ FY sections simultaneously (accordion is non-exclusive).
4. **Row functionality preserved** — Within an expanded table:
   - Status pills still render correctly (OPEN green / CLOSED red / FUTURE gold).
   - Close Period / Reopen buttons appear for the correct rows.
   - Clicking Close Period still opens the modal, confirms, refreshes.
   - Closed By column + Journal Entries count unchanged.
5. **Build** — `npm run build` passes.
6. **TS diagnostics** — No new errors in `PeriodsPanel.tsx` (pre-existing errors in other files allowed, as per the earlier audit).

## Risks

| Risk | Handling |
|------|----------|
| Hook-order lint error if init depends on `grouped` declared below | Compute initial expansion from `data.accountingPeriods` directly inside useState, avoiding cross-hook reference. |
| Collapsed FY still renders its table into DOM (if using CSS hide instead of conditional) | Use `{expanded && <Card>}` (React unmount) — keeps DOM lean; no risk of row-click event handlers firing for invisible rows. |
| Lucide import conflict (`ChevronDown` name shadowed) | Import both `ChevronRight, ChevronDown` in the existing lucide-react import clause on line 3. |
| Inline onClick handler re-render perf | Wrap toggle in `useCallback` if the panel becomes slow; 200 row max is trivial so likely not needed. |

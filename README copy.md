# Running the Modulo Ledger app on CodeSandbox

## 1. Create the sandbox
Go to codesandbox.io → **Create** → choose the **Vite + React** template (not "React" classic template — this app uses `import.meta`-style tooling that Vite handles cleanly).

## 2. Replace these files
Delete the default sample files Vite gives you, and add these (already included in this folder):

- `package.json` — dependencies (`react`, `react-dom`, `lucide-react`, `xlsx`, `vite`)
- `vite.config.js`
- `index.html`
- `src/main.jsx`

CodeSandbox will auto-install the dependencies from `package.json`.

## 3. Add your App.jsx
Create `src/App.jsx` and paste in your original component code (the long one with the ledger/invoicing/payroll app). **Copy it directly from your original source** rather than retyping — it contains a long base64-encoded logo image that's easy to corrupt by hand.

## 4. The ONE required code change: replace `window.storage`

`window.storage` is a special API that only exists inside Claude.ai's artifact preview — it does **not** exist in a normal browser or on CodeSandbox. You need to swap it for `localStorage` (or leave it as in-memory state if you don't need it to persist between visits).

Find this block near the bottom of the file, inside the `App` component:

```js
useEffect(() => {
  (async () => {
    try {
      const res = await window.storage.get(STORAGE_KEY, false);
      if (res && res.value) {
        const parsed = JSON.parse(res.value);
        setData({ ...DEFAULT_DATA, ...parsed, company: { ...DEFAULT_COMPANY, ...(parsed.company || {}) } });
        setCompanyNameDraft(parsed.companyName || DEFAULT_DATA.companyName);
      } else {
        setCompanyNameDraft(DEFAULT_DATA.companyName);
      }
    } catch (err) {
      setCompanyNameDraft(DEFAULT_DATA.companyName);
    }
    setLoaded(true);
  })();
}, []);

const mutate = useCallback((fn) => {
  setData((prev) => {
    const next = fn(prev);
    window.storage.set(STORAGE_KEY, JSON.stringify(next), false).catch(() => {});
    return next;
  });
}, []);
```

Replace it with this (uses `localStorage`, which works in any browser, including CodeSandbox's preview):

```js
useEffect(() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      setData({ ...DEFAULT_DATA, ...parsed, company: { ...DEFAULT_COMPANY, ...(parsed.company || {}) } });
      setCompanyNameDraft(parsed.companyName || DEFAULT_DATA.companyName);
    } else {
      setCompanyNameDraft(DEFAULT_DATA.companyName);
    }
  } catch (err) {
    setCompanyNameDraft(DEFAULT_DATA.companyName);
  }
  setLoaded(true);
}, []);

const mutate = useCallback((fn) => {
  setData((prev) => {
    const next = fn(prev);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (err) {}
    return next;
  });
}, []);
```

That's the only functional change needed — everything else (accounts, journal, payroll, invoicing, exports) runs exactly the same.

## 5. Run it
CodeSandbox should auto-preview once dependencies install. If not, click "Open in new tab" or run `npm run dev` in the sandbox terminal.

## Notes
- The `xlsx` "Export to Excel" button works fine in a normal browser — it triggers a real file download.
- Fonts load from Google Fonts via a `<link>` tag injected at runtime — this works fine on CodeSandbox as long as the sandbox has network access (it does, by default).
- Nothing else in the file needs to change — no other Claude-artifact-only APIs are used.

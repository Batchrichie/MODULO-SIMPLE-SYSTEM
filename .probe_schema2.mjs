// Stub a minimal WebSocket constructor so supabase-js Node 22+ check does not throw.
function FakeWS(url, protocols) {
  this.url = url;
  this.protocols = protocols;
  this.readyState = 3;
  this.close = () => {};
  this.send = () => {};
  this.addEventListener = () => {};
  this.removeEventListener = () => {};
  this.dispatchEvent = () => true;
}
globalThis.WebSocket = FakeWS;

import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";
import path from "path";
import { readFileSync } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = readFileSync(path.join(__dirname, ".env"), "utf8")
  .split("\n")
  .filter((line) => line && !line.startsWith("#"))
  .reduce((acc, line) => {
    const idx = line.indexOf("=");
    acc[line.slice(0, idx)] = line.slice(idx + 1);
    return acc;
  }, {});

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fetch },
  realtime: { enabled: false },
});

console.error("Querying public.vw_accounting_periods full list …");
const { data: vwRows, error: vwErr } = await supabase
  .from("vw_accounting_periods")
  .select("*")
  .limit(24);
if (vwErr) {
  console.error("VW ERROR:", vwErr.message, JSON.stringify(vwErr));
} else {
  if (vwRows && vwRows.length > 0) {
    console.log(`vw_accounting_periods returned ${vwRows.length} rows`);
    console.log("COLUMNS:", Object.keys(vwRows[0]).join(", "));
    console.log("\nFirst row:\n", JSON.stringify(vwRows[0], null, 2));
    if (vwRows.length > 1) {
      console.log("\nSecond row (partial):", JSON.stringify(vwRows[1], null, 2));
    }
  } else {
    console.log("vw_accounting_periods: empty or 0 rows.");
  }
}

console.log("\n\n=== Trying table accounting_periods select * again, broader range ===");
const { data: rows2, error: err2 } = await supabase
  .from("accounting_periods")
  .select("*")
  .limit(24);
if (err2) {
  console.error("TABLE ERROR:", err2.message, JSON.stringify(err2));
} else {
  if (rows2 && rows2.length > 0) {
    console.log(`accounting_periods returned ${rows2.length} rows`);
    console.log("COLUMNS:", Object.keys(rows2[0]).join(", "));
    console.log("First row:\n", JSON.stringify(rows2[0], null, 2));
  } else {
    console.log("accounting_periods table: empty");
  }
}

// Also resolve the RPC function signatures by probing with WRONG param names
// to force a "function does not exist" message that lists valid signatures.
console.log("\n\n=== Signature probe: close_accounting_period with bad params ===");
for (const attempt of [
  { name: "close_accounting_period(p_period_code, p_reason)", params: { p_period_code: "2026-09", p_reason: "x" } },
  { name: "close_accounting_period(p_period, p_reason)", params: { p_period: "2026-09", p_reason: "x" } },
  { name: "reopen_accounting_period(p_period_code, p_reason)", params: { p_period_code: "2026-09", p_reason: "x" } },
  { name: "reopen_accounting_period(p_period, p_reason)", params: { p_period: "2026-09", p_reason: "x" } },
]) {
  const { error } = await supabase.rpc(attempt.name.split("(")[0], attempt.params);
  const msg = error ? error.message : "no-error";
  console.log(`${attempt.name}: => ${msg}`);
}

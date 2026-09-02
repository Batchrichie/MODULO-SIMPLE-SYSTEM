// Stub a minimal WebSocket constructor so supabase-js Node 22+ check does not throw.
// It will never actually be invoked because realtime is disabled below.
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

console.error("Querying public.accounting_periods …");
const { data: cols, error: errCols } = await supabase
  .from("accounting_periods")
  .select("*")
  .range(0, 2);
if (errCols) {
  console.error("SELECT error:", errCols.message, JSON.stringify(errCols));
  process.exit(0);
}
console.log("\n=== Sample rows (up to 2) — column names from keys: ===");
if (cols && cols.length > 0) {
  console.log("COLUMNS:", Object.keys(cols[0]).join(", "));
  console.log("\nSample data:\n", JSON.stringify(cols, null, 2));
} else {
  console.log("No rows returned; table may be empty or not exist.");
}

console.log("\n\n=== Checking close_accounting_period / reopen_accounting_period RPC existence via dummy call ===");
for (const fn of ["close_accounting_period", "reopen_accounting_period"]) {
  const { error } = await supabase.rpc(fn, {
    p_period_id: "00000000-0000-0000-0000-000000000000",
    p_reason: "schema-probe",
  });
  const msg = error ? error.message : "no-error (possibly null row returned)";
  console.log(`${fn}: probe result message -> ${msg}`);
}

console.log("\n=== Checking vw_accounting_periods existence via select 1 ===");
const vwResult = await supabase
  .from("vw_accounting_periods")
  .select("*", { count: "exact", head: true })
  .range(0, 0);
console.log(
  "vw_accounting_periods status:",
  vwResult.error ? `ERROR: ${vwResult.error.message}` : `OK (count: ${vwResult.count})`
);

// Also test: if columns were period_code / financial_year_id, sample values show up above.
// Also try selecting explicitly period_code and financial_year_id:
if (cols && cols.length > 0) {
  const sample = cols[0];
  const normalizedKeys = Object.keys(sample).map(k => k.toLowerCase());
  console.log("\n=== Normalized lowercase column list:", normalizedKeys.join(", "));
}

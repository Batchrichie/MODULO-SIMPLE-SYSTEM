# Repository reconciliation plan: proposal only (nothing executed, no repo edits, no commits, no database changes)

Basis: repo `Batchrichie/MODULO-SIMPLE-SYSTEM` at HEAD `ca2fbae` (2026-10-08), read-only clone with full history; production read-only queries; the 125 verified reconstructions (unchanged: re-verified, 125 exact, 0 changed).

## 0. Scope correction
The repo changed after the earlier snapshot. `supabase/migrations/` now has 10 files:
- 8 repo-only files (their versions do not exist in production), as previously reported.
- 2 files added on 2026-10-08 whose versions DO exist in production but whose content differs: `20261008100842_harden_accounting_period_controls` and `20261008100913_restrict_accounting_period_rpc_execute`.

## 1. File-by-file disposition

Replay column = what would happen if the file were executed against the populated production database (inferred from content and live state; not executed).

| # | Repo file | Production counterpart | Exact content differences | Version-key issue | Replay outcome on production | Proposed disposition |
|---|---|---|---|---|---|---|
| 1 | 20260819_fix_gl_report_amount_and_payroll_controls | 20260819114822 (same name) | Semantically identical; repo adds header comment and compact formatting | Duplicate key `20260819` with #2; 8-digit version | DANGEROUS: re-creates the older run_payroll (no loan deduction, no employer Tier split, no period guard, old 0.5%/5% model) and an older P&L function | REPLACE with the production-exact file; ARCHIVE the original |
| 2 | 20260819_gl_reports_and_payroll_source_of_truth | None by name; overlaps 20260819113717 + 20260819113739 + part of 20260819114822 | Different bundle: 3 report functions plus an old run_payroll; lacks get_financial_reconciliation(); not equal to the production pair | Duplicate key `20260819` with #1 | DANGEROUS: DROPs get_profit_and_loss(date,date) and recreates an older shape; re-creates the older run_payroll | ARCHIVE (superseded); never executable |
| 3 | 20260821000000_get_account_ledger | 20260821133530 add_get_account_ledger | Same logic; repo adds a header comment and explicit `default null::date` casts; name and version differ | none | Harmless re-create of the same function | REPLACE with the production-exact file; ARCHIVE the original |
| 4 | 20260824_allow_invoice_sms_log_write | 20260824175744 (same name) | Identical SQL; repo adds 2 comment lines | 8-digit version | FAILS: CREATE POLICY has no IF NOT EXISTS and the policy already exists | REPLACE with the production-exact file; ARCHIVE the original |
| 5 | 20260916000000_mark_cash_and_bank_accounts_as_cash | None | n/a | none | No-op: accounts 1103 and 1113 are already `is_cash = true` live (statement is idempotent) | ARCHIVE; effect already present (decision A) |
| 6 | 20260920230000_frontend_backend_contract_compatibility | 20260920220431 (same name) | Repo has 2 EXTRA statements production lacks: `REVOKE EXECUTE ... FROM anon` on post_bill(9-arg) and on record_project_transaction_value(3-arg), added in repo commit 6fdb628 after the initial commit | Sorts between production 20260920220431 and 20260920231032 | Functionally the same CREATE OR REPLACE overloads; the REVOKEs would be no-ops today (live ACL on both already excludes anon and PUBLIC) | FLAGGED for separate security review. REPLACE with the production-exact file; ARCHIVE the original with the REVOKEs; do NOT deploy |
| 7 | 20260920233000_frontend_contract_and_project_accounting | 20260920231032 (same name) | Identical apart from operator whitespace and header comments | none | Harmless re-create plus GRANT/REVOKE | REPLACE with the production-exact file; ARCHIVE the original |
| 8 | 20260923111500_data_api_grants_baseline | None (never applied) | n/a | none | HARMFUL to hardening: grants SELECT/INSERT/UPDATE/DELETE to `authenticated` on every public table, which would re-add UPDATE/DELETE on payroll_runs and payroll_lines and INSERT/UPDATE/DELETE on expenses (currently revoked), and does not remove existing anon grants | ARCHIVE; do NOT apply; any grants baseline needs its own security-reviewed design (decision D) |
| 9 (new) | 20261008100842_harden_accounting_period_controls | Same version in production | Production text is wrapped in `DO $migration$ BEGIN ... END` and has no CLOSED guard; the repo version adds `AND status <> 'CLOSED'` to the period-normalization UPDATE and drops the DO wrapper. The repo copy was added 1 min after production applied it ("align with applied version") and edited again 44 s later to add the CLOSED guard, so it never equalled production | Same version, different content | None (version already applied). Production's text would reopen CLOSED periods if replayed where any exist; live there are no closed periods (audit table empty) so no production effect occurred | REPLACE with the production-exact file; ARCHIVE the repo variant as the reference for a possible forward fix (decision C) |
| 10 (new) | 20261008100913_restrict_accounting_period_rpc_execute | Same version in production | Semantically identical; repo adds comments and multi-line formatting | Same version | None | REPLACE with the production-exact file; ARCHIVE the original |

Duplicate version keys: `20260819` (files 1 and 2). All other repo versions are unique, but only files 9 and 10 use production-format 14-digit versions.

## 2. Proposed final repository layout

```
supabase/
  migrations/                    ACTIVE ledger mirror (CLI-visible). 115 exact production migrations,
                                 later only genuinely new forward migrations (> baseline). Immutable up to the baseline.
  baseline/                      Reviewed schema-only dump at version 20261009070555 (to be generated by you or CI;
                                 NOT created here: needs a database connection). Fresh environments start from this.
  reconciliation/
    production_inventory.psv     version | name | production md5
    reconstruction_results.psv   per-file PASS/FAIL
    RECONCILIATION_STATUS.md
    rollbacks/                   rollback SQL for migrations we authored (never CLI-visible)
  archive/
    repo-originals/              the 8 repo-only files + the 2 differing 8 Oct files, as found, byte-for-byte,
                                 renamed `.sql.txt` so tooling cannot execute them, plus README (provenance, commit ids)
  tools/
    verify_history.py            history guard (section 3)
    pending_check.sql/.sh        pending-vs-applied check (section 3)
PRIVATE (outside this repository): the 10 exact held migrations + EVIDENCE_ONLY note.
```
The repository is readable without authentication (cloned anonymously), so identity and data-specific migrations should live in a private store, with only names and hashes in the public manifest. Credential-bearing migrations remain evidence-only.

Replay-completeness caveat: the 115-file tree is NOT self-sufficient. Later tree migrations depend on objects created by held files (`positions` and employee columns in positions_and_employee_roles; `project_assignments` and the field-ops tables in field_ops_tables_and_pm_autoassign). History is therefore audit evidence, not a replay source. New environments should start from `baseline/` plus forward migrations.

## 3. Deployment safeguards (no replay of reconstructed history against production)

1. Production's `supabase_migrations.schema_migrations` is the ledger. The repo mirrors it; it never drives it.
2. Baseline marker: freeze at `20261009070555`. Every file at or below it must match the manifest hash (no post-application edits; this is how the 8 Oct divergence happened).
3. History guard in CI / pre-commit:
   - unique version keys; names match `^\d{14}_[a-z0-9_]+\.sql$`;
   - no new file with a version at or below the baseline;
   - every baseline file's md5 equals the production hash;
   - no file outside `migrations/` is CLI-visible (archive uses `.sql.txt`);
   - secret scan (credentials, emails, auth UUIDs) over `migrations/`.
4. Pending check before any apply: pending = repo versions minus remote versions. It must contain only the intended new file(s) and every pending version must be greater than the maximum remote version. Out-of-order pending versions block the apply (this prevents the older 20260819 files from being replayed with `db push --include-all`, which would regress run_payroll and the P&L function).
5. Forbidden against production without explicit written approval: `db reset`, `db push --include-all`, `migration repair`, executing anything from `archive/`.
6. One authoritative path to apply: the submitted SQL text is what production stores, so commit exactly that text, then record its production hash in the manifest. No edits after apply; fixes are new forward migrations.
7. Review gates: destructive statements (TRUNCATE/DROP/DELETE without WHERE) and hardcoded production ids/emails need a named approver; secrets only via Vault, never in migrations; rollback SQL stored separately.
8. Test on a disposable database first (local or branch), restored from `baseline/`.
9. Current state: the repo has no `supabase/config.toml`, no CI workflows and no migration commands, so none of this exists yet and is part of the proposal.

## 4. Decisions requiring approval
A. Disposition of the 10 files as tabulated (archive/replace), including `mark_cash` (archive vs record as a no-op forward migration).
B. Where the 10 held migrations live (recommended: private store outside the public repo) and whether the repo should be made private.
C. harden_accounting_period_controls: faithful production text in the tree (recommended) vs the repo's corrected variant; whether to author a forward migration protecting CLOSED periods.
D. Security review of the two anon REVOKEs and of the grants baseline (live anon table grants still exist; out of this phase).
E. Fresh-environment strategy: baseline dump at 20261009070555 (who runs pg_dump) vs history replay.
F. Approve implementing the guard scripts and CI.
G. The staging ZIP contains the 11 sensitive-review files: delete and regenerate a candidate-tree-only ZIP?
H. Coordination with whoever edits migration files in the repo after they are applied.
I. Out of this phase and unchanged: PAYE effective dating, privilege hardening, account-code changes, credential rotation.

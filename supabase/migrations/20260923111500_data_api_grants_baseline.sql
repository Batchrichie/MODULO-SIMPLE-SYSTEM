-- Data API grants baseline for the October 30 Supabase change.
--
-- Existing tables historically inherited broad Data API grants. Make the intended
-- authenticated/service_role table privileges explicit so a future Supabase
-- default-grant change does not make existing tables or migrations inconsistent.
--
-- We intentionally do not add anon access here. Modulo's application data is
-- authenticated and RLS-protected; exposing accounting, payroll, invoices,
-- projects, and employee data to anon is not required for the application.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT quote_ident(schemaname) AS schema_name,
           quote_ident(tablename) AS table_name
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %s.%s TO authenticated',
      r.schema_name, r.table_name
    );
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %s.%s TO service_role',
      r.schema_name, r.table_name
    );
  END LOOP;
END
$$;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO service_role;

-- Restrict accounting-period state-transition RPCs to authenticated/service roles.
-- The functions still enforce the existing 'all' permission in their bodies.

REVOKE EXECUTE ON FUNCTION public.close_accounting_period(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reopen_accounting_period(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.close_accounting_period(uuid, text)
  TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.reopen_accounting_period(uuid, text)
  TO authenticated, service_role;

-- Harden accounting-period enforcement at the database boundary.
--
-- Existing posting RPCs call assert_period_open(). This migration adds a final
-- journal-entry trigger so future posting code cannot accidentally write into
-- a CLOSED/FUTURE period or attach the wrong period_id/period code.
--
-- The demo calendar is normalized only for periods that have not been closed.
-- Existing CLOSED periods are never reopened by this migration.

CREATE OR REPLACE FUNCTION public.assert_period_open(p_date date)
RETURNS TABLE(period_id uuid, period_code varchar, financial_year_id uuid)
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_period public.accounting_periods%ROWTYPE;
  v_fy_status varchar;
BEGIN
  SELECT ap.* INTO v_period
  FROM public.accounting_periods ap
  WHERE p_date BETWEEN ap.start_date AND ap.end_date
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No accounting period exists for transaction date %.', p_date;
  END IF;

  SELECT fy.status INTO v_fy_status
  FROM public.financial_years fy
  WHERE fy.id = v_period.financial_year_id;

  IF v_fy_status IS DISTINCT FROM 'OPEN' THEN
    RAISE EXCEPTION 'Financial year for accounting period % is not open.', v_period.period_name;
  END IF;

  IF v_period.status = 'FUTURE' THEN
    RAISE EXCEPTION 'Accounting period % is not yet open.', v_period.period_name;
  END IF;

  IF v_period.status = 'CLOSED' THEN
    RAISE EXCEPTION 'Accounting period % is closed.', v_period.period_name;
  END IF;

  IF v_period.status IS DISTINCT FROM 'OPEN' THEN
    RAISE EXCEPTION 'Accounting period % is not open (status=%).',
      v_period.period_name, v_period.status;
  END IF;

  RETURN QUERY SELECT v_period.id, v_period.period_code, v_period.financial_year_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_journal_entry_period()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_period public.accounting_periods%ROWTYPE;
  v_fy_status text;
BEGIN
  SELECT ap.* INTO v_period
  FROM public.accounting_periods ap
  WHERE NEW.date BETWEEN ap.start_date AND ap.end_date
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No accounting period exists for journal date %.', NEW.date;
  END IF;

  SELECT fy.status INTO v_fy_status
  FROM public.financial_years fy
  WHERE fy.id = v_period.financial_year_id;

  IF v_fy_status IS DISTINCT FROM 'OPEN' THEN
    RAISE EXCEPTION 'Financial year for accounting period % is not open.', v_period.period_name;
  END IF;

  IF v_period.status <> 'OPEN' THEN
    RAISE EXCEPTION 'Accounting period % is not open (status=%).',
      v_period.period_name, v_period.status;
  END IF;

  IF NEW.period_id IS NULL THEN
    RAISE EXCEPTION 'Journal entry % must reference its accounting period.', NEW.id;
  END IF;

  IF NEW.period_id IS DISTINCT FROM v_period.id THEN
    RAISE EXCEPTION
      'Journal entry % period_id does not match transaction date % (expected period %).',
      NEW.id, NEW.date, v_period.period_code;
  END IF;

  IF NEW.period IS DISTINCT FROM v_period.period_code THEN
    RAISE EXCEPTION
      'Journal entry % period code does not match transaction date % (expected %).',
      NEW.id, NEW.date, v_period.period_code;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS z_enforce_journal_entry_period ON public.journal_entries;

CREATE TRIGGER z_enforce_journal_entry_period
BEFORE INSERT OR UPDATE OF date, period, period_id
ON public.journal_entries
FOR EACH ROW
EXECUTE FUNCTION public.enforce_journal_entry_period();

REVOKE EXECUTE ON FUNCTION public.close_accounting_period(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reopen_accounting_period(uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.close_accounting_period(uuid, text)
  TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.reopen_accounting_period(uuid, text)
  TO authenticated, service_role;

SELECT set_config('app.period_status_write_allowed', 'on', true);

UPDATE public.accounting_periods
SET status = CASE
    WHEN start_date > CURRENT_DATE THEN 'FUTURE'
    ELSE 'OPEN'
  END,
  is_current = (CURRENT_DATE BETWEEN start_date AND end_date)
WHERE financial_year_id IN (
  SELECT id FROM public.financial_years WHERE status = 'OPEN'
)
AND status <> 'CLOSED';

CREATE UNIQUE INDEX IF NOT EXISTS accounting_periods_one_current_idx
  ON public.accounting_periods (financial_year_id)
  WHERE is_current = true;

-- Follow-up migration for the frontend/backend contract audit and project accounting source-of-truth fixes.
--
-- Issue 7: FinancialsPanel already calls get_profit_and_loss with an optional
-- p_project filter. The original backend only exposed the two-argument
-- signature, so project P&L calls failed with a function-signature error.
-- This overload preserves the existing two-argument contract and adds the
-- exact three-argument contract used by the frontend.
--
-- Issue 8: Project financial cards were recalculating revenue, cost and WIP
-- from cached React journal state even though the backend already owns the
-- authoritative project financial view (vw_project_poc). The companion
-- frontend change now treats backend project figures as authoritative.

CREATE OR REPLACE FUNCTION public.get_profit_and_loss(
  p_start_date date,
  p_end_date date,
  p_project text
)
RETURNS TABLE(
  code text,
  name text,
  type text,
  reporting_group text,
  total_debit numeric,
  total_credit numeric,
  amount numeric
)
LANGUAGE plpgsql
STABLE
SET search_path TO public, pg_temp
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    a.code::text,
    a.name::text,
    a.type::text,
    a.reporting_group::text,
    COALESCE(SUM(l.debit), 0),
    COALESCE(SUM(l.credit), 0),
    CASE
      WHEN a.normal = 'Credit'
        THEN COALESCE(SUM(l.credit), 0) - COALESCE(SUM(l.debit), 0)
      WHEN a.normal = 'Debit'
        THEN COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0)
      ELSE 0
    END
  FROM public.accounts a
  JOIN public.journal_lines l
    ON a.code = l.account_code
  JOIN public.journal_entries e
    ON l.entry_id = e.id
  WHERE a.type IN ('Income', 'Expense')
    AND e.date BETWEEN p_start_date AND p_end_date
    AND (p_project IS NULL OR e.project = p_project)
  GROUP BY
    a.code,
    a.name,
    a.type,
    a.reporting_group,
    a.normal
  HAVING
    COALESCE(SUM(l.debit), 0) <> 0
    OR COALESCE(SUM(l.credit), 0) <> 0
  ORDER BY
    a.type,
    a.reporting_group NULLS LAST,
    a.code;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_profit_and_loss(date, date, text)
  TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_profit_and_loss(date, date, text)
  FROM anon;

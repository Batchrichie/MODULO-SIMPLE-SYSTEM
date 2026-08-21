-- Migration: get_account_ledger
-- Captures a function that was created directly on the live Supabase project
-- during design/prototyping. This migration brings it into source control
-- with no behavioral changes — verified byte-for-byte against the live
-- pg_get_functiondef() output on 2026-08-21.
--
-- Behavior:
--   Returns the ledger (list of journal lines + running balance) for a
--   single account, optionally bounded by [p_start_date, p_end_date].
--   - If p_start_date is provided, an opening-balance row is emitted first,
--     summarizing all activity strictly before p_start_date.
--   - running_balance is a signed running total, normalized so it always
--     reads as a natural increase for the account's normal balance side
--     (Debit-normal accounts: debit - credit; Credit-normal: credit - debit).
--   - reversed / reversal_of are passed through from journal_entries so the
--     UI can visually flag reversed entries and their reversal pairs.
--
-- Verified against live data on 2026-08-21:
--   - Account 1113 (GCB Bank, zero activity): returns 0 rows with no start
--     date, matching a computed Trial Balance balance of 0.
--   - Account 6100 (Salaries and Wages): verified against a temporary,
--     fully-cleaned-up synthetic reversed entry + its reversal — running
--     balance correctly nets the pair to 0 before continuing with real
--     activity, ending at the correct final balance of 3,661.88, matching
--     Trial Balance. No test data was left in the database.

CREATE OR REPLACE FUNCTION public.get_account_ledger(
  p_account_code text,
  p_start_date date DEFAULT NULL::date,
  p_end_date date DEFAULT NULL::date
)
RETURNS TABLE(
  entry_id text,
  entry_number text,
  entry_date date,
  description text,
  project text,
  reversed boolean,
  reversal_of text,
  debit numeric,
  credit numeric,
  running_balance numeric,
  is_opening_balance boolean
)
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_normal text;
  v_opening numeric := 0;
begin
  select normal into v_normal from accounts where code = p_account_code;
  if v_normal is null then
    raise exception 'Unknown account code %', p_account_code;
  end if;

  -- balance of everything strictly before the requested window (0 if no start date, i.e. showing all-time)
  if p_start_date is not null then
    select coalesce(
      case when v_normal = 'Debit'
        then sum(l.debit) - sum(l.credit)
        else sum(l.credit) - sum(l.debit)
      end, 0)
    into v_opening
    from journal_lines l
    join journal_entries e on e.id = l.entry_id
    where l.account_code = p_account_code
      and e.date < p_start_date;

    return query
    select null::text, null::text, p_start_date - 1, 'Opening balance'::text,
           null::text, false, null::text, null::numeric, null::numeric,
           v_opening, true;
  end if;

  return query
  select
    e.id::text,
    e.entry_number::text,
    e.date,
    e.description,
    e.project::text,
    e.reversed,
    e.reversal_of::text,
    l.debit,
    l.credit,
    v_opening + sum(
      case when v_normal = 'Debit' then (l.debit - l.credit) else (l.credit - l.debit) end
    ) over (order by e.date, e.id, l.id rows between unbounded preceding and current row) as running_balance,
    false
  from journal_lines l
  join journal_entries e on e.id = l.entry_id
  where l.account_code = p_account_code
    and (p_start_date is null or e.date >= p_start_date)
    and (p_end_date is null or e.date <= p_end_date)
  order by e.date, e.id, l.id;
end;
$function$;

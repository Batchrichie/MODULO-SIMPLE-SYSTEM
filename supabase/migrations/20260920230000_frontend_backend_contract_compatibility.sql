-- Frontend/backend contract compatibility follow-up.
-- The existing frontend currently calls:
--   1) post_bill with p_bill_number plus the other posting arguments.
--   2) record_project_transaction_value with only p_project, p_field and p_new_value.
-- The live database had the hardened implementations, but their signatures no longer
-- matched those frontend call sites. These overloads preserve the hardened 5-argument
-- implementation while restoring the frontend contracts without replacing existing
-- functions or changing their accounting controls.

-- Frontend contract: post_bill(p_bill_number, p_date, p_due_date, p_vendor,
-- p_description, p_project, p_amount, p_expense_account_code, p_ap_account_code).
-- The supplied bill number is honored when present; otherwise the normal sequence is used.
CREATE OR REPLACE FUNCTION public.post_bill(
  p_bill_number text,
  p_date date,
  p_due_date date,
  p_vendor text,
  p_description text,
  p_project character varying,
  p_amount numeric,
  p_expense_account_code character varying,
  p_ap_account_code character varying DEFAULT NULL::character varying
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
DECLARE
  v_bill_id varchar;
  v_bill_number varchar;
  v_entry_id varchar;
  v_expense_type varchar;
  v_ap_account varchar;
  v_ap_role varchar;
  v_period record;
BEGIN
  IF NOT (public.my_permissions() ? 'all' OR public.my_permissions() ? 'ceo:bills:write') THEN
    RAISE EXCEPTION 'Not authorized to post bills' USING errcode = '42501';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Bill amount must be greater than zero';
  END IF;

  IF p_vendor IS NULL OR trim(p_vendor) = '' THEN
    RAISE EXCEPTION 'Vendor is required';
  END IF;

  v_bill_number := NULLIF(trim(p_bill_number), '');
  IF v_bill_number IS NULL THEN
    v_bill_number := 'BILL-' || nextval('public.bill_seq')::text;
  END IF;

  IF EXISTS (SELECT 1 FROM public.bills WHERE bill_number = v_bill_number) THEN
    RAISE EXCEPTION 'Bill number % already exists', v_bill_number;
  END IF;

  SELECT type INTO v_expense_type
  FROM public.accounts
  WHERE code = p_expense_account_code;

  IF v_expense_type IS NULL THEN
    RAISE EXCEPTION 'Expense account % does not exist', p_expense_account_code;
  END IF;

  IF v_expense_type NOT IN ('Expense', 'Asset') THEN
    RAISE EXCEPTION 'Account % (type=%) is not a valid expense/asset account for a bill',
      p_expense_account_code, v_expense_type;
  END IF;

  IF p_ap_account_code IS NOT NULL THEN
    SELECT role INTO v_ap_role
    FROM public.accounts
    WHERE code = p_ap_account_code;

    IF v_ap_role IS DISTINCT FROM 'ap' THEN
      RAISE EXCEPTION 'Account % is not a valid AP account (role=%)',
        p_ap_account_code, coalesce(v_ap_role, 'none');
    END IF;

    v_ap_account := p_ap_account_code;
  ELSE
    SELECT code INTO v_ap_account
    FROM public.accounts
    WHERE role = 'ap' AND is_default = true
    LIMIT 1;

    IF v_ap_account IS NULL THEN
      RAISE EXCEPTION 'No default AP account is configured (role=ap, is_default=true)';
    END IF;
  END IF;

  IF v_ap_account = p_expense_account_code THEN
    RAISE EXCEPTION 'Expense account and AP account cannot be the same account';
  END IF;

  SELECT * INTO v_period
  FROM public.assert_period_open(p_date);

  v_bill_id := v_bill_number;

  PERFORM set_config('app.ap_write_allowed', 'on', true);
  PERFORM set_config('app.ledger_write_allowed', 'on', true);

  INSERT INTO public.bills (
    id, bill_number, date, due_date, vendor, description, project, amount,
    status, expense_account_code, ap_account_code, posted_at, posted_by
  ) VALUES (
    v_bill_id, v_bill_number, p_date, p_due_date, p_vendor, p_description, p_project, p_amount,
    'Unpaid', p_expense_account_code, v_ap_account, now(), public.my_employee_id()
  );

  v_entry_id := 'JE-BILL-' || to_char(nextval('public.journal_entry_bill_seq'), 'FM0000');

  INSERT INTO public.journal_entries (
    id, entry_number, date, description, period, project, reversed, period_id
  ) VALUES (
    v_entry_id, v_entry_id, p_date,
    concat('Bill ', v_bill_number, ' — ', p_vendor),
    v_period.period_code, p_project, false, v_period.period_id
  );

  INSERT INTO public.journal_lines (entry_id, account_code, debit, credit) VALUES
    (v_entry_id, p_expense_account_code, p_amount, 0),
    (v_entry_id, v_ap_account, 0, p_amount);

  UPDATE public.bills
  SET journal_entry_id = v_entry_id
  WHERE id = v_bill_id;

  RETURN jsonb_build_object(
    'bill_id', v_bill_id,
    'bill_number', v_bill_number,
    'journal_entry_id', v_entry_id,
    'ap_account_code', v_ap_account,
    'status', 'Unpaid'
  );
END;
$$;

-- Keep the existing hardened 5-argument project-value function as the source of truth.
-- The 3-argument frontend contract uses the current date and no reason, so the existing
-- function still requires a reason whenever prior project activity makes one mandatory.
CREATE OR REPLACE FUNCTION public.record_project_transaction_value(
  p_project character varying,
  p_field character varying,
  p_new_value numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
BEGIN
  RETURN public.record_project_transaction_value(
    p_project,
    p_field,
    p_new_value,
    CURRENT_DATE,
    NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.post_bill(
  text, date, date, text, text, character varying, numeric, character varying, character varying
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.post_bill(
  text, date, date, text, text, character varying, numeric, character varying, character varying
) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.post_bill(
  text, date, date, text, text, character varying, numeric, character varying, character varying
) FROM anon;

REVOKE ALL ON FUNCTION public.record_project_transaction_value(
  character varying, character varying, numeric
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.record_project_transaction_value(
  character varying, character varying, numeric
) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.record_project_transaction_value(
  character varying, character varying, numeric
) FROM anon;

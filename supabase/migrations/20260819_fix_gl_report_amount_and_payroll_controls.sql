-- Follow-up migration for GL-driven reports and payroll controls.
-- P&L intentionally exposes `amount` because the existing frontend report mapper
-- consumes that field. The value is still calculated exclusively from the GL.
DROP FUNCTION IF EXISTS public.get_profit_and_loss(date, date);
CREATE OR REPLACE FUNCTION public.get_profit_and_loss(p_start_date date, p_end_date date)
RETURNS TABLE(code text, name text, type text, reporting_group text, total_debit numeric, total_credit numeric, amount numeric)
LANGUAGE plpgsql
SET search_path TO 'public','pg_temp'
AS $$
BEGIN
  RETURN QUERY
  SELECT a.code::text,a.name::text,a.type::text,a.reporting_group::text,
         COALESCE(SUM(l.debit),0),COALESCE(SUM(l.credit),0),
         CASE WHEN a.normal='Credit' THEN COALESCE(SUM(l.credit),0)-COALESCE(SUM(l.debit),0)
              WHEN a.normal='Debit' THEN COALESCE(SUM(l.debit),0)-COALESCE(SUM(l.credit),0)
              ELSE 0 END
  FROM accounts a JOIN journal_lines l ON a.code=l.account_code
  JOIN journal_entries e ON l.entry_id=e.id
  WHERE a.type IN ('Income','Expense') AND e.date BETWEEN p_start_date AND p_end_date
  GROUP BY a.code,a.name,a.type,a.reporting_group,a.normal
  HAVING COALESCE(SUM(l.debit),0)<>0 OR COALESCE(SUM(l.credit),0)<>0
  ORDER BY a.type,a.reporting_group NULLS LAST,a.code;
END;
$$;

CREATE OR REPLACE FUNCTION public.run_payroll(p_period text)
RETURNS void LANGUAGE plpgsql SET search_path TO 'public','pg_temp' AS $$
DECLARE
  v_emp record; v_rates record;
  v_gross numeric; v_emp_tier1 numeric; v_emp_tier2 numeric; v_ssnit_er numeric;
  v_paye numeric; v_net numeric; v_chargeable numeric;
  v_run_id text := 'RUN-'||p_period; v_entry_id text := 'JE-PAY-'||p_period;
  v_total_gross numeric:=0; v_total_t1 numeric:=0; v_total_t2 numeric:=0;
  v_total_er numeric:=0; v_total_paye numeric:=0; v_total_net numeric:=0;
BEGIN
  PERFORM set_config('app.ledger_write_allowed','on',true);
  IF p_period IS NULL OR p_period !~ '^\d{4}-\d{2}$' THEN RAISE EXCEPTION 'Payroll period must be YYYY-MM.'; END IF;
  IF EXISTS (SELECT 1 FROM payroll_runs WHERE period=p_period) THEN RAISE EXCEPTION 'Payroll for period % has already been posted.',p_period; END IF;
  IF NOT EXISTS (SELECT 1 FROM employees WHERE active=true) THEN RAISE EXCEPTION 'No active employees to run payroll for.'; END IF;
  SELECT * INTO v_rates FROM app_tax_rates LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'No tax rates configured in app_tax_rates.'; END IF;
  IF v_rates.employee_ssnit_tier1_rate IS NULL OR v_rates.employee_tier2_rate IS NULL OR v_rates.ssnit_employer_rate IS NULL THEN RAISE EXCEPTION 'Incomplete pension rate configuration.'; END IF;
  INSERT INTO payroll_runs(id,period,entry_number,posted_at) VALUES(v_run_id,p_period,v_entry_id,now());
  INSERT INTO journal_entries(id,entry_number,date,description,period,project) VALUES(v_entry_id,v_entry_id,(p_period||'-28')::date,'Payroll posting for '||p_period,p_period,NULL);
  FOR v_emp IN SELECT * FROM employees WHERE active=true LOOP
    v_gross:=COALESCE(v_emp.base_salary,0);
    IF v_gross<0 THEN RAISE EXCEPTION 'Negative salary for employee %.',v_emp.name; END IF;
    IF v_emp.exempt_ssnit THEN v_emp_tier1:=0; v_emp_tier2:=0; v_ssnit_er:=0;
    ELSE v_emp_tier1:=ROUND(v_gross*v_rates.employee_ssnit_tier1_rate,2); v_emp_tier2:=ROUND(v_gross*v_rates.employee_tier2_rate,2); v_ssnit_er:=ROUND(v_gross*v_rates.ssnit_employer_rate,2); END IF;
    v_chargeable:=GREATEST(v_gross-v_emp_tier1-v_emp_tier2,0);
    IF v_emp.exempt_paye THEN v_paye:=0;
    ELSE
      SELECT COALESCE(SUM(slice*rate),0) INTO v_paye FROM (SELECT LEAST(v_chargeable,upto_amount)-LAG(LEAST(v_chargeable,upto_amount),1,0) OVER(ORDER BY upto_amount) slice,rate FROM paye_brackets) b WHERE slice>0;
      v_paye:=ROUND(v_paye,2);
    END IF;
    v_net:=ROUND(v_gross-v_emp_tier1-v_emp_tier2-v_paye,2);
    INSERT INTO payroll_lines(run_id,employee_id,name,gross,ssnit_employee,ssnit_employer,employee_ssnit_tier1,employee_tier2,paye,net) VALUES(v_run_id,v_emp.id,v_emp.name,v_gross,v_emp_tier1+v_emp_tier2,v_ssnit_er,v_emp_tier1,v_emp_tier2,v_paye,v_net);
    v_total_gross:=v_total_gross+v_gross; v_total_t1:=v_total_t1+v_emp_tier1; v_total_t2:=v_total_t2+v_emp_tier2; v_total_er:=v_total_er+v_ssnit_er; v_total_paye:=v_total_paye+v_paye; v_total_net:=v_total_net+v_net;
  END LOOP;
  INSERT INTO journal_lines(entry_id,account_code,debit,credit) VALUES
    (v_entry_id,'6100',v_total_gross,0),(v_entry_id,'6105',v_total_er,0),(v_entry_id,'2240',0,v_total_er+v_total_t1),(v_entry_id,'2241',0,v_total_t2),(v_entry_id,'2230',0,v_total_paye),(v_entry_id,'2130',0,v_total_net);
  IF (SELECT COALESCE(SUM(debit),0)-COALESCE(SUM(credit),0) FROM journal_lines WHERE entry_id=v_entry_id)<>0 THEN RAISE EXCEPTION 'Payroll journal is unbalanced for period %.',p_period; END IF;
END;
$$;

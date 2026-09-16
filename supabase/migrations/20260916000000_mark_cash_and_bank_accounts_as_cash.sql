-- Include all configured cash and bank accounts in database cash-flow reports.
-- The get_cash_flow() RPC filters journal lines by accounts.is_cash.
UPDATE public.accounts
SET is_cash = true
WHERE code IN ('1103', '1113')
  AND is_cash IS DISTINCT FROM true;

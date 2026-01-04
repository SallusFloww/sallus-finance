-- =============================================================================
-- UNIFIED CALCULATION LAYER - Single Source of Truth for Financial Reports
-- =============================================================================

-- View 1: movements_effective
-- Normalized view of financial_entries with status flags and effective amounts
CREATE OR REPLACE VIEW public.movements_effective AS
SELECT
  id,
  company_id,
  type,
  status,
  descricao,
  categoria,
  valor,
  data_prevista,
  data_recebimento,
  unit_id,
  payment_method,
  receipt_type,
  operadora,
  observacao,
  created_by,
  created_at,
  updated_at,
  cancelled_by,
  cancelled_at,
  cancel_reason,
  -- Status flags
  (status = 'recebido') AS is_realizado,
  (status = 'previsto') AS is_previsto,
  (status = 'cancelado') AS is_cancelado,
  -- Effective amounts (based on status)
  CASE WHEN status = 'recebido' THEN valor ELSE 0 END AS effective_amount_realizado,
  CASE WHEN status = 'previsto' THEN valor ELSE 0 END AS effective_amount_previsto,
  CASE WHEN status = 'cancelado' THEN valor ELSE 0 END AS effective_amount_cancelado,
  -- Type flags for easier aggregation
  (type = 'entrada') AS is_entrada,
  (type = 'saida') AS is_saida
FROM public.financial_entries;

-- Enable RLS on the view (inherits from base table)
ALTER VIEW public.movements_effective SET (security_invoker = on);

-- =============================================================================
-- Function 2: get_financial_summary
-- Returns totals by status for a given period and company
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_financial_summary(
  p_company_id UUID,
  p_date_start DATE,
  p_date_end DATE,
  p_unit_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  -- Realized totals
  entradas_realizadas NUMERIC,
  saidas_realizadas NUMERIC,
  saldo_realizado NUMERIC,
  -- Predicted totals
  entradas_previstas NUMERIC,
  saidas_previstas NUMERIC,
  -- Cancelled totals
  entradas_canceladas NUMERIC,
  saidas_canceladas NUMERIC,
  -- Counts
  count_realizado INTEGER,
  count_previsto INTEGER,
  count_cancelado INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- Realized entries (only "recebido" status)
    COALESCE(SUM(CASE WHEN type = 'entrada' AND status = 'recebido' THEN valor ELSE 0 END), 0) AS entradas_realizadas,
    COALESCE(SUM(CASE WHEN type = 'saida' AND status = 'recebido' THEN valor ELSE 0 END), 0) AS saidas_realizadas,
    COALESCE(SUM(CASE WHEN type = 'entrada' AND status = 'recebido' THEN valor ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN type = 'saida' AND status = 'recebido' THEN valor ELSE 0 END), 0) AS saldo_realizado,
    -- Predicted entries
    COALESCE(SUM(CASE WHEN type = 'entrada' AND status = 'previsto' THEN valor ELSE 0 END), 0) AS entradas_previstas,
    COALESCE(SUM(CASE WHEN type = 'saida' AND status = 'previsto' THEN valor ELSE 0 END), 0) AS saidas_previstas,
    -- Cancelled entries (never impact balance)
    COALESCE(SUM(CASE WHEN type = 'entrada' AND status = 'cancelado' THEN valor ELSE 0 END), 0) AS entradas_canceladas,
    COALESCE(SUM(CASE WHEN type = 'saida' AND status = 'cancelado' THEN valor ELSE 0 END), 0) AS saidas_canceladas,
    -- Counts
    COUNT(*) FILTER (WHERE status = 'recebido')::INTEGER AS count_realizado,
    COUNT(*) FILTER (WHERE status = 'previsto')::INTEGER AS count_previsto,
    COUNT(*) FILTER (WHERE status = 'cancelado')::INTEGER AS count_cancelado
  FROM public.financial_entries
  WHERE 
    company_id = p_company_id
    AND data_prevista >= p_date_start
    AND data_prevista <= p_date_end
    AND (p_unit_id IS NULL OR unit_id = p_unit_id);
END;
$$;

-- =============================================================================
-- Function 3: get_summary_by_unit
-- Returns financial summary grouped by unit (only realized by default)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_summary_by_unit(
  p_company_id UUID,
  p_date_start DATE,
  p_date_end DATE,
  p_include_cancelled BOOLEAN DEFAULT FALSE,
  p_include_previsto BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  unit_id TEXT,
  mov_count_realizado INTEGER,
  entradas_realizadas NUMERIC,
  saidas_realizadas NUMERIC,
  saldo_realizado NUMERIC,
  entradas_previstas NUMERIC,
  saidas_previstas NUMERIC,
  cancelados_total NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fe.unit_id,
    COUNT(*) FILTER (WHERE fe.status = 'recebido')::INTEGER AS mov_count_realizado,
    COALESCE(SUM(CASE WHEN fe.type = 'entrada' AND fe.status = 'recebido' THEN fe.valor ELSE 0 END), 0) AS entradas_realizadas,
    COALESCE(SUM(CASE WHEN fe.type = 'saida' AND fe.status = 'recebido' THEN fe.valor ELSE 0 END), 0) AS saidas_realizadas,
    COALESCE(SUM(CASE WHEN fe.type = 'entrada' AND fe.status = 'recebido' THEN fe.valor ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN fe.type = 'saida' AND fe.status = 'recebido' THEN fe.valor ELSE 0 END), 0) AS saldo_realizado,
    -- Optional: previsto
    CASE WHEN p_include_previsto THEN
      COALESCE(SUM(CASE WHEN fe.type = 'entrada' AND fe.status = 'previsto' THEN fe.valor ELSE 0 END), 0)
    ELSE 0 END AS entradas_previstas,
    CASE WHEN p_include_previsto THEN
      COALESCE(SUM(CASE WHEN fe.type = 'saida' AND fe.status = 'previsto' THEN fe.valor ELSE 0 END), 0)
    ELSE 0 END AS saidas_previstas,
    -- Optional: cancelled
    CASE WHEN p_include_cancelled THEN
      COALESCE(SUM(CASE WHEN fe.status = 'cancelado' THEN fe.valor ELSE 0 END), 0)
    ELSE 0 END AS cancelados_total
  FROM public.financial_entries fe
  WHERE 
    fe.company_id = p_company_id
    AND fe.data_prevista >= p_date_start
    AND fe.data_prevista <= p_date_end
    AND fe.unit_id IS NOT NULL
  GROUP BY fe.unit_id
  ORDER BY saldo_realizado DESC;
END;
$$;

-- =============================================================================
-- Function 4: get_latest_movements
-- Returns latest movements with all relevant info
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_latest_movements(
  p_company_id UUID,
  p_date_start DATE DEFAULT NULL,
  p_date_end DATE DEFAULT NULL,
  p_limit INTEGER DEFAULT 10,
  p_include_cancelled BOOLEAN DEFAULT TRUE,
  p_include_previsto BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
  id UUID,
  type TEXT,
  status TEXT,
  unit_id TEXT,
  categoria TEXT,
  descricao TEXT,
  valor NUMERIC,
  data_prevista DATE,
  data_recebimento DATE,
  receipt_type TEXT,
  payment_method TEXT,
  operadora TEXT,
  observacao TEXT,
  cancel_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fe.id,
    fe.type::TEXT,
    fe.status::TEXT,
    fe.unit_id,
    fe.categoria,
    fe.descricao,
    fe.valor,
    fe.data_prevista,
    fe.data_recebimento,
    fe.receipt_type,
    fe.payment_method,
    fe.operadora,
    fe.observacao,
    fe.cancel_reason,
    fe.cancelled_at,
    fe.created_at
  FROM public.financial_entries fe
  WHERE 
    fe.company_id = p_company_id
    AND (p_date_start IS NULL OR fe.data_prevista >= p_date_start)
    AND (p_date_end IS NULL OR fe.data_prevista <= p_date_end)
    AND (p_include_cancelled OR fe.status != 'cancelado')
    AND (p_include_previsto OR fe.status != 'previsto')
  ORDER BY fe.created_at DESC
  LIMIT p_limit;
END;
$$;

-- =============================================================================
-- Function 5: get_expense_by_category
-- Returns expense breakdown by category (only realized)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_expense_by_category(
  p_company_id UUID,
  p_date_start DATE,
  p_date_end DATE
)
RETURNS TABLE (
  categoria TEXT,
  total NUMERIC,
  count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(fe.categoria, 'Sem Categoria') AS categoria,
    SUM(fe.valor) AS total,
    COUNT(*)::INTEGER AS count
  FROM public.financial_entries fe
  WHERE 
    fe.company_id = p_company_id
    AND fe.type = 'saida'
    AND fe.status = 'recebido'
    AND fe.data_prevista >= p_date_start
    AND fe.data_prevista <= p_date_end
  GROUP BY fe.categoria
  ORDER BY total DESC;
END;
$$;

-- =============================================================================
-- Function 6: get_income_breakdown
-- Returns income breakdown by receipt_type, payment_method, operadora
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_income_breakdown(
  p_company_id UUID,
  p_date_start DATE,
  p_date_end DATE
)
RETURNS TABLE (
  -- By receipt type
  particular NUMERIC,
  convenio NUMERIC,
  -- By payment method
  dinheiro NUMERIC,
  pix NUMERIC,
  debito NUMERIC,
  credito_vista NUMERIC,
  credito_parcelado NUMERIC,
  -- By operadora
  ipasgo NUMERIC,
  unimed NUMERIC,
  bradesco NUMERIC,
  geap NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- By receipt type
    COALESCE(SUM(CASE WHEN fe.receipt_type = 'PARTICULAR' THEN fe.valor ELSE 0 END), 0) AS particular,
    COALESCE(SUM(CASE WHEN fe.receipt_type = 'CONVENIO' THEN fe.valor ELSE 0 END), 0) AS convenio,
    -- By payment method
    COALESCE(SUM(CASE WHEN fe.payment_method = 'DINHEIRO' THEN fe.valor ELSE 0 END), 0) AS dinheiro,
    COALESCE(SUM(CASE WHEN fe.payment_method = 'PIX' THEN fe.valor ELSE 0 END), 0) AS pix,
    COALESCE(SUM(CASE WHEN fe.payment_method = 'CARTAO_DEBITO' THEN fe.valor ELSE 0 END), 0) AS debito,
    COALESCE(SUM(CASE WHEN fe.payment_method = 'CREDITO_VISTA' THEN fe.valor ELSE 0 END), 0) AS credito_vista,
    COALESCE(SUM(CASE WHEN fe.payment_method = 'CREDITO_PARCELADO' THEN fe.valor ELSE 0 END), 0) AS credito_parcelado,
    -- By operadora
    COALESCE(SUM(CASE WHEN fe.operadora = 'IPASGO' THEN fe.valor ELSE 0 END), 0) AS ipasgo,
    COALESCE(SUM(CASE WHEN fe.operadora = 'UNIMED' THEN fe.valor ELSE 0 END), 0) AS unimed,
    COALESCE(SUM(CASE WHEN fe.operadora = 'BRADESCO' THEN fe.valor ELSE 0 END), 0) AS bradesco,
    COALESCE(SUM(CASE WHEN fe.operadora = 'GEAP' THEN fe.valor ELSE 0 END), 0) AS geap
  FROM public.financial_entries fe
  WHERE 
    fe.company_id = p_company_id
    AND fe.type = 'entrada'
    AND fe.status = 'recebido'
    AND fe.data_prevista >= p_date_start
    AND fe.data_prevista <= p_date_end;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_financial_summary TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_summary_by_unit TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_latest_movements TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_expense_by_category TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_income_breakdown TO authenticated;
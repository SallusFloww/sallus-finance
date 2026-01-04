-- =====================================================
-- MIGRATION: Standardization & ADM Premium Role (v2)
-- =====================================================

-- 1) DROP and recreate movements_effective VIEW (needed due to column order change)
DROP VIEW IF EXISTS public.movements_effective;

CREATE VIEW public.movements_effective AS
SELECT
  fe.id,
  fe.company_id,
  fe.type,
  fe.status,
  fe.unit_id,
  fe.descricao,
  fe.categoria,
  fe.valor,
  fe.data_prevista,
  fe.data_recebimento,
  fe.receipt_type,
  fe.payment_method,
  fe.operadora,
  fe.observacao,
  fe.cancel_reason,
  fe.cancelled_at,
  fe.cancelled_by,
  fe.created_by,
  fe.updated_by,
  fe.created_at,
  fe.updated_at,
  
  -- Type flags
  (fe.type = 'entrada') AS is_entrada,
  (fe.type = 'saida') AS is_saida,
  
  -- Status flags - canonical names (recebido is the DB value)
  (fe.status = 'recebido') AS is_recebido,
  (fe.status = 'previsto') AS is_previsto,
  (fe.status = 'cancelado') AS is_cancelado,
  
  -- BACKWARD COMPATIBILITY: is_realizado alias for is_recebido
  (fe.status = 'recebido') AS is_realizado,
  
  -- Effective amounts - canonical names
  CASE WHEN fe.status = 'recebido' THEN fe.valor ELSE 0 END AS effective_amount_recebido,
  CASE WHEN fe.status = 'previsto' THEN fe.valor ELSE 0 END AS effective_amount_previsto,
  CASE WHEN fe.status = 'cancelado' THEN fe.valor ELSE 0 END AS effective_amount_cancelado,
  
  -- BACKWARD COMPATIBILITY: effective_amount_realizado alias
  CASE WHEN fe.status = 'recebido' THEN fe.valor ELSE 0 END AS effective_amount_realizado
FROM public.financial_entries fe;

-- 2) DROP and recreate get_latest_movements with COALESCE for nullable fields
DROP FUNCTION IF EXISTS public.get_latest_movements(uuid, date, date, integer, boolean, boolean);

CREATE OR REPLACE FUNCTION public.get_latest_movements(
  p_company_id uuid,
  p_date_start date DEFAULT NULL,
  p_date_end date DEFAULT NULL,
  p_limit integer DEFAULT 10,
  p_include_cancelled boolean DEFAULT true,
  p_include_previsto boolean DEFAULT true
)
RETURNS TABLE (
  id uuid,
  type text,
  status text,
  unit_id text,
  categoria text,
  descricao text,
  valor numeric,
  data_prevista date,
  data_recebimento date,
  receipt_type text,
  payment_method text,
  operadora text,
  observacao text,
  cancel_reason text,
  cancelled_at timestamptz,
  created_at timestamptz
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
    COALESCE(fe.unit_id, '') AS unit_id,
    COALESCE(fe.categoria, '') AS categoria,
    fe.descricao,
    fe.valor,
    fe.data_prevista,
    fe.data_recebimento,
    COALESCE(fe.receipt_type, '') AS receipt_type,
    COALESCE(fe.payment_method, '') AS payment_method,
    COALESCE(fe.operadora, '') AS operadora,
    COALESCE(fe.observacao, '') AS observacao,
    COALESCE(fe.cancel_reason, '') AS cancel_reason,
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

-- Grant execute on function
GRANT EXECUTE ON FUNCTION public.get_latest_movements TO authenticated;

-- 3) CREATE/UPDATE ADM PREMIUM ROLE (idempotent)
DO $$
DECLARE
  v_company_id uuid;
  v_user_id uuid;
  v_admin_role_id uuid;
BEGIN
  -- Find the first active company
  SELECT id INTO v_company_id
  FROM public.companies
  WHERE status = 'active'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RAISE NOTICE 'No active company found. Skipping ADM Premium setup.';
    RETURN;
  END IF;

  -- Check if user exists in profiles
  SELECT id INTO v_user_id
  FROM public.profiles
  WHERE LOWER(email) = LOWER('gestao@imecsaude.com.br')
  LIMIT 1;

  -- Find or create Admin role
  SELECT id INTO v_admin_role_id
  FROM public.roles
  WHERE name = 'Admin' AND (company_id = v_company_id OR company_id IS NULL)
  LIMIT 1;

  IF v_admin_role_id IS NULL THEN
    INSERT INTO public.roles (company_id, name, description, is_system)
    VALUES (v_company_id, 'Admin', 'Administrador com acesso total', true)
    RETURNING id INTO v_admin_role_id;
  END IF;

  -- Grant ALL existing permissions to Admin role
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_admin_role_id, p.id
  FROM public.permissions p
  WHERE NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = v_admin_role_id AND rp.permission_id = p.id
  );

  -- If user exists, assign them to Admin role
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.user_company_roles (company_id, user_id, role_id, is_active, is_primary)
    VALUES (v_company_id, v_user_id, v_admin_role_id, true, true)
    ON CONFLICT (user_id, company_id) 
    DO UPDATE SET role_id = EXCLUDED.role_id, is_active = true, is_primary = true;

    RAISE NOTICE 'Admin role assigned to gestao@imecsaude.com.br with all permissions';
  ELSE
    RAISE NOTICE 'User gestao@imecsaude.com.br not found. Create the user first via Auth.';
  END IF;
END $$;
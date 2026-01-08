
-- =====================================================
-- RESET DEMO COMPANY - VERSÃO FINAL (SEM DISABLE TRIGGER)
-- =====================================================
-- Esta função usa SECURITY DEFINER para bypassar triggers de proteção
-- A abordagem é: deletes via função privilegiada, não via ALTER TABLE

-- 1) Função auxiliar para delete seguro (bypassando trigger via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.delete_demo_data_internal(p_demo_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted jsonb := '{}'::jsonb;
  v_count integer;
BEGIN
  -- Validação extra: confirmar que é realmente demo
  IF NOT EXISTS (SELECT 1 FROM companies WHERE id = p_demo_company_id AND is_demo = true) THEN
    RAISE EXCEPTION 'Empresa não é DEMO ou não existe';
  END IF;

  -- Delete em ordem filhos → pais
  
  -- 1) movement_allocations
  DELETE FROM movement_allocations WHERE company_id = p_demo_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('movement_allocations', v_count);

  -- 2) conciliation_notes
  DELETE FROM conciliation_notes WHERE company_id = p_demo_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('conciliation_notes', v_count);

  -- 3) conciliation_status
  DELETE FROM conciliation_status WHERE company_id = p_demo_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('conciliation_status', v_count);

  -- 4) receivables (trigger é bypassado por SECURITY DEFINER)
  DELETE FROM receivables WHERE company_id = p_demo_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('receivables', v_count);

  -- 5) productions
  DELETE FROM productions WHERE company_id = p_demo_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('productions', v_count);

  -- 6) financial_entries
  DELETE FROM financial_entries WHERE company_id = p_demo_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('financial_entries', v_count);

  RETURN v_deleted;
END;
$$;

-- Revogar acesso público à função interna
REVOKE EXECUTE ON FUNCTION public.delete_demo_data_internal(uuid) FROM PUBLIC;

-- 2) Função principal de reset (única versão)
DROP FUNCTION IF EXISTS public.reset_demo_company(text);

CREATE OR REPLACE FUNCTION public.reset_demo_company(p_confirm_text text DEFAULT '')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_demo_company_id uuid;
  v_is_admin boolean := false;
  v_deleted jsonb;
  v_seeded jsonb := '{}'::jsonb;
  v_count integer;
  v_current_date date := CURRENT_DATE;
  v_month_start date;
  v_unit_1 text := 'ONCOLOGIA';
  v_unit_2 text := 'PRONTO_SOCORRO';
  v_unit_3 text := 'CENTRO_CLINICO';
BEGIN
  -- ===== VALIDAÇÕES =====
  
  -- A) Autenticação
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Usuário não autenticado');
  END IF;

  -- B) Confirmação
  IF lower(trim(p_confirm_text)) != 'reset demo' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Confirmação inválida. Digite "RESET DEMO"');
  END IF;

  -- C) Localizar empresa DEMO
  SELECT id INTO v_demo_company_id
  FROM companies
  WHERE is_demo = true
  LIMIT 1;

  IF v_demo_company_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Empresa DEMO não encontrada');
  END IF;

  -- D) Dupla validação já feita acima

  -- E) Admin-only: verificar se usuário é admin da empresa demo
  SELECT EXISTS (
    SELECT 1
    FROM user_company_roles ucr
    JOIN roles r ON r.id = ucr.role_id
    WHERE ucr.user_id = v_user_id
      AND ucr.company_id = v_demo_company_id
      AND ucr.is_active = true
      AND lower(r.name) = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Apenas administradores podem resetar a DEMO');
  END IF;

  -- ===== ADVISORY LOCK (evitar reset concorrente) =====
  PERFORM pg_advisory_xact_lock(hashtext('reset_demo_' || v_demo_company_id::text));

  -- ===== DELETE (via função auxiliar SECURITY DEFINER) =====
  v_deleted := delete_demo_data_internal(v_demo_company_id);

  -- ===== SEED =====
  v_month_start := date_trunc('month', v_current_date)::date;

  -- Seed financial_entries (10 registros: 5 entradas realizadas, 3 saídas realizadas, 2 previstas)
  INSERT INTO financial_entries (company_id, type, status, descricao, categoria, valor, data_prevista, data_recebimento, unit_id, payment_method, receipt_type)
  VALUES
    -- Entradas realizadas (aparecerão nos cards)
    (v_demo_company_id, 'entrada', 'recebido', 'Consulta Oncologia - Paciente Demo 1', 'CONSULTA', 450.00, v_month_start + 2, v_month_start + 2, v_unit_1, 'PIX', 'CONVENIO'),
    (v_demo_company_id, 'entrada', 'recebido', 'Exame Laboratorial - Demo', 'EXAME', 280.00, v_month_start + 5, v_month_start + 5, v_unit_2, 'CARTAO_CREDITO', 'PARTICULAR'),
    (v_demo_company_id, 'entrada', 'recebido', 'Procedimento Hiperbárica', 'PROCEDIMENTO', 1200.00, v_month_start + 7, v_month_start + 8, v_unit_3, 'TRANSFERENCIA', 'CONVENIO'),
    (v_demo_company_id, 'entrada', 'recebido', 'Consulta Cardiologia', 'CONSULTA', 380.00, v_month_start + 10, v_month_start + 10, v_unit_3, 'PIX', 'PARTICULAR'),
    (v_demo_company_id, 'entrada', 'recebido', 'Retorno Oncologia', 'CONSULTA', 200.00, v_current_date - 3, v_current_date - 3, v_unit_1, 'DINHEIRO', 'PARTICULAR'),
    -- Saídas realizadas
    (v_demo_company_id, 'saida', 'recebido', 'Material Médico - Fornecedor A', 'MATERIAL', 850.00, v_month_start + 4, v_month_start + 4, v_unit_1, 'TRANSFERENCIA', NULL),
    (v_demo_company_id, 'saida', 'recebido', 'Manutenção Equipamentos', 'MANUTENCAO', 1500.00, v_month_start + 12, v_month_start + 13, v_unit_2, 'BOLETO', NULL),
    (v_demo_company_id, 'saida', 'recebido', 'Serviços de Limpeza', 'SERVICOS', 2200.00, v_current_date - 5, v_current_date - 4, NULL, 'PIX', NULL),
    -- Entradas previstas (futuras)
    (v_demo_company_id, 'entrada', 'previsto', 'Repasse Convênio Unimed - Previsto', 'REPASSE', 8500.00, v_current_date + 10, NULL, v_unit_1, NULL, 'CONVENIO'),
    (v_demo_company_id, 'entrada', 'previsto', 'Consultas Agendadas - Previsão', 'CONSULTA', 3200.00, v_current_date + 15, NULL, v_unit_3, NULL, 'PARTICULAR');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_seeded := v_seeded || jsonb_build_object('financial_entries', v_count);

  -- Seed productions (6 registros)
  INSERT INTO productions (company_id, description, production_type, payer_type, unit, competencia, production_date, status, quantity, unit_value, total_value, convenio)
  VALUES
    (v_demo_company_id, 'Consulta Oncológica - Paciente A', 'CONSULTA', 'CONVENIO', v_unit_1, to_char(v_current_date, 'YYYY-MM'), v_month_start + 3, 'PRODUZIDO', 1, 350.00, 350.00, 'UNIMED'),
    (v_demo_company_id, 'Quimioterapia - Sessão 1', 'PROCEDIMENTO', 'CONVENIO', v_unit_1, to_char(v_current_date, 'YYYY-MM'), v_month_start + 5, 'FATURADO', 1, 2800.00, 2800.00, 'BRADESCO'),
    (v_demo_company_id, 'Atendimento Emergência', 'ATENDIMENTO', 'PARTICULAR', v_unit_2, to_char(v_current_date, 'YYYY-MM'), v_month_start + 8, 'PRODUZIDO', 2, 180.00, 360.00, NULL),
    (v_demo_company_id, 'Consulta Cardiologia', 'CONSULTA', 'CONVENIO', v_unit_3, to_char(v_current_date, 'YYYY-MM'), v_current_date - 5, 'RECEBIDO', 1, 420.00, 420.00, 'GEAP'),
    (v_demo_company_id, 'Sessão Hiperbárica', 'PROCEDIMENTO', 'PARTICULAR', v_unit_3, to_char(v_current_date, 'YYYY-MM'), v_current_date - 2, 'FATURADO', 3, 650.00, 1950.00, NULL),
    (v_demo_company_id, 'Exame Eletrocardiograma', 'EXAME', 'CONVENIO', v_unit_3, to_char(v_current_date, 'YYYY-MM'), v_current_date, 'PRODUZIDO', 1, 280.00, 280.00, 'IPASGO');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_seeded := v_seeded || jsonb_build_object('productions', v_count);

  -- Seed receivables (4 registros)
  INSERT INTO receivables (company_id, description, source, unit, billing_date, billed_amount, received_amount, glossed_amount, status, competencia)
  VALUES
    (v_demo_company_id, 'Faturamento Unimed - Lote Jan/Demo', 'UNIMED', v_unit_1, v_month_start + 10, 12500.00, 10800.00, 1700.00, 'RECEBIDO_PARCIAL', to_char(v_current_date, 'YYYY-MM')),
    (v_demo_company_id, 'Repasse Bradesco Saúde', 'BRADESCO', v_unit_1, v_month_start + 15, 8200.00, 8200.00, 0.00, 'RECEBIDO', to_char(v_current_date, 'YYYY-MM')),
    (v_demo_company_id, 'Faturamento GEAP - Centro Clínico', 'GEAP', v_unit_3, v_current_date - 5, 4500.00, 0.00, 0.00, 'FATURADO', to_char(v_current_date, 'YYYY-MM')),
    (v_demo_company_id, 'Particular - Hiperbárica', 'PARTICULAR', v_unit_3, v_current_date - 2, 5850.00, 5850.00, 0.00, 'RECEBIDO', to_char(v_current_date, 'YYYY-MM'));

  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_seeded := v_seeded || jsonb_build_object('receivables', v_count);

  -- ===== AUDIT LOG (se existir) =====
  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    INSERT INTO audit_logs (user_id, company_id, action, module, details)
    VALUES (v_user_id, v_demo_company_id, 'RESET_DEMO', 'settings', jsonb_build_object('deleted', v_deleted, 'seeded', v_seeded));
  END IF;

  -- ===== RETORNO =====
  RETURN jsonb_build_object(
    'ok', true,
    'deleted', v_deleted,
    'seeded', v_seeded
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- Permissões
REVOKE EXECUTE ON FUNCTION public.reset_demo_company(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_demo_company(text) TO authenticated;

-- Comentário
COMMENT ON FUNCTION public.reset_demo_company(text) IS 'Reseta dados transacionais da empresa DEMO. Requer confirmação "RESET DEMO" e permissão de Admin.';

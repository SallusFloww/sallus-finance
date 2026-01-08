
-- =============================================================================
-- RESET DEMO COMPANY - VERSÃO FINAL COM BYPASS DE TRIGGERS
-- =============================================================================
-- Desabilita triggers de prevent_hard_delete temporariamente APENAS para a DEMO
-- =============================================================================

CREATE OR REPLACE FUNCTION public.reset_demo_company(p_confirm_text text DEFAULT ''::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_demo_company_id uuid;
  v_is_admin boolean;
  v_deleted jsonb := '{}'::jsonb;
  v_count integer;
  v_now date := CURRENT_DATE;
  v_competencia text := to_char(CURRENT_DATE, 'YYYY-MM');
BEGIN
  -- 1. Obter usuário autenticado
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Usuário não autenticado');
  END IF;
  
  -- 2. Validar texto de confirmação (case-insensitive)
  IF LOWER(TRIM(p_confirm_text)) != 'reset demo' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Confirmação inválida. Digite "RESET DEMO"');
  END IF;
  
  -- 3. Buscar empresa DEMO (dupla verificação: is_demo = true)
  SELECT id INTO v_demo_company_id
  FROM public.companies
  WHERE is_demo = true
  LIMIT 1;
  
  IF v_demo_company_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Empresa DEMO não encontrada');
  END IF;
  
  -- 4. Verificar se usuário é Admin da empresa DEMO
  SELECT EXISTS (
    SELECT 1
    FROM public.user_company_roles ucr
    JOIN public.roles r ON r.id = ucr.role_id
    WHERE ucr.user_id = v_user_id
      AND ucr.company_id = v_demo_company_id
      AND ucr.is_active = true
      AND r.name = 'Admin'
  ) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Apenas Admin pode resetar a empresa DEMO');
  END IF;
  
  -- ==========================================================================
  -- 5. DESABILITAR TRIGGERS DE PREVENT_HARD_DELETE (temporariamente)
  -- ==========================================================================
  ALTER TABLE public.financial_entries DISABLE TRIGGER trg_prevent_delete_financial;
  ALTER TABLE public.productions DISABLE TRIGGER trg_prevent_delete_productions;
  ALTER TABLE public.receivables DISABLE TRIGGER trg_prevent_delete_receivables;
  
  -- ==========================================================================
  -- 6. DELETAR dados transacionais (ordem: filhos → pais, sempre com filtro)
  -- ==========================================================================
  
  -- 6.1 movement_allocations (filho de financial_entries)
  DELETE FROM public.movement_allocations WHERE company_id = v_demo_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('movement_allocations', v_count);
  
  -- 6.2 conciliation_notes
  DELETE FROM public.conciliation_notes WHERE company_id = v_demo_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('conciliation_notes', v_count);
  
  -- 6.3 conciliation_status
  DELETE FROM public.conciliation_status WHERE company_id = v_demo_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('conciliation_status', v_count);
  
  -- 6.4 receivables
  DELETE FROM public.receivables WHERE company_id = v_demo_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('receivables', v_count);
  
  -- 6.5 productions
  DELETE FROM public.productions WHERE company_id = v_demo_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('productions', v_count);
  
  -- 6.6 financial_entries
  DELETE FROM public.financial_entries WHERE company_id = v_demo_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('financial_entries', v_count);
  
  -- ==========================================================================
  -- 7. REABILITAR TRIGGERS
  -- ==========================================================================
  ALTER TABLE public.financial_entries ENABLE TRIGGER trg_prevent_delete_financial;
  ALTER TABLE public.productions ENABLE TRIGGER trg_prevent_delete_productions;
  ALTER TABLE public.receivables ENABLE TRIGGER trg_prevent_delete_receivables;
  
  -- ==========================================================================
  -- 8. SEED: Inserir dados demo realistas
  -- Usando unit_ids REAIS da DEMO: ONCOLOGIA, PRONTO_SOCORRO, CENTRO_CLINICO
  -- ==========================================================================
  
  -- 8.1 Lançamentos financeiros (10 registros)
  INSERT INTO public.financial_entries (
    company_id, type, status, unit_id, categoria, descricao, valor, 
    data_prevista, data_recebimento, receipt_type, payment_method, created_by
  ) VALUES
    -- Entradas realizadas
    (v_demo_company_id, 'entrada', 'recebido', 'ONCOLOGIA', 'RECEITAS_OPERACIONAIS', 
     'Consulta particular - Paciente Demo 1', 350.00, 
     v_now - 15, v_now - 15, 'PARTICULAR', 'PIX', v_user_id),
    
    (v_demo_company_id, 'entrada', 'recebido', 'CENTRO_CLINICO', 'RECEITAS_OPERACIONAIS', 
     'Exame de sangue - Paciente Demo 2', 180.00, 
     v_now - 12, v_now - 12, 'PARTICULAR', 'CARTAO_DEBITO', v_user_id),
    
    (v_demo_company_id, 'entrada', 'recebido', 'PRONTO_SOCORRO', 'RECEITAS_OPERACIONAIS', 
     'Repasse IPASGO - Lote Janeiro', 4500.00, 
     v_now - 10, v_now - 10, 'CONVENIO', NULL, v_user_id),
    
    -- Entradas previstas
    (v_demo_company_id, 'entrada', 'previsto', 'ONCOLOGIA', 'RECEITAS_OPERACIONAIS', 
     'Consulta agendada - Paciente Demo 3', 280.00, 
     v_now + 5, NULL, 'PARTICULAR', 'PIX', v_user_id),
    
    (v_demo_company_id, 'entrada', 'previsto', 'PRONTO_SOCORRO', 'RECEITAS_OPERACIONAIS', 
     'Repasse UNIMED - Previsão', 3200.00, 
     v_now + 15, NULL, 'CONVENIO', NULL, v_user_id),
    
    -- Saídas realizadas
    (v_demo_company_id, 'saida', 'recebido', 'CENTRO_CLINICO', 'DESPESAS_OPERACIONAIS', 
     'Material de escritório', 450.00, 
     v_now - 8, v_now - 8, NULL, 'PIX', v_user_id),
    
    (v_demo_company_id, 'saida', 'recebido', 'ONCOLOGIA', 'DESPESAS_PESSOAL', 
     'Salário colaborador Demo', 3500.00, 
     v_now - 5, v_now - 5, NULL, 'TRANSFERENCIA', v_user_id),
    
    -- Saída prevista
    (v_demo_company_id, 'saida', 'previsto', 'PRONTO_SOCORRO', 'DESPESAS_FIXAS', 
     'Aluguel sede PS', 2800.00, 
     v_now + 10, NULL, NULL, NULL, v_user_id),
    
    -- Compartilhada
    (v_demo_company_id, 'saida', 'recebido', 'CENTRO_CLINICO', 'DESPESAS_COMPARTILHADAS', 
     'Sistema de gestão', 890.00, 
     v_now - 3, v_now - 3, NULL, 'BOLETO', v_user_id),
    
    -- Cancelada
    (v_demo_company_id, 'entrada', 'cancelado', 'ONCOLOGIA', 'RECEITAS_OPERACIONAIS', 
     'Consulta cancelada - No-show', 280.00, 
     v_now - 7, NULL, 'PARTICULAR', NULL, v_user_id);
  
  -- 8.2 Produções (6 registros)
  INSERT INTO public.productions (
    company_id, unit, payer_type, convenio, production_type, description, 
    total_value, quantity, production_date, status, competencia, created_by
  ) VALUES
    (v_demo_company_id, 'ONCOLOGIA', 'PARTICULAR', NULL, 'CONSULTA', 
     'Consulta clínica - Dr. Demo', 350.00, 1, v_now - 15, 'FATURADO', v_competencia, v_user_id),
    
    (v_demo_company_id, 'CENTRO_CLINICO', 'CONVENIO', 'IPASGO', 'EXAME', 
     'Hemograma completo', 85.00, 2, v_now - 12, 'PRODUZIDO', v_competencia, v_user_id),
    
    (v_demo_company_id, 'PRONTO_SOCORRO', 'CONVENIO', 'UNIMED', 'CONSULTA', 
     'Retorno paciente convênio', 180.00, 1, v_now - 10, 'RECEBIDO', v_competencia, v_user_id),
    
    (v_demo_company_id, 'ONCOLOGIA', 'PARTICULAR', NULL, 'PROCEDIMENTO', 
     'Pequeno procedimento ambulatorial', 650.00, 1, v_now - 5, 'FATURADO', v_competencia, v_user_id),
    
    (v_demo_company_id, 'PRONTO_SOCORRO', 'CONVENIO', 'BRADESCO', 'EXAME', 
     'Ultrassonografia abdominal', 220.00, 1, v_now - 3, 'PRODUZIDO', v_competencia, v_user_id),
    
    (v_demo_company_id, 'CENTRO_CLINICO', 'PARTICULAR', NULL, 'CONSULTA', 
     'Primeira consulta - Novo paciente', 400.00, 1, v_now - 1, 'PRODUZIDO', v_competencia, v_user_id);
  
  -- 8.3 Contas a receber (4 registros)
  INSERT INTO public.receivables (
    company_id, unit, source, description, billed_amount, 
    expected_receipt_days, status, billing_date, created_by
  ) VALUES
    (v_demo_company_id, 'ONCOLOGIA', 'IPASGO', 'Lote Janeiro 2026', 4500.00, 
     30, 'FATURADO', v_now - 15, v_user_id),
    
    (v_demo_company_id, 'PRONTO_SOCORRO', 'UNIMED', 'Lote Dezembro 2025', 3200.00, 
     45, 'FATURADO', v_now - 10, v_user_id),
    
    (v_demo_company_id, 'CENTRO_CLINICO', 'BRADESCO', 'Procedimentos Q4', 1850.00, 
     60, 'FATURADO', v_now - 5, v_user_id),
    
    (v_demo_company_id, 'PRONTO_SOCORRO', 'GEAP', 'Lote Novembro 2025', 2100.00, 
     30, 'RECEBIDO', v_now - 40, v_user_id);
  
  -- ==========================================================================
  -- 9. Registrar no audit_logs
  -- ==========================================================================
  INSERT INTO public.audit_logs (user_id, company_id, action, module, details)
  VALUES (
    v_user_id,
    v_demo_company_id,
    'RESET_DEMO',
    'SYSTEM',
    jsonb_build_object(
      'deleted', v_deleted,
      'seeded', jsonb_build_object('financial_entries', 10, 'productions', 6, 'receivables', 4),
      'timestamp', now()
    )
  );
  
  RETURN jsonb_build_object(
    'ok', true,
    'message', 'Empresa DEMO resetada com sucesso',
    'deleted', v_deleted,
    'seeded', jsonb_build_object('financial_entries', 10, 'productions', 6, 'receivables', 4)
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- Em caso de erro, garantir que triggers são reabilitados
    ALTER TABLE public.financial_entries ENABLE TRIGGER trg_prevent_delete_financial;
    ALTER TABLE public.productions ENABLE TRIGGER trg_prevent_delete_productions;
    ALTER TABLE public.receivables ENABLE TRIGGER trg_prevent_delete_receivables;
    RAISE;
END;
$function$;

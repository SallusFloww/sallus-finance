-- Corrigir função reset_demo_company para usar nomes de coluna corretos
CREATE OR REPLACE FUNCTION public.reset_demo_company(p_confirm_text text DEFAULT '')
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
  
  -- 3. Buscar empresa DEMO
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
  
  -- 5. DELETAR dados transacionais (ordem: filhos → pais)
  
  -- 5.1 movement_allocations
  DELETE FROM public.movement_allocations WHERE company_id = v_demo_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('movement_allocations', v_count);
  
  -- 5.2 conciliation_notes
  DELETE FROM public.conciliation_notes WHERE company_id = v_demo_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('conciliation_notes', v_count);
  
  -- 5.3 conciliation_status
  DELETE FROM public.conciliation_status WHERE company_id = v_demo_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('conciliation_status', v_count);
  
  -- 5.4 receivables
  DELETE FROM public.receivables WHERE company_id = v_demo_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('receivables', v_count);
  
  -- 5.5 productions
  DELETE FROM public.productions WHERE company_id = v_demo_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('productions', v_count);
  
  -- 5.6 financial_entries
  DELETE FROM public.financial_entries WHERE company_id = v_demo_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('financial_entries', v_count);
  
  -- 6. SEED: Inserir dados demo realistas
  -- 6.1 Lançamentos financeiros (10 registros)
  INSERT INTO public.financial_entries (company_id, type, status, unit_id, categoria, descricao, valor, data_prevista, data_recebimento, receipt_type, payment_method, created_by) VALUES
    (v_demo_company_id, 'entrada', 'recebido', 'UNIDADE_A', 'RECEITAS_OPERACIONAIS', 'Consulta particular - Paciente Demo 1', 350.00, CURRENT_DATE - 15, CURRENT_DATE - 15, 'PARTICULAR', 'PIX', v_user_id),
    (v_demo_company_id, 'entrada', 'recebido', 'UNIDADE_A', 'RECEITAS_OPERACIONAIS', 'Exame de sangue - Paciente Demo 2', 180.00, CURRENT_DATE - 12, CURRENT_DATE - 12, 'PARTICULAR', 'CARTAO_DEBITO', v_user_id),
    (v_demo_company_id, 'entrada', 'recebido', 'UNIDADE_B', 'RECEITAS_OPERACIONAIS', 'Repasse IPASGO - Lote Janeiro', 4500.00, CURRENT_DATE - 10, CURRENT_DATE - 10, 'CONVENIO', NULL, v_user_id),
    (v_demo_company_id, 'entrada', 'previsto', 'UNIDADE_A', 'RECEITAS_OPERACIONAIS', 'Consulta agendada - Paciente Demo 3', 280.00, CURRENT_DATE + 5, NULL, 'PARTICULAR', 'PIX', v_user_id),
    (v_demo_company_id, 'entrada', 'previsto', 'UNIDADE_B', 'RECEITAS_OPERACIONAIS', 'Repasse UNIMED - Previsão', 3200.00, CURRENT_DATE + 15, NULL, 'CONVENIO', NULL, v_user_id),
    (v_demo_company_id, 'saida', 'recebido', 'UNIDADE_A', 'DESPESAS_OPERACIONAIS', 'Material de escritório', 450.00, CURRENT_DATE - 8, CURRENT_DATE - 8, NULL, 'PIX', v_user_id),
    (v_demo_company_id, 'saida', 'recebido', 'UNIDADE_A', 'DESPESAS_PESSOAL', 'Salário colaborador Demo', 3500.00, CURRENT_DATE - 5, CURRENT_DATE - 5, NULL, 'TRANSFERENCIA', v_user_id),
    (v_demo_company_id, 'saida', 'previsto', 'UNIDADE_B', 'DESPESAS_FIXAS', 'Aluguel sede B', 2800.00, CURRENT_DATE + 10, NULL, NULL, NULL, v_user_id),
    (v_demo_company_id, 'saida', 'recebido', 'SHARED', 'DESPESAS_COMPARTILHADAS', 'Sistema de gestão', 890.00, CURRENT_DATE - 3, CURRENT_DATE - 3, NULL, 'BOLETO', v_user_id),
    (v_demo_company_id, 'entrada', 'cancelado', 'UNIDADE_A', 'RECEITAS_OPERACIONAIS', 'Consulta cancelada - No-show', 280.00, CURRENT_DATE - 7, NULL, 'PARTICULAR', NULL, v_user_id);
  
  -- 6.2 Produções (6 registros) - usando coluna 'unit' e 'competencia'
  INSERT INTO public.productions (company_id, unit, payer_type, convenio, production_type, description, total_value, quantity, production_date, status, competencia, created_by) VALUES
    (v_demo_company_id, 'UNIDADE_A', 'PARTICULAR', NULL, 'CONSULTA', 'Consulta clínica - Dr. Demo', 350.00, 1, CURRENT_DATE - 15, 'FATURADO', to_char(CURRENT_DATE, 'YYYY-MM'), v_user_id),
    (v_demo_company_id, 'UNIDADE_A', 'CONVENIO', 'IPASGO', 'EXAME', 'Hemograma completo', 85.00, 2, CURRENT_DATE - 12, 'PRODUZIDO', to_char(CURRENT_DATE, 'YYYY-MM'), v_user_id),
    (v_demo_company_id, 'UNIDADE_B', 'CONVENIO', 'UNIMED', 'CONSULTA', 'Retorno paciente convênio', 180.00, 1, CURRENT_DATE - 10, 'RECEBIDO', to_char(CURRENT_DATE, 'YYYY-MM'), v_user_id),
    (v_demo_company_id, 'UNIDADE_A', 'PARTICULAR', NULL, 'PROCEDIMENTO', 'Pequeno procedimento ambulatorial', 650.00, 1, CURRENT_DATE - 5, 'FATURADO', to_char(CURRENT_DATE, 'YYYY-MM'), v_user_id),
    (v_demo_company_id, 'UNIDADE_B', 'CONVENIO', 'BRADESCO', 'EXAME', 'Ultrassonografia abdominal', 220.00, 1, CURRENT_DATE - 3, 'PRODUZIDO', to_char(CURRENT_DATE, 'YYYY-MM'), v_user_id),
    (v_demo_company_id, 'UNIDADE_A', 'PARTICULAR', NULL, 'CONSULTA', 'Primeira consulta - Novo paciente', 400.00, 1, CURRENT_DATE - 1, 'PRODUZIDO', to_char(CURRENT_DATE, 'YYYY-MM'), v_user_id);
  
  -- 6.3 Contas a receber (4 registros) - usando coluna 'unit' e 'source'
  INSERT INTO public.receivables (company_id, unit, source, description, billed_amount, expected_receipt_days, status, billing_date, created_by) VALUES
    (v_demo_company_id, 'UNIDADE_A', 'IPASGO', 'Lote Janeiro 2026', 4500.00, 30, 'FATURADO', CURRENT_DATE - 15, v_user_id),
    (v_demo_company_id, 'UNIDADE_B', 'UNIMED', 'Lote Dezembro 2025', 3200.00, 45, 'FATURADO', CURRENT_DATE - 10, v_user_id),
    (v_demo_company_id, 'UNIDADE_A', 'BRADESCO', 'Procedimentos Q4', 1850.00, 60, 'FATURADO', CURRENT_DATE - 5, v_user_id),
    (v_demo_company_id, 'UNIDADE_B', 'GEAP', 'Lote Novembro 2025', 2100.00, 30, 'RECEBIDO', CURRENT_DATE - 40, v_user_id);
  
  -- 7. Registrar no audit_logs
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
END;
$function$;
-- Substituir função RPC por versão segura (usa auth.uid(), anti-duplicação)
CREATE OR REPLACE FUNCTION public.link_receivable_to_existing_entry(
  p_company_id uuid,
  p_receivable_id uuid,
  p_entry_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_receivable RECORD;
  v_entry RECORD;
  v_user_id uuid;
  v_user_name text;
  v_history jsonb;
  v_now timestamptz := now();
  v_existing_obs text;
BEGIN
  -- usuário real do auth
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Usuário não autenticado');
  END IF;

  SELECT COALESCE(full_name, email)
    INTO v_user_name
  FROM profiles
  WHERE id = v_user_id;

  -- Validar receivable
  SELECT * INTO v_receivable
  FROM receivables
  WHERE id = p_receivable_id
    AND company_id = p_company_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Receivable não encontrado ou não pertence à empresa');
  END IF;

  IF v_receivable.linked_transaction_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Receivable já está vinculado a outra movimentação');
  END IF;

  -- Validar financial_entry
  SELECT * INTO v_entry
  FROM financial_entries
  WHERE id = p_entry_id
    AND company_id = p_company_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Movimentação não encontrada ou não pertence à empresa');
  END IF;

  IF v_entry.status <> 'recebido' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Movimentação não está com status recebido');
  END IF;

  IF v_entry.type <> 'entrada' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Movimentação não é uma entrada');
  END IF;

  -- Anti duplicação: outro receivable já vinculado ao mesmo entry
  IF EXISTS (
    SELECT 1
    FROM receivables
    WHERE company_id = p_company_id
      AND linked_transaction_id = p_entry_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Movimentação já está vinculada a outro faturamento');
  END IF;

  -- Montar histórico
  v_history := COALESCE(v_receivable.history, '[]'::jsonb);
  v_history := v_history || jsonb_build_array(jsonb_build_object(
    'action', 'VINCULADO',
    'description', format('Vinculado a movimentação existente. Valor: %s', v_entry.valor::text),
    'timestamp', v_now,
    'userId', v_user_id,
    'userName', v_user_name,
    'amount', v_entry.valor,
    'linkedTransactionId', p_entry_id
  ));

  -- Atualizar receivable
  UPDATE receivables SET
    linked_transaction_id = p_entry_id,
    status = 'RECEBIDO',
    received_amount = v_entry.valor,
    actual_receipt_date = COALESCE(v_entry.data_recebimento, v_entry.data_prevista),
    updated_at = v_now,
    updated_by = v_user_id,
    history = v_history
  WHERE id = p_receivable_id;

  -- Atualizar observacao do financial_entry sem duplicar
  v_existing_obs := COALESCE(v_entry.observacao, '');

  IF v_existing_obs NOT ILIKE ('%receivable_id=' || p_receivable_id::text || '%') THEN
    UPDATE financial_entries SET
      observacao = CASE
        WHEN v_existing_obs = '' THEN 'receivable_id=' || p_receivable_id::text
        ELSE v_existing_obs || ' | receivable_id=' || p_receivable_id::text
      END,
      updated_at = v_now,
      updated_by = v_user_id
    WHERE id = p_entry_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'message', 'Vínculo criado com sucesso',
    'receivable_id', p_receivable_id,
    'entry_id', p_entry_id
  );
END;
$$;
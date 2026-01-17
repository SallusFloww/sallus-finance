-- Atualizar RPC import_productions_batch para incluir payment_method
CREATE OR REPLACE FUNCTION public.import_productions_batch(_company_id uuid, _context jsonb, _file_name text, _rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _batch_id UUID;
  _user_id UUID;
  _total_rows INT;
  _valid_count INT := 0;
  _invalid_count INT := 0;
  _total_value NUMERIC := 0;
  _row JSONB;
  _row_num INT := 0;
  _production_type TEXT;
  _unit TEXT;
  _competencia TEXT;
  _payer_type TEXT;
  _convenio TEXT;
  _payment_method TEXT; -- ✅ Novo campo
  _errors JSONB := '[]'::JSONB;
  _row_date DATE;
  _row_value NUMERIC;
  _row_paciente TEXT;
  _competencia_start DATE;
  _competencia_end DATE;
  _comp_year INT;
  _comp_month INT;
  _recent_batch UUID;
BEGIN
  _user_id := auth.uid();
  
  -- Validar permissão
  IF NOT (has_role_in_company(_user_id, _company_id, 'Admin') OR has_role_in_company(_user_id, _company_id, 'Gestor')) THEN
    RAISE EXCEPTION 'Sem permissão para importar produções';
  END IF;
  
  -- ✅ PROTEÇÃO 4B: Verificar batch PROCESSING recente do mesmo usuário (60s)
  SELECT id INTO _recent_batch
  FROM production_import_batches
  WHERE company_id = _company_id
    AND created_by = _user_id
    AND status = 'PROCESSING'
    AND created_at > (now() - interval '60 seconds')
  LIMIT 1;
  
  IF _recent_batch IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Já existe uma importação em andamento. Aguarde concluir.',
      'duplicate_batch_id', _recent_batch
    );
  END IF;
  
  -- Extrair contexto
  _production_type := _context->>'production_type';
  _unit := _context->>'unit';
  _competencia := _context->>'competencia';
  _payer_type := _context->>'payer_type';
  _convenio := _context->>'convenio';
  _payment_method := _context->>'payment_method'; -- ✅ Extrair payment_method
  
  -- ✅ PROTEÇÃO 3: Normalizar competência para YYYY-MM
  -- Se vier MM/YYYY, converter
  IF _competencia ~ '^\d{2}/\d{4}$' THEN
    _competencia := SUBSTRING(_competencia FROM 4 FOR 4) || '-' || SUBSTRING(_competencia FROM 1 FOR 2);
  END IF;
  
  -- Validar formato YYYY-MM
  IF _competencia !~ '^\d{4}-\d{2}$' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Competência inválida. Use formato YYYY-MM.'
    );
  END IF;
  
  -- Validar contexto obrigatório
  IF _production_type IS NULL OR _production_type = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tipo de produção é obrigatório');
  END IF;
  
  IF _unit IS NULL OR _unit = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unidade é obrigatória');
  END IF;
  
  IF _payer_type = 'CONVENIO' AND (_convenio IS NULL OR _convenio = '') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Convênio é obrigatório para pagador tipo CONVENIO');
  END IF;
  
  -- ✅ Validar payment_method obrigatório para PARTICULAR
  IF _payer_type = 'PARTICULAR' AND (_payment_method IS NULL OR _payment_method = '') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Modo de pagamento é obrigatório para pagador PARTICULAR');
  END IF;
  
  -- Calcular limites da competência para validação de datas
  _comp_year := SUBSTRING(_competencia FROM 1 FOR 4)::INT;
  _comp_month := SUBSTRING(_competencia FROM 6 FOR 2)::INT;
  _competencia_start := make_date(_comp_year, _comp_month, 1);
  _competencia_end := (_competencia_start + interval '1 month' - interval '1 day')::DATE;
  
  _total_rows := jsonb_array_length(_rows);
  
  -- Criar batch
  INSERT INTO production_import_batches (
    company_id, created_by, context, file_name, 
    total_rows, valid_rows, invalid_rows, status
  ) VALUES (
    _company_id, _user_id, _context, _file_name,
    _total_rows, 0, 0, 'PROCESSING'
  ) RETURNING id INTO _batch_id;
  
  -- Processar cada linha com validação
  FOR _row IN SELECT * FROM jsonb_array_elements(_rows)
  LOOP
    _row_num := _row_num + 1;
    
    BEGIN
      -- ✅ PROTEÇÃO 1: Validar data
      BEGIN
        _row_date := (_row->>'production_date')::DATE;
      EXCEPTION WHEN OTHERS THEN
        _row_date := NULL;
      END;
      
      IF _row_date IS NULL THEN
        _errors := _errors || jsonb_build_object('row', _row_num, 'error', 'Data inválida');
        _invalid_count := _invalid_count + 1;
        CONTINUE;
      END IF;
      
      -- ✅ PROTEÇÃO 1: Validar data dentro da competência
      IF _row_date < _competencia_start OR _row_date > _competencia_end THEN
        _errors := _errors || jsonb_build_object('row', _row_num, 'error', 'Data fora da competência');
        _invalid_count := _invalid_count + 1;
        CONTINUE;
      END IF;
      
      -- ✅ PROTEÇÃO 2: Validar valor > 0 (não aceitar 0 ou negativo)
      BEGIN
        _row_value := (_row->>'unit_value')::NUMERIC;
      EXCEPTION WHEN OTHERS THEN
        _row_value := NULL;
      END;
      
      IF _row_value IS NULL OR _row_value <= 0 THEN
        _errors := _errors || jsonb_build_object('row', _row_num, 'error', 'Valor deve ser maior que zero');
        _invalid_count := _invalid_count + 1;
        CONTINUE;
      END IF;
      
      -- Paciente é opcional
      _row_paciente := NULLIF(TRIM(COALESCE(_row->>'paciente_nome', '')), '');
      
      -- ✅ Inserir produção válida COM payment_method
      INSERT INTO productions (
        company_id,
        production_date,
        unit_value,
        total_value,
        quantity,
        paciente_nome,
        production_type,
        unit,
        competencia,
        payer_type,
        convenio,
        payment_method,
        description,
        status,
        import_batch_id,
        import_row_number,
        import_source,
        created_by
      ) VALUES (
        _company_id,
        _row_date,
        _row_value,
        _row_value,
        1,
        _row_paciente,
        _production_type,
        _unit,
        _competencia,
        _payer_type,
        NULLIF(_convenio, ''),
        NULLIF(_payment_method, ''),
        COALESCE(_row_paciente, _production_type),
        'PRODUZIDO',
        _batch_id,
        _row_num,
        'import',
        _user_id
      );
      
      _valid_count := _valid_count + 1;
      _total_value := _total_value + _row_value;
      
    EXCEPTION WHEN OTHERS THEN
      _errors := _errors || jsonb_build_object('row', _row_num, 'error', SQLERRM);
      _invalid_count := _invalid_count + 1;
    END;
  END LOOP;
  
  -- Atualizar batch com resultado final
  UPDATE production_import_batches
  SET 
    status = CASE WHEN _valid_count > 0 THEN 'SUCCESS' ELSE 'FAILED' END,
    valid_rows = _valid_count,
    invalid_rows = _invalid_count,
    total_value = _total_value,
    error_message = CASE WHEN _invalid_count > 0 THEN _errors::TEXT ELSE NULL END
  WHERE id = _batch_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'batch_id', _batch_id,
    'imported_count', _valid_count,
    'invalid_count', _invalid_count,
    'total_value', _total_value,
    'errors', _errors
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Em caso de erro fatal, atualizar batch
  IF _batch_id IS NOT NULL THEN
    UPDATE production_import_batches
    SET status = 'FAILED', error_message = SQLERRM
    WHERE id = _batch_id;
  END IF;
  
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$function$;
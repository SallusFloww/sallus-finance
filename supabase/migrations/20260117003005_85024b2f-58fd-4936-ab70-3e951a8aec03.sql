-- 1) Adicionar colunas em productions (se não existirem)
ALTER TABLE public.productions 
ADD COLUMN IF NOT EXISTS paciente_nome TEXT NULL,
ADD COLUMN IF NOT EXISTS import_batch_id UUID NULL,
ADD COLUMN IF NOT EXISTS import_row_number INT NULL,
ADD COLUMN IF NOT EXISTS import_source TEXT NOT NULL DEFAULT 'manual';

-- 2) Criar tabela de auditoria de batches
CREATE TABLE IF NOT EXISTS public.production_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  context JSONB NOT NULL,
  file_name TEXT NULL,
  total_rows INT NOT NULL,
  valid_rows INT NOT NULL,
  invalid_rows INT NOT NULL,
  total_value NUMERIC NULL,
  status TEXT NOT NULL DEFAULT 'PROCESSING',
  error_message TEXT NULL
);

-- RLS para production_import_batches
ALTER TABLE public.production_import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view batches for their companies"
ON public.production_import_batches
FOR SELECT
USING (company_id IN (SELECT get_user_companies(auth.uid())));

CREATE POLICY "Admins and Gestors can insert batches"
ON public.production_import_batches
FOR INSERT
WITH CHECK (
  company_id IN (SELECT get_user_companies(auth.uid()))
  AND (has_role_in_company(auth.uid(), company_id, 'Admin') OR has_role_in_company(auth.uid(), company_id, 'Gestor'))
);

CREATE POLICY "Admins and Gestors can update batches"
ON public.production_import_batches
FOR UPDATE
USING (
  company_id IN (SELECT get_user_companies(auth.uid()))
  AND (has_role_in_company(auth.uid(), company_id, 'Admin') OR has_role_in_company(auth.uid(), company_id, 'Gestor'))
);

-- 3) RPC para importação atômica
CREATE OR REPLACE FUNCTION public.import_productions_batch(
  _company_id UUID,
  _context JSONB,
  _file_name TEXT,
  _rows JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _batch_id UUID;
  _user_id UUID;
  _total_rows INT;
  _valid_rows INT;
  _total_value NUMERIC := 0;
  _row JSONB;
  _row_num INT := 0;
  _production_type TEXT;
  _unit TEXT;
  _competencia TEXT;
  _payer_type TEXT;
  _convenio TEXT;
BEGIN
  _user_id := auth.uid();
  
  -- Validar permissão
  IF NOT (has_role_in_company(_user_id, _company_id, 'Admin') OR has_role_in_company(_user_id, _company_id, 'Gestor')) THEN
    RAISE EXCEPTION 'Sem permissão para importar produções';
  END IF;
  
  -- Extrair contexto
  _production_type := _context->>'production_type';
  _unit := _context->>'unit';
  _competencia := _context->>'competencia';
  _payer_type := _context->>'payer_type';
  _convenio := _context->>'convenio';
  
  _total_rows := jsonb_array_length(_rows);
  _valid_rows := _total_rows;
  
  -- Criar batch
  INSERT INTO production_import_batches (
    company_id, created_by, context, file_name, 
    total_rows, valid_rows, invalid_rows, status
  ) VALUES (
    _company_id, _user_id, _context, _file_name,
    _total_rows, _valid_rows, 0, 'PROCESSING'
  ) RETURNING id INTO _batch_id;
  
  -- Inserir produções
  FOR _row IN SELECT * FROM jsonb_array_elements(_rows)
  LOOP
    _row_num := _row_num + 1;
    
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
      description,
      status,
      import_batch_id,
      import_row_number,
      import_source,
      created_by
    ) VALUES (
      _company_id,
      (_row->>'production_date')::DATE,
      (_row->>'unit_value')::NUMERIC,
      (_row->>'unit_value')::NUMERIC,
      1,
      NULLIF(TRIM(_row->>'paciente_nome'), ''),
      _production_type,
      _unit,
      _competencia,
      _payer_type,
      NULLIF(_convenio, ''),
      COALESCE(NULLIF(TRIM(_row->>'paciente_nome'), ''), _production_type),
      'PRODUZIDO',
      _batch_id,
      _row_num,
      'import',
      _user_id
    );
    
    _total_value := _total_value + (_row->>'unit_value')::NUMERIC;
  END LOOP;
  
  -- Atualizar batch como sucesso
  UPDATE production_import_batches
  SET status = 'SUCCESS', total_value = _total_value
  WHERE id = _batch_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'batch_id', _batch_id,
    'imported_count', _valid_rows,
    'total_value', _total_value
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Em caso de erro, atualizar batch
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
$$;
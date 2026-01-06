-- =============================================
-- HARDENING MIGRATION: Production Security Fixes
-- =============================================

-- 1) Remover SECURITY DEFINER das funções de trigger (manter search_path)
-- Nota: Funções de trigger precisam executar no contexto do usuário, não do definer

CREATE OR REPLACE FUNCTION public.validate_financial_entry_values()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- Valor não pode ser negativo (NULL-safe)
  IF COALESCE(NEW.valor, 0) < 0 THEN
    RAISE EXCEPTION 'Valor não pode ser negativo: %', NEW.valor;
  END IF;
  
  -- company_id é obrigatório
  IF NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'company_id é obrigatório';
  END IF;
  
  -- Proteger company_id contra alteração em UPDATE
  IF TG_OP = 'UPDATE' AND OLD.company_id IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'Alteração de company_id não permitida';
  END IF;
  
  -- data_prevista não pode estar muito no futuro (proteção anti-fraude)
  IF NEW.data_prevista > CURRENT_DATE + INTERVAL '5 years' THEN
    RAISE EXCEPTION 'Data prevista muito distante: %', NEW.data_prevista;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_receivable_values()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- Validações NULL-safe
  IF COALESCE(NEW.billed_amount, 0) < 0 THEN
    RAISE EXCEPTION 'billed_amount não pode ser negativo: %', NEW.billed_amount;
  END IF;
  
  IF COALESCE(NEW.received_amount, 0) < 0 THEN
    RAISE EXCEPTION 'received_amount não pode ser negativo: %', NEW.received_amount;
  END IF;
  
  IF COALESCE(NEW.glossed_amount, 0) < 0 THEN
    RAISE EXCEPTION 'glossed_amount não pode ser negativo: %', NEW.glossed_amount;
  END IF;
  
  IF NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'company_id é obrigatório';
  END IF;
  
  -- Proteger company_id contra alteração em UPDATE
  IF TG_OP = 'UPDATE' AND OLD.company_id IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'Alteração de company_id não permitida';
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_production_values()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- Validações NULL-safe
  IF COALESCE(NEW.total_value, 0) < 0 THEN
    RAISE EXCEPTION 'total_value não pode ser negativo: %', NEW.total_value;
  END IF;
  
  IF COALESCE(NEW.quantity, 0) < 1 THEN
    RAISE EXCEPTION 'quantity deve ser pelo menos 1: %', NEW.quantity;
  END IF;
  
  IF NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'company_id é obrigatório';
  END IF;
  
  -- Proteger company_id contra alteração em UPDATE
  IF TG_OP = 'UPDATE' AND OLD.company_id IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'Alteração de company_id não permitida';
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_hard_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'Deleção física não permitida. Use cancelamento/soft-delete.';
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- 2) Adicionar coluna request_id para idempotência em financial_entries
ALTER TABLE public.financial_entries 
ADD COLUMN IF NOT EXISTS request_id uuid;

-- Criar índice único para idempotência (company_id + request_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_entries_idempotency 
ON public.financial_entries (company_id, request_id) 
WHERE request_id IS NOT NULL;

-- 3) Garantir defaults seguros para colunas críticas (retrocompatível)
ALTER TABLE public.financial_entries 
ALTER COLUMN valor SET DEFAULT 0;

ALTER TABLE public.receivables 
ALTER COLUMN billed_amount SET DEFAULT 0,
ALTER COLUMN received_amount SET DEFAULT 0,
ALTER COLUMN glossed_amount SET DEFAULT 0;

ALTER TABLE public.productions 
ALTER COLUMN total_value SET DEFAULT 0,
ALTER COLUMN quantity SET DEFAULT 1;

-- 4) Adicionar proteção de company_id em movement_allocations
CREATE OR REPLACE FUNCTION public.validate_movement_allocation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'company_id é obrigatório';
  END IF;
  
  -- Proteger company_id contra alteração em UPDATE
  IF TG_OP = 'UPDATE' AND OLD.company_id IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'Alteração de company_id não permitida';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Criar trigger se não existir
DROP TRIGGER IF EXISTS trg_validate_movement_allocation ON public.movement_allocations;
CREATE TRIGGER trg_validate_movement_allocation
  BEFORE INSERT OR UPDATE ON public.movement_allocations
  FOR EACH ROW EXECUTE FUNCTION public.validate_movement_allocation();
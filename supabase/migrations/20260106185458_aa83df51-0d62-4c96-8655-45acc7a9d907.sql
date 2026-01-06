-- ============================================================
-- AUDITORIA PRODUÇÃO: Correções de Segurança e Integridade
-- ============================================================

-- 1) ÍNDICES PARA PERFORMANCE (faltando em audit_logs)
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON public.audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);

-- 2) CONSTRAINT para evitar valores negativos (segurança de dados)
-- Usar trigger em vez de CHECK para flexibilidade

CREATE OR REPLACE FUNCTION public.validate_financial_entry_values()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Valor não pode ser negativo
  IF NEW.valor < 0 THEN
    RAISE EXCEPTION 'Valor não pode ser negativo: %', NEW.valor;
  END IF;
  
  -- company_id é obrigatório (belt-and-suspenders)
  IF NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'company_id é obrigatório';
  END IF;
  
  -- data_prevista não pode estar muito no futuro (proteção anti-fraude)
  IF NEW.data_prevista > CURRENT_DATE + INTERVAL '5 years' THEN
    RAISE EXCEPTION 'Data prevista muito distante: %', NEW.data_prevista;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_financial_entry ON public.financial_entries;
CREATE TRIGGER trg_validate_financial_entry
  BEFORE INSERT OR UPDATE ON public.financial_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_financial_entry_values();

-- 3) Trigger de validação para receivables
CREATE OR REPLACE FUNCTION public.validate_receivable_values()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.billed_amount < 0 THEN
    RAISE EXCEPTION 'billed_amount não pode ser negativo: %', NEW.billed_amount;
  END IF;
  
  IF NEW.received_amount < 0 THEN
    RAISE EXCEPTION 'received_amount não pode ser negativo: %', NEW.received_amount;
  END IF;
  
  IF NEW.glossed_amount < 0 THEN
    RAISE EXCEPTION 'glossed_amount não pode ser negativo: %', NEW.glossed_amount;
  END IF;
  
  IF NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'company_id é obrigatório';
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_receivable ON public.receivables;
CREATE TRIGGER trg_validate_receivable
  BEFORE INSERT OR UPDATE ON public.receivables
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_receivable_values();

-- 4) Trigger de validação para productions
CREATE OR REPLACE FUNCTION public.validate_production_values()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.total_value < 0 THEN
    RAISE EXCEPTION 'total_value não pode ser negativo: %', NEW.total_value;
  END IF;
  
  IF NEW.quantity < 1 THEN
    RAISE EXCEPTION 'quantity deve ser pelo menos 1: %', NEW.quantity;
  END IF;
  
  IF NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'company_id é obrigatório';
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_production ON public.productions;
CREATE TRIGGER trg_validate_production
  BEFORE INSERT OR UPDATE ON public.productions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_production_values();

-- 5) Função para prevenir deleção acidental (soft delete enforcement)
CREATE OR REPLACE FUNCTION public.prevent_hard_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'Deleção física não permitida. Use cancelamento/soft-delete.';
END;
$$;

-- Aplicar nas tabelas críticas (redundância com RLS)
DROP TRIGGER IF EXISTS trg_prevent_delete_financial ON public.financial_entries;
CREATE TRIGGER trg_prevent_delete_financial
  BEFORE DELETE ON public.financial_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_hard_delete();

DROP TRIGGER IF EXISTS trg_prevent_delete_receivables ON public.receivables;
CREATE TRIGGER trg_prevent_delete_receivables
  BEFORE DELETE ON public.receivables
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_hard_delete();

DROP TRIGGER IF EXISTS trg_prevent_delete_productions ON public.productions;
CREATE TRIGGER trg_prevent_delete_productions
  BEFORE DELETE ON public.productions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_hard_delete();

-- 6) Função de auditoria automática para updated_at
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Garantir que updated_at sempre é atualizado
DROP TRIGGER IF EXISTS trg_updated_at_financial ON public.financial_entries;
CREATE TRIGGER trg_updated_at_financial
  BEFORE UPDATE ON public.financial_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

DROP TRIGGER IF EXISTS trg_updated_at_receivables ON public.receivables;
CREATE TRIGGER trg_updated_at_receivables
  BEFORE UPDATE ON public.receivables
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

DROP TRIGGER IF EXISTS trg_updated_at_productions ON public.productions;
CREATE TRIGGER trg_updated_at_productions
  BEFORE UPDATE ON public.productions
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();
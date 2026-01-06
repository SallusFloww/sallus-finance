-- ============= PACOTES CONVÊNIO - MIGRATION RETROCOMPATÍVEL =============
-- Objetivo: Suportar pacotes BOX/GTA de convênio com componentes (consulta/taxa/matmed)
-- REGRA: Apenas ADD COLUMN/ADD TABLE/ADD INDEX - sem DROP/RENAME

-- ============= 1. TABELA DE REGRAS DE PREÇO POR PLANO =============
CREATE TABLE IF NOT EXISTS public.package_pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_id text NOT NULL, -- IPASGO, UNIMED, BRADESCO, GEAP, etc.
  package_type text NOT NULL CHECK (package_type IN ('PACOTE_BOX', 'PACOTE_GTA')),
  consult_default_amount numeric(12,2) NOT NULL DEFAULT 0,
  fee_default_amount numeric(12,2) NOT NULL DEFAULT 0,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id),
  notes text
);

-- Índices para performance e vigência
CREATE INDEX IF NOT EXISTS idx_package_pricing_rules_lookup 
  ON public.package_pricing_rules(company_id, plan_id, package_type, effective_from DESC);
CREATE INDEX IF NOT EXISTS idx_package_pricing_rules_active 
  ON public.package_pricing_rules(company_id, is_active);

-- RLS para isolamento multiempresa
ALTER TABLE public.package_pricing_rules ENABLE ROW LEVEL SECURITY;

-- Policy SELECT: usuários podem ver regras da sua empresa
CREATE POLICY "Users can view package pricing rules from their company"
  ON public.package_pricing_rules
  FOR SELECT
  USING (company_id IN (SELECT get_user_companies(auth.uid())));

-- Policy INSERT: Admins e Gestors podem criar regras
CREATE POLICY "Admins and Gestors can insert package pricing rules"
  ON public.package_pricing_rules
  FOR INSERT
  WITH CHECK (
    (company_id IN (SELECT get_user_companies(auth.uid()))) AND
    (has_role_in_company(auth.uid(), company_id, 'Admin') OR has_role_in_company(auth.uid(), company_id, 'Gestor'))
  );

-- Policy UPDATE: Admins e Gestors podem atualizar regras
CREATE POLICY "Admins and Gestors can update package pricing rules"
  ON public.package_pricing_rules
  FOR UPDATE
  USING (
    (company_id IN (SELECT get_user_companies(auth.uid()))) AND
    (has_role_in_company(auth.uid(), company_id, 'Admin') OR has_role_in_company(auth.uid(), company_id, 'Gestor'))
  );

-- Policy DELETE: Bloquear deleção física (soft-delete via is_active)
CREATE POLICY "No direct deletion of package pricing rules"
  ON public.package_pricing_rules
  FOR DELETE
  USING (false);

-- Trigger para updated_at automático
CREATE TRIGGER trg_updated_at_package_pricing_rules
  BEFORE UPDATE ON public.package_pricing_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

-- Trigger para proteger company_id
CREATE OR REPLACE FUNCTION public.validate_package_pricing_rule()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'company_id é obrigatório';
  END IF;
  
  IF TG_OP = 'UPDATE' AND OLD.company_id IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'Alteração de company_id não permitida';
  END IF;
  
  -- Validar valores não negativos
  IF COALESCE(NEW.consult_default_amount, 0) < 0 THEN
    RAISE EXCEPTION 'consult_default_amount não pode ser negativo';
  END IF;
  
  IF COALESCE(NEW.fee_default_amount, 0) < 0 THEN
    RAISE EXCEPTION 'fee_default_amount não pode ser negativo';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_package_pricing_rule
  BEFORE INSERT OR UPDATE ON public.package_pricing_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_package_pricing_rule();

-- ============= 2. COLUNAS DE PACOTE EM RECEIVABLES (RETROCOMPATÍVEL) =============
-- Adiciona campos para componentes do pacote - não quebra dados existentes

ALTER TABLE public.receivables 
  ADD COLUMN IF NOT EXISTS is_package boolean NOT NULL DEFAULT false;

ALTER TABLE public.receivables 
  ADD COLUMN IF NOT EXISTS package_type text CHECK (package_type IS NULL OR package_type IN ('PACOTE_BOX', 'PACOTE_GTA'));

ALTER TABLE public.receivables 
  ADD COLUMN IF NOT EXISTS consult_amount numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.receivables 
  ADD COLUMN IF NOT EXISTS fee_amount numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.receivables 
  ADD COLUMN IF NOT EXISTS matmed_amount numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.receivables 
  ADD COLUMN IF NOT EXISTS consult_qty integer NOT NULL DEFAULT 1;

ALTER TABLE public.receivables 
  ADD COLUMN IF NOT EXISTS package_qty integer NOT NULL DEFAULT 1;

ALTER TABLE public.receivables 
  ADD COLUMN IF NOT EXISTS request_id uuid;

-- Índice único para idempotência em receivables
CREATE UNIQUE INDEX IF NOT EXISTS idx_receivables_request_id 
  ON public.receivables(company_id, request_id) 
  WHERE request_id IS NOT NULL;

-- Índice para filtros de pacotes
CREATE INDEX IF NOT EXISTS idx_receivables_package 
  ON public.receivables(company_id, is_package, package_type) 
  WHERE is_package = true;

-- ============= 3. COLUNAS DE PACOTE EM PRODUCTIONS (RETROCOMPATÍVEL) =============
-- Para produção também poder ser registrada como pacote

ALTER TABLE public.productions 
  ADD COLUMN IF NOT EXISTS is_package boolean NOT NULL DEFAULT false;

ALTER TABLE public.productions 
  ADD COLUMN IF NOT EXISTS package_type text CHECK (package_type IS NULL OR package_type IN ('PACOTE_BOX', 'PACOTE_GTA'));

ALTER TABLE public.productions 
  ADD COLUMN IF NOT EXISTS consult_amount numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.productions 
  ADD COLUMN IF NOT EXISTS fee_amount numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.productions 
  ADD COLUMN IF NOT EXISTS matmed_amount numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.productions 
  ADD COLUMN IF NOT EXISTS package_qty integer NOT NULL DEFAULT 1;

ALTER TABLE public.productions 
  ADD COLUMN IF NOT EXISTS request_id uuid;

-- Índice único para idempotência em productions
CREATE UNIQUE INDEX IF NOT EXISTS idx_productions_request_id 
  ON public.productions(company_id, request_id) 
  WHERE request_id IS NOT NULL;

-- Índice para filtros de pacotes
CREATE INDEX IF NOT EXISTS idx_productions_package 
  ON public.productions(company_id, is_package, package_type) 
  WHERE is_package = true;

-- ============= 4. ATUALIZAR TRIGGER DE VALIDAÇÃO DE RECEIVABLES =============
-- Adicionar validação para campos de pacote

CREATE OR REPLACE FUNCTION public.validate_receivable_values()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
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
  
  -- Validações de campos de pacote
  IF COALESCE(NEW.consult_amount, 0) < 0 THEN
    RAISE EXCEPTION 'consult_amount não pode ser negativo: %', NEW.consult_amount;
  END IF;
  
  IF COALESCE(NEW.fee_amount, 0) < 0 THEN
    RAISE EXCEPTION 'fee_amount não pode ser negativo: %', NEW.fee_amount;
  END IF;
  
  IF COALESCE(NEW.matmed_amount, 0) < 0 THEN
    RAISE EXCEPTION 'matmed_amount não pode ser negativo: %', NEW.matmed_amount;
  END IF;
  
  IF NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'company_id é obrigatório';
  END IF;
  
  -- Proteger company_id contra alteração em UPDATE
  IF TG_OP = 'UPDATE' AND OLD.company_id IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'Alteração de company_id não permitida';
  END IF;
  
  -- Se é pacote, package_type deve estar preenchido
  IF NEW.is_package = true AND NEW.package_type IS NULL THEN
    RAISE EXCEPTION 'package_type é obrigatório para pacotes';
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============= 5. ATUALIZAR TRIGGER DE VALIDAÇÃO DE PRODUCTIONS =============
-- Adicionar validação para campos de pacote

CREATE OR REPLACE FUNCTION public.validate_production_values()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Validações NULL-safe
  IF COALESCE(NEW.total_value, 0) < 0 THEN
    RAISE EXCEPTION 'total_value não pode ser negativo: %', NEW.total_value;
  END IF;
  
  IF COALESCE(NEW.quantity, 0) < 1 THEN
    RAISE EXCEPTION 'quantity deve ser pelo menos 1: %', NEW.quantity;
  END IF;
  
  -- Validações de campos de pacote
  IF COALESCE(NEW.consult_amount, 0) < 0 THEN
    RAISE EXCEPTION 'consult_amount não pode ser negativo: %', NEW.consult_amount;
  END IF;
  
  IF COALESCE(NEW.fee_amount, 0) < 0 THEN
    RAISE EXCEPTION 'fee_amount não pode ser negativo: %', NEW.fee_amount;
  END IF;
  
  IF COALESCE(NEW.matmed_amount, 0) < 0 THEN
    RAISE EXCEPTION 'matmed_amount não pode ser negativo: %', NEW.matmed_amount;
  END IF;
  
  IF NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'company_id é obrigatório';
  END IF;
  
  -- Proteger company_id contra alteração em UPDATE
  IF TG_OP = 'UPDATE' AND OLD.company_id IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'Alteração de company_id não permitida';
  END IF;
  
  -- Se é pacote, package_type deve estar preenchido
  IF NEW.is_package = true AND NEW.package_type IS NULL THEN
    RAISE EXCEPTION 'package_type é obrigatório para pacotes';
  END IF;
  
  RETURN NEW;
END;
$$;
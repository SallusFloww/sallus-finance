-- =====================================================
-- ONDA 1: CORREÇÕES CRÍTICAS - MIGRATION CONSOLIDADA
-- =====================================================

-- 1) ADICIONAR COLUNAS FALTANTES EM financial_entries
-- -----------------------------------------------------
ALTER TABLE public.financial_entries 
ADD COLUMN IF NOT EXISTS specialty text;

ALTER TABLE public.financial_entries 
ADD COLUMN IF NOT EXISTS request_id uuid UNIQUE;

-- 2) CRIAR TABELA conciliation_status
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conciliation_status (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  receivable_id uuid REFERENCES public.receivables(id) ON DELETE SET NULL,
  financial_entry_id uuid REFERENCES public.financial_entries(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  matched_at timestamp with time zone,
  matched_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.conciliation_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conciliation_status
CREATE POLICY "Users can view conciliation status for their companies"
ON public.conciliation_status FOR SELECT
USING (company_id IN (SELECT get_user_companies(auth.uid())));

CREATE POLICY "Admins and Gestors can manage conciliation status"
ON public.conciliation_status FOR ALL
USING (
  company_id IN (SELECT get_user_companies(auth.uid())) 
  AND (
    has_role_in_company(auth.uid(), company_id, 'Admin') 
    OR has_role_in_company(auth.uid(), company_id, 'Gestor')
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_conciliation_status_updated_at
BEFORE UPDATE ON public.conciliation_status
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- 3) CRIAR TABELA conciliation_notes
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conciliation_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  conciliation_status_id uuid REFERENCES public.conciliation_status(id) ON DELETE CASCADE,
  receivable_id uuid REFERENCES public.receivables(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.conciliation_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conciliation_notes
CREATE POLICY "Users can view conciliation notes for their companies"
ON public.conciliation_notes FOR SELECT
USING (company_id IN (SELECT get_user_companies(auth.uid())));

CREATE POLICY "Admins and Gestors can manage conciliation notes"
ON public.conciliation_notes FOR ALL
USING (
  company_id IN (SELECT get_user_companies(auth.uid())) 
  AND (
    has_role_in_company(auth.uid(), company_id, 'Admin') 
    OR has_role_in_company(auth.uid(), company_id, 'Gestor')
  )
);

-- 4) CRIAR FUNÇÃO RPC: get_user_permissions
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id uuid)
RETURNS TABLE(permission_code text, permission_name text, module text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT p.code, p.name, p.module
  FROM permissions p
  JOIN role_permissions rp ON rp.permission_id = p.id
  JOIN user_company_roles ucr ON ucr.role_id = rp.role_id
  WHERE ucr.user_id = _user_id AND ucr.is_active = true
$$;

-- 5) CRIAR FUNÇÃO RPC: validate_invite_token
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_invite_token(_token uuid)
RETURNS TABLE(
  id uuid,
  email text,
  full_name text,
  company_id uuid,
  company_name text,
  role_id uuid,
  role_name text,
  status text,
  expires_at timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    ui.id,
    ui.email,
    ui.full_name,
    ui.company_id,
    c.name as company_name,
    ui.role_id,
    r.name as role_name,
    ui.status,
    ui.expires_at
  FROM user_invites ui
  JOIN companies c ON c.id = ui.company_id
  JOIN roles r ON r.id = ui.role_id
  WHERE ui.token = _token
    AND ui.status = 'pending'
    AND ui.expires_at > now()
$$;

-- 6) CRIAR FUNÇÃO RPC: reset_demo_company
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.reset_demo_company(_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _is_admin boolean;
BEGIN
  -- Verificar se o usuário é admin da empresa
  SELECT has_role_in_company(auth.uid(), _company_id, 'Admin') INTO _is_admin;
  
  IF NOT _is_admin THEN
    RAISE EXCEPTION 'Apenas administradores podem resetar dados demo';
  END IF;
  
  -- Deletar dados de conciliação
  DELETE FROM conciliation_notes WHERE company_id = _company_id;
  DELETE FROM conciliation_status WHERE company_id = _company_id;
  
  -- Deletar dados financeiros (em ordem de dependência)
  DELETE FROM financial_entries WHERE company_id = _company_id;
  DELETE FROM receivables WHERE company_id = _company_id;
  DELETE FROM productions WHERE company_id = _company_id;
  
  -- Resetar saldo inicial
  UPDATE company_financial_settings 
  SET initial_balance = 0, initial_balance_adjustments = '[]'::jsonb
  WHERE company_id = _company_id;
  
  RETURN true;
END;
$$;

-- 7) CRIAR FUNÇÃO RPC: link_receivable_to_existing_entry
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.link_receivable_to_existing_entry(
  _receivable_id uuid,
  _financial_entry_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _receivable_company_id uuid;
  _entry_company_id uuid;
  _user_id uuid;
BEGIN
  _user_id := auth.uid();
  
  -- Buscar company_id do receivable
  SELECT company_id INTO _receivable_company_id 
  FROM receivables WHERE id = _receivable_id;
  
  -- Buscar company_id da entry
  SELECT company_id INTO _entry_company_id 
  FROM financial_entries WHERE id = _financial_entry_id;
  
  -- Validar que ambos existem e pertencem à mesma empresa
  IF _receivable_company_id IS NULL OR _entry_company_id IS NULL THEN
    RAISE EXCEPTION 'Receivable ou Financial Entry não encontrado';
  END IF;
  
  IF _receivable_company_id != _entry_company_id THEN
    RAISE EXCEPTION 'Receivable e Financial Entry devem pertencer à mesma empresa';
  END IF;
  
  -- Verificar permissão
  IF NOT (has_role_in_company(_user_id, _receivable_company_id, 'Admin') 
          OR has_role_in_company(_user_id, _receivable_company_id, 'Gestor')) THEN
    RAISE EXCEPTION 'Sem permissão para vincular';
  END IF;
  
  -- Atualizar o receivable com o link
  UPDATE receivables 
  SET linked_transaction_id = _financial_entry_id,
      updated_by = _user_id,
      updated_at = now()
  WHERE id = _receivable_id;
  
  -- Criar/atualizar status de conciliação
  INSERT INTO conciliation_status (company_id, receivable_id, financial_entry_id, status, matched_at, matched_by)
  VALUES (_receivable_company_id, _receivable_id, _financial_entry_id, 'matched', now(), _user_id)
  ON CONFLICT (id) DO UPDATE SET
    financial_entry_id = EXCLUDED.financial_entry_id,
    status = 'matched',
    matched_at = now(),
    matched_by = _user_id;
  
  RETURN true;
END;
$$;
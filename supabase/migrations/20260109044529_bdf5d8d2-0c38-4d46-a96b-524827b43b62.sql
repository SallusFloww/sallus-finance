-- =====================================================
-- SALLUS FINANCE - SCHEMA CONSOLIDADO
-- =====================================================

-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'viewer');
CREATE TYPE public.financial_entry_status AS ENUM ('previsto', 'recebido', 'cancelado');
CREATE TYPE public.financial_entry_type AS ENUM ('entrada', 'saida');

-- =====================================================
-- TABELAS PRINCIPAIS
-- =====================================================

-- Companies
CREATE TABLE public.companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    name text NOT NULL,
    cnpj text UNIQUE,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT companies_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'suspended'::text])))
);

-- Profiles
CREATE TABLE public.profiles (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text NOT NULL,
    full_name text,
    avatar_url text,
    status text DEFAULT 'active'::text NOT NULL,
    last_login timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT profiles_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'suspended'::text])))
);

-- Roles
CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    is_system boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT roles_company_id_name_key UNIQUE (company_id, name)
);

-- Permissions
CREATE TABLE public.permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    code text NOT NULL UNIQUE,
    name text NOT NULL,
    description text,
    module text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Role Permissions
CREATE TABLE public.role_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT role_permissions_role_id_permission_id_key UNIQUE (role_id, permission_id)
);

-- User Company Roles
CREATE TABLE public.user_company_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    is_primary boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_company_roles_user_company_unique UNIQUE (user_id, company_id),
    CONSTRAINT user_company_roles_user_id_company_id_role_id_key UNIQUE (user_id, company_id, role_id)
);

-- User Invites
CREATE TABLE public.user_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    email text NOT NULL,
    full_name text NOT NULL,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    invited_by uuid NOT NULL REFERENCES auth.users(id),
    token uuid DEFAULT gen_random_uuid() NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
    accepted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_invites_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'expired'::text, 'cancelled'::text])))
);

-- Company Settings
CREATE TABLE public.company_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
    currency text DEFAULT 'BRL'::text NOT NULL,
    timezone text DEFAULT 'America/Sao_Paulo'::text NOT NULL,
    locale text DEFAULT 'pt-BR'::text NOT NULL,
    default_period text DEFAULT 'current_month'::text NOT NULL,
    show_consolidation_message boolean DEFAULT true NOT NULL,
    score_min_days integer DEFAULT 7 NOT NULL,
    segment text DEFAULT 'saude'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Company Financial Settings
CREATE TABLE public.company_financial_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
    initial_balance numeric DEFAULT 0 NOT NULL,
    initial_balance_last_update timestamp with time zone,
    initial_balance_adjustments jsonb DEFAULT '[]'::jsonb,
    units jsonb DEFAULT '[]'::jsonb,
    categories jsonb DEFAULT '[]'::jsonb,
    payment_methods jsonb DEFAULT '["PIX", "TRANSFER", "CASH", "CARD"]'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Financial Entries
CREATE TABLE public.financial_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    type public.financial_entry_type NOT NULL,
    status public.financial_entry_status DEFAULT 'previsto'::public.financial_entry_status NOT NULL,
    descricao text NOT NULL,
    categoria text,
    valor numeric(15,2) NOT NULL,
    data_prevista date NOT NULL,
    data_recebimento date,
    observacao text,
    unit_id text,
    payment_method text,
    receipt_type text,
    operadora text,
    created_by uuid REFERENCES auth.users(id),
    updated_by uuid REFERENCES auth.users(id),
    cancelled_by uuid REFERENCES auth.users(id),
    cancelled_at timestamp with time zone,
    cancel_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT financial_entries_valor_check CHECK ((valor >= (0)::numeric))
);

-- Productions
CREATE TABLE public.productions (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    production_date date NOT NULL,
    competencia text NOT NULL,
    unit text NOT NULL,
    specialty text,
    payer_type text NOT NULL,
    convenio text,
    production_type text NOT NULL,
    description text NOT NULL,
    procedure_code text,
    quantity integer DEFAULT 1 NOT NULL,
    unit_value numeric DEFAULT 0 NOT NULL,
    total_value numeric DEFAULT 0 NOT NULL,
    billed_value numeric,
    received_value numeric,
    glossed_value numeric,
    status text DEFAULT 'PRODUZIDO'::text NOT NULL,
    linked_receivable_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    history jsonb DEFAULT '[]'::jsonb,
    edit_logs jsonb DEFAULT '[]'::jsonb,
    CONSTRAINT productions_payer_type_check CHECK ((payer_type = ANY (ARRAY['CONVENIO'::text, 'PARTICULAR'::text]))),
    CONSTRAINT productions_status_check CHECK ((status = ANY (ARRAY['PRODUZIDO'::text, 'FATURADO'::text, 'GLOSADO'::text, 'RECEBIDO'::text])))
);

-- Receivables
CREATE TABLE public.receivables (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    billing_date date NOT NULL,
    competencia text,
    unit text NOT NULL,
    source text NOT NULL,
    description text NOT NULL,
    billed_amount numeric NOT NULL,
    received_amount numeric DEFAULT 0 NOT NULL,
    glossed_amount numeric DEFAULT 0 NOT NULL,
    status text DEFAULT 'FATURADO'::text NOT NULL,
    gloss_type text,
    gloss_reason text,
    appeal_status text DEFAULT 'NAO_INICIADO'::text,
    appeal_amount numeric,
    appeal_start_date timestamp with time zone,
    appeal_resolved_date timestamp with time zone,
    appeal_recovered_amount numeric,
    appeal_transaction_id uuid,
    expected_receipt_days integer,
    actual_receipt_date date,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    linked_transaction_id uuid,
    history jsonb DEFAULT '[]'::jsonb,
    edit_logs jsonb DEFAULT '[]'::jsonb,
    CONSTRAINT receivables_appeal_status_check CHECK ((appeal_status = ANY (ARRAY['NAO_INICIADO'::text, 'EM_RECURSO'::text, 'DEFERIDO'::text, 'INDEFERIDO'::text]))),
    CONSTRAINT receivables_gloss_type_check CHECK ((gloss_type = ANY (ARRAY['PARCIAL'::text, 'TOTAL'::text]))),
    CONSTRAINT receivables_status_check CHECK ((status = ANY (ARRAY['FATURADO'::text, 'RECEBIDO'::text, 'RECEBIDO_COM_GLOSA'::text, 'GLOSADO'::text])))
);

-- Audit Logs
CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
    action text NOT NULL,
    module text,
    details jsonb,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX idx_financial_entries_company ON public.financial_entries USING btree (company_id);
CREATE INDEX idx_financial_entries_data_prevista ON public.financial_entries USING btree (data_prevista);
CREATE INDEX idx_financial_entries_status ON public.financial_entries USING btree (status);
CREATE INDEX idx_financial_entries_type ON public.financial_entries USING btree (type);
CREATE INDEX idx_productions_company_id ON public.productions USING btree (company_id);
CREATE INDEX idx_productions_production_date ON public.productions USING btree (production_date);
CREATE INDEX idx_productions_status ON public.productions USING btree (status);
CREATE INDEX idx_receivables_company_id ON public.receivables USING btree (company_id);
CREATE INDEX idx_receivables_billing_date ON public.receivables USING btree (billing_date);
CREATE INDEX idx_receivables_status ON public.receivables USING btree (status);
CREATE INDEX idx_user_company_roles_active ON public.user_company_roles USING btree (user_id, company_id, is_active);
CREATE INDEX user_invites_company_idx ON public.user_invites USING btree (company_id);
CREATE INDEX user_invites_email_idx ON public.user_invites USING btree (email);
CREATE INDEX user_invites_status_idx ON public.user_invites USING btree (status);
CREATE UNIQUE INDEX user_invites_token_idx ON public.user_invites USING btree (token);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Get user companies
CREATE OR REPLACE FUNCTION public.get_user_companies(_user_id uuid) RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT company_id FROM public.user_company_roles WHERE user_id = _user_id
$$;

-- Check if user belongs to company
CREATE OR REPLACE FUNCTION public.user_belongs_to_company(_user_id uuid, _company_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_company_roles WHERE user_id = _user_id AND company_id = _company_id)
$$;

-- Check if user has role in company
CREATE OR REPLACE FUNCTION public.has_role_in_company(_user_id uuid, _company_id uuid, _role_name text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_company_roles ucr
    JOIN public.roles r ON r.id = ucr.role_id
    WHERE ucr.user_id = _user_id AND ucr.company_id = _company_id AND r.name = _role_name
  )
$$;

-- Check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_company_roles ucr
    JOIN public.roles r ON r.id = ucr.role_id
    WHERE ucr.user_id = _user_id AND r.name = 'Admin'
  )
$$;

-- Handle new user - create profile
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;

-- Create company defaults
CREATE OR REPLACE FUNCTION public.create_company_defaults() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.company_settings (company_id, segment) VALUES (NEW.id, 'saude') ON CONFLICT (company_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- =====================================================
-- TRIGGERS
-- =====================================================
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_company_settings_updated_at BEFORE UPDATE ON public.company_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_company_financial_settings_updated_at BEFORE UPDATE ON public.company_financial_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_financial_entries_updated_at BEFORE UPDATE ON public.financial_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_productions_updated_at BEFORE UPDATE ON public.productions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_receivables_updated_at BEFORE UPDATE ON public.receivables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_user_company_roles_updated_at BEFORE UPDATE ON public.user_company_roles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_user_invites_updated_at BEFORE UPDATE ON public.user_invites FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trigger_create_company_defaults AFTER INSERT ON public.companies FOR EACH ROW EXECUTE FUNCTION public.create_company_defaults();

-- Trigger para criar profile quando usuário é criado
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_company_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_financial_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Companies
CREATE POLICY "Authenticated users can create companies" ON public.companies FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can view their companies" ON public.companies FOR SELECT USING (id IN (SELECT public.get_user_companies(auth.uid())));
CREATE POLICY "Admins can update companies" ON public.companies FOR UPDATE USING (public.has_role_in_company(auth.uid(), id, 'Admin'));
CREATE POLICY "Admins can delete companies" ON public.companies FOR DELETE TO authenticated USING (public.has_role_in_company(auth.uid(), id, 'Admin'));

-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles in company" ON public.profiles FOR SELECT USING (
  (auth.uid() = id) OR 
  EXISTS (
    SELECT 1 FROM public.user_company_roles ucr1
    JOIN public.user_company_roles ucr2 ON ucr1.company_id = ucr2.company_id
    WHERE ucr1.user_id = auth.uid() AND ucr2.user_id = profiles.id AND public.has_role_in_company(auth.uid(), ucr1.company_id, 'Admin')
  )
);

-- Roles
CREATE POLICY "Authenticated users can view system roles" ON public.roles FOR SELECT USING (is_system = true OR company_id IN (SELECT public.get_user_companies(auth.uid())));
CREATE POLICY "Admins can manage roles" ON public.roles USING (public.has_role_in_company(auth.uid(), company_id, 'Admin'));

-- Permissions
CREATE POLICY "Authenticated users can view permissions" ON public.permissions FOR SELECT TO authenticated USING (true);

-- Role Permissions
CREATE POLICY "Admins can manage role permissions" ON public.role_permissions USING (role_id IN (SELECT r.id FROM public.roles r WHERE public.has_role_in_company(auth.uid(), r.company_id, 'Admin')));

-- User Company Roles
CREATE POLICY "Users can view own company roles" ON public.user_company_roles FOR SELECT USING (user_id = auth.uid() OR company_id IN (SELECT public.get_user_companies(auth.uid())));
CREATE POLICY "Admins can manage user company roles" ON public.user_company_roles USING (public.has_role_in_company(auth.uid(), company_id, 'Admin'));

-- User Invites
CREATE POLICY "Admins can manage invites for their companies" ON public.user_invites TO authenticated USING (public.has_role_in_company(auth.uid(), company_id, 'Admin')) WITH CHECK (public.has_role_in_company(auth.uid(), company_id, 'Admin'));
CREATE POLICY "Anyone can validate invite token" ON public.user_invites FOR SELECT USING (true);

-- Company Settings
CREATE POLICY "Users can view their company settings" ON public.company_settings FOR SELECT USING (company_id IN (SELECT public.get_user_companies(auth.uid())));
CREATE POLICY "Admins can insert settings" ON public.company_settings FOR INSERT WITH CHECK (public.has_role_in_company(auth.uid(), company_id, 'Admin') OR company_id IN (SELECT public.get_user_companies(auth.uid())));
CREATE POLICY "Admins can update settings" ON public.company_settings FOR UPDATE USING (public.has_role_in_company(auth.uid(), company_id, 'Admin'));

-- Company Financial Settings
CREATE POLICY "Users can view their company financial settings" ON public.company_financial_settings FOR SELECT USING (company_id IN (SELECT public.get_user_companies(auth.uid())));
CREATE POLICY "Admins can manage settings" ON public.company_financial_settings USING (public.has_role_in_company(auth.uid(), company_id, 'Admin'));

-- Financial Entries
CREATE POLICY "Users can view entries for their companies" ON public.financial_entries FOR SELECT USING (company_id IN (SELECT public.get_user_companies(auth.uid())));
CREATE POLICY "Admins and Gestors can insert entries" ON public.financial_entries FOR INSERT WITH CHECK (company_id IN (SELECT public.get_user_companies(auth.uid())) AND (public.has_role_in_company(auth.uid(), company_id, 'Admin') OR public.has_role_in_company(auth.uid(), company_id, 'Gestor')));
CREATE POLICY "Admins and Gestors can update entries" ON public.financial_entries FOR UPDATE USING (company_id IN (SELECT public.get_user_companies(auth.uid())) AND (public.has_role_in_company(auth.uid(), company_id, 'Admin') OR public.has_role_in_company(auth.uid(), company_id, 'Gestor')));

-- Productions
CREATE POLICY "Users can view productions for their companies" ON public.productions FOR SELECT USING (company_id IN (SELECT public.get_user_companies(auth.uid())));
CREATE POLICY "Admins and Gestors can insert productions" ON public.productions FOR INSERT WITH CHECK (company_id IN (SELECT public.get_user_companies(auth.uid())) AND (public.has_role_in_company(auth.uid(), company_id, 'Admin') OR public.has_role_in_company(auth.uid(), company_id, 'Gestor')));
CREATE POLICY "Admins and Gestors can update productions" ON public.productions FOR UPDATE USING (company_id IN (SELECT public.get_user_companies(auth.uid())) AND (public.has_role_in_company(auth.uid(), company_id, 'Admin') OR public.has_role_in_company(auth.uid(), company_id, 'Gestor')));

-- Receivables
CREATE POLICY "Users can view receivables for their companies" ON public.receivables FOR SELECT USING (company_id IN (SELECT public.get_user_companies(auth.uid())));
CREATE POLICY "Admins and Gestors can insert receivables" ON public.receivables FOR INSERT WITH CHECK (company_id IN (SELECT public.get_user_companies(auth.uid())) AND (public.has_role_in_company(auth.uid(), company_id, 'Admin') OR public.has_role_in_company(auth.uid(), company_id, 'Gestor')));
CREATE POLICY "Admins and Gestors can update receivables" ON public.receivables FOR UPDATE USING (company_id IN (SELECT public.get_user_companies(auth.uid())) AND (public.has_role_in_company(auth.uid(), company_id, 'Admin') OR public.has_role_in_company(auth.uid(), company_id, 'Gestor')));

-- Audit Logs
CREATE POLICY "Authenticated users can insert audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT USING (company_id IN (SELECT public.get_user_companies(auth.uid())) AND (public.has_role_in_company(auth.uid(), company_id, 'Admin') OR user_id = auth.uid()));

-- =====================================================
-- SEED DATA - ROLES E PERMISSIONS
-- =====================================================
INSERT INTO public.roles (name, description, is_system) VALUES 
  ('Admin', 'Administrador com acesso total', true),
  ('Gestor', 'Gestor com acesso de edição', true),
  ('Visualizador', 'Apenas visualização', true)
ON CONFLICT DO NOTHING;
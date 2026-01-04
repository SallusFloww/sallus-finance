CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'manager',
    'viewer'
);


--
-- Name: financial_entry_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.financial_entry_status AS ENUM (
    'previsto',
    'recebido',
    'cancelado'
);


--
-- Name: financial_entry_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.financial_entry_type AS ENUM (
    'entrada',
    'saida'
);


--
-- Name: accept_invite(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accept_invite(invite_token uuid, user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_invite RECORD;
BEGIN
  -- Buscar convite válido
  SELECT * INTO v_invite
  FROM public.user_invites
  WHERE token = invite_token
    AND status = 'pending'
    AND expires_at > now();
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Criar vínculo user_company_roles
  INSERT INTO public.user_company_roles (user_id, company_id, role_id, is_primary)
  VALUES (user_id, v_invite.company_id, v_invite.role_id, true)
  ON CONFLICT (user_id, company_id) DO UPDATE SET role_id = EXCLUDED.role_id;
  
  -- Marcar convite como aceito
  UPDATE public.user_invites
  SET status = 'accepted', accepted_at = now()
  WHERE id = v_invite.id;
  
  RETURN true;
END;
$$;


--
-- Name: auto_assign_admin_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_assign_admin_role() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_company_id uuid;
  v_admin_role_id uuid;
  v_existing_role uuid;
BEGIN
  -- Só processar para o email específico
  IF NEW.email = 'gestao@imecsaude.com.br' THEN
    -- Buscar a empresa principal (primeira empresa ativa)
    SELECT id INTO v_company_id 
    FROM public.companies 
    WHERE status = 'active' 
    ORDER BY created_at ASC 
    LIMIT 1;
    
    -- Se não existe empresa, criar uma
    IF v_company_id IS NULL THEN
      INSERT INTO public.companies (name, status)
      VALUES ('IMEC Saúde', 'active')
      RETURNING id INTO v_company_id;
    END IF;
    
    -- Buscar role Admin
    SELECT id INTO v_admin_role_id 
    FROM public.roles 
    WHERE name = 'Admin' 
    LIMIT 1;
    
    -- Se não existe role Admin, criar
    IF v_admin_role_id IS NULL THEN
      INSERT INTO public.roles (name, description, is_system)
      VALUES ('Admin', 'Administrador com acesso total', true)
      RETURNING id INTO v_admin_role_id;
    END IF;
    
    -- Verificar se já existe vínculo
    SELECT id INTO v_existing_role
    FROM public.user_company_roles
    WHERE user_id = NEW.id
      AND company_id = v_company_id;
    
    -- Se não existe vínculo, criar com role Admin
    IF v_existing_role IS NULL THEN
      INSERT INTO public.user_company_roles (user_id, company_id, role_id, is_primary)
      VALUES (NEW.id, v_company_id, v_admin_role_id, true);
    ELSE
      -- Se existe, atualizar para Admin
      UPDATE public.user_company_roles
      SET role_id = v_admin_role_id
      WHERE user_id = NEW.id
        AND company_id = v_company_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: check_permission(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_permission(_user_id uuid, _company_id uuid, _permission_code text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  -- Admin sempre tem todas as permissões
  SELECT EXISTS (
    SELECT 1
    FROM user_company_roles ucr
    JOIN roles r ON r.id = ucr.role_id
    WHERE ucr.user_id = _user_id
      AND ucr.company_id = _company_id
      AND ucr.is_active = true
      AND r.name = 'Admin'
  )
  OR EXISTS (
    SELECT 1
    FROM user_company_roles ucr
    JOIN role_permissions rp ON rp.role_id = ucr.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ucr.user_id = _user_id
      AND ucr.company_id = _company_id
      AND ucr.is_active = true
      AND p.code = _permission_code
  )
$$;


--
-- Name: create_company_defaults(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_company_defaults() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Criar configurações padrão para a nova empresa
  INSERT INTO public.company_settings (company_id, segment)
  VALUES (NEW.id, 'saude')
  ON CONFLICT (company_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;


--
-- Name: get_accessible_modules(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_accessible_modules(_user_id uuid, _company_id uuid) RETURNS TABLE(module text, permissions text[])
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT 
    p.module,
    array_agg(DISTINCT p.code) as permissions
  FROM user_company_roles ucr
  JOIN role_permissions rp ON rp.role_id = ucr.role_id
  JOIN permissions p ON p.id = rp.permission_id
  WHERE ucr.user_id = _user_id
    AND ucr.company_id = _company_id
    AND ucr.is_active = true
  GROUP BY p.module
  
  UNION ALL
  
  -- Se for Admin, retorna todos os módulos
  SELECT 
    p.module,
    array_agg(DISTINCT p.code) as permissions
  FROM permissions p
  WHERE EXISTS (
    SELECT 1 FROM user_company_roles ucr
    JOIN roles r ON r.id = ucr.role_id
    WHERE ucr.user_id = _user_id
      AND ucr.company_id = _company_id
      AND ucr.is_active = true
      AND r.name = 'Admin'
  )
  GROUP BY p.module
$$;


--
-- Name: get_company_profiles_safe(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_company_profiles_safe(_company_id uuid) RETURNS TABLE(id uuid, full_name text, avatar_url text, status text, created_at timestamp with time zone, updated_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT 
    p.id,
    p.full_name,
    p.avatar_url,
    p.status,
    p.created_at,
    p.updated_at
  FROM profiles p
  JOIN user_company_roles ucr ON ucr.user_id = p.id
  WHERE ucr.company_id = _company_id
    AND user_belongs_to_company(auth.uid(), _company_id)
$$;


--
-- Name: get_user_companies(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_companies(_user_id uuid) RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT DISTINCT company_id
  FROM public.user_company_roles
  WHERE user_id = _user_id
$$;


--
-- Name: get_user_permissions(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_permissions(_user_id uuid, _company_id uuid) RETURNS TABLE(permission_code text, permission_name text, module text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT DISTINCT p.code, p.name, p.module
  FROM public.user_company_roles ucr
  JOIN public.role_permissions rp ON rp.role_id = ucr.role_id
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE ucr.user_id = _user_id
    AND ucr.company_id = _company_id
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;


--
-- Name: has_permission(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_permission(_user_id uuid, _company_id uuid, _permission_code text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_company_roles ucr
    JOIN public.role_permissions rp ON rp.role_id = ucr.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ucr.user_id = _user_id
      AND ucr.company_id = _company_id
      AND p.code = _permission_code
  )
$$;


--
-- Name: has_role_in_company(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role_in_company(_user_id uuid, _company_id uuid, _role_name text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_company_roles ucr
    JOIN public.roles r ON r.id = ucr.role_id
    WHERE ucr.user_id = _user_id
      AND ucr.company_id = _company_id
      AND r.name = _role_name
  )
$$;


--
-- Name: is_active_user(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_active_user(_user_id uuid, _company_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_company_roles
    WHERE user_id = _user_id
      AND company_id = _company_id
      AND is_active = true
  )
$$;


--
-- Name: is_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_company_roles ucr
    JOIN public.roles r ON r.id = ucr.role_id
    WHERE ucr.user_id = _user_id
      AND r.name = 'Admin'
  )
$$;


--
-- Name: log_access_denied(uuid, uuid, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_access_denied(_user_id uuid, _company_id uuid, _action text, _resource text, _details jsonb DEFAULT NULL::jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO audit_logs (user_id, company_id, action, module, details)
  VALUES (
    _user_id,
    _company_id,
    'ACCESS_DENIED',
    _resource,
    jsonb_build_object(
      'attempted_action', _action,
      'resource', _resource,
      'timestamp', now(),
      'details', COALESCE(_details, '{}'::jsonb)
    )
  );
END;
$$;


--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: user_belongs_to_company(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_belongs_to_company(_user_id uuid, _company_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_company_roles
    WHERE user_id = _user_id
      AND company_id = _company_id
  )
$$;


--
-- Name: validate_invite_token(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_invite_token(invite_token uuid) RETURNS TABLE(id uuid, email text, full_name text, company_name text, role_name text, is_valid boolean)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT 
    i.id,
    i.email,
    i.full_name,
    c.name as company_name,
    r.name as role_name,
    (i.status = 'pending' AND i.expires_at > now()) as is_valid
  FROM public.user_invites i
  JOIN public.companies c ON c.id = i.company_id
  JOIN public.roles r ON r.id = i.role_id
  WHERE i.token = invite_token
$$;


SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    company_id uuid,
    action text NOT NULL,
    module text,
    details jsonb,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    cnpj text,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT companies_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'suspended'::text])))
);


--
-- Name: user_company_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_company_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    company_id uuid NOT NULL,
    role_id uuid NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: companies_safe; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.companies_safe WITH (security_invoker='true') AS
 SELECT id,
    name,
    status,
    created_at,
    updated_at
   FROM public.companies c
  WHERE (id IN ( SELECT user_company_roles.company_id
           FROM public.user_company_roles
          WHERE (user_company_roles.user_id = auth.uid())));


--
-- Name: company_financial_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_financial_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    initial_balance numeric DEFAULT 0 NOT NULL,
    initial_balance_last_update timestamp with time zone,
    initial_balance_adjustments jsonb DEFAULT '[]'::jsonb,
    units jsonb DEFAULT '[]'::jsonb,
    categories jsonb DEFAULT '[]'::jsonb,
    payment_methods jsonb DEFAULT '["PIX", "TRANSFER", "CASH", "CARD"]'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: company_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
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


--
-- Name: financial_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
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
    created_by uuid,
    updated_by uuid,
    cancelled_by uuid,
    cancelled_at timestamp with time zone,
    cancel_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT financial_entries_valor_check CHECK ((valor >= (0)::numeric))
);


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    module text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: productions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.productions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
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


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    avatar_url text,
    status text DEFAULT 'active'::text NOT NULL,
    last_login timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT profiles_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'suspended'::text])))
);


--
-- Name: profiles_safe; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.profiles_safe WITH (security_invoker='true') AS
 SELECT id,
    full_name,
    avatar_url,
    status,
    created_at,
    updated_at
   FROM public.profiles p
  WHERE ((id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM (public.user_company_roles ucr1
             JOIN public.user_company_roles ucr2 ON ((ucr1.company_id = ucr2.company_id)))
          WHERE ((ucr1.user_id = auth.uid()) AND (ucr2.user_id = p.id)))));


--
-- Name: receivables; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.receivables (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
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


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    name text NOT NULL,
    description text,
    is_system boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    full_name text NOT NULL,
    company_id uuid NOT NULL,
    role_id uuid NOT NULL,
    invited_by uuid NOT NULL,
    token uuid DEFAULT gen_random_uuid() NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
    accepted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_invites_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'expired'::text, 'cancelled'::text])))
);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: companies companies_cnpj_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_cnpj_key UNIQUE (cnpj);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: company_financial_settings company_financial_settings_company_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_financial_settings
    ADD CONSTRAINT company_financial_settings_company_id_key UNIQUE (company_id);


--
-- Name: company_financial_settings company_financial_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_financial_settings
    ADD CONSTRAINT company_financial_settings_pkey PRIMARY KEY (id);


--
-- Name: company_settings company_settings_company_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_settings
    ADD CONSTRAINT company_settings_company_id_key UNIQUE (company_id);


--
-- Name: company_settings company_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_settings
    ADD CONSTRAINT company_settings_pkey PRIMARY KEY (id);


--
-- Name: financial_entries financial_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_entries
    ADD CONSTRAINT financial_entries_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_code_key UNIQUE (code);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: productions productions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productions
    ADD CONSTRAINT productions_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: receivables receivables_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receivables
    ADD CONSTRAINT receivables_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_role_id_permission_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_permission_id_key UNIQUE (role_id, permission_id);


--
-- Name: roles roles_company_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_company_id_name_key UNIQUE (company_id, name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: user_company_roles user_company_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_company_roles
    ADD CONSTRAINT user_company_roles_pkey PRIMARY KEY (id);


--
-- Name: user_company_roles user_company_roles_user_company_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_company_roles
    ADD CONSTRAINT user_company_roles_user_company_unique UNIQUE (user_id, company_id);


--
-- Name: user_company_roles user_company_roles_user_id_company_id_role_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_company_roles
    ADD CONSTRAINT user_company_roles_user_id_company_id_role_id_key UNIQUE (user_id, company_id, role_id);


--
-- Name: user_invites user_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_invites
    ADD CONSTRAINT user_invites_pkey PRIMARY KEY (id);


--
-- Name: idx_financial_entries_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financial_entries_company ON public.financial_entries USING btree (company_id);


--
-- Name: idx_financial_entries_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financial_entries_company_id ON public.financial_entries USING btree (company_id);


--
-- Name: idx_financial_entries_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financial_entries_created_at ON public.financial_entries USING btree (created_at);


--
-- Name: idx_financial_entries_data_prevista; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financial_entries_data_prevista ON public.financial_entries USING btree (data_prevista);


--
-- Name: idx_financial_entries_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financial_entries_status ON public.financial_entries USING btree (status);


--
-- Name: idx_financial_entries_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financial_entries_type ON public.financial_entries USING btree (type);


--
-- Name: idx_productions_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_productions_company_id ON public.productions USING btree (company_id);


--
-- Name: idx_productions_production_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_productions_production_date ON public.productions USING btree (production_date);


--
-- Name: idx_productions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_productions_status ON public.productions USING btree (status);


--
-- Name: idx_receivables_billing_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_receivables_billing_date ON public.receivables USING btree (billing_date);


--
-- Name: idx_receivables_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_receivables_company_id ON public.receivables USING btree (company_id);


--
-- Name: idx_receivables_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_receivables_status ON public.receivables USING btree (status);


--
-- Name: idx_user_company_roles_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_company_roles_active ON public.user_company_roles USING btree (user_id, company_id, is_active);


--
-- Name: user_invites_company_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_invites_company_idx ON public.user_invites USING btree (company_id);


--
-- Name: user_invites_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_invites_email_idx ON public.user_invites USING btree (email);


--
-- Name: user_invites_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_invites_status_idx ON public.user_invites USING btree (status);


--
-- Name: user_invites_token_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX user_invites_token_idx ON public.user_invites USING btree (token);


--
-- Name: profiles trigger_auto_assign_admin; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_auto_assign_admin AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.auto_assign_admin_role();


--
-- Name: companies trigger_create_company_defaults; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_create_company_defaults AFTER INSERT ON public.companies FOR EACH ROW EXECUTE FUNCTION public.create_company_defaults();


--
-- Name: companies update_companies_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: company_financial_settings update_company_financial_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_company_financial_settings_updated_at BEFORE UPDATE ON public.company_financial_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: company_settings update_company_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_company_settings_updated_at BEFORE UPDATE ON public.company_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: financial_entries update_financial_entries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_financial_entries_updated_at BEFORE UPDATE ON public.financial_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: productions update_productions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_productions_updated_at BEFORE UPDATE ON public.productions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: receivables update_receivables_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_receivables_updated_at BEFORE UPDATE ON public.receivables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: user_company_roles update_user_company_roles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_company_roles_updated_at BEFORE UPDATE ON public.user_company_roles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: user_invites update_user_invites_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_invites_updated_at BEFORE UPDATE ON public.user_invites FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: audit_logs audit_logs_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: company_financial_settings company_financial_settings_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_financial_settings
    ADD CONSTRAINT company_financial_settings_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: company_settings company_settings_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_settings
    ADD CONSTRAINT company_settings_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: financial_entries financial_entries_cancelled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_entries
    ADD CONSTRAINT financial_entries_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES auth.users(id);


--
-- Name: financial_entries financial_entries_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_entries
    ADD CONSTRAINT financial_entries_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: financial_entries financial_entries_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_entries
    ADD CONSTRAINT financial_entries_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: financial_entries financial_entries_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_entries
    ADD CONSTRAINT financial_entries_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: productions productions_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productions
    ADD CONSTRAINT productions_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: receivables receivables_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receivables
    ADD CONSTRAINT receivables_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: roles roles_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: user_company_roles user_company_roles_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_company_roles
    ADD CONSTRAINT user_company_roles_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: user_company_roles user_company_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_company_roles
    ADD CONSTRAINT user_company_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_company_roles user_company_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_company_roles
    ADD CONSTRAINT user_company_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_company_roles user_company_roles_user_id_fkey_profiles; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_company_roles
    ADD CONSTRAINT user_company_roles_user_id_fkey_profiles FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_invites user_invites_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_invites
    ADD CONSTRAINT user_invites_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: user_invites user_invites_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_invites
    ADD CONSTRAINT user_invites_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id);


--
-- Name: user_invites user_invites_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_invites
    ADD CONSTRAINT user_invites_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: financial_entries Admins and Gestors can insert entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and Gestors can insert entries" ON public.financial_entries FOR INSERT WITH CHECK (((company_id IN ( SELECT public.get_user_companies(auth.uid()) AS get_user_companies)) AND (public.has_role_in_company(auth.uid(), company_id, 'Admin'::text) OR public.has_role_in_company(auth.uid(), company_id, 'Gestor'::text))));


--
-- Name: productions Admins and Gestors can insert productions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and Gestors can insert productions" ON public.productions FOR INSERT WITH CHECK (((company_id IN ( SELECT public.get_user_companies(auth.uid()) AS get_user_companies)) AND (public.has_role_in_company(auth.uid(), company_id, 'Admin'::text) OR public.has_role_in_company(auth.uid(), company_id, 'Gestor'::text))));


--
-- Name: receivables Admins and Gestors can insert receivables; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and Gestors can insert receivables" ON public.receivables FOR INSERT WITH CHECK (((company_id IN ( SELECT public.get_user_companies(auth.uid()) AS get_user_companies)) AND (public.has_role_in_company(auth.uid(), company_id, 'Admin'::text) OR public.has_role_in_company(auth.uid(), company_id, 'Gestor'::text))));


--
-- Name: financial_entries Admins and Gestors can update entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and Gestors can update entries" ON public.financial_entries FOR UPDATE USING (((company_id IN ( SELECT public.get_user_companies(auth.uid()) AS get_user_companies)) AND (public.has_role_in_company(auth.uid(), company_id, 'Admin'::text) OR public.has_role_in_company(auth.uid(), company_id, 'Gestor'::text))));


--
-- Name: productions Admins and Gestors can update productions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and Gestors can update productions" ON public.productions FOR UPDATE USING (((company_id IN ( SELECT public.get_user_companies(auth.uid()) AS get_user_companies)) AND (public.has_role_in_company(auth.uid(), company_id, 'Admin'::text) OR public.has_role_in_company(auth.uid(), company_id, 'Gestor'::text))));


--
-- Name: receivables Admins and Gestors can update receivables; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and Gestors can update receivables" ON public.receivables FOR UPDATE USING (((company_id IN ( SELECT public.get_user_companies(auth.uid()) AS get_user_companies)) AND (public.has_role_in_company(auth.uid(), company_id, 'Admin'::text) OR public.has_role_in_company(auth.uid(), company_id, 'Gestor'::text))));


--
-- Name: companies Admins can delete companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete companies" ON public.companies FOR DELETE TO authenticated USING (public.has_role_in_company(auth.uid(), id, 'Admin'::text));


--
-- Name: company_settings Admins can insert settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert settings" ON public.company_settings FOR INSERT WITH CHECK ((public.has_role_in_company(auth.uid(), company_id, 'Admin'::text) OR (company_id IN ( SELECT public.get_user_companies(auth.uid()) AS get_user_companies))));


--
-- Name: user_invites Admins can manage invites for their companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage invites for their companies" ON public.user_invites TO authenticated USING (public.has_role_in_company(auth.uid(), company_id, 'Admin'::text)) WITH CHECK (public.has_role_in_company(auth.uid(), company_id, 'Admin'::text));


--
-- Name: role_permissions Admins can manage role permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage role permissions" ON public.role_permissions USING ((role_id IN ( SELECT r.id
   FROM public.roles r
  WHERE public.has_role_in_company(auth.uid(), r.company_id, 'Admin'::text))));


--
-- Name: roles Admins can manage roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage roles" ON public.roles USING (public.has_role_in_company(auth.uid(), company_id, 'Admin'::text));


--
-- Name: company_financial_settings Admins can manage settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage settings" ON public.company_financial_settings USING (public.has_role_in_company(auth.uid(), company_id, 'Admin'::text));


--
-- Name: user_company_roles Admins can manage user company roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage user company roles" ON public.user_company_roles USING (public.has_role_in_company(auth.uid(), company_id, 'Admin'::text));


--
-- Name: companies Admins can update companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update companies" ON public.companies FOR UPDATE USING (public.has_role_in_company(auth.uid(), id, 'Admin'::text));


--
-- Name: company_settings Admins can update settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update settings" ON public.company_settings FOR UPDATE USING (public.has_role_in_company(auth.uid(), company_id, 'Admin'::text));


--
-- Name: profiles Admins can view all profiles in company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all profiles in company" ON public.profiles FOR SELECT USING (((auth.uid() = id) OR (EXISTS ( SELECT 1
   FROM (public.user_company_roles ucr1
     JOIN public.user_company_roles ucr2 ON ((ucr1.company_id = ucr2.company_id)))
  WHERE ((ucr1.user_id = auth.uid()) AND (ucr2.user_id = profiles.id) AND public.has_role_in_company(auth.uid(), ucr1.company_id, 'Admin'::text))))));


--
-- Name: audit_logs Admins can view audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT USING (((company_id IN ( SELECT public.get_user_companies(auth.uid()) AS get_user_companies)) AND (public.has_role_in_company(auth.uid(), company_id, 'Admin'::text) OR (user_id = auth.uid()))));


--
-- Name: companies Authenticated users can create companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create companies" ON public.companies FOR INSERT TO authenticated WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: audit_logs Authenticated users can insert audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: permissions Authenticated users can view permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view permissions" ON public.permissions FOR SELECT TO authenticated USING (true);


--
-- Name: financial_entries No direct deletion allowed; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct deletion allowed" ON public.financial_entries FOR DELETE USING (false);


--
-- Name: productions No direct deletion of productions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct deletion of productions" ON public.productions FOR DELETE USING (false);


--
-- Name: receivables No direct deletion of receivables; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct deletion of receivables" ON public.receivables FOR DELETE USING (false);


--
-- Name: profiles System can insert profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can insert profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: financial_entries Users can view entries from their company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view entries from their company" ON public.financial_entries FOR SELECT USING ((company_id IN ( SELECT public.get_user_companies(auth.uid()) AS get_user_companies)));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: productions Users can view productions from their company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view productions from their company" ON public.productions FOR SELECT USING ((company_id IN ( SELECT public.get_user_companies(auth.uid()) AS get_user_companies)));


--
-- Name: receivables Users can view receivables from their company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view receivables from their company" ON public.receivables FOR SELECT USING ((company_id IN ( SELECT public.get_user_companies(auth.uid()) AS get_user_companies)));


--
-- Name: role_permissions Users can view role permissions in their companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view role permissions in their companies" ON public.role_permissions FOR SELECT USING ((role_id IN ( SELECT roles.id
   FROM public.roles
  WHERE (roles.company_id IN ( SELECT public.get_user_companies(auth.uid()) AS get_user_companies)))));


--
-- Name: roles Users can view roles in their companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view roles in their companies" ON public.roles FOR SELECT USING ((company_id IN ( SELECT public.get_user_companies(auth.uid()) AS get_user_companies)));


--
-- Name: company_financial_settings Users can view settings from their company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view settings from their company" ON public.company_financial_settings FOR SELECT USING ((company_id IN ( SELECT public.get_user_companies(auth.uid()) AS get_user_companies)));


--
-- Name: company_settings Users can view settings of their companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view settings of their companies" ON public.company_settings FOR SELECT USING ((company_id IN ( SELECT public.get_user_companies(auth.uid()) AS get_user_companies)));


--
-- Name: companies Users can view their companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their companies" ON public.companies FOR SELECT USING ((id IN ( SELECT public.get_user_companies(auth.uid()) AS get_user_companies)));


--
-- Name: user_company_roles Users can view their company roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their company roles" ON public.user_company_roles FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.user_belongs_to_company(auth.uid(), company_id)));


--
-- Name: user_invites Users can view their own invites by email; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own invites by email" ON public.user_invites FOR SELECT TO authenticated USING ((email = ( SELECT p.email
   FROM public.profiles p
  WHERE (p.id = auth.uid()))));


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: companies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

--
-- Name: company_financial_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_financial_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: company_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: financial_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: productions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.productions ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: receivables; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;

--
-- Name: role_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_company_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_company_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_invites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_invites ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;
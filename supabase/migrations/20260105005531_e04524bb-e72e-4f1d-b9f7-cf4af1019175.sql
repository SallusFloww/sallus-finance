-- ============================================================
-- MIGRAÇÃO IDEMPOTENTE: Roles de sistema + permissões vinculadas
-- Funciona para TODAS as companies existentes, sem IDs fixos
-- ============================================================

-- 1) GARANTIR PERMISSÕES BASE (idempotente via ON CONFLICT)
INSERT INTO public.permissions (code, name, module, description)
VALUES
  ('VIEW_DASHBOARD', 'Visualizar Dashboard', 'dashboard', 'Acesso ao dashboard principal'),
  ('VIEW_TRANSACTIONS', 'Visualizar Transações', 'transactions', 'Listar movimentações financeiras'),
  ('CREATE_TRANSACTIONS', 'Criar Transações', 'transactions', 'Adicionar novas movimentações'),
  ('EDIT_TRANSACTIONS', 'Editar Transações', 'transactions', 'Modificar movimentações existentes'),
  ('DELETE_TRANSACTIONS', 'Excluir Transações', 'transactions', 'Cancelar/excluir movimentações'),
  ('VIEW_REPORTS', 'Visualizar Relatórios', 'reports', 'Acessar relatórios gerenciais'),
  ('EXPORT_REPORTS', 'Exportar Relatórios', 'reports', 'Baixar relatórios em Excel/PDF'),
  ('VIEW_DRE', 'Visualizar DRE', 'dre', 'Acessar demonstrativo de resultado'),
  ('VIEW_SCORE', 'Visualizar Score', 'score', 'Acessar score de saúde financeira'),
  ('VIEW_TRENDS', 'Visualizar Tendências', 'trends', 'Acessar análise de tendências'),
  ('VIEW_RECEIVABLES', 'Visualizar Recebíveis', 'receivables', 'Listar contas a receber'),
  ('MANAGE_RECEIVABLES', 'Gerenciar Recebíveis', 'receivables', 'Editar/baixar recebíveis'),
  ('VIEW_PRODUCTION', 'Visualizar Produção', 'production', 'Listar registros de produção'),
  ('CREATE_PRODUCTION', 'Criar Produção', 'production', 'Adicionar registros de produção'),
  ('EDIT_PRODUCTION', 'Editar Produção', 'production', 'Modificar registros de produção'),
  ('VIEW_BILLING', 'Visualizar Faturamento', 'billing', 'Acessar módulo de faturamento'),
  ('CREATE_BILLING', 'Criar Faturamento', 'billing', 'Gerar novos faturamentos'),
  ('VIEW_BI', 'Visualizar BI', 'bi', 'Acessar business intelligence'),
  ('VIEW_AUDIT', 'Visualizar Auditoria', 'audit', 'Acessar logs de auditoria'),
  ('VIEW_SETTINGS', 'Visualizar Configurações', 'settings', 'Acessar página de configurações'),
  ('EDIT_SETTINGS', 'Editar Configurações', 'settings', 'Modificar configurações do sistema'),
  ('VIEW_USERS', 'Visualizar Usuários', 'users', 'Listar usuários do sistema'),
  ('CREATE_USERS', 'Criar Usuários', 'users', 'Convidar novos usuários'),
  ('EDIT_USERS', 'Editar Usuários', 'users', 'Modificar permissões de usuários'),
  ('DELETE_USERS', 'Excluir Usuários', 'users', 'Remover/desativar usuários')
ON CONFLICT (code) DO NOTHING;

-- 2) CRIAR ROLES DE SISTEMA PARA CADA COMPANY (idempotente)
-- Admin
INSERT INTO public.roles (name, description, company_id, is_system)
SELECT 'Admin', 'Administrador com acesso total ao sistema', c.id, true
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.roles r WHERE r.name = 'Admin' AND r.company_id = c.id
);

-- Gestor
INSERT INTO public.roles (name, description, company_id, is_system)
SELECT 'Gestor', 'Gestor com acesso amplo exceto configurações críticas', c.id, true
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.roles r WHERE r.name = 'Gestor' AND r.company_id = c.id
);

-- Financeiro
INSERT INTO public.roles (name, description, company_id, is_system)
SELECT 'Financeiro', 'Acesso focado em finanças e relatórios', c.id, true
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.roles r WHERE r.name = 'Financeiro' AND r.company_id = c.id
);

-- Operacional
INSERT INTO public.roles (name, description, company_id, is_system)
SELECT 'Operacional', 'Acesso operacional para lançamentos e produção', c.id, true
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.roles r WHERE r.name = 'Operacional' AND r.company_id = c.id
);

-- Leitura
INSERT INTO public.roles (name, description, company_id, is_system)
SELECT 'Leitura', 'Acesso somente leitura a todas as áreas', c.id, true
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.roles r WHERE r.name = 'Leitura' AND r.company_id = c.id
);

-- 3) VINCULAR PERMISSÕES ÀS ROLES (set-based, idempotente)

-- Admin: TODAS as permissões
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'Admin'
ON CONFLICT DO NOTHING;

-- Gestor: todas EXCETO EDIT_SETTINGS e DELETE_USERS
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'Gestor'
  AND p.code NOT IN ('EDIT_SETTINGS', 'DELETE_USERS')
ON CONFLICT DO NOTHING;

-- Financeiro: permissões específicas de finanças
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'Financeiro'
  AND p.code IN (
    'VIEW_DASHBOARD', 'VIEW_TRANSACTIONS', 'VIEW_REPORTS', 'EXPORT_REPORTS',
    'VIEW_DRE', 'VIEW_SCORE', 'VIEW_TRENDS', 'VIEW_RECEIVABLES', 'VIEW_BILLING', 'VIEW_BI'
  )
ON CONFLICT DO NOTHING;

-- Operacional: permissões de operação
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'Operacional'
  AND p.code IN (
    'VIEW_DASHBOARD', 'VIEW_TRANSACTIONS', 'CREATE_TRANSACTIONS', 'EDIT_TRANSACTIONS',
    'VIEW_PRODUCTION', 'CREATE_PRODUCTION', 'EDIT_PRODUCTION', 'VIEW_BILLING', 'CREATE_BILLING'
  )
ON CONFLICT DO NOTHING;

-- Leitura: todas as permissões VIEW_*
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'Leitura'
  AND p.code LIKE 'VIEW_%'
ON CONFLICT DO NOTHING;
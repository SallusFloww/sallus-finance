-- =====================================================
-- PRÉ GO-LIVE: SETUP DEMO + PERMISSIONS (CORRIGIDO)
-- Escopo: Criar empresa DEMO, popular permissions, vincular admin
-- Data: 2026-01-09
-- =====================================================

-- 1) CRIAR EMPRESA DEMO
-- O trigger create_company_defaults já cria company_settings automaticamente
INSERT INTO companies (name, cnpj, is_demo, status)
VALUES ('Empresa Demonstração', NULL, true, 'active');

-- 2) CRIAR COMPANY_FINANCIAL_SETTINGS PARA DEMO (se não existir)
INSERT INTO company_financial_settings (company_id, initial_balance)
SELECT id, 0 FROM companies WHERE is_demo = true
ON CONFLICT (company_id) DO NOTHING;

-- 3) POPULAR TABELA PERMISSIONS
INSERT INTO permissions (code, name, module, description) VALUES
('VIEW_DASHBOARD', 'Visualizar Dashboard', 'dashboard', 'Acesso à tela principal'),
('VIEW_TRANSACTIONS', 'Visualizar Movimentações', 'transactions', 'Ver lista de movimentações'),
('CREATE_TRANSACTIONS', 'Criar Movimentações', 'transactions', 'Inserir novas movimentações'),
('EDIT_TRANSACTIONS', 'Editar Movimentações', 'transactions', 'Alterar movimentações existentes'),
('CANCEL_TRANSACTIONS', 'Cancelar Movimentações', 'transactions', 'Cancelar movimentações'),
('VIEW_RECEIVABLES', 'Visualizar Recebíveis', 'receivables', 'Ver contas a receber'),
('CREATE_RECEIVABLES', 'Criar Recebíveis', 'receivables', 'Inserir novos recebíveis'),
('EDIT_RECEIVABLES', 'Editar Recebíveis', 'receivables', 'Alterar recebíveis existentes'),
('VIEW_PRODUCTION', 'Visualizar Produção', 'production', 'Ver registros de produção'),
('CREATE_PRODUCTION', 'Criar Produção', 'production', 'Inserir nova produção'),
('EDIT_PRODUCTION', 'Editar Produção', 'production', 'Alterar produção existente'),
('VIEW_BILLING', 'Visualizar Faturamento', 'billing', 'Ver telas de faturamento'),
('CREATE_BILLING', 'Criar Faturamento', 'billing', 'Gerar faturamento'),
('VIEW_REPORTS', 'Visualizar Relatórios', 'reports', 'Acesso a relatórios'),
('EXPORT_REPORTS', 'Exportar Relatórios', 'reports', 'Exportar relatórios PDF/Excel'),
('VIEW_TRENDS', 'Visualizar Tendências', 'executive', 'Ver análise de tendências'),
('VIEW_SCORE', 'Visualizar Score', 'executive', 'Ver score de saúde financeira'),
('VIEW_DRE', 'Visualizar DRE', 'executive', 'Ver demonstrativo de resultado'),
('VIEW_BI', 'Visualizar BI', 'executive', 'Acesso ao Business Intelligence'),
('VIEW_AUDIT', 'Visualizar Auditoria', 'audit', 'Ver logs de auditoria'),
('VIEW_SETTINGS', 'Visualizar Configurações', 'settings', 'Ver configurações'),
('EDIT_SETTINGS', 'Editar Configurações', 'settings', 'Alterar configurações'),
('VIEW_USERS', 'Visualizar Usuários', 'users', 'Ver lista de usuários'),
('MANAGE_USERS', 'Gerenciar Usuários', 'users', 'Criar/editar/desativar usuários');

-- 4) POPULAR ROLE_PERMISSIONS
-- Admin: Todas as permissões
INSERT INTO role_permissions (role_id, permission_id)
SELECT '53cfbec5-a673-4c1d-8488-11183b185213', id FROM permissions;

-- Gestor: Permissões operacionais
INSERT INTO role_permissions (role_id, permission_id)
SELECT '8206e741-e02a-4b34-a68c-9513fca49aa7', id 
FROM permissions 
WHERE code NOT IN ('MANAGE_USERS', 'EDIT_SETTINGS', 'VIEW_AUDIT');

-- Visualizador: Apenas VIEW_*
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'f80b5fa1-4bd4-4a09-aa17-bd957f55f5a0', id 
FROM permissions 
WHERE code LIKE 'VIEW_%';

-- 5) VINCULAR ADMIN À EMPRESA DEMO
INSERT INTO user_company_roles (user_id, company_id, role_id, is_primary, is_active)
SELECT 
  '48e31b0c-31ac-4adc-9275-c6c8ad6ea895',
  c.id,
  '53cfbec5-a673-4c1d-8488-11183b185213',
  false,
  true
FROM companies c WHERE c.is_demo = true;
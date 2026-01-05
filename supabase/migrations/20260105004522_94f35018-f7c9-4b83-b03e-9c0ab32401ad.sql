-- Insert base permissions for the system
INSERT INTO public.permissions (module, code, name, description) VALUES
-- Dashboard
('dashboard', 'VIEW_DASHBOARD', 'Visualizar Dashboard', 'Permite acesso ao dashboard principal'),
-- Transactions
('transactions', 'VIEW_TRANSACTIONS', 'Visualizar Transações', 'Permite visualizar movimentações financeiras'),
('transactions', 'CREATE_TRANSACTIONS', 'Criar Transações', 'Permite criar novas movimentações'),
('transactions', 'EDIT_TRANSACTIONS', 'Editar Transações', 'Permite editar movimentações existentes'),
('transactions', 'DELETE_TRANSACTIONS', 'Excluir Transações', 'Permite excluir movimentações'),
-- Reports
('reports', 'VIEW_REPORTS', 'Visualizar Relatórios', 'Permite acesso aos relatórios'),
('reports', 'EXPORT_REPORTS', 'Exportar Relatórios', 'Permite exportar relatórios'),
-- DRE
('dre', 'VIEW_DRE', 'Visualizar DRE', 'Permite acesso ao DRE'),
-- Score
('score', 'VIEW_SCORE', 'Visualizar Score', 'Permite acesso ao score financeiro'),
-- Trends
('trends', 'VIEW_TRENDS', 'Visualizar Tendências', 'Permite acesso às tendências'),
-- Production
('production', 'VIEW_PRODUCTION', 'Visualizar Produção', 'Permite visualizar produção'),
('production', 'CREATE_PRODUCTION', 'Criar Produção', 'Permite criar produção'),
('production', 'EDIT_PRODUCTION', 'Editar Produção', 'Permite editar produção'),
-- Billing
('billing', 'VIEW_BILLING', 'Visualizar Faturamento', 'Permite visualizar faturamento'),
('billing', 'CREATE_BILLING', 'Criar Faturamento', 'Permite criar faturamento'),
-- Receivables
('receivables', 'VIEW_RECEIVABLES', 'Visualizar Recebíveis', 'Permite visualizar contas a receber'),
('receivables', 'MANAGE_RECEIVABLES', 'Gerenciar Recebíveis', 'Permite gerenciar contas a receber'),
-- BI
('bi', 'VIEW_BI', 'Visualizar BI', 'Permite acesso ao Business Intelligence'),
-- Users
('users', 'VIEW_USERS', 'Visualizar Usuários', 'Permite visualizar lista de usuários'),
('users', 'CREATE_USERS', 'Criar Usuários', 'Permite convidar novos usuários'),
('users', 'EDIT_USERS', 'Editar Usuários', 'Permite editar usuários'),
('users', 'DELETE_USERS', 'Remover Usuários', 'Permite remover usuários'),
-- Settings
('settings', 'VIEW_SETTINGS', 'Visualizar Configurações', 'Permite visualizar configurações'),
('settings', 'EDIT_SETTINGS', 'Editar Configurações', 'Permite editar configurações'),
-- Audit
('audit', 'VIEW_AUDIT', 'Visualizar Auditoria', 'Permite visualizar logs de auditoria')
ON CONFLICT (code) DO NOTHING;
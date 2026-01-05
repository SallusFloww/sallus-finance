-- Create additional system roles for the company and assign all permissions to Admin
DO $$
DECLARE
    admin_role_id uuid := 'b0000000-0000-0000-0000-000000000001';
    company_id uuid := 'a0000000-0000-0000-0000-000000000001';
    gestor_role_id uuid;
    operacional_role_id uuid;
    financeiro_role_id uuid;
    leitura_role_id uuid;
    perm_id uuid;
BEGIN
    -- Create Gestor role if not exists
    INSERT INTO public.roles (company_id, name, description, is_system)
    VALUES (company_id, 'Gestor', 'Gestor com acesso operacional completo', true)
    ON CONFLICT DO NOTHING
    RETURNING id INTO gestor_role_id;
    
    IF gestor_role_id IS NULL THEN
        SELECT id INTO gestor_role_id FROM roles WHERE company_id = company_id AND name = 'Gestor';
    END IF;
    
    -- Create Operacional role if not exists
    INSERT INTO public.roles (company_id, name, description, is_system)
    VALUES (company_id, 'Operacional', 'Acesso às operações diárias', true)
    ON CONFLICT DO NOTHING
    RETURNING id INTO operacional_role_id;
    
    IF operacional_role_id IS NULL THEN
        SELECT id INTO operacional_role_id FROM roles WHERE company_id = company_id AND name = 'Operacional';
    END IF;
    
    -- Create Financeiro role if not exists
    INSERT INTO public.roles (company_id, name, description, is_system)
    VALUES (company_id, 'Financeiro', 'Acesso às funções financeiras e relatórios', true)
    ON CONFLICT DO NOTHING
    RETURNING id INTO financeiro_role_id;
    
    IF financeiro_role_id IS NULL THEN
        SELECT id INTO financeiro_role_id FROM roles WHERE company_id = company_id AND name = 'Financeiro';
    END IF;
    
    -- Create Leitura role if not exists
    INSERT INTO public.roles (company_id, name, description, is_system)
    VALUES (company_id, 'Leitura', 'Acesso apenas para visualização', true)
    ON CONFLICT DO NOTHING
    RETURNING id INTO leitura_role_id;
    
    IF leitura_role_id IS NULL THEN
        SELECT id INTO leitura_role_id FROM roles WHERE company_id = company_id AND name = 'Leitura';
    END IF;
    
    -- Assign ALL permissions to Admin role
    FOR perm_id IN SELECT id FROM permissions LOOP
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES (admin_role_id, perm_id)
        ON CONFLICT DO NOTHING;
    END LOOP;
    
    -- Assign permissions to Gestor (all except settings/users management)
    FOR perm_id IN SELECT id FROM permissions WHERE code NOT IN ('EDIT_SETTINGS', 'DELETE_USERS') LOOP
        IF gestor_role_id IS NOT NULL THEN
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES (gestor_role_id, perm_id)
            ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;
    
    -- Assign permissions to Financeiro (financial and reports)
    FOR perm_id IN SELECT id FROM permissions WHERE code IN (
        'VIEW_DASHBOARD', 'VIEW_TRANSACTIONS', 'VIEW_REPORTS', 'EXPORT_REPORTS',
        'VIEW_DRE', 'VIEW_SCORE', 'VIEW_TRENDS', 'VIEW_RECEIVABLES', 'VIEW_BILLING', 'VIEW_BI'
    ) LOOP
        IF financeiro_role_id IS NOT NULL THEN
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES (financeiro_role_id, perm_id)
            ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;
    
    -- Assign permissions to Operacional (operations)
    FOR perm_id IN SELECT id FROM permissions WHERE code IN (
        'VIEW_DASHBOARD', 'VIEW_TRANSACTIONS', 'CREATE_TRANSACTIONS', 'EDIT_TRANSACTIONS',
        'VIEW_PRODUCTION', 'CREATE_PRODUCTION', 'EDIT_PRODUCTION', 'VIEW_BILLING', 'CREATE_BILLING'
    ) LOOP
        IF operacional_role_id IS NOT NULL THEN
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES (operacional_role_id, perm_id)
            ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;
    
    -- Assign permissions to Leitura (view only)
    FOR perm_id IN SELECT id FROM permissions WHERE code LIKE 'VIEW_%' LOOP
        IF leitura_role_id IS NOT NULL THEN
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES (leitura_role_id, perm_id)
            ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;
END $$;
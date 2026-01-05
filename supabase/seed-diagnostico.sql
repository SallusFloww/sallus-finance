-- ============================================================
-- SCRIPT DE DIAGNÓSTICO: Integridade do Sistema de Permissões
-- Apenas SELECTs, não altera dados
-- ============================================================

-- 1) TOTAL DE COMPANIES
SELECT '1. COMPANIES' as secao, count(*) as total FROM companies;

-- 2) LISTA DE COMPANIES
SELECT '2. LISTA COMPANIES' as secao, id, name, status, created_at FROM companies ORDER BY created_at;

-- 3) TOTAL DE PERMISSÕES BASE
SELECT '3. PERMISSIONS' as secao, count(*) as total FROM permissions;

-- 4) LISTA DE PERMISSÕES
SELECT '4. LISTA PERMISSIONS' as secao, code, name, module FROM permissions ORDER BY module, code;

-- 5) ROLES POR COMPANY (verifica se todas companies têm os 5 roles)
SELECT 
  '5. ROLES POR COMPANY' as secao,
  c.name as company_name,
  r.name as role_name,
  r.is_system,
  r.id as role_id
FROM companies c
LEFT JOIN roles r ON r.company_id = c.id
ORDER BY c.name, r.name;

-- 6) CONTAGEM DE PERMISSÕES POR ROLE (visão consolidada)
SELECT 
  '6. PERMISSÕES POR ROLE' as secao,
  c.name as company_name,
  r.name as role_name,
  COUNT(rp.id) as qtd_permissoes
FROM roles r
JOIN companies c ON r.company_id = c.id
LEFT JOIN role_permissions rp ON rp.role_id = r.id
GROUP BY c.name, r.name
ORDER BY c.name, r.name;

-- 7) ROLES SEM COMPANY (possível erro)
SELECT 
  '7. ROLES ÓRFÃS (sem company)' as secao,
  r.id, r.name, r.company_id
FROM roles r
WHERE r.company_id IS NULL;

-- 8) ROLES DUPLICADAS (mesmo nome na mesma company)
SELECT 
  '8. ROLES DUPLICADAS' as secao,
  r.company_id,
  r.name,
  COUNT(*) as qtd
FROM roles r
GROUP BY r.company_id, r.name
HAVING COUNT(*) > 1;

-- 9) COMPANIES SEM NENHUMA ROLE
SELECT 
  '9. COMPANIES SEM ROLES' as secao,
  c.id, c.name
FROM companies c
LEFT JOIN roles r ON r.company_id = c.id
WHERE r.id IS NULL;

-- 10) PERMISSÕES ESPERADAS VS REAIS POR ROLE
SELECT 
  '10. VALIDAÇÃO FINAL' as secao,
  r.name as role_name,
  c.name as company_name,
  COUNT(rp.id) as permissoes_vinculadas,
  CASE 
    WHEN r.name = 'Admin' THEN 25
    WHEN r.name = 'Gestor' THEN 23
    WHEN r.name = 'Leitura' THEN 13
    WHEN r.name = 'Financeiro' THEN 10
    WHEN r.name = 'Operacional' THEN 9
    ELSE 0
  END as esperado,
  CASE 
    WHEN COUNT(rp.id) = CASE 
      WHEN r.name = 'Admin' THEN 25
      WHEN r.name = 'Gestor' THEN 23
      WHEN r.name = 'Leitura' THEN 13
      WHEN r.name = 'Financeiro' THEN 10
      WHEN r.name = 'Operacional' THEN 9
      ELSE 0
    END THEN '✅ OK'
    ELSE '❌ ERRO'
  END as status
FROM roles r
JOIN companies c ON r.company_id = c.id
LEFT JOIN role_permissions rp ON rp.role_id = r.id
GROUP BY r.id, r.name, c.name
ORDER BY c.name, r.name;

-- 11) USUÁRIOS E SEUS VÍNCULOS
SELECT 
  '11. USUÁRIOS VINCULADOS' as secao,
  p.email,
  p.full_name,
  c.name as company_name,
  r.name as role_name,
  ucr.is_active,
  ucr.is_primary
FROM profiles p
JOIN user_company_roles ucr ON ucr.user_id = p.id
JOIN companies c ON c.id = ucr.company_id
JOIN roles r ON r.id = ucr.role_id
ORDER BY c.name, p.email;

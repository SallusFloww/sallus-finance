-- Criar empresa Imec Saúde LTDA
INSERT INTO companies (id, name, status)
VALUES (
  gen_random_uuid(),
  'Imec Saúde LTDA',
  'active'
)
RETURNING id;

-- Nota: O usuário sallusflow@hotmail.com precisará:
-- 1. Criar conta pelo fluxo de autenticação do app
-- 2. Após criar conta, será vinculado como Admin desta empresa
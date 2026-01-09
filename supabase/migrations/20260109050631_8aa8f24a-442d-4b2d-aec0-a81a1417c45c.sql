-- Vincular usuário como Admin da Imec Saúde LTDA
INSERT INTO user_company_roles (
  user_id,
  company_id,
  role_id,
  is_primary,
  is_active
)
VALUES (
  '48e31b0c-31ac-4adc-9275-c6c8ad6ea895', -- sallusflow@hotmail.com
  '4b016966-0302-4784-b0ba-adf60e2f7e4a', -- Imec Saúde LTDA
  '53cfbec5-a673-4c1d-8488-11183b185213', -- Admin role
  true,
  true
);

-- Atualizar nome do perfil
UPDATE profiles 
SET full_name = 'Administrador Premium'
WHERE id = '48e31b0c-31ac-4adc-9275-c6c8ad6ea895';
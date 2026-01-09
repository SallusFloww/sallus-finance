-- Adicionar coluna is_demo na tabela companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
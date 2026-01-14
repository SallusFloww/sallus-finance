-- Adicionar campos para extended settings na tabela company_financial_settings
ALTER TABLE public.company_financial_settings
ADD COLUMN IF NOT EXISTS production_types jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS exam_types jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS payers jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS system_parameters jsonb DEFAULT NULL;
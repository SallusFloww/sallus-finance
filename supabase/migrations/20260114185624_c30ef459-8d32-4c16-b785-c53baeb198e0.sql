-- Adicionar coluna specialties para persistir especialidades como cadastro mestre
ALTER TABLE public.company_financial_settings 
ADD COLUMN IF NOT EXISTS specialties jsonb DEFAULT '[]'::jsonb;
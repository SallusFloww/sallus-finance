-- Adicionar colunas de pacote para persistir dados de Pacote Box/GTA
ALTER TABLE public.productions
ADD COLUMN IF NOT EXISTS is_package boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS package_type text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS package_qty numeric DEFAULT 1,
ADD COLUMN IF NOT EXISTS consult_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS fee_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS matmed_amount numeric DEFAULT 0;

-- Comentários para documentação
COMMENT ON COLUMN public.productions.is_package IS 'Indica se é um registro de pacote (Box/GTA)';
COMMENT ON COLUMN public.productions.package_type IS 'Tipo do pacote: PACOTE_BOX ou PACOTE_GTA';
COMMENT ON COLUMN public.productions.package_qty IS 'Quantidade de pacotes (usado para agregação)';
COMMENT ON COLUMN public.productions.consult_amount IS 'Valor total de consultas (package_qty * valor_unitario_consulta)';
COMMENT ON COLUMN public.productions.fee_amount IS 'Valor total de taxas/box (package_qty * valor_unitario_taxa)';
COMMENT ON COLUMN public.productions.matmed_amount IS 'Valor total de mat/med (total - consult - fee)';
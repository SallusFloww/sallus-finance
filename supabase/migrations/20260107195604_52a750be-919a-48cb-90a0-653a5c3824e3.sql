-- Adicionar coluna payment_method na tabela productions para produções PARTICULAR
-- Esta coluna armazena a forma de pagamento quando payerType = 'PARTICULAR'

ALTER TABLE public.productions 
ADD COLUMN IF NOT EXISTS payment_method text NULL;

-- Adicionar comentário descritivo
COMMENT ON COLUMN public.productions.payment_method IS 'Forma de pagamento para produções PARTICULAR (DINHEIRO, PIX, CARTAO_DEBITO, CREDITO_VISTA, CREDITO_PARCELADO)';
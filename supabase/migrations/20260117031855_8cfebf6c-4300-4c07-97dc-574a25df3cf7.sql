-- Adicionar coluna payment_method à tabela productions para suportar modo de pagamento (PARTICULAR)
ALTER TABLE public.productions ADD COLUMN IF NOT EXISTS payment_method text NULL;

-- Comentário para documentação
COMMENT ON COLUMN public.productions.payment_method IS 'Modo de pagamento quando payer_type=PARTICULAR: PIX, DINHEIRO, CARTAO, TRANSFERENCIA, BOLETO, OUTRO';
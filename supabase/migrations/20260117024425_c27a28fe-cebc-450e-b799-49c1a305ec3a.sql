-- Adiciona coluna import_hash para detecção de lotes duplicados
ALTER TABLE public.production_import_batches 
ADD COLUMN IF NOT EXISTS import_hash TEXT NULL;

-- Índice único para bloquear duplicados (null é permitido)
CREATE UNIQUE INDEX IF NOT EXISTS idx_production_import_batches_hash 
ON public.production_import_batches (import_hash) 
WHERE import_hash IS NOT NULL;
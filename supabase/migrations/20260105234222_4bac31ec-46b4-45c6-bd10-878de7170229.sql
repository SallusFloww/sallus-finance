-- ============================================
-- Ensure UNIQUE constraint on conciliation_status
-- ============================================
-- Check if constraint exists, if not create it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'conciliation_status_unique_item'
  ) THEN
    ALTER TABLE public.conciliation_status 
    ADD CONSTRAINT conciliation_status_unique_item 
    UNIQUE (company_id, item_type, item_id);
  END IF;
END $$;

-- ============================================
-- Create optimized indexes for conciliation_status
-- ============================================
CREATE INDEX IF NOT EXISTS idx_conciliation_status_company_status 
ON public.conciliation_status (company_id, status);

CREATE INDEX IF NOT EXISTS idx_conciliation_status_company_updated 
ON public.conciliation_status (company_id, updated_at DESC);

-- ============================================
-- Create optimized indexes for conciliation_notes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_conciliation_notes_company_item 
ON public.conciliation_notes (company_id, item_id);

CREATE INDEX IF NOT EXISTS idx_conciliation_notes_company_created 
ON public.conciliation_notes (company_id, created_at DESC);
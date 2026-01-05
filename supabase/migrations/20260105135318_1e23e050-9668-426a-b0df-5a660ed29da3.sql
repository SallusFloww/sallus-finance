-- Add specialty column to financial_entries for Centro Clínico and Oncologia breakdown
ALTER TABLE public.financial_entries
ADD COLUMN IF NOT EXISTS specialty text;

-- Add comment explaining the column purpose
COMMENT ON COLUMN public.financial_entries.specialty IS 'Medical specialty for Centro Clínico and Oncologia units (e.g., CARDIOLOGIA, OFTALMOLOGIA)';

-- Create index for efficient querying by company, unit, and specialty
CREATE INDEX IF NOT EXISTS idx_financial_entries_company_unit_specialty
ON public.financial_entries (company_id, unit_id, specialty);
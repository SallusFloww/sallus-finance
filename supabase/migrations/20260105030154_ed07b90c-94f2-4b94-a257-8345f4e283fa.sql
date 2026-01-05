-- Create function to update timestamps if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create table to persist unit allocations for shared expenses
CREATE TABLE public.movement_allocations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  movement_id UUID NOT NULL REFERENCES public.financial_entries(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL,
  unit_name TEXT NOT NULL,
  allocation_percent NUMERIC NOT NULL DEFAULT 0,
  allocation_amount NUMERIC NOT NULL DEFAULT 0,
  criterion TEXT NOT NULL,
  criterion_value NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.movement_allocations ENABLE ROW LEVEL SECURITY;

-- Policies for movement_allocations
CREATE POLICY "Users can view allocations from their company"
ON public.movement_allocations
FOR SELECT
USING (company_id IN (SELECT get_user_companies(auth.uid())));

CREATE POLICY "Admins and Gestors can insert allocations"
ON public.movement_allocations
FOR INSERT
WITH CHECK (
  company_id IN (SELECT get_user_companies(auth.uid()))
  AND (
    has_role_in_company(auth.uid(), company_id, 'Admin')
    OR has_role_in_company(auth.uid(), company_id, 'Gestor')
  )
);

CREATE POLICY "Admins and Gestors can update allocations"
ON public.movement_allocations
FOR UPDATE
USING (
  company_id IN (SELECT get_user_companies(auth.uid()))
  AND (
    has_role_in_company(auth.uid(), company_id, 'Admin')
    OR has_role_in_company(auth.uid(), company_id, 'Gestor')
  )
);

CREATE POLICY "Admins and Gestors can delete allocations"
ON public.movement_allocations
FOR DELETE
USING (
  company_id IN (SELECT get_user_companies(auth.uid()))
  AND (
    has_role_in_company(auth.uid(), company_id, 'Admin')
    OR has_role_in_company(auth.uid(), company_id, 'Gestor')
  )
);

-- Create indexes for performance
CREATE INDEX idx_movement_allocations_company ON public.movement_allocations(company_id);
CREATE INDEX idx_movement_allocations_movement ON public.movement_allocations(movement_id);
CREATE INDEX idx_movement_allocations_unit ON public.movement_allocations(unit_id);

-- Add trigger for updated_at
CREATE TRIGGER update_movement_allocations_updated_at
BEFORE UPDATE ON public.movement_allocations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
-- Create package_pricing_rules table for storing consultation and fee defaults per plan/package type
CREATE TABLE public.package_pricing_rules (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL,
    package_type TEXT NOT NULL CHECK (package_type IN ('PACOTE_BOX', 'PACOTE_GTA')),
    consult_default_amount NUMERIC NOT NULL DEFAULT 0,
    fee_default_amount NUMERIC NOT NULL DEFAULT 0,
    effective_from DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID
);

-- Enable Row Level Security
ALTER TABLE public.package_pricing_rules ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view package pricing rules for their companies"
ON public.package_pricing_rules
FOR SELECT
USING (company_id IN (SELECT get_user_companies(auth.uid())));

CREATE POLICY "Admins and Gestors can insert package pricing rules"
ON public.package_pricing_rules
FOR INSERT
WITH CHECK (
    company_id IN (SELECT get_user_companies(auth.uid()))
    AND (
        has_role_in_company(auth.uid(), company_id, 'Admin')
        OR has_role_in_company(auth.uid(), company_id, 'Gestor')
    )
);

CREATE POLICY "Admins and Gestors can update package pricing rules"
ON public.package_pricing_rules
FOR UPDATE
USING (
    company_id IN (SELECT get_user_companies(auth.uid()))
    AND (
        has_role_in_company(auth.uid(), company_id, 'Admin')
        OR has_role_in_company(auth.uid(), company_id, 'Gestor')
    )
);

-- Create index for efficient lookups
CREATE INDEX idx_package_pricing_rules_company_plan 
ON public.package_pricing_rules(company_id, plan_id, package_type, effective_from DESC)
WHERE is_active = true;
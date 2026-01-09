-- Copiar categorias da empresa real para a empresa DEMO
UPDATE company_financial_settings
SET 
  categories = (
    SELECT categories 
    FROM company_financial_settings cfs
    JOIN companies c ON cfs.company_id = c.id
    WHERE c.is_demo = false AND c.status = 'active'
    LIMIT 1
  ),
  units = (
    SELECT units 
    FROM company_financial_settings cfs
    JOIN companies c ON cfs.company_id = c.id
    WHERE c.is_demo = false AND c.status = 'active'
    LIMIT 1
  ),
  payment_methods = (
    SELECT payment_methods 
    FROM company_financial_settings cfs
    JOIN companies c ON cfs.company_id = c.id
    WHERE c.is_demo = false AND c.status = 'active'
    LIMIT 1
  )
WHERE company_id IN (SELECT id FROM companies WHERE is_demo = true);
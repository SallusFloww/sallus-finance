

## Plano: Limpeza total de dados de teste (todas as empresas)

### O que será limpo

Tabelas transacionais na ordem correta (respeitando dependências):

1. `conciliation_notes` — notas de conciliação
2. `conciliation_status` — status de conciliação
3. `productions` — produções
4. `financial_entries` — lançamentos financeiros
5. `receivables` — recebíveis

Tabelas que **não** serão tocadas: `companies`, `profiles`, `roles`, `user_company_roles`, `company_settings`, `company_financial_settings`, `doctors`, `health_plans`, `permissions`, `role_permissions`, `user_invites`, `package_pricing_rules`.

### Como será executado

Um script SQL direto via `psql` (usando service role, sem restrição de RLS):

```sql
DELETE FROM conciliation_notes;
DELETE FROM conciliation_status;
DELETE FROM productions;
DELETE FROM financial_entries;
DELETE FROM receivables;
DELETE FROM production_import_batches;
```

Também resetar saldo inicial de todas as empresas:

```sql
UPDATE company_financial_settings 
SET initial_balance = 0, initial_balance_adjustments = '[]'::jsonb;
```

### Segurança

- Estrutura do banco (tabelas, colunas, RLS, funções) permanece intacta
- Configurações da empresa (categorias, unidades, tipos de produção) preservadas
- Usuários, perfis e permissões preservados
- Apenas dados transacionais são removidos

### Resultado

Todas as tabelas de lançamentos voltam a zero. O sistema continua funcionando normalmente, pronto para novos dados reais.


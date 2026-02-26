

# Plano: Corrigir Build Errors + Fase 1 da Revisao Estrutural

## Contexto dos Erros Atuais

A tabela `productions` no banco de dados:
- **TEM** `health_plan_id` (NOT NULL, obrigatorio)
- **NAO TEM** coluna `convenio`

O codigo TypeScript:
- Envia `convenio` (coluna inexistente)
- Nao envia `health_plan_id` (obrigatorio)

Isso causa todos os build errors atuais.

## Fase 1: Corrigir Build Errors (Imediato)

### 1.1 Migracao SQL: Tornar `health_plan_id` nullable

A coluna `health_plan_id` e obrigatoria no DB mas producoes manuais de tipo PARTICULAR nao tem convenioplano de saude. Precisamos:

```sql
ALTER TABLE productions ALTER COLUMN health_plan_id DROP NOT NULL;
ALTER TABLE productions ALTER COLUMN health_plan_id SET DEFAULT NULL;
```

Isso vai regenerar o `types.ts` automaticamente, tornando `health_plan_id` opcional no Insert type.

### 1.2 Corrigir `useProductionDB.ts`

- Na interface `DBProduction` (linha 32): remover `convenio` e adicionar `health_plan_id`
- No `addProduction`: adicionar `health_plan_id: null` ao insertPayload (para producoes manuais sem convenioplano)
- No `toProduction`: mapear `health_plan_id` se necessario
- Nos casts `as DBProduction`: garantir compatibilidade

### 1.3 Corrigir `ProductionForm.tsx`

- Na bulk insert (linha 1147-1181): substituir `convenio` por `health_plan_id`
- Quando `payerType === "CONVENIO"`, buscar o `health_plan_id` correspondente ao nome do convenio na tabela `health_plans`
- Quando `payerType === "PARTICULAR"`, enviar `health_plan_id: null`

### 1.4 Corrigir `ProductionImportModal.tsx`

- Na query de duplicidade (linha 483): remover `convenio` do select, usar `health_plan_id` ou outra coluna existente
- Ajustar chaves de comparacao que referenciam `convenio`

## Fase 2: Sobre a Revisao Estrutural Completa

A revisao completa pedida (tabelas `business_units`, `specialties`, FKs, migracao de dados) e um projeto de grande porte que requer:

1. Criacao de tabelas relacionais
2. Migracao de dados existentes (TEXT para UUID FK)
3. Atualizacao de 20+ arquivos (hooks, forms, reports, BI, dashboards)
4. Periodo de compatibilidade dupla (TEXT + FK)

**Recomendacao**: Implementar a Fase 1 primeiro para restaurar o build funcional, validar, e depois planejar a Fase 2 em um segundo momento dedicado.

## Arquivos Modificados

| Arquivo | Alteracao |
|---------|-----------|
| Migracao SQL | `health_plan_id` DROP NOT NULL |
| `src/hooks/useProductionDB.ts` | DBProduction sem `convenio`, com `health_plan_id`; insertPayload com `health_plan_id` |
| `src/components/production/ProductionForm.tsx` | Bulk insert com `health_plan_id` em vez de `convenio` |
| `src/components/production/ProductionImportModal.tsx` | Query sem `convenio`, usar `health_plan_id` |

## Risco

**Baixo**. As alteracoes alinham o codigo com o schema real do banco. Nenhum dado e perdido. A logica de negocio permanece a mesma.


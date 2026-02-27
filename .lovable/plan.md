
# Excluir Producoes Canceladas do Relatorio de Producao

## Problema

A funcao `filterProductions` em `useProductionDB.ts` nao exclui producoes com status `CANCELADO`. Como o `ProductionReport.tsx` depende dessa funcao para obter os dados, producoes canceladas aparecem em todos os calculos: totais, rankings, consolidado por componentes, mix assistencial, etc.

## Solucao

Adicionar exclusao automatica de producoes canceladas no `filterProductions`, a menos que o filtro explicitamente peca por esse status.

### Arquivo: `src/hooks/useProductionDB.ts`

Na funcao `filterProductions` (linha ~605), adicionar logo no inicio do filtro:

```typescript
// Excluir cancelados por padrao, a menos que filtro explicito por CANCELADO
if (p.status === "CANCELADO" && filters.status !== "CANCELADO") return false;
```

Isso garante que:
- Relatorio de Producao nao inclui cancelados
- BI, rankings e consolidado ficam corretos
- A lista de producao na pagina `/production` ainda pode mostrar cancelados quando o filtro de status for "CANCELADO" ou "Todos status" (esse ultimo precisara de ajuste separado se necessario)
- Nenhum outro modulo e impactado (DRE, Aging, Faturamento nao usam essa funcao)

### Arquivo: `src/pages/ProductionReport.tsx`

Nenhuma alteracao necessaria. O relatorio ja usa `filterProductions`, que passara a excluir cancelados automaticamente.

## Consideracao sobre a pagina /production

A pagina de listagem de producao (`/production`) tambem usa `filterProductions`. Producoes canceladas continuarao visiveis quando o usuario selecionar status "Todos" na pagina de producao, pois o filtro `status` nao e passado nesse caso. Porem, com a mudanca proposta, "Todos" passara a excluir cancelados tambem.

Se for desejavel que a pagina `/production` ainda mostre cancelados em "Todos status", uma opcao e adicionar um parametro `includeCancelled` ao filtro. Mas com base no pedido atual, a prioridade e excluir cancelados do relatorio.

**Abordagem escolhida**: Adicionar `includeCancelled?: boolean` ao `ProductionFilters` para manter flexibilidade. A pagina `/production` passara `includeCancelled: true` e o relatorio nao.

### Alteracoes detalhadas:

1. **`src/hooks/useProductionDB.ts`**:
   - Adicionar `includeCancelled?: boolean` na interface `ProductionFilters`
   - Na funcao `filterProductions`: excluir `CANCELADO` quando `includeCancelled` nao for `true`

2. **`src/pages/Production.tsx`** (se necessario):
   - Passar `includeCancelled: true` no filtro para manter comportamento atual da listagem

## Risco

**Minimo**. Apenas adiciona uma condicao de filtro. Nenhum dado e alterado no banco.

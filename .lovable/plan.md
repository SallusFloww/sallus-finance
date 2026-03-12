
# Corrigir Card "Convenio Principal" Mostrando UUID

## Problema

O campo `p.convenio` contem o UUID do `health_plan_id` (ex: `3bbf237b-9901-4164-bde3-70f75a6be3a9`), pois no `useProductionDB.ts` linha 112 ele e mapeado assim:

```
convenio: db.health_plan_id || undefined
```

A funcao `formatConvenioDisplayName` apenas aplica title case, nao resolve UUIDs para nomes. Isso afeta:
- Card "Convenio Principal" nos KPIs
- Ranking por Convenio
- Insights e alertas de concentracao
- Leitura executiva

## Solucao

Buscar a tabela `health_plans` no `ProductionReport.tsx` e criar um mapa UUID->nome para resolver os nomes antes de exibir.

### Arquivo: `src/pages/ProductionReport.tsx`

**1. Adicionar state e fetch para health plans**

Apos os hooks existentes (useProductionDB, usePackagePricing), adicionar:

```typescript
const [healthPlanMap, setHealthPlanMap] = useState<Record<string, string>>({});

useEffect(() => {
  if (!companyId) return;
  supabase
    .from("health_plans")
    .select("id, name")
    .eq("company_id", companyId)
    .then(({ data }) => {
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((hp) => { map[hp.id] = hp.name; });
        setHealthPlanMap(map);
      }
    });
}, [companyId]);
```

**2. Criar helper de resolucao de nome**

```typescript
const resolveConvenioName = useCallback((convenioId: string | undefined): string => {
  if (!convenioId) return "PARTICULAR";
  return healthPlanMap[convenioId] || convenioId;
}, [healthPlanMap]);
```

**3. Usar o helper nos pontos que agrupam por convenio**

- `strategicKPIs` (linha ~535): trocar `p.convenio` por `resolveConvenioName(p.convenio)`
- `convenioRanking` (linha ~684): trocar `p.convenio || "PARTICULAR"` por `resolveConvenioName(p.convenio)`

Isso corrige automaticamente todos os cards, rankings e insights que dependem desses dados.

## O que NAO muda

- Nenhuma query de banco
- Nenhum outro modulo (DRE, Aging, BI, Faturamento)
- O campo `convenio` no hook continua armazenando o UUID (correto para persistencia)

## Risco

**Minimo**. Apenas adiciona uma consulta de leitura a `health_plans` e resolve nomes antes da exibicao.

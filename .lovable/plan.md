

# Fix: Unidades criadas em Configuracoes devem refletir em todas as abas e relatorios

## Problema

Quando uma nova unidade (ex: "Hiperbarica") e criada em Configuracoes, ela nao aparece imediatamente nos filtros de Relatorios, Faturamento, Recebiveis, BI, Score, DRE, etc. O usuario precisa dar F5 para ver a unidade nova.

Isso acontece porque essas paginas consomem `settings.units` via `useApp()` -> `useTransactionsDB` -> `useCompanySettings`. O `useCompanySettings` carrega dados uma unica vez no mount e nao escuta mudancas. O `GlobalRealtimeProvider` so escuta `financial_entries`, `productions` e `receivables` -- nunca `company_financial_settings`.

## Solucao (2 arquivos)

### 1. `src/contexts/GlobalRealtimeProvider.tsx` -- Adicionar listener para `company_financial_settings`

Adicionar um quarto `.on()` no canal realtime para escutar mudancas na tabela `company_financial_settings`, filtrado por `company_id`. Quando o usuario salva uma nova unidade em Configuracoes, o canal detecta a mudanca e incrementa a versao global.

### 2. `src/hooks/useCompanySettings.ts` -- Reagir a versao global

Importar `useGlobalRealtime` e observar `version`. Quando `version` mudar (indicando que alguma tabela critica foi alterada, incluindo agora `company_financial_settings`), chamar `loadSettings()` para refetch dos dados.

Isso faz com que **todas** as instancias de `useCompanySettings` (dentro de `useTransactionsDB`/`AppContext`, dentro de `ProductionForm`, dentro de `FinancialEntryForm`, etc.) recebam os dados atualizados automaticamente.

## Detalhes tecnicos

### Arquivo 1: `src/contexts/GlobalRealtimeProvider.tsx`

Adicionar ao canal `global-financial-realtime`, apos o listener de `receivables`:

```text
.on(
  "postgres_changes",
  {
    event: "*",
    schema: "public",
    table: "company_financial_settings",
    filter: `company_id=eq.${companyId}`,
  },
  (payload) => {
    console.log("[GlobalRealtime] company_financial_settings alterado:", payload.eventType);
    notifyAll();
  }
)
```

### Arquivo 2: `src/hooks/useCompanySettings.ts`

1. Importar `useGlobalRealtime`
2. Obter `version` do contexto
3. Adicionar um `useEffect` que chama `loadSettings()` quando `version` muda (apos o carregamento inicial, para evitar duplo-load no mount)

```text
const { version } = useGlobalRealtime();

useEffect(() => {
  if (initialLoadDone.current && currentCompany?.id) {
    loadSettings();
  }
}, [version]);
```

## O que NAO muda

- Nenhuma pagina individual precisa ser alterada (Reports, Billing, Receivables, BI, etc.)
- Nenhum schema, RPC, trigger ou RLS
- A correcao anterior do `ProductionForm` (effectiveUnits) continua valida como camada extra de seguranca
- Dados historicos intactos
- Performance: o refetch so ocorre quando ha mudanca real detectada pelo realtime

## Teste

1. Abrir a aba Relatorios (ou Faturamento, Recebiveis, BI)
2. Em outra aba do navegador, ir em Configuracoes e criar uma nova unidade "Hiperbarica"
3. Voltar para Relatorios -- a unidade "Hiperbarica" deve aparecer nos filtros de unidade sem precisar dar F5


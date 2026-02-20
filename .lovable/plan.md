

# Fix: Unidade "Hiperbarica" nao aparece no formulario de Producao

## Causa raiz

A pagina `Production.tsx` obtem unidades de `transactions.settings.units`, que vem do `AppContext` -> `useTransactionsDB` -> `useCompanySettings`. Esse e um **hook independente** que carrega dados apenas uma vez no mount. Quando voce cria "Hiperbarica" em Configuracoes, aquela instancia de `useCompanySettings` atualiza, mas a instancia do `AppContext` **nao recarrega**. O `GlobalRealtimeProvider` escuta apenas `financial_entries`, `productions` e `receivables` -- nunca `company_financial_settings`.

Resultado: ao navegar para Producao, as unidades passadas no prop `units={settings.units}` estao desatualizadas.

Alem disso, o `ProductionForm` tem sua propria instancia de `useCompanySettings` (linha 123), mas a logica na linha 332 **prioriza o prop `units`** sobre os dados frescos:

```text
const effectiveUnits = units && units.length > 0 ? units : settings?.units || [];
```

Como o prop sempre tem pelo menos as 3 unidades default (Oncologia, Pronto Socorro, Centro Clinico), a condicao `units.length > 0` e sempre `true`, e os dados frescos do `ProductionForm` sao ignorados.

## Solucao

Inverter a prioridade na linha 332 do `ProductionForm.tsx`: usar os dados do proprio `useCompanySettings` do formulario como fonte primaria (pois ele carrega diretamente do banco no mount), e usar o prop `units` apenas como fallback.

### Arquivo: `src/components/production/ProductionForm.tsx`

Linha 332 -- mudar de:

```text
const effectiveUnits = units && units.length > 0 ? units : settings?.units || [];
```

Para:

```text
const effectiveUnits = settings?.units && settings.units.length > 0
  ? settings.units
  : (units && units.length > 0 ? units : []);
```

Isso garante que o formulario sempre usa os dados mais recentes do banco (sua propria instancia de `useCompanySettings` carrega no mount do dialog), com fallback para o prop caso o carregamento ainda nao tenha terminado.

## O que NAO muda

- Nenhum outro arquivo
- Nenhum schema, RPC, trigger ou RLS
- O prop `units` continua existindo como fallback
- Dados historicos intactos
- Fluxos de edicao, exclusao e inativacao de unidades inalterados

## Teste

1. Criar unidade "Hiperbarica" em Configuracoes (ja feito)
2. Ir para Producao -> Nova Producao
3. Verificar que "Hiperbarica" aparece no dropdown de Unidade

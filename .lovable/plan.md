

# Fix: Valores decimais truncados na Producao (R$ 910,85 vira R$ 910)

## Causa raiz

O campo "Valor Total" no formulario de producao aceita entrada com virgula (ex: `910,85` - formato brasileiro). Porem, no `handleSubmit`, o valor e convertido usando `parseFloat()` nativo do JavaScript, que **para de ler no primeiro caractere nao-numerico** (a virgula). Resultado: `parseFloat("910,85")` retorna `910`.

Isso acontece em **3 pontos** do `ProductionForm.tsx`:
- Linha 972: pacote (`parseFloat(packageTotalValue)`)
- Linha 1032: tipo avulso (`parseFloat(typeValues.totalValue)`)
- Linha 1127: multi-tipo batch (`parseFloat(typeValues.totalValue)`)

Ironicamente, o formulario ja tem uma funcao `toNum` (linha 300) que trata corretamente virgulas brasileiras, mas ela so e usada para o resumo visual (pre-conferencia) -- nunca no submit.

## Solucao

Extrair a funcao `toNum` para fora do `useMemo` e usa-la nos 3 pontos do `handleSubmit` no lugar de `parseFloat`.

### Mudancas em `src/components/production/ProductionForm.tsx`

1. **Mover `toNum` para escopo do componente** (antes do `useMemo` de `totals`), como funcao reutilizavel:

```typescript
// Locale-aware decimal parser (handles both "910.85" and "910,85")
const toNum = (s?: string): number => {
  if (!s || s === "") return 0;
  let str = String(s).trim().replace(/[¤$\s]/g, "");
  const lastComma = str.lastIndexOf(",");
  const lastDot = str.lastIndexOf(".");
  if (lastComma > lastDot) {
    str = str.replace(/\./g, "").replace(",", ".");
  } else {
    str = str.replace(/,/g, "");
  }
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
};
```

2. **Substituir `parseFloat` por `toNum`** nos 3 pontos do submit:

| Linha | Antes | Depois |
|---|---|---|
| ~928 | `parseFloat(singleTotalValue \|\| packageTotalValue)` | `toNum(singleTotalValue \|\| packageTotalValue)` |
| ~972 | `parseFloat(packageTotalValue)` | `toNum(packageTotalValue)` |
| ~1032 | `parseFloat(typeValues.totalValue)` | `toNum(typeValues.totalValue)` |
| ~1127 | `parseFloat(typeValues.totalValue)` | `toNum(typeValues.totalValue)` |

Nenhuma outra mudanca. Nenhum arquivo adicional. Nenhuma alteracao de schema, RLS, triggers, ou dados historicos.

## O que NAO muda

- Formato de entrada no campo (o usuario continua digitando com virgula)
- Funcao `parseMoneyBR` (usada no Billing para recebimento -- ja funciona corretamente)
- Valores ja salvos no banco (dados historicos permanecem intactos)
- Nenhum outro componente ou hook e alterado
- Trigger `financial_entries_category_guard()` nao e tocado

## Teste de validacao

1. Criar producao com valor `910,85`
2. Verificar no banco que `total_value = 910.85`
3. Faturar e abrir modal "Registrar Recebimento" -- valor deve aparecer como `910.85`
4. Confirmar recebimento e verificar que `financial_entries.valor = 910.85`

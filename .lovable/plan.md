
# Fix: "Parecer" nao aparece no dropdown de Tipo de Producao

## Problema

"Parecer" esta cadastrado em `company_financial_settings.production_types` e aparece na aba Configuracoes, mas **nao aparece** no formulario de lancamento de producao.

## Causa raiz

No `ProductionForm.tsx` (linha 214-219), o filtro que separa tipos customizados dos tipos base faz duas verificacoes:

1. Se o **nome** do tipo customizado esta na lista `BASE_PRODUCTION_TYPES` (IDs como "CONSULTA", "EXAME")
2. Se o **nome** do tipo customizado bate com algum **label** em `PRODUCTION_TYPE_LABELS`

"PARECER" foi adicionado a `PRODUCTION_TYPE_LABELS` (em `constants.ts` linha 63) com label "Parecer". Entao quando o filtro compara `"parecer" === "parecer"`, ele considera que e um tipo base e **remove** da lista de customizados.

Porem, "PARECER" **nao** esta em `BASE_PRODUCTION_TYPES` (que so tem CONSULTA, EXAME, QUIMIOTERAPIA, BOX_PS, SESSAO_TERAPEUTICA, INTERNACAO, MAT_MED, OUTRO). Entao ele nunca e incluido por nenhum dos dois caminhos.

## Solucao

Adicionar `"PARECER"` ao array `BASE_PRODUCTION_TYPES` em `src/types/index.ts`. Isso e a correcao mais simples e coerente: se o tipo ja tem um label oficial no sistema, ele deve ser um tipo base.

### Arquivo: `src/types/index.ts`

Adicionar `"PARECER"` ao array `BASE_PRODUCTION_TYPES`:

```text
export const BASE_PRODUCTION_TYPES = [
  "CONSULTA",
  "EXAME",
  "QUIMIOTERAPIA",
  "BOX_PS",
  "SESSAO_TERAPEUTICA",
  "INTERNACAO",
  "MAT_MED",
  "OUTRO",
  "PARECER",        // <-- ADICIONAR
] as const;
```

### O que NAO muda

- Nenhum outro arquivo e alterado
- Tipos customizados criados pelo usuario continuam funcionando
- Nenhuma alteracao de banco, RPC, trigger ou dados historicos
- O label "Parecer" ja existe em `PRODUCTION_TYPE_LABELS`, entao o dropdown mostrara o nome correto

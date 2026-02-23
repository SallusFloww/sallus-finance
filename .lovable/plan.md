
# Corrigir Label "RECEBIMENTO_FATURAMENTO" nas Movimentacoes

## Problema

Quando uma producao com tipo customizado (ex: "Oxigenoterapia Hiperbarica") e recebida via faturamento, o sistema armazena a categoria como `RECEBIMENTO_FATURAMENTO` no banco porque o tipo de producao nao esta registrado como "categoria valida" nas configuracoes da empresa. Isso faz com que nas movimentacoes e relatorios apareca o codigo bruto em vez do nome legivel.

## Causa raiz

No `useReceivablesDB.ts`, a logica de inferencia de categoria faz:

1. Busca o `production_type` das producoes vinculadas
2. Valida se esse tipo existe nas `categories` da empresa (company_financial_settings)
3. Se NAO existir como categoria registrada -> fallback para `"RECEBIMENTO_FATURAMENTO"`

O problema e que tipos como "Oxigenoterapia Hiperbarica" sao tipos de **producao**, nao categorias financeiras registradas. A validacao e desnecessariamente restritiva.

## Solucao (2 camadas)

### Camada 1 - Causa raiz: `src/hooks/useReceivablesDB.ts`

Alterar a logica de inferencia de categoria em **2 locais** (funcao `markAsReceived` ~linha 479 e funcao de recebimento parcelado ~linha 1227):

**Antes**: So usa o production_type como categoria se ele estiver registrado nas categories da empresa. Senao, fallback para RECEBIMENTO_FATURAMENTO.

**Depois**: Se o production_type existe em `PRODUCTION_TYPE_LABELS` (constantes do sistema) OU nas categories da empresa OU nos `productionTypes` customizados da empresa, usa-lo diretamente como categoria. Isso cobre CONSULTA, EXAME, QUIMIOTERAPIA e tambem tipos customizados como "Oxigenoterapia Hiperbarica".

Logica expandida:
```
// Validar contra: categories da empresa + PRODUCTION_TYPE_LABELS + productionTypes customizados
if (uniqueTypes.length === 1) {
  const type = uniqueTypes[0];
  if (validCategoryCodes.has(type.toUpperCase()) || PRODUCTION_TYPE_LABELS[type] || PRODUCTION_TYPE_LABELS[type.toUpperCase()]) {
    inferredCategory = type;  // Usar o tipo diretamente
  } else {
    // Fallback mas com nota
    inferredCategory = type;  // Usar mesmo assim - resolveCategoryLabel resolve na exibicao
  }
}
```

Simplificando: **sempre usar o production_type como categoria quando ha um unico tipo**. Manter RECEBIMENTO_FATURAMENTO apenas para multiplos tipos ou quando nao ha producoes vinculadas.

### Camada 2 - Safety net na exibicao: `src/hooks/useTransactionsDB.ts`

Expandir a funcao `resolveCategoryLabel` para tratar:

1. Adicionar `"RECEBIMENTO_FATURAMENTO" -> "Recebimento de Faturamento"` como mapeamento direto (para registros antigos ja salvos no banco)
2. Tentar resolver nomes customizados que podem estar no formato de display (ex: "Oxigenoterapia Hiperbarica") - ja funciona com o return as-is

### Camada 3 - Mapeamento global: `src/utils/constants.ts`

Adicionar `RECEBIMENTO_FATURAMENTO: "Recebimento de Faturamento"` ao `PRODUCTION_TYPE_LABELS` para que qualquer lugar do sistema que use esse mapa consiga resolver o label.

## Arquivos alterados

| Arquivo | Alteracao |
|---------|-----------|
| `src/hooks/useReceivablesDB.ts` | Simplificar inferencia de categoria: usar production_type diretamente quando ha um unico tipo (2 locais) |
| `src/utils/constants.ts` | Adicionar RECEBIMENTO_FATURAMENTO ao PRODUCTION_TYPE_LABELS |
| `src/hooks/useTransactionsDB.ts` | Nenhuma alteracao necessaria - resolveCategoryLabel ja consulta PRODUCTION_TYPE_LABELS |

## Impacto

- **Novos recebimentos**: Vao gravar o production_type correto como categoria (ex: "Oxigenoterapia Hiperbarica", "CONSULTA", "QUIMIOTERAPIA")
- **Registros antigos**: Os que ja estao salvos como "RECEBIMENTO_FATURAMENTO" passarao a exibir "Recebimento de Faturamento" (label legivel) em vez do codigo bruto
- **Qualquer tipo customizado futuro**: Automaticamente resolvido, pois o sistema vai usar o production_type diretamente

## O que NAO muda

- Nenhum schema de banco de dados
- Nenhuma RLS ou trigger
- O fluxo de convenio/particular permanece identico
- Relatorios e DRE usam `resolveCategoryLabel` que ja funciona com o PRODUCTION_TYPE_LABELS
- Nenhum componente de UI precisa ser alterado (a resolucao e feita no hook)

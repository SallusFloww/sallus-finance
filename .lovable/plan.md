

# Corrigir Consolidado por Componentes Mostrando Zero

## Problema

O card "Consolidado por Componentes" compara `reportType` usando valores em MAIUSCULO (`"CONSULTA"`, `"EXAME"`, `"BOX_TAXA"`, `"MAT_MED"`), porem os registros no banco estao com `production_type` em formato misto (ex: `"Consulta"`, `"Exame"`).

A funcao `toReportItems` repassa o `productionType` diretamente como `reportType` sem normalizar:

```text
// Linha 235 de ProductionReport.tsx
const reportType = p.productionType === "BOX_PS" ? "BOX_TAXA" : p.productionType;
// Se p.productionType = "Consulta", reportType = "Consulta"
// Mas o card filtra: item.reportType === "CONSULTA" --> nao bate!
```

Isso faz com que TODOS os cards mostrem zero, mesmo com 31 registros no periodo.

**Nao e um problema de status** — o `filterProductions` nao filtra por status, entao producoes com status `PRODUZIDO` ja estao incluidas. O problema e puramente de case-sensitivity na comparacao do tipo.

## Solucao

Normalizar o `reportType` para MAIUSCULO na funcao `toReportItems` (linha 235), garantindo que todos os tipos sejam comparaveis com os filtros dos cards.

### Arquivo: `src/pages/ProductionReport.tsx`

**Alteracao 1 — Producoes normais (nao-pacote)**

Na linha 235, alterar:
```
const reportType = p.productionType === "BOX_PS" ? "BOX_TAXA" : p.productionType;
```
Para:
```
const rawType = p.productionType.toUpperCase();
const reportType = rawType === "BOX_PS" ? "BOX_TAXA" : rawType;
```

**Alteracao 2 — Producoes pacote (comparacao de tipo)**

Na linha 163, a verificacao `p.productionType === "PACOTE_BOX"` ja usa maiusculo, entao nao precisa de ajuste. Porem, como seguranca adicional, normalizar a comparacao:
```
const isPackage = p.isPackage 
  || p.productionType.toUpperCase() === "PACOTE_BOX" 
  || p.productionType.toUpperCase() === "PACOTE_GTA";
```

## O que NAO muda

- Nenhuma query de banco ou trigger
- Nenhuma logica de faturamento, aging ou DRE
- Nenhum outro componente ou pagina
- A tabela consolidada (`consolidatedTable`) ja usa `reportItems`, entao sera corrigida automaticamente

## Risco

**Minimo**. Apenas normaliza strings para maiusculo antes da comparacao. Nenhum dado e alterado.

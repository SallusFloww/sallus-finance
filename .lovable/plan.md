
# Permitir Cancelamento de Producoes com Status "PRODUZIDO"

## Resumo

Adicionar a funcionalidade de **cancelar** producoes que ainda nao foram faturadas (status = "PRODUZIDO"). Producoes faturadas, recebidas ou glosadas permanecem bloqueadas. O cancelamento e logico (soft delete): o registro permanece no banco com status "CANCELADO" para auditoria.

## Alteracoes

### 1. `src/types/index.ts`

Adicionar "CANCELADO" ao tipo `ProductionStatus`:

```typescript
export type ProductionStatus = "PRODUZIDO" | "FATURADO" | "GLOSADO" | "RECEBIDO" | "CANCELADO";
```

### 2. `src/hooks/useProductionDB.ts`

Substituir a funcao `deleteProduction` (que hoje apenas exibe um toast de erro) por uma funcao `cancelProduction` que:

- Valida que o status e "PRODUZIDO"
- Faz UPDATE no banco: `status = 'CANCELADO'`
- Adiciona entrada no `history` com acao "CANCELADO"
- Exibe toast de sucesso
- Faz refetch

Manter a funcao `deleteProduction` existente (para nao quebrar a interface), mas internamente redirecionar para cancelamento.

### 3. `src/components/production/ProductionList.tsx`

- Adicionar config de status para "CANCELADO" no `STATUS_CONFIG`:
  ```
  CANCELADO: {
    label: "Cancelado",
    color: "bg-gray-500/10 text-gray-500 border-gray-500/20",
    icon: XCircle,
    description: "Producao cancelada. Nao sera faturada.",
  }
  ```
- Trocar o item "Excluir" do dropdown por "Cancelar" (icone `XCircle` em vez de `Trash2`)
- Adicionar dialog de confirmacao antes de cancelar (AlertDialog com motivo opcional)
- Aplicar estilo visual de linha cancelada (opacity reduzida, texto riscado)
- Excluir producoes canceladas do calculo de totais

### 4. `src/pages/Production.tsx`

- Passar a nova funcao `cancelProduction` (via `onDelete` ou nova prop) para o `ProductionList`
- Ajustar contadores do resumo operacional para ignorar producoes canceladas
- Adicionar filtro de status "CANCELADO" no select de status

### 5. Filtros e relatorios

- O filtro de status na pagina Production ja suporta valores dinamicos -- basta adicionar `<SelectItem value="CANCELADO">Cancelado</SelectItem>`
- Producoes canceladas devem ser **excluidas** dos calculos de KPIs e do faturamento sugerido (ja estao, pois so consideram "PRODUZIDO")

## O que NAO muda

- Nenhum schema de banco (a coluna `status` e `text`, aceita qualquer valor)
- Nenhuma RLS ou trigger
- Nenhuma migracao SQL necessaria
- Fluxo de faturamento/recebimento inalterado
- Relatorios e DRE nao sao impactados (producoes canceladas nao entram em faturamento)

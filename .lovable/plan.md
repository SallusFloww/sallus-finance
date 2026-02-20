

# Botao "Usar data da producao" no dialog de Recebimento

## O que sera feito

No dialog "Registrar Recebimento" da pagina de Faturamento (`/billing`):

1. **Corrigir o label** de "Usar data do faturamento" para "Usar data da producao"
2. **Buscar as datas de producao distintas** vinculadas ao receivable selecionado (via tabela `productions` com `linked_receivable_id`)
3. **Exibir um botao por data de producao distinta** encontrada, permitindo preencher rapidamente a data de recebimento com a data correta de cada producao
4. **Manter o funcionamento atual**: o campo de data continua editavel manualmente e com default "hoje"

## Detalhes tecnicos

### Arquivo: `src/pages/Billing.tsx`

**1. Novo estado para armazenar as datas de producao vinculadas**

Adicionar um estado `linkedProductionDates` (array de strings YYYY-MM-DD, sem duplicatas, ordenado).

**2. Alterar `openReceiveDialog`**

Ao abrir o dialog, buscar as datas de producao distintas no banco:

```text
const { data: prods } = await supabase
  .from("productions")
  .select("production_date")
  .eq("company_id", currentCompany.id)
  .eq("linked_receivable_id", receivable.id);

const uniqueDates = Array.from(new Set(
  (prods || []).map(p => p.production_date).filter(Boolean)
)).sort();

setLinkedProductionDates(uniqueDates);
```

**3. Substituir o botao atual no dialog**

Remover o botao fixo "Usar data do faturamento" e substituir por:

- Se houver **1 data de producao**: exibir um unico botao "Usar data da producao (dd/MM/yyyy)"
- Se houver **varias datas**: exibir um botao por data, com label "Usar data da producao: dd/MM/yyyy"
- Se **nao houver producoes vinculadas**: nao exibir nenhum botao (comportamento limpo)

```text
{linkedProductionDates.length > 0 && (
  <div className="space-y-1">
    {linkedProductionDates.map((d) => (
      <Button
        key={d}
        type="button"
        variant="outline"
        size="sm"
        className="w-full gap-2 text-xs"
        onClick={() => setReceiveData({ ...receiveData, date: d })}
      >
        <CalendarIcon className="h-3 w-3" />
        Usar data da producao ({format(parseISO(d), "dd/MM/yyyy")})
      </Button>
    ))}
  </div>
)}
```

**4. Limpar estado ao fechar dialog**

Resetar `linkedProductionDates` para `[]` ao fechar o dialog.

## O que NAO muda

- Nenhuma logica de recebimento, criacao de movimentacao financeira ou RPC
- Nenhum outro dialog (glosa, recurso, historico)
- Nenhum schema ou RLS
- O campo de data manual continua funcionando normalmente
- O default continua sendo a data de hoje

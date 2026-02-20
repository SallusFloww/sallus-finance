
# Melhorar dialog "Marcar como Recebido" no Faturamento

## O que sera feito

No dialog de "Registrar Recebimento" da pagina de Faturamento (`/billing`), sera adicionado um botao de atalho que permite marcar o recebimento com a mesma data do faturamento (data de producao/emissao). Isso facilita o fluxo de recebimentos de particulares, onde o pagamento ocorre no ato.

## Arquivo: `src/pages/Billing.tsx`

### Alteracao no dialog "Marcar Recebido" (linhas 1026-1033)

Substituir o campo simples de data por um bloco com:

1. O campo de data existente (mantido como esta)
2. Um botao de atalho "Usar data do faturamento (dd/MM/yyyy)" que preenche automaticamente a data de recebimento com a `billingDate` do receivable selecionado

O bloco ficara assim:

```text
<div className="space-y-2">
  <Label>Data do Recebimento *</Label>
  <Input
    type="date"
    value={receiveData.date}
    onChange={(e) => setReceiveData({ ...receiveData, date: e.target.value })}
  />
  {selectedReceivable && (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="w-full gap-2 text-xs"
      onClick={() => setReceiveData({ ...receiveData, date: selectedReceivable.billingDate })}
    >
      <CalendarIcon className="h-3 w-3" />
      Usar data do faturamento ({format(parseISO(selectedReceivable.billingDate), "dd/MM/yyyy")})
    </Button>
  )}
</div>
```

## O que NAO muda

- Nenhuma logica de recebimento ou criacao de movimentacao financeira
- Nenhum outro dialog (glosa, recurso, historico)
- Nenhum schema, RPC ou RLS
- O campo de data continua editavel manualmente
- O comportamento padrao (data de hoje) continua igual

## Resultado

- O campo de data do recebimento continua com a data de hoje como padrao
- Um botao abaixo permite trocar rapidamente para a data do faturamento (util para particulares que pagam na hora)
- O usuario pode tambem digitar qualquer outra data manualmente

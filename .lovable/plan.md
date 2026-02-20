

# Receber por data de producao individual

## Problema

Quando um recebivel agrupa producoes de dias diferentes, hoje so e possivel registrar o recebimento com UMA unica data. O usuario precisa poder receber cada grupo de producao na sua data especifica, gerando uma movimentacao financeira separada por data.

## Solucao

Adicionar um **modo de recebimento por data de producao** no dialog existente, mantendo o modo atual (data unica) como padrao.

## Como vai funcionar

1. Ao abrir o dialog "Registrar Recebimento", o sistema busca as producoes vinculadas ao recebivel
2. Se houver producoes de **datas diferentes**, aparece uma opcao: "Receber por data de producao"
3. Ao ativar essa opcao, o dialog mostra uma tabela com cada data de producao, quantidade de itens e valor proporcional
4. Ao confirmar, o sistema cria **uma movimentacao financeira por data**, cada uma com o valor proporcional das producoes daquele dia
5. O recebivel e marcado como RECEBIDO com o valor total
6. O modo padrao (data unica) continua funcionando exatamente como hoje

## Detalhes tecnicos

### Arquivo: `src/pages/Billing.tsx`

**1. Expandir o estado para armazenar producoes completas (nao so datas)**

```text
// Tipo local para producoes vinculadas
interface LinkedProduction {
  id: string;
  production_date: string;
  total_value: number;
}

// Estado
const [linkedProductions, setLinkedProductions] = useState<LinkedProduction[]>([]);
const [receiveByProductionDate, setReceiveByProductionDate] = useState(false);
```

**2. Alterar `openReceiveDialog` para buscar producoes completas**

Buscar `id`, `production_date` e `total_value` das producoes vinculadas. Agrupar por data para exibir no dialog.

**3. Alterar o dialog para mostrar as duas opcoes**

- Manter campo de data unica (padrao) com os botoes de atalho de data de producao
- Adicionar um Switch "Receber por data de producao" que, ao ativar, mostra a tabela de datas com valores
- A tabela exibe: Data | Qtd producoes | Valor proporcional
- Remover o botao "Usar data do faturamento" (nao e mais necessario)

**4. Alterar `handleMarkReceived` para suportar os dois modos**

- **Modo simples (padrao)**: funciona exatamente como hoje - uma movimentacao, uma data
- **Modo por data de producao**: chama `markAsReceived` uma vez para cada grupo de data, com o valor proporcional. Alternativamente, cria as movimentacoes diretamente no Billing.tsx e depois atualiza o receivable

### Arquivo: `src/hooks/useReceivablesDB.ts`

**5. Adicionar funcao `markAsReceivedMultipleDates`**

Nova funcao que recebe um array de `{ date, amount }` e cria uma movimentacao por item:

```text
markAsReceivedMultipleDates(
  receivableId: string,
  entries: Array<{ date: string; amount: number }>,
  userName: string
)
```

Internamente:
- Reutiliza a mesma logica de inferencia de categoria/especialidade do `markAsReceived` atual
- Cria N financial_entries (uma por data/valor)
- Atualiza o receivable com status RECEBIDO e o total recebido
- Vincula o primeiro transaction_id ao receivable (linked_transaction_id)
- Registra todas as movimentacoes no historico

## O que NAO muda

- Nenhum schema de banco de dados
- Nenhuma RLS ou RPC
- O modo de recebimento simples (data unica) continua identico
- Nenhum outro dialog (glosa, recurso, historico)
- A logica de idempotencia e anti-duplicidade e mantida
- O rollback automatico e mantido

## Fluxo visual do dialog

```text
+------------------------------------------+
| Registrar Recebimento                    |
+------------------------------------------+
| Valor: R$ 1.500,00                       |
|                                          |
| Data do Recebimento: [2026-02-20]        |
| [Usar data da producao (10/02/2026)]     |
| [Usar data da producao (15/02/2026)]     |
|                                          |
| [x] Receber por data de producao         |
|                                          |
| (quando ativado, mostra:)                |
| +------+-------+----------+             |
| | Data | Qtd   | Valor    |             |
| +------+-------+----------+             |
| | 10/02| 3     | R$ 900   |             |
| | 15/02| 2     | R$ 600   |             |
| +------+-------+----------+             |
| Total: R$ 1.500,00                       |
|                                          |
| [Cancelar]  [Confirmar Recebimento]      |
+------------------------------------------+
```

Quando o switch esta desativado, funciona exatamente como hoje (campo de data unica).
Quando ativado, ignora o campo de data unica e usa as datas individuais das producoes.


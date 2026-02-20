
# Editar Producao - Funcionalidade de Ponta a Ponta

## O que sera feito

Adicionar a possibilidade de **editar uma producao existente** diretamente na lista de producoes (aba Producao). O usuario podera corrigir medico, data, unidade, convenio, descricao, quantidade, valor e demais campos de uma producao que ainda esteja com status "PRODUZIDO".

## Regra de negocio

- Somente producoes com status **PRODUZIDO** podem ser editadas (producoes ja faturadas/recebidas/glosadas sao bloqueadas)
- Toda edicao gera um registro no `edit_logs` e no `history` da producao para rastreabilidade completa
- O formulario de edicao abre pre-preenchido com os dados atuais da producao

## Alteracoes por arquivo

### 1. `src/hooks/useProductionDB.ts` - Expandir campos editaveis

O `updateProduction` atual so atualiza `description`, `quantity`, `unitValue` e `doctorId`. Sera expandido para suportar tambem:

- `production_date` (data da producao)
- `competencia`
- `unit` (unidade)
- `payer_type` (convenio/particular)
- `convenio`
- `payment_method`
- `specialty`
- `procedure_code`
- `production_type`

Cada campo so e atualizado se vier definido no `data` parcial, mantendo o comportamento seguro atual.

### 2. `src/components/production/ProductionList.tsx` - Adicionar opcao "Editar" e dialog de edicao

**Menu dropdown**: Adicionar item "Editar" no menu de acoes (icone de lapis), visivel apenas quando `status === "PRODUZIDO"` e quando o callback `onEdit` esta disponivel.

**Dialog de edicao**: Um dialog inline no proprio `ProductionList` com os campos editaveis:

- Data da producao (date input)
- Competencia (text input com mascara MM/YYYY)
- Unidade (select das unidades disponiveis)
- Medico (select dos medicos carregados)
- Pagador: Convenio/Particular (select)
- Convenio (select, visivel se pagador = CONVENIO)
- Tipo de producao (select)
- Descricao/Procedimento (text input)
- Codigo do procedimento (text input opcional)
- Quantidade (number input)
- Valor unitario (number input)
- Especialidade (select, visivel se unidade = Centro Clinico)

O dialog exibe o **valor total calculado** (quantidade x valor unitario) em tempo real.

**Comportamento**:
- Ao clicar "Editar" no dropdown, abre o dialog pre-preenchido
- Ao confirmar, chama `onEdit(productionId, dadosAlterados)`
- Exibe toast de sucesso/erro
- A lista atualiza automaticamente via refetch

### 3. `src/pages/Production.tsx` - Conectar o fluxo

- Importar `updateProduction` do hook (ja retornado mas nao usado)
- Criar handler `handleEditProduction` que chama `updateProduction(id, data, userName)`
- Passar `onEdit={handleEditProduction}` para `ProductionList`

### 4. `src/components/production/index.ts` - Sem alteracoes

O export do `ProductionList` ja existe.

## Fluxo visual

```text
Lista de Producoes
  |
  +-- [Menu ...] --> "Editar" (so para status PRODUZIDO)
        |
        v
  +------------------------------------------+
  | Editar Producao                          |
  +------------------------------------------+
  | Data: [2026-02-15]                       |
  | Competencia: [02/2026]                   |
  | Unidade: [Centro Clinico v]              |
  | Medico: [Dr. Silva v]                    |
  | Pagador: [Convenio v]                    |
  | Convenio: [UNIMED v]                     |
  | Tipo: [Consulta v]                       |
  | Descricao: [Consulta Medica]             |
  | Cod. Proc.: [10101012]                   |
  | Qtde: [1]   Valor Unit.: [350,00]        |
  | Total: R$ 350,00                         |
  |                                          |
  | [Cancelar]  [Salvar Alteracoes]           |
  +------------------------------------------+
```

## O que NAO muda

- Nenhum schema de banco de dados (a tabela `productions` ja tem todos os campos)
- Nenhuma RLS (a policy de UPDATE para Admin/Gestor ja existe)
- O formulario de criacao (ProductionForm) permanece identico
- O fluxo de exclusao permanece identico
- Nenhum outro componente ou pagina e afetado
- A logica de historico e edit_logs ja existe no hook e sera reutilizada

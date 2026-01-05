# PLANO DE TESTES - AUDITORIA SALLUSFINANCE
**Data:** 2026-01-05  
**Versão:** 1.0

---

## OBJETIVO

Validar que as correções aplicadas garantem integridade financeira conforme regras de negócio:
- CANCELADOS nunca entram em totais (exceto modo auditoria)
- Apenas REALIZADOS impactam saldo
- PENDENTES são informativos, não impactam saldo
- Atualizações são instantâneas (sem refresh)

---

## PRÉ-REQUISITOS

1. Usuário logado com role Admin ou Gestor
2. Pelo menos 1 empresa com saldo inicial configurado
3. Acesso às páginas: Dashboard, Movimentações, Relatórios, BI, Tendências, DRE

---

## CENÁRIOS DE TESTE

### CT-01: Criação de Movimentação (Entrada Realizada)

| Passo | Ação | Resultado Esperado |
|-------|------|-------------------|
| 1 | Acessar Dashboard ou Movimentações | Página carrega sem erros |
| 2 | Clicar em "Nova Movimentação" | Modal abre |
| 3 | Selecionar "Entrada" | Opções de recebimento aparecem |
| 4 | Selecionar status "Recebido" | Data de recebimento é preenchida |
| 5 | Preencher valor: R$ 1.000,00 | Campo aceita valor |
| 6 | Preencher descrição: "Teste Auditoria" | Campo aceita texto |
| 7 | Selecionar unidade: ONCOLOGIA | Campo aceita seleção |
| 8 | Selecionar tipo recebimento: PARTICULAR | Opções de pagamento aparecem |
| 9 | Selecionar forma pagamento: PIX | Campo aceita seleção |
| 10 | Clicar "Salvar" | Toast de sucesso aparece |
| 11 | Verificar lista de movimentações | Novo item aparece INSTANTANEAMENTE (sem refresh) |
| 12 | Verificar card de saldo | Saldo aumentou R$ 1.000,00 |
| 13 | Navegar para Relatórios | Mesmo valor aparece nos totais |

**Critério de Aceite:** Movimentação aparece em < 1 segundo em todos os lugares.

---

### CT-02: Criação de Movimentação (Entrada Prevista)

| Passo | Ação | Resultado Esperado |
|-------|------|-------------------|
| 1 | Criar entrada com status "Previsto" | Toast de sucesso |
| 2 | Verificar lista | Item aparece com badge "Previsto" |
| 3 | Verificar card de saldo | Saldo NÃO aumentou |
| 4 | Verificar Relatórios (modo normal) | Previsto NÃO entra nos totais |
| 5 | Ativar "Modo Diretor" | Previsto ENTRA nos totais |
| 6 | Desativar "Modo Diretor" | Previsto SAI dos totais |

**Critério de Aceite:** PENDENTE só aparece em totais no Modo Diretor.

---

### CT-03: Cancelamento de Movimentação

| Passo | Ação | Resultado Esperado |
|-------|------|-------------------|
| 1 | Identificar movimentação REALIZADA existente | Item visível na lista |
| 2 | Anotar saldo atual do Dashboard | Valor anotado |
| 3 | Clicar em "Cancelar" na movimentação | Modal de confirmação |
| 4 | Confirmar cancelamento (opcional: informar motivo) | Toast de sucesso |
| 5 | Verificar lista | Item aparece com badge "Cancelado" e estilo riscado |
| 6 | Verificar card de saldo | Saldo DIMINUIU pelo valor cancelado |
| 7 | Navegar para Relatórios | Cancelado NÃO aparece nos totais |
| 8 | Navegar para BI | Cancelado NÃO aparece em KPIs |
| 9 | Navegar para Tendências | Cancelado NÃO aparece em gráficos |
| 10 | Navegar para DRE | Cancelado NÃO aparece em linhas |

**Critério de Aceite:** CANCELADO nunca impacta nenhum total ou gráfico.

---

### CT-04: Consistência Entre Painéis

| Passo | Ação | Resultado Esperado |
|-------|------|-------------------|
| 1 | Definir período: mês atual | Filtro aplicado |
| 2 | Anotar valores do Dashboard: Entradas, Saídas, Saldo | Valores anotados |
| 3 | Navegar para Relatórios com mesmo período | Valores IDÊNTICOS |
| 4 | Navegar para BI com mesmo período | Valores IDÊNTICOS |
| 5 | Filtrar por unidade específica | Valores consistentes em todos os painéis |

**Critério de Aceite:** Mesmo período/unidade = mesmos valores em Dashboard, Relatórios e BI.

---

### CT-05: DRE vs Caixa (Regimes Diferentes)

| Passo | Ação | Resultado Esperado |
|-------|------|-------------------|
| 1 | Criar entrada com data prevista em janeiro, recebimento em fevereiro | Item criado |
| 2 | Verificar Caixa (janeiro) | Item NÃO aparece (data recebimento é fevereiro) |
| 3 | Verificar Caixa (fevereiro) | Item APARECE |
| 4 | Verificar DRE (janeiro) | Depende da competência configurada |
| 5 | Ativar "Incluir Cancelados" no DRE | Cancelados aparecem como subtotal separado |

**Critério de Aceite:** DRE pode ter valores diferentes do Caixa (competência vs caixa).

---

### CT-06: Validação de Formulário

| Passo | Ação | Resultado Esperado |
|-------|------|-------------------|
| 1 | Tentar salvar com valor R$ 0,00 | Erro: "valor maior que zero" |
| 2 | Tentar salvar com valor negativo | Erro: "valor maior que zero" |
| 3 | Tentar salvar sem descrição | Erro: "informe descrição" |
| 4 | Tentar salvar entrada sem tipo recebimento | Erro: "selecione tipo recebimento" |
| 5 | Tentar salvar PARTICULAR sem forma pagamento | Erro: "selecione forma pagamento" |
| 6 | Tentar salvar CONVÊNIO sem operadora | Erro: "selecione operadora" |

**Critério de Aceite:** Nenhum lançamento inválido é criado.

---

### CT-07: Isolamento de Tenant (RLS)

| Passo | Ação | Resultado Esperado |
|-------|------|-------------------|
| 1 | Logar como usuário da Empresa A | Dashboard carrega dados da Empresa A |
| 2 | Tentar acessar via URL com ID de outra empresa | Dados NÃO aparecem (RLS bloqueia) |
| 3 | Verificar console/network | Nenhum dado de Empresa B vazou |

**Critério de Aceite:** Usuário só vê dados da sua empresa.

---

### CT-08: Atualização em Tempo Real (Realtime)

| Passo | Ação | Resultado Esperado |
|-------|------|-------------------|
| 1 | Abrir app em 2 abas do navegador | Ambas mostram mesmos dados |
| 2 | Na aba 1, criar movimentação | Toast de sucesso na aba 1 |
| 3 | Verificar aba 2 (sem refresh) | Movimentação aparece automaticamente |
| 4 | Na aba 2, cancelar uma movimentação | Toast de sucesso na aba 2 |
| 5 | Verificar aba 1 (sem refresh) | Status muda para "Cancelado" automaticamente |

**Critério de Aceite:** Alterações propagam entre abas sem refresh.

---

## MATRIZ DE RASTREABILIDADE

| Teste | Requisito | Bug Relacionado |
|-------|-----------|-----------------|
| CT-01 | Criação instantânea | BUG-1 (movimentações só após refresh) |
| CT-02 | PENDENTE não impacta saldo | Regra de negócio |
| CT-03 | CANCELADO excluído de totais | BUG-2 (cancelados somando) |
| CT-04 | Fonte única de verdade | Consistência financeira |
| CT-05 | DRE separado de Caixa | Regra de negócio (competência) |
| CT-06 | Validação de entrada | Governança/SOX |
| CT-07 | Isolamento multi-tenant | Segurança/RLS |
| CT-08 | Realtime updates | UX/Performance |

---

## CRITÉRIOS DE APROVAÇÃO

- [ ] Todos os cenários CT-01 a CT-08 passam
- [ ] Nenhum erro de console (warnings permitidos)
- [ ] Tempo de resposta < 2 segundos para operações CRUD
- [ ] Saldo calculado = Saldo Inicial + Entradas REALIZADAS - Saídas REALIZADAS

---

## NOTAS

- Testes devem ser executados após aplicação dos patches P0
- Ambiente de teste: Preview do Lovable (sandbox)
- Dados de teste: criar movimentações específicas para auditoria
- Após aprovação, considerar automação com Playwright/Cypress

---

*Plano de Testes gerado por Lovable AI - Auditoria Enterprise v1.0*

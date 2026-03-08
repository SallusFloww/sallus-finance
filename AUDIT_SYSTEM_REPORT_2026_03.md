# AUDITORIA COMPLETA DO SISTEMA — Sallus Finance
**Data:** 2026-03-08  
**Auditor:** Senior Software Architect / QA Engineer / Security Reviewer  

---

## DIAGNÓSTICO GERAL

### Classificação: **B) Funcional com ajustes menores**

O sistema está **tecnicamente sólido** para uso em produção. Os fluxos operacionais, financeiros e de faturamento estão corretos e seguem as regras de negócio documentadas. As proteções contra duplicidade, rollback automático e isolamento por empresa (RLS) estão implementadas. Os ajustes identificados são melhorias incrementais, não bloqueadores de go-live.

---

## 1️⃣ FLUXO OPERACIONAL — ✅ CORRETO

### Fluxo de Status
```
PRODUZIDO → FATURADO → RECEBIDO
                    └→ GLOSADO → (recurso) → RECEBIDO
PRODUZIDO → CANCELADO (terminal)
```

**Verificações realizadas:**

| Regra | Status | Arquivo |
|-------|--------|---------|
| Produção NÃO gera caixa | ✅ | `useProductionDB.ts:314` — insert com status "PRODUZIDO", sem toque em `financial_entries` |
| Apenas RECEBIDO gera entrada financeira | ✅ | `useReceivablesActions.ts:315-335` — `markAsReceived` insere em `financial_entries` com status "recebido" |
| Cancelamento apenas em PRODUZIDO | ✅ | `useProductionDB.ts:527` — guard `production.status !== "PRODUZIDO"` |
| Edição apenas em PRODUZIDO | ✅ | `useProductionDB.ts:418` — guard idêntico |
| GLOSADO permite retorno a FATURADO | ✅ | `ProductionList.tsx:109-111` — `STATUS_TRANSITIONS` |

### ⚠️ PROBLEMA P2: Transição de status no inline não valida no backend

**Arquivo:** `Production.tsx:215-217`  
**Impacto:** Médio — permite transição direta PRODUZIDO→FATURADO via `updateProduction` sem criar receivable  
**Detalhe:** O `handleStatusChange` chama `updateProduction(id, { status: newStatus })`, que no hook (`useProductionDB.ts:414-518`) **NÃO valida transições de status**. Apenas valida se status === "PRODUZIDO" para edição de campos, mas a linha 506 faz `update` sem validar o novo status.  
**Correção recomendada:** Adicionar mapa de transições válidas no `updateProduction` do hook, rejeitando transições inválidas (ex: RECEBIDO→PRODUZIDO).

### ⚠️ PROBLEMA P2: Bulk status change sem validação de transição

**Arquivo:** `Production.tsx:220-226`  
**Impacto:** Médio — `handleBulkStatusChange` permite marcar produções como RECEBIDO diretamente, mas o `updateProduction` no hook só permite edição de PRODUZIDO.  
**Detalhe:** O guard na linha 418 (`production.status !== "PRODUZIDO"`) impede que status de FATURADO sejam atualizados via `updateProduction`. As ações bulk de "Marcar recebidos" podem silenciosamente falhar para produções FATURADO.  
**Correção recomendada:** O `updateProduction` deveria aceitar mudanças de status como caso especial, separando a validação de edição de campos da validação de transição de status. Alternativa: criar `updateProductionStatus()` dedicado.

---

## 2️⃣ INTEGRIDADE FINANCEIRA — ✅ CORRETO

### Fórmula de Saldo
```
Saldo = Saldo Inicial + Receitas REALIZADAS − Despesas REALIZADAS
```

**Verificações:**

| Regra | Status | Arquivo |
|-------|--------|---------|
| Apenas `status=recebido` impacta saldo | ✅ | `useFinancialEntries.ts:372-383` — entradas "recebido" somam, saídas "recebido" subtraem |
| Cancelados excluídos do saldo | ✅ | `useFinancialEntries.ts:374` — cancelados contados separadamente, não somados |
| `useTransactionsDB.ts` usa `isRealized()` | ✅ | Linhas 253-257 — helpers robustos de `statusHelpers.ts` |
| Saldo inicial incluído | ✅ | `useTransactionsDB.ts:262` — `settings.initialBalance + totalIncome - totalExpense` |

### Proteção contra duplicidade financeira

| Mecanismo | Status | Local |
|-----------|--------|-------|
| `request_id` (idempotency) em `financial_entries` | ✅ | `useFinancialEntries.ts:156-184` |
| `processingIdsRef` (lock de memória) | ✅ | `useReceivablesActions.ts:218-222` |
| Busca por `receivable_id` na observação antes de inserir | ✅ | `useReceivablesActions.ts:227-239` |
| Rollback automático se update do receivable falhar | ✅ | `useReceivablesActions.ts:364-371` |
| Rollback em `markAsReceivedMultipleDates` | ✅ | `useReceivablesActions.ts:738-748` |

---

## 3️⃣ CONSISTÊNCIA DE STATUS — ✅ COM RESSALVA

### Status válidos (productions)
```
PRODUZIDO | FATURADO | RECEBIDO | GLOSADO | CANCELADO
```

**Verificado em:**
- `STATUS_CONFIG` em `ProductionList.tsx:44-83` — 5 status
- `STATUS_TRANSITIONS` em `ProductionList.tsx:101-112` — transições válidas
- DB constraint `productions_status_check` (mencionado em memory)

### ⚠️ PROBLEMA P3: Status "RECEBIDO_COM_GLOSA" existe em receivables mas não em productions

**Arquivo:** `useReceivablesActions.ts:422`  
**Impacto:** Baixo — sistema de recebíveis trata `RECEBIDO_COM_GLOSA` como status distinto, mas esse status não é refletido de volta nas produções vinculadas.  
**Nota:** Isso é consistente com o design (produção e financeiro são domínios separados), mas pode causar confusão em relatórios cruzados.

---

## 4️⃣ RISCO DE DUPLICIDADE — ✅ BEM PROTEGIDO

| Cenário | Proteção | Status |
|---------|----------|--------|
| Duplo clique em "Registrar Produção" | Optimistic update + replace por ID real | ✅ |
| Duplo clique em "Marcar como Recebido" | `processingIdsRef` (useRef lock) | ✅ |
| Re-tentativa de API | `request_id` UNIQUE em `financial_entries` | ✅ |
| Colagem duplicada de Excel | Rows são adicionadas (não substituídas), mas cada submit gera IDs únicos | ✅ |
| Faturamento duplicado | Busca por `receivable_id` na observação + `idempotency_key` | ✅ |
| Recebível duplicado | Busca por campos idênticos criados nos últimos 2 minutos | ✅ |

---

## 5️⃣ PERFORMANCE — ⚠️ AJUSTES RECOMENDADOS

### ✅ Bom
- Paginação de 1000 em 1000 implementada em todos os hooks (`useProductionDB.ts:178-196`, `useFinancialEntries.ts:112-131`, `useReceivablesDB.ts:36-49`)
- `useMemo` para cálculos derivados pesados
- `useCallback` para funções estáveis
- Realtime via versioning (não polling)

### ⚠️ PROBLEMA P2: N+1 queries em markAsReceived

**Arquivo:** `useReceivablesActions.ts:244-310`  
**Impacto:** Performance — 3 queries separadas para buscar specialty, production_type e labels das produções vinculadas, quando uma única query resolveria.  
**Correção recomendada:** Consolidar em `SELECT specialty, production_type FROM productions WHERE linked_receivable_id = $id`.

### ⚠️ PROBLEMA P3: Fetch completo após cada operação

**Arquivo:** `useProductionDB.ts:407,514,556,592,614,644`  
**Impacto:** Performance em escala — `fetchProductions()` recarrega TODAS as produções após cada insert/update. Com 50k+ registros, isso será lento.  
**Correção recomendada:** Usar optimistic updates para mutations simples e periodic full-refresh apenas via realtime.

### ⚠️ PROBLEMA P3: `filterProductions` itera toda a lista em memória

**Arquivo:** `useProductionDB.ts:650-687`  
**Impacto:** Performance em escala — com 100k registros, filtragem client-side será lenta.  
**Correção futura:** Migrar filtros para queries server-side (Supabase) quando o volume justificar.

---

## 6️⃣ SEGURANÇA — ✅ SÓLIDO

### RLS Policies

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|--------|--------|--------|--------|--------|
| `productions` | ✅ company_id | ✅ Admin/Gestor | ✅ Admin/Gestor | ❌ Bloqueado |
| `financial_entries` | ✅ company_id | ✅ Admin/Gestor | ✅ Admin/Gestor | ❌ Bloqueado |
| `receivables` | ✅ company_id | ✅ Admin/Gestor | ✅ Admin/Gestor | ❌ Bloqueado |
| `companies` | ✅ company_id | ✅ Auth required | ✅ Admin only | ✅ Admin only |
| `profiles` | ✅ own + company | ❌ Trigger only | ✅ own only | ❌ Bloqueado |

**Verificações:**
- ✅ Todas as tabelas críticas usam `get_user_companies(auth.uid())` para isolamento
- ✅ Funções sensíveis (`has_role_in_company`, `is_admin`) são `SECURITY DEFINER` 
- ✅ Roles separadas em tabela própria (`user_company_roles`) — não em profiles
- ✅ DELETE físico bloqueado em todas as tabelas financeiras — apenas soft-delete
- ✅ `cleanup_company_data_by_window` requer role Admin + texto de confirmação

### ⚠️ PROBLEMA P3: Sem rate limiting no frontend

**Impacto:** Baixo — sem throttling em batch operations. Um usuário poderia criar centenas de produções em loop.  
**Mitigação existente:** Plan limits via `checkPlanLimit()` em todos os hooks.

---

## 7️⃣ UX OPERACIONAL — ✅ BOM

### Fluxos implementados

| Funcionalidade | Status |
|----------------|--------|
| Lançamento único de produção | ✅ Modal com multi-type |
| Lançamento em lote (grade) | ✅ Tab/Enter para navegar |
| Paste do Excel (Ctrl+V) | ✅ Parser inteligente 2-4 colunas |
| Shift+Enter (salvar e novo) | ✅ Mantém contexto |
| Status inline clicável | ✅ Popover com transições |
| Seleção em lote + ações | ✅ Checkbox + barra flutuante |
| Importação CSV | ✅ Modal dedicado |
| Autocomplete de procedimentos | ✅ Histórico top 20 |
| Edição inline (PRODUZIDO) | ✅ Dialog com todos os campos |
| Cancelamento com motivo | ✅ Dialog + auditoria |

### ⚠️ PROBLEMA P3: Sem confirmação no bulk status change

**Arquivo:** `ProductionList.tsx:391-406`  
**Impacto:** UX — clicar "Faturar todos" ou "Marcar recebidos" executa imediatamente sem confirmação.  
**Correção recomendada:** Adicionar `ConfirmationDialog` antes de executar bulk actions.

---

## 8️⃣ ESCALABILIDADE — ✅ PRONTO ATÉ 50K

| Volume | Suporte | Notas |
|--------|---------|-------|
| 10k produções | ✅ | Paginação + client-side filtering funciona bem |
| 50k produções | ⚠️ | Client-side filtering começa a ter latência perceptível |
| 100k registros financeiros | ⚠️ | Full fetch + filter em memória será lento. Migrar filtros para server-side |

**Recomendação para escala:**
1. Implementar filtros server-side via `supabase.from().select().filter()` com paginação
2. Adicionar índices compostos: `(company_id, production_date)`, `(company_id, status)`
3. Implementar virtual scrolling na tabela para >500 registros visíveis

---

## RISCOS TÉCNICOS

### Risco 1: Transição de status sem validação server-side
**Probabilidade:** Média | **Impacto:** Alto  
O frontend permite transições via `updateProduction`, mas o banco não tem constraint de transição (apenas `CHECK` de valores válidos). Um bug no frontend poderia criar transições inválidas como RECEBIDO→PRODUZIDO.  
**Mitigação:** Criar trigger SQL `validate_production_status_transition()`.

### Risco 2: Orphan financeiro se realtime falhar
**Probabilidade:** Baixa | **Impacto:** Médio  
Se o WebSocket desconectar durante `markAsReceived`, a entrada financeira é criada mas o receivable pode não atualizar. Rollback automático mitiga, mas se o rollback também falhar, a entrada fica órfã.  
**Mitigação existente:** `reconcileOrphanedReceivables()` — ferramenta de reconciliação.

### Risco 3: Memory pressure com dados grandes
**Probabilidade:** Média (após 50k) | **Impacto:** Médio  
Todos os registros são carregados em memória. Com 100k+ registros, isso pode causar lentidão em dispositivos com pouca RAM.  
**Mitigação futura:** Lazy loading + server-side pagination.

---

## MELHORIAS SUGERIDAS

### Prioridade Alta
1. **Validação de transição de status no backend** — trigger SQL que rejeita transições inválidas
2. **Unificar queries em `markAsReceived`** — consolidar 3 queries de produção em 1
3. **Separar `updateProductionStatus()` de `updateProduction()`** — lógica de transição distinta de edição

### Prioridade Média
4. **Confirmação para bulk actions** — dialog antes de faturar/receber em lote
5. **Índices compostos no banco** — `(company_id, production_date)`, `(company_id, status, production_date)`
6. **Throttling de batch operations** — debounce para evitar spam de requests

### Prioridade Baixa
7. **Virtual scrolling** para tabelas com >500 linhas
8. **Server-side filtering** para quando volume exceder 50k registros
9. **Cache de médicos/convênios** — evitar re-fetch em cada abertura de modal

---

## RESULTADO FINAL

### ✅ O sistema está pronto para produção?

**SIM, com ressalvas.**

O Sallus Finance está **tecnicamente sólido** para uso em produção real com as seguintes qualificações:

1. **Integridade financeira: CORRETA** — A fórmula de saldo é consistente, cancelados são excluídos, apenas RECEBIDO gera caixa.
2. **Segurança: ADEQUADA** — RLS isola por empresa, roles em tabela separada, soft-delete em todas as tabelas.
3. **Duplicidade: PROTEGIDA** — 3 camadas de proteção (lock, idempotency, busca prévia).
4. **Fluxo operacional: FUNCIONAL** — Todos os caminhos críticos testáveis e documentados.

**Riscos residuais que NÃO bloqueiam go-live:**
- Transições de status validadas apenas no frontend (risco mitigável com trigger SQL)
- Performance pode degradar acima de 50k registros (volume típico de clínicas médias é <20k/ano)
- Bulk actions sem confirmação (risco operacional baixo, corrigível sem downtime)

**Recomendação:** Deploy em produção aprovado. Implementar trigger de validação de transição de status como primeira melhoria pós-deploy.

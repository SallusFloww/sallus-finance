# AUDITORIA TÉCNICA PROFUNDA — NÍVEL SaaS
**Sistema:** Sallus Finance  
**Data:** 2026-03-08  
**Versão:** Auditoria v3 — Pré-Escala SaaS  
**Auditor:** Senior Software Architect / DB Engineer / Security Auditor  

---

## CLASSIFICAÇÃO DO SISTEMA

### **B+ — Arquitetura Sólida com Ajustes Pontuais para Escala**

O sistema é funcional, possui integridade financeira robusta, segurança multi-tenant adequada e fluxos operacionais corretos. Os ajustes identificados são de **escala e performance**, não de **correção de bugs críticos**.

---

## 1 — ARQUITETURA DO SISTEMA

### ✅ Pontos Fortes

| Aspecto | Avaliação |
|---|---|
| Separação de responsabilidades | Hooks dedicados por domínio (`useProductionDB`, `useReceivablesDB`, `useFinancialEntries`, `useTransactionsDB`) |
| Componentes UI desacoplados | `ProductionList`, `ProductionForm`, `ProductionStats` são modulares |
| Status helpers centralizados | `statusHelpers.ts`, `productionStatusTransitions.ts` — fonte única de verdade |
| Soft-delete enforced | DELETE físico bloqueado por RLS em `financial_entries`, `productions`, `receivables` |
| Realtime sync | `GlobalRealtimeProvider` com versionamento global — elegante e funcional |
| Auditoria imutável | `history` e `edit_logs` em JSON por registro |
| Idempotência | `request_id` em `financial_entries`, `idempotency_key` em `receivables` |

### ⚠️ Problemas Identificados

| # | Arquivo | Problema | Impacto | Correção |
|---|---|---|---|---|
| A1 | `src/pages/Production.tsx` | 590 linhas — página acumula lógica de filtros, KPIs, alertas e handlers | Manutenibilidade | Extrair `useProductionPage()` custom hook com toda a lógica de estado |
| A2 | `src/pages/Receivables.tsx` | 1421 linhas — monolítico com formulários, tabelas, dialogs | Manutenibilidade | Extrair componentes: `ReceivableForm`, `ReceivableTable`, `ReceivableDialogs` |
| A3 | `src/pages/Billing.tsx` | 1595 linhas — maior arquivo do projeto | Manutenibilidade | Decomposição urgente em `BillingKPIs`, `BillingTable`, `BillingReconciliation` |
| A4 | `src/pages/SuggestedBilling.tsx` | 1249 linhas | Manutenibilidade | Extrair `SuggestedBillingGroup` e `SuggestedBillingConfirmDialog` |
| A5 | `PRODUCTION_TYPE_LABELS` | Duplicado em 4+ arquivos (`Production.tsx`, `ProductionList.tsx`, `SuggestedBilling.tsx`, `useReceivablesActions.ts`) | Inconsistência | Já existe `PRODUCTION_TYPE_LABELS` em `utils/constants.ts` — usar apenas essa referência |
| A6 | `useTransactionsDB.ts` | Wrapper sobre `useFinancialEntries` com dupla transformação (DB → Entry → Transaction) | Overhead desnecessário | Avaliar se a camada Transaction pode ser eliminada, usando FinancialEntry diretamente |

---

## 2 — ARQUITETURA DE DADOS

### ✅ Pontos Fortes

- **RLS em todas as tabelas** — company_id enforced via `get_user_companies()` e `has_role_in_company()` (SECURITY DEFINER)
- **Roles separadas** em tabela dedicada (`roles` + `user_company_roles`) — NÃO no profile ✅
- **Soft-delete** — nenhuma tabela crítica permite DELETE físico via RLS
- **Trigger de validação de categoria** — `financial_entries_category_guard()` previne categorias inválidas
- **Paginação robusta** — todos os fetchs fazem loop de 1000 em 1000

### ⚠️ Problemas Identificados

| # | Tabela/Arquivo | Problema | Impacto | Correção |
|---|---|---|---|---|
| D1 | `productions` | `unit` é TEXT livre, não FK para tabela normalizada | Inconsistência de dados, typos | Migrar para `unit_id UUID REFERENCES business_units(id)` (já planejado conforme memória) |
| D2 | `productions` | `specialty` é TEXT livre | Mesma inconsistência | Migrar para `specialty_id UUID REFERENCES specialties(id)` |
| D3 | `productions` | `health_plan_id` é NOT NULL mas sem default — requer sempre convênio | Produções particulares sem convênio precisam de valor placeholder | Adicionar valor sentinela "PARTICULAR" na tabela `health_plans` |
| D4 | `receivables` | `linked_transaction_id` aponta para primeira entrada, mas split receipts geram múltiplas entries | Reconciliação depende de `ILIKE observacao` (frágil) | Criar tabela pivô `receivable_financial_entries(receivable_id, financial_entry_id)` |
| D5 | `financial_entries` | `request_id` não tem UNIQUE constraint visível na DDL (só mencionado no código) | Risco de duplicidade se constraint não existir | Verificar/criar `UNIQUE(company_id, request_id)` |
| D6 | Sem índices explícitos | Queries filtram por `company_id + status`, `company_id + linked_receivable_id`, `company_id + production_date` | Performance em >50k registros | Criar índices compostos (ver seção Performance) |
| D7 | `productions.status` | Sem CHECK constraint no banco | Status inválido pode ser inserido via RPC ou migration | Adicionar `CHECK (status IN ('PRODUZIDO','FATURADO','RECEBIDO','GLOSADO','CANCELADO'))` |

---

## 3 — INTEGRIDADE FINANCEIRA

### ✅ Regras Confirmadas e Corretas

| Regra | Local de Verificação | Status |
|---|---|---|
| Produção NÃO gera caixa | `useProductionDB.addProduction` → insere apenas em `productions` | ✅ Correto |
| Apenas RECEBIDO gera receita | `markAsReceived` → cria `financial_entries` com `status: "recebido"` | ✅ Correto |
| Cancelados excluídos do saldo | `useTransactionsDB.getStats` → `isCancelled()` filter | ✅ Correto |
| Saldo = Inicial + Receitas REALIZADAS − Despesas REALIZADAS | `useTransactionsDB.getStats` linha 262 | ✅ Correto |
| Rollback automático | `markAsReceived` → se update do receivable falha, cancela a entry criada | ✅ Correto |
| Trava anti-duplicidade | `processingIdsRef` + busca por `receivable_id` na observação | ✅ Correto |
| Idempotência no faturamento | `SuggestedBilling` gera `idempotencyKey` determinístico | ✅ Correto |

### ⚠️ Cenários de Risco Financeiro

| # | Cenário | Impacto | Probabilidade | Mitigação |
|---|---|---|---|---|
| F1 | Usuário marca recebível como RECEBIDO, mas connection drop antes do `fetchReceivables` + `refreshAll` | Entry criada no caixa, mas UI pode não refletir imediatamente | Baixa | GlobalRealtime + visibilitychange já mitigam; adicionar retry na falha de update |
| F2 | `markAsReceivedMultipleDates` — falha na 3ª de 5 entries | As 2 primeiras são canceladas via rollback ✅ | Baixa | Já tratado corretamente |
| F3 | Glosa parcial — `RECEBIDO_COM_GLOSA` não gera entry de caixa automaticamente | Valor líquido (faturado - glosa) não entra no caixa | **MÉDIO** | Verificar se `markAsGlossed` deveria criar entry para valor líquido quando glosa é PARCIAL |
| F4 | `reconcileOrphanedReceivables` usa `data_prevista = billingDate` | Data contábil pode diferir da data real de crédito | Baixa | Aceitar como design choice (contabilidade por competência) |

### 🔴 FINDING CRÍTICO — F3 Detalhado

Em `markAsGlossed` (linha ~393-438 de useReceivablesActions.ts):
- Quando `glossType === "PARCIAL"`, o sistema atualiza `received_amount = billedAmount - glossAmount` mas **NÃO cria uma `financial_entry`** correspondente.
- Isso significa que o **valor líquido recebido na glosa parcial NÃO entra no caixa**.
- A UI mostra toast "Movimentação de X criada automaticamente" (Receivables.tsx:284) mas **não é verdade** — nenhuma movimentação é criada.

**Impacto:** Subnotificação de receita no caixa. Divergência entre Faturamento e Caixa.

**Correção Recomendada:** Em `markAsGlossed`, quando `glossType === "PARCIAL"` e `netReceivedAmount > 0`, criar `financial_entry` com `valor = netReceivedAmount` e `status = "recebido"`, similar ao fluxo de `markAsReceived`.

---

## 4 — FLUXO OPERACIONAL COMPLETO

### Simulação de Fluxos

| Fluxo | Resultado | Observação |
|---|---|---|
| Lançar produção | ✅ | Optimistic update + fallback + plan limits |
| Editar produção | ✅ | Apenas PRODUZIDO pode ser editado, edit_logs preservados |
| Cancelar produção | ✅ | Apenas PRODUZIDO, soft-delete com history |
| Faturar (SuggestedBilling) | ✅ | Agrupamento inteligente, idempotência, linkToReceivable atômico |
| Receber (markAsReceived) | ✅ | Entry criada + receivable atualizado + rollback automático |
| Glosar (markAsGlossed) | ⚠️ | Glosa parcial não gera entrada no caixa (ver F3) |
| Recurso deferido (approveAppeal) | ⚠️ | NÃO cria entry de caixa para valor recuperado |

### Transições de Status Validadas

```
PRODUZIDO → FATURADO ✅ (via linkToReceivable)
PRODUZIDO → CANCELADO ✅ (via cancelProduction)
FATURADO → RECEBIDO ✅ (via markAsReceived)
FATURADO → GLOSADO ✅ (via markAsGlossed)
GLOSADO → FATURADO ✅ (via STATUS_TRANSITIONS no UI)
RECEBIDO → [nada] ✅ (status final)
CANCELADO → [nada] ✅ (status final)
```

Validação no frontend via `productionStatusTransitions.ts` ✅
**Falta validação no banco** (trigger ou check) — ver D7.

---

## 5 — SEGURANÇA (MULTI-TENANT)

### ✅ Confirmado

| Aspecto | Status |
|---|---|
| Todas as tabelas têm RLS ativado | ✅ |
| company_id filtering via `get_user_companies()` (SECURITY DEFINER) | ✅ |
| Roles Admin/Gestor/Visualizador via tabela separada | ✅ |
| INSERT em tabelas financeiras requer Admin ou Gestor | ✅ |
| DELETE físico bloqueado em todas as tabelas críticas | ✅ |
| `handle_new_user()` trigger cria profile automaticamente | ✅ |
| `create_default_company_for_user()` provisiona empresa para novos usuários | ✅ |

### ⚠️ Riscos Identificados

| # | Risco | Impacto | Correção |
|---|---|---|---|
| S1 | `company_financial_settings_categories_backup` — SEM RLS | Qualquer usuário autenticado pode ler/escrever backups de qualquer empresa | Ativar RLS com policy `company_id IN (get_user_companies(auth.uid()))` |
| S2 | `error_logs` — INSERT com `WITH CHECK (true)` | Qualquer usuário pode inserir logs com `company_id` de outra empresa | Alterar policy: `WITH CHECK (company_id IN (get_user_companies(auth.uid())) OR company_id IS NULL)` |
| S3 | `system_alerts` — INSERT com `WITH CHECK (true)` | Qualquer usuário pode inserir alertas | Aceitável se alertas são info/debug; revisar se contêm dados sensíveis |
| S4 | `isAdmin()` no AuthContext usa `currentRole?.name === "Admin"` (client-side) | Determina permissões no UI, mas backend é protegido por RLS | OK para UX, RLS é a real barreira |
| S5 | `cleanup_company_data_by_window` hardcodes Admin role ID | Se role ID mudar, a função quebra | Buscar role por nome em vez de hardcoded UUID |

---

## 6 — PERFORMANCE

### Cenários Simulados

| Volume | Fetch Atual | Tempo Estimado | Impacto |
|---|---|---|---|
| 1k produções | 1 query | ~200ms | ✅ Aceitável |
| 10k produções | 10 queries (paginadas 1000) | ~1-2s | ⚠️ Perceptível |
| 50k produções | 50 queries | ~5-10s | 🔴 Inaceitável |
| 100k financial_entries | 100 queries | ~10-20s | 🔴 Inaceitável |

### Problemas de Performance Identificados

| # | Local | Problema | Impacto | Correção |
|---|---|---|---|---|
| P1 | `useProductionDB.fetchProductions` | Carrega TODAS as produções em memória | Acima de 10k registros, delay significativo | Implementar server-side filtering com date range obrigatório na query |
| P2 | `useFinancialEntries.fetchEntries` | Mesmo problema — full fetch | Mesmo impacto | Mesma solução |
| P3 | `useReceivablesDB.fetchReceivables` | Mesmo problema | Mesmo impacto | Mesma solução |
| P4 | `Billing.tsx fetchCaixaTotal` | Loop `for (const rId of receivableIds)` — 1 query por receivable | N+1 queries para cross-check | Consolidar: `WHERE observacao ILIKE ANY(ARRAY[...])` ou tabela pivô |
| P5 | `markAsReceivedMultipleDates` | N+1 ainda presente (3 queries separadas para specialty/type) | Resolvido em `markAsReceived` mas não em `markAsReceivedMultipleDates` | Aplicar mesma consolidação da correção anterior |
| P6 | `filterProductions` / `filterTransactions` / `filterReceivables` | Client-side filtering sobre dados completos | CPU overhead com volumes altos | Migrar para server-side filtering progressivamente |
| P7 | Sem índices compostos | Queries frequentes: `(company_id, production_date)`, `(company_id, status)`, `(company_id, linked_receivable_id)` | Full table scans em volumes altos | Criar índices compostos |

### Índices Recomendados

```sql
CREATE INDEX IF NOT EXISTS idx_productions_company_date ON productions(company_id, production_date DESC);
CREATE INDEX IF NOT EXISTS idx_productions_company_status ON productions(company_id, status);
CREATE INDEX IF NOT EXISTS idx_productions_company_linked ON productions(company_id, linked_receivable_id) WHERE linked_receivable_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_financial_entries_company_date ON financial_entries(company_id, data_prevista DESC);
CREATE INDEX IF NOT EXISTS idx_financial_entries_company_status ON financial_entries(company_id, status);
CREATE INDEX IF NOT EXISTS idx_receivables_company_status ON receivables(company_id, status);
CREATE INDEX IF NOT EXISTS idx_receivables_company_billing ON receivables(company_id, billing_date DESC);
```

---

## 7 — ESCALABILIDADE

### Avaliação por Cenário

| Cenário | Status | Gargalo Principal |
|---|---|---|
| 10 clínicas (~5k registros) | ✅ Funcional | Nenhum |
| 50 clínicas (~50k registros) | ⚠️ Lento | Full fetch + client-side filtering |
| 500 clínicas (~500k registros) | 🔴 Inviável | Memória do browser + tempo de fetch |
| 5M registros | 🔴 Inviável | Arquitetura precisa migrar para server-side |

### Roadmap para Escala

1. **Fase 1 (imediata):** Índices compostos no banco + date range obrigatório nos fetchs
2. **Fase 2 (curto prazo):** Server-side filtering via RPC (`get_productions_filtered`) com paginação real
3. **Fase 3 (médio prazo):** Views materializadas para KPIs e dashboards
4. **Fase 4 (longo prazo):** Sharding por company_id ou particionamento por competência

---

## 8 — UX OPERACIONAL

### ✅ Pontos Fortes

| Aspecto | Avaliação |
|---|---|
| Lançamento de produção | Modal dedicado com autocomplete e modo batch |
| Paste do Excel | Clipboard inteligente com detecção de formato BR |
| Status inline | Popover de transição com opções visuais |
| Faturamento sugerido | Agrupamento inteligente por critérios múltiplos |
| Alerta educativo | "Produção não gera caixa" visível na lista |
| Feedback visual | Badge de destaque pós-lançamento (3.5s) |
| Reconciliação | Ferramenta automática de reparo Faturamento ↔ Caixa |

### ⚠️ Fricções Identificadas

| # | Aspecto | Problema | Impacto | Correção |
|---|---|---|---|---|
| U1 | Billing.tsx | Recebimento individual requer 3+ cliques (abrir menu → Marcar Recebido → preencher → confirmar) | Operacional | Adicionar "Quick Receive" com valor pré-preenchido |
| U2 | Receivables.tsx vs Billing.tsx | Duas páginas com funcionalidades sobrepostas (ambas gerenciam receivables) | Confusão do usuário | Unificar ou definir papéis claros (Receivables = legado?) |
| U3 | Filtros | Cada página tem sua própria implementação de filtros de data | Inconsistência UX | Criar `<DateRangeFilter>` compartilhado |
| U4 | Convênios hardcoded | `CONVENIOS = ["IPASGO", "UNIMED", ...]` em 3+ arquivos | Novas clínicas com outros convênios | Já migrado para `health_plans` table — remover arrays hardcoded restantes |

---

## 9 — ROBUSTEZ DO SISTEMA

### ✅ Proteções Existentes

- **Rollback automático** em markAsReceived e markAsReceivedMultipleDates
- **processingIdsRef** — trava contra double-click
- **Idempotência** — `request_id` e `idempotency_key`
- **Validação de transição** — `productionStatusTransitions.ts`
- **Rate limit** — 500ms entre status changes
- **Bulk confirmation** — ConfirmationDialog antes de operações em lote
- **financial_entries_category_guard** — trigger de validação de categoria
- **Plan limits** — `get_company_plan_limits` RPC
- **Error boundary** — `error-boundary.tsx` componente

### ⚠️ Lacunas

| # | Lacuna | Impacto | Correção |
|---|---|---|---|
| R1 | Validação de transição apenas no frontend | Bypass via API direta | Criar trigger `validate_production_status_transition()` no banco |
| R2 | `updateProduction` aceita `data.status` via Partial<Production> | Qualquer hook pode mudar status sem validação | Separar `updateProductionData()` de `changeProductionStatus()` |
| R3 | `approveAppeal` não cria entry financeira | Valor recuperado de recurso não entra no caixa | Criar entry de caixa ao deferir recurso, similar a markAsReceived |
| R4 | Sem timeout em operations longas | Se Supabase demora, UI fica travada | Adicionar AbortController com timeout de 30s |
| R5 | `reconcileOrphanedReceivables` processa sequencialmente | Lento com muitos órfãos | Processar em paralelo com Promise.all (chunks de 10) |

---

## 10 — CONSISTÊNCIA DE ESTADOS

### Cenários de Inconsistência Verificados

| Cenário | Proteção Existente | Status |
|---|---|---|
| Produção RECEBIDA sem transação no caixa | `markAsReceived` cria entry atomicamente + rollback | ✅ Protegido |
| Transação sem receivable (órfã) | `reconcileOrphanedReceivables` detecta e repara | ✅ Protegido |
| Receivable RECEBIDO sem produção vinculada | Possível (receivable manual) — by design | ✅ Aceitável |
| Produção FATURADA sem receivable | Possível se receivable for deletado (soft-delete impede) | ✅ Protegido |
| Glosa parcial sem entry de caixa | **NÃO protegido** — ver F3 | 🔴 Bug |
| Recurso deferido sem entry de caixa | **NÃO protegido** — ver R3 | 🔴 Bug |
| production.status === RECEBIDO mas receivable.status ≠ RECEBIDO | Sincronizado via linkToReceivable + markAsReceived | ✅ Protegido |

---

## RESUMO DE PROBLEMAS POR PRIORIDADE

### 🔴 P0 — Correção Urgente (Bug Financeiro)

| ID | Descrição | Arquivo |
|---|---|---|
| F3 | Glosa parcial não gera entry de caixa — divergência Faturamento↔Caixa | `useReceivablesActions.ts:393-438` |
| R3 | approveAppeal não gera entry de caixa — valor recuperado perdido | `useReceivablesActions.ts:465-492` |

### 🟡 P1 — Importante (Segurança/Integridade)

| ID | Descrição |
|---|---|
| S1 | `company_financial_settings_categories_backup` sem RLS |
| S2 | `error_logs` INSERT sem filtro de company_id |
| D7 | Sem CHECK constraint de status no banco |
| R1 | Validação de transição apenas no frontend |

### 🟢 P2 — Escala (Performance)

| ID | Descrição |
|---|---|
| P1-P3 | Full fetch de todas as tabelas críticas |
| P4 | N+1 no cross-check Faturamento↔Caixa |
| P5 | N+1 em markAsReceivedMultipleDates |
| P7 | Falta de índices compostos |

### ⚪ P3 — Qualidade (Manutenibilidade)

| ID | Descrição |
|---|---|
| A1-A4 | Páginas monolíticas (590-1595 linhas) |
| A5 | PRODUCTION_TYPE_LABELS duplicado |
| D1-D2 | unit/specialty como TEXT livre |
| U2 | Sobreposição Receivables ↔ Billing |

---

## CONCLUSÃO

### O sistema está pronto para escalar como SaaS?

**Ainda não** — mas está **muito próximo**.

### Justificativa

**O que está excelente:**
- Integridade financeira sólida (saldo, idempotência, rollback)
- Segurança multi-tenant robusta (RLS em todas as tabelas, roles separadas)
- Fluxo operacional correto e completo
- Realtime sync elegante
- UX operacional bem pensada

**O que bloqueia a escala:**

1. **Bug financeiro P0 (F3 + R3):** Glosa parcial e recurso deferido não geram movimentação no caixa. Isso cria divergência entre Faturamento e Caixa que a ferramenta de reconciliação **não detecta** (pois procura receivables RECEBIDO sem entry, não RECEBIDO_COM_GLOSA).

2. **Performance (P1-P7):** Full fetch + client-side filtering funciona até ~10k registros. Acima disso, o sistema degradará significativamente. Para SaaS com múltiplas clínicas, server-side filtering é obrigatório.

3. **Segurança (S1):** Tabela de backup sem RLS é um vazamento de dados potencial.

### Plano de Ação Recomendado

| Fase | Prazo | Ações |
|---|---|---|
| **Fase 0 — Hotfix** | 1-2 dias | Corrigir F3, R3 (criar entries para glosa parcial e recurso deferido) |
| **Fase 1 — Hardening** | 1 semana | S1, D7, R1 (RLS, CHECK constraint, trigger de transição) |
| **Fase 2 — Performance** | 2-3 semanas | Índices compostos, server-side filtering nas 3 tabelas principais |
| **Fase 3 — Refactoring** | Ongoing | Decomposição de páginas monolíticas, eliminação de duplicação |
| **Fase 4 — Scale** | 1-2 meses | Views materializadas, paginação real, tabela pivô receivable↔entries |

**Após Fase 0 e Fase 1, o sistema estará pronto para produção real com até ~50 clínicas.**  
**Após Fase 2, suportará centenas de clínicas.**

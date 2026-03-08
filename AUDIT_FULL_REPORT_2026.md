# 🔍 AUDITORIA TÉCNICA COMPLETA — SALLUS FINANCE
**Data:** 2026-03-08 | **Versão:** v2.0

---

## 1️⃣ DIAGNÓSTICO TÉCNICO DO SISTEMA

### Nível de Maturidade: **Beta Avançado (7/10)**

O sistema possui uma base sólida com:
- Arquitetura multi-tenant funcional
- Autenticação/Autorização com RBAC granular
- RLS no banco de dados
- Realtime via Supabase channels
- Idempotência em inserções financeiras

### Riscos Principais
| Risco | Severidade |
|-------|-----------|
| Queries sem paginação (limite 1000 rows Supabase) | 🔴 CRÍTICO |
| health_plans sem RLS | 🔴 CRÍTICO |
| Audit log faz chamada externa (ipify.org) bloqueante | 🟡 ALTO |
| Polling de 30s no GlobalRealtimeProvider causa re-renders cascata | 🟡 ALTO |
| Hooks monolíticos (useProductionDB 852 linhas) | 🟡 MÉDIO |
| Console.logs abundantes em produção | 🟡 MÉDIO |

### Pontos Fortes
- Soft-delete (cancelamento) em vez de exclusão física
- Idempotência via `request_id` em financial_entries
- GlobalRealtimeProvider centralizado (evita listeners duplicados)
- Validação com Zod na tela de auth
- Trigger `financial_entries_category_guard` no DB para validar categorias

---

## 2️⃣ PROBLEMAS CRÍTICOS

| # | Problema | Impacto | Arquivo | Solução |
|---|---------|---------|---------|---------|
| 1 | **health_plans SEM RLS** | Qualquer usuário autenticado pode ler/escrever todos os health plans de todas as empresas | DB: `health_plans` | Criar políticas RLS |
| 2 | **Sem paginação nas queries** — `select("*")` em productions, financial_entries, receivables | Empresas com >1000 registros perdem dados silenciosamente | `useProductionDB.ts:178`, `useFinancialEntries.ts:113`, `useReceivablesDB.ts` | Implementar paginação ou `.range()` |
| 3 | **doctors RLS usa subquery quebrada** — `SELECT doctors.company_id FROM profiles` deveria usar `user_company_roles` | Doctors podem não ser acessíveis para usuários legítimos | DB: `doctors` RLS policies | Reescrever policy para usar `get_user_companies()` |
| 4 | **Audit log chama API externa** (ipify.org) em cada ação | Latência de 200-500ms em cada operação auditada; falha silenciosa se offline | `useAuditLogDB.ts:48` | Remover fetch de IP ou mover para Edge Function |
| 5 | **receivables_dupes_20260108 sem RLS** | Tabela de backup exposta publicamente | DB | Habilitar RLS ou dropar tabela |
| 6 | **company_financial_settings_categories_backup sem RLS** | Dados de backup expostos | DB | Habilitar RLS |

---

## 3️⃣ BUGS IDENTIFICADOS

### Bug 1: Polling causa re-fetch desnecessário a cada 30s
- **Arquivo:** `src/contexts/GlobalRealtimeProvider.tsx:148`
- **Causa:** O polling incrementa `version` a cada 30s mesmo sem mudanças, causando refetch de TODAS as tabelas (productions, financial_entries, receivables)
- **Impacto:** 3 queries a cada 30s por aba aberta × N usuários
- **Correção:** Usar `count` query ou checksum antes de incrementar version

### Bug 2: Console.log em produção
- **Arquivo:** `useFinancialEntries.ts:131`, `GlobalRealtimeProvider.tsx` (múltiplas linhas)
- **Causa:** Logs de debug não removidos
- **Correção:** Remover ou usar `if (import.meta.env.DEV)`

### Bug 3: `entryToTransaction` hardcoda `financialCategory: "OPERACIONAL"`
- **Arquivo:** `src/hooks/useTransactionsDB.ts:52`
- **Causa:** Não lê a categoria real do DB
- **Impacto:** DRE e relatórios que dependem de financialCategory sempre mostram OPERACIONAL
- **Correção:** Derivar de `entry.categoria` ou campo dedicado

### Bug 4: `updateProduction` armazena JSON completo no editLog
- **Arquivo:** `src/hooks/useProductionDB.ts:393-394`
- **Causa:** `previousValue: JSON.stringify(production)` armazena o objeto inteiro
- **Impacto:** Coluna `edit_logs` cresce exponencialmente, degradando performance
- **Correção:** Armazenar apenas campos alterados

### Bug 5: `filterTransactions` não exclui cancelados por padrão
- **Arquivo:** `src/hooks/useTransactionsDB.ts:184`
- **Causa:** Diferente de `filterProductions`, não tem flag `includeCancelled`
- **Impacto:** Menores — transações canceladas aparecem em filtros "todos"

### Bug 6: `paymentMethodParticular` não existe em `entryToTransaction`
- **Arquivo:** `src/hooks/useTransactionsDB.ts:240`
- **Causa:** `t.paymentMethodParticular` é lido no getStats mas nunca é setado na conversão `entryToTransaction`
- **Impacto:** Income breakdown por método de pagamento sempre retorna 0

---

## 4️⃣ PROBLEMAS DE ARQUITETURA

### 4.1 Hooks Monolíticos
| Hook | Linhas | Recomendação |
|------|--------|-------------|
| `useProductionDB.ts` | 852 | Separar em `useProductionCRUD`, `useProductionFilters`, `useProductionStats` |
| `useReceivablesDB.ts` | 1395 | Separar em módulos menores |
| `useTransactionsDB.ts` | 413 | Aceitável, mas poderia separar getStats |
| `ProductionReport.tsx` | ~2800+ | Separar em sub-componentes |

### 4.2 Camada de Abstração Redundante
`useTransactionsDB` → `useFinancialEntries` → Supabase
A camada `Transaction` duplica conceitos de `FinancialEntry` com mapeamento manual bidirecional. Considerar unificar.

### 4.3 AppContext Carrega Dados Globalmente
`AppContext` instancia `useTransactionsDB()` e `useAuditLogDB()` no nível raiz, fazendo fetch de TODOS os dados financeiros mesmo em páginas que não precisam (ex: Settings, Users).

### 4.4 Falta de Error Boundaries
Apenas `src/components/ui/error-boundary.tsx` existe mas não é usado nas rotas principais. Um erro em qualquer página derruba toda a aplicação.

---

## 5️⃣ PROBLEMAS NO BANCO DE DADOS

### 5.1 Tabelas Sem RLS (CRÍTICO)
```
health_plans                              → SEM RLS
receivables_dupes_20260108                → SEM RLS  
company_financial_settings_categories_backup → SEM RLS
```

### 5.2 Índices Recomendados
```sql
-- Consultas frequentes por company_id + data (productions, financial_entries, receivables)
CREATE INDEX IF NOT EXISTS idx_productions_company_date 
  ON productions(company_id, production_date DESC);

CREATE INDEX IF NOT EXISTS idx_financial_entries_company_date 
  ON financial_entries(company_id, data_prevista DESC);

CREATE INDEX IF NOT EXISTS idx_receivables_company_date 
  ON receivables(company_id, billing_date DESC);

-- Filtro por status (muito usado)
CREATE INDEX IF NOT EXISTS idx_productions_company_status 
  ON productions(company_id, status);

CREATE INDEX IF NOT EXISTS idx_financial_entries_company_status 
  ON financial_entries(company_id, status);

-- health_plans por empresa
CREATE INDEX IF NOT EXISTS idx_health_plans_company 
  ON health_plans(company_id);

-- doctors por empresa
CREATE INDEX IF NOT EXISTS idx_doctors_company_active 
  ON doctors(company_id, active);
```

### 5.3 RLS para doctors está incorreta
A policy usa subquery `SELECT doctors.company_id FROM profiles` que é auto-referencial e não funciona como esperado. Deveria ser:
```sql
DROP POLICY IF EXISTS "Doctors - Select by company" ON doctors;
CREATE POLICY "Doctors - Select by company" ON doctors
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_user_companies(auth.uid())));
```

### 5.4 Campo `unit` em `productions` é texto livre
Deveria ser FK para `business_units` (conforme memória do projeto). Mesmo problema com `specialty`.

---

## 6️⃣ GARGALOS DE PERFORMANCE

| # | Origem | Impacto | Solução |
|---|--------|---------|---------|
| 1 | `select("*")` carrega TODOS os registros no mount | Lento para empresas grandes; limite 1000 rows | Paginação server-side |
| 2 | Polling 30s no GlobalRealtimeProvider | 3 refetch completos a cada 30s | Remover polling; confiar no realtime |
| 3 | `ProductionReport.tsx` calcula tudo em `useMemo` | Re-calcula ~20 memos em cada mudança de filtro | Debounce nos filtros |
| 4 | `useAuditLogDB` faz fetch HTTP externo (ipify) | +200-500ms por ação auditada | Remover ou mover para server |
| 5 | `AppContext` monta dados financeiros globalmente | Fetch desnecessário em páginas admin | Lazy load por rota |
| 6 | Sem lazy loading de rotas | Bundle monolítico | `React.lazy()` + Suspense |

---

## 7️⃣ VULNERABILIDADES DE SEGURANÇA

| # | Vulnerabilidade | Impacto | Correção |
|---|----------------|---------|---------|
| 1 | `health_plans` sem RLS | Leak de dados entre empresas | Criar RLS policies |
| 2 | `receivables_dupes_20260108` sem RLS | Acesso público a backup de dados | Enable RLS + policy ou DROP |
| 3 | `isAdmin()` verifica role name no client-side | Poderia ser manipulado em memória (baixo risco com RLS) | OK com RLS ativo no DB |
| 4 | Supabase anon key exposta no código | Normal para client-side, mas RLS é essencial | Garantir RLS em TODAS as tabelas |
| 5 | `doctors` RLS policy auto-referencial | Pode negar acesso legítimo ou permitir indevido | Corrigir policy |
| 6 | Sem rate limiting em auth | Brute force possível | Configurar no Supabase Dashboard |

---

## 8️⃣ FUNCIONALIDADES INCOMPLETAS

1. **FinancialCategory sempre "OPERACIONAL"** — `entryToTransaction()` não resolve a categoria real
2. **Income breakdown por método de pagamento** — campo `paymentMethodParticular` nunca populado na conversão
3. **Migração unit/specialty para FK** — planejada mas não implementada (campos ainda são texto livre)
4. **Error boundaries** — componente existe mas não é usado nas rotas
5. **Exportação PDF** — usa jsPDF que tem limitações com caracteres especiais em português
6. **Signup desabilitado** — tela de auth só mostra login (correto para invite-only, mas sem onboarding self-service)

---

## 9️⃣ MELHORIAS ESTRATÉGICAS DE PRODUTO

1. **Paginação server-side** — Essencial para empresas reais com milhares de registros
2. **Dashboard com cache** — Implementar React Query `staleTime` para evitar refetch constante
3. **Lazy loading de rotas** — Reduzir bundle inicial de ~2MB para <500KB
4. **Notificações push** — Alertas de vencimento, glosas pendentes, etc.
5. **Multi-tab sync** — BroadcastChannel API para sincronizar entre abas sem polling
6. **Audit trail visual** — Timeline de alterações por registro (já tem dados no `history`)

---

## 🔟 CORREÇÕES PRONTAS PARA IMPLEMENTAÇÃO

### Correção 1: RLS para health_plans
```sql
ALTER TABLE health_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view health plans for their companies"
  ON health_plans FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_user_companies(auth.uid())));

CREATE POLICY "Admins and Gestors can manage health plans"
  ON health_plans FOR ALL TO authenticated
  USING (has_role_in_company(auth.uid(), company_id, 'Admin') 
      OR has_role_in_company(auth.uid(), company_id, 'Gestor'))
  WITH CHECK (has_role_in_company(auth.uid(), company_id, 'Admin') 
           OR has_role_in_company(auth.uid(), company_id, 'Gestor'));
```

### Correção 2: RLS para tabelas de backup
```sql
ALTER TABLE receivables_dupes_20260108 ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_financial_settings_categories_backup ENABLE ROW LEVEL SECURITY;
-- Nenhuma policy = ninguém acessa (seguro)
```

### Correção 3: Corrigir doctors RLS
```sql
DROP POLICY IF EXISTS "Doctors - Select by company" ON doctors;
DROP POLICY IF EXISTS "Doctors - Insert by company" ON doctors;
DROP POLICY IF EXISTS "Doctors - Update by company" ON doctors;

CREATE POLICY "Doctors - Select by company" ON doctors
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_user_companies(auth.uid())));

CREATE POLICY "Doctors - Insert by company" ON doctors
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT get_user_companies(auth.uid()))
    AND (has_role_in_company(auth.uid(), company_id, 'Admin')
      OR has_role_in_company(auth.uid(), company_id, 'Gestor')));

CREATE POLICY "Doctors - Update by company" ON doctors
  FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_user_companies(auth.uid()))
    AND (has_role_in_company(auth.uid(), company_id, 'Admin')
      OR has_role_in_company(auth.uid(), company_id, 'Gestor')));
```

### Correção 4: Índices de performance
```sql
CREATE INDEX IF NOT EXISTS idx_productions_company_date ON productions(company_id, production_date DESC);
CREATE INDEX IF NOT EXISTS idx_financial_entries_company_date ON financial_entries(company_id, data_prevista DESC);
CREATE INDEX IF NOT EXISTS idx_receivables_company_date ON receivables(company_id, billing_date DESC);
CREATE INDEX IF NOT EXISTS idx_productions_company_status ON productions(company_id, status);
CREATE INDEX IF NOT EXISTS idx_financial_entries_company_status ON financial_entries(company_id, status);
CREATE INDEX IF NOT EXISTS idx_health_plans_company ON health_plans(company_id);
CREATE INDEX IF NOT EXISTS idx_doctors_company_active ON doctors(company_id, active);
```

---

## 1️⃣1️⃣ ROADMAP PARA FINALIZAÇÃO

### FASE 1 — Correções Críticas (1-2 dias)
- [ ] Aplicar RLS em health_plans, receivables_dupes, categories_backup
- [ ] Corrigir doctors RLS
- [ ] Criar índices de performance
- [ ] Remover fetch ipify.org do audit log
- [ ] Remover console.logs de produção

### FASE 2 — Estabilização (3-5 dias)
- [ ] Implementar paginação server-side (productions, financial_entries, receivables)
- [ ] Corrigir `entryToTransaction` para popular financialCategory e paymentMethodParticular
- [ ] Remover polling 30s do GlobalRealtimeProvider
- [ ] Adicionar Error Boundaries nas rotas

### FASE 3 — Otimização (5-7 dias)
- [ ] Lazy loading de rotas com React.lazy()
- [ ] Refatorar hooks monolíticos (useProductionDB, useReceivablesDB)
- [ ] React Query staleTime para cache de dados
- [ ] Debounce em filtros de relatórios

### FASE 4 — Produção (3-5 dias)
- [ ] Migrar unit/specialty para FK (conforme plano existente)
- [ ] Testes automatizados para fluxos críticos
- [ ] Monitoramento de erros (Sentry ou similar)
- [ ] Configurar rate limiting no Supabase Auth

---

## 1️⃣2️⃣ CHECKLIST FINAL DE PRODUÇÃO

- [x] Autenticação funcional
- [x] RBAC com permissões granulares
- [x] Soft-delete em vez de exclusão física
- [x] Idempotência em inserções financeiras
- [x] Realtime sync via Supabase channels
- [ ] RLS em TODAS as tabelas ← **PENDENTE**
- [ ] Paginação server-side ← **PENDENTE**
- [ ] Índices de performance ← **PENDENTE**
- [ ] Error boundaries nas rotas ← **PENDENTE**
- [ ] Sem console.logs em produção ← **PENDENTE**
- [ ] Lazy loading de rotas ← **PENDENTE**
- [ ] Testes automatizados ← **PENDENTE**
- [ ] Monitoramento de erros ← **PENDENTE**
- [ ] Rate limiting auth ← **PENDENTE**

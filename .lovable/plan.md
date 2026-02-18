
# AUDITORIA CIRÚRGICA — Multi-Type Production Selection
**Arquivo auditado:** `src/components/production/ProductionForm.tsx` (1692 linhas)
**Arquivos de suporte:** `src/hooks/useProductionDB.ts`, `src/pages/Production.tsx`, `src/contexts/GlobalRealtimeProvider.tsx`, `src/utils/constants.ts`

---

## RESUMO EXECUTIVO

A implementação está **majoritariamente correta** e os três fluxos (single, package, multi) estão estruturalmente separados. Foram identificados **4 riscos** com severidades distintas:

1. **RISCO CRÍTICO (P0):** O batch ID é armazenado em `edit_logs` (JSONB), não no campo `notes` como especificado. A coluna `notes` da tabela `productions` **não existe no schema** — portanto a especificação original era correta ao usar `notes`... mas o schema não tem essa coluna. O código contornou isso usando `edit_logs`, mas o batchId fica inacessível por query SQL simples sem jsonb parsing.
2. **RISCO MODERADO (P1):** Ausência de proteção contra duplo-clique / retry no caminho multi-type. O `submitting` state existe, mas há uma janela de race condition no momento de toggle.
3. **RISCO BAIXO (P2):** A conversão de `competencia` MM/YYYY → YYYY-MM ocorre **apenas no path multi-type** (linha 1082-1083). No path single-type (via `onSubmit` → `addProduction`), o hook `useProductionDB.addProduction` recebe `competencia` em formato MM/YYYY e insere diretamente no banco sem conversão — **isso já existia antes e é um bug pré-existente**, não introduzido pela feature.
4. **RISCO BAIXO (P3):** O refresh automático após o bulk insert depende exclusivamente do `GlobalRealtimeProvider` (Postgres Changes listener). Se o canal WebSocket estiver degradado, a lista não vai atualizar até o próximo polling de 30s.

---

## PARTE 1 — REVISÃO ESTÁTICA: CHECKLIST COMPLETO

### A) Fluxo SINGLE (não-pacote)
**RESULTADO: OK**

**Evidência:** `ProductionForm.tsx` linhas 993–1047:
```typescript
if (isSingleNonPackage) {
  // ...validations...
  onSubmit({ productionType: type as ProductionType, ... });
  onOpenChange(false);
  return;
}
```
O `onSubmit` → `handleAddProduction` (Production.tsx L172) → `addProduction` (useProductionDB) → insert de 1 linha. Caminho inalterado.

### B) Fluxo PACKAGE (PACOTE_BOX / PACOTE_GTA)
**RESULTADO: OK**

**Evidência:** `ProductionForm.tsx` linhas 934–988:
```typescript
if (isSinglePackage) {
  // validateTotal, packageType, consultAmount, feeAmount, matmedAmount
  onSubmit({ isPackage: true, packageType: pkgType, ... });
  onOpenChange(false);
  return;
}
```
PackageFields renderizado na linha 1633, isolado dentro de `{isPackageType && ...}`. Fluxo package 100% preservado.

### C) Fluxo MULTI (N>1, não-pacote)
**RESULTADO: OK com ressalvas (ver riscos P0 e P3)**

**Evidência:** `ProductionForm.tsx` linhas 1050–1152:
- Uma única chamada `supabase.from("productions").insert(rows)` (linha 1137) — operação atômica
- `rows` é um array construído via `selectedTypes.map(...)` (linhas 1085–1135)

---

### CHECKLIST DETALHADO — PARTE 1

**1. `selectedTypes[]` e `perTypeValues{}` como fonte única de verdade**
**RESULTADO: OK**

- `selectedTypes` inicializado em L240: `useState<string[]>(["CONSULTA"])`
- `perTypeValues` inicializado em L241-243 com estrutura `{ CONSULTA: { quantity: "1", totalValue: "" } }`
- Todos os campos per-type (quantity, totalValue, examType, therapySessionType) são lidos exclusivamente de `perTypeValues[type]` nos paths de submit (L1086-1088, L1092-1095)
- Campos shared em `formData` (L246-266): productionDate, competencia, unit, specialty, doctorId, payerType, convenio, paymentMethod, notes

**2. Exclusividade dos Pacotes**
**RESULTADO: OK**

Camada 1 — `toggleType()` (L422-454):
```typescript
if (isPackage) {
  setSelectedTypes([type]);   // exclui todos os outros
  setPerTypeValues({ [type]: { quantity: "1", totalValue: "" } });
  return;
}
// Para não-pacote: limpa pacotes existentes
const hadPackage = selectedTypes.some(t => PACKAGE_PRODUCTION_TYPES.includes(t));
const base = hadPackage ? [] : selectedTypes;
```

Camada 2 — `handleSubmit()` (L934): `if (isSinglePackage)` é checado antes do path multi, então um pacote nunca entra no bulk insert.

Camada 3 — UI: Pacotes renderizados com radio-style button (L1301-1313), visualmente separados por `<Separator>` (L1282), com aviso textual (L1348-1351): *"Pacotes não podem ser combinados com outros tipos"*

**Nota:** Não há validação explícita no `handleSubmit` para bloquear `selectedTypes = ["PACOTE_BOX", "CONSULTA"]` além da lógica no toggle. Se alguém injetar estado diretamente, o path multi poderia processar um pacote como non-package. Na prática, via UI normal, isso é impossível.

**3. Bulk insert é UMA chamada única**
**RESULTADO: OK**

**Evidência:** L1137:
```typescript
const { error } = await supabase.from("productions").insert(rows);
```
Uma chamada HTTP POST. Supabase usa transação PostgreSQL implícita para arrays no insert — all-or-nothing. **Confirmado.**

**4. Refresh após bulk insert**
**RESULTADO: OK com ressalva (P3)**

O bulk insert **não chama** `fetchProductions()` diretamente. O refresh acontece via:
1. `GlobalRealtimeProvider` detecta a mudança na tabela `productions` via `postgres_changes` listener (GlobalRealtimeProvider.tsx L68-82)
2. Incrementa `version` → `useProductionDB` observa `globalVersion` (L194-196): `useEffect(() => { fetchProductions(); }, [fetchProductions, globalVersion])`

**Isso funciona quando o canal WebSocket está ativo.** O fallback é polling de 30s (GlobalRealtimeProvider.tsx L118-127). Se o canal cair por momentos, o usuário pode não ver as novas linhas imediatamente. Patch sugerido: chamar `fetchProductions()` explicitamente após o bulk insert (simples, sem risco).

**5. Toast messages**
**RESULTADO: OK**

- Multi-type (N>1): L1145: `toast.success(\`${selectedTypes.length} produções registradas com sucesso\`)`
- Erro: L1141: `toast.error("Falha ao registrar produções. Nada foi salvo.")`
- Single-type: toast vem de `useProductionDB.addProduction()` L375: `toast.success("Produção registrada com sucesso")`
- Package: também via `addProduction()` — mesmo toast

**6. Batch ID armazenado corretamente**
**RESULTADO: FAIL — Discrepância vs. especificação**

O plano original especificou que o batchId seria armazenado em `notes` com o padrão `[#BATCH:UUID]`. O código implementado armazena em `edit_logs` (L1127-1133):
```typescript
edit_logs: [{ field: "batch_id", value: batchId, createdAt: new Date().toISOString() }]
```

**Por quê:** A coluna `notes` não existe no schema da tabela `productions` (confirmado pelo schema fornecido — colunas da tabela não incluem `notes`). O código usou `edit_logs` como alternativa — que existe como coluna JSONB.

**Impacto:** A rastreabilidade funciona, mas queries SQL precisam usar `jsonb` parsing:
```sql
-- Para encontrar um batch:
SELECT * FROM productions
WHERE edit_logs @> '[{"field":"batch_id","value":"<uuid>"}]'::jsonb;
```
Em vez do simples `notes ILIKE '%BATCH%'`. Funcional, porém menos conveniente.

**Patch sugerido (P0):** Usar o campo `history` JSONB existente para armazenar o batchId de forma mais semântica, ou simplesmente aceitar o comportamento atual (edit_logs é auditável e JSONB é indexável).

**7. Campos dinâmicos não "vazam" entre tipos**
**RESULTADO: OK**

- `renderDynamicFields()` só executa quando `!isMultiType` (L1358): `{!isMultiType && renderDynamicFields()}`
- No modo multi, `renderInlineSubField(type)` (L748-862) é chamado apenas para o tipo específico (dentro do loop `nonPackageProductionTypes.map`, L1244): `{renderInlineSubField(type)}`
- Validação de EXAME em multi-type (L1061-1063): `if (type === "EXAME" && !typeValues.examType)` — verifica apenas o tipo atual no loop
- Validação de SESSAO em multi-type (L1065-1068): `if (type === "SESSAO_TERAPEUTICA" && !typeValues.therapySessionType)` — idem

**8. examType armazenado no perTypeValues["EXAME"]**
**RESULTADO: OK**

- Em single-type EXAME, o popover (L576-580) chama `updatePerTypeValue("EXAME", "examType", type)` — hardcoded para "EXAME"
- Em multi-type EXAME, inline popover (L787-789) chama `updatePerTypeValue(type, "examType", et)` onde `type === "EXAME"` — correto

---

## PARTE 2 — ROTEIRO DE TESTES MANUAIS

Execute os cenários abaixo na interface em `/production` > "Nova Produção".

| # | Cenário | Passos | Esperado | Como verificar |
|---|---|---|---|---|
| CT-01 | SINGLE CONSULTA PARTICULAR | (1) Abrir form. (2) Deixar Consulta marcada. (3) Unit=ONCOLOGIA, Comp=mês atual, Pagador=Particular, Forma=PIX. (4) Qtde=2, Valor=500. (5) Registrar. | Toast "Produção registrada com sucesso". 1 linha aparece na lista. | Ver lista imediatamente |
| CT-02 | SINGLE EXAME sem examType | (1) Marcar EXAME. (2) Preencher campos shared. (3) NÃO selecionar tipo de exame. (4) Registrar. | Toast de bloqueio: "Selecione o tipo de exame" | Form não fecha |
| CT-03 | SINGLE EXAME com examType | (1) Igual CT-02 + selecionar "Ressonância Magnética". (2) Registrar. | Produção salva, descrição = "Ressonância Magnética" | Lista + query: `SELECT description FROM productions ORDER BY created_at DESC LIMIT 1` |
| CT-04 | SINGLE SESSAO sem therapyType | (1) Marcar SESSAO_TERAPEUTICA. (2) Não selecionar tipo. (3) Registrar. | Toast "Selecione o tipo de sessão" | Form não fecha |
| CT-05 | MULTI CONSULTA+BOX+MAT_MED PARTICULAR | (1) Marcar CONSULTA (qty=1, val=200), BOX_PS (qty=1, val=150), MAT_MED (qty=1, val=100). (2) Campos shared: Unit, Comp, Particular, PIX. (3) Botão deve dizer "Registrar 3 produções". (4) Registrar. | Toast "3 produções registradas com sucesso". 3 novas linhas na lista. | `SELECT production_type, total_value FROM productions WHERE created_by='...' ORDER BY created_at DESC LIMIT 3` |
| CT-06 | MULTI EXAME+CONSULTA sem examType | (1) Marcar EXAME + CONSULTA. (2) Não selecionar tipo de exame. (3) Registrar. | Toast "Selecione o tipo de exame para Exame". CONSULTA não exige examType. | Form não fecha |
| CT-07 | MULTI EXAME+CONSULTA com examType | (1) Igual CT-06 + selecionar tipo de exame inline para EXAME. (2) Registrar. | 2 linhas salvas. EXAME com examType correto. CONSULTA sem examType. | Query: `SELECT production_type, description FROM productions ORDER BY created_at DESC LIMIT 2` |
| CT-08 | MULTI SESSAO+BOX sem therapyType | (1) Marcar SESSAO_TERAPEUTICA + BOX_PS. (2) Não selecionar tipo de sessão. (3) Registrar. | Toast bloqueio para SESSAO. BOX não é bloqueado por isso. | Form não fecha |
| CT-09 | PACOTE_BOX sozinho CONVENIO | (1) Clicar em "Pacote Box (Convênio)". (2) Verificar que outros tipos ficam desmarcados. (3) Preencher CONVENIO + valor. (4) Registrar. | Fluxo de pacote idêntico ao anterior. 1 linha com is_package=true. | `SELECT is_package, package_type FROM productions ORDER BY created_at DESC LIMIT 1` |
| CT-10 | Tentar PACOTE+CONSULTA | (1) Marcar CONSULTA. (2) Clicar em PACOTE_BOX. | CONSULTA é desmarcada automaticamente (toggle limpa selectedTypes). Aviso visual "Pacotes não combinam com outros tipos". | UI imediato — nenhuma linha do tipo CONSULTA pode coexistir com PACOTE no selectedTypes |
| CT-11 | Desmarcar o único tipo | (1) Deixar apenas CONSULTA marcada. (2) Clicar em CONSULTA para desmarcar. | CONSULTA permanece marcada (mínimo 1 obrigatório). | Evidência: toggleType L437-438: `if (next.length === 0) return;` |
| CT-12 | Validação vazia (sem unit) | (1) Abrir form. (2) Não selecionar unidade. (3) Registrar. | Toast "Preencha todos os campos obrigatórios" | L901-904 |

---

## PARTE 3 — QUERIES SQL PARA AUDITORIA DE BANCO

Execute no SQL Editor do Supabase (`vmukhcosthdzibpcdvcw`):

**Query 1 — Verificar batch multi recém-inserido:**
```sql
-- Encontrar produções de um batch (substitua pelo batchId visto no edit_logs)
SELECT
  id,
  production_type,
  quantity,
  total_value,
  unit_value,
  unit,
  competencia,
  payer_type,
  doctor_id,
  company_id,
  created_at,
  edit_logs
FROM productions
WHERE edit_logs @> '[{"field": "batch_id"}]'::jsonb
  AND created_at > now() - interval '1 hour'
ORDER BY created_at DESC;
```

**Query 2 — Confirmar atomicidade (N linhas do mesmo batch):**
```sql
-- Extrair o batchId e agrupar
SELECT
  edit_logs->0->>'value' AS batch_id,
  COUNT(*) AS linha_count,
  array_agg(production_type) AS tipos,
  COUNT(DISTINCT company_id) AS empresas_distintas,
  COUNT(DISTINCT unit) AS unidades_distintas,
  COUNT(DISTINCT competencia) AS competencias_distintas,
  SUM(total_value) AS valor_total_batch
FROM productions
WHERE edit_logs @> '[{"field": "batch_id"}]'::jsonb
  AND created_at > now() - interval '1 hour'
GROUP BY edit_logs->0->>'value'
ORDER BY MIN(created_at) DESC;
```

**Query 3 — Verificar que os campos compartilhados estão idênticos em todas as linhas do batch:**
```sql
-- Substitua 'SEU_BATCH_UUID_AQUI' pelo UUID real
WITH batch_rows AS (
  SELECT *
  FROM productions
  WHERE edit_logs @> json_build_array(
    json_build_object('field', 'batch_id', 'value', 'SEU_BATCH_UUID_AQUI')
  )::jsonb
)
SELECT
  production_type,
  production_date,
  competencia,
  unit,
  payer_type,
  convenio,
  payment_method,
  doctor_id,
  quantity,
  total_value,
  unit_value,
  status
FROM batch_rows
ORDER BY production_type;
```

**Query 4 — Verificar legado (single-type, não-pacote):**
```sql
-- Produções criadas via fluxo legado (sem batch_id no edit_logs)
SELECT id, production_type, quantity, total_value, edit_logs
FROM productions
WHERE NOT (edit_logs @> '[{"field": "batch_id"}]'::jsonb)
  AND import_source = 'manual'
  AND created_at > now() - interval '24 hours'
ORDER BY created_at DESC
LIMIT 10;
```

**Query 5 — Verificar duplicidade por retry (proteção contra duplo-submit):**
```sql
-- Detectar pares suspeitos de linhas quase-idênticas criadas em <5 segundos
SELECT
  a.id AS id_1,
  b.id AS id_2,
  a.production_type,
  a.total_value,
  a.unit,
  a.created_at AS criado_1,
  b.created_at AS criado_2,
  EXTRACT(EPOCH FROM (b.created_at - a.created_at)) AS diff_segundos
FROM productions a
JOIN productions b
  ON a.production_type = b.production_type
  AND a.unit = b.unit
  AND a.total_value = b.total_value
  AND a.company_id = b.company_id
  AND a.id < b.id
  AND b.created_at - a.created_at < interval '5 seconds'
WHERE a.created_at > now() - interval '1 hour'
ORDER BY a.created_at DESC;
```

---

## PARTE 4 — REGRESSÃO EM RELATÓRIOS/ESTATÍSTICAS

| Item | Análise estática | Status |
|---|---|---|
| **Cards de estatísticas de produção** | `ProductionStats` e `operationalStats` em `Production.tsx` (L191-239) calculam `byType[p.productionType]` — cada linha do batch tem `productionType` distinto e correto. Somas corretas. | OK |
| **Filtro por tipo** | `filterProductions({ productionType })` em `useProductionDB.ts` filtra por `p.productionType`. Linhas de batch têm tipos distintos → cada uma aparece no filtro correto. | OK |
| **Filtro por médico** | `doctor_id` propagado corretamente em `rows` (L1106): `doctor_id: formData.doctorId \|\| null` — igual para todas as linhas do batch. | OK |
| **Filtro por convênio** | `convenio` propagado na L1108 — igual em todas as linhas. | OK |
| **Faturamento Sugerido** | `/suggested-billing` usa `productions` com `status === "PRODUZIDO"` e linhas individuais. Cada linha do batch aparece separadamente como candidata ao faturamento — comportamento correto (cada tipo é uma produção independente). | OK |
| **DRE e BI** | Ambos consomem `productions` via hooks que fazem SELECT * e filtram por `company_id`. As N linhas do batch aparecem como N produções independentes — correto semanticamente. | OK |
| **Relatório de Produção** | `ProductionReport.tsx` agrega por `productionType` — linhas de batch com tipos distintos se comportam exatamente como N inserções manuais separadas. | OK |
| **Exportações** | Mesma lógica — sem impacto. | OK |
| **Realtime para outras abas** | GlobalRealtimeProvider listener em `productions` vai disparar `notifyAll()` após o bulk insert, atualizando todas as abas abertas. | OK |

---

## RISCOS REMANESCENTES E PATCHES CIRÚRGICOS

### P0 — batchId em `edit_logs`, não em `notes` (sem `notes` no schema)

**Causa:** Coluna `notes` não existe em `productions`. O código adaptou para `edit_logs`.
**Impacto:** Funcional, mas queries de rastreabilidade requerem JSONB syntax. Documentação/especificação desatualizada.
**Patch sugerido:** Nenhuma mudança de código necessária — o `edit_logs` funciona. Apenas documentar o padrão real de consulta (Query 1 e 2 acima).

### P1 — Proteção contra duplo-clique / retry

**Causa:** O estado `submitting` (L278) existe e o botão é desabilitado durante o submit (L1685). No entanto, não há proteção contra o caso onde o usuário abre o form, submete, fecha, abre de novo e submete novamente com exatamente os mesmos dados (sem idempotência).
**Impacto:** Baixo. Duplo submit de batch intencional criaria N linhas duplicadas. Não é um bug introduzido — o fluxo legado single-type também não tem idempotência.
**Patch sugerido (mínimo):** Após o bulk insert com sucesso, fechar o form imediatamente (`onOpenChange(false)` na L1146 já faz isso) e o reset do estado no `useEffect` de L343 previne resubmit. O risco real é apenas em double-click, que o `disabled={submitting}` (L1685) já cobre.

### P2 — Formato `competencia` no single-type (bug pré-existente)

**Causa:** No path multi-type, há conversão explícita: `const [mm, yyyy] = formData.competencia.split("/"); const competenciaDB = \`${yyyy}-${mm}\`` (L1082-1083). No path single-type, `competencia` é passada como MM/YYYY diretamente ao `onSubmit` → `addProduction` → insert. O banco recebe MM/YYYY em vez de YYYY-MM.
**Impacto:** Bug pré-existente antes desta feature. Não introduzido agora. Se o banco aceita ambos os formatos nas queries de filtro, pode ser silencioso.
**Patch sugerido (cirúrgico, single-type path L1026-1045):**
```typescript
// Adicionar antes do onSubmit no path single:
const [smm, syyyy] = formData.competencia.split("/");
const competenciaForDB = syyyy ? `${syyyy}-${smm}` : formData.competencia;
// Usar competenciaForDB na chamada onSubmit
```

### P3 — Refresh dependente apenas de WebSocket após bulk insert

**Causa:** O bulk insert não chama `fetchProductions()` explicitamente. Depende do `GlobalRealtimeProvider` WebSocket.
**Impacto:** Se o canal WebSocket estiver degradado no momento do insert, a lista só atualiza no próximo polling de 30s.
**Patch sugerido (uma linha):** Após `toast.success(...)` no path multi (L1145-1146), chamar `fetchProductions()` via um callback passado como prop, ou simplesmente confiar no realtime (que é o padrão já estabelecido no projeto para todos os outros fluxos).

---

## CHECKLIST FINAL CONSOLIDADO

### Parte 1 — Revisão Estática
| Item | Status | Evidência |
|---|---|---|
| Fluxo SINGLE inalterado | OK | L993-1047 |
| Fluxo PACKAGE inalterado | OK | L934-988 |
| Fluxo MULTI via bulk insert único | OK | L1137 |
| selectedTypes[] é fonte única de verdade | OK | L240-243 |
| perTypeValues{} controla qty/valor/examType/therapyType | OK | L456-461 |
| Pacotes exclusivos no toggle | OK | L422-454 |
| Pacotes exclusivos na validação submit | OK | L934 (isSinglePackage antes do multi) |
| Batch ID auditável | FAIL (não em `notes`, mas em `edit_logs`) | L1127-1133 |
| Refresh após bulk insert | OK com ressalva (P3) | GlobalRealtimeProvider |
| Toast single: mensagem legada | OK | useProductionDB L375 |
| Toast multi N>1: "N produções..." | OK | L1145 |
| Toast erro: "Falha ao registrar..." | OK | L1141 |
| EXAME bloqueia sem examType (single) | OK | L1003-1005 |
| EXAME bloqueia sem examType (multi) | OK | L1061-1063 |
| SESSAO bloqueia sem therapyType (single) | OK | L1007-1009 |
| SESSAO bloqueia sem therapyType (multi) | OK | L1065-1068 |
| examType não vaza para outros tipos | OK | renderInlineSubField por type |
| therapyType não vaza para outros tipos | OK | idem |
| Seleção mínima de 1 tipo | OK | L437-438 |
| submitting previne duplo-clique | OK | L1685 |

### Parte 4 — Regressão
| Módulo | Status |
|---|---|
| Cards/stats de produção | OK |
| Filtros (tipo, médico, convênio) | OK |
| Faturamento sugerido/recebíveis | OK |
| DRE e BI | OK |
| Relatórios e exportações | OK |
| Realtime multi-abas | OK |

---

## VEREDICTO

**AUDITORIA PARCIALMENTE APROVADA — APROVADA COM RESSALVAS**

Os fluxos legado (single + package) estão **100% preservados e inalterados**. O fluxo multi-type funciona corretamente com bulk insert atômico, validações por tipo sem vazamento, e toasts adequados.

Os 4 riscos identificados:
- **P0** (batchId em edit_logs): aceitável — funciona, apenas requer query JSONB. Documentar.
- **P1** (duplo submit): coberto pelo `disabled={submitting}`. Risco residual mínimo.
- **P2** (competencia format no single-type): **bug pré-existente**, não introduzido por esta feature. Deve ser corrigido em tarefa separada.
- **P3** (refresh dependente de WebSocket): padrão já aceito em todo o sistema. Não é regressão.

**Arquivos auditados:**
- `src/components/production/ProductionForm.tsx` @ 1692 linhas
- `src/hooks/useProductionDB.ts` @ 797 linhas
- `src/pages/Production.tsx` @ 498 linhas
- `src/contexts/GlobalRealtimeProvider.tsx`
- `src/utils/constants.ts`

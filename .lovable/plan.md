
# Pacote Box/GTA Particular - Suporte Completo

## Resumo

Hoje o sistema bloqueia pacotes (PACOTE_BOX/PACOTE_GTA) para pagador "Particular". O objetivo e permitir que pacotes sejam lancados como Particular, com a possibilidade de **zerar a consulta** (cobrando apenas taxa + mat/med), e configurar regras de precificacao para "PARTICULAR" na aba de Pacotes em Configuracoes.

## Pontos de bloqueio atuais (4 pontos)

1. **useEffect linha 423-438**: Forca `payerType = "CONVENIO"` quando pacote e selecionado
2. **Validacao submit linha 982-985**: Rejeita pacotes com pagador diferente de CONVENIO
3. **PackageFields render linha 1672-1704**: So exibe componentes se `formData.convenio` estiver preenchido (PARTICULAR nao tem convenio)
4. **Labels**: "Pacote Box (Convenio)" / "Pacote GTA (Convenio)" em 4 locais

## Alteracoes

### 1. `src/components/production/ProductionForm.tsx`

**a) Remover forcamento de payerType (linhas 423-438)**
O useEffect que forca `payerType = "CONVENIO"` sera alterado para apenas resetar os campos de breakdown (consultAmount, feeAmount, etc.) sem forcar o payerType. O usuario fica livre para escolher Convenio ou Particular.

**b) Remover bloqueio no submit (linhas 982-985)**
Remover o bloco que impede submissao quando `payerType !== "CONVENIO"`. Para PARTICULAR:
- Se houver regra configurada para planId="PARTICULAR", usar calculo automatico normalmente
- Se nao houver regra, permitir modo manual (PackageFields ja suporta isso)
- Pular a validacao `validateTotal` quando pagador for PARTICULAR sem regra configurada

**c) Ajustar submit para PARTICULAR (linhas 999-1024)**
No bloco de submit do pacote, quando `payerType === "PARTICULAR"`:
- Passar `paymentMethod` no lugar de `convenio`
- Passar `planId` como `"PARTICULAR"` para o PackageFields

**d) Ajustar renderizacao do PackageFields (linhas 1672-1704)**
Trocar a condicao `!formData.convenio` por uma logica que:
- Se CONVENIO e sem convenio selecionado: mostra aviso "Selecione o convenio"
- Se PARTICULAR: mostra PackageFields com `planId="PARTICULAR"` e modo manual ativado. O usuario pode definir consulta como R$0,00 (cobrando apenas taxa + mat/med)
- Se CONVENIO com convenio selecionado: fluxo atual normal

**e) Atualizar labels (linhas 369-371)**
De "Pacote Box (Convenio)" para "Pacote Box" e "Pacote GTA (Convenio)" para "Pacote GTA" na funcao `getDefaultDescription`.

### 2. `src/components/production/PackageFields.tsx`

**a) Label generico (linha 154)**
De "Componentes do Pacote (Convenio)" para "Componentes do Pacote".

**b) Consulta zerada**
O componente ja suporta modo manual onde o usuario pode digitar R$0,00 na consulta. Para PARTICULAR sem regra, o modo manual sera ativado automaticamente (prop `forceManual`), permitindo ao usuario definir consulta = 0 facilmente. Adicionar tambem um botao rapido "Sem consulta" que zera o campo de consulta com um clique.

### 3. `src/utils/constants.ts`

**a) Atualizar PRODUCTION_TYPE_LABELS (linhas 65-66)**
De `"Pacote Box (Convenio)"` para `"Pacote Box"` e `"Pacote GTA (Convenio)"` para `"Pacote GTA"`.

**b) Atualizar PACKAGE_TYPES (linhas 71-73)**
Mesma atualizacao nos nomes.

**c) Atualizar PACKAGE_TYPE_LABELS (linhas 75-78)**
Mesma atualizacao nos nomes.

### 4. `src/components/settings/SettingsPackagePricing.tsx`

**a) Adicionar "PARTICULAR" como opcao de plano/convenio (linha 300-315)**
No select de "Plano/Convenio", adicionar uma opcao fixa "PARTICULAR" alem dos convenios existentes (OPERADORAS). Isso permite ao usuario configurar regras de precificacao especificas para pacotes particulares (ex: consulta = 0, taxa = X).

**b) Atualizar labels de tipo de pacote (linhas 50-53)**
Remover "(Convenio)" dos labels exibidos na listagem.

**c) Atualizar titulo da secao (linha 163)**
De "Pacotes Convenio -- Parametros" para "Pacotes -- Parametros (Consulta/Taxa)".

### 5. `src/hooks/usePackagePricing.ts`

Nenhuma alteracao necessaria. O hook ja aceita qualquer `planId` string (incluindo "PARTICULAR") e busca regras normalmente. Se nao houver regra para "PARTICULAR", retorna null e o sistema cai no modo manual - comportamento correto.

## Fluxo do usuario - Particular sem consulta

```text
1. Configuracoes > Pacotes > Nova Regra
   - Plano: PARTICULAR
   - Tipo: Pacote Box
   - Consulta: R$ 0,00
   - Taxa: R$ 150,00
   - Vigencia: 01/01/2026

2. Producao > Nova Producao
   - Selecionar "Pacote Box"
   - Pagador: Particular
   - Forma de Pagamento: PIX
   - Valor Total: R$ 500,00
   - Componentes calculados automaticamente:
     Consulta: R$ 0,00 | Taxa: R$ 150,00 | Mat/Med: R$ 350,00
   - OU clicar "Sem consulta" no modo manual
```

## O que NAO muda

- Nenhum schema de banco de dados (a tabela `productions` ja aceita `payer_type = "PARTICULAR"` com `is_package = true`)
- Nenhuma RLS, trigger ou RPC
- O fluxo de convenio para pacotes continua identico
- O hook useProductionDB ja trata payment_method para PARTICULAR
- Relatorios, billing e lista nao fazem distincao de payer_type para pacotes
- Importacao CSV permanece inalterada

## Detalhes tecnicos

| Arquivo | Linhas afetadas | Tipo de mudanca |
|---------|----------------|-----------------|
| `src/components/production/ProductionForm.tsx` | ~423-438, ~982-985, ~999-1024, ~1672-1704, ~369-371 | Remover restricoes, ajustar condicional de render |
| `src/components/production/PackageFields.tsx` | ~154, novo botao "Sem consulta" | Label generico, prop forceManual, botao atalho |
| `src/utils/constants.ts` | ~65-78 | Labels sem "(Convenio)" |
| `src/components/settings/SettingsPackagePricing.tsx` | ~50-53, ~163, ~300-315 | Opcao PARTICULAR, labels genericos |

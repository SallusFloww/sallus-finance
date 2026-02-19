

# Vincular Tipo de Producao a Categoria Financeira Automaticamente

## Problema
Ao criar um novo Tipo de Producao (ex: "Parecer"), nenhuma categoria financeira correspondente e criada. Se o usuario cria a categoria manualmente depois, pode escolher `entryType = 'saida'` por engano, fazendo com que o trigger `financial_entries_category_guard()` force `type = 'saida'` nos lancamentos — quebrando a conciliacao Caixa x Faturamento.

## Solucao

Modificar o fluxo de adicao de Tipo de Producao para que, na mesma operacao atomica, tambem crie/ajuste a categoria financeira correspondente com `entryType = 'entrada'`.

**Abordagem escolhida**: Criar uma RPC no Postgres (`upsert_production_type_with_category`) que manipula ambos os arrays `production_types` e `categories` dentro da mesma transacao. O frontend chama a RPC e atualiza o estado local com o resultado.

Isso e mais seguro que manipular no frontend porque:
- Operacao atomica (ambos arrays atualizados ou nenhum)
- Sem race condition entre duas chamadas separadas
- Validacao server-side do formato dos arrays

## Mudancas

### 1. Criar RPC `upsert_production_type_with_category` (migracao SQL)

```sql
CREATE OR REPLACE FUNCTION public.upsert_production_type_with_category(
  _company_id uuid,
  _name text,
  _description text DEFAULT '',
  _desired_entry_type text DEFAULT 'entrada'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _settings RECORD;
  _prod_types jsonb;
  _categories jsonb;
  _code text;
  _prod_id text;
  _existing_prod jsonb;
  _existing_cat jsonb;
  _new_prod jsonb;
  _new_cat jsonb;
  _user_id uuid;
  _now text;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  -- Verificar permissao
  IF NOT (has_role_in_company(_user_id, _company_id, 'Admin')
          OR has_role_in_company(_user_id, _company_id, 'Gestor')) THEN
    RAISE EXCEPTION 'Sem permissao para alterar configuracoes';
  END IF;

  -- Buscar settings atual
  SELECT production_types, categories INTO _prod_types, _categories
  FROM company_financial_settings
  WHERE company_id = _company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Configuracoes da empresa nao encontradas';
  END IF;

  _prod_types := COALESCE(_prod_types, '[]'::jsonb);
  _categories := COALESCE(_categories, '[]'::jsonb);
  _now := to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"');

  -- Gerar code normalizado
  _code := upper(regexp_replace(
    translate(trim(_name), 'áàãâéèêíìîóòõôúùûçÁÀÃÂÉÈÊÍÌÎÓÒÕÔÚÙÛÇ',
                            'aaaaeeeiiioooouuucAAAAEEEIIIOOOOUUUC'),
    '[^A-Z0-9]+', '_', 'g'
  ));

  IF _code = '' OR _code IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nome invalido');
  END IF;

  _prod_id := _code;

  -- Verificar se production_type ja existe (por id/code)
  SELECT elem INTO _existing_prod
  FROM jsonb_array_elements(_prod_types) elem
  WHERE upper(elem->>'id') = _code
     OR upper(elem->>'name') = upper(trim(_name))
  LIMIT 1;

  IF _existing_prod IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Tipo de producao ja existe: ' || (_existing_prod->>'name')
    );
  END IF;

  -- Criar novo production_type
  _new_prod := jsonb_build_object(
    'id', _prod_id,
    'name', trim(_name),
    'description', NULLIF(trim(_description), ''),
    'active', true,
    'allowBatchEntry', true,
    'requiresDetail', false,
    'valueModel', 'TOTAL',
    'createdAt', _now
  );

  _prod_types := _prod_types || jsonb_build_array(_new_prod);

  -- Verificar se categoria ja existe (por code)
  SELECT elem INTO _existing_cat
  FROM jsonb_array_elements(_categories) elem
  WHERE upper(elem->>'code') = _code
  LIMIT 1;

  IF _existing_cat IS NOT NULL THEN
    -- Categoria existe: corrigir entryType se estiver vazio/nulo
    IF (_existing_cat->>'entryType') IS NULL OR (_existing_cat->>'entryType') = '' THEN
      _categories := (
        SELECT jsonb_agg(
          CASE WHEN upper(elem->>'code') = _code
               THEN elem || jsonb_build_object('entryType', _desired_entry_type)
               ELSE elem
          END
        )
        FROM jsonb_array_elements(_categories) elem
      );
    END IF;
    -- Se entryType ja tem valor, nao sobrescrever (respeitar escolha do usuario)
  ELSE
    -- Criar nova categoria como INCOME/entrada
    _new_cat := jsonb_build_object(
      'id', lower(regexp_replace(_code, '_', '-', 'g')),
      'code', _code,
      'name', trim(_name),
      'type', 'INCOME',
      'entryType', _desired_entry_type,
      'active', true,
      'isStrategic', false,
      'impactsPredictability', false,
      'internalNote', ''
    );
    _categories := _categories || jsonb_build_array(_new_cat);
  END IF;

  -- Atualizar atomicamente
  UPDATE company_financial_settings
  SET production_types = _prod_types,
      categories = _categories,
      updated_at = now()
  WHERE company_id = _company_id;

  RETURN jsonb_build_object(
    'success', true,
    'production_type', _new_prod,
    'category_code', _code,
    'production_types', _prod_types,
    'categories', _categories
  );
END;
$$;
```

### 2. Modificar `SettingsProductionTypes.tsx`

**Adicionar prop** `categories` e `onSyncComplete` para receber o estado completo apos RPC:

```typescript
interface SettingsProductionTypesProps {
  productionTypes: ProductionTypeConfig[];
  categories: Category[];          // NOVO
  productions: Production[];
  onUpdate: (types: ProductionTypeConfig[]) => void;
  onSyncComplete: (data: {       // NOVO
    productionTypes: ProductionTypeConfig[];
    categories: Category[];
  }) => void;
  onAddLog: (action: string, details: string) => void;
}
```

**Modificar `handleAddType`**: em vez de montar o objeto localmente e chamar `onUpdate`, chamar a RPC e usar o retorno para atualizar ambos os arrays:

```typescript
const handleAddType = async () => {
  const trimmed = newType.trim();
  if (!trimmed) return;

  // Validacao local (UX rapido)
  const exists = types.some(t => t.name.toLowerCase() === trimmed.toLowerCase());
  if (exists) {
    toast.error("Tipo de producao ja existe!");
    return;
  }

  try {
    const { data, error } = await supabase.rpc('upsert_production_type_with_category', {
      _company_id: currentCompany.id,
      _name: trimmed,
      _description: newDescription.trim(),
      _desired_entry_type: 'entrada',
    });

    if (error) throw error;

    const result = data as any;
    if (!result.success) {
      toast.error(result.error || 'Erro ao criar tipo');
      return;
    }

    // Atualizar estado com arrays retornados pela RPC
    onSyncComplete({
      productionTypes: result.production_types,
      categories: result.categories,
    });

    onAddLog("UPDATE_SETTINGS", `Tipo "${trimmed}" adicionado com categoria ENTRADA vinculada`);
    setNewType("");
    setNewDescription("");
    toast.success("Tipo criado e categoria vinculada como ENTRADA");
  } catch (err) {
    console.error("Erro ao criar tipo:", err);
    toast.error("Erro ao salvar. Tente novamente.");
  }
};
```

### 3. Modificar `Settings.tsx` — passar novas props

```typescript
<SettingsProductionTypes
  productionTypes={extendedSettings?.productionTypes ?? []}
  categories={settings.categories}
  productions={productions ?? []}
  onUpdate={(types) => setExtendedSettings(prev => ({ ...prev, productionTypes: types }))}
  onSyncComplete={({ productionTypes, categories }) => {
    // Atualizar ambos os arrays atomicamente no estado local
    setExtendedSettings(prev => ({ ...prev, productionTypes }));
    updateSettings({ categories });
  }}
  onAddLog={addAuditLog}
/>
```

### 4. Importar `supabase` e `useAuth` no componente

`SettingsProductionTypes` precisara de acesso ao `supabase` client e ao `currentCompany`. Adicionar:
- Import de `supabase` do client
- Prop `companyId: string` passada de `Settings.tsx`

## O que NAO muda

- Trigger `financial_entries_category_guard()` permanece inalterado
- Tipos de producao existentes nao sao alterados
- Categorias existentes nao sao sobrescritas (apenas `entryType` vazio e corrigido)
- Fluxo de edicao/toggle de tipos continua usando `onUpdate` (sem RPC)
- Lancamentos historicos (`financial_entries`, `receivables`) nao sao tocados
- Nenhuma chave de JSON e renomeada

## Resumo de arquivos

| Arquivo | Mudanca |
|---|---|
| Nova migracao SQL | RPC `upsert_production_type_with_category` |
| `src/components/settings/SettingsProductionTypes.tsx` | `handleAddType` chama RPC; novas props `companyId`, `categories`, `onSyncComplete` |
| `src/pages/Settings.tsx` | Passa novas props para `SettingsProductionTypes` |

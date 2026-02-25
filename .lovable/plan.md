

# Tornar Medico Opcional na Producao (Corrigir Trigger)

## Problema

O banco de dados possui um trigger `check_doctor_before_insert` que **bloqueia** qualquer INSERT na tabela `productions` quando `doctor_id` e NULL:

```sql
IF NEW.doctor_id IS NULL THEN
  RAISE EXCEPTION 'Producao sem medico vinculado nao e permitida.';
END IF;
```

Isso faz com que producoes sem medico aparecam momentaneamente na tela (atualizacao otimista) e depois desaparecam quando o banco rejeita o INSERT.

## Solucao

Uma unica migracao SQL para alterar a funcao do trigger, removendo a restricao de `doctor_id` obrigatorio:

```sql
CREATE OR REPLACE FUNCTION public.check_doctor_before_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- doctor_id e opcional, permitir NULL
  RETURN NEW;
END;
$$;
```

## O que muda

| Local | Alteracao |
|-------|-----------|
| Migracao SQL (trigger function) | Remove a validacao que bloqueia doctor_id NULL |

## O que NAO muda

- Nenhum arquivo de codigo frontend (o formulario ja trata medico como opcional)
- Nenhuma RLS ou outra trigger
- Nenhum outro schema ou tabela
- Dados existentes nao sao afetados
- A RPC `import_productions_batch` continuara validando medico obrigatorio para importacao CSV (regra separada, dentro da propria RPC)

## Risco

**Minimo**. A coluna `doctor_id` ja aceita NULL no schema. A unica mudanca e parar de rejeitar insercoes sem medico.


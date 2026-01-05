# QA - Fluxo de Convite

## Checklist de Validação (Executar após cada atualização)

### 1. Teste Anônimo (Navegador Limpo)
- [ ] Abrir nova aba anônima
- [ ] Acessar `https://finance.sallusflow.com.br/i/<uuid-válido>`
- [ ] **ESPERADO:** Redireciona automaticamente para `/auth?invite=<uuid>`
- [ ] **NUNCA DEVE APARECER:** `lovable.dev/login` ou qualquer página do Lovable

### 2. Teste Token Inválido
- [ ] Acessar `https://finance.sallusflow.com.br/i/abc123`
- [ ] **ESPERADO:** Tela "Convite inválido ou expirado" com:
  - Logo SallusFinance
  - Ícone de alerta
  - Botão "Ir para o Login"
  - Link de Suporte (WhatsApp)

### 3. Teste Geração de Convite
- [ ] Logar como Admin
- [ ] Ir para `/users`
- [ ] Criar novo convite
- [ ] Copiar o link gerado
- [ ] **ESPERADO:** Link no formato `https://finance.sallusflow.com.br/i/<token>`
- [ ] **NUNCA DEVE CONTER:** `lovableproject.com` ou `localhost`

### 4. Teste Fluxo Completo
- [ ] Gerar convite para email novo
- [ ] Abrir link em aba anônima
- [ ] Completar cadastro
- [ ] **ESPERADO:** Usuário criado e logado com sucesso

---

## Arquitetura de Rotas (Referência)

```
/i/:token          → InviteRedirect (PÚBLICO - SEM ProtectedRoute)
/auth              → Auth (PÚBLICO - SEM ProtectedRoute)
/onboarding        → ProtectedRoute (allowNoCompany=true)
/*                 → ProtectedRoute ou AdminRoute
```

## Guardrails Implementados

### Edge Function `send-invite`
- Domínio de produção hardcoded: `https://finance.sallusflow.com.br`
- Ignora `origin` do request (evita vazamento de preview URLs)
- Validação de APP_URL: rejeita localhost, lovable, placeholder

### Frontend `InviteRedirect`
- Validação UUID v4 no cliente
- Tela de erro amigável para tokens inválidos
- Redirect imediato para `/auth?invite=<token>`

### Frontend `Users.tsx`
- Validação do inviteUrl antes de copiar
- Fallback para produção se URL inválida

---

## Configuração Supabase Auth (Obrigatória)

| Campo          | Valor                                      |
|----------------|-------------------------------------------|
| Site URL       | `https://finance.sallusflow.com.br`       |
| Redirect URLs  | `https://finance.sallusflow.com.br/*`     |

---

## Troubleshooting

### "Redirect para lovable.dev/login"
**Causa:** Preview tentando acessar rota protegida
**Solução:** Verificar se `/i/:token` está ANTES de qualquer `ProtectedRoute` em App.tsx

### "Link contém lovableproject.com"
**Causa:** Edge function usando origin do request
**Solução:** Verificar guardrail no `send-invite/index.ts` - deve usar domínio hardcoded

### "Convite inválido" para token válido
**Causa:** Token expirado ou já aceito
**Solução:** Verificar tabela `user_invites` no banco

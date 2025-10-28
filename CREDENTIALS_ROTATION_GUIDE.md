# Guia de Rotação de Credenciais

Este guia ajudará você a revogar as credenciais comprometidas e gerar novas.

---

## 1. OpenAI API Key

### Revogar a chave antiga:
1. Acesse: https://platform.openai.com/api-keys
2. Faça login na sua conta
3. Encontre a chave que começa com `sk-proj-UYje1V87fkLtkmUm1UFz...`
4. Clique em **"Revoke"** ou no ícone de lixeira
5. Confirme a revogação

### Gerar nova chave:
1. Na mesma página, clique em **"+ Create new secret key"**
2. Dê um nome descritivo: `gmarquesimoveis-production`
3. Selecione as permissões necessárias (recomendado: apenas o necessário)
4. Copie a nova chave (ela só será mostrada uma vez!)
5. Salve em local seguro temporariamente

---

## 2. Perplexity API Key

### Revogar a chave antiga:
1. Acesse: https://www.perplexity.ai/settings/api
2. Faça login na sua conta
3. Encontre a chave que começa com `pplx-hyFFC7DBCOiOjaHDcAbA...`
4. Clique em **"Delete"** ou **"Revoke"**
5. Confirme a revogação

### Gerar nova chave:
1. Na mesma página, clique em **"Generate New API Key"**
2. Dê um nome: `gmarquesimoveis-prod`
3. Copie a nova chave
4. Salve em local seguro temporariamente

---

## 3. Supabase Database Password

### Rotacionar a senha do banco:
1. Acesse: https://supabase.com/dashboard/project/onzhqnoepxxzvqwlslya/settings/database
2. Vá para a aba **"Database"**
3. Na seção **"Connection String"**, clique em **"Reset database password"**
4. Gere uma nova senha segura
5. Copie a nova **Connection String** completa
6. Salve em local seguro temporariamente

**Formato da nova Connection String**:
```
postgresql://postgres.onzhqnoepxxzvqwlslya:[NOVA_SENHA]@aws-1-sa-east-1.pooler.supabase.com:6543/postgres
```

---

## 4. Session Secret

### Gerar novo secret:

**Opção 1 - No terminal (Node.js)**:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

**Opção 2 - No terminal (OpenSSL)**:
```bash
openssl rand -base64 64
```

**Opção 3 - Online (se não tiver acesso ao terminal)**:
- Use: https://generate-secret.vercel.app/64
- Ou qualquer gerador de strings aleatórias seguras

Copie o resultado e salve temporariamente.

---

## 5. Atualizar Variáveis de Ambiente no Easypanel

### Passo a passo:

1. Acesse o painel do Easypanel
2. Vá para o projeto `gmarquesimoveis`
3. Navegue até a seção de **Environment Variables** ou **Secrets**
4. Atualize as seguintes variáveis com os novos valores:

```bash
# OpenAI
OPENAI_API_KEY=[NOVA_CHAVE_OPENAI]

# Perplexity
PERPLEXITY_API_KEY=[NOVA_CHAVE_PERPLEXITY]

# Supabase
SUPABASE=[NOVA_CONNECTION_STRING_COMPLETA]
SUPABASE_URL=https://onzhqnoepxxzvqwlslya.supabase.co
SUPABASE_ANON_KEY=[MANTER_A_MESMA_OU_RENOVAR_TAMBÉM]

# Session
SESSION_SECRET=[NOVO_SECRET_GERADO]

# Manter as outras como estão
LOGIN=1
SENHA=1
```

5. Salve as alterações
6. **Reinicie a aplicação** ou faça um novo deploy

---

## 6. Verificação Pós-Rotação

Após atualizar todas as credenciais:

### Teste 1 - Conexão com Banco de Dados:
- Acesse a aplicação
- Tente fazer login
- Verifique se os dados são carregados corretamente

### Teste 2 - Upload de Imagens (Supabase Storage):
- Tente fazer upload de uma imagem
- Verifique se a imagem é salva no Supabase

### Teste 3 - Funcionalidades de IA:
- Teste a transcrição de áudio (OpenAI)
- Teste a busca de propriedades (Perplexity + OpenAI)

### Teste 4 - Sessões:
- Faça logout e login novamente
- Verifique se a sessão persiste após reload da página

---

## 7. Checklist Final

Marque conforme for concluindo:

- [ ] OpenAI API Key revogada
- [ ] Nova OpenAI API Key gerada
- [ ] Perplexity API Key revogada
- [ ] Nova Perplexity API Key gerada
- [ ] Senha do Supabase rotacionada
- [ ] Novo Session Secret gerado
- [ ] Todas as variáveis atualizadas no Easypanel
- [ ] Aplicação reiniciada/deployed
- [ ] Teste de banco de dados OK
- [ ] Teste de upload de imagens OK
- [ ] Teste de funcionalidades de IA OK
- [ ] Teste de sessões OK

---

## ⚠️ Importante

1. **Não compartilhe** as novas credenciais em chats, emails ou mensagens
2. **Não commite** as credenciais no repositório Git
3. **Use sempre** variáveis de ambiente do Easypanel
4. **Salve** as credenciais em um gerenciador de senhas seguro (ex: 1Password, Bitwarden, LastPass)

---

## 🔐 Boas Práticas para o Futuro

1. **Rotação Regular**: Configure lembretes para rotacionar credenciais a cada 90 dias
2. **Ambientes Separados**: Use credenciais diferentes para desenvolvimento e produção
3. **Princípio do Menor Privilégio**: Configure APIs com apenas as permissões necessárias
4. **Monitoramento**: Configure alertas de uso incomum
5. **Backup**: Mantenha backup das configurações (sem as credenciais!)

---

Se precisar de ajuda durante o processo, consulte a documentação oficial de cada serviço:
- OpenAI: https://platform.openai.com/docs
- Perplexity: https://docs.perplexity.ai
- Supabase: https://supabase.com/docs
- Easypanel: https://easypanel.io/docs

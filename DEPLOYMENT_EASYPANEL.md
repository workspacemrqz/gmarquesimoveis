# Implantação no Easypanel - Guia Completo

## Problema Corrigido

O erro que você estava enfrentando era:
```
Error: Could not find the build directory: /workspace/public
```

**Causa**: O arquivo `server/vite.ts` estava procurando os arquivos compilados em `/workspace/public`, mas o Vite os gera em `dist/public/`.

**Solução**: Corrigido o caminho em `server/vite.ts` linha 113 para:
```typescript
const distPath = path.resolve(import.meta.dirname, "..", "dist", "public");
```

## Configuração de Deployment no Easypanel

### Passo 1: Criar Aplicação no Easypanel

1. Acesse seu painel do Easypanel
2. Clique em "Create Application" ou "Nova Aplicação"
3. Conecte seu repositório Git

### Passo 2: Configurar Build Method

1. Selecione **"Buildpacks"** como método de build
2. O builder `heroku/builder:24` será automaticamente detectado via arquivo `project.toml`
3. Não é necessário configurar manualmente o buildpack

### Passo 3: Configurar Variáveis de Ambiente

Configure TODAS estas variáveis na aba "Environment":

```
NODE_ENV=production
PORT=5000
SUPABASE=postgresql://seu-usuario:sua-senha@seu-host.supabase.co:5432/postgres
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua-chave-anonima-aqui
SESSION_SECRET=uma-string-secreta-aleatoria-muito-longa
LOGIN=seu-usuario-admin
SENHA=sua-senha-admin
AI_INTEGRATIONS_OPENAI_BASE_URL=https://seu-ollama-url.com/v1
AI_INTEGRATIONS_OPENAI_API_KEY=sua-chave-ollama
PERPLEXITY_API_KEY=sua-chave-perplexity
```

**Importante**: Substitua todos os valores de exemplo pelos seus valores reais.

### Passo 4: Configurar Porta do Proxy

1. Na configuração do serviço, configure o **proxy port** para **5000**
2. Isso garante que o tráfego externo seja direcionado corretamente para sua aplicação

### Passo 5: Deploy

1. Clique em "Deploy" ou "Implantar"
2. Aguarde o processo de build completar

## Processo de Build (Automático)

O Heroku Buildpack executará automaticamente:

1. **Detecção**: Detecta Node.js 20.x pelo `package.json`
2. **Instalação**: Executa `npm ci` para instalar dependências
3. **Build**: Executa `npm run build` que compila o frontend para `dist/public/`
4. **Inicialização**: Usa o `Procfile` para executar `npm start`

## Verificação de Sucesso

Após o deploy, você deverá ver nos logs:

```
🚀 Server running on 0.0.0.0:5000
```

Se ver esta mensagem, sua aplicação está rodando corretamente!

## Troubleshooting

### Erro: "Could not find the build directory"

Se ainda ver este erro após o deploy:
- Verifique se o commit mais recente inclui a correção no `server/vite.ts`
- Force um rebuild limpando o cache no Easypanel
- Verifique os logs de build para garantir que `npm run build` foi executado

### Erro: "Connection terminated unexpectedly"

Este é um erro de conexão com o PostgreSQL:
- Verifique se a variável `SUPABASE` está correta
- Confirme que seu IP está autorizado no Supabase
- Verifique se o banco de dados está online

### Build bem-sucedido mas aplicação não inicia

- Verifique TODAS as variáveis de ambiente obrigatórias
- Confira os logs da aplicação no Easypanel
- Certifique-se de que `NODE_ENV=production` está definido

## Arquivos de Configuração

Os seguintes arquivos estão configurados para deployment:

- **`project.toml`**: Define o builder Heroku e buildpacks
- **`Procfile`**: Define o comando de start (`web: npm start`)
- **`package.json`**: Define os scripts e versões do Node.js/npm
- **`vite.config.ts`**: Configura o output do build para `dist/public/`
- **`server/vite.ts`**: Serve os arquivos estáticos de `dist/public/` em produção

## Comandos Úteis (Para Debug Local)

Para testar localmente em modo produção:

```bash
# 1. Build do frontend
npm run build

# 2. Iniciar em modo produção
NODE_ENV=production npm start
```

Se funcionar localmente, funcionará no Easypanel!

## Checklist Pré-Deploy

- [ ] Todas as variáveis de ambiente estão configuradas
- [ ] O commit mais recente está no repositório Git
- [ ] A porta do proxy está configurada para 5000
- [ ] O método de build está configurado como "Buildpacks"
- [ ] As credenciais do Supabase estão corretas

## Suporte

Se encontrar problemas:
1. Verifique os logs de build no Easypanel
2. Verifique os logs da aplicação em tempo de execução
3. Confirme que todas as variáveis de ambiente estão corretas
4. Teste localmente com `NODE_ENV=production npm start` após rodar `npm run build`

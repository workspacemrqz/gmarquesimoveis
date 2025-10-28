# Guia de Implantação - Easypanel com Buildpacks

## Problema Identificado e Corrigido

O erro `bash: line 1: tsx: command not found` ocorria durante a implantação porque o comando `tsx` não estava acessível via PATH quando executado diretamente pelo Procfile.

## Solução Aplicada

A solução foi modificar o Procfile para usar `npm start` ao invés de executar `tsx` diretamente. Quando o npm executa scripts, ele automaticamente adiciona `node_modules/.bin` ao PATH, permitindo que os executáveis instalados como o `tsx` sejam encontrados.

## Arquivos de Configuração

### 1. project.toml
Especifica os buildpacks necessários para a construção da imagem:

```toml
[_]
schema-version = "0.2"

[build]
builder = "heroku/builder:24"

[[io.buildpacks.group]]
id = "heroku/nodejs"

[[io.buildpacks.group]]
id = "heroku/procfile"
```

### 2. Procfile
Define como a aplicação deve ser iniciada em produção:
```
web: npm start
```

### 3. package.json
Configuração dos scripts e engines:
```json
{
  "engines": {
    "node": "20.x",
    "npm": "10.x"
  },
  "scripts": {
    "dev": "tsx server/index.ts",
    "build": "vite build",
    "start": "NODE_ENV=production tsx server/index.ts"
  }
}
```

**Importante**: O pacote `tsx` está incluído nas dependências de produção (não em devDependencies), pois é necessário para executar o servidor TypeScript em produção.

## Processo de Build no Easypanel

1. **Detecção**: O buildpack Node.js detecta o projeto baseado no `package.json`
2. **Instalação**: Instala Node.js 20.x e npm 10.x conforme especificado em `engines`
3. **Dependências**: Executa `npm ci` para instalar todas as dependências
4. **Build**: Executa `npm run build` que compila o frontend com Vite
5. **Prune**: Executa `npm prune` (mantém dependências de produção, incluindo `tsx`)
6. **Procfile**: O buildpack Procfile configura o processo web
7. **Start**: Em produção, executa `npm start` que por sua vez executa `tsx server/index.ts`

## Variáveis de Ambiente Necessárias

Configure as seguintes variáveis de ambiente no Easypanel antes da implantação:

### Obrigatórias:
- `SUPABASE` ou `DATABASE_URL`: URL de conexão com o banco de dados PostgreSQL
- `SESSION_SECRET`: Chave secreta para criptografia de sessões (use uma string aleatória forte)
- `LOGIN`: Nome de usuário do administrador
- `SENHA`: Senha do administrador

### Para Recursos de IA (opcionais):
- `AI_INTEGRATIONS_OPENAI_BASE_URL`: URL base da API OpenAI
- `AI_INTEGRATIONS_OPENAI_API_KEY`: Chave de API do OpenAI
- `PERPLEXITY_API_KEY`: Chave de API do Perplexity para busca AI

### Configuradas Automaticamente:
- `PORT`: Definida automaticamente pela plataforma (padrão: 5000 se não definida)
- `NODE_ENV`: Definida como `production` pelo script de start

## Como Implantar no Easypanel

### 1. Preparação do Repositório
Certifique-se de que todos os arquivos estão commitados:
```bash
git add .
git commit -m "Configure deployment for Easypanel with Heroku buildpacks"
git push
```

### 2. Configuração no Easypanel
1. Acesse o painel do Easypanel
2. Selecione o método de construção: **Buildpacks**
3. Escolha o construtor: **heroku/builder:24**
4. Configure as variáveis de ambiente listadas acima
5. Inicie a implantação

### 3. Verificação
Após a implantação bem-sucedida, você deve ver nos logs:
```
🚀 Server running on 0.0.0.0:[PORT]
```

## Estrutura do Projeto

```
├── client/           # Frontend React + Vite
├── server/           # Backend Express + TypeScript
├── shared/           # Schemas e tipos compartilhados
├── package.json      # Configuração do Node.js e scripts
├── Procfile          # Comando de inicialização
├── project.toml      # Configuração dos buildpacks
└── vite.config.ts    # Configuração do Vite
```

## Build de Produção

O processo de build:
1. **Frontend**: Vite compila o React e gera arquivos estáticos em `dist/public/`
2. **Backend**: O servidor TypeScript é executado diretamente via `tsx` (sem compilação prévia)
3. **Servir**: Em produção, o Express serve os arquivos estáticos do frontend e as rotas da API

## Troubleshooting

### "tsx: command not found"
- ✅ **Solucionado**: Use `npm start` no Procfile ao invés de `tsx` diretamente
- Verifique que `tsx` está em `dependencies` (não em `devDependencies`)

### "Cannot find module '@shared/schema'"
- Verifique que o `tsconfig.json` tem o path alias configurado
- Certifique-se que o arquivo `shared/schema.ts` existe

### "Session secret is required"
- Configure a variável de ambiente `SESSION_SECRET`

### "Database connection error"
- Verifique que `SUPABASE` ou `DATABASE_URL` está configurada corretamente
- Teste a conexão com o banco de dados

### Site não abre após deployment
- Verifique os logs de build para erros
- Confirme que todas as variáveis de ambiente estão configuradas
- Verifique que a aplicação está escutando na porta correta (variável `PORT`)

## Logs e Monitoramento

Para visualizar os logs da aplicação no Easypanel:
1. Acesse o painel do serviço
2. Vá para a aba "Logs"
3. Procure por:
   - Mensagens de inicialização do servidor
   - Erros de conexão com banco de dados
   - Requisições HTTP

## Atualizações Futuras

Para atualizar a aplicação após a primeira implantação:
1. Faça as alterações no código
2. Commit e push para o repositório
3. No Easypanel, clique em "Rebuild" ou configure deploy automático via webhook

## Suporte

Se encontrar problemas adicionais:
- Verifique os logs de build e runtime no Easypanel
- Confirme que todas as variáveis de ambiente estão configuradas
- Verifique se o Procfile e project.toml estão commitados no repositório
- Teste localmente com `npm run build && npm start` para simular produção

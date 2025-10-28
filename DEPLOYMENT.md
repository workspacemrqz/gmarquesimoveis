# Guia de Implantação - Easypanel com Buildpacks

## Problema Identificado

O erro durante a implantação ocorreu porque o arquivo `project.toml` estava configurado de forma incompleta:

```
ERROR: failed to export: determining entrypoint: tried to set web to default but it doesn't exist
```

## Causa Raiz

Quando você especifica buildpacks manualmente no `project.toml`, é necessário incluir **todos** os buildpacks necessários. O projeto estava configurado apenas com:

```toml
[[io.buildpacks.group]]
id = "heroku/nodejs"
```

Isso fazia com que o buildpack do Procfile não fosse incluído, impedindo que o processo `web` fosse configurado corretamente.

## Correção Aplicada

O arquivo `project.toml` foi atualizado para incluir o buildpack do Procfile:

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

## Arquivos de Configuração

### 1. project.toml
Especifica os buildpacks necessários para a construção da imagem.

### 2. Procfile
Define como a aplicação deve ser iniciada em produção:
```
web: NODE_ENV=production tsx server/index.ts
```

### 3. package.json
- **Node.js**: versão 20.x
- **npm**: versão 10.x
- **tsx**: incluído nas dependências (necessário para executar TypeScript em produção)

## Processo de Build

1. **Detecção**: O buildpack Node.js detecta o projeto e instala as dependências
2. **Build**: Executa `npm run build` para compilar o frontend (Vite)
3. **Procfile**: O buildpack Procfile configura o processo web
4. **Start**: Em produção, executa o comando do Procfile

## Variáveis de Ambiente Necessárias

Certifique-se de que as seguintes variáveis estão configuradas no Easypanel:

- `SESSION_SECRET`: Segredo para sessões
- `SUPABASE`: URL de conexão com o banco de dados Supabase
- `SUPABASE_ANON_KEY`: Chave anônima do Supabase
- `PORT`: Porta do servidor (geralmente definida automaticamente pela plataforma)
- `NODE_ENV`: Define automaticamente como `production` pelo Procfile

## Próximos Passos

1. Faça commit das alterações:
   ```bash
   git add project.toml
   git commit -m "Fix: Add Procfile buildpack to project.toml"
   git push
   ```

2. Execute novamente a implantação no Easypanel

3. A aplicação deve iniciar corretamente na porta definida pela variável `PORT`

## Verificação

Após a implantação bem-sucedida, você deve ver nos logs:
```
🚀 Server running on 0.0.0.0:[PORT]
```

## Suporte

Se encontrar problemas adicionais:
- Verifique os logs de build no Easypanel
- Confirme que todas as variáveis de ambiente estão configuradas
- Verifique se o Procfile e project.toml estão commitados no repositório

# BBOS — Bispo Business Operating System

Fundação do sistema operacional de negócios da Bispo Coffees. Esta primeira entrega cobre exclusivamente a operação industrial.

## Executar localmente

```bash
cp .env.example .env
docker compose up -d postgres
corepack enable
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:3001/api
- Health check: http://localhost:3001/api/health

O dashboard usa dados demonstrativos locais como fallback, portanto a interface pode ser testada mesmo antes do PostgreSQL estar disponível.

## Deploy Staging — Render

O arquivo `render.yaml` define os três recursos do primeiro ambiente online:

- `bbos-web-staging`: aplicação Next.js;
- `bbos-api-staging`: API NestJS;
- `bbos-postgres-staging`: PostgreSQL usado pelo staging.

No Render, configure os valores secretos marcados como `sync: false`:

- `NEXT_PUBLIC_API_URL`: URL pública da API, incluindo `/api`;
- `WEB_URL`: URL pública do Web, usada pelo CORS da API;
- `BBOS_STAGING_USER` e `BBOS_STAGING_PASSWORD`: acesso temporário Basic Auth do Web de staging.

O health check da API é `/api/health`. O serviço da API deve ser implantado
antes do Web e ambos devem usar o mesmo banco PostgreSQL.

Após o primeiro deploy, execute a migration de produção a partir da raiz:

```bash
pnpm db:generate
pnpm db:migrate:deploy
```

`pnpm db:migrate` continua disponível para desenvolvimento local; o comando
`pnpm db:migrate:deploy` usa `prisma migrate deploy` e não recria o banco.

O usuário e a senha temporários não são armazenados no repositório. Ao abrir
o endereço do Web staging, o navegador solicitará essas credenciais. Remova
`BBOS_STAGING_USER` e `BBOS_STAGING_PASSWORD` quando o login definitivo do
BBOS estiver disponível.

Procedimento resumido: criar os serviços a partir do `render.yaml`, preencher
as variáveis secretas no painel do Render, aguardar o health check da API,
executar `pnpm db:migrate:deploy` com a `DATABASE_URL` do staging e então
acessar o endereço do Web para o primeiro teste online.

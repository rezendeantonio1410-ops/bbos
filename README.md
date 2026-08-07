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

# BBOS: referência de publicação

Verificado em 04/11/2026 no workspace Render BBOs (`tea-d9u6dd2jobas73ee13ag`), confirmado por José Rezende.

- Repositório: https://github.com/rezendeantonio1410-ops/bbos
- Branch publicada: `release/bbos-rc1-consolidation`
- Aplicativo: https://bbos-app-rc1.onrender.com
- Serviço web: `bbos-app-rc1` / `srv-daldtlbl550s73audeq0`
- API: https://bbos-api-rc1.onrender.com
- Serviço API: `bbos-api-rc1` / `srv-dalsvqad0e5s738hi9f0`
- Ambos publicam automaticamente os commits da branch acima.
- Existem outros serviços de preview/staging: não presumir que a branch `feature/ecommerce-home-v1` representa o aplicativo RC1.

## Cadastro de celular

- Formulário: `apps/web/src/app/(system)/clientes/page.tsx`
- API: `apps/api/src/customers.controller.ts`
- Normalização e validação: `packages/shared/src/brazil-mobile.ts`
- Testes: `node --test packages/shared/tests/brazil-mobile.mjs` após build de `@bbos/shared`.
- Brasil: DDD válido + celular de 9 dígitos iniciado em 9, persistido com +55.
- A integração Bling remove o DDI em `normalizeBlingPhone` antes de enviar ao campo celular.

Antes de novas publicações, confirmar no Render a branch e o commit atuais.

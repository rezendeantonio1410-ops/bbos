# CI de rascunho Signa — validação isolada

Base: PR #67 WIP, commit 290a0a18702c9773b31c32481c29610b3839b695.

Executar `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` no GitHub Actions.

Este commit é exclusivamente de validação; **não publicar**. Não altera banco, API, pedidos, preços, pagamentos, Bling ou produção.

Gate ainda aberto: #93 requer rascunho completo no servidor, isolamento por tenant/usuário, controle de concorrência, recuperação entre dispositivos, idempotência e integração autenticada.

# BBOS — Auditoria de prontidão de integração

**Data:** 21/08/2026  
**Base auditada:** `origin/main` em `8008b7a2a31d092cde07b7ce66a8e8a20b26a0e6`  
**Escopo:** somente análise dos PRs #16–#25. Nenhum merge, rebase, resolução de conflito ou alteração funcional foi executado.

## Resumo dos PRs

| PR | Título | Branch | Dependências | Arquivos sobrepostos | Risco de conflito | Precisa rebase? | Ordem recomendada | Observações |
|---:|---|---|---|---|---|---|---:|---|
| #16 | Confirmação de Compra V2 — geração de PDF versionado | `codex/purchase-confirmation-pdf` | Compra V2 e `PurchaseConfirmationDocumentVersion` já presentes no main | `apps/api/package.json` com #24; `apps/api/src/green-coffee-purchases.controller.ts` com #19 | Médio | Sim, está 1 commit atrás; mergeable CLEAN | 5 | PDF é independente do fluxo físico, mas o controller de compras também é alterado por contatos. |
| #17 | BBOS Human Experience System 1.0 — fundação técnica | `codex/bbos-human-experience-foundation` | Nenhuma funcional | Nenhuma sobreposição direta nos PRs auditados | Baixo | Sim, está 1 commit atrás; mergeable CLEAN | 2 | Fundação de tokens/UI; não deve bloquear os módulos operacionais. |
| #18 | Gestão de corretores — interface administrativa | `codex/brokers-management-ui` | Backend `/api/brokers` já existente no main | `apps/web/src/app/(system)/cafe-verde/page.tsx` somente com futura navegação de módulos | Baixo | Sim, está 1 commit atrás; mergeable CLEAN | 3 | Tela isolada; comissão continua pertencendo à compra, não ao cadastro. |
| #19 | Gestão de contatos comerciais de fornecedores | `codex/supplier-commercial-contacts` | Supplier/SupplierContact e fluxo de compras | `apps/api/src/green-coffee-purchases.controller.ts` com #16; `apps/web/src/app/(system)/fornecedores/page.tsx` | Médio | Sim, está 1 commit atrás; mergeable CLEAN | 4 | Deve entrar antes do PDF se o PDF precisar do contato comercial atualizado. |
| #20 | BBOS Resilience — recuperação automática de cold start | `codex/staging-cold-start-resilience` | Nenhuma; **já mergeado** | `apps/web/package.json`, `apps/web/src/components/app-shell.tsx`, auth-session | Já resolvido | Não se aplica | 1 | Não é candidato a novo merge; já faz parte do histórico integrado. |
| #21 | Recebimento de Café Verde V1 — rastreabilidade e tolerância | `codex/green-coffee-receiving-v1` | Compra aprovada e modelos de recebimento | `apps/api/src/receipts.controller.ts` com #22; tela `/recebimento` | Alto | Sim, está 1 commit atrás; mergeable CLEAN | 6 | Primeiro passo do fluxo físico; integrar antes de Laboratório. |
| #22 | Laboratório e Qualidade V1 — decisão e comparação contratual | `codex/green-coffee-lab-quality-v1` | #21 e `GreenCoffeeLabSample`/`CoffeeLot` | `apps/api/src/receipts.controller.ts` com #21; nova tela `/laboratorio` | Alto | Não, alinhado ao main, mas deve aguardar #21 | 7 | É dependente conceitual e de controller de recebimentos; não integrar isoladamente antes de #21. |
| #23 | Estoque e Rastreabilidade de Café Verde V1 | `codex/green-coffee-inventory-traceability-v1` | #21/#22, CoffeeLot e movimentos | `apps/api/src/inventory.controller.ts`, tela `/estoque` | Médio/alto | Não, alinhado ao main, mas deve aguardar #21/#22 | 8 | Deve preservar a regra de que qualidade não aprovada não é disponível. |
| #24 | Produção e Blends V1 — fluxo industrial rastreável | `codex/production-blends-v1` | Estoque aprovado e saldo de CoffeeLot; idealmente #23 | `apps/api/package.json` com #16; `package.json` com #25; produção/blends | Alto | Não, alinhado ao main; revalidar após #23 | 9 | Consome lotes aprovados; não deve entrar antes da regra de disponibilidade de estoque. |
| #25 | BBOS Smoke Test — fundação de validação pós-deploy | `codex/bbos-smoke-test-foundation` | Endpoints finais disponíveis após os módulos | `package.json` com #24; docs/scripts novos | Médio | Não, alinhado ao main; rebase recomendado após #24 | 10 | Deve ser integrado depois dos endpoints que ele verifica, para evitar checks temporariamente inválidos. |

**Freshness:** comparação `git rev-list --left-right --count origin/main...PR`: #16, #17, #18, #19 e #21 estão `1 atrás / 1 à frente`; #22, #23, #24 e #25 estão alinhados ao main atual; #20 está mergeado e o head histórico não é mais uma unidade de integração.

## A. Ordem de integração recomendada

1. **#20 — resiliência/cold start**: já integrado; confirmar checks no main.
2. **#17 — foundation visual**: tokens e componentes compartilhados, sem acoplar regras de negócio.
3. **#18 — cadastros de corretores**: tela isolada e backend já presente.
4. **#19 — contatos comerciais**: consolida dados usados pela compra e pelo documento.
5. **#16 — PDF de Confirmação de Compra**: tratar o conflito pontual no controller de compras após #19.
6. **#21 — recebimento**: primeira etapa física.
7. **#22 — laboratório/qualidade**: depende dos vínculos e estados do recebimento.
8. **#23 — estoque/rastreabilidade**: consome decisão de qualidade e movimentos.
9. **#24 — produção/blends**: consome lotes aprovados e saldo confiável.
10. **#25 — smoke test**: último, para validar os endpoints efetivamente integrados.

Essa ordem segue a prioridade operacional solicitada: resiliência, fundação visual, cadastros, PDF, recebimento, laboratório, estoque, produção e smoke test.

## B. Conflitos potenciais

- **AppShell:** #20 já alterou `apps/web/src/components/app-shell.tsx`; nenhum PR aberto posterior altera o mesmo arquivo, portanto não há conflito aberto previsto.
- **`package.json` raiz:** #24 adiciona script de testes; #25 também adiciona `smoke`. Integrar #24 antes de #25 e preservar ambos os scripts.
- **`apps/api/package.json`:** #16 e #24 alteram scripts/dependências. Reaplicar as duas alterações, sem descartar nenhum comando.
- **Rotas Web:** #18 adiciona `/corretores`; #17 altera tokens/UI; #21, #22 e #23 adicionam telas distintas (`/recebimento`, `/laboratorio`, `/estoque`). Não há mesmo arquivo entre elas, mas o menu/app-shell deve ser revisado após cada integração.
- **`green-coffee-purchases.controller.ts`:** #16 e #19 modificam o mesmo controller. Este é o conflito de maior proximidade entre PDF e contatos; integrar #19 antes de #16 e preservar ambos os endpoints.
- **`receipts.controller.ts`:** #21 e #22 modificam o mesmo controller. Integrar recebimento antes de laboratório e revisar os métodos adicionados, sem resolver por remoção.
- **`inventory.controller.ts`:** #23 amplia o controller de estoque; #24 consome a disponibilidade por `CoffeeLot`, portanto validar contratos depois de #23.
- **Production/blends:** #24 concentra alterações em `production.controller.ts`, `blends.controller.ts`, páginas de produção/blends e scripts; não há sobreposição direta com #23, mas existe dependência de domínio.
- **Shared UI:** #17 altera `packages/ui` e `globals.css`; as telas operacionais usam classes/componentes existentes. Validar visual após #17, sem reescrever telas.
- **Schema Prisma:** nenhum dos PRs #16–#25 lista migration/schema alterado. Ainda assim, conferir compatibilidade dos modelos já presentes antes de integrar fluxos físicos.

Não há conflito real confirmado pelo GitHub nos PRs atualmente marcados `MERGEABLE`; os itens acima são sobreposições ou conflitos prováveis quando a ordem for aplicada.

## C. Regras de integração

- Não alterar a Ficha de Compra V2 além do que o PR específico de PDF/contatos exige.
- Não fazer merge nesta auditoria.
- Não apagar branches.
- Não resolver conflito por remoção de código.
- Não usar `ours`/`theirs` cegamente.
- Preservar `companyId`, autenticação e isolamento entre empresas.
- Preservar a cadeia de rastreabilidade Compra → Recebimento → Laboratório → Lote → Estoque → Produção.
- Após cada merge real, rodar typecheck, lint, testes e build dos pacotes afetados.

## D. Conclusão executiva

### Podem integrar diretamente (sem conflito GitHub atual)

- #17, #18, #22, #23, #24 e #25 estão marcados `MERGEABLE` pelo GitHub.
- #16, #19 e #21 também estão `MERGEABLE`, mas devem ser integrados na ordem indicada por compartilharem arquivos.
- #20 já está mergeado.

### Precisam de rebase ou atualização antes da integração final

- #16, #17, #18, #19 e #21 estão um commit atrás do `origin/main`; podem ser mergeados tecnicamente, mas recomenda-se atualizar/revalidar após os PRs precedentes.
- #25 deve ser revalidado após #24 por sobreposição no `package.json` raiz.
- #16 deve ser revalidado após #19 por sobreposição no controller de compras.
- #22 deve ser revalidado após #21 por sobreposição no controller de recebimentos.

### Conflitos reais identificados

Nenhum conflito Git foi reportado como `CONFLICTING` pelo GitHub nesta auditoria. Existem três zonas de conflito potencial que exigirão integração cuidadosa: compras (#16/#19), recebimentos (#21/#22) e scripts/package.json (#16/#24/#25).

### Maior risco

O maior risco é integrar os fluxos físicos fora de ordem e perder vínculos/contratos entre recebimento, laboratório, estoque e produção, ou resolver as sobreposições de controllers removendo lógica de company scope, autenticação ou rastreabilidade. A ordem recomendada reduz esse risco.

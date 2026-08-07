# Migração progressiva do catálogo de produtos

## Fonte oficial

O fluxo persistente é `Frontend → API → ProductsService → ProductsRepository → Prisma → PostgreSQL`. `ProductVariant.id` e `ProductVariant.sku` são as identidades operacionais do SKU.

O catálogo compartilhado demonstrativo permanece temporariamente apenas como adaptador de compatibilidade de leitura quando a API não estiver disponível. A tela `/produtos` identifica esse modo; novas gravações nunca são persistidas no adaptador.

## Compatibilidade preservada

- `ProductionOrder.productName` e `ProductionOrder.sku` permanecem durante a transição; novas integrações devem preencher `productVariantId`.
- `FinishedProduct.sku`, `name`, `line` e `packageWeightG` permanecem; novas integrações devem preencher `productVariantId`.
- Vendas ainda utiliza dataset demonstrativo com SKUs históricos `BC-*`.
- Produção ainda possui OPs demonstrativas com SKUs históricos `BC-*`, embora o wizard já leia o catálogo compartilhado.
- Estoque acabado ainda usa `FinishedProduct`; sua convergência com `ProductVariant` será uma fase posterior.
- Páginas de linha, produto e custo tentam a API persistente e usam o adaptador somente quando ela estiver indisponível.

Nenhuma referência antiga foi removida ou reescrita automaticamente.

## Regras persistentes

- SKU possui índice único global.
- Produto possui código único dentro da linha.
- Apresentação possui índice único por produto.
- A API valida Linha → apresentação antes da transação.
- Operações críticas usam transação serializável.

## Próximas migrações

1. Vincular novas OPs obrigatoriamente por `productVariantId`.
2. Vincular produto acabado por `productVariantId` e eliminar duplicação semântica após migração dos registros.
3. Migrar datasets de Vendas/Pedidos para IDs persistentes.
4. Remover o adaptador demonstrativo somente quando todos os consumidores estiverem persistentes.

# Migração progressiva de Produção para ProductVariant

## Estado auditado

- `ProductionOrder` já possuía `productVariantId` opcional, além dos snapshots legados `productName` e `sku`.
- A criação de OP usava `productName` e `sku` recebidos do cliente como identidade operacional.
- O wizard de Produção consumia `PRODUCT_CATALOG_DEMO` e escolhia SKU textual.
- `FinishedProduct` já possuía relação opcional com `ProductVariant`.
- `FinishedGoodsMovement` relacionava apenas OP e produto acabado.
- Produção, Vendas e Estoque ainda possuem datasets demonstrativos com códigos `BC-*`.

## Fonte oficial para novas OPs

Toda nova OP exige `productVariantId`. A API busca a variante persistida e valida variante, produto e linha ativos, além da apresentação permitida. `companyId`, `productName` e `sku` são derivados do catálogo; os dois últimos permanecem como snapshot de compatibilidade.

## Compatibilidade e backfill

`productVariantId` permanece anulável no schema para não invalidar OPs históricas. A migration faz backfill somente quando o SKU textual corresponde ao índice globalmente único de `ProductVariant.sku`. Sem correspondência, o registro permanece intacto e aparece em `pnpm --filter @bbos/database report:production-variants`.

`FinishedProduct` recebe o mesmo backfill seguro. Novas entradas em `FinishedGoodsMovement` carregam `productVariantId`, sem remover a relação atual com `FinishedProduct`.

## Dependências ainda legadas

- Mocks de Produção e Vendas com SKUs `BC-*`.
- Estoque acabado representado por `FinishedProduct`.
- Campos textuais `ProductionOrder.productName` e `ProductionOrder.sku`.
- Reservas de café verde ainda usam a infraestrutura existente de lotes e `ProductionConsumption`.
- O wizard preserva o modo demonstrativo operacional dos lotes enquanto o estoque real não possui dados suficientes.

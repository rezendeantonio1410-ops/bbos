# ProductVariant → Estoque de produto acabado V1

## Arquitetura reutilizada

Não foi criado um segundo estoque. `FinishedProduct` permanece como saldo por armazém e `FinishedGoodsMovement` como razão de movimentos. Para registros novos, ambos priorizam `ProductVariant.id`; SKU, nome, linha e peso permanecem snapshots legíveis.

## Saldo oficial

Cada combinação `ProductVariant + Warehouse` possui um saldo independente:

```text
physicalUnits = FinishedProduct.quantityOnHand
reservedUnits = FinishedProduct.reservedQuantity
availableUnits = physicalUnits - reservedUnits
```

Reserva não reduz o físico e nunca pode superar o saldo físico. O fluxo Pedido → Reserva permanece para uma etapa posterior.

## Conclusão de produção

A conclusão de uma OP com variante ativa usa `producedPackages` como quantidade efetivamente embalada. `finishedOutputKg` é preservado separadamente no movimento; o peso unitário vem de `ProductVariant.netWeightGrams`.

O movimento recebe tipo `PRODUCTION_IN`, `productVariantId`, `productionOrderId`, `sourceType`, `sourceId`, unidade e chave de idempotência `PRODUCTION_IN:<orderId>`. Repetir a conclusão retorna o movimento existente sem incrementar saldo, consumir lotes ou gerar custos novamente.

## Compatibilidade

- `FinishedProduct` não foi removido.
- Registros sem `productVariantId` continuam consultáveis como `legacy`.
- Tipos antigos `ENTRY`, `EXIT` e `ADJUSTMENT` permanecem no enum.
- SKUs `BC-*` e datasets demonstrativos de Vendas/Produção permanecem.
- Conclusão de OP antiga sem variante ainda pode usar `finishedProductId` legado.
- `SalesOrder` e Vendas ainda se relacionam com `FinishedProduct`; a reserva por `ProductVariant` será uma etapa posterior.

## API

- `GET /api/inventory/finished-goods`
- `GET /api/inventory/finished-goods/:productVariantId`
- `GET /api/inventory/finished-goods/:productVariantId/movements`

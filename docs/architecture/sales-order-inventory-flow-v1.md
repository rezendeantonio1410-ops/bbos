# Sales Order → Reserva → Expedição V1

## Chave operacional

Novos `SalesOrderItem` referenciam exclusivamente `ProductVariant.id`. `productName` e `sku` permanecem como snapshots de auditoria e compatibilidade com pedidos legados.

## Fluxo e estados

`DRAFT → RESERVED → PICKING → READY_TO_SHIP → INVOICED → SHIPPED → DELIVERED`.

`CONFIRMED` e `IN_PRODUCTION` são mantidos para leitura de dados antigos. A confirmação comercial leva o pedido a `CONFIRMED`; a reserva é uma operação transacional separada que leva a `RESERVED`. Transições operacionais são explícitas nos endpoints `/picking`, `/picking/confirm`, `/ready-to-ship` e `/invoice`.

## Estoque

- `ON_HAND`: `FinishedProduct.quantityOnHand` (estoque físico).
- `RESERVED`: `FinishedProduct.reservedQuantity` e reservas `ACTIVE`.
- `AVAILABLE`: `ON_HAND - RESERVED`.

Confirmação somente incrementa o reservado. Expedição cria `FinishedGoodsMovement` `SALE_OUT`, reduz o físico e consome a reserva. Cancelamento libera a reserva sem gerar saída.

## Idempotência e concorrência

Cada item possui uma reserva única (`InventoryReservation.salesOrderItemId` e `idempotencyKey`). Cada saída possui `SALE_OUT:<salesOrderItemId>`. As operações bloqueiam a linha de `FinishedProduct` com `FOR UPDATE` dentro de transação Prisma, impedindo reservas concorrentes acima do disponível.

## Compatibilidade

`FinishedProduct`, `code`, snapshots textuais e pedidos antigos sem itens continuam preservados. A migração para ProductVariant e agregações reais de vendas deve ser progressiva; não há ainda faturamento financeiro, contas a receber ou reconhecimento de receita.

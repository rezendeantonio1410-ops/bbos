# Sales Order → Inventory Reservation V1

## Estado encontrado

`SalesOrder` armazenava um único `FinishedProduct` opcional, quantidade e preço. Não existiam itens, reserva comercial, expedição transacional ou API de pedidos. `FinishedProduct` já materializava estoque físico e reservado, e `FinishedGoodsMovement` já suportava `PRODUCTION_IN` e `SALE_OUT`.

## Fluxo oficial para novos pedidos

```text
ProductVariant
  → SalesOrderItem
  → InventoryReservation (ACTIVE)
  → FinishedProduct.reservedQuantity
  → expedição
  → FinishedGoodsMovement (SALE_OUT)
  → InventoryReservation (CONSUMED)
```

`ProductVariant.id` é a chave operacional. `productName` e `sku` em `SalesOrderItem` são snapshots legíveis, nunca chaves relacionais.

## Saldos

- `physicalStock`: `FinishedProduct.quantityOnHand`.
- `reservedStock`: `FinishedProduct.reservedQuantity`, atualizado na mesma transação das reservas ativas.
- `availableStock = physicalStock - reservedStock`.

Confirmar um pedido não altera o físico. Cancelar libera somente a reserva. Expedir reduz físico e reserva na mesma quantidade.

## Idempotência

- Uma reserva por item: `SalesOrderItem.id` é único em `InventoryReservation`.
- Chave de reserva: `SALES_RESERVATION:<salesOrderItemId>`.
- Chave de saída: `SALE_OUT:<salesOrderItemId>`.
- Confirmar, cancelar ou expedir novamente retorna o estado já processado sem repetir efeito.

## Concorrência

Confirmação, cancelamento e expedição usam transação Prisma `ReadCommitted` com bloqueio pessimista PostgreSQL `SELECT ... FOR UPDATE` nos saldos de `FinishedProduct`. Os IDs são bloqueados em ordem estável para reduzir risco de deadlock. Depois do lock, a disponibilidade é relida e validada antes de qualquer incremento. Assim, dois pedidos concorrentes não conseguem reservar a mesma disponibilidade e o perdedor recebe a insuficiência estruturada após aguardar o primeiro commit.

## Rastreabilidade

`SALE_OUT` referencia `SalesOrder`, `SalesOrderItem`, `InventoryReservation`, `ProductVariant`, `FinishedProduct`, armazém, quantidade, peso, `sourceType=SALES_ORDER` e `sourceId`.

## Compatibilidade

Permanecem preservados:

- `SalesOrder.finishedProductId`, `quantity` e `unitPrice` para leitura antiga;
- `FinishedProduct` como saldo materializado;
- SKUs textuais `BC-*`;
- datasets demonstrativos de Vendas;
- pedidos antigos sem `SalesOrderItem`, apresentados como legados e não reservados automaticamente.

## API

- `GET /api/sales-orders`
- `GET /api/sales-orders/options`
- `GET /api/sales-orders/:id`
- `POST /api/sales-orders`
- `POST /api/sales-orders/:id/confirm`
- `POST /api/sales-orders/:id/cancel`
- `POST /api/sales-orders/:id/ship`
- `GET /api/inventory/finished-goods/:productVariantId`

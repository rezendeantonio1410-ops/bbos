# BBOS Storefront Resilience Standard

## Goal

External failures may delay a sale, but they must not lose, duplicate, or silently corrupt it.

## Core invariants

1. One business purchase = one `StorefrontOrder`.
2. Payment retries never create a new business order.
3. Every provider payment attempt is persisted in `StorefrontPaymentAttempt`.
4. Every write path is idempotent.
5. Webhooks are persisted before processing and are safe to replay.
6. Provider callbacks are not the only source of truth; reconciliation polls recover missed events.
7. Background work is claimed with PostgreSQL `FOR UPDATE SKIP LOCKED`.
8. A paid order cannot be created twice, invoiced twice, or shipped twice.
9. Duplicate payment approvals are isolated as an operational incident.
10. Expired freight quotes are refreshed without losing checkout data.
11. Integration work uses bounded retry/backoff; repeated failures become visible incidents.
12. Provider outages must not erase customer state.

## Payment lifecycle

`StorefrontOrder`
- AWAITING_PAYMENT
- PAID
- PREPARING
- INVOICED
- SHIPPED
- DELIVERED
- PAYMENT_FAILED / EXCEPTION / CANCELLED

`StorefrontPaymentAttempt`
- CREATING
- AWAITING_PAYMENT
- PROCESSING
- PAID
- FAILED
- CANCELLED
- EXPIRED
- ERROR

A StorefrontOrder may have many payment attempts. Only one business order is created.

## Webhook pattern

1. Receive provider event.
2. Persist `IntegrationWebhookEvent` with a deterministic hash.
3. Return HTTP 202 immediately.
4. A worker claims the event.
5. Re-read provider state.
6. Apply an idempotent state transition.
7. Mark webhook processed, ignored, or error.

## Worker pattern

- Claim work with `FOR UPDATE SKIP LOCKED`.
- Mark PROCESSING.
- Execute provider read/write.
- Commit the business transition.
- Use exponential backoff for transient failure.
- Stop after the retry ceiling and surface the incident.
- A later webhook/reconciliation may still recover a failed attempt.

## Freight

- Quotes may expire.
- Checkout auto-requotes the same carrier/service.
- Same/lower price: continue.
- Higher price: update checkout total and require confirmation.
- Customer identity/address/cart data are preserved.

## Operational health

`GET /api/storefront/operations/health` must expose:
- order status counts
- payment attempt counts
- payment failures
- webhook errors
- integration outbox failures
- shipment status counts
- duplicate paid attempts

## Release gate

Before production is considered healthy, test:

- 100 concurrent checkout requests
- repeated double-clicks
- repeated identical webhooks
- out-of-order webhooks
- Mercado Pago timeout
- Bling unavailable
- Melhor Envio unavailable
- API restart during processing
- worker restart during processing
- expired freight quote
- two payment attempts for the same order

Expected result:
- exactly one business order per purchase
- no duplicate invoice
- no duplicate shipment label
- no silently lost payment
- all recoverable failures self-heal
- unrecoverable failures become visible operational incidents

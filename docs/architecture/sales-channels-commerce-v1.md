# Canais de Venda e Commerce V1

## Separação de camadas

- **BBOS Core**: catálogo `ProductLine → Product → ProductVariant`, clientes, estoque e `SalesOrder`.
- **BBOS Gestão**: operação industrial, financeira e comercial.
- **BBOS Commerce Admin**: canais, preços por canal e indicadores online.
- **Storefront público**: camada futura, consumindo APIs do núcleo.

As camadas compartilham o mesmo estoque, clientes, ProductVariant e SalesOrder. O Commerce não cria estoque, produto ou pedido paralelo.

## Canais

`SalesChannel` suporta ECOMMERCE, B2B, DISTRIBUIDOR, CAFETERIA, ESCRITORIO, EXPORTACAO e OUTRO. `SalesOrder.salesChannelId` é opcional durante a transição para preservar pedidos legados; novas integrações devem preenchê-lo.

## Preços

`ProductPrice` relaciona `ProductVariant`, `SalesChannel`, moeda e vigência. Preços são versionados por período; não há preço global duplicado dentro do Commerce.

## Estoque único

Compra em qualquer canal cria/recebe um `SalesOrder` comum. A confirmação utiliza o fluxo existente de reserva:

`available = physical - reserved`

Nenhum canal baixa estoque físico na reserva. A baixa ocorre apenas na expedição (`SALE_OUT`).

## Indicadores

`GET /api/commerce/dashboard` separa vendas online, pedidos, ticket médio, clientes e pedidos pendentes. Conversão e carrinhos abandonados retornam `null` até existir storefront real. Sem canal ECOMMERCE cadastrado, a resposta é marcada como demo.

## Integrações futuras

O storefront poderá consumir catálogo, preços, estoque, clientes, pedidos, pagamentos e frete via APIs BBOS. Gateway, checkout, cupons, SEO e login de consumidor não fazem parte desta versão.

# Financeiro V1

## Princípio obrigatório

\`Vendas contratadas\` são pedidos comerciais confirmados. \`Receita faturada\` são pedidos em estado \`INVOICED\` e geram um \`AccountsReceivable\`. \`Caixa recebido\` só existe quando um \`Payment\` cria uma \`FinancialTransaction\` de tipo \`RECEIPT\`. Faturamento nunca aumenta caixa automaticamente.

## Entidades

- \`FinancialAccount\`: contas de caixa, banco e contas digitais.
- \`AccountsReceivable\`: valor faturado, vencimento e saldo em aberto.
- \`AccountsPayable\`: compromissos por fornecedor e centro de custo.
- \`Payment\`: recebimento/pagamento idempotente.
- \`FinancialTransaction\`: única origem para calcular saldo.

## Cálculos

\`saldo = saldo inicial + recebimentos - pagamentos + transferências + ajustes\`.

\`saldo projetado = caixa atual + recebíveis em aberto - contas a pagar em aberto\`.

Pagamentos parciais atualizam \`openAmount\` e o status para \`PARTIALLY_PAID\`; pagamentos totais levam a \`PAID\`. Idempotência é garantida por \`Payment.idempotencyKey\`.

## Integração comercial

Ao entrar em \`INVOICED\`, a \`SalesOrder\` cria um único \`AccountsReceivable\` por \`salesOrderId\`. O recebível não é considerado pago até existir um \`Payment\`.

## PostgreSQL

O schema, migration, serviços e telas foram preparados, mas a persistência real depende da disponibilidade do PostgreSQL local. Dados apresentados nas telas sem conexão são explicitamente demonstrativos.

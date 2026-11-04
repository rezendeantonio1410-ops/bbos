# Cobrança de pedido a prazo em PDF

Na lista e no detalhe de um pedido a prazo confirmado, usar **PDF de cobrança**.
O arquivo pode ser baixado e encaminhado manualmente ao cliente. Não há envio automático.

O documento consulta o título existente no contas a receber, usa seu saldo em aberto e vencimento, e inclui a NF-e de saída autorizada mais recente (número, série e chave), itens e total do pedido. Não cria títulos, não registra pagamentos e não altera vencimentos.

Não é gerado para pedidos cancelados, rascunhos, amostras, vendas à vista, moeda estrangeira, títulos quitados ou cancelados, saldo inválido, ausência de vencimento ou NF-e não autorizada/incompleta.

Pix estático em BR Code: chave CNPJ já usada pelo PDF de pedidos da Bispo, 13008726000112. O CNPJ da empresa da sessão deve corresponder à chave. Usa o saldo atual no momento de geração e referência estável do título. QR Code e copia e cola têm conteúdo idêntico. O vencimento é informativo: QR estático não expira automaticamente. A confirmação do recebimento segue o fluxo financeiro existente.

Endpoint autenticado: `GET /api/sales-orders/:id/billing/pdf`. A empresa vem da sessão e o pedido, título e NF são consultados dentro desse escopo. O PDF usa resposta privada sem cache.

Não há migração de banco nem integração de boleto bancário. O modelo atual tem um título por pedido; o documento não inventa parcelas.

Testes: `pnpm --filter @bbos/api test:sales-order-billing`.

Referência do BR Code: https://www.bcb.gov.br/content/estabilidadefinanceira/pix/Regulamento_Pix/II_ManualdePadroesparaIniciacaodoPix.pdf

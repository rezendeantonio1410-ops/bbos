# Conciliação Financeira V1

A conciliação é uma camada operacional sobre `FinancialTransaction`, `Payment`, `AccountsReceivable` e `AccountsPayable`. Ela não altera o estado financeiro do núcleo.

## Estados

- `PENDING`: movimento externo ainda sem correspondente.
- `MATCHED`: valor, direção e ao menos um contexto (referência, contraparte ou data) coincidem.
- `PARTIALLY_MATCHED`: parte do valor foi relacionada.
- `DIVERGENT`: há candidato, mas direção, valor ou contexto diverge.
- `IGNORED`: item descartado operacionalmente, com evento de auditoria.

## Fluxo

`ReconciliationItem` representa o movimento importado/registrado para conferência. `financialTransactionId` é opcional enquanto pendente e possui índice único para impedir dupla conciliação. Cada mudança grava `ReconciliationEvent`, com estado anterior, posterior, valor relacionado, diferença, ação e data.

O motor determinístico compara direção, valor, referência/documento, contraparte e janela de até três dias. Não há IA ou matching probabilístico.

Desconciliação limpa o vínculo e retorna o item a `PENDING`, sem apagar o histórico de eventos.

## API

- `GET /api/finance/reconciliation`
- `GET /api/finance/reconciliation/pending`
- `GET /api/finance/reconciliation/summary`
- `POST /api/finance/reconciliation`
- `POST /api/finance/reconciliation/:id/match`
- `POST /api/finance/reconciliation/:id/auto-match`
- `POST /api/finance/reconciliation/:id/unmatch`
- `POST /api/finance/reconciliation/:id/ignore`

As operações de vínculo, desvínculo e auditoria são transacionais e idempotentes.

## Extensão multibanco V1.1

`FinancialInstitution` representa a instituição sem limitar país ou tipo de banco. `FinancialAccount` pode apontar para uma instituição, mantém moeda própria (BRL, EUR, USD, GBP ou outra suportada), dados bancários mascarados e nunca armazena credenciais.

`BankTransaction` é a entrada externa normalizada. A chave de idempotência de importação é `financialAccountId + externalId`; cada transação externa pode ter no máximo um `ReconciliationItem`. Fontes suportadas: MANUAL, CSV, OFX, API, OPEN_BANKING e OTHER.

O matching exige compatibilidade de conta e moeda quando disponíveis. A consolidação de contas em moedas diferentes retorna `porMoeda` e não soma valores cambiais diretamente. Transferências internas devem ser classificadas futuramente como `INTERNAL_TRANSFER`, sem compor receita ou despesa.

`BankConnector` define a fronteira para futuros adapters bancários (`connect`, `syncAccounts`, `syncTransactions`, `getBalance`, `disconnect`) sem acoplar instituições ao `ReconciliationService`.

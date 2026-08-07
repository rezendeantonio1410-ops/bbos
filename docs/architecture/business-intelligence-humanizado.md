# BBOS — Business Intelligence Humanizado

## Decisão arquitetural

O Dashboard Executivo é o cockpit rápido da empresa. Sua composição visual aprovada está congelada: correções, integração e manutenção são permitidas, mas reorganizações e novos blocos analíticos exigem solicitação explícita.

O BI Executivo será uma camada analítica profunda, construída somente depois da consolidação dos módulos operacionais. Nesta fase existe apenas a rota reservada `/bi`; não há motor paralelo, IA generativa ou banco analítico separado.

## Princípio

O BBOS não deve apenas apresentar dados. Deve transformar dados em informações compreensíveis, rastreáveis e acionáveis para pessoas.

Fluxo de interpretação:

`DADO → CONTEXTO → DIAGNÓSTICO → CAUSA → IMPACTO → RECOMENDAÇÃO → AÇÃO`

Fluxo de auditoria:

`BI → KPI → causa → módulo → entidade → transação/origem`

## Fontes oficiais

| Domínio    | Fonte oficial                                     |
| ---------- | ------------------------------------------------- |
| Produtos   | Catálogo `ProductLine → Product → ProductVariant` |
| Vendas     | Performance comercial, pedidos e SKUs             |
| Produção   | OPs, batches, consumos e recursos                 |
| Estoque    | Lotes, movimentos, reservas e cobertura           |
| Custos     | Cost Events, rateios e snapshots do Cost Engine   |
| Financeiro | Caixa e resultado financeiro                      |
| Pedidos    | Demanda e atendimento                             |
| Logística  | Movimentações e entregas                          |

O BI futuro consumirá contratos publicados por esses domínios. Não deverá copiar cadastros, recalcular regras no frontend nem manter um banco paralelo nesta etapa.

## Contrato analítico mínimo

Métricas compartilhadas usam `actual`, `target`, `previous`, `variance`, `trend`, `period`, `entity` e `source`. Quando aplicável, também expõem `financialImpact`, `status` e `breakdown`.

`source` identifica domínio, entidade e referência de origem. `breakdown` mantém a mesma estrutura recursiva, permitindo aprofundamento sem perder a linhagem do dado.

## Ordem de desenvolvimento

1. Produtos / SKUs
2. Cost Engine / Centros de Custo
3. Produção
4. Estoque
5. Pedidos
6. Financeiro
7. Logística
8. Integrações
9. BI Executivo

Trading e IA autônoma permanecem fora do escopo atual.

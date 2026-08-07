# Cost Engine V1 — custeio gerencial industrial

O Cost Engine mantém três camadas independentes: custo direto, custo industrial indireto e custo corporativo. Custos corporativos não são incorporados automaticamente ao custo fabril; entram somente no custo total absorvido por meio de uma regra de rateio identificável.

## Fluxo e fonte oficial

`CostEvent → CostCenter → AllocationRule/Resource → ProductionOrder → ProductVariant`

Cada novo lançamento criado pela API de custeio exige um centro de custo ativo. Quando ligado a uma OP ou SKU, os respectivos IDs são validados. O SKU textual permanece somente como atributo legível e compatibilidade transitória.

## Fórmulas

- Depreciação por hora = `(valor de aquisição - valor residual) / (vida útil em meses × horas produtivas esperadas por mês)`.
- Manutenção por hora = `estimativa mensal de manutenção / horas produtivas esperadas por mês`.
- Energia por hora = `kWh nominal por hora × tarifa por kWh`.
- Gás por hora = `consumo por hora × tarifa da unidade de gás`.
- Custo máquina/hora = depreciação/h + manutenção/h + energia/h + gás/h + outros custos/h.
- Custo direto = café verde + perda de torra + embalagem + etiqueta + caixa + insumos diretos + mão de obra direta.
- Custo industrial real = custo direto + energia + gás + depreciação/máquina + manutenção + outros industriais + rateios industriais.
- Custo total absorvido = custo industrial real + rateio corporativo.
- Custo real por unidade = custo industrial real / unidades boas.
- Custo real por kg = custo industrial real / kg bons.
- Margem bruta = `(receita líquida - custo direto) / receita líquida`.
- Margem industrial = `(receita líquida - custo industrial real) / receita líquida`.
- Margem de contribuição = `(receita líquida - custos variáveis aplicáveis) / receita líquida`.
- Margem após rateio = `(receita líquida - custo total absorvido) / receita líquida`.

Medições reais de energia ou gás têm prioridade sobre rateios. Sem medição, o custo pode ser distribuído por kg, horas de máquina, horas de mão de obra, consumo, área, receita, percentual fixo ou unidades produzidas.

## Memória, períodos e auditoria

`CostCalculationSnapshot.composition` preserva entradas, saídas e IDs de origem do cálculo. `AllocationPeriod` usa os estados `OPEN`, `CALCULATED` e `CLOSED`; períodos fechados não devem ser recalculados automaticamente. Ajustes posteriores devem gerar novos eventos e trilha própria.

A navegação auditável é: margem → ProductVariant → OP → CostEvent → centro de custo → regra/origem. A interface não apresenta diagnóstico quando não existem eventos reais rastreáveis.

## API e telas

- `GET /api/costing/summary`
- `GET /api/costing/cost-centers`
- `GET /api/costing/cost-centers/:id`
- `GET /api/costing/resources`
- `GET /api/costing/product-variants/:id`
- `POST /api/costing/events`
- `/custos`
- `/custos/produtos/[productVariantId]`

O endpoint legado por SKU resolve primeiro o `ProductVariant.id`; não é uma chave operacional nova.

## Dados reais pendentes

Os centros e tipos de máquinas são estrutura persistida. Valores de aquisição, tarifas, orçamento, consumo, receita líquida e custos reais permanecem zerados até cadastro/apontamento real; o seed não inventa valores financeiros.

# Cost Engine V1.1 — camada operacional

O V1.1 mantém o núcleo do Cost Engine V1 e acrescenta operações gerenciais persistentes. O usuário trabalha com lançamentos, tarifas, máquinas, distribuição e fechamento; os termos contábeis permanecem nos dados de auditoria.

## Navegação

`/custos` oferece Visão Geral, Lançamentos, Centros de Custo, Máquinas e Equipamentos, Tarifas, Rateios e Fechamentos.

## Regras operacionais

- Todo novo lançamento exige centro de custo ativo.
- OP, ProductVariant, fornecedor e recurso são referências opcionais e rastreáveis.
- A competência de um período `CLOSED` rejeita novos lançamentos.
- Uma nova tarifa ativa encerra a vigência da versão anterior equivalente; o registro histórico não é sobrescrito.
- O custo máquina/hora sempre expõe depreciação, manutenção, energia, gás e outros separadamente.
- Regras de rateio preservam origem, método, base, destinos e resultados.
- Períodos operacionais usam `OPEN → CALCULATING → REVIEW → CLOSED`.

## Pré-fechamento

O fechamento é bloqueado quando existem lançamentos sem centro, tarifas necessárias ausentes, máquinas utilizadas sem parâmetros, OPs sem apontamento, custos não rateados ou SKUs produzidos sem custo calculável. O cálculo gera snapshots por OP/ProductVariant somente com kg bons e unidades efetivamente registradas.

O fechamento ocorre em transação serializável, altera regras ativas para aplicadas e torna o período imutável. Uma atualização condicional impede dois fechamentos concorrentes.

## Snapshot

Cada snapshot registra período, OP, ProductVariant, kg, unidades, custos direto/industrial/corporativo/absorvido, custos unitários, composição por tipo, IDs dos eventos e regras relacionadas. Receita e margens permanecem vazias quando a fonte comercial real ainda não está integrada.

## Dados demonstrativos

O seed estrutural cria somente centros e categorias de máquinas com valores financeiros zerados. Nenhum snapshot real recebe dados demonstrativos.

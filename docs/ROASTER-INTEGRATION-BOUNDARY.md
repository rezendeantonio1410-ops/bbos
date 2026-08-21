# Limite de integração com torradores Huno/Atilla

## O que o BBOS já possui

O núcleo industrial atual registra `ProductionOrder`, `ProductionConsumption`, `ProductionBatch`, lote de café verde, operador, máquina, início/fim da execução, pesos verde/torrado, perda, rendimento e observações. A companhia, o usuário autenticado e os eventos industriais permanecem no contexto da ordem e do lote.

## O que deverá vir do equipamento

Quando a interface oficial estiver disponível, o torrador poderá fornecer início/fim da torra, temperatura, tempo, curvas, eventos, pesos de entrada/saída, operador, programa/receita, identificador externo do batch e consumo de energia. Nenhum formato de payload é assumido nesta etapa.

## Ponto recomendado de integração

A integração deve ocorrer em um adaptador de entrada do backend, depois da autenticação e da validação da `ProductionOrder`. O adaptador deve converter o contrato oficial do equipamento para `ProductionBatch` e eventos industriais, sem acoplar o controller a um fabricante.

## Idempotência e duplicidade

O identificador externo do equipamento deve ser persistido em campo próprio quando o contrato for definido, com unicidade por empresa. Até lá, a criação de batch continua explícita pelo fluxo operacional existente. Uma repetição deve retornar o batch já criado, nunca gerar uma segunda execução ou consumir café novamente.

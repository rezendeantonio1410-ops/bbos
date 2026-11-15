# Limite de integração com torradores Huno/Atilla

## Referência operacional oficial

- Modelo do equipamento: `Atilla Huno 15 kg` (identificação técnica, não limite operacional).
- Nome exibido no BBOS: `Torrador Atilla Huno 15 kg • carga operacional 17 kg`.
- Carga operacional adotada pelo BBOS: até **17 kg de café verde por batelada**.
- Ciclo padrão: **10 minutos de torra + 2 minutos de resfriamento**.
- Cada `ProductionBatch` representa uma batelada física. O sistema sugere 17 kg e exige um novo registro para o saldo restante.
- Energia e gás são calculados pela configuração do recurso `TOR-01`. Com as tarifas vigentes, a referência apresentada é **R$ 0,28 de energia + R$ 5,19 de gás por batelada**.
- Registros legados acima de 17 kg são contabilizados por `ceil(peso verde / 17)`, preservando os eventos financeiros originais e registrando complementos auditáveis quando necessários.

## O que o BBOS já possui

O núcleo industrial atual registra `ProductionOrder`, `ProductionConsumption`, `ProductionBatch`, lote de café verde, operador, máquina, início/fim da execução, pesos verde/torrado, perda, rendimento e observações. A companhia, o usuário autenticado e os eventos industriais permanecem no contexto da ordem e do lote.

## O que deverá vir do equipamento

Quando a interface oficial estiver disponível, o torrador poderá fornecer início/fim da torra, temperatura, tempo, curvas, eventos, pesos de entrada/saída, operador, programa/receita, identificador externo do batch e consumo de energia. Nenhum formato de payload é assumido nesta etapa.

## Ponto recomendado de integração

A integração deve ocorrer em um adaptador de entrada do backend, depois da autenticação e da validação da `ProductionOrder`. O adaptador deve converter o contrato oficial do equipamento para `ProductionBatch` e eventos industriais, sem acoplar o controller a um fabricante.

## Idempotência e duplicidade

O identificador externo do equipamento deve ser persistido em campo próprio quando o contrato for definido, com unicidade por empresa. Até lá, a criação de batch continua explícita pelo fluxo operacional existente. Uma repetição deve retornar o batch já criado, nunca gerar uma segunda execução ou consumir café novamente.

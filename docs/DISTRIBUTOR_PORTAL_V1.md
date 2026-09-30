# Portal do Distribuidor — escopo V1

## Objetivo

Dar autonomia ao distribuidor sem transformar a experiência em um ERP exposto. O portal deve ser simples para comprar e, ao mesmo tempo, obedecer às regras comerciais, financeiras, fiscais e logísticas já controladas pelo BBOS.

## Princípios

- Acesso somente por convite, vinculado a um `Customer` ativo do BBOS.
- Login sem senha por código de seis dígitos enviado ao e-mail autorizado.
- Catálogo, disponibilidade e preços vindos da tabela comercial do próprio distribuidor.
- Nenhum preço pode ser digitado ou alterado pelo cliente.
- Crédito é uma condição concedida pela Bispo, não uma escolha do checkout.
- Sem crédito vigente ou suficiente, o pedido segue por Pix automaticamente.
- O distribuidor escolhe entre cotação pela plataforma Bispo, retirada na empresa ou transportadora própria.
- Na cotação pela plataforma, a contratação e a compra da etiqueta acontecem somente depois da confirmação financeira e da autorização fiscal.
- Toda ação relevante deixa trilha: usuário, data, IP resumido, versão do preço, cotação e aceite.

## Jornada do distribuidor

1. A Bispo libera o acesso dentro do cadastro do cliente.
2. O distribuidor recebe o endereço do portal e entra com e-mail + código temporário.
3. O portal apresenta catálogo B2B, estoque disponível, preço da sua tabela e quantidade mínima.
4. O distribuidor monta o pedido e vê o resumo por caixas, peso e valor.
5. O distribuidor escolhe a modalidade de entrega:
   - **Cotar pela plataforma Bispo:** o BBOS consulta as opções elegíveis para o CEP; a opção escolhida entra no total do pedido e a Bispo contrata o frete após as liberações financeira e fiscal.
   - **Retirada na Bispo Coffees:** o frete do pedido é zero e a retirada é agendada após as liberações financeira e fiscal.
   - **Transportadora do distribuidor:** o distribuidor informa a transportadora e assume contratação, custo, seguro, coleta, rastreamento e risco do transporte.
7. O BBOS resolve o pagamento:
   - crédito aprovado e disponível: mantém o prazo concedido;
   - sem crédito, crédito vencido ou limite insuficiente: gera Pix;
   - cliente inativo: bloqueia e orienta contato com a Bispo.
8. O cliente confirma a versão exata do pedido.
9. Com crédito aprovado, o pedido avança para reserva. Com Pix, permanece protegido até a confirmação do Mercado Pago.
10. Após pagamento, estoque e NF-e seguem no fluxo atual do BBOS. Etiqueta e rastreamento automáticos existem somente quando o frete foi escolhido na plataforma.

## Áreas da V1

### Início

- crédito disponível e condição concedida;
- pedidos em andamento;
- ação principal “Novo pedido”;
- avisos objetivos sobre cadastro, pagamento ou entrega.

### Novo pedido

- produtos e apresentações liberados para o canal `DISTRIBUIDOR`;
- busca, quantidade, múltiplos e disponibilidade;
- preço oficial sem campo de desconto;
- cálculo de caixas e peso;
- escolha entre cotação pela plataforma, retirada ou transportadora própria;
- cotação de frete com preço e prazo quando a plataforma for escolhida;
- resumo final e aceite.

### Pedidos

- rascunho, aguardando Pix, confirmado, em separação, faturado, enviado e entregue;
- segunda via do Pix enquanto válido;
- PDF do pedido, NF-e e rastreamento quando disponíveis;
- repetição de pedido usando preços e estoque atuais.

### Conta da empresa

- dados fiscais e endereços somente para consulta na primeira versão;
- contatos autorizados;
- solicitação de correção enviada para a equipe Bispo;
- política de crédito visível sem expor anotações internas.

## Regra financeira

```text
cliente ativo?
  não -> bloquear
  sim -> pedido a prazo?
    não -> Pix
    sim -> crédito aprovado e disponível >= total?
      sim -> prazo concedido
      não -> Pix automático
```

O aceite comercial e o pagamento são eventos diferentes. Um pedido que exige Pix pode estar aceito pelo cliente, mas não pode reservar estoque, faturar ou contratar frete antes do pagamento acreditado.

## Regra logística

- A cotação é congelada pelo identificador da `ShippingQuote` e validada novamente ao salvar o pedido.
- O frete entra no total do Pix somente quando o distribuidor escolhe uma cotação da plataforma e a Bispo fará a contratação.
- A compra da etiqueta não ocorre no checkout: ocorre após pagamento/crédito, autorização da NF-e e confirmação das dimensões finais.
- Se preço ou dimensão mudar antes da contratação, o BBOS solicita nova cotação e registra a diferença.
- Na retirada, o frete é zero e o BBOS não compra etiqueta.
- Na transportadora própria, o frete é zero no pedido, o nome da transportadora é obrigatório e o BBOS não compra etiqueta nem assume custo, seguro, rastreamento ou risco de transporte.
- A responsabilidade pela transportadora própria aparece no resumo, PDF, mensagem e termo de aceite do distribuidor.

## Segurança e escopo de acesso

- O acesso do consumidor da loja e o acesso B2B podem compartilhar a tecnologia de sessão, mas não a autorização.
- Um `DistributorPortalAccess` deve ligar e-mail, empresa BBOS, cliente e papel (`BUYER` ou `MANAGER`).
- Todas as consultas devem filtrar por `companyId` e `customerId` resolvidos da sessão; o navegador nunca escolhe esses identificadores.
- Convite, suspensão e troca de contato são ações internas auditáveis.

## Implantação sugerida

1. PIX condicional no aceite B2B e visibilidade “Aguardando Pix”.
2. Convite e login do distribuidor; painel de consulta de pedidos.
3. Catálogo e criação do pedido pelo distribuidor.
4. Cotação e seleção do frete no portal.
5. Documentos fiscais, contratação logística e recompra assistida.

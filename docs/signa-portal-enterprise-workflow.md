# Portal Signa — contrato funcional (desenvolvimento)

## Objetivo
Portal B2B da Bispo Coffees para parceiros Signa e Rodrigo. Separar destinatário fiscal, cliente final comercial e destino de entrega. Não publicar sem aprovação.

## Pedido
1. Início: seleção obrigatória do destinatário fiscal: SIGNA ou RODRIGO. A identificação fiscal real deve ser resolvida no backend por cadastro autorizado, nunca por texto livre.
2. Cliente atendido: escolha explícita entre associar cliente existente, cadastrar cliente ou "Não indicar". O cliente final não substitui o destinatário da NF-e. Sem escolha explícita, não avançar.
3. Itens: variantes, unidades, peso em kg, preço, totais, endereço/retirada, observações e condições.
4. Salvar rascunho; enviar para análise Bispo com registro de usuário, data e versão.
5. Bispo aceita ou devolve para correção. Só o aceite permite transição para produção. Após aceite, impedir edição unilateral dos itens aprovados.
6. Produção concluída -> pedido pronto -> emissão fiscal. Mostrar link DANFE/XML somente após autorização e disponibilidade do documento.
7. Após NF disponível, oferecer Pix vinculado a pedido, valor e identificação de transação. Validar webhook autenticado e consultar provedor para reconciliação; não confiar em retorno do navegador.
8. Se Pix não confirmado, permitir comprovante (PDF/JPG/PNG), com controle de tamanho, verificação de arquivo, armazenamento privado, autorização e trilha de auditoria. Comprovante significa "em análise", nunca "pago".
9. Expedição/retirada conforme pagamento confirmado ou condição comercial expressamente autorizada.

## Modelo de dados
- sales_order.bill_to_customer_id: obrigatório, cadastrado e autorizado (Signa/Rodrigo)
- sales_order.end_customer_id: opcional; persistir decisão explícita mesmo se nulo
- end_customer.source_partner_id, company_id e localização (cidade, UF, CEP) para relatórios
- order_events: estado anterior/novo, ator, horário, motivo
- payment_attempts: provedor, referência externa, valor, status e idempotência
- payment_proofs: arquivo privado, usuário, data, revisão, resultado
Aplicar migrações aditivas e retrocompatíveis. Não alterar dados de pedidos antigos implicitamente.

## Relatórios
Por período, mês, destinatário fiscal, cliente comercial, produto, linha, cidade, UF, status, kg pedidos, kg aprovados, kg produzidos, kg faturados, kg entregues, receita faturada, recebimentos, pendências, frequência, ticket médio, ranking e evolução. Mapas apenas para endereços conhecidos; não inferir localização de pedidos sem cliente identificado. Exportação CSV/XLSX e PDF com filtros e origem dos dados.

## Critérios de aceite
- Pedido não avança sem escolha Signa/Rodrigo e decisão explícita sobre cliente final.
- Seleção fiscal é persistida e usada na emissão, não apenas exibida na UI.
- Pedido não entra em produção sem aceite Bispo.
- NF não aparece antes de autorização.
- Pix pago somente após verificação confiável.
- Comprovante não liquida recebível automaticamente.
- Acesso segregado por parceiro, empresa e papel; trilha de auditoria.
- Testes automatizados para transições, autorização, idempotência, relatórios e migração.

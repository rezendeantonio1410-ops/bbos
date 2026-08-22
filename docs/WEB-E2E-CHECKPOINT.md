# BBOS — checkpoint do primeiro teste Web

Roteiro curto para validar o fluxo operacional no staging. Use uma sessão real, uma empresa real e registre o identificador retornado em cada etapa. Não crie dados automaticamente.

| Checkpoint | Ação do usuário | Resultado esperado / persistência | Próximo passo |
| --- | --- | --- | --- |
| 1. Login | Entrar com credenciais de staging | Sessão criada; `/api/auth/me` retorna usuário e `companyId` | Abrir o BBOS |
| 2. Fornecedor/Fazenda | Abrir Café Verde → Fornecedores; localizar/criar o fornecedor de teste e uma unidade PR | Supplier e unidade ativa persistidos na empresa | Cadastrar contato |
| 3. Contato comercial | Adicionar contato, definir principal e autorização quando aplicável | SupplierContact ativo persistido | Nova compra |
| 4. Nova compra | Informar origem, safra 2026/27, Arábica/IPR 99, Natural, 60 kg e R$ 40/kg | Compra criada com número e status de aprovação | Aprovar |
| 5. Aprovação | Aprovar a compra com usuário autorizado | decisão, ator e horário auditados | Gerar documento |
| 6. PDF | Gerar/baixar a confirmação | versão imutável, snapshot e hash persistidos | Registrar entrega |
| 7. Recebimento | Registrar entrada física de 60 kg (ou parcial) | recebimento vinculado à compra, saldo e tolerância calculados | Enviar amostra |
| 8. Laboratório | Abrir a amostra e informar umidade, defeitos, peneira e pontuação | comparação contratual persistida | Decidir qualidade |
| 9. Aprovação de qualidade | Aprovar, aprovar com ressalva (com observação) ou reprovar | CoffeeLot muda para liberado ou bloqueado conforme decisão | Consultar estoque |
| 10. Estoque | Abrir Estoque e localizar o lote | somente lote aprovado com saldo positivo aparece como disponível | Criar blend |
| 11. Blend | Criar receita com componentes que somem 100% | Blend persistido e necessidade calculável | Abrir produção |
| 12. Ordem de produção | Selecionar blend, quantidade e lotes aprovados | ordem valida saldo e empresa | Iniciar consumo |
| 13. Consumo | Registrar o consumo efetivo | ProductionConsumption reduz saldo sem permitir negativo | Concluir batch |
| 14. ProductionBatch | Informar peso verde e torrado | perda kg, perda % e rendimento calculados no backend | Encerrar teste |

Dados sugeridos para digitação manual: Produtor Teste BBOS / Fazenda Teste / PR / Norte Pioneiro do Paraná / São Jerônimo da Serra / 2026/27 / Arábica / IPR 99 / Natural / Especial / 84 pontos / 12% / 26 defeitos / 2 sacas de 30 kg / R$ 40/kg.

Em qualquer etapa, confirme empresa, usuário responsável, identificador gerado e ausência de duplicação após refresh/reenvio.

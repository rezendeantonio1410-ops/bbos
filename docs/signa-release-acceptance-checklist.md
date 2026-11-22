# Signa — checklist de aceite antes da publicação integral

> Estado em 22/11/2026. A PR #67 permanece WIP e **não deve ser publicada** sem aceite completo.
> A entrega antecipada do Reserva 500 g/1 kg é isolada na PR #70 e deve seguir seu próprio rito de testes.

## Registro incremental — 22/11/2026

### Avanço incremental: relatórios, navegação e identidade — 22/11/2026

- [x] **Catálogo Reserva em produção (leitura de banco)**: migração `20261122153000_signa_reserva_500_1000` concluída em 22/11 às 15:56 UTC, sem rollback registrado; SKUs `RAR-WLR-250`, `RAR-WLR-500`, `RAR-WLR-1000` ativos no catálogo e preço exclusivo Signa, respectivamente R$ 38,00, R$ 76,80 e R$ 148,00. Ainda não significa pedido real autenticado testado.
- [x] **Filtro anual de relatórios corrigido em código**: consulta parametrizada aplica o mesmo intervalo anual a totais mensais, produtos e regiões. O frontend solicita dados novos a cada troca de ano; exportação é explicitamente CSV **mensal**. Foram criados testes de validação de ano e limites de período e incluídos em `pnpm test`.
- [x] **Identidade Bispo / Signa ajustada em código**: cabeçalho Bispo legível sobre fundo claro, painel empresarial neutro e remoção do segundo bloco de boas-vindas da Signa. Atalhos de módulos ainda inexistentes deixam de direcionar a seções incorretas e aparecem desativados.
- [ ] **Gate obrigatório**: validar GitHub Actions no SHA final desta branch, resolver divergência/conflitos com release e executar testes completos autenticados, migração em ambiente isolado e aprovação visual. Nenhum novo deploy destes módulos está autorizado.


- **Reserva**: hotfix PR #70 mesclada na release (merge `880283eb`), com workflow de CI aprovado para o head `ff4ef9f`. A entrega antecipada **não autoriza** publicar o restante desta PR.
- **Datas dos pedidos Signa**: foi identificado um regex incorreto com `\\d` literal no validador. A validação foi extraída para `isValidPartnerRequestedReadyDate` e protegida por teste de regressão incluído em `pnpm test`.
- **Ainda sem aceite**: testes de pedido autenticado, verificação de schema/migrações no banco vivo, confirmação de datas por aprovador Bispo, validação fiscal/financeira ponta a ponta, CI do commit final e smoke tests visuais desktop/mobile. Não presumir conclusão com base apenas em build.

## 1. Dados e segurança — issue #64

- [ ] Entidade privada de cliente final com `partnerId` e `companyId`, índices e FK opcional para pedidos, preservando pedidos antigos.
- [ ] Endpoints de criar, consultar, editar, listar e pesquisa com autorização explícita por parceiro e escopo de empresa.
- [ ] Proibir acesso horizontal entre parceiros, edição cruzada, adivinhação de IDs e exposição no cadastro fiscal geral.
- [ ] UI responsiva para Não indicar / Selecionar cadastrado / Cadastrar novo, com validação essencial sem burocracia.
- [ ] Destinatário **fiscal** obrigatório e separado: Signa Coffee ou Rodrigo Lampert Ribas; resolver registros existentes da base de produção, sem duplicá-los.
- [ ] Confirmar cadastro fiscal e permissão real de Rodrigo na produção antes de disponibilizar a escolha.
- [ ] NF-e sempre em nome do destinatário fiscal selecionado, nunca do cliente final privado.
- [ ] Testes de isolamento, autorização, migração retrocompatível, pedidos novos e históricos.

## 2. Pedido, data e aprovação — issue #66

- [ ] Data **solicitada** persistida ao enviar pedido; data **confirmada** editável somente por aprovador autorizado (José, Suzi ou delegado).
- [ ] Fluxos: enviar -> aguardar aprovação -> aprovar/rejeitar/solicitar ajustes -> produzir -> faturar -> entregar; motivos e timestamps auditáveis.
- [ ] Trilha de auditoria e notificações sem duplicidade; alterações de prazo e aprovação devem ser notificadas.
- [ ] Separar estados de aprovação, produção, NF-e, pagamento e entrega; não inferir pagamento por status fiscal.
- [ ] Cartões prioritários dos pedidos em andamento e histórico separado, com navegação eficiente no desktop e mobile.
- [ ] NF-e PDF/XML acessível **somente quando efetivamente autorizada**, respeitando autorização e destinatário fiscal.
- [ ] Pagamento Pix vinculado a cobrança válida, mesmo antes da NF quando suportado, sem cobranças para pedidos rejeitados sem regras de estorno.
- [ ] Upload privado de comprovante com extensão/tamanho/permissão, revisão financeira e conciliação idempotente; comprovante isolado não marca pago.
- [ ] Testes de transições, concorrência, permissões, notificações, reversões e pagamentos parciais.

## 3. Relatórios e inteligência comercial — issue #65

- [ ] Indicadores derivados dos pedidos e das fontes financeiras reais, com filtros por período, produto, gramatura, município/UF e cliente final.
- [ ] Separar `pedido`, `NF autorizada`, `recebido`, `em aberto`, cancelamentos/estornos e devoluções.
- [ ] Comparações mês/mês e ano/ano, volumes em kg/unidades, frequência, recompra, novos/inativos e cruzamentos.
- [ ] Mapa somente de geografia válida, com dados ausentes explicitados; sem métricas inventadas.
- [ ] Exportação de CSV, XLSX e PDF com filtros e data de geração; paginação no backend.
- [ ] Testes de conciliação de totais, isolamento entre parceiros e consistência dos filtros.

## 4. Experiência e operação

- [ ] Logo Signa de fonte oficial e identidade Bispo: tipografia Montserrat/Inter, hierarquia e layout semânticos.
- [ ] UX rápida e acessível, estilo SAP Fiori/Oracle Fusion/Dynamics 365, sem copiar marca nem adicionar burocracia.
- [ ] Testes em mobile/desktop, foco e teclado, erros de formulário, estados vazios, carregamento e navegação.
- [ ] Catálogo Signa exclusivo sem interferir nos demais: Reserva 250 g R$ 38, 500 g R$ 76,80, 1 kg R$ 148.
- [ ] Não aceitar preço zero nem SKU indisponível; auditar tabelas, estoque sob encomenda e snapshot de preço do pedido.

## 5. Porta de saída para produção integral

- [ ] PR #67 completa, revisão de segurança e migrações aditivas sem perda de dados.
- [ ] GitHub Actions aprovado no SHA exato do merge.
- [ ] Testes de integração usando ambiente isolado e dados de teste, especialmente pedido + emissão fiscal + pagamento + relatório.
- [ ] Render app/API implantadas no mesmo commit; migrações confirmadas em `_prisma_migrations`.
- [ ] Smoke tests autenticados para os perfis Signa, Bispo aprovador e sem permissão; comparar dados de pedidos com DB.
- [ ] Confirmar logs sem erros críticos, rollback preparado e monitorar indicadores após implantação.

**Regra de release:** a PR #70 pode ser publicada antecipadamente após sua própria validação; todos os demais itens ficam bloqueados até o aceite integral da PR #67.

# Signa — checklist de aceite antes da publicação integral

## Incremento em 23/11/2026 — limite transacional de rascunhos da conta (WIP, SEM PUBLICAR)

- [x] **Código implementado na branch feature da PR #67** (commits `123af79`, `b4ece89`, `9f47851`, `325c85b`): criação de rascunhos Signa limitada a **100 registros DRAFT por companyId/partnerId/userId**. A API usa transação PostgreSQL com `pg_advisory_xact_lock` por escopo, executa a contagem após obter o lock e retorna **409 Conflict** com orientação para excluir uma cópia antiga quando o limite é atingido. A listagem já usa LIMIT 100; a proteção evita que novos rascunhos fiquem inacessíveis na UI. Não remove rascunhos existentes.
- [x] Testes unitários cobrem 0, 99, 100, 101 e contagem negativa. **CI completo aprovado** em [Actions #45129125534](https://github.com/rezendeantonio1410-ops/bbos/actions/runs/45129125534): TypeScript, lint, testes e build, no código da feature mais um arquivo de validação isolado da PR temporária [#103](https://github.com/rezendeantonio1410-ops/bbos/pull/103). CI não comprova concorrência real nem execução transacional no banco.
- [x] **Verificação SQL sem mutação em Render staging:** `EXPLAIN (VERBOSE)` confirmou que a expressão de lock `pg_advisory_xact_lock(hashtextextended(...)) IS NULL` é aceita pelo PostgreSQL. Consulta somente leitura confirmou **ausência da tabela `PartnerOrderDraft` e da migração `20261123030000_signa_order_drafts`** nessa instância identificada como staging. Nenhuma migração aplicada.
- [x] Render: serviços `bbos-api-rc1` e `bbos-app-rc1` permanecem com último deploy **live** no commit prévio `07c6b9f`; auto-deploy aponta para `release/bbos-rc1-consolidation`. Nenhuma alteração na release, no banco, em pedidos, pagamentos, NF-e ou Bling.
- [ ] **Porta de publicação ainda fechada:** ensaio da migração em banco isolado com rollback, testes de concorrência e autorização reais, E2E em duas sessões/dispositivos, envio idempotente de pedido, aceite visual da PR #92, resolução de conflitos da PR #67, aprovação fiscal/financeira e demais integrações.

## Incremento em 23/11/2026 — duplicação segura de rascunhos Signa (WIP, sem publicação)

- [x] Implementada no formulário a ação **Duplicar na conta** para um rascunho selecionado. A interface busca o rascunho pelo endpoint autenticado (escopo `companyId/partnerId/userId`) e cria **um novo** registro pelo POST de rascunhos, enviando **somente `saved.payload`**. O original não é modificado; não chama a rota de pedido, não altera pagamentos, estoque ou fiscal. A nova cópia é selecionada para recuperação e revisão antes de qualquer eventual envio.
- [x] Acrescentado teste de regressão para recusar metadados de identificação/escopo/versão na cópia e revalidar apenas o payload permitido, sem transportar campos de preço e proprietário.
- [x] **GitHub Actions CI #45122052528 aprovado** na PR temporária [#102](https://github.com/rezendeantonio1410-ops/bbos/pull/102): typecheck, lint, testes e build; validação sobre o código da feature nos commits `5b05670` e `0ea2b58`. PR #102 de validação **não será integrada** na branch principal nem na release.
- [ ] **Aceite integral ainda bloqueado:** ensaio da migração de rascunhos em banco isolado e rollback; E2E autenticado entre dispositivos e usuários; limitação de volume/expiração; conversão idempotente para pedido com limpeza/auditoria; revisão visual desktop/mobile da PR #92; resolução de conflitos da PR #67 e testes fiscais, Bling, Pix, relatórios e produção.
- [ ] **Render não foi revalidado nesta execução:** conexão não tinha workspace selecionado. Não inferir deploy, banco ou migração a partir do CI. Nenhum merge/deploy ou mutação de registros reais autorizado por este incremento.

## Incremento em 23/11/2026 — rascunhos persistentes no servidor (WIP, sem publicação)

- [x] Criada a migração **aditiva e ainda não aplicada** 20261123030000_signa_order_drafts: tabela separada PartnerOrderDraft, FKs para empresa/parceiro/usuário, JSON de conteúdo, índice por escopo e data, versão para concorrência, estado DRAFT. Não altera registros existentes, pedidos, estoque, Bling, NF-e, Pix nem preços.
- [x] Implementados endpoints autenticados GET/POST/PATCH/DELETE /partner-portal/order-drafts (incluindo consulta por ID) na **branch feature da PR #67**. Toda leitura, edição e exclusão exige companyId, partnerId e userId da sessão. Apenas distribuidor Signa autenticado pode operar; IDs comerciais e fiscais são validados contra vínculos autorizados, e variantes são checadas no catálogo privado ativo.
- [x] Payload parcial (inclusive vazio), sem preços nem dados tributários livres; suporta cliente comercial, seleção fiscal, itens, entrega, data solicitada e notas. Limites de comprimento, quantidades, data e whitelist de campos impedem inserção de preço, valor total, campo de pagamento ou escopo falsificado. PATCH/DELETE exigem **versão exata** para evitar sobrescrita concorrente; conflito retorna erro sem gravar.
- [x] Formulário Signa na branch oferece **Salvar na conta, Listar, Recuperar e Excluir**, preservando os rascunhos locais anteriores. Ao recuperar, checa comprador e catálogo atual, limpa a cotação e exige confirmação/revisão antes de enviar. Os novos endpoints ainda **não estão disponíveis na versão publicada**.
- [x] Testes do validador adicionados ao teste principal. A primeira execução CI da PR temporária #101 encontrou um teste estático antigo que exigia exatamente três chamadas de catálogo; com a quarta validação legítima no servidor, o teste foi corrigido e CI repetido.
- [x] **CI de validação isolada aprovado** em [Actions #45115959659](https://github.com/rezendeantonio1410-ops/bbos/actions/runs/45115959659): typecheck, lint, testes e build concluídos. PR temporária #101 fechada **sem merge** e branch principal continua em draft. Este CI valida o código com um documento auxiliar apenas na branch temporária, mas **não é teste autenticado E2E nem migração aplicada**.
- [ ] **Gate permanece fechado:** executar migração em ambiente isolado com ensaio de rollback/compatibilidade; testes autenticados de isolamento empresa/parceiro/usuário, acesso cruzado, recuperação entre dispositivos, concorrência e expiração; teste real de catálogo e pedido 500g/1kg sem mexer em dados de produção; fluxo idempotente de conversão rascunho para SalesOrder; duplicação e limpeza pós-submissão; inspeção visual desktop/mobile e aceite da PR #92; resolver conflitos da PR #67, fiscal/Pix/NF-e/Bling/BI. **Não fazer merge nem deploy da PR #67.**
- [x] **Render consultado sem alterações**: bbos-api-rc1 e bbos-app-rc1 continuam com deploy live do commit 07c6b9f (anterior a este incremento). Nenhuma migração, merge ou deploy novo foi disparado nesta execução.


## Incremento em 23/11/2026 — isolamento seguro de rascunhos locais (WIP)

- [x] Alterada a chave de armazenamento do rascunho local de **cliente fiscal apenas** para `companyId/partnerId/userId/customerId`, identidade devolvida exclusivamente por `GET /partner-portal/order-options` após autorização do parceiro; não é usada identidade fornecida pelo navegador.
- [x] Recuperação, autosave, descarte e limpeza após pedido utilizam a mesma chave por usuário. Controles ficam desabilitados quando a sessão não fornece o escopo. A versão local v1 permanece intacta no navegador, **mas não é lida nem automaticamente migrada**: impossível provar quem era seu proprietário em navegadores compartilhados.
- [x] Adicionados testes para isolamento entre empresas, parceiros, usuários e compradores, colisões de chave e ausência de identificador. A informação de rascunho continua limitada a variantes, quantidades, modalidade e data; nunca inclui valores, dados fiscais ou dados pessoais.
- [x] **CI concluído com sucesso** no código atualizado (feature SHA `7506fb5`): PR temporária #100, [Actions #45110229762](https://github.com/rezendeantonio1410-ops/bbos/actions/runs/45110229762) aprovada em typecheck, lint, testes e build. PR de validação encerrada sem merge; este registro é atualização documental posterior ao CI.
- [ ] **Autenticação real e inspeção visual** ainda pendentes antes do aceite. Este incremento não cria rascunhos no servidor; recuperação entre dispositivos, edição integral, exclusão, idempotência e migração de banco da issue #93 permanecem pendentes.
- [ ] **Não publicar PR #67 nem #92 separadamente.** A PR #67 segue em rascunho com conflitos; PR #92 exige validação visual real. Dados, pedidos, NF-e, Pix, preços e Bling não foram alterados por este incremento.


> Estado em 22/11/2026. A PR #67 permanece WIP e **não deve ser publicada** sem aceite completo.
> A entrega antecipada do Reserva 500 g/1 kg é isolada na PR #70 e deve seguir seu próprio rito de testes.

## Revisão incremental — 22/11/2026, 22h53 (Brasília)

- [x] **Código alterado apenas na branch draft PR #67 (sem merge):** catálogo exclusivo Signa agora falha de forma fechada se não houver linhas ativas em `CustomerCatalogProduct`: não expõe produtos pelo fallback geral de preços. A mesma guarda é aplicada a `order-options`, `quote` e `orders`, sem modificar a política de fallback para outros distribuidores.
- [x] **Fechada outra via de exposição do catálogo:** quando um distribuidor não possui exatamente uma conta de preços vinculada, `order-options` não devolve mais `internalOptions.variants` para o portal do distribuidor; retorna catálogo vazio para evitar acesso a produtos internos. Novo teste de regressão estático adicionado. A criação de pedidos mantém validação do catálogo por `customerId`, sem alterar histórico.
- [x] Criados testes unitários para catálogo Signa vazio, catálogo restrito aos SKUs explícitos, desativação de uma variante e compatibilidade com outros distribuidores, além de teste de presença das três integrações no controller. Inclusão na suíte raiz via `test:signa-order-isolation`. **Testes adicionados não significam testes executados ou CI aprovado.**
- [x] PR #70 permanece integrada à release no SHA `880283eb`. Nesta leitura somente de banco `bbos-postgres-staging`, migração do Reserva concluída sem rollback e três variantes no catálogo privado Signa ativas, com `RAR-WLR-250` R$ 38,00; `RAR-WLR-500` R$ 76,80; `RAR-WLR-1000` R$ 148,00.
- [x] Render RC1 app/API exibem último deploy `live` de `8d40edeca2b9c9d14273e048fed2202526a2a5f8` (publicação anterior, não desta revisão). Serviços têm auto-deploy na branch release.
- [ ] **Pendência desta revisão:** CI completo no HEAD final, teste autenticado de pedido 500 g, comprovação do banco realmente ligado à API RC1; testes de isolamento, migração em ambiente representativo, aprovação de data exclusivamente Bispo, fiscal Signa/Rodrigo, NF-e/Bling, Pix/conciliação, relatórios/exportações e aceite visual desktop/mobile. A PR #67 continua draft com conflitos. Não publicar parcial nem alterar pedidos/dados existentes.

## Revisão incremental — 22/11/2026, 20h45 (Brasília)

- [x] **Código efetivamente alterado, sem publicação:** validação de preço privado `parseBillableUnitPrice` agora recusa frações de centavo e formatos não decimais (notação exponencial/hexadecimal), além de preço nulo, negativo ou não finito. Decimal SQL com zeros finais continua aceito. Isso impede arredondamento silencioso antes de gerar cotação/pedido; não altera preços ou registros em banco.
- [x] Casos de regressão adicionados a `signa-billing-recipient.test.ts`, já incluído no `pnpm test` do monorepo. Execução local isolada com Node 22 e remoção de tipos TypeScript: **3 testes passaram** (preços Reserva, valores inválidos, formatos legítimos). **Não equivale a CI/typecheck/lint/build do repositório completo.** HEAD deste incremento: `150c66ba5b267aafad64b59f542f7e1080de0796`.
- [x] **PR #70** permanece merged (`880283eb`), Actions da branch aprovada (`45040608415`). Na **única instância Postgres listada no workspace, nomeada `bbos-postgres-staging`**, leitura estritamente SQL mostra migração Reserva aplicada sem rollback, SKU `RAR-WLR-250` R$ 38,00, `RAR-WLR-500` R$ 76,80 e `RAR-WLR-1000` R$ 148,00; variantes/catálogo/preço ativos e nenhum preço privado ativo de outros clientes identificado nesses SKUs.
- [x] Nessa mesma base, **nenhum pedido Signa do SKU 500 g** e **1 pedido de 10 unidades do SKU 1 kg** em consulta por item de pedido. Isso não demonstra autenticação, autorização, nem aprovação do pedido no RC1. Migrações de clientes finais e datas aparecem aplicadas no staging, mas não comprovam que suas funcionalidades estão publicadas na API RC1.
- [x] **Render RC1 app/API live** no commit `f65ef8397c145421ec38b8296418aa1614085635` (22/11 às 20h32 BRT), implantado por outros PRs. Foi constatado que os commits `ad23787`, `f459b51` e `f65ef83` alteraram módulos Signa diretamente na release. **Reconciliar esses incrementos já publicados com a regra de publicação integral**; não pressupor que todos os módulos além de #70 seguem fora de produção.
- [ ] **Porta de aceite fechada:** a PR #67 continua draft e `mergeable=false`; não há workflow de Actions nem status de CI no novo HEAD. Falta comprovar vínculo real API/DB em produção, teste de pedido autenticado 500 g/1 kg, integração Bling/NF-e, cadastros fiscais verificados, Pix/conciliação, aprovações Bispo, isolamento autenticado, relatórios/exportações e inspeção visual. Nenhum merge, deploy, pedido de teste real ou alteração em dados existentes foi executado nesta revisão.

## Revisão incremental — 22/11/2026, 19h50 (Brasília)

- [x] **Implementação efetiva isolada na PR #67 (não publicada):** edição de nome/cidade/UF do cliente final comercial pelo próprio distribuidor, preservando o cadastro fiscal `Customer` e os dados históricos. `PATCH /partner-portal/end-customers/:customerId` exige sessão de parceiro DISTRIBUTOR e aplica `WHERE id=$1 AND companyId=$2 AND partnerId=$3 AND active=true`. O formulário oferece edição do cliente selecionado, sem alterar destinatário fiscal.
- [x] Validador unitário adicionado para rejeitar alteração de `partnerId`, `companyId`, `taxId`, `active`, ID fiscal, entrada inválida e UF/nome incorretos. Teste estático também comprova cláusula de isolamento no SQL. Ambos integrados ao comando `pnpm test`; **não confundir testes adicionados com CI aprovado**.
- [x] **PR #70** segue `merged` (SHA `880283eb`); workflow da PR `45040608415` concluído como `success`. Deploys RC1 da aplicação e API em `live` no SHA `c48b9d7`, posterior ao hotfix. Nenhum merge ou deploy foi feito nesta revisão.
- [x] Banco **`bbos-postgres-staging`** consultado somente leitura: variantes `RAR-WLR-250`, `RAR-WLR-500` e `RAR-WLR-1000`, preços privados Signa R$ 38,00 / R$ 76,80 / R$ 148,00, catálogo ativo e sem outro cliente com preço privado ativo encontrado. Migração do Reserva concluída sem rollback. **Nova confirmação:** migrações de clientes comerciais e aprovação de data também constam aplicadas *nesta base staging* às 22:07 UTC; isso NÃO prova implantação da PR #67 na aplicação/API RC1 nem que a base é produção.
- [x] Na base consultada há registros de pedidos para 250 g (37 unidades) e 1 kg (10 unidades); **não há registro de pedido para 500 g** nessa consulta. Esses registros não substituem teste autenticado e controlado do catálogo/fluxo de criação de pedido RC1.
- [ ] **CI do HEAD novo da PR #67 não comprovado**; validação temporária PR #83 criada como rascunho sem autorização de merge, mas não havia execução de Actions para esse SHA no momento da consulta. Validar typecheck/lint/test/build e testes de migração/segurança antes de liberar.
- [ ] **Portas de publicação fechadas:** comprovante de qual banco está ligado a app/API RC1, criação autenticada de pedido 500g e 1kg, Bling/NF-e, Pix/conciliação, verificação fiscal Signa/Rodrigo, aprovação de prazo exclusiva Bispo, isolamento autenticado horizontal, relatórios/exportações, logo e aceite visual desktop/mobile. A PR #67 tem conflitos com release e permanece draft.

## Revisão incremental — 22/11/2026, 18h51 (Brasília)

- [x] PR #70 **merged**, commit `880283eb`, CI de sua branch aprovado. App e API RC1 estão `live` no Render no commit `902187f`, posterior ao hotfix. Não houve novo merge/deploy neste ciclo.
- [x] Leitura **somente leitura** do banco identificado explicitamente no Render como `bbos-postgres-staging`: migração `20261122153000_signa_reserva_500_1000` concluída sem rollback, variantes `RAR-WLR-250`, `RAR-WLR-500`, `RAR-WLR-1000` ativas, preços Signa R$ 38,00 / R$ 76,80 / R$ 148,00 e catálogo privado ativo. O banco de fato conectado aos serviços RC1 **não foi comprovado** por esta consulta.
- [x] **Nova evidência desde 17h47:** existe na base consultada um pedido atribuído ao parceiro Signa para **10 unidades do SKU `RAR-WLR-1000`**, preço unitário R$ 148,00, total do item R$ 1.480,00, status `READY_TO_SHIP`, criado em 22/11/2026 às 21:47 UTC. Este registro **não demonstra** sozinho que o pedido foi criado com sessão autenticada no serviço RC1. A variante de **500 g continua sem pedidos nessa base**.
- [ ] **Integração Bling NÃO comprovada**: a instância consultada não possui `IntegrationResourceMap` com SKU/variant ID de `RAR-WLR-500` ou `RAR-WLR-1000`. Antes de considerar concluído, sincronizar produto fiscal validado e verificar IDs no Bling, produtos não duplicados, variantes/SKUs corretos e NF-e em ambiente seguro. Não confundir nome visual "Reserva" com produto-base "White Label Raro".
- [x] **Correção de segurança em código WIP PR #67:** consultas de autorização de PDF, lista de pedidos e eventos agora permitem pedido de distribuidor quando o parceiro o criou; consulta por cliente vinculado só é permitida para **pedido legado sem parceiro de origem** (`createdByStorefrontPartnerId IS NULL`). Pedidos atribuídos a outro parceiro ficam invisíveis. Nenhum registro histórico foi alterado.
- [x] Teste de regressão estático das três consultas e da guarda dos PDFs fiscais adicionado em `partner-portal-order-access.test.ts`, registrado em `pnpm test`. A execução completa de CI para o HEAD atualizado **ainda precisa ser comprovada**.
- [ ] Manter bloqueada a publicação da PR #67 até resolução de conflitos, testes autenticados de isolamento horizontal, pedido 500 g, aprovação de data Bispo, NF-e/Pix, relatórios e inspeção visual desktop/mobile. Não alterar automaticamente produção nem gerar pedido fictício.

**Esta revisão substitui como evidência atual as contagens de pedidos anotadas em revisões anteriores do checklist.** Os demais itens e bloqueadores continuam válidos.

## Revisão incremental — 22/11/2026, 17h47 (Brasília)

- [x] PR #70 continua **merged** na branch `release/bbos-rc1-consolidation`; app/API Render `live` no SHA `902187f`, que inclui a entrega urgente.
- [x] Leitura SQL da instância **identificada no Render como `bbos-postgres-staging`**: catálogo e preços exclusivos Signa ativos: `RAR-WLR-250` (250 g / R$ 38,00), `RAR-WLR-500` (500 g / R$ 76,80), `RAR-WLR-1000` (1 kg / R$ 148,00). Nenhum preço privado nem registro de catálogo ativo para outros clientes nas variantes novas. Essa leitura **não comprova, isoladamente, qual URL de banco os serviços RC1 usam**.
- [ ] Teste autenticado de criação de pedido ainda pendente. Na base consultada existem **0 pedidos Signa** para cada SKU Reserva; não gerar pedidos artificiais em produção nem declarar aprovação do fluxo.
- [x] Implementado nesta PR WIP um bloqueio de preços inválidos na cotação e criação de pedidos: sem preço, zero, negativo, não finito ou menor que 1 centavo = erro controlado, nunca pedido gratuito. Testes de regressão cobrindo 250 g, 500 g, 1 kg e entradas inválidas incorporados ao teste `test:signa-billing` que já integra `pnpm test`.
- [ ] Confirmar execução integral de CI no SHA final da PR #67, revisar migrações em banco isolado, reconciliação fiscal/Pix e segurança por parceiro. **Não fazer merge/deploy da PR #67 até todos os testes e validações visual/fiscal estarem aprovados.**

## Verificação atual — 22/11/2026, 16h (Brasília) — NÃO PUBLICAR PR #67

- [x] **PR #70 já integrada à release**, sem novo merge: migração `20261122153000_signa_reserva_500_1000` verificada em consulta somente leitura (`finished=true`, `rolled_back=false`). Banco confirma variantes ativas `RAR-WLR-250` (250 g, R$ 38,00), `RAR-WLR-500` (500 g, R$ 76,80) e `RAR-WLR-1000` (1 kg, R$ 148,00), com preços privados ativos exclusivamente na conta Signa Coffee.
- [x] **Render app/API**, ambos `live` no mesmo commit de release `902187f`, posterior à PR #70. A execução não fez alterações em produção.
- [ ] **GATE #70 ainda aberto:** não há evidência de criação de pedido autenticado para 500 g e 1 kg com validação de visibilidade/status; leitura de banco e cotação não substituem o teste.
- [x] **Implementação incremental na PR #67:** nenhuma escolha fiscal automática; seletores explícitos por cartão; opção de cliente comercial cadastrado e busca por nome, município ou UF sem diferenciar acentos; limpeza de seleção ao cancelar e concluir pedidos; regressões de busca adicionadas ao comando raiz `pnpm test`.
- [ ] **CI e integração pendentes:** HEAD da PR #67 `d63b52c` ainda sem GitHub Actions completo, branch divergiu da release (47 commits à frente, 5 atrás) e PR permanece `mergeable=false`. Status de workflow anterior não valida o commit atual. Executar typecheck, lint, teste e build no SHA final após resolver a divergência.
- [ ] **Fluxos globais incompletos:** aprovação de data Bispo, NF-e fiscal autorizada, Pix/conciliação, relatórios financeiro x pedidos, exportação XLSX/PDF, isolamento autenticado, desktop/mobile, logo oficial e validação visual. Não liberar essas funcionalidades antes do aceite integral.

**Nota de rastreabilidade:** PRs #74 e #75 foram integradas anteriormente na release; não são rascunhos. Sua integração não comprova prontidão fiscal do cadastro Signa/Rodrigo (ainda `NOT_VERIFIED`). A PR #67 continua independente e não pode pressupor emissão de NF-e.

## Avanço incremental: faturamento Signa/Rodrigo — 22/11/2026 (somente código WIP)

- [x] **Base de produção verificada (somente leitura):** cadastro ativo de Signa Coffee (CNPJ) e Rodrigo Lampert Ribas (CPF), ambos da mesma empresa BBOS. O CNPJ do parceiro Signa corresponde ao CNPJ de seu cliente comercial. **Ambos estão com `taxIdVerificationStatus=NOT_VERIFIED`**. Isso não é autorização para emitir NF-e.
- [x] **Restrição fiscal implementada em código na PR #67:** novo `GET /partner-portal/billing-recipients` só fornece destinatários autorizados à Signa autenticada (vínculo e CNPJ parceiro/cliente iguais). Pedido exige ID fiscal da lista; outras pessoas não podem informar ID arbitrário. Rodrigo não vira cliente comercial da Signa.
- [x] **Tabela de preço preservada em código:** cotação e `resolvePrice` usam o `customerId` comercial da Signa; `SalesOrdersService.create` recebe separadamente o destinatário fiscal como `customerId` do pedido. Snapshot de preço conserva `pricingCustomerId`; `createdByStorefrontPartnerId` é incluído já na criação.
- [x] **Visibilidade corrigida em código:** pedidos faturados para Rodrigo, eventos e arquivos de cobrança/NF-e podem ser consultados pelo parceiro que criou o pedido, sem liberar acesso a outros parceiros.
- [x] **Interface**: escolha Signa/CNPJ ou Rodrigo/CPF no novo pedido, rótulo de validação fiscal pendente; cliente final permanece separado. Teste unitário de allowlist criado e incorporado a `pnpm test` na branch.
- [ ] **Porta de saída NÃO aprovada**: PR #67 diverge da release; CI ainda sem execução no HEAD atualizado; é obrigatória validação completa de segurança, dados fiscais, precificação e NF-e real em ambiente isolado. PRs #74 e #75 já foram integradas à release; esse fato não libera faturamento fiscal nem dispensa testes e validação de cadastro.
- [ ] **Migrações do restante da PR #67 NÃO aplicadas em produção**: `20261122010000_partner_end_customers` e `20261122020000_signa_ready_date_approval`. Esta pendência é esperada e impede testar esses fluxos no ambiente produtivo.
- [ ] **Pedido autenticado em produção não simulado**: preservar o histórico; nenhum pedido fictício ou teste com emissão fiscal/financeira foi criado.
- [ ] **Confirmação de NF-e:** verificar bloqueio fiscal com documentos `NOT_VERIFIED`, destinatário fiscal correto no XML/PDF autorizado, Pix e conciliação antes de aceitar.
- [ ] **CI e testes:** executar `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`; cenários Signa e Rodrigo, isolamento horizontal, preço exclusivo, histórico, migrabilidade e validação visual.

### PR #70 — produção verificada sem alterações adicionais nesta execução

- [x] PR #70 integrada via merge `880283eb`; workflow `45040608415` (`Test, typecheck, lint and build`) concluído com sucesso.
- [x] Migração `20261122153000_signa_reserva_500_1000` concluída às 15:56:12 UTC sem rollback; 12 apresentações ativas no catálogo privado Signa, inclusive Reserva 250 g R$ 38,00, 500 g R$ 76,80 e 1 kg R$ 148,00.
- [x] Preços exclusivos das três variantes confirmados em leitura da base; nenhum outro cliente tem preço privado ativo nas duas variantes novas.
- [x] Render aplicação/API `live` no commit `402c1499` (posterior ao merge #70), conforme deploys observados.
- [ ] Teste autenticado de criação de **pedido real** para cada SKU novo e validação do resultado/visibilidade na produção. Sem credencial autorizada para simulação e sem alterar pedidos reais, este gate **permanece aberto**.

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

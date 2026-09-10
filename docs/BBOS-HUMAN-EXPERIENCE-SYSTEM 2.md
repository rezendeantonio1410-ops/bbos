# BBOS Human Experience System 1.0 — fundação

## Objetivo

Esta camada prepara o BBOS para evoluir globalmente a experiência de uso —
reduzindo carga cognitiva, mantendo a linguagem operacional e preservando o
DNA Bispo — sem alterar regras de negócio ou redesenhar páginas existentes.

## Arquitetura encontrada

- `apps/web/src/app/globals.css` concentra Tailwind, reset básico, superfícies,
  cores de marca, ajustes de dashboards e acessibilidade global.
- `apps/web/tailwind.config.ts` concentra a extensão de cores, fontes e sombra
  usada pelas classes utilitárias.
- `packages/ui/src/index.tsx` já fornece `Card`, `Button` e `Badge`; esses
  componentes são consumidos por parte das telas, enquanto várias páginas
  antigas ainda escrevem classes Tailwind localmente.
- `packages/ui/src/brand/tokens.ts` mantém o contrato da marca e agora também
  publica o contrato semântico da experiência.
- `AppShell` (`apps/web/src/components/app-shell.tsx`) concentra sidebar,
  topbar, navegação e sessão, mas ainda possui classes locais de layout.

## Problemas identificados

Há dois níveis de estilo: componentes compartilhados no pacote UI e classes
locais repetidas nas páginas. Isso impede trocar uma decisão visual de forma
global. Também havia valores hexadecimais repetidos em componentes e estilos
específicos de dashboards. A migração integral não faz parte desta fundação.

Os arquivos `apps/web/src/app/(system)/compras-cafe-verde-v2/page 2.tsx` e
`apps/web/src/components/green-coffee-purchases-v2 2.tsx` eram arquivos locais
não rastreados, sem referências no código. O segundo era idêntico ao componente
oficial; o primeiro era uma cópia anterior da página. Foram removidos por serem
artefatos acidentais e por causarem erros de typecheck/build quando descobertos
automaticamente pelo Next.

## Tokens semânticos

`packages/ui/src/brand/tokens.ts` exporta `humanExperienceTokens`. A mesma
camada é disponibilizada no Web por variáveis CSS `--bbos-*`:

- superfícies: `surface-base`, `surface-elevated`, `surface-subtle`,
  `surface-page`;
- conteúdo: `text-primary`, `text-secondary`, `text-muted`, `text-on-action`;
- ação: `action-primary`, `action-primary-hover`;
- estados: `state-success`, `state-information`, `state-attention`,
  `state-critical`, `state-neutral`;
- domínio: `coffee-green`, `coffee-roasted`, `coffee-caramel`;
- estrutura: `border`, `focus-ring`, raios e duração de movimento.

Os valores preservam a aparência atual. A semântica permite ajustar contraste,
modo futuro ou linguagem de estado sem procurar dezenas de páginas.

## Componentes centralizados

`@bbos/ui` mantém os componentes existentes e centraliza seus estilos:

- `Card`: superfície elevada, borda e sombra;
- `Button`: ação primária, estados disabled e foco;
- `Badge`: indicador compacto com `role=status`;
- `Input` e `Select`: controles consistentes, foco visível e estado disabled;
- `Alert`: mensagem com `role=alert`;
- `Status`: ponto semântico + texto, sem depender apenas de cor.

Nenhuma página foi convertida nesta etapa; portanto, não há alteração de
comportamento nem de layout da Ficha de Compra V2.

## Estratégia de adoção progressiva

1. Novas telas devem usar `@bbos/ui` e os tokens `--bbos-*`.
2. Em cada manutenção de uma tela existente, substituir primeiro cores,
   bordas, foco e estados por tokens, preservando o espaçamento atual.
3. Migrar grupos por domínio (Café Verde, Recebimento, Produção), validando
   screenshots e typecheck a cada grupo.
4. Só depois consolidar padrões de densidade, progressive disclosure e
   iconografia de realidade simplificada.

## Ainda não migrado

Páginas antigas ainda possuem classes locais para cards, botões, inputs,
selects, alerts e badges. Sidebar/topbar continuam no `AppShell`. Ícones de
domínio ainda usam principalmente Lucide; a futura iconografia de grão,
saca, equipamento e cupping deve ser introduzida como uma biblioteca de ativos
sem alterar regras de negócio.

## Acessibilidade e movimento

O foco visível é aplicado globalmente e nos controles compartilhados. O token
`--bbos-focus-ring` permite ajuste de contraste. `prefers-reduced-motion`
reduz transições e animações sem exigir mudanças nas páginas.

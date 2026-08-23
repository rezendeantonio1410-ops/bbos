# BBOS Human Experience — inventário de migração

## Arquitetura encontrada

Os tokens semânticos vivem em `packages/ui/src/brand/tokens.ts` e são expostos
como variáveis CSS em `apps/web/src/app/globals.css`. Os componentes básicos
compartilhados (`Card`, `Button`, `Input`, `Select`, `Alert` e `Status`) vivem
em `packages/ui/src/index.tsx`. A aplicação usa esses componentes junto com
classes Tailwind locais em páginas do App Router.

## Fundação criada nesta etapa

- aliases semânticos para ação, superfície, texto e estados cognitivos;
- `HumanPageHeader`, `HumanEmptyState`, `ActionBar` e `StatusBadge`;
- foco visível e `prefers-reduced-motion` preservados nos tokens globais;
- estados sempre combinam texto/forma com cor, sem depender somente de cor.

## Inventário inicial

| Área | Estado atual | Prioridade | Próximo componente |
| --- | --- | --- | --- |
| Início | comando e pendências já humanizados | alta | `HumanPageHeader`, `HumanEmptyState` |
| Dashboard Executivo | cockpit com métricas e pulso operacional | alta | `ExecutiveMetric`, `AttentionPanel` |
| Dashboard Industrial | métricas operacionais em cards | alta | `OperationalPulse`, `StatusBadge` |
| Café Verde / Compras | fluxo operacional rico, ainda com estilos locais | alta | `ProgressStep`, `SectionCard` |
| Fornecedores / Corretores | listas e modais funcionais | média | `ActionBar`, `HumanEmptyState` |
| Recebimento / Laboratório / Estoque | estados operacionais distintos | alta | `StatusBadge`, `AttentionPanel` |
| Produção / Blends | fluxo industrial e seleção de lotes | alta | `OperationalPulse`, `HumanEmptyState` |
| Produtos / Pedidos / Vendas | tabelas e listas funcionais | média | `HumanPageHeader`, `StatusBadge` |
| Financeiro / Custos / BI | alta densidade informativa | média | `SectionCard`, `SmartStat` |
| Commerce | operação comercial separada | baixa | `ActionBar`, `HumanEmptyState` |

## Estratégia incremental

1. Migrar cabeçalhos, estados vazios e status para os componentes acima, uma
   área por PR, sem alterar contratos de API.
2. Trocar gradualmente cores locais por tokens semânticos; valores existentes
   permanecem visualmente compatíveis.
3. Validar cada área em desktop, tablet, mobile, loading, erro e sem dados.
4. Só depois consolidar padrões de densidade específicos de cada domínio.

As PRs seguintes devem permanecer separadas por domínio. Nenhuma página é
reescrita automaticamente nesta fundação e nenhuma regra de negócio é alterada.

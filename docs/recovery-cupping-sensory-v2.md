# Recovery Cupping Sensory V2

Esta branch parte do `main` atual e serve para recuperar seletivamente a camada sensorial/mobile existente em `staging/cupping-mobile-v2`.

## Escopo autorizado nesta recuperação

- interface sensorial ilustrada;
- navegação mobile passo a passo;
- pontuação em incrementos de 0,25;
- motor de scoring tradicional/Traditional 100, quando compatível com o domínio atual;
- avaliação por cinco xícaras para uniformidade, doçura e clean cup;
- defeitos por xícara;
- autosave/offline/local draft;
- biblioteca sensorial e assets visuais já existentes.

## Escopo explicitamente fora desta recuperação

- migrations antigas da branch `staging/cupping-mobile-v2`;
- substituição do `CuppingController` atual;
- regressão do fluxo atual de amostra, lote, decisão de qualidade, treinamento ou multiprovador;
- merge direto da branch antiga.

## Regra de integração

O `main` atual é a fonte de verdade para domínio, banco e fluxo operacional. A branch antiga é fonte de referência para UX sensorial, motor técnico e assets reutilizáveis. Cada bloco recuperado deve ser pequeno, auditável e compatível com o `main` antes de avançar.

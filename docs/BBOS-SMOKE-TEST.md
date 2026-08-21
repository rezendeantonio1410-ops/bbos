# BBOS Smoke Test

## Objetivo

O smoke test faz uma verificação rápida, somente de leitura, para indicar se o Web, o proxy/API e os principais módulos do BBOS continuam acessíveis após um merge ou deploy. Ele não substitui testes de unidade, integração ou validação operacional.

## Como executar

Localmente:

```bash
BBOS_BASE_URL=http://localhost:3000 pnpm smoke
```

Staging:

```bash
BBOS_BASE_URL=https://bbos-web-staging.onrender.com pnpm smoke
```

O teste usa `fetch` do Node e não exige dependência adicional.

## Variáveis

- `BBOS_BASE_URL`: URL do Web (padrão: `http://localhost:3000`). O prefixo `/api` é acrescentado aos checks de API.
- `BBOS_API_URL`: opcional, URL direta da API para um check adicional de `/api/health` (por exemplo, `http://localhost:3001`). As chamadas funcionais continuam usando o proxy same-origin do Web.
- `BBOS_SMOKE_EMAIL` e `BBOS_SMOKE_PASSWORD`: opcionais e fornecidas somente no ambiente de execução. Nunca devem ser commitadas ou impressas.
- `BBOS_SMOKE_TIMEOUT_MS`: timeout por chamada, padrão de 12 segundos.

Sem credenciais, o teste valida Web e health público e marca autenticação/módulos protegidos como `SKIP`, sem fingir que estão validados.

## Checks atuais

São verificados `/`, `/api/health` e, quando uma sessão externa é fornecida, `/api/auth/login`, `/api/auth/me`, Dashboard, Fornecedores, Compras, Recebimentos, opções de recebimento, Estoque, Blends, Produção e Corretores. Laboratório fica `SKIP` porque o `main` atual não expõe um endpoint dedicado de leitura.

As chamadas autenticadas são GET (exceto o login), não criam fornecedor, compra, recebimento, lote ou produção e mantêm o cookie apenas em memória durante a execução.

## Resultado e retries

Cada linha mostra `PASS`, `FAIL` ou `SKIP` e o tempo aproximado. Timeout, erro de rede e HTTP 502/503/504 recebem poucas tentativas com backoff (0, 1, 2 e 4 segundos), para acomodar cold start sem retry infinito. 401/403 não entram em retry de cold start.

Nenhum cookie, token, senha, header de autenticação ou corpo de resposta é impresso.

## Limitações e evolução

O teste depende de a URL do Web/proxy estar acessível e, para checks protegidos, de credenciais fornecidas fora do repositório. Novos endpoints somente de leitura podem ser adicionados à lista em `scripts/bbos-smoke-test.mjs` depois de auditados.

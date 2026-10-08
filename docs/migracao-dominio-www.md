# Migração segura da loja para www.bispocoffees.com.br

## Objetivo

Concentrar a presença pública da Bispo Coffees em `www.bispocoffees.com.br`, mantendo o sistema interno isolado em `bbos.bispocoffees.com.br` e preservando links antigos da Nuvemshop.

## Estado auditado em 08/10/2026

| Endereço                   | Destino atual                                 | Papel depois da migração                |
| -------------------------- | --------------------------------------------- | --------------------------------------- |
| `bispocoffees.com.br`      | Nuvemshop (`185.133.35.21` e `185.133.35.22`) | Redirecionar para `www`                 |
| `www.bispocoffees.com.br`  | `bispocoffees.lojavirtualnuvem.com.br`        | Loja nova no Render                     |
| `loja.bispocoffees.com.br` | `bbos-ecommerce-preview-v2.onrender.com`      | Redirecionar permanentemente para `www` |
| `bbos.bispocoffees.com.br` | `bbos-app-rc1.onrender.com`                   | Permanecer como sistema interno         |

Os registros MX do Google e o TXT de verificação não fazem parte do corte e não devem ser alterados.

## Mapeamento de URLs antigas

| Nuvemshop                       | Loja nova                    |
| ------------------------------- | ---------------------------- |
| `/`                             | `/loja`                      |
| `/produtos/`                    | `/loja#cafes`                |
| `/produtos/essencial-500g/`     | `/loja#essencial`            |
| `/produtos/intenso-500g/`       | `/loja#intenso`              |
| `/produtos/caramelo-500g/`      | `/loja#caramelo`             |
| `/produtos/doce-de-leite-500g/` | `/loja#doce-de-leite`        |
| `/produtos/tangerina-500g/`     | `/loja#tangerina`            |
| `/produtos/singular-500g/`      | `/loja#singular`             |
| `/produtos/sublime-500g/`       | `/loja#sublime`              |
| `/produtos/raro-250g/`          | `/loja#raro`                 |
| `/quem-somos/`                  | `/loja/sobre`                |
| `/contato/`                     | `/loja/entrega-e-devolucoes` |
| `/account/login/`               | `/loja/conta`                |
| `/account/register/`            | `/loja/conta`                |

Os redirecionamentos são permanentes (`308`), preservam parâmetros de campanha e só existem nos hosts públicos da loja.

## Sequência de corte

1. Manter a Nuvemshop publicada e reduzir o TTL dos registros `@` e `www` para 300 segundos.
2. Adicionar `www.bispocoffees.com.br` ao serviço Render `bbos-ecommerce-preview-v2` e registrar o valor de DNS e o IP de apex apresentados pelo painel.
3. Validar em homologação: catálogo, sacola, frete, PIX/cartão, confirmação, e-mail e entrada do pedido no BBOS.
4. No Registro.br, trocar somente:
   - `www`: CNAME da Nuvemshop para o destino informado pelo Render;
   - `@`: os dois A antigos pelo A informado pelo Render.
5. Não alterar `MX`, `TXT`, `loja`, `bbos` ou qualquer registro de e-mail.
6. Confirmar certificado TLS e respostas `200`/`308` em todos os endereços mapeados.
7. Atualizar o serviço web com:
   - `NEXT_PUBLIC_STOREFRONT_URL=https://www.bispocoffees.com.br`
   - `STOREFRONT_ENFORCE_CANONICAL_HOST=true`
8. Atualizar a API com `STOREFRONT_WEB_URL=https://www.bispocoffees.com.br` e publicar novamente.
9. Manter a Nuvemshop disponível por pelo menos sete dias para consulta e rollback, mas sem tráfego do domínio principal.

## Rollback

Se checkout, certificado ou pedidos falharem, desative a imposição do host canônico e restaure temporariamente:

- `www` para `bispocoffees.lojavirtualnuvem.com.br`;
- `@` para `185.133.35.21` e `185.133.35.22`.

Com TTL de 300 segundos, o retorno tende a ocorrer em poucos minutos. O BBOS e o e-mail permanecem fora desse rollback.

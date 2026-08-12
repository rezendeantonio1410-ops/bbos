# BBOS Cupping Mobile V1

## Ambiente local

1. Configure a `DATABASE_URL` no `.env` da raiz e aplique as migrations somente em um banco de desenvolvimento compatível.
2. Gere o client: `corepack pnpm db:generate`.
3. Inicie API e Web: `corepack pnpm dev`.
4. Para acesso pela rede local, inicie a Web com `corepack pnpm --filter @bbos/web dev -- --hostname 0.0.0.0`.
5. Descubra o IP local do Mac (`ipconfig getifaddr en0`, normalmente) e configure `PUBLIC_WEB_URL=http://IP-DO-MAC:3000` na API antes de gerar o convite.
6. Com Mac e iPhone/iPad na mesma rede Wi-Fi, abra o magic link ou escaneie o QR exibido em `/laboratorio/sessoes/[sessionId]`.

O fluxo mobile permanece sob `/cupping/mobile/...`. O convite é individual, expira em 24 horas e somente seu SHA-256 é persistido. O token aberto aparece apenas no momento da liberação.

## Variáveis

- `DATABASE_URL`: PostgreSQL do ambiente.
- `PUBLIC_WEB_URL`: origem usada pela API nos magic links; padrão local `http://localhost:3000`.
- `NEXT_PUBLIC_API_URL`: base pública da API; padrão local `http://localhost:3001/api`.

Para testar no iPhone, `NEXT_PUBLIC_API_URL` também precisa usar o IP do Mac, não `localhost`.

## Produção

Use HTTPS em `PUBLIC_WEB_URL` e `NEXT_PUBLIC_API_URL`. QR e e-mail apontam para o mesmo magic link HTTPS. SMS e WhatsApp possuem abstração, mas não enviam nesta V1 sem provider configurado. O adaptador de desenvolvimento apenas retorna o link para copiar.

## Fluxo de teste

Crie uma sessão em `/laboratorio/sessoes/nova`, adicione amostras e provadores, abra a sessão e selecione **Liberar para prova**. No mobile, aceite o convite, percorra as etapas, revise e finalize. A consolidação pode ser consultada em `/laboratorio/sessoes/[sessionId]/resultado`.

Rascunhos são mantidos em `localStorage` e sincronizados por autosave com debounce quando a conexão volta. O backend rejeita alteração de avaliação finalizada; reabertura exige usuário `ADMIN` ou `INDUSTRIAL` da mesma empresa.

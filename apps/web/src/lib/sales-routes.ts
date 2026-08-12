export const salesDesktopRoutes = {
  home: "/sales/desktop",
  clients: "/sales/desktop/clientes",
  newClient: "/sales/desktop/clientes/novo",
  orders: "/sales/desktop/pedidos",
  newOrder: "/sales/desktop/pedidos/novo",
  catalog: "/sales/desktop/catalogo",
  agenda: "/sales/desktop/agenda",
  commissions: "/sales/desktop/comissoes",
  stock: "/sales/desktop/estoque",
  reports: "/sales/desktop/relatorios",
  notifications: "/sales/desktop/notificacoes",
} as const;

export const salesMobileRoutes = {
  home: "/sales/mobile",
  clients: "/sales/mobile/clientes",
  newClient: "/sales/mobile/clientes/novo",
  orders: "/sales/mobile/pedidos",
  newOrder: "/sales/mobile/pedidos/novo",
  catalog: "/sales/mobile/catalogo",
  agenda: "/sales/mobile/agenda",
  stock: "/sales/mobile/estoque",
  notifications: "/sales/mobile/notificacoes",
} as const;

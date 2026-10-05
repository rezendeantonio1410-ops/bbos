export const protectedSystemPrefixes = [
  "/home",
  "/dashboard",
  "/dashboard-industrial",
  "/blends",
  "/cafe-verde",
  "/clientes",
  "/recebimento",
  "/compras-cafe-verde",
  "/compras-cafe-verde-v2",
  "/corretores",
  "/laboratorio",
  "/estoque",
  "/producao",
  "/financeiro",
  "/custos",
  "/pedidos",
  "/vendas",
  "/exportacoes",
  "/commerce",
  "/bi",
  "/produtos",
  "/fornecedores",
  "/integracoes",
  "/notas-entrada",
  "/perfil",
  "/sobre",
  "/usuarios",
  "/parceiro",
] as const;

export function isProtectedSystemPath(pathname: string) {
  return protectedSystemPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

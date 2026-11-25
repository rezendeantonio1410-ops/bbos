import {
  BarChart3,
  BrainCircuit,
  Boxes,
  Calculator,
  CircleDollarSign,
  ClipboardList,
  Factory,
  Flame,
  FlaskConical,
  Gauge,
  Globe2,
  Store,
  House,
  Images,
  LayoutDashboard,
  LocateFixed,
  Megaphone,
  MapPinned,
  PackageCheck,
  PackageOpen,
  Route,
  FileInput,
  Settings,
  Ship,
  ShoppingBag,
  ShoppingCart,
  Truck,
  UsersRound,
  Warehouse,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type BbosRole =
  | "ADMIN"
  | "EXECUTIVE"
  | "INDUSTRIAL"
  | "FINANCE"
  | "ACCOUNTANT"
  | "SALES"
  | "MARKETPLACE_OPERATOR";

export type BbosNavItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  roles: BbosRole[];
  keywords?: string[];
  /** Items sharing a subgroup show as sub-lines under one menu entry. */
  subgroup?: BbosNavSubgroup;
};

export type BbosNavSubgroup = { id: string; label: string; icon: LucideIcon };

/** One entry for field work: nearby, customer visits and prospects. */
export const VISITS_SUBGROUP: BbosNavSubgroup = { id: "visitas", label: "Visitas", icon: Route };

export type BbosNavGroup = {
  id:
    | "overview"
    | "commercial"
    | "export"
    | "prospecting"
    | "brand"
    | "supply"
    | "quality"
    | "roasting"
    | "inventory"
    | "finance"
    | "analytics";
  label: string;
  description: string;
  /** Icon that stands for the area, always shown next to its name. */
  icon: LucideIcon;
  alwaysOpen?: boolean;
  tone: "green" | "blue" | "amber" | "violet";
  items: BbosNavItem[];
};

const ALL: BbosRole[] = [
  "ADMIN",
  "EXECUTIVE",
  "INDUSTRIAL",
  "FINANCE",
  "SALES",
];
const LEADERSHIP: BbosRole[] = ["ADMIN", "EXECUTIVE"];
const ACCOUNTING: BbosRole[] = ["ADMIN", "EXECUTIVE", "FINANCE", "ACCOUNTANT"];
const MARKETPLACE: BbosRole[] = ["ADMIN", "EXECUTIVE", "MARKETPLACE_OPERATOR"];
const KNOWN_ROLES = new Set<BbosRole>([
  ...ALL,
  "ACCOUNTANT",
  "MARKETPLACE_OPERATOR",
]);

// Eight work areas in the order of the coffee (SAP Fiori spaces / Dynamics 365
// modules). Settings (users, integrations, app) live in the user menu.
export const bbosNavigation: BbosNavGroup[] = [
  {
    id: "overview",
    icon: House,
    label: "Início",
    description: "Alertas e próximas ações",
    alwaysOpen: true,
    tone: "green",
    items: [
      {
        href: "/home",
        label: "Central de comando",
        description: "Exceções e próxima melhor ação",
        icon: House,
        roles: ALL,
        keywords: ["inicio", "hoje", "atenção"],
      },
    ],
  },
  {
    id: "commercial",
    icon: ShoppingCart,
    label: "Vendas",
    description: "Pedidos e clientes",
    tone: "blue",
    items: [
      {
        href: "/pedidos",
        label: "Pedidos",
        description: "Cotação, promessa, reserva e entrega",
        icon: ShoppingBag,
        roles: [
          "ADMIN",
          "EXECUTIVE",
          "SALES",
          "FINANCE",
          "INDUSTRIAL",
          "ACCOUNTANT",
        ],
        keywords: ["pedido", "venda", "estoque"],
      },
      {
        href: "/clientes",
        label: "Clientes",
        description: "Cadastro, crédito e relacionamento",
        icon: UsersRound,
        roles: ["ADMIN", "EXECUTIVE", "SALES", "FINANCE", "ACCOUNTANT"],
        keywords: ["cliente", "credito"],
      },
    ],
  },
  {
    // Own area: export carries documents, logistics, exchange and partners.
    id: "export",
    icon: Ship,
    label: "Exportações",
    description: "Carteira, logística, documentos e câmbio",
    tone: "blue",
    items: [
      {
        href: "/exportacoes",
        label: "Visão geral",
        description: "Carteira, logística e documentos",
        icon: Ship,
        roles: ["ADMIN", "EXECUTIVE", "FINANCE", "INDUSTRIAL"],
        keywords: [
          "exportacao",
          "internacional",
          "incoterm",
          "booking",
          "container",
          "proforma",
          "cambio",
        ],
      },
      {
        href: "/exportacoes/clientes",
        label: "Clientes externos",
        description: "Importadores e torrefações do exterior",
        icon: Globe2,
        roles: ["ADMIN", "EXECUTIVE", "FINANCE", "INDUSTRIAL"],
        keywords: ["importador", "comprador", "exterior", "buyer"],
      },
      {
        href: "/exportacoes/amostras",
        label: "Amostras",
        description: "Envio, rastreio e resposta do comprador",
        icon: PackageCheck,
        roles: ["ADMIN", "EXECUTIVE", "FINANCE", "INDUSTRIAL"],
        keywords: ["amostra", "sample", "rastreio", "dhl", "fedex", "ups"],
      },
      {
        href: "/exportacoes/contratos",
        label: "Contratos",
        description: "Do aprovado ao embarque",
        icon: ClipboardList,
        roles: ["ADMIN", "EXECUTIVE", "FINANCE", "INDUSTRIAL"],
        keywords: ["contrato", "embarque", "incoterm", "fob"],
      },
    ],
  },
  {
    // Field work: new customers, visits and the map (CRM in SAP / Dynamics).
    id: "prospecting",
    icon: Route,
    label: "Prospecção",
    description: "Pré-cadastros, visitas e mapa",
    tone: "blue",
    items: [
      {
        href: "/prospeccao",
        label: "Prospecção",
        description: "Pré-cadastros para visitar e confirmar",
        icon: MapPinned,
        roles: ["ADMIN", "EXECUTIVE", "SALES"],
        keywords: ["pre cadastro", "prospect", "lead", "visita", "cnpj"],
      },
      {
        href: "/atendimento",
        label: "Visitas",
        description: "Visitas, relatos e próximas ações",
        icon: ClipboardList,
        roles: ["ADMIN", "EXECUTIVE", "SALES"],
        keywords: ["visita", "relato", "vendedor", "follow-up"],
      },
      {
        href: "/por-perto",
        label: "Por perto",
        description: "Clientes e pré-cadastros perto de você",
        icon: LocateFixed,
        roles: ALL,
        keywords: ["perto", "mapa", "localizacao", "gps", "rota", "visita"],
      },
    ],
  },
  {
    // Channels and brand (Marketing in SAP / Dynamics).
    id: "brand",
    icon: Megaphone,
    label: "Loja e marca",
    description: "Canais, preços, marketplaces e imagens",
    tone: "violet",
    items: [
      {
        href: "/commerce",
        label: "Canais e preços",
        description: "Loja, preços e campanhas",
        icon: Globe2,
        roles: ["ADMIN", "EXECUTIVE"],
        keywords: ["preco", "canal", "tabela"],
      },
      {
        href: "/commerce/marketplaces",
        label: "Marketplaces",
        description: "Pedidos, anúncios e conciliação",
        icon: Store,
        roles: MARKETPLACE,
        keywords: ["mercado livre", "marketplace", "anuncio", "repasse"],
      },
      {
        href: "/commerce/midia",
        label: "Biblioteca da marca",
        description: "Fundadores, provas, origem e vitrines",
        icon: Images,
        roles: ["ADMIN", "EXECUTIVE"],
        keywords: ["foto", "imagem", "fundadores", "prova", "origem", "loja"],
      },
    ],
  },
  {
    id: "supply",
    icon: Truck,
    label: "Compras",
    description: "Café verde, fornecedores e entradas",
    tone: "amber",
    items: [
      {
        href: "/cafe-verde",
        label: "Café verde",
        description: "Comprar, receber e liberar",
        icon: PackageOpen,
        roles: ["ADMIN", "EXECUTIVE", "INDUSTRIAL", "FINANCE"],
        keywords: ["compra", "suprimentos", "recebimento", "lote", "fornecedor"],
      },
      {
        href: "/fornecedores",
        label: "Fornecedores",
        description: "Produtores, cooperativas e contatos",
        icon: UsersRound,
        roles: ["ADMIN", "EXECUTIVE", "INDUSTRIAL", "FINANCE"],
        keywords: ["produtor", "cooperativa", "fazenda", "corretor"],
      },
      {
        href: "/recebimento",
        label: "Recebimento",
        description: "Entregas, peso conferido e entrada de lote",
        icon: PackageOpen,
        roles: ["ADMIN", "EXECUTIVE", "INDUSTRIAL", "FINANCE"],
        keywords: ["entrega", "chegada", "saca", "peso"],
      },
      {
        href: "/notas-entrada",
        label: "Notas de entrada",
        description: "Captura, classificação e alocação fiscal",
        icon: FileInput,
        roles: ["ADMIN", "EXECUTIVE", "INDUSTRIAL", "FINANCE", "ACCOUNTANT"],
        keywords: [
          "nfe",
          "nota fiscal",
          "xml",
          "sefaz",
          "entrada",
          "embalagem",
          "gas",
        ],
      },
    ],
  },
  {
    id: "quality",
    icon: FlaskConical,
    label: "Qualidade",
    description: "Amostras, cupping e liberação",
    tone: "amber",
    items: [
      {
        href: "/laboratorio",
        label: "Laboratório",
        description: "Amostras, cupping e liberação",
        icon: FlaskConical,
        roles: ["ADMIN", "EXECUTIVE", "INDUSTRIAL"],
        keywords: ["qualidade", "amostra", "cupping"],
      },
    ],
  },
  {
    id: "roasting",
    icon: Flame,
    label: "Torra",
    description: "Ordens de torra e receitas",
    tone: "amber",
    items: [
      {
        href: "/producao",
        label: "Ordens de torra",
        description: "Planejar, torrar e embalar",
        icon: Factory,
        roles: ["ADMIN", "EXECUTIVE", "INDUSTRIAL"],
        keywords: ["op", "torra", "batch", "empacotamento"],
      },
      {
        href: "/blends",
        label: "Receitas (blends)",
        description: "Receitas e composição de lotes",
        icon: Boxes,
        roles: ["ADMIN", "EXECUTIVE", "INDUSTRIAL"],
        keywords: ["receita", "mistura"],
      },
    ],
  },
  {
    id: "inventory",
    icon: Warehouse,
    label: "Estoque",
    description: "Lotes e produtos",
    tone: "amber",
    items: [
      {
        href: "/estoque",
        label: "Estoque",
        description: "Café verde, torrado e produto acabado",
        icon: Warehouse,
        roles: ["ADMIN", "EXECUTIVE", "INDUSTRIAL"],
        keywords: ["saldo", "torrado", "granel", "produto acabado"],
      },
      {
        href: "/produtos",
        label: "Produtos",
        description: "SKU, apresentação, custo e disponibilidade",
        icon: PackageCheck,
        roles: ["ADMIN", "EXECUTIVE", "INDUSTRIAL"],
        keywords: ["sku", "pacote", "acabado"],
      },
    ],
  },
  {
    id: "finance",
    icon: CircleDollarSign,
    label: "Financeiro",
    description: "Receber, pagar, caixa e custos",
    tone: "violet",
    items: [
      {
        href: "/financeiro",
        label: "Financeiro",
        description: "Receber, pagar, caixa e conciliar",
        icon: CircleDollarSign,
        roles: ACCOUNTING,
        keywords: ["caixa", "receber", "pagar"],
      },
      {
        href: "/custos",
        label: "Custos e margens",
        description: "Custo real, margem e retorno",
        icon: Calculator,
        roles: ["ADMIN", "EXECUTIVE", "FINANCE", "INDUSTRIAL", "ACCOUNTANT"],
        keywords: ["margem", "roi", "custeio"],
      },
    ],
  },
  {
    id: "analytics",
    icon: BarChart3,
    label: "Análises",
    description: "Painéis e relatórios",
    tone: "green",
    items: [
      {
        href: "/dashboard",
        label: "Painel executivo",
        description: "Resultado, caixa, ROI e prioridades",
        icon: LayoutDashboard,
        roles: LEADERSHIP,
        keywords: ["diretoria", "resultado", "roi"],
      },
      {
        href: "/dashboard-industrial",
        label: "Painel industrial",
        description: "Produção, perdas, capacidade e estoque",
        icon: Gauge,
        roles: ["ADMIN", "EXECUTIVE", "INDUSTRIAL"],
        keywords: ["fabrica", "torra", "eficiencia"],
      },
      {
        href: "/vendas",
        label: "Desempenho de vendas",
        description: "Desempenho e carteira comercial",
        icon: BarChart3,
        roles: ["ADMIN", "EXECUTIVE", "SALES", "FINANCE", "ACCOUNTANT"],
        keywords: ["faturamento", "receita"],
      },
      {
        href: "/bi",
        label: "Inteligência",
        description: "Diagnóstico, previsão e evidências",
        icon: BrainCircuit,
        roles: LEADERSHIP,
        keywords: ["ia", "insight", "previsao"],
      },
    ],
  },
];

export function navigationForRole(role?: string | null) {
  if (!role || !KNOWN_ROLES.has(role as BbosRole)) return [];
  const resolved = role as BbosRole;
  return bbosNavigation
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.roles.includes(resolved)),
    }))
    .filter((group) => group.items.length > 0);
}

const mobileRoutePriority: Partial<Record<BbosRole, string[]>> = {
  ADMIN: ["/home", "/por-perto", "/pedidos", "/financeiro"],
  EXECUTIVE: ["/home", "/por-perto", "/pedidos", "/dashboard"],
  INDUSTRIAL: ["/home", "/por-perto", "/producao", "/estoque"],
  FINANCE: ["/home", "/por-perto", "/pedidos", "/financeiro"],
  ACCOUNTANT: ["/financeiro", "/notas-entrada", "/custos", "/clientes"],
  SALES: ["/home", "/por-perto", "/pedidos", "/clientes"],
  MARKETPLACE_OPERATOR: ["/commerce/marketplaces"],
};

export function mobileNavigationForRole(role?: string | null) {
  if (!role || !KNOWN_ROLES.has(role as BbosRole)) return [];
  const items = navigationForRole(role).flatMap((group) => group.items);
  const priority = mobileRoutePriority[role as BbosRole] ?? [];
  return priority.flatMap((href) => {
    const item = items.find((candidate) => candidate.href === href);
    return item ? [item] : [];
  });
}

/**
 * Unread notifications per navigation group (menu badges, like Outlook/Teams):
 * a notification counts for the group whose item best matches its link.
 */
export function pendingCountByGroup(
  groups: BbosNavGroup[],
  notifications: Array<{ href: string; readAt: string | null }>,
) {
  const items = groups.flatMap((group) => group.items.map((item) => ({ group: group.id, href: item.href })));
  const counts: Partial<Record<BbosNavGroup["id"], number>> = {};
  for (const notification of notifications) {
    if (notification.readAt) continue;
    const path = notification.href.split(/[?#]/)[0] ?? "";
    const match = items
      .filter((item) => path === item.href || path.startsWith(`${item.href}/`))
      .sort((a, b) => b.href.length - a.href.length)[0];
    if (match) counts[match.group] = (counts[match.group] ?? 0) + 1;
  }
  return counts;
}

export const toneClasses = {
  green: {
    text: "text-[var(--bbos-coffee-green)]",
    dot: "bg-[var(--bbos-coffee-green)]",
    soft: "bg-[var(--bbos-surface-subtle)]",
    active:
      "bg-[var(--bbos-nav-active)] text-[var(--bbos-nav-active-text)] shadow-[inset_3px_0_0_var(--bbos-coffee-green)]",
  },
  blue: {
    text: "text-[var(--bbos-coffee-green)]",
    dot: "bg-[var(--bbos-coffee-green)]",
    soft: "bg-[var(--bbos-surface-subtle)]",
    active:
      "bg-[var(--bbos-nav-active)] text-[var(--bbos-nav-active-text)] shadow-[inset_3px_0_0_var(--bbos-coffee-green)]",
  },
  amber: {
    text: "text-[var(--bbos-coffee-green)]",
    dot: "bg-[var(--bbos-coffee-green)]",
    soft: "bg-[var(--bbos-surface-subtle)]",
    active:
      "bg-[var(--bbos-nav-active)] text-[var(--bbos-nav-active-text)] shadow-[inset_3px_0_0_var(--bbos-coffee-green)]",
  },
  violet: {
    text: "text-[var(--bbos-coffee-green)]",
    dot: "bg-[var(--bbos-coffee-green)]",
    soft: "bg-[var(--bbos-surface-subtle)]",
    active:
      "bg-[var(--bbos-nav-active)] text-[var(--bbos-nav-active-text)] shadow-[inset_3px_0_0_var(--bbos-coffee-green)]",
  },
} as const;

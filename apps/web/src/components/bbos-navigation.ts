import {
  BarChart3,
  BrainCircuit,
  Boxes,
  Calculator,
  CircleDollarSign,
  ClipboardList,
  Factory,
  FlaskConical,
  Gauge,
  Globe2,
  Store,
  House,
  Images,
  LayoutDashboard,
  PackageCheck,
  PackageOpen,
  FileInput,
  PlugZap,
  Settings,
  Ship,
  ShoppingBag,
  Smartphone,
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
};

export type BbosNavGroup = {
  id: "overview" | "commercial" | "international" | "operations" | "management";
  label: string;
  description: string;
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

export const bbosNavigation: BbosNavGroup[] = [
  {
    id: "overview",
    label: "Visão geral",
    description: "Decidir, priorizar e agir",
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
      {
        href: "/aplicativo",
        label: "Aplicativo",
        description: "Alertas de provas e atenções no iPhone",
        icon: Smartphone,
        roles: LEADERSHIP,
        keywords: ["iphone", "aplicativo", "notificacao", "push"],
      },
      {
        href: "/dashboard",
        label: "Executivo",
        description: "Resultado, caixa, ROI e prioridades",
        icon: LayoutDashboard,
        roles: LEADERSHIP,
        keywords: ["diretoria", "resultado", "roi"],
      },
      {
        href: "/dashboard-industrial",
        label: "Industrial",
        description: "Produção, perdas, capacidade e estoque",
        icon: Gauge,
        roles: ["ADMIN", "EXECUTIVE", "INDUSTRIAL"],
        keywords: ["fabrica", "torra", "eficiencia"],
      },
    ],
  },
  {
    id: "commercial",
    label: "Comercial",
    description: "Clientes, pedidos e receita",
    tone: "blue",
    items: [
      {
        href: "/clientes",
        label: "Clientes",
        description: "Cadastro, crédito e relacionamento",
        icon: UsersRound,
        roles: ["ADMIN", "EXECUTIVE", "SALES", "FINANCE", "ACCOUNTANT"],
        keywords: ["cliente", "credito"],
      },
      {
        href: "/atendimento",
        label: "Atendimento",
        description: "Visitas, relatos e próximas ações",
        icon: ClipboardList,
        roles: ["ADMIN", "EXECUTIVE", "SALES"],
        keywords: ["visita", "relato", "vendedor", "follow-up"],
      },
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
        href: "/vendas",
        label: "Vendas",
        description: "Desempenho e carteira comercial",
        icon: BarChart3,
        roles: ["ADMIN", "EXECUTIVE", "SALES", "FINANCE", "ACCOUNTANT"],
        keywords: ["faturamento", "receita"],
      },
      {
        href: "/commerce",
        label: "Commerce",
        description: "Canais, preços e governança",
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
    id: "international",
    label: "Mercado internacional",
    description: "Contratos, bookings e moedas",
    tone: "violet",
    items: [
      {
        href: "/exportacoes",
        label: "Central de exportações",
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
    ],
  },
  {
    id: "operations",
    label: "Operação",
    description: "Do café verde ao produto vendável",
    tone: "amber",
    items: [
      {
        href: "/cafe-verde",
        label: "Café Verde",
        description: "Compra, recebimento, lote e estoque",
        icon: PackageOpen,
        roles: ["ADMIN", "EXECUTIVE", "INDUSTRIAL", "FINANCE"],
        keywords: ["compra", "recebimento", "lote", "fornecedor"],
      },
      {
        href: "/laboratorio",
        label: "Laboratório",
        description: "Amostras, cupping e liberação",
        icon: FlaskConical,
        roles: ["ADMIN", "EXECUTIVE", "INDUSTRIAL"],
        keywords: ["qualidade", "amostra", "cupping"],
      },
      {
        href: "/producao",
        label: "Produção",
        description: "Reserva, torra, perdas e embalagem",
        icon: Factory,
        roles: ["ADMIN", "EXECUTIVE", "INDUSTRIAL"],
        keywords: ["op", "torra", "batch", "empacotamento"],
      },
      {
        href: "/estoque",
        label: "Estoque",
        description: "Café verde, torrado e produto acabado",
        icon: Warehouse,
        roles: ["ADMIN", "EXECUTIVE", "INDUSTRIAL"],
        keywords: ["saldo", "torrado", "granel", "produto acabado"],
      },
      {
        href: "/blends",
        label: "Blends",
        description: "Receitas e composição de lotes",
        icon: Boxes,
        roles: ["ADMIN", "EXECUTIVE", "INDUSTRIAL"],
        keywords: ["receita", "mistura"],
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
    id: "management",
    label: "Gestão",
    description: "Financeiro, custos e governança",
    tone: "violet",
    items: [
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
        label: "Custos",
        description: "Custo real, margem e retorno",
        icon: Calculator,
        roles: ["ADMIN", "EXECUTIVE", "FINANCE", "INDUSTRIAL", "ACCOUNTANT"],
        keywords: ["margem", "roi", "custeio"],
      },
      {
        href: "/integracoes",
        label: "Integrações",
        description: "Bling, marketplaces, pagamentos e fretes",
        icon: PlugZap,
        roles: LEADERSHIP,
        keywords: [
          "bling",
          "fiscal",
          "nfe",
          "webhook",
          "mercado livre",
          "melhor envio",
          "mercado pago",
        ],
      },
      {
        href: "/usuarios",
        label: "Usuários e acessos",
        description: "Papéis, permissões e segurança",
        icon: Settings,
        roles: ["ADMIN"],
        keywords: ["acesso", "perfil", "permissao"],
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
  ADMIN: ["/home", "/pedidos", "/estoque", "/financeiro"],
  EXECUTIVE: ["/home", "/pedidos", "/estoque", "/dashboard"],
  INDUSTRIAL: ["/home", "/producao", "/estoque", "/dashboard-industrial"],
  FINANCE: ["/home", "/pedidos", "/financeiro", "/notas-entrada"],
  ACCOUNTANT: ["/financeiro", "/notas-entrada", "/custos", "/clientes"],
  SALES: ["/home", "/clientes", "/atendimento", "/pedidos"],
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

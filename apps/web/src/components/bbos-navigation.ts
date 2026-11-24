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
  LocateFixed,
  MapPinned,
  PackageCheck,
  PackageOpen,
  FileInput,
  Settings,
  Ship,
  ShoppingBag,
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
  id:
    | "overview"
    | "commercial"
    | "supply"
    | "quality"
    | "roasting"
    | "inventory"
    | "finance"
    | "analytics";
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

// Eight work areas in the order of the coffee (SAP Fiori spaces / Dynamics 365
// modules). Settings (users, integrations, app) live in the user menu.
export const bbosNavigation: BbosNavGroup[] = [
  {
    id: "overview",
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
    label: "Vendas",
    description: "Clientes, pedidos e canais",
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
        href: "/por-perto",
        label: "Por perto",
        description: "Clientes e pré-cadastros perto de você",
        icon: LocateFixed,
        roles: ALL,
        keywords: ["perto", "mapa", "localizacao", "gps", "rota", "visita"],
      },
      {
        href: "/prospeccao",
        label: "Prospecção",
        description: "Pré-cadastros para visitar e confirmar",
        icon: MapPinned,
        roles: ["ADMIN", "EXECUTIVE", "SALES"],
        keywords: ["pre cadastro", "prospect", "lead", "visita", "cnpj"],
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
        href: "/exportacoes",
        label: "Exportações",
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
  ADMIN: ["/home", "/pedidos", "/estoque", "/financeiro"],
  EXECUTIVE: ["/home", "/pedidos", "/estoque", "/dashboard"],
  INDUSTRIAL: ["/home", "/producao", "/estoque", "/dashboard-industrial"],
  FINANCE: ["/home", "/pedidos", "/financeiro", "/notas-entrada"],
  ACCOUNTANT: ["/financeiro", "/notas-entrada", "/custos", "/clientes"],
  SALES: ["/home", "/por-perto", "/atendimento", "/pedidos"],
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

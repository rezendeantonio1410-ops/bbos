import {
  BarChart3,
  BrainCircuit,
  Boxes,
  Calculator,
  CircleDollarSign,
  Factory,
  FlaskConical,
  Gauge,
  Globe2,
  House,
  LayoutDashboard,
  PackageCheck,
  PackageOpen,
  PlugZap,
  Settings,
  ShoppingBag,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type BbosRole = "ADMIN" | "EXECUTIVE" | "INDUSTRIAL" | "FINANCE" | "SALES";

export type BbosNavItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  roles: BbosRole[];
  keywords?: string[];
};

export type BbosNavGroup = {
  id: "overview" | "commercial" | "operations" | "management";
  label: string;
  description: string;
  alwaysOpen?: boolean;
  tone: "green" | "blue" | "amber" | "violet";
  items: BbosNavItem[];
};

const ALL: BbosRole[] = ["ADMIN", "EXECUTIVE", "INDUSTRIAL", "FINANCE", "SALES"];
const LEADERSHIP: BbosRole[] = ["ADMIN", "EXECUTIVE"];

export const bbosNavigation: BbosNavGroup[] = [
  {
    id: "overview",
    label: "Visão geral",
    description: "Decidir, priorizar e agir",
    alwaysOpen: true,
    tone: "green",
    items: [
      { href: "/home", label: "Central de comando", description: "Exceções e próxima melhor ação", icon: House, roles: ALL, keywords: ["inicio", "hoje", "atenção"] },
      { href: "/dashboard", label: "Executivo", description: "Resultado, caixa, ROI e prioridades", icon: LayoutDashboard, roles: LEADERSHIP, keywords: ["diretoria", "resultado", "roi"] },
      { href: "/dashboard-industrial", label: "Industrial", description: "Produção, perdas, capacidade e estoque", icon: Gauge, roles: ["ADMIN", "EXECUTIVE", "INDUSTRIAL"], keywords: ["fabrica", "torra", "eficiencia"] },
    ],
  },
  {
    id: "commercial",
    label: "Comercial",
    description: "Clientes, pedidos e receita",
    tone: "blue",
    items: [
      { href: "/clientes", label: "Clientes", description: "Cadastro, crédito e relacionamento", icon: UsersRound, roles: ["ADMIN", "EXECUTIVE", "SALES", "FINANCE"], keywords: ["cliente", "credito"] },
      { href: "/pedidos", label: "Pedidos", description: "Cotação, promessa, reserva e entrega", icon: ShoppingBag, roles: ["ADMIN", "EXECUTIVE", "SALES", "FINANCE", "INDUSTRIAL"], keywords: ["pedido", "venda", "estoque"] },
      { href: "/vendas", label: "Vendas", description: "Desempenho e carteira comercial", icon: BarChart3, roles: ["ADMIN", "EXECUTIVE", "SALES", "FINANCE"], keywords: ["faturamento", "receita"] },
      { href: "/commerce", label: "Commerce", description: "Canais, preços e governança", icon: Globe2, roles: ["ADMIN", "EXECUTIVE", "SALES"], keywords: ["preco", "canal", "tabela"] },
    ],
  },
  {
    id: "operations",
    label: "Operação",
    description: "Do café verde ao produto vendável",
    tone: "amber",
    items: [
      { href: "/cafe-verde", label: "Café Verde", description: "Compra, recebimento, lote e estoque", icon: PackageOpen, roles: ["ADMIN", "EXECUTIVE", "INDUSTRIAL", "FINANCE"], keywords: ["compra", "recebimento", "lote", "fornecedor"] },
      { href: "/laboratorio", label: "Laboratório", description: "Amostras, cupping e liberação", icon: FlaskConical, roles: ["ADMIN", "EXECUTIVE", "INDUSTRIAL"], keywords: ["qualidade", "amostra", "cupping"] },
      { href: "/producao", label: "Produção", description: "Reserva, torra, perdas e embalagem", icon: Factory, roles: ["ADMIN", "EXECUTIVE", "INDUSTRIAL"], keywords: ["op", "torra", "batch", "empacotamento"] },
      { href: "/blends", label: "Blends", description: "Receitas e composição de lotes", icon: Boxes, roles: ["ADMIN", "EXECUTIVE", "INDUSTRIAL"], keywords: ["receita", "mistura"] },
      { href: "/produtos", label: "Produtos", description: "SKU, apresentação, custo e disponibilidade", icon: PackageCheck, roles: ["ADMIN", "EXECUTIVE", "INDUSTRIAL", "SALES"], keywords: ["sku", "pacote", "acabado"] },
    ],
  },
  {
    id: "management",
    label: "Gestão",
    description: "Financeiro, custos e governança",
    tone: "violet",
    items: [
      { href: "/financeiro", label: "Financeiro", description: "Receber, pagar, caixa e conciliar", icon: CircleDollarSign, roles: ["ADMIN", "EXECUTIVE", "FINANCE"], keywords: ["caixa", "receber", "pagar"] },
      { href: "/custos", label: "Custos", description: "Custo real, margem e retorno", icon: Calculator, roles: ["ADMIN", "EXECUTIVE", "FINANCE", "INDUSTRIAL"], keywords: ["margem", "roi", "custeio"] },
      { href: "/integracoes", label: "Integrações", description: "Bling, fiscal, filas e webhooks", icon: PlugZap, roles: LEADERSHIP, keywords: ["bling", "fiscal", "nfe", "webhook"] },
      { href: "/usuarios", label: "Usuários e acessos", description: "Papéis, permissões e segurança", icon: Settings, roles: ["ADMIN"], keywords: ["acesso", "perfil", "permissao"] },
      { href: "/bi", label: "Inteligência", description: "Diagnóstico, previsão e evidências", icon: BrainCircuit, roles: LEADERSHIP, keywords: ["ia", "insight", "previsao"] },
    ],
  },
];

export function navigationForRole(role?: string | null) {
  const resolved = (role ?? "INDUSTRIAL") as BbosRole;
  return bbosNavigation
    .map((group) => ({ ...group, items: group.items.filter((item) => item.roles.includes(resolved)) }))
    .filter((group) => group.items.length > 0);
}

export const toneClasses = {
  green: { text: "text-[#087568]", dot: "bg-[#087568]", soft: "bg-[#EAF6F2]", active: "bg-[#EAF6F2] text-[#123B35] shadow-[inset_3px_0_0_#087568]" },
  blue: { text: "text-[#3E73A8]", dot: "bg-[#3E73A8]", soft: "bg-[#EEF5FB]", active: "bg-[#EEF5FB] text-[#244F79] shadow-[inset_3px_0_0_#3E73A8]" },
  amber: { text: "text-[#B87518]", dot: "bg-[#C8923E]", soft: "bg-[#FFF6E6]", active: "bg-[#FFF6E6] text-[#795019] shadow-[inset_3px_0_0_#C8923E]" },
  violet: { text: "text-[#6D4FA3]", dot: "bg-[#6D4FA3]", soft: "bg-[#F4F0FB]", active: "bg-[#F4F0FB] text-[#523B7C] shadow-[inset_3px_0_0_#6D4FA3]" },
} as const;

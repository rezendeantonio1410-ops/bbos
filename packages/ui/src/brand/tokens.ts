/**
 * Contrato da identidade visual oficial da Bispo Coffees.
 *
 * Todos os valores permanecem nulos até o recebimento e a validação do
 * Brand Guideline oficial. Não preencher com aproximações ou referências
 * externas.
 */

export type OfficialBrandValue = string | number;
export type PendingOfficialBrandValue = OfficialBrandValue | null;

export type BrandLogoVariant = {
  /** Nome aprovado no guideline oficial. */
  name: string;
  /** Caminho público do arquivo oficial, relativo a apps/web/public. */
  path: string | null;
  /** Contexto de uso aprovado, documentado sem inferências. */
  usage: string | null;
  /** Fundo ou requisito de contraste previsto no guideline. */
  background: string | null;
};

export type BrandTokenContract = {
  meta: {
    status: 'pending-official-assets' | 'validated';
    guidelineVersion: string | null;
    guidelineDate: string | null;
    validatedAt: string | null;
  };
  colors: {
    ritualBlack: PendingOfficialBrandValue;
    chineseBlack: PendingOfficialBrandValue;
    whittSand: PendingOfficialBrandValue;
    platinum: PendingOfficialBrandValue;
    primary: PendingOfficialBrandValue;
    secondary: PendingOfficialBrandValue;
    accent: PendingOfficialBrandValue;
    background: PendingOfficialBrandValue;
    surface: PendingOfficialBrandValue;
    textPrimary: PendingOfficialBrandValue;
    textSecondary: PendingOfficialBrandValue;
    border: PendingOfficialBrandValue;
  };
  surface: {
    base: PendingOfficialBrandValue;
    card: PendingOfficialBrandValue;
    header: PendingOfficialBrandValue;
    sidebar: PendingOfficialBrandValue;
    page: PendingOfficialBrandValue;
    muted: PendingOfficialBrandValue;
  };
  analytics: {
    identityRevenue: PendingOfficialBrandValue;
    positiveProfit: PendingOfficialBrandValue;
    coffeeCostTarget: PendingOfficialBrandValue;
    financeCash: PendingOfficialBrandValue;
    projectionTrend: PendingOfficialBrandValue;
    attention: PendingOfficialBrandValue;
    critical: PendingOfficialBrandValue;
  };
  typography: {
    identityFamily: PendingOfficialBrandValue;
    functionalFamily: PendingOfficialBrandValue;
    weights: Record<string, PendingOfficialBrandValue>;
    sizes: Record<string, PendingOfficialBrandValue>;
    lineHeights: Record<string, PendingOfficialBrandValue>;
    letterSpacing: Record<string, PendingOfficialBrandValue>;
  };
  spacing: Record<string, PendingOfficialBrandValue>;
  borderRadius: Record<string, PendingOfficialBrandValue>;
  semanticStates: {
    positive: PendingOfficialBrandValue;
    attention: PendingOfficialBrandValue;
    critical: PendingOfficialBrandValue;
    informational: PendingOfficialBrandValue;
    neutral: PendingOfficialBrandValue;
  };
  logoVariants: BrandLogoVariant[];
};

export const brandTokens: BrandTokenContract = {
  meta: {
    status: 'validated',
    guidelineVersion: '1.1',
    guidelineDate: '2026-08',
    validatedAt: '2026-08-06',
  },
  colors: {
    ritualBlack: '#0A0A0A',
    chineseBlack: '#0E191D',
    whittSand: '#EBEBEB',
    platinum: '#E0EAE9',
    primary: '#0A0A0A',
    secondary: '#0E191D',
    accent: '#E0EAE9',
    background: '#EBEBEB',
    surface: '#EBEBEB',
    textPrimary: '#0A0A0A',
    textSecondary: '#0E191D',
    border: '#E0EAE9',
  },
  surface: {
    base: '#FFFFFF',
    card: '#FFFFFF',
    header: '#FFFFFF',
    sidebar: '#FFFFFF',
    page: '#F3FAF8',
    muted: '#F7F9F8',
  },
  analytics: {
    identityRevenue: '#087568',
    positiveProfit: '#16A06A',
    coffeeCostTarget: '#C8923E',
    financeCash: '#3E73A8',
    projectionTrend: '#7867A9',
    attention: '#E99A35',
    critical: '#D95757',
  },
  typography: {
    identityFamily: 'Montserrat',
    functionalFamily: 'Inter',
    weights: { thin: 100, light: 300, regular: 400, semibold: 600 },
    sizes: {},
    lineHeights: {},
    letterSpacing: {},
  },
  spacing: {},
  borderRadius: {},
  semanticStates: {
    positive: '#047857',
    attention: '#B45309',
    critical: '#B91C1C',
    informational: '#0369A1',
    neutral: '#57534E',
  },
  logoVariants: [
    {
      name: 'primary-horizontal',
      path: '/brand/logo/bispo-logo-official.jpg',
      usage: 'Marca principal horizontal. Largura mínima digital de 80 px e área de proteção conforme guideline.',
      background: 'light',
    },
  ],
};

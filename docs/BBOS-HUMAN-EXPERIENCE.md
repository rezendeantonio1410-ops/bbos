# BBOS Human Experience

## Cognitive Color & State System

The BBOS interface uses color as an operational signal, never as decoration. Every
semantic color is paired with text, an icon, a label, or a shape so that meaning
remains clear in grayscale and for users with color-vision differences.

### Semantic roles

- **Success** (`--bbos-state-success`, `--bbos-success-soft`, `--bbos-success-border`): confirmed, approved, available, or ready.
- **Warning** (`--bbos-state-attention`, `--bbos-warning-soft`, `--bbos-warning-border`): pending information, attention, or an action still required.
- **Information** (`--bbos-state-information`, `--bbos-info-soft`): context, an active step, or processing.
- **Intelligence** (`--bbos-intelligence`, `--bbos-intelligence-soft`): reserved for a real BBOS insight or recommendation; never for invented metrics.
- **Danger** (`--bbos-state-critical`, `--bbos-danger-soft`, `--bbos-danger-border`): error, block, risk, or a critical divergence.
- **Neutral/disabled** (`--bbos-text-muted`, `--bbos-surface-subtle`): background context and unavailable actions.

Warm surfaces (`--bbos-surface-warm`) and coffee accents (`--bbos-coffee-green`,
`--bbos-coffee-roasted`, `--bbos-coffee-caramel`) give the product a Bispo sense of
place without turning operational pages into colorful dashboards.

### When to use color

Use the light surface and border variants for status regions, guidance, and derived
values. Use the stronger role only for the accompanying marker, icon, or short label.
Primary actions remain black; secondary actions use the secondary action token.
Never communicate a state using color alone, and do not use intelligence styling
unless the system has a real, explainable insight.

### Cognitive states in the purchase form

The V2 purchase form distinguishes automatic context from fields requiring action.
Its progress strip maps **Origem → Especificação → Quantidade → Comercial →
Governança**. Guidance text explains the next human action (for example, “Falta
definir o preço por kg.”), while derived weight and value use quiet success/warm
surfaces. Section accents identify context without painting entire cards.

### Accessibility and motion

All interactive controls retain visible `:focus-visible` rings from the shared tokens.
States include text and symbols, and contrast should be checked whenever a token is
changed. Shared motion tokens honor `prefers-reduced-motion`; future transitions must
use those tokens and remain optional, short, and informative.

The semantic layer is intentionally additive. Other modules can adopt the roles
progressively without changing their business behavior or requiring a global redesign.

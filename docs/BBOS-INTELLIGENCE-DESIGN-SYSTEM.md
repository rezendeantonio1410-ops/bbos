# BBOS Intelligence Design System

## Product thesis
BBOS is not a traditional ERP that asks users to learn menus. It is an assisted operating system that observes context, reduces friction, anticipates risk, explains decisions and guides the next best action while preserving human control.

Core loop:

**Observe → Understand context → Detect friction → Anticipate → Recommend → Human confirms → Learn**

## Design principles
1. **Role-based** — show the information and actions relevant to the user’s job and current task.
2. **Progressive disclosure** — show the essential decision first; reveal detail only when needed.
3. **Recognition over recall** — the system should remember context, previous selections and likely next actions.
4. **Exception-first** — healthy operations stay quiet; risk, deviation and decisions rise to the top.
5. **Explainable intelligence** — recommendations must expose their basis and confidence when material.
6. **Human-in-command** — AI can prepare, recommend and automate reversible low-risk steps; financial, stock, production, pricing and destructive actions require explicit confirmation and auditability.
7. **Comfort for long sessions** — low-saturation surfaces, sufficient contrast, limited borders, restrained motion, semantic colour and generous spacing.
8. **No fake certainty** — missing data is shown as missing data, with guidance on what must be completed next.
9. **Friction is a product signal** — repeated visits, abandoned flows and recurring errors trigger assistance rather than blame.
10. **One operating truth** — commerce, stock, production, quality, finance and BI share the same operational data model.

## Semantic colour model
- Bispo green: brand, healthy operation, primary guidance.
- Blue: information and process state.
- Amber: attention, approaching limits, unresolved decisions.
- Red: critical risk only.
- Violet: AI, prediction, recommendations and machine reasoning.
- Warm neutral surfaces: default working environment.

Colour must never be the only carrier of meaning. Labels, icons and text remain required.

## Navigation model
### Visão Geral
- Central de comando
- Executivo
- Industrial

### Comercial
- Clientes
- Pedidos
- Vendas
- Commerce

### Operação
- Café Verde
- Produção
- Blends
- Produtos
- Laboratório

### Gestão
- Financeiro
- Custos
- Inteligência

Navigation is task-oriented and grouped by journey rather than exposing every database entity as an equal menu item.

## Intelligence Layer v1
### Context
Track current route, role, current entity, active operation and relevant operational state.

### Friction detection
Signals include repeated visits to the same module in a short period, abandonment, repeated validation errors, excessive back-and-forth navigation and repeated manual sequences.

The first implementation stores short-lived route repetition signals locally in the browser. This is intentionally privacy-conscious: it is designed to improve the interface, not secretly score employee productivity.

### Next Best Action
Recommendations combine operational rules and business data. Examples:
- low finished-goods coverage → suggest production quantity;
- confirmed orders without stock → suggest reservation or production;
- green coffee lot awaiting release → suggest cupping/quality action;
- margin below target → explain cost driver and request review;
- receivable risk → warn before new credit release.

### AI reasoning layer
A model-connected assistant should be embedded in workflow rather than isolated as a generic chat box. It should support questions such as:
- “Why are you recommending this production quantity?”
- “What changed in cash since yesterday?”
- “Which customers need attention today?”
- “What can run out this week?”
- “What is pressing the margin of Caramelo?”

Recommended AI response contract:
- answer;
- evidence/data sources;
- confidence;
- suggested action;
- impact;
- confirmation requirement;
- audit record.

## Humanized empty states
Never show only “Sem dados”. Use:
- what is missing;
- why it matters;
- next action;
- direct link to resolve it.

Example: “ROI ainda não disponível. Cadastre custos de produção para calcular margem e retorno.”

## Benchmark references
### SAP Fiori
Use as benchmark for role-based, adaptive, simple, coherent and delightful enterprise UX; Fiori also explicitly treats intelligence as integral to UX while keeping users in control.
https://experience.sap.com/fiori-design-web/design-principles/
https://experience.sap.com/fiori-design-web/sap-fiori/

### Microsoft Dynamics 365
Benchmark for embedding copilots and AI agents into ERP/CRM workflows and unifying operational data for guided decisions.
https://learn.microsoft.com/pt-br/dynamics365/copilot/ai-get-started

### ServiceNow AI Platform / Now Assist
Benchmark for contextual AI skills, agentic workflows, orchestration and proactive assistance inside operational work.
https://www.servicenow.com/docs/r/intelligent-experiences/ai-products.html
https://www.servicenow.com/docs/r/pt-BR/intelligent-experiences/understand-na-aia.html

### Salesforce Einstein
Benchmark for grounding conversational AI in trusted enterprise data and embedding AI across business applications.
https://www.salesforce.com/br/blog/einstein-copilot/

## Human-computer interaction bibliography
- Norman, Donald A. *The Design of Everyday Things*. Core concepts: feedback, mapping, constraints, consistency, affordances and signifiers.
- Nielsen, Jakob. *10 Usability Heuristics for User Interface Design*. Relevant principles: visibility of system status, match with the real world, user control, consistency, error prevention, recognition rather than recall, flexibility and minimalist design.
- Krug, Steve. *Don't Make Me Think*. Principle: interfaces should reduce unnecessary cognitive interpretation and make likely actions obvious.
- W3C. *Web Content Accessibility Guidelines (WCAG)*. BBOS targets at least WCAG AA contrast: 4.5:1 for normal text and 3:1 for large text.
- Rogers, Sharp & Preece. *Interaction Design: Beyond Human-Computer Interaction*. Foundational HCI principles for feedback, cognition, usability and user-centred interaction.

## Rollout sequence
1. Command Center + navigation + semantic visual system.
2. Eliminate fake/demo numbers from operational dashboards.
3. Friction detection and contextual help.
4. Guided forms and progressive disclosure.
5. Next Best Action rules for stock, production, orders, quality and finance.
6. Model-connected AI reasoning with evidence, confidence and human approval.
7. Role-adaptive home and personalised work queues.
8. Learning loop based on accepted/rejected recommendations and workflow outcomes.

## Acceptance question
For every screen and workflow ask:

> “Does the user need to understand the BBOS, or is the BBOS understanding the user?”

If the answer is the first, the experience still has friction to remove.

# BBOS Experience Constitution 2.0

## Product thesis
BBOS is not an ERP menu system. It is an operating system for the Bispo Coffees business that understands the state of work, shows what matters now, prepares the next safe action and keeps the human in command.

The user should not need to understand the internal architecture of BBOS. BBOS must understand the user, the role, the current record, the operational state and the consequence of the next action.

## The operational experience law
Every important business object must answer five questions in one screen:
1. What is this?
2. What state is it in now?
3. What is blocking it?
4. What should happen next?
5. What will change if I act?

If the user must leave the record to discover one of these answers, the experience is incomplete.

## Core interaction rule
**Understand in 3 seconds → decide in 10 → act in 1 click.**

This is an acceptance criterion, not a slogan.

## Reference synthesis
BBOS combines principles rather than imitating visual styles:
- Microsoft Fluent / 365: predictable grouping, plain language, concise navigation, consistent spatial hierarchy and accessible focus.
- Apple: clarity, strong information hierarchy, scannable tables and immediate visual feedback.
- SAP Fiori: role-based, responsive, simple, coherent and task-oriented enterprise work.
- Salesforce: contextual record pages, role/profile adaptation, grouped views and record-centric workspaces.
- Tesla: persistent operational state, contextual actions, search-to-action and minimal distraction from the primary task.
- Human-AI research: disclose capabilities and limits, time assistance to the user context, support correction, explain material recommendations and preserve human control.
- ISO 9241-210: design around the real human work lifecycle and validate with users throughout the product lifecycle.

## The Bispo advantage
Generic enterprise systems know processes. BBOS must also know coffee.

The domain model and interface must reflect the operating knowledge built by José Rezende and Suzi Ninov:
- green coffee is not usable inventory until quality releases it;
- traceability begins before reception, in supplier/origin/purchase/sample context;
- quality decisions have commercial, stock and production consequences;
- roast loss, packaging, production cost and finished-goods availability are one continuous chain;
- a commercial order is not isolated from credit, stock, production, fiscal and finance;
- discipline and auditability are valuable, but duplicate entry and unnecessary approvals are not.

The desired lesson from heavy enterprise systems is: preserve control, eliminate friction.

## Navigation constitution
Navigation is a map of work, not a list of database entities.

### Visão geral
Purpose: understand the company now.
- Central de comando
- Executivo
- Industrial

### Comercial
Purpose: turn demand into a safe, profitable order.
- Clientes
- Pedidos
- Vendas
- Preços e canais

### Operação
Purpose: transform purchased coffee into traceable sellable product.
- Café verde
- Laboratório
- Produção
- Estoque e produtos
- Blends

### Gestão
Purpose: govern money, policy, access, fiscal and intelligence.
- Financeiro
- Custos
- Fiscal e integrações
- Usuários e acessos
- Inteligência

Rules:
- Maximum two navigation levels.
- One canonical route per business function.
- Legacy versions never compete in navigation.
- Navigation must adapt to role and permission.
- Each group has a semantic colour, icon and human-readable purpose in the DOM — never only via CSS pseudo-content.

## Canonical record-page pattern
Purchase, Receipt, Green Coffee Lot, Lab Analysis, Production Order, Finished Goods Lot, Customer and Sales Order must share one mental model.

### 1. Identity header
- human business number/code;
- primary name/object;
- current status;
- owner/responsible person;
- most important amount/quantity if relevant.

### 2. State rail
A compact horizontal/vertical operational path showing completed, current and future states.
Examples:
- Purchase: Draft → Approval → Supplier acceptance → Awaiting delivery → Received → Closed.
- Green coffee: Received → Lab → Approved/Blocked → Available → Reserved → Consumed.
- Production: Planned → Reserved → Roasting → WIP → Packaging → Finished.
- Order: Draft → Confirmed → Reserved → Picking → Ready → Fiscal → Shipped → Delivered.

### 3. Next Best Action
Exactly one primary next action whenever possible.
It must include:
- action;
- reason;
- consequence;
- blocking condition if unavailable.

Secondary actions live in an overflow/action menu.

### 4. Evidence cards
Only information needed to decide now.
Details use progressive disclosure.

### 5. Timeline / audit
Human-readable chronological record of material events:
who, what, when, old value/new value where relevant, source and linked document.

## Page anatomy
Every operational page follows this order:
1. Context/title.
2. Current state.
3. Exception/attention if any.
4. Primary action.
5. Core facts/KPIs.
6. Work content.
7. History/evidence.

Do not lead with dashboards when the user came to complete a task.

## Exception-first, not dashboard-first
Healthy operations stay quiet.
Raise only:
- blocked work;
- overdue work;
- quality deviation;
- stock risk;
- margin/ROI violation;
- credit/fiscal/financial exception;
- missing required evidence.

No alert should exist without a clear action or reason why no action is possible.

## Colour semantics
Colour carries domain meaning, never decoration alone.
- Bispo green: healthy/complete/primary operational guidance.
- Blue: commercial/information/process context.
- Amber/coffee: operation/attention/pending decision.
- Violet: AI/recommendation/prediction only.
- Red: blocked/critical/destructive only.
- Warm neutral: primary work surface.

All colour meaning must also have text/icon/state labels.

## Intelligence constitution
AI is embedded in the workflow, not placed everywhere as a chatbot.

AI loop:
**Observe → detect exception/opportunity → calculate impact → recommend → prepare action → human approves sensitive action → execute → audit.**

AI may automatically perform reversible low-risk preparation.
AI may not silently:
- approve credit;
- change price policy;
- release blocked quality;
- consume/adjust stock;
- confirm production quantities;
- issue/cancel fiscal documents;
- post payments;
- delete material records.

Material recommendations must expose evidence and uncertainty.

## Search / command constitution
The global command surface must become search-to-action, not only assistant-open.
It should find:
- purchase number;
- receipt;
- green lot;
- sample;
- production order;
- SKU/product;
- customer;
- sales order;
- invoice/fiscal document;
- financial title;
- settings/actions permitted to the role.

A result can navigate or launch a safe contextual action.

## Data-state constitution
Never confuse these states:
- zero;
- missing/not configured;
- loading;
- unavailable/error;
- not applicable.

No screen may show 0 as a business fact when data failed to load.
No recommendation may claim certainty from missing data.

## Industrial continuity
BBOS must model the real chain as one journey:
Purchase → supplier acceptance → inbound NF/receipt → lot → sample → lab release → green stock → production reservation → roasting → WIP → packaging → finished-goods lot → available stock → order reservation → fiscal → shipment.

Critical missing capabilities to complete the journey:
- roasted/WIP inventory;
- packaging-material inventory with reservation/consumption/minimum stock;
- finished-goods lot with batch traceability, production date and expiry;
- demand shortage → production need/recommendation;
- receivable due date driven by the order payment condition;
- fiscal status separated from internal invoicing state.

## Role-based experience
The same record may show different emphasis by role.

### Executive/Admin
Exceptions, cash, ROI, commitments, approvals, consequences.

### Sales
Customer, price policy, credit, available stock, delivery promise, order next step.

### Industrial
Available released material, reservations, machine/operator, batch, loss, packaging, output.

### Finance
Commitments, due dates, fiscal state, receivables/payables, reconciliation, cash impact.

Role adaptation changes emphasis and permitted actions, not the underlying truth.

## Interaction friction rules
A workflow is considered blocked by design when any of these occurs:
- duplicate data entry already known to BBOS;
- user must remember a code that could be selected/searched;
- same decision requires visits to more than two modules;
- user must manually reconcile state changes the system already knows;
- required field appears without explaining why it matters;
- a modal/drawer hides the consequence of the action;
- an error has no recovery path;
- a list has no filter/search for normal operating scale.

## Drawer and modal rules
Contextual drawer:
- header: identity + status + close + one quick action;
- body: facts and task;
- footer: sticky primary action when the flow requires completion.

Drawers must be opaque, scrollable and visually independent from background content.
Do not nest modal inside modal when a record page or drawer can preserve context.

## Tables and matrices
Use rows for scan/comparison.
Use inline editing only where rapid comparison is the task (e.g. price matrix).
Sensitive changes require permission and audit, but should not force a separate screen unless necessary.

## Empty-state contract
Every empty state answers:
- what is missing;
- whether this is normal;
- why it matters;
- next action.

Example:
“ROI ainda não disponível. Falta custo real do SKU. Concluir custo da OP →”

## Performance and resilience
A large enterprise experience must remain usable during partial failure.
- one failed widget must not crash the page;
- loading uses skeleton/known layout, not shifting structure;
- route-level error fallback preserves session and offers recovery;
- API failures never masquerade as empty business data;
- transitions that change stock/money/fiscal state are transactional and idempotent.

## Audit criteria for every screen
Score 0–2 for each:
1. Location is obvious.
2. Current state is obvious.
3. Primary decision is obvious.
4. Primary action is obvious.
5. Missing data is honest.
6. Exceptions are prioritized.
7. Role permissions are clear.
8. Consequence is visible before sensitive action.
9. History/evidence is accessible.
10. No duplicate work is requested.
11. Keyboard/mobile/accessibility are viable.
12. Visual density supports long sessions.

Target: at least 22/24 before a screen is considered VNext complete.

## Non-negotiable acceptance questions
For every screen:
- Can a first-time trained employee understand it without learning BBOS architecture?
- Does the screen match the real coffee/business process?
- Is the next action safer and faster than doing the same work in a conventional ERP?
- Is complexity revealed only when useful?
- Would José trust the operational truth shown here?
- Would Suzi feel that the system preserves enterprise discipline without creating enterprise friction?

If any answer is no, the screen is not finished.

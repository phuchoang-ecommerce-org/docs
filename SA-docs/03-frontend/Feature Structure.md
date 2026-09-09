# Feature Structure — Enterprise Commerce Platform (ECP)

**Document type:** Frontend architecture specification (normative)
**Status:** **Proposed** — [`ADR-0035`](../01-system/ADR/ADR-0035-feature-sliced-frontend-structure.md) records the decision this document specifies
**Audience:** Frontend Engineering, Architecture Review
**Related documents:** [Frontend Architecture](./Frontend%20Architecture.md) · [Routing](./Routing.md) · [Data Fetching](./Data%20Fetching.md) · [State Management](./State%20Management.md) · [ADR-0035](../01-system/ADR/ADR-0035-feature-sliced-frontend-structure.md) · [ADR-0036](../01-system/ADR/ADR-0036-nextjs-server-sole-api-caller.md) · [Module Dependency Diagram](../02-backend/Module%20Dependency%20Diagram.md) · [ADR-0018](../01-system/ADR/ADR-0018-architecture-governance-ci-gate.md)

---

## 1. The Problem This Solves

The backend's boundaries are verified at build time. [`Module Dependency Diagram.md`](../02-backend/Module%20Dependency%20Diagram.md) declares which module may import which, [`ADR-0018`](../01-system/ADR/ADR-0018-architecture-governance-ci-gate.md) makes a violation fail CI, and [`ADR-0002`](../01-system/ADR/ADR-0002-modular-monolith-deployment-unit.md) is honest that without that gate "the *modular* in modular monolith is only a claim."

The frontend, on the same repository, has no such thing. It ships one bundle, every file can import every other file, and there is nothing structural to prevent the checkout feature from importing the admin reporting chart. `P15` names exactly this asymmetry — structural discipline that depends on memory rather than on a tool — and [`ADR-0020`](../01-system/ADR/ADR-0020-typescript-strict-mode.md) §1 says it plainly: without a type system the frontend's correctness "rests on tests and review alone."

Types close half the gap. This document closes the other half: **where code goes, and what it may import.**

---

## 2. The Layout

```nano
ecommerce-frontend-next/
├── app/                       ROUTES ONLY
│   ├── (storefront)/          layouts · pages · loading · error · not-found
│   ├── (auth)/
│   ├── (account)/
│   ├── (admin)/
│   ├── api/                   route handlers — session, csrf, revalidate, healthz
│   ├── layout.tsx             the one root layout: html, body, fonts, providers
│   └── globals.css
│
├── features/<domain>/         ONE FOLDER PER API DOMAIN  (§3)
│   ├── components/            this feature's UI — server and client
│   ├── server/                queries.ts · actions.ts        'server-only'
│   ├── schema/                Zod parsers for this domain's responses
│   ├── url/                   this feature's search-param encoding
│   └── types.ts               the domain vocabulary this feature exports
│
├── components/
│   ├── ui/                    shadcn/ui source, owned and edited  (UIDS §10)
│   └── layout/                header · footer · shells · account sidebar
│
├── lib/
│   ├── api/                   generated types + THE fetch client   'server-only'
│   ├── session/               cookie custody · CSRF · serialised refresh
│   ├── observability/         correlation id · web vitals reporter
│   └── utils/                 formatting — money, dates, numbers
│
├── stores/                    the one Zustand store  (State Management §4)
├── styles/                    the Tailwind theme — the one Ma token source
└── tests/e2e/                 the thin Playwright suite
```

Four layers, dependencies pointing downward only: `app/` → `features/` → `lib/` → `components/`. [`Frontend Architecture.md`](./Frontend%20Architecture.md) §3.1 states the model; §4 below is what enforces it.

**`app/` holds no logic.** A `page.tsx` composes feature components, awaits feature queries, and declares its boundaries. When a page file grows a data transformation or a conditional render worth naming, that code belongs in the feature it came from. The test: a page file should be readable as a description of the screen.

---

## 3. Feature Folders Follow the API, Not the Backend Modules

Fourteen folders, matching the fourteen domains of [`OpenAPI/`](../04-shared/OpenAPI/README.md):

```nano
features/
  identity        catalog        search          inventory
  cart            ordering       payment         shipping
  promotion       review         notification    administration
  reporting       audit
```

**They are created on demand, not up front.** An empty folder documents an intention rather than a fact — the same rule [`SA-docs/README.md`](../README.md#folder-layout) §1.1 applies to the documentation tree.

### 3.1 Where this does not line up with the backend

[`Deployment Diagram.md`](../01-system/Deployment%20Diagram.md) §3 lists thirteen Spring Modulith modules. The frontend has fourteen feature folders. The difference is not an error, and reading it as one leads to the wrong refactor:

| Mismatch | Why |
|---|---|
| `search` is a frontend feature; there is no `search` module | Search is `catalog`'s event-fed Elasticsearch read model ([`ADR-0014`](../01-system/ADR/ADR-0014-elasticsearch-search-read-model.md)). The API exposes it as its own domain because it answers different questions with different freshness, and the frontend follows the API. |
| `administration` is a frontend feature; there is no `administration` module | Its operations — account status, sessions, role grants — are `identity`'s. The API separates them because the *caller* is an operator rather than the account holder, which is a UI distinction as much as a contract one. |
| `shared-kernel` has no frontend counterpart | `Money`, typed IDs, and `Address` are the domain vocabulary of [`Frontend Architecture.md`](./Frontend%20Architecture.md) §6.2, and they live in `lib/api` beside the generated types rather than in a feature. |
| `cart` covers two aggregates | Cart and wishlist are one API domain and one feature folder; `Domain Model.md` treats them as separate aggregates. Splitting the folder would put `moveToCart` on a boundary it has to cross constantly. |

**The frontend consumes the contract, so it is organised by the contract.** Organising it by backend module would mean reorganising the frontend whenever a module is extracted — which [`ADR-0002`](../01-system/ADR/ADR-0002-modular-monolith-deployment-unit.md) anticipates happening.

### 3.2 Inside a feature

| Folder | Contains | Rule |
|---|---|---|
| `components/` | Everything this domain renders | Server by default. `"use client"` on the leaf ([`Frontend Architecture.md`](./Frontend%20Architecture.md) §3.3) |
| `server/queries.ts` | Read functions Server Components await | `import 'server-only'`. Every function returns parsed, typed data or throws a typed problem |
| `server/actions.ts` | Server Actions — this domain's writes | `'use server'`, each wrapped by the CSRF + idempotency wrapper of [`Data Fetching.md`](./Data%20Fetching.md) §6 |
| `schema/` | Zod parsers for the responses this feature reads | Hand-written and reviewed ([`Frontend Architecture.md`](./Frontend%20Architecture.md) §6.3) |
| `url/` | Parse and serialise this feature's search params | One module, so the encoding contract of [`State Management.md`](./State%20Management.md) §3 has one implementation |
| `types.ts` | What this feature exports to `app/` | The feature's public surface. Everything else is internal by convention and by §4 |

A feature that needs none of these has none of them: `inventory` is a folder with `components/` and `types.ts` only, because availability is displayed inside catalog, cart, and checkout screens and has no route of its own ([`Routing.md`](./Routing.md) §3).

---

## 4. Import Rules

These are the frontend's forbidden edges, and they mirror [`Module Dependency Diagram.md`](../02-backend/Module%20Dependency%20Diagram.md) §5 in intent: the rule is declared once, and the build refuses the violation.

| # | Rule | Rationale |
|---|---|---|
| **I-1** | `features/A` **never** imports from `features/B` | The coupling surface `CON-02` exists to prevent. Cross-feature composition happens in `app/`, where it is visible as page composition |
| **I-2** | `app/` may import `features/*`, `components/*`, `lib/*`, `stores/` | `app/` is the composition root — the frontend's counterpart to the backend's `app` subproject |
| **I-3** | `features/*` may import `components/*`, `lib/*`, and `stores/` — never `app/` | Dependencies point downward |
| **I-4** | Nothing outside `lib/api` imports the fetch client, and nothing outside `lib/session` reads a session cookie | One API caller and one credential custodian ([`ADR-0036`](../01-system/ADR/ADR-0036-nextjs-server-sole-api-caller.md)). Two would be two places to forget the CSRF token |
| **I-5** | `components/ui/` and `components/layout/` import **nothing** from `features/` or `lib/api` | A design-system component that fetches is no longer a design-system component. This keeps [`UI Design System.md`](./UI%20Design%20System.md) §10's single implementation reusable |
| **I-6** | `lib/api`, `lib/session`, and every `features/*/server/` file carry `import 'server-only'` | A build error is how a credential path stays off the client. The alternative is noticing in review |
| **I-7** | No server file imports `stores/` | A Zustand store on the server is either shared between users or silently per-request; both are bugs, and the second is the one that reaches production |
| **I-8** | `@tanstack/react-query` is importable from exactly four paths | The closed list of [`Data Fetching.md`](./Data%20Fetching.md) §5. Everything else is server-fetched, and the lint rule is what keeps that from eroding one convenience at a time |

### 4.1 Enforcement

Two tools, because they check different things:

| Tool | Checks | When |
|---|---|---|
| **`eslint-plugin-boundaries`** | `I-1`–`I-5`, `I-7`, `I-8` — per-file import legality | Every lint run; build-failing |
| **`dependency-cruiser`** | The same rules as a graph, plus **cycles**, which a per-file rule cannot see | CI; build-failing |
| **`server-only`** | `I-6` — a server module reached from a client bundle | Build; fails compilation |

The cycle check is the one that earns `dependency-cruiser`'s presence alongside the ESLint plugin. `I-1` makes a direct `features/A` → `features/B` cycle impossible, but a cycle through `components/` or `lib/utils/` is still expressible and is exactly the kind of thing that is discovered during an unrelated refactor two years later.

[`ADR-0035`](../01-system/ADR/ADR-0035-feature-sliced-frontend-structure.md) §5 is honest about the limit: this is a lint gate, and a lint gate is suppressible. It is the same class of guarantee ArchUnit gives the backend, which is to say a good one and not a proof.

---

## 5. Graduation and Placement

Two decisions come up constantly. Both have an answer here so they do not get made ad hoc.

**When does a component leave a feature for `components/`?** When a second feature needs it *and* it holds no domain meaning. A `PriceDisplay` used by catalog, cart, and ordering is still domain-shaped — it knows about `Money` — and belongs to `catalog` with the others importing it through `app/`, or it belongs in `lib/utils` as a formatter plus a `components/ui` primitive. The rule that keeps `components/ui/` clean is `I-5`: if moving it would require it to import from `features/`, it does not move.

**Where does a new piece of code go?** In order:

1. Is it a route, a layout, or a boundary? → `app/`
2. Does it name a domain concept? → that domain's `features/` folder
3. Is it a credential, a network call, or observability? → `lib/`
4. Is it a design-system primitive with no domain knowledge? → `components/ui/`
5. None of these? → it is probably two things. Split it.

**Duplication across features is acceptable; a cross-feature import is not.** Two features rendering a similar status badge differently is cheaper than the coupling that unifying them creates, and this is the single most common place `I-1` gets argued with. `UI Design System.md` §10's single-implementation rule applies to the design system's primitives — Button, Card, Input, Table, Modal, Badge, Tooltip — not to every composition built from them.

---

## 6. What This Does Not Constrain

- **File naming inside a folder.** Convention is `kebab-case.tsx` and one component per file, enforced by nothing.
- **Test placement.** Component tests sit beside their component; the Playwright suite is centralised in `tests/e2e/` because it is thin by design ([`Testing and Benchmark Strategy.md`](../01-system/Testing%20and%20Benchmark%20Strategy.md) §6.7).
- **How many components a feature has.** [`UI Design System.md`](./UI%20Design%20System.md) §9's "one primary objective per screen" constrains screens, not folders.

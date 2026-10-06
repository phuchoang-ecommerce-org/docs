# ADR-0035 — Feature-Sliced Frontend Structure with Lint-Enforced Import Boundaries

**Status:** Proposed
**Date:** 2026-09-09
**Traces to:** `P15` · `CON-02` · `NFR-MAINT-02` · `NFR-MAINT-05`

---

## 1. Context and Problem Statement

[ADR-0018](./ADR-0018-architecture-governance-ci-gate.md) gives the backend a mandatory CI gate: ArchUnit and Spring Modulith verify that a module imports only what [`Module Dependency Diagram.md`](../../02-backend/Module%20Dependency%20Diagram.md) permits, and a violation fails the build. [ADR-0002](./ADR-0002-modular-monolith-deployment-unit.md) is blunt about why that matters — without it, "the *modular* in modular monolith is only a claim."

The frontend, in the same repository, ships one bundle in which every file can import every other file. Nothing prevents the checkout feature from importing an admin reporting chart, and nothing prevents a design-system button from acquiring a data fetch. [ADR-0020](./ADR-0020-typescript-strict-mode.md) closed part of the gap — a type system is an automated structural check — but types constrain *shapes*, not *dependencies*. A perfectly typed import across a boundary that should not exist compiles cleanly.

`P15` argues that structural discipline must be automatic rather than remembered, and `NFR-MAINT-02` requires that a change in one area not force changes elsewhere. Both are currently unenforced on the half of the system the customer touches. What is undecided is the unit the frontend is organised into, and whether the boundaries between those units are checked by anything.

## 2. Decision Drivers

- `P15` / `NFR-MAINT-05` — a rule a tool enforces survives; one that depends on memory does not.
- `CON-02` / `NFR-MAINT-02` — high cohesion, loose coupling, explicit interfaces between UI modules.
- [ADR-0019](./ADR-0019-nextjs-app-router-rendering-strategy.md) — the App Router already dictates that `app/` is route-shaped, so the question is only what sits beneath it.
- [ADR-0025](./ADR-0025-httponly-cookie-session.md) — `ecp-web` holds live tokens, so "which files may touch a credential" is a security boundary and not only a tidiness one.
- The API is view-shaped and numerous: 121 paths, 155 operations, fourteen domains ([`OpenAPI/README.md`](../../04-shared/OpenAPI/README.md)). Whatever the unit is, there will be a lot of it.

## 3. Considered Options

**Option 1 — Feature folders, one per API domain, with import rules enforced by lint.** *(chosen)*

- **Pros:** A feature is the unit a change actually arrives in — "add wishlist sharing" touches one folder, which is `NFR-MAINT-02` expressed as a directory. Forbidding `features/A` → `features/B` gives the frontend the same declared-and-verified edge set the backend has, and it is checkable by tools that already exist (`eslint-plugin-boundaries`, `dependency-cruiser`). Organising by the fourteen API domains rather than the thirteen backend modules means the frontend does not have to reorganise when a module is extracted, which [ADR-0002](./ADR-0002-modular-monolith-deployment-unit.md) anticipates. Colocating a domain's queries, actions, and parsers puts the `server-only` credential path in named, greppable places, which serves [ADR-0025](./ADR-0025-httponly-cookie-session.md).
- **Cons:** The no-cross-feature-import rule forces some duplication, and it will be argued with every time. Deciding which feature a genuinely shared component belongs to is a judgement call with no mechanical answer. Fourteen folders is more ceremony than a small application needs, and this application is not small yet.

**Option 2 — Type-first folders: `components/`, `hooks/`, `services/`, `types/`, `utils/`.**

- **Pros:** The default in the ecosystem, so it needs no explanation. Trivially obvious where a new file goes. No boundary rules to maintain.
- **Cons:** Every meaningful change touches every folder, which is the opposite of `NFR-MAINT-02`. There is no unit a boundary could be drawn around — `services/` importing `services/` is both universal and meaningless, so there is nothing to enforce, and `P15`'s automation has nothing to attach to. At 155 operations, `services/` becomes a directory of a hundred files with no organising principle.

**Option 3 — Pure colocation in `app/`, with everything living beside the route that uses it.**

- **Pros:** Maximum locality; the App Router supports it directly; nothing to look up. Excellent for the first twenty screens.
- **Cons:** The storefront and the admin console both read orders, both read products, and both read customers. Colocation gives each route its own copy, and the copies diverge — most damagingly in the Zod parsers, where two definitions of an order response mean one of them is silently wrong. Route trees also reorganise for navigation reasons, and colocated logic moves with them for no reason of its own.

**Option 4 — Feature folders as a convention, with no enforcement.**

- **Pros:** All of Option 1's structure, none of the lint configuration or the arguments about suppressions.
- **Cons:** This is the null option, and `P15` describes it failing. A cross-feature import is not visible in a diff unless a reviewer is looking for it, it always solves an immediate problem, and by the time the coupling is felt the cost of unwinding it exceeds the cost of living with it. The backend does not rely on convention, and the reason it does not applies identically here.

## 4. Decision Outcome

**Chosen: Option 1.** The frontend is organised into feature folders matching the API's fourteen domains, over a four-layer dependency order, with the boundaries enforced by lint at build time.

```nano
  app/          routes — layouts, pages, boundaries, route handlers
      ↓
  features/     one folder per API domain: components · server · schema · url
      ↓
  lib/          the fetch client · session custody · observability   ('server-only')
      ↓
  components/   ui/ (shadcn source) · layout/ — no data access, ever
```

| Commitment | Detail |
|---|---|
| The unit is the API domain | Fourteen folders, matching [`OpenAPI/`](../../04-shared/OpenAPI/README.md), **not** the thirteen backend modules. The three places they differ are named in [`Feature Structure.md`](../../03-frontend/Feature%20Structure.md) §3.1 |
| Folders are created on demand | An empty folder documents an intention, not a fact |
| `features/A` never imports `features/B` | Cross-feature composition happens in `app/`, where it reads as page composition |
| One API caller, one credential custodian | Nothing outside `lib/api` imports the fetch client; nothing outside `lib/session` reads a session cookie ([ADR-0036](./ADR-0036-nextjs-server-sole-api-caller.md)) |
| Server paths are `server-only` | `lib/api`, `lib/session`, and every `features/*/server/` file. A leak becomes a build error rather than a review comment |
| Design-system components import nothing from `features/` | A primitive that fetches is no longer a primitive |
| Enforcement is two tools | `eslint-plugin-boundaries` for per-file import legality; `dependency-cruiser` for the graph, because **cycles** are invisible to a per-file rule |
| Both are build-failing | The frontend's counterpart to [ADR-0018](./ADR-0018-architecture-governance-ci-gate.md)'s gate |

The full layout, the eight numbered import rules, and the placement procedure are in [`Feature Structure.md`](../../03-frontend/Feature%20Structure.md).

## 5. Consequences

### Positive

- The frontend gets a declared, verified dependency graph, closing the `P15` asymmetry [ADR-0020](./ADR-0020-typescript-strict-mode.md) §1 identified and only partly addressed.
- `server-only` on the credential path converts a class of security mistake into a compilation failure, which matters more here than in a conventional frontend because [ADR-0025](./ADR-0025-httponly-cookie-session.md) puts live tokens in this process.
- A change arrives in one folder, which is `NFR-MAINT-02` made structural rather than aspirational.
- Organising by contract rather than by module means a future module extraction ([ADR-0002](./ADR-0002-modular-monolith-deployment-unit.md)) is invisible to the frontend.

### Negative

- **The no-cross-feature rule forces duplication, and the duplication is real.** Two features rendering similar status badges will diverge. This is accepted deliberately — the coupling that unifying them creates costs more — but it is a cost paid continuously and argued about repeatedly.
- **A lint gate is suppressible.** `// eslint-disable` defeats every rule here in one line. It is visible in review, which is the whole mechanism, and that is a weaker guarantee than the backend's ArchUnit gate over compiled bytecode. Naming it is better than implying parity.
- **Placement is a judgement call with no mechanical answer.** [`Feature Structure.md`](../../03-frontend/Feature%20Structure.md) §5 gives a procedure; a procedure is not a rule, and two engineers will place the same component differently.
- **Fourteen domains is more structure than the application needs today**, and premature structure has its own cost — a small feature carries the ceremony of a large one.

### Neutral / follow-on

- Whether the boundary rules should extend to route groups — forbidding `(storefront)` from importing an `(admin)` component — is left to the first time it comes up. It is expressible in the same tooling.
- The `Money`-arithmetic prohibition of [`Frontend Architecture.md`](../../03-frontend/Frontend%20Architecture.md) §6.2 has no lint rule behind it and is a candidate for a custom one.

## 6. Related Decisions

[ADR-0018](./ADR-0018-architecture-governance-ci-gate.md) · [ADR-0019](./ADR-0019-nextjs-app-router-rendering-strategy.md) · [ADR-0020](./ADR-0020-typescript-strict-mode.md) · [ADR-0036](./ADR-0036-nextjs-server-sole-api-caller.md) · [ADR-0006](./ADR-0006-spring-modulith-module-boundaries.md)

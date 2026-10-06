# ADR-0006 — Spring Modulith: One Module per Bounded Context, Plus a `shared-kernel`

**Status:** Accepted
**Date:** 2026-09-06
**Traces to:** `P1` · `P14` · `CON-01` · `CON-02` · `NFR-MAINT-01` · `NFR-MAINT-02` · `NFR-MAINT-06`

---

## 1. Context and Problem Statement

[ADR-0002](./ADR-0002-modular-monolith-deployment-unit.md) commits the platform to a single deployable. That decision is only worth making if the "modular" half is real: a monolith whose modules are a naming convention is a layered monolith with extra folders, and it fails `P1`, `CON-01`, and `CON-02` exactly as thoroughly as one that never tried.

[`Domain Model.md`](../../02-backend/Domain%20Model.md) §3–§4 resolves the 14 BA domains into **12 bounded contexts**: Identity & Access, Catalog, Inventory, Cart & Wishlist, Ordering, Payment, Shipping, Promotion, Review, Notification, Audit, and Reporting & Analytics. `SCH` folds into Catalog as a CQRS read model; `ADM` dissolves into Identity & Access plus an admin BFF.

Two questions follow, and `Domain Model.md` §5.3 explicitly hands the second one forward as unresolved:

1. What is the unit of enforcement, and how is a boundary violation detected?
2. Where does the Shared Kernel physically live? §5.3 establishes that `Money`, typed identity wrappers, and `Address` are shared across all twelve contexts, that the kernel must have **zero outbound dependencies**, and that its home is **not** `04-shared/` — because [`SA-docs/README.md`](../../README.md#folder-layout) §1.1 reserves that for API and contract artifacts, not domain code. It states this is *"a forward-pointer for Backend Architecture to resolve."* This record resolves it.

## 2. Decision Drivers

- `NFR-MAINT-01` — every domain has an explicit boundary, and any dependency crossing it is deliberate and visible.
- `NFR-MAINT-02` — a change confined to one domain's rules must not require change in another.
- `NFR-MAINT-06` (Should) — boundaries must be drawn so a domain could later be deployed separately *without redrawing them*.
- `P14` — module boundaries double as team-ownership boundaries.
- `P15` — the rule must fail a build, not a code review.

## 3. Considered Options

**Option 1 — Spring Modulith, one module per bounded context, with a `shared-kernel` module beneath all of them.** *(chosen)*

- **Pros:** Module boundaries become a build-time verified property: a module may be reached only through its public API or its published events, never through its internals. The module structure matches the context map exactly, so `NFR-MAINT-06` is satisfiable by inspection. Modulith's event publication registry and documentation generation come from the same metadata. A `shared-kernel` module with zero outbound dependencies is itself verifiable.
- **Cons:** Ties the module structure to a Spring-specific library — a coupling at the *structural* level, though not in the domain layer ([ADR-0005](./ADR-0005-clean-architecture-ports-and-adapters.md) keeps that clean). Modules are packages inside one artifact, so the compiler alone will not stop a violation; the verification test must actually run.

**Option 2 — Separate Maven modules, one artifact per bounded context.**

- **Pros:** The compiler enforces the boundary — an undeclared dependency simply will not compile. The strongest possible guarantee.
- **Cons:** Twelve artifacts to version and wire for a system that deploys as one. Cyclic dependencies that Modulith reports as violations become hard build failures with no diagnostic context. Worse, the Order-Placement Partnership (`Domain Model.md` §5.1) needs Ordering, Inventory, and Promotion inside one transaction; expressing that across artifacts means either a dependency edge that defeats the separation or a coordinating module that becomes a de facto god module.

**Option 3 — Package-by-feature convention, enforced by ArchUnit rules alone.**

- **Pros:** No new library; ArchUnit is already in the stack for `P15`; full control over rule wording.
- **Cons:** Every boundary rule must be hand-written and kept in step as contexts are added — the rules become the thing that erodes. Loses Modulith's event registry and its notion of a module's *published* API, which is what makes "reach it through its public API or its events" expressible at all.

**Option 4 — No enforced boundaries; rely on review discipline.**

- **Cons:** This is the null option and it fails `P15` by definition. Recorded only because it is the default outcome if the verification test is ever allowed to be skipped.

## 4. Decision Outcome

**Chosen: Option 1.** Twelve Spring Modulith application modules, one per bounded context, plus a `shared-kernel` module structurally beneath all of them.

```nano
  backend/src/main/java/…/ecp/
  │
  ├── shared-kernel/          Money · typed IDs · Address        (zero outbound dependencies)
  │
  ├── identity/               ├── ordering/          ├── notification/
  ├── catalog/                ├── payment/           ├── audit/
  ├── inventory/              ├── shipping/          └── reporting/
  ├── cart/                   ├── promotion/
  │                           ├── review/
  │
  └── each module:  api/                              public — the deliberate surface
                    internal/application/             use cases, ports, orchestration
                    internal/domain/{model,event}/    aggregates, VOs, domain events
                    internal/domain/repository/       one JMolecules repository per root
                    internal/infrastructure/          adapters
```

**Resolution of `Domain Model.md` §5.3.** The Shared Kernel gets its own `shared-kernel` module with two enforced properties:

| Rule | Enforcement |
|---|---|
| Zero outbound dependencies — the kernel depends on none of the twelve contexts | ArchUnit dependency test; also verifiable because Modulith treats it as a module with no declared dependencies |
| Behaviour-only Value Objects; no aggregates, no repositories, no services | Review plus an ArchUnit rule forbidding JMolecules `@AggregateRoot` and `@Repository` stereotypes in the kernel package |

It stays deliberately tiny. `04-shared/` remains reserved for OpenAPI, DTOs, event contracts, and the permission matrix — contract artifacts, not domain code — exactly as `Domain Model.md` §5.3 requires.

**Cross-module communication follows the context map, not convenience.** The relationship patterns in `Domain Model.md` §5.2 are the specification: Open Host Service calls (Identity & Access's `AuthorizationService`), one-time translation (Cart → Ordering), Conformist event subscription (Audit, Notification, Reporting), and the two Partnership ports. A module reaches another module only through one of these.

**Module boundaries are team boundaries** (`P14`). A team owning Catalog develops against Ordering's published API and events, never its internals.

## 5. Consequences

### Positive

- `NFR-MAINT-01` and `NFR-MAINT-02` become build-time facts rather than review outcomes.
- `NFR-MAINT-06` is satisfiable by inspection: the module graph *is* the context map, so a future extraction inherits boundaries rather than negotiating them.
- `Domain Model.md` §5.3's open item is closed, and the closure is itself verifiable.

### Negative

- **The Order-Placement Partnership crosses three module boundaries inside one transaction.** This is legitimate under `Domain Model.md` §5.1 but it is the one place the boundary is deliberately porous, and it must be expressed through `StockReservationPort` and `PromotionRedemptionPort` rather than a direct call — otherwise Modulith reports it as a violation and the temptation is to relax the rule instead of the code.
- **Modules are packages, not artifacts.** Nothing physically prevents a violation between the moment it is written and the moment the verification test runs. The value of this ADR is entirely contingent on [ADR-0018](./ADR-0018-architecture-governance-ci-gate.md)'s CI gate being mandatory.
- **The Shared Kernel is a standing coupling risk.** Every context depends on it, so a change there has the widest possible blast radius. Growth must be resisted actively; the mitigation is the size discipline, and size discipline is not automatable.

### Neutral / follow-on

- The physical package root and the admin BFF's placement are for [`Backend Architecture.md`](../../02-backend/Backend%20Architecture.md) to detail; this record fixes the structure, not the naming.

## 6. Related Decisions

[ADR-0002](./ADR-0002-modular-monolith-deployment-unit.md) · [ADR-0005](./ADR-0005-clean-architecture-ports-and-adapters.md) · [ADR-0007](./ADR-0007-jmolecules-tactical-ddd.md) · [ADR-0012](./ADR-0012-transactional-outbox-and-kafka.md) · [ADR-0018](./ADR-0018-architecture-governance-ci-gate.md)

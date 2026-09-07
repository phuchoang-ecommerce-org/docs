# ADR-0009 — PostgreSQL as the Single Transactional Source of Truth

**Document type:** Architecture Decision Record
**Status:** Accepted
**Date:** 2026-09-06
**Deciders:** Solution Architecture
**Traces to:** `P4` · `P7` · `P10` · `NFR-REL-01` · `NFR-REL-02` · `NFR-PERF-02` · `NFR-SCAL-07` · `BR-ORD-02`
**Related documents:** [Solution Architecture](../Solution%20Architecture.md) · [Domain Model](../../02-backend/Domain%20Model.md)

---

## 1. Context and Problem Statement

`P7` states that a partial failure across order, payment, and inventory must not go unnoticed. `NFR-REL-01` makes it absolute: *"No operation spanning order, payment, and inventory ever completes partially. Under induced failure at any point, the outcome is either fully applied or fully absent."*

[`Domain Model.md`](../../02-backend/Domain%20Model.md) §5.1 sharpens this into the platform's central design constraint. `BR-ORD-02` requires order creation and stock reservation to be one indivisible operation, and reading `UC-ORD-05` with `UC-PRM-02` shows the indivisibility is three-way: `Order`, `StockItem`, and `Promotion` must commit together, since promotion usage-cap consumption is structurally the same oversell problem as stock. Each aggregate's invariant is single-aggregate; **atomicity across the three comes from one shared local database transaction.**

That places a hard requirement on the transactional store: it must give real ACID transactions spanning multiple tables owned by different bounded contexts, in one process. Everything else — search, caching, analytics — is downstream of it.

## 2. Decision Drivers

- `NFR-REL-01` — no partial completion, verified by fault injection at each step.
- `NFR-REL-02` — repeated submission of a confirmed checkout never produces a second order, including under concurrency (`BR-ORD-03`).
- `BR-ORD-02` — order creation and stock reservation indivisible, including under system failure.
- `NFR-PERF-02` — transactional writes ≤ 800 ms p95 (assumption **[A-03]**).
- `P10` / `NFR-SCAL-07` — query cost must stay flat as data grows, which requires a mature planner and real index support.
- `Domain Model.md` §7 — several global constraints (`BR-CAT-01` SKU uniqueness, `BR-CUS-01` email uniqueness, `BR-REV-02`, `BR-AUD-03`) have a **database constraint as their actual enforcement point**.

## 3. Considered Options

**Option 1 — PostgreSQL as the sole transactional store.** *(chosen)*

- **Pros:** Serializable and read-committed isolation with real multi-table ACID transactions — exactly what the three-aggregate Partnership needs. Row-level versioning supports the optimistic locking of [ADR-0011](./ADR-0011-optimistic-locking-reservation-model.md). Unique and check constraints give `BR-CAT-01`, `BR-CUS-01`, `BR-REV-02`, and `BR-AUD-03` an enforcement point that no application-level race can defeat. A mature planner plus composite and partial indexes answer `P10` directly. The Transactional Outbox ([ADR-0012](./ADR-0012-transactional-outbox-and-kafka.md)) needs the outbox insert to be in the same local transaction as the business write — which requires a single relational store, not a federation.
- **Cons:** Vertical scaling limits on the write path; a single instance is a single point of failure for the entire purchase path (`NFR-AVAIL-01`). Schema migrations require deliberate handling.

**Option 2 — MongoDB as the primary transactional store.**

- **Pros:** Flexible schema; horizontal scale-out; already in the stack for read models.
- **Cons:** Multi-document transactions exist but carry cost and constraints that make them a poor fit for the highest-frequency, highest-stakes path on the platform. No relational unique constraints across the shapes `BR-CAT-01` and `BR-CUS-01` need. `Solution Architecture.md` §2 already forecloses this: *"MongoDB is not the transactional source of truth."*

**Option 3 — Store-per-context (PostgreSQL for Ordering, something else for Inventory, etc.).**

- **Pros:** Maximum context autonomy; each context picks its ideal store; closest to a microservices end state.
- **Cons:** Destroys the shared local transaction the Order-Placement Partnership depends on, converting `BR-ORD-02` into a distributed saga inside a single deployable — all of the complexity of distribution with none of its benefits. Also breaks the Outbox pattern's core premise. Directly contradicts [ADR-0002](./ADR-0002-modular-monolith-deployment-unit.md).

**Option 4 — PostgreSQL with a separate schema per bounded context, same database and connection.**

- **Pros:** Logical separation visible in the store; cross-schema transactions still work, so the Partnership is unaffected; a natural seam for future extraction.
- **Cons:** Cross-schema foreign keys either get used (recreating coupling in the database that [ADR-0006](./ADR-0006-spring-modulith-module-boundaries.md) removed from the code) or get forbidden (needing its own governance). Adds migration and permission complexity now for extraction convenience later.

## 4. Decision Outcome

**Chosen: Option 1.** One PostgreSQL database is the transactional source of truth for every context. Read models are derived from it and are never authoritative.

| Commitment | Reason |
|---|---|
| **One database, one connection pool, one transaction manager** | The Order-Placement Partnership requires a single local transaction across three contexts (`Domain Model.md` §5.1). |
| **Table naming carries the owning module prefix** (`ordering_order`, `inventory_stock_item`) | Ownership stays legible in the store without cross-schema machinery; each module's tables are written only by that module's adapters. |
| **No cross-module foreign keys** | A FK from `ordering_order` to `inventory_stock_item` reintroduces at the storage layer the coupling [ADR-0006](./ADR-0006-spring-modulith-module-boundaries.md) removed from the code. Cross-context references are typed IDs, not constraints. |
| **Global uniqueness rules are database constraints** | `BR-CAT-01`, `BR-CUS-01`, `BR-REV-02`, `BR-AUD-03` — per `Domain Model.md` §7, the constraint is the enforcement point and any domain pre-check exists only for fast feedback. |
| **Indexes are designed against named query patterns** | `P10`, `NFR-SCAL-07`. Composite indexes such as `(customer_id, created_at DESC)` for order history; partial indexes for the outbox's unpublished rows and for active promotions. Every index is justified by a query, and unused indexes are removed — they are write-path cost. |
| **Transaction boundary is owned by `@ApplicationService`** | Per [ADR-0007](./ADR-0007-jmolecules-tactical-ddd.md); no controller and no domain service opens a transaction. |
| **Read-committed by default; explicit escalation where a rule requires it** | Oversell prevention rests on optimistic version checks ([ADR-0011](./ADR-0011-optimistic-locking-reservation-model.md)) rather than on blanket serializable isolation, which would cost `NFR-PERF-02`. |

## 5. Consequences

### Positive

- `NFR-REL-01` and `BR-ORD-02` are satisfied by plain transaction rollback. A mid-placement failure releases every reservation already taken with no compensating-action code (`Domain Model.md` §5.1).
- Global uniqueness constraints are enforced where no application race can bypass them.
- `P10` is answerable with indexes rather than with architecture.

### Negative

- **Single point of failure for the purchase path.** `NFR-AVAIL-01` (99.9% monthly, assumption **[A-12]**) rests on this instance. High availability, backup, and restore are prerequisites, and no record covers them yet — a real gap.
- **The write path scales vertically only.** Absorbing `NFR-SCAL-06`'s 10× peak depends on keeping reads off this store, which is what [ADR-0015](./ADR-0015-redis-cache-and-rate-limiting.md) and [ADR-0014](./ADR-0014-elasticsearch-search-read-model.md) exist to do. If write throughput ever becomes the limit, this decision is what gets revisited first.
- **No cross-module FKs means no referential integrity across contexts.** An `Order` can reference a deleted `Product`. Accepted deliberately — `BR-ORD-06` freezes order-line prices at placement precisely so an order does not depend on the catalog's current state — but it means orphan detection is an application concern.
- **One shared database is a coupling risk over time.** Nothing physically stops a query joining another module's tables; the prohibition is enforced by review and by adapters being module-private ([ADR-0006](./ADR-0006-spring-modulith-module-boundaries.md)).

### Neutral / follow-on

- Migration tooling, HA topology, and backup/restore policy are undecided and not covered by any record.
- Extraction of a context later means extracting its tables; the module-prefixed naming makes that mechanical rather than archaeological.

## 6. Related Decisions

[ADR-0002](./ADR-0002-modular-monolith-deployment-unit.md) · [ADR-0008](./ADR-0008-cqrs-command-query-separation.md) · [ADR-0010](./ADR-0010-jpa-write-model-jdbc-read-models.md) · [ADR-0011](./ADR-0011-optimistic-locking-reservation-model.md) · [ADR-0012](./ADR-0012-transactional-outbox-and-kafka.md) · [ADR-0013](./ADR-0013-mongodb-scoped-to-read-models.md) · [ADR-0029](./ADR-0029-flyway-versioned-schema-migrations.md)

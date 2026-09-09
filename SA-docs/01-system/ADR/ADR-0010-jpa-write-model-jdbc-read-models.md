# ADR-0010 — Spring Data JPA for the Write Model, Spring Data JDBC for Read Models

**Status:** Accepted
**Date:** 2026-09-06
**Traces to:** `P12` · `CON-03` · `NFR-MAINT-03` · `NFR-PERF-01` · `NFR-PERF-02` · `NFR-REL-03`

---

## 1. Context and Problem Statement

[`Technology Stack.md`](../Technology%20Stack.md) said, at the time of this record: *"MongoDB/PostgreSQL (Using both of Spring Data JPA and Spring Data JDBC)."* (The line has since been amended to name all three Spring Data modules and their sides — by this record and by [ADR-0030](./ADR-0030-spring-data-mongodb-read-model-access.md). The original wording is quoted here because it is the ambiguity this record exists to resolve.) It committed to using both and said nothing about which is used where. Left unresolved, "both" means each developer chooses per repository, and the persistence strategy becomes an accident of who wrote the class.

The two are genuinely different tools. JPA gives a persistence context, dirty checking, lazy loading, and `@Version` optimistic locking — machinery that suits an aggregate with a lifecycle. Spring Data JDBC has no persistence context and no lazy loading; it maps a query result to an object and stops — which suits a read model, and makes the SQL that answers a `NFR-PERF-01` latency target visible rather than generated.

[ADR-0008](./ADR-0008-cqrs-command-query-separation.md) already splits the command path from the query path. That split gives "both" a principled boundary, if one is drawn deliberately.

## 2. Decision Drivers

- `NFR-REL-03` — concurrent purchase attempts must never confirm more orders than there is stock. The oversell defence is a versioned conditional update ([ADR-0011](./ADR-0011-optimistic-locking-reservation-model.md)), and JPA's `@Version` implements exactly that.
- `NFR-PERF-01` (300 ms p95 reads) and `NFR-PERF-02` (800 ms p95 writes) — a latency target is only defensible if the SQL behind it is known.
- `CON-03` / `NFR-MAINT-03` — the domain model must not be shaped by the ORM ([ADR-0005](./ADR-0005-clean-architecture-ports-and-adapters.md)).
- `Domain Model.md` §7 — one repository per aggregate root, never per entity. `StockReservation` and `CartLine` are child entities that must be loaded and saved through their root.
- The N+1 and lazy-loading-exception failure modes are the most common performance defects in Spring persistence, and both come from JPA on a read path.

## 3. Considered Options

**Option 1 — JPA for the write model, JDBC for read models.** *(chosen)*

- **Pros:** Uses each tool where its cost buys something. JPA's persistence context, cascading, and `@Version` are exactly what an aggregate needs — `StockItem` with its `StockReservation` children is a textbook case, and `@Version` is the `NFR-REL-03` mechanism. JDBC on the read side eliminates lazy-loading exceptions and N+1 by construction, and makes each query's SQL explicit and reviewable against its latency target. The split mirrors [ADR-0008](./ADR-0008-cqrs-command-query-separation.md), so a class's persistence technology follows from which side it is on rather than from preference.
- **Cons:** Two persistence technologies, two mapping styles, two sets of failure modes in one codebase. Both need configuring against the same `DataSource`, and the transaction manager must be shared correctly.

**Option 2 — JPA everywhere.**

- **Pros:** One technology; one mental model; derived query methods everywhere.
- **Cons:** Read queries acquire a persistence context they never need, paying dirty-check cost on every managed entity. Lazy loading turns a projection into an N+1 hazard, which is the single most common way an `NFR-PERF-01` budget is blown. Entity graphs and DTO projections exist to fix this, and are themselves a body of workaround knowledge. Contradicts the stack's explicit commitment to use both.

**Option 3 — JDBC everywhere.**

- **Pros:** No hidden behaviour; every statement visible; simplest possible model; strong aggregate-orientation by design.
- **Cons:** Loses `@Version` optimistic locking as a first-class feature, so `NFR-REL-03`'s defence becomes hand-written version-check SQL on the platform's most critical invariant. Loses cascading persistence for aggregates with child entities, so `StockItem` → `StockReservation` and `Order` → `OrderLine` lifecycles are managed by hand. Trades a well-understood tool for hand-rolled equivalents on exactly the path where correctness matters most.

**Option 4 — JPA for the write model, plain `JdbcTemplate` for reads.**

- **Pros:** Maximum control; no second Spring Data module.
- **Cons:** Row-mapper boilerplate for every projection — the kind of boilerplate `P15` names as a maintenance cost. Spring Data JDBC provides the same explicitness with mapping included.

## 4. Decision Outcome

**Chosen: Option 1.** The persistence technology follows the CQRS side.

| | Write model (commands) | Read models (queries) |
|---|---|---|
| Technology | Spring Data JPA / Hibernate | Spring Data JDBC |
| Applies to | Aggregate roots and their child entities | Projections, list views, detail views, reporting queries against PostgreSQL |
| Annotated with | `@PersistenceAdapter` implementing a JMolecules `@Repository` interface | `@QueryService` with `@Transactional(readOnly = true)` |
| Optimistic locking | `@Version` on every aggregate root | not applicable |
| Fetching | Eager within the aggregate boundary; **no lazy collections across it** | Explicit SQL, one statement per view |

Supporting rules:

- **One repository per aggregate root** (`Domain Model.md` §7). `StockReservation`, `CartLine`, and `OrderLine` have no repository; they are reached through `StockItem`, `Cart`, and `Order`.
- **JPA entities are not domain objects.** They are persistence-layer types living in `infrastructure`, mapped to and from domain objects by MapStruct ([ADR-0005](./ADR-0005-clean-architecture-ports-and-adapters.md)). This is the cost `NFR-MAINT-03` is worth paying — an ORM annotation never appears on `Order`.
- **No lazy loading crosses an aggregate boundary.** A lazy reference from `Order` to another aggregate is a design error, not a tuning opportunity; cross-aggregate references are typed IDs ([ADR-0009](./ADR-0009-postgresql-source-of-truth.md)).
- **Read queries name their SQL.** Every `@QueryService` method carries the statement it runs, so it can be checked against `NFR-PERF-01` and against the index that supports it (`P10`).
- Both share the single `DataSource` and transaction manager of [ADR-0009](./ADR-0009-postgresql-source-of-truth.md), so a read inside a command transaction sees that transaction's writes.

## 5. Consequences

### Positive

- `NFR-REL-03`'s oversell defence uses `@Version`, a well-understood mechanism, rather than hand-written version SQL on the most critical path in the system.
- The read path cannot suffer a lazy-loading exception or an accidental N+1, because the technology has neither feature.
- Every latency-budgeted query has visible SQL, so `NFR-PERF-01` and `NFR-PERF-03` become reviewable at the statement level rather than at the abstraction level.

### Negative

- **Two persistence technologies is real cognitive load.** A developer must know which side they are on before choosing a repository style, and the two have different null-handling, different mapping conventions, and different failure modes.
- **JPA entity plus domain object plus DTO** means three shapes for `Order`. MapStruct generates the mapping, but the shapes are designed and maintained by hand, and adding one field touches all three.
- **Hibernate's behaviour is still Hibernate's behaviour.** Flush timing, cascade semantics, and first-level caching remain present on the write path and still need to be understood; this decision narrows their blast radius rather than removing them.

### Neutral / follow-on

- MongoDB read models use Spring Data MongoDB and Elasticsearch its own client; this record governs PostgreSQL access only. [ADR-0030](./ADR-0030-spring-data-mongodb-read-model-access.md) picks up the MongoDB half.
- Whether a given read is served from PostgreSQL/JDBC or from a projected store is [ADR-0008](./ADR-0008-cqrs-command-query-separation.md)'s classification table, not a per-query preference.

## 6. Related Decisions

[ADR-0005](./ADR-0005-clean-architecture-ports-and-adapters.md) · [ADR-0007](./ADR-0007-jmolecules-tactical-ddd.md) · [ADR-0008](./ADR-0008-cqrs-command-query-separation.md) · [ADR-0009](./ADR-0009-postgresql-source-of-truth.md) · [ADR-0011](./ADR-0011-optimistic-locking-reservation-model.md) · [ADR-0030](./ADR-0030-spring-data-mongodb-read-model-access.md)

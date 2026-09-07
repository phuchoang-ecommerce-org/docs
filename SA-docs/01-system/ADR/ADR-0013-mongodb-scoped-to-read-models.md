# ADR-0013 — MongoDB Scoped to Flexible Read Models Only

**Document type:** Architecture Decision Record
**Status:** Accepted
**Date:** 2026-09-06
**Deciders:** Solution Architecture
**Traces to:** `P4` · `P13` · `CON-06` · `NFR-PERF-05` · `NFR-PERF-06`
**Related documents:** [Solution Architecture](../Solution%20Architecture.md) · [Technology Stack](../Technology%20Stack.md) · [ADR-0008](./ADR-0008-cqrs-command-query-separation.md)

---

## 1. Context and Problem Statement

[`Technology Stack.md`](../Technology%20Stack.md) lists *"MongoDB/PostgreSQL."* [`Solution Architecture.md`](../Solution%20Architecture.md) §2 immediately constrains it, and the constraint is unusually emphatic:

> MongoDB is not the transactional source of truth. PostgreSQL remains the source of truth for all transactional data. MongoDB is introduced only where a read model's document shape evolves independently of the transactional schema and does not require relational transaction semantics. **If a use case does not need that property, MongoDB is not used for it.**

§7 reinforces it by listing MongoDB against "`P4` (scoped)" — the only technology in that table carrying a qualifier.

The risk this record addresses is not that MongoDB is wrong. It is that a document store present in the stack tends to acquire use cases by convenience rather than by need, and the platform then has two sources of truth without anyone having decided to create one. This record states where MongoDB is used, where it is not, and what test a new use case must pass.

## 2. Decision Drivers

- `Solution Architecture.md` §2's scoping rule is already binding; this record operationalises it rather than reopening it.
- `NFR-PERF-06` — reporting may lag by at most 5 minutes; inventory and payment state carry **no** permitted lag.
- `CON-06` / `NFR-PERF-05` — analytical work must not contend with transactional work.
- `P13` — reporting must not run aggregates against live transactional tables.
- Every additional datastore is operational surface for one team already running PostgreSQL, Redis, Elasticsearch, and Kafka.

## 3. Considered Options

**Option 1 — MongoDB for flexible read models and the reporting projection, fed by Kafka.** *(chosen)*

- **Pros:** A denormalised document matches a screen's shape exactly, so a view is one lookup instead of a multi-table join. Document shape evolves without a migration, which is the property `Solution Architecture.md` §2 names. Pre-aggregated reporting documents make `P13`'s dashboards cheap and give `CON-06` a physically separate store, so `NFR-PERF-05` is satisfied structurally. Rebuildable from Kafka, so it is never authoritative.
- **Cons:** A fourth datastore to run, back up, and monitor. Every projection is code plus lag monitoring. Two representations of the same data can drift if a projection is buggy.

**Option 2 — No MongoDB; serve flexible views and reporting from PostgreSQL (JSONB where needed).**

- **Pros:** One less datastore. `JSONB` with GIN indexes covers a lot of what a document store offers. One backup story, one operational model.
- **Cons:** Reporting aggregates then run on the transactional instance, which is exactly what `CON-06` forbids and `P13` describes as the problem. A separate PostgreSQL reporting instance recovers the isolation — but then the count of datastores is unchanged and the shape flexibility is lost. A genuinely viable option if the reporting workload turns out small; recorded so that it is the first thing reconsidered if MongoDB's operational cost outweighs its use.

**Option 3 — MongoDB as the primary store for some contexts (e.g. Review, Notification).**

- **Pros:** Those contexts have simple, document-shaped, low-invariant data; a document store fits.
- **Cons:** Directly violates §2's rule. It would also split the transactional store, which breaks the Outbox premise ([ADR-0012](./ADR-0012-transactional-outbox-and-kafka.md)) and the shared local transaction ([ADR-0009](./ADR-0009-postgresql-source-of-truth.md)) for those contexts. Even for Review — where `BR-REV-02`'s one-review-per-customer-per-product rule is a database unique constraint per `Domain Model.md` §7 — the fit is worse than it looks.

**Option 4 — Elasticsearch for reporting too, dropping MongoDB entirely.**

- **Pros:** Removes a datastore; Elasticsearch aggregations are capable and fast.
- **Cons:** Couples the search index's lifecycle and capacity to the reporting workload, so a heavy dashboard query degrades `NFR-PERF-03` and `NFR-PERF-04` on the conversion-critical path. Reintroduces the contention `CON-06` forbids, just between two read models instead of between reads and writes.

## 4. Decision Outcome

**Chosen: Option 1**, tightly scoped.

**MongoDB is used for exactly two things:**

| Use | Fed by | Consistency |
|---|---|---|
| **Reporting & Analytics read model** — pre-aggregated documents for dashboards (`P13`) | Kafka events from all contexts | Eventual, ≤ 5 minutes (`NFR-PERF-06`) |
| **Flexible denormalised read views** whose document shape evolves independently of the transactional schema | Kafka events from the owning context | Eventual, seconds |

**MongoDB is never used for:** order state · payment state · stock or reservations · cart contents · account credentials or roles · the audit log ([ADR-0017](./ADR-0017-append-only-audit-log.md)) · any data a business invariant is enforced against.

**Admission test.** A new MongoDB use case must answer *yes* to both:

1. Does this read model's document shape evolve independently of the transactional schema?
2. Can it tolerate eventual consistency, and is it fully rebuildable from Kafka?

A *no* to either means PostgreSQL — through a JDBC projection ([ADR-0010](./ADR-0010-jpa-write-model-jdbc-read-models.md)) — is the answer. "It would be easier in Mongo" is not a *yes*.

**Reporting & Analytics has zero upstream influence** (`Domain Model.md` §5.2): no context designs around Reporting's needs, and Reporting never publishes an event.

## 5. Consequences

### Positive

- `CON-06` and `NFR-PERF-05` hold structurally — a dashboard query is physically incapable of touching a table checkout depends on.
- Dashboards read pre-aggregated documents rather than computing `JOIN`/`SUM`/`GROUP BY` at request time, so `P13` is answered at the storage layer.
- The admission test gives the §2 rule teeth: a reviewer has a question to ask rather than a principle to invoke.

### Negative

- **A fourth datastore.** Backup, restore, upgrade, monitoring, and on-call knowledge for a store that serves no write path. This is the least-justified item in the stack by traced business need, and it is recorded as such.
- **Reporting lag is user-visible.** A dashboard can be five minutes behind (`NFR-PERF-06`). Any view where staleness is not acceptable is by definition not a MongoDB use case, and the admission test is what keeps that line from eroding.
- **Projection code and lag monitoring per read model** — not free, and lag must be alerted on, not merely observable.
- **Two representations of the same data.** The mitigation is derivation plus rebuildability, not reconciliation.

### Neutral / follow-on

- If the reporting workload turns out modest, Option 2 (a separate PostgreSQL reporting instance) removes a technology at equal isolation. This is the first thing to revisit if operational cost bites.
- Document schema versioning and rebuild procedure are for [`Backend Architecture.md`](../../02-backend/Backend%20Architecture.md).

## 6. Related Decisions

[ADR-0008](./ADR-0008-cqrs-command-query-separation.md) · [ADR-0009](./ADR-0009-postgresql-source-of-truth.md) · [ADR-0012](./ADR-0012-transactional-outbox-and-kafka.md) · [ADR-0014](./ADR-0014-elasticsearch-search-read-model.md)

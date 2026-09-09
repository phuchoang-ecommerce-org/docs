# Solution Architecture — Enterprise Commerce Platform (ECP)

**Document type:** Solution Architecture
**Related documents:** [Business Problem Analysis](../../BA-docs/general-approach.md) · [Software Requirements Specification](../../BA-docs/srs.md) · [Traceability Matrix](../../BA-docs/traceability-matrix.md) · [Technology Stack](./Technology%20Stack.md) · [Architecture Decision Records](./ADR/README.md)
**Audience:** Engineering, Product Management, Architecture Review

---

## 1. Purpose of This Document

The [Business Problem Analysis](../../BA-docs/general-approach.md) catalogs seventeen business problems (P1–P17) the Enterprise Commerce Platform must solve, independent of any technology. This document takes each of those problems and answers: *what architectural decision addresses it, what technology implements that decision, and why*.

It also closes the loop the other business documents deliberately leave open. [`srs.md`](../../BA-docs/srs.md) §2 fixes the actors and external interfaces this system must serve without saying how; §6 states measurable non-functional targets without saying what meets them; §8 lists capabilities this release must not foreclose; §9 states the criteria the business will judge the platform against. Sections 4, 6, 10, and 12 below answer each of those in turn, so that nothing in the business analysis is left without an architectural answer.

No technology in this stack is included because it is popular or because the stack "should" have it. Every entry below traces back to a specific, named business problem.

---

## 2. Architecture Decision Principle

Every architectural and technology decision in this document follows the same chain of reasoning:

```mermaid
flowchart LR
    A[Business Problem] --> B[Requirement]
    B --> C[Constraint]
    C --> D[Architecture Decision]
    D --> E[Technology]
```

Two decisions in this stack are explicitly **scoped**, not applied universally, and are worth calling out because they are common sources of over-engineering:

- **MongoDB** is not the transactional source of truth. PostgreSQL remains the source of truth for all transactional data. MongoDB is introduced only where a read model's document shape evolves independently of the transactional schema and does not require relational transaction semantics (e.g., flexible, denormalized read views). If a use case does not need that property, MongoDB is not used for it.
- **Kafka** is not required for every inter-module interaction. Within the modular monolith, in-process domain events are sufficient for same-deployment communication. Kafka is introduced specifically where an interaction must cross a durability or distribution boundary — i.e., where the event must survive process restarts, fan out to multiple asynchronous consumers, or eventually cross a service boundary.

---

## 3. High-Level Architecture

```mermaid
flowchart TB
    Client[Client Applications] --> API[REST API + Authentication]
    API --> Monolith[Modular Monolith — Spring Modulith]

    subgraph Monolith[" "]
        Command[Command Side<br/>Domain Layer — Clean Architecture]
        Query[Query Side]
    end

    Command --> PG[(PostgreSQL<br/>Transactional Store)]
    Command --> Outbox[Transactional Outbox]
    Outbox --> Kafka[[Kafka — Event Backbone]]

    Kafka --> Mongo[(MongoDB<br/>Flexible Read Models)]
    Kafka --> ES[(Elasticsearch<br/>Search Index)]
    Kafka --> Redis[(Redis<br/>Cache / Hot Data)]
    Kafka --> Analytics[Reporting & Analytics Read Model]

    Query --> Mongo
    Query --> ES
    Query --> Redis
    Query --> Analytics
```

This is a **logical** architecture. The system is delivered today as a modular monolith — a single deployable unit with enforced internal module boundaries — not as a set of independently deployed microservices. Section 11 explains how this architecture enables that transition later, if and when the business needs it. The full backend/frontend technology shortlist this architecture draws from is maintained separately in [Technology Stack](./Technology%20Stack.md).

The governing architectural style is: **Modular Monolith + Domain-Driven Design + Clean Architecture + CQRS + Event-Driven Architecture**, with Kafka as the event backbone for interactions that genuinely require asynchronous, durable, multi-consumer delivery.

---

## 4. System Context — Actors & External Interfaces

Architecture decisions are not sized against an abstract "the system" — they are sized against who and what actually calls it. This section fixes that context, drawn from SRS §2.3 and §2.6, before Section 5 maps problems to decisions.

### Actors

![Actors and system boundary](../../BA-docs/diagrams/system-context.svg)

| Actor | Enters through | Architectural consequence |
|---|---|---|
| Guest | REST API, unauthenticated | Cart and browse state must be servable without a Customer aggregate; a guest cart merges into the customer's cart on login — a Cart module concern, not a Customer module concern (P1). |
| Customer | REST API, JWT-authenticated | The primary caller of Catalog, Cart, Order, Payment, Review, Notification. |
| Staff | REST API, JWT-authenticated, `Staff` role | Catalog, promotion, and commercial order-progression operations — same API, RBAC-scoped (P16). |
| Warehouse Operator | REST API, JWT-authenticated, `Warehouse` role | Inventory and shipment operations — the actor whose concurrent actions the reservation model in P8 exists to serialize correctly. |
| Customer Support Agent | REST API, JWT-authenticated, `Support` role | Order/shipment inspection, cancellation, refund initiation, review moderation. |
| Administrator | REST API, JWT-authenticated, `Admin` role | Full operational authority, including role management and the audit trail (P16, P17). |
| Scheduler (Time) | In-process scheduled job / Kafka delayed delivery | Drives cart expiry, flash-sale start/end, promotion expiry — not a human caller, but a first-class trigger the domain model must accept the same way it accepts an API call (P5: no rule may live only behind a human-initiated entry point). |
| Payment Gateway | Outbound adapter call; inbound async webhook | See External Interfaces below. |
| Shipping Carrier | Outbound adapter call; inbound async webhook | See External Interfaces below. |
| Email Service Provider | Outbound adapter call | See External Interfaces below. |

The role authority table in SRS §2.3 is normative for `FR-AUD-05` and is implemented directly as the RBAC policy referenced in P16 — every row of that table becomes an authorization rule enforced at the API/application boundary, never a client-side assumption.

### External Interfaces

Every external interface in SRS §2.6 is reached through a port defined in the domain/application layer and implemented by an adapter in infrastructure — the Clean Architecture boundary from P3 applied concretely:

| Interface | Direction | Port (domain-facing) | Adapter (infrastructure) | Failure handling |
|---|---|---|---|---|
| Payment Gateway | Outbound authorize/capture/refund; inbound async settlement callback | `PaymentProcessor` port | Provider-specific adapter | Callback is idempotent and correlates to an order via a stable reference; provider unavailability fails the operation cleanly and is retryable (`NFR-AVAIL-03`), and never leaves an order in an ambiguous state (P7). |
| Shipping Carrier | Outbound dispatch request; inbound tracking/delivery events | `ShippingProvider` port | Provider-specific adapter | Same idempotent-callback and clean-failure treatment as Payment Gateway. |
| Email Service Provider | Outbound only | `NotificationSender` port | Provider-specific adapter, invoked as a Kafka consumer of business events (P2, P6) | Delivery failure does not block the business transaction that triggered it — email is a consumer of an already-committed event, not a step inside the transaction. |
| Client Applications (web storefront, admin console, future mobile) | Inbound | REST API | Shared API layer, RBAC-scoped per Actors above | This is the entry point, not an integration — its only obligation is that no client is trusted to enforce a rule the platform doesn't also enforce (P5). |

Because each provider sits behind a port, replacing a payment processor or adding a second shipping carrier (P3) is an adapter-level change — it does not touch Order, Payment, or Shipping domain logic, and it requires no change to the ports those modules already depend on.

---

## 5. Business Problem → Architecture Decision Mapping

Each entry below corresponds to the identically-numbered problem in the Business Problem Analysis.

### Theme A — Growth & Extensibility of Business Capability

#### P1. Business domains are multiplying and becoming interdependent

- **Architecture decision:** Organize the codebase around explicit business modules (Catalog, Inventory, Ordering, Payment, Shipping, Promotion, Customer), each owning its own domain model, application services, infrastructure, and a deliberate public API. Everything not exposed through that API is private to the module.
- **Technology:** Domain-Driven Design (Strategic Design) + Spring Modulith.
- **Rationale:** Spring Modulith turns module boundaries from a documentation convention into a structural, verifiable property of the codebase — a module cannot reach into another module's internals, only its public API or its published events. This directly targets P1: a new capability (e.g., a future Loyalty module) can be added without deep changes to Order, Payment, or Inventory, and a change inside one module has a bounded blast radius.

#### P2. New capabilities need to plug into existing business events without destabilizing the core

- **Architecture decision:** Core workflows publish domain events for significant business moments (e.g., `OrderPaid`) instead of directly invoking every interested downstream capability.
- **Technology:** Domain Events (in-process) and Kafka (cross-boundary), consumed independently by each interested capability.
- **Rationale:** This inverts the dependency direction described in P2. The Order module does not need to know that Loyalty, CRM, or Recommendation exist; each of those capabilities subscribes to the event on its own terms. A new capability is added by adding a new consumer, not by modifying the order workflow.

```mermaid
flowchart LR
    OrderPaid([OrderPaid Event]) --> Kafka[[Kafka]]
    Kafka --> Notification[Notification]
    Kafka --> Loyalty[Loyalty — future]
    Kafka --> CRM[CRM — future]
    Kafka --> Analytics[Analytics]
    Kafka --> Recommendation[Recommendation — future]
```

---

### Theme B — Adaptability to Business & Technology Change

#### P3. Dependence on a single provider or vendor increases switching cost and risk

- **Architecture decision:** Domain and application logic depend only on abstractions (ports) that describe *what* is needed (e.g., "process a payment"), never on a specific provider's SDK or protocol. Concrete providers are plugged in as adapters behind those ports.
- **Technology:** Clean Architecture (ports & adapters / hexagonal boundary).
- **Rationale:** This is a direct answer to P3. Swapping a payment provider, adding a second shipping carrier, or integrating an external ERP/CRM system becomes a matter of writing a new adapter, not modifying business logic. It also keeps the domain model free of framework and vendor-specific types, which lowers the cost of every future integration named in the SRS's Future Expansion section.

#### P4. Not all business data needs to be equally up-to-the-millisecond

- **Architecture decision:** Explicitly classify data by the consistency guarantee it actually requires, and apply strong consistency only where the business impact of staleness is unacceptable.
- **Technology:** PostgreSQL with ACID transactions for Order/Payment/Inventory; eventual consistency (via Kafka-propagated events) for Search, Analytics, and Recommendation read models.
- **Rationale:** This makes the trade-off in P4 deliberate instead of accidental. Money and stock get strong consistency because the cost of being wrong is high. Search rankings and dashboards tolerate a few seconds of lag because the cost of staleness there is negligible — and accepting that lag is what allows those read paths to scale independently of the transactional store.

---

### Theme C — Business Rule Integrity & Trust

#### P5. Business rules must hold regardless of how a request enters the system

- **Architecture decision:** Business invariants (e.g., "stock cannot go negative," "an order can only transition through valid states," "only a verified buyer may review a product") are enforced inside the domain model itself — in Aggregates and Domain Services — not in controllers, admin scripts, or individual API handlers.
- **Technology:** DDD Tactical Design (Aggregate Root, Entity, Value Object, Domain Service, Domain Event), reinforced by JMolecules to make these concepts explicit and enforceable in code.
- **Rationale:** Because every entry point — REST API, admin tooling, batch jobs, future mobile clients — routes through the same domain layer, there is exactly one place a rule can be enforced, and it cannot be bypassed by a new or overlooked entry point. This is the structural answer to P5.

#### P6. Business-critical events must never silently disappear between systems

- **Architecture decision:** Persist the intent to publish an event in the same database transaction as the business change it describes, and let a separate, reliable process deliver it to the event backbone.
- **Technology:** Transactional Outbox pattern (PostgreSQL) + Kafka.
- **Rationale:** Writing to a database and publishing to a message broker cannot be done as a single atomic operation, because they are different systems. The Outbox pattern solves this by making the "publish" step part of the same local transaction as the business write, and only that transaction needs to succeed. A separate worker then reliably relays outbox rows to Kafka, guaranteeing that if the business change was committed, the event will eventually be published — directly closing the gap described in P6.

```mermaid
flowchart LR
    subgraph TX["PostgreSQL Transaction"]
        Order[Update Order]
        OutboxRow[Insert Outbox Row]
    end
    TX --> Worker[Outbox Relay Worker]
    Worker --> Kafka[[Kafka]]
    Kafka --> Notification[Notification]
    Kafka --> Analytics[Analytics]
    Kafka --> Downstream[Other Consumers]
```

---

### Theme D — Revenue & Financial Integrity

#### P7. A partial failure in the order, payment, or inventory process must not go unnoticed

- **Architecture decision:** All state changes within a single business transaction (e.g., creating an order and reserving inventory) are committed atomically — either the entire unit succeeds, or none of it does.
- **Technology:** PostgreSQL with ACID transaction guarantees.
- **Rationale:** This is the most direct available answer to P7. Atomicity eliminates the class of failure where money is charged without an order existing, or inventory is decremented without a completed sale, which is precisely the risk the business cannot absorb.

#### P8. Sudden concentrated demand must never allow the platform to sell what it does not have

- **Architecture decision:** Stock changes under concurrent access are validated and applied atomically, with an explicit reservation state between "available" and "confirmed" stock, rather than a simple read-then-write that can race.
- **Technology:** PostgreSQL optimistic locking (versioned updates with a conditional `WHERE`) combined with an availability/reservation/confirmation stock model; Redis for high-throughput reservation counters where extreme concurrency (flash sales) requires it.
- **Rationale:** A naive "read stock, subtract, write stock" sequence allows two concurrent requests to both read the same available quantity and both succeed, overselling the product. Conditional, versioned updates guarantee that a stock decrement only succeeds if the previously-read state is still valid, directly preventing the overselling scenario described in P8.

```mermaid
flowchart TB
    Req1[Request A] --> Check{Available >= Requested<br/>AND version matches?}
    Req2[Request B] --> Check
    Check -->|Yes, first to commit| Reserve[Reserve Stock<br/>version += 1]
    Check -->|No — stale version| Retry[Reject / Retry]
```

---

### Theme E — Peak-Demand & Operational Resilience

#### P9. The platform's highest-traffic moments are also its highest-revenue moments

- **Architecture decision:** Absorb read-heavy and repeated-access traffic in front of the transactional database, so a demand spike does not directly translate into a database load spike.
- **Technology:** Redis as a cache-aside layer for hot data (popular products, categories, cart, session, rate limiting), combined with the reservation-based concurrency control from P8 for the write path.
- **Rationale:** During a flash sale, the overwhelming majority of requests are reads (viewing the product, checking stock) rather than writes (completing a purchase). Redis absorbs that read volume with sub-millisecond latency, keeping PostgreSQL free to handle the smaller but critical volume of writes — which is exactly what P9 requires: the system must not degrade at the moment it matters most.

#### P10. Growth in customers, products, and orders must not translate into proportionally worse performance or cost

- **Architecture decision:** Query patterns that are known and frequent (e.g., "a customer's orders, most recent first") are supported by purpose-built database indexes rather than relying on full table scans that degrade as data volume grows.
- **Technology:** Database indexing strategy aligned to actual query patterns (e.g., composite index on `(customer_id, created_at)`).
- **Rationale:** As order volume grows from thousands to millions of rows, an unindexed query's cost grows with it, while an indexed query's cost stays roughly flat. This directly addresses P10 by decoupling response latency and infrastructure cost from data growth, and delays or removes the need for more expensive scaling strategies (sharding, read replicas).

---

### Theme F — Customer Experience & Conversion

#### P11. Customers who cannot quickly find what they want will leave without buying

- **Architecture decision:** Product discovery (full-text search, filtering, ranking, autocomplete) is served by a purpose-built, denormalized search read model, kept in sync with the transactional catalog via events rather than queried live from it.
- **Technology:** Elasticsearch, populated via Kafka events published from the Catalog module.
- **Rationale:** Relational pattern-matching queries (e.g., `LIKE '%keyword%'`) do not scale to fast, relevant, filterable search at catalog sizes in the tens of thousands of products and beyond. A dedicated search index directly targets P11 — the business problem of lost conversion due to poor product discovery — by making search fast and relevant regardless of catalog size.

#### P12. Precise transaction handling and fast, flexible browsing are two different jobs the platform must do equally well

- **Architecture decision:** Separate the write path (commands that change state) from the read path (queries that serve data), allowing each to be modeled, optimized, and scaled independently.
- **Technology:** CQRS — commands against PostgreSQL; queries against purpose-built read models (Elasticsearch for search, Redis for hot reads, MongoDB/reporting store for flexible or aggregated views).
- **Rationale:** This is the structural answer to P12. Instead of one data model trying to simultaneously guarantee transactional integrity and serve fast, denormalized reads — and doing both poorly — each side is optimized for what it actually needs to do.

```mermaid
flowchart LR
    API[API] --> Command[Command]
    API --> Query[Query]
    Command --> PG[(PostgreSQL)]
    Query --> Redis[(Redis)]
    Query --> ES[(Elasticsearch)]
    Query --> Mongo[(MongoDB)]
```

---

### Theme G — Operational Intelligence

#### P13. Leadership needs timely visibility into the business without slowing down the business itself

- **Architecture decision:** Reporting and analytics are served from a dedicated read model built from the same business events used elsewhere, rather than running aggregate queries (JOINs, SUM, GROUP BY) directly against the live transactional tables.
- **Technology:** CQRS + event-driven projection into a reporting-optimized store, fed by Kafka.
- **Rationale:** An admin dashboard running heavy aggregate queries against the same tables that customer checkout depends on creates direct resource contention between the two. Projecting a separate reporting model from business events removes that contention entirely, which is precisely what P13 requires: analytics and transactions stop competing for the same resources.

---

### Theme H — Organizational & Delivery Sustainability

#### P14. Delivery teams working on different parts of the business must not block each other

- **Architecture decision:** The same module boundaries introduced for P1 double as ownership boundaries for delivery teams — a Catalog team can develop against Catalog's public API without needing to coordinate line-by-line with the Order team.
- **Technology:** Spring Modulith module structure, aligned to team ownership.
- **Rationale:** Because the enforced module boundary already limits how one area of the system can depend on another's internals, teams working in different modules are structurally prevented from creating the kind of tight coupling that would otherwise force them to coordinate on every change — directly addressing P14 as headcount grows.

#### P15. Without ongoing discipline, the platform's structure will erode and every future feature will cost more than the last

- **Architecture decision:** Architectural rules (dependency direction, module boundaries, layering) are expressed as automated tests that run in continuous integration, not as documentation that developers are expected to remember.
- **Technology:** ArchUnit (dependency and layering rules) + JMolecules (explicit DDD building blocks) + Spring Modulith's own boundary verification.
- **Rationale:** A rule that only exists in a document degrades the moment someone doesn't read it. A rule enforced by a failing build cannot be silently violated. This turns architecture quality from "developer discipline" into a verifiable constraint, which is the direct, durable answer to the erosion described in P15.

---

### Theme I — Risk, Security & Accountability

#### P16. Every role in the business must be able to do exactly what its job requires — no more, no less

- **Architecture decision:** Every operation is authorized against the caller's role before it executes, with roles that map directly to real business functions (Customer, Staff, Warehouse, Customer Support, Administrator).
- **Technology:** Role-Based Access Control (RBAC) enforced at the API/application boundary, backed by JWT-based authentication with refresh tokens.
- **Rationale:** This maps directly onto P16: the platform's roles are not an abstract technical concept but a reflection of real job functions, and enforcing them consistently prevents the exact failure mode described in the business problem — a role performing an action outside its intended scope.

#### P17. The business must be able to answer "who did this, when, and why" for every significant action

- **Architecture decision:** Every significant business action (price change, inventory adjustment, order cancellation, refund approval, promotion creation) produces an immutable audit record capturing the actor, the timestamp, the before/after state, and, where applicable, a reason.
- **Technology:** Append-only audit logging, populated from the same domain events used elsewhere in the architecture.
- **Rationale:** Because audit records are derived from domain events already being published for other purposes (P2, P6), accountability is achieved without duplicating business logic — every meaningful action is already an event, and audit logging is simply one more consumer of it. This directly satisfies P17's requirement for traceability and immutability.

---

## 6. Quality Attribute Targets

Section 5 states which architecture decision answers each business problem. This section states the numbers those decisions are actually sized against, taken from SRS §6 — the same targets that turn "acceptable latency" or "handles high traffic" from an adjective into something a load test either passes or fails.

### Performance & Scalability

| Target | Requirement | Architecture mechanism |
|---|---|---|
| Catalog/category reads ≤ 300 ms p95 | `NFR-PERF-01` | Redis cache-aside (P9) + database indexing (P10) |
| Search first results ≤ 500 ms p95 | `NFR-PERF-03` | Elasticsearch (P11) |
| Autocomplete ≤ 150 ms p95 | `NFR-PERF-04` | Elasticsearch (P11) |
| Transactional writes ≤ 800 ms p95 | `NFR-PERF-02` | PostgreSQL + optimistic locking / reservation model (P7, P8) |
| Catalog ≥ 10,000 products, ≥ 100,000 customers, thousands of orders/day, thousands of concurrent customers — without breaching the targets above | `NFR-SCAL-01`–`NFR-SCAL-04` | Database indexing (P10) + CQRS read/write separation (P12) + Redis absorption of read volume (P9) |
| Absorb 10× median throughput for the duration of a peak event | `NFR-SCAL-06` | Redis + reservation-based concurrency control (P8, P9) |
| Report generation must not measurably degrade `NFR-PERF-01`/`NFR-PERF-02` under concurrent load | `NFR-PERF-05` | CQRS projection into a dedicated reporting store (P13) |
| Reporting may lag transactional state by at most 5 minutes; inventory and payment state carry no permitted lag | `NFR-PERF-06` | Event-driven projection (P4, P13) — the concrete number behind the P4 consistency-classification decision |

### Availability & Reliability

| Target | Requirement | Architecture mechanism |
|---|---|---|
| Purchase path (browse, cart, checkout, payment) available 99.9% monthly | `NFR-AVAIL-01` | Read-path caching isolates the purchase path from non-essential-capability load (P9) |
| Failure of search, recommendations, reviews, or reporting must not prevent browsing/checkout/payment | `NFR-AVAIL-02` | CQRS: each read model is a separate consumer; a downstream read model being down does not block the command side (P12) |
| Provider unavailability fails cleanly and is retryable, and never corrupts platform state | `NFR-AVAIL-03` | Ports & adapters (P3) + PostgreSQL transaction boundary (P7) |
| No order/payment/inventory operation ever completes partially | `NFR-REL-01`, `NFR-REL-02` | PostgreSQL ACID transactions (P7) |
| Concurrent purchase attempts never confirm more orders than there is stock to fulfil | `NFR-REL-03` | Optimistic locking / reservation model (P8) |
| An accepted business event is delivered to every dependent process at least once, even after infrastructure failure | `NFR-REL-05`, `NFR-REL-06` | Transactional Outbox + Kafka (P6) |

### Security

| Target | Requirement | Architecture mechanism |
|---|---|---|
| Every operation authorized server-side against the caller's role | `NFR-SEC-01` | RBAC at the API/application boundary (P16) |
| Access tokens short-lived; refresh tokens rotate on use, reuse invalidates the session | `NFR-SEC-03` | JWT authentication with refresh-token rotation (P16) |
| Request rates limited per caller; authentication endpoints carry a stricter limit | `NFR-SEC-05` | Redis-backed rate limiting (P9, P16) |
| Credentials, payment details, and tokens never appear in logs or audit entries | `NFR-SEC-07` | Audit logging derived from domain events carries only business fields, never raw request payloads (P17) |

These targets are what "sizing" means in practice: Redis is not introduced because caching is good practice — it is introduced because `NFR-PERF-01` and `NFR-SCAL-06` cannot both hold under `NFR-SCAL-04`'s concurrency without it. Where SRS §2.5 marks a figure as an assumption rather than a Product Owner-confirmed number — **[A-03]** the 300 ms / 800 ms latency split, **[A-04]** the 10× peak multiplier, **[A-12]** the 99.9% availability target — this architecture is sized against the assumption and should be re-validated if the assumption changes.

---

## 7. Technology Stack Summary

| Technology | Business Problem(s) Addressed | Business Value | ADR |
|---|---|---|---|
| Domain-Driven Design (Strategic + Tactical) | P1, P5 | Clear business boundaries; rules enforced consistently everywhere | [0006](./ADR/ADR-0006-spring-modulith-module-boundaries.md), [0007](./ADR/ADR-0007-jmolecules-tactical-ddd.md) |
| Spring Modulith | P1, P14 | Verifiable module boundaries; supports team scaling | [0006](./ADR/ADR-0006-spring-modulith-module-boundaries.md) |
| Clean Architecture | P3 | Low switching cost for vendors/providers; framework-independent domain | [0005](./ADR/ADR-0005-clean-architecture-ports-and-adapters.md) |
| CQRS | P12, P13 | Transactions and reads scale and evolve independently | [0008](./ADR/ADR-0008-cqrs-command-query-separation.md) |
| PostgreSQL | P4, P7, P8 | ACID guarantees protect money, orders, and inventory | [0009](./ADR/ADR-0009-postgresql-source-of-truth.md), [0010](./ADR/ADR-0010-jpa-write-model-jdbc-read-models.md) |
| Optimistic Locking / Reservation Model | P8 | Prevents overselling under concurrent demand | [0011](./ADR/ADR-0011-optimistic-locking-reservation-model.md) |
| Transactional Outbox | P6 | No business event is ever silently lost | [0012](./ADR/ADR-0012-transactional-outbox-and-kafka.md) |
| Apache Kafka | P2, P6, P9, P11, P13 | Reliable, decoupled distribution of business events | [0012](./ADR/ADR-0012-transactional-outbox-and-kafka.md) |
| Event-Driven Architecture | P2, P4 | New capabilities plug in without core coupling | [0012](./ADR/ADR-0012-transactional-outbox-and-kafka.md) |
| Elasticsearch | P11 | Fast, relevant product search drives conversion | [0014](./ADR/ADR-0014-elasticsearch-search-read-model.md) |
| Redis | P9 | Absorbs traffic spikes; low-latency hot data | [0015](./ADR/ADR-0015-redis-cache-and-rate-limiting.md) |
| MongoDB | P4 (scoped) | Flexible read models where relational structure isn't needed | [0013](./ADR/ADR-0013-mongodb-scoped-to-read-models.md) |
| Database Indexing | P10 | Query performance and cost stay flat as data grows | [0009](./ADR/ADR-0009-postgresql-source-of-truth.md) |
| Reporting Read Model (CQRS projection) | P13 | Business intelligence without impacting checkout | [0008](./ADR/ADR-0008-cqrs-command-query-separation.md), [0013](./ADR/ADR-0013-mongodb-scoped-to-read-models.md) |
| ArchUnit | P15 | Architecture rules enforced automatically in CI | [0018](./ADR/ADR-0018-architecture-governance-ci-gate.md) |
| JMolecules | P5, P15 | DDD concepts made explicit and checkable in code | [0007](./ADR/ADR-0007-jmolecules-tactical-ddd.md) |
| RBAC + JWT Authentication | P16 | Access limited to what each role legitimately needs | [0016](./ADR/ADR-0016-jwt-refresh-rotation-rbac.md), [0025](./ADR/ADR-0025-httponly-cookie-session.md) |
| Audit Logging | P17 | Every significant action is traceable and immutable | [0017](./ADR/ADR-0017-append-only-audit-log.md) |
| MapStruct | P3 | Clean mapping between domain, persistence, and API layers without leaking framework concerns into the domain | [0005](./ADR/ADR-0005-clean-architecture-ports-and-adapters.md) |
| Lombok | P15 | Reduces boilerplate, keeping the codebase easier to review and maintain | [0027](./ADR/ADR-0027-java-21-spring-boot-4-gradle.md) |

The `ADR` column links each technology to the record that argues for it — including the alternatives that were weighed and rejected. Decisions with no row here because they are not a *technology* — the modular monolith itself, the REST API style, and the whole frontend stack — are recorded in the [ADR index](./ADR/README.md).

---

## 8. Architecture Governance

§5 `P15` names the mechanism — Spring Modulith for module-boundary verification, ArchUnit for layering and dependency-direction rules, JMolecules for making DDD building blocks explicit types — and [ADR-0018](./ADR/ADR-0018-architecture-governance-ci-gate.md) is the record of why governance is a CI gate rather than a review practice, with the rule table it enforces. Neither is repeated here.

---

## 9. Delivery Roadmap

The architecture is deliberately delivered in a sequence that builds each layer on top of a working prior layer, rather than attempting all capabilities simultaneously.

| Phase | Focus | Problems Addressed | Primary Technology |
|---|---|---|---|
| 1 | Modular foundation | P1, P14 | DDD (Strategic) + Spring Modulith |
| 2 | Domain modeling & invariants | P5 | DDD (Tactical) + Clean Architecture |
| 3 | Concurrency-safe inventory | P7, P8 | PostgreSQL transactions + optimistic locking |
| 4 | Read/write separation | P12 | CQRS |
| 5 | Reliable event distribution | P2, P6 | Domain Events + Transactional Outbox + Kafka |
| 6 | Caching & traffic absorption | P9 | Redis (cache-aside) |
| 7 | Product search | P11 | Elasticsearch |
| 8 | Operational intelligence | P13 | CQRS projection + reporting read model |
| 9 | Query performance at scale | P10 | Database indexing |
| 10 | Architecture governance | P15 | ArchUnit + JMolecules |

Security (P16) and audit (P17) are treated as cross-cutting concerns implemented alongside every phase above, rather than as a discrete late-stage phase — access control and traceability must exist from the first transactional workflow onward, not be retrofitted.

---

## 10. Future Expansion — Extensibility Roadmap

SRS §8 lists ten capabilities explicitly deferred from this release — not because they're unimportant, but because R1 requires that each "can be added with minimal impact to existing modules." The obligation this places on the architecture is not to build these now; it is to not make them expensive later.

| Deferred capability | How this architecture keeps the door open |
|---|---|
| Loyalty programme, membership levels, reward points | New module subscribing to `OrderPaid` / `PaymentSettled` via Kafka (P2) — no change to checkout or payment |
| AI product recommendation | Recommendation is already a separable read concern; a new consumer projects off existing catalog/order events (P2, P11) |
| Chat support, live shopping | New bounded module under Spring Modulith (P1) |
| Multi-language | Catalog content is modeled so translatable text is a value, not a schema decision — extending it is additive |
| Multi-currency | Monetary Value Objects already carry amount, currency, and precision explicitly (SRS **[A-10]**) rather than a bare number — a second currency is a new value, not a new type |
| Multi-region | Independent read/write scaling (CQRS, P12) and enforced module boundaries (P1) mean a region is a deployment-topology decision, not a domain redesign |
| Multi-vendor marketplace | Catalog, Inventory, and Order Aggregates can carry an explicit seller/ownership attribute without redesign, because ownership is already a first-class concept in the domain model (P5) |
| Mobile application | Every rule is enforced server-side (P5) — a new client is a new caller of the same REST API and RBAC policy, not a new place rules must be re-implemented |
| External ERP integration | New adapter behind a port (P3) |
| External CRM integration | New adapter behind a port (P3); also a new Kafka consumer of the events already published for P2 |

---

## 11. Path to Microservices

The platform is delivered today as a **modular monolith**, not a set of independently deployed services. This is a deliberate choice, not a limitation: at the current scale, a single deployable unit with enforced internal boundaries delivers the benefits described above (P1, P14) with lower operational overhead than a distributed system would require.

```mermaid
flowchart LR
    subgraph Today["Today — Modular Monolith"]
        Catalog1[Catalog]
        Order1[Ordering]
        Payment1[Payment]
    end
    subgraph Future["Future — Extracted Services, if business growth requires it"]
        Catalog2[Catalog Service] --> KafkaF[[Kafka]]
        Order2[Order Service] --> KafkaF
        Payment2[Payment Service] --> KafkaF
    end
    Today -. module boundaries already enforced .-> Future
```

Because module boundaries (P1) are enforced today rather than assumed, and cross-module communication already favors events over direct calls (P2, P6) where durability matters, extracting any individual module into its own deployable service — should the business reach a scale that requires it — is a boundary-preserving change rather than a rewrite. Spring Modulith is therefore best understood not as "microservices in disguise," but as the mechanism that keeps that future option open without paying its operational cost today.

---

## 12. Acceptance Criteria Traceability

SRS §9 states six conditions under which the business considers these problems solved. Each is an outcome, not a technology, so it is verified by the architecture as a whole rather than owned by a single decision:

| ID | Criterion | Verified primarily by |
|---|---|---|
| `AC-01` | All core business workflows function correctly | Domain layer enforcing invariants regardless of entry point (P5); PostgreSQL ACID transactions (P7) |
| `AC-02` | Business rules enforced consistently regardless of entry point | DDD Aggregates/Domain Services as the single enforcement point (P5); RBAC at the API boundary (P16) |
| `AC-03` | New business modules addable with minimal modification to existing code | Spring Modulith module boundaries (P1) + domain events as the extension point (P2, Section 10) |
| `AC-04` | The system remains maintainable as complexity increases | ArchUnit + JMolecules + Spring Modulith boundary verification as automated CI gates (P15) |
| `AC-05` | Reporting does not significantly impact transactional operations | CQRS projection into a dedicated reporting store (P13) |
| `AC-06` | Production-quality architecture suitable for an enterprise environment | The reliability, security, availability, and observability mechanisms in Section 6, taken together, not any single one |

A criterion here is satisfied only when the architecture decisions that back it are actually implemented and tested against the targets in Section 6 — this table exists so that gap is visible at the architecture level, not discovered for the first time during acceptance testing.

---

## 13. Summary

No technology decision in this architecture stands on its own. Each one is the answer to a specific, named business problem from the [Business Problem Analysis](../../BA-docs/general-approach.md):

```mermaid
flowchart TB
    Business[Business Problems P1–P17] --> Architecture[Architecture Decisions]
    Architecture --> Tech[Technology Stack]
    Tech --> Outcomes[Revenue Protection · Customer Trust · Delivery Velocity · Compliance]
```

Where a technology's application is not justified by a specific problem — as called out in Section 2 for MongoDB and Kafka — its use is deliberately scoped rather than applied universally, to keep the architecture aligned with actual business need rather than technology adoption for its own sake.

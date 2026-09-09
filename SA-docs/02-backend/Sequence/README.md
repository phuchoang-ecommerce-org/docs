# Sequence Diagrams — Enterprise Commerce Platform (ECP)

**Document type:** Backend architecture specification — index
**Status:** **Proposed** — these documents settle ordering questions no existing document states
**Audience:** Backend Engineering, Frontend Engineering, Architecture Review, QA
**Related documents:** [Domain Model](../Domain%20Model.md) · [Module Dependency Diagram](../Module%20Dependency%20Diagram.md) · [Solution Architecture](../../01-system/Solution%20Architecture.md) · [Integration Contract](../../04-shared/Integration%20Contract.md) · [Use Cases](../../../BA-docs/use-cases/README.md)

---

## 1. Why This Folder Exists

`SA-docs/` documents the platform from every angle except **behaviour over time**. There are use-case diagrams, a context map, a module dependency graph, a deployment topology, an OpenAPI contract, and thirty ADRs — and none of them shows a single request travelling through the layers they describe.

That gap is load-bearing. The platform's three most expensive problems are all temporal:

| Problem | Decided by | Diagram |
|---|---|---|
| **P7** — partial failure across order, payment, and inventory | Where the transaction boundary sits | [`01-Ordering.md`](./01-Ordering.md) §6, §9 |
| **P8** — overselling under concentrated demand | The interleaving of two concurrent optimistic-lock updates | [`01-Ordering.md`](./01-Ordering.md) §7 |
| **P6** — a committed fact no downstream process hears about | The outbox row committing inside the business transaction | [`00-Overview.md`](./00-Overview.md) §3 |

Each is a claim about *ordering*, and prose is a poor medium for ordering. `Solution Architecture.md` §4 asserts that a provider timeout "is not a decline"; `ADR-0012` asserts that the outbox row and the business update share one transaction. These diagrams are where those assertions become checkable.

[`SA-docs/README.md`](../../README.md#folder-layout) §1.1 reserved `02-backend/Sequence/` for exactly this, and [`SA-docs/README.md`](../../README.md) recorded it as omitted "until there is something to put in it."

---

## 2. The Documents

| Document | Diagrams | Covers |
|---|---|---|
| [`00-Overview.md`](./00-Overview.md) | 3 | The purchase-path map, the request pipeline every call passes through, and the event backbone behind every asynchronous arrow |
| [`01-Ordering.md`](./01-Ordering.md) | 10 | Checkout assembly, **placement**, cancellation, status advance — and the three failure paths that decide P7 and P8 |
| [`02-Inventory.md`](./02-Inventory.md) | 4 | Reservation, commitment, adjustment, expiry |
| [`03-Payment.md`](./03-Payment.md) | 7 | Authorisation, the provider callback, COD settlement, refund — and the three ways a provider result goes wrong |
| [`04-Identity.md`](./04-Identity.md) | 7 | Registration, login, session refresh and rotation, logout, password reset, reuse detection, authorisation denial |
| [`05-Cart-Catalog-Search.md`](./05-Cart-Catalog-Search.md) | 8 | Cart operations, product display, search, and the read-model projections that feed them |
| [`06-Fulfilment.md`](./06-Fulfilment.md) | 7 | Shipment creation, carrier tracking, delivery — and promotion redemption and flash-sale launch |
| [`07-Supporting.md`](./07-Supporting.md) | 10 | Review, notification, administration, reporting, audit |

**Reading order.** [`00-Overview.md`](./00-Overview.md) first — it establishes the map and the two mechanisms every other diagram leans on. Then [`01-Ordering.md`](./01-Ordering.md), which is where the architecture is actually decided. Everything after that can be read on demand.

---

## 3. The Participant Vocabulary

**Every diagram draws the same actor from the same set of lifelines, named identically.** A reader who learns the vocabulary once can read all fifty-six. Names are taken from the documents that own them, never invented:

| Tier | Lifelines | Named by |
|---|---|---|
| Actors | `Customer`, `Guest`, `Staff`, `Warehouse Operator`, `Support Agent`, `Administrator`, `Scheduler`, `Payment Gateway`, `Shipping Carrier`, `Email Service Provider` | [Solution Architecture §4](../../01-system/Solution%20Architecture.md) Actors table |
| Edge | `Browser`, `Next.js server`, `nginx` | [`deployment.puml`](../../diagrams/deployment.puml) |
| API layer | `RateLimitFilter`, `JwtAuthenticationFilter`, `«X»Controller` | [ADR-0015](../../01-system/ADR/ADR-0015-redis-cache-and-rate-limiting.md), [ADR-0016](../../01-system/ADR/ADR-0016-jwt-refresh-rotation-rbac.md), the OpenAPI paths |
| Application layer | `«UseCase»Service`, `AuthorizationService` | [ADR-0005](../../01-system/ADR/ADR-0005-clean-architecture-ports-and-adapters.md); `AuthorizationService` is Identity's Open Host Service per [Module Dependency Diagram §3.2](../Module%20Dependency%20Diagram.md) |
| Domain | `Order`, `StockItem`, `Cart`, `Promotion`, `Payment`, `Shipment`, `Account`, `Product`, `Review` | [Domain Model §8](../Domain%20Model.md) aggregate roots |
| Ports | `StockReservationPort`, `PromotionRedemptionPort`, `PaymentProcessor`, `ShippingProvider`, `NotificationSender` | [Domain Model §5.1](../Domain%20Model.md), [Solution Architecture §4](../../01-system/Solution%20Architecture.md) External Interfaces |
| Adapters | `InventoryStockAdapter`, `PromotionAdapter`, `«Provider»PaymentAdapter`, `CarrierAdapter`, `EmailAdapter` | [Module Dependency Diagram §3.1](../Module%20Dependency%20Diagram.md) — the two Partnership adapters live in `ordering.infrastructure` |
| Infrastructure | `PostgreSQL`, `OutboxRepository`, `Outbox relay`, `Kafka`, `Redis`, `Elasticsearch`, `MongoDB` | [`deployment.puml`](../../diagrams/deployment.puml) |
| Projectors | `SearchProjector`, `AvailabilityProjector`, `ReportingProjector`, `AuditListener`, `NotificationListener` | [ADR-0013](../../01-system/ADR/ADR-0013-mongodb-scoped-to-read-models.md), [ADR-0014](../../01-system/ADR/ADR-0014-elasticsearch-search-read-model.md), [Domain Model §5.2](../Domain%20Model.md) |

A near-duplicate — `OrderService` alongside `PlaceOrderService` — means the vocabulary has drifted and is a defect, not a stylistic choice.

### 3.1 Arrow vocabulary

The transport of every message is visible in its arrow, because [`ADR-0012`](../../01-system/ADR/ADR-0012-transactional-outbox-and-kafka.md) §4 fixes transport by rule rather than by preference, and confusing the three is what makes an architecture look atomic when it is not:

| Arrow | Transport | Creates a module dependency? |
|---|---|---|
| `A->>B` | Synchronous call — in-process, same thread, same transaction | **Yes** |
| `A-->>B` | Return value | — |
| `A-)B` | In-process Spring Modulith event | **Yes** — the listener names the publisher's type |
| `A--)B` | Outbox + Kafka publication or delivery | **No** — [Module Dependency Diagram §5](../Module%20Dependency%20Diagram.md) |

### 3.2 Transaction frames

A tinted `rect` with a `Note over` header encloses **exactly** the messages inside one PostgreSQL transaction. This is the single most important visual element in the folder: it is what makes `BR-ORD-02` and the outbox rule visible instead of merely asserted. Everything drawn after a `COMMIT` divider is, by construction, unable to undo what the frame committed.

### 3.3 Layered, with three module-level exceptions

The three diagrams in [`00-Overview.md`](./00-Overview.md) use module-level lifelines — `Ordering`, `Inventory`, `Payment` — and exist to give the map. **Every other diagram is layered**: `Customer → Next.js server → nginx → Controller → Application Service → Aggregate → Port → Adapter → PostgreSQL / Kafka / provider`. The [ADR-0005](../../01-system/ADR/ADR-0005-clean-architecture-ports-and-adapters.md) port boundary and the transaction boundary are precisely what every failure mode turns on, so collapsing them would hide the subject.

The request pipeline is drawn once, in [`00-Overview.md`](./00-Overview.md) §2. Every other diagram collapses it to a one-line note. Without that, fifty-five diagrams each open with the same six messages.

---

## 4. Format

Every document in this folder assumes §3 — the participant vocabulary and the arrow and frame conventions of §3.1–§3.2 — without restating it.

Mermaid, embedded directly in these Markdown files, per the convention [`SA-docs/README.md`](../../README.md) §1 already sets: PlantUML `.puml` for standalone diagrams in [`diagrams/`](../../diagrams), Mermaid for diagrams that live inside a document. `util/toHtml.js` renders them, following the reader's light or dark theme, with click-to-zoom and drag-to-pan.

```bash
cd util && npm run docs:html      # every *.md -> a styled, gitignored *.html sibling
```

There is nothing to compile and no generated image to keep in step with its source — the diagram *is* the document, which is the point of choosing Mermaid over a committed SVG for this material.

Two constraints the syntax imposes, worth knowing before editing: a semicolon inside a label ends the statement, so HTML entities such as `&lt;` break the parser (`«guillemets»` are used instead), and Mermaid has no reference-box element, so cross-diagram pointers are written as notes.

---

## 5. What These Diagrams Do Not Claim

Stated plainly, in the register this repository already uses for its own gaps ([Integration Contract §8.4](../../04-shared/Integration%20Contract.md), [Testing and Benchmark Strategy](../../01-system/Testing%20and%20Benchmark%20Strategy.md)):

- **Nothing here is verified against code, because there is no code.** `ecommerce-backend-spring` is a Spring Boot scaffold and `ecommerce-frontend-next` is a starter page. These diagrams are specification — the same status as [`Database.md`](../Database.md) and the OpenAPI contract, which also describe a system not yet built. They are what an implementation should be checked *against*.
- **The class and method names on these lifelines will become stale assertions** once controllers and services exist, and the [ADR-0018](../../01-system/ADR/ADR-0018-architecture-governance-ci-gate.md) CI gate cannot catch it. The only mitigation is that §3's naming is derived from artefacts the gate *does* check — the module graph and the OpenAPI contract — rather than invented here.
- **Timing is ordinal, never quantitative.** No diagram asserts a latency. The `NFR-PERF-*` targets belong to [`Testing and Benchmark Strategy.md`](../../01-system/Testing%20and%20Benchmark%20Strategy.md).
- **Retry bounds, backoff curves, hold windows, and relay poll intervals are configuration**, per [ADR-0011](../../01-system/ADR/ADR-0011-optimistic-locking-reservation-model.md) §5. A diagram shows *that* a bounded retry happens, never how many times.
- **Failure diagrams are not exhaustive.** They cover the exception flows whose cost is high enough to have shaped an architecture decision. The full set lives in the [use-case specifications](../../../BA-docs/use-cases/README.md), which remain normative for behaviour.

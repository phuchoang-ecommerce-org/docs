# Sequence Diagrams — Enterprise Commerce Platform (ECP)

**Document type:** Backend architecture specification — index
**Status:** **Proposed** — these documents settle ordering questions no existing document states
**Audience:** Backend Engineering, Frontend Engineering, Architecture Review, QA
**Related documents:** [Domain Model](../Domain%20Model.md) · [Module Dependency Diagram](../Module%20Dependency%20Diagram.md) · [Solution Architecture](../../01-system/Solution%20Architecture.md) · [Integration Contract](../../04-shared/Integration%20Contract.md) · [Use Cases](../../../BA-docs/use-cases/README.md)

## 1. Scope

These 56 diagrams specify message order and transaction boundaries across 14 domains. They make three failure-sensitive decisions visible:

| Problem | Decided by | Diagram |
|---|---|---|
| **P7** — partial failure across order, payment, and inventory | Where the transaction boundary sits | [`01-Ordering.md`](./01-Ordering.md) §6, §9 |
| **P8** — overselling under concentrated demand | The interleaving of two concurrent optimistic-lock updates | [`01-Ordering.md`](./01-Ordering.md) §7 |
| **P6** — a committed fact no downstream process hears about | The outbox row committing inside the business transaction | [`00-Overview.md`](./00-Overview.md) §3 |

The diagrams show the order behind these claims. They do not replace the normative use cases or contracts.

## 2. Documents

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

Read [`00-Overview.md`](./00-Overview.md) first, then [`01-Ordering.md`](./01-Ordering.md). Read the remaining files by domain.

## 3. Participant vocabulary

All diagrams use the same lifeline names. Names come from their owning documents:

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

Near-duplicate names such as `OrderService` and `PlaceOrderService` are vocabulary drift.

### 3.1 Arrows

Each arrow identifies its transport under [`ADR-0012`](../../01-system/ADR/ADR-0012-transactional-outbox-and-kafka.md) §4:

| Arrow | Transport | Creates a module dependency? |
|---|---|---|
| `A->>B` | Synchronous call — in-process, same thread, same transaction | **Yes** |
| `A-->>B` | Return value | — |
| `A-)B` | In-process Spring Modulith event | **Yes** — the listener names the publisher's type |
| `A--)B` | Outbox + Kafka publication or delivery | **No** — [Module Dependency Diagram §5](../Module%20Dependency%20Diagram.md) |

### 3.2 Transaction frames

A tinted `rect` with a `Note over` header contains the messages in one PostgreSQL transaction. Messages after a `COMMIT` divider cannot undo that transaction. This notation shows `BR-ORD-02` and the outbox rule.

### 3.3 Layers

The three diagrams in [`00-Overview.md`](./00-Overview.md) use module-level lifelines. All other diagrams show the full path: `Customer → Next.js server → nginx → Controller → Application Service → Aggregate → Port → Adapter → PostgreSQL / Kafka / provider`.

The request pipeline appears once in [`00-Overview.md`](./00-Overview.md) §2. Other diagrams replace it with a note.

## 4. Format

The diagrams use Mermaid embedded in Markdown. Standalone diagrams in [`diagrams/`](../../diagrams) use PlantUML. The Astro documentation reader renders Mermaid diagrams directly.

```bash
cd util && npm run dev            # browse the Markdown documentation and Mermaid diagrams locally
```

Do not use HTML entities with semicolons inside labels; the semicolon ends the Mermaid statement. Use `«guillemets»` where needed. Mermaid has no reference box, so cross-diagram references use notes.

## 5. Limits

- The diagrams are specifications and are not verified against implementation code. The backend and frontend are still scaffolds.
- Lifeline class and method names can drift after implementation. Naming is derived from the module graph and OpenAPI contract, but the [ADR-0018](../../01-system/ADR/ADR-0018-architecture-governance-ci-gate.md) gate does not verify these diagrams.
- Timing is ordinal. [`Testing and Benchmark Strategy.md`](../../01-system/Testing%20and%20Benchmark%20Strategy.md) owns `NFR-PERF-*` latency targets.
- Retry counts, backoff, hold windows, and relay intervals are configuration under [ADR-0011](../../01-system/ADR/ADR-0011-optimistic-locking-reservation-model.md) §5.
- Failure diagrams cover architecture-shaping cases only. The [use cases](../../../BA-docs/use-cases/README.md) remain normative for behavior.

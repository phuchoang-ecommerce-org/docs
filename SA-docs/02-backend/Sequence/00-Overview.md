# Sequence Diagrams — Overview

**Document type:** Backend architecture specification
**Status:** **Proposed**
**Audience:** Backend Engineering, Frontend Engineering, Architecture Review
**Related documents:** [README](./README.md) · [Module Dependency Diagram](../Module%20Dependency%20Diagram.md) · [Domain Model](../Domain%20Model.md) · [Integration Contract](../../04-shared/Integration%20Contract.md)

Three module-level diagrams. The first is the map; the other two are mechanisms that every layered diagram in this folder leans on rather than redrawing.

Arrow and frame conventions are in [`README.md`](./README.md) §3.1–§3.2.

---

## 1. The Purchase Path

The whole of it, context to context, with each step naming the layered diagram that expands it. Nothing here is authoritative about ordering *within* a step — that is what the expansions are for. What it is authoritative about is the sequence of steps and, crucially, which of them share a transaction: exactly one does.

| | |
|---|---|
| **Use cases** | `UC-CAT-03` · `UC-CRT-01` · `UC-ORD-01`–`05` · `UC-PAY-02` · `UC-INV-03` · `UC-SHP-03`–`06` · `UC-REV-01` |
| **Business rules** | `BR-CRT-04` · `BR-ORD-01` · `BR-ORD-02` · `BR-INV-01` · `BR-PAY-01` |
| **Decisions** | [ADR-0005](../../01-system/ADR/ADR-0005-clean-architecture-ports-and-adapters.md) · [ADR-0011](../../01-system/ADR/ADR-0011-optimistic-locking-reservation-model.md) · [ADR-0012](../../01-system/ADR/ADR-0012-transactional-outbox-and-kafka.md) |
| **Problems** | `P6` · `P7` · `P8` · `P11` |

```mermaid
sequenceDiagram
  autonumber
  actor Customer
  actor Warehouse as Warehouse Operator
  participant Catalog
  participant Cart
  participant Ordering
  participant Inventory
  participant Promotion
  participant Payment
  participant Shipping
  participant Review
  participant Kafka
  actor Gateway as Payment Gateway
  actor Carrier as Shipping Carrier

  Note over Customer,Carrier: BROWSE AND COLLECT — nothing is committed
  Customer->>Catalog: view product, search
  Customer->>Cart: add to cart
  Cart->>Catalog: live price plus ADVISORY availability (Open Host Service)
  Cart->>Promotion: NON-BINDING discount preview
  Note over Cart: BR-CRT-04 — a cart line never carries a price.<br/>Nothing here reserves stock or commits a discount.

  Note over Customer,Carrier: CHECKOUT — assembling the obligation
  Customer->>Ordering: initiate checkout
  Cart-)Ordering: CartCheckedOut — unpriced snapshot, once
  Customer->>Ordering: address, shipping option, voucher, summary
  Ordering->>Shipping: quote the fee through ShippingProvider

  Note over Customer,Carrier: PLACEMENT — the only atomic step
  Customer->>Ordering: place order
  rect rgba(124,92,255,0.08)
    Note over Ordering,Promotion: ONE PostgreSQL transaction — BR-ORD-02
    Ordering->>Inventory: StockReservationPort.reserve()
    Ordering->>Promotion: PromotionRedemptionPort.redeem()
    Ordering->>Ordering: create Order, DRAFT to PENDING_PAYMENT, write outbox row
  end
  Note over Ordering,Promotion: P7 and P8 are both decided inside this frame.<br/>Synchronous port calls, not events — an asynchronous<br/>handoff cannot be atomic (ADR-0012 §4).
  Ordering--)Kafka: OrderCreated

  Note over Customer,Carrier: PAYMENT — a separate transaction, reached only after the first committed
  Kafka--)Payment: OrderCreated
  Payment->>Gateway: authorise and capture through PaymentProcessor
  Gateway--)Payment: asynchronous result
  Payment--)Kafka: PaymentCaptured
  Kafka--)Ordering: PENDING_PAYMENT to PAID

  Note over Customer,Carrier: FULFILMENT
  Warehouse->>Ordering: advance status
  Ordering--)Kafka: OrderPacked
  Kafka--)Shipping: create shipment
  Shipping->>Carrier: dispatch through ShippingProvider
  Warehouse->>Inventory: commit reservation, Held to Committed
  Carrier--)Shipping: tracking and delivery
  Shipping--)Kafka: ShipmentDelivered
  Kafka--)Ordering: to DELIVERED

  Note over Customer,Carrier: AFTER DELIVERY
  Kafka--)Review: OrderDelivered unlocks verified-buyer eligibility
  Customer->>Review: submit review
  Review--)Kafka: ReviewPublished
  Kafka--)Catalog: rating display
```

**Where each step is expanded**

| Step | Diagram |
|---|---|
| Browse, search | [`05-Cart-Catalog-Search.md`](./05-Cart-Catalog-Search.md) §6, §7 |
| Add to cart | [`05-Cart-Catalog-Search.md`](./05-Cart-Catalog-Search.md) §2 |
| Checkout steps | [`01-Ordering.md`](./01-Ordering.md) §2–§5 |
| **Place order** | [`01-Ordering.md`](./01-Ordering.md) §6 |
| Reserve stock | [`02-Inventory.md`](./02-Inventory.md) §2 |
| Redeem voucher | [`06-Fulfilment.md`](./06-Fulfilment.md) §6 |
| Authorise payment | [`03-Payment.md`](./03-Payment.md) §2 |
| Advance status, ship, deliver | [`01-Ordering.md`](./01-Ordering.md) §10, [`06-Fulfilment.md`](./06-Fulfilment.md) §2–§4 |
| Submit review | [`07-Supporting.md`](./07-Supporting.md) §2 |

**Why this picture has cycles and the module graph does not.** Ordering publishes to Payment and Payment publishes back to Ordering; Ordering depends on Inventory while Inventory feeds Catalog, which Cart reads. Every one of those loops closes through a `--)` arrow, and [`Module Dependency Diagram.md`](../Module%20Dependency%20Diagram.md) §5 rules that a Kafka-transported event creates no compile-time coupling: each consumer declares its own local record type rather than importing the publisher's. Remove that rule and `ApplicationModules.verify()` fails on the platform's most business-critical path. This diagram is the runtime picture; the module graph is the compile-time one, and conflating them is what makes module graphs look cyclic when they are not.

---

## 2. The Request Pipeline

Drawn once here, in full. Every other diagram in this folder collapses it to a note, because repeating six messages forty-seven times would push the actual content a third of the way down each diagram.

| | |
|---|---|
| **Use cases** | `UC-AUD-03` · `UC-AUD-04` · `UC-AUD-01` |
| **Business rules** | `BR-AUD-01` · `BR-AUD-02` |
| **Quality** | `NFR-SEC-01` · `NFR-SEC-06` · `NFR-OBS-01` · `NFR-OBS-03` · `NFR-PERF-01` |
| **Decisions** | [ADR-0015](../../01-system/ADR/ADR-0015-redis-cache-and-rate-limiting.md) · [ADR-0016](../../01-system/ADR/ADR-0016-jwt-refresh-rotation-rbac.md) · [ADR-0025](../../01-system/ADR/ADR-0025-httponly-cookie-session.md) · [ADR-0031](../../01-system/ADR/ADR-0031-contract-first-openapi.md) |
| **Problems** | `P5` · `P16` · `P17` |

```mermaid
sequenceDiagram
  autonumber
  actor Caller as Any authenticated actor
  participant Next as Next.js server
  participant NGINX as nginx
  participant RateLimit as RateLimitFilter
  participant Jwt as JwtAuthenticationFilter
  participant Ctl as «X»Controller
  participant AppSvc as «UseCase»Service
  participant Authz as AuthorizationService
  participant Audit as AuditListener
  participant Redis

  Caller->>Next: action (session cookie plus CSRF token)
  Next->>Next: resolve the cookie to an access token, held server-side
  Note over Next: ADR-0025 — no token is ever present in client<br/>JavaScript. The Next.js server attaches it, which is<br/>what makes it part of the trusted computing base.
  Next->>NGINX: HTTPS request<br/>Authorization: Bearer «access»<br/>X-Correlation-Id issued at the edge

  NGINX->>NGINX: TLS termination (NFR-SEC-06), coarse rate-limit backstop
  NGINX->>RateLimit: forward to /api/v1/...
  RateLimit->>Redis: INCR plus EXPIRE on the caller's bucket
  Redis-->>RateLimit: current count
  alt within quota
    RateLimit->>Jwt: continue
  else quota exceeded
    RateLimit-->>NGINX: 429 ECP-SEC-4290 plus Retry-After
    Note over RateLimit: UC-AUD-04 — precedes every externally<br/>originated request (ADR-0015).
  end

  Jwt->>Jwt: verify signature and expiry, with no datastore lookup
  Note over Jwt: ADR-0016 — the access token is stateless precisely so<br/>authorisation costs nothing on a path budgeted at 300 ms.<br/>The price is that a revoked role stays effective until expiry.
  Jwt->>Ctl: authenticated principal (subject, roles)

  Ctl->>Ctl: validate the body against the OpenAPI contract
  Ctl->>AppSvc: command or query, plus correlationId
  AppSvc->>Authz: authorise(actor, operation, ownership)
  Note over Authz: UC-AUD-03 — the single authorisation decision point,<br/>called from EVERY module's application layer. That is what<br/>makes BR-AUD-02 ("the same decision regardless of entry<br/>point") hold by construction rather than by review, and it<br/>is what every module-to-identity edge in the module graph is.
  Authz-->>AppSvc: permitted or denied

  alt permitted
    AppSvc->>AppSvc: execute the use case
    AppSvc-)Audit: record an entry where the operation is auditable
    Note over Audit: UC-AUD-01 — appended for any change to a price, stock<br/>level, order state, refund, promotion, review visibility,<br/>account status, or role. Audit exposes no mutation API at<br/>all, so BR-AUD-01 holds by construction (ADR-0017).
    AppSvc-->>Ctl: result
    Ctl-->>NGINX: 2xx plus X-Correlation-Id
  else denied
    Authz-)Audit: security event (actor, operation, outcome)
    AppSvc-->>Ctl: AccessDenied
    Ctl-->>NGINX: 403 ECP-SEC-4030
    Note over Ctl: NFR-SEC-01 — the decision is server-side. A client may<br/>hide a control it cannot use, but hiding is courtesy,<br/>never enforcement. See 04-Identity.md §8.
  end

  NGINX-->>Next: response
  Next-->>Caller: rendered result
```

**Why the order of the four gates is fixed.** Rate limiting precedes authentication because an unauthenticated flood must be cheap to reject — putting JWT verification first would make the flood pay for signature checks. Authentication precedes contract validation because there is no reason to parse a body for a caller with no valid token. Contract validation precedes authorisation because `UC-AUD-03` decides on an *operation*, and a malformed request has not yet named one. And authorisation sits in the **application** layer rather than the controller, because `BR-AUD-02` requires the same decision for a request that arrives from the Scheduler or an event consumer, neither of which passes through a controller at all.

**Correlation.** `NFR-OBS-03` is satisfied by one identifier issued at the edge and threaded through the application service, the domain event, the outbox row, the Kafka envelope, and every downstream consumer's logs. It also appears in every error response ([Integration Contract §4.1](../../04-shared/Integration%20Contract.md)). One identifier survives every hop, which is the whole of the requirement.

---

## 3. The Event Backbone

The mechanism behind every `--)` arrow in this folder. It is drawn once for the same reason as the request pipeline, and it carries the decision that makes `P6` unreachable.

| | |
|---|---|
| **Use cases** | `UC-NTF-01` · `UC-AUD-01` · `UC-RPT-01` |
| **Business rules** | `BR-NTF-01` · `BR-AUD-01` |
| **Quality** | `NFR-REL-06` · `NFR-AVAIL-02` · `NFR-OBS-03` |
| **Decisions** | [ADR-0012](../../01-system/ADR/ADR-0012-transactional-outbox-and-kafka.md) · [ADR-0013](../../01-system/ADR/ADR-0013-mongodb-scoped-to-read-models.md) · [ADR-0014](../../01-system/ADR/ADR-0014-elasticsearch-search-read-model.md) · [ADR-0017](../../01-system/ADR/ADR-0017-append-only-audit-log.md) |
| **Problems** | `P2` · `P6` |

```mermaid
sequenceDiagram
  autonumber
  participant Pub as Publishing context
  participant PG as PostgreSQL
  participant Relay as Outbox relay
  participant Kafka
  participant Notify as Notification
  participant Audit
  participant Report as Reporting
  participant Targeted as Targeted consumer

  rect rgba(124,92,255,0.08)
    Note over Pub,PG: ONE PostgreSQL transaction
    Pub->>PG: UPDATE the aggregate (Order, Payment, Shipment, ...)
    Pub->>PG: INSERT the outbox row — same transaction
  end
  Note over Pub,PG: ADR-0012 — this is the whole decision. The business fact and<br/>the row that announces it commit together, or neither commits.<br/>There is no window in which the database says one thing and<br/>the topic says another.

  Note over Pub,Targeted: COMMIT

  loop relay poll — the interval is configuration, not architecture
    Relay->>PG: SELECT unpublished outbox rows, in order
    PG-->>Relay: rows
    Relay--)Kafka: publish to ecp.«context».«aggregate».v1<br/>partition key is aggregateId
    Kafka-->>Relay: ack
    Relay->>PG: mark published
  end
  Note over Relay,Kafka: Partitioning by aggregateId is not a tuning choice. Ordering<br/>holds only within a partition, so any other key lets a consumer<br/>observe OrderPaid before OrderCreated (ADR-0012 §5). One topic<br/>per aggregate TYPE, never per event type — that is what makes<br/>the ordering between them meaningful.

  Note over Pub,Targeted: AT-LEAST-ONCE DELIVERY — every consumer is idempotent, without exception
  Kafka--)Notify: envelope (eventId, eventType, correlationId, payload)
  Kafka--)Audit: same envelope
  Kafka--)Report: same envelope
  Kafka--)Targeted: same envelope

  Notify->>Notify: has this eventId been handled? if so, acknowledge and stop
  Audit->>Audit: append an immutable entry (BR-AUD-01)
  Report->>Report: project into MongoDB (ADR-0013)
  Targeted->>Targeted: deserialise into its OWN local record type
  Note over Targeted: Module Dependency Diagram §5 — a Kafka consumer declares<br/>its own record in «consumer».infrastructure rather than<br/>importing the publisher's type. That is what keeps the module<br/>graph acyclic and what makes future extraction a<br/>boundary-preserving change.

  alt the consumer succeeds
    Notify-->>Kafka: commit the offset
  else the consumer fails
    Notify->>Notify: retry with backoff, then dead-letter topic plus alert
    Note over Notify: NFR-AVAIL-02 — a failing consumer never blocks the<br/>publisher. A broken email provider must leave checkout alone.
  end
```

**What the envelope carries.** Every message above is the envelope in [Integration Contract §6.1](../../04-shared/Integration%20Contract.md): `eventId` (the idempotency key every consumer keys on), `eventType`, `eventVersion`, `occurredAt`, `aggregateType`/`aggregateId`, `correlationId`, `actor`, and a `payload` of **business fields only** — never a raw request body, a credential, a token, or a payment instrument (`NFR-SEC-07`). `occurredAt` is when the fact happened, not when it was published; outbox lag means the two differ, and a consumer that conflates them computes wrong durations.

**What this costs.** Removing the compile-time link between publisher and consumer is what keeps the module graph acyclic, and the price is paid in full here: **nothing in the compiler catches a consumer that misreads a field.** Contract tests against the published schema are the only mechanism that would, and [Integration Contract §8.4](../../04-shared/Integration%20Contract.md) records that no tool has been named for them yet. This is an open gap, not a solved problem.

**What it buys.** `P2` and `AC-03` work as intended: a future loyalty, CRM, or recommendation consumer subscribes to `OrderPaid` without checkout changing by a line, and without appearing anywhere in the compile-time module graph.

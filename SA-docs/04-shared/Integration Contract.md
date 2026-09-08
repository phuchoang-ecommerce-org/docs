# Integration Contract — Enterprise Commerce Platform (ECP)

**Document type:** Interface specification (normative)
**Status:** **Proposed** — every section states a decision made nowhere else in the repository
**Audience:** Backend Engineering, Frontend Engineering, Architecture Review, QA
**Related documents:** [ADR-0003](../01-system/ADR/ADR-0003-rest-api-style.md) · [ADR-0031](../01-system/ADR/ADR-0031-contract-first-openapi.md) · [OpenAPI](./OpenAPI/README.md) · [ADR-0012](../01-system/ADR/ADR-0012-transactional-outbox-and-kafka.md) · [ADR-0016](../01-system/ADR/ADR-0016-jwt-refresh-rotation-rbac.md) · [Domain Model](../02-backend/Domain%20Model.md) · [Module Dependency Diagram](../02-backend/Module%20Dependency%20Diagram.md) · [SRS](../../BA-docs/srs.md)

---

## 1. Purpose and Scope

Five documents point at `04-shared/` for a contract that did not exist: [`ADR-0003`](../01-system/ADR/ADR-0003-rest-api-style.md) for OpenAPI and versioning, [`ADR-0012`](../01-system/ADR/ADR-0012-transactional-outbox-and-kafka.md) for event contracts, [`ADR-0016`](../01-system/ADR/ADR-0016-jwt-refresh-rotation-rbac.md) for the permission matrix, [`ADR-0020`](../01-system/ADR/ADR-0020-typescript-strict-mode.md) for generated client types, and [`Domain Model.md`](../02-backend/Domain%20Model.md) §5.3 for the boundary between contract artefacts and domain code. This document is that contract.

**What is normative here.** Everything that crosses a boundary the platform does not control on both sides:

- the REST surface every client class uses — web storefront, admin console, and the future mobile client (SRS §8);
- the Kafka event envelope every consumer deserialises, including consumers that do not exist yet;
- the error vocabulary a client is expected to branch on;
- the role/operation grid that authorisation is verified against.

**What is not.** Internal, in-process interactions. A Spring Modulith event between two modules in the same deployable is governed by [`Module Dependency Diagram.md`](../02-backend/Module%20Dependency%20Diagram.md) §5, not by this document — it is a compile-time dependency, and the compiler is a better contract than prose.

### 1.1 Where the OpenAPI document lives

[`04-shared/OpenAPI/`](./OpenAPI/README.md) holds the OpenAPI 3.1 description of the REST surface — 121 paths, 155 operations, across all fourteen domains.

**It is hand-authored, and that is a deliberate reversal.** This section previously said the folder stayed empty until the controller layer existed, because [`ADR-0003`](../01-system/ADR/ADR-0003-rest-api-style.md) §4 required the document be *"generated rather than hand-written, so it cannot drift."* [`ADR-0031`](../01-system/ADR/ADR-0031-contract-first-openapi.md) supersedes that row. The concern about drift was right; the mechanism changed. **Drift is now prevented by verification rather than by generation**: once controllers exist, CI diffs the generated description against the published one and fails the build on divergence, so a mismatch forces a human to say which of the two is wrong. Until then the document is checked by review, by `redocly lint`, and by the coverage assertions in [`OpenAPI/README.md`](./OpenAPI/README.md) §8.

The reason for reversing is in [`ADR-0031`](../01-system/ADR/ADR-0031-contract-first-openapi.md) §1, and it is short: waiting for the controller layer meant there was no contract at all, which blocked [`ADR-0020`](../01-system/ADR/ADR-0020-typescript-strict-mode.md), left QA nothing to test against, and would have let the wire format be decided one controller at a time without review.

So the split is: **§2–§5 are the rules the OpenAPI document must comply with; the OpenAPI document is the enumeration of endpoints.** This document still never lists endpoints one by one — that separation is unchanged, and it is why the two files do not duplicate each other.

### 1.2 Status

Every section here is a first-time decision. Per [ADR/README](../01-system/ADR/README.md) §2 that makes the document `Proposed` as a whole. Two sections carry additional weight and are flagged where they appear: **§4 (error taxonomy)**, which closes a gap [`ADR-0003`](../01-system/ADR/ADR-0003-rest-api-style.md) §5 explicitly left open, and **§6 (event envelope)**, which closes one [`ADR-0012`](../01-system/ADR/ADR-0012-transactional-outbox-and-kafka.md) §5 deferred. Neither is quietly promoted; both want ratification, and either may justify an ADR of its own.

---

## 2. REST Conventions

One REST/JSON API serves every client class ([`ADR-0003`](../01-system/ADR/ADR-0003-rest-api-style.md)). All six roles enter through it, and authorisation is applied once at the API/application boundary.

| Aspect | Rule | Traces to |
|---|---|---|
| Versioning | URI path prefix: `/api/v1/...`. Visible in logs, cacheable, trivially routable. | ADR-0003 §4 (`Proposed`) |
| Resource naming | Plural nouns, kebab-case, hierarchical by ownership: `/api/v1/orders/{orderId}/lines`. Never a verb in a path. | — |
| Content type | `application/json` on request and response; `application/problem+json` on error (§4). UTF-8 always. | — |
| Money | Always an object — `{"amount": "129.99", "currency": "VND"}` — never a bare number. Amount is a **string** so no client's JSON parser can convert it to a float. | Domain Model §5.3, SRS **[A-10]** |
| Timestamps | RFC 3339, UTC, with offset: `2026-09-07T14:03:11Z`. | — |
| Identifiers | Opaque strings. A client never parses, orders, or infers meaning from an id. | Domain Model §5.3 |
| Input validation | Every externally supplied field is validated against type, range, and format **before any business processing**. Rejection is `400` with a field-level error list (§4.3). | `FR-AUD-08`, `NFR-SEC-04` |
| Read-model transparency | Which store answers a query — PostgreSQL, Elasticsearch, MongoDB, or Redis — never appears in the URI or the response. It is an infrastructure decision behind the contract. | ADR-0003 §4 |

### 2.1 Verbs and status codes

| Verb | Use | Success | Notable failures |
|---|---|---|---|
| `GET` | Retrieve. Never changes state. | `200`, `304` | `404`, `403` |
| `POST` | Create, or invoke an operation that is not idempotent by nature | `201` + `Location`, `202` for accepted-async | `400`, `409`, `422` |
| `PUT` | Replace a resource wholly. Idempotent. | `200`, `204` | `404`, `409`, `412` |
| `PATCH` | Partial update. | `200`, `204` | `400`, `404`, `409` |
| `DELETE` | Remove. Idempotent — deleting an absent resource returns `204`, not `404`. | `204` | `403`, `409` |

Three distinctions that are otherwise argued about on every code review:

- **`401` vs `403`.** `401` means *not authenticated* — no credential, or an expired one. `403` means *authenticated and not permitted*. A client must be able to distinguish these, because only the first is worth refreshing a token for.
- **`404` vs `403` for resources a caller does not own.** A customer requesting another customer's order gets `404`, not `403`. Returning `403` confirms the order exists, which leaks information across a tenancy boundary.
- **`409` vs `422`.** `409` is a conflict with current state that may succeed later (insufficient stock, promotion exhausted, order already cancelled). `422` is a request that is well-formed but semantically impossible and will never succeed as written. Clients retry the first class and never the second.

### 2.2 Idempotency

**`Idempotency-Key` is required on `POST /api/v1/orders` and on payment initiation.** It is not applied globally — [`ADR-0003`](../01-system/ADR/ADR-0003-rest-api-style.md) §4 scopes it to exactly the operations whose repetition is a business defect.

| Rule | Detail |
|---|---|
| Header | `Idempotency-Key: <client-generated opaque string, ≤ 128 chars>` |
| Missing on a required endpoint | `400`, code `ECP-ORD-4001` |
| Replay with the same key and same request body | The **original** response is returned verbatim, with the original status. No second order is created. |
| Replay with the same key and a *different* body | `409`, code `ECP-ORD-4090`. This is a client defect, and masking it would hide a real bug. |
| Retention | Keys are retained at least 24 hours; a key reused after expiry is treated as new. |
| Concurrency | Two simultaneous requests with the same key: exactly one is processed; the other blocks briefly and returns the same response. |

This is the mechanism `BR-ORD-03` ("repeated submission of the same confirmed checkout yields the same single order"), `FR-ORD-09`, and `NFR-REL-02` require. `NFR-REL-02` specifically requires it to hold **under concurrent submission**, which is why the last row is part of the contract and not an implementation detail.

The equivalent property on the inbound side — provider callbacks applied at most once per attempt (`BR-PAY-01`, `FR-PAY-05`) — is §6.4.

---

## 3. Pagination, Filtering, and Sorting

Every collection endpoint is paginated. There is no unpaginated list endpoint, because one added later is a breaking change to every client that assumed it returned everything.

### 3.1 Envelope

```json
{
  "items": [ ... ],
  "page": { "size": 20, "next": "eyJvIjoxMjM0fQ", "total": 4821 }
}
```

| Field | Rule |
|---|---|
| `page.size` | Default 20, maximum 100. A larger request is clamped, not rejected. |
| `page.next` | Opaque cursor. Absent when there are no further pages. A client never constructs or parses one. |
| `page.total` | **Optional.** Present only where counting is cheap. Absent on search results and on any Elasticsearch-backed collection — an exact deep count would breach `NFR-PERF-03`. Clients must render correctly without it. |

### 3.2 Cursor, not offset

Cursor pagination is the default. Offset (`?page=7`) is rejected for two reasons that both bite in production: it produces duplicated and skipped rows when the underlying set changes between requests — routine on an order list — and its cost grows with depth, which is precisely the `P10` problem indexing exists to avoid.

### 3.3 Filtering and sorting

| Aspect | Rule |
|---|---|
| Filtering | Explicit named parameters only: `?status=Shipped&placedAfter=2026-01-01`. No generic query language, no client-supplied predicates. This is CQRS working as intended — a read model is purpose-built, and an unknown parameter is `400`, never silently ignored. |
| Sorting | `?sort=placedAt:desc`. Only fields an endpoint documents as sortable, because each one must be backed by an index (`P10`). |
| Search | `?q=` on search endpoints only. Relevance-ordered by default; `sort` and `q` together are `422`. |

---

## 4. Error Taxonomy

**Status: `Proposed`.** [`ADR-0003`](../01-system/ADR/ADR-0003-rest-api-style.md) §5 states plainly: *"Error-code taxonomy is not decided here; `04-shared/Error Codes` is reserved for it."* This section is that decision, made for the first time.

### 4.1 Shape

RFC 9457 `application/problem+json`, one shape for every error the platform returns:

```json
{
  "type": "https://ecp.example/errors/ECP-INV-4091",
  "title": "Insufficient available stock",
  "status": 409,
  "code": "ECP-INV-4091",
  "detail": "SKU TS-BLU-M has 2 units available; 5 were requested.",
  "instance": "/api/v1/orders",
  "correlationId": "0f9c2b3a-4d61-4e2f-9c77-1a2b3c4d5e6f",
  "errors": []
}
```

| Field | Rule |
|---|---|
| `code` | **The contract.** A stable machine-readable string clients branch on. Never reworded, never reused, never removed within a major version. |
| `title` | Short human-readable summary. Not stable, not for branching, not for display to an end user. |
| `detail` | Context for a developer or a log. **Never** contains a credential, a token, a payment detail, or a raw request payload (`NFR-SEC-07`). |
| `correlationId` | Echoes the request's correlation id (§6.2), so a user-reported failure is findable in logs and traces (`NFR-OBS-03`). |
| `errors` | Field-level detail; empty except on validation failures (§4.3). |

**`title` and `detail` are not user-facing copy.** The client maps `code` to its own localised message. This matters for the deferred multi-language capability (SRS §8) — translation is a client concern, and building it into the API would make every new language a backend release.

### 4.2 Code scheme

`ECP-<DOMAIN>-<NNNN>` where `<DOMAIN>` is one of the SRS §2.2 domain codes — `CUS`, `CAT`, `SCH`, `INV`, `CRT`, `ORD`, `PAY`, `SHP`, `PRM`, `REV`, `NTF`, `ADM`, `RPT`, `AUD` — plus `GEN` for cross-cutting failures owned by no domain.

`<NNNN>` opens with the HTTP status it accompanies, then a two-digit sequence: `4091` is the first `409` in its domain, `4001` the first `400`. This is a readability convention, not a parsing rule — clients match the whole code, never a substring.

### 4.3 Validation errors

`400`, code `ECP-GEN-4000`, with `errors` populated. Every failing field is reported in one response — never the first failure only, which turns form completion into a round-trip per mistake:

```json
"errors": [
  { "field": "shippingAddress.postalCode", "code": "ECP-GEN-4002", "detail": "Required." },
  { "field": "lines[0].quantity",          "code": "ECP-GEN-4003", "detail": "Must be at least 1." }
]
```

### 4.4 Seed catalogue

Not exhaustive — the enumeration lives in `04-shared/Error Codes` as the API grows. These are the codes that carry business rules, and each one exists because a specific rule can be violated:

| Code | Status | Meaning | Enforces |
|---|---|---|---|
| `ECP-GEN-4000` | 400 | Request validation failed; see `errors` | `FR-AUD-08`, `NFR-SEC-04` |
| `ECP-GEN-4010` | 401 | No credential, or the access token has expired | `NFR-SEC-03` |
| `ECP-GEN-4011` | 401 | Refresh token invalid, expired, or already consumed — the session chain is invalidated | `BR-CUS-03`, `NFR-SEC-03` |
| `ECP-GEN-4030` | 403 | Authenticated, but the role does not permit this operation | `BR-AUD-02`, `NFR-SEC-01` |
| `ECP-GEN-4290` | 429 | Rate limit exceeded; `Retry-After` is set | `NFR-SEC-05` |
| `ECP-GEN-5030` | 503 | A dependency is unavailable; the operation is retryable and platform state is unchanged | `NFR-AVAIL-03` |
| `ECP-INV-4091` | 409 | Insufficient available stock for one or more lines | `BR-INV-01`, `FR-ORD-06` |
| `ECP-ORD-4001` | 400 | `Idempotency-Key` required and absent | `BR-ORD-03` |
| `ECP-ORD-4090` | 409 | `Idempotency-Key` reused with a different request body | `BR-ORD-03` |
| `ECP-ORD-4091` | 409 | Order state transition not permitted from the current state | `BR-ORD-01`, `FR-ORD-11` |
| `ECP-ORD-4220` | 422 | Cart is empty, or contains no purchasable line | `BR-ORD-01` |
| `ECP-PRM-4090` | 409 | Promotion usage limit reached by a concurrent redemption | `UC-PRM-02` E7 |
| `ECP-PRM-4220` | 422 | Voucher invalid, expired, or not applicable to this order | `BR-PRM-01`, `FR-ORD-05` |
| `ECP-PRM-4221` | 422 | Discount would exceed the discountable value of the order | `BR-PRM-02` |
| `ECP-PAY-4090` | 409 | A payment attempt is already in flight for this order | `BR-PAY-01` |
| `ECP-PAY-4220` | 422 | Refund would exceed the amount captured | `BR-PAY-02` |
| `ECP-REV-4030` | 403 | Reviewer is not a verified buyer of this product | `BR-REV-01`, `FR-REV-06` |
| `ECP-CRT-4090` | 409 | Requested quantity exceeds available stock for the variant | `BR-CRT-02` |

One code was added to this catalogue by [`04-shared/OpenAPI/`](./OpenAPI/README.md): **`ECP-GEN-4040`** (`404` — the resource does not exist, *or* exists and the caller does not own it; the two are deliberately indistinguishable, §2.1). It is needed because §4.5 rule 2 requires every `4xx` to carry a code and this table had none for `404`. It belongs here and in `04-shared/Error Codes`.

**`ECP-INV-4091` and `ECP-PRM-4090` are the two that matter most.** Both are the visible surface of a concurrency guarantee — `BR-INV-01`'s oversell prevention and the usage-cap enforcement `UC-PRM-02` E7 describes — and both are *expected* outcomes under peak load, not exceptional ones. A client that treats either as a generic failure will present a checkout error where it should present "someone else just took the last one."

### 4.5 Rules

1. A code, once published, is never reused for a different meaning and never removed within a major version. Deprecating one means it stops being *returned*, not stops being *documented*.
2. Every `4xx`/`5xx` response carries a `code`. There is no bare status-code error.
3. `5xx` never leaks an exception type, a stack frame, or a SQL fragment into `detail`.
4. A failure caused by an external provider is `503` with `ECP-GEN-5030`, never a passthrough of the provider's own error — the platform's contract does not change when a provider is swapped ([`ADR-0005`](../01-system/ADR/ADR-0005-clean-architecture-ports-and-adapters.md)).

---

## 5. Authentication and Authorisation at the Boundary

| Aspect | Rule | Traces to |
|---|---|---|
| Access token | Short-lived JWT. Every request is authorised against the acting user's roles. | `NFR-SEC-01`, `NFR-SEC-03` |
| Refresh token | Held server-side, rotated on every use. Reuse of a consumed token invalidates the entire session chain and returns `ECP-GEN-4011`. | `BR-CUS-03`, `NFR-SEC-03` |
| Browser transport | `httpOnly` + `Secure` + `SameSite=Lax` cookie (`Strict` for admin). No token is ever readable by client JavaScript or stored in `localStorage`. | [ADR-0025](../01-system/ADR/ADR-0025-httponly-cookie-session.md) |
| Non-browser clients | `Authorization: Bearer <jwt>`. The future mobile client is a new *caller*, not new rules. | `P5`, SRS §8 |
| CSRF | Mandatory for cookie-authenticated state-changing requests. | [ADR-0025](../01-system/ADR/ADR-0025-httponly-cookie-session.md) |
| Where the decision is made | One synchronous `AuthorizationService` call from the application layer of the handling module, before the command executes. Never in a domain object, never in a client. | `BR-AUD-02`, Domain Model §5.2 |
| Rate limiting | Per caller. Authentication endpoints carry a stricter limit and **fail closed**; other endpoints fail open. `429` + `Retry-After`. | `NFR-SEC-05`, [ADR-0015](../01-system/ADR/ADR-0015-redis-cache-and-rate-limiting.md) |

**The frontend enforces nothing.** Hiding an admin control is a UX decision; it is never an authorisation decision. Every endpoint behaves identically whether or not the client rendered a button for it — which is what makes `BR-AUD-02`'s "same decision whatever entry point" (`FR-AUD-06`, `AC-02`) testable rather than aspirational.

---

## 6. Event Envelope and Topic Naming

**Status: `Proposed`.** [`ADR-0012`](../01-system/ADR/ADR-0012-transactional-outbox-and-kafka.md) §5 defers topic naming, partition counts, retention, and serialisation format to `Backend Architecture.md`. The parts that are a *contract* — what a consumer can rely on — are decided here; the operational parameters remain deferred.

Everything in this section applies to **Kafka-transported events only**. In-process Modulith events are an internal mechanism, not a contract ([`Module Dependency Diagram.md`](../02-backend/Module%20Dependency%20Diagram.md) §5).

### 6.1 Envelope

```json
{
  "eventId": "018f3c2a-7b41-7c9e-9f10-2a4b6c8d0e12",
  "eventType": "OrderPaid",
  "eventVersion": 1,
  "occurredAt": "2026-09-07T14:03:11.482Z",
  "aggregateType": "Order",
  "aggregateId": "ORD-2026-000184213",
  "correlationId": "0f9c2b3a-4d61-4e2f-9c77-1a2b3c4d5e6f",
  "actor": { "userId": "USR-00042", "role": "Customer" },
  "payload": { }
}
```

| Field | Contract |
|---|---|
| `eventId` | Globally unique, stable across redelivery. **The idempotency key every consumer keys on** (§6.4). |
| `eventType` | The domain event's name, exactly as in [`Domain Model.md`](../02-backend/Domain%20Model.md) §9. |
| `eventVersion` | Integer, starts at 1, increments only on a breaking change (§8). |
| `occurredAt` | When the business fact happened — **not** when it was published. Outbox lag means these differ, and consumers that conflate them compute wrong durations. |
| `aggregateType` / `aggregateId` | The aggregate the fact is about. `aggregateId` is the partition key (§6.3). |
| `correlationId` | Propagated from the originating request through every downstream event, so one business transaction is followable across every module it touches (`NFR-OBS-03`). |
| `actor` | Who caused it. Feeds the audit trail's attribution requirement (`NFR-OBS-01`). Absent for Scheduler-triggered events. |
| `payload` | Event-specific business fields. **Business fields only** — never a raw request payload, a credential, a token, or a full payment instrument (`NFR-SEC-07`). |

### 6.2 Correlation

A correlation id is issued at the edge and threaded through: HTTP request → application service → domain event → outbox row → Kafka envelope → every downstream consumer's own logs and events. It also appears in every error response (§4.1). This is the whole of `NFR-OBS-03` — one identifier that survives every hop.

### 6.3 Topics and partitioning

| Aspect | Rule |
|---|---|
| Topic naming | `ecp.<context>.<aggregate>.v<major>` — e.g. `ecp.ordering.order.v1`, `ecp.payment.payment.v1`. Lowercase, dot-separated. |
| Granularity | One topic per aggregate type, not per event type. All `Order*` events share `ecp.ordering.order.v1`, which is what makes ordering between them meaningful. |
| Partition key | **`aggregateId`, always.** |
| Retention, partition count, replication | Deferred to `Backend Architecture.md`. |

**Partitioning by `aggregateId` is not a tuning choice.** [`ADR-0012`](../01-system/ADR/ADR-0012-transactional-outbox-and-kafka.md) §5 states the hazard directly: *"Event ordering holds only within a partition. Order lifecycle events must be partitioned by order id, or a consumer can observe `OrderPaid` before `OrderCreated`."* Any other key makes the order lifecycle unobservable in order.

### 6.4 Consumer obligations

Non-negotiable, and the reason they are in a contract rather than a guideline is that at-least-once delivery makes every one of them a correctness requirement:

1. **Idempotent, without exception.** Keyed on `eventId` or on a natural business key. [`ADR-0012`](../01-system/ADR/ADR-0012-transactional-outbox-and-kafka.md) §5 names the failure modes: duplicate emails, double-counted analytics, duplicate audit entries.
2. **Tolerate unknown fields.** A publisher may add fields at any time (§8). A consumer that fails on an unrecognised field converts every additive change into a breaking one.
3. **Tolerate reordering across aggregates.** Ordering is guaranteed within a partition and nowhere else.
4. **Never block the publisher.** Retry with backoff, then dead-letter and alert. `NFR-AVAIL-02` requires a failing non-essential capability to leave checkout alone.
5. **Bind only the fields you use.** This is what keeps a consumer decoupled from its publisher and extraction cheap ([`Module Dependency Diagram.md`](../02-backend/Module%20Dependency%20Diagram.md) §5).

The same idempotency requirement applies to inbound provider callbacks: a payment settlement notification is applied at most once per attempt however many times the provider delivers it (`BR-PAY-01`, `FR-PAY-05`), correlating to an order by a stable reference.

---

## 7. Event Catalogue

The contract surface, from [`Domain Model.md`](../02-backend/Domain%20Model.md) §9 and the transport rule in [`ADR-0012`](../01-system/ADR/ADR-0012-transactional-outbox-and-kafka.md) §4. Only **Kafka** rows are a contract; in-process rows are listed so the boundary is visible.

| Event | Publisher | Transport | Known consumers | Payload carries |
|---|---|---|---|---|
| `AccountRegistered`, `AccountVerified`, `AccountRoleChanged`, `AccountSuspended` | `identity` | In-process | Audit, Notification | Account id, role(s), status. **Never** a credential hash or token |
| `ProductCreated`, `ProductPublished`, `ProductPriceChanged`, `ProductDiscontinued`, `VariantAdded`, `CategoryChanged` | `catalog` | Kafka | Search index, Audit, Reporting | Product/variant/category id, SKU, `Money` price, status |
| `StockReserved`, `StockReservationCommitted`, `StockReservationReleased`, `StockReservationExpired`, `StockAdjusted` | `inventory` | In-process **and** Kafka | Ordering (in-process, Partnership); Catalog availability, Audit, Reporting (Kafka) | SKU, warehouse id, quantity, reservation id and status |
| `CartLineAdded`, `CartExpired`, `CartCheckedOut` | `cart` | In-process | Ordering (checkout snapshot, once) | Cart id, lines, variant ids and quantities. **Unpriced** — `BR-CRT-04` |
| `OrderCreated`, `OrderPaid`, `OrderProcessing`, `OrderPacked`, `OrderShipped`, `OrderDelivered`, `OrderCompleted`, `OrderCancelled`, `OrderPaymentFailed`, `OrderRefunded`, `OrderReturned` | `ordering` | **Kafka + Outbox** | Payment (`OrderCreated`), Shipping (`OrderPacked`), Review (`OrderDelivered`/`OrderCompleted`), Catalog, Notification, Audit, Reporting | Order id, customer id, lines with frozen `Money`, status, shipping address |
| `PaymentCaptured`, `PaymentFailed`, `PaymentRefunded` | `payment` | **Kafka + Outbox** | Ordering, Notification, Audit, Reporting | Payment id, order id, `Money` amount, method, provider reference, outcome. **Never** a card number, token, or provider credential |
| `ShipmentCreated`, `ShipmentDispatched`, `ShipmentDelivered` | `shipping` | **Kafka + Outbox** | Ordering, Notification, Reporting | Shipment id, order id, carrier, tracking reference, status |
| `PromotionActivated`, `PromotionRedeemed`, `PromotionExpired` | `promotion` | In-process (Partnership) **and** Kafka (Reporting) | Ordering (in-process); Audit, Reporting (Kafka) | Promotion id, order id, discount `Money`, usage count |
| `ReviewSubmitted`, `ReviewPublished`, `ReviewModerated` | `review` | Kafka | Catalog (rating display), Notification, Audit | Review id, product id, customer id, rating, moderation status. **Never** review body text to Reporting |

`notification`, `audit`, and `reporting` are universal consumers — they subscribe to every Kafka topic above rather than to a listed subset ([`Domain Model.md`](../02-backend/Domain%20Model.md) §5.2). Audit exposes no mutation API at all, so `BR-AUD-01`'s immutability is enforced by construction, not by a runtime check.

Two rows deserve a second look. `CartCheckedOut` carries **unpriced** lines — a `CartLine` never has a price (`BR-CRT-04`), and pricing happens once at placement (`BR-ORD-06`). And the `Payment*` events carry a provider *reference*, never an instrument: `NFR-SEC-07` is a constraint on payloads, not only on logs.

---

## 8. Schema Evolution

Applies identically to REST responses and event payloads. The rule is **additive by default**.

### 8.1 Non-breaking — ship freely, no version change

- Adding an optional request field, or a new response/payload field.
- Adding a new enum value **where the contract already documents that unknown values must be tolerated** — which it does, for every status enum.
- Adding a new endpoint, a new event type, or a new topic.
- Relaxing a validation constraint.

### 8.2 Breaking — requires a version increment

- Removing or renaming any field.
- Changing a field's type, or its nullability from optional to required.
- Changing the meaning of an existing value.
- Changing a partition key, or narrowing a topic's contents.
- Tightening validation on an existing field.

### 8.3 How a version changes

| Surface | Mechanism | Deprecation |
|---|---|---|
| REST | New URI prefix: `/api/v2/...`. Both serve concurrently. | `v1` is announced deprecated, carries a `Deprecation` header, and is removed no earlier than **two release cycles** after every known client has migrated. |
| Events | `eventVersion` increments; a **new topic** `...v2` is published. The publisher writes both for a transition window. | `v1` is retired only when every consumer group has confirmed migration — including consumers the publisher does not own. |

**A published event's schema is owned jointly by its publisher and its consumers** ([`ADR-0012`](../01-system/ADR/ADR-0012-transactional-outbox-and-kafka.md) §4). A publisher cannot unilaterally make a breaking change, and dual-publishing during transition is the cost of that.

### 8.4 The standing risk

[`Module Dependency Diagram.md`](../02-backend/Module%20Dependency%20Diagram.md) §5 deliberately removes the compile-time link between a Kafka publisher and its consumers — that is what keeps the module graph acyclic and future extraction cheap. The price is paid here: **nothing in the compiler catches a consumer that misreads a field.** Contract tests against the schema published in `04-shared/Event Contract` are the only mechanism that does, and [`ADR-0018`](../01-system/ADR/ADR-0018-architecture-governance-ci-gate.md)'s test stack does not yet name a tool for them. This is an open gap, not a solved problem.

---

## 9. Permission Matrix

Derived directly from SRS §2.3's role authority summary, which is **normative for `FR-AUD-05`**. A blank cell means no access. This grid is what `NFR-SEC-01` is verified against, per role per operation.

| Domain | Guest | Customer | Staff | Warehouse | Support | Admin |
|---|---|---|---|---|---|---|
| Catalog & Category | read | read | manage | read | read | manage |
| Search & Recommendation | use | use | use | — | use | use |
| Customer & Identity | register, log in | own record | — | — | read | manage |
| Cart & Wishlist | own guest cart | own | — | — | read | read |
| Checkout & Order | — | own | progress | progress | read, cancel, return | manage |
| Payment | — | own | — | settle COD | refund | manage |
| Inventory | — | availability only | read | manage | read | manage |
| Shipping | — | own tracking | read | manage | read | manage |
| Promotion | — | redeem | manage | — | read | manage |
| Review | read | own | moderate | — | moderate | manage |
| Notification | — | own | — | — | read | manage |
| Reporting & Analytics | — | — | commercial reports | inventory reports | — | all |
| Audit trail | — | — | — | — | read | read |
| Role management | — | — | — | — | — | manage |

**"own" is a runtime check, not a role check.** A Customer may read *their* order; the role grants the capability and ownership grants the instance. Both are evaluated server-side, and a caller requesting a resource they do not own receives `404` rather than `403` (§2.1).

**No role has `manage` on the audit trail.** Not an omission — `BR-AUD-01` and `NFR-OBS-02` require the trail be unamendable *through any interface, by any role*, and [`ADR-0017`](../01-system/ADR/ADR-0017-append-only-audit-log.md) enforces this by exposing no mutation API at any layer and granting the database role only `INSERT` and `SELECT`. The grid's blank cell is the visible half of a guarantee made structurally.

Every row becomes an authorisation rule at the API/application boundary, never a client-side assumption.

---

## 10. Governance and Change Process

| Contract | Owned by | Changed how |
|---|---|---|
| REST surface | The module owning the resource | Additive changes ship with the feature. A breaking change needs a `v2` and a migration plan (§8.3). |
| Error codes | The domain named in the code | New codes appended to §4.4 and `04-shared/Error Codes` in the same change that introduces them. A code is never redefined. |
| Event schemas | **Jointly**, publisher and every known consumer | Additive changes ship freely; breaking changes need agreement from every consumer group, including ones the publisher does not own. |
| Permission matrix | Identity & Access, tracking SRS §2.3 | Changes here follow the SRS, not the reverse. If the grid and SRS §2.3 disagree, **SRS §2.3 is right** and this document is stale. |
| Published OpenAPI | The module owning the resource, in [`04-shared/OpenAPI/`](./OpenAPI/README.md) | Hand-authored and normative ([ADR-0031](../01-system/ADR/ADR-0031-contract-first-openapi.md)). Once controllers exist, CI diffs the generated description against it and fails the build on divergence; a mismatch is resolved in the same change by fixing whichever of the two is wrong. |

Three standing rules:

1. **Machine-checkable artefacts win over prose — in one direction only.** Where the OpenAPI document's *enumeration* disagrees with reality, fix the code or the document; the CI gate ([ADR-0031](../01-system/ADR/ADR-0031-contract-first-openapi.md)) makes that a build failure rather than a discussion. But where the OpenAPI document's *rules* disagree with §2–§5 of this document, **this document is right**: it is the law, and the OpenAPI file is the enumeration written under it.
2. **A `Proposed` section is never quietly promoted.** §4 and §6 are first-time decisions. Promotion to `Accepted` is its own commit, per [ADR-0001](../01-system/ADR/ADR-0001-record-architecture-decisions.md).
3. **A contract change that reaches an external consumer is a release event**, not a refactor. This includes every Kafka topic, because a consumer may exist that no one on the publishing team knows about — which is the entire point of `P2`.

---

## 11. Next Step

`Backend Architecture.md` implements this contract: the controller layer that must match the OpenAPI document in [`04-shared/OpenAPI/`](./OpenAPI/README.md), the CI gate that verifies it does ([ADR-0031](../01-system/ADR/ADR-0031-contract-first-openapi.md)), the outbox relay and topic configuration, and the error-code registry. The physical boundary these contracts cross is drawn in [`01-system/Deployment Diagram.md`](../01-system/Deployment%20Diagram.md); the internal boundaries they do *not* govern are in [`02-backend/Module Dependency Diagram.md`](../02-backend/Module%20Dependency%20Diagram.md).

Two items here want ratification rather than implementation: the **error taxonomy** (§4) and the **event envelope** (§6). Both close gaps that [`ADR-0003`](../01-system/ADR/ADR-0003-rest-api-style.md) and [`ADR-0012`](../01-system/ADR/ADR-0012-transactional-outbox-and-kafka.md) named and left open, and either may deserve promotion into an ADR of its own.

# Integration Contract — Enterprise Commerce Platform (ECP)

**Document type:** Interface specification (normative)
**Status:** **Proposed** — every section states a decision made nowhere else in the repository
**Audience:** Backend Engineering, Frontend Engineering, Architecture Review, QA
**Related documents:** [ADR-0003](../01-system/ADR/ADR-0003-rest-api-style.md) · [ADR-0031](../01-system/ADR/ADR-0031-contract-first-openapi.md) · [OpenAPI](./OpenAPI/README.md) · [ADR-0012](../01-system/ADR/ADR-0012-transactional-outbox-and-kafka.md) · [ADR-0016](../01-system/ADR/ADR-0016-jwt-refresh-rotation-rbac.md) · [Domain Model](../02-backend/Domain%20Model.md) · [Module Dependency Diagram](../02-backend/Module%20Dependency%20Diagram.md) · [SRS](../../BA-docs/srs.md)

---

## 1. Purpose and Scope

This document defines contracts for boundaries the platform does not control on both sides:

- the REST surface every client class uses — web storefront, admin console, and the future mobile client (SRS §8);
- the Kafka event envelope every consumer deserialises, including consumers that do not exist yet;
- the error vocabulary a client is expected to branch on;
- the role/operation grid that authorisation is verified against.

It does not govern in-process module interactions. [`Module Dependency Diagram.md`](../02-backend/Module%20Dependency%20Diagram.md) §5 governs those compile-time dependencies. [`Deployment Diagram.md`](../01-system/Deployment%20Diagram.md) defines the physical boundaries.

### 1.1 Where the OpenAPI document lives

[`04-shared/OpenAPI/`](./OpenAPI/README.md) is the hand-authored OpenAPI 3.1 contract for 121 paths and 155 operations across fourteen domains. It supports generated client types under [`ADR-0020`](../01-system/ADR/ADR-0020-typescript-strict-mode.md). [`ADR-0031`](../01-system/ADR/ADR-0031-contract-first-openapi.md) supersedes ADR-0003's generated-first approach. Before controllers exist, review, `redocly lint`, and the checks in [`OpenAPI/README.md`](./OpenAPI/README.md) §8 verify it. After controllers exist, CI fails when the generated description differs.

Sections 2–5 define REST rules. OpenAPI enumerates endpoints.

### 1.2 Status

The document is `Proposed` under [ADR/README](../01-system/ADR/README.md) §2 because it contains first-time decisions. Sections 4 and 6 close gaps left by ADR-0003 and ADR-0012 and need explicit ratification.

---

## 2. REST Conventions

One REST/JSON API serves every client class ([`ADR-0003`](../01-system/ADR/ADR-0003-rest-api-style.md)). The API/application boundary authorises all six roles.

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

Status distinctions:

- `401`: not authenticated. `403`: authenticated but not permitted. Only `401` may trigger token refresh.
- An unowned resource returns `404`, not `403`, to hide its existence.
- `409`: current-state conflict that may succeed later. `422`: the request cannot succeed as written. Clients may retry `409`, never `422`.

### 2.2 Idempotency

**`Idempotency-Key` is required on `POST /api/v1/orders` and payment initiation.** [`ADR-0003`](../01-system/ADR/ADR-0003-rest-api-style.md) §4 limits it to operations where repetition is a business defect.

| Rule | Detail |
|---|---|
| Header | `Idempotency-Key: <client-generated opaque string, ≤ 128 chars>` |
| Missing on a required endpoint | `400`, code `ECP-ORD-4001` |
| Replay with the same key and same request body | The **original** response is returned verbatim, with the original status. No second order is created. |
| Replay with the same key and a *different* body | `409`, code `ECP-ORD-4090`. This is a client defect, and masking it would hide a real bug. |
| Retention | Keys are retained at least 24 hours; a key reused after expiry is treated as new. |
| Concurrency | Two simultaneous requests with the same key: exactly one is processed; the other blocks briefly and returns the same response. |

This implements `BR-ORD-03`, `FR-ORD-09`, and `NFR-REL-02`, including concurrent submission.

The equivalent property on the inbound side — provider callbacks applied at most once per attempt (`BR-PAY-01`, `FR-PAY-05`) — is §6.4.

---

## 3. Pagination, Filtering, and Sorting

Every collection endpoint is paginated. No unpaginated list endpoint is allowed.

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

Cursor pagination is the default; offset pagination is rejected. Each cursor is an opaque, versioned HMAC-signed keyset token. It contains sort values and a UUID tie-breaker and is bound to endpoint, resource scope, sort, and normalized filters. The server reads **`size + 1`** rows, returns at most `size`, and builds `page.next` from the last returned row. It never uses `OFFSET` or loads the full candidate set.

Clients pass `page.next` unchanged and discard it when a listing input changes. A malformed, tampered, or incompatible cursor returns `400`; it never starts a new first page. Rotation keeps one active signing key and one previous verification key.

### 3.3 Filtering and sorting

| Aspect | Rule |
|---|---|
| Filtering | Explicit named parameters only: `?status=Shipped&placedAfter=2026-01-01`. No generic query language, no client-supplied predicates. This is CQRS working as intended — a read model is purpose-built, and an unknown parameter is `400`, never silently ignored. |
| Sorting | `?sort=placedAt:desc`. Only fields an endpoint documents as sortable, because each one must be backed by an index (`P10`). |
| Search | `?q=` on search endpoints only. Relevance-ordered by default; `sort` and `q` together are `422`. |

---

## 4. Error Taxonomy

**Status: `Proposed`.** This section closes the error-taxonomy gap from [`ADR-0003`](../01-system/ADR/ADR-0003-rest-api-style.md) §5.

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

`title` and `detail` are not user-facing. The client maps `code` to localised copy; translation does not require a backend release.

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

### 4.4 The registry

The enumeration this section seeded now lives in [`Error Codes.md`](./Error%20Codes.md) §3 — every `ECP-<DOMAIN>-<NNNN>` in force, the HTTP status it carries, what it means, the rule it enforces, and the operations that return it. It is the copy `Backend Architecture.md` §6.3 names as the one CI diffs the domain enums against, so it is the only copy kept.

`ECP-INV-4091` and `ECP-PRM-4090` are expected concurrency outcomes under peak load, not client defects.

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

**The frontend enforces nothing.** Hiding a control is a UX choice. The API applies the same decision for every entry point (`BR-AUD-02`, `FR-AUD-06`, `AC-02`).

---

## 6. Event Envelope and Topic Naming

**Status: `Proposed`.** This section defines the consumer contract deferred by ADR-0012. [`Backend Architecture.md`](../02-backend/Backend%20Architecture.md) §4 defines operational parameters; [`ADR-0032`](../01-system/ADR/ADR-0032-json-event-serialisation-and-schema-contract.md) defines serialisation.

This section applies only to Kafka events. In-process Modulith events are internal ([`Module Dependency Diagram.md`](../02-backend/Module%20Dependency%20Diagram.md) §5).

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

The edge issues one correlation id. It flows through the HTTP request, application service, domain event, outbox row, Kafka envelope, consumer logs, downstream events, and error responses (§4.1). This satisfies `NFR-OBS-03`.

### 6.3 Topics and partitioning

| Aspect | Rule |
|---|---|
| Topic naming | `ecp.<context>.<aggregate>.v<major>` — e.g. `ecp.ordering.order.v1`, `ecp.payment.payment.v1`. Lowercase, dot-separated. |
| Granularity | One topic per aggregate type, not per event type. All `Order*` events share `ecp.ordering.order.v1`, which is what makes ordering between them meaningful. |
| Partition key | **`aggregateId`, always.** |
| Retention, partition count, replication | [`Backend Architecture.md`](../02-backend/Backend%20Architecture.md) §4.2–§4.3 — 30-day retention, `cleanup.policy=delete`, partitions per topic, `RF=1` on the single-broker topology. A **partition-count increase rehashes keys and breaks ordering for every aggregate in flight**, so it is a versioned change, not a tuning knob. |

`aggregateId` is mandatory because ordering exists only within a partition. Another key can expose `OrderPaid` before `OrderCreated` ([`ADR-0012`](../01-system/ADR/ADR-0012-transactional-outbox-and-kafka.md) §5).

### 6.4 Consumer obligations

At-least-once delivery requires every consumer to:

1. Be idempotent by `eventId` or a natural business key.
2. Tolerate unknown fields (§8).
3. **Tolerate reordering across aggregates.** Ordering is guaranteed within a partition and nowhere else.
4. Never block the publisher. Retry with backoff, then dead-letter and alert (`NFR-AVAIL-02`).
5. Bind only used fields ([`Module Dependency Diagram.md`](../02-backend/Module%20Dependency%20Diagram.md) §5).

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

`notification`, `audit`, and `reporting` subscribe to every Kafka topic ([`Domain Model.md`](../02-backend/Domain%20Model.md) §5.2). Audit exposes no mutation API (`BR-AUD-01`).

`CartCheckedOut` carries unpriced lines (`BR-CRT-04`); placement sets prices once (`BR-ORD-06`). `Payment*` events carry a provider reference, never a payment instrument (`NFR-SEC-07`).

---

## 8. Schema Evolution

REST responses and event payloads are **additive by default**.

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

Publisher and consumers jointly own a published event schema ([`ADR-0012`](../01-system/ADR/ADR-0012-transactional-outbox-and-kafka.md) §4). Breaking changes require agreement and dual-publishing during migration.

### 8.4 The standing risk

The compiler does not check Kafka consumers. JSON Schema 2020-12 files at `04-shared/Event Contract/<context>/<EventType>.v<N>.json` provide the contract ([`ADR-0032`](../01-system/ADR/ADR-0032-json-event-serialisation-and-schema-contract.md) §4). Each event needs two L3 tests:

- Publisher: validate a real outbox row against the schema.
- Consumer: verify that every bound field exists and is `required`.

[`Backend Architecture.md`](../02-backend/Backend%20Architecture.md) §9 rules B8 and B9 fail the build for a missing schema or test. Enforcement is CI-time, not broker publish-time; ADR-0032 §5 records this open cost.

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

`own` is a server-side runtime check. Role grants the capability; ownership grants the instance. An unowned resource returns `404`, not `403` (§2.1).

No role can manage the audit trail. `BR-AUD-01` and `NFR-OBS-02` require no mutation API; the database role has only `INSERT` and `SELECT` ([`ADR-0017`](../01-system/ADR/ADR-0017-append-only-audit-log.md)).

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

Standing rules:

1. When endpoint enumeration differs, fix code or OpenAPI; CI fails until they match. When OpenAPI rules differ from §§2–5, this document is normative.
2. Promotion from `Proposed` to `Accepted` requires its own commit ([ADR-0001](../01-system/ADR/ADR-0001-record-architecture-decisions.md)).
3. A contract change reaching an external consumer is a release event, including Kafka changes (`P2`).

---

## 11. Pending ratification

The error taxonomy (§4) and event envelope (§6) need ratification. They close gaps recorded by ADR-0003 and ADR-0012.

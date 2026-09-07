# ADR-0015 — Redis for Cache-Aside, Hot Data, Rate Limiting, and Flash-Sale Pre-Filtering

**Document type:** Architecture Decision Record
**Status:** Accepted
**Date:** 2026-09-06
**Deciders:** Solution Architecture
**Traces to:** `P9` · `P8` · `CON-05` · `NFR-PERF-01` · `NFR-SCAL-04` · `NFR-SCAL-06` · `NFR-SEC-05` · `NFR-AVAIL-01`
**Related documents:** [Solution Architecture](../Solution%20Architecture.md) · [ADR-0011](./ADR-0011-optimistic-locking-reservation-model.md)

---

## 1. Context and Problem Statement

`P9` observes that the platform's highest-traffic moments are also its highest-revenue moments. `NFR-SCAL-06` quantifies it: absorb **10× median throughput** for the duration of a promotional event (assumption **[A-04]**) while continuing to satisfy `BR-INV-01`. `NFR-SCAL-04` requires thousands of concurrent customers while `NFR-PERF-01` (300 ms p95 catalog reads) still holds. `CON-05` states the general rule — frequently accessed data is optimised for low latency.

[ADR-0002](./ADR-0002-modular-monolith-deployment-unit.md) makes this pressing. A single deployable cannot scale one hot module independently, so peak absorption has to come from tiers that *can* scale on their own axes. During a flash sale the overwhelming majority of requests are reads — viewing the product, checking stock — not writes. If each of those reads reaches PostgreSQL, the transactional store saturates and the small volume of genuinely critical writes suffers.

Separately, `NFR-SEC-05` requires per-caller rate limiting with a stricter limit on authentication endpoints. In a horizontally scaled deployment that requires shared counters, which no single instance's memory can provide.

## 2. Decision Drivers

- `NFR-PERF-01` — 300 ms p95 catalog reads (assumption **[A-03]**) under `NFR-SCAL-04` concurrency.
- `NFR-SCAL-06` — 10× peak absorption without breaching `BR-INV-01`.
- `NFR-SEC-05` — per-caller limits, stricter on auth; must work across instances.
- `NFR-AVAIL-01` — 99.9% on the purchase path; the cache must not become a new way to fail.
- `NFR-PERF-06` — inventory availability and payment state carry **no permitted lag**, which bounds what may be cached.

## 3. Considered Options

**Option 1 — Redis for cache-aside, session/cart hot data, rate-limit counters, and a scoped flash-sale pre-filter.** *(chosen)*

- **Pros:** Sub-millisecond reads absorb the volume PostgreSQL would otherwise serve. Shared across instances, so rate limits and sessions work under horizontal scaling. Atomic counters and TTLs handle rate limiting and cart expiry directly. Already in the stack against `P9`.
- **Cons:** A cache is a second representation of data and can go stale. Adds a component whose failure must degrade rather than break. Invalidation is genuinely hard and is where cache bugs live.

**Option 2 — In-process caching (Caffeine) only.**

- **Pros:** No network hop, no extra component, simplest possible deployment.
- **Cons:** Not shared, so each instance holds its own copy with its own staleness, and rate limits become per-instance — `NFR-SEC-05` is unenforceable. Cache is lost on restart, so a rolling deploy at peak produces a thundering herd against PostgreSQL at the worst moment.

**Option 3 — No application cache; rely on database tuning, indexes, and read replicas.**

- **Pros:** One less component; no staleness; no invalidation logic.
- **Cons:** `NFR-SCAL-06`'s 10× peak then lands entirely on PostgreSQL. Replicas add lag and cost and still serve the transactional shape. `P9`'s premise is that read volume should be absorbed *in front of* the transactional store, not routed around inside it.

**Option 4 — HTTP/CDN caching for catalog reads instead of a server-side cache.**

- **Pros:** Absorbs load before it reaches the platform at all; the cheapest possible read.
- **Cons:** Complementary rather than alternative — it cannot serve personalised or authenticated responses, cannot back rate limiting, and cannot hold cart or session state. Worth adopting for anonymous catalog responses, but it does not replace Redis. Not decided here.

## 4. Decision Outcome

**Chosen: Option 1.** Redis serves four clearly separated roles, and the separation is the decision.

| Role | Pattern | Staleness tolerance | Notes |
|---|---|---|---|
| **Catalog / category cache** | Cache-aside with TTL, invalidated on `ProductPriceChanged` / `ProductDiscontinued` / `CategoryChanged` | Seconds | The primary `NFR-PERF-01` and `NFR-SCAL-06` mechanism. |
| **Session and cart hot data** | Redis as the read-through hot copy; PostgreSQL remains the record | None for correctness | Cart contents are transactional ([ADR-0009](./ADR-0009-postgresql-source-of-truth.md)); Redis makes reads cheap, never authoritative. `BR-CRT-01`'s configurable expiry window maps to a TTL, but the authoritative expiry is the scheduled domain action. |
| **Rate limiting** | Atomic counters with sliding window, keyed per caller; stricter bucket on auth endpoints | n/a | `NFR-SEC-05`. Shared state is exactly why in-process caching cannot do this. |
| **Flash-sale pre-filter** | Counter per designated SKU, checked before the database | n/a — advisory in one direction only | `P8`, `NFR-SCAL-06`. **May reject early; may never authorise a sale.** Every accepted request still passes the versioned check in [ADR-0011](./ADR-0011-optimistic-locking-reservation-model.md). |

**Three rules bound the blast radius:**

1. **Redis is never a source of truth.** Every key is reconstructible from PostgreSQL or Kafka. Flushing Redis entirely must cost latency and nothing else.
2. **Nothing with a zero-lag requirement is served from cache.** `NFR-PERF-06` gives inventory availability and payment state no permitted lag, so authoritative availability, order state, and payment state are read from the command side. The displayed availability on a product page is advisory (`Domain Model.md` §5.2); the binding one is not cached.
3. **A Redis outage degrades, it does not fail.** A cache miss falls through to PostgreSQL. Rate limiting fails **closed** on the authentication endpoints — losing the limiter must not become a way to bypass `NFR-SEC-05` — and open elsewhere. This split must be tested, not assumed.

**Invalidation is event-driven, not time-guessed.** Catalog cache entries are invalidated by the same domain events that feed the search index ([ADR-0014](./ADR-0014-elasticsearch-search-read-model.md)), with TTL as a backstop rather than as the primary mechanism.

## 5. Consequences

### Positive

- `NFR-PERF-01` under `NFR-SCAL-04` concurrency becomes reachable, and `NFR-SCAL-06`'s 10× peak is absorbed by a tier that scales independently of the single deployable.
- `NFR-SEC-05` is satisfiable across instances, which in-process state cannot do.
- The flash-sale pre-filter keeps PostgreSQL contention proportional to *remaining stock* rather than to traffic, which directly reduces the retry-storm risk in [ADR-0011](./ADR-0011-optimistic-locking-reservation-model.md).

### Negative

- **Stale reads are now possible on the catalog path.** A price change is visible after invalidation propagates. `BR-ORD-06` protects the customer — the binding price is frozen at placement — but a customer can briefly see a stale price, and that is a support and trust question, not just a technical one.
- **A new failure mode on the purchase path.** Redis contributes to `NFR-AVAIL-01` when healthy and threatens it when misconfigured. The fail-closed-on-auth, fail-open-elsewhere split is the mitigation and is itself a thing that can be got wrong.
- **The flash-sale pre-filter is a second representation of stock.** Its one-directional advisory contract is what stops it becoming a source of truth, and that contract is enforced by review rather than by a type — the weakest enforcement in this record.
- **Cache invalidation bugs are subtle and hard to reproduce**, and an event-driven invalidation that silently stops working looks exactly like a working cache.

### Neutral / follow-on

- CDN/HTTP caching in front of anonymous catalog responses is complementary and undecided.
- Redis topology (standalone, sentinel, cluster), eviction policy, and memory sizing are for [`Backend Architecture.md`](../../02-backend/Backend%20Architecture.md).

## 6. Related Decisions

[ADR-0011](./ADR-0011-optimistic-locking-reservation-model.md) · [ADR-0009](./ADR-0009-postgresql-source-of-truth.md) · [ADR-0008](./ADR-0008-cqrs-command-query-separation.md) · [ADR-0016](./ADR-0016-jwt-refresh-rotation-rbac.md)

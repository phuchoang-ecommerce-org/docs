# ADR-0038 — Event-Driven Tag Revalidation for Statically Generated Catalog Routes

**Status:** Proposed
**Date:** 2026-09-09
**Traces to:** `P11` · `BR-ORD-06` · `NFR-PERF-01` · `NFR-SCAL-06` · `NFR-AVAIL-02`

---

## 1. Context and Problem Statement

[ADR-0019](./ADR-0019-nextjs-app-router-rendering-strategy.md) §4 makes home, category, and product-detail pages **statically generated with incremental revalidation**, because they are the highest-traffic, most cacheable, most conversion-critical routes and `NFR-SCAL-06`'s 10× peak has to land somewhere other than the origin. It then names the cost in §5, and the naming is precise:

> Static catalog pages need reliable invalidation. They are revalidated on catalog events, which means the frontend now consumes a backend concern, and a missed invalidation shows a stale price. `BR-ORD-06` protects the customer at placement, but the displayed price was still wrong.

"Revalidated on catalog events" is a direction, not a mechanism. Nothing states who observes the event, how the observation reaches `ecp-web`, what granularity is invalidated, or what happens when the mechanism silently stops. That last question is the important one: [ADR-0015](./ADR-0015-redis-cache-and-rate-limiting.md) §5 already identifies a dead invalidation consumer as *"subtle and hard to reproduce"* on the backend cache, and the same failure on a statically generated storefront is worse — it is public, it is a price, and nobody sees an error.

There is also a boundary question. [`Deployment Diagram.md`](../Deployment%20Diagram.md) §2 puts Kafka on `data-01`, and `ecp-web` reaches no data-tier component at all today. Making the frontend a Kafka consumer changes the topology, the trust boundary, and the operational surface.

## 2. Decision Drivers

- `BR-ORD-06` protects the customer at placement, so a stale displayed price is a trust problem rather than a financial one — which is exactly why it must not be tolerated as "eventually correct."
- `NFR-SCAL-06` — the static routes exist to absorb 10× peak. Any mechanism that makes them dynamic defeats their purpose.
- [`Backend Architecture.md`](../../02-backend/Backend%20Architecture.md) §5.7 already has a working pattern for this exact problem: catalog events invalidate Redis keys through a consumer, with TTL as a backstop and lag alarming as the only thing that would notice a failure.
- [ADR-0025](./ADR-0025-httponly-cookie-session.md) and [`Security.md`](../Security.md) §3 put `ecp-web` inside the trusted computing base; every new inbound endpoint on it is security-relevant.
- [`Deployment Diagram.md`](../Deployment%20Diagram.md) §2 scales `ecp-web` by replica count, so any cache mechanism has to survive `N > 1`.

## 3. Considered Options

**Option 1 — A Kafka consumer in `ecp-api` delivers a signed catalog event envelope to a revalidation endpoint on `ecp-web`.** *(chosen)*

- **Pros:** Reuses the pattern [`Backend Architecture.md`](../../02-backend/Backend%20Architecture.md) §5.7 already runs for the Redis cache, including its consumer-group conventions, its idempotency, and its lag alarm — so the frontend's invalidation is observable by the apparatus that already exists. Kafka stays inside the data tier and `ecp-web` gains no broker client, no consumer-group membership, and no partition assignment to operate. Tag granularity means one price change invalidates one product, not the catalog. The event supplies invalidation identifiers, never page content, and `ecp-web` alone derives tags from them.
- **Cons:** It is an HTTP call between two application components that otherwise only talk in one direction, and the direction reverses here. `ecp-web` gains an inbound endpoint that purges cache, which is a denial-of-service primitive if it is ever reachable or unauthenticated. And a single HTTP call reaches a single replica — see §5.

**Option 2 — `ecp-web` consumes Kafka directly.**

- **Pros:** No new endpoint on `ecp-web`, no shared secret, no reversed call direction. The frontend learns about changes from the same stream everything else does, with the same ordering and replay guarantees.
- **Cons:** Puts a Kafka client, a consumer group, and partition assignment into the Node process, and puts `ecp-web` on the data-tier network — a topology change [`Deployment Diagram.md`](../Deployment%20Diagram.md) §2 does not make and `Security.md` §3 would have to redraw. Every `ecp-web` replica becomes a consumer-group member, so scaling the frontend rebalances a Kafka group, and a rolling deploy triggers a rebalance storm. It also gives the frontend a second, deeper dependency on the event contract ([ADR-0032](./ADR-0032-json-event-serialisation-and-schema-contract.md)) that it would then have to version against.

**Option 3 — Time-based revalidation only.**

- **Pros:** Nothing to build, nothing to secure, nothing to operate. Works identically across replicas. Fails safe.
- **Cons:** Staleness is the interval, and the interval is a choice between wrong prices and lost caching. Sixty seconds makes the catalog nearly dynamic at 10× peak, which is what `NFR-SCAL-06` cannot afford; ten minutes means a price correction takes ten minutes to reach the storefront. Neither answers [ADR-0019](./ADR-0019-nextjs-app-router-rendering-strategy.md) §5's concern, which is about a *specific* stale price rather than an average one.

**Option 4 — The admin console revalidates directly when it writes.**

- **Pros:** Immediate; no consumer, no broker, no secret; the writer knows exactly what changed.
- **Cons:** Only catches changes made through the admin UI. A bulk product amendment, a promotion activating on schedule, or a discontinuation triggered by another module changes nothing on the storefront — and those are precisely the paths where a stale price is most likely. It also creates a second invalidation route alongside any event-driven one, and two mechanisms for one concern is how they disagree.

## 4. Decision Outcome

**Chosen: Option 1**, with Option 3 retained underneath it as a backstop rather than as the mechanism.

| Commitment | Detail |
|---|---|
| Observer | A consumer group in `ecp-api`, `ecp.web-revalidation`, over `ecp.catalog.product.v1` and `ecp.catalog.category.v1` ([`Backend Architecture.md`](../../02-backend/Backend%20Architecture.md) §4.2's topic catalogue) |
| Transport | A signed `POST` to `ecp-web`'s internal revalidation route handler, on the internal network only |
| Payload | A signed catalog event envelope, **never caller-supplied tags or page content**. `ecp-web` derives tags from the event identifiers under the versioned [`Private Web Revalidation Callback v1`](../../04-shared/Event%20Contract/web-revalidation.v1.md), so content cannot create a second freshness mechanism |
| Granularity | `product:{id}` · `variant-price:{sku}` · `category:{slug}` — deliberately parallel to the Redis key scheme of [`Backend Architecture.md`](../../02-backend/Backend%20Architecture.md) §5.7 |
| Backstop | Every statically generated route also carries a time-based `revalidate`. TTL is a backstop, not the mechanism ([ADR-0015](./ADR-0015-redis-cache-and-rate-limiting.md) §4) |
| Observability | The consumer joins the existing invalidation-lag alarm. A silently dead consumer is otherwise indistinguishable from a working one |
| Single path | The admin console never revalidates directly. It writes through `ecp-api` and the event does the rest |

The wiring and tag table are in [`Data Fetching.md`](../../03-frontend/Data%20Fetching.md) §7; the endpoint's versioned request, signature, and response contract are in [`Private Web Revalidation Callback v1`](../../04-shared/Event%20Contract/web-revalidation.v1.md).

## 5. Consequences

### Positive

- A price change reaches the storefront in seconds rather than in an interval, without making the `P11` routes dynamic — which is the whole reason [ADR-0019](./ADR-0019-nextjs-app-router-rendering-strategy.md) made them static.
- The mechanism is observable by apparatus that already exists, so the `ADR-0015` §5 failure mode has the same alarm on both sides of it.
- `ecp-web` gains no broker dependency, so [`Deployment Diagram.md`](../Deployment%20Diagram.md) §2's network model is unchanged and `Security.md` §3's trust boundaries do not move.
- Tag granularity keeps a single product change from evicting the catalog, which matters at peak.

### Negative

- **This does not work across replicas without a shared cache, and that is a precondition rather than a caveat.** Each `ecp-web` instance holds its own filesystem cache; one signed POST reaches one replica and the others keep serving stale pages. `N > 1` requires a shared cache handler — `redis-cache` is the obvious backing store ([ADR-0034](./ADR-0034-redis-two-instance-topology.md)) — and adopting one changes [`Deployment Diagram.md`](../Deployment%20Diagram.md) §2, because it makes `ecp-web` reach the data tier after all. **This is the same discovery as [`Frontend Architecture.md`](../../03-frontend/Frontend%20Architecture.md) §10 `F-02`**: `ecp-web` is stateful, and the topology currently assumes it is not.
- **A new inbound endpoint on a trusted-computing-base component.** It purges cache, so an unauthenticated or externally reachable version is a denial-of-service primitive. The signature and the network restriction are both required; either alone is insufficient.
- **The call direction reverses.** `ecp-api` now depends on `ecp-web` being reachable for a non-critical function, and a failed call must be retried by the consumer rather than dropped — otherwise a transient network fault produces a permanently stale page that only the TTL backstop rescues.
- **The frontend now consumes a backend concern**, exactly as [ADR-0019](./ADR-0019-nextjs-app-router-rendering-strategy.md) §5 warned. The tag vocabulary is a coupling between `ecp-api`'s catalog events and `ecp-web`'s cache keys, and it is not in [`04-shared/`](../../04-shared/Integration%20Contract.md).

### Neutral / follow-on

- The tag vocabulary and the callback's wire contract now live in `04-shared/Event Contract/`; [`Data Fetching.md`](../../03-frontend/Data%20Fetching.md) §7 remains the frontend-facing explanation of the same mapping.
- Whether the shared cache handler and the shared session store (`F-02`) are one decision or two is left to whichever is taken first. They have the same shape and the same backing store.

## 6. Related Decisions

[ADR-0019](./ADR-0019-nextjs-app-router-rendering-strategy.md) · [ADR-0023](./ADR-0023-server-first-data-fetching.md) · [ADR-0015](./ADR-0015-redis-cache-and-rate-limiting.md) · [ADR-0012](./ADR-0012-transactional-outbox-and-kafka.md) · [ADR-0034](./ADR-0034-redis-two-instance-topology.md) · [ADR-0036](./ADR-0036-nextjs-server-sole-api-caller.md)

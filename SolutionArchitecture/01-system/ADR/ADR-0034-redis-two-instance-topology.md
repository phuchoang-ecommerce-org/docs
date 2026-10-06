# ADR-0034 — Two Redis Instances: an Evictable Cache and a Non-Evictable State Store

**Status:** **Proposed**
**Date:** 2026-09-09
**Traces to:** `P8` · `P9` · `CON-05` · `NFR-PERF-01` · `NFR-SCAL-04` · `NFR-SCAL-06` · `NFR-SEC-05` · `NFR-AVAIL-01`

---

## 1. Context and Problem Statement

[ADR-0015](./ADR-0015-redis-cache-and-rate-limiting.md) §4 gives Redis four roles and says that *"the separation is the decision"*. [`Database.md`](../../02-backend/Database.md) §7.3 then wrote those four roles down as eight key families in a single table, and §5 deferred the physical arrangement: *"Redis topology (standalone, sentinel, cluster), eviction policy, and memory sizing are for `Backend Architecture.md`."*

Reading those two documents together surfaces a problem that neither could see alone.

**Redis's `maxmemory-policy` is instance-wide.** There is no per-key, per-prefix, or per-database eviction exemption — logical databases (`SELECT 0..15`) share one `maxmemory` budget and one eviction policy, so they do not separate anything that matters here. And the eight key families of §7.3 are not one kind of thing:

| Key family | If it is evicted |
|---|---|
| `cat:product:*`, `cat:category:*`, `cat:variant:price:*` | A cache miss. Falls through to PostgreSQL, costs latency, and nothing else — exactly [ADR-0015](./ADR-0015-redis-cache-and-rate-limiting.md) §4's rule 1 |
| `cart:{cartId}` | A cache miss. `cart_cart` is the record ([ADR-0009](./ADR-0009-postgresql-source-of-truth.md)) |
| `rl:{callerId}:{bucket}`, `rl:auth:{callerId}` | **The counter resets to zero and the caller's budget is silently restored.** `NFR-SEC-05` is not enforced for that window |
| `flash:{sku}` | **The pre-filter's remaining allowance vanishes**, so the counter no longer rejects anything and the whole `P8` request volume reaches PostgreSQL's versioned check |
| `sess:{sessionId}` | The session's hot attributes are gone, forcing a re-authentication round trip against `identity_token` |

The bottom three rows are not caches. They are small, correctness-bearing state whose loss changes behaviour rather than latency.

And the timing is adversarial. Cache pressure is highest during a promotional event — `NFR-SCAL-06`'s 10× median throughput — which is the same moment `NFR-SEC-05`'s rate limiting matters most and the same moment `flash:{sku}` exists to protect [ADR-0011](./ADR-0011-optimistic-locking-reservation-model.md)'s versioned check from a retry storm. Under any eviction policy that can reach those keys, **Redis discards the platform's protection precisely when the platform is under attack from its own success.**

[ADR-0015](./ADR-0015-redis-cache-and-rate-limiting.md) §5 already flags the shape of this without naming the mechanism: *"Redis contributes to `NFR-AVAIL-01` when healthy and threatens it when misconfigured."* This is that misconfiguration, and on a single instance it is not a misconfiguration at all — it is the only available configuration.

## 2. Decision Drivers

- `NFR-SEC-05` — per-caller limits, stricter on auth, working across instances. [ADR-0015](./ADR-0015-redis-cache-and-rate-limiting.md) §4 requires the auth limiter to **fail closed**; a limiter that silently resets fails *open* without any component reporting an error.
- `NFR-SCAL-06` — 10× peak absorption. The cache must be able to evict freely under that pressure, which is what makes an evictable instance necessary rather than merely convenient.
- `P8` / [ADR-0011](./ADR-0011-optimistic-locking-reservation-model.md) — the flash-sale pre-filter keeps PostgreSQL contention proportional to remaining stock rather than to traffic. An evicted counter removes that property at peak.
- `NFR-PERF-01` — 300 ms p95 catalog reads. The cache needs enough memory to hold a working set, and it needs to be able to evict rather than refuse writes when it does not.
- `NFR-AVAIL-01` — the cache must not become a new way to fail.
- [ADR-0028](./ADR-0028-deployment-topology-containerisation.md) — one `data-01` VM, one failure domain. Any answer that adds a component must justify it against that.

## 3. Considered Options

**Option 1 — One instance, `maxmemory-policy allkeys-lru`.**

- **Pros:** One container, one connection factory, one thing to size and watch. The conventional cache configuration, and correct for a pure cache.
- **Cons:** Evicts `rl:*` and `flash:*` under memory pressure, and memory pressure coincides with peak by definition. The rate limiter fails open with no error anywhere, which is the specific outcome `NFR-SEC-05` exists to prevent and which [ADR-0015](./ADR-0015-redis-cache-and-rate-limiting.md) §4 hardened the auth bucket against. Rejected.

**Option 2 — One instance, `maxmemory-policy volatile-lru`.**

- **Pros:** Sounds like the answer: evict only keys with a TTL, protect the rest.
- **Cons:** It protects nothing here, because **every** key family in [`Database.md`](../../02-backend/Database.md) §7.3 carries a TTL — the rate-limit counters expire with their window, `flash:{sku}` expires with the sale, `sess:` slides. The candidate set is identical to Option 1's. Worse, it *looks* safe, so the failure would be discovered rather than anticipated. Rejected, and recorded because it is the intuitive wrong answer.

**Option 3 — One instance, `maxmemory-policy noeviction`.**

- **Pros:** Nothing is ever evicted; correctness state is safe.
- **Cons:** When `maxmemory` is reached, writes are refused. A cache that returns errors on write is worse than one that evicts: every cache-fill attempt fails, the miss rate climbs, PostgreSQL takes the full read volume, and `NFR-PERF-01` breaks — under exactly the peak that `NFR-SCAL-06` requires the platform to absorb. Sizing the instance so this never happens means sizing for the worst case of an unbounded catalog cache, which is not a size, it is a hope. Rejected.

**Option 4 — Two instances: `redis-cache` evictable, `redis-state` non-evictable.** *(chosen)*

- **Pros:** Each instance gets the policy its contents actually need, which no single instance can provide because the policy is instance-wide. The cache can be flushed entirely at any time — [ADR-0015](./ADR-0015-redis-cache-and-rate-limiting.md) §4's rule 1 becomes literally true of a whole instance rather than of individual keys. The state store is small and TTL-bounded by construction (a rate-limit counter lives for a window; a flash counter for a sale), so `noeviction` on it is a defensible sizing problem rather than an unbounded one. The two also get different persistence: the cache needs none, the state store benefits from an append-only file so a restart does not reset every rate-limit budget at once.
- **Cons:** A second container on `data-01`, a second connection factory, a second thing to size and alarm. The allocation of a key prefix to an instance is a code-level decision that nothing in Redis enforces — a developer can point the wrong template at the wrong prefix and everything will work until the day it evicts.

**Option 5 — Redis Sentinel or Redis Cluster.**

- **Pros:** The textbook answers for Redis topology, and the ones [ADR-0015](./ADR-0015-redis-cache-and-rate-limiting.md) §5 named as deferred.
- **Cons:** Both solve availability and horizontal capacity; neither solves the eviction-policy problem, because policy is still per-instance and a cluster would carry the same mixed key set into every shard. Sentinel needs at least three nodes to arbitrate a failover, and [`Deployment Diagram.md`](../Deployment%20Diagram.md) §8 has one VM — a Sentinel quorum inside a single failure domain arbitrates nothing that the loss of that VM does not end anyway. Rejected as answering a different question, and revisited in §5 if the data tier is ever replicated.

**Option 6 — Move the rate limiter and the flash counter out of Redis entirely — to PostgreSQL, or to in-process state.**

- **Pros:** Removes the mixed-contents problem at the root.
- **Cons:** [ADR-0015](./ADR-0015-redis-cache-and-rate-limiting.md) §3 already rejected in-process counters: *"rate limits become per-instance — `NFR-SEC-05` is unenforceable."* PostgreSQL counters put a write on the transactional store for every request, which inverts the entire purpose of `P9`. Rejected on the strength of a decision already made.

## 4. Decision Outcome

**Chosen: Option 4.** Two Redis instances, distinguished by what eviction would cost.

| | `redis-cache` | `redis-state` |
|---|---|---|
| Holds | `cat:product:*` · `cat:category:*` · `cat:variant:price:*` · `cart:{cartId}` | `rl:{callerId}:{bucket}` · `rl:auth:{callerId}` · `flash:{sku}` · `sess:{sessionId}` |
| `maxmemory-policy` | `allkeys-lru` | `noeviction` |
| Persistence | none — `save ""`, `appendonly no` | `appendonly yes` |
| On loss of the instance | Latency, until it refills | Rate-limit budgets reset once; flash counters must be re-seeded; sessions re-authenticate |
| May be flushed deliberately | **Yes**, at any time | No |
| Sized by | Catalog working set | Concurrent callers × window, plus active sessions — bounded and estimable |

The admission test is one question, and it is the question Options 1–3 could not act on: **if this key vanished, would the platform be slower, or would it behave differently?** Slower goes in `redis-cache`. Differently goes in `redis-state`. Concrete configuration, sizing arithmetic, the two connection factories, and the key-by-key allocation are [`Backend Architecture.md`](../../02-backend/Backend%20Architecture.md) §5.1–§5.5, extending [`Database.md`](../../02-backend/Database.md) §7.3 with an instance column.

**`cart:{cartId}` is in the cache, deliberately.** It is the one entry that invites the opposite reading, because a lost cart looks like a behaviour change to a customer. It is not: `cart_cart` is the record ([ADR-0009](./ADR-0009-postgresql-source-of-truth.md)), the key is a hot copy, and [`Database.md`](../../02-backend/Database.md) §7.3 already warns that *"a key evicted early must not expire a customer's cart"* — authoritative expiry is the scheduled domain action against `cart_cart.expires_at`. Eviction costs a database read.

**`sess:{sessionId}` is in the state store, also deliberately, and it is the closest call.** The authoritative session record is the rotating refresh token in `identity_token` ([ADR-0016](./ADR-0016-jwt-refresh-rotation-rbac.md)), so an evicted `sess:` hash is technically recoverable — but recovering it means a re-authentication round trip, and evicting these keys under cache pressure would do that to a large fraction of active users simultaneously, at peak. That is a behaviour change at exactly the wrong moment, so it goes with the state.

**`noeviction` on `redis-state` is a commitment to sizing it, not a way to avoid the question.** The instance must be alarmed at 80% of `maxmemory` ([`Backend Architecture.md`](../../02-backend/Backend%20Architecture.md) §7), because the failure mode past 100% is a refused `INCR` — and a refused `INCR` in the auth limiter must be treated as the limiter being unavailable, which [ADR-0015](./ADR-0015-redis-cache-and-rate-limiting.md) §4 requires to **fail closed**. Getting that path wrong turns a memory alarm into an authentication outage, so §5.10 of [`Backend Architecture.md`](../../02-backend/Backend%20Architecture.md) writes the whole degradation matrix down rather than leaving it to be inferred.

**Neither instance is replicated, and the eviction split does not pretend otherwise.** [`Deployment Diagram.md`](../Deployment%20Diagram.md) §8's *"one failure domain with no replica"* is unchanged by this record — losing `data-01` loses both instances along with everything else. This decision is about what happens under memory pressure, which is a far more likely event than losing the VM.

## 5. Consequences

### Positive

- `NFR-SEC-05` survives `NFR-SCAL-06`. The rate limiter cannot be evicted by catalog traffic, which under any single-instance policy it could — and would, at the worst possible moment.
- The flash-sale pre-filter keeps working through peak, so [ADR-0011](./ADR-0011-optimistic-locking-reservation-model.md) §5's retry-storm mitigation holds when it is needed rather than when it is idle.
- [ADR-0015](./ADR-0015-redis-cache-and-rate-limiting.md) §4's rule 1 — *"flushing Redis entirely must cost latency and nothing else"* — becomes literally true of `redis-cache`, so `FLUSHALL` on it is a supported operational action rather than an incident.
- The cache can be sized aggressively and evict freely, which is what a cache is for, without that freedom being paid for by something that is not a cache.
- Different persistence per instance falls out for free: no fsync cost on the hot cache path, and an append-only file on the small state store so a restart does not hand every caller a fresh rate-limit budget simultaneously.

### Negative

- **A second container and a second connection factory** on a VM already running five stateful services, and a second set of memory alarms. Real cost, accepted because the alternative is a correctness failure at peak.
- **The split is enforced by convention, not by a type.** Nothing stops a developer writing `rl:` through the cache template. [`Backend Architecture.md`](../../02-backend/Backend%20Architecture.md) §9 adds a CI rule mapping key prefix to declared factory, which makes it checkable — but this is the same class of enforcement [ADR-0011](./ADR-0011-optimistic-locking-reservation-model.md) §5 calls *"the weakest enforcement in this record"*, and it deserves the same scepticism.
- **`redis-state` can still fill.** `noeviction` converts a sizing failure into refused writes rather than silent eviction, which is the better failure — but it is still a failure, and it now has a path into the authentication flow via fail-closed. The alarm at 80% is load-bearing.
- **Two instances mean two ways to be misconfigured**, and a `maxmemory-policy` set wrongly on `redis-state` reproduces the exact problem this record exists to remove, invisibly. It belongs in the deployment configuration review, not only in the compose file.
- **Nothing here improves availability.** A reader could reasonably expect a record titled "topology" to address it; this one does not, and [`Deployment Diagram.md`](../Deployment%20Diagram.md) §8's single-failure-domain risk is untouched.

### Neutral / follow-on

- [`Database.md`](../../02-backend/Database.md) §7.3 gains an **Instance** column, and [`Deployment Diagram.md`](../Deployment%20Diagram.md) §2's `data-01` table gains a second Redis row with its own volume. Both are follow-on edits recorded in [`Backend Architecture.md`](../../02-backend/Backend%20Architecture.md) §12.
- Sentinel or Cluster remain the right answers to availability and horizontal capacity, and remain deferred with [`Deployment Diagram.md`](../Deployment%20Diagram.md) §8's other replication questions. Adopting either later does not disturb this split — each instance would be replicated separately, keeping its own policy.
- HTTP/CDN caching in front of anonymous catalog responses stays complementary and undecided, exactly as [ADR-0015](./ADR-0015-redis-cache-and-rate-limiting.md) §5 left it. It would reduce `redis-cache` pressure and would not change `redis-state` at all.
- The local development topology can collapse to one instance with `allkeys-lru`, provided the eviction-behaviour tests ([`Backend Architecture.md`](../../02-backend/Backend%20Architecture.md) §8) run against the two-instance arrangement. A single local instance that quietly hides the distinction is how the split gets broken.

## 6. Related Decisions

[ADR-0015](./ADR-0015-redis-cache-and-rate-limiting.md) · [ADR-0011](./ADR-0011-optimistic-locking-reservation-model.md) · [ADR-0016](./ADR-0016-jwt-refresh-rotation-rbac.md) · [ADR-0009](./ADR-0009-postgresql-source-of-truth.md) · [ADR-0028](./ADR-0028-deployment-topology-containerisation.md) · [ADR-0008](./ADR-0008-cqrs-command-query-separation.md)

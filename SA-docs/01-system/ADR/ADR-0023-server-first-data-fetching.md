# ADR-0023 — Server-First Data Fetching; TanStack Query Only for Client-Owned Interactive State

**Status:** Proposed
**Date:** 2026-09-06
**Traces to:** `P11` · `NFR-PERF-01` · `NFR-AVAIL-02` · `NFR-PERF-06` · `NFR-REL-02`

---

## 1. Context and Problem Statement

Nothing in the repository states how the frontend fetches data. [`Frontend Architecture.md`](../../03-frontend/Frontend%20Architecture.md) is a stub and `Data Fetching.md` is a planned-but-absent file in [`SA-docs/README.md`](../../README.md#folder-layout) §1.1.

Two backend decisions make this consequential rather than routine:

- **CQRS means read models are eventually consistent** ([ADR-0008](./ADR-0008-cqrs-command-query-separation.md)). Search lags catalog by seconds; reporting may lag by up to five minutes (`NFR-PERF-06`). But inventory availability and payment state carry **no permitted lag**. A single fetching strategy that treats all reads alike will either over-fetch authoritative data or cache something that must not be cached.
- **`NFR-AVAIL-02`** requires that search, recommendations, reviews, or reporting failing must not prevent browsing, checkout, or payment — which is a per-section requirement, not a per-page one.

[ADR-0019](./ADR-0019-nextjs-app-router-rendering-strategy.md) already chose Server Components as the default rendering model. What remains is which reads happen on the server, which happen in the browser, and what governs writes.

## 2. Decision Drivers

- `NFR-PERF-01` — the 300 ms p95 server budget must not be multiplied by a client-side request waterfall.
- `NFR-AVAIL-02` — degradation must be sectional.
- `NFR-PERF-06` — inventory availability and payment state have no permitted lag, so they must never be served from a client cache.
- `NFR-REL-02` / `BR-ORD-03` — a double-submitted checkout must not create a second order; the client's retry behaviour is part of that story.
- `P11` — perceived speed on discovery is a conversion issue.

## 3. Considered Options

**Option 1 — Server Components fetch by default; a client cache library only where the browser genuinely owns the state.** *(chosen)*

- **Pros:** Most reads happen on the server, close to the API, so there is no client waterfall and no data-fetching library in the bundle for the majority of pages. Each server-fetched section sits in its own `Suspense` boundary, which is `NFR-AVAIL-02` expressed directly. Where the browser really does own state — typeahead, infinite scroll, polling — a purpose-built cache is available without imposing it everywhere.
- **Cons:** Two fetching models coexist, and the boundary between them must be understood. Server-fetched data does not auto-refresh; a change made elsewhere requires an explicit revalidation.

**Option 2 — TanStack Query for everything, client-side.**

- **Pros:** One consistent model; excellent cache, retry, and background-refetch semantics; well-understood.
- **Cons:** Every page starts with an empty document and fetches after hydration — the waterfall [ADR-0019](./ADR-0019-nextjs-app-router-rendering-strategy.md) exists to avoid, and the worst case for `P11`. Ships a fetching library to every page whether it needs one or not. Aggressive background refetching against an eventually-consistent read model produces visible flicker as a projection catches up.

**Option 3 — Server Components only; no client fetching library at all.**

- **Pros:** Simplest; one model; smallest bundle.
- **Cons:** Genuinely client-owned interactions — search typeahead at `NFR-PERF-04`'s 150 ms budget, infinite scroll, polling an in-flight payment — become hand-rolled `useEffect` fetches with hand-rolled deduplication, cancellation, and retry. That is a cache library, written badly.

**Option 4 — Server Components plus SWR instead of TanStack Query.**

- **Pros:** Smaller and simpler for the read-only cases this record actually keeps on the client.
- **Cons:** Weaker mutation and invalidation story, which matters for the cart — the one place client-side writes are frequent. A close call; TanStack Query is chosen for mutation handling, and SWR would be a reasonable substitution if the bundle cost proved significant.

## 4. Decision Outcome

**Chosen: Option 1.** Server-first, with a client cache admitted only where the browser owns the state.

| Read | Where | Why |
|---|---|---|
| Catalog, category, product detail | Server Component, statically generated | Highest traffic; cacheable; `P11` |
| Search results and facets | Server Component, dynamic, own `Suspense` boundary | Eventually consistent; failure degrades the section (`NFR-AVAIL-02`) |
| Search **typeahead** | **Client**, TanStack Query, debounced | Keystroke-driven; `NFR-PERF-04`'s 150 ms budget needs request deduplication and cancellation |
| Cart contents | Server Component on load; client cache for in-page mutations | Authoritative on arrival; responsive during editing |
| Checkout, order state, payment state | **Server Component only, never cached client-side** | `NFR-PERF-06` permits no lag here |
| Order history, account | Server Component | Per-user, authoritative |
| Reviews, recommendations | Server Component in its own boundary | Non-essential; must degrade independently (`NFR-AVAIL-02`) |
| Admin dashboards | Server Component; client polling where a live view is wanted | Reporting lags up to 5 minutes (`NFR-PERF-06`) and **the staleness must be shown**, not hidden |

**Rules:**

- **Nothing with a zero-lag requirement is client-cached.** Order state, payment state, and authoritative stock are read fresh from the server. This mirrors [ADR-0015](./ADR-0015-redis-cache-and-rate-limiting.md)'s rule on the backend, for the same reason.
- **Writes are Server Actions or route handlers**, never direct browser calls to the backend API — this keeps the session cookie server-side ([ADR-0025](./ADR-0025-httponly-cookie-session.md)) and gives one place to attach the `Idempotency-Key` that `BR-ORD-03` and `NFR-REL-02` require ([ADR-0003](./ADR-0003-rest-api-style.md)).
- **Order placement is never retried automatically.** A network timeout on `POST /orders` has an unknown outcome; the client asks the user, or re-presents the same idempotency key. Blind retry on the purchase path is a defect.
- **Optimistic UI only where the operation cannot fail on business grounds.** Adding to a cart may be optimistic; placing an order may not — [ADR-0011](./ADR-0011-optimistic-locking-reservation-model.md) means a placement can be rejected after the customer has committed, and the UI must distinguish **"sold out"** from **"try again."** Showing success and retracting it is worse than a brief wait.
- **Staleness is surfaced, not concealed.** A dashboard reading a projection that may lag five minutes says so.

## 5. Consequences

### Positive

- No client-side waterfall on the pages that matter most for `P11` and `NFR-PERF-01`.
- `NFR-AVAIL-02` is satisfied per section, because each remote read has its own boundary.
- The zero-lag rule prevents the most damaging possible frontend cache bug: a customer acting on a stale order or payment state.
- A single write path makes idempotency and session handling one concern rather than a per-call habit.

### Negative

- **Two fetching models is real complexity**, and the boundary between them is a judgement each time. Getting it wrong pulls a page into the client bundle or leaves an interaction sluggish.
- **Server-fetched data does not refresh on its own.** A price change made in the admin console is not reflected in an open storefront tab until a navigation or an explicit revalidation. Acceptable for a storefront, and a genuine limitation for the admin console.
- **Rejecting optimistic UI at checkout costs perceived speed** at the highest-intent moment. Accepted deliberately: a retracted success on an order is materially worse than a spinner.
- **Not auto-retrying order placement pushes ambiguity onto the user.** The alternative — silent retry with an unknown outcome — risks the duplicate-order scenario `NFR-REL-02` forbids, and the idempotency key makes an explicit user-initiated retry safe.

### Neutral / follow-on

- SWR remains a viable substitution for the narrow client-cached set if bundle cost matters.
- Revalidation triggers for statically generated catalog pages are shared with [ADR-0019](./ADR-0019-nextjs-app-router-rendering-strategy.md).

## 6. Related Decisions

[ADR-0019](./ADR-0019-nextjs-app-router-rendering-strategy.md) · [ADR-0024](./ADR-0024-frontend-state-management.md) · [ADR-0025](./ADR-0025-httponly-cookie-session.md) · [ADR-0008](./ADR-0008-cqrs-command-query-separation.md) · [ADR-0011](./ADR-0011-optimistic-locking-reservation-model.md)

# ADR-0036 — The Next.js Server Is the Sole API Caller; Composition Happens in Server Components, Not in a BFF Tier

**Status:** Proposed
**Date:** 2026-09-09
**Traces to:** `P5` · `P11` · `NFR-SEC-01` · `NFR-PERF-01` · `NFR-AVAIL-02` · `CON-02`

---

## 1. Context and Problem Statement

[ADR-0019](./ADR-0019-nextjs-app-router-rendering-strategy.md) §5 left one item explicitly open: *"the admin BFF's shape."* [ADR-0023](./ADR-0023-server-first-data-fetching.md) §4 requires that writes go through Server Actions or route handlers rather than direct browser calls, and [ADR-0025](./ADR-0025-httponly-cookie-session.md) makes the Next.js server the only party that ever holds a token. Between them the *direction* is settled. What is not settled is the **shape of the layer that does the calling**, and there are three separable questions inside it:

1. **Is there a BFF as a network tier** — HTTP endpoints inside `ecp-web` that the browser calls and that aggregate several backend calls — or is composition a function call inside a Server Component?
2. **Does the admin console need something the storefront does not?** An admin dashboard reads revenue, order statistics, inventory, and customer figures on one screen; a product page reads one product. [`OpenAPI/`](../../04-shared/OpenAPI/README.md) exposes 155 operations, none of which is a dashboard.
3. **Is the calling code generated or written?** [ADR-0020](./ADR-0020-typescript-strict-mode.md) §5 defers generator choice, and most OpenAPI generators emit a client, not just types.

Getting this wrong is expensive in a specific way: a BFF tier, once the browser calls it, becomes an API with consumers, and it is an API nobody specified, nobody versioned, and nobody put in [`04-shared/`](../../04-shared/Integration%20Contract.md).

## 2. Decision Drivers

- `P5` / `NFR-SEC-01` — the frontend decides nothing. Any layer that starts merging authorisation-relevant results is a layer that can get authorisation wrong.
- [ADR-0025](./ADR-0025-httponly-cookie-session.md) — the credential lives in exactly one place, and every additional caller is another place to forget the CSRF token or the correlation header.
- `NFR-PERF-01` / `P11` — a browser → `ecp-web` → `ecp-api` round trip for a read that a Server Component could have made server-side is the waterfall [ADR-0019](./ADR-0019-nextjs-app-router-rendering-strategy.md) exists to remove.
- `NFR-AVAIL-02` — degradation must be sectional. An aggregating endpoint that returns one object fails as one object.
- `CON-02` — explicit interfaces; a second, unspecified API surface is the opposite.
- [ADR-0031](./ADR-0031-contract-first-openapi.md) — the contract is normative and hand-authored, so there is exactly one API and it is already written down.

## 3. Considered Options

**Option 1 — One server-side fetch client; composition happens inside Server Components; route handlers exist only for what genuinely needs an HTTP endpoint.** *(chosen)*

- **Pros:** An admin dashboard that needs five reads issues five concurrent server-side calls inside one Server Component — no aggregation endpoint, no second contract, and each read sits in its own `Suspense` boundary so `NFR-AVAIL-02` holds per section rather than per response. The credential path stays single. Nothing new becomes callable from the browser, so no accidental public API appears. The fetch client is one reviewable file that knows the five local rules — session token, `X-Correlation-Id`, `Idempotency-Key`, problem-JSON, cursor pagination — that the contract requires ([`Integration Contract.md`](../../04-shared/Integration%20Contract.md) §2, §3).
- **Cons:** "Composition in a component" is a discipline, not a structure — nothing stops someone from writing an aggregating route handler later. Server-to-server calls fan out per render, so a poorly composed admin page can make more backend calls than a BFF endpoint would have. The client is hand-written, which means it is code this repository maintains.

**Option 2 — A real BFF tier: aggregating route handlers in `app/api/` that the browser calls.**

- **Pros:** The classic pattern, well understood. View-shaped endpoints give the admin console exactly the payload it wants in one request. Clean separation between rendering and data shaping, and a natural place to cache.
- **Cons:** It reintroduces the browser → server → server waterfall on every page, which is what [ADR-0019](./ADR-0019-nextjs-app-router-rendering-strategy.md) chose Server Components to avoid — the cost lands hardest on `P11`'s discovery pages. It creates a second HTTP API with no OpenAPI description, no version, and no permission matrix, against a repository whose whole `04-shared/` discipline exists to prevent exactly that. An aggregated response is one `Suspense` boundary and one failure, so `NFR-AVAIL-02`'s sectional degradation is lost precisely on the admin dashboard where a reporting outage is most likely. And CQRS already builds view-shaped reads on the backend ([ADR-0008](./ADR-0008-cqrs-command-query-separation.md)) — a second view-shaping layer duplicates the work in a place with less context.

**Option 3 — A generated API client used directly from pages.**

- **Pros:** No hand-written client to maintain; regenerated with the contract; types and calls stay in lockstep by construction.
- **Cons:** The generated client knows nothing about the session cookie, the correlation header, the idempotency key, the problem-JSON error shape, or the opaque cursor — every one of which is a decision in this repository. Teaching a generated artefact five local rules, through interceptors or a wrapper, is more work than writing the wrapper, and less reviewable. It also tends to encourage direct calls from client components, which [ADR-0023](./ADR-0023-server-first-data-fetching.md) restricts to four cases.

**Option 4 — The browser calls `ecp-api` directly.**

- **Cons:** Already rejected as Option 4 of [ADR-0025](./ADR-0025-httponly-cookie-session.md), and rejected again here for the additional reason that Server Components would then have to forward cookies by hand. Listed only so the option is visibly closed.

## 4. Decision Outcome

**Chosen: Option 1.** `ecp-web` is the sole API caller, through one client, and composition is a function call rather than a network hop.

| Commitment | Detail |
|---|---|
| One fetch client | `lib/api`, `server-only`. It attaches the access token, `X-Correlation-Id`, and `Idempotency-Key` where required; parses `application/problem+json`; and handles the opaque cursor. Nothing else calls `ecp-api` |
| Reads are function calls | `features/*/server/queries.ts`, awaited by Server Components. Concurrent reads on one screen are concurrent calls in one component, each inside its own boundary |
| Writes are Server Actions | `features/*/server/actions.ts`, composed with the CSRF and idempotency wrapper. Route handlers are used for writes only where a Server Action cannot be ([`Data Fetching.md`](../../03-frontend/Data%20Fetching.md) §6) |
| **There is no BFF tier** | The admin console composes in Server Components exactly as the storefront does. It is not a different architecture; it is a denser screen |
| Route handlers are a closed list | Session/sign-in callbacks, CSRF issuance, the revalidation webhook ([ADR-0038](./ADR-0038-event-driven-catalog-revalidation.md)), and `healthz`. Adding a fifth is an amendment to this record |
| Types generated, client written | `openapi-typescript` emits types only; the client is ours. Zod parses at the boundary ([ADR-0020](./ADR-0020-typescript-strict-mode.md): a generated type is not a runtime guarantee) |
| Nothing in `ecp-web` is a public API | No route handler, Server Action, or RSC endpoint is contract-stable. A future mobile client calls `ecp-api` ([`Integration Contract.md`](../../04-shared/Integration%20Contract.md) §5), never `ecp-web` |

**On the admin console specifically**, since that is what [ADR-0019](./ADR-0019-nextjs-app-router-rendering-strategy.md) §5 asked: it gets no aggregation layer. A dashboard needing revenue, order statistics, and inventory figures awaits three reporting queries concurrently in one Server Component, renders each in its own boundary, and shows each one's staleness — which [ADR-0023](./ADR-0023-server-first-data-fetching.md) §4 requires anyway, since reporting may lag five minutes (`NFR-PERF-06`) and the lag must be surfaced rather than hidden. Merging three figures with three different freshnesses into one payload makes that impossible to display honestly.

## 5. Consequences

### Positive

- No second API surface exists, so none can drift from [`04-shared/`](../../04-shared/Integration%20Contract.md), and `CON-02`'s explicit-interface requirement keeps one interface to be explicit about.
- `NFR-AVAIL-02` holds on the admin dashboard, which is the screen most likely to depend on a laggy or failing read model.
- The credential, the correlation header, and the idempotency key are attached in one file, so they cannot be forgotten per call site.
- No browser → `ecp-web` → `ecp-api` waterfall, so [ADR-0019](./ADR-0019-nextjs-app-router-rendering-strategy.md)'s benefit is not spent on the way to the data.

### Negative

- **"No BFF" is a discipline, not a structure.** Nothing in the tooling prevents an aggregating route handler from appearing; the closed list above is enforced by review. The first genuinely awkward screen will make the case for one.
- **Fan-out is now the frontend's problem.** A Server Component awaiting eight reads makes eight backend calls per render. A BFF would at least have made that visible in one place; here it is visible only in the component, and `NFR-PERF-01`'s budget is consumed once per call.
- **The fetch client is code this repository owns**, including its retry, timeout, and cancellation behaviour. That is a small amount of infrastructure to maintain and to test.
- **Client-side navigation still re-fetches on the server.** Composition-in-component means a filter change is a server round trip ([ADR-0024](./ADR-0024-frontend-state-management.md) §5 accepts this for URL state), which is correct for shareability and slower than a local cache update.

### Neutral / follow-on

- If fan-out becomes a measured problem, the answer is a purpose-built read model on the backend ([ADR-0008](./ADR-0008-cqrs-command-query-separation.md)) — a new operation in the contract — rather than an aggregation layer in `ecp-web`. That keeps view-shaping where the data is.
- The client's timeout and retry policy is specified in [`Data Fetching.md`](../../03-frontend/Data%20Fetching.md) §4, including the rule that order placement is never retried automatically.

## 6. Related Decisions

[ADR-0019](./ADR-0019-nextjs-app-router-rendering-strategy.md) · [ADR-0023](./ADR-0023-server-first-data-fetching.md) · [ADR-0025](./ADR-0025-httponly-cookie-session.md) · [ADR-0031](./ADR-0031-contract-first-openapi.md) · [ADR-0035](./ADR-0035-feature-sliced-frontend-structure.md) · [ADR-0008](./ADR-0008-cqrs-command-query-separation.md)

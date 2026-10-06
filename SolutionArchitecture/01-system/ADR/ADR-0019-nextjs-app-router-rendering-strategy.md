# ADR-0019 — Next.js App Router with React Server Components, and a Rendering Strategy per Route Class

**Status:** Accepted (Next.js) · **Proposed** (App Router, RSC, route classification)
**Date:** 2026-09-06
**Traces to:** `P11` · `P5` · `NFR-PERF-01` · `NFR-AVAIL-02` · `NFR-SEC-01`

---

## 1. Context and Problem Statement

When this record was written, the entire frontend architecture in the repository was one line of [`Technology Stack.md`](../Technology%20Stack.md) — at the time, *"NextJS, KumaUI, RadixUI, shadcn/ui, Framer Motion"* — and a one-line stub at [`Frontend Architecture.md`](../../03-frontend/Frontend%20Architecture.md). Next.js was named; nothing else about how it is used was decided anywhere.

That gap matters more than it looks. `P11` makes product discovery a revenue problem: customers who cannot quickly find what they want leave without buying. `NFR-PERF-01` budgets catalog reads at 300 ms p95 server-side (assumption **[A-03]**), and a slow client can spend that budget several times over before anything is painted. A storefront is also the platform's public surface, so rendering strategy is a search-visibility decision as much as a performance one.

Two questions are open:

1. **App Router or Pages Router?** They imply different data-fetching models, different component boundaries, and different auth handling.
2. **What rendering strategy does each kind of page use?** A product listing, a cart, an order-confirmation page, and an admin dashboard have nothing in common in freshness, personalisation, or cacheability. One global answer will be wrong for most of them.

## 2. Decision Drivers

- `P11` — discovery speed is a conversion problem, and first contentful paint on catalog pages is part of it.
- `NFR-PERF-01` — the 300 ms p95 server budget leaves little room for client-side waterfalls.
- `NFR-AVAIL-02` — search or reviews failing must not prevent browsing or checkout; the UI must degrade per-section rather than per-page.
- `P5` / `NFR-SEC-01` — no rule is enforced client-side. The frontend renders and requests; it never decides authorisation.
- [ADR-0008](./ADR-0008-cqrs-command-query-separation.md) makes read models eventually consistent, so the UI must distinguish authoritative reads from advisory ones.
- Catalog pages must be crawlable; cart and account pages must not be cached.

## 3. Considered Options

**Option 1 — Next.js App Router with React Server Components, rendering strategy chosen per route class.** *(chosen)*

- **Pros:** Server Components fetch on the server, next to the API, which removes the client-side request waterfall that most reliably breaks a perceived-latency budget. Streaming with `Suspense` lets a page render its shell and stream slower sections — the natural expression of `NFR-AVAIL-02`, since a failing reviews section degrades to a boundary instead of taking the page down. Static generation for catalog pages gives near-zero-latency first paint and clean crawlability for `P11`. Layout nesting matches the storefront/admin split. Route handlers give a server-side place to hold the session cookie ([ADR-0025](./ADR-0025-httponly-cookie-session.md)).
- **Cons:** The Server/Client Component split is a genuine new mental model, and the boundary is easy to get wrong. Server Components constrain which libraries can be used where — a real constraint on Framer Motion and on Radix, both of which are client-side. Caching semantics have moved between Next.js versions and need pinning.

**Option 2 — Next.js Pages Router with `getServerSideProps` / `getStaticProps`.**

- **Pros:** Mature, stable, widely documented; one clear data-fetching function per page; no Server/Client split to reason about.
- **Cons:** Data fetching is page-level, so a component deep in the tree cannot fetch its own data without a client request — reintroducing the waterfall. No streaming, so the slowest section gates the whole page and `NFR-AVAIL-02` becomes an all-or-nothing per page. Receiving reduced investment upstream.

**Option 3 — Client-side SPA (Vite + React Router), Next.js dropped.**

- **Pros:** Simplest mental model; clean separation from the backend; no server runtime to operate.
- **Cons:** Contradicts the one frontend decision the repository actually records. Every page begins with an empty document and a data waterfall, which is the worst case for `P11` and for `NFR-PERF-01`'s perceived budget. Catalog crawlability requires prerendering, which means adding back what Next.js provides.

**Option 4 — Next.js App Router, but everything dynamically server-rendered.**

- **Pros:** One strategy, no classification to maintain, always fresh.
- **Cons:** Discards static generation for catalog pages — the highest-traffic, most cacheable, most conversion-critical routes — and puts their entire load on the origin at exactly the moment `NFR-SCAL-06`'s 10× peak arrives. Wastes the benefit that motivates the framework.

## 4. Decision Outcome

**Chosen: Option 1.** Next.js **App Router** with React Server Components as the default, and rendering strategy assigned per route class.

| Route class | Strategy | Reason |
|---|---|---|
| Home, category, product detail | **Static with incremental revalidation**, invalidated on catalog events | Highest traffic, cacheable, crawlable. Directly serves `P11` and takes load off the origin at peak. |
| Search results and facets | **Dynamic server render**, streamed | Query-dependent; reads Elasticsearch ([ADR-0014](./ADR-0014-elasticsearch-search-read-model.md)); wrapped in its own `Suspense` boundary so a search outage degrades the section, not the page (`NFR-AVAIL-02`). |
| Cart, checkout, account, order history | **Dynamic server render, never cached** | Per-user and authoritative. These read the command side ([ADR-0008](./ADR-0008-cqrs-command-query-separation.md)) — a cart or order state must never come from a cached or projected view. |
| Admin console | **Dynamic server render**, client-interactive within | Low traffic, high interactivity, always fresh. |

**Rules that follow:**

- **Server Components by default.** `"use client"` is added where interactivity, browser APIs, Radix primitives, or Framer Motion require it — and it is pushed as far down the tree as possible, so an interactive leaf does not make its whole page a client bundle.
- **Every remotely-loaded section owns a `Suspense` boundary and an error boundary.** This is the concrete mechanism for `NFR-AVAIL-02` and for the empty-state guidance in [`UI Design System.md`](../../03-frontend/UI%20Design%20System.md) §13.
- **Advisory data is labelled as such in the UI.** Search results and catalog availability are eventually consistent and explicitly non-authoritative (`Domain Model.md` §5.2); stock shown on a listing is an indication, and the binding answer comes at checkout ([ADR-0011](./ADR-0011-optimistic-locking-reservation-model.md)).
- **The frontend enforces nothing.** Hiding an admin control for a Customer is a UX courtesy; the authorisation decision is the backend's, at the application boundary ([ADR-0016](./ADR-0016-jwt-refresh-rotation-rbac.md)). `P5` and `NFR-SEC-01` are not shared responsibilities.
- **Performance budgets** are set per route class against `NFR-PERF-01`'s spirit, and the static catalog routes carry the tightest ones. `Technology Stack.md`'s "Benchmark performance" line applies to the frontend too.

## 5. Consequences

### Positive

- Catalog pages — the `P11` surface — are static and crawlable, with first paint independent of origin load.
- Server-side fetching removes the client waterfall, so the `NFR-PERF-01` server budget is not multiplied on the client.
- `NFR-AVAIL-02` becomes a component-level property: a failing search or reviews section degrades inside its boundary.
- Route handlers give the session cookie a server-side home ([ADR-0025](./ADR-0025-httponly-cookie-session.md)).

### Negative

- **The Server/Client boundary is the main source of frontend defects in this model.** A misplaced `"use client"` silently pulls a subtree into the browser bundle and undoes the benefit; there is no error, only a slower page.
- **Static catalog pages need reliable invalidation.** They are revalidated on catalog events, which means the frontend now consumes a backend concern, and a missed invalidation shows a stale price. The mechanism is decided in [ADR-0038](./ADR-0038-event-driven-catalog-revalidation.md), which also finds that it does not work across `ecp-web` replicas without a shared cache. `BR-ORD-06` protects the customer at placement, but the displayed price was still wrong.
- **Radix and Framer Motion are client-side**, so every interactive component is a client component. The design system's component layer ([ADR-0021](./ADR-0021-tailwind-shadcn-radix-styling-system.md)) will be largely client-side even where its content is not.
- **App Router caching semantics have changed across versions.** The Next.js major version must be pinned and upgrades treated as behavioural changes, not patches.

### Neutral / follow-on

- Route grouping, layout composition, and the admin BFF's shape are for [`Frontend Architecture.md`](../../03-frontend/Frontend%20Architecture.md). **Now answered:** route groups and layout composition in [`Routing.md`](../../03-frontend/Routing.md) §2, and the admin BFF's shape by [ADR-0036](./ADR-0036-nextjs-server-sole-api-caller.md) — there is no BFF tier, and the admin console composes in Server Components exactly as the storefront does. The per-route-class budgets §4 requires are set in [`Performance.md`](../../03-frontend/Performance.md) §2 and gated by [ADR-0039](./ADR-0039-frontend-performance-budgets-ci-gate.md).
- Deployment target for the Next.js server is undecided, as is the backend's (SRS §1.2).

## 6. Related Decisions

[ADR-0020](./ADR-0020-typescript-strict-mode.md) · [ADR-0021](./ADR-0021-tailwind-shadcn-radix-styling-system.md) · [ADR-0023](./ADR-0023-server-first-data-fetching.md) · [ADR-0025](./ADR-0025-httponly-cookie-session.md) · [ADR-0003](./ADR-0003-rest-api-style.md)

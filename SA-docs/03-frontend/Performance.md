# Performance — Enterprise Commerce Platform (ECP)

**Document type:** Frontend architecture specification (normative)
**Status:** **Proposed** — sets the per-route-class budgets [`ADR-0019`](../01-system/ADR/ADR-0019-nextjs-app-router-rendering-strategy.md) §4 requires and [`Testing and Benchmark Strategy.md`](../01-system/Testing%20and%20Benchmark%20Strategy.md) §11 records as unset
**Audience:** Frontend Engineering, Architecture Review, QA
**Related documents:** [Frontend Architecture](./Frontend%20Architecture.md) · [Routing](./Routing.md) · [Data Fetching](./Data%20Fetching.md) · [ADR-0019](../01-system/ADR/ADR-0019-nextjs-app-router-rendering-strategy.md) · [ADR-0039](../01-system/ADR/ADR-0039-frontend-performance-budgets-ci-gate.md) · [Testing and Benchmark Strategy](../01-system/Testing%20and%20Benchmark%20Strategy.md) · [UI Design System](./UI%20Design%20System.md)

---

## 1. These Are Not `NFR-PERF-01`

This distinction is stated first because getting it wrong makes every number below meaningless.

`NFR-PERF-01` budgets catalog and category reads at **300 ms p95, measured server-side, excluding external provider time** (assumption **[A-03]**). It is a property of `ecp-api`, it is verified by the smoke benchmark of [`Testing and Benchmark Strategy.md`](../01-system/Testing%20and%20Benchmark%20Strategy.md) §7, and nothing in this document changes it.

The budgets here are **client-side, measured in a browser, and they include everything** — network, `ecp-web`'s render, `ecp-api`'s response, hydration, and paint. [`ADR-0019`](../01-system/ADR/ADR-0019-nextjs-app-router-rendering-strategy.md) §1 explains why both exist: *"a slow client can spend that budget several times over before anything is painted."* A page can satisfy `NFR-PERF-01` comfortably and still fail every budget in §2.

Two apparatuses, two questions:

| | `NFR-PERF-01` | This document |
|---|---|---|
| Measures | `ecp-api` server latency | What a customer experiences |
| Where | Server-side, excluding provider time | Browser |
| Verified by | Smoke benchmark ([`Testing and Benchmark Strategy.md`](../01-system/Testing%20and%20Benchmark%20Strategy.md) §7) | Lighthouse CI + bundle gate + RUM (§8) |
| Gate | Benchmark trigger | Build-failing ([`ADR-0039`](../01-system/ADR/ADR-0039-frontend-performance-budgets-ci-gate.md)) |

---

## 2. The Budget Classes

Four classes, matching the rendering classes of [`Routing.md`](./Routing.md) §3. Thresholds are p75 on a mid-tier mobile device over a throttled 4G connection — the profile Core Web Vitals uses, and the one a customer on a phone actually has.

| | **P1** static catalog | **P2** dynamic streamed | **P3** transactional | **P4** admin |
|---|---|---|---|---|
| Routes | `/`, `/c/…`, `/p/…` | `/search` | Cart, checkout, account, auth | `/admin/…` |
| **LCP** | **≤ 1.8 s** | ≤ 2.5 s | ≤ 2.5 s | ≤ 3.0 s |
| **INP** | ≤ 200 ms | ≤ 200 ms | **≤ 150 ms** | ≤ 200 ms |
| **CLS** | ≤ 0.05 | ≤ 0.1 | **≤ 0.05** | ≤ 0.1 |
| **TTFB** | ≤ 200 ms | ≤ 600 ms | ≤ 600 ms | ≤ 800 ms |
| **Client JS**, gzipped | **≤ 130 KB** | ≤ 160 KB | ≤ 180 KB | ≤ 250 KB |

Each threshold has a reason, and the reasons are not interchangeable:

- **`P1` carries the tightest budget** because [`ADR-0019`](../01-system/ADR/ADR-0019-nextjs-app-router-rendering-strategy.md) §4 requires it — these are the highest-traffic, most conversion-critical routes, they are `P11`'s surface, and being statically generated they have no excuse. A `P1` route that cannot meet 1.8 s LCP is not slow; it is misconfigured.
- **`P1`'s TTFB is 200 ms** because a cache hit should not involve `ecp-api` at all. A `P1` TTFB regression is usually a route that has quietly become dynamic (§7).
- **`P3` has the strictest CLS and INP** even though it is not the fastest class. A layout shift on a checkout page moves a button under a finger that is already descending, and a sluggish response at the moment of purchase is the most expensive latency in the application. `NFR-AVAIL-01` budgets the purchase path at 99.9%; being available and unusable does not satisfy it.
- **`P4` is loosest on LCP and largest on JS** and still capped. An admin table with virtualisation and charts genuinely needs more code than a product page. It does not need it on first load (§3).

**A route that cannot meet its class's budget does not get a waiver; it gets reclassified, and the reclassification is visible.** [`ADR-0039`](../01-system/ADR/ADR-0039-frontend-performance-budgets-ci-gate.md) §4 makes that the sanctioned escape, because a per-route exception list is how budgets stop meaning anything.

---

## 3. Bundle Discipline

The client bundle is the budget most easily lost by accident, because nothing fails when it grows.

| Rule | Detail |
|---|---|
| Server by default | [`Frontend Architecture.md`](./Frontend%20Architecture.md) §3.3. A misplaced `"use client"` produces no error and no warning — only a bigger bundle, which §8's gate is what notices |
| Client boundaries take `children` | An interactive shell receives server-rendered content as props rather than importing it. This is the single technique that stops a client boundary from spreading through a subtree |
| Heavy admin UI is dynamically imported | Data grids, chart libraries, and rich editors load on the route that uses them via `next/dynamic`, never from a shared layout |
| Framer Motion is loaded lazily | `LazyMotion` with only the features actually used. [`ADR-0026`](../01-system/ADR/ADR-0026-motion-and-accessibility-baseline.md) constrains motion to fade, opacity, colour, and small elevation changes, so the full feature set is not needed — and [`UI Design System.md`](./UI%20Design%20System.md) §8's *"almost invisible"* motion should not cost more than the thing it animates |
| Icons are imported individually | Lucide is tree-shakeable; a barrel import defeats it ([`ADR-0022`](../01-system/ADR/ADR-0022-ma-design-tokens.md)) |
| No date, money, or utility library on the storefront | Money is formatted from a string ([`Frontend Architecture.md`](./Frontend%20Architecture.md) §6.2) and dates through `Intl`, both built in |
| No second data-fetching library | TanStack Query is scoped to the four cases of [`Data Fetching.md`](./Data%20Fetching.md) §5 and is lint-enforced, so it does not reach the `P1` routes at all |

**A dependency added to a shared layout is added to every route in that group**, which is where budget regressions come from in practice — not from the feature that needed it.

---

## 4. Images

Product imagery is the largest payload on the `P1` routes and is almost always the LCP element.

| Rule | Why |
|---|---|
| `next/image` everywhere; no bare `<img>` | Sizing, format negotiation, and lazy loading come with it |
| AVIF with WebP fallback | Materially smaller than JPEG at the same perceived quality |
| Explicit `width`/`height` or `fill` with a sized container | **This is the CLS budget.** An unsized image is the most common cause of a layout shift |
| `priority` on the LCP element only | On a product page that is the primary image; on a category page it is the first row. Prioritising everything prioritises nothing |
| `sizes` set from the actual layout | Without it the browser downloads a desktop-width image for a phone |
| Below-the-fold images lazy-load | The default, and it stays the default |

`blob:` is permitted in `img-src` ([`Frontend Architecture.md`](./Frontend%20Architecture.md) §5.1) for client-side preview on review image upload, and for nothing else.

---

## 5. Fonts

[`ADR-0022`](../01-system/ADR/ADR-0022-ma-design-tokens.md) chose **Inter**, restricted to weights 400, 500, and 600, and noted that its variable build carries all three in one file. [`UI Design System.md`](./UI%20Design%20System.md) §4 makes typography the primary visual element, which means a font swap is not a cosmetic event — it is the page rearranging itself.

| Rule | Why |
|---|---|
| Self-hosted via `next/font/local` | **Required, not preferred.** `font-src 'self'` ([`Frontend Architecture.md`](./Frontend%20Architecture.md) §5.1) permits no font host, and a third-party font host is a render-blocking dependency on someone else's availability |
| One variable file, subset to Latin | Three weights in one request. The subset is revisited if internationalisation arrives (`F-04`) |
| `display: swap` with a metric-matched fallback | Text is readable immediately, and the swap does not shift the layout — an unmatched fallback turns `display: swap` into a CLS failure |
| Preloaded | It is used above the fold on every route |
| No second family | [`UI Design System.md`](./UI%20Design%20System.md) §4 forbids mixing; the budget agrees |

---

## 6. Streaming and Boundaries

`NFR-AVAIL-02` and the LCP budget are served by the same mechanism, which is worth noticing: a page that streams its shell first paints sooner *and* degrades sectionally.

- **The shell is static and streams immediately.** Header, navigation, and layout do not wait on data.
- **Each remotely-loaded section owns a `Suspense` boundary** ([`Routing.md`](./Routing.md) §8). The slowest section does not gate the page.
- **Skeletons are shaped like their content**, so the swap does not shift the layout. This is a CLS rule as much as a design one.
- **The LCP element is never inside a `Suspense` boundary that waits on a slow read.** On a product page the primary image and title come from `getProduct` and render in the first flush; reviews, recommendations, and availability stream after.

Getting the last rule wrong is the most common way a well-structured page misses its LCP budget: the page streams beautifully and the thing the customer came for arrives last.

---

## 7. The Nonce and Static Generation

[`Frontend Architecture.md`](./Frontend%20Architecture.md) §5.1 generates a CSP nonce per request. A per-request value in the HTML makes the HTML per-request — which is exactly what [`ADR-0019`](../01-system/ADR/ADR-0019-nextjs-app-router-rendering-strategy.md) §4 chose static generation to avoid on the `P1` routes.

**The resolution:** `R1` routes use a **hash-based** `script-src` for the framework's inline bootstrap and stay cacheable; `R2`–`R4` routes use the per-request nonce. Both satisfy the policy — neither uses `unsafe-inline` — and only the dynamic classes pay the per-request cost.

**This is a trade, not a solved problem**, and it has a maintenance cost that is honest to name: the hash set changes when the framework's inline bootstrap changes, so a Next.js upgrade can break the `P1` CSP. The check belongs in the same integration test that asserts the policy is served ([`Frontend Architecture.md`](./Frontend%20Architecture.md) §8), and [`ADR-0019`](../01-system/ADR/ADR-0019-nextjs-app-router-rendering-strategy.md) §5 already requires treating Next.js upgrades as behavioural changes rather than patches.

If the hash approach becomes unmaintainable, the fallback is a `P1` TTFB budget of 600 ms instead of 200 ms — the routes stay correct and lose their best property. That would be a visible regression against §2, which is the point of writing the budget down.

---

## 8. Measurement

Three instruments, because they answer different questions. [`ADR-0039`](../01-system/ADR/ADR-0039-frontend-performance-budgets-ci-gate.md) records why they gate the build rather than only reporting.

| Instrument | Measures | When | Gate |
|---|---|---|---|
| **Lighthouse CI** | LCP, CLS, TTFB against §2, on one representative route per class | Every pull request | **Build-failing** |
| **Bundle-size gate** | Client JS per route against §2 | Every pull request | **Build-failing** |
| **Web Vitals RUM** | LCP, INP, CLS from real sessions, segmented by route class | Continuously in production | Alarms; does not gate |

**INP is the reason RUM is not optional.** Interaction latency depends on what a customer actually does, and a synthetic run does not do it. Lighthouse can gate LCP and CLS honestly; INP is only meaningful in the field, so §2's INP thresholds are alarm thresholds rather than build gates.

The RUM beacon is subject to [`Security.md`](../01-system/Security.md) §8 and [`Frontend Architecture.md`](./Frontend%20Architecture.md) §2.2: it carries timings and a route class, **never a URL with customer data in it, never a session identifier, and never a token**. A search query in an RUM payload is a data-classification incident.

Per-route-class measurement is [`Testing and Benchmark Strategy.md`](../01-system/Testing%20and%20Benchmark%20Strategy.md) §7.9's second trigger, deliberately not part of the smoke run — the two apparatuses stay separate for the reason §1 gives.

---

## 9. What Is Not Budgeted

Named so their absence is visible rather than mistaken for an oversight.

- **Server-side render time inside `ecp-web`.** It is inside TTFB and is not separately budgeted, so a slow render and a slow `ecp-api` look the same from here. Distinguishing them needs `ecp-web` request timing, which `F-03` ([`Frontend Architecture.md`](./Frontend%20Architecture.md) §10) has not settled a destination for.
- **Backend fan-out per render.** [`ADR-0036`](../01-system/ADR/ADR-0036-nextjs-server-sole-api-caller.md) §5 names this as a negative consequence: a Server Component awaiting eight reads makes eight backend calls, and nothing here counts them. The `P1` TTFB budget catches the symptom, not the cause.
- **Behaviour at `NFR-SCAL-06`'s 10× peak.** These are single-session budgets. Whether they hold under peak is a load-test question and belongs to [`Testing and Benchmark Strategy.md`](../01-system/Testing%20and%20Benchmark%20Strategy.md) §7.
- **Total page weight.** Deliberately unbudgeted — LCP and the JS budget together constrain what matters, and a byte budget would penalise the product imagery `P11` depends on.

# ADR-0039 — Per-Route-Class Performance Budgets as a Build-Failing CI Gate

**Status:** Proposed
**Date:** 2026-09-09
**Traces to:** `P11` · `P15` · `NFR-PERF-01` · `NFR-AVAIL-01` · `NFR-MAINT-05`

---

## 1. Context and Problem Statement

[ADR-0019](./ADR-0019-nextjs-app-router-rendering-strategy.md) §4 closes with a requirement: *"Performance budgets are set per route class against `NFR-PERF-01`'s spirit, and the static catalog routes carry the tightest ones."* [`Testing and Benchmark Strategy.md`](../Testing%20and%20Benchmark%20Strategy.md) §11 then records the state of it honestly, as a gap: *"Frontend route budgets are set"* is listed among the things that have not happened, alongside the observation that `package.json` currently contains `eslint` and nothing else.

So the budgets do not exist. But the more consequential question is not what the numbers are — it is **what happens when a change misses one**, and that has never been asked.

The reason it matters here specifically is that frontend performance regresses by accretion. Nobody makes a page slow; a client boundary moves up one level, a chart library is imported in a shared layout, an image loses its `sizes` attribute. Each change is individually defensible and invisible in review, and the page is 40% heavier a year later with no commit to point at. `P15` describes exactly this class of decay — discipline that depends on memory rather than on a tool — and [ADR-0018](./ADR-0018-architecture-governance-ci-gate.md) is the backend's answer to it. The frontend has type checking and lint ([ADR-0020](./ADR-0020-typescript-strict-mode.md), [ADR-0035](./ADR-0035-feature-sliced-frontend-structure.md)), and neither of those can see a bundle grow.

## 2. Decision Drivers

- `P11` — discovery speed is a conversion problem, and the statically generated catalog routes are its surface.
- `P15` / `NFR-MAINT-05` — a rule a tool enforces survives; one that depends on memory does not.
- [ADR-0019](./ADR-0019-nextjs-app-router-rendering-strategy.md) §4 requires per-route-class budgets and does not say how they are held.
- [ADR-0019](./ADR-0019-nextjs-app-router-rendering-strategy.md) §5 — a misplaced `"use client"` produces *"no error, only a slower page."*
- `NFR-AVAIL-01` budgets the purchase path at 99.9%; a checkout that is available and unusable does not satisfy the intent.
- `NFR-PERF-01` is measured server-side and cannot see any of this ([`Performance.md`](../../03-frontend/Performance.md) §1).

## 3. Considered Options

**Option 1 — Budgets per route class, enforced as a build-failing CI gate, with RUM alarming alongside.** *(chosen)*

- **Pros:** A regression is attributed to the change that caused it, in the pull request that introduced it, which is the only moment it is cheap to fix. It is the frontend's counterpart to [ADR-0018](./ADR-0018-architecture-governance-ci-gate.md), closing the `P15` asymmetry on the half of the system the customer touches. Per-class budgets let the static catalog routes carry a genuinely tight number without holding the admin console to it, which is what [ADR-0019](./ADR-0019-nextjs-app-router-rendering-strategy.md) §4 actually asked for. The bundle-size half of the gate is deterministic, so it does not flake.
- **Cons:** Synthetic measurement is noisy, and a noisy gate that fails randomly gets disabled — which is worse than not having one. Some metrics, INP in particular, are not honestly measurable synthetically. A gate blocks work at inconvenient moments, and the pressure to add a waiver arrives with the first genuinely urgent fix.

**Option 2 — Measure in production with RUM, alarm on regression, do not gate.**

- **Pros:** Measures what customers actually experience, on real devices and real networks. Covers INP properly. Never blocks anyone, never flakes, no synthetic-environment fidelity problem.
- **Cons:** The regression is already shipped, and by the time an alarm fires the causing change is one of thirty in the release. Attribution is the whole difficulty with accreted regressions, and this option gives it up. It also provides nothing before first deploy, so a new route can launch over budget with no signal at all.

**Option 3 — One global budget for the whole application.**

- **Pros:** One number, trivially understood, nothing to classify or maintain.
- **Cons:** It has to accommodate the admin console's data grids and charts, which makes it loose enough that a product page could double in weight and pass. That inverts [ADR-0019](./ADR-0019-nextjs-app-router-rendering-strategy.md) §4's requirement that the catalog routes carry the *tightest* budget, and it is precisely the `P11` surface the loose number stops protecting.

**Option 4 — Budgets documented as targets, checked in review.**

- **Pros:** No tooling, no flake, no waivers; a reviewer can weigh context a threshold cannot.
- **Cons:** The null option, and the one `P15` describes failing. A reviewer cannot see a bundle grow by 6 KB in a diff, which is the actual mechanism of the decay. [ADR-0018](./ADR-0018-architecture-governance-ci-gate.md) rejected the equivalent for the backend and the reasoning transfers unchanged.

## 4. Decision Outcome

**Chosen: Option 1**, with Option 2 adopted alongside it rather than instead of it — they answer different questions.

| Commitment | Detail |
|---|---|
| Four budget classes | `P1` static catalog · `P2` dynamic streamed · `P3` transactional · `P4` admin, matching [ADR-0019](./ADR-0019-nextjs-app-router-rendering-strategy.md) §4's rendering classes. Values in [`Performance.md`](../../03-frontend/Performance.md) §2 |
| `P1` carries the tightest | Per [ADR-0019](./ADR-0019-nextjs-app-router-rendering-strategy.md) §4 |
| **Build-failing** | Lighthouse CI (LCP, CLS, TTFB) on one representative route per class, plus a deterministic bundle-size check per route |
| **INP is alarmed, not gated** | It is not honestly measurable synthetically. Field data from RUM is the source of truth for it |
| RUM alongside | Web Vitals from real sessions, segmented by route class, carrying **no URL with customer data, no session identifier, no token** ([`Security.md`](../Security.md) §8) |
| **No per-route waiver list** | A route that cannot meet its class's budget is **reclassified**, and the reclassification is a visible change to [`Routing.md`](../../03-frontend/Routing.md) |
| Separate from the smoke benchmark | [`Testing and Benchmark Strategy.md`](../Testing%20and%20Benchmark%20Strategy.md) §7.9's second trigger. `NFR-PERF-01` is server-side and measures something else ([`Performance.md`](../../03-frontend/Performance.md) §1) |

**The no-waiver rule is the load-bearing part of this record.** A waiver list is how a budget becomes decorative: the first exception is justified, the tenth is inherited, and nobody can say which routes are still held to anything. Reclassification costs the same effort and leaves the answer legible — a route in `P2` is a route someone decided could not be `P1`, and that decision is in a document rather than in a config file's exception array.

## 5. Consequences

### Positive

- A regression is attributed to its cause at the moment it is cheapest to fix, which is the entire difference between a budget and a target.
- The `P11` catalog routes get a genuinely tight number that the admin console's needs cannot dilute.
- The frontend gains a structural gate to sit beside type checking and boundary lint, closing the `P15` asymmetry [ADR-0020](./ADR-0020-typescript-strict-mode.md) §1 identified.
- Field data covers what synthetic measurement cannot, without either instrument pretending to be the other.

### Negative

- **Synthetic measurement is noisy, and a flaky gate erodes trust in every gate.** Mitigated by measuring medians over repeated runs and by keeping the deterministic bundle check as the primary signal — but not eliminated, and a persistently flaky Lighthouse job is a reason to narrow what it gates rather than to disable it.
- **The no-waiver rule will be unpopular at exactly the wrong moment.** An urgent fix that pushes a route over budget cannot be merged with an exception; it is reclassified or it is made to fit. That is deliberate and it is a real cost.
- **A representative route per class is not every route.** A route can drift over budget without being the one measured. The bundle check covers all of them; the Lighthouse half does not.
- **Budgets set before the application exists are estimates.** The numbers in [`Performance.md`](../../03-frontend/Performance.md) §2 are derived from Core Web Vitals thresholds and from what the rendering strategy should make achievable, not from measurement of this codebase. The first real measurements may show one of them was wrong, and the honest response is to amend the document rather than to grant an exception.

### Neutral / follow-on

- CI provider is undecided ([`Deployment Diagram.md`](../Deployment%20Diagram.md) §1) and this record is compatible with any of them.
- The RUM destination is `F-03` in [`Frontend Architecture.md`](../../03-frontend/Frontend%20Architecture.md) §10 and is not chosen here.
- Behaviour at `NFR-SCAL-06`'s 10× peak is a load-test question and stays with [`Testing and Benchmark Strategy.md`](../Testing%20and%20Benchmark%20Strategy.md) §7.

## 6. Related Decisions

[ADR-0019](./ADR-0019-nextjs-app-router-rendering-strategy.md) · [ADR-0018](./ADR-0018-architecture-governance-ci-gate.md) · [ADR-0020](./ADR-0020-typescript-strict-mode.md) · [ADR-0021](./ADR-0021-tailwind-shadcn-radix-styling-system.md) · [ADR-0035](./ADR-0035-feature-sliced-frontend-structure.md) · [ADR-0036](./ADR-0036-nextjs-server-sole-api-caller.md)

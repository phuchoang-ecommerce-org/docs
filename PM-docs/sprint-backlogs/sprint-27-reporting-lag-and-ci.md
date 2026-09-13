# Sprint 27 — Reporting: Inventory Report, Lag & CI

**Release:** R2 · **Gate:** **`G13` — Contract Sync** · **Backend 21 pts · Frontend 13 pts**
**Related documents:** [`../release-plan.md`](../release-plan.md) · [`../integration-plan.md`](../integration-plan.md) · [`../../BA-docs/user-stories/13-reporting-analytics.md`](../../BA-docs/user-stories/13-reporting-analytics.md) · [`../../SA-docs/01-system/Testing%20and%20Benchmark%20Strategy.md`](../../SA-docs/01-system/Testing%20and%20Benchmark%20Strategy.md) §9

---

## Sprint Goal

> **Every reporting screen shows its own lag.**

`NFR-PERF-06` permits five minutes. The sprint goal is not that the lag be small — it is that **an operator deciding on a five-minute-old figure must know that is what they are doing.** A figure whose age is unknown will be acted on as though it were current, which is the failure the whole reporting domain is shaped to avoid.

`EN-DATA-5` is what makes the claim checkable: the lag is **measured against the bound**, not asserted to be within it. Sprint 26 built the read models and implemented `E2`'s stale branch against a provisional bound; this sprint gives that branch a real measurement to compare against.

`EN-CI-1` brings stages 1–4 of [`Testing and Benchmark Strategy.md`](../../SA-docs/01-system/Testing%20and%20Benchmark%20Strategy.md) §9 into a pipeline. Stage 2 is marked **never skippable**, and that word is the point.

## Committed Items

| Lane | ID | Item | Pts |
|---|---|---|---:|
| BE | `US-RPT-04` | View Inventory Report | 5 |
| BE | `EN-DATA-5` | MongoDB reporting read models; projection lag measurement against NFR-PERF-06 | 8 |
| BE | `EN-CI-1` | CI stages 1–4 of Testing Strategy §9 | 8 |
| | | **Backend total** | **21** |
| FE | `EN-FE-E2E-2` | Accessibility sweep: axe in component tests, token-contrast assertions, manual screen-reader pass | 13 |
| FE | — | *Lane reserve — see [`../release-plan.md`](../release-plan.md) §6* | *5* |
| | | **Frontend total** | **13** |

---

## Backend Lane

### `EN-DATA-5` MongoDB read models; projection lag measurement (8 pts)
- [ ] The read-model collections formalised — one per report, projected from the Sprint 08 outbox through the `EN-EVENT-2` idempotency and ordering guards. **No fourth implementation of those guards**
- [ ] **Lag is measured, not assumed**: event-occurred-at to projection-applied-at, exposed as a Micrometer meter in the `EN-OBS-2` set and surfaced through the report responses as the `asAt` the screens display
- [ ] **Asserted against `NFR-PERF-06`'s five minutes under an event burst**, not at rest. Lag at rest is always fine; the bound exists for the burst, and IH-3 row 4 re-runs this assertion
- [ ] Replaces Sprint 26's provisional bound. If the real measurement changes what `E2` considers stale, that is a finding recorded here, not a silent adjustment
- [ ] **Rebuildable from the outbox alone** via the Sprint 14 `EN-EVENT-4` replay path — `EN-BENCH-2` (Sprint 29) drills it and IH-3 row 9 inherited a carried half of exactly this from IH-2
- [ ] `reporting` holds no write-model repository; ArchUnit and `allowedDependencies` assert it, extending Sprint 26's check rather than duplicating it

### `EN-CI-1` CI stages 1–4 of Testing Strategy §9 (8 pts)
- [ ] **Stage 1 — compile & type check**: Java compile, `tsc --noEmit`, ESLint. Fail. Budget 2 min
- [ ] **Stage 2 — fast suite**: L1, L2, L3. **Fail, and never skippable.** [`ADR-0018`](../../SA-docs/01-system/ADR/ADR-0018-architecture-governance-ci-gate.md) §5 names the failure mode — *slow builds create pressure to skip them, which is exactly how the gate fails* — so the 3-minute budget is part of the requirement, not an aspiration
- [ ] **Stage 3 — slow suite**: L4, L5, L6. Fail. Budget 12 min
- [ ] **Stage 4 — contract**: §6.6 spec ↔ code, **both directions** — `EN-CONTRACT-1` from Sprint 16 and `EN-CONTRACT-2` from Sprint 25, now gated rather than run locally
- [ ] Stages 1–2 on every push; 3–4 on every pull request and on `main`
- [ ] **The CI provider is `Proposed`, not decided** ([`ADR-0018`](../../SA-docs/01-system/ADR/ADR-0018-architecture-governance-ci-gate.md) §5) and [`../release-plan.md`](../release-plan.md) §7 R5 schedules it to be settled **before this sprint**. Confirm it is settled before starting, or raise it at Planning — the stages are provider-independent by design, but they cannot run on an undecided provider
- [ ] Stages 5–7 are **`EN-CI-2`, Sprint 29**. Do not partially implement them here

### `US-RPT-04` View Inventory Report (5 pts) — `getInventoryReport`
- [ ] **`E1` — the as-at time is stated.** No decision made from this report consumes stock; `UC-INV-01` re-checks at the moment of reserving and `BR-INV-01` holds regardless of what this report showed (`UC-INV-05` `E3`)
- [ ] `E2` — a SKU with no configured reorder threshold appears in the position report but not in low-stock exposure, and is **listed as unconfigured rather than silently omitted**
- [ ] `E3` — authority declined. Stock levels and warehouse structure are commercially sensitive (`P16`, `BR-AUD-02`)
- [ ] **`E4` — a reporting outage leaves the operational inventory view (`US-INV-05`, Sprint 12) available.** Warehouse work cannot stop for a reporting outage (`NFR-AVAIL-02`)

---

## Frontend Lane

### `EN-FE-E2E-2` Accessibility sweep (13 pts)
- [ ] **axe in component tests across every component and screen delivered so far** — not only the new ones. The obligation has been per-story since Sprint 00; this is the sweep that confirms it actually held
- [ ] **Token-contrast assertions** on the design-system tokens themselves, so a future token change fails a test rather than quietly degrading every screen using it
- [ ] **A manual screen-reader pass.** [`ADR-0026`](../../SA-docs/01-system/ADR/ADR-0026-motion-and-accessibility-baseline.md) is explicit that automated `axe` coverage is *"a floor, not all of them"* — the manual pass is the part that cannot be automated and therefore the part most likely to be skipped
- [ ] Priority order for the manual pass: the purchase path first (`/p/[productId]` → `/cart` → the checkout funnel), then `(account)`, then `(admin)`
- [ ] Reduced-motion respected everywhere the motion baseline applies
- [ ] **Findings are logged as sized backlog items with named sprints**, not fixed opportunistically until the points run out. An accessibility sweep that fixes what is easy and leaves what is hard unrecorded has made the problem invisible rather than smaller
- [ ] Record what was swept and what was not. Sprint 32 restates coverage honestly, and it can only restate what this sprint wrote down

---

## Integration Risk

**`G13` is the first and only gate that looks at reporting**, and four screens built across Sprints 23–24 against the mock arrive at it together. The states that matter — incomplete, stale, zero, partially unavailable — are precisely the ones Prism never generated, so all four are being verified for the first time in one session.

Concretely: if the backend's staleness field is a boolean and the frontend expected a timestamp, or if `E5`'s explicit zero and `E3`'s failure share a shape, four screens are wrong in the same way. That is check 6's job at this gate and it deserves more than a glance.

Second: `EN-CI-1` will make previously-local failures visible. A test that only ever ran on one developer's machine, or a boundary rule nobody re-ran after Sprint 24's `EN-CI-3`, surfaces here. Budget for it inside the sprint.

## Gate `G13` — Contract Sync

Checklist: [`../integration-plan.md`](../integration-plan.md) §3.1, scoped to reporting — read models and screens.

| # | Check |
|---|---|
| 1 | Types regenerated, diff empty — enforced in CI by `EN-CI-3` since Sprint 24 |
| 2 | Contract test **spec→code** across `getRevenueReport`, `getProductPerformanceReport`, `getOrderStatisticsReport`, `getInventoryReport` — now a pipeline stage, not a local run |
| 3 | Contract test **code→spec**, machine-verified by `EN-CONTRACT-2` — no undocumented reporting endpoint |
| 4 | `/admin`, `/admin/reports/revenue`, `/admin/reports/products`, `/admin/reports/orders`, `/admin/reports/inventory` render against the real API |
| 5 | Pagination envelope and cursor shape match on `getProductPerformanceReport` |
| 6 | **The four honest-figure states render as designed, and are visibly different from one another:** a period including today marked **incomplete** · a figure past the bound marked **stale, with its age** · **zero** presented explicitly and distinguishably from a computation failure · a **partially unavailable** report showing what it has and marking the rest |
| 7 | Permission matrix: every report refused server-side for `CUSTOMER` and for any `STAFF` role the matrix does not grant; the attempt recorded |
| 8 | **`Money` in every report is a string and server-computed, derived from prices recorded on the orders** — change a product's price and confirm no historical figure moves |
| 9 | One correlation id across browser → API → projection on a report read |
| 10 | Drift logged **and** `openapi.yaml` amended in the same session |
| — | **Also confirm, since it is this increment's whole point:** each screen displays its own as-at time, and `/admin`'s cards each show their own staleness independently ([`ADR-0036`](../../SA-docs/01-system/ADR/ADR-0036-nextjs-server-sole-api-caller.md) §4). **Recorded as expected, not drift:** `/admin/audit` is mock-served until Sprint 28 |

## Definition of Done

Every item satisfies its lane's list in [`../definition-of-done.md`](../definition-of-done.md) §3 or §4, and every story reaches §5.

Additionally: **`EN-DATA-5` is done when the lag is measured under a burst and compared against the five-minute bound**, not when the meter exists. And `EN-FE-E2E-2`'s findings are all logged with named sprints before the sprint is called done.

## Review Notes

<!-- filled at Sprint Review -->

## Retrospective

**Went well:**
**Change one thing:**
**Action (owned, carried to next sprint's board):**

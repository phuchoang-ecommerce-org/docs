# Sprint 26 — Reporting: Read Models & Core Reports

**Release:** R2 · **Gate:** none · **Backend 18 pts · Frontend 0 pts**
**Related documents:** [`../release-plan.md`](../release-plan.md) · [`../integration-plan.md`](../integration-plan.md) · [`../../BA-docs/user-stories/13-reporting-analytics.md`](../../BA-docs/user-stories/13-reporting-analytics.md) · [`../../BA-docs/use-cases/13-reporting-analytics.md`](../../BA-docs/use-cases/13-reporting-analytics.md)

---

## Sprint Goal

> **Reporting answers from MongoDB, never from the write model.**

`CON-06` holds at the **process level**: reporting queries must not compete with transactions. That is not a performance preference — it is what `P13` is about, and `UC-RPT-01` `E6` states the priority plainly: under contention **the report waits, not the checkout**. A revenue query that touches PostgreSQL is a correct-looking implementation that fails the constraint.

The second theme is that **an honest figure beats a complete-looking one**. `E1` marks a period including today as incomplete; `E2` states the as-at time and labels a figure stale beyond the permitted lag; `E5` presents zero explicitly and distinguishably from a computation failure — *"no revenue" and "we could not compute revenue" are different facts and must never look alike.*

## Committed Items

| Lane | ID | Item | Pts |
|---|---|---|---:|
| BE | `US-RPT-01` | View Revenue Report | 8 |
| BE | `US-RPT-02` | View Product Performance Report | 5 |
| BE | `US-RPT-05` | View Order and Conversion Statistics | 5 |
| | | **Backend total** | **18** |
| FE | — | *Lane reserve — see [`../release-plan.md`](../release-plan.md) §6* | *18* |
| | | **Frontend total** | **0** |

### The zero-point frontend lane

**This is the only sprint in the plan with no committed frontend story, and it is deliberate.** The three reporting screens were built in Sprint 23 and 24 against the mock; they integrate at `G13` next sprint. The full 18 points are reserve, spent on its documented order of use ([`../release-plan.md`](../release-plan.md) §6):

- [ ] **Absorb backend slip** from Sprints 22–25 first, if there is any. That is the reserve's first purpose and it outranks the rest
- [ ] **Prepare the next increment** — `EN-FE-E2E-2`'s accessibility sweep is committed next sprint at 13 points and benefits from a running start
- [ ] **Deepen the design system.** [`UI Design System.md`](../../SA-docs/03-frontend/UI%20Design%20System.md) specifies a *Ma*-inspired system whose quality is not achievable in the 38 points `EN-FE-DS` budgets. This is where the remainder goes
- [ ] **Manual accessibility work.** [`ADR-0026`](../../SA-docs/01-system/ADR/ADR-0026-motion-and-accessibility-baseline.md) is explicit that automated `axe` coverage is *"a floor, not all of them"*

**Record at Review which of the four the sprint actually spent it on.** An unspent reserve reported as spent is how §6's asset quietly becomes padding.

---

## Backend Lane

### `US-RPT-01` View Revenue Report (8 pts) — `getRevenueReport`
- [ ] Reads the **MongoDB read model, never PostgreSQL.** ArchUnit asserts `reporting` holds no write-model repository, and `allowedDependencies` grants it no edge that would let it
- [ ] **`CON-06` at the process level**: confirm by test that a reporting query issues no statement against the transactional database. A correct number obtained the wrong way fails this sprint's goal
- [ ] **`E1` — a period including today is marked explicitly incomplete, with its as-at time.** A partial day presented as a whole one produces a false decline every morning
- [ ] **`E2` — the as-at time is always returned; beyond the permitted lag (**[A-11]**) the response says the figure is stale rather than presenting it as current.** A figure of unknown age is worse than an acknowledged gap, because it will be acted on
- [ ] `E3` — a reporting outage reports the failure, and **transactional operations are unaffected**. The separation `P13` requires runs in both directions (`NFR-SCAL-05`)
- [ ] `E4` — authority declined **and recorded**. Revenue figures are commercially sensitive (`P16`)
- [ ] **`E5` — zero is returned explicitly, distinguishable from a computation failure.** Two different fields, not one ambiguous number
- [ ] `E6` — under report demand during a peak event, transactional latency targets continue to hold (`NFR-PERF-01`, `-02`). **The report waits, not the checkout**
- [ ] Revenue computed from **prices recorded on the orders** (`BR-ORD-06`, `FR-DAT-03`), never from current catalog prices

### `US-RPT-05` View Order and Conversion Statistics (5 pts) — `getOrderStatisticsReport`
- [ ] **`E1` — where session data is unavailable, order statistics are returned and conversion marked unavailable.** A conversion rate from an unknown denominator is not a number worth returning
- [ ] `E2` — orders not yet terminal are counted in their current state **and identified as in flight**; counting them as completed overstates fulfilment
- [ ] `E3`/`E5` as `UC-RPT-01` `E3`/`E4`
- [ ] `E4` — the case where the temptation to trade checkout speed for a live dashboard is strongest. **`P13` answers it**: transactional targets hold and the report waits

### `US-RPT-02` View Product Performance Report (5 pts) — `getProductPerformanceReport`
- [ ] **`E1` — a product removed during the period is still reported** from the orders referencing it (`FR-DAT-04`). Dropping it would understate the period's totals
- [ ] **`E2` — unavailable view counts mark those columns unavailable and return the rest.** A partial report is useful; a silently incomplete one is not
- [ ] `E5` — a period spanning a price change computes from **prices recorded on the orders**, not the product's current price. Anything else restates history every time a price moves
- [ ] `E3`/`E4` as `UC-RPT-01`
- [ ] Cursor pagination on the Sprint 02 envelope

---

## Integration Risk

**Nothing this sprint meets a gate on either side** — the backend ships three read operations the frontend already built screens for three sprints ago, and they meet at `G13` next sprint.

The concrete exposure is that **the honest-figure states are the ones Prism cannot generate.** The frontend built incomplete, stale, zero, and partially-unavailable renderings against mock data that is none of those things. Whether the backend's `asAt`, `incomplete` and `unavailable` field shapes match what those screens parse is unverified until `G13`. One deliberate read of the reporting schemas in `openapi.yaml` by both developers this sprint costs an hour and removes the whole class.

Second: **`EN-DATA-5` is next sprint, not this one.** The MongoDB read models are built here and their *lag measurement* against `NFR-PERF-06` is Sprint 27. Until then `E2`'s "beyond the permitted lag" branch has no measured lag to compare against — implement the branch, and record that the bound it tests against is provisional.

## Definition of Done

Every item satisfies its lane's list in [`../definition-of-done.md`](../definition-of-done.md) §3 or §4, and every story reaches §5.

Additionally: **confirm by test, not by inspection, that no reporting query reaches PostgreSQL.** That is the sprint goal, and it is the one property that will silently stop being true later if nothing asserts it.

## Review Notes

<!-- filled at Sprint Review -->

## Retrospective

**Went well:**
**Change one thing:**
**Action (owned, carried to next sprint's board):**

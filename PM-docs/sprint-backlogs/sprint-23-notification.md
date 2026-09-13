# Sprint 23 — Notification

**Release:** R1 · **Gate:** **`G11` — Contract Sync** · **Backend 21 pts · Frontend 13 pts**
**Related documents:** [`../release-plan.md`](../release-plan.md) · [`../integration-plan.md`](../integration-plan.md) · [`../../BA-docs/user-stories/11-notification.md`](../../BA-docs/user-stories/11-notification.md) · [`../../BA-docs/use-cases/11-notification.md`](../../BA-docs/use-cases/11-notification.md)

---

## Sprint Goal

> **The platform tells people what happened.**

`notification` is a pure consumer — it subscribes to the Sprint 08 outbox's topics and owns no command path of its own. That shape decides its exception flows: **the business event it reports is never affected by a delivery failure.** `UC-NTF-01` `E7` and `UC-NTF-02` `E1` both say so explicitly, and `UC-ORD-05` `E9` said it first — an order is never reversed because its confirmation could not be composed.

The mirror rule is `BR-NTF-01`: a notification is **never marked delivered** when it was not. `E1` retries with backoff and then records **undeliverable**, surfaced operationally. This is `P6` in its most visible form — the customer who was never told.

This sprint also closes the escalation channel Sprint 20's `US-SHP-03` `E5` has been carrying without one.

**`R1` closes here.** Sprint 24 begins Release 2.

## Committed Items

| Lane | ID | Item | Pts |
|---|---|---|---:|
| BE | `US-NTF-01` | Deliver Email Notification | 8 |
| BE | `US-NTF-02` | Deliver In-App Notification | 5 |
| BE | `US-NTF-03` | View In-App Notifications | 3 |
| BE | `EN-BENCH-1` | `bench/smoke.js` — k6 scenarios S1–S5 reconciled against `openapi.yaml` | 5 |
| | | **Backend total** | **21** |
| FE | `US-RPT-01` | View Revenue Report | 5 |
| FE | `US-RPT-02` | View Product Performance Report | 3 |
| FE | `US-RPT-05` | View Order and Conversion Statistics | 5 |
| FE | — | *Lane reserve — see [`../release-plan.md`](../release-plan.md) §6* | *5* |
| | | **Frontend total** | **13** |

---

## Backend Lane

### `US-NTF-01` Deliver Email Notification (8 pts) — `listNotificationDeliveries`
- [ ] Kafka consumer over the order, payment and shipment topics; **idempotency and ordering guards reuse `EN-EVENT-2`'s**, not a fourth implementation
- [ ] **`E6` — a notification that cannot be recorded is not sent.** Recording precedes dispatch, so a message sent with no record of it is one nobody can later confirm was sent (`P6`)
- [ ] **`E4` — an event raised more than once sends one notification.** Duplicate confirmations for one order teach customers to distrust the channel — and the outbox is at-least-once by design, so duplicates are routine
- [ ] `E1` — a provider rejection records **failed** and retries with backoff; after the configured attempts it records **undeliverable** and surfaces it operationally. **It is never marked delivered** (`BR-NTF-01`)
- [ ] `E2` — an unreachable provider leaves it **pending** and retries. Because recording precedes dispatch, nothing is lost to a provider outage (`NFR-AVAIL-03`)
- [ ] `E3` — a bouncing address records undeliverable and **flags the address for correction**; repeated bounces suppress further sending, so provider reputation is not spent on a dead address
- [ ] `E5` — no registered address records undeliverable **with the reason**, not discarded: the absence is itself worth surfacing
- [ ] **`E7` — a composition failure is recorded and escalated, and the business event it reports is unaffected** (`UC-ORD-05` `E9`)
- [ ] This is the escalation channel Sprint 20's `US-SHP-03` `E5` has been carrying without one — wire it
- [ ] `BR-NTF-02` — transactional notifications are not suppressible by preference. `US-NTF-04` is Sprint 32; the **rule** is enforced here regardless

### `US-NTF-02` Deliver In-App Notification (5 pts) — internal consumer
- [ ] `E1` — a failed recording retries; **the business event is unaffected**
- [ ] `E2` — a duplicated event records once
- [ ] `E3` — a suspended or deleted account records **undeliverable with the reason**, not discarded
- [ ] **`E4` — a notification for another customer's account is refused and recorded. In-app notifications are scoped to their recipient absolutely** (`BR-AUD-02`, `P16`)

### `US-NTF-03` View In-App Notifications (3 pts) — `listOwnNotifications`, `setNotificationReadState`, `dismissNotification`, `markNotificationsRead`
- [ ] `E1` — no notifications returns an explicit empty page, never an error
- [ ] **`E2` — another customer's notifications are declined and the attempt recorded.** Notifications reveal order history and are scoped absolutely (`P16`)
- [ ] **`E3` — a failed read-state change still returns the notification content.** A read-state failure never withholds the message
- [ ] `E4` — a notification referencing a deleted order or product returns **its recorded text** (`FR-DAT-04`)
- [ ] Cursor pagination on the Sprint 02 envelope

### `EN-BENCH-1` `bench/smoke.js` — k6 scenarios S1–S5 (5 pts)
- [ ] Scenarios S1–S5 of [`Testing and Benchmark Strategy.md`](../../SA-docs/01-system/Testing%20and%20Benchmark%20Strategy.md) written as k6, **reconciled against `openapi.yaml`** — a scenario hitting a path or payload the contract does not define is a defect in the scenario
- [ ] Smoke scale only. **The load rig `NFR-PERF` and `AC-05`/`AC-06` need is deliberately deferred** by §7.9 with five dated triggers; this item does not discharge that deferral and must not be reported as doing so
- [ ] Runnable against a local stack by one developer in one command
- [ ] Records what it measured and at what scale, so the numbers are not later read as capacity evidence

---

## Frontend Lane

> All three stories are built against the mock. `reporting` arrives in **Sprints 26–27** — a three-sprint lead, the longest remaining in the plan.

### `US-RPT-01` View Revenue Report (5 pts) — `/admin/reports/revenue`, `/admin`, **R4**
- [ ] Reads `getRevenueReport`
- [ ] **`E1` — a period including today is marked explicitly incomplete, with its as-at time stated.** A partial day presented as a whole one produces a false decline every morning
- [ ] **`E2` — the as-at time is always stated; beyond the permitted lag (**[A-11]**) the figure is labelled stale rather than presented as current.** A figure of unknown age is worse than an acknowledged gap, because it will be acted on
- [ ] **`E5` — zero is presented explicitly and distinguishably from a computation failure.** "No revenue" and "we could not compute revenue" are different facts and must never look alike
- [ ] `E3` — a reporting outage renders its own screen, and **nothing about it touches checkout** (`P13`, `NFR-SCAL-05`)
- [ ] **No client-side arithmetic on `Money`** — every figure is server-computed
- [ ] Hand-written Zod parsers for the report payloads; each `/admin` dashboard card in its own `<Suspense>` boundary showing its own staleness ([`ADR-0036`](../../SA-docs/01-system/ADR/ADR-0036-nextjs-server-sole-api-caller.md) §4)
- [ ] Vitest + axe across incomplete, stale, zero, and unavailable states

### `US-RPT-05` View Order and Conversion Statistics (5 pts) — `/admin/reports/orders`, `/admin`, **R4**
- [ ] Reads `getOrderStatisticsReport`
- [ ] **`E1` — where session data is unavailable, order statistics are shown and conversion marked unavailable.** A conversion rate from an unknown denominator is not a number worth showing
- [ ] `E2` — orders not yet terminal are counted in their current state **and identified as in flight**; counting them as completed overstates fulfilment
- [ ] Vitest + axe

### `US-RPT-02` View Product Performance Report (3 pts) — `/admin/reports/products`, **R4**
- [ ] Reads `getProductPerformanceReport`
- [ ] `E1` — a product removed during the period is **still reported** from the orders referencing it (`FR-DAT-04`); dropping it would understate the totals
- [ ] `E2` — unavailable view counts mark those columns unavailable and present the rest. **A partial report is useful; a silently incomplete one is not**
- [ ] `E5` — revenue is computed from **prices recorded on the orders**, not current catalog prices (`FR-DAT-03`, `BR-ORD-06`). The screen must not re-derive anything from a product lookup
- [ ] Vitest + axe

---

## Integration Risk

**`notification` has almost no contract surface** — two of its three stories are consumers with none at all — so `G11` verifies very little of what this sprint actually built. The guarantees that matter (recorded-before-sent, never-marked-delivered, duplicate-collapsed, business-event-unaffected) are verified by the sprint's own tests or not at all.

The concrete exposure: **`E4` duplicate collapse meets an at-least-once outbox.** If the idempotency key for a notification is derived from anything but the event id, a redelivery sends a second email — and the failure is invisible in every test that publishes each event once.

Second: three reporting screens are built against Prism for three sprints, and reporting is the domain where mock data is **least** representative — staleness, incompleteness and zero are the states that matter, and Prism generates none of them naturally. Exercise them by hand-editing mock responses.

## Gate `G11` — Contract Sync

Checklist: [`../integration-plan.md`](../integration-plan.md) §3.1, scoped to notification, plus the payment increment of Sprint 22.

| # | Check |
|---|---|
| 1 | Types regenerated, diff empty |
| 2 | Contract test **spec→code** across `listOwnNotifications`, `setNotificationReadState`, `dismissNotification`, `markNotificationsRead`, `listNotificationDeliveries`, `settleCashOnDelivery`, `retryPayment`, `refundPayment`, `listPaymentRefunds`, `listPaymentAttempts`, `listUnmatchedPayments` |
| 3 | Contract test **code→spec** — no undocumented notification or payment endpoint (manual until Sprint 25) |
| 4 | `/account/notifications`, the header bell, `/admin/payments`, `/admin/payments/[paymentId]` render against the real API |
| 5 | Pagination envelope and cursor shape match on `listOwnNotifications`, `listNotificationDeliveries`, `listPaymentAttempts`, `listPaymentRefunds`, `listUnmatchedPayments` |
| 6 | **Designed screens:** `/admin/payments` empty as **"the design at rest"**, not "no data" · `ECP-PAY-4220` maximum refundable · a failed or pending refund shown as still outstanding · a notification whose read-state update failed **still showing its content** |
| 7 | **Permission matrix:** another customer's notifications are refused server-side · `refundPayment` refused for every role the matrix does not grant · `listUnmatchedPayments` unreachable by `CUSTOMER` |
| 8 | **`Money` on refunds compared on exact `NUMERIC` values** — confirm no rounding anywhere between the contract and the comparison |
| 9 | **One correlation id, now asserted continuously by `EN-OBS-3`**, across browser → API → outbox → Kafka → notification consumer — **and no card detail or personal identifier in the trace** |
| 10 | Drift logged **and** `openapi.yaml` amended in the same session |
| — | **Recorded as expected, not drift:** reporting screens are mock-served until Sprints 26–27; `review` until Sprint 24. **Not covered here:** the notification guarantees with no contract surface — recorded-before-sent, duplicate collapse, undeliverable-not-delivered |

## Definition of Done

Every item satisfies its lane's list in [`../definition-of-done.md`](../definition-of-done.md) §3 or §4, and every story reaches §5.

**Release 1 closes here.** Confirm at Review that the purchase path runs end to end — register, browse, cart, checkout, pay, ship, deliver, notify — and record plainly which parts of it were verified by demonstration and which by test.

## Review Notes

<!-- filled at Sprint Review -->

## Retrospective

**Went well:**
**Change one thing:**
**Action (owned, carried to next sprint's board):**

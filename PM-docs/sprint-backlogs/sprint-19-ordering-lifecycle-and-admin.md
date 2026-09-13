# Sprint 19 — Ordering: Lifecycle & Admin Orders

**Release:** R1 · **Gate:** **`G9` — Contract Sync** · **Backend 19 pts · Frontend 7 pts**
**Related documents:** [`../release-plan.md`](../release-plan.md) · [`../integration-plan.md`](../integration-plan.md) · [`../../BA-docs/user-stories/06-checkout-order.md`](../../BA-docs/user-stories/06-checkout-order.md) · [`../../BA-docs/user-stories/08-shipping.md`](../../BA-docs/user-stories/08-shipping.md)

---

## Sprint Goal

> **An order has a life after placement.**

`US-ORD-10` at 8 points is the order state machine, and it is the sprint's centre of gravity. `BR-ORD-01` makes it **a property of the platform rather than a convention of one interface** — an `ADMINISTRATOR` cannot move an order from Draft to Delivered, and an administrative interface that could skip transitions would be exactly the loophole `P5` describes.

Two exception flows encode the whole discipline and pull in opposite directions: **`E3` — a failed side effect means the transition does not occur**, because a Processing → Packed that fails to commit the reservation leaves stock the platform thinks it still holds. **`E6` — a failed event leaves the transition standing**, because a dropped event means a downstream process silently misses a shipment. State and side effect move together; state and *notification of state* do not.

## Committed Items

| Lane | ID | Item | Pts |
|---|---|---|---:|
| BE | `US-ORD-06` | View Order Details | 3 |
| BE | `US-ORD-07` | Track Order | 3 |
| BE | `US-ORD-08` | Cancel Order | 5 |
| BE | `US-ORD-10` | Advance Order Status | 8 |
| | | **Backend total** | **19** |
| FE | `US-SHP-01` | Calculate Shipping Fee | 2 |
| FE | `US-SHP-05` | View Shipment Tracking | 5 |
| FE | — | *Lane reserve — see [`../release-plan.md`](../release-plan.md) §6* | *11* |
| | | **Frontend total** | **7** |

---

## Backend Lane

### `US-ORD-10` Advance Order Status (8 pts) — `advanceOrderStatus`, `advanceOrderStatusesInBulk`, `setOrderInvestigationFlag`
- [ ] The state machine as a first-class domain object, not a set of `if` statements per endpoint. The legal transitions are enumerated once and every caller goes through them
- [ ] **`E1` — an illegal transition is declined whatever the actor's role and whatever entry point the request arrived through**, stating the current state and the transitions available. `ECP-ORD-4091` (`BR-ORD-01`, `P5`)
- [ ] `E2` — authority is checked **per transition**, not per endpoint. Approving a refund and packing a box are different authorities (`P16`); permission-matrix cell asserted for each
- [ ] **`E3` — a failed side effect means the transition does not occur** (`NFR-REL-01`). The worked case: Processing → Packed commits the reservation through `inventory`; if the commit fails the order stays in Processing
- [ ] `E4` — a failed audit write means the transition is not applied. The `UC-AUD-01` `E1` branch from Sprint 12, selected — not reimplemented
- [ ] `E5` — concurrent transitions: exactly one succeeds, the other is re-evaluated against the new state and declines as `E1` if no longer legal. L5 concurrency test on the `EN-DATA-4` rig
- [ ] **`E6` — a business event that cannot be raised leaves the transition standing** and is retried until delivered (`NFR-REL-06`, `P6`). The Sprint 08 outbox already guarantees it; assert it here
- [ ] `advanceOrderStatusesInBulk` reports **per-order** outcomes. An aggregate result hides the `E1` failures inside it
- [ ] `setOrderInvestigationFlag` is audited like any other command

### `US-ORD-08` Cancel Order (5 pts) — `cancelOrder`
- [ ] **`E1` — Packed or beyond is declined**; once packed the goods are committed and the remedy is a return (`BR-ORD-04`). `ECP-ORD-4091`. `US-ORD-09` is Sprint 31 — the decline is real now, the return path is carried forward with that named sprint
- [ ] `E2` — an already-cancelled order reports success without acting. **Releasing the reservation twice would inflate available stock** (`UC-INV-02` `E1`)
- [ ] **`E3` — a failed reservation release leaves the order Cancelled** — the customer's request is honoured — and the release is retried and escalated. Held-but-unreleasable stock is invisible loss (`P7`)
- [ ] **`E4` — a failed refund leaves the order Cancelled but not Refunded**, visibly awaiting refund and retried. **The discrepancy is never closed by marking it refunded** (`BR-PAY-02`, `P7`). `payment` arrives Sprint 22 — build the awaiting-refund state; carry the refund call to that named sprint
- [ ] `E5` — a cancellation racing a state advance: exactly one transition applies; if the advance wins to Packed, cancellation fails as `E1`

### `US-ORD-06` View Order Details (3 pts) — `getOrder`, `listOrderLines`
- [ ] **`E1` — an order the caller does not own returns the same response as one that does not exist**, and the attempt is recorded (`P16`). Same non-disclosure rule as Sprint 05's `getOwnAddress`
- [ ] `E2` — an order referencing a deleted product presents **in full from the values recorded at placement** (`FR-DAT-04`). A catalog change never rewrites a purchase record
- [ ] **`E3` — the placement price is returned, not the current one** (`BR-ORD-06`, `FR-DAT-03`)
- [ ] This replaces the empty `listOrders` Sprint 05 built — confirm `/account/orders` now returns real rows

### `US-ORD-07` Track Order (3 pts) — `trackOrder`
- [ ] `E1` — when carrier updates are unavailable, the **last recorded state and when it was received** are returned. A stale state is never presented as current
- [ ] `E2` — an update older than the latest recorded **does not move the shipment backwards** (`BR-SHP-02`)
- [ ] `E3` — ownership as `UC-ORD-06` `E1`
- [ ] **`shipping` does not exist until Sprint 20** — this returns the order-side tracking state; real carrier events arrive next sprint. Record the boundary

---

## Frontend Lane

> Both stories are built against the Prism mock; the backend delivers them in **Sprint 20**. The 11-point reserve is the largest in the plan and absorbs Sprint 18 slip.

### `US-SHP-05` View Shipment Tracking (5 pts) — `/account/orders/[orderId]/tracking`, **R3**
- [ ] Reads `getShipment`, `listShipmentTrackingEvents`
- [ ] **`E1` — no updates yet: the screen states the shipment is dispatched and awaiting the first carrier update.** An empty history is explained, never left blank
- [ ] **`E2` — the age of the last update is stated explicitly.** A stale status presented as current is worse than no status, because the customer acts on it
- [ ] `E3` — a shipment the caller may not see returns the same outcome as one that does not exist. **A tracking reference identifies a real address and must not be probeable** (`P16`)
- [ ] Events render in recorded order, with an out-of-order event visible in the history but not advancing the headline state (`BR-SHP-02`)
- [ ] Hand-written Zod parsers for shipment and tracking-event payloads; `loading.tsx`; Vitest + axe across empty, stale, and out-of-order histories

### `US-SHP-01` Calculate Shipping Fee (2 pts) — `/checkout/shipping`, **R3**
- [ ] Quote display refactored onto the real `getShippingQuotes` shape, replacing the Sprint 14 mock-shaped implementation
- [ ] **`E3` — the UI never estimates a fee.** A failure is stated and retry offered (`BR-SHP-01`)
- [ ] `E4` — a fallback rate, where one exists, is **identified as a fallback**; `E1`/`E2` reuse the Sprint 14 unserved-destination and restricted-line screens
- [ ] Vitest + axe

---

## Integration Risk

**`placeOrder` and the whole order lifecycle meet the frontend at `G9`, one sprint after the partnership was built and one sprint before IH-2 examines it properly.** The gate will exercise the happy path and the documented error codes; it will not exercise fault injection, concurrency, or idempotency under load. Those are IH-2 rows 1, 2 and 3, and `G9` must not be read as having covered them.

Second: `US-ORD-08` `E4` and `US-ORD-10` `E3` both depend on modules that are partly absent — `payment` until Sprint 22, `shipping` until Sprint 20. Both produce **real states with no real driver** this sprint. Record precisely which half is built, or Sprint 20–22 will re-litigate it.

## Gate `G9` — Contract Sync

Checklist: [`../integration-plan.md`](../integration-plan.md) §3.1, scoped to ordering — placement, lifecycle, and admin orders.

| # | Check |
|---|---|
| 1 | Types regenerated, diff empty |
| 2 | Contract test **spec→code** across `placeOrder`, `getOrder`, `listOrderLines`, `trackOrder`, `cancelOrder`, `advanceOrderStatus`, `advanceOrderStatusesInBulk`, `setOrderInvestigationFlag`, `listOrders` |
| 3 | Contract test **code→spec** — no undocumented ordering endpoint (manual until Sprint 25) |
| 4 | `/checkout/review` → `/checkout/confirmation/[orderId]`, `/account/orders`, `/account/orders/[orderId]`, `/account/orders/[orderId]/tracking`, `/admin/orders`, `/admin/orders/[orderId]` all render against the real API |
| 5 | Pagination envelope and cursor shape match on `listOrders` (both the customer-scoped and admin-scoped forms) and `listOrderLines` |
| 6 | **Designed screens:** `ECP-INV-4091` as **"sold out", visibly different from "try again"** · `ECP-ORD-4091` illegal transition showing current state and available transitions · `ECP-ORD-4001`/`4090` surfaced as client defects · order awaiting refund shown as awaiting refund |
| 7 | **Permission matrix, server-side:** another customer's order is `404`, never `403`, and the screen does not explain why · an illegal transition is refused for `ADMINISTRATOR` too |
| 8 | **`Money` on the placed order is the placement price, not the current catalog price** — change a product's price after placement and confirm the order detail does not move |
| 9 | One correlation id across browser → API → outbox → Kafka on a placement |
| 10 | Drift logged **and** `openapi.yaml` amended in the same session |
| — | **Recorded as expected, not drift:** carrier tracking events are order-side only until Sprint 20; refund and payment-failure states have no driver until Sprints 21–22. **Not covered here:** idempotency under concurrency, fault injection, the oversell race end to end — IH-2 rows 1–3 |

## Definition of Done

Every item satisfies its lane's list in [`../definition-of-done.md`](../definition-of-done.md) §3 or §4, and every story reaches §5.

## Review Notes

<!-- filled at Sprint Review -->

## Retrospective

**Went well:**
**Change one thing:**
**Action (owned, carried to next sprint's board):**

# Sprint 18 — Ordering: Place Order (the Partnership)

**Release:** R1 · **Gate:** none · **Backend 18 pts · Frontend 10 pts**
**Related documents:** [`../release-plan.md`](../release-plan.md) · [`../integration-plan.md`](../integration-plan.md) · [`../../BA-docs/user-stories/06-checkout-order.md`](../../BA-docs/user-stories/06-checkout-order.md) · [`../../SA-docs/02-backend/Module%20Dependency%20Diagram.md`](../../SA-docs/02-backend/Module%20Dependency%20Diagram.md) §8 · [`../../SA-docs/02-backend/Domain%20Model.md`](../../SA-docs/02-backend/Domain%20Model.md) §5.1

---

## Sprint Goal

> **Placing an order is atomic across three modules.**

This is the **Order-Placement Partnership** — described in [`Module Dependency Diagram.md`](../../SA-docs/02-backend/Module%20Dependency%20Diagram.md) §8 as *the single place in the system where one transaction spans three modules*, and the one boundary that is deliberately porous. `BR-ORD-02` requires creating the order, reserving its stock, and consuming the promotion's usage allowance to be indivisible **including under system failure**.

Two things keep that from becoming a general licence, and both are deliverables here: it goes through **`StockReservationPort` and `PromotionRedemptionPort`, never a direct call** — both owned by `ordering.application`, satisfied by adapters in `ordering.infrastructure` — and it is **scoped to this one interaction**. Every other cross-module edge stays a query or a one-time translation.

One 13-point story. `UC-ORD-05` carries ten exception flows, and **`E4`, `E5` and `E7` are the three that `P7` exists for**. This is the riskiest sprint in the plan and it is deliberately shielded: no gate at its end, and an 8-point frontend reserve behind it.

## Committed Items

| Lane | ID | Item | Pts |
|---|---|---|---:|
| BE | `US-ORD-05` | Place Order | 13 |
| BE | `EN-EVENT-5` | Order lifecycle events on the outbox; ordering topic partitioning | 5 |
| | | **Backend total** | **18** |
| FE | `US-ORD-07` | Track Order | 3 |
| FE | `US-ORD-08` | Cancel Order | 2 |
| FE | `US-ORD-10` | Advance Order Status | 5 |
| FE | — | *Lane reserve — see [`../release-plan.md`](../release-plan.md) §6* | *8* |
| | | **Frontend total** | **10** |

---

## Backend Lane

### `US-ORD-05` Place Order (13 pts) — `placeOrder`

**The partnership**
- [ ] `StockReservationPort` and `PromotionRedemptionPort` defined in `ordering.application`, adapters in `ordering.infrastructure`. **`ordering.domain` never sees either module**
- [ ] Both called inside **one local transaction** with the order insert and the outbox write. Because it is one transaction today, a mid-placement failure needs no compensating action — rollback releases every held reservation for free ([`Module Dependency Diagram.md`](../../SA-docs/02-backend/Module%20Dependency%20Diagram.md) §8)
- [ ] The adapters are shaped so a future extraction turns them into saga/compensating-action adapters **without changing `ordering.domain`**. That is the property being bought; a direct service call in the domain forfeits it
- [ ] `@ApplicationModule(allowedDependencies=...)` and ArchUnit both permit exactly these two edges and no more

**Idempotency**
- [ ] **`E4` — a duplicate submission returns the existing order and creates no second one** (`BR-ORD-03`, `NFR-REL-02`). Two orders and two charges from one intention is the failure `P7` names
- [ ] `ECP-ORD-4001` when `Idempotency-Key` is absent; **`ECP-ORD-4090` when the key is reused with a different body** — a client defect, reported rather than masked
- [ ] Concurrent submission of one key yields one order. L5 concurrency test on the Sprint 14 `EN-DATA-4` rig — this is IH-2 row 1 and it is proved here first

**The failure modes**
- [ ] **`E1` — insufficient stock creates no order and reserves no line.** `ECP-INV-4091`, reporting which lines are short and the quantity available for each; the cart is returned intact
- [ ] `E2` — concurrent placements are admitted only up to available stock. The Sprint 11 race extended end to end through `placeOrder`
- [ ] `E3` — a voucher invalid at placement is removed, the revised total presented, and **re-confirmation required**. The order is never placed at a total the customer has not agreed to
- [ ] **`E5` — a failure between reservation and order creation leaves neither.** `BR-ORD-02`, `NFR-REL-01`. The atomic boundary is what prevents it, and **fault injection at each step is the deliverable** — after reservation, after redemption, after the order insert, after the outbox write. Fully applied or fully absent, never partial
- [ ] `E6` — a declined authorisation moves the order to **Payment Failed with the reservation held** for the retry window (**[A-07]**). `payment` arrives Sprint 21 — build the state and the hold; carry the authorisation call to that named sprint
- [ ] **`E7` — a provider timeout is not a decline.** The order stays in **Pending Payment** with its reservation held, resolved when the provider's result arrives. Treating a timeout as a decline risks cancelling an order that was in fact charged
- [ ] **`E8` — a failure to raise `OrderCreated` leaves the order standing.** The event is retried until delivered, never dropped (`BR-NTF-01`, `NFR-REL-06`, `P6`) — which the Sprint 08 outbox already guarantees, so assert it rather than reimplement it
- [ ] `E9` — a failed confirmation notification leaves the order standing; `E10` — a cart that cannot be emptied leaves the order standing. A stale cart is cosmetic; an unplaced order is not
- [ ] `US-ORD-04`'s re-confirmation token is checked: a placement whose summary was never re-confirmed is refused

### `EN-EVENT-5` Order lifecycle events on the outbox; ordering topic partitioning (5 pts)
- [ ] Every order lifecycle event published through the Sprint 08 outbox, registered in its topic catalogue
- [ ] **Partitioned by order id**, so per-order event ordering holds — the property `notification` (Sprint 23), `reporting` (Sprints 26–27) and the payment read model all depend on
- [ ] Correlation id carried from the originating request through the envelope (`NFR-OBS-03`)
- [ ] Consumer idempotency and ordering guards reuse `EN-EVENT-2`'s, not a third implementation

---

## Frontend Lane

> All three stories are built against the Prism mock. The backend delivers them in **Sprint 19**.

### `US-ORD-10` Advance Order Status (5 pts) — `/admin/orders`, `/admin/orders/[orderId]`, **R4**
- [ ] Writes `advanceOrderStatus`, `advanceOrderStatusesInBulk`, `setOrderInvestigationFlag`; reads `listOrders`, `getOrder`, `listOrderLines`
- [ ] Built on the Sprint 12 `EN-FE-DS-6` discriminated union — **permitted transitions are exhaustive at compile time, and an unhandled state is a build failure, not a blank action bar**
- [ ] **`E1` — an illegal transition is declined for every role including `ADMINISTRATOR`**, showing the current state and the transitions available from it. `ECP-ORD-4091`. The state machine is a property of the platform, not a convention of one interface (`BR-ORD-01`, `P5`) — the UI must not offer a transition it believes an admin can force
- [ ] `E2` — authority is per transition: approving a refund and packing a box are different authorities (`P16`). Drawn controls follow the matrix; the server decides
- [ ] `E5` — a concurrent transition means the screen's state may be stale; a declined action re-reads and re-renders rather than insisting
- [ ] Bulk advance reports per-order outcomes — a bulk action that reports one aggregate result hides the `E1` failures inside it
- [ ] Vitest + axe, including a test asserting an unhandled status fails `npm run typecheck`

### `US-ORD-07` Track Order (3 pts) — `/account/orders/[orderId]/tracking`, **R3**
- [ ] Reads `trackOrder`
- [ ] **`E1` — when carrier updates are unavailable, the last recorded state is shown with when it was received. A stale state is never presented as current** (`NFR-AVAIL-02`)
- [ ] `E2` — an out-of-order carrier event does not move the shipment backwards (`BR-SHP-02`); the display reflects the latest state, not the latest message
- [ ] `E3` — another customer's order is `404`, and the screen does not explain why
- [ ] Vitest + axe, including the empty-history and stale-update states

### `US-ORD-08` Cancel Order (2 pts) — `/account/orders/[orderId]`, **R3**
- [ ] Writes `cancelOrder`
- [ ] **`E1` — an order already Packed or beyond is declined and the customer directed to a return** (`BR-ORD-04`). `US-ORD-09` is Sprint 31, so this sprint points at Support; record the forward link
- [ ] `E2` — an already-cancelled order reports success without acting again
- [ ] `E4` — an order cancelled but not refunded shows as **visibly awaiting refund**. The discrepancy is never closed by displaying it as refunded (`BR-PAY-02`, `P7`)
- [ ] `E5` — a cancellation that loses a race to a state advance declines as `E1`, and the screen re-reads rather than retrying
- [ ] Vitest + axe

---

## Integration Risk

**Nothing this sprint meets a gate, and that is intentional** — the partnership transaction is the last thing that should be rushed to meet one. The exposure is that `placeOrder` is exercised only by its own tests until `G9` at Sprint 19, then again, properly, at IH-2.

The concrete risk inside the sprint: **fault injection is easy to write shallowly.** Injecting a failure that the transaction was always going to roll back proves nothing. The four injection points must each be placed *after* the preceding step has genuinely applied, and each test must assert the absence of the order **and** the return of the stock — not just that an exception was thrown.

Second: `E6` and `E7` describe payment outcomes with no `payment` module behind them. The order states and the reservation hold are real this sprint; what drives them is not. Write down which half is built.

## Definition of Done

Every item satisfies its lane's list in [`../definition-of-done.md`](../definition-of-done.md) §3 or §4, and every story reaches §5.

Additionally: **`US-ORD-05` is done when the fault-injection suite passes at all four injection points**, not when placement works. A green happy path is not evidence about `NFR-REL-01`.

## Review Notes

<!-- filled at Sprint Review -->

## Retrospective

**Went well:**
**Change one thing:**
**Action (owned, carried to next sprint's board):**

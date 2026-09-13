# IH-2 — Integration Hardening: The Money Path

**Release:** R1 · **Position:** after Sprint 20, before Sprint 21 · **No new stories · no story points**
**Related documents:** [`../release-plan.md`](../release-plan.md) · [`../integration-plan.md`](../integration-plan.md) §4 · [`./ih-1-session-and-catalog.md`](./ih-1-session-and-catalog.md)

---

## Goal

> **The money path — the sprint that decides whether `P6`, `P7` and `P8` are solved.**

That sentence is from [`../release-plan.md`](../release-plan.md) §4 and it is not rhetoric. Three of the platform's named risks converge here and nowhere else:

| | |
|---|---|
| **`P6`** | An accepted business event is silently lost, and the business operates on an incomplete picture without knowing it |
| **`P7`** | A transaction partially completes — a duplicate order, an unreleasable reservation, a capture with no record, an order marked refunded that was not |
| **`P8`** | Overselling under peak load, then cancelling confirmed orders afterwards — damaging the brand precisely during the event meant to build it |

IH-1 hardened session custody because it is hardest to retrofit. **IH-2 hardens the money path because it is the one whose failures cost money and cannot be apologised away.** Every row below is a property that no single sprint owns: Sprint 18 built placement, Sprint 19 the lifecycle, Sprint 20 shipment — and the guarantees run across all three.

Both developers, both lanes, full sprint. **No new stories, no points.** An IH sprint that takes on delivery work is an IH sprint that reports green because it ran out of time to look.

**One row is about a module that does not exist yet.** `payment` arrives in Sprint 21, so row 8's provider-callback verification and row 9's payment read model are examined against what Sprint 20 built — the carrier authenticity path and the outbox retention — and the payment-specific half is carried to IH-3. Say so in the row rather than passing it on a substitute.

---

## The Nine Rows

Each row is from [`../release-plan.md`](../release-plan.md) §4's IH-2 block. The tasks under each say *how* it is demonstrated — a row is passed by a demonstration, never by a code reading.

### 1 — Concurrent submission of one `Idempotency-Key` yields one order
*Source: `NFR-REL-02` · [`Integration Contract.md`](../../SA-docs/04-shared/Integration%20Contract.md) §2.2*
- [ ] Fire N concurrent `placeOrder` requests carrying **the same key and the same body**. Exactly one order exists afterwards; every response names that same order
- [ ] Repeat with the same key and a **different** body: `ECP-ORD-4090`, reported as the client defect it is — never masked by minting a new key
- [ ] Repeat with **no** key: `ECP-ORD-4001`
- [ ] Drive it from the browser, not only from the test suite: double-click the place-order button, and confirm the frontend reused one key rather than minting two ([`Routing.md`](../../SA-docs/03-frontend/Routing.md) §4.3 rule 2)
- [ ] Confirm one order **and** one reservation **and** one voucher redemption — `BR-ORD-03` binds all three, not just the order row

### 2 — N threads racing one SKU: successes equal stock, every loser sees a clean rejection
*Source: `NFR-REL-03` · [`ADR-0011`](../../SA-docs/01-system/ADR/ADR-0011-optimistic-locking-reservation-model.md)*
- [ ] The Sprint 11 race, now driven **end to end through `placeOrder`** rather than through `StockReservationPort` directly. M units available, N placements: exactly M orders exist, and **the total reserved never exceeds M** (`BR-INV-01`, `NFR-SCAL-06`)
- [ ] Every loser receives `ECP-INV-4091` — a clean rejection naming which lines are short and the quantity available for each. **No loser receives a `500`, a timeout, or a confirmed order**
- [ ] Repeat with a multi-line order under contention: `UC-INV-01` `E3`'s cleanup holds, and no half-reserved order survives
- [ ] Repeat with a promotion at its last available use in the same placement — `UC-PRM-02` `E7` and `BR-INV-01` hold **simultaneously**, which is the combination Sprint 18's partnership transaction exists for
- [ ] Run at a thread count high enough to have failed before the locking was right. A race that has never gone red proves nothing

### 3 — Fault injected after reservation, after redemption, after order insert, after outbox write — fully applied or fully absent, never partial
*Source: `NFR-REL-01`*
- [ ] Four injection points, each placed **after the preceding step has genuinely applied**. Injecting where rollback was always going to happen proves nothing
- [ ] After reservation → no order, and **the stock is back**. Assert the available quantity, not merely the exception
- [ ] After redemption → no order, and **the voucher's usage allowance is back**
- [ ] After the order insert → no order, no reservation, no redemption (`UC-ORD-05` `E5`, `BR-ORD-02`)
- [ ] After the outbox write → the order stands **and the event is eventually delivered** (`UC-ORD-05` `E8`). This one is the opposite of the other three, deliberately: a paid order that no downstream process hears about is `P6`
- [ ] Repeat each injection under concurrency, not only single-threaded

### 4 — `ECP-INV-4091` renders as "sold out", visibly different from "try again"
*Source: [`Error Codes.md`](../../SA-docs/04-shared/Error%20Codes.md) · [`Routing.md`](../../SA-docs/03-frontend/Routing.md) §4.3*
- [ ] Drive a real shortfall through the browser and **look at the screen**. It says sold out. It does not say try again, and it is not the generic error boundary
- [ ] Put the two screens side by side — "sold out" and "try again" must be **visibly different outcomes to a customer**, not two strings in one layout
- [ ] Confirm the `(admin)` rendering of the same code on `adjustStock` is the adjustment-declined screen, not the storefront copy. **One code, two designed screens, routed by context**
- [ ] Confirm `ECP-PRM-4090` fails the voucher field and not the checkout, the same distinction one domain over

### 5 — A timeout is never retried automatically; the customer is told the outcome is unknown and offered one explicit retry
*Source: [`ADR-0023`](../../SA-docs/01-system/ADR/ADR-0023-server-first-data-fetching.md) §4*
- [ ] Make `placeOrder` time out. **No automatic retry fires** — assert on the server's request log, not on the UI
- [ ] The screen states the outcome is **unknown**, not that it failed. "Failed" is a claim the platform cannot make here
- [ ] Exactly one explicit retry is offered, and taking it **reuses the original `Idempotency-Key`**
- [ ] Confirm the backend's half: `UC-ORD-05` `E7` — a provider timeout leaves the order in **Pending Payment with its reservation held**, not cancelled. A timeout is not a decline
- [ ] Confirm the same discipline on `initiatePayment` once `payment` exists; until Sprint 21, record it as carried

### 6 — Nothing in the checkout funnel is cached and nothing is optimistic
*Source: `NFR-PERF-06`*
- [ ] Walk every funnel route — `/checkout`, `/checkout/shipping`, `/checkout/payment`, `/checkout/review`, `/checkout/payment/processing`, `/checkout/confirmation/[orderId]` — and inspect the response headers and the build output. **None is cached, none is static**
- [ ] Confirm no client cache holds funnel state across a navigation: change the cart in a second tab and confirm the funnel reflects it
- [ ] Confirm **nothing is optimistic** here, unlike `/cart` where it is required. A placement can be rejected after the customer has committed ([`ADR-0011`](../../SA-docs/01-system/ADR/ADR-0011-optimistic-locking-reservation-model.md)), so an optimistic funnel lies
- [ ] The contrast is the check: `/cart` optimistic and reverting visibly, `/checkout/*` never optimistic. Both are correct and they must not converge

### 7 — Another customer's order returns `404`, and the screen never explains why
*Source: [`Integration Contract.md`](../../SA-docs/04-shared/Integration%20Contract.md) §2.1 · [`Routing.md`](../../SA-docs/03-frontend/Routing.md) §6*
- [ ] Two real accounts, two real orders. Each fetches the other's `getOrder`, `listOrderLines`, `trackOrder`, `cancelOrder`, `getShipment`, `listShipmentTrackingEvents`. **Every one is `404`, never `403`**
- [ ] The rendered screen does not distinguish "not yours" from "does not exist" — no wording, no status code, no timing difference
- [ ] Confirm the attempt **is** recorded server-side (`P16`). Non-disclosure to the caller is not non-recording
- [ ] Repeat for a `STAFF` account against a customer order, where the matrix does not grant it

### 8 — Provider callback signature verified; a forged callback changes nothing
*Source: [`Security.md`](../../SA-docs/01-system/Security.md)*
- [ ] **`payment` arrives in Sprint 21.** What exists to examine now is `receiveCarrierEvent` (`UC-SHP-04` `E4`) — verify first, then act; a forged carrier update changes nothing and is recorded as a security event
- [ ] Forge a carrier update marking an undelivered order delivered. **Nothing changes.** For Cash On Delivery this would move money, which is why the row generalises
- [ ] Confirm the rejection is **visible** — a silently-dropped forgery looks exactly like one that never arrived
- [ ] Confirm `/api/internal/revalidate`'s signature check (IH-1 row 6) has not regressed
- [ ] **Record explicitly as carried to IH-3:** the payment provider callback itself, including that it terminates at `nginx` and never passes through `ecp-web`. Do not pass this row on the carrier substitute alone

### 9 — Retained-outbox replay reconstructs the payment read model
*Source: [`Backend Architecture.md`](../../SA-docs/02-backend/Backend%20Architecture.md) §3.4.5*
- [ ] §3.4.5 makes the retained outbox rows **the permanent event history**. Confirm the retention policy in force actually retains them — and that the pruning obligation [`ADR-0012`](../../SA-docs/01-system/ADR/ADR-0012-transactional-outbox-and-kafka.md) §5 states has been reconciled with it, not applied in ignorance of it
- [ ] Drop a downstream read model and **rebuild it from the outbox alone**, using the Sprint 14 `EN-EVENT-4` replay path. It converges, and idempotency means the replay duplicates nothing
- [ ] Do it on the **search projection and the order read model**, which exist today; `payment`'s read model is Sprint 21–22 and is **carried to IH-3**
- [ ] Confirm a partial index on unpublished rows exists, so the outbox does not become a `P10` problem of its own
- [ ] Measure how long the rebuild takes. An unmeasured recovery path is one nobody will choose under pressure

---

## Known Gaps Carried In

Recorded at Sprint 20 Review and revisited here rather than rediscovered:

- [ ] **Real states with absent drivers.** `US-ORD-08` `E4` (Cancelled-but-not-Refunded) and `US-SHP-06` `E4` (Delivered-but-not-Paid) both exist as states with no `payment` module to resolve them until Sprint 22. Confirm the states are reachable and correctly displayed; the settlement is not in scope
- [ ] **`US-SHP-03` `E5`** escalates to an operational alert channel that does not exist until Sprint 23's notification work. Confirm the escalation is recorded somewhere durable in the meantime
- [ ] **`US-ORD-09` (Request Return) is Sprint 31.** `UC-ORD-08` `E1` directs a customer to a return path that is not built; confirm the decline is correct and the direction is honest about that
- [ ] **`EN-CONTRACT-1` findings** from Sprint 16 that were logged rather than fixed — confirm each still has a named sprint

---

## Exit Criterion

> Every row above passes, **or** the failure is a logged, sized backlog item with a named sprint.

**A row is never marked passed on a local workaround.** A finding resolved by changing an environment variable, disabling a check, lowering a thread count until the race stopped failing, or running the demonstration a second way until it worked is an **open finding**, and it is recorded as one.

Rows 8 and 9 are **partially carried by construction**, not by failure. Record the carried half explicitly against IH-3 rather than marking the row passed on what was available.

## Review Notes

<!-- filled at Sprint Review -->

## Retrospective

**Went well:**
**Change one thing:**
**Action (owned, carried to next sprint's board):**

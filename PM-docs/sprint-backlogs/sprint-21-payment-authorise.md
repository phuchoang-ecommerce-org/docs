# Sprint 21 — Payment: Authorise & Provider Callback

**Release:** R1 · **Gate:** **`G10` — Contract Sync** · **Backend 19 pts · Frontend 23 pts**
**Related documents:** [`../release-plan.md`](../release-plan.md) · [`../integration-plan.md`](../integration-plan.md) · [`../../BA-docs/user-stories/07-payment.md`](../../BA-docs/user-stories/07-payment.md) · [`../../BA-docs/use-cases/07-payment.md`](../../BA-docs/use-cases/07-payment.md)

---

## Sprint Goal

> **Money can be taken.**

Every exception flow in `UC-PAY-02` and `UC-PAY-03` reduces to one discipline: **the platform never guesses what the provider did.** A timeout is not a decline (`E2`). A result that cannot be attributed is recorded as unmatched, never discarded (`E4`, `E2`). A result contradicting one already applied is escalated, never overwritten (`E4`) — deciding automatically which of two contradictory financial statements is true is precisely what human reconciliation is for.

Two structural facts shape the sprint. The **provider callback terminates at `nginx` and never passes through `ecp-web`** — it is a server-to-server path, not a browser one, and IH-2 row 8 deferred its verification to IH-3. And `/checkout/payment/processing` **polls**; the provider return is a route handler, not a page ([`Routing.md`](../../SA-docs/03-frontend/Routing.md) §4.3 rule 6).

The lane balance inverts this sprint — 23 frontend points against 19 backend, the first time the frontend carries more. It spends the surplus on `review` and `notification` screens whose backends are three sprints out.

## Committed Items

| Lane | ID | Item | Pts |
|---|---|---|---:|
| BE | `US-PAY-01` | Select Payment Method | 3 |
| BE | `US-PAY-02` | Authorise Online Payment | 8 |
| BE | `US-PAY-03` | Handle Payment Gateway Result | 8 |
| | | **Backend total** | **19** |
| FE | `US-PAY-02` | Authorise Online Payment | 5 |
| FE | `US-PAY-03` | Handle Payment Gateway Result | 3 |
| FE | `US-REV-01` | Submit Product Review | 5 |
| FE | `US-REV-04` | View Product Reviews | 5 |
| FE | `US-NTF-03` | View In-App Notifications | 5 |
| | | **Frontend total** | **23** |

---

## Backend Lane

### `US-PAY-01` Select Payment Method (3 pts) — `listEligiblePaymentMethods`, `selectCheckoutPaymentMethod`
- [ ] Replaces the mock the frontend has used since Sprint 20. **Confirm the contract shape did not move**; a change is a drift entry and an `openapi.yaml` amendment
- [ ] **`E1` — Cash On Delivery outside its configured conditions is not offered**, and the reason is stated if asked (`BR-PAY-03`). Offering it and declining later wastes the customer's time at the worst moment
- [ ] `E2` — where no method is eligible, the platform says so and directs to Support. **It never places an unpayable order**
- [ ] `E3` — a method unavailable by the time of the summary requires a new selection (`UC-ORD-04`)

### `US-PAY-02` Authorise Online Payment (8 pts) — `initiatePayment`, `getOrderPayment`
- [ ] Provider **anti-corruption layer**: the provider's vocabulary stops at the adapter and `payment.domain` never sees it
- [ ] **Card details are never logged** (`NFR-SEC-07`) — assert it, including in error paths and in the correlation-id trace
- [ ] `E1` — a decline moves the order to **Payment Failed with the reservation held** for the retry window (**[A-07]**), the reason surfaced only as far as the provider permits, and a retry offered
- [ ] **`E2` — no answer, or an answer after the timeout, is not a failure.** The order stays in **Pending Payment** with its reservation held and the attempt marked **unresolved**, settled when the provider's result arrives or on reconciliation. Treating a timeout as a decline is how a customer is charged for an order the platform then cancels — the partial failure `P7` names
- [ ] `E3` — an unreachable provider makes no attempt; the order stays Pending Payment. **Platform state is not corrupted by a provider outage** (`NFR-AVAIL-03`)
- [ ] **`E4` — a provider success for an attempt the platform has no record of is recorded as an unmatched payment and escalated. Never discarded** — an unrecorded capture is money taken from a customer that the business cannot see (`P7`)
- [ ] `E5` — a duplicate authorisation for one attempt applies the result once (`BR-PAY-01`). **The customer is charged once.** `ECP-PAY-4090` when an attempt is already in flight
- [ ] `E6` — an amount differing from the order total records the discrepancy and **does not transition to Paid**; escalated rather than accepted
- [ ] `Idempotency-Key` required on `initiatePayment` — `ECP-ORD-4001`/`4090` apply here as they do to `placeOrder`

### `US-PAY-03` Handle Payment Gateway Result (8 pts) — `receivePaymentProviderNotification`
- [ ] **`E3` — verify authenticity first, before anything else.** An unverified result is an instruction to move money from an unknown party; rejected and recorded as a security event
- [ ] The endpoint **terminates at `nginx` and never passes through `ecp-web`** — confirm the routing, and that no browser-reachable path exposes it
- [ ] **`E1` — duplicate delivery is applied once and the duplicates acknowledged.** Providers retry until acknowledged, so duplicates are routine; applying a success twice would move an order twice or refund twice (`BR-PAY-01`, `NFR-REL-04`)
- [ ] `E2` — an unattributable result is recorded as **unmatched and escalated**, never discarded (`UC-PAY-02` `E4`)
- [ ] **`E4` — a result contradicting one already applied is not overwritten.** The conflict is recorded and escalated
- [ ] `E5` — a result for an order that was cancelled in flight is **recorded and escalated**: a capture against a cancelled order is money to be refunded (`UC-PAY-06`, Sprint 22), not a result to drop
- [ ] **`E6` — a failed application acknowledges nothing.** Retained and retried; never acknowledged as processed when it was not (`P6`)
- [ ] Payment events onto the Sprint 08 outbox, partitioned per the `EN-EVENT-5` scheme — this is the read model IH-3 will replay

---

## Frontend Lane

### `US-PAY-02` Authorise Online Payment (5 pts) — `/checkout/payment/processing`, **R3**
- [ ] **The screen polls `getOrderPayment`** — case 3 of [`Data Fetching.md`](../../SA-docs/03-frontend/Data%20Fetching.md) §5 — until the payment resolves. It is never cached and never optimistic
- [ ] Three terminal outcomes rendered distinctly: authorised · declined (`E1`, with retry offered) · **unresolved** (`E2`). **"Unresolved" is a designed state, not a spinner that never stops** — the customer is told the outcome is not yet known
- [ ] `E3` — an unreachable provider says to retry shortly, distinct from a decline
- [ ] **A timeout is never retried automatically**; one explicit retry, reusing the original `Idempotency-Key` ([`ADR-0023`](../../SA-docs/01-system/ADR/ADR-0023-server-first-data-fetching.md) §4)
- [ ] No card detail is ever placed in a URL, a log, or an error message
- [ ] Hand-written Zod parsers for the payment payload; Vitest + axe across all four states

### `US-PAY-03` Handle Payment Gateway Result (3 pts) — the provider return handler
- [ ] **The provider return is a route handler, not a page** ([`Routing.md`](../../SA-docs/03-frontend/Routing.md) §4.3 rule 6). It verifies, then redirects to `/checkout/payment/processing`, which polls
- [ ] A return that fails verification redirects to the designed failure screen and **changes nothing**
- [ ] The handler is idempotent — a customer refreshing the return URL must not produce a second outcome
- [ ] Vitest over verify-and-redirect, forged-return, and repeated-return

### `US-REV-01` Submit Product Review (5 pts) — `/p/[productId]`, `/account/orders/[orderId]`, **mock-only**
- [ ] Writes `submitProductReview`, `addReviewImage`. `review` arrives **Sprint 24**
- [ ] **`E1` — a non-verified-buyer is declined, and `ECP-REV-4030`'s copy tells the caller to retry shortly rather than that they never bought the product** — the verified-purchase read model is eventually consistent ([`Error Codes.md`](../../SA-docs/04-shared/Error%20Codes.md)). Getting this wording wrong accuses a real buyer of lying
- [ ] `E2` — an undelivered order says review becomes available after delivery; `E3` — an existing review offers amendment instead (`US-REV-02` is Sprint 32 — link honestly)
- [ ] **`E5` — a rejected image offers submitting the review without it** rather than losing the whole submission (`BR-REV-04`)
- [ ] `E6` — an unverified account offers a verification resend
- [ ] Vitest + axe

### `US-REV-04` View Product Reviews (5 pts) — `/p/[productId]`, **mock-only**
- [ ] Reads `listProductReviews`, `getProductRatingSummary`; writes `reportReview`
- [ ] **Renders into the advisory reviews boundary Sprint 07 built** — `E1`, reviews unavailable, is a **section empty state and never a page error** (`NFR-AVAIL-02`). Do not add a second boundary beside the existing one
- [ ] `E2` — a stale aggregate is acceptable and stated; no purchasing decision depends on it
- [ ] Cursor pagination through the Sprint 05 control
- [ ] Vitest + axe, including a test that a failing reviews fetch leaves the rest of the product page intact

### `US-NTF-03` View In-App Notifications (5 pts) — `/account/notifications`, **R3, mock-only**
- [ ] Reads `listOwnNotifications`; writes `setNotificationReadState`, `dismissNotification`, `markNotificationsRead`. `notification` arrives **Sprint 23**
- [ ] `E1` — no notifications renders an explicit empty list, never an error
- [ ] **`E3` — a failed read-state change still presents the notification content.** The customer's goal is met; the state change retries. A read-state failure never withholds the message
- [ ] `E4` — a notification referencing a deleted order or product presents **its recorded text**, and following it reports the target is no longer available (`FR-DAT-04`)
- [ ] The header bell shares one unread count with this screen — one source, not two
- [ ] Vitest + axe

---

## Integration Risk

**`G10` verifies the customer-facing half of payment and cannot verify the provider half.** The callback terminates at `nginx` from a real provider; the gate exercises `initiatePayment` and `getOrderPayment` and a simulated notification. **IH-2 row 8 already carried the real callback verification to IH-3** — `G10` must not be read as having closed it.

Second, and larger: **the unresolved-payment state is the hardest thing on the screen to test and the most expensive to get wrong.** `E2` produces an order that is neither paid nor failed, holding stock, waiting on a provider. Both lanes must exercise it deliberately — the backend by timing the provider out, the frontend by polling a payment that never resolves — because nothing in the happy path will produce it.

Third: three of the five frontend stories are mock-only for three more sprints (`review` Sprint 24, `notification` Sprint 23). That is the contract-first dividend, but `ECP-REV-4030`'s eventual-consistency wording is the kind of detail Prism cannot validate.

## Gate `G10` — Contract Sync

Checklist: [`../integration-plan.md`](../integration-plan.md) §3.1, scoped to payment, plus the shipping increment of Sprint 20.

| # | Check |
|---|---|
| 1 | Types regenerated, diff empty |
| 2 | Contract test **spec→code** across `listEligiblePaymentMethods`, `selectCheckoutPaymentMethod`, `initiatePayment`, `getOrderPayment`, `receivePaymentProviderNotification`, `getShippingQuotes`, `createShipment`, `listShipments`, `getShipment`, `listShipmentTrackingEvents`, `confirmShipmentDelivery`, `receiveCarrierEvent` |
| 3 | Contract test **code→spec** — no undocumented payment or shipping endpoint (manual until Sprint 25) |
| 4 | `/checkout/payment`, `/checkout/payment/processing`, the provider return handler, `/admin/shipments`, `/admin/shipments/[shipmentId]` render against the real API |
| 5 | Pagination envelope and cursor shape match on `listShipments` and `listShipmentTrackingEvents` |
| 6 | **Designed screens:** declined · **unresolved, as its own state and not an endless spinner** · provider unreachable · `ECP-PAY-4090` attempt already in flight · carrier rejection leaving the order visibly in Packed · Delivered-but-not-Paid |
| 7 | Permission matrix: `receivePaymentProviderNotification` and `receiveCarrierEvent` are system-actor paths unreachable by `CUSTOMER` or `STAFF`; another customer's `getOrderPayment` is `404` |
| 8 | **`Money` on the authorised amount is a string, and the amount authorised is compared to the order total on exact values** — `UC-PAY-02` `E6` is only detectable if nothing rounds on the way |
| 9 | One correlation id across browser → API → outbox → Kafka on an authorisation, **and no card detail anywhere in that trace** |
| 10 | Drift logged **and** `openapi.yaml` amended in the same session |
| — | **Recorded as expected, not drift:** `review` and `notification` screens are mock-served until Sprints 24 and 23. **Carried to IH-3, not closed here:** real provider callback signature verification (IH-2 row 8), payment read-model replay (IH-2 row 9) |

## Definition of Done

Every item satisfies its lane's list in [`../definition-of-done.md`](../definition-of-done.md) §3 or §4, and every story reaches §5.

Additionally: **the unresolved-payment path is exercised end to end**, both lanes, before the sprint is called done. It is the state `P7` is about.

## Review Notes

<!-- filled at Sprint Review -->

## Retrospective

**Went well:**
**Change one thing:**
**Action (owned, carried to next sprint's board):**

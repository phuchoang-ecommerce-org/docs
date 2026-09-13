# Sprint 22 — Payment: Settle, Retry & Refund

**Release:** R1 · **Gate:** none · **Backend 20 pts · Frontend 21 pts**
**Related documents:** [`../release-plan.md`](../release-plan.md) · [`../integration-plan.md`](../integration-plan.md) · [`../../BA-docs/user-stories/07-payment.md`](../../BA-docs/user-stories/07-payment.md) · [`../../BA-docs/user-stories/12-administration.md`](../../BA-docs/user-stories/12-administration.md)

---

## Sprint Goal

> **Money can be settled, retried, and given back.**

This sprint closes the states earlier sprints created but could not resolve: Sprint 19's Cancelled-but-not-Refunded, Sprint 20's Delivered-but-not-Paid, Sprint 21's Payment Failed with the reservation held. Each was built deliberately as a visible discrepancy rather than a hidden one, and each gets its resolution here.

**`US-PAY-06` is where the audit rule inverts.** `UC-PAY-06` `E7` is the canonical `UC-AUD-01` `E2` case: a refund whose audit entry cannot be written **stands**, because the customer's money has already moved and reversing it would be worse — and the missing entry is escalated immediately as a compliance exception. Sprint 12 built that branch specifically for this story. Select it; do not write a second one.

`/admin/payments` is `listUnmatchedPayments` — **the one admin list that should be empty in normal operation**, and its empty state says so.

## Committed Items

| Lane | ID | Item | Pts |
|---|---|---|---:|
| BE | `US-PAY-04` | Settle Cash On Delivery Payment | 5 |
| BE | `US-PAY-05` | Retry Failed Payment | 5 |
| BE | `US-PAY-06` | Process Refund | 5 |
| BE | `EN-OBS-3` | Correlation id traced REST → outbox → Kafka → projection | 5 |
| | | **Backend total** | **20** |
| FE | `US-PAY-04` | Settle Cash On Delivery Payment | 2 |
| FE | `US-PAY-05` | Retry Failed Payment | 3 |
| FE | `US-PAY-06` | Process Refund | 3 |
| FE | `US-ADM-03` | Manage Customer Accounts | 5 |
| FE | `US-ADM-04` | Manage Orders | 5 |
| FE | `US-ADM-06` | Manage User Roles | 3 |
| | | **Frontend total** | **21** |

---

## Backend Lane

### `US-PAY-06` Process Refund (5 pts) — `refundPayment`, `listPaymentRefunds`, `listPaymentAttempts`, `listUnmatchedPayments`
- [ ] **`E1` — a refund exceeding the captured amount is declined**, stating the maximum refundable. `ECP-PAY-4220`, enforced **on exact `NUMERIC` values** per [`Error Codes.md`](../../SA-docs/04-shared/Error%20Codes.md) — a rounding step here is an unbounded loss (`BR-PAY-02`, `P7`)
- [ ] `E2` — authority declined **and recorded**. Refund approval is one of the highest-value authorities in the platform and a standing fraud risk (`P16`, `P17`)
- [ ] **`E3` — a provider rejection leaves the refund recorded as failed and the order not Refunded**, escalated for manual settlement. **The obligation to the customer does not disappear because the provider declined**
- [ ] `E4` — an unreachable provider leaves the refund **pending** and retries. Because the obligation is recorded before the request is sent, it is visible even if the request never reaches the provider (`P7`)
- [ ] `E5` — a duplicate refund request issues once (`BR-PAY-01`). **Refunding twice is a direct loss with no counterparty to recover from**
- [ ] `E6` — no reason supplied is declined (`BR-AUD-01`, `P17`)
- [ ] **`E7` — a failed audit write lets the refund stand**, and the missing entry is escalated as a compliance exception. The `UC-AUD-01` `E2` branch from Sprint 12, selected — **this is deliberately the opposite of `UC-INV-04` `E4`**, and the difference is that money has already moved
- [ ] Resolves Sprint 19's `US-ORD-08` `E4`: an order awaiting refund can now reach Refunded
- [ ] `listUnmatchedPayments` is the reconciliation queue fed by Sprint 21's `E2`/`E4` paths

### `US-PAY-04` Settle Cash On Delivery Payment (5 pts) — `settleCashOnDelivery`
- [ ] `E1` — a refused delivery collects nothing: the goods return, the order is cancelled, its reservation released and the goods restocked. **The refusal reason is recorded — repeated refusals are a fraud signal**
- [ ] **`E2` — a collected amount differing from the order total records what was actually collected and does not transition to Paid.** Marking an order paid for an amount not collected misstates revenue (`P7`)
- [ ] **`E3` — delivery confirmed but collection never recorded leaves the order in Pending Payment, on an outstanding-collection report. It is never assumed paid because it was delivered** — resolving Sprint 20's `US-SHP-06` `E4`
- [ ] `E4` — authority declined **and recorded**. Recording cash receipt is a financial control (`P16`)

### `US-PAY-05` Retry Failed Payment (5 pts) — `retryPayment`
- [ ] `E1` — a passed retry window declines, explaining the order was cancelled and the stock released. The cart contents are offered again **subject to current availability** — the platform cannot restore a claim on stock it has returned to sale
- [ ] **`E2` — a reservation no longer held re-checks availability and re-reserves** (`UC-INV-01`); if stock is gone it declines as `E1`. It never promises goods it does not have (`BR-INV-01`)
- [ ] `E3` — a further decline keeps the order in **Payment Failed with the reservation held and the window running**. Retries are permitted but **rate-limited** — repeated attempts against a failing instrument are themselves a fraud signal
- [ ] `E4` — an order cancelled in another session reports the current state and declines (`BR-ORD-01`)
- [ ] **`E5` — the order total is not recalculated.** It was fixed at placement (`BR-ORD-06`) and the customer pays what they agreed to, whatever prices or promotions did in the meantime

### `EN-OBS-3` Correlation id traced REST → outbox → Kafka → projection (5 pts)
- [ ] The trace IH-1 row 8 demonstrated by hand, now **continuous and asserted** across every hop: edge → API log → outbox row → Kafka envelope → consumer → projection
- [ ] The id **originates at the edge and is propagated, never regenerated** at a hop — a fresh id per hop is indistinguishable from no id at all when it matters
- [ ] A test fails the build if a hop drops it, so the property does not decay between here and IH-3
- [ ] **No card detail, token, or personal identifier rides along in the trace** (`NFR-SEC-07`)
- [ ] Covers the payment path specifically — the one IH-3 will need when reconciling a capture against an order

---

## Frontend Lane

> `US-ADM-03`, `US-ADM-04` and `US-ADM-06` are built against the mock. The backend delivers them in **Sprint 25**.

### `US-PAY-06` Process Refund (3 pts) — `/admin/payments`, `/admin/payments/[paymentId]`, **R4**
- [ ] Reads `listUnmatchedPayments`, `getPayment`, `listPaymentAttempts`, `listPaymentRefunds`; writes `refundPayment`
- [ ] **`/admin/payments` is the one admin list that should be empty in normal operation, and its empty state says so** — [`UI Design System.md`](../../SA-docs/03-frontend/UI%20Design%20System.md) §13's "the design at rest", not "no data"
- [ ] `E1` — `ECP-PAY-4220` renders the maximum refundable; `E6` — reason is required by the form and the server remains the authority
- [ ] **`E3`/`E4` — a failed or pending refund shows the obligation as still outstanding.** Never as settled
- [ ] Vitest + axe

### `US-PAY-05` Retry Failed Payment (3 pts) — `/checkout/payment/processing`, **R3**
- [ ] `retryPayment` from the processing screen, reusing the Sprint 21 poll
- [ ] `E1` — a passed window explains the cancellation and offers the cart again, **stating that availability may have changed**
- [ ] `E3` — a rate-limited retry reuses the Sprint 04 `429` screen rather than inventing one
- [ ] **`E5` — the screen never recalculates the total.** Whatever it shows is what the server fixed at placement
- [ ] Vitest + axe

### `US-PAY-04` Settle Cash On Delivery Payment (2 pts) — `/admin/payments/[paymentId]`, **R4**
- [ ] `settleCashOnDelivery` as an operator action
- [ ] **`E2` — a differing collected amount is recordable, and the screen does not mark the order Paid.** The discrepancy is shown as a discrepancy
- [ ] `E3` — the outstanding-collection view is reachable from here
- [ ] Vitest + axe

### `US-ADM-03` Manage Customer Accounts (5 pts) — `/admin/customers`, **R4, mock-only**
- [ ] Reads `searchAccounts`, `getAccount`; writes `correctAccountProfile`, `setAccountStatus`, `closeAccount`, `endAccountSessions`
- [ ] **`E2` — credentials are never displayed to any role.** Passwords exist only as one-way hashes and are not retrievable (`NFR-SEC-02`, `NFR-SEC-07`). The screen must not have a field for them
- [ ] `E3` — a suspension without a recorded reason cannot be submitted (`BR-AUD-01`)
- [ ] **`E4` — suspending an account with open orders blocks access but the screen states that open orders continue to be fulfilled.** The platform does not abandon a paid order because an account was suspended (`P7`)
- [ ] Vitest + axe

### `US-ADM-04` Manage Orders (5 pts) — `/admin/orders`, **R4, mock-only**
- [ ] Reads `listOrders` (scoped); writes `advanceOrderStatusesInBulk`. Extends the Sprint 18 order screens rather than duplicating them
- [ ] **`E1` — an illegal transition is declined for every role including `ADMINISTRATOR`**, via the `EN-FE-DS-6` union. `ECP-ORD-4091`
- [ ] **`E3` — amending a placed order's contents or total is not offered at all.** Once Paid, terms are fixed; the remedies are cancellation, return and refund, each leaving a record (`BR-ORD-06`, `P17`)
- [ ] `E4` — an order that changed while being inspected re-evaluates and declines as `E1` if no longer legal
- [ ] Bulk advance reports **per-order** outcomes
- [ ] Vitest + axe

### `US-ADM-06` Manage User Roles (3 pts) — `/admin/roles`, **R4, mock-only**
- [ ] Reads `listRoles`, `listAccountRoles`; writes `grantAccountRole`, `revokeAccountRole`
- [ ] **`E1` — self-elevation is refused and recorded as a security event.** Self-elevation would make every other access control decorative (`BR-AUD-03`, `P16`)
- [ ] **`E2` — revoking the last `ADMINISTRATOR` is refused.** A platform with no Administrator cannot be administered, including to undo this change
- [ ] `E4` — a reason is required. Privilege changes are the first thing an auditor examines (`P17`)
- [ ] The UI may not pre-empt `E1`/`E2` by hiding controls — **the server is the authority and its refusal must be renderable**
- [ ] Vitest + axe

---

## Integration Risk

**No gate closes this sprint, and it carries the plan's highest-consequence write.** `refundPayment` moves money outward, its audit branch is the inverted one, and nothing checks it against the frontend until `G11` at Sprint 23. The `E7` path — audit fails, refund stands, exception escalated — must be exercised deliberately inside the sprint, because it cannot occur by accident.

Second: six frontend stories land in one 21-point lane, three of them against a backend three sprints away. The `(admin)` surface is now large enough that the Sprint 09 rule matters again — **a `CUSTOMER` reaching any of these routes sees the shell and server-side `403`s, never a redirect** (IH-1 row 5, `Security.md` T9). Re-check it here rather than at `G12`.

Third: `EN-OBS-3` asserts a property that has been true by demonstration since IH-1. If it has decayed, this is where that is discovered — and the fix belongs in this sprint, not logged forward.

## Definition of Done

Every item satisfies its lane's list in [`../definition-of-done.md`](../definition-of-done.md) §3 or §4, and every story reaches §5.

Additionally: **`payment` closes here.** Confirm at Review that Sprint 19's Cancelled-but-not-Refunded and Sprint 20's Delivered-but-not-Paid states can now both be resolved end to end, since IH-2 recorded them as real states with absent drivers.

## Review Notes

<!-- filled at Sprint Review -->

## Retrospective

**Went well:**
**Change one thing:**
**Action (owned, carried to next sprint's board):**

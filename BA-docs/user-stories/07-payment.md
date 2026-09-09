# Payment — User Stories (`PAY`)

**Related documents:** [`README.md`](./README.md) (index and template) · [`../use-cases/07-payment.md`](../use-cases/07-payment.md) (source use cases) · [`../srs.md`](../srs.md)

---

## US-PAY-01 — Select Payment Method

**As a** Customer
**I want** to choose how I pay for my order
**So that** I can pay the way I prefer

**Realises:** `UC-PAY-01` · `FR-PAY-01`, `FR-PAY-02`
**Priority:** Must

**Acceptance Criteria**
- Given the order's destination and value, when I reach payment method selection, then only methods eligible for this order are presented, with any fee or delay identified, and my selection is recorded against the order.
- Given I select Cash On Delivery, when I confirm it, then no authorisation is sought at placement and the order stays Pending Payment until delivery.
- Given I select bank transfer, when I confirm it, then I am given transfer instructions and a reference, and the order stays Pending Payment until settlement.
- Given I change my method before placement, when I do so, then the new selection is recorded and eligibility re-evaluated.
- Given Cash On Delivery is not eligible for this order, when methods are presented, then it is not offered, and the reason is stated if asked.
- Given no method is eligible for the order, when I reach this step, then I am told the order cannot be paid for as configured and directed to Support.
- Given my selected method becomes unavailable before placement, when I reach the summary, then I am told and required to select again.

---

## US-PAY-02 — Authorise Online Payment

**As a** Customer
**I want** my chosen online payment method authorised and captured
**So that** my order completes without being charged twice

**Realises:** `UC-PAY-02` · `FR-PAY-03`, `FR-PAY-04`, `FR-PAY-09`
**Priority:** Must

**Acceptance Criteria**
- Given an order in Pending Payment with stock reserved, when authorisation is requested, then a payment attempt is recorded before the provider is contacted, the provider authorises and captures, the outcome is recorded against the attempt, and the order moves to Paid.
- Given the provider requires an additional customer step, when encountered, then I am directed to complete it and the order remains Pending Payment with its reservation held.
- Given authorisation and capture are separate steps, when the provider separates them, then the order moves to Paid only on capture.
- Given a retry of a previously failed attempt, when made, then a new attempt with its own reference is recorded, never conflated with the earlier one.
- Given the provider declines, when it happens, then the order moves to Payment Failed with its reservation held for the retry window, and I am offered a retry.
- Given the provider does not answer or answers after timeout, when it happens, then the order remains Pending Payment with its reservation held rather than being assumed failed.
- Given the provider is unreachable before any attempt is made, when it happens, then no attempt is recorded and the order remains Pending Payment.
- Given the provider reports success for an attempt with no matching record, when it happens, then the capture is recorded as unmatched and escalated for reconciliation, never discarded.
- Given a duplicate authorisation result for the same attempt, when received, then it is applied once and I am charged once.
- Given the authorised amount differs from the order total, when detected, then the discrepancy is recorded and the order does not move to Paid.

---

## US-PAY-03 — Handle Payment Gateway Result

**As** the Payment Gateway
**I want** a delivered result applied to its payment attempt
**So that** the order reflects what actually happened to the payment, exactly once

**Realises:** `UC-PAY-03` · `FR-PAY-04`, `FR-PAY-05`
**Priority:** Must

**Acceptance Criteria**
- Given a result attributable to a recorded attempt, when it is verified and has not already been applied, then it is recorded and the order transitions to Paid or Payment Failed accordingly.
- Given a refund outcome, when received, then it is recorded against the refund and the order moves to Refunded where the refund is complete.
- Given a bank transfer settlement, when received, then the order awaiting transfer resolves to Paid.
- Given a result resolves an attempt previously left unresolved by timeout, when it arrives, then it settles that attempt.
- Given a result delivered more than once, when redelivered, then it is applied once and the duplicates are acknowledged.
- Given a result that cannot be attributed to any attempt, when received, then it is recorded as unmatched and escalated, never discarded.
- Given a result fails authenticity verification, when checked, then it is rejected and recorded as a security event.
- Given a result contradicts one already applied, when received, then it is not overwritten — the conflict is recorded and escalated.
- Given the order is no longer in a state the result can apply to, when received, then the result is recorded and escalated rather than dropped.
- Given applying the result fails, when it happens, then nothing is applied, and the result is retained and retried.

---

## US-PAY-04 — Settle Cash On Delivery Payment

**As a** Warehouse Operator
**I want** to record collection of a Cash On Delivery payment
**So that** the order shows as paid once payment is actually collected

**Realises:** `UC-PAY-04` · `FR-PAY-07`, `FR-PAY-04`
**Priority:** Must

**Acceptance Criteria**
- Given delivery is confirmed and the amount collected matches the order total, when I record it, then the order moves to Paid and an audit entry is written.
- Given the carrier reports collection, when they do, then attribution is to the carrier.
- Given delivery and collection are reported separately, when delivery occurs first, then the order reaches Delivered but stays unpaid until collection is separately recorded.
- Given the customer refuses delivery, when it happens, then no payment is collected, the goods return, the order is cancelled, its reservation released, and the goods restocked.
- Given the collected amount differs from the order total, when recorded, then the discrepancy is escalated and the order does not move to Paid.
- Given delivery is confirmed but collection is never recorded, when this occurs, then the order stays Pending Payment and appears on an outstanding-collection report.
- Given I lack authority to record collection, when I attempt it, then it is declined and recorded.

---

## US-PAY-05 — Retry Failed Payment

**As a** Customer
**I want** to retry payment for an order in Payment Failed
**So that** I can recover an order that failed for a fixable reason

**Realises:** `UC-PAY-05` · `FR-PAY-06`, `FR-INV-03`
**Priority:** Must

**Acceptance Criteria**
- Given an order in Payment Failed within the retry window with its reservation still held, when I retry, then a new payment attempt is recorded and, on success, the order moves to Paid.
- Given I choose a different payment method, when I retry, then eligibility is re-evaluated for the new method.
- Given the retry window elapses without a successful retry, when it does, then the order moves to Cancelled and its reservation is released.
- Given I abandon the order instead of retrying, when I cancel it, then the stock is released immediately rather than waiting for window expiry.
- Given the retry window has passed, when I try to retry, then I am declined and told the order was cancelled and stock released.
- Given the reservation is no longer held when I retry, when this is discovered, then availability is re-checked and re-reserved, or I am declined if stock is no longer available.
- Given the retry also declines, when it does, then the order stays Payment Failed with the reservation held and the window running, subject to rate limiting on further retries.
- Given the order state changed in another session, when I try to retry, then I am told the current state and the retry is declined.
- Given a price or promotion changed during the window, when I retry, then the order total is not recalculated — I pay what I agreed to at placement.

---

## US-PAY-06 — Process Refund

**As a** Customer Support Agent
**I want** to issue a refund against a captured payment
**So that** the customer's money is returned promptly and the decision is attributable

**Realises:** `UC-PAY-06` · `FR-PAY-08`, `FR-AUD-01`
**Priority:** Must

**Acceptance Criteria**
- Given a captured payment and a stated amount and reason within the captured total, when I initiate the refund, then it is recorded before the provider is contacted, requested from the provider, and the order moves to Refunded once the full captured amount is refunded.
- Given only some lines are refunded, when a partial refund is issued, then the order does not become Refunded and the remaining captured amount stands.
- Given the refund is automatic on cancellation, when triggered, then it is attributed to the cancellation and its actor.
- Given a Cash On Delivery order, when refunded, then no provider capture is reversed — the refund is settled by the business's own process.
- Given a refund would exceed the captured amount, when requested, then it is declined with the maximum refundable amount stated.
- Given I lack the authority to approve refunds, when I attempt one, then it is declined and the attempt recorded.
- Given the provider rejects the refund, when it does, then it stays recorded as failed, the order is not marked Refunded, and it is escalated for manual settlement.
- Given the provider is unreachable, when requested, then the refund stays recorded as pending and is retried.
- Given a duplicate refund request, when it arrives, then it is recognised and issued once.
- Given no reason is supplied, when I initiate a refund, then it is declined.
- Given the audit entry cannot be written after the refund has already moved money, when this happens, then the refund stands and the missing entry is escalated immediately as a compliance exception.

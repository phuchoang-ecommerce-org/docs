# Checkout & Order — User Stories (`ORD`)

**Document type:** User Story Specification — domain
**Related documents:** [`README.md`](./README.md) (index and template) · [`../use-cases/06-checkout-order.md`](../use-cases/06-checkout-order.md) (source use cases) · [`../srs.md`](../srs.md)
**Audience:** Product Management, Engineering, Quality Assurance

---

## US-ORD-01 — Initiate Checkout

**As a** Customer
**I want** to start checkout from my cart
**So that** I can buy what is in it

**Realises:** `UC-ORD-01` · `FR-ORD-01`
**Priority:** Must

**Acceptance Criteria**
- Given an authenticated, verified session and a non-empty cart with at least one purchasable line, when I proceed to checkout, then an order is created in state Draft and I continue to shipping and billing capture, with no stock yet reserved.
- Given a checkout is already in progress, when I proceed to checkout again, then the existing Draft order is resumed rather than a second created.
- Given the cart changed since I last viewed it, when I proceed to checkout, then any price or availability change is stated before I continue.
- Given my cart is empty, when I try to check out, then I am declined and returned to the cart.
- Given no line is currently purchasable, when I try to check out, then I am declined with each unpurchasable line identified and offered for removal.
- Given some lines are unpurchasable, when I try to check out, then checkout proceeds only after I explicitly remove or reduce those lines.
- Given my account is unverified, when I try to check out, then I am declined, told verification is required, and offered a resend, with my cart preserved.
- Given I am a guest, when I try to check out, then I am required to log in or register, with my guest cart preserved for merge.

---

## US-ORD-02 — Provide Shipping and Billing Information

**As a** Customer
**I want** to supply shipping and billing details during checkout
**So that** my order is delivered to the right place at a known cost

**Realises:** `UC-ORD-02` · `FR-ORD-02`, `FR-ORD-03`, `FR-ORD-04`, `FR-SHP-02`, `FR-SHP-03`
**Priority:** Must

**Acceptance Criteria**
- Given a selected shipping address and billing information, when I submit them, then the order carries a validated shipping address, billing information, a selected shipping option, and a calculated shipping fee.
- Given I enter a new address, when I select it, then it is validated, stored to my address book, and selected for the order.
- Given billing differs from shipping, when I submit both, then each is captured and validated independently.
- Given more than one shipping option, when I select one, then its fee and estimate are presented and the fee recalculates on selection.
- Given I have no stored address, when I reach this step, then I am taken directly to address entry.
- Given an address fails validation, when I submit it, then I am told which field is wrong and checkout does not proceed.
- Given no carrier serves the destination, when the fee is calculated, then I am told plainly and offered a different address.
- Given the fee cannot be calculated, when attempted, then I am told and permitted to retry — no fee is ever guessed.
- Given the address changes after the fee was calculated, when it happens, then the fee and estimate are recalculated before the summary is shown.
- Given some lines cannot ship to the destination, when calculated, then they are identified and I must remove them or change the address.

---

## US-ORD-03 — Apply Voucher at Checkout

**As a** Customer
**I want** to apply a voucher code to my order
**So that** I receive the advertised saving

**Realises:** `UC-ORD-03` · `FR-ORD-05`, `FR-PRM-08`, `FR-PRM-09`
**Priority:** Must

**Acceptance Criteria**
- Given a valid voucher code, when I apply it, then the discount is calculated, capped so the total cannot go negative, recorded against the order, and the updated total shown with the discount itemised.
- Given an applied voucher, when I remove it, then the discount is reversed and the total restored.
- Given I replace an applied voucher, when I submit a new code, then the new code is validated first and only replaces the existing one if valid.
- Given more than one promotion is eligible, when discounts are calculated, then the configured stacking policy determines which apply, deterministically.
- Given a free-shipping voucher, when applied, then the discount applies to the shipping fee rather than the goods.
- Given a code that is not recognised, when I apply it, then I am told it is not valid without disclosing why.
- Given a voucher that is expired or not yet active, when I apply it, then I am told it is not currently valid.
- Given an order that does not meet the voucher's conditions, when I apply it, then I am told the unmet condition.
- Given a voucher whose usage limit is reached, when I apply it, then I am told it is no longer available.
- Given a discount that would exceed the order value, when calculated, then it is capped at the discountable value.
- Given a voucher validated here but invalid at placement, when I place the order, then it is re-validated and handled per `US-ORD-05`.

---

## US-ORD-04 — Review Order Summary

**As a** Customer
**I want** to review a complete order summary before confirming
**So that** I know exactly what will be charged before agreeing

**Realises:** `UC-ORD-04` · `FR-ORD-06`, `FR-ORD-07`
**Priority:** Must

**Acceptance Criteria**
- Given complete delivery and payment details, when I reach the summary, then line items, unit and line prices, itemised discounts, shipping fee, total payable, delivery address, delivery estimate, and payment method are presented, with every line re-checked for availability.
- Given I amend the order from the summary, when I change quantity, address, or payment method, then I am returned here with a fresh, re-validated summary.
- Given Cash On Delivery is selected, when the summary is shown, then it states payment is collected on delivery.
- Given a line's price changed since checkout began, when the summary is shown, then the current price is shown with the change stated and re-confirmation is required.
- Given a line's stock fell below its quantity, when the summary is shown, then the shortfall is reported and I must reduce or remove the line before continuing.
- Given an applied voucher is no longer valid, when the summary is shown, then it is removed, the total change is stated, and re-confirmation is required.
- Given the shipping fee changed, when the summary is shown, then the new fee is shown and re-confirmation required.
- Given every line has become unpurchasable, when the summary is computed, then checkout ends and I am returned to the cart with an explanation.

---

## US-ORD-05 — Place Order

**As a** Customer
**I want** to confirm and place my order
**So that** my confirmation means the goods are reserved for me

**Realises:** `UC-ORD-05` · `FR-ORD-08`, `FR-ORD-09`, `FR-INV-02`, `FR-PAY-03`
**Priority:** Must

**Acceptance Criteria**
- Given a confirmed order summary, when I place the order, then exactly one order is created with stock reserved for every line as one indivisible operation, the order moves to Pending Payment or Paid, and an OrderCreated event is raised.
- Given Cash On Delivery, when the order is placed, then no authorisation is sought and the order stays in Pending Payment until delivery.
- Given the provider requires an additional step, when placing, then the order remains in Pending Payment with its reservation held until the result arrives.
- Given the total payable is zero after discounts, when placing, then no authorisation is sought and the order moves directly to Paid.
- Given insufficient stock on one or more lines, when I place the order, then no order is created and no line is reserved, and I am told exactly which lines are short and by how much.
- Given concurrent placements compete for the last units, when evaluated, then reservations are admitted only up to available stock and every other attempt fails cleanly, with no oversell at any load.
- Given the applied voucher becomes invalid at the moment of placement, when I place the order, then it is removed, the revised total presented, and re-confirmation required — the order is not placed at an unagreed total.
- Given I double-submit or a client retries after a timeout, when placement is processed, then the existing order is returned and no second order is created.
- Given a failure occurs between reservation and order creation, when it happens, then neither survives — any reservation taken is released and no order exists.
- Given payment authorisation is declined, when placing, then the order transitions to Payment Failed and the reservation is held for the configured retry window.
- Given the payment provider is unreachable or times out, when placing, then the order remains in Pending Payment with its reservation held rather than being assumed failed.
- Given the OrderCreated event cannot be raised, when it happens, then the order stands and the event is retried until delivered, never dropped.
- Given the confirmation notification cannot be dispatched, when it happens, then the order stands and the notification is retried.
- Given the cart cannot be emptied after placement, when it happens, then the order stands and the cart is emptied on retry.

---

## US-ORD-06 — View Order Details

**As a** Customer
**I want** to view the full detail of an order
**So that** I can confirm what I bought and what was charged

**Realises:** `UC-ORD-06` · `FR-ORD-12`
**Priority:** Must

**Acceptance Criteria**
- Given I own the order or hold a role granting order read, when I open it, then it is presented in full as at placement — line items, prices, discounts, fee, and total recorded then — together with its current state and the actions that state permits.
- Given Support or an Administrator views any order, when they do so, then authorisation is by role rather than ownership and the access is recorded.
- Given the order is cancellable, when I view it, then cancellation is offered only where the current state permits it.
- Given the order is returnable, when I view it, then return is offered only where the state and return window permit it.
- Given I do not own the order and lack the authority to view it, when I try, then I receive the same response as for an order that does not exist, and the attempt is recorded.
- Given the order references a deleted product, when I view it, then it presents in full using the values recorded at placement.
- Given the product's price changed since placement, when I view the order, then the placement price is shown, never the current one.

---

## US-ORD-07 — Track Order

**As a** Customer
**I want** to see an order's current state and shipment tracking
**So that** I know where my goods are without contacting Support

**Realises:** `UC-ORD-07` · `FR-ORD-13`, `FR-SHP-06`
**Priority:** Must

**Acceptance Criteria**
- Given I own the order or hold a role granting order read, when I open tracking, then the lifecycle position, tracking events in order, and delivery estimate are presented.
- Given the order has not yet shipped, when I open tracking, then the order state and expected dispatch are shown, explaining the absence of tracking.
- Given the order splits across shipments, when I open tracking, then each shipment is presented separately with the lines it carries.
- Given the order is delivered, when I open tracking, then the delivery date is shown together with the remaining return window.
- Given carrier updates are unavailable, when I open tracking, then the last recorded state is shown along with when it was received, never presented as current.
- Given the carrier reports an out-of-order event, when it arrives, then it does not move the shipment backwards.
- Given I lack authority over the order, when I try to view tracking, then I receive the same response as `US-ORD-06`.

---

## US-ORD-08 — Cancel Order

**As a** Customer
**I want** to cancel an order before it is dispatched
**So that** I can withdraw before it is packed and shipped

**Realises:** `UC-ORD-08` · `FR-ORD-14`, `FR-INV-03`, `FR-PAY-08`
**Priority:** Must

**Acceptance Criteria**
- Given an order in a state that permits cancellation, when I cancel it, then it moves to Cancelled, its stock reservation is released, a refund is initiated if payment was captured, and I am notified.
- Given the order was cancelled before payment, when cancelled, then it is terminal at Cancelled with no refund arising.
- Given Support cancels on my behalf, when they do so, then authorisation is by role and the audit entry records the agent and the reason.
- Given only some lines are cancelled, when a partial cancellation is processed, then only their reservations are released, the total is adjusted, and excess captured payment is refunded.
- Given the order is already Packed or beyond, when I try to cancel it, then it is declined and I am directed to request a return instead.
- Given the order is already Cancelled, when I try to cancel it again, then success is reported without repeating the action.
- Given the reservation release fails, when cancelling, then the order is still marked Cancelled and the release is retried.
- Given the refund fails, when cancelling a paid order, then the order is Cancelled but not Refunded, and stays visibly awaiting refund.
- Given cancellation races a fulfilment state advance, when both occur together, then exactly one transition applies; if the advance wins, cancellation fails and I am directed to request a return.

---

## US-ORD-09 — Request Return

**As a** Customer
**I want** to request a return against a delivered order
**So that** I can send back what does not suit me

**Realises:** `UC-ORD-09` · `FR-ORD-15`, `FR-PAY-08`, `FR-INV-05`
**Priority:** Should

**Acceptance Criteria**
- Given an order in state Delivered and within the return window, when I request a return with lines and a reason, then a return is recorded, and on receipt and acceptance the order moves to Returned with a refund initiated.
- Given I return only some lines, when requested, then only those are restocked and refunded, with the rest of the order standing.
- Given Support raises the return on my behalf, when they do so, then it is recorded against the agent.
- Given goods are received damaged, when inspected, then the return is accepted for refund but the goods are not restocked, with the write-off recorded.
- Given goods fail the return conditions on inspection, when rejected, then the order stays Delivered, no refund is issued, and the decision and reason are recorded and communicated.
- Given the return window has passed, when I request a return, then it is declined, stating when the window closed, unless a Support Agent overrides with a recorded reason.
- Given the order is not Delivered, when I request a return, then it is declined and I am directed to cancel instead.
- Given a return was already requested for those lines, when I request again, then the existing request is presented rather than a second created.
- Given the goods never arrive, when the configured period lapses, then the request closes with the reason recorded and no refund is issued.
- Given the refund fails, when processing an accepted return, then the order is Returned but not Refunded, and stays visibly awaiting refund.

---

## US-ORD-10 — Advance Order Status

**As a** Staff member
**I want** to advance an order to its next legal state
**So that** the order record reflects its actual fulfilment progress

**Realises:** `UC-ORD-10` · `FR-ORD-10`, `FR-ORD-11`, `FR-ORD-16`, `FR-AUD-01`
**Priority:** Must

**Acceptance Criteria**
- Given a legal transition from the order's current state and an actor whose role permits it, when the transition is requested, then it is applied together with its side effects as one operation, an audit entry records who advanced it and when, and the corresponding business event is raised.
- Given a carrier reports dispatch or delivery, when the event is received, then the transition is attributed to the carrier and the same legality rule applies.
- Given a payment result arrives, when processed, then it moves the order between Pending Payment, Paid, and Payment Failed as appropriate.
- Given the return window closes or a payment retry window elapses, when the Scheduler acts, then the corresponding automatic transition is applied.
- Given several orders are advanced together, when a bulk advance is requested, then each is evaluated and applied independently, with one illegal transition never failing the batch.
- Given the requested transition is not legal from the current state, when requested by any role through any entry point, then it is declined, stating the current state and the transitions available from it.
- Given the actor lacks authority for this specific transition, when requested, then it is declined and the attempt is recorded.
- Given a side effect fails during the transition, when it happens, then the transition does not occur — state and side effect move together or not at all.
- Given the audit entry cannot be written, when the transition is attempted, then the transition is not applied.
- Given two actors request conflicting transitions concurrently, when both arrive, then exactly one succeeds and the other is re-evaluated against the new state.
- Given the resulting business event cannot be raised, when it happens, then the transition stands and the event is retried until delivered.

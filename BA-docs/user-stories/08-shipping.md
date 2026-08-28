# Shipping — User Stories (`SHP`)

**Document type:** User Story Specification — domain
**Related documents:** [`README.md`](./README.md) (index and template) · [`../use-cases/08-shipping.md`](../use-cases/08-shipping.md) (source use cases) · [`../srs.md`](../srs.md)
**Audience:** Product Management, Engineering, Quality Assurance

---

## US-SHP-01 — Calculate Shipping Fee

**As a** Customer
**I want** the shipping fee calculated for my order
**So that** there is no surprise at the order summary

**Realises:** `UC-SHP-01` · `FR-SHP-02`, `FR-ORD-04`
**Priority:** Must

**Acceptance Criteria**
- Given a destination and order contents, when the fee is calculated, then it reflects the eligible providers, the contents, and the selected option, and is recorded against the order.
- Given a free-shipping promotion applies, when the fee is calculated, then the fee is still computed as normal and the promotion waives it as an itemised discount.
- Given the order splits across warehouses, when the fee is calculated, then a fee is computed per shipment and presented as one total with the split explained.
- Given the destination or contents change, when they do, then the fee is recalculated and the new figure presented before confirmation.
- Given a value or weight threshold is reached, when the fee is calculated, then the qualifying condition for a reduced or waived fee is stated.
- Given no provider serves the destination, when calculated, then I am told the destination cannot be delivered to and offered a different address.
- Given some lines cannot ship to the destination, when calculated, then the restricted items are identified and must be removed or the address changed.
- Given the fee cannot be calculated, when attempted, then I am told the failure and offered a retry — the platform never estimates.
- Given weight or dimensions are unknown for a line, when calculated, then the configured category default is used and the order is flagged for review.

---

## US-SHP-02 — Estimate Delivery Date

**As a** Customer
**I want** an estimated delivery date for my order
**So that** I can decide on delivery speed as well as price

**Realises:** `UC-SHP-02` · `FR-SHP-03`
**Priority:** Should

**Acceptance Criteria**
- Given a determined shipping option and destination, when the estimate is computed, then a delivery date range is presented, accounting for transit time and non-working days, and recorded against the order.
- Given more than one shipping option, when compared, then each is presented with its own fee and estimate.
- Given a backordered line, when the estimate is computed, then it reflects the expected restock date and the delay is stated before placement.
- Given split shipments, when estimated, then each carries its own estimate rather than only the latest being shown.
- Given the estimate is unavailable, when this happens, then the order can still be placed without one.
- Given the carrier revises the estimate after dispatch, when this happens, then the revised estimate is recorded, the customer notified, and the original retained for comparison.
- Given the computed estimate falls outside the carrier's stated service, when this happens, then the carrier's stated service is presented instead and the discrepancy flagged.

---

## US-SHP-03 — Create Shipment

**As a** Warehouse Operator
**I want** to create a shipment for a packed order
**So that** the order dispatches with a carrier and tracking reference

**Realises:** `UC-SHP-03` · `FR-SHP-01`, `FR-SHP-04`, `FR-ORD-16`
**Priority:** Must

**Acceptance Criteria**
- Given an order in Packed with its reservation committed, when I create the shipment, then it is recorded with a carrier and tracking reference, the order moves to Shipping, and the customer is notified.
- Given the order ships as more than one parcel, when shipments are created, then each is recorded separately with its own reference and lines, and the order advances only once all are dispatched.
- Given I override the automatic carrier selection, when I do, then the override and its reason are recorded.
- Given a Cash On Delivery order, when the shipment is created, then the amount to collect is declared to the carrier.
- Given the order is not in Packed, when shipment creation is attempted, then it is declined.
- Given the carrier rejects the shipment, when this happens, then no shipment is recorded, the order stays Packed, and the rejection reason is presented.
- Given the carrier is unreachable, when creation is attempted, then no shipment is recorded, the order stays Packed, and an alternative carrier is offered where one serves the destination.
- Given the tracking reference is not returned, when the shipment is created, then it is recorded as dispatched without a reference and flagged for follow-up, with dispatch still notified.
- Given the shipment is created but the order fails to advance to Shipping, when this happens, then the transition is retried and persistent failure is escalated.

---

## US-SHP-04 — Record Carrier Tracking Update

**As a** Shipping Carrier
**I want** to report a status change for a shipment
**So that** the customer can follow the parcel without asking

**Realises:** `UC-SHP-04` · `FR-SHP-05`, `FR-ORD-13`
**Priority:** Must

**Acceptance Criteria**
- Given an update attributable to a recorded shipment and no older than the latest recorded, when it is verified, then it is appended to the shipment's history, and where it signals delivery the order advances.
- Given an exception is reported — a failed attempt, a refusal, or damage, when it arrives, then it is recorded, the customer notified, and Support alerted.
- Given the parcel is returning to sender, when reported, then the order is flagged for Support and the goods restocked on receipt.
- Given the delivery date is revised, when reported, then the estimate is updated and the customer notified.
- Given the update is delivered more than once, when redelivered, then it is recorded once.
- Given an update arrives out of order, when older than the latest recorded, then it is retained in history but does not move the shipment backwards.
- Given the reference matches no shipment, when this happens, then it is recorded as unmatched and escalated.
- Given the update fails authenticity verification, when checked, then it is rejected and recorded as a security event.
- Given recording the update fails, when it happens, then nothing is recorded and the update is retained and retried.

---

## US-SHP-05 — View Shipment Tracking

**As a** Customer
**I want** to see a shipment's tracking history
**So that** I know where my parcel is

**Realises:** `UC-SHP-05` · `FR-SHP-06`
**Priority:** Must

**Acceptance Criteria**
- Given I own the order or hold a role granting order read, when I open tracking, then the updates in order, current status, delivery estimate, and time of the last update are presented.
- Given several shipments, when I view tracking, then each is presented separately with the lines it carries.
- Given Support views any shipment, when they do, then authorisation is by role rather than ownership and is auditable.
- Given no updates have been received yet, when I view tracking, then I am told the shipment is dispatched and awaiting the first update.
- Given the last update is old, when I view tracking, then its age is stated explicitly.
- Given I lack authority over the shipment, when I try to view it, then I receive the same response as for a shipment that does not exist.

---

## US-SHP-06 — Confirm Delivery

**As a** Shipping Carrier
**I want** to confirm delivery of a shipment
**So that** the order's return window starts and settlement can proceed

**Realises:** `UC-SHP-06` · `FR-SHP-07`, `FR-ORD-16`, `FR-PAY-07`
**Priority:** Must

**Acceptance Criteria**
- Given an order in Shipping, when delivery is confirmed, then the order moves to Delivered, the return window starts from the delivery date, Cash On Delivery settlement is triggered where applicable, and the customer is notified.
- Given only some shipments of the order have arrived, when confirmed, then those lines are delivered and the order advances only once all have.
- Given delivery is recorded by Support because the carrier feed is unavailable, when this happens, then attribution is to the agent with the basis recorded.
- Given the return window later closes, when the Scheduler acts, then the order transitions from Delivered to Completed.
- Given the order is not in Shipping, when delivery confirmation is attempted, then it is declined and the conflict recorded.
- Given delivery is confirmed more than once, when redelivered, then it is applied once and the return window is not restarted.
- Given the customer disputes delivery, when this happens, then the order stays Delivered and the dispute is recorded for Support resolution.
- Given Cash On Delivery collection is not recorded, when delivery is confirmed, then the order is Delivered but not Paid, and appears on the outstanding-collection report.
- Given the confirmation fails to apply, when it happens, then the order stays in Shipping and the confirmation is retried.

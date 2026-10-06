# Inventory — User Stories (`INV`)

**Related documents:** [`README.md`](./README.md) (index and template) · [`../use-cases/04-inventory.md`](../use-cases/04-inventory.md) (source use cases) · [`../srs.md`](../srs.md)

---

## US-INV-01 — Reserve Stock for an Order

**As** the Checkout & Order process, acting for a Customer
**I want** to reserve stock for every line of an order at placement
**So that** a confirmed order is always backed by physical stock

**Realises:** `UC-INV-01` · `FR-INV-02`, `FR-ORD-06`, `FR-ORD-08`
**Priority:** Must

**Acceptance Criteria**
- Given every line has sufficient available stock, when the order is placed, then reserved stock increases and available stock decreases by the ordered quantity for every line, as one indivisible operation, and each reservation is recorded in state held.
- Given lines drawn from more than one warehouse, when reserved, then the reservation records which warehouse each line drew from.
- Given a line's quantity exceeds any one warehouse's stock but not the combined total, when reserved, then it splits across warehouses as one all-or-nothing reservation.
- Given one or more lines have insufficient available stock, when placement is attempted, then no line is reserved and the platform reports exactly which lines are short and the quantity actually available.
- Given concurrent placements compete for the last units, when reservations are evaluated, then admission never exceeds available stock and every excess request fails cleanly.
- Given a failure occurs part-way through a multi-line reservation, when it fails, then every reservation already taken in that attempt is released and available stock returns to its prior value.
- Given a duplicate reservation request for an order that already holds one, when it arrives, then the existing reservation is returned and no second one is taken.
- Given a variant became unpublished between checkout and placement, when reservation is attempted for that line, then it is refused and I am told the product is no longer available.

---

## US-INV-02 — Release Reserved Stock

**As** the Checkout & Order process, or the Scheduler
**I want** to release a held reservation
**So that** available stock is restored when an order is cancelled or its payment window elapses

**Realises:** `UC-INV-02` · `FR-INV-03`, `FR-ORD-14`, `FR-PAY-06`
**Priority:** Must

**Acceptance Criteria**
- Given a reservation in state held, when release is requested, then reserved stock decreases and available stock increases by the reserved quantity, and the reservation moves to state released.
- Given a Payment Failed order's retry window elapses, when the Scheduler acts, then its reservation is released and the order transitions to Cancelled.
- Given only some lines of an order are cancelled, when release is requested, then only those reservations are released.
- Given a reservation already released, when release is requested again, then no action is taken and success is reported.
- Given a reservation already committed, when release is requested, then it is declined and the conflict is recorded for investigation.
- Given a release fails, when requested, then the reservation stays held, the release is retried, and repeated failure is escalated.
- Given a reservation with no matching order, when release is requested, then the release proceeds and the orphaned reservation is recorded for investigation.

---

## US-INV-03 — Commit Reserved Stock on Fulfilment

**As a** Warehouse Operator
**I want** a held reservation committed when its order is packed
**So that** stock quantity and the order's fulfilment state move together

**Realises:** `UC-INV-03` · `FR-INV-04`, `FR-ORD-16`
**Priority:** Must

**Acceptance Criteria**
- Given a reservation in state held for an order in Processing, when I pack the order, then stock quantity and reserved stock both decrease by the reserved quantity, available stock is unchanged, and the reservation moves to state committed.
- Given commitment spans warehouses, when applied, then each constituent reservation is committed against the warehouse it was taken from.
- Given only some lines ship now, when commitment is requested, then only those reservations are committed and the rest stay held.
- Given a reservation already committed, when commitment is requested again, then no action is taken and success is reported.
- Given a reservation already released, when commitment is requested, then it is declined and the order does not advance, raised for manual resolution.
- Given a physical shortfall is discovered at picking, when I record it, then an inventory adjustment is created, the order is cancelled or partially fulfilled with its reservation released accordingly, and the customer is notified.
- Given commitment fails, when attempted, then the reservation stays held and the order does not advance to Packed.

---

## US-INV-04 — Adjust Inventory

**As a** Warehouse Operator
**I want** to record an inventory adjustment against a SKU and warehouse
**So that** the stock record matches what is physically present, with the change attributable

**Realises:** `UC-INV-04` · `FR-INV-05`, `FR-ADM-05`, `FR-AUD-01`
**Priority:** Must

**Acceptance Criteria**
- Given a non-zero quantity delta and a reason, when I submit the adjustment, then stock quantity and available stock are updated and an audit entry records the actor, SKU, warehouse, delta, before and after values, reason, and time.
- Given goods received, when I record a positive delta, then available stock rises accordingly.
- Given damage or write-off, when I record a negative delta, then it is applied only if it does not push available stock below zero.
- Given returned goods accepted, when I restock them, then the positive delta references the originating order.
- Given a negative adjustment would push available stock below zero, when I submit it, then it is declined and I am told how many units are reserved and against which orders.
- Given no reason is supplied, when I submit an adjustment, then it is declined.
- Given I lack the authority to adjust inventory, when I attempt it, then it is declined and the attempt is recorded.
- Given the audit entry cannot be written, when I submit an adjustment, then the adjustment is not applied.
- Given a concurrent adjustment to the same SKU, when both are applied, then each is computed against the value current when it is applied and both appear separately in the audit trail.

---

## US-INV-05 — View Inventory Levels

**As a** Warehouse Operator
**I want** to view stock quantity, reserved stock, and available stock
**So that** I can plan picking and replenishment

**Realises:** `UC-INV-05` · `FR-INV-01`, `FR-INV-06`
**Priority:** Must

**Acceptance Criteria**
- Given I hold a role granting inventory read, when I open the inventory view, then stock quantity, reserved stock, and available stock are presented separately, per SKU and warehouse.
- Given I filter to low stock, when I apply the filter, then only SKUs below their reorder threshold are shown.
- Given stock exists across warehouses, when I view a SKU, then aggregated totals are presented alongside the per-warehouse breakdown.
- Given I am a Guest or Customer viewing the catalog, when availability is shown, then only whether a variant is available is disclosed, never quantity or warehouse breakdown.
- Given I lack the authority to view inventory, when I attempt it, then the platform declines.
- Given a SKU does not exist, when I query it, then I am told it is unknown without disclosing whether it once existed.
- Given figures are momentarily inconsistent under load, when I view them, then the view may briefly lag reservations in flight without this affecting correctness elsewhere.

# Sequence Diagrams — Inventory

**Document type:** Backend architecture specification
**Status:** **Proposed**
**Audience:** Backend Engineering, Architecture Review, QA
**Related documents:** [README](./README.md) · [01-Ordering](./01-Ordering.md) · [UC-INV](../../../BA-docs/use-cases/04-inventory.md) · [ADR-0011](../../01-system/ADR/ADR-0011-optimistic-locking-reservation-model.md)

---

## 1. Purpose

Inventory is one of the two **Core** subdomains, and the reservation lifecycle is the reason. Every diagram here turns on one aggregate, `StockItem`, and one mechanism: a `@Version` column that turns a stale read into zero updated rows.

The reservation states are `Held`, `Committed`, and `Released` ([Domain Model §8.3](../Domain%20Model.md)). `BR-INV-02` makes each transition terminal — a reservation that has been committed can never be released, and one that has been released can never be committed. Almost every exception flow below is a consequence of that rule.

The one thing Inventory deliberately does **not** know is that Ordering exists. [Module Dependency Diagram §3.1](../Module%20Dependency%20Diagram.md) fixes the direction: `ordering → inventory`, never the reverse, because a Core context must not learn about a downstream one in order to protect its own invariant.

---

## 2. UC-INV-01 — Reserve Stock for an Order

The inside view of the `StockReservationPort` call in [`01-Ordering.md`](./01-Ordering.md) §6. It has no HTTP entry point of its own: the primary actor is Checkout & Order, and this always runs inside the caller's transaction.

| | |
|---|---|
| **Use cases** | `UC-INV-01` main success |
| **Business rules** | `BR-INV-01` · `BR-INV-02` |
| **Quality** | `NFR-REL-03` · `NFR-SCAL-06` |
| **Decisions** | [ADR-0010](../../01-system/ADR/ADR-0010-jpa-write-model-jdbc-read-models.md) · [ADR-0011](../../01-system/ADR/ADR-0011-optimistic-locking-reservation-model.md) · [ADR-0015](../../01-system/ADR/ADR-0015-redis-cache-and-rate-limiting.md) |
| **Problems** | `P8` |
| **Contention path** | [`01-Ordering.md`](./01-Ordering.md) §7 |

```mermaid
sequenceDiagram
  autonumber
  participant StockPort as StockReservationPort
  participant Adapter as InventoryStockAdapter
  participant ReserveStock as ReserveStockService
  participant StockItem
  participant Reservation as StockReservation
  participant Redis
  participant Outbox as OutboxRepository
  participant PG as PostgreSQL

  Note over StockPort,PG: Called from inside the placement transaction — never on its own
  StockPort->>Adapter: reserve(sku, warehouseId, quantity)
  Note over StockPort,Adapter: The port is owned by ORDERING and the adapter lives in<br/>ordering.infrastructure (ADR-0005 §4). Inventory does not<br/>implement an Ordering interface, which is what keeps the<br/>edge pointing ordering to inventory and not back.
  Adapter->>ReserveStock: reserve(...) — inventory.api

  opt the SKU is a designated flash-sale SKU
    ReserveStock->>Redis: DECR the pre-filter counter
    alt the counter is exhausted
      Redis-->>ReserveStock: reject early
      ReserveStock-->>StockPort: insufficient — PostgreSQL never touched
    else the counter still has headroom
      Redis-->>ReserveStock: continue
    end
    Note over Redis: ADR-0011 — advisory in ONE direction only. It may reject,<br/>it may NEVER authorise. Every admitted request still passes<br/>the versioned check below.
  end

  ReserveStock->>StockItem: load by (Sku, WarehouseId)
  StockItem-->>ReserveStock: onHand, reserved, version
  ReserveStock->>StockItem: reserve(quantity)
  StockItem->>StockItem: available = onHand minus reserved<br/>derived, never stored
  alt available is at least the requested quantity
    StockItem->>PG: UPDATE inventory_stock_item SET quantity_reserved = ?,<br/>version = version + 1 WHERE id = ? AND version = ?
    alt 1 row updated
      PG-->>StockItem: committed within the caller's transaction
      StockItem->>Reservation: create — status Held, quantity, orderId
      Reservation->>PG: INSERT inventory_stock_reservation
      ReserveStock-)StockPort: StockReserved — in-process, for the Partnership
      ReserveStock->>Outbox: append(StockReserved) for Catalog availability
      Outbox->>PG: INSERT inventory_outbox
      ReserveStock-->>StockPort: StockReservationId, status Held
    else 0 rows updated — another writer moved the version
      PG-->>StockItem: stale
      Note over StockItem: 01-Ordering.md §7. Bounded retry with jitter, then reject.<br/>The bound and the backoff are configuration (ADR-0011 §5).
    end
  else insufficient (E1)
    StockItem-->>ReserveStock: shortfall plus the quantity actually available
    ReserveStock-->>StockPort: insufficient — NO line is reserved
    Note over ReserveStock: E1 — no order is created and no line is reserved. The whole<br/>placement transaction rolls back. Reserving the lines that<br/>fit and failing the rest would produce a partially<br/>fulfillable order, which BR-ORD-02 forbids.
  end
```

**Why the same event goes out twice, by two transports.** `StockReserved` is published in-process *and* through the outbox to Kafka, and [`ADR-0012`](../../01-system/ADR/ADR-0012-transactional-outbox-and-kafka.md) §4 lists it in both rows deliberately. The in-process copy serves the Partnership participants inside the deployable. The Kafka copy feeds Catalog's availability read model, which is a separate deployable concern and must survive a restart. Sending only the in-process event would leave the storefront's availability display stale after any process bounce; sending only the Kafka event would make the Partnership eventually consistent, which `BR-ORD-02` forbids.

**Why multi-warehouse lines are independent reservations.** There is no cross-warehouse aggregate. A line drawn from two warehouses produces two `StockReservation` rows, and the `Order` side holds a plain set of `(StockItemId, StockReservationId)` references ([Domain Model §8.3, §8.5](../Domain%20Model.md)). Partial commit and partial release are therefore legal outcomes — which is what makes `UC-INV-03` A2 (partial fulfilment) expressible rather than approximated.

---

## 3. UC-INV-03 — Commit Reserved Stock on Fulfilment

| | |
|---|---|
| **Use cases** | `UC-INV-03` main success · `UC-ORD-10` |
| **Business rules** | `BR-INV-01` · `BR-INV-02` · `BR-INV-03` · `BR-ORD-01` |
| **Quality** | `NFR-REL-01` · `NFR-REL-04` |
| **Problems** | `P7` |

```mermaid
sequenceDiagram
  autonumber
  actor Warehouse as Warehouse Operator
  participant Ctl as InventoryController
  participant Commit as CommitReservationService
  participant Authz as AuthorizationService
  participant Reservation as StockReservation
  participant StockItem
  participant Order
  participant Outbox as OutboxRepository
  participant PG as PostgreSQL

  Warehouse->>Ctl: POST /api/v1/stock-reservations/{reservationId}/commitments
  Note over Ctl: Also reached from AdvanceOrderStatusService on<br/>PROCESSING to PACKED — 01-Ordering.md §10.
  Ctl->>Commit: commit(reservationId, actor, correlationId)
  Commit->>Authz: authorise(actor, STOCK_COMMIT)
  Authz-->>Commit: permitted

  Commit->>Reservation: load
  alt status is Held
    Reservation-->>Commit: Held, quantity, stockItemId
    rect rgba(124,92,255,0.08)
      Note over Commit,PG: ONE PostgreSQL transaction with the order transition
      Commit->>StockItem: commit(quantity)
      StockItem->>PG: UPDATE inventory_stock_item<br/>SET quantity_on_hand = quantity_on_hand - ?,<br/>quantity_reserved = quantity_reserved - ?,<br/>version = version + 1 WHERE id = ? AND version = ?
      PG-->>StockItem: 1 row updated
      Note over StockItem: Both counters fall by the same amount, so AVAILABLE IS<br/>UNCHANGED — those units were never available (BR-INV-01).<br/>This is why availability is derived: one update cannot<br/>leave the pair inconsistent.
      Commit->>Reservation: to Committed — terminal
      Reservation->>PG: UPDATE inventory_stock_reservation
      Commit->>Order: allow the advance to PACKED (BR-ORD-01)
      Commit->>Outbox: append(StockReservationCommitted)
      Outbox->>PG: INSERT inventory_outbox
    end
    Commit-->>Ctl: 200 OK
  else status is already Committed (E1)
    Reservation-->>Commit: Committed
    Commit-->>Ctl: 200 OK, no action taken
    Note over Commit: A retried pack must not deduct stock twice<br/>(BR-INV-02, NFR-REL-04).
  else status is Released (E2)
    Reservation-->>Commit: Released
    Commit-->>Ctl: 409 — the order is NOT advanced
    Note over Commit: The order was cancelled after picking began. Committing a<br/>released reservation would deduct stock already promised<br/>to someone else. Raised for the Operator to resolve<br/>physically rather than resolved automatically.
  end
```

**Why the commitment shares the order's transaction.** E4 states it plainly: if the commitment fails, the reservation stays `Held` **and the order does not advance**. Order state and stock state move together or not at all. An order that reached `PACKED` on a failed commitment leaves the platform believing it still holds stock that has physically left — `P7` in the form nobody notices, because no customer complains and no report shows it.

**The physical shortfall case.** E3 is the one where the platform's figure and reality have already diverged before this diagram starts: the shelf holds fewer units than the record. There is no software fix, and the design does not pretend otherwise. The Operator records an adjustment (§4), which makes the divergence **visible and attributable** rather than silently absorbed, and the order is cancelled or partially fulfilled with its reservation released accordingly. `P17`'s requirement is that the discrepancy has a name and an author, not that it never happens.

---

## 4. UC-INV-04 — Adjust Inventory

| | |
|---|---|
| **Use cases** | `UC-INV-04` · `UC-AUD-01` |
| **Business rules** | `BR-INV-01` · `BR-INV-03` · `BR-AUD-01` |
| **Quality** | `NFR-OBS-01` |
| **Problems** | `P16` · `P17` |

```mermaid
sequenceDiagram
  autonumber
  actor Warehouse as Warehouse Operator
  participant Ctl as InventoryController
  participant Adjust as AdjustStockService
  participant Authz as AuthorizationService
  participant StockItem
  participant Audit as AuditListener
  participant Outbox as OutboxRepository
  participant PG as PostgreSQL

  Warehouse->>Ctl: POST /api/v1/stock-items/{stockItemId}/adjustments<br/>delta, reason code, note
  Ctl->>Adjust: adjust(stockItemId, delta, reason, actor, correlationId)
  Adjust->>Authz: authorise(actor, STOCK_ADJUST)
  Authz-->>Adjust: permitted
  Note over Authz: P16 — adjusting stock is a financial control. A denial is<br/>recorded as an attempt, not discarded.

  Adjust->>Adjust: a reason is MANDATORY — an unexplained adjustment<br/>is indistinguishable from shrinkage

  rect rgba(124,92,255,0.08)
    Note over Adjust,PG: ONE PostgreSQL transaction
    Adjust->>StockItem: adjustOnHand(delta)
    StockItem->>StockItem: reject if the result would leave onHand below reserved
    Note over StockItem: BR-INV-01 — an adjustment may not push available negative.<br/>Units already reserved belong to orders that exist.
    StockItem->>PG: UPDATE inventory_stock_item SET quantity_on_hand = ?,<br/>version = version + 1 WHERE id = ? AND version = ?
    PG-->>StockItem: 1 row updated
    Adjust-)Audit: actor, stockItemId, delta, reason, timestamp
    Audit->>PG: INSERT audit_entry, append-only
    Adjust->>Outbox: append(StockAdjusted)
    Outbox->>PG: INSERT inventory_outbox
  end

  Adjust-->>Ctl: 200 OK, new on-hand quantity
  Note over Adjust,PG: StockAdjusted reaches Catalog's availability read model,<br/>Audit, and Reporting — 00-Overview.md §3.
```

**Why an adjustment cannot push availability negative.** `quantityReserved` represents units already promised to orders that exist. An adjustment that took `onHand` below `reserved` would make `available` negative and would mean the platform had sold goods it cannot supply — arriving at `P8`'s outcome through the back door rather than through a race. The aggregate rejects it, and the shortfall is resolved by cancelling orders explicitly (`UC-ORD-08`), which is visible, rather than by a number quietly going negative, which is not.

---

## 5. Failure — A Reservation Outlives Its Order

The Scheduler as a first-class trigger. Without this sweep, one abandoned failed payment holds stock indefinitely, and after a flash sale that is a large number of units.

| | |
|---|---|
| **Use cases** | `UC-INV-02` A1 · `UC-PAY-05` · `UC-ORD-08` |
| **Business rules** | `BR-INV-01` · `BR-INV-02` · `BR-ORD-04` · `BR-CRT-01` |
| **Quality** | `NFR-REL-04` |
| **Decisions** | [ADR-0011](../../01-system/ADR/ADR-0011-optimistic-locking-reservation-model.md) · [ADR-0028](../../01-system/ADR/ADR-0028-deployment-topology-containerisation.md) |
| **Problems** | `P5` · `P7` · `P8` |

```mermaid
sequenceDiagram
  autonumber
  actor Scheduler
  participant Sweep as ReservationExpirySweep
  participant Reservation as StockReservation
  participant StockItem
  participant Outbox as OutboxRepository
  participant PG as PostgreSQL
  participant Kafka
  participant Order

  Note over Scheduler: Only ONE ecp-api replica runs the scheduler profile.<br/>The Scheduler must fire once, not once per replica<br/>(ADR-0028, Deployment Diagram §6).
  Scheduler->>Sweep: run — the interval and the hold window are configuration
  Sweep->>PG: SELECT reservations in Held whose hold window has elapsed
  PG-->>Sweep: candidate reservations

  loop each candidate, independently
    rect rgba(124,92,255,0.08)
      Note over Sweep,PG: ONE transaction per reservation
      Sweep->>Reservation: re-read the status under the version check
      alt still Held
        Reservation-->>Sweep: Held
        Sweep->>StockItem: release(quantity)
        StockItem->>PG: UPDATE inventory_stock_item<br/>SET quantity_reserved = quantity_reserved - ?,<br/>version = version + 1 WHERE id = ? AND version = ?
        Sweep->>Reservation: to Released — terminal
        Reservation->>PG: UPDATE inventory_stock_reservation
        Sweep->>Outbox: append(StockReservationExpired)
        Outbox->>PG: INSERT inventory_outbox
      else already Released (E1)
        Reservation-->>Sweep: Released — no action, report success
        Note over Reservation: Releasing twice would return units the business does not<br/>hold, inflating available stock. That is the mirror image<br/>of overselling and equally damaging (BR-INV-02).
      else already Committed (E2)
        Reservation-->>Sweep: Committed — DECLINE, record the conflict
        Note over Reservation: The goods have shipped and the stock is genuinely gone.<br/>Returning committed units to availability would sell stock<br/>that has physically left the building.
      end
    end
  end

  Outbox--)Kafka: StockReservationExpired
  Kafka--)Order: PAYMENT_FAILED to CANCELLED, retry window elapsed
  Note over Order: BR-ORD-04, UC-PAY-05. The customer keeps their claim on<br/>the stock while they resolve the payment — and only for a<br/>bounded window, because held stock is unsellable stock.
  Note over Sweep: E3 — a failed release leaves the reservation HELD and<br/>retries. Repeated failure is escalated as an operational<br/>alert: held-but-unreleasable stock is invisible loss (P7)<br/>that no one will spot in the sales figures.
```

**Why each reservation gets its own transaction.** A sweep that processed the whole batch in one transaction would let a single conflicting reservation roll back every other release in the batch, and would hold locks across an unbounded number of rows. Per-reservation transactions mean one `Committed` reservation (E2) declines on its own and the rest still return to availability.

**Why the hold window is not an architectural constant.** Too long and inventory is stranded by dead orders; too short and a legitimately slow checkout is cancelled underneath the customer. [`ADR-0011`](../../01-system/ADR/ADR-0011-optimistic-locking-reservation-model.md) §5 makes it a business setting, and `BR-CRT-01` already establishes that expiry windows are configurable. The diagram shows *that* the sweep happens, never how often.

**Why the Scheduler is drawn as an actor.** [Solution Architecture §4](../../01-system/Solution%20Architecture.md) lists `Scheduler (Time)` in the Actors table, not as an implementation detail, because `P5` requires that no rule live only behind a human-initiated entry point. Expiry is a business rule, and it enters the domain through the same application service and the same authorisation model as an API call.

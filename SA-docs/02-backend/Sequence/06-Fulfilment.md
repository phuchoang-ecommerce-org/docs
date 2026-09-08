# Sequence Diagrams — Fulfilment and Promotion

**Document type:** Backend architecture specification
**Status:** **Proposed**
**Audience:** Backend Engineering, Architecture Review, QA
**Related documents:** [README](./README.md) · [UC-SHP](../../../BA-docs/use-cases/08-shipping.md) · [UC-PRM](../../../BA-docs/use-cases/09-promotion.md) · [01-Ordering](./01-Ordering.md) · [02-Inventory](./02-Inventory.md)

---

## 1. Purpose

Two domains that look unrelated and share one property: both are driven by a party or a clock the platform does not control, and both must keep an order's state honest when that party is slow, silent, or contradictory.

Shipping is bounded by a carrier. Everything it knows about a parcel arrives asynchronously, out of order, and more than once — so `BR-SHP-02` (never move a shipment backwards) does for tracking what `BR-PAY-01` does for payment results.

Promotion appears here because its *binding* moment is not in the promotion domain at all: it is inside the placement transaction in [`01-Ordering.md`](./01-Ordering.md) §6. §6 below is the inside view of that call, and §7 is what happens when a preview and a redemption disagree.

Arrow and frame conventions: [`README.md`](./README.md) §3.1–§3.2.

---

## 2. UC-SHP-03 — Create a Shipment

| | |
|---|---|
| **Use cases** | `UC-SHP-03` main success · `UC-ORD-10` · `UC-INV-03` |
| **Business rules** | `BR-ORD-01` · `BR-INV-02` |
| **Quality** | `NFR-REL-04` · `NFR-AVAIL-03` |
| **Decisions** | [ADR-0005](../../01-system/ADR/ADR-0005-clean-architecture-ports-and-adapters.md) · [ADR-0012](../../01-system/ADR/ADR-0012-transactional-outbox-and-kafka.md) |
| **Problems** | `P3` · `P7` |
| **Failure path** | §5 |

```mermaid
sequenceDiagram
  autonumber
  participant Kafka
  participant Listener as OrderPackedListener
  participant MakeShipment as CreateShipmentService
  participant Shipment
  participant ShipPort as ShippingProvider
  participant Adapter as CarrierAdapter
  actor Carrier as Shipping Carrier
  participant Outbox as OutboxRepository
  participant PG as PostgreSQL
  participant Order

  Kafka--)Listener: OrderPacked — ecp.ordering.order.v1
  Note over Listener: Shipping deserialises into its OWN local record type. It<br/>has no compile-time edge to Ordering, which is what lets<br/>both publish to each other without a cycle.
  Listener->>Listener: has this eventId been handled? at-least-once means redelivery
  Listener->>MakeShipment: create(orderId, lines, destination, option, correlationId)

  MakeShipment->>Order: confirm the order is PACKED and its reservation COMMITTED
  alt it is
    Order-->>MakeShipment: PACKED, reservations Committed
  else it is not (E1)
    MakeShipment-->>Listener: declined
    Note over MakeShipment: BR-ORD-01, BR-INV-02, P7 — dispatching an order whose<br/>stock is not committed would ship goods the platform still<br/>counts as merely reserved.
  end

  MakeShipment->>MakeShipment: select the carrier for this destination and option
  Note over MakeShipment: A2 — an Operator may override the automatic selection.<br/>The override AND its reason are recorded (UC-AUD-01).

  MakeShipment->>ShipPort: dispatch(lines, destination, service level)
  ShipPort->>Adapter: through the carrier-specific adapter
  Note over ShipPort,Adapter: ADR-0005, P3 — adding a second carrier is an adapter<br/>change. Nothing above this line moves.
  opt Cash On Delivery (A3)
    Adapter->>Carrier: declare the amount to collect
    Note over Adapter,Carrier: So that collection can be recorded on delivery<br/>(03-Payment.md §4).
  end
  Adapter->>Carrier: create the shipment
  Carrier-->>Adapter: tracking reference
  Adapter-->>ShipPort: carrier, tracking reference

  rect rgba(124,92,255,0.08)
    Note over MakeShipment,PG: ONE PostgreSQL transaction
    MakeShipment->>Shipment: record carrier, reference, and the lines it carries
    Shipment->>PG: INSERT shipping_shipment, shipping_shipment_line
    MakeShipment->>Outbox: append(ShipmentCreated)
    Outbox->>PG: INSERT shipping_outbox
  end
  Note over Shipment: A1 — a split shipment records each parcel SEPARATELY with<br/>its own reference and lines, and the order advances only<br/>when all are dispatched.<br/>E4 — a missing tracking reference does not withhold the<br/>FACT of dispatch. The shipment is flagged for follow-up and<br/>the customer told the reference when it arrives.

  Outbox--)Kafka: ShipmentCreated
  Kafka--)Order: PACKED to SHIPPING (UC-ORD-10)
  Kafka--)Order: Notification tells the customer, with the reference
  Note over Order: E5 — if the shipment exists with the carrier but the order<br/>fails to advance, the TRANSITION is retried. The shipment<br/>is never cancelled, because it cannot be recalled. An order<br/>stuck in PACKED with goods in transit misstates both<br/>fulfilment and revenue, so persistent failure escalates (P7).
```

---

## 3. UC-SHP-04 — Record a Carrier Tracking Update

| | |
|---|---|
| **Use cases** | `UC-SHP-04` main success · `UC-SHP-05` |
| **Business rules** | `BR-SHP-02` |
| **Quality** | `NFR-SEC-04` · `NFR-REL-04` |
| **Problems** | `P6` |

```mermaid
sequenceDiagram
  autonumber
  actor Carrier as Shipping Carrier
  participant NGINX as nginx
  participant Ctl as CarrierEventController
  participant Verify as CallbackVerificationService
  participant Record as RecordTrackingUpdateService
  participant Shipment
  participant TrackingEvent
  participant Outbox as OutboxRepository
  participant PG as PostgreSQL

  Carrier->>NGINX: POST /api/v1/carrier-events<br/>signature, tracking reference, status, timestamp
  Note over NGINX: Inbound from the public internet, no JWT. Same trust<br/>boundary shape as the payment callback (03-Payment.md §3).
  NGINX->>Ctl: forward
  Ctl->>Verify: verify the update originates from the carrier
  alt authentic
    Verify-->>Ctl: authentic
  else it is not
    Ctl-->>Carrier: 401, nothing applied — recorded as a security event
    Note over Verify: NFR-SEC-04. An unverified carrier event can move an order<br/>to DELIVERED, which starts a return window and, for Cash<br/>On Delivery, triggers settlement.
  end

  Ctl->>Record: record(trackingReference, status, occurredAt)
  Record->>PG: SELECT shipping_shipment WHERE tracking_reference = ?
  alt the shipment is found
    PG-->>Record: shipment, latest recorded status and time
    alt the update is newer than the latest recorded
      rect rgba(124,92,255,0.08)
        Note over Record,PG: ONE PostgreSQL transaction
        Record->>TrackingEvent: append to the shipment's history
        TrackingEvent->>PG: INSERT shipping_tracking_event
        Record->>Shipment: advance the shipment status
        Record->>Outbox: append(ShipmentDispatched) or append(ShipmentDelivered)
        Outbox->>PG: INSERT shipping_outbox
      end
      opt the update signals delivery
        Note over Record: Continues into §4.
      end
    else it is older than the latest recorded (E2)
      Record->>TrackingEvent: append to the history for completeness
      Note over TrackingEvent: BR-SHP-02 — retained, but it does NOT move the shipment<br/>backwards. An "in transit" arriving after "delivered" must<br/>not un-deliver a parcel. TrackingEvent is append-only, so<br/>the out-of-order arrival is preserved AND inert.
    else the same update again (E1)
      Record-->>Ctl: recorded once
      Note over Record: Carriers retry until acknowledged, so duplicates are<br/>routine (NFR-REL-04) — as with payment (03-Payment.md §7).
    end
    Ctl-->>Carrier: 200 — acknowledged
  else no shipment matches the reference (E3)
    PG-->>Record: none
    Record->>PG: record as unmatched and escalate
    Ctl-->>Carrier: 200
    Note over Record: It may indicate a shipment created with the carrier but<br/>never recorded (§2, E5) — which is exactly the gap worth<br/>surfacing rather than discarding.
  end

  Note over Carrier,PG: A1 — a failed attempt, refusal, or damage is recorded, the<br/>customer notified, and Support ALERTED: these need action,<br/>not observation. A2 — a return to sender flags the order for<br/>Support and restocks the goods on receipt (UC-INV-04).<br/>A3 — a revised delivery date updates the estimate and<br/>notifies the customer.
```

**Why the tracking history is append-only.** `BR-SHP-02` needs two things that pull in opposite directions: the shipment's *current* status must never regress, and the full carrier history must be retained for support and dispute handling. An append-only `TrackingEvent` list with a separately-maintained current status gives both — the late-arriving event is kept and visible, and it changes nothing. Overwriting a single status field would satisfy the first requirement by destroying the evidence for the second.

---

## 4. UC-SHP-06 — Confirm Delivery

The event with the widest blast radius in the platform: it closes fulfilment, starts the return window, unlocks review eligibility, and — for Cash On Delivery — triggers settlement.

| | |
|---|---|
| **Use cases** | `UC-SHP-06` · `UC-PAY-04` · `UC-REV-01` · `UC-ORD-10` |
| **Business rules** | `BR-ORD-01` · `BR-ORD-05` · `BR-REV-01` |
| **Problems** | `P7` · `P17` |

```mermaid
sequenceDiagram
  autonumber
  actor Carrier as Shipping Carrier
  participant Confirm as ConfirmDeliveryService
  participant Shipment
  participant Outbox as OutboxRepository
  participant PG as PostgreSQL
  participant Kafka
  participant Order
  participant Payment
  participant Review
  actor Scheduler

  Carrier--)Confirm: delivery confirmed, with any proof supplied
  Note over Carrier,Confirm: A2 — Support may record delivery when the carrier feed is<br/>unavailable. Attribution is to the AGENT, with the basis<br/>recorded (P17).
  Confirm->>Order: confirm the order is SHIPPING
  alt it is
    Order-->>Confirm: SHIPPING
    rect rgba(124,92,255,0.08)
      Note over Confirm,PG: ONE PostgreSQL transaction
      Confirm->>Shipment: record the delivery time and proof
      Shipment->>PG: UPDATE shipping_shipment
      Confirm->>Outbox: append(ShipmentDelivered)
      Outbox->>PG: INSERT shipping_outbox
    end
    Outbox--)Kafka: ShipmentDelivered
    Kafka--)Order: SHIPPING to DELIVERED (BR-ORD-01)
    Order->>Order: start the return window FROM the delivery date (BR-ORD-05)
    Note over Order: A1 — a partial delivery marks only those lines delivered.<br/>The order advances only when all shipments have arrived.<br/>E2 — a duplicate confirmation is applied ONCE, so the<br/>return window is not silently extended by a redelivery.

    Kafka--)Payment: Cash On Delivery — trigger settlement
    Note over Payment: 03-Payment.md §4. E4 — a delivered order with no recorded<br/>collection is DELIVERED but NOT PAID, and appears on the<br/>outstanding-collection report. Delivery is never taken as<br/>evidence of payment.
    Kafka--)Review: OrderDelivered unlocks verified-buyer eligibility
    Note over Review: 07-Supporting.md §2. Review learns that a purchase<br/>completed WITHOUT any compile-time edge to Ordering.
    Scheduler--)Order: the return window closes — DELIVERED to COMPLETED (A3)
  else the order is not in SHIPPING (E1)
    Confirm-->>Carrier: declined, conflict recorded
    Note over Confirm: A delivery for an order never dispatched indicates a<br/>mismatch worth investigating, not a fact to accept.
  end
  Note over Carrier,Scheduler: E3 — a customer disputing delivery does NOT reverse the<br/>carrier's confirmation automatically. The order stays<br/>DELIVERED, the dispute is recorded for Support, and the<br/>resolution is a return or a refund — each attributable (P17).
```

**Why one event drives four consequences through Kafka rather than four direct calls.** Payment, Review, Notification, and Reporting all need to know a delivery happened, and none of them is on Shipping's critical path. Publishing once and letting each consume independently means a failure in Review's projection cannot delay Cash On Delivery settlement, and a new consumer — a loyalty programme awarding points on delivery — is added without touching this diagram. That is `P2`, and the alternative would give Shipping a compile-time edge to four contexts it has no business knowing about.

---

## 5. Failure — The Carrier Cannot Be Reached

| | |
|---|---|
| **Use cases** | `UC-SHP-03` E2, E3 |
| **Business rules** | `BR-ORD-01` |
| **Quality** | `NFR-AVAIL-03` · `NFR-REL-04` |
| **Problems** | `P3` · `P7` |

```mermaid
sequenceDiagram
  autonumber
  actor Warehouse as Warehouse Operator
  participant MakeShipment as CreateShipmentService
  participant ShipPort as ShippingProvider
  participant Adapter as CarrierAdapter
  actor Carrier as Shipping Carrier
  participant Order
  participant PG as PostgreSQL

  Note over Order: The order is PACKED and its reservation COMMITTED
  MakeShipment->>ShipPort: dispatch(...)
  ShipPort->>Adapter: through the carrier-specific adapter
  Adapter->>Carrier: create the shipment
  alt the carrier rejects it (E2)
    Carrier-->>Adapter: rejected, with a reason
    Adapter-->>MakeShipment: rejected
    MakeShipment-->>Warehouse: the rejection reason, so the declaration can be corrected
  else the carrier is unreachable (E3)
    Carrier--)Adapter: no response
    Adapter-->>MakeShipment: unreachable
    opt an alternative carrier serves this destination
      MakeShipment->>ShipPort: dispatch through the alternative
      Note over ShipPort: NFR-AVAIL-03, P3 — a second adapter behind the same port.<br/>The failover costs no change above the port line.
    end
  end

  Note over MakeShipment,PG: NOTHING IS RECORDED
  MakeShipment->>PG: no shipment row is written
  Note over Order: The order STAYS PACKED. It is never advanced on an<br/>unconfirmed dispatch, because an order in SHIPPING with no<br/>parcel tells the customer a tracking reference is coming<br/>that will never arrive, and tells Reporting that goods left<br/>the building when they did not (P7).
  MakeShipment-->>Warehouse: retry when the carrier recovers

  Note over Warehouse,PG: THE ASYMMETRY WITH §2, E5
  Note over MakeShipment: Here, nothing external happened — so nothing is recorded<br/>and the operation is safely refused.<br/>There, the parcel EXISTS with the carrier and cannot be<br/>recalled — so the order transition is retried instead.<br/>The rule is the same in both: the platform's record<br/>follows physical reality, never the other way round.
```

---

## 6. UC-PRM-03 — Redeem a Promotion at Placement

The inside view of the `PromotionRedemptionPort` call in [`01-Ordering.md`](./01-Ordering.md) §6. Like stock reservation, it has no entry point of its own and always runs inside the caller's transaction.

| | |
|---|---|
| **Use cases** | `UC-PRM-03` · `UC-PRM-02` · `UC-ORD-05` |
| **Business rules** | `BR-PRM-01` · `BR-PRM-02` · `BR-PRM-03` |
| **Quality** | `NFR-REL-03` · `NFR-SCAL-06` |
| **Decisions** | [ADR-0005](../../01-system/ADR/ADR-0005-clean-architecture-ports-and-adapters.md) · [ADR-0011](../../01-system/ADR/ADR-0011-optimistic-locking-reservation-model.md) |
| **Problems** | `P5` |
| **Preview counterpart** | [`01-Ordering.md`](./01-Ordering.md) §4 |

```mermaid
sequenceDiagram
  autonumber
  participant PromoPort as PromotionRedemptionPort
  participant Adapter as PromotionAdapter
  participant RedeemPromo as RedeemPromotionService
  participant Promotion
  participant Redemption as PromotionRedemption
  participant Outbox as OutboxRepository
  participant PG as PostgreSQL

  Note over PromoPort,PG: Called from inside the placement transaction — never alone
  PromoPort->>Adapter: redeem(voucherCode, customerId, orderId, subtotal)
  Adapter->>RedeemPromo: redeem(...) — promotion.api

  RedeemPromo->>Promotion: load by code, with its UsageCounter
  Promotion-->>RedeemPromo: DiscountRule, ValidityWindow, usageCount, version
  RedeemPromo->>RedeemPromo: RE-VALIDATE every condition — active period, customer<br/>eligibility, order eligibility, total and per-customer limits
  Note over RedeemPromo: BR-PRM-01. This is a full re-validation, not a trust of the<br/>preview at 01-Ordering.md §4. The preview may be seconds or<br/>minutes old, and a campaign can be exhausted in between.

  alt every condition still holds
    RedeemPromo->>RedeemPromo: calculate the discount, capped at the discountable value (BR-PRM-02)
    RedeemPromo->>Promotion: incrementUsage()
    Promotion->>PG: UPDATE promotion_promotion SET usage_count = usage_count + 1,<br/>version = version + 1 WHERE id = ? AND version = ?<br/>AND usage_count < usage_limit
    alt 1 row updated
      PG-->>Promotion: claimed
      RedeemPromo->>Redemption: record against the order (FR-PRM-09)
      Redemption->>PG: INSERT promotion_redemption
      RedeemPromo-)PromoPort: PromotionRedeemed — in-process, for the Partnership
      RedeemPromo->>Outbox: append(PromotionRedeemed) for Reporting
      Outbox->>PG: INSERT promotion_outbox
      RedeemPromo-->>PromoPort: Discount(Money)
    else 0 rows updated
      PG-->>Promotion: another redemption took the last allocation
      Note over Promotion: The IDENTICAL mechanism as stock (02-Inventory.md §2), on<br/>the identical grounds: over-redemption is unbudgeted<br/>spend, exactly as overselling is unfulfillable demand.<br/>Bounded retry, then §7.
    end
  else a condition has lapsed
    RedeemPromo-->>PromoPort: no longer valid — see §7
  end
```

**Why promotion uses the same locking mechanism as stock.** A usage cap and a stock level are the same shape of problem: a finite allocation that concurrent requests draw down, where exceeding it costs real money. [`ADR-0011`](../../01-system/ADR/ADR-0011-optimistic-locking-reservation-model.md) §4 states it directly — promotion redemption is optimistically locked "the same way", inside the same transaction. Using a weaker mechanism for promotion would mean unbudgeted discount is prevented less rigorously than unfulfillable demand, and finance would not accept that distinction.

**Why the `usage_count < usage_limit` predicate is in the `WHERE` clause.** Checking the limit in application code and then updating leaves a window. Putting the predicate in the conditional update closes it, so the cap is enforced by the same statement that claims the allocation. The version check and the limit check are two guards in one atomic operation.

---

## 7. Failure — A Voucher Valid at Preview Is Exhausted at Placement

| | |
|---|---|
| **Use cases** | `UC-ORD-05` E3 · `UC-ORD-03` E6 · `UC-PRM-02` E7 |
| **Business rules** | `BR-PRM-01` · `BR-ORD-06` |
| **Quality** | `NFR-SCAL-06` |
| **Problems** | `P5` |

```mermaid
sequenceDiagram
  autonumber
  actor Customer
  participant Checkout as CheckoutService
  participant Validate as VoucherValidationService
  participant PlaceOrder as PlaceOrderService
  participant PromoPort as PromotionRedemptionPort
  participant RedeemPromo as RedeemPromotionService
  participant Promotion
  participant PG as PostgreSQL

  Note over Customer,PG: The campaign has ONE redemption left
  Customer->>Checkout: apply voucher SAVE20
  Checkout->>Validate: validate — NON-BINDING preview
  Validate->>Promotion: usageCount is below the limit
  Validate-->>Checkout: valid, discount 20
  Checkout-->>Customer: total shown WITH the discount
  Note over Checkout: 01-Ordering.md §4. Nothing has been claimed. The customer<br/>now reads the summary, changes an address, and confirms —<br/>which takes as long as it takes.

  Note over Customer,PG: MEANWHILE, ANOTHER CUSTOMER PLACES AN ORDER AND TAKES THE LAST REDEMPTION

  Customer->>PlaceOrder: confirm and place
  rect rgba(124,92,255,0.08)
    Note over PlaceOrder,PG: the placement transaction — 01-Ordering.md §6
    PlaceOrder->>PromoPort: redeem(SAVE20, subtotal)
    PromoPort->>RedeemPromo: redeem(...)
    RedeemPromo->>PG: UPDATE promotion_promotion SET usage_count = usage_count + 1,<br/>version = version + 1 WHERE id = ? AND version = ?<br/>AND usage_count < usage_limit
    PG-->>RedeemPromo: 0 rows updated — the limit is reached
    RedeemPromo-->>PromoPort: EXHAUSTED
    PlaceOrder->>PG: ROLLBACK the whole transaction
  end
  Note over PlaceOrder,PG: No order. No stock reserved. No idempotency key consumed.<br/>The rollback is the same one as 01-Ordering.md §9 — one<br/>mechanism, every partial-failure case.

  PlaceOrder-->>Customer: 409 ECP-PRM-4090
  Customer->>Checkout: the revised total is presented, WITHOUT the voucher
  Note over Checkout: UC-ORD-05 E3 — the platform does NOT place the order at a<br/>total the customer has not agreed to. It removes the<br/>voucher, states plainly that the total changed and why, and<br/>requires an explicit RE-CONFIRMATION (BR-ORD-06).
  Customer->>PlaceOrder: re-confirm at the new total, NEW idempotency key
  Note over PlaceOrder: Integration Contract §4.4 — ECP-PRM-4090 is an EXPECTED<br/>outcome under load, not a failure. It must be presented as<br/>"the promotion ran out" rather than as a generic checkout<br/>error, because the two call for different customer actions.
```

**Why the preview is allowed to be wrong.** Making it binding would mean reserving discount budget the moment a code is typed — stranding campaign allocation for every abandoned checkout, exactly as reserving stock at `UC-ORD-01` would strand inventory. The design accepts a preview that can lapse and pays for it with a re-confirmation at placement. Both the stock path and the promotion path make the same trade, for the same reason, and resolve it at the same instant.

**Why the order is not simply placed without the discount.** Silently dropping the voucher and charging the higher total would violate `BR-ORD-06` — the customer would be charged a price they were not shown. The `409` is the design working: it costs a round trip and preserves the rule that no total is ever charged without being agreed.

---

## 8. UC-PRM-04 — Launch a Flash Sale

Where every mechanism in this folder is exercised at once, and the only place the architecture is deliberately sized for a spike.

| | |
|---|---|
| **Use cases** | `UC-PRM-04` · `UC-PRM-05` · `UC-AUD-01` |
| **Business rules** | `BR-PRM-01` · `BR-INV-01` |
| **Quality** | `NFR-REL-03` · `NFR-SCAL-06` · `NFR-AVAIL-01` · `NFR-AVAIL-02` |
| **Decisions** | [ADR-0011](../../01-system/ADR/ADR-0011-optimistic-locking-reservation-model.md) · [ADR-0015](../../01-system/ADR/ADR-0015-redis-cache-and-rate-limiting.md) |
| **Problems** | `P5` · `P8` · `P9` |

```mermaid
sequenceDiagram
  autonumber
  actor Scheduler
  participant LaunchSale as ActivatePromotionService
  participant Authz as AuthorizationService
  participant Promotion
  participant Audit as AuditListener
  participant Redis
  participant Outbox as OutboxRepository
  participant PG as PostgreSQL
  participant Kafka
  participant SearchProj as SearchProjector
  actor Customer

  Note over Scheduler: A1 — an Administrator may launch early or late. Same<br/>service, and the action and actor are recorded (P17).
  Scheduler->>LaunchSale: the configured start time is reached
  LaunchSale->>Authz: authorise(SYSTEM, PROMOTION_ACTIVATE)
  Authz-->>LaunchSale: permitted
  Note over Authz: P5 — the Scheduler passes the same authorisation model as<br/>a human. A campaign that can only start by hand is a rule<br/>living behind a human-initiated entry point.

  rect rgba(124,92,255,0.08)
    Note over LaunchSale,PG: ONE PostgreSQL transaction
    LaunchSale->>Promotion: status to ACTIVE
    Promotion->>PG: UPDATE promotion_promotion
    LaunchSale-)Audit: activation, actor, timestamp
    Audit->>PG: INSERT audit_entry
    LaunchSale->>Outbox: append(PromotionActivated)
    Outbox->>PG: INSERT promotion_outbox
  end
  Outbox--)Kafka: PromotionActivated
  Kafka--)SearchProj: sale prices become visible in catalog and search
  Note over SearchProj: 05-Cart-Catalog-Search.md §8. The projection lag means<br/>the sale price appears in search a moment after it is<br/>active — display data, as always.

  opt a stock allocation is set aside (A2)
    LaunchSale->>Redis: seed the flash-sale pre-filter counter
    Note over Redis: ADR-0011, ADR-0015 — advisory in ONE direction. It rejects<br/>hopeless requests before they reach PostgreSQL, so the<br/>database sees contention proportional to REMAINING STOCK<br/>rather than to traffic. It may never authorise a sale.<br/>Only a DESIGNATED SKU gets this: an unanticipated viral<br/>product has no such protection.
  end

  Note over Customer,PG: THE SPIKE
  Customer->>LaunchSale: thousands of concurrent placements
  Note over Customer: E1 is the EXPECTED CONDITION, not a fault. Reservations<br/>are admitted up to available stock and no further, and every<br/>later placement is told the item is gone<br/>(01-Ordering.md §7). The platform confirms no order it<br/>cannot fulfil, at any load. Cancelling confirmed orders<br/>afterwards is the failure P8 describes, and it damages the<br/>brand precisely during the event meant to build it.
  Note over Customer: E2, P9 — browse and search may degrade BEFORE the purchase<br/>path does (NFR-AVAIL-02), while checkout and payment keep<br/>meeting their targets. Availability is preserved where<br/>revenue is, and that ordering is deliberate.

  Scheduler->>LaunchSale: the configured end time is reached (UC-PRM-05)
  LaunchSale->>Promotion: status to EXPIRED
  LaunchSale-)Audit: deactivation, actor, timestamp
  Note over LaunchSale: E4 — if deactivation FAILS, discounting would continue past<br/>the window as unbudgeted spend that grows every minute. The<br/>exposure is bounded because BR-PRM-01 is re-evaluated<br/>INSIDE the placement transaction (§6): an expired promotion<br/>is rejected at the moment of ordering even if deactivation<br/>itself has not completed. Re-validating at placement is not<br/>redundancy — it is the containment for this failure.
```

**Why re-validation at placement is what makes deactivation failure survivable.** E3 and E4 are the two ways the clock can fail — a sale that does not start, and a sale that does not stop. The first is a customer-facing failure with a fixed deadline and no software mitigation; it escalates. The second would be an unbounded and growing financial loss, except that the binding check in §6 reads the promotion's *current* state rather than trusting a flag set at activation. The exposure is therefore bounded by one placement, not by however long it takes someone to notice.

# Sequence Diagrams — Ordering

**Document type:** Backend architecture specification
**Status:** **Proposed**
**Audience:** Backend Engineering, Architecture Review, QA
**Related documents:** [README](./README.md) · [00-Overview](./00-Overview.md) · [UC-ORD](../../../BA-docs/use-cases/06-checkout-order.md) · [Domain Model](../Domain%20Model.md) · [ADR-0011](../../01-system/ADR/ADR-0011-optimistic-locking-reservation-model.md) · [ADR-0012](../../01-system/ADR/ADR-0012-transactional-outbox-and-kafka.md)

---

## 1. Purpose

The transition from intent to obligation. Four diagrams assemble a checkout, one places the order, three show the ways placement fails, and two cover the lifecycle afterwards.

Sections §6 through §9 are the centre of gravity for the whole folder. `P7` (partial failure across order, payment, and inventory) and `P8` (overselling under concentrated demand) are both decided by the ordering of messages inside a single transaction frame, and neither is visible in any static diagram in this repository.

Two rules dominate every diagram below:

- **`BR-ORD-02`** — creating an order and reserving its stock is one indivisible operation.
- **`BR-ORD-01`** — only the transitions in [`srs.md`](../../../BA-docs/srs.md) §5.3 are legal, whoever requests them and however they arrive.

The request pipeline every diagram opens with is drawn in [`00-Overview.md`](./00-Overview.md) §2.

---

## 2. UC-ORD-01 — Initiate Checkout

| | |
|---|---|
| **Use cases** | `UC-ORD-01` main success · `UC-AUD-03` |
| **Business rules** | `BR-CUS-02` · `BR-CRT-02` · `BR-CRT-04` · `BR-CAT-02` · `BR-ORD-01` |
| **Quality** | `NFR-PERF-02` |
| **Decisions** | [ADR-0005](../../01-system/ADR/ADR-0005-clean-architecture-ports-and-adapters.md) · [ADR-0012](../../01-system/ADR/ADR-0012-transactional-outbox-and-kafka.md) |
| **Problems** | `P11` |

```mermaid
sequenceDiagram
  autonumber
  actor Customer
  participant Next as Next.js server
  participant Ctl as CheckoutController
  participant Checkout as InitiateCheckoutService
  participant Authz as AuthorizationService
  participant Cart
  participant Catalog as CatalogQueryService
  participant Order
  participant PG as PostgreSQL

  Customer->>Next: proceed to checkout
  Next->>Ctl: POST /api/v1/checkouts
  Note over Next,Ctl: request pipeline — 00-Overview.md §2
  Ctl->>Checkout: initiate(customerId, correlationId)

  Checkout->>Authz: authorise(actor, CHECKOUT_INITIATE, own)
  Authz-->>Checkout: permitted, and the account is email-verified
  Note over Authz: BR-CUS-02 — an unverified account cannot order, and a<br/>Guest is refused HERE rather than at the payment step<br/>(UC-ORD-01 E4, E5). The cart is preserved either way.

  Checkout->>PG: SELECT the caller's existing DRAFT order
  alt a DRAFT already exists
    PG-->>Checkout: the draft order
    Checkout-->>Ctl: 200 OK — resumed
    Note over Checkout: A1 — the existing DRAFT is RESUMED, never duplicated.<br/>Returning to checkout must not multiply orders.
  else no DRAFT exists
    PG-->>Checkout: none
    Checkout->>Cart: load the caller's cart
    Cart-->>Checkout: CartLines (variantId, quantity) — UNPRICED
    Note over Cart: BR-CRT-04 — a CartLine never carries a price.<br/>Pricing happens once, at placement (BR-ORD-06).

    Checkout->>Catalog: for each line, is it published and available?
    Catalog-->>Checkout: publication status plus ADVISORY availability
    Note over Catalog: BR-CAT-02, BR-CRT-02. Availability here is advisory —<br/>Inventory is authoritative and nothing is reserved until<br/>UC-ORD-05. An empty or wholly unpurchasable cart is<br/>422 ECP-ORD-4220 (E1, E2). A partly unpurchasable one<br/>requires the customer to remove lines EXPLICITLY (E3):<br/>the platform never silently drops a line from an order<br/>someone is about to pay for.

    Checkout->>Catalog: price every line at the current price
    Catalog-->>Checkout: Money per line

    rect rgba(124,92,255,0.08)
      Note over Checkout,PG: ONE PostgreSQL transaction
      Checkout->>Order: create(customerId, priced lines)
      Order->>Order: to DRAFT (BR-ORD-01)
      Order->>PG: INSERT ordering_order, ordering_order_line
      Cart-)Checkout: CartCheckedOut
    end
    Note over Cart,Checkout: ADR-0012 §4 — in-process, not Kafka. A one-time translation<br/>within the deployable with a single local subscriber. Ordering<br/>translates the snapshot into its OWN frozen OrderLine value<br/>objects rather than holding a reference to the cart.

    Checkout-->>Ctl: 201 Created
  end

  Ctl-->>Next: Checkout resource — the draft plus what still blocks placement
  Next-->>Customer: render the checkout page
```

**Why no stock is reserved here.** The success postcondition is deliberate: an order exists in `DRAFT` and *nothing is held*. Reserving at the start of checkout would strand inventory for every abandoned session, and `P11` identifies each checkout step as an abandonment point. The cost of deferring is that the availability shown here is advisory and can go stale — which is exactly why `UC-ORD-04` re-checks it and `UC-ORD-05` re-checks it again under a lock.

**Why the cart hand-off is in-process rather than Kafka.** `CartCheckedOut` has one local subscriber, does not need to survive a restart independently of the transaction that raised it, and is consumed once. [`ADR-0012`](../../01-system/ADR/ADR-0012-transactional-outbox-and-kafka.md) §4's rule sends it in-process, and that is what produces the real `ordering → cart` Gradle edge in [Module Dependency Diagram §3.1](../Module%20Dependency%20Diagram.md). Sending it through Kafka would remove the edge but buy nothing, and would make a one-time translation eventually consistent for no reason.

---

## 3. UC-ORD-02 — Provide Shipping and Billing Information

| | |
|---|---|
| **Use cases** | `UC-ORD-02` main success · `UC-SHP-01` · `UC-SHP-02` · `UC-CUS-09` |
| **Business rules** | `BR-CUS-05` · `BR-SHP-01` |
| **Quality** | `NFR-PERF-02` · `NFR-SEC-04` |
| **Decisions** | [ADR-0005](../../01-system/ADR/ADR-0005-clean-architecture-ports-and-adapters.md) |

```mermaid
sequenceDiagram
  autonumber
  actor Customer
  participant Next as Next.js server
  participant Ctl as CheckoutController
  participant Checkout as CheckoutService
  participant Account
  participant Order
  participant Quote as ShippingQuoteService
  participant ShipPort as ShippingProvider
  actor Carrier as Shipping Carrier
  participant PG as PostgreSQL

  Customer->>Next: open the delivery step
  Next->>Ctl: GET /api/v1/accounts/me/addresses
  Note over Next,Ctl: request pipeline — 00-Overview.md §2
  Ctl->>Account: stored addresses, default flagged
  Account-->>Ctl: addresses (BR-CUS-05 — exactly one default)
  Ctl-->>Next: addresses
  Next-->>Customer: present with the default pre-selected

  Customer->>Next: select or enter a shipping address
  Next->>Ctl: PUT /api/v1/checkouts/{checkoutId}/shipping-address
  Ctl->>Checkout: setShippingAddress(...)
  Checkout->>Checkout: validate against the destination's expected format
  Note over Checkout: NFR-SEC-04, validated server-side. E1 names the failing<br/>field and proceeds no further. An undeliverable address<br/>costs a redelivery, a support contact, and often a refund.
  opt a new address was entered (A1)
    Checkout->>Account: add it to the address book (UC-CUS-09 A4)
    Account->>PG: INSERT identity_address
  end
  Checkout->>Order: record the shipping Address as a SNAPSHOT
  Note over Order: The Order holds a snapshot value object, not a reference.<br/>Editing the address book later must not rewrite the<br/>delivery address of an order already placed.

  Customer->>Next: supply billing information, or reuse the shipping address (A2)
  Next->>Ctl: PUT /api/v1/checkouts/{checkoutId}/billing-information
  Ctl->>Checkout: setBillingInformation(...)
  Checkout->>Order: record the billing Address snapshot

  Note over Customer,PG: SHIPPING FEE — UC-SHP-01, UC-SHP-02
  Checkout->>Quote: quote(destination, order contents)
  Quote->>ShipPort: rate request through the port (ADR-0005)
  ShipPort->>Carrier: through CarrierAdapter in shipping.infrastructure
  Carrier-->>ShipPort: options, fees, delivery estimates
  ShipPort-->>Quote: ShippingOption list
  Quote-->>Checkout: options

  alt the destination is served
    Checkout-->>Next: each option with its fee and estimate
    Next-->>Customer: present the options
    Customer->>Next: select an option (A3)
    Next->>Ctl: PUT /api/v1/checkouts/{checkoutId}/shipping-option
    Ctl->>Checkout: setShippingOption(...)
    Checkout->>Quote: recalculate for the selected option
    Checkout->>Order: record the option and its fee
    Order->>PG: UPDATE ordering_order
  else no carrier serves the destination (E2)
    Checkout-->>Next: 422 — stated plainly, a different address offered
    Note over Checkout: E3 — a fee that cannot be calculated blocks placement<br/>outright. BR-SHP-01 requires the fee shown at confirmation<br/>to be the fee charged, so the platform retries or declines.<br/>It never guesses. E5 — lines that cannot ship to the<br/>destination must be removed rather than shipped partially.
  end
```

**Why the fee is quoted through a port.** `FR-SHP-02` is satisfied by a carrier the platform does not control, and `P3` requires that adding a second carrier is an adapter change rather than a project. The `ShippingProvider` port is what makes the `CheckoutService` above indifferent to which carrier answers — nothing in this diagram above the port line changes when the carrier does.

**Why the fee is recalculated more than once.** `BR-SHP-01` states that the fee presented at confirmation is the fee charged. An address change after a quote (E4) invalidates it, so the quote is re-run before the summary, and `UC-ORD-04` confirms it a third time. Quoting once and trusting it is how a customer is charged a different amount from the one they agreed to.

---

## 4. UC-ORD-03 — Apply Voucher at Checkout

| | |
|---|---|
| **Use cases** | `UC-ORD-03` main success · `UC-PRM-02` |
| **Business rules** | `BR-PRM-01` · `BR-PRM-02` · `BR-PRM-03` |
| **Problems** | `P5` |
| **Binding counterpart** | [`06-Fulfilment.md`](./06-Fulfilment.md) §6 |

```mermaid
sequenceDiagram
  autonumber
  actor Customer
  participant Next as Next.js server
  participant Ctl as CheckoutController
  participant Checkout as CheckoutService
  participant Validate as VoucherValidationService
  participant Promotion
  participant Order
  participant PG as PostgreSQL

  Customer->>Next: enter a voucher code
  Next->>Ctl: PUT /api/v1/checkouts/{checkoutId}/voucher
  Note over Next,Ctl: request pipeline — 00-Overview.md §2
  Ctl->>Checkout: applyVoucher(code, correlationId)

  Checkout->>Validate: validate(code, customerId, order)
  Note over Checkout,Validate: Promotion's Open Host Service. This is a READ across the<br/>boundary, not the Partnership — it creates no reservation<br/>of discount budget and no usage increment.

  Validate->>Promotion: load by code
  Promotion-->>Validate: DiscountRule, ValidityWindow, UsageCounter
  Validate->>Validate: active period, customer eligibility, order eligibility,<br/>total usage limit, per-customer usage limit
  Note over Validate: BR-PRM-01 — every configured condition, checked together.<br/>E1: an unrecognised code is reported as simply "not valid",<br/>never distinguishing never-existed from expired from<br/>exhausted, because distinguishing them lets codes be probed.<br/>E3 is the deliberate exception: an unmet minimum or a<br/>missing qualifying category IS stated, because the customer<br/>can act on it.

  alt every condition holds
    Validate->>Validate: calculate the discount, capped at the discountable value
    Note over Validate: BR-PRM-02 — an order total is never negative and the<br/>platform never pays a customer to order (E5). A free-shipping<br/>voucher applies to the fee, not the goods (A4).<br/>BR-PRM-03 — where several promotions are eligible the<br/>stacking policy decides DETERMINISTICALLY (A3), and the<br/>itemisation shows the outcome rather than one merged number.
    Checkout->>Order: record the voucher and its contribution
    Order->>PG: UPDATE ordering_order
    Checkout-->>Next: updated total, discount itemised
  else a condition fails
    Validate-->>Checkout: ineligible, plus the disclosable reason
    Checkout-->>Next: 422 — any voucher already applied is UNCHANGED
    Note over Checkout: A2 — a replacement code is validated BEFORE the current<br/>one is released, so a customer cannot lose a working<br/>discount to a typo.
  end

  opt the customer removes the voucher (A1)
    Customer->>Next: remove
    Next->>Ctl: DELETE /api/v1/checkouts/{checkoutId}/voucher
    Checkout->>Order: reverse the discount and restore the total
  end
```

**Why this validation is not the last one.** Nothing here increments a usage counter, and nothing here is binding. `UC-ORD-05` step 3 re-validates *inside* the placement transaction, because validating once leaves a window in which an exhausted campaign can still be redeemed (E6). The preview and the redemption are different operations against the same aggregate, and [Domain Model §5.2](../Domain%20Model.md) separates them deliberately: the Cart-facing Open Host Service returns a non-binding preview, and only `PromotionRedemptionPort` inside the Partnership binds. The failure that falls out of that gap is [§7 of `06-Fulfilment.md`](./06-Fulfilment.md).

---

## 5. UC-ORD-04 — Review Order Summary

| | |
|---|---|
| **Use cases** | `UC-ORD-04` main success |
| **Business rules** | `BR-CRT-04` · `BR-INV-01` · `BR-ORD-06` · `BR-PRM-01` · `BR-SHP-01` |
| **Quality** | `NFR-PERF-02` |

```mermaid
sequenceDiagram
  autonumber
  actor Customer
  participant Next as Next.js server
  participant Ctl as CheckoutController
  participant Summary as CheckoutSummaryService
  participant Catalog as CatalogQueryService
  participant Inventory as InventoryQueryService
  participant Validate as VoucherValidationService
  participant Quote as ShippingQuoteService
  participant Order

  Customer->>Next: open the summary
  Next->>Ctl: GET /api/v1/checkouts/{checkoutId}/summary
  Note over Next,Ctl: request pipeline — 00-Overview.md §2
  Ctl->>Summary: summarise(checkoutId, correlationId)

  Summary->>Catalog: re-price every line at the CURRENT price
  Catalog-->>Summary: Money per line
  Summary->>Inventory: re-check availability for every line
  Inventory-->>Summary: available quantity per SKU (still advisory)
  Summary->>Validate: re-validate any applied voucher
  Validate-->>Summary: still valid, or the reason it is not
  Summary->>Quote: confirm the fee is current for this address and option
  Quote-->>Summary: fee and delivery estimate
  Summary->>Order: load the frozen snapshot so far
  Order-->>Summary: lines, addresses, method

  alt nothing changed since the customer last looked
    Summary-->>Next: lines, unit and line prices, itemised discounts,<br/>shipping fee, total payable, address, estimate, method
    Next-->>Customer: present the summary
    Customer->>Next: confirm — proceed to UC-ORD-05
  else something changed
    Summary-->>Next: the change, stated explicitly, plus a required re-confirmation
    Note over Summary: E1 a price moved · E2 stock fell below the line quantity ·<br/>E3 the voucher lapsed · E4 the fee changed · E5 nothing is<br/>purchasable any more. In every case the platform states<br/>what changed and requires an EXPLICIT re-confirmation.<br/>BR-ORD-06 — the customer is never charged a price they<br/>were not shown.
  end
```

**Why four checks that all ran a moment ago run again.** Each of them can go stale between the step that set it and this one, and each has a different owner: prices move in Catalog, stock moves in Inventory, campaigns lapse in Promotion, fees move with the address in Shipping. A summary is a promise about a total, and the four inputs to that total are owned by four contexts that do not coordinate.

**Why this is still not enough.** Every check here is a read without a lock, so the summary can go stale the instant it is rendered — E2 says so explicitly. Reserving stock here to prevent that would strand inventory for every customer who reads a summary and leaves. The design accepts a stale summary and resolves it under a lock at placement, which is why `UC-ORD-05` re-runs all of this a *third* time. That is not redundancy; it is the only point at which the check and the state change are atomic.

---

## 6. UC-ORD-05 — Place Order

**The most important diagram in this repository.** Everything inside the tinted frame commits together or not at all, and that single property is what answers `P7` and `P8`.

| | |
|---|---|
| **Use cases** | `UC-ORD-05` main success · `UC-INV-01` · `UC-PRM-03` · `UC-AUD-03` |
| **Business rules** | `BR-ORD-01` · `BR-ORD-02` · `BR-ORD-03` · `BR-ORD-06` · `BR-INV-01` · `BR-PRM-01` |
| **Quality** | `NFR-REL-01` · `NFR-REL-02` · `NFR-REL-06` · `NFR-PERF-02` |
| **Decisions** | [ADR-0005](../../01-system/ADR/ADR-0005-clean-architecture-ports-and-adapters.md) · [ADR-0011](../../01-system/ADR/ADR-0011-optimistic-locking-reservation-model.md) · [ADR-0012](../../01-system/ADR/ADR-0012-transactional-outbox-and-kafka.md) · [ADR-0016](../../01-system/ADR/ADR-0016-jwt-refresh-rotation-rbac.md) · [ADR-0025](../../01-system/ADR/ADR-0025-httponly-cookie-session.md) |
| **Problems** | `P6` · `P7` · `P8` |
| **Failure paths** | §7 · §8 · §9 |

```mermaid
sequenceDiagram
  autonumber
  actor Customer
  participant Next as Next.js server
  participant NGINX as nginx
  participant Ctl as OrderController
  participant PlaceOrder as PlaceOrderService
  participant StockPort as StockReservationPort
  participant PromoPort as PromotionRedemptionPort
  participant Order
  participant Outbox as OutboxRepository
  participant Authz as AuthorizationService
  participant ReserveStock as ReserveStockService
  participant StockItem
  participant RedeemPromo as RedeemPromotionService
  participant Promotion
  participant PG as PostgreSQL

  Customer->>Next: confirm the summary (UC-ORD-04 step 6)
  Note over Next: ADR-0025 — the browser holds only an httpOnly cookie.<br/>No access token is ever present in client JavaScript.
  Next->>NGINX: POST /api/v1/orders<br/>Authorization: Bearer «access»<br/>Idempotency-Key: «client uuid»<br/>X-Correlation-Id: «cid»
  Note over NGINX,Ctl: request pipeline — 00-Overview.md §2
  NGINX->>Ctl: POST /api/v1/orders
  Ctl->>PlaceOrder: place(command, idempotencyKey, correlationId)

  Note over Customer,PG: AUTHORISATION AND IDEMPOTENCY — before any state changes
  PlaceOrder->>Authz: authorise(actor, ORDER_PLACE, own)
  Authz-->>PlaceOrder: permitted
  PlaceOrder->>PG: SELECT ordering_idempotency_key WHERE key = ?
  PG-->>PlaceOrder: no prior record
  Note over PlaceOrder: BR-ORD-03 — a prior record returns the ORIGINAL response<br/>verbatim and creates no second order. See §8.

  rect rgba(124,92,255,0.08)
    Note over PlaceOrder,PG: ONE PostgreSQL transaction — BR-ORD-02
    PlaceOrder->>PG: INSERT ordering_idempotency_key<br/>a unique constraint claims the key
    PlaceOrder->>PlaceOrder: re-price every line at the current price
    Note over PlaceOrder: BR-ORD-06, BR-CRT-04 — prices are frozen into the<br/>order here and never re-derived afterwards.

    opt a voucher was applied at UC-ORD-03
      PlaceOrder->>PromoPort: redeem(voucherCode, subtotal)
      PromoPort->>RedeemPromo: through the in-process PromotionAdapter
      RedeemPromo->>Promotion: incrementUsage()
      Promotion->>PG: UPDATE promotion_promotion SET usage_count = ?,<br/>version = version + 1 WHERE id = ? AND version = ?
      PG-->>Promotion: 1 row updated
      RedeemPromo-)PromoPort: PromotionRedeemed
      RedeemPromo-->>PromoPort: Discount(Money)
      Note over RedeemPromo: The BINDING redemption. UC-ORD-03's preview was not.<br/>Zero rows updated is 06-Fulfilment.md §7.
    end

    loop for every order line
      PlaceOrder->>StockPort: reserve(sku, warehouseId, quantity)
      StockPort->>ReserveStock: through the in-process InventoryStockAdapter
      ReserveStock->>StockItem: reserve(quantity)
      StockItem->>PG: UPDATE inventory_stock_item SET quantity_reserved = ?,<br/>version = version + 1 WHERE id = ? AND version = ?
      PG-->>StockItem: 1 row updated
      ReserveStock-)StockPort: StockReserved
      ReserveStock-->>StockPort: StockReservationId, status Held
    end
    Note over StockPort: available = onHand minus reserved, derived and never stored,<br/>so no code path can write an inconsistent pair of counters.<br/>BR-INV-01 holds by construction: a stale-read write matches<br/>zero rows and cannot commit (ADR-0011). Contention is §7.

    PlaceOrder->>Order: create(frozen OrderLines, address snapshots,<br/>reservationIds, discount)
    Order->>Order: DRAFT to PENDING_PAYMENT (BR-ORD-01)
    Order->>PG: INSERT ordering_order, ordering_order_line
    PlaceOrder->>Outbox: append(OrderCreated, correlationId)
    Outbox->>PG: INSERT ordering_outbox
    Note over Outbox: ADR-0012 — the outbox row is written in the SAME<br/>transaction as the business change, which is what makes<br/>P6 unreachable rather than merely unlikely.
  end

  Note over Customer,PG: COMMIT — nothing below this line can un-place the order
  PlaceOrder-->>Ctl: OrderPlaced(orderId, PENDING_PAYMENT)
  Ctl-->>NGINX: 201 Created<br/>Location: /api/v1/orders/{orderId}
  NGINX-->>Next: 201 Created
  Next-->>Customer: render the confirmation page
  PlaceOrder->>PlaceOrder: empty the cart, best effort
  Note over PlaceOrder: E10 — outside the transaction. A stale cart is cosmetic,<br/>an unplaced order is not.
  Note over PlaceOrder,PG: The relay then publishes OrderCreated to<br/>ecp.ordering.order.v1 — 00-Overview.md §3 — reaching<br/>Payment (03-Payment.md §2), Notification, Audit,<br/>Reporting, and Catalog.<br/>E8 — if publication fails the order STANDS and the relay<br/>retries. The event is never dropped (NFR-REL-06).
```

### 6.1 Why the ordering inside the frame is what it is

**The idempotency claim comes first, and inside the transaction.** Reading the key outside the transaction (the `SELECT` above the frame) is a fast path, not the guarantee — two simultaneous requests can both read "no prior record". The guarantee is the `INSERT` against a unique constraint *inside* the frame: exactly one of the two commits, and the loser retries and finds the original. `NFR-REL-02` requires idempotency to hold under concurrent submission, which a read-then-act check cannot provide.

**Re-pricing precedes reservation.** A price is cheap to compute and cannot fail on contention; a reservation is expensive and can. Doing the fallible, contended work last means a re-price that changes the total aborts before any stock has been held.

**Promotion redemption precedes stock reservation.** Both are optimistically locked and either can lose. Promotion is redeemed first because a promotion aggregate is a *single row* under campaign-wide contention, while stock reservations are per-SKU and per-warehouse — losing the cheaper, more contended race first avoids holding N stock reservations open while waiting to discover that the voucher is exhausted.

**Order creation precedes the outbox write, and both are inside.** The order must exist before an event can name its id. And the outbox row must be inside, because [`ADR-0012`](../../01-system/ADR/ADR-0012-transactional-outbox-and-kafka.md)'s entire value is that the fact and its announcement share a commit. Move the outbox `INSERT` one line below the frame and `P6` becomes reachable: an order exists that Payment, Notification, and Reporting never hear about.

**Payment is not in the frame at all.** It cannot be — the provider is a party the platform does not control and its call can hang for as long as it likes. Holding a database transaction open across a third-party network call would convert every provider slowdown into database connection exhaustion. That is why `OrderCreated` leaves through the outbox and Payment is a separate transaction reached only after this one committed, and it is why an order can legitimately sit in `PENDING_PAYMENT`.

**What the two ports buy.** [`ADR-0005`](../../01-system/ADR/ADR-0005-clean-architecture-ports-and-adapters.md) §4 gives Ordering ownership of `StockReservationPort` and `PromotionRedemptionPort` even though Inventory and Promotion satisfy them. Today both adapters are in-process and join this transaction. After a future extraction they become Saga-capable adapters against remote services, and *this diagram is the thing that changes* — the frame stops being one transaction and becomes a compensating-action sequence. Naming that boundary now is what makes the extraction a boundary-preserving change rather than a rewrite, and [Module Dependency Diagram §3.1](../Module%20Dependency%20Diagram.md) explains why the adapters live in `ordering.infrastructure` rather than the other way round.

---

## 7. Failure — Two Placements Race for the Last Units

`P8`, in the only form it actually occurs. This is not an error case: it is the ordinary outcome of a flash sale, and it happens most at peak revenue.

| | |
|---|---|
| **Use case** | `UC-ORD-05` E1, E2 · `UC-INV-01` E1 |
| **Business rules** | `BR-INV-01` · `BR-INV-02` |
| **Quality** | `NFR-REL-03` · `NFR-SCAL-06` |
| **Decisions** | [ADR-0011](../../01-system/ADR/ADR-0011-optimistic-locking-reservation-model.md) · [ADR-0015](../../01-system/ADR/ADR-0015-redis-cache-and-rate-limiting.md) |
| **Problems** | `P8` |

```mermaid
sequenceDiagram
  autonumber
  actor CustA as Customer A
  actor CustB as Customer B
  participant PlaceA as PlaceOrderService (request A)
  participant PlaceB as PlaceOrderService (request B)
  participant Redis
  participant ReserveStock as ReserveStockService
  participant StockItem
  participant PG as PostgreSQL

  Note over CustA,PG: One unit of the SKU remains. onHand = 5, reserved = 4, version = 41
  CustA->>PlaceA: place order, quantity 1
  CustB->>PlaceB: place order, quantity 1

  opt the SKU is a DESIGNATED flash-sale SKU
    PlaceA->>Redis: DECR the pre-filter counter
    Redis-->>PlaceA: still above zero, continue
    PlaceB->>Redis: DECR the pre-filter counter
    Redis-->>PlaceB: still above zero, continue
    Note over Redis: ADR-0011 — advisory in ONE direction only. It may reject<br/>early so PostgreSQL sees contention proportional to<br/>remaining stock rather than to traffic. It may NEVER<br/>authorise a sale, and every request it admits still passes<br/>the versioned check below. It is a second place stock is<br/>represented, and that one-directional contract is the only<br/>thing keeping it from becoming a source of truth.
  end

  rect rgba(124,92,255,0.08)
    Note over PlaceA,PG: transaction A
    PlaceA->>ReserveStock: reserve(sku, warehouse, 1)
    ReserveStock->>StockItem: read — version 41, available 1
  end
  rect rgba(124,92,255,0.08)
    Note over PlaceB,PG: transaction B — interleaved, same instant
    PlaceB->>ReserveStock: reserve(sku, warehouse, 1)
    ReserveStock->>StockItem: read — version 41, available 1
  end

  Note over CustA,PG: BOTH have read the same version. Only one can commit.
  PlaceA->>PG: UPDATE inventory_stock_item SET quantity_reserved = 5,<br/>version = 42 WHERE id = ? AND version = 41
  PG-->>PlaceA: 1 row updated — COMMIT
  PlaceA-->>CustA: 201 Created, order placed

  PlaceB->>PG: UPDATE inventory_stock_item SET quantity_reserved = 5,<br/>version = 42 WHERE id = ? AND version = 41
  PG-->>PlaceB: 0 rows updated — the version moved
  Note over PlaceB: This is the whole mechanism. A stale-read write matches<br/>zero rows, so the transaction cannot commit and no second<br/>reservation exists. BR-INV-01 holds by CONSTRUCTION, not<br/>by a check that could be forgotten.

  loop bounded retry with jitter — the bound is configuration
    PlaceB->>StockItem: re-read — version 42, available 0
    StockItem-->>PlaceB: insufficient
  end
  PlaceB-->>CustB: 409 ECP-INV-4091 — the shortfall and the quantity<br/>available for each short line
  Note over CustB: The whole of transaction B rolled back: no order, no<br/>reservation, no promotion redemption, no outbox row, and<br/>the idempotency key released. The cart is intact.<br/>Losing a race for scarce stock is a FAR better outcome<br/>than confirming an order the business must cancel later.
```

**Why optimistic locking rather than a lock or a queue.** Pessimistic row locks serialise every checkout on a hot SKU, including the many that would have succeeded, and hold a lock across application logic. A queue makes placement asynchronous, which breaks the synchronous confirmation the customer is waiting for. Optimistic locking makes the *uncontended* path — the overwhelming majority — cost nothing, and pays only where two writers genuinely collide. [`ADR-0011`](../../01-system/ADR/ADR-0011-optimistic-locking-reservation-model.md) §3 weighs all three.

**What this costs, stated honestly.** Retry storms under single-SKU contention are the mechanism's worst case, and they coincide exactly with peak revenue. The Redis pre-filter mitigates it for SKUs someone *designated* in advance; an unanticipated viral product gets no such protection and will see elevated retry-exhaustion rejections. Retry exhaustion must therefore be a monitored signal, not a silent `500`. And the rejection above is a real conversion loss suffered by a customer who had already committed intent — which is why the response distinguishes `ECP-INV-4091` ("someone took the last one, retrying may work") from a generic checkout error. [Integration Contract §4.4](../../04-shared/Integration%20Contract.md) makes that an expected outcome under load rather than a failure.

**Why `available` is derived and never stored.** Storing `availableQuantity` alongside `quantityOnHand` and `quantityReserved` creates three numbers that can disagree. Deriving it means no code path can write an inconsistent pair, and the version check protects the one authoritative row.

---

## 8. Failure — Duplicate Submission

| | |
|---|---|
| **Use case** | `UC-ORD-05` E4 |
| **Business rules** | `BR-ORD-03` |
| **Quality** | `NFR-REL-02` |
| **Decisions** | [ADR-0003](../../01-system/ADR/ADR-0003-rest-api-style.md) · [ADR-0011](../../01-system/ADR/ADR-0011-optimistic-locking-reservation-model.md) |
| **Problems** | `P7` |

```mermaid
sequenceDiagram
  autonumber
  actor Customer
  participant Next as Next.js server
  participant Ctl as OrderController
  participant PlaceOrder as PlaceOrderService
  participant PG as PostgreSQL

  Customer->>Next: confirm (double click, or the client retries after a timeout)
  Next->>Ctl: POST /api/v1/orders — Idempotency-Key: K
  Ctl->>PlaceOrder: place(command, K)
  rect rgba(124,92,255,0.08)
    Note over PlaceOrder,PG: transaction 1
    PlaceOrder->>PG: INSERT ordering_idempotency_key K
    PG-->>PlaceOrder: inserted
    PlaceOrder->>PG: reserve stock, create the order, write the outbox row
  end
  PlaceOrder->>PG: store the response body and status against K
  PlaceOrder-->>Ctl: 201 Created, order ORD-000184213

  Note over Customer,PG: THE SECOND SUBMISSION — same key, same body
  Next->>Ctl: POST /api/v1/orders — Idempotency-Key: K
  Ctl->>PlaceOrder: place(command, K)
  PlaceOrder->>PG: SELECT ordering_idempotency_key K
  PG-->>PlaceOrder: found, with the stored response
  PlaceOrder-->>Ctl: the ORIGINAL 201 and body, verbatim
  Note over PlaceOrder: No second order. No second reservation. No second<br/>outbox row. BR-ORD-03 — repeated submission of the same<br/>confirmed checkout yields the same single order.

  Note over Customer,PG: TWO SUBMISSIONS AT THE SAME INSTANT
  par request 1
    PlaceOrder->>PG: INSERT ordering_idempotency_key K
    PG-->>PlaceOrder: inserted — proceeds
  and request 2
    PlaceOrder->>PG: INSERT ordering_idempotency_key K
    PG-->>PlaceOrder: unique constraint violation
    PlaceOrder->>PlaceOrder: block briefly, then re-read
    PlaceOrder->>PG: SELECT the stored response for K
    PG-->>PlaceOrder: request 1's response
    PlaceOrder-->>Ctl: the same response
  end
  Note over PlaceOrder: NFR-REL-02 requires idempotency to hold under CONCURRENT<br/>submission. A read-then-act check cannot deliver that —<br/>the unique constraint is what makes exactly one win.

  Note over Customer,PG: SAME KEY, DIFFERENT BODY
  Next->>Ctl: POST /api/v1/orders — Idempotency-Key: K, altered body
  Ctl-->>Next: 409 ECP-ORD-4090
  Note over Ctl: A client defect, surfaced rather than masked. Returning<br/>the original response here would hide a real bug.
```

**Why idempotency is a separate mechanism from optimistic locking.** They solve different problems and neither substitutes for the other. Optimistic locking prevents *overselling* — two writers changing the same row from the same read. It does nothing about a single customer submitting twice, because both submissions are perfectly legal writes against different rows. `BR-ORD-03` needs a claim on the *intention*, which is what the `Idempotency-Key` and its unique constraint provide. [`ADR-0011`](../../01-system/ADR/ADR-0011-optimistic-locking-reservation-model.md) §4 states this separation explicitly.

**Why the key is scoped rather than global.** [`ADR-0003`](../../01-system/ADR/ADR-0003-rest-api-style.md) §4 requires `Idempotency-Key` on order placement and payment initiation only — the operations whose repetition is a business defect. Applying it everywhere would impose a storage and retention cost on every `GET` and every naturally idempotent `PUT` for no benefit. Keys are retained at least 24 hours; one reused after expiry is treated as new.

---

## 9. Failure — Something Breaks Between Reservation and Order Creation

The case `BR-ORD-02` exists for, and the clearest statement of `P7` in the system.

| | |
|---|---|
| **Use case** | `UC-ORD-05` E5 |
| **Business rules** | `BR-ORD-02` · `BR-INV-02` |
| **Quality** | `NFR-REL-01` |
| **Decisions** | [ADR-0002](../../01-system/ADR/ADR-0002-modular-monolith-deployment-unit.md) · [ADR-0011](../../01-system/ADR/ADR-0011-optimistic-locking-reservation-model.md) |
| **Problems** | `P7` |

```mermaid
sequenceDiagram
  autonumber
  actor Customer
  participant PlaceOrder as PlaceOrderService
  participant StockPort as StockReservationPort
  participant StockItem
  participant Promotion
  participant Order
  participant Outbox as OutboxRepository
  participant PG as PostgreSQL

  Customer->>PlaceOrder: place order
  rect rgba(124,92,255,0.08)
    Note over PlaceOrder,PG: ONE PostgreSQL transaction
    PlaceOrder->>Promotion: redeem the voucher
    Promotion->>PG: UPDATE promotion_promotion — usage incremented
    PlaceOrder->>StockPort: reserve line 1
    StockPort->>StockItem: Held
    StockItem->>PG: UPDATE inventory_stock_item — reserved incremented
    PlaceOrder->>StockPort: reserve line 2
    StockPort->>StockItem: Held
    StockItem->>PG: UPDATE inventory_stock_item — reserved incremented
    PlaceOrder->>Order: create the order
    Order->>PG: INSERT ordering_order
    Note over Order,PG: FAILURE HERE — a constraint violation, a lost connection,<br/>a process crash, an unhandled exception
    PG-->>PlaceOrder: transaction aborted
  end

  PG->>PG: ROLLBACK
  Note over PG: Every write above is undone by the SAME rollback:<br/>the promotion usage counter, both stock reservations,<br/>the partial order row, and the idempotency key.<br/>There is nothing to compensate because nothing committed.

  PlaceOrder-->>Customer: 500 with the correlation id — no order, no held stock
  Note over Customer: Failure postcondition, met exactly: no order is confirmed<br/>and no stock remains reserved. The cart is intact and the<br/>customer can retry with a new idempotency key.
```

**Why this needs no compensating logic.** This is the payoff for [`ADR-0002`](../../01-system/ADR/ADR-0002-modular-monolith-deployment-unit.md)'s choice of a modular monolith over services. Ordering, Inventory, and Promotion write to one PostgreSQL instance in one transaction, so the database's rollback *is* the compensation. `UC-INV-01` E3 needs no code at all. Split these three contexts into separate services with separate databases and this diagram becomes a saga: a reservation that must be explicitly released, a promotion counter that must be explicitly decremented, and a compensating action for each that can itself fail — with a new class of bug where the compensation is lost and stock stays held forever.

**What this costs later.** [`ADR-0002`](../../01-system/ADR/ADR-0002-modular-monolith-deployment-unit.md) commits to keeping extraction a boundary-preserving change, and the ports in §6 are the seam. But the honest statement is that extracting Inventory or Promotion turns this rollback into a saga, and *that* is the real cost of extraction — not the wiring. The ports make it tractable; they do not make it free. [`Module Dependency Diagram.md`](../Module%20Dependency%20Diagram.md) §3.1 records the same trade-off from the dependency side.

**Why a partial failure is worse than a total one.** An order recorded without stock is a promise the warehouse cannot keep; stock held without an order is invisible loss that no report shows. Both are resolved by hand, and `P7` names the cost. A clean `500` that the customer can retry is strictly better than either.

---

## 10. UC-ORD-10 — Advance Order Status

| | |
|---|---|
| **Use cases** | `UC-ORD-10` main success · `UC-INV-03` · `UC-AUD-01` |
| **Business rules** | `BR-ORD-01` · `BR-INV-02` · `BR-AUD-01` · `BR-AUD-02` |
| **Quality** | `NFR-REL-01` · `NFR-OBS-01` |
| **Problems** | `P5` · `P7` · `P17` |

```mermaid
sequenceDiagram
  autonumber
  actor Staff
  participant Ctl as OrderController
  participant Advance as AdvanceOrderStatusService
  participant Authz as AuthorizationService
  participant Order
  participant StockPort as StockReservationPort
  participant Audit as AuditListener
  participant Outbox as OutboxRepository
  participant PG as PostgreSQL

  Staff->>Ctl: POST /api/v1/orders/{orderId}/status-transitions<br/>target PACKED
  Note over Ctl: The Scheduler (A3), a payment result (A2), and a carrier<br/>event (A1) enter the SAME service below, not a parallel one.
  Ctl->>Advance: advance(orderId, targetState, actor, correlationId)

  Advance->>Authz: authorise(actor, ORDER_ADVANCE, targetState)
  Authz-->>Advance: permitted
  Note over Authz: E2, P16 — approving a refund and packing a box are<br/>different authorities. A denial is recorded, not silent.

  Advance->>Order: load, then check the transition against srs.md §5.3
  Order-->>Advance: PROCESSING, and PACKED is legal from it
  Note over Order: BR-ORD-01, E1, P5 — this holds whatever the actor's role.<br/>An Administrator cannot move an order from DRAFT to<br/>DELIVERED, because the state machine is a property of the<br/>platform, not a convention of one interface. The same check<br/>runs for the admin console, the Scheduler, and a webhook.

  rect rgba(124,92,255,0.08)
    Note over Advance,PG: ONE PostgreSQL transaction — state and side effect move together
    Advance->>Order: PROCESSING to PACKED
    Order->>PG: UPDATE ordering_order SET status, version = version + 1<br/>WHERE id = ? AND version = ?
    PG-->>Order: 1 row updated
    Advance->>StockPort: commit the reservations, Held to Committed
    StockPort->>PG: UPDATE inventory_stock_item — onHand decremented
    Advance-)Audit: actor, transition, timestamp, reason
    Audit->>PG: INSERT audit_entry, append-only
    Advance->>Outbox: append(OrderPacked, correlationId)
    Outbox->>PG: INSERT ordering_outbox
  end

  Note over Staff,PG: COMMIT
  Advance-->>Ctl: 200 OK, new state PACKED
  Note over Advance,PG: The relay publishes OrderPacked, which reaches Shipping<br/>(06-Fulfilment.md §2), Notification, Audit, and Reporting.<br/>E6 — the transition STANDS if publication fails, and the<br/>relay retries. See 00-Overview.md §3.
```

**Why the side effect is inside the frame.** E3 is unambiguous: a `PROCESSING → PACKED` that advances the order but fails to commit the reservation leaves stock the platform believes it still holds. That is `P7` again in a quieter form — no customer sees it, and no report shows it, which makes it worse rather than better. State and side effect move together or neither moves.

**Why the audit entry is inside too.** E4 states that a transition whose audit entry cannot be written is *not applied*. This is the one place where an audit failure blocks a business operation, and it is deliberate: `P17` exists because an unattributable change to an order is not acceptable at any price. Everywhere else audit is a Kafka consumer and cannot block anything.

**Why one service handles four kinds of trigger.** Staff, the Scheduler, a payment result, and a carrier webhook all advance orders. Routing them through one application service is what makes `BR-ORD-01` hold uniformly — `P5`'s requirement that no rule lives only behind a human-initiated entry point. The `Scheduler (Time)` actor in [Solution Architecture §4](../../01-system/Solution%20Architecture.md) is a first-class trigger for exactly this reason.

**Concurrency.** E5 is handled by the same `@Version` mechanism as stock: two actors advancing one order both read the same version, one commits, and the other is re-evaluated against the new state and declines as E1 if it is no longer legal. A bulk advance (A4) evaluates and applies each order independently, so one illegal transition neither fails the batch nor leaves the rest half-applied.

---

## 11. UC-ORD-08 — Cancel Order

| | |
|---|---|
| **Use cases** | `UC-ORD-08` main success · `UC-INV-02` · `UC-PAY-06` |
| **Business rules** | `BR-ORD-01` · `BR-ORD-04` · `BR-INV-02` · `BR-PAY-02` |
| **Quality** | `NFR-REL-01` |
| **Problems** | `P7` |

```mermaid
sequenceDiagram
  autonumber
  actor Customer
  participant Ctl as OrderController
  participant Cancel as CancelOrderService
  participant Authz as AuthorizationService
  participant Order
  participant StockPort as StockReservationPort
  participant Audit as AuditListener
  participant Outbox as OutboxRepository
  participant PG as PostgreSQL
  participant Kafka
  participant Payment

  Customer->>Ctl: POST /api/v1/orders/{orderId}/cancellation
  Ctl->>Cancel: cancel(orderId, actor, reason, correlationId)
  Cancel->>Authz: authorise — the caller owns the order, or holds Support
  Authz-->>Cancel: permitted
  Note over Authz: A2 — a Support cancellation is authorised by ROLE, and<br/>the audit entry records the agent and the reason (P17).

  Cancel->>Order: is the current state cancellable?
  Order-->>Cancel: PAID — legal per BR-ORD-04
  Note over Order: BR-ORD-04 permits DRAFT, PENDING_PAYMENT, PAYMENT_FAILED,<br/>PAID, PROCESSING. E1 — once PACKED the goods are<br/>committed and the remedy is a return, not a cancellation.<br/>E2 — an already-cancelled order reports success WITHOUT<br/>acting again, because releasing a reservation twice would<br/>inflate available stock.

  rect rgba(124,92,255,0.08)
    Note over Cancel,PG: ONE PostgreSQL transaction
    Cancel->>Order: to CANCELLED (BR-ORD-01)
    Order->>PG: UPDATE ordering_order — version checked
    Cancel->>StockPort: release the reservations, Held to Released
    StockPort->>PG: UPDATE inventory_stock_item — reserved decremented
    Cancel-)Audit: actor, reason, timestamp
    Cancel->>Outbox: append(OrderCancelled, correlationId)
    Outbox->>PG: INSERT ordering_outbox
  end

  Note over Customer,Payment: COMMIT — the customer's request is honoured from here on
  Cancel-->>Ctl: 200 OK, CANCELLED

  opt payment had been captured
    Outbox--)Kafka: OrderCancelled
    Kafka--)Payment: initiate a refund (03-Payment.md §5)
    Payment--)Kafka: PaymentRefunded
    Kafka--)Order: CANCELLED to REFUNDED
    Note over Payment: E4 — a failed refund leaves the order CANCELLED but NOT<br/>REFUNDED. It stays visibly awaiting refund and is retried.<br/>The discrepancy is never closed by marking it refunded<br/>(BR-PAY-02, P7). A1 — cancelled before payment, no refund<br/>arises and CANCELLED is terminal.
  end
```

**Why the refund is asynchronous but the release is not.** Releasing a reservation is a local row update that belongs in the same transaction as the state change — E3 makes the priority explicit: if the release fails the order is *still* cancelled, because the customer's request is honoured, and the release is retried and escalated. Held-but-unreleasable stock is invisible loss. The refund, by contrast, crosses to a provider the platform does not control, so it takes the same route as every other provider interaction: an event out, a result back, and an order state that reflects reality rather than intention.

**Why a cancellation can lose a race.** E5 — a cancellation and a fulfilment advance can arrive together. Both go through the version check on `Order`, exactly one applies, and if the advance wins and reaches `PACKED` the cancellation fails as E1 and the customer is directed to request a return. This is the same mechanism as §7 and §10, applied a third time: one aggregate, one version column, one winner.

**Partial cancellation** (A4) releases only the affected lines' reservations, adjusts the order total, and refunds any excess capture — bounded by `BR-PAY-02`, which caps cumulative refunds at the amount actually captured.

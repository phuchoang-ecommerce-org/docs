# Sprint 17 — Ordering: Checkout Funnel

**Release:** R1 · **Gate:** **`G8` — Contract Sync** · **Backend 18 pts · Frontend 10 pts**
**Related documents:** [`../release-plan.md`](../release-plan.md) · [`../integration-plan.md`](../integration-plan.md) · [`../../BA-docs/user-stories/06-checkout-order.md`](../../BA-docs/user-stories/06-checkout-order.md) · [`../../SA-docs/03-frontend/Routing.md`](../../SA-docs/03-frontend/Routing.md)

---

## Sprint Goal

> **Checkout collects everything an order needs.**

`ordering` is the module with three cross-context edges, and every one of them now exists: `inventory` since Sprint 11, `cart` since Sprint 13, `promotion` since Sprint 16. This sprint builds the collection phase — nothing here reserves stock, redeems a voucher or takes money. Placement is Sprint 18, deliberately separated, because the partnership transaction deserves a sprint that is about nothing else.

`G8` is the gate the frontend has been waiting three sprints for: `/checkout` and `/checkout/shipping` were built in Sprint 14 and `/checkout/review` in Sprint 15, all against Prism. This is the **longest mock-only stretch in the plan**, and the gate is where it ends.

## Committed Items

| Lane | ID | Item | Pts |
|---|---|---|---:|
| BE | `US-ORD-01` | Initiate Checkout | 5 |
| BE | `US-ORD-02` | Provide Shipping and Billing Information | 5 |
| BE | `US-ORD-03` | Apply Voucher at Checkout | 3 |
| BE | `US-ORD-04` | Review Order Summary | 5 |
| | | **Backend total** | **18** |
| FE | `US-ORD-05` | Place Order | 5 |
| FE | `US-ORD-06` | View Order Details | 5 |
| FE | — | *Lane reserve — see [`../release-plan.md`](../release-plan.md) §6* | *8* |
| | | **Frontend total** | **10** |

The frontend reserve here is 8 points and it is load-bearing: [`../release-plan.md`](../release-plan.md) §4 states it **absorbs any backend slip from the preceding four sprints**.

---

## Backend Lane

### `US-ORD-01` Initiate Checkout (5 pts) — `initiateCheckout`, `getCurrentCheckout`
- [ ] `Checkout` aggregate and the `ordering` Flyway migration; the module scaffold has existed since Sprint 05's `listOrders`
- [ ] `E1` — an empty cart is declined. `ECP-ORD-4220`, documented as **never retry**
- [ ] `E2` — no purchasable line is declined with each unpurchasable line identified; `ECP-ORD-4220`
- [ ] **`E3` — some lines unpurchasable: checkout proceeds only after the customer explicitly removes or reduces them.** The platform never silently drops a line from an order about to be paid for
- [ ] `E4` — an unverified account is declined with a verification resend offered, and **the cart is preserved** (`BR-CUS-02`)
- [ ] `E5` — a guest is required to log in or register, guest cart preserved for merge (`UC-CRT-05`, Sprint 14)
- [ ] Cross-module reads go through ports; ArchUnit confirms `ordering` reaches `cart` and `catalog` only by the edges its `allowedDependencies` grants

### `US-ORD-02` Provide Shipping and Billing Information (5 pts) — `setCheckoutShippingAddress`, `setCheckoutBillingInformation`, `selectCheckoutShippingOption`
- [ ] `Address` comes from `shared-kernel`, the same value object Sprint 05 added — not an `ordering`-local copy
- [ ] `E1` — validation names **which field** failed and does not proceed
- [ ] `E2` — an unserved destination is stated plainly with a different address offered; **no fee is quoted that cannot be honoured**
- [ ] **`E3` — a fee that cannot be calculated blocks the order and permits retry. The platform never guesses** (`BR-SHP-01`: the fee shown at confirmation is the fee charged)
- [ ] `E4` — an address changed after quoting **re-calculates** fee and estimate before the summary
- [ ] `E5` — lines that cannot ship to the destination are identified and must be removed or the address changed
- [ ] **`shipping` does not exist until Sprint 20.** `getShippingQuotes` is served here by a provisional `ordering`-side implementation against the contract's shape. Record it as provisional in the Review Notes and carry the real computation to Sprint 20 — do not mark `US-SHP-01` done from here

### `US-ORD-03` Apply Voucher at Checkout (3 pts) — `applyCheckoutVoucher`, `removeCheckoutVoucher`
- [ ] Calls `promotion`'s validation through a port; **no voucher is redeemed at this stage** — redemption happens inside the placement transaction in Sprint 18
- [ ] `E1`/`E2` — non-disclosive failure copy, `ECP-PRM-4220`, exactly as Sprint 15 established. The checkout path must not become a second, more helpful oracle
- [ ] `E3` — an unmet condition **is** named, because it is actionable; `E4` — a reached usage limit reports unavailable
- [ ] `E5` — a discount exceeding the order value is **capped**; the total is never negative (`BR-PRM-02`). `ECP-PRM-4221`
- [ ] `E6` — re-validation at placement is `US-ORD-05`'s `E3`, Sprint 18. Carried forward with that named sprint

### `US-ORD-04` Review Order Summary (5 pts) — `getOrderSummary`
- [ ] The summary is assembled from lines, discounts and shipping fee, with **every amount server-computed**. `E6` of `UC-PRM-03` applies: line amounts must sum to the recorded total, or Finance cannot reconcile it (`FR-DAT-01`, `P7`)
- [ ] `E1` — a changed price shows the current value with the change stated and **requires explicit re-confirmation** (`BR-ORD-06`)
- [ ] `E2` — a line short of stock reports the shortfall and requires reduction or removal. Reserving happens at placement, so this check exists here **and again** at `UC-ORD-05`
- [ ] `E3` — a voucher gone invalid is removed, the total change stated, re-confirmation required
- [ ] `E4` — a changed shipping fee is shown and re-confirmed (`BR-SHP-01`)
- [ ] `E5` — every line unpurchasable ends the checkout and returns the customer to the cart
- [ ] The re-confirmation token is real state, not a UI convention — `US-ORD-05` will refuse a placement whose summary was never re-confirmed

---

## Frontend Lane

> Both stories are built against the Prism mock. `placeOrder` lands in **Sprint 18**, `getOrder` in **Sprint 19**.

### `US-ORD-05` Place Order (5 pts) — `/checkout/review`, `/checkout/confirmation/[orderId]`, **R3**
- [ ] **The `Idempotency-Key` is minted once per attempt and reused on any user-initiated retry — never regenerated.** Rule 2 of [`Routing.md`](../../SA-docs/03-frontend/Routing.md) §4.3, and regenerating it is exactly how a duplicate order happens
- [ ] **A timeout is never retried automatically.** The customer is told the outcome is unknown and offered **one explicit retry** (rule 3, [`ADR-0023`](../../SA-docs/01-system/ADR/ADR-0023-server-first-data-fetching.md) §4)
- [ ] `ECP-ORD-4001` (key absent) and `ECP-ORD-4090` (key reused with a different body) are **client defects** — surfaced as such, never masked by silently minting a new key
- [ ] **`ECP-INV-4091` renders as "sold out", visibly different from "try again"** (rule 4). This is the single most-repeated requirement in the source documents and IH-2 row 4
- [ ] `ECP-PRM-4090` fails the voucher field, not the checkout (rule 5)
- [ ] Nothing on this screen is cached and nothing is optimistic (rule 1)
- [ ] `/checkout/confirmation/[orderId]` reads `getOrder`, `listOrderLines`
- [ ] Vitest + axe across placement success, sold-out, voucher-exhausted, timeout, and duplicate-submission paths

### `US-ORD-06` View Order Details (5 pts) — `/account/orders/[orderId]`, **R3**
- [ ] Reads `getOrder`, `listOrderLines`; the `(account)` group's never-cached posture from Sprint 05
- [ ] **`E1` — another customer's order returns `404` and the screen never explains why.** The group `not-found.tsx` Sprint 05 built already implements this; `notFound()` on a `404 ApiProblem` rather than a per-segment copy
- [ ] `E2` — an order referencing a deleted product presents **in full from the values recorded at placement** (`FR-DAT-04`). A catalog change never rewrites a purchase record
- [ ] **`E3` — the placement price is shown, not the current one** (`BR-ORD-06`, `FR-DAT-03`). The order detail is the one screen that must *not* reuse the storefront's current-price rendering
- [ ] Order status rendered through the Sprint 12 `EN-FE-DS-6` discriminated union
- [ ] Hand-written Zod parsers for order and order-line payloads; `loading.tsx`; Vitest + axe

---

## Integration Risk

**Three sprints of frontend checkout work meet a real backend for the first time at `G8`.** `/checkout`, `/checkout/shipping`, `/checkout/payment` and `/checkout/review` were all built against Prism's generated examples. Everything they assume about checkout state shape, re-confirmation semantics and summary composition is unverified until the gate.

The specific trap: **`getShippingQuotes` is provisional this sprint** and `listEligiblePaymentMethods` has no `payment` module behind it until Sprint 21. Both will return contract-shaped placeholders. Record them as expected at `G8` rather than logging them as drift — and record equally that the *shapes* are what the gate checks, not the values.

## Gate `G8` — Contract Sync

Checklist: [`../integration-plan.md`](../integration-plan.md) §3.1, scoped to checkout, plus the promotion increment of Sprint 16.

| # | Check |
|---|---|
| 1 | Types regenerated, diff empty |
| 2 | Contract test **spec→code** across `initiateCheckout`, `getCurrentCheckout`, `setCheckoutShippingAddress`, `setCheckoutBillingInformation`, `selectCheckoutShippingOption`, `applyCheckoutVoucher`, `removeCheckoutVoucher`, `getOrderSummary`, `setPromotionStatus`, `updatePromotion` — now automated by `EN-CONTRACT-1` |
| 3 | Contract test **code→spec** — no undocumented checkout endpoint (still manual; `EN-CONTRACT-2` is Sprint 25) |
| 4 | `/checkout`, `/checkout/shipping`, `/checkout/payment`, `/checkout/review` and `/admin/promotions/[promotionId]` render against the real API |
| 5 | No new list operation in this increment; confirm `listPromotions` still matches |
| 6 | **Designed screens:** `ECP-ORD-4220` empty/unpurchasable cart · `ECP-PRM-4220` non-disclosive voucher copy, identical across causes · `ECP-PRM-4221` capped discount · unserved destination and uncalculable fee as their own screens, never a generic boundary |
| 7 | Permission matrix: every checkout operation is scoped to the owning customer; another customer's checkout is `404`, never `403` |
| 8 | **`Money` across the whole summary is a string and every amount is server-computed** — subtotal, discount, shipping fee, total. **Line amounts sum to the recorded total** |
| 9 | One correlation id across browser → API on a checkout write |
| 10 | Drift logged **and** `openapi.yaml` amended in the same session |
| — | **Recorded as expected, not drift:** `getShippingQuotes` is provisional until Sprint 20; `listEligiblePaymentMethods` has no `payment` module until Sprint 21; `placeOrder` does not exist until Sprint 18 |

## Definition of Done

Every item satisfies its lane's list in [`../definition-of-done.md`](../definition-of-done.md) §3 or §4, and every story reaches §5.

## Review Notes

<!-- filled at Sprint Review -->

## Retrospective

**Went well:**
**Change one thing:**
**Action (owned, carried to next sprint's board):**

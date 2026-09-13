# Sprint 13 — Cart: Lines & Guest Cart

**Release:** R1 · **Gate:** **`G6` — Contract Sync** · **Backend 20 pts · Frontend 13 pts**
**Related documents:** [`../release-plan.md`](../release-plan.md) · [`../integration-plan.md`](../integration-plan.md) · [`../../BA-docs/user-stories/05-cart-wishlist.md`](../../BA-docs/user-stories/05-cart-wishlist.md) · [`../../SA-docs/03-frontend/Routing.md`](../../SA-docs/03-frontend/Routing.md)

---

## Sprint Goal

> **A guest can build a cart.**

"Guest" is the load-bearing word. A cart that only works for signed-in customers is a shorter sprint and a worse funnel — most carts begin before anyone has an account. So `EN-WIRE-4`'s cookie-based identity resolution is committed alongside the four line operations rather than after them, because retrofitting guest identity onto a customer-only cart means rewriting all four.

One rule threads through every story here: **the platform never silently changes what the customer asked for.** Not a capped quantity, not a dropped line, not an honoured stale price. Each exception flow below is a specific instance of it.

## Committed Items

| Lane | ID | Item | Pts |
|---|---|---|---:|
| BE | `US-CRT-01` | Add Item to Cart | 5 |
| BE | `US-CRT-02` | Update Cart Item Quantity | 3 |
| BE | `US-CRT-03` | Remove Item from Cart | 2 |
| BE | `US-CRT-04` | View Cart | 5 |
| BE | `EN-WIRE-4` | Guest-cart cookie handling and cart identity resolution | 5 |
| | | **Backend total** | **20** |
| FE | `US-CRT-01` | Add Item to Cart | 3 |
| FE | `US-CRT-02` | Update Cart Item Quantity | 3 |
| FE | `US-CRT-03` | Remove Item from Cart | 2 |
| FE | `US-CRT-04` | View Cart | 5 |
| FE | — | *Lane reserve — see [`../release-plan.md`](../release-plan.md) §6* | *5* |
| | | **Frontend total** | **13** |

---

## Backend Lane

### `EN-WIRE-4` Guest-cart cookie handling and cart identity resolution (5 pts)
- [ ] One resolution function: a request resolves to a cart by **customer id when authenticated, by guest-cart cookie otherwise** — never by both, never by a header the client can choose
- [ ] The guest cookie is opaque, unguessable, and carries the same posture rules the Sprint 04 session cookie established
- [ ] A guest cart identifier is not a permission: possession of the cookie grants access to that cart and nothing else. A `CUSTOMER`'s cart is never reachable by a guest cookie
- [ ] `BR-CRT-01` — cart lifetime and expiry semantics defined here, consumed by `US-CRT-06` in Sprint 14
- [ ] The resolution is exercised for both identities on every cart operation below, not only on `getCurrentCart`

### `US-CRT-01` Add Item to Cart (5 pts) — `addCartLine`
- [ ] `E1` — quantity exceeding available stock is **declined**, stating the quantity actually available and offering it. `ECP-CRT-4090`. **Never silently capped** — a shopper who asked for five and receives two discovers it at checkout or on delivery
- [ ] `E2` — a variant unpublished since the page loaded leaves the cart **unchanged** (`BR-CAT-02`)
- [ ] `E3` — a wholly out-of-stock variant is declined and the wishlist offered, so the intent is captured. **`US-CRT-07` is Sprint 31** — return the outcome the contract defines and carry the wishlist offer forward with a named sprint
- [ ] `E4` — a cart expired mid-session creates a new cart and **adds the line anyway**, telling the visitor. The addition is not lost to housekeeping
- [ ] `BR-CRT-04` — the line carries no price of its own; price is read at view time

### `US-CRT-02` Update Cart Item Quantity (3 pts) — `updateCartLineQuantity`
- [ ] `E1` — a new quantity above available stock is declined, the available quantity stated, and **the previous value kept**. `ECP-CRT-4090`
- [ ] `E2` — a line removed in another session reports the line is gone and returns the current cart; it is never resurrected
- [ ] `E3` — a variant unpublished since the line was added declines the increase and marks the line **unpurchasable**

### `US-CRT-03` Remove Item from Cart (2 pts) — `removeCartLine`
- [ ] `E1` — removing an already-removed line reports success. The goal already holds; idempotent, the same shape as Sprint 05's `removeOwnAddress`
- [ ] `E2` — emptying a cart in active checkout **ends the checkout** and returns to the cart (`FR-ORD-01`). `checkout` does not exist until Sprint 17 — implement the cart-side outcome, carry the checkout-side forward with a named sprint

### `US-CRT-04` View Cart (5 pts) — `getCurrentCart`, `getCart`
- [ ] Lines priced at the **current** catalog price, per `BR-CRT-04` — the cart stores intent, not a quotation
- [ ] **`E1` — a risen price is presented at the new, higher value with the change stated explicitly.** The old price is never honoured silently, and the increase is never applied silently either (`BR-ORD-06`)
- [ ] `E2` — a line short of stock is **marked short with the available quantity**; the quantity is not adjusted for the customer
- [ ] `E3` — an unpublished variant's line is marked unpurchasable and **not removed automatically**, so the customer sees what was lost
- [ ] `E4` — an expired cart returns an empty cart stating the previous one expired
- [ ] `getCart` is ownership-scoped: another party's cart returns the same `404` a non-existent one does

---

## Frontend Lane

> `/cart` is **R3** per [`Routing.md`](../../SA-docs/03-frontend/Routing.md) §4.2 — server-fetched on load, client cache for in-page editing only.

### `US-CRT-04` View Cart (5 pts) — `/cart`
- [ ] Server-fetched on load; `loading.tsx` skeleton in the shape of the line list
- [ ] **`E1` risen price, `E2` short stock and `E3` unpurchasable are three visibly distinct line treatments** — each states what changed, and none of them silently alters the line
- [ ] `E4` — the expired-cart empty state says the previous cart expired; it is not the generic "your cart is empty"
- [ ] Availability rendered through the Sprint 11 `EN-FE-DS-5` component, not a second implementation
- [ ] Hand-written Zod parsers for cart and cart-line payloads
- [ ] Vitest + axe across the normal, empty, expired, and three degraded line states

### `US-CRT-01` Add Item to Cart (3 pts) — `/p/[productId]`, `/cart`
- [ ] Add-to-cart from the product page; **availability never disables it** (`EN-FE-DS-5`), the server decides
- [ ] `ECP-CRT-4090` renders as "only N available" against **the line**, with the offer to add that quantity — never as a page-level error, and never as an automatic substitution
- [ ] `E2`/`E3` render their own designed outcomes, distinct from `E1`
- [ ] Vitest + axe

### `US-CRT-02` Update Cart Item Quantity (3 pts) — `/cart`
- [ ] **Optimistic quantity edits that revert visibly on failure** — normative in [`Routing.md`](../../SA-docs/03-frontend/Routing.md) §4.2. "Visibly" is the requirement: a silent revert is worse than no optimism
- [ ] `E1` — the revert restores the previous value and states the available quantity
- [ ] Rapid successive edits do not interleave into a wrong final quantity
- [ ] Vitest covering optimistic apply, revert-on-failure, and the rapid-edit sequence

### `US-CRT-03` Remove Item from Cart (2 pts) — `/cart`
- [ ] Removal is optimistic and reverts visibly on failure, same rule as quantity
- [ ] `E1` — an already-removed line resolves to the same end state without an error
- [ ] Vitest + axe

---

## Integration Risk

**Guest identity is the first thing in the plan that Prism cannot model.** The mock issues no guest cookie and enforces no ownership scoping, so every frontend cart path has been exercised against a backend that always says yes. `G6` is the first time cookie resolution, ownership scoping and the expired-cart path meet real behaviour.

Second: optimistic updates against a server that legitimately refuses (`ECP-CRT-4090` is a **normal** outcome, not an error) is the combination most likely to produce a UI that ends up out of step with the server. Check the revert, not just the happy path.

## Gate `G6` — Contract Sync

Checklist: [`../integration-plan.md`](../integration-plan.md) §3.1, scoped to cart, plus the inventory increment of Sprint 12.

| # | Check |
|---|---|
| 1 | Types regenerated, diff empty |
| 2 | Contract test **spec→code** across `addCartLine`, `updateCartLineQuantity`, `removeCartLine`, `getCurrentCart`, `getCart`, `adjustStock`, `listStockAdjustments`, `listStockItems`, `getStockItem`, `listWarehouses` |
| 3 | Contract test **code→spec** — no undocumented cart or inventory endpoint |
| 4 | `/cart`, `/admin/inventory` and `/admin/inventory/[stockItemId]` render against the real API |
| 5 | Pagination envelope and cursor shape match on `listStockItems` and `listStockAdjustments` |
| 6 | **Designed screens, all four:** `ECP-CRT-4090` fails the line with the available quantity, never the page and never a silent cap · risen price stated explicitly · unpurchasable line marked and kept · expired cart's own empty state |
| 7 | **Ownership, server-side:** a second browser's guest cookie cannot read the first's cart — same `404` as a non-existent cart, never a `403` · `listStockItems` refused for `CUSTOMER` and `GUEST` |
| 8 | **`Money` on cart lines and totals is a string and the frontend performs no arithmetic on it** — the cart is the first screen that displays a computed total, and this is the check that catches client-side summing |
| 9 | One correlation id across browser → API on a cart write |
| 10 | Drift logged **and** `openapi.yaml` amended in the same session |
| — | **Exercised by hand, since the mock cannot model it:** guest cookie issued on first add · cart survives a page reload · a signed-in customer and a guest resolve to different carts |

## Definition of Done

Every item satisfies its lane's list in [`../definition-of-done.md`](../definition-of-done.md) §3 or §4, and every story reaches §5.

## Review Notes

<!-- filled at Sprint Review -->

## Retrospective

**Went well:**
**Change one thing:**
**Action (owned, carried to next sprint's board):**

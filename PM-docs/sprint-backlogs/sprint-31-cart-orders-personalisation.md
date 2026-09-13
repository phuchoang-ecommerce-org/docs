# Sprint 31 — Release 3: Cart, Orders & Personalisation

**Release:** R3 · **Gate:** **`G15` — Contract Sync** · **Backend 21 pts · Frontend 15 pts**
**Related documents:** [`../release-plan.md`](../release-plan.md) · [`../integration-plan.md`](../integration-plan.md) · [`../../BA-docs/user-stories/05-cart-wishlist.md`](../../BA-docs/user-stories/05-cart-wishlist.md) · [`../../BA-docs/user-stories/06-checkout-order.md`](../../BA-docs/user-stories/06-checkout-order.md)

---

## Sprint Goal

> **Wishlist, returns, delivery estimates, and personalisation.**

The last five `Should` stories, and the one that closes a loop left open since Sprint 13: **`US-ORD-09` Request Return.** `UC-CRT-01` `E3` has offered the wishlist since Sprint 13 without one existing; `UC-ORD-08` `E1` has directed customers to a return path since Sprint 19 without one existing. Both forward references become real here, and both files recorded them honestly rather than pretending otherwise — this sprint is where that bookkeeping pays off.

Two rules shape the wishlist stories, and both are about **not destroying intent**. `UC-CRT-08` `E1` — an out-of-stock item **stays on the wishlist**, which is exactly where an out-of-stock item belongs. `E3` — if adding to the cart fails, the wishlist entry is **not** removed: ordering the steps this way means a failure costs the customer nothing, and the reverse order would lose the saved intent.

And `US-SCH-07`'s rail is the one place an `R1` route contains dynamic content — **worth naming rather than discovering**, as [`Routing.md`](../../SA-docs/03-frontend/Routing.md) §4.1 puts it.

## Committed Items

| Lane | ID | Item | Pts |
|---|---|---|---:|
| BE | `US-SCH-07` | Receive Personalised Recommendations | 5 |
| BE | `US-CRT-07` | Manage Wishlist | 5 |
| BE | `US-CRT-08` | Move Wishlist Item to Cart | 3 |
| BE | `US-ORD-09` | Request Return | 5 |
| BE | `US-SHP-02` | Estimate Delivery Date | 3 |
| | | **Backend total** | **21** |
| FE | `US-SCH-07` | Receive Personalised Recommendations | 3 |
| FE | `US-CRT-07` | Manage Wishlist | 5 |
| FE | `US-CRT-08` | Move Wishlist Item to Cart | 2 |
| FE | `US-ORD-09` | Request Return | 3 |
| FE | `US-SHP-02` | Estimate Delivery Date | 2 |
| FE | — | *Lane reserve — see [`../release-plan.md`](../release-plan.md) §6* | *3* |
| | | **Frontend total** | **15** |

---

## Backend Lane

### `US-ORD-09` Request Return (5 pts) — `requestOrderReturn`, `getOrderReturnRequest`, `resolveOrderReturn`
- [ ] Closes the path `UC-ORD-08` `E1` has directed customers to since Sprint 19
- [ ] **`E1` — a passed return window declines, stating when it closed.** A Support Agent may override **with a recorded reason** — exactly the discretion `P17` requires to be attributable
- [ ] `E2` — an order not Delivered declines and directs to cancellation (`UC-ORD-08`). **An undelivered order is cancelled, not returned**
- [ ] `E3` — a return already requested for those lines **presents the existing request** rather than creating a second
- [ ] **`E4` — goods that never arrive leave the request open until it lapses**, then closed with the reason recorded. **No refund is issued for goods not received** (`BR-PAY-02`)
- [ ] **`E5` — a failed refund leaves the order Returned but not Refunded**, visibly awaiting refund until retry succeeds (`UC-ORD-08` `E4`). The discrepancy is never closed by marking it refunded
- [ ] The return window derives from delivery confirmation (`BR-ORD-05`), and `UC-SHP-06` `E2` already guarantees a duplicate confirmation does not restart it
- [ ] Transitions go through the Sprint 19 state machine; `resolveOrderReturn` is audited and its authority is separate from cancellation and refund (`P16`)

### `US-CRT-07` Manage Wishlist (5 pts) — `getOwnWishlist`, `addWishlistItem`, `removeWishlistItem`
- [ ] Closes the offer `UC-CRT-01` `E3` has made since Sprint 13
- [ ] **`E1` — an existing entry whose product is unpublished is marked unavailable, not deleted**, so the customer sees what happened. A new save of an unpublished product is declined
- [ ] `E2` — a guest is told a wishlist requires an account, and **the intended item is preserved** so it can be saved immediately after registering or signing in
- [ ] **`E3` — another customer's wishlist is declined and the attempt recorded** (`BR-AUD-02`, `P16`); the same response as one that does not exist
- [ ] A wishlist holds **intent, not a quotation** — no price is stored on an entry (`BR-CRT-04`)

### `US-SCH-07` Receive Personalised Recommendations (5 pts) — `listPersonalisedRecommendations`, `setOwnPersonalisationPreference`
- [ ] **`E1` — unavailable falls back to trending (`UC-SCH-06`) or omits the section. It never falls back to another customer's recommendations** (`BR-SCH-01`, `P16`)
- [ ] `E2` — recommendations derived from a suspended or deleted account omit the section (`BR-AUD-02`)
- [ ] `setOwnPersonalisationPreference` is ownership-scoped absolutely
- [ ] `BR-CAT-02` — unpublished products never appear

### `US-CRT-08` Move Wishlist Item to Cart (3 pts) — `moveWishlistItemsToCart`
- [ ] **`E1` — an out-of-stock item is not moved and stays on the wishlist**, which is where it belongs; a restock notification is offered
- [ ] `E2` — a product unpublished since it was saved declines the move and marks the entry unavailable (`UC-CRT-07` `E1`)
- [ ] **`E3` — if adding to the cart fails, the wishlist entry is not removed.** The step order is deliberate: a failure costs the customer nothing, and the reverse order would lose the saved intent
- [ ] **`E4` — a risen price moves the item and the cart shows the current price with the change stated.** The saved price is never honoured, because a wishlist holds intent, not a quotation (`UC-CRT-04` `E1`, `BR-CRT-04`)

### `US-SHP-02` Estimate Delivery Date (3 pts) — `getShippingQuotes` (estimate)
- [ ] Extends the Sprint 20 quote rather than adding an operation
- [ ] **`E1` — an unavailable estimate lets the order proceed without one** (`NFR-AVAIL-02`). An estimate is useful, not essential, and its absence must never block a purchase
- [ ] `E2` — a carrier revising the estimate after dispatch records the revision and notifies the customer (`UC-SHP-04`); **the original is retained so the difference is visible**
- [ ] `E3` — an estimate outside the carrier's stated service **presents the carrier's stated service** rather than the platform's own computation, and flags the discrepancy for review

---

## Frontend Lane

### `US-CRT-07` Manage Wishlist (5 pts) — `/wishlist`, **R3**
- [ ] `CUSTOMER` only; **a `GUEST` reaching it is redirected to sign-in with a return path** ([`Routing.md`](../../SA-docs/03-frontend/Routing.md) §4.2) — the one place in the plan where a redirect is the designed behaviour rather than the `T9` mistake, because this is authentication, not authorisation
- [ ] `E1` — an unavailable entry is **marked, not hidden**
- [ ] `E2` — a guest adding from a product page is sent to sign-in and **the item is saved on return**, not lost
- [ ] Availability through the Sprint 11 `EN-FE-DS-5` component; `loading.tsx`; hand-written Zod parsers
- [ ] Vitest + axe

### `US-ORD-09` Request Return (3 pts) — `/account/orders/[orderId]/return`, **R3**
- [ ] Reads `getOrderReturnRequest`; writes `requestOrderReturn`. The admin resolution path is `/admin/orders/[orderId]/return` with `resolveOrderReturn`
- [ ] **`E1`/`E2` render as distinct designed screens** — a passed window states when it closed; an undelivered order links to cancellation
- [ ] `E3` — an existing request is **shown**, and the form is not offered a second time
- [ ] **`E5` — a return awaiting refund is shown as awaiting refund**, never as settled — the same treatment Sprint 18 gave `UC-ORD-08` `E4`
- [ ] **Update the Sprint 18 cancel screen**: `UC-ORD-08` `E1` has pointed at Support since then and can now point at this route
- [ ] Vitest + axe

### `US-SCH-07` Receive Personalised Recommendations (3 pts) — `/`, **R2 inside the R1 shell**
- [ ] **The one place an `R1` route contains dynamic content** ([`Routing.md`](../../SA-docs/03-frontend/Routing.md) §4.1). The rail streams into its own boundary as a dynamic section inside a static page
- [ ] **For a `GUEST` the rail is not rendered at all**, so the page stays wholly static
- [ ] **Not above the fold, and the shell never awaits it** — either would make the whole route dynamic and forfeit exactly what [`ADR-0019`](../../SA-docs/01-system/ADR/ADR-0019-nextjs-app-router-rendering-strategy.md) §4 made it static for, and what `P1`'s LCP budget depends on
- [ ] `E1` — unavailable falls back to trending or **disappears silently**
- [ ] Confirm against `EN-FE-PERF-2`'s budget gate that the home page's `R1` class still passes
- [ ] Vitest + axe

### `US-CRT-08` Move Wishlist Item to Cart (2 pts) — `/wishlist`
- [ ] **`E1`/`E3` — a failed move leaves the item visibly on the wishlist.** The optimistic pattern from Sprint 13 applies, and the revert must be visible
- [ ] `E4` — a risen price is stated on arrival in the cart, reusing the Sprint 13 treatment
- [ ] Vitest + axe

### `US-SHP-02` Estimate Delivery Date (2 pts) — `/checkout/shipping`, **R3**
- [ ] The estimate renders beside the quote; **`E1` — its absence changes nothing else on the screen** and never blocks progress
- [ ] `E2` — a revised estimate shows the revision **with the original still visible**
- [ ] Vitest + axe

---

## Integration Risk

**`G15` is the last Contract Sync gate**, and after it only Sprint 32's Release Readiness Review remains. Anything not caught here is caught by a review whose job is to state status, not to find defects.

The specific exposure: `US-ORD-09` and `US-CRT-07` close forward references that have been recorded in Sprint 13's and Sprint 19's files for eighteen and twelve sprints respectively. The copy on those older screens still points at the old destination — Support, or a wishlist that did not exist. **Updating them is part of this sprint**, and nothing in the gate checklist will notice if it is skipped.

Second: `US-SCH-07` is the one dynamic section inside a static page. Get it wrong and the home page silently becomes dynamic — which `EN-FE-PERF-2`'s budget gate should catch, but only if the budgets were set tightly enough in Sprint 28 to distinguish the two.

## Gate `G15` — Contract Sync

Checklist: [`../integration-plan.md`](../integration-plan.md) §3.1, scoped to the Release 3 `Should` stories and the discovery increment of Sprint 30.

| # | Check |
|---|---|
| 1 | Types regenerated, diff empty — CI-enforced since Sprint 24 |
| 2 | Contract test **spec→code** across `getOwnWishlist`, `addWishlistItem`, `removeWishlistItem`, `moveWishlistItemsToCart`, `requestOrderReturn`, `getOrderReturnRequest`, `resolveOrderReturn`, `listPersonalisedRecommendations`, `setOwnPersonalisationPreference`, `getShippingQuotes`, and Sprint 30's `getSearchSuggestions`, `listPopularKeywords`, `listOwnRecentKeywords`, `removeOwnRecentKeyword`, `clearOwnRecentKeywords`, `listRelatedProducts`, `listFrequentlyBoughtTogetherForProduct`, `listFrequentlyBoughtTogetherForCart`, `listTrendingProducts`, `listNewArrivals`, `listFeaturedCategories` |
| 3 | Contract test **code→spec**, machine-verified — no undocumented endpoint |
| 4 | `/wishlist`, `/account/orders/[orderId]/return`, `/admin/orders/[orderId]/return`, `/checkout/shipping`, `/search` and `/` render against the real API |
| 5 | Pagination envelope and cursor shape match on `getOwnWishlist` and `listProductReviews`-style list reads in the increment |
| 6 | **Designed screens:** a return outside its window stating when it closed · a return awaiting refund shown as awaiting refund · an out-of-stock wishlist item **staying on the wishlist** · **every recommendation rail failing silently** — no error, no empty state, no explanation |
| 7 | **Permission matrix — cite `EN-CONTRACT-3`'s generated suite.** Another customer's wishlist, recent keywords, or return request returns `404`, never `403`; `resolveOrderReturn` refused for every role the matrix does not grant |
| 8 | **`Money` on a wishlist item moved to the cart is the current price, not the saved one** — save an item, change its price, move it, and confirm the cart states the change |
| 9 | One correlation id across browser → API on a return request |
| 10 | Drift logged **and** `openapi.yaml` amended in the same session |
| — | **Also confirm, since no other check will:** the home page is **still statically generated for a `GUEST`** with the personalised rail present · Sprint 13's and Sprint 19's forward-reference copy now points at the routes that exist |

## Definition of Done

Every item satisfies its lane's list in [`../definition-of-done.md`](../definition-of-done.md) §3 or §4, and every story reaches §5.

Additionally: **no forward reference in any earlier sprint's screens still points at something that does not exist.** This is the sprint where that becomes checkable, and Sprint 32 has no capacity to discover it.

## Review Notes

<!-- filled at Sprint Review -->

## Retrospective

**Went well:**
**Change one thing:**
**Action (owned, carried to next sprint's board):**

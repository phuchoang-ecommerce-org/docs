# Shopping Cart & Wishlist — User Stories (`CRT`)

**Document type:** User Story Specification — domain
**Related documents:** [`README.md`](./README.md) (index and template) · [`../use-cases/05-cart-wishlist.md`](../use-cases/05-cart-wishlist.md) (source use cases) · [`../srs.md`](../srs.md)
**Audience:** Product Management, Engineering, Quality Assurance

---

## US-CRT-01 — Add Item to Cart

**As a** Guest
**I want** to add a product variant to my cart
**So that** I can capture my intent to buy it without registering first

**Realises:** `UC-CRT-01` · `FR-CRT-01`, `FR-CRT-05`
**Priority:** Must

**Acceptance Criteria**
- Given a published, purchasable variant and a quantity within available stock, when I add it, then the cart contains the line at that quantity, combined with any existing line for the same variant, and no stock is reserved.
- Given I have no cart yet, when I add an item, then a guest cart is created without requiring registration.
- Given the variant is already in my cart, when I add more, then quantities combine and the combined total is checked against available stock.
- Given the requested quantity exceeds available stock, when I add the item, then the platform declines, states the quantity actually available, and offers to add that instead.
- Given the variant is unpublished or removed since the page loaded, when I try to add it, then I am told it is no longer available and the cart is unchanged.
- Given the variant is entirely out of stock, when I try to add it, then the addition is declined and I am offered the wishlist instead.
- Given my cart expired mid-session, when I add an item, then a new cart is created, the item is added, and I am told the previous cart expired.

---

## US-CRT-02 — Update Cart Item Quantity

**As a** Guest
**I want** to change the quantity of a cart line
**So that** I can adjust before committing to checkout

**Realises:** `UC-CRT-02` · `FR-CRT-02`
**Priority:** Must

**Acceptance Criteria**
- Given a positive integer quantity within available stock, when I update a line, then the line reflects the new quantity and the cart total is re-priced.
- Given I set a quantity to zero, when I submit it, then the line is treated as removed.
- Given I reduce a quantity, when I submit it, then the update proceeds without an availability check blocking it.
- Given I adjust quantity during checkout, when I submit it, then the shipping fee is recalculated and any applied voucher is re-validated.
- Given the new quantity exceeds available stock, when I submit it, then the platform declines, states the available quantity, and keeps the previous value.
- Given the line was removed in another session, when I try to update it, then I am told the line is gone and shown the current cart.
- Given the variant became unpublished since the line was added, when I try to increase its quantity, then the increase is declined and I am told the line must be removed before checkout.

---

## US-CRT-03 — Remove Item from Cart

**As a** Guest
**I want** to remove a line from my cart
**So that** I can change my mind without losing the rest of the cart

**Realises:** `UC-CRT-03` · `FR-CRT-03`
**Priority:** Must

**Acceptance Criteria**
- Given a line in my cart, when I remove it, then the line is gone, every other line is unaffected, and the total is re-priced.
- Given I am authenticated, when I remove a line, then I may instead save it to my wishlist in one action, preserving the intent.
- Given the last line is removed, when it happens, then the cart is retained as an empty cart rather than deleted.
- Given a line is removed during active checkout, when it happens, then the shipping fee is recalculated and any voucher re-validated.
- Given the line was already removed, when I try to remove it again, then success is reported.
- Given removal empties a cart in active checkout, when it happens, then the checkout ends and I am returned to the cart.

---

## US-CRT-04 — View Cart

**As a** Guest
**I want** to view my cart
**So that** I can see exactly what I am about to buy and at what price

**Realises:** `UC-CRT-04` · `FR-CRT-04`, `FR-CRT-08`
**Priority:** Must

**Acceptance Criteria**
- Given a cart with lines, when I open it, then every line is presented at current prices with current availability, and any changes since items were added are identified.
- Given I am authenticated, when I open my cart, then my stored cart is retrieved and appears on any device.
- Given I am a guest, when I open my cart, then the visit-scoped guest cart is retrieved.
- Given my cart is empty, when I open it, then this is stated plainly with discovery surfaces offered.
- Given an automatically applied promotion, when the cart is shown, then it is displayed with the discount it contributes.
- Given a line's price rose since it was added, when the cart is shown, then the current, higher price is displayed with the change stated explicitly.
- Given a line's available stock has fallen below its quantity, when the cart is shown, then the line is marked short with the available quantity stated.
- Given a line's variant is no longer published, when the cart is shown, then the line is marked unpurchasable and must be removed before checkout.
- Given my cart expired, when I open it, then an empty cart is presented and I am told the previous one expired.

---

## US-CRT-05 — Merge Guest Cart on Login

**As a** Customer
**I want** my guest cart merged into my account on login
**So that** I do not lose what I assembled before signing in

**Realises:** `UC-CRT-05` · `FR-CRT-06`, `FR-CUS-03`
**Priority:** Must

**Acceptance Criteria**
- Given a non-empty guest cart and a successful login, when login completes, then the customer's cart contains the union of both carts with combined quantities for shared variants, re-checked against available stock, and the guest cart is discarded.
- Given I have no stored cart, when I log in with a guest cart, then the guest cart becomes my cart in full.
- Given my guest cart is empty, when I log in, then my stored cart stands unchanged and nothing is reported.
- Given the merge follows registration, when I first log in afterward, then the same merge behaviour applies.
- Given a combined quantity exceeds available stock, when the merge runs, then the line is carried over at the maximum available quantity and the reduction is stated explicitly.
- Given a guest line's variant is no longer published, when the merge runs, then the line is not carried over and I am told which product was dropped and why.
- Given a guest line is entirely out of stock, when the merge runs, then it is carried over marked unpurchasable rather than dropped.
- Given the merge fails, when it happens, then login still succeeds, my stored cart is untouched, the guest cart is preserved for retry, and I am told my earlier items will be recovered.
- Given concurrent merges from two sessions, when they occur, then they apply in sequence against the cart as it then stands, so neither session's items are lost.

---

## US-CRT-06 — Expire Inactive Cart

**As** the Scheduler
**I want** to expire a cart after its configured inactivity period
**So that** stale carts and prices do not persist indefinitely

**Realises:** `UC-CRT-06` · `FR-CRT-07`
**Priority:** Must

**Acceptance Criteria**
- Given a cart with no activity for the configured period and not in active checkout, when the Scheduler runs, then the cart is expired and no longer presented, and no stock is released since a cart never reserved any.
- Given guest and authenticated carts, when expiry periods are evaluated, then each may use its own configured period.
- Given the configured period changes, when it takes effect, then it applies only to subsequent evaluations, never retroactively expiring an already-live cart.
- Given pre-expiry notification is configured, when a cart nears expiry, then the customer is notified in advance.
- Given a cart is in active checkout, when expiry is evaluated, then expiry is deferred.
- Given a cart holds an order in Draft, when expiry is evaluated, then expiry is deferred to order cancellation, which releases any reservation.
- Given an expiry attempt fails, when it happens, then the cart remains live and is retried on the next run.

---

## US-CRT-07 — Manage Wishlist

**As a** Customer
**I want** to save and remove products on my wishlist
**So that** I can hold intent without committing to purchase

**Realises:** `UC-CRT-07` · `FR-CRT-09`
**Priority:** Should

**Acceptance Criteria**
- Given a published product, when I save it to my wishlist, then it is added, or I am told it is already saved rather than being duplicated.
- Given an item on my wishlist, when I remove it, then it is removed and the rest of the wishlist is unaffected.
- Given I view my wishlist, when it loads, then items are shown with current price and availability, with any price fall since saving highlighted.
- Given an out-of-stock product, when I try to save it, then the save succeeds — the wishlist exists precisely to hold this intent.
- Given I save an item directly from the cart, when I do so, then it is removed from the cart and added to the wishlist in one action.
- Given a wishlisted product becomes unpublished or removed, when the wishlist is viewed, then the entry is marked unavailable rather than deleted.
- Given I am a guest, when I try to use a wishlist, then I am told an account is required and offered registration or login, with the intended item preserved.
- Given I request another customer's wishlist, when I do so, then it is declined and the attempt is recorded.

---

## US-CRT-08 — Move Wishlist Item to Cart

**As a** Customer
**I want** to move a wishlist item into my cart
**So that** I can act on a saved intention, often prompted by a price fall or restock

**Realises:** `UC-CRT-08` · `FR-CRT-10`, `FR-CRT-01`
**Priority:** Should

**Acceptance Criteria**
- Given a wishlisted item that is published and in stock, when I move it, then the cart contains the variant and the item is removed from the wishlist only after the addition succeeds.
- Given the wishlist item is a product without a selected variant, when I move it, then I am taken to variant selection before it is added.
- Given I choose to copy rather than move, when I do so, then the wishlist entry is retained after the cart addition.
- Given I move every eligible item at once, when I do so, then items that cannot move stay on the wishlist with the reason stated, rather than the whole action failing.
- Given the item is out of stock, when I try to move it, then the move is declined and the item remains on the wishlist, with a restock notification offered.
- Given the product was unpublished since it was saved, when I try to move it, then the move is declined and the wishlist entry is marked unavailable.
- Given adding to the cart fails, when it happens, then the wishlist entry is not removed.
- Given the price has risen since the item was saved, when it moves to the cart, then the cart shows the current price with the change stated.

# Product Catalog & Category — User Stories (`CAT`)

**Related documents:** [`README.md`](./README.md) (index and template) · [`../use-cases/02-catalog-category.md`](../use-cases/02-catalog-category.md) (source use cases) · [`../srs.md`](../srs.md)

---

## US-CAT-01 — Browse Category Tree

**As a** Guest
**I want** to browse the category navigation
**So that** I can narrow from a broad idea to a specific product

**Realises:** `UC-CAT-01` · `FR-CAT-05`, `FR-CAT-07`
**Priority:** Must

**Acceptance Criteria**
- Given no prior context, when I open category navigation, then the category tree is presented with each category's name, image, and children, navigable to arbitrary depth.
- Given I arrive directly at a nested category, when the page loads, then the ancestor path is shown so I can move back up.
- Given a category has no image, when it is presented, then it still appears in navigation using its name alone.
- Given a category no longer exists, when I try to reach it, then I am told it is unavailable and shown the nearest surviving ancestor.
- Given the category tree is unavailable, when I open navigation, then search and featured categories remain reachable.

---

## US-CAT-02 — Browse Category Product Listing

**As a** Guest
**I want** to see the products in a category
**So that** I can compare candidates quickly

**Realises:** `UC-CAT-02` · `FR-CAT-03`, `FR-CAT-08`, `FR-INV-07`
**Priority:** Must

**Acceptance Criteria**
- Given a category with published products, when I select it, then a paginated listing is presented with each product's name, image, current price, and availability.
- Given I choose a different ordering, when I select price, newest, or popularity, then the listing is re-retrieved from the first page.
- Given I apply a filter, when I narrow by brand, price range, or attribute, then the listing reflects the combined filters.
- Given an out-of-stock product in the category, when the listing is shown, then it appears marked unavailable rather than being hidden.
- Given a category has no published products, when I open its listing, then an empty listing is presented explicitly with sibling categories offered.
- Given I request a page beyond the last, when I do so, then the last available page is presented rather than an empty one.
- Given availability cannot be determined, when the listing is shown, then affected products are marked unknown rather than the listing being suppressed.

---

## US-CAT-03 — View Product Details

**As a** Guest
**I want** to view a product's full detail
**So that** I have enough information to decide whether to buy it

**Realises:** `UC-CAT-03` · `FR-CAT-01`, `FR-CAT-04`, `FR-INV-07`, `FR-REV-07`
**Priority:** Must

**Acceptance Criteria**
- Given a published product, when I open it, then its name, description, images, brand, categories, attributes, price, variants, per-variant availability, aggregate rating, and related products are presented.
- Given the product has variants, when I open it, then variant dimensions and selectable values are presented, deferring price and availability to variant selection.
- Given the product is on promotion, when I open it, then both the standard and promotional price are shown together with the promotion's period.
- Given every variant is out of stock, when I open the product, then it is still presented, marked unavailable, with add-to-cart disabled.
- Given the product is unpublished or removed, when I try to open it, then I am told it is unavailable and offered the containing category.
- Given reviews are unavailable, when I open the product, then the rest of the page is presented without the review section.
- Given related products are unavailable, when I open the product, then the rest of the page is presented without that section.

---

## US-CAT-04 — Select Product Variant

**As a** Customer
**I want** to select the exact variant of a product
**So that** I add the precise configuration I intend to buy

**Realises:** `UC-CAT-04` · `FR-CAT-02`
**Priority:** Must

**Acceptance Criteria**
- Given a value for every variant dimension, when I make my selections, then a single variant is identified with its own price and availability, and can be added to the cart.
- Given only some dimensions are selected, when I view the product, then a price range across matching variants is shown and add-to-cart stays disabled.
- Given combinations that do not exist or hold no stock, when they are shown, then they are marked as such before selection.
- Given a combination that does not exist, when I select it, then I am told it is unavailable and my other selections are retained.
- Given the identified variant is out of stock, when I select it, then its detail is presented but add-to-cart is disabled and I am told it is out of stock.

---

## US-CAT-05 — View Featured Categories

**As a** Guest
**I want** to see featured categories on the storefront home
**So that** I have a starting point without knowing what to search for

**Realises:** `UC-CAT-05` · `FR-CAT-06`, `FR-CAT-07`
**Priority:** Should

**Acceptance Criteria**
- Given categories designated as featured, when I open the storefront home, then they are presented with their images in their configured order.
- Given no categories are designated featured, when I open the home page, then the section is omitted rather than shown empty.
- Given featured categories are unavailable, when I open the home page, then the rest of the page is presented without that section.
- Given a featured category has been removed, when the section is shown, then it is omitted without suppressing the others.

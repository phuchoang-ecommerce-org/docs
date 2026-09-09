# Permission Matrix — Enterprise Commerce Platform (ECP)

**Document type:** Interface specification (normative) — the per-operation realisation
**Status:** **Proposed** — first assembled here; every cell traces to a source that already decided it (§1.2)
**Audience:** Backend Engineering, Frontend Engineering, QA, Architecture Review, Security Review
**Traces to:** `NFR-SEC-01`, `FR-AUD-05`, `FR-AUD-06`, `BR-AUD-02`, `BR-AUD-03`, `P5`, `P16`
**Related documents:** [SRS](../../BA-docs/srs.md) §2.3 (normative) · [Integration Contract](./Integration%20Contract.md) §5, §9 · [Security](../01-system/Security.md) §5 · [ADR-0016](../01-system/ADR/ADR-0016-jwt-refresh-rotation-rbac.md) · [OpenAPI](./OpenAPI/README.md) §5.1 · [Error Codes](./Error%20Codes.md) · [Use Cases — Audit & Access Control](../../BA-docs/use-cases/14-audit-access-control.md)

---

## 1. Purpose and Status

### 1.1 The gap this closes

[`ADR-0016`](../01-system/ADR/ADR-0016-jwt-refresh-rotation-rbac.md) §4 names the destination directly: *"SRS §2.3's authority table is normative and destined for `04-shared/Permission Matrix`."* Three other records point at the same reserved, never-created location: [`ADR-0003`](../01-system/ADR/ADR-0003-rest-api-style.md) §2, [`Integration Contract.md`](./Integration%20Contract.md) §1, and [`OpenAPI/README.md`](./OpenAPI/README.md) §8, which calls the domain × role grid *"the artefact `NFR-SEC-01` is verified against"* and asks a human to check it row by row. This document is that artefact.

### 1.2 What this is, and what it deliberately is not

**This is not a third copy of the domain-level grid.** [Security.md](../01-system/Security.md) §5.2 already declines to repeat it a second time, for a reason worth keeping: *"a third copy is a third thing to drift."* SRS §2.3 states it first and is normative; [`Integration Contract.md`](./Integration%20Contract.md) §9 mirrors it once. A third verbatim copy here would be the exact failure mode both of those documents were written to avoid.

**What this document adds is the grain neither of those has: the operation.** SRS §2.3 and [`Integration Contract.md`](./Integration%20Contract.md) §9 answer *"what can a Customer do in Checkout & Order"* with one word — `own`. Fourteen domains and six roles is 84 cells; the OpenAPI contract underneath them is **121 paths, 155 operations**. This document is the map between the two: which of the 155 operations each role's grant actually authorises, with every deviation from the domain-level grid named and justified rather than left for a reader to reconstruct from fourteen YAML files.

**Nothing here is invented.** Every role assignment below is transcribed from the `x-ecp-roles`, `x-ecp-ownership`, and `x-ecp-traces` vendor extensions already committed in [`04-shared/OpenAPI/paths/`](./OpenAPI/paths/) ([conventions in `OpenAPI/README.md`](./OpenAPI/README.md) §3.2), which were themselves checked cell-by-cell against SRS §2.3 in [`OpenAPI/README.md`](./OpenAPI/README.md) §5.1. This document reproduces that check at full completeness — all 155 operations, not the deviations alone — because the artefact `NFR-SEC-01` is verified against should not require reading fourteen YAML files to audit.

**Governance is unchanged and is worth stating up front, not at the bottom:** *"Changes here follow the SRS, not the reverse. If the grid and SRS §2.3 disagree, SRS §2.3 is right"* ([`Integration Contract.md`](./Integration%20Contract.md) §10). This document inherits that rule exactly. §9 records the one place that rule currently has teeth.

---

## 2. Roles

### 2.1 Human actors and their role codes

| Role (SRS §2.3) | `identity_role.code` literal | Authenticated? |
|---|---|---|
| Guest | `GUEST` | No — an unauthenticated caller. Listed as a role because several operations name it explicitly in `x-ecp-roles`, not because it carries a credential. |
| Customer | `CUSTOMER` | Yes |
| Staff | `STAFF` | Yes |
| Warehouse Operator | `WAREHOUSE_OPERATOR` | Yes |
| Customer Support Agent | `CUSTOMER_SUPPORT` | Yes |
| Administrator | `ADMINISTRATOR` | Yes |

**A caller may hold more than one role; authority is the union of every role held** ([`../../BA-docs/use-cases/14-audit-access-control.md`](../../BA-docs/use-cases/14-audit-access-control.md) `UC-AUD-03` A4). The tables in §5 list, per operation, every role that independently suffices — not a combination required.

### 2.2 System actors — authorised by signature, not by role

Two operations carry `x-ecp-roles: []` and `providerSignature` security instead of a role check. They are not blank cells in the human sense; §7 covers them separately because SRS §2.3's role table does not model them at all — they come from the *system actor* table in the same section.

| Actor | Operation |
|---|---|
| Payment Gateway | `receivePaymentProviderNotification` |
| Shipping Carrier | `receiveCarrierEvent` |

---

## 3. How to Read This Matrix

1. **Role grants the capability; ownership grants the instance.** Where an operation's **Own** column is marked, the role check alone is not the whole authorisation decision — a runtime check confirms the resource belongs to the acting party ([`Integration Contract.md`](./Integration%20Contract.md) §9). `GET /orders/{orderId}` lists `CUSTOMER` with ownership marked: any Customer may call the endpoint, but only against *their own* order.
2. **Ownership does not narrow an operator role on the same row.** Where a row lists both a Customer-class role and an operator role (Staff, Warehouse, Support, Administrator) with **Own** marked, the mark describes the Customer-class grant. The operator roles on that row reach the operation by role-scope across all records, per `UC-AUD-03` A2 — they are not each individually restricted to "their own," because an operator does not own a customer's order in the first place.
3. **A caller requesting a resource they do not own receives `404` (`ECP-GEN-4040`), not `403`.** This is deliberate and covered fully in [`Error Codes.md`](./Error%20Codes.md) §3.1: existence is itself information, and the two outcomes are indistinguishable on purpose.
4. **A blank Roles cell does not appear** — every one of the 155 operations declares at least one permitted caller (§2.2's two signature-authorised operations, or one-or-more roles). A domain cell that is blank in the SRS §2.3 *domain-level* grid means no operation in that domain is reachable by that role at all; §6 confirms this holds for every blank cell that grid has.
5. **`GUEST` in a role list is a real grant, not a placeholder for "everyone."** An operation without `GUEST` in its role list requires authentication even where the action seems read-only — `getCart` for an anonymous caller's own guest cart still requires the guest cart's own unauthenticated identity path (§5.5), and an operation like `getCurrentCart` is scoped to a session that already exists, whether that session is a Guest's or a Customer's.
6. **Traces are use-case and rule identifiers, not exhaustive.** The `Traces` column reproduces `x-ecp-traces` verbatim: `UC`, `FR`, and `BR` identifiers the operation realises, semicolon-separated by category. `US-<D>-<nn>` user stories are not listed separately because [`OpenAPI/README.md`](./OpenAPI/README.md)'s convention makes `UC-<D>-<nn>` and `US-<D>-<nn>` the identity mapping — citing the use case cites the user story.

---

## 4. The Domain-Level Grid, for Orientation Only

Fourteen rows, six columns, and it is normative at SRS §2.3 and mirrored at [`Integration Contract.md`](./Integration%20Contract.md) §9 — not reproduced a third time here (§1.2). In shape: Guest reaches only browsing, search, registration, and login; Customer adds ownership-scoped carts, orders, payments, reviews, and notifications; Staff and Warehouse split commercial and fulfilment operations; Support reaches across records for service recovery; and Administrator alone reaches role management and the full width of reporting. No role, including Administrator, reaches `manage` on the audit trail — the blank cell is a structural guarantee ([ADR-0017](../01-system/ADR/ADR-0017-append-only-audit-log.md)), not an omission. Open either source document for the cell-by-cell grid; §5 below is its expansion into the 155 operations that implement it.

---

## 5. The Per-Operation Matrix

Grouped by SRS §2.2 domain, in the same order [`OpenAPI/README.md`](./OpenAPI/README.md) §2.1 uses. Within each domain, rows are sorted by path so the resource hierarchy stays visible. **Roles** lists every role that independently suffices, in the fixed order Guest → Customer → Staff → Warehouse → Support → Admin; **Own** marks an ownership-scoped grant (§3 rule 1); **Traces** is `x-ecp-traces` verbatim (§3 rule 6).

### 5.1 `CUS` — Customer & Identity (18 operations)

| Method & Path | Operation | Roles permitted | Own | Traces |
|---|---|---|---|---|
| `POST /account-verification-requests` | `resendEmailVerification` — Request a new verification mail | Guest, Customer |  | UC-CUS-02; FR-CUS-02; BR-CUS-02, BR-CUS-04 |
| `POST /account-verifications` | `verifyEmailAddress` — Verify an email address | Guest |  | UC-CUS-02; FR-CUS-02; BR-CUS-02 |
| `GET /accounts` | `searchAccounts` — Search customer accounts | Support, Admin |  | UC-ADM-03; FR-ADM-03, FR-AUD-02; BR-AUD-01 |
| `POST /accounts` | `registerAccount` — Register a customer account | Guest |  | UC-CUS-01; FR-CUS-01, FR-CUS-02; BR-CUS-01, BR-CUS-02, BR-CUS-04 |
| `GET /accounts/me` | `getOwnAccount` — Get the caller's own account | Customer, Staff, Warehouse, Support, Admin | ✓ | UC-CUS-08; FR-CUS-08 |
| `PATCH /accounts/me` | `updateOwnProfile` — Update the caller's own profile | Customer, Staff, Warehouse, Support, Admin | ✓ | UC-CUS-08; FR-CUS-08; BR-CUS-01, BR-CUS-02 |
| `GET /accounts/me/addresses` | `listOwnAddresses` — List the caller's shipping addresses | Customer | ✓ | UC-CUS-09; FR-CUS-09; BR-CUS-05 |
| `POST /accounts/me/addresses` | `addOwnAddress` — Add a shipping address | Customer | ✓ | UC-CUS-09; FR-CUS-09; BR-CUS-05 |
| `DELETE /accounts/me/addresses/{addressId}` | `removeOwnAddress` — Remove one of the caller's addresses | Customer | ✓ | UC-CUS-09; FR-CUS-09; BR-CUS-05 |
| `GET /accounts/me/addresses/{addressId}` | `getOwnAddress` — Get one of the caller's addresses | Customer | ✓ | UC-CUS-09; FR-CUS-09; BR-CUS-05 |
| `PUT /accounts/me/addresses/{addressId}` | `replaceOwnAddress` — Replace one of the caller's addresses | Customer | ✓ | UC-CUS-09; FR-CUS-09; BR-CUS-05, BR-ORD-06 |
| `PUT /accounts/me/password` | `changeOwnPassword` — Change the caller's own password | Customer, Staff, Warehouse, Support, Admin | ✓ | UC-CUS-06; FR-CUS-06; BR-CUS-03 |
| `POST /password-reset-requests` | `requestPasswordReset` — Request a password-reset link | Guest |  | UC-CUS-07; FR-CUS-07; BR-CUS-03, BR-CUS-04 |
| `POST /password-resets` | `completePasswordReset` — Set a new password using a reset token | Guest |  | UC-CUS-07; FR-CUS-07; BR-CUS-03 |
| `POST /session-renewals` | `renewSession` — Exchange a refresh token for a new access token | Customer, Staff, Warehouse, Support, Admin | ✓ | UC-CUS-05; FR-CUS-05; BR-CUS-03 |
| `DELETE /sessions` | `endAllOwnSessions` — Log out of every session | Customer, Staff, Warehouse, Support, Admin | ✓ | UC-CUS-04; FR-CUS-04; BR-CUS-03 |
| `POST /sessions` | `logIn` — Log in | Guest |  | UC-CUS-03, UC-CRT-05; FR-CUS-03, FR-CRT-06; BR-CUS-03, BR-CUS-04 |
| `DELETE /sessions/current` | `logOut` — Log out | Customer, Staff, Warehouse, Support, Admin | ✓ | UC-CUS-04; FR-CUS-04; BR-CUS-03 |

### 5.2 `CAT` — Product Catalog & Category (21 operations)

| Method & Path | Operation | Roles permitted | Own | Traces |
|---|---|---|---|---|
| `GET /categories` | `listCategories` — Browse the category tree | Guest, Customer, Staff, Warehouse, Support, Admin |  | UC-CAT-01; FR-CAT-05, FR-CAT-07; BR-CAT-03 |
| `POST /categories` | `createCategory` — Create a category | Staff, Admin |  | UC-ADM-02; FR-ADM-02, FR-CAT-05; BR-CAT-03 |
| `DELETE /categories/{categoryId}` | `deleteCategory` — Delete a category | Staff, Admin |  | UC-ADM-02; FR-ADM-02; BR-CAT-03 |
| `GET /categories/{categoryId}` | `getCategory` — Get one category | Guest, Customer, Staff, Warehouse, Support, Admin |  | UC-CAT-01; FR-CAT-05 |
| `PATCH /categories/{categoryId}` | `updateCategory` — Update or move a category | Staff, Admin |  | UC-ADM-02; FR-ADM-02; BR-CAT-03 |
| `GET /categories/{categoryId}/products` | `listCategoryProducts` — Browse the products in a category | Guest, Customer, Staff, Warehouse, Support, Admin |  | UC-CAT-02; FR-CAT-03, FR-CAT-08; BR-CAT-02 |
| `GET /featured-categories` | `listFeaturedCategories` — List featured categories | Guest, Customer, Staff, Support, Admin |  | UC-CAT-05; FR-CAT-06 |
| `POST /product-bulk-amendments` | `amendProductsInBulk` — Amend several products in one request | Staff, Admin |  | UC-ADM-01; FR-ADM-01; BR-CAT-01 |
| `GET /products` | `listProducts` — List products | Guest, Customer, Staff, Warehouse, Support, Admin |  | UC-CAT-02, UC-ADM-01; FR-CAT-03, FR-ADM-01; BR-CAT-02 |
| `POST /products` | `createProduct` — Create a product | Staff, Admin |  | UC-ADM-01; FR-ADM-01, FR-CAT-01; BR-CAT-01 |
| `DELETE /products/{productId}` | `deleteProduct` — Delete a product | Staff, Admin |  | UC-ADM-01; FR-ADM-01; BR-CAT-01 |
| `GET /products/{productId}` | `getProduct` — View product details | Guest, Customer, Staff, Warehouse, Support, Admin |  | UC-CAT-03; FR-CAT-01, FR-CAT-04, FR-INV-07; BR-CAT-01, BR-CAT-02 |
| `PATCH /products/{productId}` | `updateProduct` — Update a product | Staff, Admin |  | UC-ADM-01; FR-ADM-01; BR-CAT-01 |
| `POST /products/{productId}/images` | `addProductImage` — Add a product image | Staff, Admin |  | UC-ADM-01; FR-ADM-01, FR-CAT-01 |
| `DELETE /products/{productId}/images/{imageId}` | `removeProductImage` — Remove a product image | Staff, Admin |  | UC-ADM-01; FR-ADM-01 |
| `PUT /products/{productId}/publication` | `setProductPublication` — Publish, unpublish, or discontinue a product | Staff, Admin |  | UC-ADM-01; FR-ADM-01; BR-CAT-02 |
| `GET /products/{productId}/variants` | `listProductVariants` — List a product's variants | Guest, Customer, Staff, Warehouse, Support, Admin |  | UC-CAT-04; FR-CAT-02; BR-CAT-01 |
| `POST /products/{productId}/variants` | `addProductVariant` — Add a variant | Staff, Admin |  | UC-ADM-01; FR-ADM-01, FR-CAT-02; BR-CAT-01 |
| `DELETE /products/{productId}/variants/{variantId}` | `removeProductVariant` — Remove a variant | Staff, Admin |  | UC-ADM-01; FR-ADM-01; BR-CAT-01 |
| `GET /products/{productId}/variants/{variantId}` | `getProductVariant` — Get one variant | Guest, Customer, Staff, Warehouse, Support, Admin |  | UC-CAT-04; FR-CAT-02 |
| `PUT /products/{productId}/variants/{variantId}/price` | `changeVariantPrice` — Change a variant's list price | Staff, Admin |  | UC-ADM-01; FR-ADM-01; BR-ORD-06 |

### 5.3 `SCH` — Search & Recommendation (14 operations)

| Method & Path | Operation | Roles permitted | Own | Traces |
|---|---|---|---|---|
| `GET /accounts/me/personalisation-preferences` | `getOwnPersonalisationPreference` — Get the caller's personalisation preference | Customer | ✓ | UC-SCH-07; FR-SCH-11; BR-SCH-01 |
| `PUT /accounts/me/personalisation-preferences` | `setOwnPersonalisationPreference` — Opt in or out of personalisation | Customer | ✓ | UC-SCH-07; FR-SCH-11; BR-SCH-01 |
| `GET /carts/{cartId}/frequently-bought-together` | `listFrequentlyBoughtTogetherForCart` — Frequently bought together with the whole cart | Guest, Customer | ✓ | UC-SCH-05; FR-SCH-08; BR-CAT-02 |
| `GET /products/{productId}/frequently-bought-together` | `listFrequentlyBoughtTogetherForProduct` — Frequently bought together with this product | Guest, Customer, Staff, Support, Admin |  | UC-SCH-05; FR-SCH-08; BR-CAT-02 |
| `GET /products/{productId}/related-products` | `listRelatedProducts` — Related products | Guest, Customer, Staff, Support, Admin |  | UC-SCH-05; FR-SCH-07; BR-CAT-02 |
| `GET /recommendations/new-arrivals` | `listNewArrivals` — Recently published products | Guest, Customer, Staff, Support, Admin |  | UC-SCH-06; FR-SCH-10; BR-CAT-02 |
| `GET /recommendations/personalised` | `listPersonalisedRecommendations` — Personalised recommendations | Customer | ✓ | UC-SCH-07; FR-SCH-11; BR-SCH-01 |
| `GET /recommendations/trending` | `listTrendingProducts` — Trending products | Guest, Customer, Staff, Support, Admin |  | UC-SCH-06; FR-SCH-09; BR-CAT-02 |
| `GET /search/popular-keywords` | `listPopularKeywords` — List platform-wide popular keywords | Guest, Customer, Staff, Support, Admin |  | UC-SCH-04; FR-SCH-05 |
| `GET /search/products` | `searchProducts` — Search products by keyword | Guest, Customer, Staff, Support, Admin |  | UC-SCH-01, UC-SCH-03; FR-SCH-01, FR-SCH-03, FR-SCH-04; BR-CAT-02 |
| `DELETE /search/recent-keywords` | `clearOwnRecentKeywords` — Clear the caller's recent keywords | Customer | ✓ | UC-SCH-04; FR-SCH-06; BR-SCH-01 |
| `GET /search/recent-keywords` | `listOwnRecentKeywords` — List the caller's recent keywords | Customer | ✓ | UC-SCH-04; FR-SCH-06; BR-SCH-01 |
| `DELETE /search/recent-keywords/{keyword}` | `removeOwnRecentKeyword` — Remove one recent keyword | Customer | ✓ | UC-SCH-04; FR-SCH-06; BR-SCH-01 |
| `GET /search/suggestions` | `getSearchSuggestions` — Auto-complete a search term | Guest, Customer, Staff, Support, Admin |  | UC-SCH-02; FR-SCH-02 |

**§6.2 covers the one cell here worth a second look:** Inventory's "availability only" grant for Customer has no `INV` endpoint at all — it is satisfied inside `CAT` and `SCH` responses instead.

### 5.4 `INV` — Inventory (6 operations)

| Method & Path | Operation | Roles permitted | Own | Traces |
|---|---|---|---|---|
| `GET /stock-items` | `listStockItems` — View inventory levels | Staff, Warehouse, Support, Admin |  | UC-INV-05; FR-INV-01, FR-INV-06; BR-INV-01 |
| `GET /stock-items/{stockItemId}` | `getStockItem` — Get one stock item | Staff, Warehouse, Support, Admin |  | UC-INV-05; FR-INV-01; BR-INV-01 |
| `GET /stock-items/{stockItemId}/adjustments` | `listStockAdjustments` — Review a SKU's adjustment history | Staff, Warehouse, Support, Admin |  | UC-INV-04, UC-ADM-05; FR-INV-05, FR-ADM-05 |
| `POST /stock-items/{stockItemId}/adjustments` | `adjustStock` — Adjust inventory | Warehouse, Admin |  | UC-INV-04, UC-ADM-05; FR-INV-05, FR-ADM-05, FR-AUD-02; BR-INV-01, BR-AUD-01 |
| `POST /stock-reservations/{reservationId}/commitments` | `commitStockReservation` — Commit reserved stock on fulfilment | Warehouse, Admin |  | UC-INV-03; FR-INV-04; BR-INV-01, BR-INV-02 |
| `GET /warehouses` | `listWarehouses` — List warehouses | Staff, Warehouse, Support, Admin |  | UC-INV-05; FR-INV-01 |

Reserve Stock (`UC-INV-01`) and Release Reserved Stock (`UC-INV-02`) have no endpoint of their own — they are in-process `StockReservationPort` calls inside the order-placement and cancellation transactions, traced instead on `placeOrder` and `cancelOrder` in `ORD` (§5.6), which is where a caller actually triggers them ([`OpenAPI/README.md`](./OpenAPI/README.md) §5).

### 5.5 `CRT` — Cart & Wishlist (10 operations)

| Method & Path | Operation | Roles permitted | Own | Traces |
|---|---|---|---|---|
| `GET /carts/current` | `getCurrentCart` — View the caller's cart | Guest, Customer | ✓ | UC-CRT-04; FR-CRT-04, FR-CRT-05, FR-CRT-08; BR-CRT-01, BR-CRT-04 |
| `GET /carts/{cartId}` | `getCart` — Get one cart | Guest, Customer, Support, Admin | ✓ | UC-CRT-04; FR-CRT-04; BR-CRT-04 |
| `POST /carts/{cartId}/lines` | `addCartLine` — Add an item to the cart | Guest, Customer | ✓ | UC-CRT-01, UC-CRT-08; FR-CRT-01, FR-CRT-05, FR-CRT-10; BR-CRT-02, BR-CRT-04 |
| `DELETE /carts/{cartId}/lines/{lineId}` | `removeCartLine` — Remove a cart line | Guest, Customer | ✓ | UC-CRT-03; FR-CRT-03 |
| `PATCH /carts/{cartId}/lines/{lineId}` | `updateCartLineQuantity` — Update a cart line's quantity | Guest, Customer | ✓ | UC-CRT-02; FR-CRT-02; BR-CRT-02 |
| `POST /carts/{cartId}/merges` | `mergeGuestCart` — Merge a guest cart into the caller's cart | Customer | ✓ | UC-CRT-05; FR-CRT-06; BR-CRT-02, BR-CRT-04 |
| `POST /carts/{cartId}/wishlist-transfers` | `moveWishlistItemsToCart` — Move every movable wishlist item into the cart | Customer | ✓ | UC-CRT-08; FR-CRT-10; BR-CRT-02 |
| `GET /wishlists/current` | `getOwnWishlist` — View the caller's wishlist | Customer | ✓ | UC-CRT-07; FR-CRT-09 |
| `POST /wishlists/{wishlistId}/items` | `addWishlistItem` — Save an item to the wishlist | Customer | ✓ | UC-CRT-07; FR-CRT-09 |
| `DELETE /wishlists/{wishlistId}/items/{itemId}` | `removeWishlistItem` — Remove a wishlist item | Customer | ✓ | UC-CRT-07; FR-CRT-09 |

**`getCart` is the one `CRT` row that widens past "own":** Support and Admin reach any cart by role, not ownership, for dispute resolution — consistent with SRS §2.3's `read` grant to Support here (Guest and Customer keep `own`).

### 5.6 `ORD` — Checkout & Order (20 operations)

| Method & Path | Operation | Roles permitted | Own | Traces |
|---|---|---|---|---|
| `POST /checkouts` | `initiateCheckout` — Initiate checkout | Customer | ✓ | UC-ORD-01; FR-ORD-01; BR-ORD-01 |
| `GET /checkouts/current` | `getCurrentCheckout` — Get the caller's checkout in progress | Customer | ✓ | UC-ORD-01; FR-ORD-01; BR-ORD-01 |
| `PUT /checkouts/{checkoutId}/billing-information` | `setCheckoutBillingInformation` — Provide billing information | Customer | ✓ | UC-ORD-02; FR-ORD-03 |
| `PUT /checkouts/{checkoutId}/shipping-address` | `setCheckoutShippingAddress` — Provide the shipping address | Customer | ✓ | UC-ORD-02; FR-ORD-02, FR-ORD-04; BR-CUS-05 |
| `PUT /checkouts/{checkoutId}/shipping-option` | `selectCheckoutShippingOption` — Select a shipping option | Customer | ✓ | UC-ORD-02, UC-SHP-01; FR-ORD-04, FR-SHP-02 |
| `GET /checkouts/{checkoutId}/summary` | `getOrderSummary` — Review the order summary | Customer | ✓ | UC-ORD-04; FR-ORD-06, FR-ORD-07; BR-ORD-06 |
| `DELETE /checkouts/{checkoutId}/voucher` | `removeCheckoutVoucher` — Remove the applied voucher | Customer | ✓ | UC-ORD-03; FR-ORD-05; BR-PRM-01 |
| `PUT /checkouts/{checkoutId}/voucher` | `applyCheckoutVoucher` — Apply a voucher to the checkout | Customer | ✓ | UC-ORD-03, UC-PRM-03; FR-ORD-05, FR-PRM-08, FR-PRM-09; BR-PRM-01, BR-PRM-02 |
| `POST /order-status-transition-batches` | `advanceOrderStatusesInBulk` — Advance several orders' statuses | Staff, Warehouse, Admin |  | UC-ORD-10, UC-ADM-04; FR-ORD-10, FR-ORD-11, FR-ADM-04; BR-ORD-01, BR-ORD-04 |
| `GET /orders` | `listOrders` — List orders | Customer, Staff, Warehouse, Support, Admin | ✓ | UC-CUS-10, UC-ORD-06, UC-ADM-04; FR-CUS-10, FR-ORD-12, FR-ADM-04 |
| `POST /orders` | `placeOrder` — Place the order | Customer | ✓ | UC-ORD-05, UC-INV-01, UC-PRM-03; FR-ORD-08, FR-ORD-09, FR-INV-02, FR-PRM-09; BR-ORD-01, BR-ORD-02, BR-ORD-03, BR-ORD-06, BR-INV-01, BR-PRM-01, BR-PRM-02 |
| `GET /orders/{orderId}` | `getOrder` — View order details | Customer, Staff, Warehouse, Support, Admin | ✓ | UC-ORD-06, UC-ADM-04; FR-ORD-12, FR-ADM-04; BR-ORD-06 |
| `POST /orders/{orderId}/cancellation` | `cancelOrder` — Cancel an order | Customer, Support, Admin | ✓ | UC-ORD-08, UC-INV-02; FR-ORD-14, FR-INV-03; BR-ORD-01, BR-ORD-04, BR-INV-02 |
| `PUT /orders/{orderId}/investigation-flag` | `setOrderInvestigationFlag` — Flag an order for investigation | Staff, Support, Admin |  | UC-ADM-04; FR-ADM-04, FR-AUD-02; BR-AUD-01 |
| `GET /orders/{orderId}/lines` | `listOrderLines` — List an order's lines | Customer, Staff, Warehouse, Support, Admin | ✓ | UC-ORD-06; FR-ORD-12; BR-ORD-06 |
| `GET /orders/{orderId}/return-request` | `getOrderReturnRequest` — Get the return request for an order | Customer, Warehouse, Support, Admin | ✓ | UC-ORD-09; FR-ORD-15; BR-ORD-05 |
| `POST /orders/{orderId}/return-request` | `requestOrderReturn` — Request a return | Customer, Support, Admin | ✓ | UC-ORD-09; FR-ORD-15; BR-ORD-05 |
| `PUT /orders/{orderId}/return-request/resolution` | `resolveOrderReturn` — Accept, reject, or write off a return | Warehouse, Support, Admin |  | UC-ORD-09; FR-ORD-15, FR-INV-05; BR-ORD-01, BR-ORD-05 |
| `POST /orders/{orderId}/status-transitions` | `advanceOrderStatus` — Advance an order's status | Staff, Warehouse, Admin |  | UC-ORD-10, UC-ADM-04, UC-INV-03; FR-ORD-10, FR-ORD-11, FR-ORD-16, FR-ADM-04, FR-AUD-02; BR-ORD-01, BR-ORD-04, BR-AUD-01 |
| `GET /orders/{orderId}/tracking` | `trackOrder` — Track an order | Customer, Staff, Warehouse, Support, Admin | ✓ | UC-ORD-07; FR-ORD-13; BR-SHP-02 |

Support's presence on `cancelOrder`, `requestOrderReturn`, and `resolveOrderReturn` — but its **absence** from `advanceOrderStatus` and `advanceOrderStatusesInBulk` — is the direct, deliberate expression of §9's discrepancy: SRS §2.3 gives Support `cancel, return` but not `progress`, and this matrix follows the SRS.

### 5.7 `PAY` — Payment (12 operations)

| Method & Path | Operation | Roles permitted | Own | Traces |
|---|---|---|---|---|
| `PUT /checkouts/{checkoutId}/payment-method` | `selectCheckoutPaymentMethod` — Select a payment method | Customer | ✓ | UC-PAY-01; FR-PAY-01, FR-PAY-02; BR-PAY-03 |
| `GET /orders/{orderId}/payment` | `getOrderPayment` — Get an order's payment | Customer, Support, Admin | ✓ | UC-PAY-02, UC-ORD-06; FR-PAY-04; BR-PAY-01 |
| `GET /orders/{orderId}/payment-methods` | `listEligiblePaymentMethods` — List the payment methods eligible for an order | Customer, Support, Admin | ✓ | UC-PAY-01; FR-PAY-01, FR-PAY-02; BR-PAY-03 |
| `POST /payment-provider-notifications` | `receivePaymentProviderNotification` — Receive a payment provider callback | *(signature — Payment Gateway, §7)* |  | UC-PAY-03; FR-PAY-04, FR-PAY-05; BR-PAY-01 |
| `POST /payments` | `initiatePayment` — Initiate payment for an order | Customer | ✓ | UC-PAY-02; FR-PAY-03, FR-PAY-09; BR-PAY-01, BR-ORD-03 |
| `GET /payments/{paymentId}` | `getPayment` — Get one payment | Customer, Support, Admin | ✓ | UC-PAY-02; FR-PAY-04 |
| `GET /payments/{paymentId}/attempts` | `listPaymentAttempts` — List a payment's attempts | Customer, Support, Admin | ✓ | UC-PAY-02, UC-PAY-05; FR-PAY-04; BR-PAY-01 |
| `POST /payments/{paymentId}/attempts` | `retryPayment` — Retry a failed payment | Customer | ✓ | UC-PAY-05; FR-PAY-06; BR-ORD-04, BR-ORD-06, BR-PAY-01 |
| `POST /payments/{paymentId}/cash-collections` | `settleCashOnDelivery` — Record Cash On Delivery collection | Warehouse, Admin |  | UC-PAY-04; FR-PAY-07; BR-PAY-03 |
| `GET /payments/{paymentId}/refunds` | `listPaymentRefunds` — List a payment's refunds | Customer, Support, Admin | ✓ | UC-PAY-06; FR-PAY-08; BR-PAY-02 |
| `POST /payments/{paymentId}/refunds` | `refundPayment` — Refund a payment | Support, Admin |  | UC-PAY-06; FR-PAY-08, FR-AUD-02; BR-PAY-02, BR-AUD-01 |
| `GET /unmatched-payments` | `listUnmatchedPayments` — List provider results that could not be matched to an order | Support, Admin |  | UC-PAY-03, UC-PAY-06; FR-PAY-05, FR-PAY-08; BR-PAY-01 |

`settleCashOnDelivery` is Warehouse, not Support, matching SRS §2.3's `settle COD` cell for Warehouse in the Payment row exactly.

### 5.8 `SHP` — Shipping (8 operations)

| Method & Path | Operation | Roles permitted | Own | Traces |
|---|---|---|---|---|
| `POST /carrier-events` | `receiveCarrierEvent` — Receive a carrier tracking update | *(signature — Shipping Carrier, §7)* |  | UC-SHP-04; FR-SHP-05; BR-SHP-02 |
| `GET /orders/{orderId}/shipments` | `listOrderShipments` — List an order's shipments | Customer, Staff, Warehouse, Support, Admin | ✓ | UC-SHP-05, UC-ORD-07; FR-SHP-06, FR-ORD-13 |
| `GET /shipments` | `listShipments` — List shipments | Staff, Warehouse, Support, Admin |  | UC-SHP-05; FR-SHP-06 |
| `POST /shipments` | `createShipment` — Create a shipment | Warehouse, Admin |  | UC-SHP-03; FR-SHP-01, FR-SHP-04; BR-SHP-01 |
| `GET /shipments/{shipmentId}` | `getShipment` — View shipment tracking | Customer, Staff, Warehouse, Support, Admin | ✓ | UC-SHP-05; FR-SHP-06; BR-SHP-02 |
| `POST /shipments/{shipmentId}/delivery-confirmation` | `confirmShipmentDelivery` — Confirm delivery | Warehouse, Support, Admin *(also — Shipping Carrier, §7)* |  | UC-SHP-06; FR-SHP-07; BR-ORD-05, BR-SHP-02 |
| `GET /shipments/{shipmentId}/tracking-events` | `listShipmentTrackingEvents` — List a shipment's tracking events | Customer, Staff, Warehouse, Support, Admin | ✓ | UC-SHP-04, UC-SHP-05; FR-SHP-05, FR-SHP-06; BR-SHP-02 |
| `GET /shipping-quotes` | `getShippingQuotes` — Quote shipping options and delivery estimates | Customer, Staff, Warehouse, Support, Admin |  | UC-SHP-01, UC-SHP-02; FR-SHP-02, FR-SHP-03 |

`confirmShipmentDelivery` is reachable two ways — a role grant for Warehouse/Support/Admin recording delivery manually, and the Shipping Carrier's signed callback (§7) recording it automatically. Both write the same fact through the same aggregate operation.

### 5.9 `PRM` — Promotion (8 operations)

| Method & Path | Operation | Roles permitted | Own | Traces |
|---|---|---|---|---|
| `GET /promotions` | `listPromotions` — List promotions | Staff, Support, Admin |  | UC-PRM-01, UC-PRM-05; FR-PRM-01, FR-ADM-06 |
| `POST /promotions` | `createPromotion` — Create a promotion | Staff, Admin |  | UC-PRM-01; FR-PRM-01, FR-PRM-07, FR-ADM-06, FR-AUD-02; BR-PRM-01, BR-PRM-02, BR-AUD-01 |
| `GET /promotions/{promotionId}` | `getPromotion` — Get one promotion | Staff, Support, Admin |  | UC-PRM-01; FR-PRM-01 |
| `PATCH /promotions/{promotionId}` | `updatePromotion` — Update a promotion | Staff, Admin |  | UC-PRM-01; FR-PRM-01, FR-ADM-06, FR-AUD-02; BR-PRM-01, BR-PRM-02, BR-ORD-06 |
| `GET /promotions/{promotionId}/redemptions` | `listPromotionRedemptions` — List a promotion's redemptions | Staff, Support, Admin |  | UC-PRM-03; FR-PRM-09; BR-PRM-01 |
| `PUT /promotions/{promotionId}/status` | `setPromotionStatus` — Activate, pause, or expire a promotion | Staff, Admin |  | UC-PRM-04, UC-PRM-05; FR-PRM-06, FR-PRM-10, FR-AUD-02; BR-PRM-01, BR-ORD-06 |
| `POST /promotions/{promotionId}/vouchers` | `generatePromotionVouchers` — Generate voucher codes | Staff, Admin |  | UC-PRM-01; FR-PRM-07; BR-PRM-01 |
| `POST /voucher-validations` | `validateVoucher` — Validate a voucher code | Customer |  | UC-PRM-02; FR-PRM-08; BR-PRM-01 |

`validateVoucher` carries no ownership mark: a voucher is validated against the checkout in progress, not owned as a resource, and [`Error Codes.md`](./Error%20Codes.md) §3.10 notes the response is deliberately non-disclosive for exactly this endpoint.

### 5.10 `REV` — Review (11 operations)

| Method & Path | Operation | Roles permitted | Own | Traces |
|---|---|---|---|---|
| `GET /products/{productId}/rating-summary` | `getProductRatingSummary` — Get a product's aggregate rating | Guest, Customer, Staff, Support, Admin |  | UC-REV-04; FR-REV-07 |
| `GET /products/{productId}/reviews` | `listProductReviews` — View a product's reviews | Guest, Customer, Staff, Support, Admin |  | UC-REV-04; FR-REV-07; BR-REV-01 |
| `POST /products/{productId}/reviews` | `submitProductReview` — Submit a product review | Customer | ✓ | UC-REV-01; FR-REV-01, FR-REV-02, FR-REV-03, FR-REV-06; BR-REV-01, BR-REV-02, BR-REV-04 |
| `GET /reviews` | `listReviews` — List reviews for moderation | Staff, Support, Admin |  | UC-REV-05; FR-REV-08, FR-ADM-07 |
| `DELETE /reviews/{reviewId}` | `deleteOwnReview` — Delete the caller's own review | Customer, Admin | ✓ | UC-REV-03; FR-REV-05; BR-REV-02 |
| `GET /reviews/{reviewId}` | `getReview` — Get one review | Guest, Customer, Staff, Support, Admin |  | UC-REV-04; FR-REV-07 |
| `PATCH /reviews/{reviewId}` | `editOwnReview` — Edit the caller's own review | Customer | ✓ | UC-REV-02; FR-REV-04; BR-REV-03 |
| `POST /reviews/{reviewId}/images` | `addReviewImage` — Add an image to the caller's review | Customer | ✓ | UC-REV-01, UC-REV-02; FR-REV-03, FR-REV-04; BR-REV-03, BR-REV-04 |
| `DELETE /reviews/{reviewId}/images/{imageId}` | `removeReviewImage` — Remove an image from the caller's review | Customer, Support, Admin | ✓ | UC-REV-02; FR-REV-04; BR-REV-03 |
| `PUT /reviews/{reviewId}/moderation` | `moderateReview` — Moderate a review | Staff, Support, Admin |  | UC-REV-05; FR-REV-08, FR-ADM-07, FR-AUD-02; BR-AUD-01 |
| `POST /reviews/{reviewId}/reports` | `reportReview` — Report a review | Guest, Customer, Staff, Support, Admin |  | UC-REV-05; FR-REV-08 |

**`reportReview` is the one `REV` row that widens past the domain grid's `read` for Guest** (§6.1): reporting hides nothing by itself — a moderator still decides — so the write grants no visibility authority and is safe to open to any visitor per `UC-REV-05`.

### 5.11 `NTF` — Notification (8 operations)

| Method & Path | Operation | Roles permitted | Own | Traces |
|---|---|---|---|---|
| `GET /accounts/me/notification-preferences` | `getOwnNotificationPreferences` — Get the caller's notification preferences | Customer | ✓ | UC-NTF-04; FR-NTF-05; BR-NTF-02 |
| `PUT /accounts/me/notification-preferences` | `setOwnNotificationPreferences` — Update the caller's notification preferences | Customer | ✓ | UC-NTF-04; FR-NTF-05; BR-NTF-02 |
| `GET /notification-deliveries` | `listNotificationDeliveries` — Review delivery outcomes | Support, Admin |  | UC-NTF-03; FR-NTF-06; BR-NTF-01 |
| `POST /notification-read-marks` | `markNotificationsRead` — Mark every notification read | Customer | ✓ | UC-NTF-03; FR-NTF-04 |
| `POST /notification-unsubscriptions` | `unsubscribeFromPromotionalNotifications` — Unsubscribe using a single-use token | Guest, Customer |  | UC-NTF-04; FR-NTF-05; BR-NTF-02 |
| `GET /notifications` | `listOwnNotifications` — View the caller's in-app notifications | Customer | ✓ | UC-NTF-03; FR-NTF-04 |
| `DELETE /notifications/{notificationId}` | `dismissNotification` — Dismiss a notification | Customer | ✓ | UC-NTF-03; FR-NTF-04; BR-NTF-01 |
| `PATCH /notifications/{notificationId}` | `setNotificationReadState` — Mark a notification read or unread | Customer | ✓ | UC-NTF-03; FR-NTF-04 |

**`unsubscribeFromPromotionalNotifications` is the `NTF` deviation** (§6.1): it is unauthenticated by design — `UC-NTF-04` A1 requires unsubscribing by single-use token without signing in, because requiring a login to stop marketing mail is how unsubscribe links get ignored. It touches only the promotional opt-in; transactional messages are unaffected (`BR-NTF-02`).

### 5.12 `ADM` — Administration (9 operations)

| Method & Path | Operation | Roles permitted | Own | Traces |
|---|---|---|---|---|
| `DELETE /accounts/{accountId}` | `closeAccount` — Close an account at the customer's request | Admin |  | UC-ADM-03; FR-ADM-03, FR-AUD-02; BR-AUD-01 |
| `GET /accounts/{accountId}` | `getAccount` — Inspect a customer account | Support, Admin |  | UC-ADM-03; FR-ADM-03, FR-AUD-02; BR-AUD-01 |
| `PATCH /accounts/{accountId}` | `correctAccountProfile` — Correct a profile detail on the customer's request | Admin |  | UC-ADM-03; FR-ADM-03, FR-AUD-02; BR-AUD-01 |
| `GET /accounts/{accountId}/roles` | `listAccountRoles` — List an account's roles | Admin |  | UC-ADM-06; FR-ADM-09; BR-AUD-02 |
| `POST /accounts/{accountId}/roles` | `grantAccountRole` — Grant a role | Admin |  | UC-ADM-06; FR-ADM-09, FR-AUD-02; BR-AUD-01, BR-AUD-03 |
| `DELETE /accounts/{accountId}/roles/{roleCode}` | `revokeAccountRole` — Revoke a role | Admin |  | UC-ADM-06; FR-ADM-09, FR-AUD-02; BR-AUD-01, BR-AUD-03 |
| `DELETE /accounts/{accountId}/sessions` | `endAccountSessions` — End every session held by an account | Admin |  | UC-ADM-06; FR-ADM-09, FR-AUD-02; BR-CUS-03, BR-AUD-01 |
| `PUT /accounts/{accountId}/status` | `setAccountStatus` — Suspend or reinstate an account | Admin |  | UC-ADM-03; FR-ADM-03, FR-AUD-02; BR-AUD-01, BR-CUS-03 |
| `GET /roles` | `listRoles` — List roles and the authority each confers | Admin |  | UC-ADM-06; FR-ADM-09, FR-AUD-05; BR-AUD-02 |

**Every write here is Administrator-only, and `getAccount` is the sole place Support reaches this domain.** §9 covers why: SRS §2.3 gives Support only `read` on Customer & Identity, while `UC-ADM-03` names Support as the primary actor suspending and correcting accounts. This matrix takes the SRS reading, fails closed on the disagreement, and flags it as unresolved rather than widening quietly.

### 5.13 `RPT` — Reporting & Analytics (8 operations)

| Method & Path | Operation | Roles permitted | Own | Traces |
|---|---|---|---|---|
| `POST /report-exports` | `requestReportExport` — Export a report | Staff, Warehouse, Admin |  | UC-RPT-06, UC-AUD-02; FR-RPT-10, FR-AUD-02, FR-AUD-04; BR-RPT-01, BR-AUD-01 |
| `GET /report-exports/{exportId}` | `getReportExport` — Get an export job's status | Staff, Warehouse, Admin | ✓ | UC-RPT-06; FR-RPT-10 |
| `GET /report-exports/{exportId}/content` | `downloadReportExport` — Download an export | Staff, Warehouse, Admin | ✓ | UC-RPT-06; FR-RPT-10, FR-AUD-02; BR-AUD-01 |
| `GET /reports/customers` | `getCustomerReport` — View the customer report | Staff, Admin |  | UC-RPT-03; FR-RPT-04, FR-RPT-07, FR-AUD-02; BR-RPT-01, BR-AUD-01 |
| `GET /reports/inventory` | `getInventoryReport` — View the inventory report | Staff, Warehouse, Admin |  | UC-RPT-04; FR-RPT-06; BR-RPT-01 |
| `GET /reports/order-statistics` | `getOrderStatisticsReport` — View order and conversion statistics | Staff, Admin |  | UC-RPT-05; FR-RPT-08, FR-RPT-09; BR-RPT-01 |
| `GET /reports/product-performance` | `getProductPerformanceReport` — View the product performance report | Staff, Admin |  | UC-RPT-02; FR-RPT-03, FR-RPT-05; BR-RPT-01 |
| `GET /reports/revenue` | `getRevenueReport` — View the revenue report | Staff, Admin |  | UC-RPT-01; FR-RPT-01, FR-RPT-02, FR-ADM-08; BR-RPT-01 |

Staff reaches `commercial reports` (revenue, product performance, customers, order statistics) and Warehouse reaches `inventory reports`, exactly splitting SRS §2.3's Reporting & Analytics row; export endpoints are open to both because an export is a delivery mechanism for whichever report the caller could already view, not a distinct authority.

### 5.14 `AUD` — Audit & Access Control (2 operations)

| Method & Path | Operation | Roles permitted | Own | Traces |
|---|---|---|---|---|
| `GET /audit-entries` | `searchAuditTrail` — Search the audit trail | Support, Admin |  | UC-AUD-02; FR-AUD-04, FR-AUD-02, FR-DAT-05; BR-AUD-01 |
| `GET /audit-entries/{auditEntryId}` | `getAuditEntry` — Get one audit entry | Support, Admin |  | UC-AUD-02; FR-AUD-03, FR-AUD-04; BR-AUD-01 |

**Read-only for every role, including Administrator, and that is the whole point.** There is no third operation here because [ADR-0017](../01-system/ADR/ADR-0017-append-only-audit-log.md) exposes no mutation endpoint at any layer, for any role — `BR-AUD-01`'s immutability holds structurally, not by a permission check that a future change could loosen.

---

## 6. Reconciliation With the Domain-Level Grid

Every non-blank cell in the SRS §2.3 / [`Integration Contract.md`](./Integration%20Contract.md) §9 grid must be reachable through at least one row in §5, and every blank cell must be unreachable. Twelve of the fourteen domain rows match the operation-level grant exactly with no comment needed. Two categories of exception exist, both already identified in [`OpenAPI/README.md`](./OpenAPI/README.md) §5.1; they are restated here in full because a reader of *this* document should not have to cross-check a second one to get the complete picture.

### 6.1 Four places an operation grants more than the domain cell literally says

| Domain cell | Grid says | Operations say | Why it is not a bug |
|---|---|---|---|
| Customer & Identity, Staff / Warehouse | `—` | `getOwnAccount`, `updateOwnProfile`, `changeOwnPassword`, session operations (§5.1) | The grid describes access to *customer records*. It was never meant to forbid a Staff member from logging out or changing their own password. Only `own`-scoped operations open; no operator reaches another account through `identity.yaml`. |
| Inventory, Customer | `availability only` | No `INV` endpoint | Satisfied inside `CAT` and `SCH` responses (`VariantAvailability`) instead of a dedicated endpoint — quantities and warehouse structure stay hidden from Guest and Customer either way. |
| Notification, Guest | *(blank)* | `unsubscribeFromPromotionalNotifications` (§5.11) | `UC-NTF-04` A1 requires it unauthenticated; it grants no read access to anything, only an opt-out. |
| Review, Guest | `read` | `reportReview` also open (§5.10) | Reporting hides nothing by itself; a write with zero visibility authority is not the access the grid's `read` cell is protecting. |

### 6.2 One disagreement between the source documents, unresolved

**SRS §2.3 and [`UC-ADM-03`](../../BA-docs/use-cases/12-administration.md) disagree about Customer Support's authority over an account, and this matrix cannot satisfy both simultaneously.**

- SRS §2.3 grants Support `read` on Customer & Identity — and grants the *same table* `read, cancel, return` on Checkout & Order, which proves the grid does express verbs beyond `read` where it means to. It says `read` here on purpose, and this table is normative for `FR-AUD-05`.
- [`UC-ADM-03`](../../BA-docs/use-cases/12-administration.md) names Customer Support Agent as **primary actor**, suspending accounts, reinstating them, and correcting profile details (steps 4, A2, A3).

§5.12 takes the narrower reading: `setAccountStatus`, `correctAccountProfile`, and `closeAccount` are `ADMINISTRATOR`-only. Two reasons, both structural rather than a coin flip: [`Integration Contract.md`](./Integration%20Contract.md) §10 states that where the grid and SRS §2.3 disagree, SRS §2.3 wins; and a permission contract that is uncertain about who may suspend an account should fail closed, not open. Support keeps exactly the part both sources agree on — `getAccount` and `searchAccounts`. The same reasoning excludes Support from `advanceOrderStatus`: the grid gives Support `cancel` and `return`, which they hold through `cancelOrder` and `resolveOrderReturn`, but not `progress`.

**This is a Business Analysis decision, not an architecture one, and it is still open.** If `UC-ADM-03`'s actor assignment is the intended behaviour, SRS §2.3's Customer & Identity row should read `read, suspend, correct` for Support, and `setAccountStatus`, `correctAccountProfile`, and `closeAccount` widen to match in the same change. Until the SRS says so, this matrix does not get ahead of the requirement it implements.

---

## 7. System Actors Authorised by Signature

Two operations sit outside the six-role grid entirely because their caller is not a human actor SRS §2.3's role table covers — it is a system actor from the same section's second table.

| Operation | Actor | Security | Why not a role |
|---|---|---|---|
| `receivePaymentProviderNotification` | Payment Gateway | `providerSignature` — [Security.md](../01-system/Security.md) §9.1 | An inbound callback carries no user session at all. The signature *is* the authentication ([Security.md](../01-system/Security.md) §9.1: "verification precedes authorisation, not the reverse"). |
| `receiveCarrierEvent` | Shipping Carrier | `providerSignature` | Same reasoning, `UC-SHP-04` E4. |

Both operations authenticate by a body signature verified against bytes captured before parsing (`Security.md` §9.1 step 1), never by a bearer token or session cookie, and an unverifiable callback is recorded and rejected, never applied (`Security.md` §9.1 step 4). This is a different trust mechanism from every other row in §5, not a weaker one — a forged signature is refused before it reaches any business logic, exactly as a wrong role is.

---

## 8. Governance

Unchanged from [`Integration Contract.md`](./Integration%20Contract.md) §10, restated here because this is the file a reviewer reaches for:

| Concern | Rule |
|---|---|
| Ownership | Identity & Access, tracking SRS §2.3 |
| Source of truth | SRS §2.3. If this document and SRS §2.3 disagree, **SRS §2.3 is right**, and this document is stale until corrected. |
| Adding an operation | The new operation's `x-ecp-roles` in [`OpenAPI/paths/`](./OpenAPI/) is authored first, checked against the domain-level grid the way §6 does, and this document's matching domain table is updated in the same change. |
| Widening a grant | Requires the SRS §2.3 cell to already permit it, or an SRS change landing first (§6.2 is the live example of a grant this document has deliberately **not** widened without one). |
| Narrowing a grant | Ships freely — it can only remove authority a caller already lacked no legitimate use for, and is the safe direction under `NFR-SEC-01`. |

---

## 9. Open Item

**Customer Support's authority over customer accounts (§6.2) needs a Business Analysis decision, not another architecture reading.** Every operation in §5.12 is already built to flip from `ADMINISTRATOR`-only to include `CUSTOMER_SUPPORT` in one change, the moment SRS §2.3's Customer & Identity row is corrected (or `UC-ADM-03`'s actor assignment is). Until then, Support's `read`-only reach into `ADM` is the contract, and any story that requires Support to suspend or correct an account is currently unimplementable by design, not by oversight.

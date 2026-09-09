# Routing — Enterprise Commerce Platform (ECP)

**Document type:** Frontend architecture specification (normative)
**Status:** **Proposed** — discharges [`ADR-0019`](../01-system/ADR/ADR-0019-nextjs-app-router-rendering-strategy.md) §5's deferral of route grouping and layout composition
**Audience:** Frontend Engineering, Architecture Review, QA, Product Management
**Related documents:** [Frontend Architecture](./Frontend%20Architecture.md) · [Data Fetching](./Data%20Fetching.md) · [State Management](./State%20Management.md) · [Performance](./Performance.md) · [ADR-0019](../01-system/ADR/ADR-0019-nextjs-app-router-rendering-strategy.md) · [OpenAPI](../04-shared/OpenAPI/README.md) · [Permission Matrix](../04-shared/Permission%20Matrix.md) · [Use Cases](../../BA-docs/use-cases/README.md)

---

## 1. What This Document Is

[`04-shared/OpenAPI/`](../04-shared/OpenAPI/README.md) describes 121 paths and 155 operations across fourteen domains. [`Permission Matrix.md`](../04-shared/Permission%20Matrix.md) says which of six roles may call each one. Neither says what a customer sees.

This document is the map: every route in `ecp-web`, what renders it, what it reads, who reaches it, and what it costs. It is the artefact that makes the contract navigable from the UI side, and §10 asserts its coverage against the contract's own count.

**It decides nothing about authorisation.** Every role column below describes which controls are *drawn*, and [`Frontend Architecture.md`](./Frontend%20Architecture.md) §3.4 is the standing rule: hiding a control is a courtesy, the server decides, and a route that renders for the wrong caller is a UI defect rather than a security breach. `NFR-SEC-01` is verified by [`Security.md`](../01-system/Security.md) §12.1's matrix, never by driving a browser ([`Testing and Benchmark Strategy.md`](../01-system/Testing%20and%20Benchmark%20Strategy.md) §6.7).

---

## 2. Route Groups and Layout Composition

```nano
app/
├── layout.tsx                    root — html · body · font · CSP nonce · providers
│
├── (storefront)/layout.tsx       header · search · cart badge · footer
│   ├── page.tsx                                             /
│   ├── c/[...slug]/                                         /c/...
│   ├── p/[productId]/                                       /p/{id}
│   ├── search/                                              /search
│   ├── cart/ · wishlist/
│   └── checkout/layout.tsx       focused shell — navigation suppressed
│       └── ...                                              /checkout/...
│
├── (auth)/layout.tsx             minimal shell, no navigation
│   └── sign-in/ · register/ · verify-email/ · forgot-password/ · reset-password/
│
├── (account)/layout.tsx          storefront shell + account sidebar
│   └── account/...                                          /account/...
│
├── (admin)/layout.tsx            operator shell — dense navigation, no storefront chrome
│   └── admin/...                                            /admin/...
│
└── api/                          the closed list of route handlers (§9)
```

Four groups, four postures:

| Group | URL prefix | Session | Cookie `SameSite` | Rendering | Budget |
|---|---|---|---|---|---|
| `(storefront)` | `/` | Optional — `GUEST` reaches most of it | `Lax` | Mostly `R1`/`R2` | `P1`/`P2` |
| `(auth)` | `/sign-in`, … | None, by construction | `Lax` | `R3` | `P3` |
| `(account)` | `/account` | Required — `CUSTOMER` | `Lax` | `R3` | `P3` |
| `(admin)` | `/admin` | Required — operator role | **`Strict`** | `R4` | `P4` |

**Checkout is a nested layout, not a fifth group.** It lives inside `(storefront)` because the customer is still shopping and the cart badge, the session, and the guest-cart cookie all carry through unchanged. What it changes is chrome: navigation is suppressed so the funnel has one exit, per [`UI Design System.md`](./UI%20Design%20System.md) §9's one-primary-objective rule.

**`(admin)` is a route group, not a second application.** [`Deployment Diagram.md`](../01-system/Deployment%20Diagram.md) §2 runs one `ecp-web`; the separation is a layout and a cookie posture. What it is emphatically not is a security boundary — see §11.

---

## 3. Rendering and Budget Classes

The four classes of [`ADR-0019`](../01-system/ADR/ADR-0019-nextjs-app-router-rendering-strategy.md) §4, named so the tables below can be read at a glance:

| Class | Strategy | Cache | Used for |
|---|---|---|---|
| **R1** | Static with incremental revalidation, invalidated on catalog events | `force-cache` + tags ([`Data Fetching.md`](./Data%20Fetching.md) §7) | Home, category, product detail |
| **R2** | Dynamic server render, streamed | `no-store`, streamed sections | Search results and facets |
| **R3** | Dynamic server render, never cached | `no-store` | Cart, checkout, account, orders, auth |
| **R4** | Dynamic server render, client-interactive within | `no-store` | Admin console |

Budget classes `P1`–`P4` are defined in [`Performance.md`](./Performance.md) §2 and referenced here only.

**`R1` routes are the only ones a crawler is meant to index.** `(auth)`, `(account)`, `(admin)`, cart, and checkout carry `noindex` and are excluded from the sitemap. A cached account page is the failure this distinction prevents.

---

## 4. Storefront Routes

Operations named are `operationId`s from [`OpenAPI/`](../04-shared/OpenAPI/README.md).

### 4.1 Catalog and discovery — `P11`'s surface

| Route | Class | Reads | Writes | Boundaries |
|---|---|---|---|---|
| `/` | **R1** | `listFeaturedCategories` · `listTrendingProducts` · `listNewArrivals` | — | One per recommendation rail; a failing rail collapses to its empty state |
| `/` — personalised rail | **R2** *(inside the R1 shell)* | `listPersonalisedRecommendations` | — | Signed-in customers only. Streamed into its own boundary; absent for `GUEST` |
| `/c/[...slug]` | **R1** | `getCategory` · `listCategoryProducts` · `listCategories` (navigation) | — | Product grid streams; facet panel is its own boundary |
| `/p/[productId]` | **R1** | `getProduct` · `listProductVariants` · `listProductImages`¹ · `getProductRatingSummary` | — | **Four separate boundaries** — see below |
| `/search` | **R2** | `searchProducts` · `listPopularKeywords` | `removeOwnRecentKeyword` · `clearOwnRecentKeywords` | Results and facets stream inside one boundary; suggestions are client-side |

¹ Images arrive with `getProduct`; `addProductImage` / `removeProductImage` are admin operations (§7.2).

**The product page is the clearest expression of `NFR-AVAIL-02` in the whole application**, and its boundary layout is normative rather than incidental:

| Section | Source | Authority | If it fails |
|---|---|---|---|
| Product, variants, price | `getProduct`, `listProductVariants` | Advisory — `BR-ORD-06` binds at placement | The page fails. This is the page |
| Availability | Catalog projection ([`ADR-0014`](../01-system/ADR/ADR-0014-elasticsearch-search-read-model.md)) | **Advisory, labelled** ([`Data Fetching.md`](./Data%20Fetching.md) §4.2) | "Availability unknown" — never blocks add-to-cart, because the binding check is at checkout |
| Reviews | `listProductReviews`, `getProductRatingSummary` | Advisory | Section-level empty state. Purchase remains possible |
| Related · frequently-bought-together | `listRelatedProducts`, `listFrequentlyBoughtTogetherForProduct` | Advisory | Rail disappears silently. A recommendation outage is not an event a customer should be told about |

**The personalised rail is the one place an `R1` route contains dynamic content**, and it is worth naming rather than discovering. The home page's shell, featured categories, trending products, and new arrivals are statically generated and shared by everyone; `listPersonalisedRecommendations` is per-customer and cannot be. It therefore streams into its own boundary as a dynamic section inside a static page, which keeps the `P1` budget of [`Performance.md`](./Performance.md) §2 on the parts that carry LCP and confines the per-request cost to the rail. For a `GUEST` the rail is not rendered at all, so the page is wholly static. A personalised section placed above the fold, or one that the shell awaits, would make the whole route dynamic and forfeit exactly what [`ADR-0019`](../01-system/ADR/ADR-0019-nextjs-app-router-rendering-strategy.md) §4 made it static for.

Search typeahead (`getSearchSuggestions`, `listOwnRecentKeywords`) is the one client-fetched read on these pages — case 1 of [`Data Fetching.md`](./Data%20Fetching.md) §5, debounced against `NFR-PERF-04`'s 150 ms budget.

### 4.2 Cart and wishlist

| Route | Class | Reads | Writes | Notes |
|---|---|---|---|---|
| `/cart` | **R3** | `getCurrentCart` | `addCartLine` · `updateCartLineQuantity` · `removeCartLine` | Server-fetched on load; client cache for in-page editing only (case 2). Quantity changes are optimistic; a failure reverts visibly |
| `/wishlist` | **R3** | `getOwnWishlist` | `addWishlistItem` · `removeWishlistItem` · `moveWishlistItemsToCart` | `CUSTOMER` only. A `GUEST` reaching it is redirected to sign-in with a return path |

`mergeGuestCart` has no route. It runs on the sign-in path, server-side, when a guest cart cookie is present (`FR-CRT-06`, `BR-CRT-03`).

### 4.3 Checkout — `R3`, never cached, never optimistic

| Route | Reads | Writes |
|---|---|---|
| `/checkout` | `initiateCheckout` · `getCurrentCheckout` | — |
| `/checkout/shipping` | `getShippingQuotes` | `setCheckoutShippingAddress` · `selectCheckoutShippingOption` |
| `/checkout/payment` | `listEligiblePaymentMethods` | `setCheckoutBillingInformation` · `selectCheckoutPaymentMethod` |
| `/checkout/review` | `getOrderSummary` | `applyCheckoutVoucher` · `removeCheckoutVoucher` · `validateVoucher` · **`placeOrder`** |
| `/checkout/payment/processing` | `getOrderPayment` (polled) | `initiatePayment` · `retryPayment` |
| `/checkout/confirmation/[orderId]` | `getOrder` · `listOrderLines` | — |

Six rules bind this funnel, and each has a named source:

1. **Nothing here is cached and nothing here is optimistic.** `NFR-PERF-06` permits no lag on payment state; [`ADR-0011`](../01-system/ADR/ADR-0011-optimistic-locking-reservation-model.md) means a placement can be rejected after the customer has committed.
2. **`placeOrder` carries an `Idempotency-Key` minted once per attempt** and reused on any user-initiated retry ([`Data Fetching.md`](./Data%20Fetching.md) §6.2). Never regenerated — regenerating it is how a duplicate order happens.
3. **A timeout is never retried automatically.** The outcome is unknown; the customer is told so and offered one explicit retry ([`ADR-0023`](../01-system/ADR/ADR-0023-server-first-data-fetching.md) §4).
4. **`ECP-INV-4091` renders as "sold out", not as an error.** It is expected under peak ([`Error Codes.md`](../04-shared/Error%20Codes.md)), and "sold out" and "try again" must be visibly different outcomes.
5. **`ECP-PRM-4090` fails the voucher field, not the checkout.**
6. **The provider return is a route handler, not a page** (§9). It verifies, then redirects to `/checkout/payment/processing`, which polls (case 3 of [`Data Fetching.md`](./Data%20Fetching.md) §5) until the payment resolves.

**Cash on delivery has no additional storefront route.** `settleCashOnDelivery` is an operator action (§7.5).

---

## 5. Auth Routes — `(auth)`, `R3`

| Route | Reads | Writes |
|---|---|---|
| `/sign-in` | — | `logIn` (+ `mergeGuestCart` on the same path) |
| `/register` | — | `registerAccount` |
| `/verify-email` | — | `verifyEmailAddress` · `resendEmailVerification` |
| `/forgot-password` | — | `requestPasswordReset` |
| `/reset-password` | — | `completePasswordReset` |

Three properties, all of them security requirements rather than UX preferences:

- **No response discloses whether an account exists.** Sign-in failures and reset requests return identical messaging ([`ADR-0025`](../01-system/ADR/ADR-0025-httponly-cookie-session.md) §4, [`Security.md`](../01-system/Security.md) §4.5). This is a rendering rule and it is easy to break by being helpful.
- **Failures use [`UI Design System.md`](./UI%20Design%20System.md) §13's empty-state pattern** — concise explanation, clear primary action.
- **Targets are at least 44×44px with visible focus** (§14). Named explicitly by [`ADR-0025`](../01-system/ADR/ADR-0025-httponly-cookie-session.md) §4 for these screens.

`logOut` and `renewSession` have no routes. Logout is an action that clears the cookie *and* invalidates the refresh token server-side; renewal is internal to `ecp-web`'s serialised refresh ([`Frontend Architecture.md`](./Frontend%20Architecture.md) §4.2) and is never customer-initiated.

---

## 6. Account Routes — `(account)`, `R3`, `CUSTOMER`

| Route | Reads | Writes |
|---|---|---|
| `/account` | `getOwnAccount` · `listOrders` (recent) | — |
| `/account/profile` | `getOwnAccount` | `updateOwnProfile` |
| `/account/security` | — | `changeOwnPassword` · `endAllOwnSessions` |
| `/account/addresses` | `listOwnAddresses` | `addOwnAddress` · `replaceOwnAddress` · `removeOwnAddress` |
| `/account/addresses/[addressId]` | `getOwnAddress` | `replaceOwnAddress` |
| `/account/orders` | `listOrders` | — |
| `/account/orders/[orderId]` | `getOrder` · `listOrderLines` · `getOrderPayment` · `listOrderShipments` | `cancelOrder` |
| `/account/orders/[orderId]/tracking` | `trackOrder` · `listShipmentTrackingEvents` · `getShipment` | — |
| `/account/orders/[orderId]/return` | `getOrderReturnRequest` | `requestOrderReturn` |
| `/account/reviews` | `listReviews` (own) | `editOwnReview` · `deleteOwnReview` · `addReviewImage` · `removeReviewImage` |
| `/account/notifications` | `listOwnNotifications` | `setNotificationReadState` · `dismissNotification` · `markNotificationsRead` |
| `/account/preferences` | `getOwnNotificationPreferences` · `getOwnPersonalisationPreference` | `setOwnNotificationPreferences` · `setOwnPersonalisationPreference` |

`submitProductReview` is written from the product page and from the order-detail page, not from a route of its own — a customer reviews a thing, not a form.

**The ownership `404` is load-bearing here.** [`Integration Contract.md`](../04-shared/Integration%20Contract.md) §2.1 returns `404` rather than `403` for another customer's order specifically so existence is not disclosed. `/account/orders/[orderId]` renders `notFound()` and **must not** say "you don't have permission to view this order" — which would undo the non-disclosure the status code was chosen to provide ([`Data Fetching.md`](./Data%20Fetching.md) §9).

`unsubscribeFromPromotionalNotifications` is reachable from an emailed link at `/unsubscribe`, which sits in `(auth)`'s minimal shell because the recipient is by definition not signed in.

---

## 7. Admin Console — `(admin)`, `R4`, `SameSite=Strict`

**The console repeats one shape**: a filtered list → a detail view → actions on the detail. Where a domain follows it exactly, the table gives the operations and nothing more; where it does not, the deviation is stated. Roles are from [`Permission Matrix.md`](../04-shared/Permission%20Matrix.md) §5 and describe **which controls are drawn**, nothing else.

### 7.1 Overview

| Route | Reads | Roles drawn for |
|---|---|---|
| `/admin` | `getOrderStatisticsReport` · `getRevenueReport` · `getInventoryReport` | `STAFF` · `ADMINISTRATOR` |

The dashboard awaits its reads **concurrently in one Server Component**, each in its own boundary, each showing its own staleness ([`ADR-0036`](../01-system/ADR/ADR-0036-nextjs-server-sole-api-caller.md) §4). There is no aggregation endpoint. Reporting may lag five minutes (`NFR-PERF-06`) and the lag is displayed, not hidden.

### 7.2 Catalog

| Route | Reads | Writes |
|---|---|---|
| `/admin/products` | `listProducts` | `amendProductsInBulk` |
| `/admin/products/new` | `listCategories` | `createProduct` |
| `/admin/products/[productId]` | `getProduct` · `listProductVariants` | `updateProduct` · `deleteProduct` · `setProductPublication` · `addProductVariant` · `getProductVariant` · `removeProductVariant` · `changeVariantPrice` · `addProductImage` · `removeProductImage` |
| `/admin/categories` | `listCategories` | `createCategory` |
| `/admin/categories/[categoryId]` | `getCategory` · `listCategoryProducts` | `updateCategory` · `deleteCategory` |

**A catalog write does not revalidate the storefront directly.** It publishes through `ecp-api`; the catalog event drives revalidation ([`ADR-0038`](../01-system/ADR/ADR-0038-event-driven-catalog-revalidation.md)). One invalidation path, not two — and the operator sees the storefront update within seconds rather than on save, which the UI says.

### 7.3 Inventory

| Route | Reads | Writes |
|---|---|---|
| `/admin/inventory` | `listStockItems` · `listWarehouses` | — |
| `/admin/inventory/[stockItemId]` | `getStockItem` · `listStockAdjustments` | `adjustStock` · `commitStockReservation` |

`adjustStock` returns `ECP-INV-4091` when an adjustment would take available stock below what is reserved. That is a **designed outcome** with a designed screen, not an error boundary — the same code the storefront renders as "sold out" ([`Error Codes.md`](../04-shared/Error%20Codes.md)).

### 7.4 Orders

| Route | Reads | Writes |
|---|---|---|
| `/admin/orders` | `listOrders` | `advanceOrderStatusesInBulk` |
| `/admin/orders/[orderId]` | `getOrder` · `listOrderLines` · `getOrderPayment` · `listOrderShipments` | `advanceOrderStatus` · `cancelOrder` · `setOrderInvestigationFlag` |
| `/admin/orders/[orderId]/return` | `getOrderReturnRequest` | `resolveOrderReturn` |

Order status is a discriminated union ([`Frontend Architecture.md`](./Frontend%20Architecture.md) §6.2), so the permitted next transitions are exhaustive at compile time. An unhandled state is a build failure rather than a blank action bar.

### 7.5 Payment · Shipping

| Route | Reads | Writes |
|---|---|---|
| `/admin/payments` | `listUnmatchedPayments` | — |
| `/admin/payments/[paymentId]` | `getPayment` · `listPaymentAttempts` · `listPaymentRefunds` | `refundPayment` · `settleCashOnDelivery` |
| `/admin/shipments` | `listShipments` | `createShipment` |
| `/admin/shipments/[shipmentId]` | `getShipment` · `listShipmentTrackingEvents` | `confirmShipmentDelivery` |

`listUnmatchedPayments` is a reconciliation queue, and it is the one admin list that should be empty in normal operation. Its empty state says so — [`UI Design System.md`](./UI%20Design%20System.md) §13's "the design at rest," not "no data."

### 7.6 Promotion · Review

| Route | Reads | Writes |
|---|---|---|
| `/admin/promotions` | `listPromotions` | `createPromotion` |
| `/admin/promotions/[promotionId]` | `getPromotion` · `listPromotionRedemptions` | `updatePromotion` · `setPromotionStatus` · `generatePromotionVouchers` |
| `/admin/reviews` | `listReviews` | — |
| `/admin/reviews/[reviewId]` | `getReview` · `reportReview`¹ | `moderateReview` · `removeReviewImage` |

¹ `reportReview` is written by customers from the product page; the admin view reads the reports it produced.

### 7.7 Customers, roles, notifications

| Route | Reads | Writes |
|---|---|---|
| `/admin/customers` | `searchAccounts` | — |
| `/admin/customers/[accountId]` | `getAccount` · `listAccountRoles` · `listOrders` (scoped) | `correctAccountProfile` · `setAccountStatus` · `closeAccount` · `endAccountSessions` |
| `/admin/roles` | `listRoles` | `grantAccountRole` · `revokeAccountRole` |
| `/admin/notifications` | `listNotificationDeliveries` | — |

`endAccountSessions` is the operator-side counterpart of `endAllOwnSessions`, and both invalidate refresh chains server-side ([`ADR-0016`](../01-system/ADR/ADR-0016-jwt-refresh-rotation-rbac.md)). The UI states the consequence — the customer is signed out everywhere — because it is not reversible.

### 7.8 Reporting · Audit

| Route | Reads | Writes |
|---|---|---|
| `/admin/reports/revenue` | `getRevenueReport` | `requestReportExport` |
| `/admin/reports/products` | `getProductPerformanceReport` | `requestReportExport` |
| `/admin/reports/customers` | `getCustomerReport` | `requestReportExport` |
| `/admin/reports/inventory` | `getInventoryReport` | `requestReportExport` |
| `/admin/reports/orders` | `getOrderStatisticsReport` | `requestReportExport` |
| `/admin/reports/exports` | `getReportExport` (polled) | `downloadReportExport` |
| `/admin/audit` | `searchAuditTrail` | — |
| `/admin/audit/[auditEntryId]` | `getAuditEntry` | — |

**Every reporting screen displays its own lag.** `NFR-PERF-06` permits up to five minutes, and [`ADR-0023`](../01-system/ADR/ADR-0023-server-first-data-fetching.md) §4 requires it be shown rather than concealed — an operator making a decision on a five-minute-old figure must know that is what they are doing.

**The audit trail is read-only in the UI and in the data model.** [`ADR-0017`](../01-system/ADR/ADR-0017-append-only-audit-log.md) makes it append-only; no edit or delete control exists to draw.

---

## 8. Boundaries

| File | Placement | Contents |
|---|---|---|
| `loading.tsx` | Every route segment that fetches | A skeleton in the shape of the content. Never a spinner on a full page, and never sized from a count that may be absent ([`Data Fetching.md`](./Data%20Fetching.md) §8) |
| `error.tsx` | Every route group, plus any segment with independently-failing sections | [`UI Design System.md`](./UI%20Design%20System.md) §13's pattern, plus the correlation id. **No stack, no response body** ([`Security.md`](../01-system/Security.md) §8.4) |
| `not-found.tsx` | `(storefront)` and `(account)` | Never explains why. The ownership `404` is deliberately indistinguishable from absence |
| `<Suspense>` | Around **every** independently-fetched section | The concrete mechanism for `NFR-AVAIL-02` ([`ADR-0019`](../01-system/ADR/ADR-0019-nextjs-app-router-rendering-strategy.md) §4) |

**A section boundary is not the same thing as an error boundary at the page level**, and conflating them is how `NFR-AVAIL-02` gets lost: a reviews failure that reaches `error.tsx` has taken down the product page, which is exactly what the requirement forbids. Each of the four product-page sections in §4.1 owns both.

Empty and degraded states use the same pattern deliberately ([`UI Design System.md`](./UI%20Design%20System.md) §13): degradation gets a designed appearance rather than a broken one.

---

## 9. Route Handlers — A Closed List

[`ADR-0036`](../01-system/ADR/ADR-0036-nextjs-server-sole-api-caller.md) §4 fixes this list. Adding a fifth entry is an amendment to that record.

| Handler | Purpose |
|---|---|
| `/api/auth/*` | Sign-in, sign-out, and the payment provider's redirect return — flows that need an HTTP endpoint a Server Action cannot provide |
| `/api/csrf` | Issues the `ecp_csrf` companion token ([`Frontend Architecture.md`](./Frontend%20Architecture.md) §4.3) |
| `/api/internal/revalidate` | The signed, internal-network-only revalidation callback ([`ADR-0038`](../01-system/ADR/ADR-0038-event-driven-catalog-revalidation.md)) |
| `/healthz` | Process liveness. **Does not proxy `ecp-api`'s health** — see [`Frontend Architecture.md`](./Frontend%20Architecture.md) §7 |

**None of these is a public API.** Nothing here is contract-stable, versioned, or described in [`04-shared/`](../04-shared/Integration%20Contract.md), and a future mobile client calls `ecp-api` rather than any of it ([`Frontend Architecture.md`](./Frontend%20Architecture.md) §9).

`/robots.txt` and `/sitemap.xml` are generated from the `R1` routes only.

---

## 10. Coverage Against the Contract

[`OpenAPI/README.md`](../04-shared/OpenAPI/README.md) counts 155 operations. Every one is either named in a table above or listed here, so an absence is visible rather than mistaken for an oversight.

### 10.1 Authorised by signature, never reachable from `ecp-web`

| Operation | Why |
|---|---|
| `receivePaymentProviderNotification` | System actor. Terminates at `nginx` and routes to `ecp-api` ([`Deployment Diagram.md`](../01-system/Deployment%20Diagram.md) §2). The browser is not involved, and `ecp-web` must never proxy it |
| `receiveCarrierEvent` | Same |

These carry `x-ecp-roles: []` and `providerSignature` security ([`Permission Matrix.md`](../04-shared/Permission%20Matrix.md) §2.2). A frontend route for either would be a security defect, not a missing feature.

### 10.2 Reached from a flow rather than from a route of its own

| Operation | Where |
|---|---|
| `renewSession` | `ecp-web`'s serialised refresh, internal ([`Frontend Architecture.md`](./Frontend%20Architecture.md) §4.2) |
| `logOut` | The account menu action; clears the cookie and invalidates server-side |
| `mergeGuestCart` | The sign-in path, when a guest cart cookie is present |
| `getSearchSuggestions` · `listOwnRecentKeywords` | The typeahead component, client-side (§4.1) |
| `listFrequentlyBoughtTogetherForCart` | The cart page's recommendation rail |
| `submitProductReview` | The product page and the order-detail page |
| `getCart` | Operator and support views of a customer's cart, from `/admin/customers/[accountId]` |
| `listProductReviews` | The product page's review section |

### 10.3 The remainder

Every other operation appears in a table in §4–§7. **The frontend surfaces the contract, it does not extend it**: no route reads anything the contract does not expose, and no screen exists that would need an operation the contract does not have. Where a screen would benefit from one — an admin dashboard aggregate is the obvious candidate — [`ADR-0036`](../01-system/ADR/ADR-0036-nextjs-server-sole-api-caller.md) §5 routes that to a new backend read model rather than to a frontend aggregation layer.

---

## 11. Middleware

One middleware, doing four things and no more:

| Does | Detail |
|---|---|
| Sets security headers and the per-request CSP nonce | [`Frontend Architecture.md`](./Frontend%20Architecture.md) §5 |
| Threads or mints `X-Correlation-Id` | [`Data Fetching.md`](./Data%20Fetching.md) §2.1 |
| Redirects unauthenticated callers away from `(account)` and `(admin)` | With a return path |
| Selects the cookie posture per group | `Strict` on `(admin)`, `Lax` elsewhere |

**The third row is routing, not authorisation.** An operator role is never checked in middleware to decide whether a request may proceed — `ecp-api` decides, on every call, and `T9` in [`Security.md`](../01-system/Security.md) §13 is the threat that exists because a redirect looks like a permission check. A caller who reaches `/admin` with a `CUSTOMER` session sees an admin shell with empty sections and `403`s behind every read, which is correct behaviour and not a bug to be fixed in middleware.

Middleware makes **no** API call. It reads the cookie's presence, not its meaning; validating a session there would put a backend round trip on every asset request.

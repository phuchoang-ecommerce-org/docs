# Sequence Diagrams — Cart, Catalog, and Search

**Document type:** Backend architecture specification
**Status:** **Proposed**
**Audience:** Backend Engineering, Frontend Engineering, Architecture Review
**Related documents:** [README](./README.md) · [UC-CRT](../../../BA-docs/use-cases/05-cart-wishlist.md) · [UC-CAT](../../../BA-docs/use-cases/02-catalog-category.md) · [UC-SCH](../../../BA-docs/use-cases/03-search-recommendation.md) · [ADR-0014](../../01-system/ADR/ADR-0014-elasticsearch-search-read-model.md) · [ADR-0015](../../01-system/ADR/ADR-0015-redis-cache-and-rate-limiting.md) · [ADR-0023](../../01-system/ADR/ADR-0023-server-first-data-fetching.md)

---

## 1. Purpose

Everything before the obligation begins. These are the highest-traffic paths in the platform and the ones where a customer is most easily lost, and the architecture reflects that: almost nothing here is authoritative.

One rule governs the whole group. **A price or an availability figure shown while browsing is display data.** The binding price is frozen at placement (`BR-ORD-06`) and the binding availability is the versioned check inside the Partnership ([ADR-0011](../../01-system/ADR/ADR-0011-optimistic-locking-reservation-model.md)). Every read model below is allowed to be stale, and the design's job is to make sure that staleness is discovered at a cheap moment rather than an expensive one.

Search is not a bounded context. [Domain Model §3](../Domain%20Model.md) folds `SCH` into Catalog: keyword search, filtering, and ranking are an alternate query path over Catalog's own data with no business rules of their own. Its read model is a CQRS projection *inside* Catalog.

---

## 2. UC-CRT-01 — Add an Item to the Cart

| | |
|---|---|
| **Use cases** | `UC-CRT-01` · `UC-CAT-03` |
| **Business rules** | `BR-CRT-01` · `BR-CRT-02` · `BR-CRT-03` · `BR-CRT-04` · `BR-CAT-02` |
| **Quality** | `NFR-PERF-01` |
| **Decisions** | [ADR-0015](../../01-system/ADR/ADR-0015-redis-cache-and-rate-limiting.md) · [ADR-0025](../../01-system/ADR/ADR-0025-httponly-cookie-session.md) |
| **Problems** | `P1` |

```mermaid
sequenceDiagram
  autonumber
  actor Guest
  participant Browser
  participant Next as Next.js server
  participant Ctl as CartController
  participant CartSvc as AddCartLineService
  participant Cart
  participant Catalog as CatalogQueryService
  participant Inventory as InventoryQueryService
  participant PG as PostgreSQL

  Guest->>Browser: add to cart
  Browser->>Next: POST /cart/lines — guest cart cookie, or none yet
  Next->>Ctl: POST /api/v1/carts/{cartId}/lines
  Note over Next,Ctl: request pipeline — 00-Overview.md §2. A Guest reaches this<br/>endpoint unauthenticated: cart and browse state must be<br/>servable without a Customer aggregate (P1).
  Ctl->>CartSvc: addLine(cartId, variantId, quantity, correlationId)

  opt no cart exists yet
    CartSvc->>Cart: create for this guest session or customer
    Cart->>PG: INSERT cart_cart
    Note over Cart: BR-CRT-01 — the cart carries an expiry from creation.<br/>The window is configurable, not an architectural constant.
  end

  CartSvc->>Catalog: is the variant published?
  Catalog-->>CartSvc: publication status (BR-CAT-02)
  CartSvc->>Inventory: advisory availability for the SKU
  Inventory-->>CartSvc: available quantity — ADVISORY, nothing is held
  Note over Inventory: BR-CRT-02. Reserving here would strand stock for every<br/>browsing session on the site. The authoritative check<br/>happens once, under a lock, at 01-Ordering.md §6.

  alt published and sufficient stock appears available
    CartSvc->>Cart: add or increase the line
    Cart->>PG: INSERT or UPDATE cart_cart_line — variantId and quantity ONLY
    Note over Cart,PG: BR-CRT-04 — a CartLine carries NO price. Storing one would<br/>create a second, silently diverging price alongside<br/>Catalog's, and the customer would eventually be shown one<br/>and charged the other.
    CartSvc-)Cart: CartLineAdded — in-process
    CartSvc-->>Ctl: the updated cart
  else not published, or nothing available
    CartSvc-->>Ctl: 422 — stating which, and why
    Note over CartSvc: BR-CRT-03 — the platform never silently drops or<br/>silently adjusts a line. A quantity that exceeds<br/>availability is capped and the cap is STATED.
  end

  Ctl-->>Next: cart resource
  Next-->>Browser: Set-Cookie guest cart id, if newly created
  Note over Next,Browser: A guest cart is identified by its OWN cookie, separate<br/>from any authenticated session (ADR-0025). That separation<br/>is what lets P1's merge-on-login be a Cart concern rather<br/>than an Identity one — see §5.
```

---

## 3. UC-CRT-04 — View the Cart

| | |
|---|---|
| **Use cases** | `UC-CRT-04` |
| **Business rules** | `BR-CRT-02` · `BR-CRT-04` |
| **Quality** | `NFR-PERF-01` |
| **Decisions** | [ADR-0015](../../01-system/ADR/ADR-0015-redis-cache-and-rate-limiting.md) · [ADR-0023](../../01-system/ADR/ADR-0023-server-first-data-fetching.md) |

```mermaid
sequenceDiagram
  autonumber
  actor Customer
  participant Next as Next.js server
  participant Ctl as CartController
  participant CartSvc as ViewCartService
  participant Cart
  participant Catalog as CatalogQueryService
  participant PromoPreview as PromotionPreviewService
  participant Inventory as InventoryQueryService
  participant Redis
  participant PG as PostgreSQL

  Customer->>Next: open the cart
  Note over Next: ADR-0023 — a Server Component fetches server-side, so the<br/>page arrives rendered and the token never enters the browser.
  Next->>Ctl: GET /api/v1/carts/current
  Ctl->>CartSvc: view(cartId, correlationId)

  CartSvc->>Cart: load the lines
  Cart->>PG: SELECT cart_cart_line
  Cart-->>CartSvc: variantId and quantity per line — still UNPRICED

  CartSvc->>Catalog: price every line at the CURRENT price
  Catalog->>Redis: cache-aside lookup for the variant
  alt cache hit
    Redis-->>Catalog: cached price and product data
  else cache miss
    Catalog->>PG: SELECT catalog_variant
    Catalog->>Redis: populate with a TTL
  end
  Catalog-->>CartSvc: Money per line
  Note over Catalog,Redis: ADR-0015 — cache-aside on the read path only. The cache is<br/>never written to as a source of truth, and a stale entry<br/>costs a re-price at checkout rather than a wrong charge.

  CartSvc->>Inventory: re-check advisory availability
  Inventory-->>CartSvc: per-line availability
  CartSvc->>PromoPreview: NON-BINDING discount preview
  PromoPreview-->>CartSvc: indicative discount
  Note over PromoPreview: Domain Model §5.2 — the Cart-facing Open Host Service<br/>returns a PREVIEW that may change by checkout. Only<br/>PromotionRedemptionPort inside the placement transaction<br/>is binding (06-Fulfilment.md §6).

  CartSvc-->>Ctl: lines, current prices, availability flags, indicative total
  Ctl-->>Next: cart resource
  Next-->>Customer: rendered cart, with any change since last view stated
  Note over Customer: E1, E2 — a price or availability change since the customer<br/>last looked is shown EXPLICITLY, so that nothing is<br/>discovered for the first time at the payment step (P11).
```

**Why the cart is re-priced on every view rather than cached with prices.** `BR-CRT-04` makes the cart a list of intentions, not a quote. Pricing at read time means a price change propagates immediately and there is exactly one place a price comes from. The cost is a Catalog call per view, which is why the Redis cache-aside layer exists — and why a stale cache entry is tolerable here in a way it would not be at placement.

---

## 4. UC-CRT-06 — Expire an Inactive Cart

| | |
|---|---|
| **Use cases** | `UC-CRT-06` |
| **Business rules** | `BR-CRT-01` |
| **Decisions** | [ADR-0028](../../01-system/ADR/ADR-0028-deployment-topology-containerisation.md) |
| **Problems** | `P5` |

```mermaid
sequenceDiagram
  autonumber
  actor Scheduler
  participant Sweep as CartExpirySweep
  participant Authz as AuthorizationService
  participant Cart
  participant PG as PostgreSQL

  Note over Scheduler: Only ONE ecp-api replica runs the scheduler profile —<br/>it must fire once, not once per replica (ADR-0028).
  Scheduler->>Sweep: run — the interval and the inactivity window are configuration
  Sweep->>Authz: authorise(SYSTEM, CART_EXPIRE)
  Note over Authz: P5 — the Scheduler passes the SAME authorisation model as a<br/>human caller. A rule that lives only behind a human-initiated<br/>entry point is a rule with a hole in it, and BR-AUD-02 makes<br/>no exception for system actors.
  Authz-->>Sweep: permitted

  Sweep->>PG: SELECT carts inactive beyond the window
  PG-->>Sweep: candidates
  loop each cart, independently
    rect rgba(124,92,255,0.08)
      Note over Sweep,PG: ONE transaction per cart
      Sweep->>Cart: expire
      Cart->>PG: UPDATE cart_cart SET status = EXPIRED
      Sweep-)Cart: CartExpired — in-process
    end
  end
  Note over Sweep,PG: No stock is released, because a cart never HELD any<br/>(§2). Cart expiry and reservation expiry are separate<br/>sweeps with separate windows — 02-Inventory.md §5 is the<br/>one that returns units to availability.
```

---

## 5. Failure — Merging a Guest Cart That Conflicts

| | |
|---|---|
| **Use cases** | `UC-CRT-05` · `UC-CUS-03` E4 |
| **Business rules** | `BR-CRT-02` · `BR-CRT-03` |
| **Problems** | `P1` |

```mermaid
sequenceDiagram
  autonumber
  actor Customer
  participant Login as LoginService
  participant Merge as MergeGuestCartService
  participant GuestCart as Cart (guest)
  participant StoredCart as Cart (customer)
  participant Catalog as CatalogQueryService
  participant Inventory as InventoryQueryService
  participant PG as PostgreSQL

  Login->>Merge: merge(guestCartId, customerId) — AFTER login succeeded
  Merge->>GuestCart: load
  Merge->>StoredCart: load
  Note over StoredCart: A1 — no stored cart, the guest cart becomes the customer's<br/>in full. A2 — an empty guest cart, the stored cart stands<br/>and nothing is reported.

  loop each guest line
    alt the variant is in both carts
      Merge->>StoredCart: COMBINE the quantities (BR-CRT-03)
    else the variant is in one only
      Merge->>StoredCart: carry the line over unchanged
    end
  end

  Merge->>Catalog: is every resulting line still published?
  Merge->>Inventory: advisory availability for every resulting line
  alt a line is no longer published (E1)
    Merge->>StoredCart: do NOT carry it over
    Note over Merge: The customer is told WHICH product was dropped and why.<br/>Silently discarding it is exactly what BR-CRT-03 forbids.
  else a line is entirely out of stock (E2)
    Merge->>StoredCart: carry it over, MARKED UNPURCHASABLE
    Note over Merge: Visible, so the customer can wishlist it — rather than<br/>discovering the loss at checkout.
  else the combined quantity exceeds availability (A4)
    Merge->>StoredCart: carry it at the maximum available quantity
    Note over Merge: The ONE case where the platform adjusts a quantity without<br/>being asked. It is preferable to discarding the line, and<br/>it is never silent (BR-CRT-03).
  end

  alt the merge commits
    rect rgba(124,92,255,0.08)
      Note over Merge,PG: ONE PostgreSQL transaction
      Merge->>PG: UPDATE cart_cart_line for the customer's cart
      Merge->>PG: DELETE or mark the guest cart consumed
    end
    Merge-->>Login: merged, with every changed line identified
  else the merge fails (E3)
    Merge-->>Login: FAILED
    Note over Login: LOGIN STANDS. The stored cart is untouched, the guest cart<br/>is preserved for retry, and the customer is told their<br/>earlier items were not carried over. A cart failure must<br/>never deny a customer access to their account.
  end
  Note over Merge,PG: E4 — two sessions merging at once are applied in SEQUENCE,<br/>each against the cart as it then stands, so neither<br/>session's items are lost. The cart's version column<br/>arbitrates, as everywhere else in this folder.
```

**Why the merge is subordinate to login.** E3 and `UC-CUS-03` E4 agree deliberately: the merge failing never denies access. A customer locked out of their account because of a cart problem is a far worse outcome than a cart they have to rebuild, and the guest cart is preserved so that even that is usually recoverable.

---

## 6. UC-CAT-03 — View Product Details

| | |
|---|---|
| **Use cases** | `UC-CAT-03` · `UC-CAT-04` · `UC-REV-04` |
| **Business rules** | `BR-CAT-01` · `BR-CAT-02` |
| **Quality** | `NFR-PERF-01` · `NFR-AVAIL-02` |
| **Decisions** | [ADR-0015](../../01-system/ADR/ADR-0015-redis-cache-and-rate-limiting.md) · [ADR-0019](../../01-system/ADR/ADR-0019-nextjs-app-router-rendering-strategy.md) · [ADR-0023](../../01-system/ADR/ADR-0023-server-first-data-fetching.md) |

```mermaid
sequenceDiagram
  autonumber
  actor Guest
  participant Browser
  participant Next as Next.js server
  participant Ctl as ProductController
  participant Query as ProductQueryService
  participant Redis
  participant Availability as InventoryQueryService
  participant Rating as RatingSummaryReadModel
  participant PG as PostgreSQL

  Guest->>Browser: open a product page
  Browser->>Next: GET /products/{slug}
  Note over Next: ADR-0019, ADR-0023 — a Server Component fetches on the<br/>server and streams rendered HTML. No client-side waterfall,<br/>and no token in the browser.
  Next->>Ctl: GET /api/v1/products/{productId}
  Ctl->>Query: get(productId)

  Query->>Redis: cache-aside lookup
  alt cache hit
    Redis-->>Query: product, variants, images
  else cache miss
    Query->>PG: SELECT catalog_product, catalog_variant, catalog_product_image
    PG-->>Query: rows
    Query->>Redis: populate with a TTL
  end
  Note over Query: BR-CAT-02 — an unpublished product is not served here at<br/>all. Publication status is part of the query, not a filter<br/>applied afterwards by the client.

  Query->>Availability: per-variant availability (inventory.api)
  Availability-->>Query: in stock, low stock, or out of stock
  Note over Availability: A LIVE advisory read of inventory_stock_item on<br/>ix_inventory_stock_item_sku, through inventory.api — not a<br/>projection (CQRS.md §5.1). The projected copy is only the<br/>search index's inStock flag (§8), which a facet must<br/>evaluate locally. DISPLAY DATA either way: BR-INV-01 is<br/>enforced only by the versioned check at 01-Ordering.md §6.<br/>Showing "in stock" for a unit someone else takes a second<br/>later is expected behaviour, not a defect.

  Query->>Rating: rating summary for this product
  Rating-->>Query: average and count
  Note over Rating: Projected into catalog_product.average_rating and<br/>review_count from Review's ReviewPublished / ReviewModerated<br/>events, guarded by rating_last_event_at so an older event<br/>cannot move the average backwards (CQRS.md §5.1). Catalog<br/>DISPLAYS ratings without owning them — Review is its own<br/>bounded context with its own moderation lifecycle.

  Query-->>Ctl: product detail
  Ctl-->>Next: product resource
  Next-->>Browser: rendered page
  Guest->>Browser: select a variant (UC-CAT-04)
  Note over Browser: Variant selection is client-side over data already<br/>fetched. No round trip, because the variants arrived<br/>with the page.
```

---

## 7. UC-SCH-01 — Search Products

| | |
|---|---|
| **Use cases** | `UC-SCH-01` · `UC-SCH-02` · `UC-SCH-03` |
| **Business rules** | `BR-CAT-02` |
| **Quality** | `NFR-PERF-01` · `NFR-AVAIL-02` |
| **Decisions** | [ADR-0008](../../01-system/ADR/ADR-0008-cqrs-command-query-separation.md) · [ADR-0014](../../01-system/ADR/ADR-0014-elasticsearch-search-read-model.md) |
| **Failure path** | §9 |

```mermaid
sequenceDiagram
  autonumber
  actor Guest
  participant Next as Next.js server
  participant Ctl as SearchController
  participant Search as ProductSearchQueryService
  participant ES as Elasticsearch
  participant Redis

  Guest->>Next: type a keyword
  Next->>Ctl: GET /api/v1/search/suggestions?q=...
  Ctl->>Search: suggest(prefix)
  Search->>ES: completion suggester
  ES-->>Search: suggestions
  Search-->>Next: suggestions (UC-SCH-02)

  Guest->>Next: submit the search
  Next->>Ctl: GET /api/v1/search/products?q=...&facets=...&sort=...
  Ctl->>Search: search(query, filters, sort, cursor)
  Search->>ES: keyword query, facet aggregations, relevance ranking
  ES-->>Search: hits, facet counts, cursor
  Note over Search,ES: ADR-0014 — Elasticsearch is a READ MODEL. No application<br/>service writes to it. Everything in it arrived through<br/>Kafka (§8), which is what makes it fully rebuildable —<br/>and a projection that cannot be rebuilt is a second source<br/>of truth by accident.

  Search-->>Ctl: results, facets, cursor
  Ctl-->>Next: cursor-paginated page
  Note over Ctl: Integration Contract §3.2 — CURSOR paging, not offset.<br/>Offset paging duplicates and skips rows on a list that<br/>changes underneath the reader, which a product list does.
  Next-->>Guest: results

  opt the customer is authenticated
    Search->>Redis: record the keyword for recent-keyword display (UC-SCH-04)
  end
  Note over Search: Prices and availability in these results are DISPLAY DATA<br/>(ADR-0014). The binding price is frozen at placement<br/>(BR-ORD-06) and the binding availability is the versioned<br/>check inside the Partnership.
```

---

## 8. The Search and Availability Projection

How anything gets into Elasticsearch. The read side of [`ADR-0008`](../../01-system/ADR/ADR-0008-cqrs-command-query-separation.md), and a concrete instance of the backbone in [`00-Overview.md`](./00-Overview.md) §3.

| | |
|---|---|
| **Use cases** | `UC-SCH-01` · `UC-CAT-03` · `UC-INV-05` |
| **Quality** | `NFR-AVAIL-02` · `NFR-SCAL-04` |
| **Decisions** | [ADR-0008](../../01-system/ADR/ADR-0008-cqrs-command-query-separation.md) · [ADR-0012](../../01-system/ADR/ADR-0012-transactional-outbox-and-kafka.md) · [ADR-0014](../../01-system/ADR/ADR-0014-elasticsearch-search-read-model.md) |
| **Problems** | `P11` |

```mermaid
sequenceDiagram
  autonumber
  participant CatalogSvc as Catalog application service
  participant InventorySvc as Inventory application service
  participant OrderingSvc as Ordering application service
  participant PG as PostgreSQL
  participant Relay as Outbox relay
  participant Kafka
  participant SearchProj as SearchProjector
  participant AvailProj as AvailabilityProjector
  participant ES as Elasticsearch

  rect rgba(124,92,255,0.08)
    Note over CatalogSvc,PG: ONE transaction — the write model plus its outbox row
    CatalogSvc->>PG: UPDATE catalog_variant — a price changed
    CatalogSvc->>PG: INSERT catalog_outbox — ProductPriceChanged
  end
  rect rgba(124,92,255,0.08)
    Note over InventorySvc,PG: ONE transaction
    InventorySvc->>PG: UPDATE inventory_stock_item
    InventorySvc->>PG: INSERT inventory_outbox — StockAdjusted
  end

  Relay->>PG: poll both outboxes
  Relay--)Kafka: ecp.catalog.product.v1
  Relay--)Kafka: ecp.inventory.stock.v1

  Kafka--)SearchProj: ProductCreated, ProductPublished, ProductPriceChanged,<br/>ProductDiscontinued, VariantAdded, CategoryChanged
  Kafka--)AvailProj: StockReserved, StockReservationCommitted, StockAdjusted
  Kafka--)SearchProj: order-line events, for frequently-bought-together and trending

  SearchProj->>SearchProj: has this eventId been applied? at-least-once means redelivery
  SearchProj->>ES: index or update the document
  AvailProj->>ES: update the availability field on the same document
  Note over SearchProj,AvailProj: Domain Model §3 — this read model is a Conformist consumer<br/>of Catalog's OWN events AND Inventory's stock events AND<br/>Ordering's order-line events. It is not Catalog data alone,<br/>which is why it belongs to Catalog as a projection rather<br/>than being a bounded context of its own.

  Note over CatalogSvc,ES: REBUILD — no coordinated outage required
  SearchProj->>Kafka: replay from the beginning of the retained log
  Kafka--)SearchProj: every event, in partition order
  SearchProj->>ES: rebuild the index into a new alias, then swap
```

**Why no application service writes to Elasticsearch directly.** A dual write — updating PostgreSQL and the index in the same method — has no transaction spanning both, so any failure between them leaves the two permanently disagreeing with no record of which is right. Routing every index update through Kafka means the outbox already guarantees the event will be delivered, and the projector's idempotency guarantees redelivery is harmless. The index becomes derivable rather than authored, which is what makes the rebuild path above possible at all.

**What is deliberately not here.** Personalised recommendation (`FR-SCH-11`) is deferred by SRS §8. When it arrives it is another consumer of the same event stream, added without touching anything in this diagram — `P2` working as designed.

---

## 9. Failure — The Search Index Is Unavailable

| | |
|---|---|
| **Use cases** | `UC-SCH-01` E · `UC-CAT-02` |
| **Quality** | `NFR-AVAIL-02` |
| **Decisions** | [ADR-0014](../../01-system/ADR/ADR-0014-elasticsearch-search-read-model.md) |
| **Problems** | `P11` |

```mermaid
sequenceDiagram
  autonumber
  actor Guest
  participant Next as Next.js server
  participant Ctl as SearchController
  participant Search as ProductSearchQueryService
  participant ES as Elasticsearch
  participant Catalog as CatalogQueryService
  participant PG as PostgreSQL
  participant Cart

  Guest->>Next: search for a keyword
  Next->>Ctl: GET /api/v1/search/products?q=...
  Ctl->>Search: search(query)
  Search->>ES: keyword query
  ES--)Search: unavailable, or times out
  Search-->>Ctl: DEGRADED — search is unavailable
  Ctl-->>Next: 503 ECP-SCH-5030, with a clear degraded state
  Next-->>Guest: "Search is temporarily unavailable. Browse by category instead."
  Note over Next: The customer is given a WORKING alternative, not an error<br/>page. UI Design System §13's empty-state pattern: a concise<br/>explanation plus a clear primary action.

  Note over Guest,Cart: EVERYTHING ELSE CONTINUES UNAFFECTED
  Guest->>Next: browse a category
  Next->>Catalog: GET /api/v1/categories/{id}/products
  Catalog->>PG: SELECT from the WRITE model — PostgreSQL, always authoritative
  PG-->>Catalog: products
  Catalog-->>Guest: category listing renders normally
  Guest->>Cart: add to cart, then check out
  Note over Cart: NFR-AVAIL-02 — a failing non-essential capability leaves<br/>CHECKOUT ALONE. Elasticsearch is on no write path and no<br/>checkout path, so its loss costs discovery, never revenue<br/>already in progress.

  Note over Guest,Cart: RECOVERY
  Note over Search,ES: The index is rebuilt from Kafka (§8) with no coordinated<br/>outage. Events published while Elasticsearch was down are<br/>still in the log, so the projector catches up on its own<br/>rather than needing a reconciliation job.
```

**Why this diagram exists at all.** [`ADR-0014`](../../01-system/ADR/ADR-0014-elasticsearch-search-read-model.md) commits that search "degrades, never blocks" and adds that this is to be **verified by a dependency-failure test, not assumed**. The value of drawing it is that it makes the claim concrete enough to write that test against: browse, cart, and checkout must all complete with Elasticsearch stopped.

**The honest limitation.** Losing search is not free — it is a real and large conversion loss, since a customer who cannot find a product cannot buy it, and `P11` counts every such point. "Degrades, never blocks" means revenue already in flight is protected, not that nothing is lost.

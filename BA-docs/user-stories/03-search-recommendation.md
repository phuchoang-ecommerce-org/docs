# Search & Recommendation — User Stories (`SCH`)

**Related documents:** [`README.md`](./README.md) (index and template) · [`../use-cases/03-search-recommendation.md`](../use-cases/03-search-recommendation.md) (source use cases) · [`../srs.md`](../srs.md)

---

## US-SCH-01 — Search Products by Keyword

**As a** Guest
**I want** to search for products by keyword
**So that** I can find the product I have in mind immediately

**Realises:** `UC-SCH-01` · `FR-SCH-01`
**Priority:** Must

**Acceptance Criteria**
- Given a keyword query, when I submit it, then matching published products are presented ordered by relevance, each with price and availability, and the query is recorded against my recent and the platform's popular keywords.
- Given a query matching exactly one product, when results are shown, then a result set is presented rather than an automatic redirect.
- Given a query resembling a SKU or brand, when results are ranked, then exact SKU or brand matches rank above partial text matches.
- Given no product matches, when I search, then I am told plainly and offered suggestions, popular keywords, and category navigation.
- Given search is unavailable, when I submit a query, then I am told search is temporarily unavailable and offered category browsing, while cart and checkout remain operational.
- Given I am outside my rate limit, when I submit a query, then the request is rejected without evaluation.

---

## US-SCH-02 — Receive Search Suggestions and Auto-complete

**As a** Guest
**I want** completions and suggestions as I type a query
**So that** I can reach my query without typing it in full or misspelling it

**Realises:** `UC-SCH-02` · `FR-SCH-02`
**Priority:** Should

**Acceptance Criteria**
- Given a partial query, when I type it, then ranked completions are presented within the auto-complete latency target.
- Given I am authenticated, when suggestions are computed, then my own recent keywords are blended in, scoped strictly to me.
- Given a partial term shorter than the configured minimum, when I type it, then no suggestions are offered.
- Given no completions match, when suggestions are computed, then nothing is presented and my typed text is left untouched.
- Given the suggestion service is unavailable, when I type a query, then suggestions are omitted silently and I can still type and submit the query.

---

## US-SCH-03 — Filter and Sort Search Results

**As a** Guest
**I want** to filter and sort a result set or category listing
**So that** I can reduce a large set of products to a decidable one

**Realises:** `UC-SCH-03` · `FR-SCH-03`, `FR-SCH-04`
**Priority:** Must

**Acceptance Criteria**
- Given one or more filters — category, brand, price range, attribute, availability — when I apply them in combination, then the result set narrows to match every active filter, with the count and active filters shown.
- Given an active filter, when I remove it, then the set is re-retrieved with the remaining filters.
- Given a chosen ordering — relevance, price, newest, or rating, when I select it, then results are re-ordered and pagination restarts.
- Given a filter combination matching nothing, when applied, then I am told plainly that nothing matches and offered to remove the most restrictive filter, without any filter being silently dropped.
- Given an invalid filter value, when I apply it, then it is rejected and named while the remaining filters still apply.
- Given an inverted price range, when I apply it, then the platform interprets the bounds to make the range non-empty.

---

## US-SCH-04 — View Popular and Recent Keywords

**As a** Guest
**I want** to see popular and, if I'm signed in, my own recent keywords
**So that** I have a starting point before I type a query

**Realises:** `UC-SCH-04` · `FR-SCH-05`, `FR-SCH-06`
**Priority:** Could

**Acceptance Criteria**
- Given I open the search field, when the platform responds, then platform-wide popular keywords are presented.
- Given I am authenticated, when the search field opens, then my own recent keywords are presented alongside, scoped strictly to me.
- Given I am a guest, when the search field opens, then only popular keywords are shown, with no placeholder implying a hidden history.
- Given I clear an individual keyword or my whole history, when I do so, then it is deleted and does not reappear.
- Given popular keywords are unavailable, when the search field opens, then the section is omitted.
- Given my personal history is unavailable, when the search field opens, then popular keywords are still shown and another customer's history is never substituted.

---

## US-SCH-05 — View Related and Frequently Bought Together Products

**As a** Guest
**I want** to see related and complementary products
**So that** I can find alternatives and complements without searching again

**Realises:** `UC-SCH-05` · `FR-SCH-07`, `FR-SCH-08`
**Priority:** Should

**Acceptance Criteria**
- Given a product or cart in context, when I view it, then related and frequently-bought-together products are presented, excluding unpublished products and items already in my cart.
- Given insufficient purchase history for a product, when complements are computed, then related products are presented alone rather than an arbitrary fill.
- Given the cart is the context, when complements are computed, then they are computed across the cart's contents rather than a single product.
- Given recommendations are unavailable, when I view a product, then the product page is presented in full without the section.
- Given every candidate is unpublished or out of stock, when the section is computed, then it is omitted rather than showing unbuyable products.

---

## US-SCH-06 — View Trending Products and New Arrivals

**As a** Guest
**I want** to see trending products and new arrivals
**So that** I have a reason to start browsing

**Realises:** `UC-SCH-06` · `FR-SCH-09`, `FR-SCH-10`
**Priority:** Could

**Acceptance Criteria**
- Given the storefront home, when I open it, then trending and recently listed published products are presented, excluding unpublished and wholly out-of-stock items.
- Given a category is in context, when trending is computed, then it is computed within that category.
- Given a product is in an active flash sale, when it appears among trending items, then it is marked as being on sale.
- Given trending data is unavailable or too stale, when the home page is shown, then the trending section is omitted while new arrivals are still presented.
- Given no products were listed recently enough, when new arrivals are computed, then the section is omitted rather than widened to fill.

---

## US-SCH-07 — Receive Personalised Recommendations

**As a** Customer
**I want** recommendations derived from my own history
**So that** I see relevant products without noise from other customers' behaviour

**Realises:** `UC-SCH-07` · `FR-SCH-11`
**Priority:** Could

**Acceptance Criteria**
- Given an authenticated session, when I open the storefront, then recommendations derived from my own browsing and purchase history are presented, identified as personalised, excluding unpublished, out-of-stock, and implausible repeat-purchase products.
- Given I have insufficient history, when recommendations are computed, then trending products are shown instead and are not labelled personalised.
- Given I have opted out of personalisation, when I open the storefront, then non-personalised discovery is presented and no profile is accumulated.
- Given personalisation is unavailable, when I open the storefront, then the platform falls back to trending or omits the section, never to another customer's recommendations.
- Given my account is suspended or deleted, when recommendations would be computed, then the section is omitted.

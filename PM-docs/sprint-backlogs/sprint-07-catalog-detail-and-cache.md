# Sprint 07 — Catalog: Product Detail & Read Cache

**Release:** R1 · **Gate:** **`G3` — Contract Sync** · **Backend 18 pts · Frontend 20 pts**
**Related documents:** [`../release-plan.md`](../release-plan.md) · [`../integration-plan.md`](../integration-plan.md) · [`../../BA-docs/user-stories/02-catalog-category.md`](../../BA-docs/user-stories/02-catalog-category.md) · [`../../SA-docs/03-frontend/Routing.md`](../../SA-docs/03-frontend/Routing.md)

---

## Sprint Goal

> **The product page is the reference implementation of `NFR-AVAIL-02`.**

[`Routing.md`](../../SA-docs/03-frontend/Routing.md) §4.1 calls the product page's boundary layout **normative rather than incidental**. Four sections fail independently: product/variants/price takes the page down because it *is* the page; availability, reviews and recommendations must not. Every later page that composes advisory sections copies what is built here, so getting the boundaries wrong now is a pattern that propagates, not a bug that stays local.

## Committed Items

| Lane | ID | Item | Pts |
|---|---|---|---:|
| BE | `US-CAT-03` | View Product Details | 5 |
| BE | `EN-DATA-3` | Catalog schema, indexes, and cursor-pagination query design | 8 |
| BE | `EN-OBS-2` | Micrometer meters named in Deployment §8 | 5 |
| | | **Backend total** | **18** |
| FE | `US-CAT-03` | View Product Details | 8 |
| FE | `US-CAT-04` | Select Product Variant | 3 |
| FE | `EN-FE-SHELL-2` | `loading.tsx` / `error.tsx` / `not-found.tsx` placement and `<Suspense>` discipline per Routing §8 | 9 |
| | | **Frontend total** | **20** |

---

## Backend Lane

### `US-CAT-03` View Product Details (5 pts) — `getProduct`, `listProductVariants`, `getProductRatingSummary`
- [ ] `BR-CAT-02` checked at step 2 — an unpublished product is `404`, and the same `404` a never-existing id returns
- [ ] Name, description, images, brand, categories, attributes, price, variants assembled in one read path. **Images arrive with `getProduct`** — there is no `listProductImages` operation ([`Routing.md`](../../SA-docs/03-frontend/Routing.md) §4.1 n.1); `addProductImage`/`removeProductImage` are admin operations and belong to Sprint 09
- [ ] Per-variant availability (`FR-INV-07`) served from the catalog projection, **labelled advisory** — `inventory` does not exist until Sprint 11 and this value is not the binding check
- [ ] `getProductRatingSummary` returns the designed empty summary — `review` does not exist until Sprint 24. The empty shape is the deliverable, the way Sprint 05's `listOrders` empty page was
- [ ] `A2` — a product on promotion returns both the standard and the promotional price plus the period (`FR-PRM-02`); shape only this sprint, since `promotion` arrives in Sprint 15
- [ ] `A3` — every variant out of stock still returns the product in full
- [ ] Exception flows: `E1` unpublished/removed; `E2` reviews unavailable omits the section; `E3` related unavailable omits the rail. **`E2` and `E3` must not propagate into the product response's status code**
- [ ] Contract test both directions on all three operations

### `EN-DATA-3` Catalog schema, indexes, and cursor-pagination query design (8 pts)
- [ ] Flyway migration for the full `catalog` table set under the Sprint 02 prefix convention
- [ ] Indexes for: category descendant lookup, published-product filter, variant resolution by dimension set, and the cursor ordering columns for each sort option `US-CAT-02` exposes
- [ ] **The cursor query design is the deliverable**: a keyset predicate per sort option, each proved stable by an L5 test that inserts a row mid-pagination and asserts no row is skipped or repeated
- [ ] `EXPLAIN` recorded for every listing query in the module's test resources, so a later regression is visible as a plan change rather than as a latency complaint

### `EN-OBS-2` Micrometer meters named in Deployment §8 (5 pts)
- [ ] Every meter named in [`Deployment Diagram.md`](../../SA-docs/01-system/Deployment%20Diagram.md) §8 registered, with the names exactly as written there — a meter with a plausible but different name is an unmonitored meter
- [ ] The Sprint 06 cache hit/miss counters folded into the named set
- [ ] Management port exposure confirmed against `EN-OBS-1` (Sprint 04); no meter leaks onto the public port

---

## Frontend Lane

### `US-CAT-03` View Product Details (8 pts) — `/p/[productId]`, **R1**
- [ ] **Four independent `<Suspense>` boundaries**, per [`Routing.md`](../../SA-docs/03-frontend/Routing.md) §4.1 — product/variants/price · availability · reviews · related. The page awaits only the first
- [ ] Availability renders **labelled as advisory** and never disables add-to-cart — the binding check is at checkout
- [ ] A failed reviews fetch renders a section-level empty state; a failed recommendations fetch removes the rail **silently**, with nothing said to the customer
- [ ] `loading.tsx` skeleton in the shape of the page; each boundary carries its own fallback rather than one page-wide spinner
- [ ] `not-found.tsx` for an unpublished/removed product that offers the containing category (`E1`) and does not explain why
- [ ] Hand-written Zod parsers for the product, variant, and rating-summary payloads
- [ ] Vitest + axe, including a test per boundary that asserts the *other three* still render when it throws

### `US-CAT-04` Select Product Variant (3 pts) — `/p/[productId]`
- [ ] Dimension selectors; partial selection shows the price range and keeps add-to-cart disabled (`A1`)
- [ ] Non-existent and zero-stock combinations marked before selection (`A2`)
- [ ] `E1` — an impossible combination keeps the rest of the selection intact rather than clearing it
- [ ] Selection is URL state, so a variant is linkable and the page stays `R1`
- [ ] Vitest + axe

### `EN-FE-SHELL-2` Boundary placement and `<Suspense>` discipline (9 pts)
- [ ] `loading.tsx` / `error.tsx` / `not-found.tsx` placed per [`Routing.md`](../../SA-docs/03-frontend/Routing.md) §8 across **every** route group delivered so far, not only the new ones
- [ ] The rule written down: a boundary exists per independently-fetched section, and a section that may fail without the page failing **must** have one
- [ ] A lint or test-level check that a new route segment without a `loading.tsx` is caught in review rather than at a gate
- [ ] Vitest + axe on the shared fallback components

---

## Integration Risk

**`getProductRatingSummary` returns an empty summary against the real API and a populated one against the mock, for seventeen sprints.** Like Sprint 05's `listOrders`, that difference is expected and must be recorded as expected at `G3`, not logged as drift. What is checked is the envelope, not the rows.

Second: `NFR-AVAIL-02` is asserted by *removing* a dependency. If `G3` only exercises the happy path, the four-boundary layout is untested and the sprint's stated goal is unverified.

## Gate `G3` — Contract Sync

Checklist: [`../integration-plan.md`](../integration-plan.md) §3.1, scoped to catalog — categories, listings, product detail, and variants.

| # | Check |
|---|---|
| 1 | Types regenerated against `openapi.yaml`, diff empty |
| 2 | Contract test **spec→code** across `listCategories`, `getCategory`, `listCategoryProducts`, `getProduct`, `listProductVariants`, `getProductVariant`, `getProductRatingSummary` |
| 3 | Contract test **code→spec** — no undocumented catalog endpoint exists |
| 4 | `/`, `/c/[...slug]` and `/p/[productId]` render against the real API |
| 5 | Pagination envelope and cursor shape match on `listCategoryProducts` — including across a sort change |
| 6 | Designed screens, not generic boundaries: unpublished product → the `not-found` that offers the category; reviews section failing → section empty state; related rail failing → rail absent, silently |
| 7 | `GUEST` reads every catalog operation; no catalog write endpoint is reachable at all (they do not exist until Sprint 09) |
| 8 | **`Money` arrives as `{"amount": "129.99", "currency": "VND"}` with `amount` a string** — this is the first increment carrying `Money`, and the frontend performs no arithmetic on it |
| 9 | One correlation id visible across browser → API log |
| 10 | Drift logged **and** `openapi.yaml` amended in the same session |
| — | **Recorded as expected, not drift:** empty rating summary and empty related rail against the real API |

## Definition of Done

Every item satisfies its lane's list in [`../definition-of-done.md`](../definition-of-done.md) §3 or §4, and every story reaches §5.

## Review Notes

<!-- filled at Sprint Review -->

## Retrospective

**Went well:**
**Change one thing:**
**Action (owned, carried to next sprint's board):**

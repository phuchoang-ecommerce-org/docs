# Sprint 30 — Release 3: Discovery `Should` and `Could` Stories

**Release:** R3 · **Gate:** none · **Backend 18 pts · Frontend 17 pts**
**Related documents:** [`../release-plan.md`](../release-plan.md) · [`../integration-plan.md`](../integration-plan.md) · [`../../BA-docs/user-stories/03-search-recommendation.md`](../../BA-docs/user-stories/03-search-recommendation.md) · [`../../BA-docs/use-cases/03-search-recommendation.md`](../../BA-docs/use-cases/03-search-recommendation.md)

---

## Sprint Goal

> **Discovery gets its `Should` and `Could` capability.**

**Release 3 begins here, past the `Must` cut line.** Everything in this sprint is capability the release could have shipped without — which changes how its failures are treated rather than how carefully it is built.

One rule covers almost every story: **a discovery feature that fails must fail invisibly.** `UC-SCH-05` `E1` — recommendations unavailable omits the section and presents the product page in full. `UC-SCH-06` `E1` — trending unavailable omits trending and still shows new arrivals, which derive from the catalog rather than from behaviour. `UC-CAT-05` `E1` — featured categories unavailable omits the section. [`Routing.md`](../../SA-docs/03-frontend/Routing.md) §4.1 puts it most directly: **a recommendation outage is not an event a customer should be told about.**

The counterweight is `BR-SCH-01`. `UC-SCH-04` `E2` is unambiguous: when personal history is unavailable the platform **never falls back to another customer's** — *an empty personal section is correct, a wrong one is a breach* (`P16`).

## Committed Items

| Lane | ID | Item | Pts |
|---|---|---|---:|
| BE | `US-CAT-05` | View Featured Categories | 2 |
| BE | `US-SCH-02` | Search Suggestions and Auto-complete | 5 |
| BE | `US-SCH-04` | View Popular and Recent Keywords | 3 |
| BE | `US-SCH-05` | View Related and Frequently-Bought-Together | 5 |
| BE | `US-SCH-06` | View Trending Products and New Arrivals | 3 |
| | | **Backend total** | **18** |
| FE | `US-CAT-05` | View Featured Categories | 3 |
| FE | `US-SCH-02` | Search Suggestions and Auto-complete | 5 |
| FE | `US-SCH-04` | View Popular and Recent Keywords | 3 |
| FE | `US-SCH-05` | View Related and Frequently-Bought-Together | 3 |
| FE | `US-SCH-06` | View Trending Products and New Arrivals | 3 |
| FE | — | *Lane reserve — see [`../release-plan.md`](../release-plan.md) §6* | *1* |
| | | **Frontend total** | **17** |

**Both lanes carry the same five stories in the same sprint** — the first time in the plan. There is no mock lead to exploit here, so agree the response shapes early rather than discovering the mismatch at `G15`.

---

## Backend Lane

### `US-SCH-02` Search Suggestions and Auto-complete (5 pts) — `getSearchSuggestions`
- [ ] Served from the Sprint 10 Elasticsearch read model; **`NFR-PERF-04`'s 150 ms budget is the tightest in the SRS** and regressions show here first (Testing Strategy §7.3 S4)
- [ ] `E1` — no completions returns nothing and **never substitutes a different query for the one being typed**
- [ ] `E2` — an unavailable suggestion service omits suggestions **silently**; the visitor can still type and submit. A failed convenience must not obstruct the underlying goal
- [ ] **`E3` — a response exceeding the latency target is abandoned rather than returned late.** A completion arriving after the visitor has typed past it is a distraction
- [ ] `BR-CAT-02` — unpublished products never appear in suggestions

### `US-SCH-05` View Related and Frequently-Bought-Together (5 pts) — `listRelatedProducts`, `listFrequentlyBoughtTogetherForProduct`, `listFrequentlyBoughtTogetherForCart`
- [ ] Derived from order history through the event backbone, never by querying `ordering` synchronously
- [ ] **`E1` — unavailable omits the section and the product page is presented in full** (`NFR-AVAIL-02`). Sprint 07 built that boundary; this fills it
- [ ] **`E2` — where every candidate is unpublished or out of stock, the section is omitted** rather than presenting products that cannot be bought
- [ ] `BR-CAT-02` throughout

### `US-SCH-04` View Popular and Recent Keywords (3 pts) — `listPopularKeywords`, `listOwnRecentKeywords`, `removeOwnRecentKeyword`, `clearOwnRecentKeywords`
- [ ] `E1` — unavailable popular keywords omits the section (`NFR-AVAIL-02`)
- [ ] **`E2` — where personal history is unavailable, popular keywords are still returned and the platform never falls back to another customer's history.** An empty personal section is correct; a wrong one is a breach (`BR-SCH-01`, `P16`)
- [ ] The personal operations are ownership-scoped absolutely; another customer's history returns the same response as one that does not exist
- [ ] `clearOwnRecentKeywords` and `removeOwnRecentKeyword` are idempotent, the same shape as Sprint 05's `removeOwnAddress`

### `US-SCH-06` View Trending Products and New Arrivals (3 pts) — `listTrendingProducts`, `listNewArrivals`
- [ ] **`E1` — trending data unavailable or too stale to be meaningful omits trending; new arrivals are still presented**, since they derive from the catalog rather than from behaviour
- [ ] **`E2` — where nothing was listed recently enough, the new-arrivals section is omitted rather than widened until it fills**, which would misrepresent old stock as new
- [ ] Both are `R1`-cacheable reads; they join the Sprint 06 cache-aside key namespaces rather than inventing new ones

### `US-CAT-05` View Featured Categories (2 pts) — `listFeaturedCategories`
- [ ] Featured categories in their configured order, with images
- [ ] `A1` — none designated **omits the section rather than returning an empty one**
- [ ] `E1` — unavailable omits the section and the rest of the home page is served; `E2` — **one removed category is omitted from the set and does not suppress the others**
- [ ] `BR-CAT-02`, `BR-CAT-03`

---

## Frontend Lane

> `/` is **R1**; `/search` is **R2**. Suggestions are the one client-fetched read on these pages — case 1 of [`Data Fetching.md`](../../SA-docs/03-frontend/Data%20Fetching.md) §5.

### `US-SCH-02` Search Suggestions and Auto-complete (5 pts) — `/search` typeahead
- [ ] **Client-fetched and debounced against `NFR-PERF-04`'s 150 ms budget** — the one place on these pages where client fetching is the correct pattern
- [ ] `E1` — no completions shows nothing and **leaves the typed text untouched**
- [ ] **`E2` — a failed suggestion fetch is silent.** The input keeps working and nothing is said
- [ ] `E3` — a late response is **discarded, not rendered**; out-of-order responses never overwrite a newer query's results
- [ ] Keyboard navigation and screen-reader announcement of the suggestion list — this is a combobox, and `EN-FE-E2E-2`'s sweep sets the standard it must meet
- [ ] Vitest + axe

### `US-SCH-04` View Popular and Recent Keywords (3 pts) — `/search`
- [ ] Popular keywords and personal recent keywords as **two separate sections that fail independently**
- [ ] **`E2` — an empty personal section renders as empty.** The UI must never fill it from the popular list, which would present another population's data as this customer's history
- [ ] Removal and clear are optimistic and revert visibly on failure, the Sprint 13 cart pattern
- [ ] For a `GUEST` the personal section is absent, not empty-with-a-prompt
- [ ] Vitest + axe

### `US-SCH-05` View Related and Frequently-Bought-Together (3 pts) — `/p/[productId]`, `/cart`
- [ ] Renders into the **related rail boundary Sprint 07 built** — do not add a second boundary beside it
- [ ] **`E1`/`E2` — the rail disappears silently.** No error, no empty state, no explanation ([`Routing.md`](../../SA-docs/03-frontend/Routing.md) §4.1)
- [ ] The `/cart` rail is its own boundary and a failure there never affects the cart lines
- [ ] Vitest + axe, including a test asserting a failing rail leaves the rest of each page intact

### `US-SCH-06` View Trending Products and New Arrivals (3 pts) — `/`, **R1**
- [ ] Two rails, each in its own `<Suspense>` boundary, both inside the `R1` static shell
- [ ] `E1` — a failed trending rail disappears and **new arrivals still render**
- [ ] Confirm the home page stays genuinely static for a `GUEST` — IH-1 row 7 and `EN-FE-PERF-2`'s budget gate both depend on it, and two new rails are exactly how a static route quietly becomes dynamic
- [ ] Vitest + axe

### `US-CAT-05` View Featured Categories (3 pts) — `/`, **R1**
- [ ] The featured rail; a category with no image renders on its name alone
- [ ] `A1`/`E1` — nothing designated, or the section unavailable, **omits it rather than rendering an empty one**
- [ ] `E2` — one removed category is absent and the others still render
- [ ] Vitest + axe

---

## Integration Risk

**No gate closes this sprint, and for the first time both lanes build the same five stories simultaneously.** Every earlier sprint gave the frontend a contract the backend had already implemented, or a mock the backend would later match. Here both sides implement against `openapi.yaml` at the same time, with nothing between them until `G15` two sprints away.

Agree the five response shapes explicitly at Planning — especially `getSearchSuggestions`, where the 150 ms budget may tempt a leaner payload than the contract documents.

Second, and specific to this sprint's nature: **silent failure is very hard to distinguish from a feature that was never wired.** A rail that disappears because the backend errored and a rail that disappears because the frontend forgot to call it look identical to everyone. Log the omission server-side and assert the call client-side, or the sprint can pass its own review while doing nothing.

## Definition of Done

Every item satisfies its lane's list in [`../definition-of-done.md`](../definition-of-done.md) §3 or §4, and every story reaches §5.

Additionally: **confirm the home page is still statically generated** after five new sections landed on it. That property has held since Sprint 06 and this is the sprint most likely to break it.

## Review Notes

<!-- filled at Sprint Review -->

## Retrospective

**Went well:**
**Change one thing:**
**Action (owned, carried to next sprint's board):**

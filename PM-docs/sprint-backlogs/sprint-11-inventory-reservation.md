# Sprint 11 — Inventory: The Reservation Model

**Release:** R1 · **Gate:** **`G5` — Contract Sync** · **Backend 18 pts · Frontend 9 pts**
**Related documents:** [`../release-plan.md`](../release-plan.md) · [`../integration-plan.md`](../integration-plan.md) · [`../../BA-docs/user-stories/04-inventory.md`](../../BA-docs/user-stories/04-inventory.md) · [`../../SA-docs/01-system/ADR/ADR-0011-optimistic-locking-reservation-model.md`](../../SA-docs/01-system/ADR/ADR-0011-optimistic-locking-reservation-model.md)

---

## Sprint Goal

> **The oversell guarantee is proved, not asserted.**

`NFR-REL-03` is verifiable in exactly one way: N threads race one SKU against real PostgreSQL, and the total reserved never exceeds the stock held. Not H2, not a mock, not a single-threaded test with a comment explaining why it is sufficient. The deliverable of this sprint is that race, and the three operations are what it races.

Note the lane asymmetry — 18 backend points against 9 frontend. `US-INV-01` and `US-INV-02` have **no contract surface at all**; they are internal ports that `ordering` will call in Sprint 18. The frontend's small commitment here is the plan working as intended, and the reserve is real reserve.

## Committed Items

| Lane | ID | Item | Pts |
|---|---|---|---:|
| BE | `US-INV-01` | Reserve Stock for an Order | 8 |
| BE | `US-INV-02` | Release Reserved Stock | 5 |
| BE | `US-INV-03` | Commit Reserved Stock on Fulfilment | 5 |
| | | **Backend total** | **18** |
| FE | `US-INV-03` | Commit Reserved Stock on Fulfilment | 2 |
| FE | `EN-FE-DS-5` | Availability display — advisory and labelled — across catalog, cart and checkout | 7 |
| FE | — | *Lane reserve — see [`../release-plan.md`](../release-plan.md) §6* | *9* |
| | | **Frontend total** | **9** |

---

## Backend Lane

### `US-INV-01` Reserve Stock for an Order (8 pts) — `StockReservationPort` (internal, no contract surface)
- [ ] `StockItem` aggregate with optimistic locking per [`ADR-0011`](../../SA-docs/01-system/ADR/ADR-0011-optimistic-locking-reservation-model.md); Flyway migration under the Sprint 02 prefix convention
- [ ] **`E1` — a multi-line reservation is all-or-nothing.** No line is reserved if any line is short, and the response names **which** lines are short and **how many** are available for each (`BR-ORD-02`)
- [ ] `E3` — a failure part-way through releases everything already taken in the attempt. This is the partial-completion case `P7` describes and `BR-ORD-02` exists for
- [ ] `E4` — a duplicate reservation request for the same order returns the **existing** reservation and takes no second one (`BR-ORD-03`, `BR-INV-02`)
- [ ] `E5` — a variant unpublished between checkout and placement refuses that line (`BR-CAT-02`)
- [ ] `ECP-INV-4091` is the contract's code for the shortfall — **it is the designed outcome of losing a race, not an error**
- [ ] The port is internal: ArchUnit asserts no web controller reaches it, and code→spec contract testing confirms it exposes no endpoint

### `US-INV-02` Release Reserved Stock (5 pts) — `StockReservationPort` (internal)
- [ ] `E1` — releasing an already-released reservation is a **no-op reporting success**. Releasing twice inflates available stock, which is overselling with the sign flipped (`BR-INV-02`)
- [ ] `E2` — releasing a **committed** reservation is declined and the conflict recorded for investigation; the goods have physically left
- [ ] `E3` — a failed release leaves the reservation **held** and retries (`NFR-REL-04`); repeated failure raises an operational alert, because held-but-unreleasable stock is invisible loss (`P7`)
- [ ] `E4` — a reservation with no order releases and is recorded as orphaned

### `US-INV-03` Commit Reserved Stock on Fulfilment (5 pts) — `commitStockReservation`
- [ ] `E1` — committing twice deducts once (`BR-INV-02`, `NFR-REL-04`); a retried pack operation is normal
- [ ] `E2` — committing a released reservation is declined and raised for the Warehouse Operator, not silently applied
- [ ] `E3` — a physical shortfall at picking is recorded as an adjustment (`UC-INV-04`, Sprint 12) and the order does not fulfil as placed. **`ordering` does not exist until Sprint 18** — implement the decline and the reservation outcome; the order-side consequences are carried forward with a named sprint, not marked done
- [ ] `E4` — a failed commitment leaves the reservation held and does **not** advance the order (`BR-ORD-01`). Order state and stock state move together or not at all
- [ ] Permission-matrix cell asserted on `commitStockReservation`

### The race — the sprint's actual deliverable
- [ ] An L5 concurrency test on **real PostgreSQL via Testcontainers**, schema-per-test-class: N threads reserve one SKU with M units available; exactly M succeed, the rest fail as `E1`, and **the total reserved never exceeds M** (`BR-INV-01`, `NFR-REL-03`, `NFR-SCAL-06`)
- [ ] The same race across a multi-line reservation, asserting `E3`'s cleanup under contention
- [ ] The same race with duplicate requests interleaved, asserting `E4` holds under concurrency
- [ ] Run it at a thread count high enough to have failed before the locking was right — a race test that has never gone red proves nothing

---

## Frontend Lane

### `US-INV-03` Commit Reserved Stock on Fulfilment (2 pts) — `/admin/inventory/[stockItemId]`, **R4**
- [ ] The commit action on the stock-item detail, per [`Routing.md`](../../SA-docs/03-frontend/Routing.md) §7.3
- [ ] `E1` — a repeated commit reports success, and the UI does not present it as a failure just because nothing changed
- [ ] `E2` — a declined commit on a released reservation renders as the designed operator-action screen, saying what must be resolved physically
- [ ] Vitest + axe

### `EN-FE-DS-5` Availability display — advisory and labelled (7 pts)
- [ ] **One availability component**, used on `/p/[productId]`, `/c/[...slug]` cards, `/cart` lines and the checkout summary. Four implementations is four places for the labelling to drift
- [ ] It is **advisory and labelled as such** ([`Data Fetching.md`](../../SA-docs/03-frontend/Data%20Fetching.md) §4.2) — it **never blocks add-to-cart**, because the binding check is at placement
- [ ] Three distinct states rendered distinctly: available · short (with the quantity) · unknown. "Unknown" is a designed state, not a fallback to "available"
- [ ] **`ECP-INV-4091` renders as "sold out", never as "try again".** [`Routing.md`](../../SA-docs/03-frontend/Routing.md) §4.3 makes this normative, and the two must be visibly different outcomes to a customer
- [ ] The Sprint 07 product page's advisory availability boundary is refactored onto this component rather than left as a second implementation
- [ ] Vitest + axe across all three states, plus a contrast assertion on the short/unknown treatments

---

## Integration Risk

**Two of the three backend stories have no contract surface, so `G5` cannot check them.** The oversell guarantee — the sprint's stated goal — is verified by the L5 race and nowhere else. If that test is weak, nothing downstream catches it until a flash sale in production, which is exactly `P8`.

Second: `ECP-INV-4091` now has two designed screens — "sold out" on the storefront and the adjustment-declined screen in `(admin)`. One error code, two correct renderings, one shared error map. That is the thing check 6 at `G5` is actually for.

## Gate `G5` — Contract Sync

Checklist: [`../integration-plan.md`](../integration-plan.md) §3.1, scoped to inventory and the search increment of Sprint 10.

| # | Check |
|---|---|
| 1 | Types regenerated, diff empty |
| 2 | Contract test **spec→code** across `searchProducts` and `commitStockReservation` |
| 3 | Contract test **code→spec** — **`StockReservationPort` exposes no endpoint**; if one appeared, the port leaked into the web layer |
| 4 | `/search` and `/admin/inventory/[stockItemId]` render against the real API |
| 5 | Pagination envelope and cursor shape match on `searchProducts`, including across a facet or sort change |
| 6 | **`ECP-INV-4091` renders as "sold out" on the storefront and as the adjustment-declined screen in `(admin)` — two designed screens, one code, neither a generic error boundary.** Search unavailable renders the degraded screen and returns `ECP-GEN-5030`, not `ECP-SCH-5030` |
| 7 | Permission matrix: `commitStockReservation` refused server-side for every role the matrix does not grant |
| 8 | `Money` unaffected in this increment — confirm no availability display assumed a numeric price |
| 9 | One correlation id across browser → API → projection on a search request |
| 10 | Drift logged **and** `openapi.yaml` amended in the same session |
| — | **Recorded as expected, not drift:** search index lag against the real stack, absent against the mock (`P4`) |

## Definition of Done

Every item satisfies its lane's list in [`../definition-of-done.md`](../definition-of-done.md) §3 or §4, and every story reaches §5.

## Review Notes

<!-- filled at Sprint Review -->

## Retrospective

**Went well:**
**Change one thing:**
**Action (owned, carried to next sprint's board):**

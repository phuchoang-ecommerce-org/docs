# Sprint 09 — Catalog Administration

**Release:** R1 · **Gate:** **`G4` — Contract Sync** · **Backend 21 pts · Frontend 15 pts**
**Related documents:** [`../release-plan.md`](../release-plan.md) · [`../integration-plan.md`](../integration-plan.md) · [`../../BA-docs/user-stories/12-administration.md`](../../BA-docs/user-stories/12-administration.md) · [`../../SA-docs/01-system/ADR/ADR-0038-event-driven-catalog-revalidation.md`](../../SA-docs/01-system/ADR/ADR-0038-event-driven-catalog-revalidation.md)

---

## Sprint Goal

> **An operator can manage the catalog, and the storefront notices.**

The second half of that sentence is the sprint. Catalog writes without revalidation is a feature; catalog writes *whose effect reaches the storefront through the event backbone* is the architecture [`ADR-0038`](../../SA-docs/01-system/ADR/ADR-0038-event-driven-catalog-revalidation.md) chose — **one invalidation path, not two**. The tempting shortcut, revalidating directly from the admin write, is precisely what this sprint must not do.

This is also the last sprint before IH-1.

## Committed Items

| Lane | ID | Item | Pts |
|---|---|---|---:|
| BE | `US-ADM-01` | Manage Products | 8 |
| BE | `US-ADM-02` | Manage Categories | 5 |
| BE | `EN-EVENT-2` | Catalog events published; consumer idempotency and ordering guards | 8 |
| | | **Backend total** | **21** |
| FE | `US-ADM-05` | Manage Inventory Adjustments | 3 |
| FE | `EN-FE-API-3` | `/api/internal/revalidate` signed callback; event-driven ISR invalidation | 8 |
| FE | `EN-FE-DS-4` | Admin console shell: dense navigation, filtered-list→detail→action pattern | 4 |
| FE | — | *Lane reserve — see [`../release-plan.md`](../release-plan.md) §6* | *3* |
| | | **Frontend total** | **15** |

---

## Backend Lane

### `US-ADM-01` Manage Products (8 pts) — `createProduct`, `updateProduct`, `deleteProduct`, `setProductPublication`, `addProductVariant`, `removeProductVariant`, `changeVariantPrice`, `addProductImage`, `removeProductImage`, `amendProductsInBulk`
- [ ] `BR-CAT-01` — SKU uniqueness enforced at the database, not only in the service; `E1` returns the conflict **named**
- [ ] `E2` — actor lacking authority is refused by the server via the `identity` `AuthorizationService`, and the attempt recorded. Repricing is `P16`'s worked example
- [ ] `E3` — removal of a product with stock or open orders is declined and unpublishing offered instead. **Neither `inventory` nor `ordering` exists yet**: implement the check against the ports they will provide, return the declined outcome for the cases that are decidable today, and record the gap here rather than marking it done
- [ ] `E4` — validation failure applies nothing; the whole submission is one transaction
- [ ] `E5` — **audit entry cannot be written → the change is not applied** (`BR-AUD-01`, `UC-AUD-01` E1). Audit is still the Sprint 03/04 stub listener; wire the *refusal path* now so `US-AUD-01` in Sprint 12 replaces a stub rather than adding a behaviour
- [ ] `E6` — search propagation failure lets the change **stand**; retried, not rolled back (`P4`)
- [ ] `amendProductsInBulk` is atomic per the contract's documented semantics; a partial bulk result is `P7`
- [ ] Permission-matrix cell asserted per operation

### `US-ADM-02` Manage Categories (5 pts) — `createCategory`, `updateCategory`, `deleteCategory`
- [ ] `BR-CAT-03` — `E1` cycle detection on reparent, enforced server-side; the Sprint 06 read-side invariant and this write-side check share one implementation
- [ ] `E2` — removal while holding products or children is declined **with the counts**, so the operator knows what to reassign
- [ ] `E3` authority; `E4` audit-write failure declines the change
- [ ] Cache invalidation fires on the Sprint 06 `EN-WIRE-3` key namespaces

### `EN-EVENT-2` Catalog events published; consumer idempotency and ordering guards (8 pts)
- [ ] Every catalog write publishes through the Sprint 08 outbox — **never directly to Kafka**, and ArchUnit asserts no module holds a producer
- [ ] Event types and payloads registered in the Sprint 08 topic catalogue
- [ ] **Consumer idempotency**: the same event delivered twice produces one effect. Proved by replaying the same envelope, not by inspecting code
- [ ] **Ordering guards**: two events for one aggregate apply in order; an out-of-order arrival is detected and handled rather than silently applied. This is what the Sprint 08 partition key buys, and it is verified here
- [ ] Correlation id survives write → outbox → Kafka → consumer (`NFR-OBS-03`), which IH-1 row 8 then extends to the projection

---

## Frontend Lane

### `EN-FE-API-3` `/api/internal/revalidate` signed callback (8 pts)
- [ ] The route handler verifies a **signature**, not an IP or a shared header — an unauthenticated revalidation endpoint is a cache-poisoning surface
- [ ] Maps event → `revalidateTag`, using the tag scheme agreed in Sprint 06 with `EN-FE-PERF-1`. If the strings drifted, reconcile them here and record which side changed
- [ ] Replay-safe: the same callback twice revalidates twice and harms nothing; an unknown event type is a no-op with a log line, not a `500`
- [ ] Rejected callbacks are observable — a silently-dropped revalidation looks exactly like a working one
- [ ] Tests: valid signature revalidates, tampered body is refused, unknown tag is a no-op

### `US-ADM-05` Manage Inventory Adjustments (3 pts) — `/admin/inventory`, **R4**
- [ ] Reads `listStockAdjustments` against the mock; `inventory` does not exist until Sprint 11–12
- [ ] `E1` — an adjustment that would take available stock negative renders as the **designed `ECP-INV-4091` screen**, stating the reserved quantity and the orders holding it. Same code the storefront renders as "sold out" ([`Error Codes.md`](../../SA-docs/04-shared/Error%20Codes.md)) — two designed screens, one code
- [ ] `E2` — reason is required by the form, and the server is still the authority
- [ ] Vitest + axe

### `EN-FE-DS-4` Admin console shell (4 pts)
- [ ] Dense navigation and the filtered-list → detail → action pattern, factored out of Sprint 08's products and categories screens rather than invented beside them
- [ ] **The `(admin)` shell renders for a `CUSTOMER`** — empty sections, `403`s behind every read. This is correct behaviour and IH-1 row 5 asserts it; a middleware redirect added here is threat `T9` of [`Security.md`](../../SA-docs/01-system/Security.md) §13
- [ ] `noindex` on the group; absent from the sitemap
- [ ] Vitest + axe

---

## Integration Risk

**`EN-EVENT-2` → `EN-FE-API-3` is the only cross-lane runtime path in the plan so far**, and it has no contract test — the callback is not in `openapi.yaml`, because it is not an `ecp-api` operation. It will not be caught by checks 2 or 3 at `G4`; it has to be exercised by hand, end to end, at the gate.

Second: ten catalog write operations move from mock to real in one gate. This is the largest single increment of contract surface since Sprint 03.

## Gate `G4` — Contract Sync

Checklist: [`../integration-plan.md`](../integration-plan.md) §3.1, scoped to catalog administration and the revalidation path.

| # | Check |
|---|---|
| 1 | Types regenerated, diff empty |
| 2 | Contract test **spec→code** across all thirteen `ADM` catalog operations |
| 3 | Contract test **code→spec** — no undocumented admin endpoint |
| 4 | `/admin/products`, `/admin/products/[productId]`, `/admin/categories`, `/admin/categories/[categoryId]`, `/admin/inventory` render against the real API |
| 5 | Pagination envelope and cursor shape match on `listProducts` and `listCategoryProducts` |
| 6 | Designed screens: duplicate SKU (`E1`), removal-while-occupied (`E2`/`E3`) with server-supplied counts, `ECP-INV-4091` on `adjustStock` as the designed screen rather than an error boundary |
| 7 | **Permission matrix, server-side**: `STAFF` and `ADMINISTRATOR` per the matrix; a `CUSTOMER` reaching `/admin` gets the shell and `403`s — **not** a redirect |
| 8 | `Money` still a string on `changeVariantPrice` round-trips; no client-side arithmetic |
| 9 | **Hand-exercised, since no contract test covers it:** catalog write → outbox → Kafka → `/api/internal/revalidate` → storefront reflects the change within seconds; one correlation id visible across the whole chain |
| 10 | Drift logged **and** `openapi.yaml` amended in the same session |

## Definition of Done

Every item satisfies its lane's list in [`../definition-of-done.md`](../definition-of-done.md) §3 or §4, and every story reaches §5.

**IH-1 begins next.** Confirm at Review which `E3`-style checks were left unimplementable by the absence of `inventory`/`ordering`, so they enter IH-1 as known gaps rather than as surprises.

## Review Notes

<!-- filled at Sprint Review -->

## Retrospective

**Went well:**
**Change one thing:**
**Action (owned, carried to next sprint's board):**

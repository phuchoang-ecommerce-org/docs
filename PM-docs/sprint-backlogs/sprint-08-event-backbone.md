# Sprint 08 — Event Backbone: Outbox & Kafka

**Release:** R1 · **Gate:** none · **Backend 21 pts · Frontend 13 pts**
**Related documents:** [`../release-plan.md`](../release-plan.md) · [`../integration-plan.md`](../integration-plan.md) · [`../../BA-docs/user-stories/12-administration.md`](../../BA-docs/user-stories/12-administration.md) · [`../../SA-docs/02-backend/Module%20Dependency%20Diagram.md`](../../SA-docs/02-backend/Module%20Dependency%20Diagram.md)

---

## Sprint Goal

> **No accepted business event can be silently lost.**

`EN-EVENT-1` is the single largest enabler in the plan and the one everything downstream assumes: search projection (S10), catalog revalidation (S09), order lifecycle (S18), notification (S23), and the reporting read models (S26–S27) all take it as given. It is committed as one 21-point item rather than split, because an outbox that is half-built is an outbox that loses events — and the point of the sprint is the guarantee, not the table.

The frontend lane spends the sprint **a full sprint ahead of the backend**, building the admin catalog console against the Prism mock. That is the contract-first dividend working as designed, not slack.

## Committed Items

| Lane | ID | Item | Pts |
|---|---|---|---:|
| BE | `EN-EVENT-1` | Transactional outbox table + polling relay + event envelope + topic catalogue | 21 |
| | | **Backend total** | **21** |
| FE | `US-ADM-01` | Manage Products | 8 |
| FE | `US-ADM-02` | Manage Categories | 5 |
| FE | — | *Lane reserve — see [`../release-plan.md`](../release-plan.md) §6* | *5* |
| | | **Frontend total** | **13** |

---

## Backend Lane

### `EN-EVENT-1` Transactional outbox + relay + envelope + topic catalogue (21 pts)

**The outbox table and the write in the same transaction**
- [ ] Flyway migration for the outbox table under the Sprint 02 prefix convention
- [ ] The domain write and the outbox insert commit **in one transaction**. An L5 test kills the connection between them and asserts neither survives — this is the whole guarantee, and it is the one test that must exist
- [ ] No module writes to the outbox through another module's repository; the write goes through `shared-kernel`'s port, and ArchUnit asserts it

**The polling relay**
- [ ] Poll → publish → mark-dispatched, with the mark committed only after the broker acknowledges
- [ ] **At-least-once, explicitly.** A crash between publish and mark republishes; that is correct and consumers must tolerate it (which `EN-EVENT-2` in Sprint 09 makes them do)
- [ ] Claim/lease so two application instances do not relay the same row — proved with two relays racing one table
- [ ] Backlog depth and relay lag exposed as Micrometer meters, joining the `EN-OBS-2` set

**The envelope**
- [ ] One envelope schema for every event: event id, type, version, aggregate id, occurred-at, **correlation id** carried from the originating request (`NFR-OBS-03`)
- [ ] The envelope is versioned from the first event, not from the first breaking change

**The topic catalogue**
- [ ] Topic names, partitioning key, and retention documented per topic in one place that later sprints extend rather than invent alongside
- [ ] Partition key chosen so per-aggregate ordering holds — the property Sprint 09's ordering guards and Sprint 18's `EN-EVENT-5` both rely on
- [ ] Kafka topics created via `compose.yaml` (stood up by `EN-DATA-1` in Sprint 01), not auto-created at first publish

**Demonstration, not assertion**
- [ ] The deliverable is a demonstration, in the shape `EN-GATE-1` set in Sprint 01: stop the broker, take catalog writes, restart the broker, show every event arrives. A passing suite with the broker up proves nothing about loss

---

## Frontend Lane

> Built entirely against the Prism mock. `createProduct` and friends do not exist in `ecp-api` until Sprint 09; they exist in `openapi.yaml` today, which is the point.

### `US-ADM-01` Manage Products (8 pts) — `/admin/products`, `/admin/products/new`, `/admin/products/[productId]`, **R4**
- [ ] The `(admin)` list → detail → action shape per [`Routing.md`](../../SA-docs/03-frontend/Routing.md) §7.2, on the group's `SameSite=Strict` posture
- [ ] Reads `listProducts`, `getProduct`, `listProductVariants`; writes `createProduct`, `updateProduct`, `deleteProduct`, `setProductPublication`, `addProductVariant`, `removeProductVariant`, `changeVariantPrice`, `addProductImage`, `removeProductImage`, `amendProductsInBulk`
- [ ] `E1` duplicate SKU and `E3` removal of a product with stock or open orders render as **named, designed outcomes** — `E3` offers unpublishing, which is the actual commercial intent
- [ ] `E4` — a failed validation applies nothing; the form is whole-or-nothing, and the UI must not leave half a submission applied
- [ ] **The save confirmation says the storefront updates within seconds, not on save** ([`ADR-0038`](../../SA-docs/01-system/ADR/ADR-0038-event-driven-catalog-revalidation.md)). Wording it as immediate is the mistake this sprint can still cheaply avoid
- [ ] Hand-written Zod parsers for every admin catalog payload; `loading.tsx` per segment; `<Suspense>` per independently-fetched section
- [ ] Vitest + axe, including the dense-table keyboard path

### `US-ADM-02` Manage Categories (5 pts) — `/admin/categories`, `/admin/categories/[categoryId]`, **R4**
- [ ] Reads `listCategories`, `getCategory`, `listCategoryProducts`; writes `createCategory`, `updateCategory`, `deleteCategory`
- [ ] `E1` cycle and `E2` removal-while-occupied render with **the counts the server returns** — the client never computes them and never pre-empts the check
- [ ] Parent reassignment UI makes the cycle constraint visible before submission, while still letting the server be the authority
- [ ] Vitest + axe

---

## Integration Risk

**Nothing this sprint meets at a gate — and that is the risk.** The backend ships an enabler with no contract surface, and the frontend ships two stories whose endpoints do not exist. The first time either is tested against the other is `G4`, two sprints of divergence later.

The concrete exposure: the admin console is being built against Prism's generated examples for ten write operations. Whatever assumptions those examples encode — field optionality, error shapes on `E1`/`E3` — go unchallenged until Sprint 09. Worth one deliberate read of the `admin` sections of `openapi.yaml` by both developers this sprint, rather than discovering it at the gate.

## Definition of Done

Every item satisfies its lane's list in [`../definition-of-done.md`](../definition-of-done.md) §3 or §4, and every story reaches §5.

`EN-EVENT-1` is an enabler with no user story: it is done when the broker-outage demonstration passes, not when the suite is green.

## Review Notes

<!-- filled at Sprint Review -->

## Retrospective

**Went well:**
**Change one thing:**
**Action (owned, carried to next sprint's board):**

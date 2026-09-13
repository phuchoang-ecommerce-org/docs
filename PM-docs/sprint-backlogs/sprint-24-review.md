# Sprint 24 — Review

**Release:** R2 · **Gate:** none · **Backend 18 pts · Frontend 11 pts**
**Related documents:** [`../release-plan.md`](../release-plan.md) · [`../integration-plan.md`](../integration-plan.md) · [`../../BA-docs/user-stories/10-review.md`](../../BA-docs/user-stories/10-review.md) · [`../../BA-docs/use-cases/10-review.md`](../../BA-docs/use-cases/10-review.md)

---

## Sprint Goal

> **Customers can review what they bought.**

**This is the first Release 2 sprint.** Everything from here to Sprint 29 completes the `Must` set; the purchase path closed at Sprint 23.

`BR-REV-01` — only verified buyers may review — is the story, and `UC-REV-01` `E1` states it the same way `UC-ORD-10` `E1` states the order state machine: **it holds whatever entry point the request arrives through and whatever role the caller holds.** An `ADMINISTRATOR` cannot author a review for a product they did not buy, because the rule is a property of the platform rather than a convention of the storefront (`P5`).

The subtlety is in the error copy. `ECP-REV-4030`'s description in [`Error Codes.md`](../../SA-docs/04-shared/Error%20Codes.md) is explicit: **the verified-purchase read model is eventually consistent, so the response tells the caller to retry shortly rather than that they never bought the product.** Wording it the other way accuses a real buyer of lying, minutes after they bought something.

And the product page's reviews section has been an advisory boundary since Sprint 07 — **a review outage is a section empty state, never a page error** (`NFR-AVAIL-02`). Sprint 07 built the boundary against an empty summary; this sprint puts real rows behind it without changing that contract.

## Committed Items

| Lane | ID | Item | Pts |
|---|---|---|---:|
| BE | `US-REV-01` | Submit Product Review | 5 |
| BE | `US-REV-04` | View Product Reviews | 5 |
| BE | `EN-EVENT-6` | Review rating-summary projection; MongoDB read-model idempotency tests | 8 |
| | | **Backend total** | **18** |
| FE | `US-RPT-04` | View Inventory Report | 3 |
| FE | `EN-CI-3` | Frontend CI stages: type check, lint, boundary + cycle check, codegen drift | 8 |
| FE | — | *Lane reserve — see [`../release-plan.md`](../release-plan.md) §6* | *7* |
| | | **Frontend total** | **11** |

---

## Backend Lane

### `US-REV-01` Submit Product Review (5 pts) — `submitProductReview`, `addReviewImage`
- [ ] **`E1` — a non-verified buyer is refused, unbypassably, by every role.** `ECP-REV-4030` (`BR-REV-01`, `FR-REV-06`, `P5`). The check goes through the verified-purchase read model, not through a role check that an admin path could skip
- [ ] **The `ECP-REV-4030` response tells the caller to retry shortly, not that they never bought the product** — the read model is eventually consistent, and the copy must not accuse a real buyer
- [ ] `E2` — an undelivered order is declined: a review written before receipt cannot be about the goods
- [ ] `E3` — an existing review for the product is declined **and amendment offered** (`BR-REV-02`). `US-REV-02` is Sprint 32 — the offer must name a route that exists or say plainly it is coming
- [ ] `E4` — a rating out of range or over-long text **records nothing**
- [ ] **`E5` — a rejected image is declined with its reason and the review offered without it** rather than losing the whole submission (`BR-REV-04`)
- [ ] `E6` — an unverified account is declined with a verification resend (`BR-CUS-02`)
- [ ] **`E7` — a product removed since purchase still accepts the review**, recorded against the order's product reference. The customer's experience is real whether or not the product is still sold (`FR-DAT-04`)
- [ ] `review` reaches `ordering` only through a port for the verified-purchase check; ArchUnit and `allowedDependencies` assert it

### `US-REV-04` View Product Reviews (5 pts) — `listProductReviews`, `getProductRatingSummary`, `reportReview`
- [ ] **Replaces the designed empty summary Sprint 07 shipped.** Confirm the response shape did not move — if it did, that is a drift entry, not a silent fix
- [ ] `E1` — reviews unavailable omits the section; **the product page is presented in full** (`NFR-AVAIL-02`)
- [ ] `E2` — a stale aggregate is acceptable and labelled; no purchasing decision depends on it
- [ ] `E3` — reviews are not presented independently of an unpublished product (`BR-CAT-02`)
- [ ] `reportReview` is written by customers from the product page; the `(admin)` view reads what it produced (`US-REV-05`, Sprint 32)
- [ ] Cursor pagination on the Sprint 02 envelope

### `EN-EVENT-6` Review rating-summary projection; MongoDB read-model idempotency (8 pts)
- [ ] MongoDB read model for the rating summary, projected from review events through the Sprint 08 outbox — **never computed synchronously on the product page**, which is what keeps `E1` a section-level failure rather than a page one
- [ ] **Idempotency tests are the named deliverable**: the same event applied twice produces one effect, proved by replaying envelopes rather than by inspecting code. The outbox is at-least-once, so this is routine, not exceptional
- [ ] Ordering guards reuse `EN-EVENT-2`'s
- [ ] **Rebuildable from the outbox alone**, using the Sprint 14 `EN-EVENT-4` replay path — IH-3 will drill it, and `EN-BENCH-2` (Sprint 29) formalises it
- [ ] Projection lag as a Micrometer meter in the `EN-OBS-2` set; `UC-REV-03` `E3` (recalculation failure) retries without withholding the withdrawal
- [ ] `NFR-AVAIL-02` proof: **stop MongoDB and confirm the product page still renders and the purchase path still works.** `EN-OBS-4` (Sprint 29) generalises this; do the review-specific case here

---

## Frontend Lane

### `EN-CI-3` Frontend CI stages (8 pts)
- [ ] Type check, lint, **boundary + cycle check** (ESLint boundaries + dependency-cruiser), and **codegen drift** as pipeline stages — the gates that have existed since Sprint 00 now enforced outside a developer's machine
- [ ] **Codegen drift fails the build**: regenerate from `openapi.yaml` and fail on a non-empty diff. This is gate check 1 automated, and after this sprint a stale `openapi.d.ts` cannot reach a gate
- [ ] Non-skippable, per [`ADR-0018`](../../SA-docs/01-system/ADR/ADR-0018-architecture-governance-ci-gate.md) — and fast enough that nobody wants to skip it, which §5 names as how the gate actually fails
- [ ] Demonstration, in the shape `EN-GATE-1` set in Sprint 01: **plant a boundary violation and a drifted type, watch CI go red, remove them, watch it go green.** The demonstration is the deliverable
- [ ] The backend's equivalent stages are `EN-CI-1` (Sprint 27) and `EN-CI-2` (Sprint 29) — this item covers the frontend lane only

### `US-RPT-04` View Inventory Report (3 pts) — `/admin/reports/inventory`, `/admin`, **R4, mock-only**
- [ ] Reads `getInventoryReport`. `reporting` arrives **Sprint 27**
- [ ] **`E1` — the as-at time is stated.** No decision made from this report consumes stock; `UC-INV-01` re-checks at the moment of reserving (`UC-INV-05` `E3`)
- [ ] `E2` — a SKU with no configured reorder threshold appears in the position report and is **listed as unconfigured rather than silently omitted**
- [ ] **`E4` — a reporting outage leaves the operational inventory view (`/admin/inventory`, Sprint 12) available.** Warehouse work cannot stop for a reporting outage (`NFR-AVAIL-02`) — and the screen should say where to go
- [ ] Vitest + axe

---

## Integration Risk

**No gate closes this sprint.** `review` reaches the frontend at `G12` in Sprint 25, where the increment is nominally administration — so the review operations must be added to `G12`'s scope explicitly or they will be checked by nobody.

The specific exposure is `ECP-REV-4030`'s copy. The frontend wrote it in Sprint 21 against a mock that returns the code with no description; the backend writes the real description now. **Two people have independently decided what a refused review says to a real buyer**, and only a deliberate comparison will catch a mismatch.

Second: `getProductRatingSummary` has returned a designed empty summary since Sprint 07 — seventeen sprints. Every product-page test written since then encodes that empty shape. Real rows arriving is the moment those assumptions surface.

## Definition of Done

Every item satisfies its lane's list in [`../definition-of-done.md`](../definition-of-done.md) §3 or §4, and every story reaches §5.

Additionally: **`EN-CI-3` is done when the planted-violation demonstration passes**, not when the pipeline is green. And confirm at Review that the review operations are added to `G12`'s scope, since no gate otherwise covers them.

## Review Notes

<!-- filled at Sprint Review -->

## Retrospective

**Went well:**
**Change one thing:**
**Action (owned, carried to next sprint's board):**

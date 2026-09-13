# Sprint 16 — Promotion: Flash Sale & Lifecycle

**Release:** R1 · **Gate:** none · **Backend 21 pts · Frontend 10 pts**
**Related documents:** [`../release-plan.md`](../release-plan.md) · [`../integration-plan.md`](../integration-plan.md) · [`../../BA-docs/user-stories/09-promotion.md`](../../BA-docs/user-stories/09-promotion.md) · [`../../BA-docs/use-cases/09-promotion.md`](../../BA-docs/use-cases/09-promotion.md)

---

## Sprint Goal

> **Promotions have a lifecycle.**

Sprint 15 made a voucher valid; this sprint makes it *stop* being valid — on a schedule, on command, and on reaching its limit. The asymmetry matters: `UC-PRM-04` `E4` and `UC-PRM-05` `E3` both describe a promotion that fails to deactivate, and both cost money **every minute** they persist. `BR-PRM-01` being re-evaluated at placement is what bounds that exposure, and it is the reason neither failure is catastrophic.

`EN-CONTRACT-1` is committed here at 13 points because there are now enough delivered operations for the spec→code direction to be worth automating — identity, catalog, search, inventory, cart and promotion. Doing it now means Sprints 17–25 inherit the harness rather than build it.

## Committed Items

| Lane | ID | Item | Pts |
|---|---|---|---:|
| BE | `US-PRM-04` | Launch Flash Sale | 5 |
| BE | `US-PRM-05` | Deactivate or Expire Promotion | 3 |
| BE | `EN-CONTRACT-1` | Contract test spec→code across delivered operations | 13 |
| | | **Backend total** | **21** |
| FE | `US-PRM-01` | Create Promotion | 5 |
| FE | `US-PRM-04` | Launch Flash Sale | 3 |
| FE | `US-PRM-05` | Deactivate or Expire Promotion | 2 |
| FE | — | *Lane reserve — see [`../release-plan.md`](../release-plan.md) §6* | *8* |
| | | **Frontend total** | **10** |

---

## Backend Lane

### `US-PRM-04` Launch Flash Sale (5 pts) — `setPromotionStatus`
- [ ] Scheduled activation at the window's start; scheduled deactivation at its end. Lease-guarded so two instances do not double-fire, same pattern as the Sprint 08 relay and the Sprint 14 cart expiry
- [ ] **`E1` — concurrent demand exceeding stock is the expected condition, not a fault.** Reservations are admitted up to available stock and no further; the Sprint 11 race already guarantees this, and nothing in the flash-sale path may weaken it (`BR-INV-01`, `NFR-REL-03`, `NFR-SCAL-06`)
- [ ] `E2` — under peak load, browsing and search may degrade **before** the purchase path does (`NFR-AVAIL-02`, `P9`). Confirm no flash-sale code path adds synchronous work to checkout
- [ ] `E3` — a sale that fails to activate at its start time is **escalated immediately**, not retried quietly. An advertised campaign that does not start is a customer-facing failure with a fixed deadline
- [ ] **`E4` — a sale that fails to deactivate keeps discounting.** Escalate immediately and permit manual deactivation. Exposure is bounded because `BR-PRM-01` is re-evaluated at placement, which rejects an expired promotion even when deactivation has not completed — assert that bound by test, because it is the only thing standing between a scheduler bug and unbudgeted spend
- [ ] `E5` — a usage limit reached before the window closes stops the sale applying **and says so**; it is never silently extended

### `US-PRM-05` Deactivate or Expire Promotion (3 pts) — `updatePromotion`, `setPromotionStatus`
- [ ] `E1` — orders in checkout carrying the promotion have it removed at placement re-validation, with the revised total re-confirmed. **`ordering` does not exist until Sprint 17–18** — implement the promotion-side removal; the re-confirmation belongs to `US-ORD-05` and is carried forward with that named sprint
- [ ] **`E2` — orders already placed are unaffected.** Their totals were fixed at placement (`BR-ORD-06`) and are not revisited when a promotion ends
- [ ] `E3` — a failed deactivation leaves the promotion active, escalates immediately, and retries (`NFR-REL-04`)
- [ ] `E4` — authority declined **and recorded** (`P16`)
- [ ] **`E5` — audit write failure lets the deactivation stand**, and the missing entry is escalated as a compliance exception. This is the **first `UC-AUD-01` `E2` case in the plan** — leaving a promotion running to preserve an audit entry costs money every minute. Select the `E2` branch the Sprint 12 `US-AUD-01` work built; do not add a second one
- [ ] Permission-matrix cell asserted on both operations

### `EN-CONTRACT-1` Contract test spec→code across delivered operations (13 pts)
- [ ] Every operation delivered through Sprint 15 is exercised **from the spec**: request shapes the contract permits are accepted, response shapes match the documented schema, and documented status codes are produced
- [ ] Driven off `openapi.yaml` itself, so an operation added to the contract without an implementation **fails the build** rather than being silently untested
- [ ] Error responses are in scope, not just the happy path — `ECP-INV-4091`, `ECP-CRT-4090`, `ECP-PRM-4220` and the `GEN` codes each have a documented shape
- [ ] Fast enough to stay in the default `check` task — [`ADR-0018`](../../SA-docs/01-system/ADR/ADR-0018-architecture-governance-ci-gate.md) §5's "slow builds create pressure to skip them" applies with full force to a suite this size
- [ ] The code→spec direction is **`EN-CONTRACT-2`, Sprint 25** — this item is deliberately one direction only, and the gate checklist's check 3 stays a manual confirmation until then
- [ ] Document which operations are covered. Coverage that is assumed rather than recorded is the failure `EN-CONTRACT-3` (Sprint 28) exists to close

---

## Frontend Lane

### `US-PRM-01` Create Promotion (5 pts) — `/admin/promotions`, `/admin/promotions/new`, **R4**
- [ ] Reads `listPromotions`; writes `createPromotion`, `generatePromotionVouchers`, on the `EN-FE-DS-4` list → detail → action shell
- [ ] **`E2` — the form cannot submit without a usage limit**, and the server remains the authority. An unbounded promotion is unbounded discount exposure (`BR-PRM-01`)
- [ ] `E1` — a configuration that could go negative renders the declined outcome and the cap requirement; `E3` names the period problem; `E4` names the unsatisfiable condition
- [ ] Generated voucher codes are displayed once, for copying — and the screen says so. A code list re-fetchable forever is a wider surface than it needs to be
- [ ] Hand-written Zod parsers for promotion, condition and voucher payloads; `loading.tsx`; `<Suspense>` per independently-fetched section
- [ ] Vitest + axe

### `US-PRM-04` Launch Flash Sale (3 pts) — `/admin/promotions/[promotionId]`, **R4**
- [ ] `setPromotionStatus` as an action on the detail view
- [ ] The scheduled window is displayed with its **activation and deactivation state**, not just its dates — `E3` and `E4` are both "the schedule and reality disagree", and an operator can only notice that if both are shown
- [ ] `E5` — a limit reached before the window closes shows the sale as stopped with the reason, distinct from an expired one
- [ ] Vitest + axe

### `US-PRM-05` Deactivate or Expire Promotion (2 pts) — `/admin/promotions/[promotionId]`, **R4**
- [ ] `updatePromotion`, `setPromotionStatus` for manual deactivation — the operator's escape hatch for `E4`, so it must be reachable in one step from the detail view
- [ ] `E3` — a failed deactivation shows the promotion **still active** with the failure stated. Showing it as deactivated when it is not is the worst available outcome
- [ ] `E2` — the screen states that placed orders are unaffected, so no operator wonders whether they need to do something about them
- [ ] Vitest + axe

---

## Integration Risk

**`EN-CONTRACT-1` will find drift that six gates did not.** It exercises every delivered operation from the spec rather than from the paths the application happens to take, so optional fields never populated, status codes never returned, and schemas never exercised all surface at once — in a sprint with no gate to absorb them.

Budget for that inside the sprint rather than carrying it to `G8`. Findings are `openapi.yaml` amendments or code fixes, decided case by case, and each one is a drift log entry per [`ADR-0031`](../../SA-docs/01-system/ADR/ADR-0031-contract-first-openapi.md).

Second: `US-PRM-05` `E5` is the first time the audit-failure branch **lets an action stand**. If Sprint 12 built only the refusal branch, this sprint discovers it.

## Definition of Done

Every item satisfies its lane's list in [`../definition-of-done.md`](../definition-of-done.md) §3 or §4, and every story reaches §5.

**`promotion` closes here.** Confirm at Review that no `PRM` story is carried, because `ordering` begins next sprint and consumes `PromotionRedemptionPort` inside a transaction.

## Review Notes

<!-- filled at Sprint Review -->

## Retrospective

**Went well:**
**Change one thing:**
**Action (owned, carried to next sprint's board):**

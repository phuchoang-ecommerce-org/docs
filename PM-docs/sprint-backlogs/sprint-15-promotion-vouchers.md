# Sprint 15 — Promotion: Vouchers & Redemption

**Release:** R1 · **Gate:** **`G7` — Contract Sync** · **Backend 21 pts · Frontend 13 pts**
**Related documents:** [`../release-plan.md`](../release-plan.md) · [`../integration-plan.md`](../integration-plan.md) · [`../../BA-docs/user-stories/09-promotion.md`](../../BA-docs/user-stories/09-promotion.md) · [`../../BA-docs/use-cases/09-promotion.md`](../../BA-docs/use-cases/09-promotion.md)

---

## Sprint Goal

> **A voucher is validated and redeemed without over-redemption.**

`UC-PRM-02` `E7` is structurally the same problem as `BR-INV-01` and gets the same treatment: two customers redeem the last available use at once, **exactly one succeeds**, and the limit holds under concurrency. Over-redemption is unbudgeted spend, which is why `BR-PRM-01` is stated as an absolute rather than a target.

The second theme is **non-disclosure**. `UC-PRM-02` `E1` requires that "never existed", "expired" and "exhausted" be indistinguishable on the standalone validation endpoint, because that endpoint is an enumeration surface — the same reasoning behind Sprint 03's sign-in response and Sprint 05's password-reset response, arriving through a third door.

## Committed Items

| Lane | ID | Item | Pts |
|---|---|---|---:|
| BE | `US-PRM-01` | Create Promotion | 8 |
| BE | `US-PRM-02` | Validate Voucher Code | 5 |
| BE | `US-PRM-03` | Apply Promotion to Order | 8 |
| | | **Backend total** | **21** |
| FE | `US-ORD-03` | Apply Voucher at Checkout | 3 |
| FE | `US-ORD-04` | Review Order Summary | 5 |
| FE | `US-PRM-02` | Validate Voucher Code | 2 |
| FE | `US-PRM-03` | Apply Promotion to Order | 3 |
| FE | — | *Lane reserve — see [`../release-plan.md`](../release-plan.md) §6* | *5* |
| | | **Frontend total** | **13** |

---

## Backend Lane

### `US-PRM-01` Create Promotion (8 pts) — `createPromotion`, `listPromotions`, `generatePromotionVouchers`
- [ ] `Promotion` aggregate, voucher codes, conditions, and the `promotion` Flyway migration under the Sprint 02 prefix convention
- [ ] **`E2` — a promotion with no usage limit is declined.** An unbounded promotion is unbounded discount exposure, and `BR-PRM-01` exists to force that decision before launch rather than after
- [ ] `E1` — a configuration that could produce a negative total is declined, or an explicit cap required (`BR-PRM-02`). **The business never pays a customer to order**
- [ ] `E3` — an end before its start, or an already-elapsed period, is declined **with the problem named**
- [ ] `E4` — mutually exclusive conditions are declined; a campaign that can never redeem is reported as a platform fault by every customer who tries it
- [ ] `E5` — authority declined **and recorded**. Creating a promotion is creating a licence to reduce prices (`P16`)
- [ ] `E6` — audit write failure means the promotion is **not created**, through the Sprint 12 `US-AUD-01` `E1` path
- [ ] `generatePromotionVouchers` produces unguessable codes — a sequential or derivable code makes `E1`'s non-disclosure pointless
- [ ] Permission-matrix cell asserted per operation; cursor pagination on `listPromotions`

### `US-PRM-02` Validate Voucher Code (5 pts) — `validateVoucher`
- [ ] **`E1` — an unrecognised code is reported as "not valid", with "never existed", "expired" and "exhausted" indistinguishable.** `ECP-PRM-4220`, described in [`Error Codes.md`](../../SA-docs/04-shared/Error%20Codes.md) as *deliberately* non-disclosive on this endpoint
- [ ] `E2` — where the campaign intends it, the validity period may be stated; otherwise `E1` applies. **The default is `E1`**
- [ ] `E3` — ineligibility is stated **without disclosing the criteria**, which would otherwise be gameable
- [ ] `E4` — per-customer limit reached is stated plainly: actionable and not disclosive
- [ ] `E5` — an unmet order condition **is** named — a minimum value, a qualifying category — because the customer may choose to meet it, which is what the condition is for
- [ ] `E6` — total usage exhausted reports the promotion is no longer available
- [ ] `E8` — rate limiting applies (`UC-AUD-04`). Repeated failed codes from one caller is code-guessing, and `NFR-SEC-05` says so
- [ ] The four-way split between what is disclosed (`E4`, `E5`) and what is not (`E1`, `E2`, `E3`) is asserted by test, per branch — this is the story most likely to be broken by someone being helpful

### `US-PRM-03` Apply Promotion to Order (8 pts) — `PromotionRedemptionPort` (internal), `listPromotionRedemptions`
- [ ] **`E7` of `UC-PRM-02` — the concurrency case.** An L5 race on the `EN-DATA-4` rig: N customers redeem the last available use; exactly one succeeds, the rest are told it is exhausted, and **the total redeemed never exceeds the limit** (`BR-PRM-01`). Same rig, same shape, same seriousness as Sprint 11's oversell race
- [ ] `ECP-PRM-4090` is the code for losing that race — **expected under peak load**, like `ECP-INV-4091`
- [ ] `E1` — a discount exceeding the discountable value is **capped**; the total is never negative (`BR-PRM-02`). `ECP-PRM-4221`
- [ ] `E2` — conflicting promotions resolve to the **single most favourable to the customer**, deterministically, and the others are recorded as not applied (`BR-PRM-03`). A non-deterministic resolution prices the same order two ways on two attempts
- [ ] `E3` — an order changing after a discount is applied **re-evaluates every applied promotion**
- [ ] `E6` — the configured rounding rule is applied consistently so line amounts sum to the recorded total. **An order whose parts do not add up cannot be reconciled by Finance** (`FR-DAT-01`, `P7`)
- [ ] `E4` (granted item out of stock) and `E5` (deactivated between application and placement) depend on `inventory` and on placement: `inventory` exists from Sprint 11, so `E4` is implementable; **`E5`'s re-validation at placement belongs to `US-ORD-05` in Sprint 18** — carry it forward with that named sprint rather than marking it done
- [ ] The redemption port is internal; code→spec confirms it exposes no endpoint

---

## Frontend Lane

> `/checkout/review` is **R3** — never cached, never optimistic ([`Routing.md`](../../SA-docs/03-frontend/Routing.md) §4.3). `placeOrder` is not built this sprint; `ordering` arrives in Sprint 17–18.

### `US-ORD-04` Review Order Summary (5 pts) — `/checkout/review`, **R3**
- [ ] Reads `getOrderSummary` against the mock; the funnel's final screen before placement
- [ ] **`E1` — a changed price shows the current value, states the change, and requires explicit re-confirmation.** The customer is never charged a price they were not shown (`BR-ORD-06`)
- [ ] `E2` — a line short of stock requires reduction or removal before continuing; the summary never reduces it for them
- [ ] `E3` — a voucher gone invalid is removed, **the total change is stated plainly with its reason**, and re-confirmation required
- [ ] `E4` — a changed shipping fee is shown and re-confirmed (`BR-SHP-01`)
- [ ] `E5` — every line unpurchasable ends checkout and returns to the cart with an explanation
- [ ] Re-confirmation is a real interaction, not a toast — the four cases above all converge on it, and it is the screen's actual job
- [ ] `loading.tsx`; hand-written Zod parsers for the summary payload; Vitest + axe across all five cases

### `US-ORD-03` Apply Voucher at Checkout (3 pts) — `/checkout/review`
- [ ] Writes `applyCheckoutVoucher`, `removeCheckoutVoucher`
- [ ] **`ECP-PRM-4090` fails the voucher field, never the checkout** — rule 5 of [`Routing.md`](../../SA-docs/03-frontend/Routing.md) §4.3, and check 6 of the integration plan exists largely for this case
- [ ] `E1`/`E2` render the non-disclosive copy exactly as the contract returns it. **The UI must not add a helpful explanation the API deliberately withheld** — that would reinstate the enumeration oracle at the presentation layer
- [ ] `E3` — an unmet condition **is** shown, because it is actionable; `E5` — a capped discount shows the capped value
- [ ] Vitest + axe, including one test asserting that the `E1` copy is identical across expired, exhausted and unknown codes

### `US-PRM-02` Validate Voucher Code (2 pts)
- [ ] The standalone `validateVoucher` path, sharing one component and one error map with `US-ORD-03` above
- [ ] Rate-limit `429` reuses the Sprint 04 screen
- [ ] Vitest

### `US-PRM-03` Apply Promotion to Order (3 pts) — `/checkout/review`, `/admin/promotions/[promotionId]`
- [ ] Discount lines rendered in the summary: which promotion, what it reduced, and — per `E2` — **which conflicting promotions were not applied**, since "recorded that the others were not applied" is only useful if the customer can see it
- [ ] `listPromotionRedemptions` on the admin promotion detail
- [ ] **No client-side arithmetic on `Money`.** Every displayed subtotal, discount and total comes from the server; this screen is where the temptation is greatest
- [ ] Vitest + axe

---

## Integration Risk

**The disclosure boundary is the risk, and it is a two-sided one.** The backend can leak by distinguishing causes; the frontend can leak by explaining a cause the backend withheld. Neither side's tests catch the other's leak. `G7` check 6 has to compare the **rendered copy** for expired, exhausted and unknown codes and confirm they are byte-identical — the same check Sprint 05 ran on password-reset messaging.

Second: `getOrderSummary` is mock-only for two more sprints, and it is the screen carrying every `Money` value in the funnel. Whatever Prism generates for discount and total shapes is unverified until `G8`.

## Gate `G7` — Contract Sync

Checklist: [`../integration-plan.md`](../integration-plan.md) §3.1, scoped to promotion, plus the cart increment of Sprint 14.

| # | Check |
|---|---|
| 1 | Types regenerated, diff empty |
| 2 | Contract test **spec→code** across `createPromotion`, `listPromotions`, `generatePromotionVouchers`, `validateVoucher`, `listPromotionRedemptions` |
| 3 | Contract test **code→spec** — **`PromotionRedemptionPort` exposes no endpoint** |
| 4 | `/checkout/review`'s voucher field and `/admin/promotions/[promotionId]` render against the real API |
| 5 | Pagination envelope and cursor shape match on `listPromotions` and `listPromotionRedemptions` |
| 6 | **`ECP-PRM-4090` fails the voucher field, never the checkout** · **the rendered copy for expired, exhausted and unknown codes is identical** · an unmet condition (`E5`) *is* named · `ECP-PRM-4221` shows the capped discount |
| 7 | Permission matrix: `createPromotion` and `generatePromotionVouchers` refused server-side for `CUSTOMER`; `validateVoucher` reachable as documented |
| 8 | **`Money` on discounts, subtotals and totals is a string, and every value shown is server-computed** — no client arithmetic anywhere in the summary |
| 9 | One correlation id across browser → API on a voucher application |
| 10 | Drift logged **and** `openapi.yaml` amended in the same session |
| — | **Recorded as expected, not drift:** `getOrderSummary` is served by the mock (`ordering` arrives Sprint 17); shipping quotes are provisional until Sprint 20 |

## Definition of Done

Every item satisfies its lane's list in [`../definition-of-done.md`](../definition-of-done.md) §3 or §4, and every story reaches §5.

## Review Notes

<!-- filled at Sprint Review -->

## Retrospective

**Went well:**
**Change one thing:**
**Action (owned, carried to next sprint's board):**

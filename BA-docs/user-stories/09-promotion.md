# Promotion — User Stories (`PRM`)

**Document type:** User Story Specification — domain
**Related documents:** [`README.md`](./README.md) (index and template) · [`../use-cases/09-promotion.md`](../use-cases/09-promotion.md) (source use cases) · [`../srs.md`](../srs.md)
**Audience:** Product Management, Engineering, Quality Assurance

---

## US-PRM-01 — Create Promotion

**As a** Staff member
**I want** to configure a promotion
**So that** Marketing can launch a campaign without a release

**Realises:** `UC-PRM-01` · `FR-PRM-01`, `FR-PRM-07`, `FR-ADM-06`, `FR-AUD-01`
**Priority:** Must

**Acceptance Criteria**
- Given a promotion type, discount, eligibility conditions, validity period, and usage limits, when I create it, then it is stored inactive until its validity period opens, and an audit entry records who created it.
- Given I generate voucher codes, when I do, then single-use codes are individually limited and shared codes rely on the total usage limit.
- Given a promotion scheduled for later, when its start time arrives, then the Scheduler activates it.
- Given I amend an existing promotion, when I save the amendment, then it is audited with before and after values and does not retroactively change discounts already applied to placed orders.
- Given I set a stacking policy, when configured, then how this promotion combines with others is deterministic.
- Given a configuration that could produce a negative order total, when submitted, then it is declined unless an explicit cap is set.
- Given no usage limit is set, when submitted, then the configuration is declined.
- Given an invalid validity period, when submitted, then it is declined with the problem named.
- Given conditions that can never be satisfied, when submitted, then the configuration is declined.
- Given I lack authority to manage promotions, when I attempt to create one, then it is declined and the attempt recorded.
- Given the audit entry cannot be written, when this happens, then the promotion is not created.

---

## US-PRM-02 — Validate Voucher Code

**As a** Customer
**I want** a voucher code I present validated
**So that** I get a clear answer about whether it applies to my order

**Realises:** `UC-PRM-02` · `FR-PRM-08`, `FR-ORD-05`
**Priority:** Must

**Acceptance Criteria**
- Given a code within its validity period, my own eligibility, order conditions met, and usage limits not exhausted, when I present it, then it is confirmed valid and the discount it would produce is returned.
- Given the same validation runs again at order placement, when I place the order, then conditions are re-checked as they then stand.
- Given an automatic promotion with no code, when eligibility is evaluated, then the same condition checks apply directly against the order.
- Given a single-use code, when validated, then the code's own use is the limit rather than a shared total.
- Given a code that is not recognised, when presented, then I am told it is not valid without distinguishing why.
- Given a code outside its validity period, when presented, then I am told when the promotion runs, or given the generic response where disclosure is not intended.
- Given I am not eligible, when the code is validated, then I am told I am not eligible without disclosing the eligibility criteria.
- Given I have reached my per-customer limit, when the code is validated, then I am told I have already used the promotion.
- Given my order does not meet the promotion's conditions, when validated, then I am told the unmet condition.
- Given the total usage limit is exhausted, when validated, then I am told the promotion is no longer available.
- Given the limit is reached by a concurrent redemption, when two customers redeem at once, then exactly one succeeds and the other is told the promotion is exhausted.
- Given excessive validation attempts from one caller, when detected, then further attempts are rejected under rate limiting.

---

## US-PRM-03 — Apply Promotion to Order

**As a** Customer
**I want** a validated promotion's discount reflected in my order total
**So that** I see the saving I was promised

**Realises:** `UC-PRM-03` · `FR-PRM-02`, `FR-PRM-03`, `FR-PRM-04`, `FR-PRM-05`, `FR-PRM-09`
**Priority:** Must

**Acceptance Criteria**
- Given a promotion validated for the order, when it is applied, then the discount is calculated against the appropriate base, capped at the discountable value, recorded against the order with its contribution, and reflected in the total.
- Given a percentage discount, when applied, then it is calculated against line or order value at the configured precision.
- Given a fixed-amount discount, when applied, then it is deducted from the order value subject to the cap.
- Given a free-shipping promotion, when applied, then the discount applies to the shipping fee while the underlying fee remains calculated and recorded.
- Given a buy-X-get-Y promotion, when applied, then qualifying lines are identified and the granted items are added or discounted, reserving stock like any other line.
- Given several promotions apply at once, when calculated, then the stacking policy decides the set and order of application deterministically.
- Given a discount would exceed the discountable value, when calculated, then it is capped and the total is never negative.
- Given promotions conflict with no resolving policy, when calculated, then only the single most favourable to me is applied, and the platform records that others were not.
- Given the order changes after a discount is applied, when it changes, then every applied promotion is re-evaluated and the discount recalculated.
- Given a buy-X-get-Y granted item is out of stock, when applied, then the platform states this and applies the configured fallback or no discount, never confirming an unfulfillable order.
- Given a promotion is deactivated between application and placement, when I place the order, then it is removed and I must re-confirm the revised total.
- Given rounding produces a discrepancy, when calculated, then the configured rounding rule is applied consistently so line amounts sum to the recorded total.

---

## US-PRM-04 — Launch Flash Sale

**As an** Administrator
**I want** a configured flash sale to activate and enforce its limits automatically
**So that** the campaign runs within its window without overselling

**Realises:** `UC-PRM-04` · `FR-PRM-06`, `FR-PRM-07`, `FR-PRM-10`
**Priority:** Must

**Acceptance Criteria**
- Given a flash sale configured with its products, discount, window, and limits, when its start time arrives or it is launched manually, then it activates, the sale price becomes visible on participating products, and it applies to qualifying orders as placed.
- Given the sale is launched manually, when I do so, then the action and actor are recorded.
- Given a stock allocation set aside for the sale, when reservations are taken, then the allocation is exhausted like any other stock with no overselling.
- Given the sale is ended early, when an Administrator does so, then it is recorded with a reason.
- Given the sale is announced in advance, when configured, then a promotion notification is raised before the start.
- Given concurrent demand exceeds available stock during the sale, when this occurs, then reservations are admitted only up to available stock and every later placement is told the item is gone — no order is confirmed that cannot be fulfilled.
- Given traffic exceeds peak capacity during the sale, when this occurs, then checkout and payment continue to meet their availability targets even if browsing and search degrade.
- Given the sale fails to activate at its start time, when this happens, then the failure is escalated immediately.
- Given the sale fails to deactivate at its end time, when this happens, then it is escalated immediately and can be deactivated manually, while re-validation at placement still rejects the expired promotion.
- Given the usage limit is reached before the window closes, when this happens, then the sale stops applying and states so rather than being silently extended.

---

## US-PRM-05 — Deactivate or Expire Promotion

**As an** Administrator
**I want** a promotion deactivated when it ends, is exhausted, or must be stopped
**So that** it stops applying to further orders while past orders remain unaffected

**Realises:** `UC-PRM-05` · `FR-PRM-10`, `FR-AUD-01`
**Priority:** Must

**Acceptance Criteria**
- Given a promotion reaching its end time, exhausting its limit, or being manually deactivated, when this happens, then it is marked inactive, stops applying to any order not yet placed, is withdrawn from catalog and search, and an audit entry is recorded.
- Given the promotion expires via the Scheduler, when it does, then attribution is to the schedule rather than a person.
- Given the usage limit is reached before the end time, when this happens, then the promotion deactivates itself.
- Given an Administrator deactivates it manually, when they do, then the reason is recorded.
- Given a still-valid promotion is reactivated, when this happens, then both the deactivation and reactivation are audited.
- Given orders in checkout still carry the promotion, when deactivation occurs, then re-validation at placement removes it and requires re-confirmation of the revised total.
- Given orders already placed with the promotion, when it is deactivated, then they are unaffected since their totals were fixed at placement.
- Given deactivation fails, when attempted, then the promotion stays active, the failure is escalated immediately and retried, with exposure bounded by re-validation at placement.
- Given I lack the authority to deactivate the promotion, when I attempt it, then it is declined and recorded.
- Given the audit entry cannot be written after deactivation has already taken effect, when this happens, then the deactivation stands and the missing entry is escalated as a compliance exception.

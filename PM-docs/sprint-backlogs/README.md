# Sprint Backlogs — Enterprise Commerce Platform (ECP)

**Document type:** Index
**Audience:** Engineering, Product Management
**Related documents:** [`../release-plan.md`](../release-plan.md) · [`../product-backlog.md`](../product-backlog.md) · [`../definition-of-done.md`](../definition-of-done.md)

---

## 1. What These Files Are, and What They Are Not

A Sprint Backlog belongs to **the people doing the work, at Sprint Planning**. Nothing here changes that.

What these files are is **pre-filled drafts**. Every one of them is assembled from material that already exists and is already fixed: the sprint goal, the committed items, their estimates and their gate come from [`../release-plan.md`](../release-plan.md) §4; the acceptance criteria, business rules and exception flows come from [`../../BA-docs/`](../../BA-docs/README.md); the route classes, boundary rules and error-code behaviour come from [`../../SA-docs/`](../../SA-docs/README.md). Writing them down in advance is transcription, not planning.

**Two things are deliberately absent from every unstarted file**, because they are the parts that genuinely cannot be written ahead of the day:

- **Nothing is checked.** Every task is `- [ ]`. A task list is a proposal until the team confirms it at Planning, and a pre-checked one is a Gantt chart wearing a checklist's clothes.
- **Review Notes and Retrospective are empty.** They record what happened. Sprints 00–05 have theirs filled because that work is done.

So at Sprint Planning the team **confirms and amends** the draft rather than authoring one from scratch: break any slice that is bigger than it looks, drop anything the last sprint invalidated, and check every item against the Definition of Ready ([`../definition-of-done.md`](../definition-of-done.md) §2). An item that fails goes back to Refinement rather than into the sprint to be clarified during it.

The **Integration Risk** section is the one part worth reading before the day. It names, per sprint, the thing most likely to surface a contract problem at the next gate — and several of those (a shared cache-key scheme, a disclosure boundary that both lanes can independently break) are cheapest to settle before either lane starts.

---

## 2. The Files

### Delivered

| Sprint | File | Goal |
|---|---|---|
| 00 | [`sprint-00-foundation.md`](./sprint-00-foundation.md) | Both lanes have a build that enforces its own rules |
| 01 | [`sprint-01-gate-and-contract-harness.md`](./sprint-01-gate-and-contract-harness.md) | The architecture gate is real and the contract harness runs — **`G0`** |
| 02 | [`sprint-02-wire-format-and-shell.md`](./sprint-02-wire-format-and-shell.md) | Every response shape a controller will ever return is decided once |
| 03 | [`sprint-03-identity-core.md`](./sprint-03-identity-core.md) | A customer can register, verify, sign in, and sign out — **`G1`** |
| 04 | [`sprint-04-authorisation.md`](./sprint-04-authorisation.md) | Authorisation and rate limiting hold on every path |
| 05 | [`sprint-05-identity-account.md`](./sprint-05-identity-account.md) | A customer owns their account — **`G2`** |

### Active

| Sprint | File | Goal |
|---|---|---|
| 06 | [`sprint-06-catalog-browse.md`](./sprint-06-catalog-browse.md) | The catalog is browsable |

### Drafted

| Sprint | File | Goal |
|---|---|---|
| 07 | [`sprint-07-catalog-detail-and-cache.md`](./sprint-07-catalog-detail-and-cache.md) | The product page is the reference implementation of `NFR-AVAIL-02` — **`G3`** |
| 08 | [`sprint-08-event-backbone.md`](./sprint-08-event-backbone.md) | No accepted business event can be silently lost |
| 09 | [`sprint-09-catalog-administration.md`](./sprint-09-catalog-administration.md) | An operator can manage the catalog, and the storefront notices — **`G4`** |
| ⛓ IH-1 | [`ih-1-session-and-catalog.md`](./ih-1-session-and-catalog.md) | Session and catalog, end to end — *no stories, no points* |
| 10 | [`sprint-10-search.md`](./sprint-10-search.md) | Search answers from its own read store |
| 11 | [`sprint-11-inventory-reservation.md`](./sprint-11-inventory-reservation.md) | The oversell guarantee is proved, not asserted — **`G5`** |
| 12 | [`sprint-12-inventory-adjustments-and-audit.md`](./sprint-12-inventory-adjustments-and-audit.md) | Stock is adjustable and every command is audited |
| 13 | [`sprint-13-cart-lines-and-guest-cart.md`](./sprint-13-cart-lines-and-guest-cart.md) | A guest can build a cart — **`G6`** |
| 14 | [`sprint-14-cart-merge-and-checkout-funnel.md`](./sprint-14-cart-merge-and-checkout-funnel.md) | A guest cart survives sign-in, and an abandoned one expires |
| 15 | [`sprint-15-promotion-vouchers.md`](./sprint-15-promotion-vouchers.md) | A voucher is validated and redeemed without over-redemption — **`G7`** |
| 16 | [`sprint-16-promotion-lifecycle.md`](./sprint-16-promotion-lifecycle.md) | Promotions have a lifecycle |
| 17 | [`sprint-17-ordering-checkout-funnel.md`](./sprint-17-ordering-checkout-funnel.md) | Checkout collects everything an order needs — **`G8`** |
| 18 | [`sprint-18-ordering-place-order.md`](./sprint-18-ordering-place-order.md) | Placing an order is atomic across three modules |
| 19 | [`sprint-19-ordering-lifecycle-and-admin.md`](./sprint-19-ordering-lifecycle-and-admin.md) | An order has a life after placement — **`G9`** |
| 20 | [`sprint-20-shipping.md`](./sprint-20-shipping.md) | Goods move and the customer can see it |
| ⛓ IH-2 | [`ih-2-the-money-path.md`](./ih-2-the-money-path.md) | The money path — whether `P6`, `P7` and `P8` are solved — *no stories, no points* |
| 21 | [`sprint-21-payment-authorise.md`](./sprint-21-payment-authorise.md) | Money can be taken — **`G10`** |
| 22 | [`sprint-22-payment-settle-retry-refund.md`](./sprint-22-payment-settle-retry-refund.md) | Money can be settled, retried, and given back |
| 23 | [`sprint-23-notification.md`](./sprint-23-notification.md) | The platform tells people what happened — **`G11`** · *Release 1 closes* |
| 24 | [`sprint-24-review.md`](./sprint-24-review.md) | Customers can review what they bought — *Release 2 begins* |
| 25 | [`sprint-25-administration.md`](./sprint-25-administration.md) | Operators can run the business — **`G12`** |
| 26 | [`sprint-26-reporting-read-models.md`](./sprint-26-reporting-read-models.md) | Reporting answers from MongoDB, never from the write model |
| 27 | [`sprint-27-reporting-lag-and-ci.md`](./sprint-27-reporting-lag-and-ci.md) | Every reporting screen shows its own lag — **`G13`** |
| 28 | [`sprint-28-audit-trail-and-contract-completeness.md`](./sprint-28-audit-trail-and-contract-completeness.md) | The audit trail is searchable and append-only |
| 29 | [`sprint-29-release-2-stabilisation.md`](./sprint-29-release-2-stabilisation.md) | Release 2 is stabilised and the event backbone is proved under failure — **`G14`** · *the `Must` cut line* |
| ⛓ IH-3 | [`ih-3-whole-system.md`](./ih-3-whole-system.md) | The whole system, and an honest statement of what is still unverified — *no stories, no points* |
| 30 | [`sprint-30-discovery-should-could.md`](./sprint-30-discovery-should-could.md) | Discovery gets its `Should` and `Could` capability — *Release 3 begins* |
| 31 | [`sprint-31-cart-orders-personalisation.md`](./sprint-31-cart-orders-personalisation.md) | Wishlist, returns, delivery estimates, and personalisation — **`G15`** |
| 32 | [`sprint-32-launch-readiness.md`](./sprint-32-launch-readiness.md) | The release is ready and its unverified claims are stated as unverified — **`RR`** |

| | | |
|---|---|---|
| — | [`_template.md`](./_template.md) | The shape every later sprint backlog takes |

**Every sprint in the plan now has a file** — all thirty-three delivery sprints and all three Integration Hardening sprints. [`../release-plan.md`](../release-plan.md) §4 remains the source each was transcribed from, and remains authoritative where the two disagree.

---

## 3. Keeping Them Current

There is nothing left to create, so the work is now maintenance — and there are two kinds.

**At Sprint Planning**, take the draft and confirm it. Break any slice bigger than it looks, drop anything the last sprint invalidated, and check every item against the Definition of Ready ([`../definition-of-done.md`](../definition-of-done.md) §2). Amend the file in place; a draft that disagreed with the day is evidence, not an embarrassment.

**At Sprint Review**, fill in Review Notes and the Retrospective, and check the tasks that were actually done. Leave unchecked what was not, with a line saying why — [`sprint-05-identity-account.md`](./sprint-05-identity-account.md) is the worked example: its one unchecked item names the sprint that can close it.

Two rules hold whatever is being edited:

- **Points are copied, never recomputed.** If a committed-items total here disagrees with [`../release-plan.md`](../release-plan.md) §4, this file is the one that is wrong. `Lane reserve` rows are excluded from the total, matching §4's own convention — including Sprint 26, whose frontend total is genuinely `0`.
- **A forward reference names its sprint.** Where a story depends on something not yet built, say so and name the sprint that builds it, rather than marking it done or leaving it silent.

[`_template.md`](./_template.md) remains for a sprint that has to be re-cut from scratch. An Integration Hardening sprint does not use it — it carries no items and no points; the three `ih-*` files are that shape.

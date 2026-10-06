# Administration — User Stories (`ADM`)

**Related documents:** [`README.md`](./README.md) (index and template) · [`../use-cases/12-administration.md`](../use-cases/12-administration.md) (source use cases) · [`../srs.md`](../srs.md)

---

## US-ADM-01 — Manage Products

**As a** Staff member
**I want** to create, amend, publish, unpublish, and price products and variants
**So that** I can maintain the catalog without needing a release

**Realises:** `UC-ADM-01` · `FR-ADM-01`, `FR-CAT-01`, `FR-CAT-02`, `FR-AUD-01`, `FR-AUD-02`
**Priority:** Must

**Acceptance Criteria**
- Given a role permitting product management and a valid submission, when I create or amend a product, then the catalog reflects the change and an audit entry records the actor and the before and after values.
- Given a price change, when applied, then it is audited specifically as a price change; carts re-price on next display and orders already placed are unaffected.
- Given a product is published, when this happens, then it becomes visible to browsing and search.
- Given a product is unpublished, when this happens, then it disappears from browsing, search, and new cart additions but remains visible on orders that already contain it, with existing cart lines marked unpurchasable rather than removed.
- Given a variant is removed, when this happens, then its SKU is not reused, so historic orders remain unambiguous.
- Given a bulk amendment, when applied, then each product is audited individually and one rejection does not fail the batch.
- Given a SKU already in use, when submitted, then it is declined with the conflict named.
- Given I lack authority to manage products, when I attempt a change, then it is declined and the attempt recorded.
- Given the product has stock or open orders and removal is attempted, when this happens, then removal is declined and unpublishing offered instead.
- Given validation fails, when submitted, then nothing is applied.
- Given the audit entry cannot be written, when this happens, then the change is not applied.
- Given propagation to search fails, when this happens, then the change stands and propagation is retried.

---

## US-ADM-02 — Manage Categories

**As a** Staff member
**I want** to create, amend, move, and remove categories
**So that** I can restructure merchandising as the product range changes

**Realises:** `UC-ADM-02` · `FR-ADM-02`, `FR-CAT-05`, `FR-CAT-06`, `FR-AUD-01`
**Priority:** Must

**Acceptance Criteria**
- Given a role permitting category management, when I create or amend a category's name, image, parent, ordering, or featured status, then the tree reflects the change, products remain reachable, and an audit entry is recorded.
- Given a category is moved to a new parent, when this happens, then its descendants move with it and products remain associated and reachable.
- Given a category is marked featured, when this happens, then it appears in the featured collection.
- Given a category is removed after its products and children are reassigned, when removal is confirmed, then it is removed.
- Given a category is reordered, when this happens, then presentation order changes without affecting product association.
- Given a change would create a cycle, when submitted, then it is declined.
- Given removal is attempted while the category holds products or children, when attempted, then it is declined with the count of what must be reassigned.
- Given I lack authority to manage categories, when I attempt a change, then it is declined and recorded.
- Given the audit entry cannot be written, when this happens, then the change is not applied.

---

## US-ADM-03 — Manage Customer Accounts

**As a** Customer Support Agent
**I want** to view, suspend, and reinstate customer accounts
**So that** I can act on accounts implicated in fraud or customer requests, with access limited to what I need

**Realises:** `UC-ADM-03` · `FR-ADM-03`, `FR-AUD-01`, `FR-AUD-02`
**Priority:** Must

**Acceptance Criteria**
- Given a role permitting customer administration, when I open an account, then its profile, addresses, and order history are presented excluding credentials and payment instrument details.
- Given I suspend or reinstate an account with a reason, when I do, then the change is applied, every session invalidated on suspension, an audit entry recorded, and the customer notified where the change affects access.
- Given I inspect an account read-only, when I do, then the access itself is audited.
- Given an account is reinstated, when this happens, then access is restored and the customer must authenticate again.
- Given I correct a profile detail at the customer's request, when I do, then the correction and its basis are recorded.
- Given an account is deleted at the customer's request, when this happens, then orders are retained as financial records with the customer reference preserved.
- Given I lack authority to manage customer accounts, when I attempt it, then it is declined and the attempt recorded.
- Given credentials are requested, when this happens, then they are never disclosed to any role.
- Given no reason is supplied for a suspension, when submitted, then it is declined.
- Given the account has open orders, when suspended, then those orders continue to be fulfilled or are deliberately resolved rather than abandoned.
- Given the audit entry cannot be written, when this happens, then the change is not applied.

---

## US-ADM-04 — Manage Orders

**As a** Staff member
**I want** to search, inspect, and act on orders within my role's limits
**So that** I can progress or intervene on orders on the business's behalf

**Realises:** `UC-ADM-04` · `FR-ADM-04`, `FR-ORD-11`, `FR-ORD-12`, `FR-ORD-16`, `FR-AUD-01`
**Priority:** Must

**Acceptance Criteria**
- Given a role permitting order administration, when I search by customer, state, date, or reference, then matching orders are presented with their current states.
- Given an order I open, when I take an action my role and its state permit — advance, cancel, accept a return, or refund, then the action applies under the same rules that govern it anywhere else, and an audit entry is recorded.
- Given Support acts for a customer, when they do, then the action is recorded against the agent with the customer as its subject.
- Given a bulk state advance, when requested, then each order is evaluated and applied independently.
- Given an order is flagged for investigation, when flagged, then its state is unchanged and fulfilment can be paused pending review.
- Given orders are exported for reconciliation, when exported, then the export itself is audited.
- Given the requested transition is not legal, when attempted by any role including Administrator, then it is declined with the current state and available transitions stated.
- Given I lack authority for the specific action, when I attempt it, then it is declined and recorded.
- Given an amendment to a placed order's contents or total is attempted, when attempted, then it is declined — the remedies are cancellation, return, and refund.
- Given the order changes while being inspected, when the action is applied, then it is re-evaluated against the current state and declined if no longer legal.
- Given the audit entry cannot be written, when this happens, then the action is not applied, except where money has already moved externally.

---

## US-ADM-05 — Manage Inventory Adjustments

**As a** Warehouse Operator
**I want** to record inventory adjustments and review adjustment history through administration
**So that** the stock record matches the shelf and every change is attributable

**Realises:** `UC-ADM-05` · `FR-ADM-05`, `FR-INV-05`, `FR-INV-06`, `FR-AUD-01`, `FR-AUD-02`
**Priority:** Must

**Acceptance Criteria**
- Given a role permitting inventory management, when I open inventory administration for a SKU or warehouse, then current stock, reserved, and available quantities are presented.
- Given a quantity delta and a reason, when I record an adjustment, then it is applied and an audit entry recorded.
- Given I review a SKU's adjustment history, when I do, then each entry shows who adjusted it, by how much, and why.
- Given several adjustments recorded against one stock count, when I record them, then the whole count can be examined as a unit afterward.
- Given an Administrator overrides normal process, when they adjust, then the elevated authority is recorded in the audit entry.
- Given the adjustment would make available stock negative, when submitted, then it is declined, stating the reserved quantity and the orders holding it.
- Given no reason is supplied, when submitted, then it is declined.
- Given I lack authority to adjust inventory, when I attempt it, then it is declined and recorded.
- Given the audit entry cannot be written, when this happens, then the adjustment is not applied.

---

## US-ADM-06 — Manage User Roles

**As an** Administrator
**I want** to assign and revoke the roles a user holds
**So that** people have exactly the authority their job requires

**Realises:** `UC-ADM-06` · `FR-ADM-09`, `FR-AUD-05`, `FR-AUD-01`, `FR-AUD-02`
**Priority:** Must

**Acceptance Criteria**
- Given I hold the Administrator role, when I assign or revoke a role for a user with a reason, then the user's roles are amended, the change takes effect within one session refresh at the latest, and an audit entry records the actor, subject, before and after roles, reason, and time.
- Given a user holds more than one role, when authority is evaluated, then it is the union of the roles held.
- Given a revocation is urgent, when I act, then I may end the user's sessions immediately rather than waiting for expiry.
- Given a role changes as part of a job change, when applied, then both the addition and the removal are recorded.
- Given I attempt to grant myself a role I do not hold, when attempted, then it is declined and recorded as a security event.
- Given the last Administrator role would be revoked, when attempted, then it is declined.
- Given I am not an Administrator, when I attempt any role change, then it is declined and recorded.
- Given no reason is supplied, when submitted, then it is declined.
- Given the audit entry cannot be written, when this happens, then the change is not applied.
- Given a user has outstanding work under a revoked role, when revoked, then the revocation still proceeds and the work is reassigned.

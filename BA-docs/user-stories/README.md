# User Story Specification — Enterprise Commerce Platform (ECP)

**Document type:** User Story Specification (index)
**Related documents:** [`../use-cases/README.md`](../use-cases/README.md) (Use Case Specification — source) · [`../srs.md`](../srs.md) (Software Requirements Specification) · [`../traceability-matrix.md`](../traceability-matrix.md)
**Audience:** Product Management, Engineering, Quality Assurance
**Version:** 1.0
**Status:** Draft for stakeholder review

---

## 1. Purpose of This Document

[`../use-cases/`](../use-cases/README.md) specifies **how each actor reaches a requirement**, in full — every precondition, every alternate flow, every exception. That level of detail is what makes it reviewable against the business rules in [`../srs.md`](../srs.md) §4, but it is not the shape engineering pulls into a sprint backlog.

This document restates the same 87 use cases as **user stories with acceptance criteria** — the format a backlog is built from and a test is written against. It is a derivation, not a second analysis: each story's "So that" clause comes from its source use case's stated stakeholder interest, and each acceptance criterion comes from that use case's main scenario, alternate flows, and exception flows restated as Given/When/Then. Nothing here overrides or re-decides anything already settled in [`../srs.md`](../srs.md) or [`../use-cases/`](../use-cases/README.md) — where the two disagree, the use case is normative.

---

## 2. Identifier Scheme and Numbering

Every story carries the identifier `US-<DOMAIN>-<nn>`, using the same domain codes as [`../srs.md`](../srs.md) §1.5. **Numbering is 1:1 with the use cases**: `US-CUS-01` realises `UC-CUS-01`, `US-ORD-05` realises `UC-ORD-05`, and so on, with no exceptions and no gaps. This is why no separate `UC → US` traceability table exists elsewhere — the mapping is the identifier itself. See [`../traceability-matrix.md`](../traceability-matrix.md) §3 for the note recording this rule.

A story's **priority** is inherited unchanged from its source use case's MoSCoW priority ([`../srs.md`](../srs.md) §1.5).

---

## 3. How to Read a Story

| Field | Meaning |
|---|---|
| **As a / I want / So that** | The actor, the goal, and the benefit — the goal restates the use case's trigger and primary actor; the benefit is drawn from that actor's stated interest in **Stakeholders & interests** |
| **Realises** | The `UC` this story derives from, and the `FR` identifiers that use case's own Traceability row cites |
| **Priority** | Inherited from the source use case |
| **Acceptance Criteria** | Given/When/Then bullets: one or two covering the main success scenario, one per alternate flow, one per exception flow |

An acceptance criterion never introduces a condition the source use case did not already specify. Where a use case's exception flow describes *why* a rule exists (a business-rule citation, a reference to a business problem `P1`–`P17`), the acceptance criterion states only the testable behaviour — the *why* stays in the use case, which remains the place to read it.

---

## 4. Story Inventory

**87 stories across 14 domains, one per use case in [`../use-cases/`](../use-cases/README.md).**

| Domain | File | Count |
|---|---|---|
| Customer & Identity | [`01-customer-identity.md`](./01-customer-identity.md) | 10 |
| Product Catalog & Category | [`02-catalog-category.md`](./02-catalog-category.md) | 5 |
| Search & Recommendation | [`03-search-recommendation.md`](./03-search-recommendation.md) | 7 |
| Inventory | [`04-inventory.md`](./04-inventory.md) | 5 |
| Cart & Wishlist | [`05-cart-wishlist.md`](./05-cart-wishlist.md) | 8 |
| Checkout & Order | [`06-checkout-order.md`](./06-checkout-order.md) | 10 |
| Payment | [`07-payment.md`](./07-payment.md) | 6 |
| Shipping | [`08-shipping.md`](./08-shipping.md) | 6 |
| Promotion | [`09-promotion.md`](./09-promotion.md) | 5 |
| Review | [`10-review.md`](./10-review.md) | 5 |
| Notification | [`11-notification.md`](./11-notification.md) | 4 |
| Administration | [`12-administration.md`](./12-administration.md) | 6 |
| Reporting & Analytics | [`13-reporting-analytics.md`](./13-reporting-analytics.md) | 6 |
| Audit & Access Control | [`14-audit-access-control.md`](./14-audit-access-control.md) | 4 |

### 4.1 Customer & Identity

| ID | Story | Actor | Priority |
|---|---|---|---|
| `US-CUS-01` | Register Customer Account | Guest | Must |
| `US-CUS-02` | Verify Email Address | Guest | Must |
| `US-CUS-03` | Log In | Guest | Must |
| `US-CUS-04` | Log Out | Customer | Must |
| `US-CUS-05` | Refresh Authenticated Session | Customer | Must |
| `US-CUS-06` | Change Password | Customer | Must |
| `US-CUS-07` | Reset Forgotten Password | Guest | Must |
| `US-CUS-08` | Manage Profile | Customer | Must |
| `US-CUS-09` | Manage Shipping Addresses | Customer | Must |
| `US-CUS-10` | View Purchase History | Customer | Must |

### 4.2 Product Catalog & Category

| ID | Story | Actor | Priority |
|---|---|---|---|
| `US-CAT-01` | Browse Category Tree | Guest | Must |
| `US-CAT-02` | Browse Category Product Listing | Guest | Must |
| `US-CAT-03` | View Product Details | Guest | Must |
| `US-CAT-04` | Select Product Variant | Customer | Must |
| `US-CAT-05` | View Featured Categories | Guest | Should |

### 4.3 Search & Recommendation

| ID | Story | Actor | Priority |
|---|---|---|---|
| `US-SCH-01` | Search Products by Keyword | Guest | Must |
| `US-SCH-02` | Receive Search Suggestions and Auto-complete | Guest | Should |
| `US-SCH-03` | Filter and Sort Search Results | Guest | Must |
| `US-SCH-04` | View Popular and Recent Keywords | Guest | Could |
| `US-SCH-05` | View Related and Frequently Bought Together Products | Guest | Should |
| `US-SCH-06` | View Trending Products and New Arrivals | Guest | Could |
| `US-SCH-07` | Receive Personalised Recommendations | Customer | Could |

### 4.4 Inventory

| ID | Story | Actor | Priority |
|---|---|---|---|
| `US-INV-01` | Reserve Stock for an Order | Checkout & Order (internal) | Must |
| `US-INV-02` | Release Reserved Stock | Checkout & Order (internal) | Must |
| `US-INV-03` | Commit Reserved Stock on Fulfilment | Warehouse Operator | Must |
| `US-INV-04` | Adjust Inventory | Warehouse Operator | Must |
| `US-INV-05` | View Inventory Levels | Warehouse Operator | Must |

### 4.5 Cart & Wishlist

| ID | Story | Actor | Priority |
|---|---|---|---|
| `US-CRT-01` | Add Item to Cart | Guest | Must |
| `US-CRT-02` | Update Cart Item Quantity | Guest | Must |
| `US-CRT-03` | Remove Item from Cart | Guest | Must |
| `US-CRT-04` | View Cart | Guest | Must |
| `US-CRT-05` | Merge Guest Cart on Login | Customer | Must |
| `US-CRT-06` | Expire Inactive Cart | Scheduler | Must |
| `US-CRT-07` | Manage Wishlist | Customer | Should |
| `US-CRT-08` | Move Wishlist Item to Cart | Customer | Should |

### 4.6 Checkout & Order

| ID | Story | Actor | Priority |
|---|---|---|---|
| `US-ORD-01` | Initiate Checkout | Customer | Must |
| `US-ORD-02` | Provide Shipping and Billing Information | Customer | Must |
| `US-ORD-03` | Apply Voucher at Checkout | Customer | Must |
| `US-ORD-04` | Review Order Summary | Customer | Must |
| `US-ORD-05` | Place Order | Customer | Must |
| `US-ORD-06` | View Order Details | Customer | Must |
| `US-ORD-07` | Track Order | Customer | Must |
| `US-ORD-08` | Cancel Order | Customer | Must |
| `US-ORD-09` | Request Return | Customer | Should |
| `US-ORD-10` | Advance Order Status | Staff | Must |

### 4.7 Payment

| ID | Story | Actor | Priority |
|---|---|---|---|
| `US-PAY-01` | Select Payment Method | Customer | Must |
| `US-PAY-02` | Authorise Online Payment | Customer | Must |
| `US-PAY-03` | Handle Payment Gateway Result | Payment Gateway | Must |
| `US-PAY-04` | Settle Cash On Delivery Payment | Warehouse Operator | Must |
| `US-PAY-05` | Retry Failed Payment | Customer | Must |
| `US-PAY-06` | Process Refund | Customer Support Agent | Must |

### 4.8 Shipping

| ID | Story | Actor | Priority |
|---|---|---|---|
| `US-SHP-01` | Calculate Shipping Fee | Customer | Must |
| `US-SHP-02` | Estimate Delivery Date | Customer | Should |
| `US-SHP-03` | Create Shipment | Warehouse Operator | Must |
| `US-SHP-04` | Record Carrier Tracking Update | Shipping Carrier | Must |
| `US-SHP-05` | View Shipment Tracking | Customer | Must |
| `US-SHP-06` | Confirm Delivery | Shipping Carrier | Must |

### 4.9 Promotion

| ID | Story | Actor | Priority |
|---|---|---|---|
| `US-PRM-01` | Create Promotion | Staff | Must |
| `US-PRM-02` | Validate Voucher Code | Customer | Must |
| `US-PRM-03` | Apply Promotion to Order | Customer | Must |
| `US-PRM-04` | Launch Flash Sale | Administrator | Must |
| `US-PRM-05` | Deactivate or Expire Promotion | Administrator | Must |

### 4.10 Review

| ID | Story | Actor | Priority |
|---|---|---|---|
| `US-REV-01` | Submit Product Review | Customer | Must |
| `US-REV-02` | Edit Own Review | Customer | Should |
| `US-REV-03` | Delete Own Review | Customer | Should |
| `US-REV-04` | View Product Reviews | Guest | Must |
| `US-REV-05` | Moderate Review | Customer Support Agent | Should |

### 4.11 Notification

| ID | Story | Actor | Priority |
|---|---|---|---|
| `US-NTF-01` | Deliver Email Notification | Business event (internal) | Must |
| `US-NTF-02` | Deliver In-App Notification | Business event (internal) | Must |
| `US-NTF-03` | View In-App Notifications | Customer | Must |
| `US-NTF-04` | Manage Notification Preferences | Customer | Should |

### 4.12 Administration

| ID | Story | Actor | Priority |
|---|---|---|---|
| `US-ADM-01` | Manage Products | Staff | Must |
| `US-ADM-02` | Manage Categories | Staff | Must |
| `US-ADM-03` | Manage Customer Accounts | Customer Support Agent | Must |
| `US-ADM-04` | Manage Orders | Staff | Must |
| `US-ADM-05` | Manage Inventory Adjustments | Warehouse Operator | Must |
| `US-ADM-06` | Manage User Roles | Administrator | Must |

### 4.13 Reporting & Analytics

| ID | Story | Actor | Priority |
|---|---|---|---|
| `US-RPT-01` | View Revenue Report | Administrator | Must |
| `US-RPT-02` | View Product Performance Report | Staff | Must |
| `US-RPT-03` | View Customer Report | Administrator | Should |
| `US-RPT-04` | View Inventory Report | Warehouse Operator | Must |
| `US-RPT-05` | View Order and Conversion Statistics | Staff | Must |
| `US-RPT-06` | Export Report | Administrator | Could |

### 4.14 Audit & Access Control

| ID | Story | Actor | Priority |
|---|---|---|---|
| `US-AUD-01` | Record Audit Entry | Any authorised actor (internal) | Must |
| `US-AUD-02` | Search Audit Trail | Administrator | Must |
| `US-AUD-03` | Authorise Request via RBAC | Any authenticated actor | Must |
| `US-AUD-04` | Enforce API Rate Limit | Any caller | Must |

---

## 5. Next Step

[`../traceability-matrix.md`](../traceability-matrix.md) records the `UC → US` numbering rule and continues to be the authority for `P → FR → UC` coverage; this document adds no new coverage claim, since every story maps to exactly one already-covered use case.

# User Story Specification — Enterprise Commerce Platform (ECP)

**Document type:** User Story Specification (index)
**Related documents:** [`../use-cases/README.md`](../use-cases/README.md) (Use Case Specification — source) · [`../srs.md`](../srs.md) (Software Requirements Specification) · [`../traceability-matrix.md`](../traceability-matrix.md)
**Audience:** Product Management, Engineering, Quality Assurance
**Version:** 1.0
**Status:** Draft for stakeholder review

## 1. Scope

These 87 stories derive from the 87 [use cases](../use-cases/README.md). The use case is normative if the two disagree.

## 2. Mapping

`US-<DOMAIN>-<nn>` maps directly to `UC-<DOMAIN>-<nn>` with no gaps. For example, `US-ORD-05` maps to `UC-ORD-05`. Stories inherit the source use case's MoSCoW priority. [`srs.md`](../srs.md) §1.5 defines the domain codes, and [`traceability-matrix.md`](../traceability-matrix.md) §3 records the mapping rule.

## 3. Story format

| Field | Meaning |
|---|---|
| **As a / I want / So that** | Actor, goal, and stakeholder interest from the source use case |
| **Realises** | Source `UC` and its traced `FR` identifiers |
| **Priority** | Inherited from the source use case |
| **Acceptance Criteria** | Given/When/Then cases for success, alternate, and exception flows |

Acceptance criteria cannot add conditions that are absent from the source use case. Business rationale stays in the use case.

## 4. Inventory

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

The [use case inventory](../use-cases/README.md#4-inventory) lists each ID, title, actor, and priority. This index does not repeat it.

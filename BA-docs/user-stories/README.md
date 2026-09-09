# User Story Specification — Enterprise Commerce Platform (ECP)

**Document type:** User Story Specification (index)
**Related documents:** [`../use-cases/README.md`](../use-cases/README.md) (Use Case Specification — source) · [`../srs.md`](../srs.md) (Software Requirements Specification) · [`../traceability-matrix.md`](../traceability-matrix.md)
**Audience:** Product Management, Engineering, Quality Assurance
**Version:** 1.0
**Status:** Draft for stakeholder review

Every numbered file in this folder is a **User Story Specification — domain** for the audience above; the per-file headers carry only what differs between them.

---

## 1. Purpose of This Document

This document restates the same 87 use cases as **user stories with acceptance criteria** — the format a backlog is built from and a test is written against. It is a derivation, not a second analysis: each story's "So that" clause comes from its source use case's stated stakeholder interest, and each acceptance criterion comes from that use case's main scenario, alternate flows, and exception flows restated as Given/When/Then. Where the two disagree, the use case is normative.

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

Story `US-<DOMAIN>-<nn>` corresponds to use case `UC-<DOMAIN>-<nn>` by construction (§2), so the per-story listing — id, title, actor, priority — is not repeated here. It is in [`../use-cases/README.md`](../use-cases/README.md) §4, which carries the same rows against their
`UC-` identifiers.


# Use Case Specification — Enterprise Commerce Platform (ECP)

**Document type:** Use Case Specification (index)
**Related documents:** [`../srs.md`](../srs.md) (Software Requirements Specification) · [`../general-approach.md`](../general-approach.md) (Business Problem Analysis) · [`../traceability-matrix.md`](../traceability-matrix.md)
**Audience:** Product Management, Engineering, Quality Assurance, Solution Architecture
**Version:** 1.0
**Status:** Draft for stakeholder review

Every numbered file in this folder is a **Use Case Specification — domain** for the audience above; the per-file headers carry only what differs between them.

---

## 1. Purpose of This Document

The exception flows are the point. `FR-ORD-08` can say that placing an order and reserving stock must be atomic in a single line; it takes a use case to say what the customer sees when the reservation succeeds and the payment does not, what happens to the reserved units, and how long they stay reserved. **P5** through **P8** — inconsistent rule enforcement, lost business events, partial failure in money-critical flows, and overselling under concentrated demand — are business problems until they are written as exception flows, at which point they become test cases.

Every use case here is specified in full. There is no abbreviated tier: a use case with no documented exception flow is a use case whose failure behaviour nobody has decided, and deciding it later, under delivery pressure, is how P5 and P7 happen.

---

## 2. Actors

Actor definitions are normative in [`../srs.md`](../srs.md) §2.3 and are not reproduced here — a second copy is a second thing to drift, and this one had already drifted before it was removed.

![Actors and system boundary](../diagrams/system-context.svg)

### 2.1 Role Authority

See [`../srs.md`](../srs.md) §2.3 for the normative role × domain authority table. `UC-AUD-03` specifies how it is enforced, and `BR-AUD-02` requires that the same decision is reached whatever entry point a request arrives through.

---

## 3. How to Read a Use Case

Every use case in this specification uses the following structure.

| Field | Meaning |
|---|---|
| **Primary actor** | The actor whose goal the use case serves |
| **Supporting actors** | Other actors and external providers the platform calls upon |
| **Stakeholders & interests** | Who cares about the outcome and what they need from it |
| **Priority** | MoSCoW, inherited from the requirements realised |
| **Trigger** | The event that starts the use case |
| **Preconditions** | What must already be true; the use case is not attempted otherwise |
| **Success postconditions** | What is true once it completes successfully |
| **Failure postconditions** | What is true if it does not — stated explicitly, because "nothing happened" is a claim that must be verified, not assumed |
| **Frequency** | How often it occurs, which informs the performance targets that apply |
| **Traceability** | The `FR`/`BR`/`NFR` identifiers realised, and the `P` business problems addressed |

Followed by:

- **Main success scenario** — numbered steps, the path where everything works.
- **Alternate flows** (`A1`, `A2`, …) — valid variations that still reach the goal, each anchored to the step it branches from.
- **Exception flows** (`E1`, `E2`, …) — paths where the goal is not reached, each stating what the actor is told and what state the system is left in.
- **Business rules applied** — the rules from [`../srs.md`](../srs.md) §4 that constrain this use case.
- **Assumptions & open questions** — where present, what remains to be confirmed.


A field with no value is omitted rather than printed with an em-dash: an absent
**Supporting actors** row means none, and an absent **Preconditions** row means none.

---

## 4. Use Case Inventory

**87 use cases across 14 domains.**

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

| ID | Use Case | Primary Actor | Priority | Realises |
|---|---|---|---|---|
| `UC-CUS-01` | Register Customer Account | Guest | Must | `FR-CUS-01` |
| `UC-CUS-02` | Verify Email Address | Guest | Must | `FR-CUS-02` |
| `UC-CUS-03` | Log In | Guest | Must | `FR-CUS-03` |
| `UC-CUS-04` | Log Out | Customer | Must | `FR-CUS-04` |
| `UC-CUS-05` | Refresh Authenticated Session | Customer | Must | `FR-CUS-05` |
| `UC-CUS-06` | Change Password | Customer | Must | `FR-CUS-06` |
| `UC-CUS-07` | Reset Forgotten Password | Guest | Must | `FR-CUS-07` |
| `UC-CUS-08` | Manage Profile | Customer | Must | `FR-CUS-08` |
| `UC-CUS-09` | Manage Shipping Addresses | Customer | Must | `FR-CUS-09` |
| `UC-CUS-10` | View Purchase History | Customer | Must | `FR-CUS-10` |

### 4.2 Product Catalog & Category

| ID | Use Case | Primary Actor | Priority | Realises |
|---|---|---|---|---|
| `UC-CAT-01` | Browse Category Tree | Guest | Must | `FR-CAT-05`, `FR-CAT-07` |
| `UC-CAT-02` | Browse Category Product Listing | Guest | Must | `FR-CAT-03`, `FR-CAT-08` |
| `UC-CAT-03` | View Product Details | Guest | Must | `FR-CAT-01`, `FR-CAT-04`, `FR-INV-07` |
| `UC-CAT-04` | Select Product Variant | Customer | Must | `FR-CAT-02` |
| `UC-CAT-05` | View Featured Categories | Guest | Should | `FR-CAT-06` |

### 4.3 Search & Recommendation

| ID | Use Case | Primary Actor | Priority | Realises |
|---|---|---|---|---|
| `UC-SCH-01` | Search Products by Keyword | Guest | Must | `FR-SCH-01` |
| `UC-SCH-02` | Receive Search Suggestions and Auto-complete | Guest | Should | `FR-SCH-02` |
| `UC-SCH-03` | Filter and Sort Search Results | Guest | Must | `FR-SCH-03`, `FR-SCH-04` |
| `UC-SCH-04` | View Popular and Recent Keywords | Guest | Could | `FR-SCH-05`, `FR-SCH-06` |
| `UC-SCH-05` | View Related and Frequently Bought Together Products | Guest | Should | `FR-SCH-07`, `FR-SCH-08` |
| `UC-SCH-06` | View Trending Products and New Arrivals | Guest | Could | `FR-SCH-09`, `FR-SCH-10` |
| `UC-SCH-07` | Receive Personalised Recommendations | Customer | Could | `FR-SCH-11` |

### 4.4 Inventory

| ID | Use Case | Primary Actor | Priority | Realises |
|---|---|---|---|---|
| `UC-INV-01` | Reserve Stock for an Order | Checkout & Order (internal) | Must | `FR-INV-02` |
| `UC-INV-02` | Release Reserved Stock | Checkout & Order (internal) | Must | `FR-INV-03` |
| `UC-INV-03` | Commit Reserved Stock on Fulfilment | Warehouse Operator | Must | `FR-INV-04` |
| `UC-INV-04` | Adjust Inventory | Warehouse Operator | Must | `FR-INV-05` |
| `UC-INV-05` | View Inventory Levels | Warehouse Operator | Must | `FR-INV-01`, `FR-INV-06` |

### 4.5 Cart & Wishlist

| ID | Use Case | Primary Actor | Priority | Realises |
|---|---|---|---|---|
| `UC-CRT-01` | Add Item to Cart | Guest | Must | `FR-CRT-01`, `FR-CRT-05` |
| `UC-CRT-02` | Update Cart Item Quantity | Guest | Must | `FR-CRT-02` |
| `UC-CRT-03` | Remove Item from Cart | Guest | Must | `FR-CRT-03` |
| `UC-CRT-04` | View Cart | Guest | Must | `FR-CRT-04`, `FR-CRT-08` |
| `UC-CRT-05` | Merge Guest Cart on Login | Customer | Must | `FR-CRT-06` |
| `UC-CRT-06` | Expire Inactive Cart | Scheduler | Must | `FR-CRT-07` |
| `UC-CRT-07` | Manage Wishlist | Customer | Should | `FR-CRT-09` |
| `UC-CRT-08` | Move Wishlist Item to Cart | Customer | Should | `FR-CRT-10` |

### 4.6 Checkout & Order

| ID | Use Case | Primary Actor | Priority | Realises |
|---|---|---|---|---|
| `UC-ORD-01` | Initiate Checkout | Customer | Must | `FR-ORD-01` |
| `UC-ORD-02` | Provide Shipping and Billing Information | Customer | Must | `FR-ORD-02`, `FR-ORD-03`, `FR-ORD-04` |
| `UC-ORD-03` | Apply Voucher at Checkout | Customer | Must | `FR-ORD-05` |
| `UC-ORD-04` | Review Order Summary | Customer | Must | `FR-ORD-06`, `FR-ORD-07` |
| `UC-ORD-05` | Place Order | Customer | Must | `FR-ORD-08`, `FR-ORD-09` |
| `UC-ORD-06` | View Order Details | Customer | Must | `FR-ORD-12` |
| `UC-ORD-07` | Track Order | Customer | Must | `FR-ORD-13` |
| `UC-ORD-08` | Cancel Order | Customer | Must | `FR-ORD-14` |
| `UC-ORD-09` | Request Return | Customer | Should | `FR-ORD-15` |
| `UC-ORD-10` | Advance Order Status | Staff | Must | `FR-ORD-10`, `FR-ORD-11`, `FR-ORD-16` |

### 4.7 Payment

| ID | Use Case | Primary Actor | Priority | Realises |
|---|---|---|---|---|
| `UC-PAY-01` | Select Payment Method | Customer | Must | `FR-PAY-01`, `FR-PAY-02` |
| `UC-PAY-02` | Authorise Online Payment | Customer | Must | `FR-PAY-03`, `FR-PAY-09` |
| `UC-PAY-03` | Handle Payment Gateway Result | Payment Gateway | Must | `FR-PAY-04`, `FR-PAY-05` |
| `UC-PAY-04` | Settle Cash On Delivery Payment | Warehouse Operator | Must | `FR-PAY-07` |
| `UC-PAY-05` | Retry Failed Payment | Customer | Must | `FR-PAY-06` |
| `UC-PAY-06` | Process Refund | Customer Support Agent | Must | `FR-PAY-08` |

### 4.8 Shipping

| ID | Use Case | Primary Actor | Priority | Realises |
|---|---|---|---|---|
| `UC-SHP-01` | Calculate Shipping Fee | Customer | Must | `FR-SHP-02` |
| `UC-SHP-02` | Estimate Delivery Date | Customer | Should | `FR-SHP-03` |
| `UC-SHP-03` | Create Shipment | Warehouse Operator | Must | `FR-SHP-01`, `FR-SHP-04` |
| `UC-SHP-04` | Record Carrier Tracking Update | Shipping Carrier | Must | `FR-SHP-05` |
| `UC-SHP-05` | View Shipment Tracking | Customer | Must | `FR-SHP-06` |
| `UC-SHP-06` | Confirm Delivery | Shipping Carrier | Must | `FR-SHP-07` |

### 4.9 Promotion

| ID | Use Case | Primary Actor | Priority | Realises |
|---|---|---|---|---|
| `UC-PRM-01` | Create Promotion | Staff | Must | `FR-PRM-01`, `FR-PRM-07`, `FR-ADM-06` |
| `UC-PRM-02` | Validate Voucher Code | Customer | Must | `FR-PRM-08` |
| `UC-PRM-03` | Apply Promotion to Order | Customer | Must | `FR-PRM-02`–`FR-PRM-05`, `FR-PRM-09` |
| `UC-PRM-04` | Launch Flash Sale | Administrator | Must | `FR-PRM-06` |
| `UC-PRM-05` | Deactivate or Expire Promotion | Administrator | Must | `FR-PRM-10` |

### 4.10 Review

| ID | Use Case | Primary Actor | Priority | Realises |
|---|---|---|---|---|
| `UC-REV-01` | Submit Product Review | Customer | Must | `FR-REV-01`, `FR-REV-02`, `FR-REV-03`, `FR-REV-06` |
| `UC-REV-02` | Edit Own Review | Customer | Should | `FR-REV-04` |
| `UC-REV-03` | Delete Own Review | Customer | Should | `FR-REV-05` |
| `UC-REV-04` | View Product Reviews | Guest | Must | `FR-REV-07` |
| `UC-REV-05` | Moderate Review | Customer Support Agent | Should | `FR-REV-08`, `FR-ADM-07` |

### 4.11 Notification

| ID | Use Case | Primary Actor | Priority | Realises |
|---|---|---|---|---|
| `UC-NTF-01` | Deliver Email Notification | Business event (internal) | Must | `FR-NTF-01`, `FR-NTF-03`, `FR-NTF-06` |
| `UC-NTF-02` | Deliver In-App Notification | Business event (internal) | Must | `FR-NTF-02`, `FR-NTF-03` |
| `UC-NTF-03` | View In-App Notifications | Customer | Must | `FR-NTF-04` |
| `UC-NTF-04` | Manage Notification Preferences | Customer | Should | `FR-NTF-05` |

### 4.12 Administration

| ID | Use Case | Primary Actor | Priority | Realises |
|---|---|---|---|---|
| `UC-ADM-01` | Manage Products | Staff | Must | `FR-ADM-01` |
| `UC-ADM-02` | Manage Categories | Staff | Must | `FR-ADM-02` |
| `UC-ADM-03` | Manage Customer Accounts | Customer Support Agent | Must | `FR-ADM-03` |
| `UC-ADM-04` | Manage Orders | Staff | Must | `FR-ADM-04` |
| `UC-ADM-05` | Manage Inventory Adjustments | Warehouse Operator | Must | `FR-ADM-05` |
| `UC-ADM-06` | Manage User Roles | Administrator | Must | `FR-ADM-09` |

### 4.13 Reporting & Analytics

| ID | Use Case | Primary Actor | Priority | Realises |
|---|---|---|---|---|
| `UC-RPT-01` | View Revenue Report | Administrator | Must | `FR-RPT-01`, `FR-RPT-02`, `FR-ADM-08` |
| `UC-RPT-02` | View Product Performance Report | Staff | Must | `FR-RPT-03`, `FR-RPT-05` |
| `UC-RPT-03` | View Customer Report | Administrator | Should | `FR-RPT-04`, `FR-RPT-07` |
| `UC-RPT-04` | View Inventory Report | Warehouse Operator | Must | `FR-RPT-06` |
| `UC-RPT-05` | View Order and Conversion Statistics | Staff | Must | `FR-RPT-08`, `FR-RPT-09` |
| `UC-RPT-06` | Export Report | Administrator | Could | `FR-RPT-10` |

### 4.14 Audit & Access Control

| ID | Use Case | Primary Actor | Priority | Realises |
|---|---|---|---|---|
| `UC-AUD-01` | Record Audit Entry | Any authorised actor (internal) | Must | `FR-AUD-01`, `FR-AUD-02`, `FR-AUD-03` |
| `UC-AUD-02` | Search Audit Trail | Administrator | Must | `FR-AUD-04` |
| `UC-AUD-03` | Authorise Request via RBAC | Any authenticated actor | Must | `FR-AUD-05`, `FR-AUD-06`, `FR-AUD-08` |
| `UC-AUD-04` | Enforce API Rate Limit | Any caller | Must | `FR-AUD-07` |

---

## 5. Cross-Cutting Use Cases

`UC-AUD-01`, `UC-AUD-03`, and `UC-AUD-04` are exercised by nearly every other use case and are
not repeated in each. Which use cases include them, and on what trigger, is specified where the three are specified: [`14-audit-access-control.md`](./14-audit-access-control.md).

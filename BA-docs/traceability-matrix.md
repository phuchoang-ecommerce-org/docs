# Traceability Matrix — Enterprise Commerce Platform (ECP)

**Document type:** Traceability Matrix
**Related documents:** [`general-approach.md`](./general-approach.md) (business problems P1–P17) · [`srs.md`](./srs.md) (requirements) · [`use-cases/README.md`](./use-cases/README.md) (use cases) · [Solution Architecture](../SA-docs/general-approach.md)
**Audience:** Product Management, Engineering, Quality Assurance, Solution Architecture
**Version:** 1.0
**Status:** Draft for stakeholder review

---

## 1. Purpose of This Document

The business analysis documents form a chain, and each link is only useful if it can be followed in both directions:

**Business problem (`P1`–`P17`) → Requirement (`FR` / `NFR` / `BR`) → Use case (`UC`) → Architecture decision and technology**

Read forward, the chain answers *"we identified this problem — what are we actually building about it?"* Read backward, it answers the harder question: *"why does this exist, and what happens to the business if we cut it?"* A requirement that cannot be traced backward to a problem is scope that entered without justification, and is a candidate for removal rather than delivery.

This document carries the middle of that chain. It also functions as a **coverage check** (§6), and the three gaps it looks for each mean something specific:

| Gap | What it means |
|---|---|
| A business problem with no requirement | The problem was catalogued and then not addressed |
| A requirement with no use case | Nobody has worked out how the requirement is exercised, so nobody can test it |
| A use case with no requirement | Behaviour was specified that no stated requirement asked for |

---

## 2. Business Problem → Requirement

Each of the seventeen problems in [`general-approach.md`](./general-approach.md) maps to the requirements that address it. The **Primary vehicle** column names where the weight of the answer sits, since a problem is rarely answered by functional requirements alone — several of these are answered almost entirely by non-functional requirements and constraints, which is exactly why those sections of the SRS carry the emphasis they do.

| Problem | Requirements | Primary vehicle |
|---|---|---|
| **P1** Domain complexity threatens delivery speed | `NFR-MAINT-01`, `NFR-MAINT-02`, `CON-01`, `CON-02` | Maintainability |
| **P2** New capabilities risk destabilising the core | `NFR-MAINT-04`, `NFR-REL-06`, `CON-07`; `FR-NTF-03`, `FR-SCH-11` | Maintainability + events |
| **P3** Vendor coupling increases switching cost | `NFR-MAINT-03`, `NFR-AVAIL-03`, `CON-03`; `FR-PAY-09`, `FR-SHP-01` | Maintainability + abstraction |
| **P4** Undifferentiated data freshness limits scale | `NFR-PERF-06`, `NFR-SCAL-05`, `CON-04`, `CON-06`; assumption **A-11** | Performance + scalability |
| **P5** Inconsistent rule enforcement enables abuse | **All of §4 Business Rules**; `NFR-SEC-01`, `FR-AUD-06`, `FR-ORD-11`, `FR-REV-06`, `BR-AUD-02` | Business rules |
| **P6** Business events can be silently lost | `NFR-REL-05`, `NFR-REL-06`, `BR-NTF-01`; `FR-NTF-06`, `FR-PAY-05` | Reliability |
| **P7** Partial failures in money-critical flows | `NFR-REL-01`, `NFR-REL-02`, `NFR-REL-04`; `BR-ORD-02`, `BR-ORD-03`, `BR-INV-02`, `BR-PAY-01`, `BR-PAY-02`; `FR-ORD-08`, `FR-ORD-09` | Reliability + business rules |
| **P8** Overselling under concentrated demand | `NFR-REL-03`, `NFR-SCAL-06`; `BR-INV-01`, `BR-CRT-02`; `FR-INV-02`, `FR-ORD-06` | Reliability + inventory rules |
| **P9** Peak events are also peak-risk moments | `NFR-SCAL-04`, `NFR-SCAL-06`, `NFR-AVAIL-01`, `NFR-AVAIL-02`, `NFR-PERF-01`–`NFR-PERF-03` | Scalability + availability |
| **P10** Growth outpacing performance and cost | `NFR-SCAL-01`, `NFR-SCAL-02`, `NFR-SCAL-03`, `NFR-SCAL-07`, `NFR-PERF-01`–`NFR-PERF-04` | Scalability + performance |
| **P11** Poor product discovery loses sales | `FR-SCH-01`–`FR-SCH-11`, `FR-CAT-03`–`FR-CAT-08`; `NFR-PERF-03`, `NFR-PERF-04` | Functional (search, catalog) |
| **P12** Transactions and browsing have conflicting needs | `NFR-SCAL-05`, `NFR-PERF-01`, `NFR-PERF-02`, `CON-04`, `CON-05` | Scalability + performance |
| **P13** Reporting competing with transactions | `NFR-PERF-05`, `NFR-PERF-06`, `CON-06`; `FR-RPT-01`–`FR-RPT-10`, `BR-RPT-01` | Performance isolation |
| **P14** Teams blocking each other as the organisation grows | `NFR-MAINT-01`, `NFR-MAINT-02`, `NFR-MAINT-06`, `CON-01`, `CON-08` | Maintainability |
| **P15** Architecture erosion over time | `NFR-MAINT-05`, `NFR-MAINT-01`, `NFR-MAINT-03` | Automated structural enforcement |
| **P16** Unauthorised access to sensitive operations | `FR-AUD-05`, `FR-AUD-06`, `FR-AUD-07`, `FR-AUD-08`; `NFR-SEC-01`–`NFR-SEC-07`; `BR-AUD-02`, `BR-AUD-03`, `BR-SCH-01` | Security |
| **P17** Inability to trace significant actions | `FR-AUD-01`–`FR-AUD-04`; `NFR-OBS-01`, `NFR-OBS-02`; `BR-AUD-01`, `BR-INV-03`, `FR-DAT-05` | Audit |

**Note on P5.** It maps to *all* of [`srs.md`](./srs.md) §4 rather than to a list, and this is deliberate. P5 is not a problem solved by particular rules; it is a problem about **where** every rule is enforced. Each rule in §4 therefore names an enforcement point, and each is inside the platform rather than in a client.

---

## 3. Requirement → Use Case

Generated from the **UC** column of [`srs.md`](./srs.md) §3, so it cannot drift from the source. Non-functional requirements are not listed here — they are cross-cutting and are traced in §2 and §5 instead.


### Customer & Identity (`CUS`)

| Requirement | Statement | Priority | Realised by |
|---|---|---|---|
| `FR-CUS-01` | Allows a visitor to register a customer account using an email address and a password. | Must | `UC-CUS-01` |
| `FR-CUS-02` | Verifies ownership of a registered email address by sending a single-use, time-limited… | Must | `UC-CUS-02` |
| `FR-CUS-03` | Authenticates a customer against their credentials and issues an access token and a refresh… | Must | `UC-CUS-03` |
| `FR-CUS-04` | Ends a customer's session on request and invalidates the associated refresh token. | Must | `UC-CUS-04` |
| `FR-CUS-05` | Issues a new access token in exchange for a valid, unexpired, unused refresh token. | Must | `UC-CUS-05` |
| `FR-CUS-06` | Allows an authenticated customer to change their password after re-confirming the current one. | Must | `UC-CUS-06` |
| `FR-CUS-07` | Allows a customer who cannot authenticate to set a new password by means of a single-use,… | Must | `UC-CUS-07` |
| `FR-CUS-08` | Allows a customer to view and update their profile. | Must | `UC-CUS-08` |
| `FR-CUS-09` | Allows a customer to hold multiple shipping addresses, to add, amend, and remove them, and… | Must | `UC-CUS-09` |
| `FR-CUS-10` | Presents a customer with the history of their orders, in reverse chronological order, with… | Must | `UC-CUS-10` |

### Product Catalog & Category (`CAT`)

| Requirement | Statement | Priority | Realised by |
|---|---|---|---|
| `FR-CAT-01` | Records for each product: SKU, name, description, images, categories, brand, variants,… | Must | `UC-CAT-03` |
| `FR-CAT-02` | Supports product variants, each carrying its own SKU, price, attribute values, and… | Must | `UC-CAT-04` |
| `FR-CAT-03` | Presents the products belonging to a category, paginated, with each product's price and… | Must | `UC-CAT-02` |
| `FR-CAT-04` | Presents the full detail of a single product, including its variants, images, attributes,… | Must | `UC-CAT-03` |
| `FR-CAT-05` | Supports categories nested to arbitrary depth and presents them as a navigable tree. | Must | `UC-CAT-01` |
| `FR-CAT-06` | Allows categories to be designated as featured and presents them as a distinct collection. | Should | `UC-CAT-05` |
| `FR-CAT-07` | Associates an image with a category and presents it wherever the category is displayed. | Should | `UC-CAT-01` |
| `FR-CAT-08` | Allows a product listing to be sorted by at least price, newest, and popularity. | Must | `UC-CAT-02` |

### Search & Recommendation (`SCH`)

| Requirement | Statement | Priority | Realised by |
|---|---|---|---|
| `FR-SCH-01` | Returns products matching a free-text keyword query across at least product name,… | Must | `UC-SCH-01` |
| `FR-SCH-02` | Offers completions and suggestions as a query is being typed. | Should | `UC-SCH-02` |
| `FR-SCH-03` | Allows search results to be narrowed by category, brand, price range, attribute values, and… | Must | `UC-SCH-03` |
| `FR-SCH-04` | Orders search results by relevance to the query by default, and allows the customer to… | Must | `UC-SCH-03` |
| `FR-SCH-05` | Presents the keywords most frequently searched across the platform. | Could | `UC-SCH-04` |
| `FR-SCH-06` | Presents an individual customer with their own recently searched keywords. | Could | `UC-SCH-04` |
| `FR-SCH-07` | Presents products related to the product being viewed. | Should | `UC-SCH-05` |
| `FR-SCH-08` | Presents products frequently purchased together with the product being viewed. | Should | `UC-SCH-05` |
| `FR-SCH-09` | Presents products currently trending by recent sales or view volume. | Could | `UC-SCH-06` |
| `FR-SCH-10` | Presents recently added products as new arrivals. | Could | `UC-SCH-06` |
| `FR-SCH-11` | Presents an authenticated customer with recommendations derived from their own browsing and… | Could | `UC-SCH-07` |

### Inventory (`INV`)

| Requirement | Statement | Priority | Realised by |
|---|---|---|---|
| `FR-INV-01` | Tracks, per SKU and per warehouse, the stock quantity, the reserved stock, and the… | Must | `UC-INV-05` |
| `FR-INV-02` | Reserves stock for each line of an order at the moment the order is placed, and refuses the… | Must | `UC-INV-01` |
| `FR-INV-03` | Releases a reservation, returning the units to available stock, when the order it belongs… | Must | `UC-INV-02` |
| `FR-INV-04` | Commits a reservation, reducing stock quantity and clearing the reservation, when the order… | Must | `UC-INV-03` |
| `FR-INV-05` | Records an inventory adjustment against a SKU and warehouse, capturing the quantity delta,… | Must | `UC-INV-04` |
| `FR-INV-06` | Presents current stock, reserved, and available quantities per SKU and warehouse to… | Must | `UC-INV-05` |
| `FR-INV-07` | Reflects a SKU's availability in the catalog and in search results. | Must | `UC-CAT-03` |

### Cart & Wishlist (`CRT`)

| Requirement | Statement | Priority | Realised by |
|---|---|---|---|
| `FR-CRT-01` | Adds a specified quantity of a product variant to the acting party's cart, combining it… | Must | `UC-CRT-01` |
| `FR-CRT-02` | Changes the quantity of an existing cart line. | Must | `UC-CRT-02` |
| `FR-CRT-03` | Removes a line from the cart. | Must | `UC-CRT-03` |
| `FR-CRT-04` | Persists an authenticated customer's cart across sessions and devices. | Must | `UC-CRT-04` |
| `FR-CRT-05` | Maintains a cart for an unauthenticated guest for the duration of their visit. | Must | `UC-CRT-01` |
| `FR-CRT-06` | On successful login, the platform merges the guest cart into the customer's stored cart,… | Must | `UC-CRT-05` |
| `FR-CRT-07` | Expires a cart after a configurable period of inactivity, and the configured period is… | Must | `UC-CRT-06` |
| `FR-CRT-08` | Prices the cart at the products' current prices whenever it is displayed, and identifies to… | Must | `UC-CRT-04` |
| `FR-CRT-09` | Allows a customer to save a product to a wishlist and to remove it. | Should | `UC-CRT-07` |
| `FR-CRT-10` | Moves a wishlist item into the cart, removing it from the wishlist on success. | Should | `UC-CRT-08` |

### Checkout & Order (`ORD`)

| Requirement | Statement | Priority | Realised by |
|---|---|---|---|
| `FR-ORD-01` | Begins a checkout from the customer's cart, refusing to begin if the cart is empty or if no… | Must | `UC-ORD-01` |
| `FR-ORD-02` | Captures shipping information for the order, offering the customer's stored addresses and… | Must | `UC-ORD-02` |
| `FR-ORD-03` | Captures billing information for the order, allowing it to differ from the shipping… | Must | `UC-ORD-02` |
| `FR-ORD-04` | Calculates the shipping fee for the order from its contents and destination, and… | Must | `UC-ORD-02` |
| `FR-ORD-05` | Validates any voucher presented at checkout and reports the reason when it is rejected. | Must | `UC-ORD-03` |
| `FR-ORD-06` | Validates that every line of the order is available in the requested quantity before the… | Must | `UC-ORD-04` |
| `FR-ORD-07` | Presents a complete order summary — line items, unit and line prices, discounts, shipping… | Must | `UC-ORD-04` |
| `FR-ORD-08` | On confirmation, the platform creates the order and reserves stock for every line as a… | Must | `UC-ORD-05` |
| `FR-ORD-09` | Treats repeated submissions of the same confirmed checkout as one order, and never creates… | Must | `UC-ORD-05` |
| `FR-ORD-10` | Maintains each order in exactly one of the states Draft, Pending Payment, Paid, Processing,… | Must | `UC-ORD-10` |
| `FR-ORD-11` | Permits only the state transitions defined in §5.3 and rejects every other transition,… | Must | `UC-ORD-10` |
| `FR-ORD-12` | Presents the full detail of an order to its owning customer, and to Support and… | Must | `UC-ORD-06` |
| `FR-ORD-13` | Presents the current state of an order and its shipment tracking information to the owning… | Must | `UC-ORD-07` |
| `FR-ORD-14` | Cancels an order on request when its current state permits cancellation, releasing its… | Must | `UC-ORD-08` |
| `FR-ORD-15` | Accepts a return request against a delivered order within the return window, and… | Should | `UC-ORD-09` |
| `FR-ORD-16` | Allows Staff and Warehouse Operators to advance an order to its next permitted state,… | Must | `UC-ORD-10` |

### Payment (`PAY`)

| Requirement | Statement | Priority | Realised by |
|---|---|---|---|
| `FR-PAY-01` | Supports payment by Cash On Delivery, credit card, digital wallet, and bank transfer. | Must | `UC-PAY-01` |
| `FR-PAY-02` | Allows the customer to select one payment method per order at checkout, offering only… | Must | `UC-PAY-01` |
| `FR-PAY-03` | Requests authorisation and capture from the external payment provider for online payment… | Must | `UC-PAY-02` |
| `FR-PAY-04` | Records against the order the payment method, amount, provider reference, outcome, and time… | Must | `UC-PAY-03` |
| `FR-PAY-05` | Accepts asynchronous result notifications from the payment provider and applies each one at… | Must | `UC-PAY-03` |
| `FR-PAY-06` | Allows a customer to retry payment for an order in state Payment Failed within a… | Must | `UC-PAY-05` |
| `FR-PAY-07` | Settles a Cash On Delivery payment on confirmation of delivery and payment collection. | Must | `UC-PAY-04` |
| `FR-PAY-08` | Issues a full or partial refund against a captured payment, records it against the order,… | Must | `UC-PAY-06` |
| `FR-PAY-09` | Expresses payment operations independently of any particular provider, so that a provider… | Must | `UC-PAY-02` |

### Shipping (`SHP`)

| Requirement | Statement | Priority | Realised by |
|---|---|---|---|
| `FR-SHP-01` | Supports more than one shipping provider and selects among them per shipment. | Must | `UC-SHP-03` |
| `FR-SHP-02` | Calculates a shipping fee from the shipment's contents, destination, and selected provider. | Must | `UC-SHP-01` |
| `FR-SHP-03` | Estimates a delivery date for a destination and provider, and presents it before the order… | Should | `UC-SHP-02` |
| `FR-SHP-04` | Creates a shipment for a packed order, dispatches it to the selected carrier, and records… | Must | `UC-SHP-03` |
| `FR-SHP-05` | Records tracking updates received from a carrier against the corresponding shipment,… | Must | `UC-SHP-04` |
| `FR-SHP-06` | Presents shipment tracking history to the owning customer, to Support, and to Administrators. | Must | `UC-SHP-05` |
| `FR-SHP-07` | Transitions an order to Delivered on confirmation of delivery from the carrier or a… | Must | `UC-SHP-06` |

### Promotion (`PRM`)

| Requirement | Statement | Priority | Realised by |
|---|---|---|---|
| `FR-PRM-01` | Supports promotions redeemed by a coupon or voucher code, and promotions applied… | Must | `UC-PRM-01` |
| `FR-PRM-02` | Supports discount by percentage of order or line value. | Must | `UC-PRM-03` |
| `FR-PRM-03` | Supports discount by fixed amount. | Must | `UC-PRM-03` |
| `FR-PRM-04` | Supports a promotion that waives the shipping fee. | Must | `UC-PRM-03` |
| `FR-PRM-05` | Supports a promotion that grants specified items when specified items are purchased. | Should | `UC-PRM-03` |
| `FR-PRM-06` | Supports a flash sale that becomes active and inactive at configured times without manual… | Must | `UC-PRM-04` |
| `FR-PRM-07` | Allows a promotion's eligibility conditions, discount, validity period, total usage limit,… | Must | `UC-PRM-01` |
| `FR-PRM-08` | Validates a voucher against every configured condition at the moment it is applied and… | Must | `UC-PRM-02` |
| `FR-PRM-09` | Records against the order every promotion applied and the discount each contributed. | Must | `UC-PRM-03` |
| `FR-PRM-10` | Activates, deactivates, and expires promotions, and immediately stops applying a promotion… | Must | `UC-PRM-05` |

### Review (`REV`)

| Requirement | Statement | Priority | Realised by |
|---|---|---|---|
| `FR-REV-01` | Accepts a numeric rating from a customer against a product. | Must | `UC-REV-01` |
| `FR-REV-02` | Accepts review text alongside a rating. | Must | `UC-REV-01` |
| `FR-REV-03` | Accepts images attached to a review. | Should | `UC-REV-01` |
| `FR-REV-04` | Allows a customer to amend their own review within the configured edit window. | Should | `UC-REV-02` |
| `FR-REV-05` | Allows a customer to delete their own review. | Should | `UC-REV-03` |
| `FR-REV-06` | Accepts a review of a product only from a customer who has an order in state Delivered or… | Must | `UC-REV-01` |
| `FR-REV-07` | Presents a product's reviews and its aggregate rating to any visitor. | Must | `UC-REV-04` |
| `FR-REV-08` | Allows Staff, Support, and Administrators to hide or remove a review that breaches policy,… | Should | `UC-REV-05` |

### Notification (`NTF`)

| Requirement | Statement | Priority | Realised by |
|---|---|---|---|
| `FR-NTF-01` | Delivers notifications by email. | Must | `UC-NTF-01` |
| `FR-NTF-02` | Delivers notifications in-app to an authenticated customer. | Must | `UC-NTF-02` |
| `FR-NTF-03` | Raises a notification on each of the following business events: order created, payment… | Must | `UC-NTF-01` · `UC-NTF-02` |
| `FR-NTF-04` | Presents a customer with their in-app notifications and allows them to be marked as read. | Must | `UC-NTF-03` |
| `FR-NTF-05` | Allows a customer to opt out of promotional notifications per channel, and does not allow… | Should | `UC-NTF-04` |
| `FR-NTF-06` | Records the delivery outcome of every notification and retries a transient failure, marking… | Must | `UC-NTF-01` |

### Administration (`ADM`)

| Requirement | Statement | Priority | Realised by |
|---|---|---|---|
| `FR-ADM-01` | Allows authorised users to create, amend, publish, unpublish, and price products and their… | Must | `UC-ADM-01` |
| `FR-ADM-02` | Allows authorised users to create, amend, move, and remove categories within the tree. | Must | `UC-ADM-02` |
| `FR-ADM-03` | Allows authorised users to view, suspend, and reinstate customer accounts. | Must | `UC-ADM-03` |
| `FR-ADM-04` | Allows authorised users to search orders, inspect them, and act on them within the limits… | Must | `UC-ADM-04` |
| `FR-ADM-05` | Allows authorised users to record inventory adjustments and to review the adjustment… | Must | `UC-ADM-05` |
| `FR-ADM-06` | Allows authorised users to create and manage promotions. | Must | `UC-PRM-01` |
| `FR-ADM-07` | Allows authorised users to moderate reviews. | Should | `UC-REV-05` |
| `FR-ADM-08` | Allows authorised users to access the reports specified in §3.13. | Must | `UC-RPT-01` |
| `FR-ADM-09` | Allows an Administrator to assign and revoke the roles held by a user. | Must | `UC-ADM-06` |

### Reporting & Analytics (`RPT`)

| Requirement | Statement | Priority | Realised by |
|---|---|---|---|
| `FR-RPT-01` | Reports revenue by day. | Must | `UC-RPT-01` |
| `FR-RPT-02` | Reports revenue by month. | Must | `UC-RPT-01` |
| `FR-RPT-03` | Reports the best-selling products over a selected period. | Must | `UC-RPT-02` |
| `FR-RPT-04` | Reports the customers with the highest purchase value over a selected period. | Should | `UC-RPT-03` |
| `FR-RPT-05` | Reports per-product performance: views, orders, revenue, returns, and average rating. | Should | `UC-RPT-02` |
| `FR-RPT-06` | Reports stock position, stock movement, and low-stock exposure by SKU and warehouse. | Must | `UC-RPT-04` |
| `FR-RPT-07` | Reports registration and first-purchase volume over time. | Should | `UC-RPT-03` |
| `FR-RPT-08` | Reports order counts by state, average order value, and cancellation and return rates. | Must | `UC-RPT-05` |
| `FR-RPT-09` | Reports the proportion of sessions that result in a placed order. | Should | `UC-RPT-05` |
| `FR-RPT-10` | Exports any report in a machine-readable form for offline analysis. | Could | `UC-RPT-06` |

### Audit & Access Control (`AUD`)

| Requirement | Statement | Priority | Realised by |
|---|---|---|---|
| `FR-AUD-01` | Records an audit entry for every significant business action, capturing the acting user,… | Must | `UC-AUD-01` |
| `FR-AUD-02` | Audits at minimum: product updated, price changed, inventory adjusted, order cancelled,… | Must | `UC-AUD-01` |
| `FR-AUD-03` | Stores audit entries append-only: once written, an entry can be neither amended nor deleted… | Must | `UC-AUD-01` |
| `FR-AUD-04` | Allows Support and Administrators to search the audit trail by actor, entity, action, and… | Must | `UC-AUD-02` |
| `FR-AUD-05` | Assigns each user one or more of the roles Customer, Staff, Warehouse, Customer Support,… | Must | `UC-AUD-03` |
| `FR-AUD-06` | Authorises every request against the acting user's roles before performing it, and reaches… | Must | `UC-AUD-03` |
| `FR-AUD-07` | Limits the rate at which a caller may issue requests and rejects requests beyond that limit… | Must | `UC-AUD-04` |
| `FR-AUD-08` | Validates every externally supplied input against its expected type, range, and format, and… | Must | `UC-AUD-03` |

### Cross-domain data requirements (`DAT`)

| Requirement | Statement | Traced to |
|---|---|---|
| `FR-DAT-01` | Monetary precision does not accumulate rounding error across line, discount, fee, and total | `UC-PRM-03` · P7 |
| `FR-DAT-02` | Timestamps are unambiguous as to time zone | `UC-AUD-01` · P17 |
| `FR-DAT-03` | Order line prices are those fixed at placement, not current prices | `UC-ORD-06`, `UC-RPT-02` · P7 |
| `FR-DAT-04` | Deleting a product, category, or customer never invalidates a historic order | `UC-ORD-06`, `UC-CUS-10`, `UC-RPT-02` · P17 |
| `FR-DAT-05` | Audit entries are retained for the period required to investigate or demonstrate compliance | `UC-AUD-01`, `UC-AUD-02` · P17 |

---

## 4. Business Rule → Use Case

A business rule is enforced wherever it is reachable, so this table names the use cases where each rule is **decided** rather than every use case it constrains.

| Rule | Statement | Enforced in |
|---|---|---|
| `BR-CUS-01` | One account per email address | `UC-CUS-01`, `UC-CUS-08` |
| `BR-CUS-02` | Unverified accounts may not order or review | `UC-CUS-03`, `UC-ORD-01`, `UC-REV-01` |
| `BR-CUS-03` | Tokens are single-use and time-limited | `UC-CUS-02`, `UC-CUS-05`, `UC-CUS-07`, `UC-NTF-04` |
| `BR-CUS-04` | No account-existence disclosure on failure | `UC-CUS-01`, `UC-CUS-03`, `UC-CUS-07` |
| `BR-CUS-05` | Exactly one default shipping address | `UC-CUS-09`, `UC-ORD-02` |
| `BR-CAT-01` | A SKU identifies at most one purchasable unit | `UC-CAT-04`, `UC-ADM-01` |
| `BR-CAT-02` | Unpublished products are not browsable, searchable, or addable | `UC-CAT-02`, `UC-SCH-01`, `UC-CRT-01`, `UC-ADM-01` |
| `BR-CAT-03` | No category is its own ancestor; no orphaning on removal | `UC-ADM-02` |
| `BR-SCH-01` | Search history and recommendations are scoped to their customer | `UC-SCH-04`, `UC-SCH-07` |
| **`BR-INV-01`** | **Available stock may never be negative** | `UC-INV-01`, `UC-INV-04`, `UC-ORD-05`, `UC-PRM-04` |
| **`BR-INV-02`** | **A reservation is resolved exactly once** | `UC-INV-01`, `UC-INV-02`, `UC-INV-03` |
| `BR-INV-03` | Adjustments require a reason and are audited | `UC-INV-04`, `UC-ADM-05` |
| `BR-CRT-01` | Cart expiry is configurable | `UC-CRT-06` |
| `BR-CRT-02` | Cart quantity may not exceed available stock | `UC-CRT-01`, `UC-CRT-02`, `UC-CRT-05` |
| `BR-CRT-03` | Cart merge never silently discards a line | `UC-CRT-05` |
| `BR-CRT-04` | A cart holds no price of its own | `UC-CRT-04`, `UC-ORD-04` |
| **`BR-ORD-01`** | **Only legal state transitions** | `UC-ORD-10`, `UC-ORD-08`, `UC-SHP-06`, `UC-ADM-04` |
| **`BR-ORD-02`** | **Order creation and stock reservation are indivisible** | `UC-ORD-05`, `UC-INV-01` |
| `BR-ORD-03` | Repeated submission yields one order | `UC-ORD-05` |
| `BR-ORD-04` | Cancellation only before Packed | `UC-ORD-08`, `UC-PAY-05` |
| `BR-ORD-05` | Return only from Delivered, within the window | `UC-ORD-09`, `UC-SHP-06` |
| `BR-ORD-06` | Order terms are fixed once Paid | `UC-ORD-04`, `UC-PAY-05`, `UC-ADM-04`, `UC-PRM-05` |
| `BR-PAY-01` | A provider result is applied at most once | `UC-PAY-02`, `UC-PAY-03`, `UC-PAY-06` |
| `BR-PAY-02` | Refunds never exceed the amount captured | `UC-PAY-06`, `UC-ORD-09` |
| `BR-PAY-03` | Cash On Delivery only where eligible | `UC-PAY-01`, `UC-PAY-04` |
| `BR-SHP-01` | The fee quoted at confirmation is the fee charged | `UC-SHP-01`, `UC-ORD-02`, `UC-ORD-04` |
| `BR-SHP-02` | A late update never moves a shipment backwards | `UC-SHP-04`, `UC-SHP-05` |
| `BR-PRM-01` | Every configured condition holds, at application and at placement | `UC-PRM-02`, `UC-PRM-04`, `UC-PRM-05`, `UC-ORD-03` |
| `BR-PRM-02` | Discount never exceeds discountable value; totals are never negative | `UC-PRM-03`, `UC-PRM-01` |
| `BR-PRM-03` | Stacking is deterministic | `UC-PRM-03` |
| **`BR-REV-01`** | **Only verified buyers may review** | `UC-REV-01` |
| `BR-REV-02` | One review per customer per product | `UC-REV-01`, `UC-REV-03` |
| `BR-REV-03` | Amendment within the edit window; thereafter moderators only | `UC-REV-02`, `UC-REV-05` |
| `BR-REV-04` | Review images validated against format and size | `UC-REV-01`, `UC-REV-02` |
| **`BR-NTF-01`** | **Delivered at least once, or recorded undeliverable** | `UC-NTF-01`, `UC-NTF-02` |
| `BR-NTF-02` | Transactional notifications cannot be opted out of | `UC-NTF-04`, `UC-NTF-01` |
| `BR-RPT-01` | Revenue counts Paid and beyond; refunds deducted in their own period | `UC-RPT-01`, `UC-RPT-02`, `UC-RPT-05` |
| **`BR-AUD-01`** | **Audit entries are append-only** | `UC-AUD-01`, `UC-AUD-02` |
| **`BR-AUD-02`** | **The same authorisation decision at every entry point** | `UC-AUD-03` — and every use case that includes it |
| `BR-AUD-03` | No self-elevation; the last Administrator cannot be removed | `UC-ADM-06`, `UC-AUD-03` |

---

## 5. Acceptance Criterion → Requirement → Verification

From [`srs.md`](./srs.md) §9. An acceptance criterion is met only when every requirement it names is met.

| Criterion | Requirements | Use cases | Verification |
|---|---|---|---|
| `AC-01` All core business workflows function correctly | Every `Must` requirement in §3 | Every `Must` use case, including alternate and exception flows | Functional test suite over all `Must` use cases |
| `AC-02` Business rules enforced consistently, whatever the entry point | All of §4; `NFR-SEC-01`; `BR-AUD-02` | `UC-AUD-03` and every use case including it | Each rule exercised through every entry point that can reach it, with identical outcome |
| `AC-03` New modules added with minimal modification | `NFR-MAINT-01`, `NFR-MAINT-02`, `NFR-MAINT-04`, `NFR-MAINT-06` | — (architectural) | Worked example: a capability reacting to an existing business event, requiring no change to checkout or payment |
| `AC-04` The system remains maintainable as complexity grows | `NFR-MAINT-01`–`NFR-MAINT-06` | — (architectural) | Structural constraints enforced by an automated check that fails the build on violation |
| `AC-05` Reporting does not significantly impact transactions | `NFR-PERF-05`, `NFR-PERF-06`, `NFR-SCAL-05` | `UC-RPT-01`–`UC-RPT-06` | Transactional latency targets hold with reporting under sustained concurrent load |
| `AC-06` Production-quality architecture suitable for enterprise use | §6.3 Reliability, §6.4 Security, §6.5 Availability, §6.7 Observability in full | `UC-ORD-05`, `UC-PAY-02`, `UC-PAY-03`, `UC-INV-01`, `UC-AUD-01`–`UC-AUD-04` | Peak-load, fault-injection, and authorisation suites pass; the audit trail withstands attempted modification by every role |

---

## 6. Coverage Summary

Checked mechanically against [`srs.md`](./srs.md) §3 and the fourteen use case files.

| Check | Result |
|---|---|
| Functional requirements defined (§3) | **129** |
| Cross-domain data requirements (§5.2) | **5** |
| Non-functional requirements (§6) | **39** |
| Constraints (§7) | **9** |
| Business rules (§4) | **40** |
| Use cases specified | **87** |
| Business problems `P1`–`P17` with at least one requirement | **17 / 17** — no gaps |
| Functional requirements with at least one use case | **129 / 129** — no gaps |
| Use cases named by at least one requirement | **87 / 87** — no orphans |
| `FR → UC` references pointing at a use case that does not exist | **0** |
| Acceptance criteria with at least one requirement | **6 / 6** |

**No coverage gaps.** Every catalogued business problem reaches at least one requirement, every functional requirement is exercised by at least one use case, and no use case specifies behaviour that no requirement asked for.

### Notes on the shape of the coverage

- **`P1`, `P14`, and `P15` map to no functional requirement at all**, and this is correct rather than a gap. They concern how the platform is structured and how that structure holds over time, which is why the SRS states them as `NFR-MAINT-*` and `CON-*`. It also makes them the easiest requirements to quietly drop under delivery pressure and the most expensive to reinstate — `P15` is precisely the prediction that this happens.
- **`P5` is the most widely distributed problem in the chain.** It reaches every business rule in §4, because it is a claim about enforcement location rather than about any particular rule.
- **`P7` and `P8` concentrate in exception flows rather than requirements.** `FR-ORD-08` states atomicity in one line; what makes it testable is the ten exception flows of `UC-ORD-05` and the five of `UC-INV-01`.
- **The `AUD` domain is cited by nearly every use case in the specification.** `UC-AUD-03` is included by every use case with a human actor and `UC-AUD-01` by every use case that changes something of consequence. Their eight requirements carry disproportionate weight, and a shortfall there is a shortfall everywhere.

---

## 7. Open Items Carried Forward

Thirteen assumptions in [`srs.md`](./srs.md) §2.5 stand unconfirmed. They are recorded here because several of them are load-bearing for requirements already stated, and confirming them may change those requirements rather than merely annotate them.

| Assumption | Affects | Why it matters |
|---|---|---|
| **A-03** Latency targets | `NFR-PERF-01`, `NFR-PERF-02` | The architecture is sized against these figures |
| **A-04** Peak multiplier of 10× | `NFR-SCAL-06`, `UC-PRM-04` | Determines the capacity a flash sale must survive (`P8`, `P9`) |
| **A-05** Cart expiry periods | `FR-CRT-07`, `UC-CRT-06` | Trades cart recovery against storage growth |
| **A-06** 14-day return window | `FR-ORD-15`, `UC-ORD-09` | Determines when revenue is final |
| **A-07** 24-hour payment retry window | `FR-PAY-06`, `UC-PAY-05` | Determines how long scarce stock is held against an unpaid order during a flash sale |
| **A-08 / A-09** Review moderation and edit policy | `FR-REV-07`, `FR-REV-08`, `UC-REV-01` | Trades review volume against storefront exposure |
| **A-11** 5-minute reporting lag | `NFR-PERF-06`, `UC-RPT-01` | The explicit `P4` freshness trade-off |
| **A-12** 99.9% availability | `NFR-AVAIL-01` | Determines the resilience investment |
| **A-13** 7-year audit retention | `FR-DAT-05`, `UC-AUD-01` | A Legal and regulatory determination, not a platform decision |

Two further items are **not** assumptions but genuine gaps in the source requirements, and cannot be closed by this specification:

- **Review content policy.** `UC-REV-05` specifies how moderation works but R1 defines no policy to moderate against. Moderation cannot be consistent without one.
- **Role granularity.** The role authority table in [`srs.md`](./srs.md) §2.3 is this specification's interpretation of R1 §9's five roles. Whether finer-grained permissions are required within a role is unsettled, and `P16` turns on getting it right.

---

## 8. Next Step

[Solution Architecture](../SA-docs/general-approach.md) completes the chain, taking each `P1`–`P17` to an architectural decision and a technology. That document is already written against the problem catalogue; the identifiers introduced here now let its decisions be traced to the specific requirements and use cases they satisfy, rather than to a problem number alone.

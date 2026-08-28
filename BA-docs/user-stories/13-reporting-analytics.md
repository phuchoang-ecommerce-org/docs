# Reporting & Analytics — User Stories (`RPT`)

**Document type:** User Story Specification — domain
**Related documents:** [`README.md`](./README.md) (index and template) · [`../use-cases/13-reporting-analytics.md`](../use-cases/13-reporting-analytics.md) (source use cases) · [`../srs.md`](../srs.md)
**Audience:** Product Management, Engineering, Quality Assurance

---

## US-RPT-01 — View Revenue Report

**As an** Administrator
**I want** to view revenue by day or month
**So that** I have the primary decision input for the business, on a figure that reconciles to what was captured

**Realises:** `UC-RPT-01` · `FR-RPT-01`, `FR-RPT-02`, `FR-ADM-08`
**Priority:** Must

**Acceptance Criteria**
- Given a role permitting revenue reporting and a selected period and granularity, when I open the report, then revenue is computed counting only orders that reached Paid or beyond, with refunds and returns deducted from the periods in which they occurred, and presented with its as-at time, without degrading transactional latency.
- Given a comparison against a prior period, when requested, then it is computed on the identical basis.
- Given a breakdown by category, payment method, or shipping destination, when requested, then each subtotal is on the same basis and sums to the total.
- Given the report is generated on schedule, when it runs, then the same basis applies and it is distributed automatically.
- Given the selected period includes today, when shown, then the figure is explicitly marked incomplete with its as-at time stated.
- Given reporting data lags beyond the permitted bound, when shown, then the figure is stated as stale rather than current.
- Given reporting is unavailable, when I request it, then the failure is reported and transactional operations are unaffected.
- Given I lack authority for revenue reporting, when I attempt it, then it is declined and recorded.
- Given the period contains no qualifying orders, when computed, then zero is presented explicitly, distinguished from a computation failure.
- Given report demand rises during a peak event, when this happens, then transactional latency targets continue to hold and the report waits.

---

## US-RPT-02 — View Product Performance Report

**As a** Staff member
**I want** to see per-product performance for a period
**So that** I can decide what to promote, reprice, or discontinue

**Realises:** `UC-RPT-02` · `FR-RPT-03`, `FR-RPT-05`, `FR-ADM-08`
**Priority:** Must

**Acceptance Criteria**
- Given a role permitting commercial reporting and a selected period, when I open the report, then per-product views, orders, units sold, revenue, returns, and average rating are presented, ranked by units or revenue, with the as-at time and counting basis stated.
- Given I rank by revenue instead of units, when I choose, then both orderings remain available.
- Given I filter by category or brand, when applied, then the report narrows accordingly.
- Given I include return rate, when shown, then it is presented as a proportion of units sold.
- Given I request variant-level detail, when shown, then performance is broken down by variant.
- Given a product was removed during the period, when reported, then its performance is still reported from the orders that reference it.
- Given view counts are unavailable, when shown, then order and revenue figures are presented and view-derived columns marked unavailable.
- Given reporting is unavailable, when requested, then the failure is reported without affecting transactions.
- Given I lack authority for this report, when I attempt it, then it is declined and recorded.
- Given the period spans a price change, when computed, then revenue is computed from the prices recorded on the orders, not the current price.

---

## US-RPT-03 — View Customer Report

**As an** Administrator
**I want** to see customer growth and value figures for a period
**So that** I can measure acquisition and retention

**Realises:** `UC-RPT-03` · `FR-RPT-04`, `FR-RPT-07`, `FR-ADM-08`
**Priority:** Should

**Acceptance Criteria**
- Given a role permitting customer reporting and a selected period, when I open the report, then registrations and first purchases, and customers ranked by purchase value on the revenue basis, are presented with the as-at time, excluding credentials and payment instrument details, and the access itself is recorded.
- Given an aggregate-only view, when selected, then counts and totals are shown without naming individuals.
- Given a retention view, when selected, then repeat purchase rate by registration cohort is presented.
- Given a segment filter by registration period, region, or value band, when applied, then results narrow accordingly.
- Given I lack authority for customer reporting, when I attempt it, then it is declined and recorded.
- Given suspended or deleted accounts fall within the period, when computed, then their orders still count toward revenue and registrations toward growth, but they are not shown as live customers.
- Given reporting is unavailable, when requested, then the failure is reported without affecting transactions.
- Given an export of customer-level data is requested, when permitted by role, then it is produced and the export is audited.

---

## US-RPT-04 — View Inventory Report

**As a** Warehouse Operator
**I want** to see stock position, movement, and low-stock exposure
**So that** I can plan replenishment

**Realises:** `UC-RPT-04` · `FR-RPT-06`, `FR-INV-01`, `FR-INV-06`
**Priority:** Must

**Acceptance Criteria**
- Given a role permitting inventory reporting and a selected scope and period, when I open the report, then stock quantity, reserved stock, and available stock by SKU and warehouse, movement over the period with reasons, and low-stock and no-movement SKUs are presented with the as-at time stated.
- Given I narrow to low stock, when applied, then only SKUs needing replenishment are shown.
- Given I view slow-moving stock, when applied, then SKUs with no sales over the period are shown.
- Given a shrinkage view, when applied, then negative adjustments are grouped by reason.
- Given cost data is available, when requested, then stock is valued at cost.
- Given figures lag reservations in flight, when shown, then the as-at time is stated and no decision from this report consumes stock.
- Given a reorder threshold is not configured for a SKU, when reported, then it appears in the position report but is listed as unconfigured rather than silently omitted from low-stock exposure.
- Given I lack authority for inventory reporting, when I attempt it, then it is declined.
- Given reporting is unavailable, when requested, then the operational inventory view remains available.

---

## US-RPT-05 — View Order and Conversion Statistics

**As a** Staff member
**I want** to see order counts, average order value, cancellation and return rates, and conversion
**So that** I can measure whether the platform is working commercially

**Realises:** `UC-RPT-05` · `FR-RPT-08`, `FR-RPT-09`, `FR-ADM-08`
**Priority:** Must

**Acceptance Criteria**
- Given a role permitting commercial reporting and a selected period, when I open the report, then order counts by state, average order value on the revenue basis, cancellation and return rates, and conversion rate are presented with the as-at time and each definition stated.
- Given a funnel-stage breakdown, when requested, then sessions reaching search, product view, cart, checkout, and placement are shown.
- Given a segmented view by campaign or channel, when requested, then conversion is broken down accordingly.
- Given cancellation reasons, when shown, then they are grouped by reason.
- Given the report is narrowed to a flash sale window, when applied, then figures reflect that window.
- Given session data is unavailable, when computed, then order statistics are presented and conversion marked unavailable rather than shown from an unknown denominator.
- Given the period includes orders still in flight, when counted, then they are shown in their current state and identified as in flight.
- Given reporting is unavailable, when requested, then the failure is reported without affecting transactions.
- Given demand for statistics peaks during a sale, when this happens, then transactional latency targets hold and the report waits.
- Given I lack authority for this report, when I attempt it, then it is declined and recorded.

---

## US-RPT-06 — Export Report

**As an** Administrator
**I want** to export a report in machine-readable form
**So that** I can reconcile figures against accounts and other sources offline

**Realises:** `UC-RPT-06` · `FR-RPT-10`, `FR-AUD-01`
**Priority:** Could

**Acceptance Criteria**
- Given I am authorised for the report being exported, when I export it, then a machine-readable file is produced carrying its parameters, counting basis, and as-at time, excluding credentials and payment instrument details, with an audit entry recorded.
- Given a large export, when requested, then it is produced asynchronously and I am notified when it is ready, so it does not contend with transactional work.
- Given a scheduled export, when it runs, then it is audited against the schedule rather than a person.
- Given a filtered export, when produced, then only the currently applied filters are exported and recorded in both the export and the audit entry.
- Given I lack authority for the underlying report, when I attempt to export it, then it is declined and recorded.
- Given the export exceeds the permitted size, when attempted, then it is declined and I am asked to narrow the period or filters.
- Given the export contains personal data, when produced, then it is permitted only where my role allows it, and the audit entry records that personal data left the platform.
- Given production fails, when this happens, then no partial file is delivered.
- Given the audit entry cannot be written, when this happens, then the export is not delivered.

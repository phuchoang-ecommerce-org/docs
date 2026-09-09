# Sequence Diagrams — Review, Notification, Administration, Reporting, Audit

**Document type:** Backend architecture specification
**Status:** **Proposed**
**Audience:** Backend Engineering, Architecture Review, Compliance
**Related documents:** [README](./README.md) · [00-Overview](./00-Overview.md) · [UC-REV](../../../BA-docs/use-cases/10-review.md) · [UC-NTF](../../../BA-docs/use-cases/11-notification.md) · [UC-ADM](../../../BA-docs/use-cases/12-administration.md) · [UC-RPT](../../../BA-docs/use-cases/13-reporting-analytics.md) · [UC-AUD](../../../BA-docs/use-cases/14-audit-access-control.md)

---

## 1. Purpose

Five domains that share a structural property: **almost everything they do is driven by an event rather than by a caller.** Notification, Audit, and Reporting are the platform's three universal consumers ([Domain Model §5.2](../Domain%20Model.md)) — they subscribe to every Kafka topic rather than to a listed subset. Review learns that a purchase completed the same way.

That is why they appear last and why they are short. Each is an application of [`00-Overview.md`](./00-Overview.md) §3 to a particular purpose, and the interesting content is not the mechanism but what each domain is and is not allowed to do with what it receives.

Administration is the exception, and deliberately so: [Domain Model §3](../Domain%20Model.md) concludes that `ADM` **is not a bounded context**. Walking `UC-ADM-01`–`06`, only account suspension and role management are genuinely identity-shaped domain logic, and both land in Identity & Access. The rest are role-gated operations routing through Catalog's, Ordering's, and Inventory's own public APIs. There is no leftover domain logic for "Administration" to own, so §7 and §8 below are drawn against Identity, and the admin console is a thin composition layer with no aggregates of its own.

---

## 2. UC-REV-01 — Submit a Product Review

| | |
|---|---|
| **Use cases** | `UC-REV-01` · `UC-SHP-06` |
| **Business rules** | `BR-REV-01` · `BR-CUS-02` |
| **Decisions** | [ADR-0012](../../01-system/ADR/ADR-0012-transactional-outbox-and-kafka.md) |
| **Problems** | `P5` |

```mermaid
sequenceDiagram
  autonumber
  participant Kafka
  participant Eligibility as PurchaseEligibilityReadModel
  actor Customer
  participant Next as Next.js server
  participant Ctl as ReviewController
  participant Submit as SubmitReviewService
  participant Authz as AuthorizationService
  participant Review
  participant Outbox as OutboxRepository
  participant PG as PostgreSQL

  Note over Kafka,Eligibility: BEFORE any review can be submitted
  Kafka--)Eligibility: OrderDelivered, OrderCompleted — ecp.ordering.order.v1
  Eligibility->>PG: project (customerId, productId, orderId, deliveredAt)
  Note over Eligibility: Review keeps its OWN projection of who bought what. It has<br/>no compile-time edge to Ordering and cannot query an order<br/>(Module Dependency Diagram §5) — this projection IS how it<br/>knows, and it is rebuildable from the log.

  Customer->>Next: write a review
  Next->>Ctl: POST /api/v1/products/{productId}/reviews
  Note over Next,Ctl: request pipeline — 00-Overview.md §2
  Ctl->>Submit: submit(productId, rating, body, images, correlationId)
  Submit->>Authz: authorise(actor, REVIEW_SUBMIT, own)
  Authz-->>Submit: permitted, and the account is email-verified (BR-CUS-02)

  Submit->>Eligibility: did this customer receive this product?
  alt a delivered order contains the product
    Eligibility-->>Submit: eligible, with the order reference
    Submit->>Review: has this customer already reviewed this product?
    alt not yet
      rect rgba(124,92,255,0.08)
        Note over Submit,PG: ONE PostgreSQL transaction
        Submit->>Review: create — status PENDING_MODERATION, verified buyer
        Review->>PG: INSERT review_review
        Submit->>Outbox: append(ReviewSubmitted)
        Outbox->>PG: INSERT review_outbox
      end
      Ctl-->>Next: 201 Created — awaiting moderation
      Note over Review: A review is NOT visible on submission. It enters<br/>moderation (§3), because an unmoderated review surface is<br/>a spam and abuse channel pointed at the product catalogue.
    else the customer has already reviewed it
      Submit-->>Ctl: 409 — edit the existing review instead (UC-REV-02)
    end
  else no delivered order contains it
    Eligibility-->>Submit: not eligible
    Submit-->>Ctl: 403
    Note over Submit: BR-REV-01 — only a verified buyer may review, and the<br/>check is server-side (P5). A rating that anyone can post<br/>is a rating that tells a customer nothing.
  end
```

**Why Review owns a projection instead of asking Ordering.** A synchronous query would give Review a compile-time edge to Ordering, and Ordering already publishes what Review needs. The projection costs a table and an eventual-consistency window — a review attempted in the seconds between delivery and projection is refused and succeeds on retry. That window is acceptable because nobody reviews a product one second after it arrives, and the alternative is a dependency edge that would have to be unpicked at extraction.

---

## 3. UC-REV-05 — Moderate a Review

| | |
|---|---|
| **Use cases** | `UC-REV-05` · `UC-AUD-01` |
| **Business rules** | `BR-REV-02` · `BR-AUD-01` |
| **Problems** | `P16` · `P17` |

```mermaid
sequenceDiagram
  autonumber
  actor Support as Support Agent
  participant Ctl as ReviewController
  participant Moderate as ModerateReviewService
  participant Authz as AuthorizationService
  participant Review
  participant Audit as AuditListener
  participant Outbox as OutboxRepository
  participant PG as PostgreSQL
  participant Kafka
  participant Rating as RatingSummaryReadModel
  participant Notify as NotificationListener

  Support->>Ctl: PUT /api/v1/reviews/{reviewId}/moderation<br/>decision and reason
  Ctl->>Moderate: moderate(reviewId, decision, reason, actor, correlationId)
  Moderate->>Authz: authorise(actor, REVIEW_MODERATE)
  Authz-->>Moderate: permitted
  Note over Authz: P16 — moderation changes what the public sees about a<br/>product. It is a Support and Administrator authority, and<br/>a refused attempt is recorded.

  rect rgba(124,92,255,0.08)
    Note over Moderate,PG: ONE PostgreSQL transaction
    Moderate->>Review: PENDING_MODERATION to PUBLISHED or REJECTED
    Review->>PG: UPDATE review_review
    Moderate-)Audit: actor, decision, reason, timestamp
    Audit->>PG: INSERT audit_entry
    Moderate->>Outbox: append(ReviewPublished) or append(ReviewModerated)
    Outbox->>PG: INSERT review_outbox
  end

  Outbox--)Kafka: ecp.review.review.v1
  Kafka--)Rating: recompute the product's average and count
  Note over Rating: Catalog DISPLAYS the rating without owning it<br/>(05-Cart-Catalog-Search.md §6). Only PUBLISHED reviews<br/>reach the summary, so a rejected review never moves an<br/>average — which is the point of moderating before<br/>publishing rather than after.
  Kafka--)Notify: tell the author the outcome
  Note over Notify: A rejection states WHY. A moderation decision with no<br/>reason is indistinguishable from censorship, and the<br/>author cannot correct what they are not told (P17).
```

---

## 4. UC-NTF-01 — Deliver an Email Notification

| | |
|---|---|
| **Use cases** | `UC-NTF-01` · `UC-NTF-04` |
| **Business rules** | `BR-NTF-01` · `BR-NTF-02` |
| **Quality** | `NFR-AVAIL-02` · `NFR-REL-06` · `NFR-SEC-07` |
| **Decisions** | [ADR-0005](../../01-system/ADR/ADR-0005-clean-architecture-ports-and-adapters.md) · [ADR-0012](../../01-system/ADR/ADR-0012-transactional-outbox-and-kafka.md) |
| **Problems** | `P3` · `P6` |
| **Failure path** | §6 |

```mermaid
sequenceDiagram
  autonumber
  participant Kafka
  participant Notify as NotificationListener
  participant Preferences as NotificationPreferenceService
  participant Notification
  participant Sender as NotificationSender
  participant Adapter as EmailAdapter
  actor ESP as Email Service Provider
  participant PG as PostgreSQL
  actor Customer

  Kafka--)Notify: OrderCreated, PaymentCaptured, ShipmentDispatched, ...
  Note over Notify: Notification is a UNIVERSAL consumer — it subscribes to<br/>every topic rather than a listed subset (Domain Model §5.2).<br/>A new event type becomes notifiable by configuration, not<br/>by a code change here.
  Notify->>PG: has this eventId already been handled?
  alt already handled
    PG-->>Notify: yes
    Notify-->>Kafka: commit the offset, do nothing
    Note over Notify: At-least-once delivery means redelivery is routine. A<br/>customer receiving two dispatch emails for one parcel is a<br/>support contact and a trust cost.
  else not yet
    PG-->>Notify: no
    Notify->>Preferences: does this customer accept this notification type on this channel?
    alt they have opted out
      Preferences-->>Notify: suppressed
      Notify->>PG: record as SUPPRESSED, with the reason
      Note over Notify: BR-NTF-02 — a suppressed notification is RECORDED, not<br/>discarded. "The customer says they never received it" needs<br/>an answer, and "we chose not to send it, here is when they<br/>opted out" is one.
    else they accept it
      rect rgba(124,92,255,0.08)
        Note over Notify,PG: ONE PostgreSQL transaction
        Notify->>Notification: create — status PENDING, templated from the event payload
        Notification->>PG: INSERT notification_notification
      end
      Note over Notification: NFR-SEC-07 — the template renders from the event's BUSINESS<br/>fields. The payload never carried a credential, a token, or<br/>a payment instrument, so none can leak into an email.

      Notify->>Sender: send(notification)
      Sender->>Adapter: through the provider-specific adapter
      Note over Sender,Adapter: ADR-0005, P3 — swapping email provider is an adapter change.
      Adapter->>ESP: deliver
      alt accepted by the provider
        ESP-->>Adapter: accepted, provider message id
        Notify->>PG: UPDATE notification SET status = SENT, provider_message_id = ?
        ESP-->>Customer: the email
      else rejected or unreachable
        Note over Notify: §6.
      end
    end
    Notify-->>Kafka: commit the offset
  end
```

**Why email is a consumer of a committed event rather than a step inside the transaction.** [Solution Architecture §4](../../01-system/Solution%20Architecture.md) states it directly: delivery failure must not block the business transaction that triggered it. An order confirmation email sent inside the placement transaction would make a mail provider's outage into a checkout outage — `NFR-AVAIL-02` inverted. Consuming an already-committed event means the worst case is a late email, never a lost order. `UC-ORD-05` E9 says the same from the other side: an order is never reversed because a message failed.

---

## 5. UC-NTF-02, UC-NTF-03 — In-App Notifications

| | |
|---|---|
| **Use cases** | `UC-NTF-02` · `UC-NTF-03` · `UC-NTF-04` |
| **Business rules** | `BR-NTF-01` |
| **Decisions** | [ADR-0023](../../01-system/ADR/ADR-0023-server-first-data-fetching.md) |

```mermaid
sequenceDiagram
  autonumber
  participant Kafka
  participant Notify as NotificationListener
  participant Notification
  participant PG as PostgreSQL
  actor Customer
  participant Next as Next.js server
  participant Ctl as NotificationController
  participant Query as NotificationQueryService

  Kafka--)Notify: a customer-visible business event
  Notify->>Notify: has this eventId been handled?
  rect rgba(124,92,255,0.08)
    Note over Notify,PG: ONE PostgreSQL transaction
    Notify->>Notification: create for the in-app channel, status UNREAD
    Notification->>PG: INSERT notification_notification
  end
  Note over Notification: The SAME event can produce an email and an in-app<br/>notification, each honouring its own channel preference<br/>(UC-NTF-04). One event, two channels, two independent<br/>opt-outs.

  Customer->>Next: open the notification centre
  Next->>Ctl: GET /api/v1/notifications
  Ctl->>Query: list(customerId, cursor)
  Query->>PG: SELECT notification_notification WHERE account_id = ?
  PG-->>Query: cursor-paginated page
  Query-->>Ctl: notifications with unread counts
  Ctl-->>Next: page
  Next-->>Customer: rendered

  Customer->>Next: mark as read
  Next->>Ctl: POST /api/v1/notification-read-marks
  Ctl->>Notification: mark read
  Notification->>PG: UPDATE notification_notification SET read_at = now()
  Note over Notification: Marking read is naturally idempotent — a second mark sets<br/>the same timestamp to the same effect. No Idempotency-Key<br/>is required, which is exactly the scoping ADR-0003 §4<br/>intends: the header is for operations whose repetition is<br/>a business defect, and this is not one.
```

---

## 6. Failure — The Email Provider Rejects or Disappears

| | |
|---|---|
| **Use cases** | `UC-NTF-01` E1 · `UC-ORD-05` E9 |
| **Business rules** | `BR-NTF-01` |
| **Quality** | `NFR-AVAIL-02` · `NFR-REL-06` |
| **Problems** | `P6` |

```mermaid
sequenceDiagram
  autonumber
  participant Kafka
  participant Notify as NotificationListener
  participant Sender as NotificationSender
  actor ESP as Email Service Provider
  participant DLQ as Dead-letter topic
  participant PG as PostgreSQL
  participant Ordering

  Kafka--)Notify: OrderCreated
  Notify->>Sender: send the confirmation email
  Sender->>ESP: deliver
  ESP--)Sender: unreachable, or a 5xx

  loop retry with backoff — the bound is configuration
    Notify->>Sender: retry
    Sender->>ESP: deliver
    ESP--)Sender: still failing
  end

  Notify->>PG: UPDATE notification SET status = FAILED, attempts, last_error
  Notify--)DLQ: the event, with its full envelope and correlation id
  Notify-->>Kafka: commit the offset
  Note over DLQ: NFR-AVAIL-02 — a failing consumer NEVER blocks the<br/>publisher. Holding the offset would stall the partition and<br/>back pressure would reach the outbox relay, turning a mail<br/>outage into an ordering outage. The dead-letter topic plus<br/>an alert is what keeps the failure contained to its own<br/>consumer group.

  Note over Ordering: THE ORDER IS UNAFFECTED
  Note over Ordering: UC-ORD-05 E9 — the order stands and the notification is<br/>retried. An order is never reversed because a message<br/>failed, and the customer can see the order in their account<br/>whether or not the email arrived.

  Note over Kafka,Ordering: RECOVERY
  Note over DLQ: The envelope in the dead-letter topic is complete —<br/>eventId, correlationId, and payload — so replaying it after<br/>the provider recovers reproduces the notification exactly.<br/>The idempotency check in §4 makes a replay of an event that<br/>DID eventually send harmless.
```

**Why the offset is committed on a permanent failure.** Refusing to commit would make the consumer retry the same event forever and stall every later event on that partition — one undeliverable address blocking every other customer's notifications. Committing and dead-lettering keeps the failure to the single message that caused it. This is the opposite of the payment callback in [`03-Payment.md`](./03-Payment.md) §3, which deliberately does *not* acknowledge a result it failed to apply — and the difference is what is at stake. A lost notification is recoverable from the dead-letter topic; a lost payment result is money.

---

## 7. UC-ADM-03 — Suspend a Customer Account

| | |
|---|---|
| **Use cases** | `UC-ADM-03` · `UC-CUS-03` E3 · `UC-AUD-01` |
| **Business rules** | `BR-CUS-03` · `BR-AUD-01` · `BR-AUD-02` |
| **Quality** | `NFR-SEC-03` · `NFR-OBS-01` |
| **Decisions** | [ADR-0016](../../01-system/ADR/ADR-0016-jwt-refresh-rotation-rbac.md) |
| **Problems** | `P16` · `P17` |

```mermaid
sequenceDiagram
  autonumber
  actor Support as Support Agent
  participant Next as Next.js server
  participant Ctl as AccountAdministrationController
  participant Suspend as SuspendAccountService
  participant Authz as AuthorizationService
  participant Account
  participant Audit as AuditListener
  participant PG as PostgreSQL

  Support->>Next: suspend an account, with a reason
  Note over Next: The admin console is a thin composition layer over each<br/>context's own public API (Domain Model §3). ADM owns no<br/>aggregate, and this call lands in IDENTITY.
  Next->>Ctl: PUT /api/v1/accounts/{accountId}/status
  Ctl->>Suspend: suspend(accountId, reason, actor, correlationId)
  Suspend->>Authz: authorise(actor, ACCOUNT_SUSPEND)
  Authz-->>Suspend: permitted
  Note over Authz: P16 — the SAME AuthorizationService as the storefront uses.<br/>The admin console gets no privileged path (BR-AUD-02).

  rect rgba(124,92,255,0.08)
    Note over Suspend,PG: ONE PostgreSQL transaction
    Suspend->>Account: status ACTIVE to SUSPENDED
    Account->>PG: UPDATE identity_account
    Suspend->>PG: REVOKE every refresh token for this account
    Suspend-)Audit: actor, accountId, reason, timestamp
    Audit->>PG: INSERT audit_entry
  end
  Note over Suspend,PG: Revoking the refresh tokens is what makes the suspension<br/>take effect. Without it the customer keeps renewing<br/>indefinitely and the status flag changes nothing.

  Ctl-->>Next: 200 OK
  Note over Support,PG: THE HONEST GAP — ADR-0016 §5<br/>The suspended customer's CURRENT access token remains<br/>valid until it expires, because AuthorizationService reads<br/>the roles the token carries rather than the account's live<br/>status. Revocation latency is bounded by the access-token<br/>lifetime, and shortening it increases refresh traffic.<br/>A deny-list would close the gap at the cost of a datastore<br/>lookup on every request — the exact cost the stateless<br/>access token exists to avoid. AccountSuspended exists as an<br/>event if that trade is ever reconsidered.
  Note over Support: UC-CUS-03 E3 — at the next login the account is reported<br/>as unavailable WITHOUT the reason, which may relate to an<br/>open fraud investigation.
```

---

## 8. UC-ADM-06 — Manage User Roles

| | |
|---|---|
| **Use cases** | `UC-ADM-06` · `UC-CUS-05` A1 · `UC-AUD-01` |
| **Business rules** | `BR-AUD-01` · `BR-AUD-02` |
| **Problems** | `P16` · `P17` |

```mermaid
sequenceDiagram
  autonumber
  actor Admin as Administrator
  participant Ctl as AccountAdministrationController
  participant Roles as ManageRolesService
  participant Authz as AuthorizationService
  participant Account
  participant Audit as AuditListener
  participant PG as PostgreSQL
  participant Refresh as RefreshSessionService

  Admin->>Ctl: PUT /api/v1/accounts/{accountId}/roles
  Ctl->>Roles: assign(accountId, roles, actor, correlationId)
  Roles->>Authz: authorise(actor, ROLE_MANAGE)
  Authz-->>Roles: permitted
  Note over Authz: SRS §2.3 grants role management to ADMINISTRATOR alone.<br/>It is the authority that grants every other authority, and<br/>P16 makes it the most closely held one in the platform.

  rect rgba(124,92,255,0.08)
    Note over Roles,PG: ONE PostgreSQL transaction
    Roles->>Account: replace the role set
    Account->>PG: UPDATE identity_account_role
    Roles-)Audit: actor, accountId, roles before and after, timestamp
    Audit->>PG: INSERT audit_entry
    Note over Audit: BEFORE and AFTER, not just the new value. "Who granted<br/>this person Administrator, and what did they hold before"<br/>is the question P17 exists to answer, and a record of the<br/>new state alone cannot.
  end
  Ctl-->>Admin: 200 OK

  Note over Roles,Refresh: HOW THE CHANGE TAKES EFFECT
  Refresh->>Account: read the CURRENT roles at the next session renewal
  Note over Refresh: 04-Identity.md §4, A1 — the new access token carries the<br/>current roles, so a revoked authority survives in an<br/>outstanding token for at most one refresh interval. That<br/>interval is the revocation latency, and it is the same<br/>trade-off as §7.
```

---

## 9. The Reporting Projection

| | |
|---|---|
| **Use cases** | `UC-RPT-01`–`UC-RPT-05` |
| **Quality** | `NFR-PERF-03` · `NFR-AVAIL-02` |
| **Decisions** | [ADR-0008](../../01-system/ADR/ADR-0008-cqrs-command-query-separation.md) · [ADR-0013](../../01-system/ADR/ADR-0013-mongodb-scoped-to-read-models.md) · [ADR-0030](../../01-system/ADR/ADR-0030-spring-data-mongodb-read-model-access.md) |
| **Problems** | `P6` · `P17` |

```mermaid
sequenceDiagram
  autonumber
  participant Kafka
  participant Projector as ReportingProjector
  participant Mongo as MongoDB
  actor Admin as Administrator
  participant Ctl as ReportingController
  participant Authz as AuthorizationService
  participant Query as ReportQueryService

  Note over Kafka,Mongo: PROJECTION — continuous, and the only way data enters
  Kafka--)Projector: every topic — orders, payments, shipments,<br/>catalog, inventory, promotions, reviews
  Note over Projector: Reporting is a UNIVERSAL consumer and a PURE read side.<br/>It has no command surface and no aggregate of its own<br/>(Domain Model §3).
  Projector->>Projector: has this eventId been applied?
  Projector->>Mongo: upsert into the denormalised report documents
  Note over Mongo: ADR-0013 — MongoDB is SCOPED to read models. PostgreSQL<br/>remains the source of truth for every fact here, and no<br/>report document is authoritative for anything. It is<br/>rebuildable from Kafka, which is what keeps it from<br/>becoming a second source of truth by accident.
  Note over Projector: NFR-SEC-07 and the event catalogue — review BODY TEXT is<br/>never published to Reporting. What a projection cannot<br/>receive, it cannot leak.

  Note over Admin,Query: QUERY
  Admin->>Ctl: GET /api/v1/reports/revenue?from=...&to=...
  Ctl->>Query: revenue(range, granularity, correlationId)
  Query->>Authz: authorise(actor, REPORT_REVENUE)
  Authz-->>Query: permitted
  Note over Authz: SRS §2.3 scopes reports by role — revenue to Administrator,<br/>product performance to Staff, inventory to Warehouse. Audit<br/>and Reporting have no command surface at all, yet still<br/>carry a compile-time edge to identity, precisely because<br/>they serve role-scoped READS (Module Dependency Diagram §3.2).
  Query->>Mongo: aggregate over the pre-projected documents
  Mongo-->>Query: figures
  Query-->>Ctl: report
  Note over Query,Mongo: The read model is EVENTUALLY CONSISTENT. A report is a<br/>picture of the business as of the last projected event,<br/>and figures may lag by the projection window. Every report<br/>therefore states its as-of time rather than implying it is<br/>live — a revenue figure that silently lags is worse than<br/>one that admits it.
```

---

## 10. UC-RPT-06 — Export a Report

| | |
|---|---|
| **Use cases** | `UC-RPT-06` · `UC-AUD-01` |
| **Business rules** | `BR-AUD-01` |
| **Problems** | `P17` |

```mermaid
sequenceDiagram
  autonumber
  actor Admin as Administrator
  participant Ctl as ReportingController
  participant Export as ReportExportService
  participant Authz as AuthorizationService
  participant Audit as AuditListener
  participant Mongo as MongoDB
  participant PG as PostgreSQL

  Admin->>Ctl: POST /api/v1/report-exports — report type, range, format
  Ctl->>Export: requestExport(...)
  Export->>Authz: authorise(actor, REPORT_EXPORT)
  Authz-->>Export: permitted
  rect rgba(124,92,255,0.08)
    Note over Export,PG: ONE PostgreSQL transaction
    Export->>PG: INSERT reporting_export — status PENDING
    Export-)Audit: actor, report type, range, timestamp
    Audit->>PG: INSERT audit_entry
  end
  Note over Audit: An export removes data from the platform's controls. Who<br/>exported what, and when, is precisely a P17 question, and<br/>it is recorded at REQUEST time rather than on completion.
  Ctl-->>Admin: 202 Accepted, with a status URL
  Note over Ctl: Asynchronous by design. A large export must not hold an<br/>HTTP connection open for minutes, and a client timeout must<br/>not lose work already done.

  Export->>Mongo: aggregate and stream the rows
  Mongo-->>Export: documents
  Export->>PG: UPDATE reporting_export SET status = READY, location

  Admin->>Ctl: GET /api/v1/report-exports/{exportId}
  Ctl-->>Admin: READY
  Admin->>Ctl: GET /api/v1/report-exports/{exportId}/content
  Ctl->>Authz: authorise again — the requester must still hold the authority
  Authz-->>Ctl: permitted
  Ctl-->>Admin: the file
  Note over Ctl: Re-authorising at download is not redundant. An export<br/>requested before a role change must not remain downloadable<br/>afterwards, and the gap between request and download can be<br/>long.
```

---

## 11. UC-AUD-01 — Record an Audit Entry

The last diagram, and the one every other diagram in this folder has been quietly referring to.

| | |
|---|---|
| **Use cases** | `UC-AUD-01` · `UC-AUD-02` |
| **Business rules** | `BR-AUD-01` · `BR-AUD-02` |
| **Quality** | `NFR-OBS-01` · `NFR-OBS-03` |
| **Decisions** | [ADR-0017](../../01-system/ADR/ADR-0017-append-only-audit-log.md) |
| **Problems** | `P17` |

```mermaid
sequenceDiagram
  autonumber
  participant AppSvc as Any application service
  participant Authz as AuthorizationService
  participant Kafka
  participant Audit as AuditListener
  participant Entry as AuditEntry
  participant PG as PostgreSQL
  actor Admin as Administrator
  participant Ctl as AuditController

  Note over AppSvc,PG: TWO SOURCES, ONE APPEND-ONLY LOG
  AppSvc-)Audit: in-process — a price, stock level, order state, refund,<br/>promotion, review visibility, account status, or role changed
  Authz-)Audit: in-process — an authorisation DENIAL (04-Identity.md §8)
  Kafka--)Audit: every business topic, as a universal consumer

  Audit->>Audit: has this eventId been recorded?
  Audit->>Entry: build — actor, action, resource, before and after, timestamp, correlationId
  Entry->>PG: INSERT audit_entry
  Note over Entry,PG: BR-AUD-01 holds BY CONSTRUCTION, not by a runtime check:<br/>Audit exposes NO mutation API at all (Integration Contract<br/>§7). There is no endpoint, no application service, and no<br/>aggregate method that updates or deletes an entry, so<br/>immutability is a property of the surface rather than a<br/>rule someone must remember (ADR-0017).

  Note over AppSvc,PG: THE TWO EXCEPTIONS WHERE AUDIT IS SYNCHRONOUS AND BLOCKING
  Note over AppSvc: 01-Ordering.md §10 (E4) — an order transition whose audit<br/>entry cannot be written is NOT APPLIED.<br/>02-Inventory.md §4 — the same for a stock adjustment.<br/>Both are entirely internal, so refusing is safe. Everywhere<br/>else audit is a consumer and cannot block anything —<br/>notably 03-Payment.md §5, where the money has already moved<br/>and the refund stands with the gap escalated instead.

  Admin->>Ctl: GET /api/v1/audit-entries?actor=...&from=...&resource=...
  Ctl->>Audit: search(filters)
  Audit->>PG: SELECT audit_entry
  PG-->>Ctl: cursor-paginated results
  Note over Ctl: SRS §2.3 grants the audit trail to Support and<br/>Administrator only. Reading who did what is itself a<br/>sensitive capability.
  Note over Admin,PG: NFR-OBS-03 — the correlationId recorded on every entry is<br/>the same one issued at the edge in 00-Overview.md §2. One<br/>business transaction is followable across every module it<br/>touched, in the audit trail and the logs alike.
```

**Why the audit trail has no mutation API rather than a permission that forbids mutation.** A permission can be misconfigured, and a service method that updates a row can be called by a future developer who does not know why it should not be. Not building the method at all is the only version of `BR-AUD-01` that cannot be undone by a later change nobody reviews carefully. It is the same reasoning as deriving `available` rather than storing it ([`02-Inventory.md`](./02-Inventory.md) §2): make the wrong state unrepresentable instead of forbidden.

**What is deliberately not claimed.** Append-only at the application layer is not tamper-proof at the storage layer. Anyone with direct database access can still alter rows, and nothing here detects it. [`ADR-0017`](../../01-system/ADR/ADR-0017-append-only-audit-log.md) records this as the residual risk it is: the log answers "who did what" for anyone acting *through the platform*, which is the threat `P17` names, and it is not a defence against a compromised database administrator.

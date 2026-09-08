# Sequence Diagrams — Payment

**Document type:** Backend architecture specification
**Status:** **Proposed**
**Audience:** Backend Engineering, Architecture Review, QA, Finance
**Related documents:** [README](./README.md) · [01-Ordering](./01-Ordering.md) · [UC-PAY](../../../BA-docs/use-cases/07-payment.md) · [Security](../../01-system/Security.md) · [ADR-0012](../../01-system/ADR/ADR-0012-transactional-outbox-and-kafka.md)

---

## 1. Purpose

Where the platform touches real money. Every use case here is bounded by a party the platform does not control, and that single fact shapes the whole domain.

Three rules run through every diagram below:

- **`BR-PAY-01`** — every provider result is applied **at most once**, however many times it arrives. Providers retry until acknowledged, so duplicate delivery is routine rather than exceptional.
- **`BR-PAY-02`** — cumulative refunds are capped at the amount actually captured.
- **`NFR-SEC-07`** — no card number, token, or provider credential enters a log, an event payload, or a database column. A payment event carries a provider *reference*, never an instrument.

And one distinction that the architecture is built around: **a provider that does not answer has not declined.** Treating a timeout as a decline is how an order gets cancelled after the customer was charged, and §6 is that case drawn in full.

`P3` applies with equal weight. No diagram below names a provider: `FR-PAY-09` requires payment to be expressed independently of any one of them, which is what the `PaymentProcessor` port is for.

Arrow and frame conventions: [`README.md`](./README.md) §3.1–§3.2.

---

## 2. UC-PAY-02 — Authorise Online Payment

| | |
|---|---|
| **Use cases** | `UC-PAY-02` main success · `UC-ORD-05` step 7 |
| **Business rules** | `BR-PAY-01` · `BR-ORD-01` |
| **Quality** | `NFR-REL-01` · `NFR-REL-04` · `NFR-AVAIL-03` · `NFR-SEC-07` |
| **Decisions** | [ADR-0005](../../01-system/ADR/ADR-0005-clean-architecture-ports-and-adapters.md) · [ADR-0012](../../01-system/ADR/ADR-0012-transactional-outbox-and-kafka.md) |
| **Problems** | `P3` · `P7` |
| **Failure paths** | §6 · §7 · §8 |

```mermaid
sequenceDiagram
  autonumber
  participant Kafka
  participant Listener as OrderCreatedListener
  participant Authorise as AuthorisePaymentService
  participant Payment
  participant Attempt as PaymentAttempt
  participant Processor as PaymentProcessor
  participant Adapter as «Provider»PaymentAdapter
  actor Gateway as Payment Gateway
  participant Outbox as OutboxRepository
  participant PG as PostgreSQL
  participant Order

  Kafka--)Listener: OrderCreated — ecp.ordering.order.v1
  Note over Listener: The consumer deserialises into its OWN local record type<br/>in payment.infrastructure. Payment has no compile-time<br/>dependency on Ordering (Module Dependency Diagram §5),<br/>which is what keeps Ordering and Payment out of a cycle.
  Listener->>Listener: has this eventId been handled? if so, acknowledge and stop
  Listener->>Authorise: authorise(orderId, amount, method, correlationId)

  rect rgba(124,92,255,0.08)
    Note over Authorise,PG: TRANSACTION 1 — record the attempt BEFORE contacting anyone
    Authorise->>Payment: load or create for this order
    Authorise->>Attempt: new attempt, unique attempt reference, status PENDING
    Attempt->>PG: INSERT payment_attempt
  end
  Note over Attempt: FR-PAY-04 — step 1 of the use case, and the ordering is<br/>the whole point. No capture can occur that the platform has<br/>no record of REQUESTING. Contact the provider first and a<br/>crash between call and record produces money taken that the<br/>business cannot see (P7).

  Authorise->>Processor: authoriseAndCapture(attemptReference, Money)
  Processor->>Adapter: through the provider-specific adapter
  Note over Processor,Adapter: ADR-0005 — the domain depends only on the port. Replacing<br/>the provider is an adapter change, not a project (P3, FR-PAY-09).
  Adapter->>Gateway: authorise and capture, quoting the attempt reference
  Note over Adapter,Gateway: BR-PAY-01 — the reference is unique to THIS attempt, which<br/>is what lets a duplicate result be recognised (§7). A retry<br/>of a failed attempt gets a NEW reference (A3), so attempts<br/>are never conflated.
  Gateway-->>Adapter: authorised and captured, provider reference
  Adapter-->>Processor: outcome, amount, provider reference
  Note over Adapter: NFR-SEC-07 — the adapter returns a REFERENCE. No card<br/>number, token, or credential crosses this line, enters a<br/>log, or is written to a column.

  rect rgba(124,92,255,0.08)
    Note over Authorise,PG: TRANSACTION 2 — record the outcome
    Authorise->>Attempt: outcome CAPTURED, amount, provider reference
    Attempt->>PG: UPDATE payment_attempt
    Authorise->>Payment: captured amount recorded
    Payment->>PG: UPDATE payment_payment
    Authorise->>Outbox: append(PaymentCaptured)
    Outbox->>PG: INSERT payment_outbox
  end

  Outbox--)Kafka: PaymentCaptured — ecp.payment.payment.v1
  Kafka--)Order: PENDING_PAYMENT to PAID (BR-ORD-01)
  Note over Order: The order transition happens in ORDERING, driven by an<br/>event, not by Payment reaching into it. Payment has no<br/>module edge to Ordering and never writes an order row.
  Kafka--)Order: Notification, Audit, and Reporting consume the same event
```

**Why the attempt is recorded before the provider is called, and in its own transaction.** If the record shared a transaction with the provider call, a rollback would erase the evidence that a call was made — and the call cannot be rolled back. Recording first, and committing that record, means the worst case is an attempt with an unknown outcome, which §6 shows is recoverable. The alternative — a capture the platform has no record of requesting — is not.

**Why the amount is verified against the order total.** E6: an authorised amount differing from the order total does **not** transition the order to `PAID`. It records the discrepancy and escalates. Accepting a mismatch means either the customer was overcharged or revenue was under-collected, and both are found later by a human either way. Finding them now is cheaper.

**Why separate authorisation and capture is an adapter concern.** A2: where a provider separates the two, authorisation holds funds and capture occurs on dispatch, and an uncaptured authorisation is released within the provider's window. That difference lives entirely behind the `PaymentProcessor` port. Nothing above the port line in the diagram changes.

**A zero-total order never reaches this diagram.** `UC-ORD-05` A3: a fully discounted order moves straight to `PAID` inside the placement transaction. Cash On Delivery (A1) also skips it, and is settled at §4.

---

## 3. UC-PAY-03 — Handle Payment Gateway Result

The inbound direction, and the only diagram in the folder where the **primary actor is an external party**.

| | |
|---|---|
| **Use cases** | `UC-PAY-03` main success |
| **Business rules** | `BR-PAY-01` · `BR-PAY-02` · `BR-ORD-01` |
| **Quality** | `NFR-REL-04` · `NFR-REL-06` · `NFR-SEC-04` |
| **Decisions** | [ADR-0003](../../01-system/ADR/ADR-0003-rest-api-style.md) · [ADR-0012](../../01-system/ADR/ADR-0012-transactional-outbox-and-kafka.md) |
| **Problems** | `P6` · `P7` |

```mermaid
sequenceDiagram
  autonumber
  actor Gateway as Payment Gateway
  participant NGINX as nginx
  participant Ctl as PaymentNotificationController
  participant Verify as CallbackVerificationService
  participant Apply as ApplyPaymentResultService
  participant Attempt as PaymentAttempt
  participant Audit as AuditListener
  participant Outbox as OutboxRepository
  participant PG as PostgreSQL
  participant Kafka
  participant Order

  Gateway->>NGINX: POST /api/v1/payment-provider-notifications<br/>signature header, attempt reference, outcome
  Note over NGINX: Inbound from the public internet, unauthenticated by JWT.<br/>The trust boundary here is the SIGNATURE, not a session —<br/>Security.md treats this as its own attack surface.
  NGINX->>Ctl: forward

  Ctl->>Verify: verify the payload originates from the provider
  alt the signature verifies
    Verify-->>Ctl: authentic
  else it does not (E3)
    Verify-)Audit: security event — rejected callback
    Ctl-->>Gateway: 401, nothing applied
    Note over Verify: NFR-SEC-04. An unverified result is an instruction to<br/>move money, from an unknown party. It is rejected and<br/>RECORDED, because a stream of them is an attack in progress.
  end

  Ctl->>Apply: apply(attemptReference, outcome, amount, providerReference)
  Apply->>PG: SELECT payment_attempt WHERE attempt_reference = ?
  alt the attempt is found and unresolved
    PG-->>Apply: attempt, status PENDING
    rect rgba(124,92,255,0.08)
      Note over Apply,PG: ONE PostgreSQL transaction
      Apply->>Attempt: record outcome, amount, provider reference
      Attempt->>PG: UPDATE payment_attempt SET outcome = ?, version = version + 1<br/>WHERE id = ? AND version = ? AND outcome IS NULL
      PG-->>Attempt: 1 row updated
      Note over Attempt: BR-PAY-01 — the conditional update IS the apply-once<br/>guarantee. A concurrently delivered duplicate matches zero<br/>rows rather than applying twice (§7).
      Apply->>Outbox: append(PaymentCaptured) or append(PaymentFailed)
      Outbox->>PG: INSERT payment_outbox
    end
    Apply-->>Ctl: applied
    Ctl-->>Gateway: 200 — acknowledged
    Outbox--)Kafka: PaymentCaptured or PaymentFailed
    Kafka--)Order: PENDING_PAYMENT to PAID, or to PAYMENT_FAILED
    Note over Order: E5 — if the order was cancelled while the result was in<br/>flight, the result is still RECORDED and escalated. A<br/>capture against a cancelled order is money to be refunded<br/>(§5), never a result to be dropped.
  else already resolved (E1)
    PG-->>Apply: outcome already recorded
    Apply-->>Ctl: no action
    Ctl-->>Gateway: 200 — acknowledged, so the provider stops retrying
  else no attempt matches (E2)
    PG-->>Apply: none
    Note over Apply: §8 — recorded as an unmatched payment and escalated.<br/>NEVER discarded.
  end

  Note over Gateway,Order: E6 — if applying fails, NOTHING is applied, the result is<br/>retained and retried, and the callback is NOT acknowledged<br/>as processed. Acknowledging work that did not happen is<br/>exactly the silent gap P6 describes.
```

**Why this is a REST endpoint and not a queue.** The provider chooses the transport, and it chooses HTTP. The design consequence is that the endpoint must be idempotent, must be fast (providers time out and retry), and must acknowledge only after durably recording the result — which is why the outbox row is inside the transaction and the `200` is returned after the commit.

**Why the conditional update carries the idempotency rather than a prior read.** A read-then-act check has a window: two duplicate callbacks delivered simultaneously can both read `PENDING`. The `WHERE ... AND outcome IS NULL` clause closes it, in exactly the same way the `@Version` clause closes the overselling window in [`01-Ordering.md`](./01-Ordering.md) §7. The same mechanism, applied to a different invariant.

**Why a contradictory result is never overwritten.** E4: a result that contradicts one already applied records the conflict and escalates. Deciding automatically which of two contradictory financial statements is true is precisely what a human reconciliation is for, and an automatic rule here would be wrong in whichever direction it chose.

---

## 4. UC-PAY-04 — Settle Cash On Delivery Payment

| | |
|---|---|
| **Use cases** | `UC-PAY-04` main success · `UC-SHP-06` · `UC-AUD-01` |
| **Business rules** | `BR-PAY-03` · `BR-ORD-01` · `BR-AUD-01` |
| **Quality** | `NFR-OBS-01` |
| **Problems** | `P7` · `P16` · `P17` |

```mermaid
sequenceDiagram
  autonumber
  actor Warehouse as Warehouse Operator
  participant Ctl as PaymentController
  participant Settle as RecordCashCollectionService
  participant Authz as AuthorizationService
  participant Payment
  participant Audit as AuditListener
  participant Outbox as OutboxRepository
  participant PG as PostgreSQL
  participant Kafka
  participant Order

  Note over Warehouse: A1 — the carrier may report collection instead, in which<br/>case attribution is to the carrier (UC-SHP-04). Same service.
  Warehouse->>Ctl: POST /api/v1/payments/{paymentId}/cash-collections<br/>amount collected, collecting party
  Ctl->>Settle: recordCollection(paymentId, amount, actor, correlationId)
  Settle->>Authz: authorise(actor, CASH_COLLECTION_RECORD)
  alt permitted
    Authz-->>Settle: permitted
  else not permitted (E4)
    Authz-)Audit: attempt recorded
    Settle-->>Ctl: 403
    Note over Authz: P16 — recording cash receipt is a financial control,<br/>not a clerical step. The refused attempt is kept.
  end

  Settle->>Payment: record the collected amount, attributed to the collector
  Settle->>Settle: does the collected amount match the order total?

  alt it matches
    rect rgba(124,92,255,0.08)
      Note over Settle,PG: ONE PostgreSQL transaction
      Payment->>PG: INSERT payment_cash_collection
      Settle-)Audit: actor, amount, timestamp
      Audit->>PG: INSERT audit_entry
      Settle->>Outbox: append(PaymentCaptured)
      Outbox->>PG: INSERT payment_outbox
    end
    Outbox--)Kafka: PaymentCaptured
    Kafka--)Order: PENDING_PAYMENT to PAID (BR-ORD-01)
  else the amounts differ (E2)
    Payment->>PG: INSERT payment_cash_collection — what was ACTUALLY collected
    Settle-->>Ctl: recorded, order NOT transitioned, discrepancy escalated
    Note over Settle: Marking an order paid for an amount that was not collected<br/>misstates revenue (P7). The platform records reality and<br/>escalates rather than reconciling it away.
  end

  Note over Warehouse,Order: A2, E3 — delivery and collection are never conflated. An<br/>order reaches DELIVERED on delivery but stays unpaid until<br/>collection is recorded, and a delivered order with no<br/>recorded collection appears on an outstanding-collection<br/>report. It is never assumed paid because it was delivered.
  Note over Warehouse,Order: E1 — a refused delivery collects nothing. The goods return,<br/>the order is cancelled, its reservation released, and the<br/>goods restocked (UC-ORD-08, UC-INV-04). The refusal reason<br/>is recorded, because repeated refusals are a fraud signal.
```

**Why Cash On Delivery has its own diagram at all.** It is the one payment path with no provider in it, and therefore no signature, no attempt reference, and no callback. The controls that the provider flow gets for free — a reference that makes duplicates detectable, a signature that authenticates the counterparty — have to be replaced by authorisation and audit, which is why both appear explicitly above. `BR-PAY-03` also confines the method to where it is economic, because it carries the highest collection risk of any method the platform offers.

---

## 5. UC-PAY-06 — Process Refund

| | |
|---|---|
| **Use cases** | `UC-PAY-06` main success · `UC-ORD-08` · `UC-ORD-09` |
| **Business rules** | `BR-PAY-01` · `BR-PAY-02` · `BR-ORD-01` · `BR-AUD-01` |
| **Quality** | `NFR-REL-01` · `NFR-REL-04` · `NFR-OBS-01` |
| **Problems** | `P7` · `P16` · `P17` |

```mermaid
sequenceDiagram
  autonumber
  actor Support as Support Agent
  participant Ctl as PaymentController
  participant Refund as ProcessRefundService
  participant Authz as AuthorizationService
  participant Payment
  participant RefundEntity as Refund
  participant Processor as PaymentProcessor
  actor Gateway as Payment Gateway
  participant Audit as AuditListener
  participant Outbox as OutboxRepository
  participant PG as PostgreSQL
  participant Order

  Support->>Ctl: POST /api/v1/payments/{paymentId}/refunds<br/>amount and REASON
  Note over Ctl: A2 — cancellation (UC-ORD-08) and an accepted return<br/>(UC-ORD-09) enter the same service automatically,<br/>attributed to that action's actor rather than a new approval.
  Ctl->>Refund: refund(paymentId, amount, reason, actor, correlationId)

  Refund->>Refund: a reason is MANDATORY (E6)
  Note over Refund: BR-AUD-01, P17 — a refund without a recorded reason<br/>cannot answer "who did this, when, and why".
  Refund->>Authz: authorise(actor, PAYMENT_REFUND)
  Authz-->>Refund: permitted
  Note over Authz: E2, P16 — refund approval is one of the highest-value<br/>authorities in the platform and a standing fraud risk.<br/>A refused attempt is recorded.

  Refund->>Payment: captured amount, plus refunds already issued
  Payment-->>Refund: captured, refundedToDate
  alt requested is at most captured minus refundedToDate
    rect rgba(124,92,255,0.08)
      Note over Refund,PG: TRANSACTION 1 — record BEFORE contacting the provider
      Refund->>RefundEntity: new refund, unique reference, status PENDING
      RefundEntity->>PG: INSERT payment_refund
      Refund-)Audit: actor, amount, reason, timestamp
      Audit->>PG: INSERT audit_entry
    end
    Note over RefundEntity: E4 — because this precedes the provider call, the<br/>obligation is VISIBLE even if the request never reaches<br/>the provider. Same ordering, same reason, as §2.

    Refund->>Processor: refund(refundReference, Money)
    Processor->>Gateway: reverse the capture
    alt the provider accepts
      Gateway-->>Processor: refunded, provider reference
      rect rgba(124,92,255,0.08)
        Note over Refund,PG: TRANSACTION 2
        Refund->>RefundEntity: status REFUNDED, provider reference
        Refund->>Outbox: append(PaymentRefunded)
        Outbox->>PG: INSERT payment_outbox
      end
      Outbox--)Order: PaymentRefunded through Kafka
      opt the refund covers the FULL captured amount
        Order->>Order: to REFUNDED (BR-ORD-01)
      end
      Note over Order: A1 — a partial refund does NOT make the order REFUNDED.<br/>The remaining captured amount stands.
    else the provider rejects (E3)
      Gateway-->>Processor: rejected
      Refund->>RefundEntity: status FAILED, escalated for manual settlement
      Note over RefundEntity: The order is NOT marked REFUNDED. The obligation to the<br/>customer does not disappear because the provider declined.
    end
  else it would exceed what was captured (E1)
    Refund-->>Ctl: 422 — states the maximum refundable
    Note over Refund: BR-PAY-02. Refunding more than was taken is an<br/>unbounded loss with no counterparty to recover from (P7).
  end
```

**Why an audit failure does not block a refund, when it blocks a status advance.** [`01-Ordering.md`](./01-Ordering.md) §10 refuses a transition whose audit entry cannot be written; here, E7 says the refund **stands** and the missing entry is escalated as a compliance exception. The difference is whether anything external has already happened. A status transition is entirely internal and can safely be refused. A refund has already moved the customer's money, and reversing it to satisfy a logging failure would be worse than the gap it fixes. The use cases state both positions explicitly, and the asymmetry is deliberate rather than an inconsistency.

**Cash On Delivery refunds** (A3) have no provider capture to reverse. The refund is recorded and settled by the business's own process, and the order still reaches `REFUNDED` once settled — which is why the refund record, not the provider call, is what the order state follows.

---

## 6. Failure — The Provider Does Not Answer

**A timeout is not a decline.** This is the single most consequential distinction in the payment domain, and the reason `UC-PAY-02` E2 exists.

| | |
|---|---|
| **Use cases** | `UC-PAY-02` E2, E3 · `UC-PAY-03` A3 |
| **Business rules** | `BR-PAY-01` · `BR-ORD-01` · `BR-INV-02` |
| **Quality** | `NFR-REL-04` · `NFR-AVAIL-03` |
| **Problems** | `P7` |

```mermaid
sequenceDiagram
  autonumber
  participant Authorise as AuthorisePaymentService
  participant Attempt as PaymentAttempt
  participant Processor as PaymentProcessor
  actor Gateway as Payment Gateway
  participant PG as PostgreSQL
  participant Order
  participant StockItem

  Note over Order,StockItem: The order is PENDING_PAYMENT with its stock reservation HELD
  Authorise->>Attempt: record the attempt, status PENDING
  Attempt->>PG: INSERT payment_attempt — COMMITTED before the call
  Authorise->>Processor: authoriseAndCapture(attemptReference, Money)
  Processor->>Gateway: authorise and capture
  Note over Gateway: The provider may have captured. It may not have. The<br/>platform cannot tell, and guessing is what costs money.
  Gateway--)Processor: no response within the timeout
  Processor-->>Authorise: TIMEOUT — not a decline

  Authorise->>Attempt: mark UNRESOLVED, not FAILED
  Attempt->>PG: UPDATE payment_attempt SET status = UNRESOLVED
  Note over Attempt: The order stays PENDING_PAYMENT and the reservation stays<br/>HELD. The platform does NOT assume failure. Treating a<br/>timeout as a decline is how a customer is charged for an<br/>order the platform then cancels — precisely the partial<br/>failure P7 names.

  Note over Authorise,StockItem: RESOLUTION PATH A — the provider's result eventually arrives
  Gateway--)Authorise: callback quoting the attempt reference
  Note over Gateway,Authorise: §3, alternate flow A3. This is the path that settles a<br/>timed-out attempt, and it is WHY §2 does not assume failure.
  Authorise->>Attempt: apply the outcome once (BR-PAY-01)
  Authorise->>Order: to PAID, or to PAYMENT_FAILED

  Note over Authorise,StockItem: RESOLUTION PATH B — no result ever arrives
  Authorise->>Gateway: reconcile the attempt against the provider's records
  Gateway-->>Authorise: captured, or never captured
  Authorise->>Attempt: apply the reconciled outcome

  Note over Authorise,StockItem: RESOLUTION PATH C — the hold window elapses first
  Note over StockItem: 02-Inventory.md §5 — the Scheduler releases the reservation<br/>and the order is cancelled. If the capture is later found to<br/>have succeeded, it becomes a refund (§5), which is a<br/>bounded, visible obligation rather than a silent loss.
```

**The distinction between E2 and E3.** E3 — the provider is *unreachable*, so no request was made — is genuinely different and genuinely safer: no attempt reaches the provider, the order simply stays `PENDING_PAYMENT`, and the customer is told to retry shortly. Platform state is not corrupted by a provider outage (`NFR-AVAIL-03`). E2 — the request went out and no answer came back — is the hard case, because the platform now holds a claim it cannot evaluate. The design's answer is to make that uncertainty *explicit and durable* (`UNRESOLVED`) rather than collapsing it to a guess.

**Why the reservation is held rather than released.** Releasing on timeout would free stock that may belong to an order that was in fact paid. Holding it costs the business a strandable unit for a bounded window; releasing it costs an oversell and a cancelled paid order. `ADR-0011`'s hold window bounds the first, and nothing bounds the second.

**Why every resolution path converges on the same three services.** Whether the result arrives by callback, by reconciliation, or by expiry, it is applied through `ApplyPaymentResultService` and the same conditional update. There is no second code path that can apply a result differently, which is what makes `BR-PAY-01` hold across all three.

---

## 7. Failure — The Same Result Is Delivered Twice

Routine, not exceptional. Providers retry until acknowledged.

| | |
|---|---|
| **Use cases** | `UC-PAY-03` E1 |
| **Business rules** | `BR-PAY-01` |
| **Quality** | `NFR-REL-04` |
| **Decisions** | [Integration Contract §6.4](../../04-shared/Integration%20Contract.md) |

```mermaid
sequenceDiagram
  autonumber
  actor Gateway as Payment Gateway
  participant Ctl as PaymentNotificationController
  participant Apply as ApplyPaymentResultService
  participant Attempt as PaymentAttempt
  participant PG as PostgreSQL
  participant Kafka
  participant Order

  Gateway->>Ctl: callback for attempt reference R — CAPTURED
  Ctl->>Apply: apply(R, CAPTURED, amount, providerReference)
  Apply->>PG: UPDATE payment_attempt SET outcome = CAPTURED<br/>WHERE attempt_reference = R AND outcome IS NULL
  PG-->>Apply: 1 row updated
  Apply->>PG: INSERT payment_outbox — PaymentCaptured
  Apply-->>Ctl: applied
  Ctl-->>Gateway: 200
  Note over Gateway: The acknowledgement is lost in transit, so as far as the<br/>provider is concerned nothing was delivered.

  Gateway->>Ctl: the SAME callback, again
  Ctl->>Apply: apply(R, CAPTURED, amount, providerReference)
  Apply->>PG: UPDATE payment_attempt SET outcome = CAPTURED<br/>WHERE attempt_reference = R AND outcome IS NULL
  PG-->>Apply: 0 rows updated — outcome is no longer NULL
  Apply-->>Ctl: already applied, no action
  Ctl-->>Gateway: 200 — acknowledged again
  Note over Apply: BR-PAY-01. Applying a success twice would move the order<br/>twice, publish PaymentCaptured twice, and — for a refund —<br/>refund twice. The conditional update makes the second<br/>delivery a no-op rather than a second effect.

  Note over Gateway,Order: THE SAME PROBLEM ONE LAYER DOWN
  Kafka--)Order: PaymentCaptured
  Kafka--)Order: PaymentCaptured — redelivered, at-least-once
  Order->>Order: has this eventId been handled? if so, acknowledge and stop
  Note over Order: Integration Contract §6.4 — eventId is the idempotency key<br/>EVERY consumer keys on. Idempotency at the provider<br/>boundary does not make the Kafka boundary idempotent:<br/>they are two separate at-least-once channels and each<br/>needs its own defence.
```

**Why acknowledging a duplicate with `200` is correct.** A provider that receives an error keeps retrying, and an endpoint that returns `409` on a duplicate turns a harmless repeat into an escalating retry storm. The contract is "apply once, acknowledge always". The one case that must **not** be acknowledged is E6 — a result the platform genuinely failed to record — because there the retry is exactly what is wanted.

---

## 8. Failure — A Capture With No Order

The case that must never be discarded.

| | |
|---|---|
| **Use cases** | `UC-PAY-02` E4 · `UC-PAY-03` E2, E5 |
| **Business rules** | `BR-PAY-01` · `BR-PAY-02` |
| **Quality** | `NFR-OBS-01` |
| **Problems** | `P7` · `P17` |

```mermaid
sequenceDiagram
  autonumber
  actor Gateway as Payment Gateway
  participant Ctl as PaymentNotificationController
  participant Verify as CallbackVerificationService
  participant Apply as ApplyPaymentResultService
  participant Unmatched as UnmatchedPaymentRegister
  participant Audit as AuditListener
  participant PG as PostgreSQL
  actor Support as Support Agent

  Gateway->>Ctl: callback — CAPTURED, attempt reference R
  Ctl->>Verify: verify the signature
  Verify-->>Ctl: authentic
  Note over Verify: Authenticity is established FIRST. What follows is a<br/>genuine statement from the provider that money moved,<br/>whatever the platform's own records say.
  Ctl->>Apply: apply(R, CAPTURED, amount)
  Apply->>PG: SELECT payment_attempt WHERE attempt_reference = R
  PG-->>Apply: no attempt matches

  rect rgba(124,92,255,0.08)
    Note over Apply,PG: ONE PostgreSQL transaction
    Apply->>Unmatched: record — amount, provider reference, raw outcome, received time
    Unmatched->>PG: INSERT payment_unmatched
    Apply-)Audit: unmatched capture recorded
    Audit->>PG: INSERT audit_entry
  end
  Apply-->>Ctl: recorded as unmatched
  Ctl-->>Gateway: 200 — acknowledged, so the provider stops retrying
  Note over Apply: It is NEVER discarded. An unrecorded capture is money<br/>taken from a customer that the business cannot see, which<br/>is the exact shape of P7.

  Support->>PG: GET /api/v1/unmatched-payments
  PG-->>Support: the reconciliation queue
  alt it belongs to a known order
    Support->>Apply: attribute the capture to that order
  else it belongs to nothing
    Support->>Apply: refund it (§5, alternate flow A4)
    Note over Apply: A4 — a refund recorded against the RECONCILIATION rather<br/>than an order, because there is no order to attach it to.
  end
```

**Why acknowledging is right even though nothing was applied.** The provider's obligation ends when it has delivered the result, and refusing to acknowledge would produce an indefinite retry loop that fixes nothing — the attempt will not appear by being told about again. Durably recording the capture and acknowledging is what converts an invisible loss into a visible work item.

**Why a capture against a cancelled order lands here too.** E5: the order was cancelled while the result was in flight. The result is recorded and escalated rather than dropped, because a capture against a cancelled order is money to be refunded (§5), not a result to be ignored. Both routes end in the same reconciliation queue, which is deliberate — it is the one place where money the platform holds but cannot explain is visible in a single list.

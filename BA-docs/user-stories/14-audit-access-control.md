# Audit & Access Control — User Stories (`AUD`)

**Document type:** User Story Specification — domain
**Related documents:** [`README.md`](./README.md) (index and template) · [`../use-cases/14-audit-access-control.md`](../use-cases/14-audit-access-control.md) (source use cases) · [`../srs.md`](../srs.md)
**Audience:** Product Management, Engineering, Quality Assurance, Security

These four stories are included by nearly every other story in this specification, exactly as their source use cases are included by nearly every other use case — see [`../use-cases/14-audit-access-control.md`](../use-cases/14-audit-access-control.md) §Domain Scope.

---

## US-AUD-01 — Record Audit Entry

**As** the platform, acting on behalf of any authorised actor
**I want** an append-only entry recorded for every significant business action
**So that** the business can always answer who did this, when, and why

**Realises:** `UC-AUD-01` · `FR-AUD-01`, `FR-AUD-02`, `FR-AUD-03`
**Priority:** Must

**Acceptance Criteria**
- Given a significant action — a product update, price change, inventory adjustment, order cancellation or advance, refund, promotion change, review moderation, account suspension, or role change, when it is performed, then an append-only entry captures the actor, action, entity, before and after values, an unambiguous time, and any stated reason, excluding credentials, payment instrument details, and tokens.
- Given the action originates from a system actor — the Scheduler, a carrier, or a payment provider, when recorded, then attribution is to that actor rather than a person.
- Given a Support Agent acts on a customer's behalf, when recorded, then both the agent and the customer are captured.
- Given read access to customer data or the audit trail, when it occurs, then the access itself is recorded.
- Given elevated authority is used outside a role's normal remit, when recorded, then the entry states that the elevated authority was exercised.
- Given the entry cannot be written and the action is still reversible, when this happens, then the action is not applied.
- Given the entry cannot be written and the action has already had irreversible external effect, when this happens, then the action stands and the missing entry is escalated immediately as a compliance exception.
- Given amendment or deletion of an entry is attempted by any role including Administrator, when attempted, then it is refused and the attempt itself is recorded as a security event.
- Given an action has no identifiable actor, when recorded, then the entry is attributed to the originating process and flagged for investigation.
- Given the configured retention period is reached, when it is, then the entry is expired by policy, itself recorded, and never deleted ad hoc.

---

## US-AUD-02 — Search Audit Trail

**As an** Administrator
**I want** to search the audit trail by actor, entity, action, or time range
**So that** I can investigate a past action or resolve a dispute with evidence

**Realises:** `UC-AUD-02` · `FR-AUD-04`, `FR-AUD-01`
**Priority:** Must

**Acceptance Criteria**
- Given a role permitting audit access, when I search by actor, entity, action type, or time range, then matching entries are presented in time order with actor, action, entity, before and after values, time, and reason, and the search itself is recorded.
- Given I investigate one entity, when I search, then every action against that order, product, or account is returned.
- Given I investigate one actor, when I search, then every action by that user over the period is returned.
- Given entries correlate across domains for one business transaction, when I search, then they are presented together.
- Given I export results for an investigation, when I do, then the export is itself audited.
- Given I lack authority for audit access, when I attempt a search, then it is declined and the attempt recorded.
- Given no entries match, when searched, then an empty result is presented explicitly, distinguished from a failed search.
- Given the query spans an impractically large range, when submitted, then I am asked to narrow it rather than receiving a truncated set.
- Given entries fall outside the retention period, when queried, then I am told they are not available rather than receiving a silent partial record.
- Given amendment of an entry is attempted from this view, when attempted, then it is refused for every role and recorded.

---

## US-AUD-03 — Authorise Request via RBAC

**As** the platform, on behalf of any authenticated actor
**I want** every operation requiring authority checked against the acting user's roles
**So that** the same authorisation decision is reached whatever entry point a request arrives through

**Realises:** `UC-AUD-03` · `FR-AUD-05`, `FR-AUD-06`, `FR-AUD-08`
**Priority:** Must

**Acceptance Criteria**
- Given a request for an operation requiring authority, when it arrives, then the acting identity and current roles are established, inputs are validated before any business processing, and the operation proceeds only once the roles confer the required authority.
- Given ownership-scoped data such as a cart, order, review, or notification, when accessed, then authority derives from ownership and every scoped read is filtered to the acting party.
- Given a Support Agent or Administrator acting on records they do not own, when they act, then authority derives from role and the access is audited.
- Given an unauthenticated request for browsing, search, or reading reviews, when it arrives, then it is permitted where explicitly allowed and refused otherwise.
- Given a user holding several roles, when authority is evaluated, then it is the union of the roles held.
- Given the acting roles do not confer the required authority, when checked, then the request is refused with the same decision reached whatever entry point it arrived through.
- Given ownership-scoped data belonging to another party is requested, when attempted, then it is refused with the same response as for data that does not exist, and the attempt is recorded.
- Given identity cannot be established, when checked, then the request is refused as unauthenticated.
- Given input fails validation, when checked, then the request is refused before any business processing occurs.
- Given roles changed since the session's token was issued, when checked, then the current roles govern.
- Given self-elevation is attempted, when detected, then it is refused and recorded as a security event.
- Given authorisation cannot be determined, when evaluated, then the request is refused — an indeterminate decision is never resolved as permitted.

---

## US-AUD-04 — Enforce API Rate Limit

**As** the platform, on behalf of every caller
**I want** requests limited per caller and endpoint
**So that** the platform stays responsive and resistant to guessing and abuse

**Realises:** `UC-AUD-04` · `FR-AUD-07`
**Priority:** Must

**Acceptance Criteria**
- Given an externally originated request, when it arrives, then the caller is identified, the applicable limit determined, and the request is counted and allowed to proceed while within it.
- Given login, registration, password reset, or voucher validation, when limited, then a stricter limit applies than for general endpoints.
- Given an authenticated caller, when limited, then a higher allowance applies than for an anonymous caller.
- Given a planned peak such as a flash sale, when configured, then limits are raised ahead of it.
- Given a caller approaching their limit, when checked, then they are told how much allowance remains.
- Given the limit is exceeded, when checked, then the request is rejected without being processed, and the caller is told when to retry.
- Given correct credentials are presented beyond the limit, when checked, then the request is still rejected.
- Given sustained excess from one caller, when detected, then it is recorded as a security event and may attract a longer block.
- Given a legitimate traffic surge from many distinct customers during a peak event, when this happens, then limits are applied per caller, not throttled as an aggregate.
- Given the caller cannot be identified, when checked, then the most restrictive applicable limit is applied.
- Given rate limiting itself becomes unavailable, when this happens, then requests proceed rather than the platform closing entirely, and the loss of the control is escalated immediately.

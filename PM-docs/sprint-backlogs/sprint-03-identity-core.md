# Sprint 03 — Identity: Registration & Sign-in

**Release:** R1 · **Gate:** **`G1` — Contract Sync** · **Backend 20 pts · Frontend 20 pts**
**Related documents:** [`../release-plan.md`](../release-plan.md) · [`../integration-plan.md`](../integration-plan.md) · [`../../BA-docs/user-stories/01-customer-identity.md`](../../BA-docs/user-stories/01-customer-identity.md)

---

## Sprint Goal

> **A customer can register, verify their email, sign in, and sign out — against the real API.**

The first sprint with user stories. `identity` is first because [`Module Dependency Diagram.md`](../../SA-docs/02-backend/Module%20Dependency%20Diagram.md) §3.2 makes all twelve other modules depend on it: every context calls `AuthorizationService` from its application layer before executing a command. It cannot be reordered later.

**This is also the first velocity measurement worth having**, and the plan is re-baselined against it ([`../release-plan.md`](../release-plan.md) §8).

## Committed Items

| Lane | ID | Item | Pts |
|---|---|---|---:|
| BE | `US-CUS-01` | Register Customer Account | 5 |
| BE | `US-CUS-02` | Verify Email Address | 3 |
| BE | `US-CUS-03` | Log In | 5 |
| BE | `US-CUS-04` | Log Out | 2 |
| BE | `EN-WIRE-2` | Redis two-instance topology; cache-aside and rate-limiter infrastructure | 5 |
| FE | `US-CUS-01` | Register — `/register` | 3 |
| FE | `US-CUS-02` | Verify email — `/verify-email` | 2 |
| FE | `US-CUS-03` | Sign in — `/sign-in` | 3 |
| FE | `US-CUS-04` | Sign out — account menu action | 1 |
| FE | `EN-FE-DS-2` | Form, EmptyState, Skeleton, Badge, motion + reduced-motion baseline | 11 |

---

## Backend Lane

### Module scaffold
- [ ] `identity` module: `api/`, `application/`, `domain/`, `infrastructure/`
- [ ] `Account` aggregate with its invariants in `domain/`, testable with no Spring context
- [ ] Flyway migration for `identity_*` tables

### `US-CUS-01` Register (5 pts) — `registerAccount`
- [ ] Main scenario plus **every** exception flow in the use case
- [ ] Password policy enforced in the domain, not the controller
- [ ] Duplicate-email handling that **does not disclose whether an account exists**
- [ ] L1 tests naming each `BR-CUS-*` id touched

### `US-CUS-02` Verify Email (3 pts) — `verifyEmailAddress`, `resendEmailVerification`
- [ ] Single-use, expiring token
- [ ] Exception flows: expired, already used, unknown

### `US-CUS-03` Log In (5 pts) — `logIn`
- [ ] JWT issue + refresh rotation per [`ADR-0016`](../../SA-docs/01-system/ADR/ADR-0016-jwt-refresh-rotation-rbac.md)
- [ ] **Sign-in failure messaging is identical regardless of cause.** A rendering and a response rule, and it is easy to break by being helpful
- [ ] Lockout / throttling behaviour per the use case's exception flows

### `US-CUS-04` Log Out (2 pts) — `logOut`
- [ ] Clears the cookie **and** invalidates the refresh token server-side. Both halves, or it is not a logout

### `EN-WIRE-2` Redis (5 pts)
- [ ] Two Redis instances per [`ADR-0034`](../../SA-docs/01-system/ADR/ADR-0034-redis-two-instance-topology.md) — cache and rate-limiting are separate concerns with separate eviction behaviour
- [ ] Cache-aside helper
- [ ] Rate-limiter primitive, ready for `US-AUD-04` in Sprint 04

### Every story above
- [ ] Contract test both directions
- [ ] Permission-matrix cell asserted
- [ ] Audit entry where `UC-AUD-01` requires one

---

## Frontend Lane

### The `(auth)` group — `R3`, never cached
- [ ] `/register`, `/verify-email`, `/sign-in` complete against the mock
- [ ] Sign-out as an account-menu action, not a route
- [ ] **No response discloses whether an account exists.** Sign-in failures and reset requests read identically — a rendering rule, not a UX preference
- [ ] Failures use the empty-state pattern: concise explanation, clear primary action
- [ ] Targets ≥ 44 × 44 px with visible focus, named explicitly by [`ADR-0025`](../../SA-docs/01-system/ADR/ADR-0025-httponly-cookie-session.md) §4 for these screens
- [ ] `features/identity/` created — the first feature folder, on demand rather than up front

### `EN-FE-DS-2` (11 pts)
- [ ] Form (with field-level error rendering the problem+JSON validation shape drives), EmptyState, Skeleton, Badge
- [ ] Motion baseline honouring `prefers-reduced-motion` per [`ADR-0026`](../../SA-docs/01-system/ADR/ADR-0026-motion-and-accessibility-baseline.md)
- [ ] Vitest + axe on each

---

## Integration Risk

**The session cookie is the highest-risk contract in the plan and it is only half-built this sprint.** `logIn` issues it in Sprint 03; the frontend takes custody of it in Sprint 04 (`EN-FE-API-2`). Between them sits `G1`, which can verify that sign-in *succeeds* but cannot yet verify refresh, CSRF, or `SameSite` behaviour.

Do not let `G1` create the impression that session handling is proved. It is proved at **IH-1**, and that is why IH-1 exists.

## Gate `G1` — Contract Sync

Checklist: [`../integration-plan.md`](../integration-plan.md) §3, scoped to the identity domain.

| # | Check |
|---|---|
| 1 | Types regenerated, diff empty |
| 2 | Contract tests both directions for `registerAccount`, `verifyEmailAddress`, `resendEmailVerification`, `logIn`, `logOut` |
| 3 | `ECP_API_BASE_URL` pointed at the real `ecp-api`; all four `(auth)` routes render |
| 4 | A registration succeeds end to end and the verification token works |
| 5 | Sign-in failure messaging is byte-identical for unknown-account and wrong-password |
| 6 | Validation errors render into the right form fields |
| 7 | One correlation id visible in the browser request and the API log |
| 8 | Drift logged **and** `openapi.yaml` amended in the same session |

## Definition of Done

Every story reaches [`../definition-of-done.md`](../definition-of-done.md) §5 — both slices plus the gate.

**Velocity is recorded this sprint** and the release plan re-baselined against it. The sprint *order* does not change; only the dates do.

## Review Notes

<!-- filled at Sprint Review -->

## Retrospective

**Went well:**
**Change one thing:**
**Action:**

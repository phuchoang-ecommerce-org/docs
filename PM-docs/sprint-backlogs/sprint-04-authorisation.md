# Sprint 04 — Identity: Session, RBAC & Rate Limit

**Release:** R1 · **Gate:** none · **Backend 20 pts · Frontend 19 pts**
**Related documents:** [`../release-plan.md`](../release-plan.md) · [`../../SA-docs/01-system/Security.md`](../../SA-docs/01-system/Security.md) · [`../../BA-docs/use-cases/14-audit-access-control.md`](../../BA-docs/use-cases/14-audit-access-control.md)

---

## Sprint Goal

> **Authorisation and rate limiting hold on every path, and the browser never holds a token.**

`BR-AUD-02` requires that the same authorisation decision is reached whatever entry point a request arrives through — REST, scheduler, or Kafka consumer. That is a property of *where the check lives*, and it cannot be retrofitted per controller. It is built now, with two controllers in existence, rather than later with a hundred.

## Committed Items

| Lane | ID | Item | Pts |
|---|---|---|---:|
| BE | `US-CUS-05` | Refresh Authenticated Session | 5 |
| BE | `US-AUD-03` | Authorise Request via RBAC | 8 |
| BE | `US-AUD-04` | Enforce API Rate Limit | 5 |
| BE | `EN-OBS-1` | Structured logging, management port, liveness/readiness | 2 |
| FE | `US-CUS-05` | Serialised refresh | 5 |
| FE | `US-AUD-03` | `403`/`404` rendering | 2 |
| FE | `US-AUD-04` | `429` rendering | 2 |
| FE | `EN-FE-API-2` | Session custody: cookie, `/api/csrf`, serialised refresh, `/api/auth/*` | 10 |

---

## Backend Lane

### `US-AUD-03` Authorise Request via RBAC (8 pts)
- [ ] `AuthorizationService` in `identity.api`, called from **every other module's `application` layer**
- [ ] ArchUnit rule: `identity` may be named from another module's `application` package **and nowhere else**. A domain object that asks who the caller is has made authorisation part of a business invariant, which Domain Model §5.2 forbids
- [ ] The same decision reached through REST, scheduler and Kafka entry points — one test per path, per `AC-02`
- [ ] **`404` rather than `403` for another customer's resource**, so existence is not disclosed ([`Integration Contract.md`](../../SA-docs/04-shared/Integration%20Contract.md) §2.1)
- [ ] Role model and grants seeded per [`Permission Matrix.md`](../../SA-docs/04-shared/Permission%20Matrix.md)

### `US-AUD-04` Enforce API Rate Limit (5 pts)
- [ ] Redis-backed per-caller limiter on the rate-limiting instance
- [ ] `429` with the problem+JSON shape and a retry hint
- [ ] Limits per the `NFR-SEC-05` table

### `US-CUS-05` Refresh Authenticated Session (5 pts) — `renewSession`
- [ ] Refresh rotation per [`ADR-0016`](../../SA-docs/01-system/ADR/ADR-0016-jwt-refresh-rotation-rbac.md); a reused refresh token invalidates the chain
- [ ] `endAllOwnSessions` / `endAccountSessions` invalidate refresh chains server-side

### `EN-OBS-1` (2 pts)
- [ ] Management port; liveness and readiness. **Readiness fails while Flyway migrations run**

---

## Frontend Lane

### `EN-FE-API-2` — session custody (10 pts)

This is the single most security-sensitive item in the frontend lane.

- [ ] `lib/session/` with `import 'server-only'`. **Nothing outside it reads a session cookie** (rule `I-4`)
- [ ] The `ecp_session` cookie: HttpOnly, Secure, `SameSite` per route group — `Strict` on `(admin)`, `Lax` elsewhere
- [ ] **No access token ever reaches the browser.** [`ADR-0025`](../../SA-docs/01-system/ADR/ADR-0025-httponly-cookie-session.md) — verified at IH-1
- [ ] `/api/csrf` issuing the `ecp_csrf` companion token; signed double-submit
- [ ] CSRF required on **every** cookie-authenticated write, enforced in the fetch client so it cannot be forgotten per-action
- [ ] **Serialised refresh** — concurrent requests hitting an expired session trigger exactly one renewal, and the rest await it. A test drives concurrent requests and asserts one `renewSession` call
- [ ] `/api/auth/*` route handlers: sign-in, sign-out. This is a **closed list** ([`Routing.md`](../../SA-docs/03-frontend/Routing.md) §9) — a fifth entry is an amendment to `ADR-0036`
- [ ] `renewSession` and `logOut` have **no routes**: renewal is internal and never customer-initiated

### Error rendering
- [ ] `403` → the section or control is absent, and the page does not explain
- [ ] `404` on another customer's resource → `notFound()`, and it **must not** say "you don't have permission to view this order". That would undo the non-disclosure the status code was chosen to provide
- [ ] `429` → a designed screen with a retry affordance, not a generic error boundary

---

## Integration Risk

**Serialised refresh cannot be proved against the Prism mock.** Prism will not expire a session, will not rotate a token, and will not reject a reused one. The concurrency test this sprint runs against a local stub; the real property is verified at **IH-1**, against `ecp-api`.

State that in the Review. A green test here is evidence of the *frontend's* serialisation logic, not of the session contract holding end to end.

## Definition of Done

Every story reaches [`../definition-of-done.md`](../definition-of-done.md) §5. There is no gate this sprint, so the integration criterion is satisfied at `G2` (Sprint 05).

Additionally:
- [ ] The ArchUnit rule confining `identity` to `application` layers is in place and demonstrated failing on a planted `domain` import
- [ ] Concurrent-request test asserts exactly one refresh

## Review Notes

<!-- filled at Sprint Review -->

## Retrospective

**Went well:**
**Change one thing:**
**Action:**

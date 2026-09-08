# Sequence Diagrams — Identity & Access

**Document type:** Backend architecture specification
**Status:** **Proposed**
**Audience:** Backend Engineering, Frontend Engineering, Security Review
**Related documents:** [README](./README.md) · [UC-CUS](../../../BA-docs/use-cases/01-customer-identity.md) · [UC-AUD](../../../BA-docs/use-cases/14-audit-access-control.md) · [Security](../../01-system/Security.md) · [ADR-0016](../../01-system/ADR/ADR-0016-jwt-refresh-rotation-rbac.md) · [ADR-0025](../../01-system/ADR/ADR-0025-httponly-cookie-session.md)

---

## 1. Purpose

Identity & Access is the context every other context depends on ([Module Dependency Diagram §3.2](../Module%20Dependency%20Diagram.md)), and the only one whose diagrams span both the Next.js server and the backend as *separate* trusted parties.

The context is deliberately wider than "Customer": role-based access spans Guest, Customer, Staff, Warehouse Operator, Support Agent, and Administrator, which is why [Domain Model §3](../Domain%20Model.md) renames SA's "Customer" module to Identity & Access. Customer is one role within it, not the whole of it.

Two decisions produce almost everything below:

- **[`ADR-0016`](../../01-system/ADR/ADR-0016-jwt-refresh-rotation-rbac.md)** — a stateless access token so authorisation costs nothing on the hot path, plus a **stateful, rotating** refresh token, because `NFR-SEC-03`'s "reuse invalidates the session" requires server-side state by definition.
- **[`ADR-0025`](../../01-system/ADR/ADR-0025-httponly-cookie-session.md)** — the browser holds an httpOnly cookie and **the Next.js server is the only party that ever sees a token**.

Arrow and frame conventions: [`README.md`](./README.md) §3.1–§3.2.

---

## 2. UC-CUS-01, UC-CUS-02 — Register and Verify

| | |
|---|---|
| **Use cases** | `UC-CUS-01` · `UC-CUS-02` · `UC-NTF-01` |
| **Business rules** | `BR-CUS-01` · `BR-CUS-02` · `BR-CUS-04` |
| **Quality** | `NFR-SEC-02` · `NFR-SEC-05` |
| **Decisions** | [ADR-0012](../../01-system/ADR/ADR-0012-transactional-outbox-and-kafka.md) · [ADR-0017](../../01-system/ADR/ADR-0017-append-only-audit-log.md) |

```mermaid
sequenceDiagram
  autonumber
  actor Guest
  participant Next as Next.js server
  participant Ctl as AccountController
  participant Register as RegisterAccountService
  participant Account
  participant Audit as AuditListener
  participant Notify as NotificationListener
  participant Sender as NotificationSender
  actor ESP as Email Service Provider
  participant PG as PostgreSQL

  Guest->>Next: submit registration
  Next->>Ctl: POST /api/v1/accounts
  Note over Next,Ctl: request pipeline — 00-Overview.md §2
  Ctl->>Register: register(email, password, correlationId)

  rect rgba(124,92,255,0.08)
    Note over Register,PG: ONE PostgreSQL transaction
    Register->>Register: hash the password (NFR-SEC-02)
    Note over Register: The plaintext never leaves this call and is never logged.<br/>Account stores a CredentialHash value object, not a password.
    Register->>Account: create — status UNVERIFIED, role Customer
    Account->>PG: INSERT identity_account
    Note over Account,PG: BR-CUS-01 — uniqueness is a DATABASE constraint, not an<br/>application check. A check-then-insert loses the race<br/>between two simultaneous registrations of one address.
    Register->>Account: issue a single-use verification token with an expiry
    Account->>PG: INSERT identity_verification_token
    Register-)Audit: AccountRegistered
    Register-)Notify: AccountRegistered
  end
  Note over Register,Notify: ADR-0012 §4 — in-process, not Kafka. Local subscribers only.<br/>The payload carries the account id, roles, and status, and<br/>NEVER a credential hash or a token (NFR-SEC-07).

  Ctl-->>Next: 201 Created
  Next-->>Guest: check your email
  Note over Ctl: BR-CUS-04 — the response is identical whether or not the<br/>address was already registered. Distinguishing them turns<br/>registration into an account-existence oracle.

  Notify->>Sender: send the verification email
  Sender->>ESP: through EmailAdapter
  ESP-->>Guest: verification link

  Guest->>Next: follow the link
  Next->>Ctl: POST /api/v1/account-verifications — token
  Ctl->>Register: verify(token)
  alt the token is valid and unconsumed
    Register->>Account: status UNVERIFIED to VERIFIED, consume the token
    Account->>PG: UPDATE identity_account, UPDATE identity_verification_token
    Register-)Audit: AccountVerified
    Ctl-->>Next: 200 OK
  else expired or already consumed
    Ctl-->>Next: 410 — offer a resend
    Note over Ctl: A resend issues a NEW token and invalidates the old one,<br/>so an expired link in an old email cannot be revived.
  end
```

**Why verification gates ordering rather than login.** `BR-CUS-02` blocks order placement and review submission, not authentication. An unverified customer can browse and build a cart (§3, A1), which preserves the work they have already done and gives them a reason to complete verification. Blocking login instead would discard the session and the cart for a customer who has done nothing wrong.

**Why uniqueness is a constraint rather than a check.** Two simultaneous registrations of the same address both pass an application-level "does this email exist" check and both insert. The unique index is the only thing that makes exactly one win — the same reasoning as the idempotency key in [`01-Ordering.md`](./01-Ordering.md) §8 and the `@Version` column in §7 of that document. Three different invariants, one mechanism: let the database arbitrate.

---

## 3. UC-CUS-03 — Log In

| | |
|---|---|
| **Use cases** | `UC-CUS-03` main success · `UC-CRT-05` · `UC-AUD-04` |
| **Business rules** | `BR-CUS-02` · `BR-CUS-03` · `BR-CUS-04` |
| **Quality** | `NFR-SEC-02` · `NFR-SEC-03` · `NFR-SEC-05` · `NFR-SEC-06` |
| **Decisions** | [ADR-0015](../../01-system/ADR/ADR-0015-redis-cache-and-rate-limiting.md) · [ADR-0016](../../01-system/ADR/ADR-0016-jwt-refresh-rotation-rbac.md) · [ADR-0025](../../01-system/ADR/ADR-0025-httponly-cookie-session.md) |
| **Problems** | `P1` |

```mermaid
sequenceDiagram
  autonumber
  actor Guest
  participant Browser
  participant Next as Next.js server
  participant NGINX as nginx
  participant RateLimit as RateLimitFilter
  participant Ctl as SessionController
  participant Login as LoginService
  participant Account
  participant Merge as MergeGuestCartService
  participant Redis
  participant PG as PostgreSQL

  Guest->>Browser: email and password
  Browser->>Next: POST /login — form action, guest cart cookie attached
  Next->>NGINX: POST /api/v1/sessions
  NGINX->>RateLimit: authentication bucket
  RateLimit->>Redis: INCR on the AUTHENTICATION limit
  alt within the limit
    Redis-->>RateLimit: continue
  else exceeded (E2)
    RateLimit-->>Next: 429 plus Retry-After
    Note over RateLimit: NFR-SEC-05 — stricter than the general limit, and applied<br/>BEFORE credentials are evaluated. Correct credentials do<br/>not bypass it, which is what makes it a brute-force defence<br/>rather than a throttle.
  end

  RateLimit->>Ctl: POST /api/v1/sessions
  Ctl->>Login: authenticate(email, password, correlationId)
  Login->>Account: load by email, verify against the stored hash
  alt credentials match and the account is active
    Account-->>Login: account, roles, verification status
    rect rgba(124,92,255,0.08)
      Note over Login,PG: ONE PostgreSQL transaction
      Login->>Login: mint a SHORT-LIVED access token carrying subject and roles
      Login->>PG: INSERT identity_refresh_token — server-side record
      Note over Login,PG: ADR-0016 — the access token is stateless and verifiable<br/>without a lookup. The refresh token is STATEFUL, because<br/>rotation and reuse detection are impossible without<br/>server-side state.
    end
    Login-->>Ctl: access token, refresh token, authenticated context

    opt a guest cart cookie was present (P1)
      Ctl->>Merge: merge(guestCartId, customerId)
      Merge-->>Ctl: merged, or FAILED
      Note over Merge: E4 — login SUCCEEDS either way. The merge is a subordinate<br/>goal, and its failure never denies access. A failed merge<br/>preserves the guest cart for retry and tells the customer<br/>their items were not carried over. See 05-Cart-Catalog-Search.md §5.
    end

    Ctl-->>Next: tokens plus context
    Next->>Next: store BOTH tokens server-side
    Next-->>Browser: Set-Cookie session — httpOnly, Secure,<br/>SameSite Lax (Strict for admin routes), scoped path, explicit expiry
    Note over Next,Browser: ADR-0025 — no token reaches client JavaScript, so an XSS<br/>flaw cannot exfiltrate the session. The cost is that CSRF<br/>protection becomes MANDATORY, since cookies are sent<br/>automatically, and that the Next.js server joins the<br/>trusted computing base.
    opt the account is unverified (A1)
      Note over Next: A session with RESTRICTED authority is issued: browse, cart,<br/>and re-request verification are permitted, while BR-CUS-02<br/>blocks placement and review. The restriction and its remedy<br/>are stated plainly rather than surfacing later as a refusal.
    end
  else credentials do not match (E1), or the account is suspended (E3)
    Login-->>Ctl: a single generic failure
    Ctl-->>Next: 401
    Note over Login: BR-CUS-04 — identical response whether the address is<br/>unknown or the password is wrong, and the comparison is<br/>constant-time so timing does not distinguish them either.<br/>E3 — a suspended account is reported as unavailable without<br/>the reason, which may relate to an open fraud investigation.
  end
```

**Why the role in the cookie is display data only.** The Next.js server may pass a role hint so the UI can decide what to render. `NFR-SEC-01` keeps every authorisation decision server-side in `AuthorizationService`, and hiding a control the user cannot use is courtesy, never enforcement — §8 is what actually enforces it.

**Why guest carts are cookie-identified rather than part of the session.** A guest cart exists before any account does. Identifying it by its own cookie keeps it outside the authenticated session entirely, which is what lets `P1`'s merge-on-login be a Cart concern rather than an Identity one — exactly as [Solution Architecture §4](../../01-system/Solution%20Architecture.md)'s Actors table anticipates.

---

## 4. UC-CUS-05 — Refresh the Authenticated Session

| | |
|---|---|
| **Use cases** | `UC-CUS-05` main success |
| **Business rules** | `BR-CUS-03` |
| **Quality** | `NFR-SEC-03` |
| **Decisions** | [ADR-0016](../../01-system/ADR/ADR-0016-jwt-refresh-rotation-rbac.md) · [ADR-0025](../../01-system/ADR/ADR-0025-httponly-cookie-session.md) |
| **Problems** | `P16` |
| **Failure path** | §7 |

```mermaid
sequenceDiagram
  autonumber
  actor Customer
  participant TabA as Browser tab A
  participant TabB as Browser tab B
  participant Next as Next.js server
  participant Ctl as SessionController
  participant Refresh as RefreshSessionService
  participant Account
  participant PG as PostgreSQL

  TabA->>Next: a request whose access token has expired
  TabB->>Next: another request, same instant, same expired token

  rect rgba(124,92,255,0.08)
    Note over Next: SERIALISED IN THE NEXT.JS SERVER — one refresh in flight per session
    Next->>Next: tab B waits on tab A's in-flight refresh
  end
  Note over Next: ADR-0016 §5 identifies the multi-tab race as a<br/>FALSE-POSITIVE logout risk: two tabs presenting the same<br/>refresh token would trip reuse detection and log the<br/>customer out, correctly by the rule and baffling in<br/>practice. ADR-0025 makes serialising it a server-side<br/>concern, which is only possible because the server holds<br/>the tokens. This is a real coordination point: done wrong<br/>it either logs users out or holds requests longer than needed.

  Next->>Ctl: POST /api/v1/session-renewals — refresh token
  Ctl->>Refresh: renew(refreshToken, correlationId)
  Refresh->>PG: SELECT identity_refresh_token WHERE token_hash = ?
  alt it exists, is unexpired, and is unconsumed
    PG-->>Refresh: valid record
    Refresh->>Account: load current status and roles
    alt the account is active
      Account-->>Refresh: ACTIVE, current roles
      rect rgba(124,92,255,0.08)
        Note over Refresh,PG: ONE PostgreSQL transaction — rotation
        Refresh->>PG: UPDATE identity_refresh_token SET consumed_at = now()<br/>WHERE id = ? AND consumed_at IS NULL
        PG-->>Refresh: 1 row updated
        Refresh->>PG: INSERT the successor refresh token, chained to its predecessor
      end
      Note over Refresh,PG: The conditional update is the rotation guarantee. Two<br/>simultaneous presentations of one token cannot both consume<br/>it — the same conditional-update mechanism as the payment<br/>callback in 03-Payment.md §7.
      Refresh->>Refresh: mint a new access token carrying the CURRENT roles
      Note over Refresh: A1, P16 — roles are re-read at every refresh, so an<br/>authority revoked by UC-ADM-06 survives in an outstanding<br/>token for at most one refresh interval. That interval is<br/>the revocation latency ADR-0016 §5 records as a NEGATIVE<br/>consequence, and shortening it increases refresh traffic.<br/>It is a real trade-off, not a free setting.
      Refresh-->>Next: new access token, new refresh token
      Next->>Next: replace both, server-side. The cookie is unchanged.
      Next-->>TabA: response
      Next-->>TabB: response, using the same new token
    else the account was suspended since issue (E3)
      Refresh->>PG: invalidate ALL tokens for this account
      Refresh-->>Next: 401 — full authentication required
    end
  else expired (E1), or already consumed (E2)
    PG-->>Refresh: invalid
    Note over Refresh: E1 requires full authentication. E2 is a different matter<br/>entirely and is drawn in §7.
  end
```

**Why rotation needs server-side state at all.** A purely stateless scheme cannot detect that a token has already been used, because there is nowhere to record it. `NFR-SEC-03` requires that reuse of a consumed refresh token invalidates the session, so the refresh token *must* be stateful. [`ADR-0016`](../../01-system/ADR/ADR-0016-jwt-refresh-rotation-rbac.md) accepts the hybrid — stateless access, stateful refresh — precisely to keep the lookup off the hot path while still making reuse detectable. The refresh-token store is consequently a stateful component on the authentication path, with its own availability, retention, and cleanup concerns.

---

## 5. UC-CUS-04 — Log Out

| | |
|---|---|
| **Use cases** | `UC-CUS-04` |
| **Business rules** | `BR-CUS-03` |
| **Decisions** | [ADR-0016](../../01-system/ADR/ADR-0016-jwt-refresh-rotation-rbac.md) · [ADR-0025](../../01-system/ADR/ADR-0025-httponly-cookie-session.md) |

```mermaid
sequenceDiagram
  autonumber
  actor Customer
  participant Browser
  participant Next as Next.js server
  participant Ctl as SessionController
  participant Logout as LogoutService
  participant PG as PostgreSQL

  Customer->>Browser: log out
  Browser->>Next: POST /logout — cookie plus CSRF token
  Next->>Ctl: DELETE /api/v1/sessions/current
  Ctl->>Logout: invalidate(refreshToken, correlationId)
  alt the token is recognised
    Logout->>PG: UPDATE identity_refresh_token SET revoked_at = now()<br/>for this token and its whole successor chain
    PG-->>Logout: revoked
  else already ended or unrecognised (E1)
    Logout-->>Ctl: success, no action
    Note over Logout: The caller's goal — not being logged in — already holds.<br/>An error here only invites a retry that cannot help.
  end
  opt log out everywhere (A1)
    Logout->>PG: revoke EVERY refresh token for this account
  end
  Ctl-->>Next: 204
  Next-->>Browser: Set-Cookie session cleared, Max-Age 0
  Note over Next,Browser: ADR-0025 — the cookie is cleared AND the refresh token is<br/>invalidated server-side. Clearing the cookie alone leaves a<br/>perfectly valid session behind, recoverable by anyone<br/>holding the token.
  Note over Logout: E2 — if invalidation cannot be completed the session still<br/>ends for the caller and the token is recorded for retry.<br/>A token whose invalidation silently failed is a security<br/>exposure, and it must be VISIBLE rather than assumed gone.
  Note over Customer,PG: The access token is not revoked and stays valid until it<br/>expires (ADR-0016 §5). A short access-token lifetime is the<br/>only mitigation, and it is the same trade-off as §4.
```

---

## 6. UC-CUS-07 — Reset a Forgotten Password

| | |
|---|---|
| **Use cases** | `UC-CUS-07` · `UC-NTF-01` |
| **Business rules** | `BR-CUS-03` · `BR-CUS-04` |
| **Quality** | `NFR-SEC-02` · `NFR-SEC-05` |

```mermaid
sequenceDiagram
  autonumber
  actor Guest
  participant Next as Next.js server
  participant Ctl as PasswordResetController
  participant Reset as PasswordResetService
  participant Account
  participant Notify as NotificationListener
  actor ESP as Email Service Provider
  participant PG as PostgreSQL

  Guest->>Next: request a password reset for an address
  Next->>Ctl: POST /api/v1/password-reset-requests
  Ctl->>Reset: request(email, correlationId)
  Reset->>Account: look the address up
  opt the account exists
    Reset->>PG: INSERT identity_password_reset_token<br/>single-use, short expiry, hashed at rest
    Reset-)Notify: send the reset link
    Notify->>ESP: through EmailAdapter
  end
  Ctl-->>Next: 202 Accepted — the SAME response either way
  Note over Ctl: BR-CUS-04 — an address that does not exist produces an<br/>identical response and comparable timing. Anything else<br/>turns this endpoint into an account-existence oracle, and<br/>it is unauthenticated and public.

  Guest->>Next: follow the link, choose a new password
  Next->>Ctl: POST /api/v1/password-resets — token plus new password
  Ctl->>Reset: reset(token, newPassword)
  alt the token is valid, unexpired, and unconsumed
    rect rgba(124,92,255,0.08)
      Note over Reset,PG: ONE PostgreSQL transaction
      Reset->>Account: replace the CredentialHash (NFR-SEC-02)
      Account->>PG: UPDATE identity_account
      Reset->>PG: UPDATE identity_password_reset_token SET consumed_at = now()<br/>WHERE id = ? AND consumed_at IS NULL
      Reset->>PG: REVOKE every refresh token for this account
      Note over Reset,PG: BR-CUS-03 — a password reset ends every existing session.<br/>Resetting because an account may be compromised, and then<br/>leaving the attacker's session live, defeats the point.
    end
    Ctl-->>Next: 200 — please sign in again
  else invalid, expired, or consumed
    Ctl-->>Next: 410 — request a new link
  end
```

---

## 7. Failure — A Consumed Refresh Token Is Presented Again

`NFR-SEC-03`'s reuse detection, and the reason rotation is worth its cost.

| | |
|---|---|
| **Use cases** | `UC-CUS-05` E2 · `UC-AUD-01` |
| **Business rules** | `BR-CUS-03` |
| **Quality** | `NFR-SEC-03` |
| **Decisions** | [ADR-0016](../../01-system/ADR/ADR-0016-jwt-refresh-rotation-rbac.md) · [ADR-0025](../../01-system/ADR/ADR-0025-httponly-cookie-session.md) |

```mermaid
sequenceDiagram
  autonumber
  actor Customer
  actor Attacker
  participant Next as Next.js server
  participant Refresh as RefreshSessionService
  participant Audit as AuditListener
  participant PG as PostgreSQL

  Note over Customer,PG: Token T1 has been stolen — from a backup, a log, or a<br/>compromised Next.js process. ADR-0025 makes browser theft<br/>via XSS impossible, which is what makes this path RARE<br/>rather than routine.

  Customer->>Next: continue the session
  Next->>Refresh: renew(T1)
  Refresh->>PG: consume T1, issue T2
  PG-->>Refresh: T1 consumed, T2 active
  Refresh-->>Next: T2

  Attacker->>Refresh: renew(T1) — the stolen copy
  Refresh->>PG: UPDATE identity_refresh_token SET consumed_at = now()<br/>WHERE token_hash = T1 AND consumed_at IS NULL
  PG-->>Refresh: 0 rows updated — ALREADY CONSUMED

  rect rgba(124,92,255,0.08)
    Note over Refresh,PG: ONE PostgreSQL transaction — the whole chain dies
    Refresh->>PG: REVOKE the entire token chain for this session,<br/>including T2 and every successor
    Refresh-)Audit: security event — refresh token reuse detected
    Audit->>PG: INSERT audit_entry
  end
  Refresh-->>Attacker: 401
  Note over Refresh: BR-CUS-03, NFR-SEC-03 — reuse invalidates the WHOLE<br/>chain, not just the presented token. Revoking only T1<br/>would leave the thief's T2 working if the thief refreshed<br/>first, and there is no way to tell which party is which.

  Customer->>Next: the next request
  Next->>Refresh: renew(T2)
  Refresh-->>Next: 401 — the chain was revoked
  Next-->>Customer: signed out, please sign in again
  Note over Customer: The legitimate customer is inconvenienced ONCE. The thief<br/>loses the session. Because the platform cannot distinguish<br/>them, ending the session for both is the only safe choice —<br/>and it converts a silent compromise into a DETECTED incident<br/>with an audit entry behind it.
```

**Why the chain is revoked rather than the token.** At the moment of detection the platform has two parties presenting descendants of one token and no way to tell which is legitimate. Revoking only the reused token leaves whichever party refreshed most recently in possession of a working session — and that is as likely to be the attacker as the customer. Killing the chain is the only choice that does not depend on guessing.

**Why this is a genuine defence rather than a formality.** It only works if a stolen token is *rare and detectable*. [`ADR-0025`](../../01-system/ADR/ADR-0025-httponly-cookie-session.md) is what makes it so: with no token in client JavaScript, an XSS flaw cannot exfiltrate the session, so the paths by which T1 leaks are few and mostly server-side. Rotation and reuse detection on a token that any script could read would be theatre.

---

## 8. Failure — Authorisation Denied

`UC-AUD-03`, from the refusing side. The counterpart to the permitted branch in [`00-Overview.md`](./00-Overview.md) §2.

| | |
|---|---|
| **Use cases** | `UC-AUD-03` · `UC-AUD-01` |
| **Business rules** | `BR-AUD-01` · `BR-AUD-02` |
| **Quality** | `NFR-SEC-01` · `NFR-OBS-01` |
| **Decisions** | [ADR-0016](../../01-system/ADR/ADR-0016-jwt-refresh-rotation-rbac.md) · [ADR-0017](../../01-system/ADR/ADR-0017-append-only-audit-log.md) |
| **Problems** | `P5` · `P16` · `P17` |

```mermaid
sequenceDiagram
  autonumber
  actor Staff
  participant Next as Next.js server
  participant Ctl as PaymentController
  participant Refund as ProcessRefundService
  participant Authz as AuthorizationService
  participant Audit as AuditListener
  participant PG as PostgreSQL

  Note over Staff: A Staff member attempts a refund, which SRS §2.3 grants to<br/>Support and Administrator only.
  Staff->>Next: approve a refund
  Note over Next: The UI never offered this control — but hiding it is<br/>courtesy, not enforcement (NFR-SEC-01). The request can be<br/>issued directly against the API, and frequently is.
  Next->>Ctl: POST /api/v1/payments/{paymentId}/refunds
  Ctl->>Refund: refund(...)
  Refund->>Authz: authorise(actor, PAYMENT_REFUND)
  Authz->>Authz: evaluate the role and operation against the permission matrix
  Authz-->>Refund: DENIED

  rect rgba(124,92,255,0.08)
    Note over Authz,PG: ONE PostgreSQL transaction
    Authz-)Audit: security event — actor, operation, resource, outcome DENIED
    Audit->>PG: INSERT audit_entry, append-only
  end
  Note over Audit: A refused attempt is evidence, and P17 wants it kept.<br/>One denial is a mis-click. A pattern of them is<br/>reconnaissance, and it is only visible if they are recorded.

  Refund-->>Ctl: AccessDenied — NOTHING was read or written
  Ctl-->>Next: 403 ECP-SEC-4030
  Next-->>Staff: you do not have permission for this action
  Note over Ctl: The response does not disclose whether the payment exists,<br/>because that would make an unauthorised caller a resource<br/>enumeration oracle.

  Note over Staff,PG: BR-AUD-02, P5 — the SAME AuthorizationService, reached<br/>from the same application layer, decides identically<br/>whether the request arrives from the storefront, the admin<br/>console, the Scheduler, or a Kafka consumer. None of them<br/>can reach a use case without passing it, because the call<br/>sits in the application service rather than the controller.
```

**Why authorisation lives in the application layer rather than the controller.** Controllers only exist for HTTP. The Scheduler advances order states, event consumers apply payment results, and neither passes through one. Putting the check in the application service is what makes `BR-AUD-02` hold for all four entry points — and it is the reason every one of the thirteen business modules carries a compile-time edge to `identity` ([Module Dependency Diagram §3.2](../Module%20Dependency%20Diagram.md)). That edge is not incidental coupling; it is the enforcement mechanism made structural.

**What this diagram does not defend against.** A role revoked *after* an access token was issued stays effective until that token expires ([ADR-0016](../../01-system/ADR/ADR-0016-jwt-refresh-rotation-rbac.md) §5). `AuthorizationService` evaluates the roles the token carries, not the roles the account currently holds. §4 shortens the window to one refresh interval; closing it entirely would require a datastore lookup on every request, which is exactly the cost the stateless access token exists to avoid. `AccountSuspended` and `AccountRoleChanged` events exist, and a deny-list for high-severity revocations is possible — at the price of reintroducing that lookup.

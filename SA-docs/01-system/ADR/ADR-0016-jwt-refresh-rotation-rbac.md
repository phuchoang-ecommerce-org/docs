# ADR-0016 — JWT Access Tokens with Rotating Refresh Tokens, RBAC at the Application Boundary

**Document type:** Architecture Decision Record
**Status:** Accepted
**Date:** 2026-09-06
**Deciders:** Solution Architecture
**Traces to:** `P16` · `P5` · `NFR-SEC-01` · `NFR-SEC-02` · `NFR-SEC-03` · `NFR-SEC-05` · `BR-CUS-03` · `BR-AUD-02` · `AC-02`
**Related documents:** [Solution Architecture](../Solution%20Architecture.md) · [Domain Model](../../02-backend/Domain%20Model.md) · [SRS](../../../BA-docs/srs.md)

---

## 1. Context and Problem Statement

`P16` requires every role to do exactly what its job requires — no more, no less. `NFR-SEC-01` makes it absolute and locates it: *"Every operation is authorised server-side against the acting user's roles. No operation relies on a client withholding it."* `AC-02` restates it as acceptance, and `BR-AUD-02` requires the same decision regardless of entry point.

[`Solution Architecture.md`](../Solution%20Architecture.md) §4 fixes six actor classes — Guest, Customer, Staff, Warehouse Operator, Customer Support Agent, Administrator — all entering through the same REST API, and states that the role authority table in SRS §2.3 is normative for `FR-AUD-05`: every row becomes an authorisation rule enforced at the API/application boundary, *never a client-side assumption*.

`NFR-SEC-03` adds the token lifecycle: access tokens short-lived, refresh tokens rotating on use, and **reuse of a consumed refresh token invalidates the session** (`BR-CUS-03`).

What remains to decide is the mechanism, and — more consequentially — *where in the layering* the authorisation check sits.

## 2. Decision Drivers

- `NFR-SEC-01` — server-side authorisation for every operation, verified per role per operation.
- `NFR-SEC-03` / `BR-CUS-03` — short-lived access tokens, rotating refresh tokens, reuse invalidates the session.
- `NFR-SEC-02` — passwords stored only as a one-way, salted, adaptive hash.
- `NFR-SEC-05` — stricter rate limits on authentication endpoints.
- `BR-AUD-02` — the same authorisation decision regardless of entry point.
- `Domain Model.md` §5.2 already specifies Identity & Access as an **Open Host Service**: a synchronous in-process `AuthorizationService` call from every other context's **application layer, never its domain layer**.

## 3. Considered Options

### Session mechanism

**Option 1 — Stateless JWT access token plus a stateful, rotating refresh token.** *(chosen)*

- **Pros:** The access token is verifiable without a datastore lookup, so authorisation costs nothing on the hot path — relevant under `NFR-SCAL-04` concurrency. The refresh token is stored server-side, which is what makes rotation and reuse-detection possible at all; `NFR-SEC-03`'s "reuse invalidates the session" requires server-side state by definition. Works uniformly for the web storefront, the admin console, and the future mobile client (SRS §8).
- **Cons:** A revoked or role-changed session remains valid until the access token expires. Hybrid statefulness — stateless access, stateful refresh — is two mechanisms to reason about.

**Option 2 — Server-side sessions with an opaque session id.**

- **Pros:** Immediate revocation; no token payload to leak; simplest reasoning.
- **Cons:** A session-store lookup on every request, on a path already budgeted at `NFR-PERF-01`'s 300 ms. Named nowhere upstream, whereas `NFR-SEC-03` describes access and refresh tokens explicitly.

**Option 3 — Long-lived JWT with no refresh token.**

- **Pros:** Simplest; fully stateless.
- **Cons:** Directly violates `NFR-SEC-03` — no rotation, no reuse detection, and a stolen token stays valid for its full life. Rejected.

### Authorisation placement

**Option A — In the application layer, via Identity & Access's `AuthorizationService` OHS.** *(chosen)* — the mechanism `Domain Model.md` §5.2 already specifies. Every context calls it before executing a command, from the application layer.

**Option B — In the web layer, on controllers (`@PreAuthorize`).** Convenient and idiomatic, but it ties the rule to an HTTP entry point. A scheduled job, an admin tool, or a Kafka consumer performing the same operation bypasses it — precisely the `P5` failure mode, and it makes `BR-AUD-02` false. Rejected as the *sole* location; retained as an additional coarse filter.

**Option C — In the domain layer, inside aggregates.** Puts the caller's identity into the domain model, coupling business invariants to an authorisation concern and violating [ADR-0005](./ADR-0005-clean-architecture-ports-and-adapters.md). `Domain Model.md` §5.2 explicitly excludes it. Rejected.

## 4. Decision Outcome

**Chosen: Option 1 + Option A.**

| Aspect | Commitment |
|---|---|
| Access token | Short-lived JWT carrying subject, roles, and expiry; signed and verified without a datastore lookup |
| Refresh token | Server-side record, **rotated on every use**; presenting a consumed token invalidates the whole session chain (`NFR-SEC-03`, `BR-CUS-03`) |
| Password storage | One-way, salted, computationally adaptive hash; never logged in any form (`NFR-SEC-02`, `NFR-SEC-07`) |
| Authorisation point | `AuthorizationService` OHS, called synchronously in-process from each context's **application layer** before a command executes |
| Web-layer checks | A coarse additional filter only — never the only check for any operation |
| Rate limiting | Redis-backed, stricter bucket on authentication endpoints ([ADR-0015](./ADR-0015-redis-cache-and-rate-limiting.md)), failing **closed** on auth |
| Role model | The six actors of `Solution Architecture.md` §4; SRS §2.3's authority table is normative and destined for `04-shared/Permission Matrix` |
| Guest sessions | A guest cart is a Cart-module concern, not a Customer-module one; on login the guest cart merges into the customer's (`P1`, SA §4) |

**Placing the check in the application layer is what makes `P5` and `BR-AUD-02` structural.** Because every entry point — REST controller, scheduled job, admin tooling, Kafka consumer, future mobile client — reaches business logic through an `@ApplicationService` ([ADR-0007](./ADR-0007-jmolecules-tactical-ddd.md)), and every `@ApplicationService` calls `AuthorizationService` before executing, there is exactly one place a rule can be enforced and no way to add an entry point that skips it.

**Tokens never appear in logs, error messages, or audit entries** (`NFR-SEC-07`). Audit records carry business fields only ([ADR-0017](./ADR-0017-append-only-audit-log.md)).

## 5. Consequences

### Positive

- `NFR-SEC-01` is verifiable exactly as the SRS asks — per role, per operation — because REST gives one endpoint per operation ([ADR-0003](./ADR-0003-rest-api-style.md)) and each maps to one application service.
- `BR-AUD-02` and `AC-02` hold by construction, not by convention.
- Refresh-token reuse detection turns a stolen token into a detected incident that ends the session, rather than a silent compromise.
- Access-token verification needs no datastore round trip, so authorisation does not consume the `NFR-PERF-01` budget.

### Negative

- **Revocation is not immediate.** A suspended account or a changed role stays effective until the access token expires. The mitigation is a short access-token lifetime — which increases refresh traffic, so the lifetime is a real trade-off between revocation latency and load, not a free setting. `AccountSuspended` and `AccountRoleChanged` events exist (`Domain Model.md` §9) and a deny-list for high-severity revocations is possible, but that reintroduces a lookup on the hot path.
- **The refresh-token store is a stateful component on the authentication path.** Its availability affects session continuity, and it needs its own retention and cleanup.
- **Rotation can produce false-positive session invalidation.** A client that races two refreshes — a mobile app resuming on a flaky network, or two browser tabs — can present the same refresh token twice and be logged out, correctly by the rule but confusingly for the user. Client-side refresh must be serialised ([ADR-0025](./ADR-0025-httponly-cookie-session.md)).
- **Every application service must remember to call `AuthorizationService`.** A missing call is a silent authorisation bypass. This is the most dangerous omission in the codebase and must be an ArchUnit rule, not a code-review habit ([ADR-0018](./ADR-0018-architecture-governance-ci-gate.md)).

### Neutral / follow-on

- Signing algorithm, key rotation, and token lifetimes are for [`Backend Architecture.md`](../../02-backend/Backend%20Architecture.md).
- The frontend's storage of these tokens is [ADR-0025](./ADR-0025-httponly-cookie-session.md) and must not contradict this record.

## 6. Related Decisions

[ADR-0003](./ADR-0003-rest-api-style.md) · [ADR-0007](./ADR-0007-jmolecules-tactical-ddd.md) · [ADR-0015](./ADR-0015-redis-cache-and-rate-limiting.md) · [ADR-0017](./ADR-0017-append-only-audit-log.md) · [ADR-0025](./ADR-0025-httponly-cookie-session.md)

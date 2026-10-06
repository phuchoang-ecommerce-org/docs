# Security — Enterprise Commerce Platform (ECP)

**Document type:** System architecture specification
**Status:** Mixed — see §1.2. Consolidating sections are `Accepted`; first-time decisions are `Proposed`
**Audience:** Engineering, Operations, Security Review, Architecture Review
**Traces to:** `P5` · `P16` · `P17` · `NFR-SEC-01`–`NFR-SEC-07` · `NFR-OBS-01` · `NFR-OBS-02` · `FR-AUD-05`–`FR-AUD-08` · `FR-DAT-04` · `FR-DAT-05` · `BR-CUS-03` · `BR-AUD-01`–`BR-AUD-03` · `BR-REV-04` · `AC-02` · `AC-06`
**Related documents:** [Solution Architecture](./Solution%20Architecture.md) · [Deployment Diagram](./Deployment%20Diagram.md) · [Integration Contract](../04-shared/Integration%20Contract.md) · [ADR-0016](./ADR/ADR-0016-jwt-refresh-rotation-rbac.md) · [ADR-0017](./ADR/ADR-0017-append-only-audit-log.md) · [ADR-0025](./ADR/ADR-0025-httponly-cookie-session.md) · [SRS](../../BA-docs/srs.md)

---

## 1. Purpose, scope, and status

### 1.1 Scope

This document consolidates the security decisions in ADR-0015, ADR-0016, ADR-0017, ADR-0025, the [Integration Contract](../04-shared/Integration%20Contract.md), and the [Deployment Diagram](./Deployment%20Diagram.md). It covers trust boundaries, controls, data classification, threats, and residual risks.

Scope: the REST API, Next.js server, data tier, and three external provider integrations from SRS §2.2. Provider organisations, corporate IT, and the future mobile client are out of scope.

### 1.2 Section status

`Accepted` restates an upstream decision. `Proposed` is a first-time decision and needs a separate promotion commit ([ADR/README](./ADR/README.md) §2).

| § | Section | Status | Why |
|---|---|---|---|
| 2 | Requirement baseline | Accepted | Verbatim from SRS §6.4, §6.7 |
| 3 | Trust boundaries | Accepted | Reads out [`Deployment Diagram.md`](./Deployment%20Diagram.md) §2–§4 as zones |
| 4 | Identity and session | Accepted (model) · **Proposed** (algorithms, lifetimes, revocation) | [ADR-0016](./ADR/ADR-0016-jwt-refresh-rotation-rbac.md), [ADR-0025](./ADR/ADR-0025-httponly-cookie-session.md) fixed the model and explicitly deferred the parameters |
| 5 | Authorisation | Accepted | [ADR-0016](./ADR/ADR-0016-jwt-refresh-rotation-rbac.md) §4, [`Integration Contract.md`](../04-shared/Integration%20Contract.md) §9, SRS §2.3 |
| 6 | Input validation and output safety | **Proposed** | `NFR-SEC-04` states the requirement; no record states the mechanism |
| 7 | Rate limiting and abuse | Accepted (policy) · **Proposed** (keys, buckets) | [ADR-0015](./ADR/ADR-0015-redis-cache-and-rate-limiting.md) §4 |
| 8 | Data protection and classification | **Proposed** | `NFR-SEC-06`, `NFR-SEC-07`, `FR-DAT-04`, `FR-DAT-05` state the requirements; the classification is made here |
| 9 | External provider integration | **Proposed** | `UC-PAY-03` E3 and `UC-SHP-04` E4 require authenticity verification; no document names a mechanism |
| 10 | Secrets and configuration | Accepted | [`Deployment Diagram.md`](./Deployment%20Diagram.md) §5 |
| 11 | Audit and security observability | Accepted (audit) · **Proposed** (security event set) | [ADR-0017](./ADR/ADR-0017-append-only-audit-log.md) §4 |
| 12 | Verification and the CI gate | Accepted (mechanism) · **Proposed** (the security rules themselves) | [ADR-0018](./ADR/ADR-0018-architecture-governance-ci-gate.md) §4 |
| 13–14 | Threat model and residual risk | **Proposed** | First-time analysis |

Section 16 lists the main ADR candidates.

---

## 2. Requirement Baseline

SRS §6.4 defines seven security requirements and their verification methods.

| ID | Requirement | SRS verification method | Where satisfied |
|---|---|---|---|
| `NFR-SEC-01` | Every operation authorised server-side against the acting user's roles. No operation relies on a client withholding it. | Authorisation test per role per operation | §5 |
| `NFR-SEC-02` | Passwords stored only as a one-way, salted, computationally adaptive hash. Never plaintext, never reversible. | Code and storage review | §4.5 |
| `NFR-SEC-03` | Access tokens short-lived; refresh tokens rotate on use; reuse of a consumed refresh token invalidates the session. | Token lifecycle test | §4.2–§4.3 |
| `NFR-SEC-04` | All externally supplied input validated before business processing. | Input-validation test suite | §6, §9 |
| `NFR-SEC-05` | Request rates limited per caller; authentication endpoints stricter than general endpoints. | Rate-limit test | §7 |
| `NFR-SEC-06` | All traffic client↔platform and platform↔provider encrypted in transit. | Configuration review | §8.3 |
| `NFR-SEC-07` | Credentials, payment instrument details, and tokens never appear in logs, error messages, or audit entries. | Log inspection | §8.4 |

Two observability requirements also apply:

| ID | Requirement | SRS verification method | Where satisfied |
|---|---|---|---|
| `NFR-OBS-01` | Every significant business action attributable to an actor and a time. | Audit trail inspection | §11 |
| `NFR-OBS-02` | The audit trail cannot be amended or deleted through any interface the platform exposes, **by any role**. | Attempted-modification test per role | §11 |

Related business rules: `BR-CUS-03`, `BR-AUD-01`–`BR-AUD-03`, and `BR-REV-04`. Under `P5` and SRS §2.4, client checks are never security boundaries.

---

## 3. Trust Boundaries and Attack Surface

The trust zones follow [`Deployment Diagram.md`](./Deployment%20Diagram.md) §4.

```mermaid
flowchart TB
    subgraph Z0["Zone 0 — Untrusted (public internet)"]
        Browser["Browser<br/>httpOnly session cookie"]
        Provider["Payment Gateway · Shipping Carrier<br/>inbound callbacks"]
        Attacker(["Unauthenticated caller"])
    end

    subgraph Z1["Zone 1 — Edge (network edge, VM app-01)"]
        Nginx["nginx<br/>TLS termination · rate-limit backstop<br/>the sole ingress, ports 443/80"]
    end

    subgraph Z2["Zone 2 — Application (network app)"]
        Web["ecp-web (Next.js)<br/>holds live tokens — trusted computing base"]
        Api["ecp-api (Spring Modulith)<br/>AuthorizationService · validation · audit"]
    end

    subgraph Z3["Zone 3 — Data (network data, VM data-01)"]
        Pg[("PostgreSQL<br/>source of truth")]
        Redis[("Redis<br/>cache · rate limit · hot data")]
        Kafka[["Kafka"]]
        Es[("Elasticsearch")]
        Mongo[("MongoDB")]
    end

    Browser -->|B1: TLS 1.3| Nginx
    Provider -->|B1: TLS + signed body| Nginx
    Attacker -.->|B1| Nginx
    Nginx -->|B2| Web
    Nginx -->|B2: webhooks routed direct| Api
    Web -->|B3: Authorization Bearer| Api
    Api -->|B4| Pg
    Api -->|B4| Redis
    Api -->|B4| Kafka
    Api -->|B4| Es
    Api -->|B4| Mongo
    Api -->|B5: outbound TLS, allowlisted| Provider
```

| # | Boundary | What crosses | Control | Traces to |
|---|---|---|---|---|
| **B1** | Internet → edge | All client traffic; all inbound provider callbacks | TLS termination; HSTS; nginx rate-limit backstop; request size caps; the only host-published port in the topology | `NFR-SEC-06`, `NFR-SEC-05` |
| **B2** | Edge → application | Proxied HTTP; webhook routing to `ecp-api` | `nginx` is the only member of both `edge` and `app`; it normalises and sets the trusted client-address header, discarding any client-supplied one (§7.2) | [Deployment §4](./Deployment%20Diagram.md) |
| **B3** | Next.js → API | `Authorization: Bearer <jwt>` on every call | The **only** place a token exists outside `ecp-api`. Session cookie never reaches `ecp-api` from the browser in the chosen flow ([ADR-0025](./ADR/ADR-0025-httponly-cookie-session.md) Option 1) | `NFR-SEC-03`, `NFR-SEC-07` |
| **B4** | API → data tier | SQL, Redis commands, Kafka produce/consume, ES and Mongo queries | Private VM-to-VM link, not routable from the internet; no data-tier port published to any host; least-privilege database roles (§11.2) | [Deployment §4](./Deployment%20Diagram.md), `NFR-OBS-02` |
| **B5** | API → providers | Authorise/capture/refund, dispatch, email | Outbound TLS; per-environment credentials; egress restricted to the provider hosts each adapter needs (§9.3) | `NFR-SEC-06`, [Deployment §5](./Deployment%20Diagram.md) |

Three boundary facts affect the threat model:

- `ecp-web` holds live tokens. Its logs, errors, and memory are security-relevant; compromise exposes sessions (§14 R2).
- Webhooks have no user session. Signature verification in §9 is their authentication control.
- `ecp-api` can reach the whole data tier. JVM module boundaries are build-enforced, not network-enforced. ADR-0002 accepts this risk (§13 T18).

---

## 4. Identity, Authentication, and Session Management

### 4.1 The model (Accepted)

Settled by [ADR-0016](./ADR/ADR-0016-jwt-refresh-rotation-rbac.md) and [ADR-0025](./ADR/ADR-0025-httponly-cookie-session.md); restated here in one place.

| Element | Commitment | Source |
|---|---|---|
| Access token | Short-lived JWT carrying subject, roles, expiry. Verified without a datastore lookup | [ADR-0016](./ADR/ADR-0016-jwt-refresh-rotation-rbac.md) §4 |
| Refresh token | Server-side record, **rotated on every use**. Presenting a consumed token invalidates the whole session chain and returns `ECP-GEN-4011` | [ADR-0016](./ADR/ADR-0016-jwt-refresh-rotation-rbac.md) §4, [IC §4.4](../04-shared/Integration%20Contract.md) |
| Browser custody | `httpOnly` + `Secure` + `SameSite=Lax` cookie (`Strict` for admin routes), scoped path, explicit expiry. **No token is readable by client JavaScript; nothing in `localStorage`**. This is entirely `ecp-web`'s doing, on its own response to the browser — `ecp-api` never sets or reads a cookie and has no "is this caller a browser" branch at all (Sprint 03 backend implementation decision; see `sprint-03-identity-core.md` Review Notes) | [ADR-0025](./ADR/ADR-0025-httponly-cookie-session.md) §4 |
| Refresh execution | Server-side, in `ecp-web`, and **serialised** so concurrent requests cannot present the same refresh token twice and trip reuse detection | [ADR-0025](./ADR/ADR-0025-httponly-cookie-session.md) §4 |
| `ecp-api`'s callers | Always `Authorization: Bearer <jwt>` plus the refresh token in the JSON body, `ecp-web` included — there is no separate "browser caller" contract at this API; only `ecp-web` stands between it and an actual browser | [IC §5](../04-shared/Integration%20Contract.md) |
| CSRF | **Mandatory** on every cookie-authenticated state-changing request. `SameSite` plus a token. Not optional, not deferred | [ADR-0025](./ADR/ADR-0025-httponly-cookie-session.md) §4 |
| Logout | Clears the cookie **and** invalidates the refresh token server-side. Clearing the cookie alone leaves a valid session behind | [ADR-0025](./ADR/ADR-0025-httponly-cookie-session.md) §4, `FR-CUS-04` |
| Guest sessions | A guest cart is identified by its own cookie and is not part of the authenticated session; it merges into the customer's cart on login | `FR-CRT-06`, `BR-CRT-03` |

### 4.2 Token parameters (Proposed)

[ADR-0016](./ADR/ADR-0016-jwt-refresh-rotation-rbac.md) §5 defers signing algorithm, key rotation, and token lifetimes. Normative properties and starting assumptions follow.

| Parameter | Normative property | Starting value |
|---|---|---|
| Access token lifetime | Short enough that the revocation lag in [ADR-0016](./ADR/ADR-0016-jwt-refresh-rotation-rbac.md) §5 is tolerable for a suspended account; long enough that refresh traffic does not become a load problem in its own right | **[ASSUMPTION]** 15 minutes |
| Refresh token lifetime | Bounded absolutely, not only by inactivity, so a stolen chain cannot be renewed forever | **[ASSUMPTION]** 14 days idle, 30 days absolute |
| Signing algorithm | Asymmetric, so a verifier never holds the signing key. `CON-08` anticipates extraction into services; symmetric signing would make every extracted service a custodian of the secret | **Decided (Sprint 03, `ecp-api`)**: `RS256` (2048-bit RSA), via Spring Security's Nimbus-backed `JwtEncoder`/`JwtDecoder`. This row's `EdDSA` starting value is superseded — RS256 is what this document already named as the fallback "where library support requires it," and Spring Security's OAuth2 resource-server support handles it without additional key-format handling. The asymmetric property this row exists to protect is unchanged |
| Key distribution | Public keys published at a JWKS endpoint; `kid` in every token header | — |
| Key rotation | Overlapping validity — a new key is published and trusted before it signs, and the old key stays trusted for at least one access-token lifetime after it stops signing | **[ASSUMPTION]** 90-day signing key rotation |
| Claims | `sub`, `roles`, `iat`, `exp`, `jti`, `iss`, `aud`. **Nothing else.** No email, no name, no order data — a JWT is readable by anyone holding it | `NFR-SEC-07` |
| Validation | Signature, `exp`, `iss`, `aud`, and algorithm **from the server's allowlist, never from the token header** | §13 T4 |

The verifier uses a server-side algorithm allowlist and rejects other algorithms before reading claims.

### 4.3 Refresh rotation and reuse detection (Accepted, with one addition)

Rotation is the session compromise-detection mechanism from ADR-0025.

```mermaid
sequenceDiagram
    participant W as ecp-web
    participant A as ecp-api
    W->>A: POST /auth/refresh (RT-1)
    A->>A: RT-1 valid and unconsumed
    A->>A: mark RT-1 consumed, issue RT-2 in same chain
    A-->>W: AT-2 + RT-2
    Note over W,A: attacker replays the stolen RT-1
    W->>A: POST /auth/refresh (RT-1)
    A->>A: RT-1 already consumed -> reuse detected
    A->>A: invalidate the entire chain
    A-->>W: 401 ECP-GEN-4011
    A->>A: emit security event auth.refresh_reuse_detected
```

Obligations:

1. Invalidate the whole chain, not only the replayed token. Store a chain identifier.
2. Emit the §11.3 security event on reuse, in addition to `401`.
3. Serialise refresh in `ecp-web` to prevent false reuse detection.

**Proposed bounded deny-list:** on `AccountSuspended` or `AccountRoleChanged` only, store the affected `sub` in Redis for one access-token lifetime and check it in the token filter. This adds one Redis lookup per request. **It is not in force until an ADR ratifies it** (§16); until then, ADR-0016's revocation lag remains.

### 4.4 Cookie and CSRF specifics (Proposed)

[`Frontend Architecture.md`](../03-frontend/Frontend%20Architecture.md) §4 ratifies the cookie names, `SameSite` rules, opaque session reference, serialised refresh, and CSRF coverage. It retires OpenAPI assumptions `O-03` and `O-04`.

| Aspect | Rule |
|---|---|
| Cookie name | `ecp_session`, matching [`securitySchemes.yaml`](../04-shared/OpenAPI/components/securitySchemes.yaml) |
| Attributes | `httpOnly`, `Secure`, `SameSite=Lax` (`Strict` on `/admin/*`), `Path=/`, explicit `Max-Age` |
| CSRF mechanism | Signed double-submit: a random token in a non-`httpOnly` companion cookie **and** in the `X-CSRF-Token` header, compared server-side in constant time. `SameSite` is the first layer, not the only one — it is a defence against cross-site requests, not against a same-site subdomain |
| Scope | Required on every cookie-authenticated `POST`/`PUT`/`PATCH`/`DELETE`. **Never** required alongside `bearerAuth`, which is not ambiently attached |
| Failure | `403` with `ECP-GEN-4030` and a security event; never a silent redirect |

### 4.5 Credentials and account lifecycle

| Concern | Rule | Traces to |
|---|---|---|
| Password storage | One-way, salted, computationally adaptive. **[ASSUMPTION]** Argon2id (memory-hard, resists GPU attack); bcrypt at cost ≥ 12 is the acceptable fallback where Argon2 is unavailable. Parameters are configuration, re-tunable without a schema change; a hash records the parameters it was produced with so a re-hash on next successful login is possible | `NFR-SEC-02` |
| Password in transit and at rest | Never logged in any form, including truncated or hashed, at any log level. Not present in any DTO that is serialised into an error response | `NFR-SEC-02`, `NFR-SEC-07` |
| Verification / reset tokens | Single-use, expiring, invalidated on use — the same rule as refresh tokens. Stored as a hash, so a database read does not yield a usable token | `BR-CUS-03` |
| Reset flow response | Identical response whether or not the account exists. [ADR-0025](./ADR/ADR-0025-httponly-cookie-session.md) §4 already requires sign-in failures not to disclose account existence; the reset flow is the same disclosure by a different route | `NFR-SEC-01` |
| Login failure response | Generic. `ECP-GEN-4010` with no distinction between unknown account, wrong password, and unverified account | — |
| Account suspension | `AccountSuspended` ends the ability to authenticate immediately and invalidates all refresh chains for that subject. Access-token effect is per §4.3 | `FR-AUD-02` |
| Role change | `AccountRoleChanged` invalidates all refresh chains, so the next access token carries the new roles | `FR-AUD-05` |
| Last Administrator | Revocation of the final Administrator is refused by a **database constraint**, not an application check — `Domain Model.md` §7 classifies `BR-AUD-03` as a global cross-aggregate constraint | `BR-AUD-03` |
| MFA | **Out of scope for this release.** No requirement in SRS §6.4 asks for it, and inventing one here would be scope this document does not own. Recorded in §14 as a residual risk for privileged roles |

---

## 5. Authorisation Model

### 5.1 Where the decision is made (Accepted)

[ADR-0016](./ADR/ADR-0016-jwt-refresh-rotation-rbac.md) §4 places authorisation in the application layer. Every entry point reaches an `@ApplicationService`, which calls `AuthorizationService` before execution. Web-only enforcement misses non-HTTP entry points; domain enforcement couples business rules to identity.

```mermaid
flowchart LR
    subgraph Entry["Entry points — all of them"]
        R["REST controller"]
        S["Scheduler job"]
        K["Kafka consumer"]
        M["Future mobile client"]
    end
    R --> AS
    S --> AS
    K --> AS
    M --> AS
    AS["@ApplicationService"] -->|"1. AuthorizationService.check(actor, permission)"| Auth["Identity &amp; Access OHS"]
    AS -->|"2. only if permitted"| D["Domain / aggregate"]
    Web["Web layer @PreAuthorize"] -.->|"coarse filter only — never the only check"| R
```

### 5.2 The policy

The grid is SRS §2.3's role authority summary, reproduced in [`Integration Contract.md`](../04-shared/Integration%20Contract.md) §9. It is not repeated a third time here, because a third copy is a third thing to drift. **If the grid and SRS §2.3 disagree, SRS §2.3 is right** ([IC §10](../04-shared/Integration%20Contract.md)).

Grid rules:

1. Role grants a capability; ownership grants an instance.
2. An unowned resource returns `404` (`ECP-GEN-4040`), not `403`.
3. No role can manage the audit trail (§11.2).

### 5.3 Enforcement layers

| Layer | Control | Security value |
|---|---|---|
| nginx | Path routing, request caps | None as authorisation. Availability control only |
| Web layer | `@PreAuthorize` coarse filter | **Additional only.** [ADR-0016](./ADR/ADR-0016-jwt-refresh-rotation-rbac.md) §4: "never the only check for any operation" |
| Application layer | `AuthorizationService` before the command | **The decision.** Everything else is commentary |
| Domain layer | Business invariants | Not authorisation, deliberately ([ADR-0005](./ADR/ADR-0005-clean-architecture-ports-and-adapters.md)) |
| Database | Least-privilege roles; constraints for `BR-AUD-03`, `BR-CAT-01`, `BR-CUS-01` | Backstop against application defects, and the enforcement point for cross-aggregate uniqueness |
| Frontend | Hiding controls | **Zero.** [IC §5](../04-shared/Integration%20Contract.md): "The frontend enforces nothing" |

ArchUnit checks that each `@ApplicationService` calls `AuthorizationService` (§12.2). The §12.1 matrix tests whether it uses the correct permission.

---

## 6. Input Validation and Output Safety

`NFR-SEC-04` and `FR-AUD-08` require validation before business processing. This section defines the mechanism.

### 6.1 Where validation happens

Each layer validates a different concern:

| Layer | Validates | Failure |
|---|---|---|
| nginx | Request size, header size, URI length, content type | `413` / `400` at the edge, never reaching the JVM |
| Deserialisation | Structural: JSON well-formedness, type conformance, unknown-field policy | `400` `ECP-GEN-4000` |
| DTO constraints | Syntactic: required, type, range, format, length, enum membership | `400` `ECP-GEN-4000` with **every** failing field in `errors` ([IC §4.3](../04-shared/Integration%20Contract.md)) |
| Application service | Semantic: does this reference exist, is this transition legal, is this actor permitted | Domain-specific `4xx` code |
| Aggregate | Invariants | Never a validation error — an aggregate that receives invalid input is a defect upstream |

Report every failing field in one response ([IC §4.3](../04-shared/Integration%20Contract.md)).

Reject unknown REST fields. Event consumers tolerate unknown fields under [IC §6.4](../04-shared/Integration%20Contract.md).

### 6.2 Injection

All five stores require parameterised queries. Never concatenate caller input into a query.

| Store | Class | Rule |
|---|---|---|
| PostgreSQL (write) | SQL injection | JPA/HQL with bound parameters only ([ADR-0010](./ADR/ADR-0010-jpa-write-model-jdbc-read-models.md)) |
| PostgreSQL (read) | SQL injection | JDBC with bound parameters. **Sort and filter fields are validated against an allowlist**, never interpolated — [IC §3.3](../04-shared/Integration%20Contract.md) enumerates the sortable fields, and that enumeration is the allowlist |
| MongoDB | Operator injection | Typed queries via Spring Data ([ADR-0030](./ADR/ADR-0030-spring-data-mongodb-read-model-access.md)); a caller-supplied map is never used as a query document, because a `$where` or `$ne` arriving as a value is a query, not data |
| Elasticsearch | Query-DSL injection | Caller input reaches the query builder as a **term or match value**, never as raw DSL. No `query_string` over user input |
| Redis | Key injection / key confusion | Keys composed from validated components with a fixed namespace prefix per role ([ADR-0015](./ADR/ADR-0015-redis-cache-and-rate-limiting.md) §4). A caller-controlled segment is encoded, so a caller cannot address another caller's bucket |

Escape caller values at the logging boundary to prevent log injection. Reject CR/LF in values written to response headers.

### 6.3 Output safety

| Surface | Rule |
|---|---|
| API responses | JSON only. `problem+json` for errors. Encoding is the serialiser's job; no string-built responses |
| `detail` field | **Never** a credential, token, payment detail, or raw request payload; `5xx` never leaks an exception type, stack frame, or SQL fragment ([IC §4.1, §4.5](../04-shared/Integration%20Contract.md)) |
| Storefront rendering | React escapes by default. `dangerouslySetInnerHTML` on any caller-supplied value — review text above all — is forbidden, and is a lint rule rather than a review habit |
| Content-Security-Policy | **[ASSUMPTION]** `default-src 'self'`; no `unsafe-inline` for scripts; nonce-based where Next.js requires inline. CSP is a second line — the first is that no token is readable by script at all ([ADR-0025](./ADR/ADR-0025-httponly-cookie-session.md)) |
| Other headers | `Strict-Transport-Security` (long max-age, `includeSubDomains`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` / `frame-ancestors 'none'` |
| CORS | The browser reaches `ecp-web`, not `ecp-api` ([ADR-0025](./ADR/ADR-0025-httponly-cookie-session.md) Option 4 rejected). `ecp-api` therefore needs **no** permissive CORS policy, and adding one would undo that decision quietly |

### 6.4 Review image upload

`FR-REV-03` is the only untrusted file upload. `BR-REV-04` limits format and size:

1. Size capped at the edge and again on receipt.
2. Format determined from **content**, not from the filename or the declared `Content-Type`.
3. Accepted formats limited to raster image types, re-encoded on receipt so that whatever metadata or trailing payload arrived does not survive.
4. Stored under a generated identifier. A caller-supplied filename is never a path component — that is path traversal by another name.
5. Served from a path that sets `Content-Type` explicitly with `nosniff`, and never executes.
6. EXIF stripped: a customer's review photo can carry GPS coordinates, which makes it PII the platform did not intend to hold (§8.1).

**[ASSUMPTION]** Object storage for review images is not decided by any record; the rules above hold for any backing store.

---

## 7. Rate Limiting and Abuse Controls

### 7.1 Policy (Accepted)

From [ADR-0015](./ADR/ADR-0015-redis-cache-and-rate-limiting.md) §4 and [IC §5](../04-shared/Integration%20Contract.md), satisfying `NFR-SEC-05` and `FR-AUD-07`:

| Aspect | Rule |
|---|---|
| Mechanism | Redis atomic counters, sliding window, keyed per caller. Shared state is exactly why in-process caching cannot do this |
| Auth endpoints | Stricter bucket, and **fail closed** — losing the limiter must not become a way to bypass `NFR-SEC-05` |
| Other endpoints | Fail open — a Redis outage degrades, it does not fail |
| Response | `429` with `ECP-GEN-4290` and `Retry-After` |
| Backstop | nginx carries an independent limit in front of the application's limiter ([Deployment §2](./Deployment%20Diagram.md)) |

Section 12.1 tests the fail-closed/fail-open split required by ADR-0015.

### 7.2 Keys and buckets (Proposed)

| Caller class | Key | Reasoning |
|---|---|---|
| Authenticated | `sub` from the verified token | Survives IP change; cannot be forged |
| Unauthenticated | Client address, **taken from the header nginx sets, with any client-supplied `X-Forwarded-For` discarded at B2** | A trusted proxy chain is the only thing that makes an IP-derived key meaningful |
| Provider callback | Provider identity, after signature verification (§9) | Never rate-limited on IP alone; a carrier's egress addresses change without notice |

| Bucket | Endpoints | Failure mode it addresses |
|---|---|---|
| **Auth-strict** | login, refresh, password reset request, verification resend | Credential stuffing, reset-token grinding |
| **Payment-retry** | payment retry within the `A-07` window | `UC-PAY-03` E3 states it directly: repeated authorisation attempts against a failing instrument are themselves a fraud signal |
| **Write** | all state-changing endpoints | Automated abuse: review flooding, promotion-code guessing |
| **Read** | catalog, search | Scraping and cost control, not security |

**[ASSUMPTION]** `Backend Architecture.md` defines concrete limits. This document defines bucket separation.

### 7.3 Enumeration and business-logic abuse

Rules for non-volume abuse:

- Login, registration, and reset use identical responses for account enumeration (§4.5).
- Unowned resources return `404` for resource enumeration (§5.2).
- Promotion guessing uses the write bucket and `BR-PRM-01`; invalid and inapplicable codes both return `ECP-PRM-4220`.

---

## 8. Data Protection

### 8.1 Classification

The following classification is `Proposed`.

| Class | Examples | Storage | Logs | Events | Read models |
|---|---|---|---|---|---|
| **C1 — Secret** | Provider API keys, JWT signing keys, DB credentials | Injected at runtime only ([Deployment §5](./Deployment%20Diagram.md)) | **Never** | **Never** | **Never** |
| **C2 — Credential** | Password hashes, refresh tokens, verification/reset tokens, access tokens, CSRF tokens | Hashed at rest (§4.5); refresh tokens server-side | **Never** (`NFR-SEC-07`) | **Never** ([IC §7](../04-shared/Integration%20Contract.md): `Account*` events carry no credential hash or token) | **Never** |
| **C3 — Payment instrument** | Card numbers, wallet identifiers, bank details | **Not stored.** The platform holds a provider *reference*, never an instrument ([IC §7](../04-shared/Integration%20Contract.md)) | **Never** (`UC-PAY-02` E1) | Reference only | Reference only |
| **C4 — Personal data** | Email, name, phone, shipping and billing addresses, order history, review authorship, review image EXIF | PostgreSQL; addresses frozen onto orders (`FR-DAT-03`) | Identifiers only, never contents | Only fields the consumer needs | §8.2 |
| **C5 — Business data** | Products, categories, prices, inventory, promotions, review text | PostgreSQL, projected freely | Free | Free | Free |

The platform stores provider references, never payment instruments ([IC §7](../04-shared/Integration%20Contract.md)).

### 8.2 Personal data in read models

Read models apply these data limits:

| Store | May contain | May **not** contain |
|---|---|---|
| Elasticsearch ([ADR-0014](./ADR/ADR-0014-elasticsearch-search-read-model.md)) | Catalog data (C5) | **Any C4.** The search index is fed by `catalog` events and exists to serve product search; a customer identifier in it serves no query and creates a second copy of personal data with no access control of its own |
| MongoDB ([ADR-0013](./ADR/ADR-0013-mongodb-scoped-to-read-models.md)) | Reporting aggregates and flexible read models; C4 only where the read model is inherently customer-scoped, and then the same fields the source holds — never more | Credentials, payment instruments, review body text to Reporting ([IC §7](../04-shared/Integration%20Contract.md)) |
| Redis ([ADR-0015](./ADR/ADR-0015-redis-cache-and-rate-limiting.md)) | Cached C5; cart hot data; rate-limit counters | C2 in any form. Redis is never a source of truth and every key is reconstructible; a token there would be a token in a store designed to be flushable |

A projection binds only fields it uses ([IC §6.4](../04-shared/Integration%20Contract.md)).

### 8.3 In transit (`NFR-SEC-06`)

| Segment | Requirement |
|---|---|
| Browser ↔ nginx | TLS 1.3 preferred, **TLS 1.2 minimum**; modern cipher suites only; HTTP on :80 redirects and serves nothing. HSTS with a long max-age |
| nginx ↔ `ecp-web` / `ecp-api` | Plain HTTP inside the `app` network is **acceptable and is a stated limitation**, not an oversight: it is unrouted from the internet, and the topology has no mutual-TLS layer. §14 carries it |
| `ecp-api` ↔ data tier | TLS where the client library supports it without operational cost; the `data` network is a private VM-to-VM link and is the primary control |
| `ecp-api` ↔ providers | TLS with certificate validation **on**. Disabling verification "temporarily" is the single most common way this requirement is lost |
| Provider → nginx | TLS, plus a signature over the body (§9) — transport authenticates the channel, the signature authenticates the sender |

### 8.4 In logs and errors (`NFR-SEC-07`)

Log inspection verifies these `NFR-SEC-07` rules:

- C1, C2, and C3 never appear at any log level, including `DEBUG`, including truncated, including hashed.
- Request and response bodies are not logged wholesale on any path that carries C2, C3, or C4. "Log the payload on error" is how credentials reach logs.
- Exceptions are logged with type and message, never with a bound parameter set that may contain a password.
- The `detail` field of a `problem+json` response is subject to the same rule as a log line ([IC §4.1](../04-shared/Integration%20Contract.md)).
- `ecp-web` is in scope for all of the above: [ADR-0025](./ADR/ADR-0025-httponly-cookie-session.md) §5 makes its logging and error reporting security-relevant because it holds live tokens. A client-side error reporter must never receive a server-side exception object.
- **[ASSUMPTION]** A denylist of field names is applied at the serialisation boundary as a backstop. It is a backstop and not the control — a field it does not know about is still logged.

### 8.5 Retention and erasure

| Data | Retention | Basis |
|---|---|---|
| Audit entries | **[A-13]** 7 years, append-only. Expiry is an operational archival process outside the application's reach, never a delete the platform can perform | `FR-DAT-05`, [ADR-0017](./ADR/ADR-0017-append-only-audit-log.md) §4 |
| Refresh tokens | Purged after absolute expiry. The store needs its own retention and cleanup ([ADR-0016](./ADR/ADR-0016-jwt-refresh-rotation-rbac.md) §5) | `BR-CUS-03` |
| Carts | **[A-05]** 30 days authenticated, 7 days guest, both configurable | `BR-CRT-01` |
| Orders and payments | Retained for the audit and dispute period; order line prices frozen at placement | `FR-DAT-03`, `FR-DAT-05` |
| Application logs | **[ASSUMPTION]** 90 days; not decided by any record | — |

Customer erasure pseudonymises C4 fields on the customer and frozen order address. It keeps orders, lines, prices, and audit entries under `FR-DAT-04`. Audit actor identifiers remain because `NFR-OBS-02` forbids amendment; §14 records this conflict.

---

## 9. External Provider Integration Security

### 9.1 Inbound callbacks

`UC-PAY-03` E3 and `UC-SHP-04` E4 require callback authenticity. Under `NFR-MAINT-03`, the provider-neutral contract uses `X-ECP-Signature` ([`securitySchemes.yaml`](../04-shared/OpenAPI/components/securitySchemes.yaml)).

| Step | Rule |
|---|---|
| 1. Preserve the raw body | The signature covers **bytes**, not a re-serialised object. The raw body is captured before parsing; verifying against re-serialised JSON fails on whitespace and key order, and "fixing" that by relaxing the comparison removes the control |
| 2. Verify the signature | Provider-specific algorithm behind the adapter, per [ADR-0005](./ADR/ADR-0005-clean-architecture-ports-and-adapters.md) — the *port* requires verification, the *adapter* knows how. Comparison is constant-time |
| 3. Check freshness | Reject a callback whose signed timestamp is outside a bounded window, so a captured callback cannot be replayed indefinitely |
| 4. Reject or record | An unverifiable callback is **recorded and rejected, never applied** ([`securitySchemes.yaml`](../04-shared/OpenAPI/components/securitySchemes.yaml)), and raises a security event (§11.3). It is a signal, not noise |
| 5. Apply idempotently | At most once per attempt however many times the provider delivers it, correlated by a stable reference ([IC §6.4](../04-shared/Integration%20Contract.md), `BR-PAY-01`) |
| 6. Handle the unmatched case | A verified result attributable to no attempt is recorded as unmatched and escalated for reconciliation. **Never discarded** — `UC-PAY-02` E4: an unrecorded capture is money taken from a customer the business cannot see |

Callbacks have no user session. Signature verification authenticates them; idempotency prevents replay effects.

### 9.2 Outbound calls

| Rule | Reasoning |
|---|---|
| Every provider call goes through a port and a provider-specific adapter | [ADR-0005](./ADR/ADR-0005-clean-architecture-ports-and-adapters.md), Solution Architecture §4. Swapping a provider is an adapter change; so is swapping its authentication scheme |
| Credentials are per-environment; staging never holds a production provider key | [Deployment §5](./Deployment%20Diagram.md) |
| Provider errors are never passed through | `503` + `ECP-GEN-5030`; the platform's contract does not change when a provider is swapped ([IC §4.5](../04-shared/Integration%20Contract.md)). A passthrough also leaks provider-side detail to a caller |
| Timeouts and circuit breaking on every call | Availability, and a slow provider must not become a way to exhaust the request pool |
| Local development uses stub adapters | [Deployment §7](./Deployment%20Diagram.md): "No developer holds a live payment credential" |

### 9.3 SSRF

SSRF rules:

- **No endpoint fetches a caller-supplied URL.** No requirement asks for one; if one is ever added it is a security decision, not a feature detail.
- Provider endpoints come from configuration, never from a request or a callback body. A callback that says "fetch your result from here" is not followed.
- **[ASSUMPTION]** Egress from `ecp-api` is restricted to the provider hosts the adapters need. The `data` network is unroutable from the internet, but nothing currently stops `ecp-api` from originating a request to it on behalf of an attacker.

---

## 10. Secrets and Configuration Management

[`Deployment Diagram.md`](./Deployment%20Diagram.md) §5 governs injection, environment scope, image tags, and environment parity. This document adds three `Proposed` rules:

1. Every C1 secret has a no-downtime rotation procedure. JWT uses overlapping validity; provider and database credentials use dual credentials during the swap.
2. Secret scanning is a CI gate (§12.3).
3. Rotate a committed secret. Deleting the file does not remove it from history or clones.

---

## 11. Audit and Security Observability

### 11.1 The audit trail (Accepted)

[ADR-0017](./ADR/ADR-0017-append-only-audit-log.md) defines audit as a Conformist event consumer with no mutation API. `FR-AUD-01` and `FR-AUD-02` define content and minimum actions. `FR-AUD-04` requires search by actor, entity, action, and time range.

### 11.2 Why immutability holds

Two mechanisms enforce immutability:

1. **No mutation API.** There is nothing to call, so the per-role test passes for the same reason at every role.
2. **Database grants.** The application's database role holds `INSERT` and `SELECT` on `audit_entry` and **not** `UPDATE` or `DELETE` ([ADR-0017](./ADR/ADR-0017-append-only-audit-log.md) §4).

[ADR-0017](./ADR/ADR-0017-append-only-audit-log.md) §5 limits the guarantee to platform interfaces. A superuser migration can alter the table (§14).

Entries never contain credentials, payment instruments, tokens, or raw request payloads. They project from domain events, not HTTP requests.

An action without a domain event has no audit entry. Keep `Domain Model.md` §9 aligned with `FR-AUD-*`; review event coverage for every new use case.

### 11.3 Security events (Proposed)

Security events indicate attacks, not business actions. They are separate from audit entries and cannot be suppressed.

| Event | Raised when | Why it matters |
|---|---|---|
| `auth.refresh_reuse_detected` | §4.3 | **The highest-signal event the platform produces.** It means a refresh token was held by two parties. Near-zero false-positive rate once refresh is serialised server-side ([ADR-0025](./ADR/ADR-0025-httponly-cookie-session.md)) |
| `auth.login_failure_burst` | Auth-strict bucket exhausted for one key | Credential stuffing |
| `authz.denied` | `AuthorizationService` refuses | A single denial is normal. A pattern from one subject across many resources is enumeration |
| `callback.signature_invalid` | §9.1 step 4 | `UC-PAY-03` E3, `UC-SHP-04` E4 require it to be recorded. Someone is forging money movement |
| `csrf.token_invalid` | §4.4 | Cross-site request attempt, or a broken client. Both require investigation |
| `admin.last_admin_revocation_attempted` | `BR-AUD-03` constraint fires | Either a lockout mistake or a privilege attack |
| `ratelimit.exceeded` | Any bucket | Volume signal; feeds the others |
| `validation.rejected_burst` | Sustained `ECP-GEN-4000` from one key | Fuzzing |

Every security event carries `correlationId` under `NFR-OBS-03` ([IC §6.2](../04-shared/Integration%20Contract.md)).

**[ASSUMPTION]** Alert routing and thresholds are not decided. `auth.refresh_reuse_detected` and `callback.signature_invalid` require a response, not only a dashboard.

---

## 12. Verification

ADR-0018 makes architecture rules build-failing tests on every build and pull request. They may change by a reasoned commit but cannot be suppressed to merge.

### 12.1 Requirement → test

The SRS names a verification method for every requirement; this maps each to the artefact that performs it.

| Requirement | SRS method | Artefact |
|---|---|---|
| `NFR-SEC-01` | Authorisation test per role per operation | Parameterised integration test over the [permission matrix](../04-shared/Integration%20Contract.md) × the [OpenAPI](../04-shared/OpenAPI/README.md) operation list — 6 roles × 155 operations, generated from the two documents rather than hand-written, so a new operation with no matrix cell fails the build |
| `NFR-SEC-02` | Code and storage review | ArchUnit: no field named for a password is persisted unhashed; integration test asserting a stored value is not the input and carries the expected hash parameters |
| `NFR-SEC-03` | Token lifecycle test | Rotation, expiry, chain-wide invalidation on reuse, and logout-invalidates-server-side. Testcontainers, because it is a stateful guarantee |
| `NFR-SEC-04` | Input-validation test suite | Per-endpoint boundary cases; injection payloads against all five stores (§6.2); the malformed-upload set for `BR-REV-04` |
| `NFR-SEC-05` | Rate-limit test | Bucket limits; **and the fail-closed-on-auth / fail-open-elsewhere split with Redis unavailable** — [ADR-0015](./ADR/ADR-0015-redis-cache-and-rate-limiting.md) §4 requires this to be tested, not assumed |
| `NFR-SEC-06` | Configuration review | TLS configuration assertion in CI; certificate-validation-enabled assertion on every provider adapter |
| `NFR-SEC-07` | Log inspection | Test that captures log output across auth, payment, and error paths and asserts no C1/C2/C3 value appears |
| `NFR-OBS-01` | Audit trail inspection | Per `FR-AUD-02` action: perform it, assert an entry with actor, time, entity, before/after |
| `NFR-OBS-02` | Attempted-modification test **per role** | For each of the six roles, attempt amend and delete through every exposed interface; assert refusal. Plus a grant assertion: the application role has no `UPDATE`/`DELETE` on `audit_entry` |
| `AC-02` | Every rule through every entry point | Each rule in SRS §4 exercised through REST, scheduler, and Kafka consumer paths, asserting identical outcomes |

### 12.2 ArchUnit security rules

Added to the table in [ADR-0018](./ADR/ADR-0018-architecture-governance-ci-gate.md) §4:

| Rule | Enforces | Note |
|---|---|---|
| Every `@ApplicationService` public command method calls `AuthorizationService` | `NFR-SEC-01`, `BR-AUD-02` | **The single highest-value rule in the build.** [ADR-0018](./ADR/ADR-0018-architecture-governance-ci-gate.md) §4 already names it as the entry no other mechanism catches |
| No domain class references an authorisation or security type | [ADR-0005](./ADR/ADR-0005-clean-architecture-ports-and-adapters.md), [ADR-0016](./ADR/ADR-0016-jwt-refresh-rotation-rbac.md) Option C | Keeps identity out of the domain |
| The Audit module exposes no update or delete operation at any layer | `NFR-OBS-02`, [ADR-0017](./ADR/ADR-0017-append-only-audit-log.md) | Makes "by construction" checkable |
| No JPA/JDBC query is built by string concatenation of a non-constant | `NFR-SEC-04` | Catches the SQL-injection shape structurally |
| No logging call takes a type classified C1/C2/C3 as an argument | `NFR-SEC-07` | Structural half of the log-inspection test |
| `dangerouslySetInnerHTML` is not used on the storefront | §6.3 | Frontend lint rule, same gate |

ArchUnit can check that a service calls `AuthorizationService`, not that it requests the correct permission. The `NFR-SEC-01` matrix test checks the permission.

### 12.3 Supply chain and pipeline

| Gate | Rule |
|---|---|
| Dependency vulnerability scan | On every build. A known-exploited or critical advisory fails it; lower severities are tracked, not ignored |
| Dependency currency | [ADR-0027](./ADR/ADR-0027-java-21-spring-boot-4-gradle.md) already carries tooling currency as a risk; an unpatchable dependency is an architecture problem, not a ticket |
| Secret scanning | On every commit and in history (§10) |
| Container image scan | Base images and the built image |
| Build provenance | Image tagged with the commit SHA ([Deployment §5](./Deployment%20Diagram.md)), so a running container traces to a source revision |
| Static analysis | Complementary to ArchUnit, per [ADR-0018](./ADR/ADR-0018-architecture-governance-ci-gate.md) §3 — good at common defects, poor at architectural relationships. Not a substitute for either rules or tests |

---

## 13. Threat Model

Threats are grouped by the §3 boundaries.

| # | Boundary | Threat | Mitigation | Residual |
|---|---|---|---|---|
| **T1** | B1 | Credential stuffing against login | Auth-strict bucket failing closed (§7); adaptive password hashing (§4.5); generic failure response | No MFA — §14 R4 |
| **T2** | B1 | Session theft via XSS in the storefront | `httpOnly` cookie: nothing readable by script ([ADR-0025](./ADR/ADR-0025-httponly-cookie-session.md)); CSP; React escaping (§6.3) | An XSS flaw can still *act as* the user in-session |
| **T3** | B1 | CSRF against cookie-authenticated writes | `SameSite` + signed double-submit token, mandatory (§4.4) | A same-site subdomain compromise defeats `SameSite`; the token layer is why it is not the only control |
| **T4** | B1/B3 | Token forgery — `alg: none`, algorithm confusion, `kid` injection | Server-side algorithm allowlist; asymmetric signing; `iss`/`aud` validation (§4.2) | — |
| **T5** | B1 | Refresh token replay after theft | Rotation + chain-wide invalidation + security event (§4.3) | Detection is at the attacker's *next* use, not at theft |
| **T6** | B1 | **Forged provider callback moving money** | Signature over raw body, freshness window, idempotency, reject-and-record (§9.1) | Provider signing-key compromise is undetectable by the platform |
| **T7** | B1 | Callback replay | Freshness window + idempotency by stable reference (§9.1) | — |
| **T8** | B1 | Enumeration of accounts, orders, promotion codes | Identical responses; `404`-not-`403`; buckets (§5.2, §7.3) | — |
| **T9** | B2/B3 | Privilege escalation by calling an endpoint the UI hides | Authorisation in the application layer; the frontend enforces nothing (§5) | A missing `AuthorizationService` call — the reason §12.2 rule 1 exists |
| **T10** | B3 | Horizontal access: reading another customer's order | Ownership is a runtime check, not a role check (§5.2) | Per-endpoint correctness; covered by the §12.1 matrix test |
| **T11** | B2 | Compromise of `ecp-web` yielding live tokens | Minimised surface; no token to a client error reporter (§8.4) | **Accepted and named** — [ADR-0025](./ADR/ADR-0025-httponly-cookie-session.md) §5 |
| **T12** | B4 | Injection into any of the five stores | Parameterisation everywhere; allowlisted sort/filter fields (§6.2) | — |
| **T13** | B4 | Audit tampering to hide an action | No mutation API + database grants (§11.2) | Superuser/migration access — [ADR-0017](./ADR/ADR-0017-append-only-audit-log.md) §5 |
| **T14** | B4 | PII leaking into Elasticsearch or MongoDB | Classification + per-store rules; bind only the fields you use (§8.2) | Enforced by review, not by a type |
| **T15** | B5 | SSRF pivot from `ecp-api` into the `data` network | No caller-supplied URL is fetched; egress restriction (§9.3) | Egress restriction is an assumption, not yet a topology fact |
| **T16** | B1 | Malicious review image | Content-sniffed format, re-encode, generated filename, `nosniff` (§6.4) | — |
| **T17** | B1 | Rate-limiter bypass by losing Redis | **Fail closed on auth** ([ADR-0015](./ADR/ADR-0015-redis-cache-and-rate-limiting.md)); nginx backstop | Fail-open elsewhere is a deliberate availability trade |
| **T18** | Zone 2 | Code execution in any module reaching all data | Module boundaries are build-enforced, not network-enforced | **Accepted** — [ADR-0002](./ADR/ADR-0002-modular-monolith-deployment-unit.md); §3 |

---

## 14. Residual Risk

These known gaps remain after the controls above.

| # | Risk | Why it stands | What would close it |
|---|---|---|---|
| **R1** | **Revocation is not immediate.** A suspended account or a revoked role stays effective until the access token expires | Accepted consequence of [ADR-0016](./ADR/ADR-0016-jwt-refresh-rotation-rbac.md) §5 — a deny-list reintroduces a hot-path lookup | The bounded deny-list in §4.3, once ratified |
| **R2** | **`ecp-web` is in the trusted computing base.** Compromising it compromises sessions | Structural to [ADR-0025](./ADR/ADR-0025-httponly-cookie-session.md) Option 1; the alternative moves the risk to the browser, which is worse | Nothing, within this architecture. It is the price of `httpOnly` custody |
| **R3** | **Audit immutability does not hold against operational database access.** A migration run as a superuser can alter the table | [ADR-0017](./ADR/ADR-0017-append-only-audit-log.md) §5 states it; `NFR-OBS-02` scopes the guarantee to platform interfaces | External append-only storage, or database-level audit of the audit table |
| **R4** | **No MFA, including for Administrator** | No SRS requirement asks for it | A requirement, then an ADR. Privileged roles first |
| **R5** | **Internal traffic in the `app` network is unencrypted** | No mutual-TLS layer in the [topology](./Deployment%20Diagram.md); the network is unrouted from the internet | Service mesh or mTLS — disproportionate at this scale, per [ADR-0028](./ADR/ADR-0028-deployment-topology-containerisation.md) |
| **R6** | **A missing `AuthorizationService` call is a silent bypass** | [ADR-0016](./ADR/ADR-0016-jwt-refresh-rotation-rbac.md) §5; the ArchUnit rule catches the omission, not a wrong permission | The §12.1 matrix test, which is why it is generated from the permission matrix rather than hand-written |
| **R7** | **Audit completeness is bounded by event coverage.** An action that publishes no event is invisible, silently | [ADR-0017](./ADR/ADR-0017-append-only-audit-log.md) §5 | A review checklist item per use case; no mechanism catches it |
| **R8** | **Erasure and audit retention conflict.** An actor identifier survives erasure in the audit trail | `NFR-OBS-02` forbids amendment by anyone; `FR-DAT-04` requires orders to survive customer deletion. Resolved in favour of `NFR-OBS-02` (§8.5) | A legal-basis decision, not an architectural one |
| **R9** | **PII classification is enforced by review, not by a type** | Same weakness [ADR-0015](./ADR/ADR-0015-redis-cache-and-rate-limiting.md) §5 concedes for the flash-sale pre-filter | Typed classification on shared-kernel value objects, checked by ArchUnit |
| **R10** | **No penetration test, and no runtime WAF** | Neither is specified anywhere; §12 verifies the controls this document names and cannot find the ones it failed to name | An independent assessment before production |

---

## 15. Traceability

| Requirement | Section | Upstream record |
|---|---|---|
| `P5` — rules hold regardless of entry point | §5.1 | [ADR-0016](./ADR/ADR-0016-jwt-refresh-rotation-rbac.md) |
| `P16` — least privilege per role | §5.2 | SRS §2.3, [IC §9](../04-shared/Integration%20Contract.md) |
| `P17` — who did this, when, why | §11 | [ADR-0017](./ADR/ADR-0017-append-only-audit-log.md) |
| `NFR-SEC-01` | §5, §12.1 | [ADR-0016](./ADR/ADR-0016-jwt-refresh-rotation-rbac.md) |
| `NFR-SEC-02` | §4.5 | *this document* |
| `NFR-SEC-03` | §4.1–§4.3 | [ADR-0016](./ADR/ADR-0016-jwt-refresh-rotation-rbac.md), [ADR-0025](./ADR/ADR-0025-httponly-cookie-session.md) |
| `NFR-SEC-04` | §6, §9.1 | *this document* |
| `NFR-SEC-05` | §7 | [ADR-0015](./ADR/ADR-0015-redis-cache-and-rate-limiting.md) |
| `NFR-SEC-06` | §8.3 | *this document* |
| `NFR-SEC-07` | §8.1, §8.4 | [ADR-0016](./ADR/ADR-0016-jwt-refresh-rotation-rbac.md), [ADR-0017](./ADR/ADR-0017-append-only-audit-log.md), [IC §7](../04-shared/Integration%20Contract.md) |
| `NFR-OBS-01`, `NFR-OBS-02` | §11 | [ADR-0017](./ADR/ADR-0017-append-only-audit-log.md) |
| `FR-AUD-05`–`FR-AUD-08` | §5.2, §6, §7 | SRS §3, [IC §9](../04-shared/Integration%20Contract.md) |
| `FR-DAT-04`, `FR-DAT-05` | §8.5 | SRS §3 |
| `BR-CUS-03` | §4.3, §4.5 | [ADR-0016](./ADR/ADR-0016-jwt-refresh-rotation-rbac.md) |
| `BR-AUD-01`–`BR-AUD-03` | §5.2, §11.2, §4.5 | [ADR-0017](./ADR/ADR-0017-append-only-audit-log.md), `Domain Model.md` §7 |
| `BR-REV-04` | §6.4 | *this document* |
| `AC-02`, `AC-06` | §5.1, §12 | [ADR-0018](./ADR/ADR-0018-architecture-governance-ci-gate.md) |

---

## 16. Pending decisions

Three first-time decisions need ADR review:

| Candidate | Why it warrants a record |
|---|---|
| **Provider callback authenticity** (§9.1) | It is the mitigation for T6, the only threat where a missing control lets a stranger move money, and no record covers it. The strongest candidate of the three |
| **Cryptographic parameters and key rotation** (§4.2, §4.5) | Signing algorithm, key rotation, and password hashing each have genuinely rejected alternatives — symmetric signing, bcrypt-only — and [ADR-0016](./ADR/ADR-0016-jwt-refresh-rotation-rbac.md) §5 deferred them explicitly |
| **The bounded revocation deny-list** (§4.3) | It modifies a consequence [ADR-0016](./ADR/ADR-0016-jwt-refresh-rotation-rbac.md) accepted on the record. **It is not in force until an ADR says so** |

[`Backend Architecture.md`](../02-backend/Backend%20Architecture.md) must ratify or replace token lifetimes (§4.2), rate limits (§7.2), and log retention (§8.5), and implement §12.2. [`Frontend Architecture.md`](../03-frontend/Frontend%20Architecture.md) has discharged the CSRF, cookie, CSP, and lint obligations; its §10 keeps `F-01`–`F-05` open.

**R10** requires an independent assessment; repository checks cannot find missing controls that were never specified.

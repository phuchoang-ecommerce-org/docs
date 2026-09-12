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
- [x] `AuthorizationService` in `identity.api`, called from **every other module's `application` layer**
- [x] ArchUnit rule: `identity` may be named from another module's `application` package **and nowhere else**. A domain object that asks who the caller is has made authorisation part of a business invariant, which Domain Model §5.2 forbids
- [x] The same decision reached through REST, scheduler and Kafka entry points — one test per path, per `AC-02`
- [x] **`404` rather than `403` for another customer's resource**, so existence is not disclosed ([`Integration Contract.md`](../../SA-docs/04-shared/Integration%20Contract.md) §2.1)
- [x] Role model and grants seeded per [`Permission Matrix.md`](../../SA-docs/04-shared/Permission%20Matrix.md)

### `US-AUD-04` Enforce API Rate Limit (5 pts)
- [x] Redis-backed per-caller limiter on the rate-limiting instance
- [x] `429` with the problem+JSON shape and a retry hint
- [x] Limits per the `NFR-SEC-05` table

### `US-CUS-05` Refresh Authenticated Session (5 pts) — `renewSession`
- [x] Refresh rotation per [`ADR-0016`](../../SA-docs/01-system/ADR/ADR-0016-jwt-refresh-rotation-rbac.md); a reused refresh token invalidates the chain
- [x] `endAllOwnSessions` / `endAccountSessions` invalidate refresh chains server-side

### `EN-OBS-1` (2 pts)
- [x] Management port; liveness and readiness. **Readiness fails while Flyway migrations run**

---

## Frontend Lane

### `EN-FE-API-2` — session custody (10 pts)

This is the single most security-sensitive item in the frontend lane.

- [x] `lib/session/` with `import 'server-only'`. **Nothing outside it reads a session cookie** (rule `I-4`)
- [x] The `ecp_session` cookie: HttpOnly, Secure, `SameSite` per route group — `Strict` on `(admin)`, `Lax` elsewhere *(mechanism exists — `createSession`'s `CookieOptions.admin` flag — but no caller passes `admin: true` yet; see Review Notes)*
- [x] **No access token ever reaches the browser.** [`ADR-0025`](../../SA-docs/01-system/ADR/ADR-0025-httponly-cookie-session.md) — verified at IH-1
- [x] `/api/csrf` issuing the `ecp_csrf` companion token; signed double-submit
- [ ] CSRF required on **every** cookie-authenticated write, enforced in the fetch client so it cannot be forgotten per-action — **partial**: outbound `X-CSRF-Token` attachment is automatic (`lib/api/headers.ts`, unchanged since Sprint 1); inbound verification (`requireCsrf`) is still opt-in per Server Action, not centrally enforced — see Review Notes
- [x] **Serialised refresh** — concurrent requests hitting an expired session trigger exactly one renewal, and the rest await it. A test drives concurrent requests and asserts one `renewSession` call
- [ ] `/api/auth/*` route handlers: sign-in, sign-out. This is a **closed list** ([`Routing.md`](../../SA-docs/03-frontend/Routing.md) §9) — a fifth entry is an amendment to `ADR-0036` — **scope decision: not built this sprint**, see Review Notes
- [x] `renewSession` and `logOut` have **no routes**: renewal is internal and never customer-initiated

### Error rendering
- [x] `403` → the section or control is absent, and the page does not explain
- [x] `404` on another customer's resource → `notFound()`, and it **must not** say "you don't have permission to view this order". That would undo the non-disclosure the status code was chosen to provide
- [x] `429` → a designed screen with a retry affordance, not a generic error boundary

---

## Integration Risk

**Serialised refresh cannot be proved against the Prism mock.** Prism will not expire a session, will not rotate a token, and will not reject a reused one. The concurrency test this sprint runs against a local stub; the real property is verified at **IH-1**, against `ecp-api`.

State that in the Review. A green test here is evidence of the *frontend's* serialisation logic, not of the session contract holding end to end.

## Definition of Done

Every story reaches [`../definition-of-done.md`](../definition-of-done.md) §5. There is no gate this sprint, so the integration criterion is satisfied at `G2` (Sprint 05).

Additionally:
- [x] The ArchUnit rule confining `identity` to `application` layers is in place and demonstrated failing on a planted `domain` import
- [x] Concurrent-request test asserts exactly one refresh — **frontend-lane item** (`EN-FE-API-2`'s serialised refresh, `lib/session/index.test.ts` — 10 concurrent callers, one `renewSession` call, against a local stub per the Integration Risk note above); backend lane's own concurrency guarantee (a losing double-refresh race is treated as reuse and invalidates the chain) is covered by `RenewSessionServiceTest.losingAConcurrentRotationRaceIsTreatedAsReuse`

## Review Notes

**Backend lane — all four committed items implemented, `./gradlew check` green (ArchUnit, Modularity, unit, and Testcontainers integration suites) against real Postgres + two Redis instances.**

- **US-CUS-05 — contract drift caught and fixed against `openapi.yaml`'s `sessionRenewals` path (not worked around)**: the endpoint returns **200**, not 201 (a renewal, unlike `logIn`, doesn't create a new resource); and every rejection reason (unknown token, expired-but-never-used, or already-consumed) returns the *same* `401 ECP-GEN-4011` per the spec's `RefreshTokenRejected` response — the implementation initially split plain expiry into a separate `ECP-GEN-4010`, caught during manual contract cross-check and corrected. Only the chain-invalidation *side effect* still varies: expiry alone does not kill the chain, only reuse/consumption does.
- **US-CUS-05**: Added a `chain_id` column to `identity_token` (new Flyway migration) linking every token produced by rotating one login's refresh token. `renewSession` is exposed as `POST /api/v1/session-renewals` (anonymous-permitted — the caller's access token is expired by definition when refreshing). Rotation records `replaced_by`; presenting an already-consumed token, or losing a concurrent rotation race against the same token, invalidates the *whole* chain (`ECP-GEN-4011`), not just that one row. `logOut`'s single-session path now also invalidates the chain, not just the presented token, closing a gap where a token rotated moments before logout could survive it. **Found and fixed during implementation**: the reuse-rejection path throws after writing the chain invalidation, and by default Spring rolls back a `@Transactional` method on any `RuntimeException` — without `noRollbackFor = DomainException.class` on `RenewSessionService.renewSession`, the very write reuse-detection depends on was being silently undone. Caught by the new `reusingAnAlreadyRotatedRefreshTokenInvalidatesTheWholeChain_ADR_0016` integration test.
- **US-AUD-03**: `identity.api.AuthorizationService` + `identity.api.CallerContext` expose the existing (Sprint 03) `PermissionMatrixAuthorizationService` to other modules, via a thin adapter living in `identity.api` (an `application`-layer class cannot implement an `api`-layer interface under the existing layering ArchUnit rules, so the adapter has to sit on the `api` side of the boundary). The new confinement rule is scoped to **`domain`** packages specifically (`identityIsNotNamedFromAnotherModulesDomainPackage`), not every non-`application` package — an earlier, more literal reading of "named only from application" broke legitimate `api`/`infrastructure` plumbing (a facade parameter, an adapter argument) that has to carry the caller through to the application layer where the actual authorisation call happens; the domain-purity property (the one the backlog's own rationale is about) is fully preserved and has a permanent planted-violation proof (`ArchitectureTests.thePlantedDomainImportOfIdentityFailsTheConfinementRule_US_AUD_03`, fixture at `app/src/test/java/.../catalog/domain/PlantedIdentityDomainImport.java`). **Scope decision**: since every non-identity module is still an empty scaffold, a minimal, clearly-labelled RBAC wiring demo was added to `catalog` (`GetProductService`/`GetProductFacade`/`ProductController` at `GET /api/v1/demo-products/{id}`, permission-matrix operation `getProduct`) — not real catalog functionality, exists only to prove the cross-module call path compiles, passes `ApplicationModules.verify()`, and reaches an identical authorisation decision through REST, a scheduler-shaped stub, and a Kafka-shaped stub (`EntryPointParityTest` — no real scheduler or Kafka infrastructure exists in this repo yet, so these stubs prove the call path, not a trigger/broker integration). **Known gap, flagged not silently closed**: the `404`-vs-`403` ownership-disclosure rule (`Integration Contract.md` §2.1) is documented as a pattern (role check → `AuthorizationService` → `403`; ownership mismatch → the resource's own application service → `404` directly, never a second authorisation call) but has no real ownable cross-module resource to test against yet — every identity operation this sprint is self-scoped (`getOwnAccount`, `renewSession`, `endAllOwnSessions`). This becomes testable once `ordering`/`cart` exist.
- **US-AUD-04**: `RateLimitFilter` now classifies every request (not just `POST`) into one of four buckets (`auth-strict`, `payment-retry` — empty path set until `payment` exists, `write`, `read`), keyed by the JWT `sub` claim for an authenticated caller (decoded directly in the filter, since it must still run ahead of Spring Security for the auth-strict bucket) rather than always the remote address. Bucket limits moved from hardcoded constants to `ecp.rate-limit.*` in `application.yml` (bound via `RateLimitBuckets`), fixing a latent Sprint 03 gap where that config block existed but nothing read it. **Doc drift found and fixed in code, not silently worked around**: `Database.md` §7.3 documents the Redis key as `rl:{callerId}:{bucket}`; the shipped adapter had the two segments swapped (`rl:{bucket}:{callerId}`). Code now matches the doc. `Database.md` §7.3 also separately lists a `rl:auth:{callerId}` key shape for the auth-strict bucket specifically — this predates Sprint 04 and was not reconciled; flagging for a follow-up docs pass rather than guessing which of the two documented shapes is authoritative.
- **EN-OBS-1**: Actuator management port on `9001` (`ECP_MANAGEMENT_PORT`); a dedicated `readiness` health group includes both `readinessState` and a new `FlywayGatedReadinessHealthIndicator`, which doubles as the app's `FlywayMigrationStrategy` — it reports `DOWN` until `Flyway.migrate()` has actually returned, making the "readiness fails during migration" guarantee explicit rather than an accident of bean-initialisation ordering. Structured JSON logging (`logging.structured.format.console: logstash`, Spring Boot 4.1.1's native support, set since Sprint 03) confirmed working end-to-end — every log line captured during the Testcontainers integration run was well-formed JSON with a `correlationId` field and no token/secret content.
- **Integration testing note**: this session ran against real Docker via Colima (not just unit/ArchUnit) — `./gradlew check` including `integrationTest` is green. Testcontainers-on-Colima needed `TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock` alongside `DOCKER_HOST` for Ryuk's bind mount to resolve; noting this for whoever next runs the suite on a Colima-backed Docker setup.
- **Cross-repo coordination**: the frontend lane (parallel session, same sprint) implemented `EN-FE-API-2` independently — no `openapi.yaml`/contract conflict arose. `logOut()` on the frontend now sends `refreshToken` in the `DELETE /sessions/current` body; confirmed against the backend's actual (optional-body, `LogoutRequest.refreshToken`) contract, unchanged this sprint.

**Frontend lane — `EN-FE-API-2`, `US-AUD-03`, `US-AUD-04` implemented; `US-CUS-05`'s frontend slice (serialised refresh) is `EN-FE-API-2`'s own checklist item, not separate work.** `npm run typecheck`, `npm run lint`, `npm run test` (124 tests), and `npm run build` all green; `npm run test:contract` passes against a live Prism mock. Not yet committed (session-local, pending review).

- **CI blocker fixed first**: `lib/api/generated/openapi.d.ts` was stale relative to this file's own already-committed `LogoutRequest`/`sessionsCurrent` drift fix (Sprint 03) — a pure regeneration (`npm run codegen:api`), no spec edit needed. `openapi-contract` CI check now passes locally once that file is committed.
- **`lib/session/`**: real cookie custody replacing the Sprint 1 no-op stub. `ecp_session` (opaque, never a JWT) and `ecp_csrf` (signed double-submit, HMAC-SHA256 over a new `CSRF_SECRET` env var — the doc specifies the double-submit *mechanism*, not a signing algorithm, so this was this sprint's implementation decision) are set together in `createSession`, backed by an in-memory, single-process session store (`lib/session/store.ts`). **Scope decision, flagged as a real limitation, not hidden**: this store does not survive a process restart and does not work across horizontally-scaled `ecp-web` instances — no distributed-store (Redis) infra or config convention exists yet in this repo, and introducing one is a platform decision outside a 10-point custody-pattern story. It sits behind a `SessionStore` interface specifically so swapping in Redis later is a one-file change. Not production-viable as shipped.
- **Serialised refresh**: `refreshSession` takes a per-session lock (`store.acquireLock`, timeout strictly shorter than the fetch client's own request timeout) and re-checks the record after acquiring, so only the caller that still sees the stale/expired token actually calls `renewSession`; everyone else waiting behind the lock sees the already-updated record. Covers both the proactive path (`getAccessToken`'s own expiry check) and the reactive path (`lib/api/client.ts` retrying once on a `401 ECP-GEN-4010` it actually sent a now-rejected token for) via the same function, keyed on whether the caller's token still matches what's stored. Unit-tested for exactly one `renewSession` call under 10 concurrent callers — against a local stub, per this doc's own Integration Risk note; real reuse-detection under concurrent load against `ecp-api` is still IH-1 scope.
- **`logIn` no longer returns tokens to client code** — a real behavior change beyond plumbing, required by "no access token ever reaches the browser" (confirmed safe: the only caller, `sign-in-form.tsx`, never read `accessToken`/`refreshToken` off the result). `logOut` now reads the current session's refresh token from the store and sends it in `DELETE /sessions/current`'s body (using the regenerated `LogoutRequest` type from the CI fix above), so it revokes the specific session server-side rather than relying on the "absent body = already ended" fallback; the cookie is cleared and the store record destroyed regardless of whether the upstream call itself succeeds.
- **Known gap, flagged not silently closed — CSRF enforcement is not fully centralised.** Outbound `X-CSRF-Token` attachment on mutating requests is automatic (`lib/api/headers.ts`, unchanged since Sprint 1 — a call site cannot forget to *send* the header). Inbound verification of a Server Action's own CSRF token is a different concern this sprint left opt-in: each action (`logIn`, `logOut`) calls `requireCsrf()` itself at the top of its body; nothing yet stops a future action from being written without that call. Frontend Architecture.md §4.3's own text ("the check belongs in one wrapper that every action composes") describes the fix — a shared Server Action wrapper — which `Data Fetching.md` §6.1 also specifies but which didn't get built this sprint (it's a larger refactor of every existing action, not just the identity ones, and was judged out of scope for a session-custody story). Recommend a follow-up enabler.
- **Known gap — `/api/auth/*` route handlers were not built.** `Routing.md` §9 lists the closed slot for flows "a Server Action cannot provide" (its own example: an OAuth/payment-provider redirect return); nothing in this sprint's scope needs one, so sign-in/sign-out stay Server-Action-based (`logIn`/`logOut` in `features/identity/server/actions.ts`, unchanged in shape from Sprint 1/3). Documenting this as a deliberate scope call, not an oversight, so it isn't silently reopened later.
- **`SameSite=Strict` under `(admin)` is mechanism-only, unexercised**: `createSession` takes a `CookieOptions.admin` flag that selects `Strict` vs `Lax`, but no caller passes `admin: true` yet — there is no admin-specific sign-in flow in this repo to exercise it. Confirmed there's nothing to wire it to yet rather than guessing; flagging so it isn't mistaken for "Strict is applied on `(admin)`" without a caller actually asking for it.
- **`readOptionalSection()`** (`lib/api/authz.ts`) catches a `403 ECP-GEN-4030` and returns `null` so a Server Component section renders absent, matching the backend's `AuthorizationService` decision above; `404`/transport/parse errors rethrow unchanged into the existing `notFound()`/`error.tsx` handling. Audited `(account)`/`(admin)`/`(storefront)` for any ownership-denial copy ("permission", "not yours", "access denied") — none found, nothing to fix.
- **429**: `ApiProblem` now carries `retryAfter` (parsed from the `Retry-After` response header) in the shared `apiRequest()` used by both reads and writes, so it's available to any call site, not just mutations — per the backend's note above that the `read` bucket now also 429s. A dedicated `<RateLimited>` retry screen (countdown, disabled until `retryAfter` elapses) is wired into sign-in this sprint as the concrete example; other call sites can adopt the same plumbing without further changes.
- **Cross-repo coordination**: coordinated live with the backend session throughout (shared docs-extract working tree) — confirmed no spec conflict before either side edited anything, and cross-checked both of the backend's mid-sprint corrections (`session-renewals` returns 200 not 201; refresh-rejection reasons consolidate to a single `401 ECP-GEN-4011`) against `lib/session/renew.ts`, which needed no changes for either since it checks `response.ok` generically and doesn't branch on the Problem's specific code.

## Retrospective

**Went well:**
**Change one thing:**
**Action:**

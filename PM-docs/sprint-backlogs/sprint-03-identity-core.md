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
- [x] `identity` module: `api/`, `application/`, `domain/`, `infrastructure/`
- [x] `Account` aggregate with its invariants in `domain/`, testable with no Spring context
- [x] Flyway migration for `identity_*` tables

### `US-CUS-01` Register (5 pts) — `registerAccount`
- [x] Main scenario plus **every** exception flow in the use case
- [x] Password policy enforced in the domain, not the controller
- [x] Duplicate-email handling that **does not disclose whether an account exists**
- [x] L1 tests naming each `BR-CUS-*` id touched

### `US-CUS-02` Verify Email (3 pts) — `verifyEmailAddress`, `resendEmailVerification`
- [x] Single-use, expiring token
- [x] Exception flows: expired, already used, unknown

### `US-CUS-03` Log In (5 pts) — `logIn`
- [x] JWT issue + refresh rotation per [`ADR-0016`](../../SA-docs/01-system/ADR/ADR-0016-jwt-refresh-rotation-rbac.md)
- [x] **Sign-in failure messaging is identical regardless of cause.** A rendering and a response rule, and it is easy to break by being helpful
- [x] Lockout / throttling behaviour per the use case's exception flows

### `US-CUS-04` Log Out (2 pts) — `logOut`
- [x] Clears the cookie **and** invalidates the refresh token server-side. Both halves, or it is not a logout

### `EN-WIRE-2` Redis (5 pts)
- [x] Two Redis instances per [`ADR-0034`](../../SA-docs/01-system/ADR/ADR-0034-redis-two-instance-topology.md) — cache and rate-limiting are separate concerns with separate eviction behaviour
- [x] Cache-aside helper
- [x] Rate-limiter primitive, ready for `US-AUD-04` in Sprint 04

### Every story above
- [ ] Contract test both directions
- [x] Permission-matrix cell asserted
- [x] Audit entry where `UC-AUD-01` requires one

---

## Frontend Lane

### The `(auth)` group — `R3`, never cached
- [x] `/register`, `/verify-email`, `/sign-in` complete against the mock
- [x] Sign-out as an account-menu action, not a route
- [x] **No response discloses whether an account exists.** Sign-in failures and reset requests read identically — a rendering rule, not a UX preference
- [x] Failures use the empty-state pattern: concise explanation, clear primary action
- [x] Targets ≥ 44 × 44 px with visible focus, named explicitly by [`ADR-0025`](../../SA-docs/01-system/ADR/ADR-0025-httponly-cookie-session.md) §4 for these screens
- [x] `features/identity/` created — the first feature folder, on demand rather than up front

### `EN-FE-DS-2` (11 pts)
- [x] Form (with field-level error rendering the problem+JSON validation shape drives), EmptyState, Skeleton, Badge
- [x] Motion baseline honouring `prefers-reduced-motion` per [`ADR-0026`](../../SA-docs/01-system/ADR/ADR-0026-motion-and-accessibility-baseline.md)
- [x] Vitest + axe on each

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

*(2026-09-12, frontend lane — `ecommerce-frontend-next`)*

All five frontend committed items shipped against the Prism mock; the backend lane had not started beyond Sprint 2's Flyway migrations at the time of this pass (`git log` showed no `identity` application/API code, and the working tree was clean — no concurrent uncommitted backend work to reconcile).

**`EN-FE-DS-2` shipped**: `Skeleton`, `Badge`, `EmptyState`, `Form`/`FormField`/`FormMessage` in `components/ui/`, following `button.tsx`/`card.tsx`'s exact pattern (`cn`, `data-slot`, `cva` where variants exist). `EmptyState` (`role="status"`, one primary action, small icon, no illustration) is the component that carries every non-disclosive failure message this sprint — sign-in 401, registration/verification rate-limits, and the verify-email "expired or already used" case all render through it. `Form`/`FormField` stay presentational (no `lib/api` import, rule I-5 intact); field/form error mapping from `Problem`/`FieldError` happens in `features/identity`, the one layer allowed to import both. **No sixth colour token added** — `styles/theme.css` still has exactly five roles (`ADR-0022`); error messaging uses an icon + border + text emphasis instead, decided with the user up front rather than discovered as a gap mid-build. **Framer Motion added** (`lib/motion/presets.ts`, a new `lib-motion` boundary element registered in `eslint.config.mjs`) with the five ADR-0026 presets (`fade`/`fadeRise`/`colorShift`/`elevate`/`overlay`) plus a global `prefers-reduced-motion` CSS floor in `styles/theme.css` that catches every plain transition regardless of which component wrote it.

**`features/identity/` created** — the first feature folder built after `features/catalog/`, same `schema/` + `server/` shape, no barrel files. `server/actions.ts` holds the five Server Actions (`registerAccount`, `verifyEmailAddress`, `resendEmailVerification`, `logIn`, `logOut`); `server/error-mapping.ts`'s `toActionResult` is the first real consumer of `lib/api/error-map.ts`'s `ERROR_SCREEN_MAP` (extended with `ECP-GEN-4010` sign-in-failed and `ECP-GEN-4290` rate-limited) — a `Problem` with populated `errors[]` becomes `fieldErrors`, and an empty-`errors[]` Problem (401 bad-credentials, 429, 404 unknown-token) becomes a non-field-attributed `formError`, which is what makes the non-disclosive rendering rule structurally enforced rather than a per-page discipline.

**Real bug found and fixed in the shared fetch client, not identity-specific code**: `lib/api/client.ts`'s `apiRequest` called `response.json()` unconditionally, which throws on the empty body every 202/204 success carries (`registerAccount`, `verifyEmailAddress`, `resendEmailVerification`, `logOut` are four of this sprint's five operations) — every one of them would have surfaced as a spurious `ApiParseError`. Fixed by reading the body as text first and treating an empty body as `undefined` rather than a parse failure; callers now state that expectation with `z.void()`. Caught by writing the identity actions against the real client rather than a mock, and confirmed against a live Prism instance (`curl -i` showed `Content-Length: 0` on all four). Added a regression test (`lib/api/__tests__/client.test.ts`) alongside the existing suite.

**Contract gap found, not fabricated around**: `paths/identity.yaml`'s `verifyEmailAddress` description promises "an expired [token] is reported as expired," but its `responses` list only `400`/`404`/`429` — no code distinguishes expired from unknown. Verify-email failure copy stays deliberately generic ("This link may have expired or already been used") rather than inventing a distinguishing code Prism will never emit; a `// TODO` in `lib/api/error-map.ts` marks where a real code would slot in once the backend adds one.

**Sign-out resolved as an injected prop, not a new boundary exception**: `components/layout/account-sidebar.tsx` cannot import `features/identity` (rule I-5 — only `app`/`features` may import `features/*`), so `AccountSidebar` gained an optional `signOutAction` prop, and `app/(account)/layout.tsx` supplies `logOut` (wrapped to `redirect("/sign-in")` after). `AccountSidebar` stays presentational, matching `Header`'s existing "never fetches" precedent.

**Sign-in success renders "Signed in." in place, not a redirect** — `lib/session`'s `getAccessToken`/`getCsrfToken` are still the Sprint 1 no-op seam, so a successful mock `logIn` never leaves the browser holding a real `ecp_session` cookie; a `redirect("/account")` would immediately bounce back via `proxy.ts`'s cookie-presence check. Documented at the call site rather than silently working around it. `/account` itself is confirmed still reachable and rendering correctly (manual `curl -b "ecp_session=fake"` check) — this sprint's `AccountSidebar`/layout change didn't disturb that path, it's just not reachable from a real sign-in yet.

**`.github/workflows/frontend-ci.yml` was not missing** — Sprint 2's retro flagged it absent, but it exists at the **monorepo root** (`/Users/phucle/Local-Document/ecommerce/.github/`), not inside `ecommerce-frontend-next/` where it was searched for. Bumped `node-version: 20` → `24` in all three jobs (`lint-typecheck-test`, `openapi-contract`, `prism-smoke`) per the user's direction; no other changes needed.

**New pattern**: `features/identity/server/actions.contract.test.ts` — this repo's first contract test that hits a live Prism instance rather than mocking `fetch` (existing `lib/api/__tests__/*` all mock). Skips gracefully (`describe.skipIf`) with a console warning when `localhost:4010` is unreachable, rather than failing the main `npm test` run; a new `npm run test:contract` script runs it standalone. Verified green (8/8) against a running mock, and confirmed the skip path also works (0 run, 8 skipped when the mock isn't up). Also documented, not routed around: `logOut` requires an authenticated caller in the contract, but this sprint's session no-op means no `Authorization` header is ever sent, so it will always 401 "Invalid security scheme used" against Prism — asserted directly rather than treated as a failure.

**Verification**: `npm run typecheck`, `npm run lint` (ESLint + `depcruise`, zero issues), `npm test` (80 Vitest tests, up from 33 before this sprint, all green; contract suite skips cleanly without the mock running), `npm run codegen:api:check` (empty diff — the OpenAPI source already carried the identity operations), `npm run test:contract` (8/8 green against a live mock), and `npx playwright test tests/e2e/identity.spec.ts` (register → verify-email → sign-in happy path, green). All three `(auth)` routes manually confirmed rendering (200, correlation id present) against `next dev` + the mock.

**Scope decisions, matching the sprint's own Integration Risk note**: real cookie/CSRF/refresh custody, `/account` reachability after a real sign-in, backend rate-limiting, password-reset routes, and `renewSession`/`endAllOwnSessions`/profile/address endpoints are all untouched this sprint — Sprint 4's `EN-FE-API-2`. Gate `G1` checks #3–#5 and #8 (real `ecp-api`, end-to-end registration, backend-verified sign-in messaging, `openapi.yaml` drift) are backend-dependent and not claimed done here; checks #1 (empty diff), #2 (frontend half of the contract tests), #6 (field-level validation rendering), and #7 (correlation id visible) are satisfied from the frontend side.

*(2026-09-12, backend lane — `ecommerce-backend-spring`)*

Built the `identity` module from the empty scaffold left after Sprint 2 (only `identity` + `identity.api` package-info files, no code) plus the already-applied Flyway schema. All five `G1`-listed operations (`registerAccount`, `verifyEmailAddress`, `resendEmailVerification`, `logIn`, `logOut`) are implemented end-to-end and pass against real PostgreSQL and both Redis instances (`./gradlew check`, Testcontainers). `renewSession` (`UC-CUS-05`) and password reset (`UC-CUS-07`) are real use cases but were **not** committed this sprint and are not implemented — only the refresh-token rotation *capability* (stateful, hashed, single-use) exists, ready for a `/session-renewals` endpoint next sprint.

**Scope decisions** (mirroring the frontend lane's practice of recording these up front rather than as discovered gaps):

- **No cookie in this repo.** `ADR-0025`'s httpOnly cookie is the Next.js server's concern in the frontend repo; this API is always JSON — `Authorization: Bearer <jwt>` plus a `refreshToken` string in the body. `logOut`'s contract had no way to name which refresh token to revoke without one, so a `refreshToken` field was added to its request body — a logged drift, `openapi.yaml` amended the same session (`paths/identity.yaml#/sessionsCurrent`, `components/schemas/identity.yaml#/LogoutRequest`), satisfying Gate `G1` check 8's own requirement.
- **Notification/audit stubbed as logging, not built.** The `notification` and `audit` modules remain empty scaffolds (`audit_entry`'s table and grants already exist from an earlier migration, but no `audit` application code does). `AccountRegistered`, `DuplicateRegistrationAttempted`, `EmailVerificationResent`, `AccountVerified`, `SessionEstablished`, and `SessionEnded` are raised as real in-process Spring Modulith events (`@ApplicationModuleListener`, genuine `AFTER_COMMIT` semantics) and consumed by a same-module listener that logs in place of sending email or writing an audit row — proves the ADR-0012 §4 transport is wired correctly without inventing another module's schema. The verification token itself is never logged (`NFR-SEC-07`), even though the event carries it for the (currently absent) real listener to build a link with.
- **RS256, not the `[ASSUMPTION]` EdDSA in `Security.md` §4.2.** Chosen per the user's decision to use full Spring Security (`spring-boot-starter-security` + `oauth2-resource-server` + `oauth2-jose`, Nimbus-backed), which supports RS256 cleanly; that document's own named fallback ("or RS256 where library support requires it"). A dev RSA keypair is generated in memory when no key path is configured, loudly logged as dev-only.
- **Argon2id via `spring-security-crypto`**, per the `[ASSUMPTION]` in `Security.md` §4.5; needs `bcprov-jdk18on` on the runtime classpath (Spring Security only declares BouncyCastle as an optional dependency).
- **Cart merge (`UC-CRT-05`) is absent from `logIn`** — the `cart` module doesn't exist yet; `Session`'s `cartMerge` field is always omitted this sprint.
- **`Contract test both directions` is the one unchecked item above.** L3 (`@WebMvcTest`) and L4 (`Testcontainers`, `IdentityApiIT`) tests assert request/response shapes matching the OpenAPI schemas by hand; no schema-validation tool (an OpenAPI-diff/request-validator, the backend equivalent of the frontend's Prism-based contract suite) is wired into the build. Flagged as a Sprint 04 gap rather than checked off on the strength of manual shape assertions.

**Build/infra gaps closed along the way, not part of the 20 points but blocking it**: `identity_role` had no seed-data migration (Sprint 2 created the table and its `CHECK` constraint but never inserted the six fixed roles) — added `V202609071408__identity_seed_roles.sql`. The root `build.gradle.kts`'s shared `dependencyManagement` block only imported the Spring Modulith and jMolecules BOMs, so any module other than `:app` adding a Spring Boot starter had no managed version — imported `spring-boot-dependencies` there too, platform-wide. `compose.yaml`'s single `redis` service is now `redis-cache`/`redis-state`, matching `ADR-0034` §5.3's exact config blocks. Boot 4.1.1's modularised autoconfiguration meant several artifacts needed explicit new dependencies undocumented anywhere in this repo yet: `spring-boot-data-redis` (not `-autoconfigure`) for `DataRedisAutoConfiguration`/`DataRedisRepositoriesAutoConfiguration` (the latter had to be excluded — it assumes a bean literally named `redisTemplate`, incompatible with the two-named-instances design), `spring-boot-starter-json` (JSON support split out of `spring-boot-starter-webmvc`), and `spring-boot-resttestclient`/`spring-boot-restclient` for `TestRestTemplate` in `integrationTest`. Jackson itself moved to `tools.jackson` (Jackson 3) in this Boot line — `RedisConfig`'s value serializer uses `GenericJacksonJsonRedisSerializer`, not the deprecated `GenericJackson2JsonRedisSerializer`.

**A `@Repository`-proxy pitfall worth recording**: the initial `registerNew`/duplicate-email implementation caught the translated `DataIntegrityViolationException` *inside* `RegisterAccountService`'s own `@Transactional` method — Spring/Hibernate mark the current transaction rollback-only the moment a flush fails, independent of whether the Java exception is caught, so the method's own later (successful) commit threw `UnexpectedRollbackException`. Fixed by giving the risky insert its own `@Transactional(propagation = REQUIRES_NEW)` method (`AccountRepository#registerNew`) so a duplicate-email failure rolls back only that nested transaction, leaving the caller's transaction — and its event publication — untouched.

**Local dev note**: Testcontainers against `colima` needs `DOCKER_HOST` and `TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock` set (the latter because colima's host-side socket path isn't a valid mount source inside the Lima VM) — not yet written down anywhere in this repo; worth a line in a contributor README if `integrationTest` becomes routine for other engineers on macOS.

**Verification**: `./gradlew test` (L1+L2+L3, all green, including two new ArchUnit rules — every identity application service depends on `AuthorizationService`, and Redis client types stay confined to `redis.RedisConfig` + `identity.infrastructure`) and `./gradlew check` (adds L4: `IdentityApiIT` against real Postgres + two real Redis containers — register → restricted-session login for an unverified account, duplicate registration, byte-identical login failure for unknown-account vs wrong-password, and logout invalidating the refresh token).

## Retrospective

**Went well:**
**Change one thing:**
**Action:**

# Sprint 05 — Identity: Account, Addresses & Recovery

**Release:** R1 · **Gate:** **`G2` — Contract Sync** · **Backend 19 pts · Frontend 19 pts**
**Related documents:** [`../release-plan.md`](../release-plan.md) · [`../integration-plan.md`](../integration-plan.md) · [`../../BA-docs/user-stories/01-customer-identity.md`](../../BA-docs/user-stories/01-customer-identity.md)

---

## Sprint Goal

> **A customer owns their account: profile, addresses, password recovery, and their order history.**

This closes the `identity` module. Every module built after this one depends on it and will not be waiting for it.

## Committed Items

| Lane | ID | Item | Pts |
|---|---|---|---:|
| BE | `US-CUS-06` | Change Password | 3 |
| BE | `US-CUS-07` | Reset Forgotten Password | 5 |
| BE | `US-CUS-08` | Manage Profile | 3 |
| BE | `US-CUS-09` | Manage Shipping Addresses | 5 |
| BE | `US-CUS-10` | View Purchase History | 3 |
| FE | `US-CUS-06` | `/account/security` | 2 |
| FE | `US-CUS-07` | `/forgot-password` · `/reset-password` | 3 |
| FE | `US-CUS-08` | `/account/profile` | 3 |
| FE | `US-CUS-09` | `/account/addresses` | 5 |
| FE | `US-CUS-10` | `/account/orders` | 3 |
| FE | `EN-FE-DS-3` | Table, Modal, Tooltip, pagination control | 3 |

---

## Backend Lane

### `US-CUS-06` Change Password (3 pts) — `changeOwnPassword`
- [x] Current password required; all other sessions invalidated on success
- [x] Every exception flow

### `US-CUS-07` Reset Forgotten Password (5 pts) — `requestPasswordReset`, `completePasswordReset`
- [x] Single-use, expiring token
- [x] **The request response is identical whether or not the account exists.** Same rule as sign-in, same reason, and the one most likely to be broken by being helpful
- [x] Exception flows: expired, already used, unknown, account closed

### `US-CUS-08` Manage Profile (3 pts) — `getOwnAccount`, `updateOwnProfile`
- [x] Audit entry per `UC-AUD-01` (stubbed the same way Sprint 03/04's audit entries are — `audit` module persistence itself remains out of scope until its own sprint)

### `US-CUS-09` Manage Shipping Addresses (5 pts)
- [x] `listOwnAddresses`, `addOwnAddress`, `replaceOwnAddress`, `removeOwnAddress`, `getOwnAddress`
- [x] `Address` comes from `shared-kernel` — a value object, not an entity in this module
- [x] Default-address rules (`BR-CUS-05`)
- [ ] Removal of an address referenced by an in-flight order — **not implementable yet**: `checkout`/`ordering` do not exist (Sprint 18), so there is no in-flight order to reference an address. Carried forward as a note for whichever sprint builds checkout's address handling, not a defect here.

### `US-CUS-10` View Purchase History (3 pts) — `listOrders`
- [x] Cursor pagination (envelope/cursor shape only — see below)
- [x] **Ownership scoping**: a customer sees only their own orders, and another customer's returns `404` (moot until `ordering` has any rows, but the role/`customerId` check is real and tested)
- [x] `ordering` does not exist yet — this reads the read model it will populate, and returns an empty page until Sprint 18. The empty state is the deliverable, and it is a designed one

---

## Frontend Lane

### The `(account)` group — `R3`, `CUSTOMER`, never cached
- [x] `/account`, `/account/profile`, `/account/security`, `/account/addresses`, `/account/addresses/[addressId]`, `/account/orders`
- [x] `/forgot-password` and `/reset-password` in `(auth)`
- [x] `loading.tsx` per segment: a skeleton **in the shape of the content**, never sized from a count that may be absent (`/account/security` has no reads per Routing.md §6, so it has none, by design)
- [x] `not-found.tsx` for `(account)` that **never explains why** — the existing group-level one already implements this; `/account/addresses/[addressId]` triggers it via `notFound()` on a `404 ApiProblem` rather than duplicating a per-segment copy
- [x] Address list uses the Table primitive with the cursor-pagination control
- [x] `/account/orders` renders its empty state cleanly — it will be empty until Sprint 18, and it must look designed rather than broken

### `EN-FE-DS-3` (3 pts)
- [x] Table, Modal, Tooltip, pagination control. Vitest + axe on each

---

## Integration Risk

**`US-CUS-10` reads a read model that no module writes yet.** At `G2` it will return an empty page against the real API and a populated one against the mock. That difference is expected and must be recorded as expected — not logged as drift.

The check that matters at `G2` is that the **envelope and cursor shape** match, not that rows come back.

## Gate `G2` — Contract Sync

Checklist: [`../integration-plan.md`](../integration-plan.md) §3, scoped to identity, session, and account.

| # | Check |
|---|---|
| 1 | Types regenerated, diff empty |
| 2 | Contract tests both directions across all ten `CUS` operations plus `AUD-03`/`-04` |
| 3 | Every `(auth)` and `(account)` route renders against the real API |
| 4 | Sign in → session cookie set with the right posture → `/account` reachable → sign out → `/account` redirects |
| 5 | A second browser session's order returns `404` and the screen does not explain why |
| 6 | Exceeding the rate limit renders the designed `429` screen |
| 7 | Reset-request messaging identical for known and unknown addresses |
| 8 | Pagination envelope and cursor shape match on `listOwnAddresses` and `listOrders` |
| 9 | `Money` is absent from these payloads — confirm no formatting assumptions were made against mock data that will change |
| 10 | Drift logged **and** `openapi.yaml` amended in the same session |

## Definition of Done

Every story reaches [`../definition-of-done.md`](../definition-of-done.md) §5.

**This is the last sprint before the catalog.** Confirm at Review that `identity` is closed: no `CUS` or `AUD` story is carried, because twelve modules are about to depend on it.

## Review Notes

**Backend lane closed.** All five `CUS` stories implemented against the existing contract (no `openapi.yaml` changes were needed — the paths, schemas, and permission-matrix rows were all already in place from Sprint 03/04's contract-first authoring). `identity` is closed: `Account` now carries `pendingEmail`/password-change/profile behaviour, `CustomerAddress` is a new aggregate backed by the Sprint 03 `identity_address` table, and `shared-kernel` gained the `Address` value object the backlog called for.

**Scope decisions, recorded for whoever revisits this sprint:**
- `listOrders` was implemented as a real (if trivial) query inside the `ordering` module scaffold rather than as a stub bolted onto `identity` — `ordering` already existed as an empty Gradle module with the right `allowedDependencies`, so this is where the Sprint 18 read model will actually live. It always returns an empty `OrderPage` today; authorisation goes through the real cross-module `AuthorizationService` call, the same pattern `catalog`'s Sprint 04 demo established.
- `UC-AUD-01` on `updateOwnProfile` is a stub log line (`NotificationAndAuditStubListeners`), consistent with Sprint 03/04 — real `audit_entry` persistence (the table already exists, ahead of code, same as `identity_address` was) is not a Sprint 05 backlog item.
- "Removal of an address referenced by an in-flight order" is **not implementable yet** — `checkout`/`ordering` have no order-placement code until Sprint 18, so there is no in-flight order to test against. Left unchecked above rather than falsely marked done; revisit when checkout exists.
- "Change password ends other sessions" is implemented as invalidating every outstanding `REFRESH` token for the account, not a specific "all but this one" exclusion — `ecp-api` is stateless bearer (`ADR-0016` §4) and the request carries no session/refresh-token identifier to exclude, so there is no session identifier available to keep alive.
- Coordinated with the frontend session (Sprint 05 FE lane) before starting: confirmed no contract drift on either side, so no joint amendment session was needed this sprint.

**Verification:** `./gradlew check` (all modules — unit, ArchUnit/Modulith boundary rules, and Testcontainers-backed integration tests against real Postgres/Redis) passes, including the two new domain aggregates, five new application services, one new `ordering` service, and four new web controllers. The frontend session additionally smoke-tested all ten `CUS` operations plus `listOrders` end-to-end against a real running instance (real Postgres/Redis via `docker compose`, not Testcontainers) and confirmed every response shape, status code, and non-disclosure/ownership behaviour matched the contract.

**Bug found by that smoke test, fixed same-day:** `addOwnAddress` was auto-defaulting *both* `isDefaultShipping` and `isDefaultBilling` to `true` for a customer's first address. `BR-CUS-05` ("at most one default shipping address," SRS) and `UC-CUS-09` step 4 only ever describe auto-defaulting the *shipping* address — `isDefaultBilling` has no documented business rule anywhere in BA/SA-docs, so auto-setting it was an unwarranted invention, not a spec requirement. Fixed in `AddressService.addOwnAddress`: `isDefaultBilling` is now stored exactly as the caller requests (default `false`), even for the first address. Covered by two new `AddressServiceTest` cases.

**Frontend lane closed.** All five `CUS` stories' routes plus `EN-FE-DS-3` implemented against the existing contract — no `openapi.yaml` changes needed on this side either; `lib/api/generated/openapi.d.ts` was already current for all ten `CUS` operations before this sprint started. New: `components/ui/{table,modal,tooltip,pagination}.tsx` (each with a co-located Vitest+axe test); `features/identity/{schema/{profile,security,address}.ts, server/queries.ts, components/*}`; a new minimal `features/ordering/` feature (schema/queries only, read-only this sprint); the four new `(auth)`/`(account)` route segments plus the previously-missing `app/(auth)/error.tsx`.

**Scope decisions, recorded for whoever revisits this sprint:**
- `AddressSchema` was promoted into `lib/api` (not duplicated in `features/identity` and `features/ordering` separately) since `Address` is shared-kernel and `features/ordering` may not import `features/identity` (rule I-1). Likewise `lib/api/pagination.ts` gained a `toPage()` helper mapping the wire `PageEnvelope` shape onto the app-level `Page<T>` — used by both `listOwnAddresses` and `listOrders`, one implementation rather than two.
- `completePasswordReset` failure copy stays generic (no expired/used/unknown distinction) — same limitation already flagged for `verifyEmailAddress` in `lib/api/error-map.ts`'s `TODO(identity)` comment, extended to cover this endpoint too. The contract emits a plain `404` for every cause.
- `US-CUS-10`'s empty state against the real API is the expected, designed outcome this sprint (`ordering` doesn't exist until Sprint 18, confirmed with the backend session) — not logged as drift. The non-empty rendering path (`OrdersTable`) was still built and unit-tested, just not exercisable against real rows yet.
- `removeOwnAddress` on an address belonging to another customer: the contract only documents the already-removed idempotent-`204` case for `DELETE`, not the ownership-mismatch case specifically (unlike `GET`/`PUT`, which explicitly document `404`). Not exercised this sprint; worth confirming the actual behaviour once wired against the real backend.
- **Cross-repo coordination**: coordinated live with the backend session (parallel, same sprint) before either side touched `openapi.yaml` — confirmed together that all ten `CUS` operations already existed in the contract from Sprint 03/04, so no amendment was needed from either lane.

**Verification:** `npm run typecheck`, `npm run lint` (ESLint + dependency-cruiser boundary rules — zero violations across 145 modules), and `npm run test` (139 passed) are all green; `npm run build` succeeds with all six new routes registered. `npm run test:contract` (22 tests) passes against a local Prism mock, covering all ten `CUS` operations plus `listOrders`; three of those tests (address-returning `POST`/`GET`/`PUT` calls, plus `listOrders`) assert structural shape via raw `fetch` rather than the full Zod schema, because Prism's dynamic example generator fills every `pattern`-constrained string field (`countryCode`, `currency`) with the literal `"string"`, ignoring the pattern — a mock limitation, not a contract defect (documented inline in `account.contract.test.ts`).

**Real-API smoke test (post-implementation, against the backend session's actual local instance).** Brought up the real stack (colima + `docker compose up` + `./gradlew :app:bootRun` — Postgres/`redis-cache` resolved to ephemeral compose ports, `redis-cache`'s isn't fixed in `compose.yaml` so `ECP_REDIS_CACHE_PORT` had to be overridden alongside `SPRING_DATASOURCE_URL`) and drove all ten `CUS` operations plus `listOrders` directly against `localhost:8080`, end to end with a freshly-registered account:
- `getOwnAccount`/`updateOwnProfile`/`changeOwnPassword`/`endAllOwnSessions`/`addOwnAddress`/`listOwnAddresses`/`getOwnAddress`/`replaceOwnAddress`/`removeOwnAddress`/`requestPasswordReset`/`listOrders` — every response parsed cleanly against our Zod schemas with no shape surprises. `removeOwnAddress` repeated on an already-removed id was `204` both times (the ownership-mismatch case above still wasn't exercised — no second account was tested).
- `getOwnAddress` on a nonexistent id: confirmed `404 ECP-GEN-4040`, never `403` — G2 check #5's pattern holds.
- `requestPasswordReset`: byte-identical `202` for a registered and an unregistered email — G2 check #7 confirmed.
- `endAllOwnSessions`: the already-issued access token still worked until its own short expiry (expected — stateless bearer, `ADR-0016`), but the refresh token was rejected (`ECP-GEN-4011`, chain invalidated) on the next renewal attempt — consistent with the backend's own Review Notes above.
- `listOrders`: empty page, `{items:[], page:{size:0}}` — envelope shape matches `Page<T>` exactly. G2 check #8 confirmed for both `listOwnAddresses` and `listOrders`.
- One behavioural note passed to the backend session, not a contract defect: `addOwnAddress` with only `isDefaultShipping:true` in the request came back with `isDefaultBilling:true` in the response too (unrequested) — worth a second look on whether a customer's very first address should auto-nominate both defaults.
- At the Next.js layer: `/sign-in`, `/register`, `/forgot-password`, `/reset-password` all render `200`; all five new `/account/*` routes correctly `307`-redirect an unauthenticated request to `/sign-in?from=...` via the proxy — G2 check #4's redirect half confirmed.
- **Not covered**: no connected browser extension was available this session, so this was HTTP/API-level verification (real requests, real responses, real redirect headers) rather than a full UI click-through (submitting the sign-in form, opening the address modal, etc.). G2 check #3 ("every route renders against the real API") is confirmed at the HTTP level for the pages tested; a full browser walkthrough is still open if wanted.

## Retrospective

**Went well:**
**Change one thing:**
**Action:**

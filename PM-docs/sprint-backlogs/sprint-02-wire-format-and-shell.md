# Sprint 02 — Wire Format & Application Shell

**Release:** R1 · **Gate:** none · **Backend 20 pts · Frontend 20 pts**
**Related documents:** [`../release-plan.md`](../release-plan.md) · [`../definition-of-done.md`](../definition-of-done.md) · [`../../SA-docs/04-shared/Integration Contract.md`](../../SA-docs/04-shared/Integration%20Contract.md)

---

## Sprint Goal

> **Every response shape a controller will ever return is decided once, before the first domain controller exists.**

This is the sprint that prevents the failure [`ADR-0031`](../../SA-docs/01-system/ADR/ADR-0031-contract-first-openapi.md) §1 exists to prevent: the wire format being decided one controller at a time. The error envelope, the pagination envelope, and the correlation header are cross-cutting, and retrofitting any of them across thirteen modules is an order of magnitude more expensive than deciding them now.

## Committed Items

| Lane | ID | Item | Pts |
|---|---|---|---:|
| BE | `EN-DATA-2` | Flyway baseline, per-module table-prefix conventions, migration map | 8 |
| BE | `EN-WIRE-1` | Problem+JSON advice, error-code registry, pagination envelope, correlation filter | 12 |
| FE | `EN-FE-SHELL-1` | Root layout, CSP nonce, middleware, four route-group layouts, chrome | 14 |
| FE | `EN-FE-DS-1` | Design system: Button, Input, Card | 6 |

---

## Backend Lane

### `EN-DATA-2` — migrations (8 pts)

- [x] Flyway configured to run on `ecp-api` startup, **before the context is ready**; readiness fails while migrations run so `nginx` does not route to a starting instance
- [x] Migration layout per module, following the map in [`Database.md`](../../SA-docs/02-backend/Database.md)
- [x] Table-prefix convention enforced: `identity_`, `catalog_`, `inventory_`, `cart_`, `ordering_`, `payment_`, `shipping_`, `promotion_`, `review_`, `notification_`, `audit_`, `reporting_`
- [x] An integration test asserting **no foreign key crosses a prefix** — `ordering_order` must not reference `catalog_product`. A shared schema is not a shared model
- [x] Baseline migration applied against the Testcontainers instance and against the Compose instance

### `EN-WIRE-1` — the wire format (12 pts)

- [x] `@RestControllerAdvice` producing problem+JSON per [`Integration Contract.md`](../../SA-docs/04-shared/Integration%20Contract.md) §4.1
- [x] Error-code registry as domain enums, seeded from [`Error Codes.md`](../../SA-docs/04-shared/Error%20Codes.md). **The two recorded drifts from the `ECP-<DOMAIN>-<NNNN>` scheme are resolved here**, not carried forward
- [x] Validation-error shape per §4.3
- [x] Pagination envelope per §3.1, **cursor-based, never offset** (§3.2)
- [x] Filtering and sorting conventions per §3.3
- [x] `X-Correlation-Id` filter: thread an inbound id or mint one; put it on the MDC so every log line carries it
- [x] Structured JSON logging to stdout, one stream per container
- [x] L3 web-slice tests asserting the envelope and the problem shape against a stub controller — a container start-up to assert a JSON field name is the waste L3 exists to avoid

---

## Frontend Lane

### `EN-FE-SHELL-1` — route groups and chrome (14 pts)

- [x] Root `app/layout.tsx`: html, body, fonts, providers, **the per-request CSP nonce**
- [x] The four route groups with their layouts and postures, per [`Routing.md`](../../SA-docs/03-frontend/Routing.md) §2:

| Group | Session | Cookie | Chrome |
|---|---|---|---|
| `(storefront)` | optional | `Lax` | header · search · cart badge · footer |
| `(auth)` | none by construction | `Lax` | minimal, no navigation |
| `(account)` | required, `CUSTOMER` | `Lax` | storefront shell + account sidebar |
| `(admin)` | required, operator | **`Strict`** | dense operator navigation, no storefront chrome |

- [x] `checkout/layout.tsx` **nested inside `(storefront)`**, not a fifth group — the customer is still shopping; what changes is that navigation is suppressed so the funnel has one exit
- [x] Middleware doing exactly four things and no more: security headers + CSP nonce; thread/mint `X-Correlation-Id`; redirect unauthenticated callers away from `(account)` and `(admin)` with a return path; select cookie posture per group
- [x] **Middleware makes no API call.** It reads the cookie's *presence*, not its meaning
- [x] A comment at the redirect noting it is routing, not authorisation — threat `T9` of [`Security.md`](../../SA-docs/01-system/Security.md) §13 exists because a redirect looks like a permission check
- [x] `components/layout/`: header, footer, account sidebar, admin shell
- [x] `robots.txt` and `sitemap.xml` generated from `R1` routes only; `(auth)`, `(account)`, `(admin)`, cart and checkout carry `noindex`

### `EN-FE-DS-1` — first primitives (6 pts)

- [x] Button, Input, Card in `components/ui/`, built on the *Ma* tokens
- [x] Targets ≥ 44 × 44 px with visible focus
- [x] No `outline: none` anywhere — lint enforces it
- [x] Vitest + axe on each; token-contrast assertion on the pairs each uses
- [x] Rule `I-5` holds: these import nothing from `features/` or `lib/api`. A design-system component that fetches is no longer a design-system component

---

## Integration Risk

**The CSP and the nonce versus static generation.** [`Performance.md`](../../SA-docs/03-frontend/Performance.md) names this trade explicitly: a per-request nonce makes a route dynamic, and the `R1` catalog routes of Sprint 06–07 must stay static. Resolve the interaction **this sprint**, while the shell is empty and cheap to change — not in Sprint 06 when three static routes depend on the answer.

## Definition of Done

Every item satisfies [`../definition-of-done.md`](../definition-of-done.md) §3 or §4.

Additionally, demonstrated at Review:
- [x] A `404` from the stub controller renders as problem+JSON with a correlation id and **no stack, no response body** — verified both via `WireFormatWebTest` (L3, stub controller) and live against a running `ecp-api` hitting a genuinely unmapped route (see backend Review Notes)
- [x] Each of the four route groups renders its shell with the correct cookie posture

## Review Notes

*(2026-09-11, backend lane — `ecommerce-backend-spring`)*

`EN-DATA-2` shipped: all 37 Flyway scripts (`app/src/main/resources/db/migration/`) — the 33 scripts named in [`Database.md`](../../SA-docs/02-backend/Database.md) §8's map, minus the one shared `V…__shared_create_processed_event.sql`, plus one script per consuming module instead (`catalog`, `ordering`, `shipping`, `reporting`) per §11 Open Question 7's own recommendation — plus the repeatable `R__reporting_order_summary_view.sql`. `app/build.gradle.kts` gained `spring-boot-starter-jdbc`, `spring-boot-starter-validation`, `spring-boot-starter-flyway` (see the dependency-naming finding below), and `org.flywaydb:flyway-database-postgresql`, wired into both `main` and the `integrationTest` source set. `NoCrossModuleForeignKeyIT` and `FlywayMigrationIT` (new) run the full script set against Testcontainers PostgreSQL: every FK stays within its own module prefix (23 foreign keys checked, zero violations), and all 37 migrations apply cleanly to an empty database. `ecp_app` (`GRANT INSERT, SELECT` / `REVOKE UPDATE, DELETE, TRUNCATE`) is created by the first script for `audit_entry`'s protections to attach to; the application does not yet connect as that role (still `postgres`/env-provided credentials) — least-privilege runtime connection is an open item ADR-0029 §5 itself defers, not new scope this sprint.

`EN-WIRE-1` shipped: `Problem`/`FieldError`/`Page`/`PageEnvelope` records and `GlobalExceptionHandler` (`@RestControllerAdvice`) in the new `app/src/main/java/org/phuchoang/ecp/web/` package, plus `CorrelationIdFilter` (`OncePerRequestFilter`, `@Order(HIGHEST_PRECEDENCE)`, MDC key `correlationId`), `Pagination` (clamp + opaque cursor encode/decode), `SortSpec`/`QueryParams` (unknown-parameter and non-sortable-field rejection), and `ValidationException`. `ErrorCode` (interface) and `GenErrorCode` (the 7 `GEN` codes plus the undeclared `ECP-GEN-5000` fallback) live in `shared-kernel/.../sharedkernel/api/` — **directly in `api`, not a nested `api/error` subpackage**, because Spring Modulith's `@NamedInterface` exposes only the exact annotated package, not its subpackages (`ModularityTests` caught this immediately: six "depends on non-exposed type" violations the first time the subpackage was tried). Six domain-specific enums — `InventoryErrorCode`, `CartErrorCode`, `OrderErrorCode`, `PaymentErrorCode`, `PromotionErrorCode`, `ReviewErrorCode` — are each the first real class in their module's `api` package, matching Backend Architecture.md §6.3's "one enum per domain" rule. The two `Error Codes.md` §5 drifts (`ECP-SEC-*` → `ECP-GEN-*`, `ECP-SCH-5030` → `ECP-GEN-5030`) are resolved by construction: no `SEC` or `SCH` entry exists anywhere in the enum set. `WireFormatStubController`/`WireFormatWebTest` (test-only, `app/src/test`) exercise every shape — success, bean-validation failure (multiple fields at once), a domain error mapped through its own `ErrorCode`, an unmapped exception falling back to `ECP-GEN-5000` at `WARN`, the pagination envelope, oversized-page clamping, and unknown-query-parameter rejection — 9 tests, all green.

**Scope decisions:**
- **No CI enum↔registry diff check built.** Backend Architecture.md §6.3 describes generating `04-shared/Error Codes` from the enums and diffing it in CI as the eventual mechanism; it is not on this sprint's checklist, and nothing here blocks adding it later.
- **`ECP-GEN-4000`'s field-level sub-code space stays open, not enumerated**, per Error Codes.md §4 — only the two documented examples (`ECP-GEN-4002` required, `ECP-GEN-4003` range/length) are declared, in a new `FieldErrorCodes` holder. `ECP-GEN-4001` is deliberately absent, matching the registry's own note that it is unassigned everywhere.
- **No `?sort=` + `?q=` together → `422` rule enforced.** Integration Contract §3.3 states it, but no `GEN` code exists for a generic 422 (only domain-specific ones like `ECP-ORD-4220` do), and no real search endpoint exists yet to need it. Left for whichever module builds the first `q=` endpoint.
- **No JPA/Hibernate starter added** — `ddl-auto=validate` (ADR-0029) has nothing to validate against with zero entities in the codebase; `spring-boot-starter-jdbc` alone gives Flyway the `DataSource` it needs.

**Findings:**
- **Spring Boot 4.1.1 splits test-slice support per starter.** `@WebMvcTest` is no longer in `spring-boot-test-autoconfigure` (which now holds only `jdbc`/`json` slices) — it moved to `org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest` in a new `spring-boot-webmvc-test` module, pulled in by `spring-boot-starter-webmvc-test`, not by the generic `spring-boot-starter-test`. Cost a compile failure to discover; worth knowing before adding any other test slice (`@DataJdbcTest` et al. likely follow the same per-starter pattern).
- **`org.flywaydb:flyway-core` + `flyway-database-postgresql` alone do not activate `FlywayAutoConfiguration` in Boot 4.1.1** — that autoconfiguration now lives in `spring-boot-flyway`, pulled in only by `spring-boot-starter-flyway`. The first pass added the raw Flyway dependencies directly (matching ADR-0029 §4's dependency list, written before this modularisation) and the app booted in ~6s with no Hikari/Flyway log line at all — silently skipping migration entirely rather than failing loudly, which is the dangerous failure mode. Caught by actually running the app against a live PostgreSQL (see verification below), not by the test suite, since `@SpringBootTest`/`@WebMvcTest` slices don't exercise a real `DataSource`. Switched to `spring-boot-starter-flyway`; ADR-0029 §4's dependency line is now stale for Boot 4.x and worth a correction pass.
- **`EcpApplicationTests.contextLoads()` (Sprint 0) moved from `test` to `integrationTest`** as `EcpApplicationIT`, importing the existing `TestcontainersConfiguration`. Once Flyway genuinely runs, a full `@SpringBootTest` context load needs a real PostgreSQL — exactly the scaffolding Sprint 1's Review Notes flagged `TestcontainersConfiguration` as "forward-looking" for. Leaving it in `test` would have meant either a fast-suite test silently depending on `localhost:5432` or (worse) `ArchitectureTests.fastSuiteImportsNoTestcontainers` forcing the same move anyway.

**Verification:** `./gradlew check` green across all 14 subprojects (L1–L3 fast suite plus `app:integrationTest`'s `PostgresConnectivityIT`, `EcpApplicationIT`, `FlywayMigrationIT`, `NoCrossModuleForeignKeyIT`, all against Testcontainers PostgreSQL). **The "Compose instance" leg of `EN-DATA-2`'s last checklist item was independently verified this sprint** (Sprint 1 could not, for lack of `docker compose` in this Colima setup — same limitation confirmed still present here): started `postgres:16` via plain `docker run` with `compose.yaml`'s exact environment, ran `./gradlew :app:bootRun` against it with `SPRING_DATASOURCE_*` env vars, and confirmed live — all 37 migrations applied (Flyway's own startup log), `/actuator/health/readiness` returned `200` only after migration completed, `/healthz` returned `OK`, structured JSON log lines appeared on stdout, and `curl` against a genuinely unmapped route (not the stub controller) returned the exact problem+json shape with the supplied correlation id echoed back, no stack, no leaked body. Container torn down after.

*(2026-09-11, frontend lane — `ecommerce-frontend-next`)*

`EN-FE-SHELL-1` shipped: `proxy.ts` at the repo root (**not** `middleware.ts` — Next.js 16 renamed the file convention and the exported function from `middleware` to `proxy`; `AGENTS.md`'s "not the Next.js you know" warning was correct to flag this), doing exactly the four things the backlog specifies and no more. `app/(storefront)`, `app/(auth)`, `app/(account)`, `app/(admin)` route groups with their layouts, `app/(storefront)/checkout/layout.tsx` nested inside storefront, `components/layout/{header,footer,account-sidebar,admin-shell}.tsx`, `app/robots.ts`/`app/sitemap.ts` restricted to `R1`. `app/page.tsx` and `app/product-demo/page.tsx` (Sprint 1's walking-skeleton demo) moved under `(storefront)/` via `git mv`, not deleted — still useful as a live demo of the fetch client and not yet superseded by a real catalog route.

**The CSP/static-generation trade (this sprint's Integration Risk) resolved as `Performance.md` §7 prescribes**: `R1` routes (`/`, `/c/*`, `/p/*`) get a **static** CSP with no nonce, set via `next.config.ts`'s `headers()` and verified by Subresource Integrity (`experimental.sri.algorithm: "sha256"`) instead — confirmed live post-build that `/` renders as a static (`○`) route while `/account`, `/admin`, `/checkout`, `/sign-in` render dynamic (`ƒ`). Every other route gets a per-request nonce from `proxy.ts`. Verified live: `curl -I /` shows `script-src 'self'` with no `nonce-` token; `curl -I /cart` shows a fresh `nonce-` value on every request. Documented as a trade, not a solved problem, per `Performance.md` §7 — a Next.js upgrade that changes the framework's inline bootstrap could require revisiting the SRI approach; the fallback (relax the `P1` `600ms` TTFB budget rather than weaken the policy) is named in `lib/observability/csp.ts`'s own comment, not just this note.

**Auth-redirect is routing, not authorisation, and says so at the code.** `proxy.ts` checks only for the presence of a `SESSION_COOKIE_NAME` cookie (`"ecp_session"`, a new constant in `lib/session/index.ts` — the eventual custodian, though real issuance is still Sprint 1's provisional no-op seam) and never calls an API. Verified live: `/account` and `/admin` without the cookie 307-redirect to `/sign-in?from=<path>`; with the cookie present, both render their shell (200, no redirect) — the admin shell renders for *any* present cookie, by design, since role is never checked here (`Security.md` §13, threat T9; `ecp-api` enforces on every read once it exists).

**Correlation id threading centralised.** Moved `newCorrelationId()`/the `X-Correlation-Id` header name out of `lib/api/headers.ts` and into a new `lib/observability/correlation-id.ts` (re-exported from `lib/api/headers.ts` unchanged, so `lib/api/client.ts` needed no edit) — both `proxy.ts` and `lib/api` now share one generation strategy instead of two independent `crypto.randomUUID()` call sites. Verified live: an inbound `X-Correlation-Id` header is threaded through unchanged; a request without one gets a fresh UUID minted and echoed on the response.

**Design-system components (`EN-FE-DS-1`) follow Sprint 0's `Button` pattern exactly**: `Input` and `Card` (+ subcomponents `CardHeader`/`CardTitle`/`CardDescription`/`CardContent`/`CardFooter`) in `components/ui/`, Ma tokens only (`rounded-control`/`rounded-card`, `h-control-sm`, five-role palette), each with a `render + axe(container)` test pair mirroring `button.test.tsx`. `Input` keeps `outline-none` (a Tailwind utility resetting the UA default) paired with a `focus-visible:ring-2` — this does not trip the `outline: none` lint ban, which matches literal CSS-property text, not the Tailwind class name; a dedicated test asserts the ring class is present so the pairing can't silently regress. No new token-contrast pairs were introduced beyond what `styles/theme.contrast.test.ts` already covers.

**Real bug found and fixed, same class as Sprint 1's `lib/api/*` finding**: `eslint-plugin-boundaries`'s single-star element patterns (`components/ui/*`, `components/layout/*`, and the pre-existing `app/*`) **do not reliably match a direct file** in the installed `@boundaries/elements` version — confirmed directly against the library (`components/ui/*` failed to classify `components/ui/button.tsx` at all; `components/ui/**` did). Every new `app/` file under a route group therefore first failed `boundaries/no-unknown-dependencies` for importing `@/components/ui/*`/`@/components/layout`, not because of anything route-group-specific (parenthesised folder names matched `app/**` fine on their own — verified separately with `micromatch.isMatch`). Fixed by switching `app`, `components-ui`, and `components-layout` element patterns to the double-star form, matching the precedent `.dependency-cruiser.cjs`'s comments already point at. Also added a `lib-api → lib-observability` boundaries policy edge (needed once `lib/api/headers.ts` started importing the shared correlation-id helper) — `lib/observability` was already covered by the `no-stores-from-server` dependency-cruiser rule, so no change was needed there.

**Scope decisions:**
- `app/(account)/account/page.tsx` and `app/(admin)/admin/page.tsx` are minimal stub pages (an overview heading, a dashboard heading) — enough to prove the shell/posture/chrome, not real account or admin screens (those are later-sprint feature work). Same for `app/(auth)/sign-in/page.tsx` (a plain form, no Server Action wired yet — `lib/session`'s cookie issuance is still a no-op) and `app/(storefront)/checkout/page.tsx`.
- `app/sitemap.ts` currently emits one entry (`/`) — category (`/c/...`) and product (`/p/...`) entries need `features/catalog` to expose a listing to enumerate from, which doesn't exist yet. The file is wired correctly and restricted to `R1`; it just has nothing more to list yet.
- The DoD's stub-controller problem+JSON demo is backend-owned (a separate session executing `EN-DATA-2`/`EN-WIRE-1` concurrently) and not independently re-verified in this pass — the frontend's own `error.tsx`/`not-found.tsx` boundaries (Security.md §8.4: no stack, no response body, only a `digest` reference) are built and were manually verified to return the correct status codes.
- `.github/workflows/frontend-ci.yml`, recorded as shipped in Sprint 1's review notes, is **absent from the working tree** — flagged here as a pre-existing gap, not fixed in this pass (out of this sprint's committed scope; carried to Retrospective).

**Verification:** `npm run lint` (ESLint + `depcruise`), `npm run typecheck`, `npm run test` (57 Vitest tests, up from 18 after Sprint 1 — includes 2 new axe-covered component test files (`Input`, `Card`), `csp.test.ts`, `correlation-id.test.ts`, and `proxy.test.ts` exercising `proxy()` directly against real `NextRequest` instances), `npm run build`, and the existing Playwright smoke spec all green. `next build`'s route table confirms `/` is static (`○`) and `/account`/`/admin`/`/checkout`/`/sign-in`/`/product-demo` are dynamic (`ƒ`), matching `ADR-0019`'s classification.

## Retrospective

**Went well:** The walking-skeleton habit from Sprint 1 paid off again — actually building four real route-group layouts and running `curl` against a live `next start` (not just unit tests) is what surfaced the `eslint-plugin-boundaries` single-star bug before it silently blocked every future `app/` file that imports a design-system component, and confirmed the CSP/SRI split behaves as `Performance.md` §7 predicted rather than just compiling. On the backend, the same habit caught something a test suite structurally could not: `./gradlew check` was green throughout the Flyway-dependency mistake (the wrong Boot 4 artifact silently skipped migration rather than failing), because every test slice mocks or containerises its own database rather than booting the real app against one — only running `bootRun` against a live PostgreSQL surfaced the missing Hikari/Flyway log lines.

**Change one thing:** The Next.js 16 `middleware.ts` → `proxy.ts` rename is exactly the kind of breaking change `AGENTS.md` warns about, and it would have been easy to write `middleware.ts` from habit and have it silently not run. Worth a standing reminder to check `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/` for the specific file convention before naming any new special file, not just before writing route logic. On the backend: Spring Boot 4's per-starter modularisation (`spring-boot-starter-webmvc-test`, `spring-boot-starter-flyway`, and presumably more waiting to be discovered) means every dependency ADR-0029/Technology Stack.md wrote before Boot 4.1.1 was pinned needs re-checking against the actual artifact graph, not assumed from Boot 2/3 habit — worth a dedicated pass before the next sprint that adds a new starter blind.

**Action (carried to next sprint's board):**
- `.github/workflows/frontend-ci.yml` needs to be (re)created — it doesn't exist despite being recorded as shipped in Sprint 1, so no CI currently runs `lint`/`typecheck`/`test`/`build`/`depcruise`/the OpenAPI diff on this repo at all.
- ~~Backend lane (`EN-DATA-2`, `EN-WIRE-1`) is owned by a separate concurrent session; this sprint's frontend/backend reconciliation pass (checking both DoD items, both Committed Items rows) still needs a follow-up commit once that lane completes~~ — **done, this pass**: both DoD demonstration items and both backend Committed Items are checked above.
- `app/(storefront)/product-demo/page.tsx` is still explicitly a throwaway (per its own comment) — remove once a real `features/catalog` product route exists.
- `ADR-0029` §4's dependency line (`org.flywaydb:flyway-core` plus `flyway-database-postgresql`) is stale for Boot 4.1.1 — it should read `spring-boot-starter-flyway` plus `flyway-database-postgresql`. Worth a correction pass on the ADR itself, not just the code.
- Least-privilege runtime DB role (`ecp_app`, created but not yet the connection role `ecp-api` runs as) is still open, per ADR-0029 §5's own deferral — worth picking up whenever the security-operational gaps get their own sprint.
- `04-shared/Error Codes.md`'s hand-authored registry is now provably behind the code (six domain enums exist that the doc never names as "enum-backed" yet) — still correctly marked `Proposed`/interim, but the generated-registry-plus-CI-diff mechanism `Backend Architecture.md` §6.3 describes is worth scheduling once enough domains have real codes to make the generator worth building.

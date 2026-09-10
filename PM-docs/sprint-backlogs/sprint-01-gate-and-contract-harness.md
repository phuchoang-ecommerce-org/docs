# Sprint 01 — Foundation: Architecture Gate & Contract Harness

**Release:** R1 · **Gate:** **`G0` — Walking Skeleton** · **Backend 20 pts · Frontend 20 pts**
**Related documents:** [`../release-plan.md`](../release-plan.md) · [`../integration-plan.md`](../integration-plan.md) · [`../definition-of-done.md`](../definition-of-done.md)

---

## Sprint Goal

> **The architecture gate is real, and the contract harness runs.** ArchUnit fails on a deliberately planted violation and then passes when it is removed; `ecp-web` renders typed, parsed data served from `openapi.yaml` through Prism.

Both halves of that sentence are demonstrations rather than green builds. A gate nobody has seen fail is a gate nobody knows works.

## Committed Items

| Lane | ID | Item | Pts |
|---|---|---|---:|
| BE | `EN-GATE-1` | ArchUnit + JMolecules + `ApplicationModules.verify()`; allow-lists; planted-violation demo | 13 |
| BE | `EN-DATA-1` | PostgreSQL + Kafka in `compose.yaml`; Testcontainers PostgreSQL + JDBC driver | 7 |
| FE | `EN-FE-API-1` | The one fetch client; codegen + diff gate; Zod boundary parsing; error→screen map; cursor pagination | 14 |
| FE | `EN-MOCK-1` | Prism mock harness off `openapi.yaml`, seeded examples | 6 |

---

## Backend Lane

### `EN-GATE-1` — the governance gate (13 pts)

[`ADR-0018`](../../SA-docs/01-system/ADR/ADR-0018-architecture-governance-ci-gate.md) is marked `Accepted` with no implementation behind it. That is the one state a governance decision must not stay in, and this closes it.

- [x] JMolecules on the build — half the `ADR-0018` §4 rules assert on its annotations
- [x] `ApplicationModules.of(EcpApplication.class).verify()` as a single test method. **It is not wrapped, softened, or caught** — its failure message is the whole diagnosis (Testing Strategy §6.2)
- [x] ArchUnit rules for the layer table of [`Module Dependency Diagram.md`](../../SA-docs/02-backend/Module%20Dependency%20Diagram.md) §6:
  - `domain` → the kernel only. Never Spring, JPA, Jackson, or a provider SDK
  - `application` → domain and ports. Never infrastructure, never `api`
  - `infrastructure` → domain, application, ports. Never `api`
  - `api` → application. Never domain internals
- [x] ArchUnit rules for the forbidden edges of §7:
  - No outbound dependency from `shared-kernel`
  - No `@AggregateRoot` or `@Repository` stereotype in the kernel package
  - No `domain` package naming `identity` or any other module
  - No module depending on `app`
- [x] ArchUnit rule: **no Testcontainers import in the fast-suite source set** — this is what keeps the fast/slow split from eroding within a month (Testing Strategy §4)
- [x] L2 runs in the **fast** suite and completes under 60 s

**Planted-violation demonstration** — the deliverable. Each is added, the build is shown to fail with a comprehensible message, and it is removed:
- [x] `review` → `payment` (an edge no allow-list grants)
- [x] `inventory` → `ordering` (inverts the Partnership direction §3.1 fixes)
- [x] A `domain` class importing `identity`
- [x] A class reaching into another module's `application` package

### `EN-DATA-1` — the data tier (7 pts)

PostgreSQL is the source of truth under [`ADR-0009`](../../SA-docs/01-system/ADR/ADR-0009-postgresql-source-of-truth.md) and is absent from both the Compose file and the test containers. Testing Strategy §12 calls this *"the first thing to fix."*

- [x] PostgreSQL added to `compose.yaml`, same image version as production
- [x] Kafka added to `compose.yaml`
- [x] PostgreSQL JDBC driver on the classpath
- [x] `TestcontainersConfiguration` gains PostgreSQL (see Review Notes — the "alongside the existing Elasticsearch, Kafka, MongoDB and Redis" premise did not hold)
- [x] Testcontainers reuse **on** locally, **off** in CI — locally it turns an 8-minute L4 run into roughly one; in CI it hides cross-test state
- [x] One L5 test proving a real transaction against the container

---

## Frontend Lane

### `EN-FE-API-1` — the one fetch client (14 pts)

- [x] `lib/api/` with `import 'server-only'`. **One** fetch client; nothing outside `lib/api` imports it (rule `I-4`)
- [x] It attaches: the session cookie, `X-Correlation-Id`, the CSRF token on writes, and `Idempotency-Key` where required
- [x] `openapi-typescript` script generating from `../docs/SA-docs/04-shared/OpenAPI/openapi.yaml`
- [x] Output **checked in**; a CI step regenerates and **fails on a diff** — a stale generation is worse than none
- [x] Zod parsing at the boundary. Every query returns parsed, typed data **or throws a typed problem**
- [x] Problem+JSON parsed into the error taxonomy of [`Integration Contract.md`](../../SA-docs/04-shared/Integration%20Contract.md) §4
- [x] The error-code→screen map, with the two that are *designed outcomes* rather than errors already wired: `ECP-INV-4091` → "sold out", `ECP-PRM-4090` → promotion usage-limit/concurrency conflict (see Review Notes — corrected from this item's original "voucher-field failure" wording)
- [x] Cursor pagination helper — cursor, never offset
- [x] Branded types: `OrderId`, `ProductId`, `SkuId`, `CartId`; `Money` with `amount` as **`string`**
- [x] A lint rule or test asserting **no arithmetic on `Money`**

**Not built:** a generated client. Teaching a generated artefact the session cookie, correlation header, idempotency key, problem-JSON parsing and cursor pagination is more work than the wrapper, and the wrapper is reviewable ([`ADR-0036`](../../SA-docs/01-system/ADR/ADR-0036-nextjs-server-sole-api-caller.md)).

### `EN-MOCK-1` — the Prism harness (6 pts)

This is the item the entire parallel-lane plan rests on.

- [x] `@stoplight/prism-cli` as a dev dependency
- [x] `npm run mock:api` → Prism serving `openapi.yaml` on `localhost:4010`
- [x] `npm run docs:openapi:lint` (from `util/`) passes before Prism is pointed at the file
- [x] Response examples seeded in the spec where Prism's generated values would be unusable for layout work — prices, names, image dimensions (see Review Notes — image *dimensions* did not apply to the schema actually touched)
- [x] `.env.example` documents both values of `ECP_API_BASE_URL`, mock and real
- [x] **No mock adapter, no `isMock` branch.** The switch is the environment variable and nothing else

---

## Integration Risk

**`openapi.yaml` may not be Prism-servable as written.** It is hand-authored, `Proposed`, and has never been executed by a tool that has to return an actual response body. Expect gaps in `examples`, and possibly in `$ref` resolution across `paths/` and `components/`.

This is the sprint's most valuable finding, not a setback: every problem found here is one the backend would otherwise have hit while implementing the endpoint. Findings are amended into `openapi.yaml` per [`../integration-plan.md`](../integration-plan.md) §5 — **not** worked around in the frontend.

## Gate `G0` — Walking Skeleton

Both developers, last day.

| # | Check |
|---|---|
| # | Check | Status |
|---|---|---|
| 1 | `npm run mock:api` serves `openapi.yaml`; `getProduct` returns a body | ✅ verified — see Review Notes |
| 2 | `ecp-web` fetches it through the real client and renders typed, Zod-parsed data | ✅ verified — see Review Notes |
| 3 | `openapi-typescript` output is checked in; a hand-edit to it fails the build | ✅ verified — see Review Notes |
| 4 | `./gradlew check` green, L2 under 60 s | ✅ (backend lane, see Review Notes above) |
| 5 | All four planted violations demonstrated failing, then removed | ✅ (backend lane, see Review Notes above) |
| 6 | `docker compose up` brings up PostgreSQL and Kafka alongside the existing services | ⚠️ not directly verified — backend lane's Colima environment has no `docker compose` plugin; equivalent proven via `docker run` with the compose service's exact env (see backend Review Notes) |
| 7 | Every `openapi.yaml` amendment made this sprint is committed, linted, and noted in the review | ✅ verified — see Review Notes |

## Definition of Done

Every item satisfies [`../definition-of-done.md`](../definition-of-done.md) §3 or §4. No user stories this sprint, so §5 does not apply.

## Review Notes

*(2026-09-10, backend lane only — `ecommerce-backend-spring`)*

- `EN-GATE-1` shipped: `archunit-junit5` + `jmolecules-archunit` + `jmolecules-ddd` added as `app` test dependencies; `ArchitectureTests.java` carries the layer rules (§6), the forbidden-edge rules (§7 — shared-kernel zero-outbound, no `@AggregateRoot`/`@Repository` stereotype in the kernel, no `domain` package naming another module, no reach into another module's `application` package), and the no-Testcontainers-in-fast-suite rule. `ModularityTests.isValid()` is unchanged — still one unwrapped `ApplicationModules.verify()` call. `./gradlew :app:test` green, L2 (`ArchitectureTests` + `ModularityTests`) executes in ≈ 10 s total, well inside the 60 s budget.
- **Scope decision:** implemented exactly Sprint 1's own checklist. `CQRS.md` §11.1's G1–G11 rules and `Security.md` §12.2 were **not** added — both are separate, unratified/unbudgeted scope per the user's explicit direction before implementation started.
- **Planted-violation demonstrations, all four rehearsed** (add → `./gradlew :app:test` fails → revert → green):
  1. `review → payment`: caught by `ApplicationModules.verify()` — *"Module 'review' depends on named interface(s) 'payment :: api' ... Allowed targets: shared-kernel :: api, identity :: api."*
  2. `inventory → ordering`: **caught by Gradle itself**, before Modulith ever runs — `ordering` already legitimately depends on `inventory` (the real `StockReservationPort` edge), so adding the reverse edge is a two-way Gradle project dependency and fails task-graph construction with *"Circular dependency between the following tasks: :inventory:compileJava ... :ordering:compileJava ... :inventory:compileJava"*. The build still fails on the planted violation, just one layer earlier than the other three — worth knowing before someone "fixes" this demo by routing through a different pair of modules.
  3. A `catalog.domain` class referencing `identity.api`: caught by the new `domainDoesNotNameAnotherModule` ArchUnit rule — *"Field ... has type <org.phuchoang.ecp.identity.api.Marker>."*
  4. A `cart.domain` class reaching into `catalog.application`: caught **twice** — the new `noClassReachesIntoAnotherModulesApplicationPackage` ArchUnit rule and `ApplicationModules.verify()` both flagged it independently (*"Module 'cart' depends on non-exposed type ... within module 'catalog'!"*), and `domainDoesNotNameAnotherModule` fired too since `catalog` is a different module. Genuine defense-in-depth, not redundant rule-writing.
- **`allowEmptyShould(true)` needed on four rules:** `domain`/`application`/`infrastructure` are still empty `.gitkeep` placeholders in every module (no domain code exists yet, per Sprint 0's own scope), so ArchUnit's default `failOnEmptyShould` fails a rule whose `that()` clause matches zero classes. Added `.allowEmptyShould(true)` to the four rules scoped to those currently-empty packages; they'll start actually checking something the moment real domain/application/infrastructure code lands.
- **`package-info.java` is a real ArchUnit class:** the shared-kernel outbound-dependency rule initially failed on `org.phuchoang.ecp.sharedkernel.package-info`'s own `@ApplicationModule`/`@NamedInterface` annotations, which resolve to `org.springframework.modulith..` — a real "dependency" by ArchUnit's definition but not a bounded-context coupling. Added `org.springframework.modulith..` to the rule's allowed-package list with a comment explaining why.
- `EN-DATA-1` shipped: `postgres:16` (matches the pinned production tag in `Deployment Diagram.md`) and `confluentinc/cp-kafka:7.7.1` added to `compose.yaml`; `org.postgresql:postgresql` driver added to the version catalog; `TestcontainersConfiguration` created in `app/src/integrationTest`; `PostgresConnectivityIT` proves a real committed transaction is visible and nothing uncommitted leaks, run against an actual `postgres:16` container (verified: 1 test, 0 failures, query executed in ≈ 2 s once the container was up).
- **Scope decision — `TestcontainersConfiguration` is PostgreSQL-only, not "alongside the existing Elasticsearch, Kafka, MongoDB and Redis."** That phrase in this backlog item assumed those four already existed. They did not — no `TestcontainersConfiguration` class existed anywhere in the repository before this pass, despite `Testing and Benchmark Strategy.md` §8 claiming otherwise. Confirmed with the user before implementing: ship PostgreSQL only, flag the doc/reality mismatch here rather than silently building out the other four (unbudgeted, out of this sprint's 7 points).
- **No persistence starter added.** EN-DATA-1's checklist asks only for the JDBC driver, not `spring-boot-starter-jdbc`/JPA — so `@ServiceConnection` on `TestcontainersConfiguration` has nothing to autoconfigure yet (no `DataSource` bean without the starter). `PostgresConnectivityIT` therefore connects with plain `java.sql.DriverManager` against its own `@Container`-managed `PostgreSQLContainer`, rather than through `TestcontainersConfiguration`/Spring. `TestcontainersConfiguration` stays as forward-looking scaffolding for the first `@SpringBootTest`-based L4/L5 test once a persistence starter lands — it is not yet consumed by any test.
- **Kafka needs `CLUSTER_ID` in KRaft mode.** `confluentinc/cp-kafka:7.7.1` in `compose.yaml` failed to boot with `CLUSTER_ID is required` until a fixed cluster ID was added to the service's environment. Verified standalone (`docker run` with the same env as `compose.yaml`, outside Gradle) that the broker completes preflight checks and reaches a stable running state.
- **No Kafka version is pinned anywhere in `SA-docs`**, despite `Deployment Diagram.md` requiring "same image and version as production" — production names only the image family (`confluentinc/cp-kafka`, KRaft mode). `7.7.1` was chosen here as a current, working tag and is a decision made during this pass, not a documented pin; it should be corrected once the docs settle on one.
- **`docker compose up` could not be verified directly** — this environment's Docker CLI (via Colima) has no `docker compose`/`docker-compose` plugin installed. Verified the equivalent by other means instead: both `postgres:16` and `confluentinc/cp-kafka:7.7.1` pull successfully, and running each with `compose.yaml`'s exact environment via plain `docker run` starts and stays up (Kafka's KRaft preflight checks pass; Postgres is additionally proven live via the Testcontainers-driven `PostgresConnectivityIT`). The `compose.yaml` service definitions themselves are unverified for compose-specific syntax (network aliases, service-to-service DNS) — worth a real `docker compose up` the next time compose tooling is available.
- **Colima/Testcontainers needs explicit socket env vars in this environment**, not just `colima start`: `DOCKER_HOST=unix://$HOME/.colima/default/docker.sock` and `TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock` (the path *inside* the Colima VM, not the macOS host path — the first attempt used the host path and failed with `mkdir ...docker.sock: operation not supported`). Worth adding to the README's "Running" section so the next person doesn't have to rediscover it.
- Frontend Lane (`EN-FE-API-1`, `EN-MOCK-1`) and the joint `G0` gate checklist (which needs both lanes) not touched by this pass.

---

*(2026-09-10, frontend lane — `ecommerce-frontend-next`)*

- `EN-FE-API-1` shipped: `lib/api/{client,config,headers,errors,error-map,pagination,ids,money,schema}.ts`, all `server-only`. `lib/api/index.ts` is the only file re-exported for outside use; `lib/session/index.ts` gained a minimal, explicitly provisional `getAccessToken`/`getCsrfToken` no-op seam (real session/cookie custody is later-sprint scope) so `headers.ts` has real functions to call. `apiQuery`/`apiMutate` require an explicit `cache` policy on every call — no implicit default. Branded `OrderId`/`ProductId`/`SkuId`/`CartId` via TS unique-symbol branding; `Money` is `{amount: string, currency: string}` with a `.strict()` Zod schema mirroring `common.yaml#Money` exactly.
- **Rule `I-4` is enforced by `.dependency-cruiser.cjs`, not `eslint-plugin-boundaries`.** Tried the boundaries-level split first (a `lib-api-public`/`lib-api-internal` element-type split so only `lib/api/index.ts` is importable from outside); the plugin (`eslint-plugin-boundaries@7.2.0`) classifies elements by folder, not by individual file — even with `partialMatch: false` it logged its own warning and left `lib/api/index.ts` unclassified for any importer whose own path was itself nested. Reverted to a single `lib-api` boundaries element (matching what the plugin can actually do) and added a path-regex forbidden rule to `.dependency-cruiser.cjs` instead, which has no such folder/file ambiguity. Verified live: importing `lib/api/client.ts` directly from `app/` is **not** caught by `eslint` but **is** caught by `depcruise` (`lib-api-internal-not-imported-outside-lib-api`) — this is the intended, working split of responsibility between the two tools, documented inline in `eslint.config.mjs`.
- **Separately, `eslint-plugin-boundaries`'s single-segment folder patterns (`"lib/api/*"`) have a real depth-matching bug in this version**: the same target import (`"@/lib/api"`) resolved correctly when the *importing* file was flat (e.g. `app/foo.tsx`) but was reported as `isUnknown` when the importing file was nested two or more levels deep (`app/product-demo/page.tsx`, `features/catalog/server/queries.ts`). Switching every affected element pattern from `"lib/api/*"`/`"lib/session/*"`/etc. to the double-star form `"lib/api/**"` fixed it project-wide. Worth knowing before anyone adds another single-level `lib/*` or `components/*` element pattern.
- **`Money.amount` needed a dedicated arithmetic guard beyond branding** — a plain `string` field still lets `Number(money.amount) + 1` typecheck cleanly, since `Number()`/`parseFloat()` are legitimate elsewhere. Added a `no-restricted-syntax` ESLint rule (same technique already used for the hex-colour/`outline: none` bans) flagging `Number(...)`/`parseFloat(...)`/`parseInt(...)`/unary `+` applied to any `.amount` member expression, scoped to exclude `lib/api/money.ts` itself — that file is the one sanctioned place the coercion happens, inside `formatMoney`, which is the only call site allowed to do it. Regression-tested directly against the ESLint `Linter` API in `lib/api/__tests__/money-no-arithmetic.test.ts` rather than shelling out to the project's own `eslint` config (a temp-directory fixture sits outside the project's `tsconfig` inclusion, which broke type-aware linting unrelated to the rule under test).
- **`ECP-PRM-4090` wording corrected.** This backlog item's checklist text (and the sprint's own error-map line) called it a "voucher-field failure." Cross-checked against `Integration Contract.md` §4.5 and `Data Fetching.md`: it is a `409` **concurrency conflict** — "promotion usage limit reached by a concurrent redemption" — the same "expected under load, retryable" class as `ECP-INV-4091`, not a `400`/`422`-style invalid-input case. The `error-map.ts` entry is named `promotion-conflict`, not `voucher-validation-error`, with a comment citing the contract so a later voucher-field UI doesn't mis-word it as "invalid voucher code."
- `EN-MOCK-1` shipped: `@stoplight/prism-cli` installed, `npm run mock:api` serves the root multi-file `openapi.yaml` on `:4010`. `npm run docs:openapi:lint` (Redocly, from `util/`) was already green before this pass — no pre-existing spec lint failures to fix.
- **Prism does not honour the OpenAPI `servers` base path** (`{protocol}://{host}/api/v1`) — it mounts every route at the bare path template (`/products/{id}`, not `/api/v1/products/{id}`), and the Prism CLI has no flag to change this. This is not a spec defect and not something `openapi.yaml` amendment fixes — the base-URL *value* absorbs the difference instead: the mock's `ECP_API_BASE_URL` has no path suffix, the real backend's includes `/api/v1`, and `lib/api` endpoint paths (e.g. `/products/{productId}`) stay identical across both. Documented directly in `.env.example`. This also surfaced a real bug in `buildUrl()`: `new URL("/products/x", base)` discards `base`'s own path because an absolute-path reference overrides it per the WHATWG URL spec — fixed by joining `base.pathname` with the relative path before constructing the final `URL`, with a regression test (`client.test.ts`) asserting the join against a base URL that itself has a path (`http://localhost:8080/api/v1`).
- **Example-seeding scope: `catalog.yaml`'s `Product`/`ProductImage`/`CategoryRef`/`Variant`, only the fields `getProduct` renders.** `name`, `slug`, `brand`, `description`, image `url`/`altText`, category `name`/`slug`, and variant `sku`/`name` all previously produced Prism's unusable `"string"`/`"http://example.com"` placeholders — now produce realistic values. Followed integration-plan.md §5 literally: additive-only `examples:` keys (verified via an empty `codegen:api:check` diff before and after — examples never change the generated type shape), `docs:openapi:lint` re-run green after the edit, Prism output re-verified. **Image *dimensions* (named in this backlog item's checklist) do not apply** — `ProductImage` has no width/height fields in the schema as written; noted here rather than inventing fields that don't exist.
- Walking-skeleton demo: `features/catalog/{server/queries.ts,schema/product.ts}` (new, minimal — not the full `features/catalog/` layout) plus a throwaway `app/product-demo/page.tsx`, explicitly commented for removal once a real product route exists. Required `export const dynamic = "force-dynamic"` — `next build` otherwise tries to statically prerender the route and fails on the missing `ECP_API_BASE_URL`/unreachable mock at build time; this is the correct posture for a page with no revalidation-tag story yet, not a workaround.
- `.github/workflows/frontend-ci.yml` added (none existed before, in either lane) — three jobs: `lint-typecheck-test`, `openapi-contract` (Redocly lint + `codegen:api:check`), `prism-smoke` (`mock:api` + a live `curl`/`jq` check of `getProduct`).
- **Gate `G0` frontend checks (#1, #2, #3, #7) verified live in this pass**, not just asserted: `curl` against a running `npm run mock:api` returned a fully-seeded `getProduct` body (#1); `npm run dev` against that mock rendered `/product-demo` with the real name/status/formatted price, confirmed via raw HTML inspection (#2); a committed-then-corrupted `lib/api/generated/openapi.d.ts` was shown to fail `codegen:api:check` and a clean regeneration was shown to pass (#3); the `catalog.yaml` example-seeding commits are the only `openapi.yaml` amendments this sprint, lint-clean at HEAD (#7). Check #6 is backend-owned and not independently re-verified here.
- 18 new Vitest tests, all passing; `npm run lint` (ESLint + depcruise), `npm run typecheck` (strict, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`), and `npm run build` all green.

## Retrospective

**Went well:** The planted-violation demos surfaced real defense-in-depth: the `cart → catalog.application` violation was independently caught by two different ArchUnit rules plus `ApplicationModules.verify()`, and the `inventory → ordering` edge never even reached Modulith because Gradle's own circular-dependency detection got there first. The gate has more than one layer protecting the same boundary, which is a stronger property than any single rule passing in isolation. On the frontend side, building the walking-skeleton demo end-to-end (not just wiring the client in isolation) is what actually surfaced two real bugs — the URL base-path join and Prism's `servers`-prefix gap — that a purely unit-tested client would have shipped silently.
**Change one thing:** `Testing and Benchmark Strategy.md` §8's "current state" table is stale in two places now confirmed by this pass (Testcontainers ES/Kafka/Mongo/Redis claimed present, are not; Flyway/JPA claimed on the classpath, are not) — worth a pass to reconcile that table against the actual repository rather than trusting it as ground truth next time. On the frontend side, this backlog item's own checklist text had two small inaccuracies (`ECP-PRM-4090`'s description, "image dimensions" in the example-seeding line) that cost a few minutes each to run down against the actual contract — worth a proofreading pass against `Integration Contract.md`/`Data Fetching.md` before a backlog item like this is committed next time.
**Action (owned, carried to next sprint's board):** Add the Colima/Testcontainers socket env vars to the README, and re-verify `compose.yaml`'s `postgres`/`kafka` services with real `docker compose up` once compose tooling is available in this environment (backend). Re-verify Gate `G0` check #6 end-to-end once that tooling exists. Frontend: `lib/api`'s `getAccessToken`/`getCsrfToken` no-op seam and the throwaway `/product-demo` route are both intentionally provisional — real session/cookie custody and a real `features/catalog` product route are follow-on work, not part of this sprint's scope.

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

- [ ] JMolecules on the build — half the `ADR-0018` §4 rules assert on its annotations
- [ ] `ApplicationModules.of(EcpApplication.class).verify()` as a single test method. **It is not wrapped, softened, or caught** — its failure message is the whole diagnosis (Testing Strategy §6.2)
- [ ] ArchUnit rules for the layer table of [`Module Dependency Diagram.md`](../../SA-docs/02-backend/Module%20Dependency%20Diagram.md) §6:
  - `domain` → the kernel only. Never Spring, JPA, Jackson, or a provider SDK
  - `application` → domain and ports. Never infrastructure, never `api`
  - `infrastructure` → domain, application, ports. Never `api`
  - `api` → application. Never domain internals
- [ ] ArchUnit rules for the forbidden edges of §7:
  - No outbound dependency from `shared-kernel`
  - No `@AggregateRoot` or `@Repository` stereotype in the kernel package
  - No `domain` package naming `identity` or any other module
  - No module depending on `app`
- [ ] ArchUnit rule: **no Testcontainers import in the fast-suite source set** — this is what keeps the fast/slow split from eroding within a month (Testing Strategy §4)
- [ ] L2 runs in the **fast** suite and completes under 60 s

**Planted-violation demonstration** — the deliverable. Each is added, the build is shown to fail with a comprehensible message, and it is removed:
- [ ] `review` → `payment` (an edge no allow-list grants)
- [ ] `inventory` → `ordering` (inverts the Partnership direction §3.1 fixes)
- [ ] A `domain` class importing `identity`
- [ ] A class reaching into another module's `application` package

### `EN-DATA-1` — the data tier (7 pts)

PostgreSQL is the source of truth under [`ADR-0009`](../../SA-docs/01-system/ADR/ADR-0009-postgresql-source-of-truth.md) and is absent from both the Compose file and the test containers. Testing Strategy §12 calls this *"the first thing to fix."*

- [ ] PostgreSQL added to `compose.yaml`, same image version as production
- [ ] Kafka added to `compose.yaml`
- [ ] PostgreSQL JDBC driver on the classpath
- [ ] `TestcontainersConfiguration` gains PostgreSQL alongside the existing Elasticsearch, Kafka, MongoDB and Redis
- [ ] Testcontainers reuse **on** locally, **off** in CI — locally it turns an 8-minute L4 run into roughly one; in CI it hides cross-test state
- [ ] One L5 test proving a real transaction against the container

---

## Frontend Lane

### `EN-FE-API-1` — the one fetch client (14 pts)

- [ ] `lib/api/` with `import 'server-only'`. **One** fetch client; nothing outside `lib/api` imports it (rule `I-4`)
- [ ] It attaches: the session cookie, `X-Correlation-Id`, the CSRF token on writes, and `Idempotency-Key` where required
- [ ] `openapi-typescript` script generating from `../docs/SA-docs/04-shared/OpenAPI/openapi.yaml`
- [ ] Output **checked in**; a CI step regenerates and **fails on a diff** — a stale generation is worse than none
- [ ] Zod parsing at the boundary. Every query returns parsed, typed data **or throws a typed problem**
- [ ] Problem+JSON parsed into the error taxonomy of [`Integration Contract.md`](../../SA-docs/04-shared/Integration%20Contract.md) §4
- [ ] The error-code→screen map, with the two that are *designed outcomes* rather than errors already wired: `ECP-INV-4091` → "sold out", `ECP-PRM-4090` → voucher-field failure
- [ ] Cursor pagination helper — cursor, never offset
- [ ] Branded types: `OrderId`, `ProductId`, `SkuId`, `CartId`; `Money` with `amount` as **`string`**
- [ ] A lint rule or test asserting **no arithmetic on `Money`**

**Not built:** a generated client. Teaching a generated artefact the session cookie, correlation header, idempotency key, problem-JSON parsing and cursor pagination is more work than the wrapper, and the wrapper is reviewable ([`ADR-0036`](../../SA-docs/01-system/ADR/ADR-0036-nextjs-server-sole-api-caller.md)).

### `EN-MOCK-1` — the Prism harness (6 pts)

This is the item the entire parallel-lane plan rests on.

- [ ] `@stoplight/prism-cli` as a dev dependency
- [ ] `npm run mock:api` → Prism serving `openapi.yaml` on `localhost:4010`
- [ ] `npm run docs:openapi:lint` (from `util/`) passes before Prism is pointed at the file
- [ ] Response examples seeded in the spec where Prism's generated values would be unusable for layout work — prices, names, image dimensions
- [ ] `.env.example` documents both values of `ECP_API_BASE_URL`, mock and real
- [ ] **No mock adapter, no `isMock` branch.** The switch is the environment variable and nothing else

---

## Integration Risk

**`openapi.yaml` may not be Prism-servable as written.** It is hand-authored, `Proposed`, and has never been executed by a tool that has to return an actual response body. Expect gaps in `examples`, and possibly in `$ref` resolution across `paths/` and `components/`.

This is the sprint's most valuable finding, not a setback: every problem found here is one the backend would otherwise have hit while implementing the endpoint. Findings are amended into `openapi.yaml` per [`../integration-plan.md`](../integration-plan.md) §5 — **not** worked around in the frontend.

## Gate `G0` — Walking Skeleton

Both developers, last day.

| # | Check |
|---|---|
| 1 | `npm run mock:api` serves `openapi.yaml`; `getProduct` returns a body |
| 2 | `ecp-web` fetches it through the real client and renders typed, Zod-parsed data |
| 3 | `openapi-typescript` output is checked in; a hand-edit to it fails the build |
| 4 | `./gradlew check` green, L2 under 60 s |
| 5 | All four planted violations demonstrated failing, then removed |
| 6 | `docker compose up` brings up PostgreSQL and Kafka alongside the existing services |
| 7 | Every `openapi.yaml` amendment made this sprint is committed, linted, and noted in the review |

## Definition of Done

Every item satisfies [`../definition-of-done.md`](../definition-of-done.md) §3 or §4. No user stories this sprint, so §5 does not apply.

## Review Notes

<!-- filled at Sprint Review -->

## Retrospective

**Went well:**
**Change one thing:**
**Action:**

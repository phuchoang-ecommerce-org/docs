# Testing and Benchmark Strategy — Enterprise Commerce Platform (ECP)

**Document type:** Test Strategy
**Status:** Proposed — elaborates the `Proposed` test-stack rows of [ADR-0018](./ADR/ADR-0018-architecture-governance-ci-gate.md) §4
**Audience:** Engineering, Quality Assurance, Architecture Review
**Traces to:** `NFR-PERF-01`–`06` · `NFR-SCAL-01`–`07` · `NFR-REL-01`–`06` · `NFR-MAINT-05` · `NFR-OBS-01`–`04` · `AC-01`–`AC-06` · `P15`
**Related documents:** [ADR-0018](./ADR/ADR-0018-architecture-governance-ci-gate.md) · [Security](./Security.md) §12 · [Solution Architecture](./Solution%20Architecture.md) §6 · [Module Dependency Diagram](../02-backend/Module%20Dependency%20Diagram.md) · [Deployment Diagram](./Deployment%20Diagram.md) §7 · [traceability-matrix](../../BA-docs/traceability-matrix.md) §5

---

## 1. Purpose, Scope, and Status

### 1.1 What this document is

This document maps non-functional requirements to test layers, owners, gates, cadence, and runtime budgets. It expands the `Proposed` test stack in [ADR-0018](./ADR/ADR-0018-architecture-governance-ci-gate.md). [`Security.md`](./Security.md) §12 remains authoritative for security verification.

### 1.2 What this document deliberately is not

§7 defines a two-minute smoke benchmark, not the full load rig. The 10,000-product catalog, 100,000 customers, 10× peak, soak, and concurrent reporting tests are deferred until a §7.9 trigger occurs. Until then, `NFR-SCAL-01`–`06`, `NFR-PERF-05`, and `NFR-AVAIL-01` are **unverified**. `AC-05` and `AC-06` cannot be claimed.

### 1.3 Section status

| § | Content | Status |
|---|---|---|
| 2 | Requirement → suite mapping | Proposed |
| 3–4 | Test layers, fast/slow split | Proposed — elaborates [ADR-0018](./ADR/ADR-0018-architecture-governance-ci-gate.md) §4 |
| 5 | Test data | Proposed |
| 6 | Per-layer detail | Proposed |
| 7 | Smoke benchmark | **Proposed** — decided here for the first time; [`Technology Stack.md`](./Technology%20Stack.md)'s "Benchmark performance" line is its only prior mention |
| 8 | Current-state gap | Fact, checked against the repository |
| 9–10 | Pipeline stages, coverage policy | Proposed — [ADR-0018](./ADR/ADR-0018-architecture-governance-ci-gate.md) §5 leaves both undecided |

---

## 2. Requirement Baseline

The SRS states a verification method per requirement. This maps each to the suite that owns it. Rows already owned by [`Security.md`](./Security.md) §12.1 are cited, not repeated.

| Requirement | SRS verification method | Owning suite (§3) |
|---|---|---|
| `NFR-PERF-01`, `-02`, `-03`, `-04` | Server-side latency at p95 | **L7 smoke benchmark** (§7) for the order-of-magnitude signal; the full load suite for the ratified figure |
| `NFR-PERF-05` | Concurrent load test | Deferred — needs the load rig (§7.9) |
| `NFR-PERF-06` | Freshness measurement | L4 — assert projection lag under an event burst against the 5-minute bound |
| `NFR-SCAL-01`–`04`, `-06` | Load / concurrency / peak test at volume | Deferred — needs the load rig (§7.9) |
| `NFR-SCAL-05` | Architectural review; scaling test | L2 partially ([ADR-0008](./ADR/ADR-0008-cqrs-command-query-separation.md) separation is structurally checkable); the scaling half is deferred |
| `NFR-SCAL-07` | Cost-per-transaction trend | Not a test — an operational measurement |
| `NFR-REL-01` | Fault injection at each step | **L5** — Testcontainers PostgreSQL, failure induced at each step of order placement |
| `NFR-REL-02` | Concurrent duplicate-submission test | **L5** — concurrent submission of one idempotency key ([Integration Contract](../04-shared/Integration%20Contract.md) §2.2) |
| `NFR-REL-03` | Concurrency test at `NFR-SCAL-06` peak | **L5** at correctness scale; the *peak* qualifier is deferred (§7.8) |
| `NFR-REL-04` | Fault-injection test | L5 — retry of a transient failure yields the single-execution outcome |
| `NFR-REL-05`, `-06` | Recovery / event-delivery test under induced failure | **L6** — Testcontainers Kafka, broker killed mid-relay |
| `NFR-SEC-01`–`07` | per [`Security.md`](./Security.md) §12.1 | L2 + L5, as that table specifies |
| `NFR-AVAIL-01` | Uptime monitoring | Not a test — production monitoring |
| `NFR-AVAIL-02` | Dependency-failure test | **L4** — Elasticsearch, review, and reporting stores stopped; browse/cart/checkout asserted still to work |
| `NFR-AVAIL-03` | Provider-failure test | L4 — stub adapters ([Deployment](./Deployment%20Diagram.md) §7) fail and time out on demand |
| `NFR-MAINT-01`–`03`, `-05` | Architectural review; automated build check | **L2** — the [ADR-0018](./ADR/ADR-0018-architecture-governance-ci-gate.md) §4 rule table |
| `NFR-MAINT-04`, `-06` | Design review against a worked example | Review, not a suite — the `AC-03` worked example |
| `NFR-OBS-01`, `-02` | per [`Security.md`](./Security.md) §12.1 | L4 |
| `NFR-OBS-03` | Trace inspection | L4 — one correlation id asserted across REST → outbox → Kafka → projection |
| `NFR-OBS-04` | Metrics review | L4 — assert the Micrometer meters named in [Deployment](./Deployment%20Diagram.md) §8 exist |

`NFR-SCAL-07` is an operational measure, `NFR-AVAIL-01` is production monitoring, and `NFR-MAINT-04`/`-06` require design review. Do not count them as automated test gaps.

---

## 3. Test Layers

Seven layers expand [ADR-0018](./ADR/ADR-0018-architecture-governance-ci-gate.md) §4 with cadence, gate, and runtime budget.

| # | Layer | Stack | Runs on | Gate | Budget |
|---|---|---|---|---|---|
| **L1** | Domain unit | JUnit 5 + AssertJ, **no Spring context** | Every build | Build-failing | < 30 s whole suite |
| **L2** | Architecture | ArchUnit + `ApplicationModules.verify()` | Every build, every PR | **Build-failing, never skippable** | < 60 s |
| **L3** | Web slice | `@WebMvcTest` + Spring Security Test, application layer mocked | Every build | Build-failing | < 90 s |
| **L4** | Module integration | Spring Modulith `Scenario` + Testcontainers (PostgreSQL, MongoDB, Kafka) | PR + main | Build-failing | < 8 min |
| **L5** | Persistence & concurrency | Testcontainers **PostgreSQL** | PR + main | Build-failing | < 5 min |
| **L6** | Event delivery | Testcontainers Kafka + induced failure | main + nightly | Build-failing on main | < 6 min |
| **L7** | Smoke benchmark | k6 against a running stack (§7) | nightly + on demand | **Reported, not build-failing** | < 5 min |

L1–L3 form the fast suite; L4–L6 the slow suite; L7 is neither and runs against a deployed process rather than a test context.

L2 stays in the fast suite and never starts a container. L3 adds request validation, `@RestControllerAdvice` mapping, and pagination-envelope checks without a full module context.

---

## 4. Fast Suite and Slow Suite

The build defines the split:

| Task | Layers | Container needed | Where |
|---|---|---|---|
| `./gradlew test` | L1, L2, L3 | No | Local, every commit, every PR |
| `./gradlew integrationTest` | L4, L5, L6 | Yes (Docker) | PR + main |
| `./gradlew check` | both of the above | Yes | Pre-merge |
| `k6 run bench/smoke.js` | L7 | A running stack | Nightly, and by hand before a performance-relevant merge |

- `test` never starts a container. Enforce this with an ArchUnit rule over fast-suite source sets.
- Testcontainers reuse is on locally and off in CI.
- The slow suite fails `main` as well as pull requests.

---

## 5. Test Data

| Concern | Rule |
|---|---|
| **Seed** | Deterministic and fixed. A test that fails only on Tuesdays is worse than no test. |
| **Volume in L1–L6** | Deliberately small. Correctness suites use the fewest rows that exercise the rule. The 10,000-product and 100,000-customer figures of `NFR-SCAL-01`/`-02` belong to the load rig, not to integration tests. |
| **Volume in L7** | 1,000 products, 20 categories, 200 customers, 500 orders — see §7.5 for why this is deliberately below `NFR-SCAL-01`. |
| **Fixtures** | Built through the domain's own factories, never by direct SQL insert. A fixture that bypasses an aggregate's invariant produces states the system cannot reach, and tests against them assert nothing. Read-model fixtures are the exception: they are projections, so seeding them directly is legitimate. |
| **Isolation** | One schema per test class for L5; Modulith `Scenario` handles event isolation for L4. No suite depends on the long-running Compose stack of [Deployment](./Deployment%20Diagram.md) §7. |
| **PII** | No production data, ever, in any environment. Generated names and addresses only — a direct consequence of [`Security.md`](./Security.md) §8's classification. |

---

## 6. What Each Layer Verifies

### 6.1 L1 — Domain unit

L1 tests the 40 business rules in SRS §4 against aggregates without a framework. Prioritize `BR-INV-01`, `BR-ORD-01`/`-02`/`-03`/`-06`, `BR-PAY-01`/`-02`, and `BR-PRM-03`. Cover their success and exception flows.

### 6.2 L2 — Architecture

L2 runs the rules from [ADR-0018](./ADR/ADR-0018-architecture-governance-ci-gate.md) §4 and [`Security.md`](./Security.md) §12.2. Run `ApplicationModules.of(EcpApplication.class).verify()` directly; do not catch or replace its failure.

### 6.3 L4 — Module integration

Use Spring Modulith `Scenario` to publish an event, verify the downstream reaction, and verify projection convergence. [ADR-0030](./ADR/ADR-0030-spring-data-mongodb-read-model-access.md) §4 requires:

- **Idempotency.** Redelivering the same event leaves the document byte-identical.
- **Ordering.** An out-of-order event does not overwrite newer state.

Run these checks against MongoDB, not a mock.

### 6.4 L5 — Persistence and concurrency

Run N threads against one SKU in real PostgreSQL. Successful orders must equal available stock; all other requests must fail without a partial write. H2 cannot verify this guarantee.

For `NFR-REL-01`, inject failure after reservation, promotion redemption, order insert, and outbox write. Each result must be fully applied or fully absent.

### 6.5 L6 — Event delivery

Stop Testcontainers Kafka during relay. Verify no accepted event is lost, every consumer receives it at least once, and the outbox drains after recovery.

### 6.6 Contract tests

[ADR-0031](./ADR/ADR-0031-contract-first-openapi.md) makes the hand-authored specification normative. The contract gate checks:

| Direction | Check |
|---|---|
| Spec → code | Every one of the 155 operations has a controller method at that path and verb. A spec operation with no implementation fails. |
| Code → spec | Every controller mapping appears in the spec. An endpoint that exists but is undocumented fails — this is the direction that catches the wire format being decided one controller at a time, which is exactly what [ADR-0031](./ADR/ADR-0031-contract-first-openapi.md) §1 exists to prevent. |
| Response shape | L3 and L4 responses validated against the operation's schema, so drift surfaces as a failing test rather than a frontend bug. |
| Permission cells | The `NFR-SEC-01` matrix test of [`Security.md`](./Security.md) §12.1 is generated from the spec × the permission matrix, so a new operation with no matrix cell fails the build. |

Spring REST Docs may generate request and response examples. It is not the API source of truth. Remove it and Asciidoctor if the project does not use those examples.

### 6.7 Frontend

| Layer | Stack | Verifies |
|---|---|---|
| Type check | `tsc --noEmit` under strict mode | [ADR-0020](./ADR/ADR-0020-typescript-strict-mode.md) — build-failing |
| Lint | ESLint + the rules of [`Security.md`](./Security.md) §12.2 (`dangerouslySetInnerHTML` ban, `outline: none` ban) | Build-failing |
| Component | Vitest + Testing Library | Keyboard interaction, focus visibility, and the ≥ 44 px hit area of [ADR-0026](./ADR/ADR-0026-motion-and-accessibility-baseline.md) §4 |
| Accessibility | `axe` in component tests | The automated subset of the WCAG AA baseline. [ADR-0026](./ADR/ADR-0026-motion-and-accessibility-baseline.md) is explicit that this is *"a floor, not all of them"* — periodic manual screen-reader testing stays necessary |
| Token contrast | Assertion over the token pairs of [ADR-0022](./ADR/ADR-0022-ma-design-tokens.md) | Measured ratios, not eyeballed |
| E2E | Playwright, a **thin** suite | The purchase path of `NFR-AVAIL-01`, and nothing else |

Keep E2E tests to cross-boundary behavior. Backend tests verify `NFR-SEC-01`. [`Frontend Architecture.md`](../03-frontend/Frontend%20Architecture.md) §8 assigns token custody, CSRF, refresh serialization, and CSP checks. Frontend performance budgets are separate from §7.

---

## 7. The Smoke Benchmark

### 7.1 Two kinds of measurement

Separate the nightly smoke benchmark from the deferred load rig:

| | **Smoke benchmark** — built now | **Load rig** — deferred |
|---|---|---|
| Question | Is the read path in the right order of magnitude? | Do `NFR-SCAL-01`–`06` hold? |
| Duration | ~2 minutes | Hours, plus a data-generation step |
| Scale | 1,000 products, 10 virtual users | 10,000 products, 100,000 customers, 10× peak |
| Environment | One developer host, `N = 1` | Staging, production-shaped, `N > 1` |
| Result | A trend line and a coarse pass/fail | A ratified statement about capacity |
| Cost | Negligible | A real project |

The smoke benchmark provides a nightly trend. It does not verify scale.

### 7.2 The rules

1. Finish within the slow-suite budget.
2. Compare with the previous run before judging absolute latency on an unratified host.
3. Report results; do not fail the build.
4. Run the production `bootJar` and image versions, not `bootRun`.
5. Discard the first 30 seconds of JVM warm-up.

### 7.3 Scope — five scenarios

Measure four read paths and one write path.

| # | Scenario | Requirement | Threshold | Why this one |
|---|---|---|---|---|
| S1 | `GET /products/{id}` — product detail, cache-warm | `NFR-PERF-01` | p95 < 300 ms | The highest-traffic route and the Redis cache-aside path of [ADR-0015](./ADR/ADR-0015-redis-cache-and-rate-limiting.md) |
| S2 | `GET /products?category=…` — first page | `NFR-PERF-01` | p95 < 300 ms | Exercises the index design of [`Database.md`](../02-backend/Database.md) and cursor pagination |
| S3 | `GET /search?q=…` | `NFR-PERF-03` | p95 < 500 ms | The only route reading Elasticsearch ([ADR-0014](./ADR/ADR-0014-elasticsearch-search-read-model.md)) |
| S4 | `GET /search/suggestions?q=…` | `NFR-PERF-04` | p95 < 150 ms | The tightest budget in the SRS; regressions show here first |
| S5 | `PUT /cart/items/{id}` — quantity amendment | `NFR-PERF-02` | p95 < 800 ms | One transactional write, to keep the write path from being measured only by the load rig |

Order placement is excluded because it consumes stock and needs reset between runs. L5 verifies its correctness. S1 uses a warm cache and does not measure deployment or eviction cold starts.

### 7.4 Tool

| Tool | Verdict |
|---|---|
| **k6** | **Chosen.** Scripted in JavaScript, thresholds are first-class and produce an exit code, single static binary with no JVM to warm alongside the system under test, JSON summary that a nightly can diff. |
| Gatling | Capable and JVM-native, but a Scala/Java DSL and a compile step for a two-minute run; its strength is the load rig this section defers. |
| JMeter | XML plans, heavier operationally; strong at the deferred rig, poor at "one file in the repository." |
| JMH | Wrong level. It measures method throughput inside one JVM; every threshold here is an HTTP-boundary latency. It becomes the right tool if a specific hot path needs micro-analysis. |
| `hey` / `oha` | Right weight, but no scenario scripting and no per-scenario thresholds — S1–S5 would become five ad-hoc invocations with the interpretation left to whoever ran them. |

k6 remains `Proposed` until ratified.

### 7.5 Run profile

| Parameter | Value | Reason |
|---|---|---|
| Target | `ecp-api` `bootJar` against the local Compose data tier ([Deployment](./Deployment%20Diagram.md) §7) | Reproducible on any developer host |
| Dataset | 1,000 products · 20 categories · 200 customers · 500 orders | Enough for index selectivity to matter; small enough to seed in seconds. **Deliberately an order of magnitude below `NFR-SCAL-01`** — this run does not claim to verify it |
| Warm-up | 1 VU, 30 s, **discarded** | JIT and connection-pool fill |
| Measured | 10 VUs, 60 s, constant | Concurrency high enough to expose pool contention, low enough that a laptop is not the bottleneck |
| Total | ~2 minutes plus seeding | Rule 1 of §7.2 |
| Output | k6 JSON summary committed to the run log, not to the repository | Trend over time is the deliverable |

Ten virtual users do not verify `NFR-SCAL-04`.

### 7.6 The script

One file, `bench/smoke.js`. Kept small enough to read in full during review:

```javascript
import http from 'k6/http';
import { check } from 'k6';

const BASE = __ENV.ECP_BASE_URL || 'http://localhost:8080';

export const options = {
  scenarios: {
    warmup:   { executor: 'constant-vus', vus: 1,  duration: '30s', tags: { phase: 'warmup' } },
    measured: { executor: 'constant-vus', vus: 10, duration: '60s', startTime: '30s',
                tags: { phase: 'measured' } },
  },
  thresholds: {
    // NFR-PERF-01 / -02 / -03 / -04, measured only on the post-warm-up phase.
    'http_req_duration{phase:measured,scenario_id:S1}': ['p(95)<300'],
    'http_req_duration{phase:measured,scenario_id:S2}': ['p(95)<300'],
    'http_req_duration{phase:measured,scenario_id:S3}': ['p(95)<500'],
    'http_req_duration{phase:measured,scenario_id:S4}': ['p(95)<150'],
    'http_req_duration{phase:measured,scenario_id:S5}': ['p(95)<800'],
    'http_req_failed': ['rate<0.01'],
  },
};

export default function () {
  const id = 1 + (__ITER % 1000);          // deterministic spread over the seeded catalog
  const t = (s) => ({ tags: { scenario_id: s } });

  check(http.get(`${BASE}/products/${id}`, t('S1')),                    { 'S1 200': r => r.status === 200 });
  check(http.get(`${BASE}/products?category=cat-${id % 20}`, t('S2')),  { 'S2 200': r => r.status === 200 });
  check(http.get(`${BASE}/search?q=shirt`, t('S3')),                    { 'S3 200': r => r.status === 200 });
  check(http.get(`${BASE}/search/suggestions?q=shi`, t('S4')),          { 'S4 200': r => r.status === 200 });
  check(http.put(`${BASE}/cart/items/${id}`, JSON.stringify({ quantity: 2 }),
                 { headers: { 'Content-Type': 'application/json' }, ...t('S5') }),
        { 'S5 2xx': r => r.status < 300 });
}
```

Paths are illustrative until controllers exist. Reconcile them with [`openapi.yaml`](../04-shared/OpenAPI/README.md). Add authenticated-session setup for S5 when the auth endpoints exist.

### 7.7 Reading a result

| Outcome | Meaning | Action |
|---|---|---|
| All thresholds pass | The read path is in the right order of magnitude on this host | Record the p95s; no action |
| One threshold fails by < 20 % | Ambiguous — host noise and an unratified environment both live in that band | Re-run once; if it persists, investigate |
| One threshold fails by > 20 %, or regresses > 40 % from the previous run | A real regression | Investigate before merging the change that caused it |
| `http_req_failed` exceeds 1 % | Not a performance result at all | The benchmark is invalid; fix correctness first |

k6 measures client-observed latency. The SRS measures server-side latency without provider time. Use the Micrometer timers from [Deployment](./Deployment%20Diagram.md) §8 to analyze marginal failures.

### 7.8 What this benchmark cannot tell you

§7 does not verify:

- **Scale.** `NFR-SCAL-01`–`04` — 10,000 products, 100,000 customers, thousands of orders/day, thousands of concurrent customers. The dataset and the VU count are both deliberately far below all four.
- **Peak.** `NFR-SCAL-06`'s 10× absorption, and therefore `NFR-REL-03` *at peak*. L5 verifies the oversell guarantee at correctness scale; whether it holds at 10× is a different question with a different answer.
- **Interference.** `NFR-PERF-05` — reporting under sustained concurrent load. `AC-05` rests entirely on this and is unverified.
- **Cold paths.** Cache-cold reads, an empty Redis after deployment, a cold Elasticsearch page cache. S1 is warm by construction.
- **Duration.** Connection-pool exhaustion, memory growth, outbox-table growth ([ADR-0012](./ADR/ADR-0012-transactional-outbox-and-kafka.md) §5), and GC behaviour at steady state are all soak properties. Sixty seconds sees none of them.
- **Topology.** `N = 1` on one host. The scheduler and outbox-relay single-runner contention that [Deployment](./Deployment%20Diagram.md) §6 flags is *invisible* at `N = 1` — that document says so, and warns it must be tested in staging rather than discovered in production.
- **Availability.** `NFR-AVAIL-01`'s 99.9 % is a monthly production measurement and cannot be benchmarked at all.

### 7.9 When the deferral ends

Build the load rig when any trigger occurs:

| Trigger | Why it forces the rig |
|---|---|
| `AC-05` or `AC-06` is put forward as met | Both name load conditions explicitly. Neither can be claimed on §7's evidence |
| Assumption **[A-03]**, **[A-04]**, or **[A-12]** is ratified by the Product Owner | Until then the targets are assumptions ([`traceability-matrix.md`](../../BA-docs/traceability-matrix.md) §7) and the expense of measuring precisely against them is not yet justified. Once ratified they are commitments |
| A promotional event is scheduled | `NFR-SCAL-06`'s 10× and `BR-INV-01` meet on the same path. Discovering the ceiling during the event is the `P8` failure the architecture exists to prevent |
| The `NFR-AVAIL-01` decision of [Deployment](./Deployment%20Diagram.md) §9 is taken | That section makes a peak-load test the evidence for moving beyond the current topology |
| Frontend route budgets are **measured** | [ADR-0019](./ADR/ADR-0019-nextjs-app-router-rendering-strategy.md) §4 requires per-route-class budgets, and [`Performance.md`](../03-frontend/Performance.md) §2 now sets them for the four classes. Lighthouse CI and Web Vitals stay a separate apparatus from §7 — [`Performance.md`](../03-frontend/Performance.md) §1 explains why they are not `NFR-PERF-01` |

---

## 8. Current State Versus What This Strategy Requires

Checked against the repository as it stands. The scaffold is a single Gradle project; the fourteen subprojects of [`Module Dependency Diagram.md`](../02-backend/Module%20Dependency%20Diagram.md) §2 are the target, not the present.

| Item | Present | Required by | Gap |
|---|---|---|---|
| JUnit 5, Spring Boot test | Yes | L1, L3 | — |
| Testcontainers: Elasticsearch, Kafka, MongoDB, Redis | Yes, in `TestcontainersConfiguration` | L4, L6 | — |
| **Testcontainers PostgreSQL + JDBC driver** | **No** | **L5** | **The most consequential gap.** `NFR-REL-01` and `NFR-REL-03` are the guarantees [ADR-0011](./ADR/ADR-0011-optimistic-locking-reservation-model.md) exists for, and neither is testable without it. Flyway and Spring Data JPA are on the classpath with no relational database behind them |
| ArchUnit | No | **L2** | [ADR-0018](./ADR/ADR-0018-architecture-governance-ci-gate.md)'s gate does not exist. `NFR-MAINT-05` and `AC-04` are unmet |
| JMolecules | No | L2 stereotype rules | Listed in [`Technology Stack.md`](./Technology%20Stack.md); half the [ADR-0018](./ADR/ADR-0018-architecture-governance-ci-gate.md) §4 rules assert on its annotations |
| `spring-modulith-starter-test` | Yes | L2, L4 | — |
| MapStruct | No | — | Listed in the stack; not a test concern, noted for completeness |
| `spring-boot-starter-restdocs` + Asciidoctor | Yes | Nothing in this strategy | Points opposite to [ADR-0031](./ADR/ADR-0031-contract-first-openapi.md) — see §6.6. Keep for examples or remove |
| Multi-project Gradle build | No — `rootProject.name = "ecommerce"`, one project | §4's source-set split | The fast/slow split is per-project; a single project makes it a source-set configuration instead |
| Frontend test tooling | **None** — `package.json` has `eslint` only | §6.7 | No Vitest, no Testing Library, no axe, no Playwright. Also absent: the boundary lint of [ADR-0035](./ADR/ADR-0035-feature-sliced-frontend-structure.md), the codegen-drift step of [`Frontend Architecture.md`](../03-frontend/Frontend%20Architecture.md) §6.3, and the budget gate of [ADR-0039](./ADR/ADR-0039-frontend-performance-budgets-ci-gate.md) |
| CI provider and pipeline | No | §9 | [ADR-0018](./ADR/ADR-0018-architecture-governance-ci-gate.md) §5 lists this as undecided; §9 proposes the stages, not the provider |
| `bench/` directory | No | §7 | The script of §7.6 has nowhere to live yet |
| Compose data tier | Partial — Elasticsearch, MongoDB, Redis | §7.5 | **No PostgreSQL and no Kafka**, which are the two the deployment topology is built on |

The highest-risk gaps are PostgreSQL test support and the missing `Accepted` ArchUnit gate.

---

## 9. Pipeline Stages

The CI provider is undecided. These stages are provider-independent.

| Stage | Runs | Gate | Budget |
|---|---|---|---|
| 1 · Compile & type check | Java compile, `tsc --noEmit`, ESLint | Fail | 2 min |
| 2 · Fast suite | L1, L2, L3 | **Fail — never skippable** | 3 min |
| 3 · Slow suite | L4, L5, L6 | Fail | 12 min |
| 4 · Contract | §6.6 spec ↔ code, both directions | Fail | 2 min |
| 5 · Security scan | Dependency, secret, and image scanning per [`Security.md`](./Security.md) §12.3 | Fail on critical | 3 min |
| 6 · Build & tag | `bootJar`, `next build`, image tagged with the commit SHA | Fail | 4 min |
| 7 · Smoke benchmark | L7 against the built image | **Report only** | 5 min |

Stages 1–2 run on every push; 3–6 on every pull request and on `main`; 7 nightly on `main` and on demand. Stage 7 runs against **stage 6's image**, not a Gradle run — rule 4 of §7.2.

---

## 10. Coverage Policy

No global line-coverage percentage is a gate. Four coverage rules are mandatory:

| Rule | Rationale |
|---|---|
| Every business rule in SRS §4 has at least one L1 test naming its `BR-` id | 40 rules; `P5` is a claim about enforcement, so an unenforced rule is the whole failure |
| Every `Must` use case's **exception** flows are covered, not only its main flow | [`traceability-matrix.md`](../../BA-docs/traceability-matrix.md) §6: *"what makes `FR-ORD-08` testable is the ten exception flows of `UC-ORD-05`"* |
| Every OpenAPI operation appears in the §6.6 contract check and the [`Security.md`](./Security.md) §12.1 permission matrix | 155 operations; an uncovered cell is an unverified authorisation decision |
| Every domain event in [Integration Contract](../04-shared/Integration%20Contract.md) §7 has an L4 test asserting a consumer reacts idempotently | Redelivery is normal under `NFR-REL-06`, not exceptional |

Measure and report line coverage, but do not gate on it.

---

## 11. Traceability

| Criterion | Verified by | Status under this strategy |
|---|---|---|
| `AC-01` Core workflows function correctly | L1 + L4 + the thin E2E suite over `Must` use cases | Achievable once the suites exist |
| `AC-02` Rules enforced regardless of entry point | [`Security.md`](./Security.md) §12.1's last row — each rule through REST, scheduler, and Kafka paths | Achievable |
| `AC-03` New modules added with minimal modification | Worked example, reviewed | Review, not a suite |
| `AC-04` Maintainable as complexity grows | **L2** | **Blocked** — ArchUnit and JMolecules absent (§8) |
| `AC-05` Reporting does not impact transactions | `NFR-PERF-05` concurrent load | **Unverified — deferred** (§7.9) |
| `AC-06` Production-quality architecture | L5 + L6 + [`Security.md`](./Security.md) §12, *and* peak-load evidence | **Partially blocked** — the peak-load half is deferred (§7.9); the fault-injection half is blocked on Testcontainers PostgreSQL |

Keep `AC-05` and `AC-06` unverified until the required load evidence exists.

---

## 12. Open Items

| Item | Status |
|---|---|
| **Testcontainers PostgreSQL and the JDBC driver.** L5 does not exist without them, and L5 carries `NFR-REL-01` and `NFR-REL-03` | Unresolved — the first thing to fix |
| **ArchUnit and JMolecules on the build.** [ADR-0018](./ADR/ADR-0018-architecture-governance-ci-gate.md)'s gate is `Accepted` with no implementation | Unresolved |
| **PostgreSQL and Kafka in `compose.yaml`.** Absent from the local data tier | Unresolved |
| **k6 as the benchmark tool** (§7.4) | `Proposed` — awaiting ratification |
| **REST Docs versus [ADR-0031](./ADR/ADR-0031-contract-first-openapi.md)** (§6.6). Keep for examples, or remove | Needs a decision |
| **The contract-test tool.** [`Module Dependency Diagram.md`](../02-backend/Module%20Dependency%20Diagram.md) §11 already carries this as unresolved for event schemas; §6.6 adds the REST side | Unresolved, both directions |
| **CI provider** ([ADR-0018](./ADR/ADR-0018-architecture-governance-ci-gate.md) §5) | Undecided; §9's stages are provider-independent |
| **Whether §7 warrants an ADR.** The k6 selection and the deferral of the load rig are both first-time decisions, which [ADR-0001](./ADR/ADR-0001-record-architecture-decisions.md) suggests belong in a record | Open |

---

## 13. Next steps

1. Add Testcontainers PostgreSQL to unblock L5.
2. Implement the `Accepted` ArchUnit and JMolecules gate.
3. Add the §7 benchmark when the first catalog controller exists.
4. Reconcile the test source sets with [`Backend Architecture.md`](../02-backend/Backend%20Architecture.md) and the implementation repositories.

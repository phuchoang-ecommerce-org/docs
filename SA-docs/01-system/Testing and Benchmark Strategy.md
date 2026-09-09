# Testing and Benchmark Strategy — Enterprise Commerce Platform (ECP)

**Document type:** Test Strategy
**Status:** Proposed — elaborates the `Proposed` test-stack rows of [ADR-0018](./ADR/ADR-0018-architecture-governance-ci-gate.md) §4
**Audience:** Engineering, Quality Assurance, Architecture Review
**Traces to:** `NFR-PERF-01`–`06` · `NFR-SCAL-01`–`07` · `NFR-REL-01`–`06` · `NFR-MAINT-05` · `NFR-OBS-01`–`04` · `AC-01`–`AC-06` · `P15`
**Related documents:** [ADR-0018](./ADR/ADR-0018-architecture-governance-ci-gate.md) · [Security](./Security.md) §12 · [Solution Architecture](./Solution%20Architecture.md) §6 · [Module Dependency Diagram](../02-backend/Module%20Dependency%20Diagram.md) · [Deployment Diagram](./Deployment%20Diagram.md) §7 · [traceability-matrix](../../BA-docs/traceability-matrix.md) §5

---

## 1. Purpose, Scope, and Status

### 1.1 What this document is

[`traceability-matrix.md`](../../BA-docs/traceability-matrix.md) asks whether *"every problem reaches a requirement, and every requirement a test."* Its first half is answered: 17/17 problems reach a requirement, 129/129 functional requirements reach a use case, no orphans. Its second half is not. The SRS names a verification method for all 39 non-functional requirements — *"fault-injection test at each step," "concurrency test at `NFR-SCAL-06` peak," "load test at volume"* — and no document says which suite performs any of them, on what stack, at what cadence, or with what result.

[ADR-0018](./ADR/ADR-0018-architecture-governance-ci-gate.md) closed part of that gap: it decided the architecture gate is `Accepted` and sketched a seven-row test strategy it marked `Proposed`, because *"the repository names no testing framework at all."* This document turns those seven rows into a strategy — layers, ownership, gates, cadence, and a benchmark definition specific enough to run.

[`Security.md`](./Security.md) §12 remains **authoritative for security verification**. Its requirement→test table (`NFR-SEC-01`–`07`, `NFR-OBS-01`–`02`, `AC-02`) and its ArchUnit security rules are not restated here; §2 below points at them and covers only what they leave.

### 1.2 What this document deliberately is not

**It does not specify a load-testing rig.** §7 defines a *quick smoke benchmark* — a two-minute run answering "is the read path in the right order of magnitude" — and nothing larger. The full-scale apparatus `NFR-SCAL-01`–`06` eventually require (10,000-product catalog, 100,000 customers, 10× peak, sustained soak, concurrent reporting load) is **deferred, not delivered**. §7.9 states the conditions under which it stops being deferrable, so the deferral is a dated decision rather than an omission.

This is a deliberate sequencing choice, and it has a cost worth naming: until that rig exists, `NFR-SCAL-01`–`06`, `NFR-PERF-05`, and `NFR-AVAIL-01` are **unverified**, and `AC-05` and `AC-06` cannot be claimed. §11 records them as unverified rather than as passing.

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

**Three requirements are not tests and should stop being counted as coverage:** `NFR-SCAL-07` (a cost trend), `NFR-AVAIL-01` (production uptime), and `NFR-MAINT-04`/`-06` (design review). Listing them as "untested" every sprint trains reviewers to ignore the column.

---

## 3. Test Layers

Seven layers, expanding [ADR-0018](./ADR/ADR-0018-architecture-governance-ci-gate.md) §4's table with cadence, gate, and a runtime budget. The budget is what keeps §4's split honest.

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

**L2 is in the fast suite on purpose.** [ADR-0018](./ADR/ADR-0018-architecture-governance-ci-gate.md) §5 names the failure mode directly — *"slow builds create pressure to skip them, which is exactly how the gate fails"* — and the architecture rules are the ones that must never be skipped. They need no container and belong nowhere else.

**L3 did not appear in ADR-0018 §4** and is added here. Between a domain unit test and a full module integration test there is a gap where `@RestControllerAdvice` error mapping ([Integration Contract](../04-shared/Integration%20Contract.md) §4), request validation, and pagination-envelope shape live. Testing those through Testcontainers is a container start-up to assert a JSON field name.

---

## 4. Fast Suite and Slow Suite

Two Gradle tasks and one script, so the split is a build fact rather than a convention:

| Task | Layers | Container needed | Where |
|---|---|---|---|
| `./gradlew test` | L1, L2, L3 | No | Local, every commit, every PR |
| `./gradlew integrationTest` | L4, L5, L6 | Yes (Docker) | PR + main |
| `./gradlew check` | both of the above | Yes | Pre-merge |
| `k6 run bench/smoke.js` | L7 | A running stack | Nightly, and by hand before a performance-relevant merge |

Rules that make the split hold:

- **`test` never starts a container.** A Testcontainers import in a fast-suite source set is itself an ArchUnit rule, or the boundary erodes within a month.
- **Testcontainers reuse is on for local runs, off in CI.** Locally, a reused container turns an 8-minute L4 run into roughly one. In CI, reuse hides cross-test state.
- **The slow suite fails the build on `main`, not only on the PR.** A test that only ever runs pre-merge is a test nobody notices going red after a dependency bump.

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

The 40 business rules of SRS §4, asserted against aggregates with no framework present. This is the dividend of [ADR-0005](./ADR/ADR-0005-clean-architecture-ports-and-adapters.md): the rules that matter most are testable in milliseconds.

Priority order follows [`traceability-matrix.md`](../../BA-docs/traceability-matrix.md) §6's own observation that `P7` and `P8` concentrate in exception flows: `BR-INV-01` (never oversell), `BR-ORD-01`/`-02`/`-03`/`-06`, `BR-PAY-01`/`-02`, `BR-PRM-03`. Each gets its happy path *and* every exception flow the use case documents — the exception flows are the requirement.

### 6.2 L2 — Architecture

The rule table in [ADR-0018](./ADR/ADR-0018-architecture-governance-ci-gate.md) §4 plus the security rules in [`Security.md`](./Security.md) §12.2, unchanged. Nothing is added here; both tables are authoritative where they stand.

One operational note: `ApplicationModules.of(EcpApplication.class).verify()` is a single test method whose failure message is the whole diagnosis. It should not be wrapped, softened, or caught.

### 6.3 L4 — Module integration

Spring Modulith's `Scenario` API, exercising the runtime event flow of [`Module Dependency Diagram.md`](../02-backend/Module%20Dependency%20Diagram.md) §4: publish a domain event, assert the downstream module reacted, assert the projection converged.

Two properties matter more than the happy path, and both come from [ADR-0030](./ADR/ADR-0030-spring-data-mongodb-read-model-access.md) §4:

- **Idempotency.** Redelivering the same event leaves the document byte-identical. `NFR-REL-06`'s at-least-once guarantee makes redelivery normal, not exceptional.
- **Ordering.** An out-of-order event does not overwrite newer state.

Neither is meaningful against a mock, which is why MongoDB is a container here.

### 6.4 L5 — Persistence and concurrency

The load-bearing suite. `NFR-REL-03` — *"concurrent purchase attempts never confirm more orders than there is stock to fulfil"* — is the single guarantee the whole reservation model of [ADR-0011](./ADR/ADR-0011-optimistic-locking-reservation-model.md) exists to provide, and it is verifiable in exactly one way: N threads racing one SKU against real PostgreSQL, asserting that successes equal stock and every loser saw a clean rejection rather than a partial write.

**An in-memory database cannot verify this.** H2's optimistic-locking behaviour is an approximation of PostgreSQL's, and an approximation of a concurrency guarantee is not a guarantee. [ADR-0018](./ADR/ADR-0018-architecture-governance-ci-gate.md) §4 says so; it is repeated here because it is the rule most likely to be traded away for build speed.

`NFR-REL-01`'s fault injection sits alongside it: fail at each step of order placement — after reservation, after promotion redemption, after order insert, after outbox write — and assert the outcome is fully applied or fully absent, never partial.

### 6.5 L6 — Event delivery

Testcontainers Kafka with the broker stopped mid-relay. Assert: no accepted business event is lost (`NFR-REL-05`), every event reaches every dependent consumer at least once (`NFR-REL-06`), and the outbox drains on recovery without manual repair. The transactional outbox of [ADR-0012](./ADR/ADR-0012-transactional-outbox-and-kafka.md) is otherwise an untested claim.

### 6.6 Contract tests

[ADR-0031](./ADR/ADR-0031-contract-first-openapi.md) makes the hand-authored specification **normative** and says the CI gate verifying controllers against it *"is a CI gate to be built alongside the controllers."* This strategy names its shape:

| Direction | Check |
|---|---|
| Spec → code | Every one of the 155 operations has a controller method at that path and verb. A spec operation with no implementation fails. |
| Code → spec | Every controller mapping appears in the spec. An endpoint that exists but is undocumented fails — this is the direction that catches the wire format being decided one controller at a time, which is exactly what [ADR-0031](./ADR/ADR-0031-contract-first-openapi.md) §1 exists to prevent. |
| Response shape | L3 and L4 responses validated against the operation's schema, so drift surfaces as a failing test rather than a frontend bug. |
| Permission cells | The `NFR-SEC-01` matrix test of [`Security.md`](./Security.md) §12.1 is generated from the spec × the permission matrix, so a new operation with no matrix cell fails the build. |

**On Spring REST Docs.** The scaffold already carries `spring-boot-starter-restdocs` and an Asciidoctor task. REST Docs generates documentation *from* tests; [ADR-0031](./ADR/ADR-0031-contract-first-openapi.md) makes the specification the source and the code the thing verified. The two point in opposite directions, and the ADR wins: the spec is the oracle. REST Docs is retained only as a source of request/response examples, never as the description of the API. If it is not used for that, the dependency and its Asciidoctor task should be removed rather than left to imply a contract strategy the ADRs rejected.

### 6.7 Frontend

| Layer | Stack | Verifies |
|---|---|---|
| Type check | `tsc --noEmit` under strict mode | [ADR-0020](./ADR/ADR-0020-typescript-strict-mode.md) — build-failing |
| Lint | ESLint + the rules of [`Security.md`](./Security.md) §12.2 (`dangerouslySetInnerHTML` ban, `outline: none` ban) | Build-failing |
| Component | Vitest + Testing Library | Keyboard interaction, focus visibility, and the ≥ 44 px hit area of [ADR-0026](./ADR/ADR-0026-motion-and-accessibility-baseline.md) §4 |
| Accessibility | `axe` in component tests | The automated subset of the WCAG AA baseline. [ADR-0026](./ADR/ADR-0026-motion-and-accessibility-baseline.md) is explicit that this is *"a floor, not all of them"* — periodic manual screen-reader testing stays necessary |
| Token contrast | Assertion over the token pairs of [ADR-0022](./ADR/ADR-0022-ma-design-tokens.md) | Measured ratios, not eyeballed |
| E2E | Playwright, a **thin** suite | The purchase path of `NFR-AVAIL-01`, and nothing else |

**The E2E suite stays small on purpose.** Every behaviour reachable by a cheaper test belongs in that cheaper test; `NFR-SEC-01` in particular is a backend property and is verified by the §12.1 matrix, never by driving a browser — [ADR-0019](./ADR/ADR-0019-nextjs-app-router-rendering-strategy.md) §4 is explicit that *"the frontend enforces nothing."*

[`Frontend Architecture.md`](../03-frontend/Frontend%20Architecture.md) §8 maps its own claims onto these layers and names the four it puts in the E2E and integration suites specifically: that no token reaches the browser, that CSRF is required on every cookie-authenticated write, that refresh is serialised under concurrency, and that the CSP is served unwidened per route group.

Per-route-class performance budgets follow [ADR-0019](./ADR/ADR-0019-nextjs-app-router-rendering-strategy.md) §4's classification, with the static catalog routes carrying the tightest. Measuring them is §7.9's second trigger, not part of the smoke run.

---

## 7. The Smoke Benchmark

### 7.1 Two kinds of measurement

[`Technology Stack.md`](./Technology%20Stack.md) lists "Benchmark performance" with no definition, and the word covers two things that need separating:

| | **Smoke benchmark** — built now | **Load rig** — deferred |
|---|---|---|
| Question | Is the read path in the right order of magnitude? | Do `NFR-SCAL-01`–`06` hold? |
| Duration | ~2 minutes | Hours, plus a data-generation step |
| Scale | 1,000 products, 10 virtual users | 10,000 products, 100,000 customers, 10× peak |
| Environment | One developer host, `N = 1` | Staging, production-shaped, `N > 1` |
| Result | A trend line and a coarse pass/fail | A ratified statement about capacity |
| Cost | Negligible | A real project |

The smoke benchmark answers a narrower question than the SRS asks, and answers it every night for nearly nothing. That is its entire justification.

### 7.2 The rules

1. **Short.** If it takes longer than a slow test suite, it will be run less often than one, and a benchmark nobody runs measures nothing.
2. **Comparative before absolute.** Its primary output is *movement against the last run*, not a certificate against `NFR-PERF-01`. A 40 % regression on an unratified host is a real signal; a 280 ms p95 on a laptop is not a passed requirement.
3. **Reported, never build-failing.** [ADR-0018](./ADR/ADR-0018-architecture-governance-ci-gate.md) §4 already fixes this. A benchmark that blocks merges on a shared CI runner's noise gets disabled within a fortnight, and then nothing is measured at all.
4. **Same process shape as production.** The `bootJar` of [Deployment](./Deployment%20Diagram.md) §3, on the same image versions — not a Gradle `bootRun` with dev tooling attached.
5. **Warm-up discarded.** The JVM's first thirty seconds measure JIT compilation, not the platform.

### 7.3 Scope — five scenarios

The read path plus one write. Deliberately the smallest set that covers the four latency NFRs.

| # | Scenario | Requirement | Threshold | Why this one |
|---|---|---|---|---|
| S1 | `GET /products/{id}` — product detail, cache-warm | `NFR-PERF-01` | p95 < 300 ms | The highest-traffic route and the Redis cache-aside path of [ADR-0015](./ADR/ADR-0015-redis-cache-and-rate-limiting.md) |
| S2 | `GET /products?category=…` — first page | `NFR-PERF-01` | p95 < 300 ms | Exercises the index design of [`Database.md`](../02-backend/Database.md) and cursor pagination |
| S3 | `GET /search?q=…` | `NFR-PERF-03` | p95 < 500 ms | The only route reading Elasticsearch ([ADR-0014](./ADR/ADR-0014-elasticsearch-search-read-model.md)) |
| S4 | `GET /search/suggestions?q=…` | `NFR-PERF-04` | p95 < 150 ms | The tightest budget in the SRS; regressions show here first |
| S5 | `PUT /cart/items/{id}` — quantity amendment | `NFR-PERF-02` | p95 < 800 ms | One transactional write, to keep the write path from being measured only by the load rig |

**Order placement is excluded.** It consumes reserved stock, so it is not idempotent across runs and would need inventory reset between iterations — which is a load-rig concern. Its latency is covered by S5's shape; its *correctness* is L5's job, and L5 is the suite that matters for it.

**S1 is cache-warm on purpose, and this is a limitation, not a feature.** A warm-cache p95 says nothing about the cold-start behaviour that a deployment or a Redis eviction actually produces. §7.8 records it.

### 7.4 Tool

| Tool | Verdict |
|---|---|
| **k6** | **Chosen.** Scripted in JavaScript, thresholds are first-class and produce an exit code, single static binary with no JVM to warm alongside the system under test, JSON summary that a nightly can diff. |
| Gatling | Capable and JVM-native, but a Scala/Java DSL and a compile step for a two-minute run; its strength is the load rig this section defers. |
| JMeter | XML plans, heavier operationally; strong at the deferred rig, poor at "one file in the repository." |
| JMH | Wrong level. It measures method throughput inside one JVM; every threshold here is an HTTP-boundary latency. It becomes the right tool if a specific hot path needs micro-analysis. |
| `hey` / `oha` | Right weight, but no scenario scripting and no per-scenario thresholds — S1–S5 would become five ad-hoc invocations with the interpretation left to whoever ran them. |

The k6 selection is `Proposed` and follows [ADR-0001](./ADR/ADR-0001-record-architecture-decisions.md): it is decided here for the first time and is not promoted quietly.

### 7.5 Run profile

| Parameter | Value | Reason |
|---|---|---|
| Target | `ecp-api` `bootJar` against the local Compose data tier ([Deployment](./Deployment%20Diagram.md) §7) | Reproducible on any developer host |
| Dataset | 1,000 products · 20 categories · 200 customers · 500 orders | Enough for index selectivity to matter; small enough to seed in seconds. **Deliberately an order of magnitude below `NFR-SCAL-01`** — this run does not claim to verify it |
| Warm-up | 1 VU, 30 s, **discarded** | JIT and connection-pool fill |
| Measured | 10 VUs, 60 s, constant | Concurrency high enough to expose pool contention, low enough that a laptop is not the bottleneck |
| Total | ~2 minutes plus seeding | Rule 1 of §7.2 |
| Output | k6 JSON summary committed to the run log, not to the repository | Trend over time is the deliverable |

**Ten virtual users is not "thousands of concurrent customers."** `NFR-SCAL-04` is untouched by this run and remains unverified.

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

Paths are illustrative until the controllers exist; the authoritative forms are in [`openapi.yaml`](../04-shared/OpenAPI/README.md), and the script's paths must be reconciled against it when the endpoints land. S5 needs an authenticated session; the cookie handling of [ADR-0025](./ADR/ADR-0025-httponly-cookie-session.md) is a `setup()` step to be added once the auth endpoints exist.

### 7.7 Reading a result

| Outcome | Meaning | Action |
|---|---|---|
| All thresholds pass | The read path is in the right order of magnitude on this host | Record the p95s; no action |
| One threshold fails by < 20 % | Ambiguous — host noise and an unratified environment both live in that band | Re-run once; if it persists, investigate |
| One threshold fails by > 20 %, or regresses > 40 % from the previous run | A real regression | Investigate before merging the change that caused it |
| `http_req_failed` exceeds 1 % | Not a performance result at all | The benchmark is invalid; fix correctness first |

**k6 measures client-observed latency; the SRS specifies server-side latency excluding external provider time.** Client-observed is a superset, so a pass is conclusive and a marginal failure is not. Separating the two requires the Micrometer timers of [Deployment](./Deployment%20Diagram.md) §8, which is where a marginal result should be taken — not into a longer k6 run.

### 7.8 What this benchmark cannot tell you

The section that keeps the run honest. None of the following is verified by anything in §7:

- **Scale.** `NFR-SCAL-01`–`04` — 10,000 products, 100,000 customers, thousands of orders/day, thousands of concurrent customers. The dataset and the VU count are both deliberately far below all four.
- **Peak.** `NFR-SCAL-06`'s 10× absorption, and therefore `NFR-REL-03` *at peak*. L5 verifies the oversell guarantee at correctness scale; whether it holds at 10× is a different question with a different answer.
- **Interference.** `NFR-PERF-05` — reporting under sustained concurrent load. `AC-05` rests entirely on this and is unverified.
- **Cold paths.** Cache-cold reads, an empty Redis after deployment, a cold Elasticsearch page cache. S1 is warm by construction.
- **Duration.** Connection-pool exhaustion, memory growth, outbox-table growth ([ADR-0012](./ADR/ADR-0012-transactional-outbox-and-kafka.md) §5), and GC behaviour at steady state are all soak properties. Sixty seconds sees none of them.
- **Topology.** `N = 1` on one host. The scheduler and outbox-relay single-runner contention that [Deployment](./Deployment%20Diagram.md) §6 flags is *invisible* at `N = 1` — that document says so, and warns it must be tested in staging rather than discovered in production.
- **Availability.** `NFR-AVAIL-01`'s 99.9 % is a monthly production measurement and cannot be benchmarked at all.

### 7.9 When the deferral ends

The load rig stops being deferrable when any one of these is true. Each is observable, so the deferral has an end condition rather than a hope:

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

**Two rows deserve emphasis.** PostgreSQL is absent from both the test containers and the Compose file while being the source of truth in [ADR-0009](./ADR/ADR-0009-postgresql-source-of-truth.md); and the ArchUnit gate that [ADR-0018](./ADR/ADR-0018-architecture-governance-ci-gate.md) marks `Accepted` has no code behind it. Everything else in this table is ordinary scaffolding work.

---

## 9. Pipeline Stages

[ADR-0018](./ADR/ADR-0018-architecture-governance-ci-gate.md) §5 records the CI provider as undecided. This proposes the stages, which are provider-independent.

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

[ADR-0018](./ADR/ADR-0018-architecture-governance-ci-gate.md) §5 leaves coverage policy open. **No global line-coverage percentage is proposed**, and the reason is the one `P15` describes: a percentage is satisfied by testing whatever is cheapest to test, which is rarely what carries risk. Getters reach 90 % faster than exception flows do.

Four mandatory-coverage rules instead, each checkable and each tied to something the traceability chain already tracks:

| Rule | Rationale |
|---|---|
| Every business rule in SRS §4 has at least one L1 test naming its `BR-` id | 40 rules; `P5` is a claim about enforcement, so an unenforced rule is the whole failure |
| Every `Must` use case's **exception** flows are covered, not only its main flow | [`traceability-matrix.md`](../../BA-docs/traceability-matrix.md) §6: *"what makes `FR-ORD-08` testable is the ten exception flows of `UC-ORD-05`"* |
| Every OpenAPI operation appears in the §6.6 contract check and the [`Security.md`](./Security.md) §12.1 permission matrix | 155 operations; an uncovered cell is an unverified authorisation decision |
| Every domain event in [Integration Contract](../04-shared/Integration%20Contract.md) §7 has an L4 test asserting a consumer reacts idempotently | Redelivery is normal under `NFR-REL-06`, not exceptional |

Line coverage is still *measured and reported* — a module trending downward is worth a conversation. It is not a gate.

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

`AC-05` and `AC-06` are recorded as not-yet-met rather than in progress. That is the honest consequence of §1.2's deferral, and it is stated here so the gap is visible at strategy level rather than discovered during acceptance — the same reason [`Solution Architecture.md`](./Solution%20Architecture.md) §12 gives for its own table.

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

## 13. Next Step

The order is fixed by dependency, not preference. Testcontainers PostgreSQL first — it unblocks L5, and L5 carries the two reliability guarantees the architecture is most exposed on. ArchUnit second, because [ADR-0018](./ADR/ADR-0018-architecture-governance-ci-gate.md)'s gate is `Accepted` and unimplemented, which is the one state a governance decision must not stay in. The §7 benchmark last: it measures endpoints that do not exist yet, so it is worth writing when the first catalog controller lands and not before.

`Backend Architecture.md` — a stub at present — is where the Gradle multi-project layout of §8 and the source-set split of §4 are settled. This document assumes that layout and should be reconciled with it once it exists.

# ADR-0018 — Architecture Governance as a CI Gate: ArchUnit, Modulith Verification, and the Test Strategy

**Status:** Accepted · the test-stack selection is **Proposed** · §4.1's eleven CQRS rules are **Proposed**, pending ratification of [`CQRS.md`](../../02-backend/CQRS.md)
**Date:** 2026-09-06
**Traces to:** `P15` · `P5` · `NFR-MAINT-01` · `NFR-MAINT-02` · `NFR-MAINT-03` · `NFR-MAINT-05` · `NFR-REL-03` · `AC-04`

---

## 1. Context and Problem Statement

Every structural decision in this folder — the layering of [ADR-0005](./ADR-0005-clean-architecture-ports-and-adapters.md), the module boundaries of [ADR-0006](./ADR-0006-spring-modulith-module-boundaries.md), the stereotype rules of [ADR-0007](./ADR-0007-jmolecules-tactical-ddd.md), the authorisation placement of [ADR-0016](./ADR-0016-jwt-refresh-rotation-rbac.md) — describes a property the code should have. None of them makes the code have it.

`P15` names the consequence: without ongoing discipline the structure erodes and every future feature costs more than the last. `NFR-MAINT-05` states the required answer directly — *"Structural constraints are enforced automatically and continuously, so that a violation is caught when it is introduced rather than discovered later"* — with "Automated build check" as its verification method. `AC-04` depends on it.

This matters most for [ADR-0002](./ADR-0002-modular-monolith-deployment-unit.md). Modules are packages inside one artifact, so the compiler will not stop a boundary violation. The entire value of "modular" in "modular monolith" is contingent on this record.

A second, related gap: **the repository names no testing framework at all.** No JUnit, no Testcontainers, no contract testing. Yet several NFRs specify their own verification method — `NFR-REL-01` "fault-injection test at each step," `NFR-REL-03` "concurrency test at `NFR-SCAL-06` peak," `NFR-SEC-01` "authorisation test per role per operation." Those tests need a stack. It is decided here as `Proposed`, per [ADR-0001](./ADR-0001-record-architecture-decisions.md).

## 2. Decision Drivers

- `NFR-MAINT-05` — violations caught when introduced, by an automated build check.
- `NFR-MAINT-01`, `NFR-MAINT-02`, `NFR-MAINT-03` — each is stated as verifiable, and each needs an executable assertion.
- The most dangerous omissions identified in other records: a missing `AuthorizationService` call ([ADR-0016](./ADR-0016-jwt-refresh-rotation-rbac.md)), a domain service holding a repository ([ADR-0007](./ADR-0007-jmolecules-tactical-ddd.md)), a lazy reference crossing an aggregate boundary ([ADR-0010](./ADR-0010-jpa-write-model-jdbc-read-models.md)).
- Several NFRs specify test *types* — concurrency, fault injection, per-role authorisation — that unit tests with mocks cannot deliver credibly.

## 3. Considered Options

**Option 1 — ArchUnit + Spring Modulith verification as mandatory build-failing tests, plus a layered test strategy.** *(chosen)*

- **Pros:** A violated rule fails the build before merge, so structure becomes a property rather than a habit — exactly `NFR-MAINT-05`'s wording. Rules live next to the code and version with it. Modulith's verification understands module APIs and events, which hand-written rules would have to reconstruct. Testcontainers lets `NFR-REL-01`/`NFR-REL-03` be tested against real PostgreSQL semantics, which is the only way an optimistic-locking guarantee is credibly verified.
- **Cons:** Rules must be written and maintained; a rule that is wrong blocks legitimate work and creates pressure to disable it. Testcontainers-based tests are slower than mocked ones, and build time is a real tax.

**Option 2 — Code review as the enforcement mechanism.**

- **Pros:** No tooling; reviewers can weigh context and intent.
- **Cons:** This is the null option `P15` describes: *"A rule that only exists in a document degrades the moment someone doesn't read it."* Fails `NFR-MAINT-05`'s "automatically and continuously" outright.

**Option 3 — Static analysis (SonarQube, Checkstyle, custom PMD rules).**

- **Pros:** Broad coverage of general code quality; established tooling.
- **Cons:** Good at style and common defects, poor at architectural relationships — "a `@DomainService` must not hold a repository field" and "no module may reach another's internals" are dependency-graph assertions, not lint rules. Complementary, not a substitute.

**Option 4 — Enforce boundaries by compilation, with one Maven module per context.**

- **Pros:** The strongest guarantee; a violation does not compile.
- **Cons:** Rejected in [ADR-0006](./ADR-0006-spring-modulith-module-boundaries.md) — it breaks the Order-Placement Partnership's shared transaction and imposes twelve artifacts on a system that deploys as one.

## 4. Decision Outcome

**Chosen: Option 1.** Architecture rules are executable tests that fail the build. Test scope follows the guarantee being verified.

**Rules that must exist.** Each corresponds to a decision that is otherwise unenforceable:

| Rule | Enforces | From |
|---|---|---|
| Domain layer depends on nothing but the shared kernel — no Spring, JPA, Jackson, provider SDKs | `CON-03`, `NFR-MAINT-03` | [ADR-0005](./ADR-0005-clean-architecture-ports-and-adapters.md) |
| Dependencies point inward: web → application → domain; infrastructure never inward-violates | layering | [ADR-0005](./ADR-0005-clean-architecture-ports-and-adapters.md) |
| No module accesses another module's internal packages (Modulith `verify()`) | `P1`, `NFR-MAINT-01`, `NFR-MAINT-02` | [ADR-0006](./ADR-0006-spring-modulith-module-boundaries.md) |
| `shared-kernel` has zero outbound dependencies on any context | Shared Kernel discipline | [ADR-0006](./ADR-0006-spring-modulith-module-boundaries.md) |
| No cyclic dependencies between modules | `NFR-MAINT-02` | [ADR-0006](./ADR-0006-spring-modulith-module-boundaries.md) |
| A `@DomainService` holds no repository, no port, and opens no transaction | `Domain Model.md` §7 | [ADR-0007](./ADR-0007-jmolecules-tactical-ddd.md) |
| Only `@ApplicationService` opens a transaction; `@QueryService` is read-only | `P5`, CQRS | [ADR-0007](./ADR-0007-jmolecules-tactical-ddd.md), [ADR-0008](./ADR-0008-cqrs-command-query-separation.md) |
| **Every `@ApplicationService` command method calls `AuthorizationService`** | `NFR-SEC-01`, `BR-AUD-02` | [ADR-0016](./ADR-0016-jwt-refresh-rotation-rbac.md) |
| Every `@AggregateRoot` carries `@Version` | `NFR-REL-03` | [ADR-0011](./ADR-0011-optimistic-locking-reservation-model.md) |
| One repository per aggregate root; none for child entities | `Domain Model.md` §7 | [ADR-0010](./ADR-0010-jpa-write-model-jdbc-read-models.md) |
| The Audit module exposes no update or delete operation | `NFR-OBS-02` | [ADR-0017](./ADR-0017-append-only-audit-log.md) |
| No `@Service`/`@Repository` outside the approved meta-annotations | `Technology Stack.md` | [ADR-0007](./ADR-0007-jmolecules-tactical-ddd.md) |
| No `org.springframework.data.mongodb` type outside a module's `infrastructure` package | `CON-03`, `NFR-MAINT-03` | [ADR-0030](./ADR-0030-spring-data-mongodb-read-model-access.md) |
| A MongoDB write occurs only inside an `@EventHandler` — never an `@ApplicationService`, controller, or scheduled job | `CON-06`, single-writer | [ADR-0030](./ADR-0030-spring-data-mongodb-read-model-access.md), [ADR-0013](./ADR-0013-mongodb-scoped-to-read-models.md) |
| A `@QueryService` reaching MongoDB carries no PostgreSQL transaction | `NFR-PERF-05`, `CON-06` | [ADR-0030](./ADR-0030-spring-data-mongodb-read-model-access.md) |

The authorisation rule is the single highest-value entry: a missing call is a silent authorisation bypass, and it is the one omission that no other mechanism catches.

The last MongoDB rule is the second-least-obvious. It is a **narrowing** of the `@QueryService` row above, not a contradiction of it: a PostgreSQL query service is read-only *and* transactional, a MongoDB one is read-only and carries no transaction at all. The failure it prevents — a transactional connection held for the duration of every dashboard request — appears only as pool pressure under load, never as a failing test, so an assertion is the only thing that catches it ([ADR-0030](./ADR-0030-spring-data-mongodb-read-model-access.md) §5).

### 4.1 Rules added by `CQRS.md` §11.1

**Status: `Proposed`.** [`CQRS.md`](../../02-backend/CQRS.md) renders [ADR-0008](./ADR-0008-cqrs-command-query-separation.md) into a command/query contract, a read-model catalogue, and per-store projection guards. Eleven of its rules are assertions this gate can carry, and they are listed here — the gate's rule set is one table, not one per document — rather than in the document that decided them. They are `Proposed` for as long as `CQRS.md` is: the [ADR index](./README.md) §2 forbids quiet promotion, so these become `Accepted` in the commit that ratifies it, not in the one that wrote it.

| # | Rule | Enforces | Catches |
|---|---|---|---|
| G1 | An `@ApplicationService` must not reference a `@QueryService`, nor any read-store client (`MongoTemplate`, an Elasticsearch client, a Redis template) | `CQRS.md` §2.2 — a command never decides against a read model | The highest-value rule of the eleven, for the same reason the authorisation rule leads the table above: a command that reads a projection returns a wrong decision under load and a correct one in every test that is not concurrent |
| G2 | A `@QueryService` must not reference a JMolecules `@Repository`, `@AggregateRoot`, `@Entity`, or `@DomainService` type | `CQRS.md` §4.2 | The N+1 and lazy-loading path [ADR-0010](./ADR-0010-jpa-write-model-jdbc-read-models.md) §3 rejects, reintroduced on the read side |
| G3 | A `@QueryService` method's return type must not be annotated `@AggregateRoot` or `@Entity` | `CQRS.md` §4.1 | A domain type reaching the wire, and with it an ORM or Jackson annotation reaching the domain (`CON-03`) |
| G4 | A view record must not reference a domain or JPA type | `CQRS.md` §4.1 | The same leak by composition rather than by return type |
| G5 | A write to Elasticsearch occurs only inside an `@EventHandler` | `CQRS.md` §6.1; [ADR-0014](./ADR-0014-elasticsearch-search-read-model.md) §4 | A dual write with no transaction spanning it — the mirror of the MongoDB rule above, for the store that already required this in prose |
| G6 | No Elasticsearch client type outside a module's `infrastructure` package | `CON-03`, `NFR-MAINT-03` | The mirror of the `spring-data-mongodb` rule above |
| G7 | A `@QueryService` reaching Elasticsearch or MongoDB carries no PostgreSQL transaction | `NFR-PERF-05`, `CON-06` | Widens the MongoDB row above to Elasticsearch. Same failure, same invisibility: a transactional connection held for every search request shows up as pool pressure under load and never as a failing test |
| G8 | An `@EventHandler` that writes a read store must not publish an event nor call another module's application service | `CQRS.md` §6.5; [`Domain Model.md`](../../02-backend/Domain%20Model.md) §5.2's zero-upstream-influence rule | A read model becoming a participant in the write side, and a runtime edge the module graph does not show |
| G9 | No cache client type in a module's `application` or `domain` package | `CQRS.md` §6.3 | Cache invalidation drifting into the application layer, where it becomes a second lifetime mechanism competing with the TTL |
| G10 | The `reporting` and `audit` modules declare no `@ApplicationService` with a mutating command method | [`Domain Model.md`](../../02-backend/Domain%20Model.md) §8.12; [ADR-0017](./ADR-0017-append-only-audit-log.md) | A write path appearing in a pure read side or an append-only log. Strengthens the Audit row above from "no update or delete" to "no command at all" |
| G11 | A command type is declared in `application`, never in `api` | `CQRS.md` §3.2 | A command reachable only over HTTP, which makes the Scheduler and event-handler entry points second-class and `BR-AUD-02`'s "same decision regardless of entry point" untestable |

G5, G6, and G7 are deliberately the Elasticsearch twins of rules this record already carried for MongoDB. The asymmetry was an artefact of [ADR-0030](./ADR-0030-spring-data-mongodb-read-model-access.md) existing while no equivalent record covered the search index, not a decision that the search index needed less protection.

**Test strategy — `Proposed`**, since the repository names no framework. The seven layers this record proposed are now carried, with their cadence, gate status, and time budget, by [`Testing and Benchmark Strategy.md`](../Testing%20and%20Benchmark%20Strategy.md) §3 — a strict superset of the table that stood here. The rule most likely to be traded away is restated there: a `BR-INV-01` optimistic-locking guarantee cannot be verified against an in-memory database.

**The gate is mandatory.** Architecture tests run on every build and every pull request. A rule may be changed by editing it in a commit that says why; it may not be suppressed to unblock a merge. A rule that is genuinely wrong is a defect in this ADR set, and the fix is to amend the record.

## 5. Consequences

### Positive

- `NFR-MAINT-05` is satisfied as written, and `NFR-MAINT-01`/`-02`/`-03` acquire executable definitions.
- The "modular" in modular monolith becomes real; without this record [ADR-0002](./ADR-0002-modular-monolith-deployment-unit.md) degrades into the layered monolith it explicitly rejects.
- Rules are documentation that cannot go stale, because a stale rule fails a build.
- `AC-04` gains concrete evidence rather than an architectural opinion.

### Negative

- **Build time grows substantially.** Testcontainers-based persistence, concurrency, and event tests are slow, and slow builds create pressure to skip them — which is exactly how the gate fails. Splitting fast and slow suites is necessary, and the architecture tests must stay in the fast one.
- **A wrong rule blocks legitimate work.** The Order-Placement Partnership is the likely first collision: it deliberately crosses three module boundaries in one transaction. It must be expressed through `StockReservationPort` and `PromotionRedemptionPort` so Modulith sees a legal interaction; if it is not, the temptation will be to relax the rule rather than fix the code.
- **The authorisation rule is hard to express precisely.** "Calls `AuthorizationService`" is checkable structurally, but "calls it with the *right* permission" is not — that remains a review and test concern.
- **Rules need maintenance.** New contexts, new stereotypes, and new patterns all require rule updates, and an unmaintained rule set is quietly weakened by exemptions.

### Neutral / follow-on

- CI provider, pipeline stages, and coverage policy are undecided; no record covers them.
- The test-stack rows stay `Proposed` until ratified, per [ADR-0001](./ADR-0001-record-architecture-decisions.md).

## 6. Related Decisions

[ADR-0005](./ADR-0005-clean-architecture-ports-and-adapters.md) · [ADR-0006](./ADR-0006-spring-modulith-module-boundaries.md) · [ADR-0007](./ADR-0007-jmolecules-tactical-ddd.md) · [ADR-0008](./ADR-0008-cqrs-command-query-separation.md) · [ADR-0011](./ADR-0011-optimistic-locking-reservation-model.md) · [ADR-0016](./ADR-0016-jwt-refresh-rotation-rbac.md) · [ADR-0017](./ADR-0017-append-only-audit-log.md) · [ADR-0030](./ADR-0030-spring-data-mongodb-read-model-access.md)

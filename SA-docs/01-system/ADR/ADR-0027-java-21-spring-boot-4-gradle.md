# ADR-0027 — Java 21 (LTS) on Spring Boot 4.1.1, Built with Gradle (Multi-Module)

**Document type:** Architecture Decision Record
**Status:** Proposed
**Date:** 2026-09-07
**Deciders:** Solution Architecture
**Traces to:** `P14` · `P15` · `NFR-MAINT-01` · `NFR-MAINT-02` · `NFR-MAINT-05` · `NFR-SCAL-04` · `NFR-SCAL-06`
**Related documents:** [Technology Stack](../Technology%20Stack.md) · [ADR-0002](./ADR-0002-modular-monolith-deployment-unit.md) · [ADR-0006](./ADR-0006-spring-modulith-module-boundaries.md) · [ADR-0018](./ADR-0018-architecture-governance-ci-gate.md)

---

## 1. Context and Problem Statement

[`Technology Stack.md`](../Technology%20Stack.md) opens with *"Spring Framework/Spring Boot"* and goes on to name Lombok, MapStruct, JMolecules, ArchUnit, and Spring Modulith — all Java libraries. The repository's `.gitignore` is pre-seeded for a JVM project (`*.class`, `*.jar`, `*.war`, `hs_err_pid*`). **No document in the repository names a language version, a Spring Boot version, or a build tool.** Java is implied and never stated. Every other backend record depends on these facts: Spring Modulith 2.x requires Spring Boot 4.x, which requires Java 17 or later; virtual threads require Java 21. This record makes the implied explicit so the rest of the set has something to stand on.

Two later records shape the terms of the build-tool and framework-version questions:

- [ADR-0006](./ADR-0006-spring-modulith-module-boundaries.md) fixed the module structure at **twelve bounded-context modules plus a `shared-kernel`**, and separately rejected "one Maven artifact per context" (its Option 2) — but only because of *what that option published*, not because compiling contexts as separate units is undesirable. Its stated cost was "twelve artifacts to version and wire for a system that deploys as one," and a broken Order-Placement Partnership. Neither cost is inherent to compiling contexts separately; both come specifically from *publishing* them separately. Used instead to define twelve *compilation units* feeding one `bootJar`, a multi-module build's advantage applies directly to ADR-0006's twelve modules without touching [ADR-0002](./ADR-0002-modular-monolith-deployment-unit.md)'s single deployable.
- [ADR-0018](./ADR-0018-architecture-governance-ci-gate.md) put ArchUnit and Spring Modulith verification on the critical path of every build and pull request, and named its own negative consequence in the same breath: *"Build time grows substantially… slow builds create pressure to skip them — which is exactly how the gate fails."*

The question this record answers: **what language version, Spring Boot version, and build tool give this platform a governable, verifiable structure (`P15`) at the concurrency and scale this is sized against (SRS §6), while keeping the local dev loop and the CI gate [ADR-0018](./ADR-0018-architecture-governance-ci-gate.md) mandates as fast as the module count [ADR-0006](./ADR-0006-spring-modulith-module-boundaries.md) fixed allows?**

Status is `Proposed` under [ADR-0001](./ADR-0001-record-architecture-decisions.md)'s rule: the outcome is stated nowhere upstream, so this record is making the decision rather than recording it.

## 2. Decision Drivers

- Spring Modulith and JMolecules — both load-bearing for `P15` and `NFR-MAINT-05` — require Spring Boot 4.x (the Modulith 2.x line).
- `NFR-SCAL-04` (thousands of concurrent customers) and `NFR-SCAL-06` (10× peak, assumption **[A-04]**) favour a runtime where a blocking request thread is cheap.
- The [`Domain Model.md`](../../02-backend/Domain%20Model.md) §7 vocabulary — immutable Value Objects, past-tense domain events, the `Held → Committed/Released` state machine — maps directly onto records, sealed types, and pattern matching.
- Currency at zero migration cost — no backend code exists yet in this repository, so adopting the current Spring Boot generation now is free in a way adopting it later, after code exists, would not be.
- `NFR-MAINT-05` — structural violations must be caught automatically; the build tool must not weaken this, and ideally strengthens it.
- The build-time cost [ADR-0018](./ADR-0018-architecture-governance-ci-gate.md) already accepted and flagged as a risk to its own gate: Testcontainers-backed persistence, concurrency, and event tests are slow, and slow builds create pressure to skip them.
- `P14` — module boundaries are team-ownership boundaries; a build where an unrelated module's change does not force a full recompile/retest lets teams actually work independently, not just own separate packages.

## 3. Considered Options

### Language version

**Option 1 — Java 21 (LTS).** *(chosen)*

- **Pros:** LTS with the longest remaining support runway. Virtual threads let the blocking, transaction-per-request model this architecture actually uses reach `NFR-SCAL-04` concurrency without a reactive rewrite. Records give immutable Value Objects (`Money`, `Quantity`, typed IDs) with no Lombok involvement. Sealed interfaces plus pattern matching express the order-lifecycle and `ReservationStatus` state machines directly.
- **Cons:** Some bytecode-manipulating agents and coverage tools lag LTS releases. Lombok must be kept on a version that supports 21.

**Option 2 — Java 17 (LTS).**

- **Pros:** Broadest tooling maturity; the minimum Spring Boot 4.x requires.
- **Cons:** No virtual threads, so peak absorption (`NFR-SCAL-06`) rests entirely on thread-pool sizing and caching. Choosing it schedules a migration to 21 later for no benefit now.

**Option 3 — Kotlin on the JVM.**

- **Pros:** Null safety, data classes, and expressive DSLs suit DDD modelling well.
- **Cons:** Named nowhere in the repository. JMolecules, ArchUnit, MapStruct, and Lombok are all documented against Java, and Lombok is redundant in Kotlin — adopting Kotlin would silently invalidate an entry in the stack list. Introduces a language decision the business documents never contemplated.

### Framework version

**Option 1 — Spring Boot 3.x.**

- **Pros:** Mature ecosystem; Spring Modulith's 1.4.x line targets this generation; the broadest body of existing tutorials and answers.
- **Cons:** Already the previous major generation as of this record's date. Choosing it now, with no backend code yet written, would only schedule an unforced migration to the 4.x line later — the same shape of argument that rejects staying on Java 17 above ("schedules a migration... later for no benefit now").

**Option 2 — Spring Boot 4.1.1 (Spring Framework 7.0.9, Jakarta EE 11).** *(chosen)*

- **Pros:** Current GA release (2026-08-21). Java 21 remains fully compatible — Spring Boot 4 keeps Java 17 as its floor and recommends 21/25, so the virtual-threads reasoning for `NFR-SCAL-04` above is untouched. Spring Modulith 2.0+, which this line requires, is itself GA — [ADR-0006](./ADR-0006-spring-modulith-module-boundaries.md)'s decision to use Spring Modulith is unaffected, only the version floor moves. Adopting the current generation before any code exists costs nothing that adopting it later would not eventually cost as a migration.
- **Cons:** Smaller body of existing tutorials and answers than the 3.x line at this point in time. Requires confirming that JMolecules, ArchUnit, Lombok, and MapStruct each have releases compatible with Jakarta EE 11 / Spring Framework 7 before implementation starts — a one-time diligence item, cheapest to pay now rather than after code exists.

### Build tool

**Option A — Maven.**

- **Pros:** Declarative POM, easy to review; annotation-processor ordering (Lombok before MapStruct) is a documented, one-line configuration; Spring Boot's own documentation defaults to it.
- **Cons:** Build time grows linearly with module count and gives no cross-run cache; multi-module wiring is more ceremonious than Gradle's; provides no compile-time reinforcement of Modulith's module boundaries — a boundary violation is only caught when the verification test runs, never earlier.

**Option B — Gradle, Groovy DSL.**

- **Pros:** The traditional Gradle default; large body of examples.
- **Cons:** Untyped build scripts with no IDE-checked structure — a real regression against a stack that already commits to strict typing at every other layer (TypeScript strict mode, [ADR-0020](./ADR-0020-typescript-strict-mode.md)). Rejected for the same reason Option A's "reviewability" argument matters: an unreviewable build file is a governance gap.

**Option C — Gradle, Kotlin DSL.** *(chosen)*

- **Pros:** Type-checked, IDE-navigable build scripts — closes the reviewability gap Option B leaves open, without abandoning the reviewability concern that favours Option A. Incremental compilation and a build cache (local, and remote if CI adopts one later) mean an unchanged module is neither recompiled nor retested. The Gradle daemon removes JVM startup cost from the edit-compile-test loop. Annotation-processor order is equally explicit here: declaration order of `annotationProcessor` dependencies is deterministic and documented, so Lombok-before-MapStruct is no harder to pin than in Maven.
- **Cons:** Build logic is executable code — it can drift if treated carelessly. Addressed directly in §4's commitments rather than dismissed.

### Build structure

**Option 1 — Flat single Gradle project**, same package layout as a Maven reactor would have used.

- **Pros:** Simplest possible structure; no `settings.gradle.kts` module graph to maintain.
- **Cons:** Forfeits exactly the property that makes Option C worth choosing: a flat project recompiles and retests everything on every change, and gives no compile-time signal when one module reaches into another's internals. Chosen against.

**Option 2 — One Gradle subproject per bounded-context module (plus `shared-kernel`), all consumed by a single `app` subproject that alone applies the Spring Boot plugin and owns `bootJar`.** *(chosen)*

- **Pros:** Matches [ADR-0006](./ADR-0006-spring-modulith-module-boundaries.md)'s twelve-module-plus-kernel structure exactly — no new module boundary is invented, the Gradle subproject graph *is* the context map. A module that does not declare another as a Gradle dependency cannot import its classes at all — a compile error, not a `verify()` failure discovered at test time. This is strictly additive to Modulith's runtime/test-time check, not a replacement for it: Modulith still runs, because "a module that *is* declared as a dependency but reaches into an internal package" is exactly the case only Modulith catches. Changing one module recompiles and reruns tests for only that module and its dependents — the direct answer to ADR-0018's stated build-time risk. `app` is the only subproject producing an artifact, so [ADR-0002](./ADR-0002-modular-monolith-deployment-unit.md)'s single deployable is unchanged.
- **Cons:** A `settings.gradle.kts` module list and each subproject's `build.gradle.kts` must be kept in step as contexts are added — real but small maintenance, and self-correcting (a missing `include()` is a compile failure, not a silent gap).

**Option 3 — One Gradle subproject per bounded context, each published as a separate artifact.**

- **Cons:** This is ADR-0006's Option 2 under a different build tool, and fails for the reasons already given there: twelve artifacts to version for a system that deploys as one, and no clean way to express the Order-Placement Partnership's shared local transaction across artifact boundaries. Rejected without reopening ADR-0002.

## 4. Decision Outcome

**Chosen: Option 1 (Java 21) + Framework Option 2 (Spring Boot 4.1.1) + Build-tool Option C (Gradle, Kotlin DSL) + Build-structure Option 2 (multi-project).**

| Aspect | Commitment |
|---|---|
| Runtime | Java 21 LTS; virtual threads enabled for the servlet request path |
| Framework | Spring Boot 4.1.1 on Spring Framework 7.0.9, Jakarta EE 11 |
| Web stack | Spring MVC, not WebFlux |
| Module framework baseline | Spring Modulith 2.x — the floor Spring Boot 4.x requires |
| Records vs. Lombok | Records for Value Objects and domain events; Lombok reserved for entities and builders where a record does not fit |
| Build tool | Gradle 8.x, Kotlin DSL (`build.gradle.kts`, `settings.gradle.kts`) |
| Build structure | One subproject per bounded-context module (`identity`, `catalog`, `inventory`, `cart`, `ordering`, `payment`, `shipping`, `promotion`, `review`, `notification`, `audit`, `reporting`) plus `shared-kernel`; a single `app` subproject depends on all of them and is the only one applying `org.springframework.boot` / producing `bootJar` |
| Inter-module dependency | `implementation(project(":context-name"))` only where [ADR-0006](./ADR-0006-spring-modulith-module-boundaries.md) §5.2's relationship patterns allow it — an undeclared dependency is a compile error |
| Annotation processing | Lombok before MapStruct, pinned by declaration order of `annotationProcessor(...)` in each module's `build.gradle.kts` |
| Dependency versions | A single Gradle version catalog (`gradle/libs.versions.toml`) shared by all subprojects — one place to bump a Spring Boot, Lombok, or MapStruct version instead of twelve |
| Build performance | `org.gradle.parallel=true`, `org.gradle.caching=true`, `org.gradle.configuration-cache=true`, and the Gradle daemon enabled by default in `gradle.properties` |
| Architecture verification | [ADR-0018](./ADR-0018-architecture-governance-ci-gate.md)'s gate is unaffected: ArchUnit and `ApplicationModules.verify()` still run as build-failing tests. Gradle's module graph is a compile-time *complement*, never a substitute |

**Spring MVC over WebFlux is part of this decision.** The Order-Placement Partnership (`Domain Model.md` §5.1) commits three aggregates inside one local transaction, which is inherently thread-bound. Virtual threads deliver the concurrency benefit without asking the domain layer to become reactive.

Illustrative shape only (not a literal file to create yet — there is no `backend/` source tree in this repository today):

```nano
settings.gradle.kts
  rootProject.name = "ecp"
  include("shared-kernel", "identity", "catalog", "inventory", "cart",
          "ordering", "payment", "shipping", "promotion", "review",
          "notification", "audit", "reporting", "app")

app/build.gradle.kts        — applies org.springframework.boot; depends on all 13 others; owns bootJar
ordering/build.gradle.kts   — implementation(project(":shared-kernel"))
                               implementation(project(":inventory"))   // StockReservationPort
                               implementation(project(":promotion"))  // PromotionRedemptionPort
shared-kernel/build.gradle.kts — zero project() dependencies (ADR-0006 §4's rule, now also a build-graph fact)
```

## 5. Consequences

### Positive

- Spring Modulith, JMolecules, and ArchUnit — the whole `P15` governance story — are available and mutually compatible on this baseline.
- Records shrink the surface Lombok has to cover, narrowing the `P15` boilerplate concern rather than trading it for annotation magic.
- `NFR-SCAL-04` concurrency becomes a runtime setting rather than an architectural rewrite.
- Starting on Spring Boot 4.1.1 costs nothing today that starting on 3.x would not eventually cost as a forced migration — no backend code exists yet to migrate.
- Directly answers [ADR-0018](./ADR-0018-architecture-governance-ci-gate.md)'s named risk: unaffected modules are neither recompiled nor retested, so the Testcontainers-heavy gate grows slower only where the change actually touched something, not everywhere.
- `shared-kernel`'s "zero outbound dependencies" rule ([ADR-0006](./ADR-0006-spring-modulith-module-boundaries.md) §4) becomes a build-graph fact in `settings.gradle.kts`/`shared-kernel/build.gradle.kts`, not only an ArchUnit rule — two independent mechanisms now guard the same invariant.
- A boundary violation that Modulith would only catch when its verification test runs is, in the common case of an *undeclared* dependency, caught by the compiler at the moment the offending line is written — in the IDE, before any test runs.
- One version catalog replaces per-module version drift risk as the module count grows.

### Negative

- **Virtual threads interact badly with thread pinning.** `synchronized` blocks around I/O and some connection-pool internals pin a carrier thread; these must be audited and the pool sized deliberately rather than left at defaults.
- **Java 21 requires current tooling.** Lombok, agents, and coverage tools must be kept on supporting versions — ongoing maintenance, not a one-time cost.
- **Spring Modulith, JMolecules, ArchUnit, Lombok, and MapStruct must each be confirmed on a release compatible with Jakarta EE 11 / Spring Framework 7** before implementation starts — a one-time diligence item, not a recurring one.
- **Build logic is executable code.** Mitigated by keeping every subproject's `build.gradle.kts` to plugin application and dependency declarations only; shared configuration lives in one convention plugin, reviewed like any other source file, not scattered per module.
- **Gradle's module graph is not a substitute for Modulith.** It only catches *undeclared* dependencies; a module that legitimately depends on another but reaches past its public API into an internal package compiles fine and is still caught solely by `ApplicationModules.verify()`. The gate in ADR-0018 remains mandatory.
- **Onboarding cost.** Engineers who know only Maven have a second build tool to learn; mitigated by keeping the Kotlin DSL scripts declarative and thin per the point above.
- **The Gradle wrapper version must be pinned and committed** (`gradlew`, `gradle/wrapper/`) for reproducible builds across machines and CI.

### Neutral / follow-on

- Container base image, JVM tuning, and CI provider remain undecided; SRS §1.2 leaves deployment topology open and no record covers it.
- A remote/shared Gradle build cache is a natural follow-on once a CI provider is chosen, not decided here.
- Container image build (e.g., the Spring Boot Gradle plugin's `bootBuildImage`) is a plausible later record; out of scope here.
- This record pins **4.1.1** as the baseline at the time of decision. Routine patch upgrades (4.1.x) are ordinary maintenance and do not require a new ADR; a minor or major version change (4.2, 5.0) would.
- Records that depend on this one ([ADR-0006](./ADR-0006-spring-modulith-module-boundaries.md), [ADR-0010](./ADR-0010-jpa-write-model-jdbc-read-models.md), [ADR-0018](./ADR-0018-architecture-governance-ci-gate.md)) are settled only once this is ratified.

## 6. Related Decisions

[ADR-0002](./ADR-0002-modular-monolith-deployment-unit.md) · [ADR-0005](./ADR-0005-clean-architecture-ports-and-adapters.md) · [ADR-0006](./ADR-0006-spring-modulith-module-boundaries.md) · [ADR-0007](./ADR-0007-jmolecules-tactical-ddd.md) · [ADR-0018](./ADR-0018-architecture-governance-ci-gate.md)

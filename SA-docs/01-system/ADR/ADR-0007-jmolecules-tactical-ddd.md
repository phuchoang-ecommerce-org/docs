# ADR-0007 — Tactical DDD via JMolecules, with Context-Named Stereotype Annotations

**Document type:** Architecture Decision Record
**Status:** Accepted
**Date:** 2026-09-06
**Deciders:** Solution Architecture
**Traces to:** `P5` · `P15` · `NFR-SEC-01` · `NFR-MAINT-05` · `AC-02`
**Related documents:** [Domain Model](../../02-backend/Domain%20Model.md) · [Solution Architecture](../Solution%20Architecture.md) · [Technology Stack](../Technology%20Stack.md)

---

## 1. Context and Problem Statement

`P5` requires that business rules hold regardless of how a request enters the system. `AC-02` restates it as an acceptance criterion, and `BR-AUD-02` requires the same authorisation decision "regardless of entry point." The structural answer is that every entry point — REST, scheduled job, admin tooling, future mobile client — routes through the same domain layer, so a rule has exactly one enforcement site.

That answer only holds if the domain layer's building blocks are unambiguous in code. [`Domain Model.md`](../../02-backend/Domain%20Model.md) §7 draws the distinction that matters most and notes it is *"the one most often blurred in practice"*: anything that loads more than one aggregate instance, opens a transaction, or crosses a module's public API is **Application Service** work, while a **Domain Service** stays pure — given already-loaded objects, it returns a decision, with no repository access and no cross-module I/O.

In plain Spring, both are `@Service`. [`Technology Stack.md`](../Technology%20Stack.md) names this explicitly as a problem: *"Expand Annotation's name meeting context's demand (Avoid using only `@Service`, `@Repository` as simple WebMVC which is not flexible for review and maintain code)."* An annotation that says nothing about a class's architectural role makes the §7 rule unreviewable and unenforceable.

## 2. Decision Drivers

- `P5` / `AC-02` — one enforcement site per rule, reachable from every entry point.
- `P15` / `NFR-MAINT-05` — structural constraints caught when introduced, not discovered later.
- `Domain Model.md` §7's Domain-vs-Application Service rule needs a machine-checkable expression.
- `Technology Stack.md`'s explicit instruction to expand stereotype names.
- ArchUnit needs something to assert *about* — a rule can only target a role that is visible in the code.

## 3. Considered Options

**Option 1 — JMolecules stereotype annotations plus context-named Spring stereotypes.** *(chosen)*

- **Pros:** `@AggregateRoot`, `@Entity`, `@ValueObject`, `@DomainEvent`, `@DomainService`, `@Repository` become explicit, framework-neutral types — JMolecules' annotations carry no Spring dependency, so they may sit in the domain layer without violating [ADR-0005](./ADR-0005-clean-architecture-ports-and-adapters.md). ArchUnit and Modulith can both assert against them. Naming the Spring stereotype for its role (`@ApplicationService`, `@PersistenceAdapter`) satisfies `Technology Stack.md` and makes a misplaced class visible at the import line.
- **Cons:** Two annotation vocabularies to learn. Custom meta-annotations are project-specific, so a newcomer cannot rely on Spring knowledge alone. JMolecules is a comparatively small-community dependency.

**Option 2 — Plain Spring stereotypes (`@Service`, `@Repository`, `@Component`).**

- **Pros:** Zero learning curve; no extra dependency; idiomatic Spring.
- **Cons:** Exactly what `Technology Stack.md` rules out. A Domain Service and an Application Service are indistinguishable, so `Domain Model.md` §7's central rule cannot be enforced and degrades to convention — which is the `P15` failure mode. `@Repository` in the domain layer also drags a Spring dependency where `NFR-MAINT-03` says none belongs.

**Option 3 — Naming and package conventions only (`*DomainService`, `domain.service` package).**

- **Pros:** No dependency at all; ArchUnit can assert on name and package patterns.
- **Cons:** A class in the right package with the right suffix can still hold a repository reference. The convention describes where a class sits, not what it is allowed to do, so the rule stays partly unenforceable. Renaming silently disables a rule.

**Option 4 — JMolecules with its ByteBuddy/AspectJ integration, generating persistence mappings from stereotypes.**

- **Pros:** Removes hand-written JPA mapping; the domain model stays completely annotation-free of persistence concerns.
- **Cons:** Build-time bytecode manipulation is exactly the tooling class flagged as risky on Java 21 in [ADR-0027](./ADR-0027-java-21-spring-boot-4-gradle.md). It also hides the persistence mapping, which [ADR-0010](./ADR-0010-jpa-write-model-jdbc-read-models.md) deliberately makes explicit. Adopt the annotations, not the code generation.

## 4. Decision Outcome

**Chosen: Option 1.** JMolecules annotations express DDD building blocks; context-named Spring meta-annotations express architectural role.

**Domain layer — JMolecules only, no Spring:**

| Annotation | Applied to | Rule it makes checkable |
|---|---|---|
| `@AggregateRoot` | `Order`, `StockItem`, `Cart`, `Product`, `Promotion`, `Payment`, `Shipment`, `Account` | Only an aggregate root may be referenced from outside its aggregate; one repository per root, never per entity |
| `@Entity` | `StockReservation`, `CartLine`, `OrderLine` | Reachable only through its root |
| `@ValueObject` | `Money`, `Quantity`, `ReservationStatus`, `Address`, typed IDs | Immutable; no identity |
| `@DomainEvent` | `OrderPaid`, `StockReserved`, `PaymentCaptured`, … | Past-tense name; immutable |
| `@DomainService` | `PromotionStackingPolicy` and peers | **No repository field, no port field, no transaction** — the `Domain Model.md` §7 rule, as an ArchUnit assertion |
| `@Repository` (JMolecules) | one per aggregate root | Interface declared in the domain layer, implemented in infrastructure |

**Application and infrastructure layers — context-named Spring meta-annotations:**

| Annotation | Meta-annotated with | Means |
|---|---|---|
| `@ApplicationService` | `@Service`, `@Transactional` | Orchestrates a use case; owns the transaction boundary; may load multiple aggregates and call ports |
| `@PersistenceAdapter` | `@Component` | Implements a domain repository interface |
| `@ProviderAdapter` | `@Component` | Implements an outbound port to an external provider |
| `@EventHandler` | `@Component` | Consumes a domain or Kafka event |
| `@QueryService` | `@Service`, `@Transactional(readOnly = true)` | Serves the read side ([ADR-0008](./ADR-0008-cqrs-command-query-separation.md)); never mutates |

The pairing is what makes `P5` structural rather than aspirational: `@DomainService` classes are asserted to hold no repository and open no transaction, `@ApplicationService` classes are the only transaction owners, and `@QueryService` classes are read-only. A rule enforced inside an `@AggregateRoot` cannot be bypassed by a new controller, because no controller can open a transaction or reach an aggregate except through an `@ApplicationService`.

**Authorisation sits in the application layer, never the domain layer** — `Domain Model.md` §5.2 specifies Identity & Access's `AuthorizationService` as a synchronous in-process call from every other context's *application* layer. This is what makes `BR-AUD-02` and `NFR-SEC-01` hold by construction.

## 5. Consequences

### Positive

- `Domain Model.md` §7's Domain-vs-Application Service rule stops being advice and becomes a failing build.
- The domain layer carries no Spring types, so [ADR-0005](./ADR-0005-clean-architecture-ports-and-adapters.md)'s dependency test is meaningful rather than decorative.
- A reviewer can tell a class's architectural role from its annotation, which is precisely the reviewability `Technology Stack.md` asks for.

### Negative

- **Project-specific vocabulary.** A developer fluent in Spring must still learn five custom stereotypes; the meta-annotations must be documented where they are declared, or they become folklore.
- **Two annotation systems on adjacent layers** invites mixing — a JMolecules `@Repository` interface next to a Spring-derived `@PersistenceAdapter` implementation is correct but reads as duplication to a newcomer.
- **JMolecules is a smaller-community dependency** than the rest of the stack. It is used only for annotations here, not for code generation, which bounds the exposure to a supply-chain and upgrade concern rather than a functional one.

### Neutral / follow-on

- The `@QueryService` read-only boundary is assumed by [ADR-0008](./ADR-0008-cqrs-command-query-separation.md) and [ADR-0010](./ADR-0010-jpa-write-model-jdbc-read-models.md).
- Global cross-aggregate constraints (`BR-CAT-01` SKU uniqueness, `BR-CUS-01` email uniqueness, `BR-REV-02`, `BR-AUD-03`) are **not** aggregate invariants; per `Domain Model.md` §7 their enforcement point is a database constraint, with any domain-service pre-check existing only for fast feedback.

## 6. Related Decisions

[ADR-0005](./ADR-0005-clean-architecture-ports-and-adapters.md) · [ADR-0006](./ADR-0006-spring-modulith-module-boundaries.md) · [ADR-0011](./ADR-0011-optimistic-locking-reservation-model.md) · [ADR-0016](./ADR-0016-jwt-refresh-rotation-rbac.md) · [ADR-0018](./ADR-0018-architecture-governance-ci-gate.md)

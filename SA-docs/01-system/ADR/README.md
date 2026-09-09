# Architecture Decision Records — Enterprise Commerce Platform (ECP)

**Document type:** Index
**Audience:** Engineering, Architecture Review
**Related documents:** [Solution Architecture](../Solution%20Architecture.md) · [Technology Stack](../Technology%20Stack.md) · [Domain Model](../../02-backend/Domain%20Model.md) · [Frontend Architecture](../../03-frontend/Frontend%20Architecture.md) · [UI Design System](../../03-frontend/UI%20Design%20System.md)

---

## 1. What This Folder Is

[`Solution Architecture.md`](../Solution%20Architecture.md) §5 records *what* was decided for each business problem `P1`–`P17`. This folder records *why that decision and not another one* — the alternatives weighed, the trade-offs accepted, and the status of each choice.

Each record follows the MADR shape established in [ADR-0001](./ADR-0001-record-architecture-decisions.md): Context and Problem Statement · Decision Drivers · Considered Options (with pros and cons) · Decision Outcome · Consequences · Related Decisions.

`Solution Architecture.md` remains authoritative for the narrative. These records elaborate it; they do not replace it.

---

## 2. Status

| Status | Meaning |
|---|---|
| `Accepted` | In force. |
| `Proposed` | Made here for the first time, awaiting ratification in architecture review. |
| `Superseded by ADR-NNNN` | Replaced by a later record. The original file is never deleted or rewritten. |

**Exception:** `ADR-0004` ("Java 21 (LTS) on Spring Boot 3.x, built with Maven") was deleted outright rather than superseded — it was never committed to version control, so no external reader ever depended on it existing. Its number is retired and not reused; its still-relevant content (Java 21, Spring MVC over WebFlux) and its still-relevant risks (virtual-thread pinning, tooling currency) were carried forward into [ADR-0027](./ADR-0027-java-21-spring-boot-4-gradle.md), which now also covers the framework version and build tool it originally decided. Once a record has been committed, this exception no longer applies — supersession, not deletion, is the rule from that point on.

**`Accepted` versus `Proposed` is assigned by rule, not by preference.** A record is `Accepted` when the outcome it states is already recorded in [`Solution Architecture.md`](../Solution%20Architecture.md), [`Domain Model.md`](../../02-backend/Domain%20Model.md), or [`Technology Stack.md`](../Technology%20Stack.md) — the record reconstructs the context and the alternatives, it does not invent the outcome. It is `Proposed` when the decision exists nowhere else in the repository and this record is the first place it is made.

A `Proposed` record is never quietly promoted. Promotion is its own commit.

---

## 3. The Records

Each record's `**Traces to:**` header carries its full list of business problems, requirements, and rules. That list is not repeated here: an index copy is an abridgement, and an abridgement of a traceability list is worse than no copy, because it reads as complete. For coverage across the whole requirement set, see [`BA-docs/traceability-matrix.md`](../../../BA-docs/traceability-matrix.md).

### Cross-cutting

| # | Decision | Status |
|---|---|---|
| [0001](./ADR-0001-record-architecture-decisions.md) | Record architecture decisions in ADRs | Accepted |
| [0002](./ADR-0002-modular-monolith-deployment-unit.md) | Modular monolith as the deployment unit | Accepted |
| [0003](./ADR-0003-rest-api-style.md) | REST as the client-facing API style | Accepted · versioning **Proposed** · §4 `Contract` row superseded by `ADR-0031` |
| [0028](./ADR-0028-deployment-topology-containerisation.md) | Docker Compose on two VMs as the deployment topology | **Proposed** |
| [0031](./ADR-0031-contract-first-openapi.md) | Contract-first OpenAPI, verified rather than generated | **Proposed** |

### Backend

| # | Decision | Status |
|---|---|---|
| [0005](./ADR-0005-clean-architecture-ports-and-adapters.md) | Clean Architecture: ports, adapters, framework-free domain | Accepted |
| [0006](./ADR-0006-spring-modulith-module-boundaries.md) | Spring Modulith: one module per bounded context, plus `shared-kernel` | Accepted |
| [0007](./ADR-0007-jmolecules-tactical-ddd.md) | Tactical DDD via JMolecules, context-named stereotypes | Accepted |
| [0008](./ADR-0008-cqrs-command-query-separation.md) | CQRS: separate the command and query paths | Accepted |
| [0009](./ADR-0009-postgresql-source-of-truth.md) | PostgreSQL as the single transactional source of truth | Accepted |
| [0010](./ADR-0010-jpa-write-model-jdbc-read-models.md) | Spring Data JPA for the write model, JDBC for read models | Accepted |
| [0011](./ADR-0011-optimistic-locking-reservation-model.md) | Optimistic locking and an explicit reservation model | Accepted |
| [0012](./ADR-0012-transactional-outbox-and-kafka.md) | Transactional Outbox with Kafka; in-process events by default | Accepted |
| [0013](./ADR-0013-mongodb-scoped-to-read-models.md) | MongoDB scoped to flexible read models only | Accepted |
| [0014](./ADR-0014-elasticsearch-search-read-model.md) | Elasticsearch as the event-fed search read model | Accepted |
| [0015](./ADR-0015-redis-cache-and-rate-limiting.md) | Redis for cache-aside, hot data, rate limiting, flash-sale pre-filter | Accepted |
| [0016](./ADR-0016-jwt-refresh-rotation-rbac.md) | JWT access tokens, rotating refresh tokens, RBAC at the boundary | Accepted |
| [0017](./ADR-0017-append-only-audit-log.md) | Append-only audit log projected from domain events | Accepted |
| [0018](./ADR-0018-architecture-governance-ci-gate.md) | Architecture governance as a CI gate; test strategy | Accepted · test stack **Proposed** · §4.1 CQRS rules **Proposed** |
| [0027](./ADR-0027-java-21-spring-boot-4-gradle.md) | Java 21 (LTS) on Spring Boot 4.1.1, built with Gradle (multi-module) | **Proposed** |
| [0029](./ADR-0029-flyway-versioned-schema-migrations.md) | Flyway for versioned schema migrations; Hibernate restricted to `validate` | Accepted (Flyway) · rules **Proposed** |
| [0030](./ADR-0030-spring-data-mongodb-read-model-access.md) | Spring Data MongoDB as the read-model access technology | **Proposed** |
| [0032](./ADR-0032-json-event-serialisation-and-schema-contract.md) | JSON event serialisation with a repository-held schema contract; no schema registry | **Proposed** |
| [0033](./ADR-0033-polling-outbox-relay.md) | A polling outbox relay over per-module outbox tables, not Spring Modulith externalisation | **Proposed** |
| [0034](./ADR-0034-redis-two-instance-topology.md) | Two Redis instances: an evictable cache and a non-evictable state store | **Proposed** |

### Frontend

| # | Decision | Status |
|---|---|---|
| [0019](./ADR-0019-nextjs-app-router-rendering-strategy.md) | Next.js App Router, RSC, rendering strategy per route class | Accepted (Next.js) · **Proposed** (App Router, RSC, route classification) |
| [0020](./ADR-0020-typescript-strict-mode.md) | TypeScript strict mode, API types generated from OpenAPI | **Proposed** |
| [0021](./ADR-0021-tailwind-shadcn-radix-styling-system.md) | Tailwind + shadcn/ui on Radix as the single styling system | Accepted |
| [0022](./ADR-0022-ma-design-tokens.md) | The Ma design system expressed as tokens | Accepted |
| [0023](./ADR-0023-server-first-data-fetching.md) | Server-first data fetching; client cache only where the browser owns state | **Proposed** |
| [0024](./ADR-0024-frontend-state-management.md) | State management: server cache, URL state, minimal client store | **Proposed** |
| [0025](./ADR-0025-httponly-cookie-session.md) | Browser session in an httpOnly cookie, never `localStorage` | **Proposed** |
| [0026](./ADR-0026-motion-and-accessibility-baseline.md) | Motion vocabulary and the WCAG AA accessibility baseline | Accepted |
| [0035](./ADR-0035-feature-sliced-frontend-structure.md) | Feature-sliced structure with lint-enforced import boundaries | **Proposed** |
| [0036](./ADR-0036-nextjs-server-sole-api-caller.md) | The Next.js server as the sole API caller; no BFF tier | **Proposed** |
| [0037](./ADR-0037-url-search-param-encoding-contract.md) | The URL search-param encoding as a stability contract | **Proposed** |
| [0038](./ADR-0038-event-driven-catalog-revalidation.md) | Event-driven tag revalidation for static catalog routes | **Proposed** |
| [0039](./ADR-0039-frontend-performance-budgets-ci-gate.md) | Per-route-class performance budgets as a build-failing CI gate | **Proposed** |

---

## 4. Reading Order

```nano
0001                     why these records exist, and how to read them
  ↓
0002 · 0003              the two decisions everything else assumes:
                         one deployable, one REST API
  ↓
0028                     where that one deployable physically runs
  ↓
0027, 0005 → 0018,       backend — runtime, structure, data, events, security, governance
0029 → 0030,
0032 → 0034              backend — the event backbone's wire format, relay, and cache topology
0019 → 0026              frontend — rendering, language, design system, data, session, motion
0035 → 0039              frontend — structure, API access, URL state, revalidation, budgets
```

`0027` is out of numeric order with its siblings: it is the backend's runtime/framework/build record and belongs first in the reading order, but was written after the frontend records because it supersedes and absorbs what was originally ADR-0004 (deleted; see §2).

`0032`–`0034` come last for the same kind of reason as `0027` comes first: they are the operational half of decisions `0012` and `0015` already made, and they only make sense after those. Each discharges a deferral that [`Backend Architecture.md`](../../02-backend/Backend%20Architecture.md) collects.

`0035`–`0039` are the frontend's equivalent, and they read the same way: `0019`–`0026` decided the frontend's shape and each of them deferred its follow-on questions to a `03-frontend/` file that did not exist. These five are what those questions turned into once the file was written — structure, API access, URL state, revalidation, and budgets. [`Frontend Architecture.md`](../../03-frontend/Frontend%20Architecture.md) §1 is the index to the six documents they sit beneath.

Two records carry more weight than the rest and are worth reading first if time is short: [ADR-0011](./ADR-0011-optimistic-locking-reservation-model.md), which is how the platform avoids selling stock it does not have, and [ADR-0018](./ADR-0018-architecture-governance-ci-gate.md), without which the "modular" in modular monolith is only a claim.

---

## 5. Adding a Record

1. Take the next number in the sequence — currently **`ADR-0040`**. Numbers are never reused, including for superseded records.
2. Name the file `ADR-00NN-<kebab-case-title>.md`.
3. Copy the structure from any existing record: metadata block, then the six numbered sections. The metadata block is `**Status:**`, `**Date:**`, and `**Traces to:**` only — every record in this folder is an Architecture Decision Record decided by Solution Architecture, so neither fact is repeated per file, and the documents a record relates to are reached through its inline links and its §6.
4. Give `Considered Options` at least one option that was genuinely rejected, with real trade-offs. If there isn't one, the decision probably didn't need a record.
5. Fill `Consequences` honestly — the negative section is the part a future reader will need.
6. Add a row to the table above.

To supersede a record, write the new one, then set the old record's status to `Superseded by ADR-00NN` and leave its content untouched.

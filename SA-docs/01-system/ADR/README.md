# Architecture Decision Records — Enterprise Commerce Platform (ECP)

**Document type:** Index
**Audience:** Engineering, Architecture Review
**Related documents:** [Solution Architecture](../Solution%20Architecture.md) · [Technology Stack](../Technology%20Stack.md) · [Domain Model](../../02-backend/Domain%20Model.md) · [Frontend Architecture](../../03-frontend/Frontend%20Architecture.md) · [UI Design System](../../03-frontend/UI%20Design%20System.md)

## 1. Scope

[`Solution Architecture.md`](../Solution%20Architecture.md) §5 records the decisions for `P1`–`P17`. These ADRs record status, context, rejected options, outcome, and consequences. `Solution Architecture.md` remains authoritative.

## 2. Status

| Status | Meaning |
|---|---|
| `Accepted` | In force. |
| `Proposed` | Made here for the first time, awaiting ratification in architecture review. |
| `Superseded by ADR-NNNN` | Replaced by a later record. The original file is never deleted or rewritten. |

`ADR-0004` was never committed. Its number is retired, and [ADR-0027](./ADR-0027-java-21-spring-boot-4-gradle.md) carries its remaining decisions and risks. Committed ADRs are superseded, never deleted or rewritten.

An ADR is `Accepted` when its outcome already exists in [`Solution Architecture.md`](../Solution%20Architecture.md), [`Domain Model.md`](../../02-backend/Domain%20Model.md), or [`Technology Stack.md`](../Technology%20Stack.md). It is `Proposed` when it introduces the decision. Promotion requires its own commit.

## 3. Records

Each ADR contains its full `Traces to` list. Use the [traceability matrix](../../../BA-docs/traceability-matrix.md) for requirement coverage.

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

## 4. Reading order

Read `0001`, then `0002`, `0003`, and `0028`. For backend work, read `0027`, `0005`–`0018`, `0029`–`0030`, and `0032`–`0034`. For frontend work, read `0019`–`0026` and `0035`–`0039`. Start with [ADR-0011](./ADR-0011-optimistic-locking-reservation-model.md) and [ADR-0018](./ADR-0018-architecture-governance-ci-gate.md) when time is limited.

## 5. Add a record

1. Use the next number, currently `ADR-0040`. Never reuse a number.
2. Name the file `ADR-00NN-<kebab-case-title>.md`.
3. Copy an existing record. Keep only `Status`, `Date`, and `Traces to` in the metadata block.
4. Include at least one rejected option with its real trade-offs.
5. Record negative consequences.
6. Add a row to the table above.

To supersede a record, add the new ADR, set the old status to `Superseded by ADR-00NN`, and leave the old content unchanged.

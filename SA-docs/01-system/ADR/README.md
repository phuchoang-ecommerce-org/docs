# Architecture Decision Records — Enterprise Commerce Platform (ECP)

**Document type:** Index
**Audience:** Engineering, Architecture Review
**Related documents:** [Solution Architecture](../Solution%20Architecture.md) · [Technology Stack](../Technology%20Stack.md) · [Domain Model](../../02-backend/Domain%20Model.md) · [UI Design System](../../03-frontend/UI%20Design%20System.md)

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

### Cross-cutting

| # | Decision | Status | Traces to |
|---|---|---|---|
| [0001](./ADR-0001-record-architecture-decisions.md) | Record architecture decisions in ADRs | Accepted | `NFR-MAINT-05` · `AC-04` |
| [0002](./ADR-0002-modular-monolith-deployment-unit.md) | Modular monolith as the deployment unit | Accepted | `P1` · `P14` · `CON-08` · `CON-09` |
| [0003](./ADR-0003-rest-api-style.md) | REST as the client-facing API style | Accepted · versioning **Proposed** · §4 `Contract` row superseded by `ADR-0031` | `P3` · `P5` · `NFR-SEC-01` · `NFR-REL-02` |
| [0028](./ADR-0028-deployment-topology-containerisation.md) | Docker Compose on two VMs as the deployment topology | **Proposed** | `CON-08` · `CON-09` · `NFR-AVAIL-01` · `NFR-SCAL-06` |
| [0031](./ADR-0031-contract-first-openapi.md) | Contract-first OpenAPI, verified rather than generated | **Proposed** | `P5` · `P15` · `CON-02` · `NFR-SEC-01` |

### Backend

| # | Decision | Status | Traces to |
|---|---|---|---|
| [0005](./ADR-0005-clean-architecture-ports-and-adapters.md) | Clean Architecture: ports, adapters, framework-free domain | Accepted | `P3` · `CON-03` · `NFR-MAINT-03` |
| [0006](./ADR-0006-spring-modulith-module-boundaries.md) | Spring Modulith: one module per bounded context, plus `shared-kernel` | Accepted | `P1` · `P14` · `CON-01` · `NFR-MAINT-06` |
| [0007](./ADR-0007-jmolecules-tactical-ddd.md) | Tactical DDD via JMolecules, context-named stereotypes | Accepted | `P5` · `P15` · `AC-02` |
| [0008](./ADR-0008-cqrs-command-query-separation.md) | CQRS: separate the command and query paths | Accepted | `P12` · `P13` · `CON-04` · `CON-06` |
| [0009](./ADR-0009-postgresql-source-of-truth.md) | PostgreSQL as the single transactional source of truth | Accepted | `P4` · `P7` · `NFR-REL-01` · `BR-ORD-02` |
| [0010](./ADR-0010-jpa-write-model-jdbc-read-models.md) | Spring Data JPA for the write model, JDBC for read models | Accepted | `P12` · `NFR-REL-03` · `NFR-PERF-01` |
| [0011](./ADR-0011-optimistic-locking-reservation-model.md) | Optimistic locking and an explicit reservation model | Accepted | `P8` · `BR-INV-01` · `BR-INV-02` · `NFR-REL-03` |
| [0012](./ADR-0012-transactional-outbox-and-kafka.md) | Transactional Outbox with Kafka; in-process events by default | Accepted | `P2` · `P6` · `CON-07` · `NFR-REL-05` · `NFR-REL-06` |
| [0013](./ADR-0013-mongodb-scoped-to-read-models.md) | MongoDB scoped to flexible read models only | Accepted | `P4` (scoped) · `P13` · `CON-06` |
| [0014](./ADR-0014-elasticsearch-search-read-model.md) | Elasticsearch as the event-fed search read model | Accepted | `P11` · `NFR-PERF-03` · `NFR-PERF-04` |
| [0015](./ADR-0015-redis-cache-and-rate-limiting.md) | Redis for cache-aside, hot data, rate limiting, flash-sale pre-filter | Accepted | `P9` · `CON-05` · `NFR-SCAL-06` · `NFR-SEC-05` |
| [0016](./ADR-0016-jwt-refresh-rotation-rbac.md) | JWT access tokens, rotating refresh tokens, RBAC at the boundary | Accepted | `P16` · `NFR-SEC-01` · `NFR-SEC-03` · `BR-CUS-03` |
| [0017](./ADR-0017-append-only-audit-log.md) | Append-only audit log projected from domain events | Accepted | `P17` · `BR-AUD-01` · `NFR-OBS-02` |
| [0018](./ADR-0018-architecture-governance-ci-gate.md) | Architecture governance as a CI gate; test strategy | Accepted · test stack **Proposed** · §4.1 CQRS rules **Proposed** | `P15` · `NFR-MAINT-05` · `AC-04` |
| [0027](./ADR-0027-java-21-spring-boot-4-gradle.md) | Java 21 (LTS) on Spring Boot 4.1.1, built with Gradle (multi-module) | **Proposed** | `P15` · `NFR-SCAL-04` · `NFR-MAINT-05` |
| [0029](./ADR-0029-flyway-versioned-schema-migrations.md) | Flyway for versioned schema migrations; Hibernate restricted to `validate` | Accepted (Flyway) · rules **Proposed** | `P15` · `NFR-MAINT-05` · `NFR-REL-01` · `NFR-OBS-02` |
| [0030](./ADR-0030-spring-data-mongodb-read-model-access.md) | Spring Data MongoDB as the read-model access technology | **Proposed** | `P13` · `CON-06` · `NFR-PERF-05` · `NFR-PERF-06` |
| [0032](./ADR-0032-json-event-serialisation-and-schema-contract.md) | JSON event serialisation with a repository-held schema contract; no schema registry | **Proposed** | `P2` · `P6` · `P15` · `NFR-REL-06` · `NFR-SEC-07` · `AC-03` |
| [0033](./ADR-0033-polling-outbox-relay.md) | A polling outbox relay over per-module outbox tables, not Spring Modulith externalisation | **Proposed** | `P2` · `P6` · `P10` · `NFR-REL-05` · `NFR-REL-06` · `NFR-OBS-04` |
| [0034](./ADR-0034-redis-two-instance-topology.md) | Two Redis instances: an evictable cache and a non-evictable state store | **Proposed** | `P8` · `P9` · `NFR-SCAL-06` · `NFR-SEC-05` · `NFR-AVAIL-01` |

### Frontend

| # | Decision | Status | Traces to |
|---|---|---|---|
| [0019](./ADR-0019-nextjs-app-router-rendering-strategy.md) | Next.js App Router, RSC, rendering strategy per route class | Accepted (Next.js) · **Proposed** (the rest) | `P11` · `NFR-PERF-01` · `NFR-AVAIL-02` |
| [0020](./ADR-0020-typescript-strict-mode.md) | TypeScript strict mode, API types generated from OpenAPI | **Proposed** | `P15` · `CON-02` |
| [0021](./ADR-0021-tailwind-shadcn-radix-styling-system.md) | Tailwind + shadcn/ui on Radix as the single styling system | Accepted | UI Design System §5, §10, §14 |
| [0022](./ADR-0022-ma-design-tokens.md) | The Ma design system expressed as tokens | Accepted | UI Design System §2–§14 |
| [0023](./ADR-0023-server-first-data-fetching.md) | Server-first data fetching; client cache only where the browser owns state | **Proposed** | `NFR-PERF-01` · `NFR-AVAIL-02` · `NFR-PERF-06` |
| [0024](./ADR-0024-frontend-state-management.md) | State management: server cache, URL state, minimal client store | **Proposed** | `CON-02` · `P11` · `NFR-SEC-01` |
| [0025](./ADR-0025-httponly-cookie-session.md) | Browser session in an httpOnly cookie, never `localStorage` | **Proposed** | `P16` · `NFR-SEC-03` · `BR-CUS-03` |
| [0026](./ADR-0026-motion-and-accessibility-baseline.md) | Motion vocabulary and the WCAG AA accessibility baseline | Accepted | UI Design System §8, §13, §14 |

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
```

`0027` is out of numeric order with its siblings: it is the backend's runtime/framework/build record and belongs first in the reading order, but was written after the frontend records because it supersedes and absorbs what was originally ADR-0004 (deleted; see §2).

`0032`–`0034` come last for the same kind of reason as `0027` comes first: they are the operational half of decisions `0012` and `0015` already made, and they only make sense after those. Each discharges a deferral that [`Backend Architecture.md`](../../02-backend/Backend%20Architecture.md) collects.

Two records carry more weight than the rest and are worth reading first if time is short: [ADR-0011](./ADR-0011-optimistic-locking-reservation-model.md), which is how the platform avoids selling stock it does not have, and [ADR-0018](./ADR-0018-architecture-governance-ci-gate.md), without which the "modular" in modular monolith is only a claim.

---

## 5. Adding a Record

1. Take the next number in the sequence — currently **`ADR-0035`**. Numbers are never reused, including for superseded records.
2. Name the file `ADR-00NN-<kebab-case-title>.md`.
3. Copy the structure from any existing record: metadata block, then the six numbered sections.
4. Give `Considered Options` at least one option that was genuinely rejected, with real trade-offs. If there isn't one, the decision probably didn't need a record.
5. Fill `Consequences` honestly — the negative section is the part a future reader will need.
6. Add a row to the table above.

To supersede a record, write the new one, then set the old record's status to `Superseded by ADR-00NN` and leave its content untouched.

Markdown is the source; HTML is generated by `node util/toHtml.js` from the repository root and is not committed.

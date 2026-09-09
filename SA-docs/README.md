# Solution Architecture — Enterprise Commerce Platform (ECP)

**Document type:** Index
**Audience:** Engineering, Architecture Review, Product Management

This folder holds the solution architecture for the Enterprise Commerce Platform: the technical decisions and technology choices that implement what [Business Analysis](../BA-docs/README.md) specifies.

---

## 1. The Documents

| Folder | Document | What it covers |
|---|---|---|
| [`01-system/`](./01-system) | [`Solution Architecture.md`](./01-system/Solution%20Architecture.md) | Business problem (`P1`–`P17`) → architecture decision → technology mapping; system context (actors, external interfaces); quality attribute targets; extensibility roadmap; acceptance criteria traceability |
| [`01-system/`](./01-system) | [`Technology Stack.md`](./01-system/Technology%20Stack.md) | Backend/frontend technology shortlist |
| [`01-system/`](./01-system) | [`Deployment Diagram.md`](./01-system/Deployment%20Diagram.md) | Physical topology — nodes, containers, networks, ports, volumes; which quality targets the topology meets and which it does not; local development topology; operational concerns |
| [`01-system/`](./01-system) | [`Security.md`](./01-system/Security.md) | The consolidated security specification — trust boundaries and attack surface, identity and session, the authorisation model, input validation, rate limiting, data classification and protection, provider callback authenticity, audit and security events, the verification matrix, threat model, and residual risk |
| [`01-system/`](./01-system) | [`Testing and Benchmark Strategy.md`](./01-system/Testing%20and%20Benchmark%20Strategy.md) | The test strategy — the seven test layers, the fast/slow suite split, test data rules, the contract-test shape, the frontend suite, the smoke benchmark against `NFR-PERF-*`, CI stages, and coverage policy |
| [`01-system/ADR/`](./01-system/ADR) | [`README.md`](./01-system/ADR/README.md) | Architecture Decision Records — index, status rules, and how to add one |
| [`01-system/ADR/`](./01-system/ADR) | `ADR-0001`–`ADR-0003`, `ADR-0005`–`ADR-0034` | One record per decision: context, alternatives considered, outcome, consequences — 5 cross-cutting, 20 backend, 8 frontend. `ADR-0004` is retired, not reused ([why](./01-system/ADR/README.md)) |
| [`02-backend/`](./02-backend) | [`Backend Architecture.md`](./02-backend/Backend%20Architecture.md) | The runtime and the event backbone — the outbox relay, the event wire form and schema contract, consumer groups, retry and dead-lettering, the normative Kafka topic catalogue, the two Redis instances, the request pipeline, and the observability signals |
| [`02-backend/`](./02-backend) | [`Domain Model.md`](./02-backend/Domain%20Model.md) | Domain-Driven Design — strategic & tactical design: subdomain classification, bounded contexts, context map, aggregates, entities, value objects, domain events |
| [`02-backend/`](./02-backend) | [`Module Dependency Diagram.md`](./02-backend/Module%20Dependency%20Diagram.md) | The module graph the build verifies — compile-time dependencies, runtime event flow, layer rules, forbidden edges, extraction readiness |
| [`02-backend/`](./02-backend) | [`CQRS.md`](./02-backend/CQRS.md) | The command and query model — the command and query contracts, the read-model catalogue, projection idempotency and ordering guards, the rebuild procedure, read-your-writes, and lag budgets |
| [`02-backend/Sequence/`](./02-backend/Sequence) | [`README.md`](./02-backend/Sequence/README.md) | Sequence diagrams — index, the normative participant vocabulary and arrow conventions, and what the diagrams deliberately do not claim |
| [`02-backend/Sequence/`](./02-backend/Sequence) | `00-Overview.md`, `01-Ordering.md` … `07-Supporting.md` | Fifty-six Mermaid sequence diagrams across all fourteen domains — the request pipeline and event backbone drawn once, then a layered diagram per significant use case, plus the failures that decide `P6`, `P7`, and `P8` |
| [`02-backend/`](./02-backend) | [`Database.md`](./02-backend/Database.md) | Data model and physical schema — conventions, per-context ER diagrams and PostgreSQL DDL, indexes and constraints, outbox tables, concurrency, the Elasticsearch/MongoDB/Redis read stores, and the Flyway migration map |
| [`03-frontend/`](./03-frontend) | [`Frontend Architecture.md`](./03-frontend/Frontend%20Architecture.md) | Frontend architecture plan *(stub)* |
| [`03-frontend/`](./03-frontend) | [`UI Design System.md`](./03-frontend/UI%20Design%20System.md) | *Ma (間)*-inspired UI design specification — philosophy, layout and spacing scale, typography, palette, components, motion, accessibility baseline, validation checklist |
| [`04-shared/`](./04-shared) | [`Integration Contract.md`](./04-shared/Integration%20Contract.md) | Everything that crosses a boundary — REST conventions, pagination, error taxonomy, event envelope and catalogue, schema evolution, permission matrix |
| [`04-shared/OpenAPI/`](./04-shared/OpenAPI) | [`README.md`](./04-shared/OpenAPI/README.md) + `openapi.yaml` | The OpenAPI 3.1 contract — 121 paths, 155 operations across all fourteen domains, every one traced to its use case and its permission-matrix cell. Hand-authored and normative per [`ADR-0031`](./01-system/ADR/ADR-0031-contract-first-openapi.md); verified against the controller layer in CI once one exists |
| [`04-shared/`](./04-shared) | [`Error Codes.md`](./04-shared/Error%20Codes.md) | The error-code registry `ADR-0003` §5 reserved and `Integration Contract.md` §4.4 seeded — every `ECP-<DOMAIN>-<NNNN>` code in force, what it enforces, and the two places the codebase has already drifted from the scheme. Hand-authored until the domain enums exist, per `Backend Architecture.md` §6.3 |
| [`04-shared/`](./04-shared) | [`Permission Matrix.md`](./04-shared/Permission%20Matrix.md) | The per-operation realisation of SRS §2.3 `ADR-0016` §4 named as its destination — all 155 OpenAPI operations mapped to the roles that may call them, the ownership scope, and the reconciliation walk against the domain-level grid, including the one open Business Analysis disagreement it cannot resolve by itself |

<a id="folder-layout"></a>

### 1.1 Folder Layout

Folders are organized by concern: `01-system/` for whole-system decisions, `02-backend/` and
`03-frontend/` for the two implementations, `04-shared/` for everything that crosses a boundary.
A folder with no content yet is omitted rather than checked in empty, so the tree shows what exists rather than what was planned.

Two rules here are cited from elsewhere in this repository and are normative:

- **`04-shared/` holds API and contract artifacts only** — OpenAPI, DTOs, event contracts, the
permission matrix, the error-code registry. It is not a home for domain code; a shared kernel belongs in its own module beneath the backend source tree.
- **Reserved, not yet created:** `04-shared/Event Contract/` (created by the change that
  implements [`Backend Architecture.md`](./02-backend/Backend%20Architecture.md) §3.5) and
  `00-vision/`. Previously reserved and since filled: `04-shared/OpenAPI/` by
[`ADR-0031`](./01-system/ADR/ADR-0031-contract-first-openapi.md), `02-backend/Sequence/` by the sequence diagrams, `01-system/ADR/` by the decision records, and
  `01-system/Deployment Diagram.md` by [`ADR-0028`](./01-system/ADR/ADR-0028-deployment-topology-containerisation.md).

---

## 2. Reading Order

```nano
../BA-docs/                          what the business needs and why  (P1–P17, FR/NFR/BR)
      ↓
01-system/Solution Architecture.md   which architecture decision answers each problem, and why
01-system/Technology Stack.md        the technology shortlist that decision draws from
01-system/ADR/                       why that decision and not another one  (ADR-0001–ADR-0034)
      ↓
02-backend/                          how the backend implements it
02-backend/Backend Architecture.md   the runtime those decisions run in -- the event backbone, Kafka, Redis
02-backend/CQRS.md                   the command/query split those decisions produce -- read models, projections, rebuild
02-backend/Database.md               the tables, constraints, and indexes those decisions produce
02-backend/Sequence/                 how those pieces behave over time -- one request, message by message
03-frontend/                         how the frontend implements it
      ↓
01-system/Deployment Diagram.md      where it physically runs
01-system/Security.md                the trust boundaries that topology draws, and what guards each one
04-shared/Integration Contract.md    the rules every boundary crossing obeys
04-shared/OpenAPI/                   the endpoints written under those rules
04-shared/Error Codes.md             every code those endpoints return, and what it enforces
04-shared/Permission Matrix.md       every operation's roles, expanded from the domain-level grid
      ↓
01-system/Testing and Benchmark Strategy.md   how every claim above is verified, and what is not yet verified
```

[`Solution Architecture.md`](./01-system/Solution%20Architecture.md) is the companion to [Business Problem Analysis](../BA-docs/general-approach.md): every technology decision in this folder traces back to a specific, named business problem defined there. Where `Solution Architecture.md` records *what* was decided, [`01-system/ADR/`](./01-system/ADR/README.md) records *why that decision and not another one* — the alternatives weighed, the trade-offs accepted, and whether the choice is settled or still awaiting review.

---

## 3. Building the Documents

Markdown is the source; the `.svg` diagrams are committed and the `.html` is not. Build commands and prerequisites are in the [repository README](../../README.md#building-the-documentation).

Diagram sources live in [`diagrams/`](./diagrams): PlantUML `.puml` files compiled to committed `.svg` siblings. Diagrams embedded directly in a document use Mermaid instead, rendered by `util/toHtml.js`.

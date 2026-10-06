# Solution Architecture — Enterprise Commerce Platform (ECP)

**Document type:** Index
**Audience:** Engineering, Architecture Review, Product Management

This folder defines the architecture that implements the [business requirements](../BA-docs/README.md).

## 1. Documents

| Folder | Document | What it covers |
|---|---|---|
| [`01-system/`](./01-system) | [`Solution Architecture.md`](./01-system/Solution%20Architecture.md) | `P1`–`P17` decision mapping, system context, quality targets, and acceptance traceability |
| [`01-system/`](./01-system) | [`Technology Stack.md`](./01-system/Technology%20Stack.md) | Backend/frontend technology shortlist |
| [`01-system/`](./01-system) | [`Deployment Diagram.md`](./01-system/Deployment%20Diagram.md) | Runtime topology, networks, ports, volumes, local setup, and operational limits |
| [`01-system/`](./01-system) | [`Security.md`](./01-system/Security.md) | Trust boundaries, identity, authorization, data protection, threat model, verification, and residual risk |
| [`01-system/`](./01-system) | [`Testing and Benchmark Strategy.md`](./01-system/Testing%20and%20Benchmark%20Strategy.md) | Test layers, test data, contracts, benchmarks, CI stages, and coverage |
| [`01-system/ADR/`](./01-system/ADR) | [`README.md`](./01-system/ADR/README.md) | Architecture Decision Records — index, status rules, and how to add one |
| [`01-system/ADR/`](./01-system/ADR) | `ADR-0001`–`ADR-0003`, `ADR-0005`–`ADR-0039` | 5 cross-cutting, 20 backend, and 13 frontend decisions. `ADR-0004` is retired. |
| [`02-backend/`](./02-backend) | [`Backend Architecture.md`](./02-backend/Backend%20Architecture.md) | Runtime, event backbone, Kafka, Redis, request pipeline, and observability |
| [`02-backend/`](./02-backend) | [`Domain Model.md`](./02-backend/Domain%20Model.md) | Subdomains, bounded contexts, aggregates, value objects, and domain events |
| [`02-backend/`](./02-backend) | [`Module Dependency Diagram.md`](./02-backend/Module%20Dependency%20Diagram.md) | Compile-time dependencies, runtime events, forbidden edges, and extraction readiness |
| [`02-backend/`](./02-backend) | [`CQRS.md`](./02-backend/CQRS.md) | Command/query contracts, read models, projections, rebuild, and lag budgets |
| [`02-backend/Sequence/`](./02-backend/Sequence) | [`README.md`](./02-backend/Sequence/README.md) | Sequence diagrams — index, the normative participant vocabulary and arrow conventions, and what the diagrams deliberately do not claim |
| [`02-backend/Sequence/`](./02-backend/Sequence) | `00-Overview.md`–`07-Supporting.md` | 56 sequence diagrams across 14 domains, including `P6`, `P7`, and `P8` failures |
| [`02-backend/`](./02-backend) | [`Database.md`](./02-backend/Database.md) | Data model, PostgreSQL DDL, indexes, outbox, read stores, and migrations |
| [`03-frontend/`](./03-frontend) | [`Frontend Architecture.md`](./03-frontend/Frontend%20Architecture.md) | Runtime, layers, Server/Client boundary, session custody, CSP, and toolchain |
| [`03-frontend/`](./03-frontend) | [`Routing.md`](./03-frontend/Routing.md) | Routes, rendering classes, boundaries, handlers, and coverage of 155 operations |
| [`03-frontend/`](./03-frontend) | [`Feature Structure.md`](./03-frontend/Feature%20Structure.md) | Feature layout, dependency order, import rules, and domain mapping |
| [`03-frontend/`](./03-frontend) | [`Data Fetching.md`](./03-frontend/Data%20Fetching.md) | Fetch client, parsing, caching, actions, revalidation, pagination, and errors |
| [`03-frontend/`](./03-frontend) | [`State Management.md`](./03-frontend/State%20Management.md) | Server, URL, local, and shared client state rules |
| [`03-frontend/`](./03-frontend) | [`Performance.md`](./03-frontend/Performance.md) | Route budgets, assets, streaming, CSP trade-offs, measurement, and CI gates |
| [`03-frontend/`](./03-frontend) | [`UI Design System.md`](./03-frontend/UI%20Design%20System.md) | Layout, spacing, type, color, components, motion, and accessibility |
| [`04-shared/`](./04-shared) | [`Integration Contract.md`](./04-shared/Integration%20Contract.md) | REST, pagination, errors, events, schema evolution, and permissions |
| [`04-shared/OpenAPI/`](./04-shared/OpenAPI) | [`README.md`](./04-shared/OpenAPI/README.md) + `openapi.yaml` | Normative OpenAPI 3.1 contract: 121 paths and 155 operations across 14 domains |
| [`04-shared/Event Contract/`](./04-shared/Event%20Contract) | [`README.md`](./04-shared/Event%20Contract/README.md) + JSON Schemas | Versioned event schemas and the private web-revalidation callback |
| [`04-shared/`](./04-shared) | [`Error Codes.md`](./04-shared/Error%20Codes.md) | `ECP-<DOMAIN>-<NNNN>` registry and known implementation drift |
| [`04-shared/`](./04-shared) | [`Permission Matrix.md`](./04-shared/Permission%20Matrix.md) | Roles and ownership scope for all 155 operations |

<a id="folder-layout"></a>

### 1.1 Folder rules

- `01-system/` holds system-wide decisions. `02-backend/` and `03-frontend/` hold implementation architecture. `04-shared/` holds boundary contracts only.
- Domain code and the shared kernel do not belong in `04-shared/`.
- `00-vision/` is reserved and not yet created. Empty planned folders are not committed.

## 2. Reading order

Start with [Business Analysis](../BA-docs/README.md), then read [`Solution Architecture.md`](./01-system/Solution%20Architecture.md) and the relevant [ADRs](./01-system/ADR/README.md). Read backend, frontend, deployment, security, and shared-contract documents as needed. Use [`Testing and Benchmark Strategy.md`](./01-system/Testing%20and%20Benchmark%20Strategy.md) to verify claims and find explicit gaps.

## 3. Build

Build instructions are in the [repository README](../README.md#build). PlantUML sources in [`diagrams/`](./diagrams) compile to committed SVG files. Embedded diagrams use Mermaid.

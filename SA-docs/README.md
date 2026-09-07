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
| [`01-system/ADR/`](./01-system/ADR) | [`README.md`](./01-system/ADR/README.md) | Architecture Decision Records — index, status rules, and how to add one |
| [`01-system/ADR/`](./01-system/ADR) | `ADR-0001`–`ADR-0003`, `ADR-0005`–`ADR-0028` | One record per decision: context, alternatives considered, outcome, consequences — 4 cross-cutting, 16 backend, 8 frontend. `ADR-0004` is retired, not reused ([why](./01-system/ADR/README.md)) |
| [`02-backend/`](./02-backend) | [`Backend Architecture.md`](./02-backend/Backend%20Architecture.md) | Backend architecture plan *(stub)* |
| [`02-backend/`](./02-backend) | [`Domain Model.md`](./02-backend/Domain%20Model.md) | Domain-Driven Design — strategic & tactical design: subdomain classification, bounded contexts, context map, aggregates, entities, value objects, domain events |
| [`02-backend/`](./02-backend) | [`Module Dependency Diagram.md`](./02-backend/Module%20Dependency%20Diagram.md) | The module graph the build verifies — compile-time dependencies, runtime event flow, layer rules, forbidden edges, extraction readiness |
| [`03-frontend/`](./03-frontend) | [`Frontend Architecture.md`](./03-frontend/Frontend%20Architecture.md) | Frontend architecture plan *(stub)* |
| [`03-frontend/`](./03-frontend) | [`UI Design System.md`](./03-frontend/UI%20Design%20System.md) | *Ma (間)*-inspired UI design specification — philosophy, layout and spacing scale, typography, palette, components, motion, accessibility baseline, validation checklist |
| [`04-shared/`](./04-shared) | [`Integration Contract.md`](./04-shared/Integration%20Contract.md) | Everything that crosses a boundary — REST conventions, pagination, error taxonomy, event envelope and catalogue, schema evolution, permission matrix |

Diagram sources live in [`diagrams/`](./diagrams): PlantUML `.puml` files compiled to committed `.svg` siblings. Diagrams embedded directly in a document use Mermaid instead, rendered by `util/toHtml.js`.

Folders are organized by concern, following the target layout in [`example-folder-structure.md`](./example-folder-structure.md). Folders from that layout with no content yet (`00-vision/`, `Sequence/`) are omitted until there is something to put in them, rather than checked in empty.

---

## 2. Reading Order

```nano
../BA-docs/                          what the business needs and why  (P1–P17, FR/NFR/BR)
      ↓
01-system/Solution Architecture.md   which architecture decision answers each problem, and why
01-system/Technology Stack.md        the technology shortlist that decision draws from
01-system/ADR/                       why that decision and not another one  (ADR-0001–ADR-0028)
      ↓
02-backend/                          how the backend implements it
03-frontend/                         how the frontend implements it
      ↓
01-system/Deployment Diagram.md      where it physically runs
04-shared/                           the contracts that cross every boundary
```

[`Solution Architecture.md`](./01-system/Solution%20Architecture.md) is the companion to [Business Problem Analysis](../BA-docs/general-approach.md): every technology decision in this folder traces back to a specific, named business problem defined there. Where `Solution Architecture.md` records *what* was decided, [`01-system/ADR/`](./01-system/ADR/README.md) records *why that decision and not another one* — the alternatives weighed, the trade-offs accepted, and whether the choice is settled or still awaiting review.

---

## 3. Building the Documents

The Markdown files are the source; HTML is generated and not committed.

```bash
# from the repo root
node util/toSvg.js       # every *.puml -> a sibling *.svg  (needs the `plantuml` CLI)
node util/toHtml.js      # every *.md   -> a styled, standalone sibling *.html
```

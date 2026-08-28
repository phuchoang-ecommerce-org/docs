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
| [`02-backend/`](./02-backend) | [`Backend Architecture.md`](./02-backend/Backend%20Architecture.md) | Backend architecture plan *(stub)* |
| [`02-backend/`](./02-backend) | [`Domain Model.md`](./02-backend/Domain%20Model.md) | Domain-Driven Design — strategic & tactical design *(stub)* |
| [`03-frontend/`](./03-frontend) | [`Frontend Architecture.md`](./03-frontend/Frontend%20Architecture.md) | Frontend architecture plan *(stub)* |
| [`03-frontend/`](./03-frontend) | [`UI Design System.md`](./03-frontend/UI%20Design%20System.md) | Zen-inspired UI design specification |

Folders are organized by concern, following the target layout in [`example-folder-structure.md`](./example-folder-structure.md). Folders from that layout with no content yet (`00-vision/`, `04-shared/`, `ADR/`, `Sequence/`) are omitted until there is something to put in them, rather than checked in empty.

---

## 2. Reading Order

```nano
../BA-docs/                          what the business needs and why  (P1–P17, FR/NFR/BR)
      ↓
01-system/Solution Architecture.md   which architecture decision answers each problem, and why
01-system/Technology Stack.md        the technology shortlist that decision draws from
      ↓
02-backend/                          how the backend implements it
03-frontend/                         how the frontend implements it
```

[`Solution Architecture.md`](./01-system/Solution%20Architecture.md) is the companion to [Business Problem Analysis](../BA-docs/general-approach.md): every technology decision in this folder traces back to a specific, named business problem defined there.

---

## 3. Building the Documents

The Markdown files are the source; HTML is generated and not committed.

```bash
# from the repo root
node util/toHtml.js      # every *.md -> a styled, standalone sibling *.html
```

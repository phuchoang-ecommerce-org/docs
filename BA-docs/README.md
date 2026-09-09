# Business Analyst Plan — Enterprise Commerce Platform (ECP)

**Document type:** Index
**Audience:** Business stakeholders, Product Management, Solution Architecture, Engineering, Quality Assurance

This folder holds the business analysis for the Enterprise Commerce Platform: what the business needs, why it needs it, what the platform must therefore do, and how each actor exercises it.

---

## 1. The Documents

| Document | What it answers | Owner's view |
|---|---|---|
| [`requirement.md`](./requirement.md) | *What did the business ask for?* | Product Owner Requirements, preserved **unchanged** as the record of stakeholder intent |
| [`general-approach.md`](./general-approach.md) | *Why does the platform need to exist?* | Business Problem Analysis — seventeen problems, `P1`–`P17`, stated without reference to technology |
| [`srs.md`](./srs.md) | *What must the platform do?* | Software Requirements Specification — identified, measurable, verifiable requirements |
| [`use-cases/`](./use-cases/README.md) | *How does each actor reach it, and what happens when it fails?* | Use Case Specification — 87 use cases, each fully specified |
| [`user-stories/`](./user-stories/README.md) | *How is this restated for a sprint backlog?* | User Story Specification — the same 87 use cases as stories with acceptance criteria |
| [`traceability-matrix.md`](./traceability-matrix.md) | *Does every problem reach a requirement, and every requirement a test?* | Traceability and coverage check |

`requirement.md` is deliberately never edited. It is the stakeholder's own words, and `srs.md` derives from it rather than replacing it — so that any later disagreement about what was asked for can be settled against the original rather than against an interpretation of it.

---

## 2. Reading Order

Read forward to understand the platform; read backward to challenge it.

```nano
requirement.md          what the business asked for
      ↓
general-approach.md     why it matters  (P1–P17)
      ↓
srs.md                  what the platform must do  (FR / NFR / BR / CON / AC)
      ↓
use-cases/              how each actor does it, and what happens when it fails  (UC)
      ↓
user-stories/           the same behaviour, restated as a backlog  (US)
      ↓
../SA-docs/             how it is built  (architecture and technology)
```

Reading backward is the more useful direction once delivery starts. Every requirement should trace to a problem, and a requirement that traces to nothing is scope that entered without justification — a candidate for removal rather than delivery.

---

## 3. Identifier Scheme

Identifiers are **stable**. A withdrawn requirement is marked withdrawn rather than renumbered, so a citation never silently changes meaning.

The full scheme — all nine identifier kinds, the fourteen domain codes, the non-functional categories, and the MoSCoW priorities — is stated once in [`srs.md`](./srs.md) §1.5. `P<n>` is defined in [`general-approach.md`](./general-approach.md), `UC-` in [`use-cases/`](./use-cases/README.md), and `US-` in [`user-stories/`](./user-stories/README.md).

---

## 4. Working Conventions

**No technology in these documents.** [`general-approach.md`](./general-approach.md) states the rule and `srs.md` and the use cases follow it: they say what must be true, never how to build it. The *how* belongs to [Solution Architecture](../SA-docs/01-system/Solution%20Architecture.md). This keeps the business analysis reviewable by stakeholders who do not read code, and keeps architectural decisions open to challenge on their own terms.

**Nothing is invented silently.** Where `requirement.md` leaves a value or policy undefined, an explicit **[ASSUMPTION]** is recorded in [`srs.md`](./srs.md) §2.5 rather than a decision being made quietly. Thirteen stand unconfirmed; several are load-bearing, and each is listed in [`srs.md`](./srs.md) §2.5 with what depends on it and what turns on confirming it.

**Failure behaviour is specified, not deferred.** Every use case documents its exception flows. A use case with no exception flow is one whose failure behaviour nobody has decided, and deciding it later under delivery pressure is how `P5` and `P7` happen in practice.

---

## 5. Building the Documents

Markdown is the source; the `.svg` diagrams are committed and the `.html` is not. Build commands and prerequisites are in the [repository README](../../README.md#building-the-documentation).

Diagram sources live in [`diagrams/`](./diagrams/): fourteen per-domain use case diagrams, plus `system-context`, `order-lifecycle`, and `checkout-activity`. `_common.iuml` carries the shared styling and is not a diagram in its own right.

---

## 6. Next Step

[Solution Architecture](../SA-docs/01-system/Solution%20Architecture.md) takes each business problem `P1`–`P17` and maps it to an architectural decision, the technology selected, and the reasoning connecting the two.

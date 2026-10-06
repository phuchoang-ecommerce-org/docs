# Business Analysis — Enterprise Commerce Platform (ECP)

**Document type:** Index
**Audience:** Business stakeholders, Product Management, Solution Architecture, Engineering, Quality Assurance

This folder defines the business problems, requirements, use cases, and user stories for ECP.

## 1. Documents

| Document | Purpose |
|---|---|
| [`requirement.md`](./requirement.md) | Original Product Owner requirements. This file is immutable. |
| [`general-approach.md`](./general-approach.md) | Seventeen technology-neutral business problems, `P1`–`P17`. |
| [`srs.md`](./srs.md) | Measurable requirements, business rules, constraints, assumptions, and acceptance criteria. |
| [`use-cases/`](./use-cases/README.md) | 87 use cases with success, alternate, and exception flows. |
| [`user-stories/`](./user-stories/README.md) | The same 87 behaviors as stories with acceptance criteria. |
| [`traceability-matrix.md`](./traceability-matrix.md) | Coverage from business problem to requirement and test. |

Read in table order. During delivery, trace backward to find requirements that have no business source.

## 2. Rules

- `requirement.md` keeps the stakeholder's original words. `srs.md` derives from it.
- BA documents state required behavior, not implementation. Technical decisions belong in [Solution Architecture](../SA-docs/01-system/Solution%20Architecture.md).
- Missing values or policies are marked `[ASSUMPTION]`. [`srs.md`](./srs.md) §2.5 lists the thirteen open assumptions and their impact.
- Every use case defines failure behavior through exception flows.
- IDs are stable. Withdrawn items keep their number and status. [`srs.md`](./srs.md) §1.5 defines the full scheme.

## 3. Build

Build instructions are in the [repository README](../README.md#build). PlantUML sources are in [`diagrams/`](./diagrams/); compiled SVG files are committed.

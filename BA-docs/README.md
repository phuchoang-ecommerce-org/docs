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
../SA-docs/             how it is built  (architecture and technology)
```

Reading backward is the more useful direction once delivery starts. Every requirement should trace to a problem, and a requirement that traces to nothing is scope that entered without justification — a candidate for removal rather than delivery.

---

## 3. Identifier Scheme

Identifiers are **stable**. A withdrawn requirement is marked withdrawn rather than renumbered, so a citation never silently changes meaning.

| Kind | Form | Example | Defined in |
|---|---|---|---|
| Business problem | `P<n>` | `P8` | [`general-approach.md`](./general-approach.md) |
| Functional requirement | `FR-<DOMAIN>-<nn>` | `FR-ORD-08` | [`srs.md`](./srs.md) §3 |
| Business rule | `BR-<DOMAIN>-<nn>` | `BR-INV-01` | [`srs.md`](./srs.md) §4 |
| Non-functional requirement | `NFR-<CATEGORY>-<nn>` | `NFR-REL-03` | [`srs.md`](./srs.md) §6 |
| Constraint | `CON-<nn>` | `CON-04` | [`srs.md`](./srs.md) §7 |
| Acceptance criterion | `AC-<nn>` | `AC-05` | [`srs.md`](./srs.md) §9 |
| Use case | `UC-<DOMAIN>-<nn>` | `UC-ORD-05` | [`use-cases/`](./use-cases/README.md) |
| Assumption | `A-<nn>` | `A-07` | [`srs.md`](./srs.md) §2.5 |

**Domain codes:** `CUS` Customer & Identity · `CAT` Catalog & Category · `SCH` Search & Recommendation · `INV` Inventory · `CRT` Cart & Wishlist · `ORD` Checkout & Order · `PAY` Payment · `SHP` Shipping · `PRM` Promotion · `REV` Review · `NTF` Notification · `ADM` Administration · `RPT` Reporting & Analytics · `AUD` Audit & Access Control · `DAT` cross-domain data qualities

---

## 4. Working Conventions

**No technology in these documents.** [`general-approach.md`](./general-approach.md) states the rule and `srs.md` and the use cases follow it: they say what must be true, never how to build it. The *how* belongs to [Solution Architecture](../SA-docs/general-approach.md). This keeps the business analysis reviewable by stakeholders who do not read code, and keeps architectural decisions open to challenge on their own terms.

**Nothing is invented silently.** Where `requirement.md` leaves a value or policy undefined, an explicit **[ASSUMPTION]** is recorded in [`srs.md`](./srs.md) §2.5 rather than a decision being made quietly. Thirteen stand unconfirmed; several are load-bearing, and they are listed with their consequences in [`traceability-matrix.md`](./traceability-matrix.md) §7.

**Failure behaviour is specified, not deferred.** Every use case documents its exception flows. A use case with no exception flow is one whose failure behaviour nobody has decided, and deciding it later under delivery pressure is how `P5` and `P7` happen in practice.

---

## 5. Building the Documents

The Markdown files are the source. Diagrams are PlantUML compiled to SVG; HTML is generated and not committed.

```bash
# from the repo root
node util/toSvg.js       # docs/BA-docs/diagrams/*.puml -> sibling *.svg
node util/toHtml.js      # every *.md -> a styled, standalone sibling *.html

# or, from util/
npm run docs:diagrams
npm run docs:html
npm run docs:build       # both, in order
```

**Prerequisites.** `node`, and the `plantuml` CLI for diagrams (`brew install plantuml graphviz` on macOS; `apt-get install plantuml graphviz` on Debian). `util/toSvg.js` reports a clear message if PlantUML is missing.

**What is committed.** The `.md` sources, the `.puml` diagram sources, and the compiled `.svg` files — the SVGs must be committed for diagrams to render on GitHub. The generated `.html` is gitignored; regenerate it locally when you want the styled, zoomable reading view.

Diagram sources live in [`diagrams/`](./diagrams/): fourteen per-domain use case diagrams, plus `system-context`, `order-lifecycle`, and `checkout-activity`. `_common.iuml` carries the shared styling and is not a diagram in its own right.

---

## 6. Next Step

[Solution Architecture](../SA-docs/general-approach.md) takes each business problem `P1`–`P17` and maps it to an architectural decision, the technology selected, and the reasoning connecting the two.

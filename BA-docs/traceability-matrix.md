# Traceability Matrix — Enterprise Commerce Platform (ECP)

**Document type:** Traceability Matrix
**Related documents:** [`general-approach.md`](./general-approach.md) (business problems P1–P17) · [`srs.md`](./srs.md) (requirements) · [`use-cases/README.md`](./use-cases/README.md) (use cases) · [Solution Architecture](../SA-docs/01-system/Solution%20Architecture.md)
**Audience:** Product Management, Engineering, Quality Assurance, Solution Architecture
**Version:** 1.0
**Status:** Draft for stakeholder review

---

## 1. Purpose

This matrix checks the `P → FR/NFR/BR → UC` chain. It reports three gap types:

| Gap | What it means |
|---|---|
| A business problem with no requirement | The problem was catalogued and then not addressed |
| A requirement with no use case | The requirement has no defined or testable behaviour |
| A use case with no requirement | The behaviour has no stated requirement |

---

## 2. Business Problem → Requirement

Each problem in [`general-approach.md`](./general-approach.md) maps to its requirements. **Primary vehicle** shows the main requirement type.

| Problem | Requirements | Primary vehicle |
|---|---|---|
| **P1** Domain complexity threatens delivery speed | `NFR-MAINT-01`, `NFR-MAINT-02`, `CON-01`, `CON-02` | Maintainability |
| **P2** New capabilities risk destabilising the core | `NFR-MAINT-04`, `NFR-REL-06`, `CON-07`; `FR-NTF-03`, `FR-SCH-11` | Maintainability + events |
| **P3** Vendor coupling increases switching cost | `NFR-MAINT-03`, `NFR-AVAIL-03`, `CON-03`; `FR-PAY-09`, `FR-SHP-01` | Maintainability + abstraction |
| **P4** Undifferentiated data freshness limits scale | `NFR-PERF-06`, `NFR-SCAL-05`, `CON-04`, `CON-06`; assumption **A-11** | Performance + scalability |
| **P5** Inconsistent rule enforcement enables abuse | **All of §4 Business Rules**; `NFR-SEC-01`, `FR-AUD-06`, `FR-ORD-11`, `FR-REV-06`, `BR-AUD-02` | Business rules |
| **P6** Business events can be silently lost | `NFR-REL-05`, `NFR-REL-06`, `BR-NTF-01`; `FR-NTF-06`, `FR-PAY-05` | Reliability |
| **P7** Partial failures in money-critical flows | `NFR-REL-01`, `NFR-REL-02`, `NFR-REL-04`; `BR-ORD-02`, `BR-ORD-03`, `BR-INV-02`, `BR-PAY-01`, `BR-PAY-02`; `FR-ORD-08`, `FR-ORD-09` | Reliability + business rules |
| **P8** Overselling under concentrated demand | `NFR-REL-03`, `NFR-SCAL-06`; `BR-INV-01`, `BR-CRT-02`; `FR-INV-02`, `FR-ORD-06` | Reliability + inventory rules |
| **P9** Peak events are also peak-risk moments | `NFR-SCAL-04`, `NFR-SCAL-06`, `NFR-AVAIL-01`, `NFR-AVAIL-02`, `NFR-PERF-01`–`NFR-PERF-03` | Scalability + availability |
| **P10** Growth outpacing performance and cost | `NFR-SCAL-01`, `NFR-SCAL-02`, `NFR-SCAL-03`, `NFR-SCAL-07`, `NFR-PERF-01`–`NFR-PERF-04` | Scalability + performance |
| **P11** Poor product discovery loses sales | `FR-SCH-01`–`FR-SCH-11`, `FR-CAT-03`–`FR-CAT-08`; `NFR-PERF-03`, `NFR-PERF-04` | Functional (search, catalog) |
| **P12** Transactions and browsing have conflicting needs | `NFR-SCAL-05`, `NFR-PERF-01`, `NFR-PERF-02`, `CON-04`, `CON-05` | Scalability + performance |
| **P13** Reporting competing with transactions | `NFR-PERF-05`, `NFR-PERF-06`, `CON-06`; `FR-RPT-01`–`FR-RPT-10`, `BR-RPT-01` | Performance isolation |
| **P14** Teams blocking each other as the organisation grows | `NFR-MAINT-01`, `NFR-MAINT-02`, `NFR-MAINT-06`, `CON-01`, `CON-08` | Maintainability |
| **P15** Architecture erosion over time | `NFR-MAINT-05`, `NFR-MAINT-01`, `NFR-MAINT-03` | Automated structural enforcement |
| **P16** Unauthorised access to sensitive operations | `FR-AUD-05`, `FR-AUD-06`, `FR-AUD-07`, `FR-AUD-08`; `NFR-SEC-01`–`NFR-SEC-07`; `BR-AUD-02`, `BR-AUD-03`, `BR-SCH-01` | Security |
| **P17** Inability to trace significant actions | `FR-AUD-01`–`FR-AUD-04`; `NFR-OBS-01`, `NFR-OBS-02`; `BR-AUD-01`, `BR-INV-03`, `FR-DAT-05` | Audit |

**P5** maps to all of [`srs.md`](./srs.md) §4 because it concerns the enforcement point of every business rule. Each rule is enforced in the platform, not in a client.

---

## 3. Requirement → Use Case

[`srs.md`](./srs.md) §3 defines the `FR → UC` mapping in its **UC** column. It is not copied here. Section 6 reports missing links.

Non-functional requirements are cross-cutting and are traced in §2 and §5 instead.

### 3.1 Use Case → User Story

Each of the 87 use cases has one user story with the same domain and number: `US-<DOMAIN>-<nn>` realises `UC-<DOMAIN>-<nn>`. The numbering is the mapping, so no duplicate table is kept here. If a story conflicts with its use case, the use case is normative.

---

## 4. Business Rule → Use Case

[`srs.md`](./srs.md) §4 defines the `BR → UC` mapping in **Enforced in (UC)**. It is not copied here.

## 5. Acceptance Criterion → Requirement → Verification

[`srs.md`](./srs.md) §9 maps `AC-01`–`AC-06` to requirements, use cases, and verification. An acceptance criterion passes only when every linked requirement passes.

## 6. Coverage Summary

Mechanically checked against [`srs.md`](./srs.md) §3 and the fourteen use case files.

| Check | Result |
|---|---|
| Functional requirements defined (§3) | **129** |
| Cross-domain data requirements (§5.2) | **5** |
| Non-functional requirements (§6) | **39** |
| Constraints (§7) | **9** |
| Business rules (§4) | **40** |
| Use cases specified | **87** |
| Business problems `P1`–`P17` with at least one requirement | **17 / 17** — no gaps |
| Functional requirements with at least one use case | **129 / 129** — no gaps |
| Use cases named by at least one requirement | **87 / 87** — no orphans |
| `FR → UC` references pointing at a use case that does not exist | **0** |
| Acceptance criteria with at least one requirement | **6 / 6** |

**Result: no coverage gaps.**

### Coverage notes

- `P1`, `P14`, and `P15` map only to `NFR-MAINT-*` and `CON-*`; this is expected.
- `P5` reaches every business rule in §4 because it concerns enforcement location.
- `P7` and `P8` depend on exception flows: ten in `UC-ORD-05` and five in `UC-INV-01`.
- `UC-AUD-03` applies to every use case with a human actor. `UC-AUD-01` applies to every significant state change.

---

## 7. Open Items Carried Forward

All thirteen assumptions in [`srs.md`](./srs.md) §2.5 remain unconfirmed. `A-03` and `A-04` size the architecture; `A-12` sets the resilience investment. The Product Owner must confirm or correct them.

Two source requirement gaps remain:

- **Review content policy:** `UC-REV-05` defines moderation, but R1 provides no content policy.
- **Role granularity:** [`srs.md`](./srs.md) §2.3 interprets the five roles in R1 §9. Finer permissions remain undecided and affect `P16`.

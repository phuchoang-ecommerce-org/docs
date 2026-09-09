# Traceability Matrix — Enterprise Commerce Platform (ECP)

**Document type:** Traceability Matrix
**Related documents:** [`general-approach.md`](./general-approach.md) (business problems P1–P17) · [`srs.md`](./srs.md) (requirements) · [`use-cases/README.md`](./use-cases/README.md) (use cases) · [Solution Architecture](../SA-docs/01-system/Solution%20Architecture.md)
**Audience:** Product Management, Engineering, Quality Assurance, Solution Architecture
**Version:** 1.0
**Status:** Draft for stakeholder review

---

## 1. Purpose of This Document

This document carries the middle of the `P → FR/NFR/BR → UC` chain and functions as a
**coverage check** (§6). A requirement that cannot be traced backward to a problem is scope that
entered without justification, and is a candidate for removal rather than delivery.

The three gaps it looks for each mean something specific:

| Gap | What it means |
|---|---|
| A business problem with no requirement | The problem was catalogued and then not addressed |
| A requirement with no use case | Nobody has worked out how the requirement is exercised, so nobody can test it |
| A use case with no requirement | Behaviour was specified that no stated requirement asked for |

---

## 2. Business Problem → Requirement

Each of the seventeen problems in [`general-approach.md`](./general-approach.md) maps to the requirements that address it. The **Primary vehicle** column names where the weight of the answer sits, since a problem is rarely answered by functional requirements alone — several of these are answered almost entirely by non-functional requirements and constraints, which is exactly why those sections of the SRS carry the emphasis they do.

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

**Note on P5.** It maps to *all* of [`srs.md`](./srs.md) §4 rather than to a list, and this is deliberate. P5 is not a problem solved by particular rules; it is a problem about **where** every rule is enforced. Each rule in §4 therefore names an enforcement point, and each is inside the platform rather than in a client.

---

## 3. Requirement → Use Case

Not tabulated here. [`srs.md`](./srs.md) §3 carries a **UC** column on every functional requirement, so the mapping already exists at the point the requirement is defined — and a second copy could only be an abridgement of it. Read §3 of the SRS for requirement → use case; this document covers what that column cannot show: whether anything is *missing* (§6).

Non-functional requirements are cross-cutting and are traced in §2 and §5 instead.

### 3.1 Use Case → User Story

Every use case in [`use-cases/`](./use-cases/README.md) has exactly one corresponding entry in [`user-stories/`](./user-stories/README.md), numbered identically: `US-<DOMAIN>-<nn>` realises `UC-<DOMAIN>-<nn>`, with no exceptions and no gaps across all 87. Because the numbering is the mapping, no separate `UC → US` table is carried here — one repeated for 87 rows would drift from the source the moment either document changed. A story's acceptance criteria derive from its use case's main scenario, alternate flows, and exception flows; where the two disagree, the use case is normative.

---

## 4. Business Rule → Use Case

Not tabulated here either. [`srs.md`](./srs.md) §4 now carries an **Enforced in (UC)** column beside each rule's enforcement point, which is where a reader asking "where is this decided?" is already looking.

## 5. Acceptance Criterion → Requirement → Verification

Not tabulated here. [`srs.md`](./srs.md) §9 states each of `AC-01`–`AC-06` with the requirements that must hold, the use cases that exercise it, and how it is judged. An acceptance criterion is met only when every requirement it names is met.

## 6. Coverage Summary

Checked mechanically against [`srs.md`](./srs.md) §3 and the fourteen use case files.

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

**No coverage gaps.** Every catalogued business problem reaches at least one requirement, every functional requirement is exercised by at least one use case, and no use case specifies behaviour that no requirement asked for.

### Notes on the shape of the coverage

- **`P1`, `P14`, and `P15` map to no functional requirement at all**, and this is correct rather than a gap. They concern how the platform is structured and how that structure holds over time, which is why the SRS states them as `NFR-MAINT-*` and `CON-*`. It also makes them the easiest requirements to quietly drop under delivery pressure and the most expensive to reinstate — `P15` is precisely the prediction that this happens.
- **`P5` is the most widely distributed problem in the chain.** It reaches every business rule in §4, because it is a claim about enforcement location rather than about any particular rule.
- **`P7` and `P8` concentrate in exception flows rather than requirements.** `FR-ORD-08` states atomicity in one line; what makes it testable is the ten exception flows of `UC-ORD-05` and the five of `UC-INV-01`.
- **The `AUD` domain is cited by nearly every use case in the specification.** `UC-AUD-03` is included by every use case with a human actor and `UC-AUD-01` by every use case that changes something of consequence. Their eight requirements carry disproportionate weight, and a shortfall there is a shortfall everywhere.

---

## 7. Open Items Carried Forward

All thirteen assumptions in [`srs.md`](./srs.md) §2.5 stand unconfirmed. They are not re-listed here: §2.5 carries each one with the requirements that depend on it and what turns on confirming it. Several are load-bearing — `A-03` and `A-04` size the architecture, `A-12` determines the resilience investment — and confirming or correcting them is a Product Owner action, not a specification one.

Two further items are **not** assumptions but genuine gaps in the source requirements, and cannot be closed by this specification:

- **Review content policy.** `UC-REV-05` specifies how moderation works but R1 defines no policy to moderate against. Moderation cannot be consistent without one.
- **Role granularity.** The role authority table in [`srs.md`](./srs.md) §2.3 is this specification's interpretation of R1 §9's five roles. Whether finer-grained permissions are required within a role is unsettled, and `P16` turns on getting it right.


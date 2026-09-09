# ADR-0001 — Record Architecture Decisions in ADRs

**Status:** Accepted
**Date:** 2026-09-06
**Traces to:** `NFR-MAINT-05` · `AC-04`

---

## 1. Context and Problem Statement

[`Solution Architecture.md`](../Solution%20Architecture.md) §5 maps every business problem (`P1`–`P17`) to an architecture decision, a technology, and a rationale. It is a good record of *what was decided*. It is not a record of *what was rejected*, *when*, *by whom*, or *under what assumption* — and those are the facts a reader needs when a decision comes back up for review two years later.

Three concrete problems follow from having only the narrative document:

- **No alternatives.** Nothing says whether GraphQL was weighed against REST, or Gradle against Maven. A future reader cannot tell a considered choice from a default.
- **No status.** Every statement in §5 reads as equally settled, even though `Technology Stack.md`'s frontend line was edited this week and its backend lines have been stable for months.
- **No supersession path.** Changing one decision means editing a 463-line document in place, destroying the previous decision's record in the process.

The repository already anticipates the fix: [`SA-docs/README.md`](../../README.md#folder-layout) §1.1 reserves `01-system/ADR/`, and [`README.md`](../../README.md) §1 states that folder is omitted only "until there is something to put in them."

## 2. Decision Drivers

- Architecture quality must be a verifiable property rather than institutional memory (`P15`, `NFR-MAINT-05`).
- `AC-04` — "the system remains maintainable as complexity increases" — is judged partly on whether a newcomer can reconstruct *why* the system looks the way it does.
- The frontend architecture is being decided now, for the first time; those decisions need somewhere to live that is not a stub file.
- Whatever format is chosen must survive `node util/toHtml.js` and match the house conventions already used across `docs/`.

## 3. Considered Options

**Option 1 — Keep decisions only in `Solution Architecture.md`.**

- **Pros:** One document, one place to look; no new convention to teach; zero migration cost.
- **Cons:** Cannot express status, supersession, or rejected alternatives without bloating the narrative past readability. Editing a decision destroys its history. Frontend decisions have no natural home there — §5 is organised by business problem, and most frontend choices answer no single `P<n>`.

**Option 2 — Nygard-format ADRs (Context / Decision / Consequences).**

- **Pros:** Very short; low authoring cost; the most widely recognised ADR shape.
- **Cons:** Alternatives appear only as prose asides, which is exactly the information gap this ADR exists to close. Offers no structured place for the traceability identifiers (`P<n>`, `NFR-*`, `BR-*`, `CON-*`) that the rest of `docs/` links everything by.

**Option 3 — MADR-format ADRs in `01-system/ADR/`, one continuous number sequence.** *(chosen)*

- **Pros:** `Considered Options` is a first-class section, so rejected alternatives are recorded by construction. Status field distinguishes recorded history from live proposals. Each record supersedes independently. Lands in the folder the target layout already reserves.
- **Cons:** More writing per decision; risk of ceremony for choices that do not deserve it. Two sources of truth if `Solution Architecture.md` and an ADR ever drift.

**Option 4 — A decision log in an external tool (wiki, issue tracker).**

- **Pros:** Comment threads, notifications, no repository churn.
- **Cons:** Decisions stop being versioned alongside the architecture they describe, and stop being reviewable in the same pull request. Rejected outright — this repository's whole premise is that architecture lives in Git next to the docs it derives from.

## 4. Decision Outcome

**Chosen: Option 3** — MADR-format Architecture Decision Records in `docs/SA-docs/01-system/ADR/`, numbered `ADR-0001` upward in a single continuous sequence, grouped in the [index](./README.md) as Cross-cutting / Backend / Frontend.

Three rules govern the set:

**Status lifecycle.** Exactly three values:

| Status | Meaning |
|---|---|
| `Proposed` | The decision is made here for the first time and has not yet been ratified in architecture review. |
| `Accepted` | The decision is in force. |
| `Superseded by ADR-NNNN` | A later record replaced it. The original file is never deleted or rewritten. |

**Accepted vs. Proposed is assigned by a rule, not by preference.** An ADR is `Accepted` when the outcome it records is already stated in [`Solution Architecture.md`](../Solution%20Architecture.md), [`Domain Model.md`](../../02-backend/Domain%20Model.md), or [`Technology Stack.md`](../Technology%20Stack.md) — the ADR reconstructs the context and the alternatives, it does not invent the outcome. It is `Proposed` when the decision exists nowhere else in the repository and this record is the first place it is made. A `Proposed` record is never quietly promoted; promotion is its own commit.

**`Solution Architecture.md` stays authoritative for the narrative.** ADRs elaborate §5, they do not replace it. Where a §7 row has a record, §7 links to it. If the two ever disagree, that is a defect to fix, not a choice to make.

## 5. Consequences

### Positive

- Rejected options become part of the record, so a revisited decision starts from what was already weighed rather than from zero.
- Frontend architecture gets a home immediately, without waiting for [`Frontend Architecture.md`](../../03-frontend/Frontend%20Architecture.md) to be written.
- Assumptions flagged in the SRS (**[A-03]** latency split, **[A-04]** 10× peak, **[A-12]** 99.9% availability) can be attached to the specific decisions sized against them, so a changed assumption has a visible blast radius.

### Negative

- Two places now describe each backend decision. Every edit to `Solution Architecture.md` §5 or §7 must be checked against the corresponding record.
- MADR's structure invites padding. Records are held to roughly 80–160 lines; an option list with no genuinely viable rejected option is a sign the ADR was not needed.

### Neutral / follow-on

- `docs/SA-docs/README.md` §1 must stop listing `ADR/` among the empty-and-omitted folders.
- Future records continue the sequence at `ADR-0027`. Numbers are never reused, even if a record is superseded.

## 6. Related Decisions

Every other record in this folder. See the [index](./README.md).

# Sprint Backlogs — Enterprise Commerce Platform (ECP)

**Document type:** Index
**Audience:** Engineering, Product Management
**Related documents:** [`../release-plan.md`](../release-plan.md) · [`../product-backlog.md`](../product-backlog.md) · [`../definition-of-done.md`](../definition-of-done.md)

---

## 1. Why Only Six Files Here

A Sprint Backlog is produced **by the people doing the work, at Sprint Planning**. Writing thirty-three of them in advance would produce thirty-three documents that are wrong by the time they are opened — and would quietly convert Scrum into a Gantt chart with ceremonies attached.

What is written in advance is what genuinely can be: the **sprint goal, the items, their estimates, and the gate** — and those live in [`../release-plan.md`](../release-plan.md) §4 for all thirty-six sprints.

The six files here are the sprints whose content is already fully determined, because their work is enabler work drawn from documents that already exist — chiefly [`Testing and Benchmark Strategy.md`](../../SA-docs/01-system/Testing%20and%20Benchmark%20Strategy.md) §8's current-state gap table. There is no discovery left in them, so writing them early costs nothing and removes a planning session's worth of uncertainty from the start of the project.

[`_template.md`](./_template.md) is what turns Sprint 06 onward into a file like these, on the morning of the day.

---

## 2. The Files

| Sprint | File | Goal |
|---|---|---|
| 00 | [`sprint-00-foundation.md`](./sprint-00-foundation.md) | Both lanes have a build that enforces its own rules |
| 01 | [`sprint-01-gate-and-contract-harness.md`](./sprint-01-gate-and-contract-harness.md) | The architecture gate is real and the contract harness runs — **`G0`** |
| 02 | [`sprint-02-wire-format-and-shell.md`](./sprint-02-wire-format-and-shell.md) | Every response shape a controller will ever return is decided once |
| 03 | [`sprint-03-identity-core.md`](./sprint-03-identity-core.md) | A customer can register, verify, sign in, and sign out — **`G1`** |
| 04 | [`sprint-04-authorisation.md`](./sprint-04-authorisation.md) | Authorisation and rate limiting hold on every path |
| 05 | [`sprint-05-identity-account.md`](./sprint-05-identity-account.md) | A customer owns their account — **`G2`** |
| — | [`_template.md`](./_template.md) | The shape every later sprint backlog takes |

---

## 3. Creating One

At Sprint Planning: copy [`_template.md`](./_template.md), name it `sprint-<nn>-<slug>.md`, and fill it from that sprint's section of [`../release-plan.md`](../release-plan.md) §4. Break each slice into tasks of a day or less. Confirm every item against the Definition of Ready ([`../definition-of-done.md`](../definition-of-done.md) §2) before committing to the sprint — an item that fails goes back to Refinement rather than into the sprint to be clarified during it.

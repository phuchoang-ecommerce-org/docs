# Product Management Plan — Enterprise Commerce Platform (ECP)

**Document type:** Index
**Audience:** Product Management, Engineering, Quality Assurance, Solution Architecture

This folder holds the delivery plan for the Enterprise Commerce Platform: the order the work is done in, who does it, how the two lanes stay out of each other's way, and what "finished" means.

[Business Analysis](../BA-docs/README.md) says **what** the platform must do. [Solution Architecture](../SA-docs/README.md) says **how** it is built. This folder says **in what order, by whom, and when it is done** — the three questions neither of the others answers.

---

## 1. The Documents

| Document | What it covers |
|---|---|
| [`scrum-framework.md`](./scrum-framework.md) | The process — roles, two-week cadence, ceremonies sized for a two-person team, the two-lane board and its `Integrated` column, the estimation scale, the velocity assumption and the rule for re-baselining it |
| [`product-backlog.md`](./product-backlog.md) | The ordered, estimated, single list of work — all 87 user stories with their lane split, sprint, and contract surface, plus the sixteen enabler epics the scaffold still owes the architecture. Asserts its own coverage against the 87 |
| [`release-plan.md`](./release-plan.md) | The sprint map — 36 sprints across three releases, both lanes side by side with their point loads, every Contract Sync gate and Integration Hardening sprint, the sequencing rationale, the schedule risks, and the re-baselining rule |
| [`integration-plan.md`](./integration-plan.md) | **How the frontend and backend stay decoupled and how they meet.** The Prism mock harness, the codegen contract, the one-environment-variable switch, the ten-point Contract Sync checklist, the three hardening sprints, and the contract-amendment procedure |
| [`definition-of-done.md`](./definition-of-done.md) | The quality gates — Definition of Ready, a Definition of Done per lane, the story-level integration criterion, the release-level `AC-01`–`AC-06` table, and the coverage policy |
| [`sprint-backlogs/`](./sprint-backlogs/README.md) | Task-level backlogs for Sprints 00–05, plus the template that turns any later sprint into one at Sprint Planning |

---

## 2. Reading Order

```nano
../BA-docs/                    what the business needs, and the 87 stories that express it
../SA-docs/                    the architecture that constrains the order it can be built in
      ↓
scrum-framework.md             how the team works — cadence, lanes, estimation
product-backlog.md             everything that must be built, ordered and sized
      ↓
release-plan.md                when each item is built, in which lane, against which gate
integration-plan.md            how the two lanes avoid blocking each other, and how they meet
      ↓
definition-of-done.md          what "finished" means at item, story, and release level
sprint-backlogs/               the next sprint, in tasks
```

---

## 3. The Plan in One Page

| | |
|---|---|
| **Team** | One backend developer, one frontend developer. Two lanes, one backlog |
| **Scope** | All 87 user stories, `Must` first — 71 `Must`, then 12 `Should`, then 4 `Could` |
| **Shape** | 36 two-week sprints: 33 delivery sprints plus 3 Integration Hardening sprints |
| **Duration** | ≈ 17 months at the assumed velocity, re-baselined after Sprint 03 |
| **`Must` cut line** | End of Sprint 29 — the viable release by the Product Owner's own MoSCoW assignment |
| **Critical path** | The backend lane, by roughly ten sprints. A second *backend* developer moves the date; a second frontend developer does not |

### 3.1 Why the two lanes can run in parallel

Because [`openapi.yaml`](../SA-docs/04-shared/OpenAPI/README.md) already exists and is **normative** under [`ADR-0031`](../SA-docs/01-system/ADR/ADR-0031-contract-first-openapi.md) — 121 paths, 155 operations, hand-authored before either implementation.

The frontend serves that file through a Prism mock and builds every screen against it; the backend is verified against the same file in both directions; the generated TypeScript types come from it with a build-failing diff. Switching the frontend from mock to real backend is one environment variable and no code change.

The result is visible in [`release-plan.md`](./release-plan.md) §3.2: the frontend routinely builds screens **one to three sprints ahead** of the endpoints behind them. That is not optimism — it is the contract being an input rather than an output.

### 3.2 How they meet

| | Cadence | Duration |
|---|---|---|
| **Contract Sync** (`G0`–`G15`) | End of every odd sprint | 1 day, both developers, scoped to that increment's domains |
| **Integration Hardening** (IH-1, IH-2, IH-3) | After Sprint 09, Sprint 20, Sprint 29 | A full sprint each, no new stories |

The three hardening sprints sit where they do for a reason: **IH-1** proves session custody, which is hardest to retrofit; **IH-2** proves the money path, where `P6` and `P8` live; **IH-3** proves the whole system and states plainly which acceptance criteria remain unverified.

---

## 4. What This Plan Does Not Claim

`AC-05` (reporting does not impact transactions) and `AC-06` (production-quality architecture) are recorded as **unverified**, not as in progress. Both rest on a load rig that [`Testing and Benchmark Strategy.md`](../SA-docs/01-system/Testing%20and%20Benchmark%20Strategy.md) §7.9 deliberately defers, with five dated triggers that end the deferral.

The strategy document says so. Restating it here is deliberate: a delivery plan that quietly claims what the test strategy says is unverified is the failure mode `P15` describes, arriving through a different door.

---

## 5. Building the Documents

Markdown is the source; the `.html` is generated and not committed. Build commands and prerequisites are in the [repository README](../../README.md#building-the-documentation).

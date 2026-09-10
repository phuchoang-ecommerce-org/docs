# Scrum Framework — Enterprise Commerce Platform (ECP)

**Document type:** Process Definition
**Audience:** Product Management, Engineering
**Version:** 1.0
**Status:** Draft for stakeholder review
**Related documents:** [`product-backlog.md`](./product-backlog.md) · [`release-plan.md`](./release-plan.md) · [`integration-plan.md`](./integration-plan.md) · [`definition-of-done.md`](./definition-of-done.md)

---

## 1. Team and Roles

| Role | Held by | Responsibility |
|---|---|---|
| **Product Owner** | Stakeholder representative | Owns backlog order and the MoSCoW assignment. Ratifies the open assumptions `A-01`–`A-12` of SRS §2.5. The only person who may cut scope |
| **Developer — backend lane** | 1 engineer | `ecp-api`. Owns the module graph, the contract's server side, and the L1–L6 suites |
| **Developer — frontend lane** | 1 engineer | `ecp-web`. Owns the route map, the contract's client side, and the frontend suites |

**There is no dedicated Scrum Master and no separate QA function.** Both are named risks (`R3` in [`release-plan.md`](./release-plan.md) §7) rather than gaps quietly left open. The mitigation is structural rather than procedural: the quality gates are **build-failing, not review-failing** ([`ADR-0018`](../SA-docs/01-system/ADR/ADR-0018-architecture-governance-ci-gate.md)), because a two-person team under delivery pressure will negotiate with a checklist and cannot negotiate with a red build.

**Facilitation rotates by sprint.** Whoever facilitates runs the ceremonies, keeps the board honest, and owns the retrospective actions. It is a half-day per sprint, not a role.

---

## 2. Cadence

Two-week sprints, Monday start.

| Ceremony | When | Duration | Notes |
|---|---|---|---|
| **Sprint Planning** | Day 1, morning | 2 h | Both lanes plan together, in one session. Two people planning separately is two people building different systems |
| **Daily Sync** | Daily | 10 min | Three questions, standing. With two people this is a conversation, not a report |
| **Contract Sync** | Last day of odd sprints | 1 day | Both developers, together. The checklist is [`integration-plan.md`](./integration-plan.md) §3 |
| **Sprint Review** | Last day | 1 h | Demonstrated against the **running system**, never against a screenshot or a passing test |
| **Retrospective** | Last day | 45 min | One action, owned, carried into the next sprint's board. Not three |
| **Backlog Refinement** | Mid-sprint | 1 h | The next two sprints' stories brought to the Definition of Ready |

Roughly 5% of capacity in ceremonies on normal sprints, 15% on gate sprints. That is accounted for in the velocity figure below rather than added on top of it.

---

## 3. The Two-Lane Board

One backlog, one board, two swimlanes.

```nano
                 │ Ready │ In progress │ In review │ Integrated │ Done
  Backend lane   │       │             │           │            │
  Frontend lane  │       │             │           │            │
```

**A story is one backlog item that produces two slices**, tracked as `US-ORD-05/BE` and `US-ORD-05/FE`. They are frequently in different sprints — see [`release-plan.md`](./release-plan.md) §3.2, where the frontend leads the backend by up to three sprints on the admin and reporting screens.

**`Integrated` is a real column and it is where slices wait.** A slice that is merged and passing its own lane's checks is *not* Done; it sits in `Integrated` until the Contract Sync verifies it against the other lane's running code. A story reaches `Done` only when **both** slices have passed that gate.

This is the column that prevents the failure this whole plan is built to avoid: two lanes each reporting 100% complete, and a system that has never been run.

---

## 4. Estimation

**Fibonacci points: 1, 2, 3, 5, 8, 13.** One point ≈ **half an ideal developer-day** — uninterrupted work on a well-understood task.

| Points | Shape of the work |
|---|---|
| 1–2 | A single endpoint or a single screen over existing structure. No new decision |
| 3 | Ordinary work in a module that already exists |
| 5 | A new aggregate, a new screen with its own data needs, or an endpoint with real exception flows |
| 8 | A new module, a new read model, or a story whose exception flows carry a business rule |
| 13 | Spans modules or has a concurrency guarantee to prove. **`US-ORD-05` is the only 13 in the backlog** |

**Nothing is estimated above 13.** An item that feels bigger is split before it is planned. `EN-EVENT-1` at 21 points is an enabler epic that is split at Sprint Planning, not a single item.

**Estimates cover the whole slice**, including its tests, its migration, and its `loading.tsx`. A story that is "done except the tests" was estimated wrong, not finished early.

### 4.1 Velocity

| | Value |
|---|---|
| Assumed velocity | **20 points per lane per sprint** |
| Sprint 00 | 14 points — first contact with an unfamiliar build |
| Backend actual load | 18–23 points/sprint, averaging 19.7 |
| Frontend actual load | 0–23 points/sprint, averaging 13.7 — the difference is reserve, and [`release-plan.md`](./release-plan.md) §6 says what it is for |

**This is an assumption, not an observation.** Nobody has completed a sprint on this codebase. It is re-baselined after Sprint 03 — the first sprint containing real user stories rather than enablers — and the rule is that **the sprint order does not change under re-baselining, only the dates do**, because the order is derived from the module graph and the layer model rather than from anyone's speed.

---

## 5. Sprint Planning, Concretely

1. Confirm the sprint goal from [`release-plan.md`](./release-plan.md). It is one sentence and both lanes serve it.
2. Pull the sprint's items. They are already ordered and estimated — planning is not re-estimation.
3. Check each against the Definition of Ready ([`definition-of-done.md`](./definition-of-done.md) §2). An item that fails goes back to Refinement; it does not go into the sprint "to be clarified during."
4. Break each slice into tasks of a day or less, in the sprint backlog file.
5. Name the integration risk: *which item in this sprint is most likely to surface a contract problem at the next gate?* Say it out loud during planning, and it will not be a surprise at the gate.

---

## 6. Working Agreements

| # | Agreement | Why |
|---|---|---|
| 1 | **Trunk-based, short-lived branches.** A branch older than two days is merged or abandoned | Two people cannot review two long-running branches and still integrate every other sprint |
| 2 | **The build is never left red.** A red `main` is the only interrupt that outranks the current task | Both lanes depend on `main` being a working baseline at any moment |
| 3 | **Contract changes go through [`integration-plan.md`](./integration-plan.md) §5.** Never a local workaround | `ADR-0031`'s drift control is that the specification is never stale |
| 4 | **Enablers are backlog items with points**, never background work | Unscheduled enablers are how the gate ends up unimplemented while the ADR says `Accepted` |
| 5 | **Exception flows are estimated with the story, not after it** | The exception flows *are* the requirement — `P5`–`P8` become test cases only when they are written down |
| 6 | **The demo runs the system.** No screenshots, no green test output as evidence of behaviour | A test proves a property; a demo proves a system |
| 7 | **An Integration Hardening sprint never absorbs late story work** | They are the only three sprints in which whole-system properties are verified |

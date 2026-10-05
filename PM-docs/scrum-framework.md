# Scrum Framework — Enterprise Commerce Platform (ECP)

**Document type:** Process Definition
**Audience:** Product Management, Engineering
**Version:** 1.0
**Status:** Draft for stakeholder review
**Related documents:** [`product-backlog.md`](./product-backlog.md) · [`release-plan.md`](./release-plan.md) · [`integration-plan.md`](./integration-plan.md) · [`definition-of-done.md`](./definition-of-done.md)

## 1. Team and roles

| Role | Held by | Responsibility |
|---|---|---|
| **Product Owner** | Stakeholder representative | Owns backlog order and MoSCoW priority, ratifies `A-01`–`A-13`, and may cut scope |
| **Backend developer** | 1 engineer | Owns `ecp-api`, the module graph, server-side contracts, and L1–L6 suites |
| **Frontend developer** | 1 engineer | Owns `ecp-web`, the route map, client-side contracts, and frontend suites |

There is no dedicated Scrum Master or QA role. [`release-plan.md`](./release-plan.md) §7 records this as `R3`. Build-failing quality gates provide the main control under [`ADR-0018`](../SA-docs/01-system/ADR/ADR-0018-architecture-governance-ci-gate.md). Facilitation rotates each sprint and uses half a day of capacity.

## 2. Cadence

Two-week sprints, Monday start.

| Ceremony | When | Duration | Notes |
|---|---|---|---|
| **Sprint Planning** | Day 1, morning | 2 h | Both lanes plan together |
| **Daily Sync** | Daily | 10 min | Both developers |
| **Contract Sync** | Last day of odd sprints | 1 day | Both developers, together. The checklist is [`integration-plan.md`](./integration-plan.md) §3 |
| **Sprint Review** | Last day | 1 h | Demo against the running system |
| **Retrospective** | Last day | 45 min | One owned action added to the next sprint |
| **Backlog Refinement** | Mid-sprint | 1 h | Prepare the next two sprints to the Definition of Ready |

Ceremonies use about 5% of normal-sprint capacity and 15% of gate-sprint capacity. The velocity assumption includes this cost.

## 3. Board

```nano
                 │ Ready │ In progress │ In review │ Integrated │ Done
  Backend lane   │       │             │           │            │
  Frontend lane  │       │             │           │            │
```

Each story has backend and frontend slices, such as `US-ORD-05/BE` and `US-ORD-05/FE`. The slices may run in different sprints. A merged slice waits in `Integrated` until Contract Sync verifies it with the other lane. The story reaches `Done` after both slices pass.

## 4. Estimation

Use Fibonacci points `1`, `2`, `3`, `5`, `8`, and `13`. One point is about half an ideal developer-day.

| Points | Shape of the work |
|---|---|
| 1–2 | A single endpoint or a single screen over existing structure. No new decision |
| 3 | Ordinary work in a module that already exists |
| 5 | A new aggregate, a new screen with its own data needs, or an endpoint with real exception flows |
| 8 | A new module, a new read model, or a story whose exception flows carry a business rule |
| 13 | Spans modules or has a concurrency guarantee to prove. **`US-ORD-05` is the only 13 in the backlog** |

Split items above 13 before planning. `EN-EVENT-1` is a 21-point enabler epic, not one item. Estimates include tests, migrations, and `loading.tsx` where applicable.

### 4.1 Velocity

| | Value |
|---|---|
| Assumed velocity | **20 points per lane per sprint** |
| Sprint 00 | 14 points |
| Backend actual load | 18–23 points/sprint, averaging 19.7 |
| Frontend actual load | 0–23 points/sprint, averaging 13.7; unused capacity is reserve under [`release-plan.md`](./release-plan.md) §6 |

Velocity is an assumption until Sprint 03 completes. Re-baselining changes dates, not sprint order.

## 5. Sprint planning

1. Confirm the sprint goal from [`release-plan.md`](./release-plan.md).
2. Pull the ordered and estimated items. Do not re-estimate them during planning.
3. Check each item against the Definition of Ready in [`definition-of-done.md`](./definition-of-done.md) §2. Return failed items to Refinement.
4. Break each slice into tasks of a day or less, in the sprint backlog file.
5. Name the item most likely to cause a contract problem at the next gate.

## 6. Working agreements

| # | Agreement | Why |
|---|---|---|
| 1 | Use trunk-based branches. Merge or abandon a branch after two days. | Keeps review and integration frequent. |
| 2 | Do not leave `main` red. | Both lanes need a working baseline. |
| 3 | Apply contract changes through [`integration-plan.md`](./integration-plan.md) §5. | Prevents local workarounds and stale specifications. |
| 4 | Put estimated enablers in the backlog. | Makes gate work visible and scheduled. |
| 5 | Estimate exception flows with the story. | Converts `P5`–`P8` into planned tests. |
| 6 | Demo the running system. | Screenshots and test output do not prove integration. |
| 7 | Do not place late story work in an Integration Hardening sprint. | Protects whole-system verification time. |

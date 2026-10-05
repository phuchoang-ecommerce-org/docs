# Product Management Plan — Enterprise Commerce Platform (ECP)

**Document type:** Index
**Audience:** Product Management, Engineering, Quality Assurance, Solution Architecture

This folder defines delivery order, ownership, integration gates, and completion rules. [Business Analysis](../BA-docs/README.md) owns scope. [Solution Architecture](../SA-docs/README.md) owns technical decisions.

## 1. Documents

| Document | What it covers |
|---|---|
| [`scrum-framework.md`](./scrum-framework.md) | Roles, two-week cadence, two-lane board, estimation, and re-baselining. |
| [`product-backlog.md`](./product-backlog.md) | All 87 stories, lane split, sprint, contract surface, and sixteen enabler epics. |
| [`release-plan.md`](./release-plan.md) | 36-sprint map, point loads, gates, risks, and schedule rules. |
| [`integration-plan.md`](./integration-plan.md) | Prism mocks, code generation, Contract Sync, hardening, and contract changes. |
| [`definition-of-done.md`](./definition-of-done.md) | Ready, lane, story, and release quality gates. |
| `sprint-backlogs/` | Planned task backlogs for Sprints 00–32 and IH-1–IH-3. This directory is not present in the current repo. |
| [`ih-1-hardening-findings.md`](./ih-1-hardening-findings.md) | Current IH-1 results, pending re-verification, blocked work, and unverified work. |

## 2. Reading order

Read [Business Analysis](../BA-docs/README.md) and [Solution Architecture](../SA-docs/README.md) first. Then read the files in the table from top to bottom.

## 3. Plan summary

| | |
|---|---|
| **Team** | One backend developer, one frontend developer. Two lanes, one backlog |
| **Scope** | 87 stories: 71 `Must`, 12 `Should`, and 4 `Could` |
| **Shape** | 36 two-week sprints: 33 delivery sprints plus 3 Integration Hardening sprints |
| **Duration** | About 17 months at the assumed velocity; re-baseline after Sprint 03 |
| **`Must` cut line** | End of Sprint 29 |
| **Critical path** | Backend, by about ten sprints |

### 3.1 Contract-first delivery

The normative [OpenAPI contract](../SA-docs/04-shared/OpenAPI/README.md) has 121 paths and 155 operations. The frontend uses it for Prism mocks and generated types. The backend is tested against the same file. This lets frontend work lead backend endpoints by one to three sprints.

### 3.2 Integration gates

| | Cadence | Duration |
|---|---|---|
| **Contract Sync** (`G0`–`G15`) | End of every odd sprint | 1 day, both developers, scoped to that increment's domains |
| **Integration Hardening** (IH-1, IH-2, IH-3) | After Sprint 09, Sprint 20, Sprint 29 | A full sprint each, no new stories |

IH-1 verifies session custody. IH-2 verifies the money path for `P6` and `P8`. IH-3 verifies the full system and records any unverified acceptance criteria.

## 4. Unverified claims

`AC-05` and `AC-06` are **unverified**. Both require the load rig deferred in [`Testing and Benchmark Strategy.md`](../SA-docs/01-system/Testing%20and%20Benchmark%20Strategy.md) §7.9.

## 5. Build

Build instructions are in the [repository README](../README.md#build).

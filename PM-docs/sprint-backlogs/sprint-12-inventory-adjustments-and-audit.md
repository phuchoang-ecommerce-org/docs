# Sprint 12 — Inventory: Adjustments, Levels & Audit Entries

**Release:** R1 · **Gate:** none · **Backend 21 pts · Frontend 13 pts**
**Related documents:** [`../release-plan.md`](../release-plan.md) · [`../integration-plan.md`](../integration-plan.md) · [`../../BA-docs/user-stories/04-inventory.md`](../../BA-docs/user-stories/04-inventory.md) · [`../../BA-docs/user-stories/14-audit-access-control.md`](../../BA-docs/user-stories/14-audit-access-control.md)

---

## Sprint Goal

> **Stock is adjustable and every command is audited.**

`US-AUD-01` lands here and not earlier for a stated reason: `UC-AUD-01` is worth building once there are commands worth auditing, and inventory adjustment is the first one that is a **direct financial control** (`P16`, `P17`). The audit stub that Sprints 03, 04, 05 and 09 have been logging through is replaced by real `audit_entry` persistence this sprint — the table has existed since Sprint 03, ahead of its code.

The hard part is not writing entries. It is `E4`: **an adjustment whose audit entry cannot be written is not applied.** Every command path delivered so far has to adopt that refusal, which is why this is an 8-point cross-cutting story rather than a 3-point table.

## Committed Items

| Lane | ID | Item | Pts |
|---|---|---|---:|
| BE | `US-INV-04` | Adjust Inventory | 5 |
| BE | `US-INV-05` | View Inventory Levels | 5 |
| BE | `US-ADM-05` | Manage Inventory Adjustments | 3 |
| BE | `US-AUD-01` | Record Audit Entry | 8 |
| | | **Backend total** | **21** |
| FE | `US-INV-04` | Adjust Inventory | 3 |
| FE | `US-INV-05` | View Inventory Levels | 5 |
| FE | `EN-FE-DS-6` | Order-status discriminated union; exhaustive transition rendering | 5 |
| FE | — | *Lane reserve — see [`../release-plan.md`](../release-plan.md) §6* | *5* |
| | | **Frontend total** | **13** |

---

## Backend Lane

### `US-AUD-01` Record Audit Entry (8 pts) — internal, every command path
- [ ] Real `audit_entry` persistence replacing the Sprint 03/04 `NotificationAndAuditStubListeners` stub; the table already exists from Sprint 03
- [ ] **`E1` — entry cannot be written and the action is reversible → the action is not applied.** This is the default and it is retrofitted onto *every* command path delivered so far: `US-CUS-08` profile updates (Sprint 05), all thirteen catalog writes (Sprint 09), and the adjustments in this sprint
- [ ] **`E2` — entry cannot be written and the effect is irreversible → the action stands, and the gap is escalated.** No such path exists yet (`UC-PAY-06` is Sprint 22, `UC-PRM-05` is Sprint 16) — build the distinction now so those sprints select a branch rather than invent one
- [ ] `E3` — amendment or deletion of an entry is **refused for every role including `ADMINISTRATOR`**, and the attempt is itself recorded as a security event (`BR-AUD-01`, `NFR-OBS-02`). Enforced at the schema and the port, not by the absence of an endpoint
- [ ] `E4` — an action with no identifiable actor is written **attributed to the originating process and flagged**, never left unrecorded
- [ ] `E5` — retention per **[A-13]** / `FR-DAT-05`; expiry is by policy and is itself recorded
- [ ] `audit`'s `allowedDependencies` and ArchUnit rules confirm no module reads another's entries directly
- [ ] Migrate the Sprint 03/04/05/09 stub call sites over and **delete the stub** — a stub left in place beside the real implementation is the next sprint's ambiguity

### `US-INV-04` Adjust Inventory (5 pts) — `adjustStock`, `listStockAdjustments`
- [ ] `E1` — a negative adjustment below reserved stock is **declined**, reporting how many units are reserved and against which orders. `ECP-INV-4091`. The record must never say the business holds less than it has already promised (`BR-INV-01`)
- [ ] `E2` — no reason supplied is declined (`BR-INV-03`). An adjustment that cannot answer "who, when, why" is what `P17` forbids
- [ ] `E3` — actor lacking authority is declined **and the attempt recorded** (`P16`)
- [ ] `E4` — audit write failure means the adjustment is **not applied**, and the whole thing is retried. Uses the `US-AUD-01` `E1` path above, not a local copy
- [ ] `E5` — concurrent adjustments to one SKU **both apply**, each computed against the value current when applied, both appearing separately in the trail. L5 concurrency test, same rig as Sprint 11's race

### `US-INV-05` View Inventory Levels (5 pts) — `listStockItems`, `getStockItem`, `listWarehouses`
- [ ] `E1` — quantities and warehouse structure are **never** exposed to `CUSTOMER` or `GUEST` (`BR-AUD-02`); permission-matrix cell asserted per operation
- [ ] `E2` — an unknown SKU reports unknown **without disclosing whether it once existed** — the same non-disclosure rule as Sprint 05's `getOwnAddress`
- [ ] `E3` — figures may briefly lag reservations in flight, and that is acceptable (`NFR-PERF-06`) because no decision here consumes stock
- [ ] Cursor pagination on the Sprint 02 envelope

### `US-ADM-05` Manage Inventory Adjustments (3 pts) — `listStockAdjustments`
- [ ] The operator-facing view of the adjustment history; `E1`–`E4` mirror `UC-INV-04`'s and must not diverge from them
- [ ] `E3` — authority declined **and recorded**; inventory adjustment is a standing internal-fraud risk (`P16`, `P17`)

---

## Frontend Lane

### `US-INV-05` View Inventory Levels (5 pts) — `/admin/inventory`, **R4**
- [ ] Filtered list of stock items with warehouse context, on the `EN-FE-DS-4` list→detail→action shell
- [ ] `E3` — the figures are **labelled as possibly lagging**, the same honesty the `/admin` dashboard applies to reporting lag. Displayed, not hidden
- [ ] `E2` — an unknown SKU renders the group `not-found`, which never explains why
- [ ] `loading.tsx` skeleton shaped like the table; pagination through the Sprint 05 control
- [ ] Hand-written Zod parsers for stock item, warehouse, and adjustment payloads
- [ ] Vitest + axe

### `US-INV-04` Adjust Inventory (3 pts) — `/admin/inventory/[stockItemId]`, **R4**
- [ ] Adjustment form; **reason is required client-side and the server remains the authority** (`E2`)
- [ ] `E1` — `ECP-INV-4091` renders the designed adjustment-declined screen with the server-supplied reserved quantity and the orders holding it. Not an error boundary, and not the storefront's "sold out" copy
- [ ] The adjustment history renders beneath, reading `listStockAdjustments` in its own boundary
- [ ] Vitest + axe

### `EN-FE-DS-6` Order-status discriminated union (5 pts)
- [ ] Order status modelled as a **discriminated union** per [`Frontend Architecture.md`](../../SA-docs/03-frontend/Frontend%20Architecture.md) §6.2, derived from the contract's enum rather than hand-listed
- [ ] Permitted next transitions are exhaustive at compile time — **an unhandled state is a build failure, not a blank action bar**
- [ ] A deliberately-added state that is not handled fails `npm run typecheck`. That demonstration is the deliverable, in the shape `EN-GATE-1` set in Sprint 01
- [ ] Built now, used from Sprint 17 — `ordering` does not exist yet, and this is the frontend running ahead as designed
- [ ] Vitest over the transition table

---

## Integration Risk

**`US-AUD-01` changes the behaviour of code that already passed a gate.** Every command path from Sprints 03, 05 and 09 acquires a new refusal branch this sprint. Nothing in the `G6` checklist will look at Sprint 09's catalog writes again, so the regression has to be caught here — re-run the catalog write paths with audit persistence failing, and confirm the change is refused rather than silently applied.

Second: `adjustStock`'s `ECP-INV-4091` and the storefront's are now genuinely different screens for one code. Confirm the error map routes by **context**, not by code alone.

## Definition of Done

Every item satisfies its lane's list in [`../definition-of-done.md`](../definition-of-done.md) §3 or §4, and every story reaches §5.

Additionally: **the audit stub is deleted, not deprecated.** Confirm at Review that no call site still logs through it.

## Review Notes

<!-- filled at Sprint Review -->

## Retrospective

**Went well:**
**Change one thing:**
**Action (owned, carried to next sprint's board):**

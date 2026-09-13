# Sprint 29 — Release 2 Stabilisation

**Release:** R2 · **Gate:** **`G14` — Contract Sync** · **Backend 21 pts · Frontend 8 pts**
**Related documents:** [`../release-plan.md`](../release-plan.md) · [`../integration-plan.md`](../integration-plan.md) · [`../../SA-docs/01-system/Testing%20and%20Benchmark%20Strategy.md`](../../SA-docs/01-system/Testing%20and%20Benchmark%20Strategy.md) · [`../definition-of-done.md`](../definition-of-done.md) §6

---

## Sprint Goal

> **Release 2 is stabilised and the event backbone is proved under failure.**

**This is the `Must` cut line.** Everything after it is capability the release can ship without, by the Product Owner's own MoSCoW assignment. All 71 `Must` stories are delivered by the end of this sprint — the viable release of SRS §1.5.

No user stories are committed. All 21 backend points are enablers, and each one closes a claim the plan has been carrying: `EN-BENCH-2` proves the outbox guarantee Sprint 08 asserted and IH-2 row 9 could only half-exercise; `EN-OBS-4` turns `NFR-AVAIL-02` from a design property into a harness that stops dependencies and watches the purchase path survive; `EN-CI-2` closes the pipeline at stage 7.

**IH-3 follows immediately.** This sprint's job is to leave it with findings rather than surprises.

## Committed Items

| Lane | ID | Item | Pts |
|---|---|---|---:|
| BE | `EN-CI-2` | CI stages 5–7; security, dependency and image scanning | 8 |
| BE | `EN-BENCH-2` | L6 event-delivery suite; broker killed mid-relay; read-model rebuild drill | 8 |
| BE | `EN-OBS-4` | NFR-AVAIL-02 dependency-failure harness (stop ES/Mongo, assert purchase path) | 5 |
| | | **Backend total** | **21** |
| FE | `EN-FE-E2E-3` | Release 2 regression walk — every `(admin)` route driven against the real API | 8 |
| FE | — | *Lane reserve — see [`../release-plan.md`](../release-plan.md) §6* | *10* |
| | | **Frontend total** | **8** |

---

## Backend Lane

### `EN-BENCH-2` L6 event-delivery suite; broker killed mid-relay; rebuild drill (8 pts)
- [ ] **Kill the broker mid-relay.** Take writes while it is down, bring it back, and confirm **the outbox drains on recovery without manual repair.** Sprint 08 demonstrated this once by hand; this makes it a suite that cannot silently stop being true
- [ ] Kill the **relay** rather than the broker, and confirm the same — a crash between publish and mark republishes, which is correct at-least-once behaviour and must not be mistaken for loss
- [ ] **The read-model rebuild drill**, properly: drop each projection — search (Sprint 10), rating summary (Sprint 24), the reporting models (Sprint 27), **and the payment read model** — and rebuild from the retained outbox alone via `EN-EVENT-4`'s replay path
- [ ] **The payment read model is the carried half of IH-2 row 9.** It is closed here or it is re-logged for IH-3 with a named owner — not passed silently
- [ ] Every rebuild converges and duplicates nothing, because consumers are idempotent (`EN-EVENT-2`). Re-prove it rather than assume it
- [ ] **Measure how long each rebuild takes.** An unmeasured recovery path is one nobody will choose under pressure
- [ ] Confirm the retention policy of [`Backend Architecture.md`](../../SA-docs/02-backend/Backend%20Architecture.md) §3.4.5 and the pruning obligation of [`ADR-0012`](../../SA-docs/01-system/ADR/ADR-0012-transactional-outbox-and-kafka.md) §5 are **reconciled**, with the partial index on unpublished rows in place — so the outbox does not become a `P10` problem of its own
- [ ] Testing Strategy §10's fourth coverage rule: **every domain event in [`Integration Contract.md`](../../SA-docs/04-shared/Integration%20Contract.md) §7 has an L4 test asserting a consumer reacts idempotently.** Audit that here; redelivery is normal under `NFR-REL-06`, not exceptional

### `EN-CI-2` CI stages 5–7 (8 pts)
- [ ] **Stage 5 — security scan**: dependency, secret, and image scanning per [`Security.md`](../../SA-docs/01-system/Security.md) §12.3. **Fail on critical.** Budget 3 min
- [ ] **Stage 6 — build & tag**: `bootJar`, `next build`, image tagged with the commit SHA. Fail. Budget 4 min
- [ ] **Stage 7 — smoke benchmark**: L7 against **stage 6's image**. **Report only** — [`ADR-0018`](../../SA-docs/01-system/ADR/ADR-0018-architecture-governance-ci-gate.md) §4 fixes this, and §7.2 rule 3 explains why: *a benchmark that blocks merges on a shared runner's noise gets disabled within a fortnight, and then nothing is measured at all*
- [ ] **Stage 7 runs against the `bootJar`, never a Gradle `bootRun`** — §7.2 rule 4, and IH-3 row 5 checks exactly this
- [ ] Warm-up discarded (rule 5); output is **movement against the last run**, not a certificate against `NFR-PERF-01` (rule 2)
- [ ] Stages 3–6 on every pull request and on `main`; **stage 7 nightly on `main` and on demand**
- [ ] With this, all seven stages of §9 exist. Confirm the budgets hold in practice — the fast suite's 3 minutes especially, since stage 2 is the never-skippable one

### `EN-OBS-4` `NFR-AVAIL-02` dependency-failure harness (5 pts)
- [ ] **Stop Elasticsearch and assert the purchase path continues**: browse by category, product detail, cart, checkout, payment. Search degrades and says so; nothing else does
- [ ] **Stop MongoDB and assert the same.** Reviews collapse to a section empty state, reporting reports its own failure, and **checkout is untouched** — `P13`'s separation running in both directions
- [ ] Stop Redis and confirm the Sprint 06 cache-aside answers identically from the database, and that the Sprint 04 rate limiter's `UC-AUD-04` `E6` fail-open behaviour holds — **requests proceed and the loss of the control is escalated**, because failing closed here turns a protective control into a total outage
- [ ] Stop the payment provider stub and the carrier stub: the platform **degrades rather than breaks** (`NFR-AVAIL-03`). This is IH-3 row 3, exercised first here
- [ ] A harness, not a checklist — runnable on demand, so IH-3 row 2 re-runs it rather than re-improvising it
- [ ] Generalises Sprint 24's review-specific `NFR-AVAIL-02` proof; fold that in rather than leaving two harnesses

---

## Frontend Lane

### `EN-FE-E2E-3` Release 2 regression walk (8 pts)
- [ ] **Every `(admin)` route driven against the real API** — products, categories, inventory, orders, payments, shipments, promotions, reviews, customers, roles, notifications, audit, and all five report screens
- [ ] This is the **first time several of them meet a real backend**: `/admin/audit` since Sprint 25, the report screens since Sprints 23–24
- [ ] For each route: the list renders, the detail renders, **one action is exercised**, and the designed failure screen is reached deliberately rather than assumed
- [ ] **Confirm the `(admin)` posture has not regressed**: a `CUSTOMER` reaching any of these routes sees the shell with empty sections and server-side `403`s — **never a redirect** (IH-1 row 5, [`Security.md`](../../SA-docs/01-system/Security.md) §13 T9). Every `(admin)` route carries `noindex` and is absent from the sitemap
- [ ] `SameSite=Strict` on `(admin)` cookies, unwidened CSP per route group
- [ ] **Keep it a walk, not a second e2e suite.** `EN-FE-E2E-1`'s thin purchase path stays thin; this is breadth over the admin surface, run deliberately, with findings logged
- [ ] Record what was walked and what was not, so Sprint 32 can restate coverage honestly

---

## Integration Risk

**This sprint commits no user story and therefore produces nothing a gate naturally checks.** `G14`'s scope is the audit trail from Sprint 28 and whatever the regression walk surfaces — the three enablers are verified by their own demonstrations or not at all.

The real exposure is **ordering**: `G14` closes Sprint 29 and IH-3 follows it. Anything `EN-BENCH-2` or `EN-OBS-4` finds late lands in a hardening sprint whose job is to confirm the system, not to repair it. Run both harnesses early in the sprint rather than at the end.

Second: **`EN-CONTRACT-3` landed last sprint and supersedes check 7's manual walk.** `G14` should cite the suite rather than re-walk cells by hand — and if the suite is not yet in stage 4, that is a finding about Sprint 28, not a reason to fall back quietly.

## Gate `G14` — Contract Sync

Checklist: [`../integration-plan.md`](../integration-plan.md) §3.1, scoped to the audit trail and contract completeness.

| # | Check |
|---|---|
| 1 | Types regenerated, diff empty — CI-enforced since Sprint 24 |
| 2 | Contract test **spec→code** across `searchAuditTrail` and `getAuditEntry`, as a pipeline stage |
| 3 | Contract test **code→spec** — **no audit write, amend, or delete endpoint exists**, which is the substantive check, not a formality |
| 4 | `/admin/audit` renders against the real API, and the `EN-FE-E2E-3` walk has driven every other `(admin)` route |
| 5 | Pagination envelope and cursor shape match on `searchAuditTrail` |
| 6 | **Designed screens:** "no matching entries" **distinguishable from "the search did not run"** · an over-large range asking the actor to narrow rather than returning a truncated set · entries beyond retention stated as unavailable, not silently omitted |
| 7 | **Permission matrix — cite `EN-CONTRACT-3`'s generated suite, do not re-walk by hand.** Confirm it covers all 155 operations with both halves of each cell, and that amendment of an audit entry is refused for `ADMINISTRATOR` too |
| 8 | `Money` unaffected in this increment |
| 9 | One correlation id across browser → API on an audit search, and a command issued during the gate appears in the trail with that id |
| 10 | Drift logged **and** `openapi.yaml` amended in the same session |
| — | **The `Must` cut line.** Confirm at this gate that all 71 `Must` stories are delivered, and record any that are not, by id, with a named sprint |

## Definition of Done

Every item satisfies its lane's list in [`../definition-of-done.md`](../definition-of-done.md) §3 or §4, and every story reaches §5.

**Release 2's release-level criteria apply**: the `AC-01`–`AC-06` table of [`../definition-of-done.md`](../definition-of-done.md) §6. Its expected state is recorded there, including that **`AC-05` is unverified and `AC-06` partially met** — the fault-injection half passes and the peak-load half is deferred. Do not fill it in optimistically here; IH-3 row 9 and Sprint 32's readiness review both depend on it being honest.

**IH-3 begins next.** Confirm at Review which enabler findings are carried, so they enter IH-3's "Known Gaps Carried In" rather than being discovered as failures.

## Review Notes

<!-- filled at Sprint Review -->

## Retrospective

**Went well:**
**Change one thing:**
**Action (owned, carried to next sprint's board):**

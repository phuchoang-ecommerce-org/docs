# IH-3 — Integration Hardening: Whole System

**Release:** R2 · **Position:** after Sprint 29, before Sprint 30 · **No new stories · no story points**
**Related documents:** [`../release-plan.md`](../release-plan.md) · [`../integration-plan.md`](../integration-plan.md) §4 · [`./ih-1-session-and-catalog.md`](./ih-1-session-and-catalog.md) · [`./ih-2-the-money-path.md`](./ih-2-the-money-path.md)

---

## Goal

> **The whole system, and an honest statement of what is still unverified.**

The second half of that sentence carries as much weight as the first. IH-1 hardened session custody because it is hardest to retrofit. IH-2 hardened the money path because its failures cost money. **IH-3 audits the whole system and then states plainly what it could not verify** — which is a deliverable, not a shortfall.

The `Must` cut line was Sprint 29. Every `Must` story is delivered and every enabler has landed. What remains is to check the properties that span all of them, and to write down, without softening, that **`AC-05` and `AC-06` are unverified** because the load rig they depend on is deliberately deferred ([`Testing and Benchmark Strategy.md`](../../SA-docs/01-system/Testing%20and%20Benchmark%20Strategy.md) §7.9, with five dated triggers that end the deferral).

**Row 9 is the one row that passes by recording a failure.** A row 9 reported as "in progress" fails; a row 9 reported as "unverified" passes. That inversion is the entire point of this sprint, and it is the failure mode `P15` describes arriving through the last available door.

Both developers, both lanes, full sprint. **No new stories, no points.**

---

## The Nine Rows

Each row is from [`../release-plan.md`](../release-plan.md) §4's IH-3 block. The tasks under each say *how* it is demonstrated — a row is passed by a demonstration, never by a code reading.

### 1 — The full security verification matrix, every row
*Source: [`Security.md`](../../SA-docs/01-system/Security.md) §12.1*
- [ ] Walk **every row** of §12.1's requirement→test matrix. Not a sample, not the rows that changed recently — every row, with the evidence recorded against it
- [ ] Confirm the rows §12.1 owns that structure cannot: [`ADR-0018`](../../SA-docs/01-system/ADR/ADR-0018-architecture-governance-ci-gate.md) §5 concedes that *calling* `AuthorizationService` is structurally checkable but calling it **with the right permission** is not. `EN-CONTRACT-3` (Sprint 28) is that test — confirm it is in the pipeline and covers all 155 operations
- [ ] Confirm the fail-closed/fail-open split is **tested rather than assumed** ([`ADR-0015`](../../SA-docs/01-system/ADR/ADR-0015-redis-cache-and-rate-limiting.md) §4): authorisation fails closed (`UC-AUD-03` `E7`), rate limiting fails open and escalates (`UC-AUD-04` `E6`). Both, deliberately, in the same session — they are opposite answers and getting them the wrong way round is invisible until it matters
- [ ] Re-confirm IH-1's session rows have not regressed: no access token in the browser, CSRF on every cookie-authenticated write, refresh serialised
- [ ] A row whose evidence is "it was checked at an earlier gate" is **not passed**. Re-demonstrate or log it

### 2 — Elasticsearch and MongoDB stopped; browse, cart, checkout and payment continue
*Source: `NFR-AVAIL-02`*
- [ ] Run Sprint 29's `EN-OBS-4` harness rather than improvising: stop Elasticsearch, then MongoDB, then both
- [ ] With Elasticsearch down: **search degrades and says so**, returning `ECP-GEN-5030` and not `ECP-SCH-5030`; category browse, product detail, cart, checkout and payment all work
- [ ] With MongoDB down: **reviews collapse to a section empty state**, recommendation rails disappear **silently**, reporting reports its own failure, and **checkout is untouched**
- [ ] With both down: the purchase path still completes end to end. Place a real order
- [ ] **Discovery degrades before the purchase path does, and revenue is where availability is preserved** (`P9`). Confirm that ordering holds rather than assuming it
- [ ] Bring each back and confirm recovery needs no manual repair

### 3 — Provider stub adapters fail and time out on demand; the platform degrades rather than breaks
*Source: `NFR-AVAIL-03`*
- [ ] **This is the half usually skipped**, and [`../release-plan.md`](../release-plan.md) §7 R6 says so: no developer holds a live credential, so the stubs are all there is — which makes their *failure* modes the only provider behaviour that can be verified before staging
- [ ] Payment provider: **decline**, **unreachable**, and **timeout**, each distinct. `UC-PAY-02` `E1`/`E3`/`E2` — and a timeout leaves the order in **Pending Payment with its reservation held**, never cancelled
- [ ] Carrier: rejection leaves the order in **Packed** and records no shipment (`UC-SHP-03` `E2`/`E3`); an unreachable carrier offers an alternative where one serves the destination
- [ ] Email provider: rejection records **failed** then **undeliverable** after the configured attempts, and **never marked delivered** (`BR-NTF-01`); unreachable leaves it **pending** and retries
- [ ] Shipping rate lookup: a configured fallback rate is used **and identified as such**; otherwise the platform reports and permits retry and **never estimates** (`BR-SHP-01`)
- [ ] In every case the platform's own state stays consistent. **A provider outage must not corrupt platform state**

### 4 — Projection lag asserted under an event burst against the five-minute bound
*Source: `NFR-PERF-06`*
- [ ] Re-run Sprint 27's `EN-DATA-5` measurement **under a burst**, not at rest. Lag at rest is always fine; the bound exists for the burst
- [ ] Every projection, not only reporting: search (Sprint 10), rating summary (Sprint 24), reporting models (Sprint 27), payment read model (Sprints 21–22)
- [ ] Confirm the measured lag is what the screens **display** — the `asAt` an operator reads must be the real one, or `UC-RPT-01` `E2`'s honesty is cosmetic
- [ ] Confirm a figure past the bound is **labelled stale** end to end, from the projection through the API to the rendered screen
- [ ] Record the measured numbers. This is a bound that will drift, and a number recorded here is what a future regression is compared against

### 5 — k6 smoke run against the `bootJar`, not a Gradle `bootRun`
*Source: [`Testing and Benchmark Strategy.md`](../../SA-docs/01-system/Testing%20and%20Benchmark%20Strategy.md) §7.2 rule 4*
- [ ] Run scenarios S1–S5 against **stage 6's built image** — the `bootJar` on the same image versions, **not** a Gradle `bootRun` with dev tooling attached
- [ ] Confirm `EN-CI-2`'s stage 7 is wired to stage 6's artefact and not to a convenience task. This is the single thing this row exists to catch
- [ ] Warm-up discarded (rule 5); output read as **movement against the last run**, not as a certificate against `NFR-PERF-01` (rule 2)
- [ ] **Report only, never build-failing** (rule 3)
- [ ] Record the numbers **and their limitations**: S1 is cache-warm on purpose, which says nothing about cold-start behaviour after a deployment or a Redis eviction (§7.8). Order placement is excluded because it consumes reserved stock (§7.3)
- [ ] **These numbers are not capacity evidence and must not be presented as any.** That is what the deferred load rig is for

### 6 — Every Micrometer meter named in `Deployment Diagram.md` §8 exists
*Source: `NFR-OBS-04`*
- [ ] Enumerate §8's meters and check each against the running application **by name**. A meter with a plausible but different name is an unmonitored meter
- [ ] Include the meters added since `EN-OBS-2` (Sprint 07): cache hit/miss, outbox backlog and relay lag, DLQ depth, projection lag per read model
- [ ] Confirm none leaks onto the public port — the management port only (`EN-OBS-1`, Sprint 04)
- [ ] Confirm `EN-OBS-3`'s continuous correlation-id assertion still holds, and that **no card detail, token, or personal identifier rides in the trace**

### 7 — Every business rule in SRS §4 has an L1 test naming its `BR-` id
*Source: [`Testing and Benchmark Strategy.md`](../../SA-docs/01-system/Testing%20and%20Benchmark%20Strategy.md) §10*
- [ ] All **40 rules**. Grep the suites for each `BR-` id and confirm a test names it — this is mechanical and should be a script, so it can be re-run rather than re-audited
- [ ] `P5` is a claim about **enforcement**, so an unenforced rule is the whole failure — not a coverage gap
- [ ] Confirm the rules that hold "whatever entry point the request arrives through" are tested through **more than one** path: REST, scheduler, and Kafka (`AC-02`). `BR-AUD-02`, `BR-ORD-01`, `BR-REV-01` and `BR-INV-01` are the ones that say so explicitly
- [ ] A rule covered only incidentally, by a test that exercises it without naming it, **does not count** — the naming is what makes the coverage auditable
- [ ] Log every gap as a sized backlog item with a named sprint

### 8 — Every `Must` use case's exception flows are covered, not only its main flow
*Source: [`Testing and Benchmark Strategy.md`](../../SA-docs/01-system/Testing%20and%20Benchmark%20Strategy.md) §10*
- [ ] [`traceability-matrix.md`](../../BA-docs/traceability-matrix.md) §6 states the principle: *"what makes `FR-ORD-08` testable is the ten exception flows of `UC-ORD-05`"*. Start there — all ten of `UC-ORD-05`'s
- [ ] Then every other `Must` use case, exception flow by exception flow. The concurrency and partial-failure flows are the ones most likely to have been skipped: `UC-INV-01` `E2`/`E3`, `UC-PRM-02` `E7`, `UC-ORD-10` `E3`/`E5`, `UC-PAY-02` `E2`/`E4`, `UC-PAY-03` `E4`
- [ ] Confirm the **audit-branch pairs** are both covered, since they are opposite answers to the same trigger: `UC-INV-04` `E4` and `UC-ADM-06` `E5` refuse the action; `UC-PAY-06` `E7` and `UC-PRM-05` `E5` let it stand and escalate
- [ ] Record the audit as a list, per use case, with gaps named. **Coverage that is assumed rather than recorded is what this row exists to replace**
- [ ] Line coverage is measured and reported but **is not a gate** (§10) — do not substitute a percentage for this audit

### 9 — `AC-05` and `AC-06` recorded as **unverified**, not as in progress
*Source: [`Testing and Benchmark Strategy.md`](../../SA-docs/01-system/Testing%20and%20Benchmark%20Strategy.md) §11 · [`../definition-of-done.md`](../definition-of-done.md) §6*
- [ ] Fill in the `AC-01`–`AC-06` table of [`../definition-of-done.md`](../definition-of-done.md) §6 **truthfully**, against what this sprint actually demonstrated
- [ ] **`AC-05` — reporting does not impact transactions — is `Unverified — deferred`.** It rests on `NFR-PERF-05` concurrent load, and the load rig is deferred. Sprint 26 proved reporting never touches the write model, which is necessary and **not sufficient**
- [ ] **`AC-06` — production-quality architecture — is `Partially met`.** The fault-injection half passes (rows 2, 3 and Sprint 29's `EN-BENCH-2`); **the peak-load half is deferred**
- [ ] `AC-03` is `Reviewed, not tested` — it is a design review, not a suite, and saying otherwise would be the same failure in miniature
- [ ] **Neither `AC-05` nor `AC-06` is recorded as "in progress".** "In progress" implies work underway that will close it; the deferral is a **decision** with five dated triggers (§7.9), and describing a decision as progress is how it stops being visible
- [ ] Confirm the five triggers are still recorded and still current. A deferral whose triggers have quietly lapsed is an omission wearing a decision's clothes
- [ ] **A release is Done when this table is filled in truthfully, not when every row says met** ([`../definition-of-done.md`](../definition-of-done.md) §6). Sprint 32's readiness review restates this table; it can only restate what is recorded here

---

## Known Gaps Carried In

From IH-2's explicitly carried rows and Sprint 29's Review, revisited here rather than rediscovered:

- [ ] **IH-2 row 8, carried half** — the **real payment provider callback**, including that it terminates at `nginx` and never passes through `ecp-web`. IH-2 passed the row on the carrier substitute and deferred this deliberately. Close it under row 1 or re-log it with a named sprint
- [ ] **IH-2 row 9, carried half** — the **payment read-model replay**. Sprint 29's `EN-BENCH-2` was to close it; confirm under row 4, or re-log
- [ ] **`EN-CONTRACT-3` findings** from Sprint 28 — authorisation defects, not test defects. Confirm each was triaged in-sprint as required, and that none was carried silently
- [ ] **`EN-FE-E2E-2` findings** from Sprint 27's accessibility sweep — all were to be logged as sized items with named sprints. Confirm none was fixed-if-easy and left unrecorded otherwise
- [ ] **Anything `G14` recorded against the `Must` cut line** — any `Must` story not delivered by Sprint 29, by id, with its named sprint

---

## Exit Criterion

> Every row above passes, **or** the failure is a logged, sized backlog item with a named sprint.

**A row is never marked passed on a local workaround.** A finding resolved by changing an environment variable, disabling a check, lowering a burst rate until the lag fitted, or running the demonstration a second way until it worked is an **open finding**, and it is recorded as one.

**Row 9 passes by recording two criteria as unverified.** If row 9 reads "in progress", or reads "met", it has failed — whatever the rest of the table says.

## Review Notes

<!-- filled at Sprint Review -->

## Retrospective

**Went well:**
**Change one thing:**
**Action (owned, carried to next sprint's board):**

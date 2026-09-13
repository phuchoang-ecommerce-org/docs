# Sprint 32 — Release 3: Reviews, Reporting & Launch Readiness

**Release:** R3 · **Gate:** **`RR` — Release Readiness Review** · **Backend 23 pts · Frontend 19 pts**
**Related documents:** [`../release-plan.md`](../release-plan.md) · [`../definition-of-done.md`](../definition-of-done.md) §6 · [`../../SA-docs/01-system/Testing%20and%20Benchmark%20Strategy.md`](../../SA-docs/01-system/Testing%20and%20Benchmark%20Strategy.md) §11 · [`./ih-3-whole-system.md`](./ih-3-whole-system.md)

---

## Sprint Goal

> **The release is ready and its unverified claims are stated as unverified.**

The last sprint of thirty-six. Six stories close the backlog — all 87 user stories delivered — and then the sprint does the thing the whole document set has been building toward: it **completes the `AC-01`–`AC-06` table honestly**.

`AC-05` and `AC-06` are recorded as **unverified**, pending the load rig ([`Testing and Benchmark Strategy.md`](../../SA-docs/01-system/Testing%20and%20Benchmark%20Strategy.md) §11, §7.9). IH-3 row 9 already established that; this sprint restates it in the release's own words rather than softening it on the way out. **A release is Done when the table is filled in truthfully, not when every row says met** ([`../definition-of-done.md`](../definition-of-done.md) §6) — and a delivery plan that quietly claims what the test strategy says is unverified is the failure mode `P15` describes, arriving through the last available door.

Two stories carry a rule worth naming. `US-REV-05` `E5`: **a moderation whose audit entry cannot be written is not applied** — nothing external has happened, so refusing is safe, and an unattributable suppression of a customer's words is precisely what `P17` forbids. And `US-NTF-04` `E1`: **transactional notifications cannot be disabled** (`BR-NTF-02`) — a customer who does not know their order shipped will contact Support, and one who does not know they were refunded may dispute the charge.

## Committed Items

| Lane | ID | Item | Pts |
|---|---|---|---:|
| BE | `US-REV-02` | Edit Own Review | 3 |
| BE | `US-REV-03` | Delete Own Review | 2 |
| BE | `US-REV-05` | Moderate Review | 5 |
| BE | `US-NTF-04` | Manage Notification Preferences | 3 |
| BE | `US-RPT-03` | View Customer Report | 5 |
| BE | `US-RPT-06` | Export Report | 5 |
| | | **Backend total** | **23** |
| FE | `US-REV-02` | Edit Own Review | 3 |
| FE | `US-REV-03` | Delete Own Review | 2 |
| FE | `US-REV-05` | Moderate Review | 3 |
| FE | `US-NTF-04` | Manage Notification Preferences | 3 |
| FE | `US-RPT-03` | View Customer Report | 3 |
| FE | `US-RPT-06` | Export Report | 5 |
| | | **Frontend total** | **19** |

**Both lanes carry the same six stories, and neither has reserve.** Plan the readiness review as work inside the sprint, not as something that happens after the stories are done.

---

## Backend Lane

### `US-RPT-06` Export Report (5 pts) — `requestReportExport`, `getReportExport`, `downloadReportExport`
- [ ] **`E1` — export must never be a route to data the actor could not view.** Authority for the underlying report is checked first; otherwise export becomes a privilege-escalation path around every control in the specification (`BR-AUD-02`, `P16`)
- [ ] **`E2` — an export exceeding the permitted size is declined** and the actor asked to narrow the period or filters. An unbounded export is both an operational risk and a data-exfiltration risk
- [ ] **`E3` — where an export contains personal data, the audit entry records that personal data left the platform** (`UC-RPT-03` `E4`, `P17`)
- [ ] Asynchronous: request → poll → download, so a large export does not hold a request open
- [ ] The download link is single-use or short-lived and **scoped to the requesting actor** — an export URL that outlives its authorisation is the same escalation `E1` prevents, arriving later

### `US-REV-05` Moderate Review (5 pts) — `moderateReview`, `listReviews`, `getReview`, `removeReviewImage`
- [ ] `E1` — authority declined **and recorded**. Moderation is the authority to suppress a customer's published words and is restricted accordingly (`P16`)
- [ ] `E2` — an already-moderated review **presents the existing decision** rather than applying a second, so the trail records one decision per action
- [ ] `E3` — no reason supplied is declined. A removal without a recorded reason cannot be defended to the author, to Legal, or to an auditor (`BR-AUD-01`, `P17`)
- [ ] `E4` — an author deleting during moderation still has the decision **recorded against the deleted review**, so their conduct remains visible even though the content is gone
- [ ] **`E5` — a failed audit write means the moderation is not applied.** This follows `UC-INV-04` `E4`, **not** `UC-PAY-06` `E7` — nothing external has happened, so refusing is safe
- [ ] `E6` — a failed notification to the author lets the moderation **stand** and retries (`BR-NTF-01`). Content breaching policy is not restored because a message failed
- [ ] Rating summary recalculated through the Sprint 24 `EN-EVENT-6` projection, never synchronously

### `US-RPT-03` View Customer Report (5 pts) — `getCustomerReport`
- [ ] `E3` — a reporting outage reports the failure and **transactional operations are unaffected** (`UC-RPT-01` `E3`)
- [ ] **`E4` — customer-level export is permitted only where the role allows it, and is audited** (`UC-RPT-06`). Personal data leaving the platform is precisely the exposure `P16` and `P17` require to be traceable
- [ ] Reads the MongoDB read model only, per Sprint 26's `CON-06` rule; the as-at and staleness treatment of `UC-RPT-01` `E1`/`E2` applies unchanged

### `US-REV-02` Edit Own Review (3 pts) — `editOwnReview`
- [ ] **`E1` — a passed edit window declines, stating when it closed.** An unbounded edit window lets a favourable review be rewritten long after it has accrued visibility, which is a known abuse channel (`BR-REV-03`)
- [ ] `E2` — another customer's review is declined **and the attempt recorded** (`P16`)
- [ ] `E3` — a moderator-removed review is declined, so **a removed review cannot be edited back into visibility**
- [ ] **`E4` — a failed validation leaves the original unchanged.** A failed amendment never destroys the existing review
- [ ] Closes the offer `UC-REV-01` `E3` has made since Sprint 24

### `US-NTF-04` Manage Notification Preferences (3 pts) — `getOwnNotificationPreferences`, `setOwnNotificationPreferences`, `unsubscribeFromPromotionalNotifications`
- [ ] **`E1` — opting out of transactional notifications is declined.** Order, payment and shipment notifications about a customer's own transactions cannot be disabled (`BR-NTF-02`). The rule has been enforced since Sprint 23; this is the surface that explains it
- [ ] `E2` — an expired or consumed unsubscribe token declines and offers signing in. **The customer is never left with no route to opt out**
- [ ] **`E3` — a failed store changes nothing and says so.** A silent failure means unwanted mail continues while the customer believes it has stopped — a compliance exposure as much as an annoyance
- [ ] `E4` — a notification already in flight may still be delivered; preferences are evaluated when a notification is raised and **the platform does not claim retrospective effect**
- [ ] `E5` — another customer's preferences declined and recorded

### `US-REV-03` Delete Own Review (2 pts) — `deleteOwnReview`, `removeReviewImage`
- [ ] `E1` — another customer's review declined and recorded
- [ ] `E2` — an already-deleted review reports success; the goal already holds
- [ ] **`E3` — a failed aggregate recalculation still withdraws the review from display** and retries (`NFR-REL-04`). A briefly stale aggregate is preferable to a withdrawn review remaining visible

---

## Frontend Lane

### `US-RPT-06` Export Report (5 pts) — `/admin/reports/exports`, **R4**
- [ ] Request → poll → download, matching the asynchronous backend shape
- [ ] **`E2` — an over-large export renders the designed narrow-your-filters screen**, not a generic error
- [ ] **Where an export contains personal data, the screen says so before the request is made.** `E3` audits it; the UI should not let it happen unknowingly
- [ ] The export list shows each request's state and age; a completed export states when its link expires
- [ ] `loading.tsx`; hand-written Zod parsers; Vitest + axe

### `US-REV-05` Moderate Review (3 pts) — `/admin/reviews`, `/admin/reviews/[reviewId]`, **R4**
- [ ] Reads `listReviews`, `getReview` and the reports `reportReview` produced; writes `moderateReview`, `removeReviewImage`
- [ ] **Reason is required by the form**, and the server remains the authority (`E3`)
- [ ] `E2` — an already-moderated review **shows the existing decision** and does not offer a second
- [ ] `E5` — a failed audit write renders the moderation as **not applied**, never as applied-with-a-warning
- [ ] Vitest + axe

### `US-NTF-04` Manage Notification Preferences (3 pts) — `/account/preferences`, `/unsubscribe`, **R3**
- [ ] **Transactional notification toggles are not drawn as disabled controls — they are not drawn.** The screen explains why (`BR-NTF-02`), because a greyed-out switch invites a support ticket
- [ ] `/unsubscribe` works from an email link **without a session**; `E2` — an expired token offers signing in rather than a dead end
- [ ] **`E3` — a failed store shows the previous state and says the change did not apply.** Never an optimistic success
- [ ] `E4` — the screen states that preferences apply to notifications raised from now on
- [ ] Vitest + axe

### `US-REV-02` Edit Own Review (3 pts) · `US-REV-03` Delete Own Review (2 pts) — `/account/reviews`, **R3**
- [ ] The customer's own reviews with edit and delete; `E1` states when the edit window closed rather than hiding the control silently
- [ ] `E4` on edit — a failed validation **leaves the original intact and visible**; the form never clears
- [ ] Delete is optimistic and reverts visibly on failure, the Sprint 13 pattern
- [ ] Vitest + axe

### `US-RPT-03` View Customer Report (3 pts) — `/admin/reports/customers`, **R4**
- [ ] The as-at, staleness, incomplete and explicit-zero treatments established in Sprint 23 — one implementation, reused
- [ ] Export from this screen routes through `US-RPT-06`'s authority and audit path, never a client-side download
- [ ] Vitest + axe

---

## Integration Risk

**There is no Contract Sync gate after this sprint.** `G15` was the last, and the Release Readiness Review states status rather than finding defects. Six stories on both lanes integrate with nothing scheduled behind them — so the integration has to happen *inside* the sprint, deliberately, not at a gate that does not exist.

Second, and the one this sprint most needs to resist: **the readiness review will be under pressure to look finished.** `AC-05` and `AC-06` will be sitting at unverified in the last sprint of a seventeen-month plan, and the cheapest available edit is to call them "in progress". IH-3 row 9 anticipated this; so does [`../definition-of-done.md`](../definition-of-done.md) §6. The correct outcome is a table with two honest failures in it.

Third: neither lane has reserve. If a story slips, the readiness review is what gets compressed — which is exactly backwards. **Timebox the review and protect it at Planning.**

---

## `RR` — Release Readiness Review

The `AC-01`–`AC-06` table of [`../definition-of-done.md`](../definition-of-done.md) §6, completed honestly. Not a Contract Sync gate — a statement of what is verified and what is not.

| Criterion | Verified by | Expected status |
|---|---|---|
| `AC-01` Core workflows function correctly | L1 + L4 + the thin Playwright suite over `Must` use cases | **Met** |
| `AC-02` Rules enforced regardless of entry point | Each rule exercised through REST, scheduler, and Kafka paths | **Met** |
| `AC-03` New modules added with minimal modification | Worked example, reviewed | **Reviewed, not tested** — a design review, not a suite |
| `AC-04` Maintainable as complexity grows | L2 | **Met** |
| `AC-05` Reporting does not impact transactions | `NFR-PERF-05` concurrent load | **Unverified — deferred** |
| `AC-06` Production-quality architecture | L5 + L6 + Security §12, **and** peak-load evidence | **Partially met** — the fault-injection half passes; the peak-load half is deferred |

- [ ] Fill the table from **what was demonstrated**, not from what was intended. IH-3's row-by-row record is the evidence
- [ ] **`AC-05` and `AC-06` are recorded as not-yet-met, never as "in progress".** The load rig they depend on is deliberately deferred with five dated triggers (§7.9). Describing a decision as progress is how it stops being visible
- [ ] Confirm the five triggers are still recorded and still current
- [ ] State plainly which NFRs remain unverified alongside them: `NFR-SCAL-01`–`06` and `NFR-PERF-05` ([`../release-plan.md`](../release-plan.md) §7 R7)
- [ ] Restate the k6 smoke numbers **with their limitations** — comparative not absolute, S1 cache-warm, order placement excluded — and confirm they are not presented anywhere as capacity evidence
- [ ] Record accessibility coverage from Sprint 27's sweep: what was swept, what was not, and which findings remain open with named owners
- [ ] Record every IH-1, IH-2 and IH-3 row that was **logged rather than passed**, with its backlog item and named sprint
- [ ] Confirm all 87 user stories are delivered, or name the exceptions by id
- [ ] **A release is Done when this table is filled in truthfully, not when every row says met**

## Definition of Done

Every item satisfies its lane's list in [`../definition-of-done.md`](../definition-of-done.md) §3 or §4, and every story reaches §5.

**The release-level definition is [`../definition-of-done.md`](../definition-of-done.md) §6**, and it is met by an honest table — not by a full one.

## Review Notes

<!-- filled at Sprint Review -->

## Retrospective

**Went well:**
**Change one thing:**
**Action (owned, carried to next sprint's board):**

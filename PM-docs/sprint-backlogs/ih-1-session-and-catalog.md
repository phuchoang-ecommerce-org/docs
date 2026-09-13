# IH-1 — Integration Hardening: Session & Catalog

**Release:** R1 · **Position:** after Sprint 09, before Sprint 10 · **No new stories · no story points**
**Related documents:** [`../release-plan.md`](../release-plan.md) · [`../integration-plan.md`](../integration-plan.md) §4 · [`../definition-of-done.md`](../definition-of-done.md)

---

## Goal

> **Session and catalog, end to end.**

This is not a Contract Sync gate and it is not a catch-up sprint. A gate checks the increment just delivered; IH-1 checks the **properties that no single increment owns** — session custody, boundary posture, the invalidation chain, and one correlation id running the length of it.

IH-1 sits first of the three hardening sprints because **session custody is the hardest thing in the plan to retrofit**. Every later sprint assumes it; if it is wrong, it is wrong everywhere at once.

Both developers, both lanes, full sprint. **No new stories are committed and no points are carried** — an IH sprint that takes on delivery work is an IH sprint that reports green because it ran out of time to look.

---

## The Nine Rows

Each row below is from [`../release-plan.md`](../release-plan.md) §4's IH-1 block. The tasks under each say *how* it is demonstrated — because a row is passed by a demonstration, never by a code reading.

### 1 — No access token reaches the browser
*Source: [`Frontend Architecture.md`](../../SA-docs/03-frontend/Frontend%20Architecture.md) §8*
- [ ] Sign in, then inspect every channel the browser can see: cookies, `localStorage`, `sessionStorage`, the HTML payload, every RSC flight response, and the network tab. **The access token appears in none of them**
- [ ] Confirm the same after a refresh and after a full page reload, not only on the first render
- [ ] Confirm no Server Action or route handler echoes the token into a response body or an error message

### 2 — CSRF required on every cookie-authenticated write
*Source: [`Frontend Architecture.md`](../../SA-docs/03-frontend/Frontend%20Architecture.md) §4.3*
- [ ] Enumerate every cookie-authenticated write delivered so far — `(auth)`, `(account)`, `(admin)` — and replay each **without** the double-submit token. Every one is refused
- [ ] Replay each with a token from a *different* session. Every one is refused
- [ ] The enumeration is the artefact: a write that was never listed is a write that was never tested

### 3 — Refresh is serialised under concurrent requests
*Source: [`Frontend Architecture.md`](../../SA-docs/03-frontend/Frontend%20Architecture.md) §4.2*
- [ ] Drive N concurrent requests through an expired access token and assert **exactly one** refresh call reaches `ecp-api`
- [ ] Assert no request fails as a side effect of losing the race — the losers wait, they do not error
- [ ] Repeat with the refresh itself failing: every waiter resolves to the same designed outcome, and none is left hanging

### 4 — CSP served unwidened per route group; `(admin)` is `SameSite=Strict`
*Source: [`Routing.md`](../../SA-docs/03-frontend/Routing.md) §2, §11*
- [ ] Capture the response headers for one route in **each** group and compare against the policy as written. A directive that was widened to make something work is the finding this row exists for
- [ ] Confirm the nonce is per-response, not per-build
- [ ] Confirm `(admin)` cookies carry `SameSite=Strict` and the storefront groups carry what the policy says they carry — not the same value copied across

### 5 — A `CUSTOMER` reaching `/admin` sees an empty shell and `403`s — not a middleware permission check
*Source: [`Routing.md`](../../SA-docs/03-frontend/Routing.md) §11 · [`Security.md`](../../SA-docs/01-system/Security.md) T9*
- [ ] Sign in as a `CUSTOMER`, navigate to `/admin` and to three `(admin)` detail routes. **The shell renders**, its sections are empty, and every read behind it returned `403` **from the server**
- [ ] Confirm there is no redirect. A redirect here is threat `T9`: it turns the router into an oracle for which routes exist and which roles hold them
- [ ] Confirm the same for a `GUEST` — unauthenticated is a different outcome from unauthorised, and both are designed

### 6 — Catalog write → event → `/api/internal/revalidate` → storefront updates within seconds
*Source: [`ADR-0038`](../../SA-docs/01-system/ADR/ADR-0038-event-driven-catalog-revalidation.md)*
- [ ] Change a product's price in `/admin/products/[productId]` and watch `/p/[productId]` update without a deploy, a manual purge, or a hard reload
- [ ] Confirm the storefront was **not** revalidated directly by the admin write — stop the relay, take a write, and confirm the storefront does *not* update. One invalidation path, not two, and this is how that is proved
- [ ] Tamper with the callback signature and confirm refusal; confirm the refusal is visible in logs rather than silent
- [ ] Replay one callback twice and confirm no harm

### 7 — `R1` routes are genuinely static; `(account)`/`(admin)` carry `noindex` and are absent from the sitemap
*Source: [`Routing.md`](../../SA-docs/03-frontend/Routing.md) §3*
- [ ] Read the build output: `/`, `/c/[...slug]`, `/p/[productId]` are prerendered. A route that silently became dynamic — usually by reading a header or a cookie in a shared component — is the finding
- [ ] Fetch each `(account)` and `(admin)` route and confirm `noindex`
- [ ] Fetch the sitemap and confirm no `(account)` or `(admin)` path appears in it

### 8 — One correlation id traced REST → outbox → Kafka → projection
*Source: `NFR-OBS-03`*
- [ ] Issue one browser request that causes a catalog write, and follow **one** id through the API log, the outbox row, the Kafka envelope, the consumer, and the revalidation callback
- [ ] Confirm the id originates at the edge and is propagated, not regenerated at each hop — a fresh id per hop is indistinguishable from no id at all when it matters
- [ ] Record the trace itself as the evidence for this row

### 9 — Permission-matrix cells for every identity and catalog operation
*Source: [`Permission Matrix.md`](../../SA-docs/04-shared/Permission%20Matrix.md)*
- [ ] Walk every identity and catalog operation delivered through Sprint 09 against its matrix row: each role that is granted succeeds, each role that is not is **refused by the server**
- [ ] Hiding a control in the UI counts for nothing here. The check is the API response
- [ ] Record which operations were walked. `EN-CONTRACT-3` (Sprint 28) generates this test for all 155 operations; until then the coverage is whatever was walked by hand, and it should be written down rather than assumed complete

---

## Known Gaps Carried In

Recorded at Sprint 09 Review and revisited here rather than rediscovered:

- [ ] `UC-ADM-01` `E3` — removal of a product with stock or open orders cannot be fully exercised: `inventory` arrives in Sprint 11 and `ordering` in Sprint 18. Confirm what *is* decidable today behaves, and carry the rest forward with a named sprint
- [ ] `UC-AUD-01` remains the Sprint 03/04 stub listener. The **refusal path** (`E1`: audit fails → the change is not applied) is what row 9's adjacent behaviour depends on; confirm the refusal is real even though the persistence is not (`US-AUD-01`, Sprint 12)

---

## Exit Criterion

> Every row above passes, **or** the failure is a logged, sized backlog item with a named sprint.

**A row is never marked passed on a local workaround.** A finding that was resolved by changing an environment variable, disabling a check, or running the demonstration a second way until it worked is an open finding, and it is recorded as one.

## Review Notes

<!-- filled at Sprint Review -->

## Retrospective

**Went well:**
**Change one thing:**
**Action (owned, carried to next sprint's board):**

# Sprint 05 — Identity: Account, Addresses & Recovery

**Release:** R1 · **Gate:** **`G2` — Contract Sync** · **Backend 19 pts · Frontend 19 pts**
**Related documents:** [`../release-plan.md`](../release-plan.md) · [`../integration-plan.md`](../integration-plan.md) · [`../../BA-docs/user-stories/01-customer-identity.md`](../../BA-docs/user-stories/01-customer-identity.md)

---

## Sprint Goal

> **A customer owns their account: profile, addresses, password recovery, and their order history.**

This closes the `identity` module. Every module built after this one depends on it and will not be waiting for it.

## Committed Items

| Lane | ID | Item | Pts |
|---|---|---|---:|
| BE | `US-CUS-06` | Change Password | 3 |
| BE | `US-CUS-07` | Reset Forgotten Password | 5 |
| BE | `US-CUS-08` | Manage Profile | 3 |
| BE | `US-CUS-09` | Manage Shipping Addresses | 5 |
| BE | `US-CUS-10` | View Purchase History | 3 |
| FE | `US-CUS-06` | `/account/security` | 2 |
| FE | `US-CUS-07` | `/forgot-password` · `/reset-password` | 3 |
| FE | `US-CUS-08` | `/account/profile` | 3 |
| FE | `US-CUS-09` | `/account/addresses` | 5 |
| FE | `US-CUS-10` | `/account/orders` | 3 |
| FE | `EN-FE-DS-3` | Table, Modal, Tooltip, pagination control | 3 |

---

## Backend Lane

### `US-CUS-06` Change Password (3 pts) — `changeOwnPassword`
- [ ] Current password required; all other sessions invalidated on success
- [ ] Every exception flow

### `US-CUS-07` Reset Forgotten Password (5 pts) — `requestPasswordReset`, `completePasswordReset`
- [ ] Single-use, expiring token
- [ ] **The request response is identical whether or not the account exists.** Same rule as sign-in, same reason, and the one most likely to be broken by being helpful
- [ ] Exception flows: expired, already used, unknown, account closed

### `US-CUS-08` Manage Profile (3 pts) — `getOwnAccount`, `updateOwnProfile`
- [ ] Audit entry per `UC-AUD-01`

### `US-CUS-09` Manage Shipping Addresses (5 pts)
- [ ] `listOwnAddresses`, `addOwnAddress`, `replaceOwnAddress`, `removeOwnAddress`, `getOwnAddress`
- [ ] `Address` comes from `shared-kernel` — a value object, not an entity in this module
- [ ] Default-address rules; removal of an address referenced by an in-flight order

### `US-CUS-10` View Purchase History (3 pts) — `listOrders`
- [ ] Cursor pagination
- [ ] **Ownership scoping**: a customer sees only their own orders, and another customer's returns `404`
- [ ] `ordering` does not exist yet — this reads the read model it will populate, and returns an empty page until Sprint 18. The empty state is the deliverable, and it is a designed one

---

## Frontend Lane

### The `(account)` group — `R3`, `CUSTOMER`, never cached
- [ ] `/account`, `/account/profile`, `/account/security`, `/account/addresses`, `/account/addresses/[addressId]`, `/account/orders`
- [ ] `/forgot-password` and `/reset-password` in `(auth)`
- [ ] `loading.tsx` per segment: a skeleton **in the shape of the content**, never sized from a count that may be absent
- [ ] `not-found.tsx` for `(account)` that **never explains why** — the ownership `404` is deliberately indistinguishable from absence
- [ ] Address list uses the Table primitive with the cursor-pagination control
- [ ] `/account/orders` renders its empty state cleanly — it will be empty until Sprint 18, and it must look designed rather than broken

### `EN-FE-DS-3` (3 pts)
- [ ] Table, Modal, Tooltip, pagination control. Vitest + axe on each

---

## Integration Risk

**`US-CUS-10` reads a read model that no module writes yet.** At `G2` it will return an empty page against the real API and a populated one against the mock. That difference is expected and must be recorded as expected — not logged as drift.

The check that matters at `G2` is that the **envelope and cursor shape** match, not that rows come back.

## Gate `G2` — Contract Sync

Checklist: [`../integration-plan.md`](../integration-plan.md) §3, scoped to identity, session, and account.

| # | Check |
|---|---|
| 1 | Types regenerated, diff empty |
| 2 | Contract tests both directions across all ten `CUS` operations plus `AUD-03`/`-04` |
| 3 | Every `(auth)` and `(account)` route renders against the real API |
| 4 | Sign in → session cookie set with the right posture → `/account` reachable → sign out → `/account` redirects |
| 5 | A second browser session's order returns `404` and the screen does not explain why |
| 6 | Exceeding the rate limit renders the designed `429` screen |
| 7 | Reset-request messaging identical for known and unknown addresses |
| 8 | Pagination envelope and cursor shape match on `listOwnAddresses` and `listOrders` |
| 9 | `Money` is absent from these payloads — confirm no formatting assumptions were made against mock data that will change |
| 10 | Drift logged **and** `openapi.yaml` amended in the same session |

## Definition of Done

Every story reaches [`../definition-of-done.md`](../definition-of-done.md) §5.

**This is the last sprint before the catalog.** Confirm at Review that `identity` is closed: no `CUS` or `AUD` story is carried, because twelve modules are about to depend on it.

## Review Notes

<!-- filled at Sprint Review -->

## Retrospective

**Went well:**
**Change one thing:**
**Action:**

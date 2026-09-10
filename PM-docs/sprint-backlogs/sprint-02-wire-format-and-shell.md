# Sprint 02 — Wire Format & Application Shell

**Release:** R1 · **Gate:** none · **Backend 20 pts · Frontend 20 pts**
**Related documents:** [`../release-plan.md`](../release-plan.md) · [`../definition-of-done.md`](../definition-of-done.md) · [`../../SA-docs/04-shared/Integration Contract.md`](../../SA-docs/04-shared/Integration%20Contract.md)

---

## Sprint Goal

> **Every response shape a controller will ever return is decided once, before the first domain controller exists.**

This is the sprint that prevents the failure [`ADR-0031`](../../SA-docs/01-system/ADR/ADR-0031-contract-first-openapi.md) §1 exists to prevent: the wire format being decided one controller at a time. The error envelope, the pagination envelope, and the correlation header are cross-cutting, and retrofitting any of them across thirteen modules is an order of magnitude more expensive than deciding them now.

## Committed Items

| Lane | ID | Item | Pts |
|---|---|---|---:|
| BE | `EN-DATA-2` | Flyway baseline, per-module table-prefix conventions, migration map | 8 |
| BE | `EN-WIRE-1` | Problem+JSON advice, error-code registry, pagination envelope, correlation filter | 12 |
| FE | `EN-FE-SHELL-1` | Root layout, CSP nonce, middleware, four route-group layouts, chrome | 14 |
| FE | `EN-FE-DS-1` | Design system: Button, Input, Card | 6 |

---

## Backend Lane

### `EN-DATA-2` — migrations (8 pts)

- [ ] Flyway configured to run on `ecp-api` startup, **before the context is ready**; readiness fails while migrations run so `nginx` does not route to a starting instance
- [ ] Migration layout per module, following the map in [`Database.md`](../../SA-docs/02-backend/Database.md)
- [ ] Table-prefix convention enforced: `identity_`, `catalog_`, `inventory_`, `cart_`, `ordering_`, `payment_`, `shipping_`, `promotion_`, `review_`, `notification_`, `audit_`, `reporting_`
- [ ] An integration test asserting **no foreign key crosses a prefix** — `ordering_order` must not reference `catalog_product`. A shared schema is not a shared model
- [ ] Baseline migration applied against the Testcontainers instance and against the Compose instance

### `EN-WIRE-1` — the wire format (12 pts)

- [ ] `@RestControllerAdvice` producing problem+JSON per [`Integration Contract.md`](../../SA-docs/04-shared/Integration%20Contract.md) §4.1
- [ ] Error-code registry as domain enums, seeded from [`Error Codes.md`](../../SA-docs/04-shared/Error%20Codes.md). **The two recorded drifts from the `ECP-<DOMAIN>-<NNNN>` scheme are resolved here**, not carried forward
- [ ] Validation-error shape per §4.3
- [ ] Pagination envelope per §3.1, **cursor-based, never offset** (§3.2)
- [ ] Filtering and sorting conventions per §3.3
- [ ] `X-Correlation-Id` filter: thread an inbound id or mint one; put it on the MDC so every log line carries it
- [ ] Structured JSON logging to stdout, one stream per container
- [ ] L3 web-slice tests asserting the envelope and the problem shape against a stub controller — a container start-up to assert a JSON field name is the waste L3 exists to avoid

---

## Frontend Lane

### `EN-FE-SHELL-1` — route groups and chrome (14 pts)

- [ ] Root `app/layout.tsx`: html, body, fonts, providers, **the per-request CSP nonce**
- [ ] The four route groups with their layouts and postures, per [`Routing.md`](../../SA-docs/03-frontend/Routing.md) §2:

| Group | Session | Cookie | Chrome |
|---|---|---|---|
| `(storefront)` | optional | `Lax` | header · search · cart badge · footer |
| `(auth)` | none by construction | `Lax` | minimal, no navigation |
| `(account)` | required, `CUSTOMER` | `Lax` | storefront shell + account sidebar |
| `(admin)` | required, operator | **`Strict`** | dense operator navigation, no storefront chrome |

- [ ] `checkout/layout.tsx` **nested inside `(storefront)`**, not a fifth group — the customer is still shopping; what changes is that navigation is suppressed so the funnel has one exit
- [ ] Middleware doing exactly four things and no more: security headers + CSP nonce; thread/mint `X-Correlation-Id`; redirect unauthenticated callers away from `(account)` and `(admin)` with a return path; select cookie posture per group
- [ ] **Middleware makes no API call.** It reads the cookie's *presence*, not its meaning
- [ ] A comment at the redirect noting it is routing, not authorisation — threat `T9` of [`Security.md`](../../SA-docs/01-system/Security.md) §13 exists because a redirect looks like a permission check
- [ ] `components/layout/`: header, footer, account sidebar, admin shell
- [ ] `robots.txt` and `sitemap.xml` generated from `R1` routes only; `(auth)`, `(account)`, `(admin)`, cart and checkout carry `noindex`

### `EN-FE-DS-1` — first primitives (6 pts)

- [ ] Button, Input, Card in `components/ui/`, built on the *Ma* tokens
- [ ] Targets ≥ 44 × 44 px with visible focus
- [ ] No `outline: none` anywhere — lint enforces it
- [ ] Vitest + axe on each; token-contrast assertion on the pairs each uses
- [ ] Rule `I-5` holds: these import nothing from `features/` or `lib/api`. A design-system component that fetches is no longer a design-system component

---

## Integration Risk

**The CSP and the nonce versus static generation.** [`Performance.md`](../../SA-docs/03-frontend/Performance.md) names this trade explicitly: a per-request nonce makes a route dynamic, and the `R1` catalog routes of Sprint 06–07 must stay static. Resolve the interaction **this sprint**, while the shell is empty and cheap to change — not in Sprint 06 when three static routes depend on the answer.

## Definition of Done

Every item satisfies [`../definition-of-done.md`](../definition-of-done.md) §3 or §4.

Additionally, demonstrated at Review:
- [ ] A `404` from the stub controller renders as problem+JSON with a correlation id and **no stack, no response body**
- [ ] Each of the four route groups renders its shell with the correct cookie posture

## Review Notes

<!-- filled at Sprint Review -->

## Retrospective

**Went well:**
**Change one thing:**
**Action:**

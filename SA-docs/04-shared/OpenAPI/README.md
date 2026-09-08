# OpenAPI Contract — Enterprise Commerce Platform (ECP)

**Document type:** Index and conventions for a normative interface specification
**Status:** **Proposed** — hand-authored contract-first under [ADR-0031](../../01-system/ADR/ADR-0031-contract-first-openapi.md)
**Audience:** Backend Engineering, Frontend Engineering, Architecture Review, QA
**Related documents:** [Integration Contract](../Integration%20Contract.md) · [ADR-0003](../../01-system/ADR/ADR-0003-rest-api-style.md) · [ADR-0031](../../01-system/ADR/ADR-0031-contract-first-openapi.md) · [ADR-0016](../../01-system/ADR/ADR-0016-jwt-refresh-rotation-rbac.md) · [ADR-0020](../../01-system/ADR/ADR-0020-typescript-strict-mode.md) · [Domain Model](../../02-backend/Domain%20Model.md) · [Database](../../02-backend/Database.md) · [SRS](../../../BA-docs/srs.md) · [Use Cases](../../../BA-docs/use-cases/README.md)

---

## 1. What This Is

`openapi.yaml` and the files it references are the **OpenAPI 3.1 description of
the ECP REST API** — 121 paths, 155 operations, across all fourteen SRS §2.2
domains.

[`Integration Contract.md`](../Integration%20Contract.md) states the *rules* every
endpoint obeys. This document is the *enumeration* of the endpoints, which the
Integration Contract deliberately never gives (§1.1). The two are complements,
not duplicates: where they disagree, **the Integration Contract is right and this
is stale**.

### 1.1 Why this is hand-written

[`ADR-0003`](../../01-system/ADR/ADR-0003-rest-api-style.md) §4 originally
proposed that OpenAPI be *"generated rather than hand-written, so it cannot
drift"*, and [`Integration Contract.md`](../Integration%20Contract.md) §1.1 kept
this folder empty on that basis. That row was `Proposed` and never ratified, and
the cost of holding it was that with no controller layer there was **no contract
at all** — [`ADR-0020`](../../01-system/ADR/ADR-0020-typescript-strict-mode.md)
had nothing to generate frontend types from, QA had nothing to write contract
tests against, and `NFR-SEC-01`'s "verifiable per role per operation" had nothing
to enumerate.

[`ADR-0031`](../../01-system/ADR/ADR-0031-contract-first-openapi.md) supersedes
that row. The drift control moves from *generation* to *verification*: this
document is normative now, and once controllers exist CI diffs the generated
description against it and fails the build on divergence. Read ADR-0031 before
changing anything here.

---

## 2. Layout

```nano
  04-shared/OpenAPI/
  ├── README.md                 this file
  ├── redocly.yaml              lint/bundle configuration
  ├── openapi.yaml              root — info, servers, security, 14 tags, the path map
  ├── paths/                    one file per SRS §2.2 domain code
  └── components/
      ├── securitySchemes.yaml  bearerAuth · sessionCookie · csrfToken · providerSignature
      ├── parameters.yaml       pagination, headers, path ids
      ├── headers.yaml          Retry-After · Location · X-Correlation-Id · ETag · Deprecation
      ├── responses.yaml        one reusable response per error code
      └── schemas/              one file per domain, plus common.yaml
```

**Top-level keys in `paths/*.yaml` are names, not paths** (`orderCancellation`,
not `/orders/{orderId}/cancellation`). The root maps each real path to one of
them. This avoids `~1` JSON-pointer escaping in all 121 root references, and the
real URL is visible in exactly one place — the root's path map.

### 2.1 Domain to file map

| Domain | Code | Paths file | Ops | Owning module |
|---|---|---|---|---|
| Customer & Identity | `CUS` | `identity.yaml` | 18 | `identity` |
| Product Catalog & Category | `CAT` | `catalog.yaml` | 21 | `catalog` |
| Search & Recommendation | `SCH` | `search.yaml` | 14 | `catalog` (read model) |
| Inventory | `INV` | `inventory.yaml` | 6 | `inventory` |
| Cart & Wishlist | `CRT` | `cart.yaml` | 10 | `cart` |
| Checkout & Order | `ORD` | `ordering.yaml` | 20 | `ordering` |
| Payment | `PAY` | `payment.yaml` | 12 | `payment` |
| Shipping | `SHP` | `shipping.yaml` | 8 | `shipping` |
| Promotion | `PRM` | `promotion.yaml` | 8 | `promotion` |
| Review | `REV` | `review.yaml` | 11 | `review` |
| Notification | `NTF` | `notification.yaml` | 8 | `notification` |
| Administration | `ADM` | `administration.yaml` | 9 | `identity` + composition |
| Reporting & Analytics | `RPT` | `reporting.yaml` | 8 | `reporting` |
| Audit & Access Control | `AUD` | `audit.yaml` | 2 | `audit` |

`SCH` and `ADM` are the two SRS domains that are not bounded contexts.
[`Domain Model.md`](../../02-backend/Domain%20Model.md) §3 resolves `SCH` into a
CQRS read model inside Catalog and dissolves `ADM` into Identity & Access plus
operator authority over other contexts' resources. They keep their own files here
because the error-code scheme, the permission matrix, and the tag list are all
organised by the fourteen SRS domain codes, not by the twelve modules.

---

## 3. Conventions

Every rule below is transcribed from a normative source; none is invented here.
See [`Integration Contract.md`](../Integration%20Contract.md) §2–§5 and §8 for the
reasoning.

| Concern | Rule |
|---|---|
| Versioning | URI prefix `/api/v1`. A breaking change ships as `/api/v2`, served concurrently; `v1` then carries a `Deprecation` header for at least two release cycles. |
| Paths | Plural nouns, kebab-case, hierarchical by ownership. **Never a verb.** A non-CRUD state change becomes a subordinate resource — `POST /orders/{orderId}/cancellation`, not `/orders/{orderId}/cancel`. |
| Money | Always `{"amount": "129.99", "currency": "VND"}`. `amount` is a **string**, scaled to `NUMERIC(19,4)`. Never a bare number. |
| Identifiers | `string`/`uuid` (UUIDv7 in store), documented as **opaque**. Business references (`orderNumber`, `sku`, `trackingReference`) are separate fields and never a path id. |
| Timestamps | RFC 3339, UTC. |
| Field names | `camelCase` on the wire; `snake_case` stays in PostgreSQL. |
| Pagination | Cursor, never offset. `size` default 20, max 100, **clamped not rejected**. `page.total` is optional and always absent on Elasticsearch-backed collections. |
| Errors | RFC 9457 `application/problem+json`. Every 4xx/5xx carries a stable `code`; `title` and `detail` are never user-facing copy. |
| Enums | **Open, not closed.** Status fields are `type: string` with `x-extensible-enum` listing the exact `CHECK`-constraint literals in SCREAMING_SNAKE. A closed `enum` would make a generated client reject a value added later, which §8.1 explicitly calls non-breaking. |
| Ownership | A resource the caller does not own returns **`404`, never `403`**. |
| Idempotency | `Idempotency-Key` required on exactly two operations: `placeOrder` and `initiatePayment`. |

### 3.1 Two discrepancies this document settles

Both are places where the Integration Contract's illustrative examples disagree
with the schema. The schema wins, and the reasoning is recorded here rather than
left for a reader to rediscover.

1. **Status-filter casing.** §3.3 shows `?status=Shipped`. That is PascalCase
   where the store uses SCREAMING_SNAKE, and `SHIPPED` is not even a legal order
   state — the state is `SHIPPING` (`Database.md` §4.5). This document uses the
   `CHECK`-constraint literals throughout.
2. **Bare-date filters.** §3.3 shows `?placedAfter=2026-01-01`, a bare date,
   while §2 requires RFC 3339 date-times. Date-range filters here are
   `format: date-time`.

### 3.2 Vendor extensions

| Extension | Meaning |
|---|---|
| `x-ecp-roles` | Roles permitted to call the operation, from the §9 permission matrix, as the `identity_role.code` literals. Empty on a provider callback, which is authenticated by signature rather than by role. |
| `x-ecp-ownership` | `own` where the role grants the capability and a runtime check grants the instance. |
| `x-ecp-traces` | The `UC`/`FR`/`BR` identifiers the operation realises. |
| `x-ecp-actor` | The external actor that calls an inbound callback. |
| `x-extensible-enum` | Known values of an open vocabulary. |

---

## 4. Where the operator operations live

**There is no `/api/v1/admin/...` surface.** A staff or administrator operation
lives on the resource it acts on and differs only in the role it requires:
`POST /products` is one endpoint whichever console calls it.

That is not a stylistic preference. `NFR-SEC-01` requires authorisation to be
verifiable *per role per operation*, which stays enumerable only while one
endpoint maps to one RBAC rule; and `BR-AUD-02` requires the same decision
whatever entry point a request arrives through, which is true by construction
when there is only one entry point. A parallel admin surface would double the
surface `NFR-SEC-01` is checked across, to serve the client class with the fewest
users — the same trade-off [`ADR-0003`](../../01-system/ADR/ADR-0003-rest-api-style.md)
§3 rejected as Option 4.

It also settles, at the contract level, the open item
[`Module Dependency Diagram.md`](../../02-backend/Module%20Dependency%20Diagram.md)
§11 records about where an admin BFF would live: at this boundary, nowhere,
because there is no separate admin API to host.

| Use case | Realised in |
|---|---|
| `UC-ADM-01` Manage Products | `catalog.yaml` |
| `UC-ADM-02` Manage Categories | `catalog.yaml` |
| `UC-ADM-03` Manage Customer Accounts | `administration.yaml` (+ `GET /accounts` in `identity.yaml`, see below) |
| `UC-ADM-04` Manage Orders | `ordering.yaml` |
| `UC-ADM-05` Manage Inventory Adjustments | `inventory.yaml` |
| `UC-ADM-06` Manage User Roles | `administration.yaml` |

One file-placement wrinkle worth knowing: `GET /accounts` (`searchAccounts`) is
defined in `identity.yaml`, not `administration.yaml`. OpenAPI allows one path
item per path and a path item can only be `$ref`'d whole, so `GET /accounts`
(admin search) and `POST /accounts` (registration) must share a file. It is
tagged `Administration` where it sits.

---

## 5. Use-case coverage

All **87** use cases from
[`use-cases/README.md`](../../../BA-docs/use-cases/README.md) are accounted for:
**81 are realised by at least one operation**, and **6 have no HTTP surface at
all**. The six are listed explicitly rather than quietly omitted — inventing
endpoints for them would misrepresent the architecture.

| Use case | Why there is no endpoint |
|---|---|
| `UC-CRT-06` Expire Inactive Cart | Scheduler-triggered (`A-02`, `FR-CRT-07`). No caller initiates it. |
| `UC-NTF-01` Deliver Email Notification | A Kafka event consumer (`Integration Contract` §7). No client invokes delivery. |
| `UC-NTF-02` Deliver In-App Notification | Same. The *inbox* is exposed (`UC-NTF-03`); the *delivery* is not. |
| `UC-AUD-01` Record Audit Entry | Written by projection from domain events. `ADR-0017` exposes no mutation API at any layer, for any role — the absence is the enforcement of `BR-AUD-01`. |
| `UC-AUD-03` Authorise Request via RBAC | Cross-cutting. Realised as the `401`/`403` declared on every operation, and as the `404`-not-`403` rule for unowned resources. |
| `UC-AUD-04` Enforce API Rate Limit | Cross-cutting. Realised as the `429` + `Retry-After` declared on every operation. |

Two more deserve a note because they *look* like they should be endpoints and are
not: `UC-INV-01` (Reserve Stock) and `UC-INV-02` (Release Reserved Stock) have no
endpoint of their own — they are in-process `StockReservationPort` calls inside
the order-placement transaction — but they *are* traced, on `placeOrder` and
`cancelOrder`, because that is where a caller actually triggers them.

The coverage assertions in §8 check both directions of this claim.

---

## 5.1 Permission-matrix walk

Every operation's `x-ecp-roles` was checked against
[`Integration Contract`](../Integration%20Contract.md) §9 / SRS §2.3, cell by
cell. Twelve of the fourteen rows match exactly. The rest are recorded here
rather than left for a reviewer to rediscover.

### Four deviations that are intentional

| Where | Grid says | Contract says | Why |
|---|---|---|---|
| Customer & Identity, for Staff / Warehouse / Support / Admin | `—` for Staff and Warehouse | Every authenticated role may log out, renew its session, and read and change **its own** profile and password | The grid row is about access to *customer records*. It cannot mean a Staff user may never end their own session or change their own password. Only `own`-scoped operations are opened; no operator reaches another account through `identity.yaml`. |
| Inventory, Customer | `availability only` | No Inventory endpoint at all | Customer-facing availability is a boolean inside catalog and search responses (`VariantAvailability`). Quantities and warehouse structure are never exposed to a Guest or Customer, so the cell is satisfied *without* an Inventory endpoint. |
| Notification, Guest | *(blank)* | `POST /notification-unsubscriptions` is unauthenticated | `UC-NTF-04` A1 requires unsubscribing by single-use token **without signing in**. Requiring a login to stop marketing mail is how unsubscribe links get ignored. It touches only a promotional opt-in; transactional messages are unaffected (`BR-NTF-02`). |
| Review, Guest | `read` | `POST /reviews/{reviewId}/reports` is unauthenticated | `UC-REV-05` opens reporting to any visitor. Reporting hides nothing by itself — a moderator decides — so the write grants no visibility authority. |

### One discrepancy in the source documents

**SRS §2.3 and `UC-ADM-03` disagree about what Customer Support may do to an
account, and this contract cannot satisfy both.**

- SRS §2.3 grants Support `read` on Customer & Identity, and the same table
  grants Support `read, cancel, return` on Checkout & Order — so the grid clearly
  does express verbs beyond `read` where it means them. It says `read` here on
  purpose. That table is **normative for `FR-AUD-05`**.
- [`UC-ADM-03`](../../../BA-docs/use-cases/12-administration.md) names Customer
  Support Agent as its **primary actor** and has them suspend accounts, reinstate
  them, and correct profile details (steps 4, A2, A3).

This contract takes the **narrower** reading and restricts `setAccountStatus`,
`correctAccountProfile`, and `closeAccount` to `ADMINISTRATOR`, for two reasons:
[`Integration Contract`](../Integration%20Contract.md) §10 states that where the
grid and SRS §2.3 disagree SRS §2.3 wins, and a permission contract that is
uncertain should fail closed. Support keeps `read` — `searchAccounts` and
`getAccount` — which is the part both documents agree on.

The same reasoning excludes Support from `advanceOrderStatus`: the grid gives
Support `cancel` and `return`, which they have through `cancelOrder` and
`resolveOrderReturn`, but not `progress`.

**This is a BA decision, not an architecture one, and it needs resolving.** If
`UC-ADM-03`'s actor assignment is correct, SRS §2.3's Customer & Identity row
should read `read, suspend, correct` for Support, and these three operations
widen to match. Until the SRS says so, widening them here would put the API
contract ahead of the requirement it is supposed to implement.

### Two operations authorised by signature, not by role

`receivePaymentProviderNotification` and `receiveCarrierEvent` carry
`x-ecp-roles: []` and `providerSignature` security. They are called by the
Payment Gateway and the Shipping Carrier — actors in SRS §2.3's *system* table,
which the role grid does not cover. Their `x-ecp-actor` records which.

---

## 6. Assumptions

Marked **`[ASSUMPTION]`** at the point of use, and collected here, mirroring the
SRS §2.5 convention. Each is a decision this document had to make because **no
repository document answers it**. None should survive contact with
`Backend Architecture.md` and `Frontend Architecture.md` unreviewed.

| # | Assumption | Why it was needed |
|---|---|---|
| **O-01** | Pagination request parameters are `cursor` and `size`. | §3 specifies only the response fields `page.next` and `page.size`; no request parameter is ever named. |
| **O-02** | Correlation header is `X-Correlation-Id`, on request and response. | §6.2 requires the identifier end-to-end but names no HTTP header anywhere in the repository. |
| **O-03** | Session cookie is named `ecp_session`. | `ADR-0025` §5 defers cookie naming to `Frontend Architecture.md`, a stub. |
| **O-04** | CSRF token travels in `X-CSRF-Token`. | `ADR-0025` §5 defers the CSRF mechanism to the same stub, while §4 makes CSRF mandatory. |
| **O-05** | Provider callbacks are signed with `X-ECP-Signature`. | `UC-PAY-03` and `UC-SHP-04` require signature verification; no document names a header, and `NFR-MAINT-03` forbids naming a provider. |
| **O-06** | Server URL is `{protocol}://{host}/api/v1`, host templated. | No document names a host. Only `https://ecp.example/errors/...` appears, and only as the problem-type namespace. |
| **O-07** | Catalog reads carry `ETag` and honour `If-None-Match`. | §2.1 lists `304` for `GET` but names no conditional-request mechanism, and `NFR-PERF-01` wants the caching. |
| **O-08** | `ECP-GEN-4040` is added for `404`. | §4.4 is "not exhaustive" and has no `404` code, yet §4.5 rule 2 requires every 4xx to carry one. Belongs in §4.4 and in `04-shared/Error Codes`. |
| **O-09** | `sort` syntax is `field:asc\|desc` and sortable fields are named per operation. | §3.3 gives the syntax by example only (`placedAt:desc`) and never enumerates sortable fields. |

### 6.1 Open items this document deliberately does **not** invent

Named here so their absence is visible rather than mistaken for an oversight.

- **No `If-Match` / `412` anywhere.** §2.1 lists `412` for `PUT`, but
  [`ADR-0011`](../../01-system/ADR/ADR-0011-optimistic-locking-reservation-model.md)
  keeps the aggregate `version` off the wire, so a client has no precondition it
  could legitimately assert. Exposing one would leak the concurrency model into
  the contract. The `412` row of §2.1 is therefore unrealised, on purpose.
- **No `X-RateLimit-*` headers.** Only `Retry-After` is documented, and
  `UC-AUD-04` A4's remaining-allowance signalling has no numeric limits behind it
  — `UC-AUD-04` defers them explicitly as "an operational parameter to be set
  from observed traffic".
- **No JWT algorithm, lifetime, issuer, or JWKS URL.** `ADR-0016` §5 defers all
  of it to `Backend Architecture.md`.
- **No password-strength or lockout policy** in any validation constraint. None
  is specified anywhere.
- **No numeric rate limits, export retention, or search-history retention.**
- Unconstrained vocabularies stay plain strings, not enums: `carrier`,
  tracking-event `status`, adjustment `reasonCode`, audit `action`/`entityType`/
  `module`, notification `templateCode`, review `contentType`. The schema defines
  no value set for any of them, so neither does this contract.

---

## 7. Building and viewing

From this directory (`redocly.yaml` here defines the `ecp@v1` API):

```bash
npx -y @redocly/cli@latest lint            # validate; every $ref must resolve
npx -y @redocly/cli@latest bundle ecp@v1 -o /tmp/ecp-openapi.bundled.yaml
npx -y @redocly/cli@latest preview-docs    # render as browsable documentation
```

Or from the repository root, via the scripts in `util/package.json`:

```bash
cd util && npm run docs:openapi:lint
cd util && npm run docs:openapi:bundle   # -> OpenAPI/dist/openapi.bundled.yaml
```

`dist/` is build output and is **not committed**, the same convention the
generated `.html` files follow (see `.gitignore`).

The bundled single-file output is what
[`ADR-0020`](../../01-system/ADR/ADR-0020-typescript-strict-mode.md) generates
frontend TypeScript types from. `redocly.yaml` relaxes exactly one rule from the
`recommended` ruleset — `no-server-example.com`, because the local-development
server genuinely is `http://localhost:8080` — and states why inline.

---

## 8. Verification

These assertions are what make "all fourteen domains, fully covered" checkable
rather than merely claimed. Run from this directory.

```bash
# a. Every use case in this spec is a real one, and every real one is accounted
#    for. Both diffs must be empty.
grep -rhoE 'UC-[A-Z]{3}-[0-9]{2}' paths/ components/ openapi.yaml | sort -u > /tmp/spec-ucs
grep -rhoE 'UC-[A-Z]{3}-[0-9]{2}' ../../../BA-docs/use-cases/README.md | sort -u > /tmp/ba-ucs
diff /tmp/spec-ucs /tmp/ba-ucs

# b. 81 use cases are realised by at least one operation; the 6 in §5 are not.
grep -rhA3 'x-ecp-traces:' paths/ | grep -oE 'UC-[A-Z]{3}-[0-9]{2}' | sort -u | wc -l

# c. Every operation declares roles and traceability — all three counts equal.
grep -rc 'operationId:'  paths/ | awk -F: '{s+=$2} END {print "operationId  " s}'
grep -rc 'x-ecp-roles:'  paths/ | awk -F: '{s+=$2} END {print "x-ecp-roles  " s}'
grep -rc 'x-ecp-traces:' paths/ | awk -F: '{s+=$2} END {print "x-ecp-traces " s}'

# d. No verb in any path. Expect no output.
#    ("search" is exempt: /search/... is a noun — the search resource.)
grep -oE '^  /[a-z0-9/{}-]+' openapi.yaml \
  | grep -iE '/(get|create|update|delete|cancel|apply|submit|login|logout|make)\b'

# e. Every seed error code from Integration Contract §4.4 is defined.
grep -ohE 'ECP-[A-Z]{3}-[0-9]{4}' components/responses.yaml | sort -u
```

Beyond the mechanical checks, three things need a human:

- **The permission matrix, row by row.** Six roles by fourteen domains
  ([`Integration Contract`](../Integration%20Contract.md) §9): every non-blank
  cell must be reachable through some operation's `x-ecp-roles`, and every blank
  cell unreachable. This grid is the artefact `NFR-SEC-01` is verified against.
- **The order state machine.** Every operation that moves an order must respect
  the `BR-ORD-01` edge set in SRS §5.3 — in particular that no `CANCELLED` edge
  exists from `PACKED` onward (`BR-ORD-04`).
- **The `NFR-SEC-07` sweep.** No response schema anywhere may carry a credential,
  a token hash, or a payment instrument.

---

## 9. Changing this document

| Change | What it needs |
|---|---|
| A new endpoint, an optional request field, a new response field, a new enum value, a relaxed constraint | Additive under §8.1. Ship it with the feature. |
| Removing or renaming a field, changing a type or nullability, changing a value's meaning, tightening validation | Breaking under §8.2. Needs `/api/v2` and a migration plan. |
| A new error code | Append it to `components/responses.yaml` **and** to Integration Contract §4.4 in the same change. A code is never redefined and never reused. |
| Anything touching a permission | The SRS §2.3 role-authority table is normative. If this document and SRS §2.3 disagree, **SRS §2.3 is right.** |

Once the controller layer exists, this document stops being the only description
of the API and becomes the thing the generated one is checked against — see
[`ADR-0031`](../../01-system/ADR/ADR-0031-contract-first-openapi.md) §4 for the
CI gate that enforces it.

# Error Codes — Enterprise Commerce Platform (ECP)

**Document type:** Interface specification (normative) — the registry
**Status:** **Proposed**, and interim by design (§1.2)
**Audience:** Backend Engineering, Frontend Engineering, QA, Architecture Review
**Traces to:** `NFR-SEC-04`, `NFR-SEC-07`, `NFR-OBS-03`, `FR-AUD-08`
**Related documents:** [Integration Contract](./Integration%20Contract.md) §4 · [Permission Matrix](./Permission%20Matrix.md) · [OpenAPI](./OpenAPI/README.md) · [`components/responses.yaml`](./OpenAPI/components/responses.yaml) · [ADR-0003](../01-system/ADR/ADR-0003-rest-api-style.md) · [Backend Architecture](../02-backend/Backend%20Architecture.md) §6.3 · [Security](../01-system/Security.md) §8.4

---

## 1. Purpose and Status

### 1.1 The gap this closes

Three documents point here and find nothing:

- [`ADR-0003`](../01-system/ADR/ADR-0003-rest-api-style.md) §5: *"Error-code taxonomy is not decided here; `04-shared/Error Codes` is reserved for it."*
- [`Integration Contract.md`](./Integration%20Contract.md) §4.4: seeds a catalogue and states *"the enumeration lives in `04-shared/Error Codes` as the API grows."*
- [`Backend Architecture.md`](../02-backend/Backend%20Architecture.md) §6.3: names this file as the committed registry a CI check diffs against.

This document is that registry: every error code in force across the platform today, where it is thrown, what rule it enforces, and the two places the codebase has already drifted from its own scheme.

### 1.2 Why this is hand-authored, and why that is temporary

[`Backend Architecture.md`](../02-backend/Backend%20Architecture.md) §6.3 is explicit about the intended mechanism, and this document does not quietly contradict it: **the eventual source of truth is one enum per domain in `<module>.api`, and `04-shared/Error Codes` is *generated* from those enums and diffed in CI.** *"A prose table cannot enforce that."* A hand-written registry would drift from the branch that actually throws each code, with nothing to notice.

There is no controller layer and no domain enum yet — the same situation [`ADR-0031`](../01-system/ADR/ADR-0031-contract-first-openapi.md) faced with the OpenAPI document, and resolved the same way [`OpenAPI/README.md`](./OpenAPI/README.md) §1.1 explains: waiting for code to exist means QA, the frontend, and this file's own consumers have nothing to work against in the meantime. So this document is hand-authored **now**, transcribing exactly what [`Integration Contract.md`](./Integration%20Contract.md) §4.4 and [`components/responses.yaml`](./OpenAPI/components/responses.yaml) have already decided, plus the corrections in §5. It carries no authority of its own — where it disagrees with those two sources, they are right and this is stale (mirroring [`Integration Contract.md`](./Integration%20Contract.md) §10 rule 1).

**This file is superseded, not promoted, the day the generated registry exists.** Nothing here should survive contact with the domain enums unreviewed.

---

## 2. Code Scheme

`ECP-<DOMAIN>-<NNNN>`, fixed by [`Integration Contract.md`](./Integration%20Contract.md) §4.2 — which states the form, the domain codes, the status-plus-sequence numbering, and the rule that a code is matched whole as an opaque string rather than parsed by prefix. The domain codes themselves are SRS §2.2's fourteen, plus `GEN` for a failure owned by no domain; [`OpenAPI/README.md`](./OpenAPI/README.md) §2.1 lists them against the paths file and owning module of each.

Two rules govern this registry specifically: a code, once published, is **never** reused for a different meaning and never removed within a major version; and the domain named in the code owns it — new codes are appended by that domain's owning module, never redefined elsewhere.

Every response, without exception, is `application/problem+json` (RFC 9457) in the `Problem` shape [`Integration Contract.md`](./Integration%20Contract.md) §4.1 defines.

---

## 3. The Registry

**19 codes are in force.** For each: the status, what it means, the rule it enforces, and how many of the 155 OpenAPI operations declare it (from [`components/responses.yaml`](./OpenAPI/components/responses.yaml); a domain with no domain-specific code is stated as such rather than left silent).

### 3.1 `GEN` — cross-cutting

| Code | Status | Meaning | Enforces | Operations |
|---|---|---|---|---|
| `ECP-GEN-4000` | 400 | Request validation failed; every failing field reported at once in `errors` (§4) | `FR-AUD-08`, `NFR-SEC-04` | 91 |
| `ECP-GEN-4010` | 401 | No credential, or the access token has expired | `NFR-SEC-03` | 121 |
| `ECP-GEN-4011` | 401 | Refresh token invalid, expired, or already consumed — the session chain is invalidated | `BR-CUS-03`, `NFR-SEC-03` | 1 (`renewSession`) |
| `ECP-GEN-4030` | 403 | Authenticated, but the role does not permit this operation | `BR-AUD-02`, `NFR-SEC-01` | 66 |
| `ECP-GEN-4040` | 404 | The resource does not exist, **or** exists and the caller does not own it — deliberately indistinguishable | `Permission Matrix` §3 | 82 |
| `ECP-GEN-4290` | 429 | Rate limit exceeded; `Retry-After` is set | `NFR-SEC-05` | 155 (every operation) |
| `ECP-GEN-5000` | 500 | An exception reached the handler with **no domain mapping**. Logged at `WARN` so the missing mapping is discoverable, not just tidy | [`Backend Architecture.md`](../02-backend/Backend%20Architecture.md) §6.3 | — *(fallback; not declared per-operation)* |
| `ECP-GEN-5030` | 503 | A dependency is unavailable; the operation is retryable and platform state is unchanged. Never a passthrough of a provider's own error | `NFR-AVAIL-03`, [`Integration Contract.md`](./Integration%20Contract.md) §4.5 rule 4 | 12 |

`ECP-GEN-4040` was not in [`Integration Contract.md`](./Integration%20Contract.md) §4.4's original seed table — [`components/responses.yaml`](./OpenAPI/components/responses.yaml) added it because §4.5 rule 2 requires every `4xx` to carry a code and the seed table had none for `404`. It belongs here now, per the note both documents already carry.

`ECP-GEN-5000` appears in no response schema because it is a **fallback**, not a designed outcome: it is what an exception handler emits when nothing more specific applies. Its presence in this registry — rather than silent reliance on a framework default — is what makes a missing mapping something CI or a log scan can find.

### 3.2 `CUS` — Customer & Identity

No domain-specific code is defined. Every `CUS` failure in the current contract resolves to a `GEN` code above (`4000`, `4010`, `4011`, `4290`) or a `404`. A future rule specific to this domain — a duplicate-email conflict, for instance — gets `ECP-CUS-4XX0` when it is designed, not before.

### 3.3 `CAT` — Product Catalog & Category

No domain-specific code is defined. Catalog and category failures surface as `GEN` codes or `404`.

### 3.4 `SCH` — Search & Recommendation

No domain-specific code is defined. A degraded search dependency surfaces as `ECP-GEN-5030`, **not** a `SCH`-specific code — see §5.2 for a place this has already drifted.

### 3.5 `INV` — Inventory

| Code | Status | Meaning | Enforces | Operations |
|---|---|---|---|---|
| `ECP-INV-4091` | 409 | Insufficient available stock for one or more lines. **Expected under peak load**, not exceptional — the visible surface of the oversell guarantee ([ADR-0011](../01-system/ADR/ADR-0011-optimistic-locking-reservation-model.md)) | `BR-INV-01`, `FR-ORD-06` | 2 (`adjustStock`, `placeOrder`) |

### 3.6 `CRT` — Cart & Wishlist

| Code | Status | Meaning | Enforces | Operations |
|---|---|---|---|---|
| `ECP-CRT-4090` | 409 | Requested quantity exceeds available stock for the variant. **Never silently capped** — the caller is told what is available | `BR-CRT-02` | 2 (`addCartLine`, `updateCartLineQuantity`) |

### 3.7 `ORD` — Checkout & Order

| Code | Status | Meaning | Enforces | Operations |
|---|---|---|---|---|
| `ECP-ORD-4001` | 400 | `Idempotency-Key` header required and absent | `BR-ORD-03` | 2 (`placeOrder`, `initiatePayment`) |
| `ECP-ORD-4090` | 409 | `Idempotency-Key` reused with a **different** request body — a client defect, reported rather than masked | `BR-ORD-03` | 2 (`placeOrder`, `initiatePayment`) |
| `ECP-ORD-4091` | 409 | Order state transition not permitted from the current state, for **every** role including Administrator | `BR-ORD-01`, `BR-ORD-04`, `FR-ORD-11` | 5 |
| `ECP-ORD-4220` | 422 | Cart is empty, or contains no purchasable line. **Never retry** | `BR-ORD-01` | 3 |

### 3.8 `PAY` — Payment

| Code | Status | Meaning | Enforces | Operations |
|---|---|---|---|---|
| `ECP-PAY-4090` | 409 | A payment attempt is already in flight for this order | `BR-PAY-01` | 2 |
| `ECP-PAY-4220` | 422 | Refund would exceed the amount captured, enforced on exact `NUMERIC` values | `BR-PAY-02` | 1 (`refundPayment`) |

### 3.9 `SHP` — Shipping

No domain-specific code is defined. Shipping failures resolve to `GEN` codes; an order-transition conflict on a shipment-driven state change is reported as `ECP-ORD-4091` (§3.7), owned by `ORD` because the order state machine is.

### 3.10 `PRM` — Promotion

| Code | Status | Meaning | Enforces | Operations |
|---|---|---|---|---|
| `ECP-PRM-4090` | 409 | Promotion usage limit reached by a concurrent redemption. **Expected** under peak load, like `ECP-INV-4091` | `UC-PRM-02` E7 | 1 (`placeOrder`) |
| `ECP-PRM-4220` | 422 | Voucher invalid, expired, or not applicable. **Deliberately non-disclosive** on the standalone validation endpoint — the three causes are indistinguishable there, because that endpoint is an enumeration surface | `BR-PRM-01`, `FR-ORD-05` | 1 (`placeOrder`) |
| `ECP-PRM-4221` | 422 | Discount would exceed the discountable value of the order | `BR-PRM-02` | 2 |

### 3.11 `REV` — Review

| Code | Status | Meaning | Enforces | Operations |
|---|---|---|---|---|
| `ECP-REV-4030` | 403 | Reviewer is not a verified buyer of this product. Unbypassable by any role. The verified-purchase read model is eventually consistent, so the response tells the caller to retry shortly rather than that they never bought the product | `BR-REV-01`, `FR-REV-06` | 1 (`submitProductReview`) |

### 3.12 `NTF` — Notification

No domain-specific code is defined. Notification failures resolve to `GEN` codes.

### 3.13 `ADM` — Administration

No domain-specific code is defined. `BR-AUD-03`'s "last Administrator" protection is enforced as a **database constraint** ([Security.md](../01-system/Security.md) §4.5), and its violation is not designed to surface as an application error code — it is a data-integrity failure, not a request the application layer is expected to reject cleanly with its own code. `Permission Matrix.md` §9 flags this as an open item worth a code once the constraint's failure mode is decided.

### 3.14 `RPT` — Reporting & Analytics

No domain-specific code is defined. Reporting failures resolve to `GEN` codes.

### 3.15 `AUD` — Audit & Access Control

No domain-specific code is defined, **and it is expected to stay that way.** `ADR-0017`'s no-mutation-API guarantee means the only two `AUD` operations are reads; nothing here has a domain-specific failure mode beyond `GEN`'s validation, authentication, authorisation, and not-found codes.

---

## 4. Field-Level Validation Sub-Codes

`ECP-GEN-4000`'s `errors` array carries one entry per failing field, and each entry is itself an `ECP-<DOMAIN>-<NNNN>` code — a field-level code, not the top-level `ECP-GEN-4000` repeated ([`Integration Contract.md`](./Integration%20Contract.md) §4.3, [`components/schemas/common.yaml`](./OpenAPI/components/schemas/common.yaml) `FieldError`).

Two are documented as examples in every normative source that shows the shape:

| Code | Meaning |
|---|---|
| `ECP-GEN-4002` | The field is required and was absent |
| `ECP-GEN-4003` | The field failed a range or length constraint (example given: "must be at least 1") |

**This space is open, not enumerated.** No source names a complete list of field-constraint sub-codes — each is assigned when the constraint it reports is implemented, following the same domain-ownership and never-reuse rules as any other code (§2). `ECP-GEN-4001` is conspicuously unassigned in every source read for this registry; it is not implied to exist, and nothing should be built assuming it does.

---

## 5. Known Drift — To Resolve Before Any Code Exists

Two places in the repository already emit a code that does not match the scheme this document transcribes. Both are in illustrative sequence-diagram prose, not in a normative contract, but both would be a real bug if copied into a handler. They are recorded here rather than silently corrected, because the responsibility for reconciling them belongs to whoever owns those diagrams.

### 5.1 `ECP-SEC-4030` / `ECP-SEC-4290` — wrong domain code

[`02-backend/Sequence/00-Overview.md`](../02-backend/Sequence/00-Overview.md) and [`02-backend/Sequence/04-Identity.md`](../02-backend/Sequence/04-Identity.md) label a `403` and a `429` with a `SEC` domain code. **`SEC` is not an SRS §2.2 domain** — it does not appear in the fourteen-domain list §2 reproduces, and the platform has no `security` bounded context to own it. The correct codes, per [`Integration Contract.md`](./Integration%20Contract.md) §4.4 and used identically everywhere else in the repository, are:

| Sequence diagram wrote | Should read |
|---|---|
| `ECP-SEC-4030` | `ECP-GEN-4030` |
| `ECP-SEC-4290` | `ECP-GEN-4290` |

### 5.2 `ECP-SCH-5030` — right domain, wrong ownership

[`02-backend/Sequence/05-Cart-Catalog-Search.md`](../02-backend/Sequence/05-Cart-Catalog-Search.md) labels a degraded-search `503` `ECP-SCH-5030`. `SCH` is a real domain code, so this is closer than §5.1, but every other dependency-unavailable outcome in the seed catalogue — including provider failures more consequential than a slow search index — is `ECP-GEN-5030` (§3.1), and `NFR-AVAIL-03` is stated once, generically, not per domain. Search degrading gracefully is real and correct behaviour ([`NFR-AVAIL-02`](../01-system/Security.md)); the code it returns should be:

| Sequence diagram wrote | Should read |
|---|---|
| `ECP-SCH-5030` | `ECP-GEN-5030` |

If a reviewer instead decides `SCH` *should* own its own `503` — because a degraded read model is a different operational signal than an unreachable payment provider — that is a legitimate position, but it is a decision nobody has made yet, and this document does not make it unilaterally. Until it is made, the seed catalogue's existing `GEN-5030` is what a handler should throw.

---

## 6. Cross-Cutting Rules

Restated from [`Integration Contract.md`](./Integration%20Contract.md) §4.5 because this is the file someone reaches for when adding a code, not the Integration Contract:

1. A code, once published, is never reused for a different meaning and never removed within a major version. Deprecating a code means it stops being *returned*, not that it stops being *documented* — the row stays, marked deprecated.
2. Every `4xx`/`5xx` response carries a `code`. There is no bare status-code error.
3. `5xx` never leaks an exception type, a stack frame, or a SQL fragment into `detail`.
4. A failure caused by an external provider is `ECP-GEN-5030`, never a passthrough of the provider's own error.

And from [Security.md](../01-system/Security.md) §8.4, because an error code is a place `NFR-SEC-07` is tested as much as a log line is: `detail` never contains a credential, a token, a payment detail, or a raw request payload, at any status.

---

## 7. Governance

| Change | What it needs |
|---|---|
| A new code | Appended to the table for its owning domain in this file **and** to [`Integration Contract.md`](./Integration%20Contract.md) §4.4 in the same change, per [`Integration Contract.md`](./Integration%20Contract.md) §10. Owned by the domain named in the code. |
| A code's meaning | Never changes. A changed rule gets a new code; the old one is deprecated (rule 1, §6). |
| Resolving §5's drift | A decision by whoever owns the affected sequence diagrams, recorded as an edit to those diagrams — not to this registry, which already states the correct code. |
| The `ECP-GEN-4000` sub-code space (§4) | New sub-codes are added as the constraints they report are implemented. No pre-allocation. |

---

## 8. Next Step

[`Backend Architecture.md`](../02-backend/Backend%20Architecture.md) §6.3 is unchanged by this document and remains the plan: one enum per domain in `<module>.api`, `GEN` in `shared-kernel`, a CI check that fails on a **removal or redefinition** (an addition passes), and a **generated** version of this file that the CI check diffs against. When that exists, this hand-authored file is replaced by the generated one — the same relationship [ADR-0031](../01-system/ADR/ADR-0031-contract-first-openapi.md) gives the OpenAPI document, running in the opposite direction: there, the hand-authored document is normative and code is checked against it; here, the code is the source and this document is what gets regenerated.

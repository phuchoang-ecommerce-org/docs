# ADR-0003 — REST as the Client-Facing API Style

**Document type:** Architecture Decision Record
**Status:** Accepted · versioning is **Proposed** · the `Contract` row of §4 is **superseded by [ADR-0031](./ADR-0031-contract-first-openapi.md)**
**Date:** 2026-09-06
**Deciders:** Solution Architecture
**Traces to:** `P3` · `P5` · `P16` · `NFR-SEC-01` · `NFR-SEC-04` · `NFR-REL-02`
**Related documents:** [Solution Architecture](../Solution%20Architecture.md) · [SRS](../../../BA-docs/srs.md) · [ADR-0016](./ADR-0016-jwt-refresh-rotation-rbac.md)

---

## 1. Context and Problem Statement

[`Solution Architecture.md`](../Solution%20Architecture.md) §3 shows `Client Applications → REST API + Authentication`, and every actor row in §4 — Guest, Customer, Staff, Warehouse Operator, Support, Administrator — reads *"Enters through: REST API."* GraphQL and gRPC appear nowhere in the repository.

What §4 does **not** settle is the surrounding contract: how the API is versioned, how the schema is published, and how the wire format is agreed with the frontend. SRS §1.2 explicitly declares API wire formats out of scope at the BA level, so there is no upstream answer to defer to. With the frontend architecture being decided now ([ADR-0019](./ADR-0019-nextjs-app-router-rendering-strategy.md) onward), an unversioned, undocumented API becomes a coupling problem immediately.

There are three distinct client classes to serve: the web storefront, the admin console, and — per SRS §8 — a future mobile application. `P5` requires that a new client is a new *caller* of existing rules, never a new place rules are re-implemented.

## 2. Decision Drivers

- Every operation must be authorised server-side against the caller's role, at one boundary (`NFR-SEC-01`, `P16`).
- All externally supplied input must be validated before business processing (`NFR-SEC-04`).
- Repeated submission of a confirmed checkout must never produce a second order (`NFR-REL-02`, `BR-ORD-03`) — the API style must make request idempotency expressible.
- Rate limits must be applied per caller, stricter on authentication endpoints (`NFR-SEC-05`).
- A future mobile client must be additive (`P5`, SRS §8).

## 3. Considered Options

**Option 1 — REST over HTTP/JSON.** *(chosen)*

- **Pros:** One resource per URI makes the authorisation boundary trivially enumerable — every endpoint maps to one operation and one RBAC rule, which is what makes `NFR-SEC-01` testable "per role per operation" as the SRS requires. Per-endpoint rate limiting (`NFR-SEC-05`) is a first-class concept. Idempotency keys on `POST /orders` are a well-worn pattern for `BR-ORD-03`. Caching semantics are built into the protocol, which matters for the `NFR-PERF-01` catalog read path. Universally consumable by web, admin, and mobile clients with no client-side runtime.
- **Cons:** Over-fetching and under-fetching on composite screens (a product detail page needs product, variants, availability, reviews, and promotions) — mitigated by purpose-built query endpoints, which CQRS ([ADR-0008](./ADR-0008-cqrs-command-query-separation.md)) makes cheap. No schema by default; a contract must be published deliberately.

**Option 2 — GraphQL.**

- **Pros:** Solves over/under-fetching directly; a single endpoint; strong typing; frontends iterate without backend changes.
- **Cons:** Authorisation moves from the endpoint to the field resolver, so `NFR-SEC-01`'s "per role per operation" verification becomes per-role-per-field across a graph — a materially larger and less enumerable surface for a platform whose whole security posture is role-based (`P16`). Per-caller rate limiting (`NFR-SEC-05`) requires query-cost analysis rather than a request counter. Arbitrary client-shaped queries against the read models undermines the point of CQRS, which is that read models are *purpose-built*. Appears in no upstream document.

**Option 3 — gRPC.**

- **Pros:** Strong contract by construction; efficient binary framing; excellent for service-to-service calls.
- **Cons:** Poor fit for a browser-first storefront (requires a proxy layer). The system has no service-to-service traffic to optimise — it is a single deployable ([ADR-0002](./ADR-0002-modular-monolith-deployment-unit.md)). Solves a problem this platform does not have.

**Option 4 — REST for the storefront, GraphQL for the admin console.**

- **Pros:** Each client gets the shape that suits it; the admin console's composite views are where GraphQL's benefit is real.
- **Cons:** Two API surfaces, two authorisation models, two rate-limit strategies — for the *same* RBAC policy. Doubles the surface `NFR-SEC-01` must be verified across, to serve the client class with the fewest users.

## 4. Decision Outcome

**Chosen: Option 1.** A single REST/JSON API serves every client class. All six roles enter through it; authorisation is applied once at the API/application boundary ([ADR-0016](./ADR-0016-jwt-refresh-rotation-rbac.md)) and never assumed by a client.

Three supporting choices are recorded here as **Proposed**, since no upstream document states them:

| Aspect | Proposed | Reason |
|---|---|---|
| Versioning | URI path prefix, `/api/v1/...` | Visible in logs, cacheable, trivially routable; header-negotiated versioning hides the version from the artefacts used to debug it. |
| Contract | OpenAPI 3.1, generated from the controller layer and published under `04-shared/OpenAPI` | [`example-folder-structure.md`](../../example-folder-structure.md) already reserves `04-shared/OpenAPI` for exactly this. Generated rather than hand-written, so it cannot drift. |
| Idempotency | `Idempotency-Key` request header on order placement and payment initiation | The mechanism `BR-ORD-03` and `NFR-REL-02` require; scoped to those endpoints rather than applied globally. |

> **Superseded, in part.** The `Contract` row above is replaced by
> [ADR-0031](./ADR-0031-contract-first-openapi.md), which keeps OpenAPI 3.1 and the
> `04-shared/OpenAPI` location but makes the document **hand-authored and verified**
> rather than generated: drift is prevented by a CI gate that diffs the generated
> description against the published one and fails the build on divergence, instead of
> by generation alone. The row is left as written — a record is never rewritten
> ([ADR/README](./README.md) §2) — and the reasoning for the change is in ADR-0031 §1.
> The `Versioning` and `Idempotency` rows are unaffected.

A read endpoint may be served by any read model — PostgreSQL, Elasticsearch, MongoDB, or Redis — without that choice appearing in its URI. Which store answers a query is an infrastructure decision behind the API, not part of the contract.

## 5. Consequences

### Positive

- One authorisation boundary, enumerable endpoint by endpoint, which is what makes `NFR-SEC-01` verifiable per role per operation.
- The future mobile client (SRS §8) is a new caller, not new work — `P5` holds by construction.
- Per-endpoint rate limiting satisfies `NFR-SEC-05`'s stricter-on-auth requirement without query analysis.

### Negative

- **Composite screens require multiple round trips or purpose-built aggregate endpoints.** The product-detail view is the clearest case. The mitigation is a dedicated query endpoint per view, which is CQRS working as intended but does mean the read API grows with the UI rather than being generic.
- **The read API couples loosely to screen design.** A frontend redesign can require a new query endpoint. Accepted: the alternative is client-shaped queries, which reintroduces the coupling CQRS removes.

### Neutral / follow-on

- The versioning, OpenAPI, and idempotency rows above stay `Proposed` until ratified in architecture review, per [ADR-0001](./ADR-0001-record-architecture-decisions.md).
- The `Contract` row was subsequently superseded by [ADR-0031](./ADR-0031-contract-first-openapi.md) before it was ever ratified; see the note in §4. `Versioning` and `Idempotency` remain `Proposed` as stated.
- Error-code taxonomy is not decided here; `04-shared/Error Codes` is reserved for it.

## 6. Related Decisions

[ADR-0016](./ADR-0016-jwt-refresh-rotation-rbac.md) · [ADR-0008](./ADR-0008-cqrs-command-query-separation.md) · [ADR-0005](./ADR-0005-clean-architecture-ports-and-adapters.md) · [ADR-0023](./ADR-0023-server-first-data-fetching.md)

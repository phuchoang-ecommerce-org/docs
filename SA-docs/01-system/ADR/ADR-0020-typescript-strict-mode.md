# ADR-0020 — TypeScript in Strict Mode, with API Types Generated from OpenAPI

**Document type:** Architecture Decision Record
**Status:** Proposed
**Date:** 2026-09-06
**Deciders:** Solution Architecture
**Traces to:** `P15` · `CON-02` · `NFR-MAINT-05` · `NFR-SEC-04`
**Related documents:** [Technology Stack](../Technology%20Stack.md) · [ADR-0003](./ADR-0003-rest-api-style.md) · [ADR-0018](./ADR-0018-architecture-governance-ci-gate.md)

---

## 1. Context and Problem Statement

When this record was written, TypeScript was named nowhere in the repository. [`Technology Stack.md`](../Technology%20Stack.md) listed Next.js, Radix, shadcn/ui, and Framer Motion — all of which ship TypeScript types and are overwhelmingly used with it — but the language itself was never stated. As with [ADR-0027](./ADR-0027-java-21-spring-boot-4-gradle.md) on the backend, the choice was implied and unrecorded. The stack line has since been updated to name it, as a consequence of this record.

The decision matters beyond developer preference. `P15` argues that structural discipline must be automatic rather than remembered, and [ADR-0018](./ADR-0018-architecture-governance-ci-gate.md) gives the backend an automated gate. Without a type system the frontend has no equivalent — its correctness rests on tests and review alone, which is the asymmetry `P15` warns about.

There is also a specific integration risk. The API is REST/JSON ([ADR-0003](./ADR-0003-rest-api-style.md)), and CQRS means read endpoints are purpose-built per view ([ADR-0008](./ADR-0008-cqrs-command-query-separation.md)) — so the response shapes are numerous and will change as views change. Hand-written response interfaces drift from the API silently, and the failure surfaces as a runtime `undefined` in a customer's browser.

## 2. Decision Drivers

- `P15` / `NFR-MAINT-05` — structural constraints caught when introduced.
- `CON-02` — high cohesion and loose coupling; explicit interfaces between UI modules.
- The read API is view-shaped and will change often ([ADR-0008](./ADR-0008-cqrs-command-query-separation.md)).
- [ADR-0003](./ADR-0003-rest-api-style.md) already commits to generating OpenAPI 3.1 from the controller layer and publishing it under `04-shared/OpenAPI`.
- `NFR-SEC-04` requires server-side validation of all input; the frontend's job is feedback, not enforcement.

## 3. Considered Options

**Option 1 — TypeScript with `strict: true`, plus API types generated from the OpenAPI document.** *(chosen)*

- **Pros:** Strict null checking eliminates the largest class of frontend runtime error, which matters most on a purchase path budgeted at `NFR-AVAIL-01`. Generated API types mean a backend response change breaks the build rather than a customer's checkout — the frontend's nearest equivalent to [ADR-0018](./ADR-0018-architecture-governance-ci-gate.md)'s gate, and it comes free because [ADR-0003](./ADR-0003-rest-api-style.md) already produces the document. Discriminated unions express the order lifecycle and `ReservationStatus` states the domain model already defines. Every library in the stack ships types.
- **Cons:** Strict mode is friction on genuinely dynamic code. Generated types must be regenerated when the API changes, and a stale generation is worse than none. Build and type-check time.

**Option 2 — TypeScript with default (non-strict) settings.**

- **Pros:** Gentler adoption; fewer null-check obligations; faster to write.
- **Cons:** Without `strictNullChecks` the single most valuable guarantee is off, and `any` spreads silently. Tightening later across a grown codebase is a large, low-priority project that rarely happens.

**Option 3 — JavaScript with JSDoc type annotations.**

- **Pros:** No build step for types; incrementally adoptable; editor support is decent.
- **Cons:** Weaker inference, awkward generics, poor ergonomics for discriminated unions, and no practical path to generated API types. Adds ceremony without the payoff.

**Option 4 — Plain JavaScript.**

- **Cons:** Leaves the frontend with no automated structural check whatsoever, against a backend that has ArchUnit, Modulith verification, and a mandatory CI gate. Fails `P15` on the half of the system the customer actually touches.

## 4. Decision Outcome

**Chosen: Option 1.** TypeScript with `strict: true`, and API types generated from the published OpenAPI document.

| Commitment | Detail |
|---|---|
| `strict: true` | Including `strictNullChecks` and `noImplicitAny`. Not relaxed per file. |
| `any` is a defect | Where a type is genuinely unknown, `unknown` plus a narrowing check. Enforced by lint, failing the build. |
| API types are **generated**, never hand-written | From `04-shared/OpenAPI` ([ADR-0003](./ADR-0003-rest-api-style.md)); generation runs in CI, and a drifted checked-in output fails the build. |
| Domain vocabulary is typed | Discriminated unions for order status, payment status, and `ReservationStatus`; branded types for `OrderId`, `ProductId`, `SkuId`, mirroring the shared kernel's typed IDs ([ADR-0006](./ADR-0006-spring-modulith-module-boundaries.md)). |
| Money is never a bare number | Amount, currency, and precision travel together, matching the `Money` Value Object (`Domain Model.md` §5.3, SA §10). A float total is a defect. |
| Runtime validation at the boundary | A generated type is a compile-time claim about a network response, not a guarantee. Responses are parsed at the API boundary; `NFR-SEC-04` remains the server's obligation, and client validation is feedback only. |
| Lint and type-check are build-failing | The frontend counterpart of [ADR-0018](./ADR-0018-architecture-governance-ci-gate.md)'s mandatory gate. |

## 5. Consequences

### Positive

- A backend response-shape change breaks the frontend build instead of a customer's checkout.
- The `Money` and typed-ID rules carry the domain model's most easily-lost invariants into the client, where floating-point currency bugs otherwise appear.
- The frontend gets an automated structural gate, closing the asymmetry with the backend that `P15` would otherwise leave open.

### Negative

- **Generated types are only as fresh as the last generation.** A stale checked-in output gives false confidence — worse than no types. CI must regenerate and fail on drift, and that pipeline step is itself a thing that can silently stop working.
- **A generated type is not a runtime guarantee.** The compiler believes the OpenAPI document; the network delivers whatever it delivers. Boundary parsing is required, and skipping it converts a type error into a runtime one at the worst place.
- **Strict mode has real friction** at library boundaries and with dynamic form handling. The cost is paid continuously, in small amounts.

### Neutral / follow-on

- Generator choice, lint rule set, and formatter are for [`Frontend Architecture.md`](../../03-frontend/Frontend%20Architecture.md).
- This record stays `Proposed` until ratified, per [ADR-0001](./ADR-0001-record-architecture-decisions.md).

## 6. Related Decisions

[ADR-0003](./ADR-0003-rest-api-style.md) · [ADR-0019](./ADR-0019-nextjs-app-router-rendering-strategy.md) · [ADR-0023](./ADR-0023-server-first-data-fetching.md) · [ADR-0018](./ADR-0018-architecture-governance-ci-gate.md)

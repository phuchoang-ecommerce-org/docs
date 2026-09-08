# ADR-0031 — Contract-First OpenAPI, Verified Rather Than Generated

**Document type:** Architecture Decision Record
**Status:** **Proposed**
**Date:** 2026-09-08
**Deciders:** Solution Architecture
**Traces to:** `P5` · `P15` · `CON-02` · `NFR-SEC-01` · `NFR-MAINT-05`
**Related documents:** [ADR-0003](./ADR-0003-rest-api-style.md) · [ADR-0018](./ADR-0018-architecture-governance-ci-gate.md) · [ADR-0020](./ADR-0020-typescript-strict-mode.md) · [Integration Contract](../../04-shared/Integration%20Contract.md) · [OpenAPI](../../04-shared/OpenAPI/README.md)

---

## 1. Context and Problem Statement

[`ADR-0003`](./ADR-0003-rest-api-style.md) §4 proposed that the API contract be
*"OpenAPI 3.1, generated from the controller layer and published under
`04-shared/OpenAPI`… **generated rather than hand-written, so it cannot
drift**."* [`Integration Contract.md`](../../04-shared/Integration%20Contract.md)
§1.1 took that at its word and kept the folder deliberately empty, on the
grounds that *"a hand-authored specification written before the code is the exact
drift that requirement exists to prevent."*

That reasoning is sound about drift and silent about sequencing. The repository
contains a 739-line SRS, 87 fully specified use cases, a 2 029-line physical
schema, and thirty architecture decisions — and **no description of the API those
things imply**. The only fully-qualified path literal anywhere in the repository
is `POST /api/v1/orders`, quoted in passing as an idempotency example.

Five documents point at `04-shared/OpenAPI` for something that does not exist:

- [`ADR-0020`](./ADR-0020-typescript-strict-mode.md) requires the frontend's API
  types to be **generated, never hand-written**, from that folder. With the folder
  empty, the frontend either hand-writes the types ADR-0020 forbids, or waits.
- [`ADR-0018`](./ADR-0018-architecture-governance-ci-gate.md)'s test strategy has
  no contract to test the API against.
- `NFR-SEC-01` requires authorisation to be verifiable *per role per operation*.
  [`Integration Contract.md`](../../04-shared/Integration%20Contract.md) §9 gives
  the role × domain grid, but "per operation" has no list of operations.
- [`Integration Contract.md`](../../04-shared/Integration%20Contract.md) §1.1 and
  §11 both defer to a controller layer that does not exist.
- [`example-folder-structure.md`](../../example-folder-structure.md) reserves the
  folder.

So the question is not *generated or hand-written*. It is: **while there is no
controller layer, is the API contract undefined, or is it defined and later
checked?** The generation-first position answers "undefined", and the cost of
that answer falls on every downstream decision listed above.

There is also a sequencing consequence nobody chose. If the first description of
the wire format is the one emitted by the first controller, then the wire format
is decided by whoever writes that controller, one endpoint at a time, without
review — which is the opposite of what `P15` and `NFR-MAINT-05` ask for.

## 2. Decision Drivers

- The frontend's types must be generated from a published contract
  (`CON-02`, [ADR-0020](./ADR-0020-typescript-strict-mode.md)), and the frontend
  is being designed now.
- Authorisation must be verifiable per role per operation (`NFR-SEC-01`), which
  requires an enumeration of operations.
- A new client must be a new caller of existing rules, never a new place rules are
  re-implemented (`P5`) — which presupposes the rules are written down.
- Architectural intent must be enforced mechanically rather than by convention
  (`P15`, `NFR-MAINT-05`, [ADR-0018](./ADR-0018-architecture-governance-ci-gate.md)).
- Drift between a description and the running code is a real hazard, and the
  reason ADR-0003 preferred generation. Whatever replaces generation must control
  it just as firmly.

## 3. Considered Options

**Option 1 — Contract-first: hand-author the description now, verify it against
the controller layer in CI later.** *(chosen)*

- **Pros:** The contract exists at the moment the frontend and backend boundary
  is being designed, so ADR-0020 has an input and QA has something to test. The
  wire format is decided once, deliberately, by architecture review, rather than
  incrementally by whoever writes each controller. Every operation can carry its
  `UC`/`FR`/`BR` traceability and its permission-matrix cell, which makes
  `NFR-SEC-01` reviewable as a document rather than as an audit of code. The
  87 use cases already specify the behaviour; writing them down as endpoints
  surfaces gaps — six use cases turn out to have no HTTP surface at all — while
  they are still cheap to resolve.
- **Cons:** Drift is now possible, and the mechanism that prevents it does not
  exist yet: it is a CI gate to be built alongside the controllers. Between now
  and then, drift is prevented only by review. The description also encodes
  choices no repository document answers — nine of them, listed as `[ASSUMPTION]`
  in [`OpenAPI/README.md`](../../04-shared/OpenAPI/README.md) §6 — and each is a
  guess until ratified.

**Option 2 — Keep generation-first: ship no contract until controllers exist.**

- **Pros:** Zero drift risk, by construction. Nothing to maintain. It is the
  status quo, and it needs no new record.
- **Cons:** ADR-0020 and the whole frontend data layer stay blocked, or proceed
  on hand-written types ADR-0020 forbids. QA has nothing to write contract tests
  against. `NFR-SEC-01`'s per-operation verification has no operand. And the wire
  format ends up decided implicitly, endpoint by endpoint, by whoever writes the
  first controller — the least reviewed way to make a decision that every client
  class depends on.

**Option 3 — Hand-author a non-normative "design intent" document, to be replaced
by the generated one.**

- **Pros:** No governance change; ADR-0003 §4 stands untouched. Gives the
  frontend something to read.
- **Cons:** Two artefacts claiming to describe the same API, one of which is
  explicitly not authoritative — so when they disagree, nobody has to fix
  anything. A contract that carries no obligation is documentation, and
  documentation is exactly what
  [`Integration Contract.md`](../../04-shared/Integration%20Contract.md) §10 rule
  1 says loses to generated artefacts. It would also be a poor input to codegen,
  since generating client types from a document nobody guarantees is worse than
  generating them from nothing.

**Option 4 — Prose endpoint catalogue in `02-backend/API.md`.**

- **Pros:** The folder layout already reserves `API.md`. Prose is easy to write
  and easy to review.
- **Cons:** Not machine-readable, so ADR-0020 still cannot generate types and no
  tooling can validate a request against it. It reproduces the enumeration
  problem — a list of endpoints in prose is precisely the thing
  [`Integration Contract.md`](../../04-shared/Integration%20Contract.md) §1.1
  identifies as "the thing that would drift", with none of the compensating
  benefit of being executable.

## 4. Decision Outcome

**Chosen: Option 1.** The OpenAPI 3.1 description under
[`04-shared/OpenAPI/`](../../04-shared/OpenAPI/README.md) is hand-authored and
**normative**. It supersedes the `Contract` row of
[`ADR-0003`](./ADR-0003-rest-api-style.md) §4, which was `Proposed` and never
ratified. Everything else in ADR-0003 — REST over HTTP/JSON, `/api/v1` URI
versioning, `Idempotency-Key` scoped to order placement and payment initiation —
stands unchanged.

**The drift control moves from generation to verification.** ADR-0003's concern
was correct; only its mechanism changes.

| Phase | The contract is | Drift is prevented by |
|---|---|---|
| Now — no controller layer | The hand-authored document | Review, plus `redocly lint` and the coverage assertions in [`OpenAPI/README.md`](../../04-shared/OpenAPI/README.md) §8 |
| Once controllers exist | Still the hand-authored document | A CI gate that diffs the springdoc-generated description against it and **fails the build on divergence** |
| If the two ever disagree | — | The build is red until a human resolves it, in the same change, by fixing either the code or the specification |

The third row is the load-bearing one. ADR-0003 §4's phrase *"a wrong
specification means wrong code, not a wrong file"* assumed the specification could
only be a derived artefact. Under a failing gate, a divergence means **one of the
two is wrong and a person must say which** — which is a stronger guarantee than
generation, because generation makes the code right by definition and therefore
cannot catch a controller that implements the wrong contract.

This gate belongs in [`ADR-0018`](./ADR-0018-architecture-governance-ci-gate.md)'s
existing governance stage, alongside the ArchUnit and Modulith checks. It is the
same idea applied to a different boundary: intent is enforced mechanically, not
by convention.

Three supporting commitments:

1. **The Integration Contract remains superior for rules.** Where the OpenAPI
   document and [`Integration Contract.md`](../../04-shared/Integration%20Contract.md)
   §2–§5 disagree, the Integration Contract is right. The OpenAPI document is the
   *enumeration*; the Integration Contract is the *law*.
2. **Every operation carries its traceability and its permission-matrix cell**,
   as `x-ecp-traces` and `x-ecp-roles`. This is what makes `NFR-SEC-01`'s "per
   role per operation" reviewable rather than aspirational.
3. **Every choice the repository does not answer is marked `[ASSUMPTION]`** at
   the point of use and collected in
   [`OpenAPI/README.md`](../../04-shared/OpenAPI/README.md) §6, following the
   SRS §2.5 convention. An unconfirmed assumption is a known open item, not an
   agreed decision.

## 5. Consequences

### Positive

- [`ADR-0020`](./ADR-0020-typescript-strict-mode.md) is unblocked: the bundled
  document is a valid codegen input today.
- `NFR-SEC-01` becomes verifiable as written — 155 operations, each with its
  roles declared, checkable against the §9 permission matrix row by row.
- The wire format is decided once, in review, rather than incrementally in
  controllers. `P5` holds by construction because there is one written contract
  for every client class to call.
- Writing the enumeration surfaced things the prose had left implicit: six use
  cases have no HTTP surface at all, `Integration Contract` §4.4 has no `404`
  code although §4.5 rule 2 requires one, and two of its filter examples
  contradict the schema's own literals. All are recorded rather than papered
  over.

### Negative

- **Drift is possible until the CI gate exists, and the gate is not built.** This
  is the real cost of the decision and should not be softened: between now and
  the first controller, the only thing keeping the document honest is review.
  Someone must build the gate as part of the first controller work, not after it.
- **Nine assumptions are now embedded in a normative document** — cookie name,
  CSRF header, correlation header, pagination parameter names, and so on. Each is
  a decision made by this document because nothing upstream made it, and each
  could be overturned by `Backend Architecture.md` or `Frontend Architecture.md`,
  both of which are stubs. Overturning one after clients exist is a breaking
  change.
- **A hand-authored document is maintenance.** Every endpoint added must be added
  twice, in code and here, until the gate makes the omission fail the build.

### Neutral / follow-on

- This record is `Proposed`. Per [ADR-0001](./ADR-0001-record-architecture-decisions.md)
  and [ADR/README](./README.md) §2, promotion to `Accepted` is its own commit.
- `Backend Architecture.md` must specify the generation tool, the gate's
  invocation, and where in the pipeline it runs. `ADR-0003` §4 never named a
  tool, and neither does this record.
- The nine assumptions want ratification alongside the error taxonomy and event
  envelope that [`Integration Contract.md`](../../04-shared/Integration%20Contract.md)
  §11 already flags.
- `04-shared/Error Codes` remains reserved. `components/responses.yaml` is the de
  facto registry until it exists, and already contains one code — `ECP-GEN-4040`
  for `404` — that belongs in Integration Contract §4.4.

## 6. Related Decisions

[ADR-0003](./ADR-0003-rest-api-style.md) · [ADR-0018](./ADR-0018-architecture-governance-ci-gate.md) · [ADR-0020](./ADR-0020-typescript-strict-mode.md) · [ADR-0016](./ADR-0016-jwt-refresh-rotation-rbac.md) · [ADR-0025](./ADR-0025-httponly-cookie-session.md)

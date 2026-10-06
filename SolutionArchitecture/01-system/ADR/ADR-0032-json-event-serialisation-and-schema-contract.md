# ADR-0032 — JSON Event Serialisation with a Repository-Held Schema Contract; No Schema Registry

**Status:** **Proposed**
**Date:** 2026-09-09
**Traces to:** `P2` · `P6` · `P15` · `CON-07` · `NFR-REL-06` · `NFR-MAINT-04` · `NFR-SEC-07` · `AC-03`

---

## 1. Context and Problem Statement

[ADR-0012](./ADR-0012-transactional-outbox-and-kafka.md) §5 closes with two words that this record exists to remove: *"Schema registry and serialisation format are undecided."* Everything downstream of that sentence was written anyway, and three documents now depend on an answer that does not exist.

[`Integration Contract.md`](../../04-shared/Integration%20Contract.md) §6.1 fixes the envelope field by field and §8 fixes the evolution rule — additive by default, `eventVersion` and a new topic on a breaking change. But an evolution rule needs an artefact to evolve. §8.4 says so and names the gap outright: *"nothing in the compiler catches a consumer that misreads a field. Contract tests against the schema published in `04-shared/Event Contract` are the only mechanism that does, and [`ADR-0018`](./ADR-0018-architecture-governance-ci-gate.md)'s test stack does not yet name a tool for them. This is an open gap, not a solved problem."*

[`Module Dependency Diagram.md`](../../02-backend/Module%20Dependency%20Diagram.md) §5 constrains the answer more than it first appears. A Kafka consumer declares its **own** local record in `<consumer>.infrastructure` rather than importing the publisher's type, and that duplication is deliberate: it is what keeps the module graph acyclic and what makes extraction a boundary-preserving change. Any serialisation choice that reintroduces a shared generated type between publisher and consumer undoes that decision by the back door.

[`Database.md`](../../02-backend/Database.md) §5.1 has already committed half the answer without saying so. The outbox column is `payload JSONB`, and the envelope is stored *column for column*. A binary wire format would mean serialising out of JSONB into something else on every publish, and the outbox — which §4.3 of [`Backend Architecture.md`](../../02-backend/Backend%20Architecture.md) makes the replay source of record — would hold a different representation from the topic it feeds.

So the question is narrower than "which serialisation format is best": it is which format and which schema-governance mechanism satisfy an already-fixed envelope, an already-fixed JSONB outbox, an already-fixed no-shared-type rule, and a single-VM data tier ([ADR-0028](./ADR-0028-deployment-topology-containerisation.md)).

## 2. Decision Drivers

- `NFR-MAINT-04` / `AC-03` — a new consumer must be addable without editing the publisher. A format whose consumer needs publisher-generated classes weakens this.
- [`Module Dependency Diagram.md`](../../02-backend/Module%20Dependency%20Diagram.md) §5 — no shared Java type between a Kafka publisher and its consumers. This is the binding constraint.
- [`Integration Contract.md`](../../04-shared/Integration%20Contract.md) §8.4 — the named open gap. A decision that does not close it has not finished.
- [`Integration Contract.md`](../../04-shared/Integration%20Contract.md) §6.4 obligation 2 — a consumer must tolerate unknown fields. Whatever governs the schema must make additive change genuinely free.
- `NFR-SEC-07` — payloads carry business fields only. Something must be able to *check* that, not merely require it.
- [ADR-0028](./ADR-0028-deployment-topology-containerisation.md) — one `data-01` VM already running PostgreSQL, Redis, Kafka, Elasticsearch, and MongoDB. Each further stateful service is charged against the same failure domain.
- `P15` — the design must be reviewable. A schema a reviewer can read in a pull request is worth more here than one held in a running service.

## 3. Considered Options

### The wire format

**Option 1 — UTF-8 JSON, the envelope of [`Integration Contract.md`](../../04-shared/Integration%20Contract.md) §6.1 as the message value.** *(chosen)*

- **Pros:** Identical to what [`Database.md`](../../02-backend/Database.md) §5.1 already stores in `payload JSONB`, so the relay publishes what the outbox holds without a representation change and replay is byte-comparable with the original publication. Self-describing, so a consumer binding three fields of eleven needs nothing from the publisher — exactly [`Module Dependency Diagram.md`](../../02-backend/Module%20Dependency%20Diagram.md) §5's requirement. Adding a field is invisible to every existing consumer without coordination, which makes §8.1's "ship freely" real rather than aspirational. Readable in `kafka-console-consumer`, in a DLT inspection, and in a log line during an incident — which is when the format's ergonomics actually matter.
- **Cons:** Three to five times the size of a binary encoding for the same content. No structural validation at the broker: a malformed payload is discovered by a consumer, not rejected at publish. Field names repeat in every message.

**Option 2 — Apache Avro with a Confluent Schema Registry.**

- **Pros:** Compact binary encoding. The registry enforces compatibility at publish time rather than in CI, which is a genuinely stronger guarantee than anything Option 1 offers — an incompatible schema cannot be published at all. Schema evolution rules are a first-class, tested feature rather than a convention.
- **Cons:** The generated `SpecificRecord` classes are the shared type [`Module Dependency Diagram.md`](../../02-backend/Module%20Dependency%20Diagram.md) §5 exists to prevent; using `GenericRecord` instead to avoid that forfeits most of Avro's ergonomic benefit and leaves the size argument alone. The registry is a further stateful service on the single `data-01` failure domain, and it becomes a **publish-path dependency** — registry down means the relay cannot publish, which converts an availability problem into the delivery problem [ADR-0012](./ADR-0012-transactional-outbox-and-kafka.md) chose the outbox to avoid. The outbox holds JSONB, so every publish would transcode, and the replay source would no longer match the wire form. Rejected on the shared-type ground first and the operational ground second.

**Option 3 — Protocol Buffers.**

- **Pros:** Compact, fast, with an explicit and well-understood evolution model built on field numbers rather than names.
- **Cons:** The same generated-type problem as Option 2, in a stronger form: a consumer that wants three fields still compiles the publisher's `.proto`. Protobuf's default-value semantics also erase the difference between "absent" and "zero", which for a `Money` amount or a quantity is a correctness hazard rather than an inconvenience. Rejected.

**Option 4 — Java serialisation of the publisher's event type, which is Spring Modulith's default for its event-publication registry.**

- **Cons:** Puts the publisher's fully-qualified class name into the durable artefact. A consumer must have that class on its classpath, which is the shared type forbidden outright; a rename of the publisher's record breaks deserialisation of history already written. Unreadable during an incident. Rejected without reservation.

**Option 5 — CloudEvents, binary content mode over JSON.**

- **Pros:** A standard envelope with existing tooling, and the §6.1 envelope is already close to CloudEvents in shape — `eventId`/`id`, `eventType`/`type`, `occurredAt`/`time`.
- **Cons:** Close is not the same, and adopting it means renaming fields that [`Integration Contract.md`](../../04-shared/Integration%20Contract.md) §6.1 has already fixed as a contract, for conformance with a specification no consumer of this platform requires. The interoperability CloudEvents buys is with systems that do not exist here. Worth revisiting if an external subscriber ever appears; not worth a contract change today.

### Governing the schema

**Option A — JSON Schema files held in `04-shared/Event Contract/`, validated in CI on both sides.** *(chosen)*

- **Pros:** The artefact [`Integration Contract.md`](../../04-shared/Integration%20Contract.md) §8.4 already names, made real. It is reviewable in a pull request, versioned with the code that produces and consumes it, and diffable — so a breaking change is visible to a human reviewer, not only to a machine. It costs no runtime component and creates no publish-path dependency. Validation runs on the publisher (does what I emit match what I promised?) and on every consumer (does the fixture I bind against match what the publisher promises?), which is what actually catches the §8.4 failure mode.
- **Cons:** Enforcement is CI-time, not publish-time. A publisher that bypasses the test, or a consumer that never wrote one, is unprotected. The schemas are hand-maintained and can drift from the code that emits them unless the publisher-side test is genuinely derived from a real emission rather than from a fixture written alongside the schema.

**Option B — No schema artefact; the `Integration Contract.md` §7 catalogue table is the contract.**

- **Cons:** A prose table cannot be executed. This is the state §8.4 describes as an open gap, and choosing it is choosing to leave it open. Rejected.

**Option C — Schemas generated from the publisher's Java record at build time.**

- **Pros:** Cannot drift from the emitting code, which is Option A's main weakness.
- **Cons:** Makes the publisher's Java type the source of truth for a contract [ADR-0012](./ADR-0012-transactional-outbox-and-kafka.md) §4 says is *"owned jointly by publisher and consumers"*. A rename in the publisher would silently rewrite the contract and the generated schema would agree with it — the diff a reviewer needs to see is exactly the diff this option removes. Rejected, but its concern is real and is answered in §4 by deriving the publisher-side test from an actual emitted envelope.

## 4. Decision Outcome

**Chosen: Option 1 + Option A.** JSON on the wire, JSON Schema in the repository, no registry.

### The wire form

| Element | Content |
|---|---|
| Message **value** | The [`Integration Contract.md`](../../04-shared/Integration%20Contract.md) §6.1 envelope, UTF-8 JSON, exactly as stored in the outbox row's columns and `payload JSONB` |
| Message **key** | `aggregateId`, as its canonical string form. [`Integration Contract.md`](../../04-shared/Integration%20Contract.md) §6.3 — *"partitioning by `aggregateId` is not a tuning choice"* |
| Message **headers** | `ecp-event-id`, `ecp-event-type`, `ecp-event-version`, `ecp-correlation-id`, `ecp-occurred-at` — mirrored from the body |
| Compression | `lz4` at the producer ([`Backend Architecture.md`](../../02-backend/Backend%20Architecture.md) §4.5), which recovers most of what JSON costs over a binary format |

**The headers are a mirror, never a second source.** They exist so that a DLT triage, a filtering consumer, or a log correlation can read the identity of a message without parsing its body. If a header and the body disagree, **the body is right** — the body is what the outbox row produced and what replay reproduces. A consumer must not bind business logic to a header.

### The schema contract

```
04-shared/Event Contract/
├── README.md
├── envelope.v1.json                     # the §6.1 envelope; every event schema references it
├── ordering/
│   ├── OrderCreated.v1.json
│   ├── OrderPaid.v1.json
│   └── …
├── payment/  ·  shipping/  ·  catalog/  ·  inventory/  ·  promotion/  ·  review/
```

| Rule | Detail |
|---|---|
| Dialect | JSON Schema 2020-12 |
| One file per event type **per major version** | `OrderPaid.v2.json` is a new file; `v1` is never edited once a consumer exists. This is [`Integration Contract.md`](../../04-shared/Integration%20Contract.md) §8.3's dual-publish window expressed as files |
| The envelope is referenced, never copied | `$ref: "../envelope.v1.json"`, with the event schema constraining `payload` only. An envelope change is then one edit, not one per event |
| `additionalProperties` is **`true`** on `payload` | Deliberate, and the mechanical expression of §6.4 obligation 2. A schema that forbade unknown fields would make every additive publisher change break every consumer's validation — the precise outcome §8.1 exists to prevent |
| Required fields are the ones a consumer may rely on | Adding a field is additive only if it is optional. Making an existing optional field required is a `v2` (§8.2) |
| Forbidden field names are enumerated | `NFR-SEC-07` as a check rather than a hope — see below |

**`NFR-SEC-07` becomes checkable here.** Every event schema inherits a shared `$ref` that fails validation on a `payload` property whose name matches a denylist — `password`, `passwordHash`, `token`, `refreshToken`, `accessToken`, `cardNumber`, `pan`, `cvv`, `secret`, `apiKey`, `authorization`. This is a name check, not a content check, and it will not catch a credential stored in a field called `reference`. It catches the careless case, which is the common one, and it is more than the constraint has today.

### The tests that close [`Integration Contract.md`](../../04-shared/Integration%20Contract.md) §8.4

Two, on opposite sides of the topic, and neither is optional:

| # | Side | Test | Catches |
|---|---|---|---|
| 1 | **Publisher** | For every event type the module publishes: exercise the command that emits it, read the resulting **outbox row**, and validate its envelope against the schema | A publisher that emits a field the contract does not describe, or omits one it promises. Reading the real outbox row rather than a hand-written fixture is what stops Option C's drift concern from applying |
| 2 | **Consumer** | For every topic the module consumes: validate the module's own local record against the schema — every field it binds must exist in the schema and be `required` there | A consumer binding a field the publisher never promised, or one the publisher may legally drop. This is the §8.4 failure mode by name |

Both run at **L3** ([`Testing and Benchmark Strategy.md`](../Testing%20and%20Benchmark%20Strategy.md) §6.6, the contract-test section), are build-failing, and are enumerated in [`Backend Architecture.md`](../../02-backend/Backend%20Architecture.md) §9 as CI-gate rules so that a *missing* test is itself a failure — a contract test that was never written protects nothing, and its absence is invisible unless something looks for it.

Test 2 is the one that matters, and it is worth being precise about why. Test 1 protects a publisher against itself, which a careful team mostly manages. Test 2 protects a consumer against a publisher it does not compile against — the relationship [`Module Dependency Diagram.md`](../../02-backend/Module%20Dependency%20Diagram.md) §5 deliberately removed from the compiler, and therefore the only place the removal can be paid for.

## 5. Consequences

### Positive

- [`Integration Contract.md`](../../04-shared/Integration%20Contract.md) §8.4's open gap is closed with a named artefact and two named tests, on both sides of the boundary.
- [`Module Dependency Diagram.md`](../../02-backend/Module%20Dependency%20Diagram.md) §5's no-shared-type rule survives serialisation. A consumer needs the schema, not the publisher's jar — so `AC-03`'s "add a consumer without touching checkout" holds through the build system as well as at runtime.
- The outbox holds the wire form. Replay ([`Backend Architecture.md`](../../02-backend/Backend%20Architecture.md) §3.4.5) republishes bytes equivalent to the original, and a rebuilt projection is comparable to the first build rather than merely similar.
- No new stateful service on `data-01`, and no registry on the publish path. Kafka remains the only thing the relay can fail to reach.
- `NFR-SEC-07` acquires a mechanical check where it previously had only a review instruction.
- A dead-lettered message is readable. During the incident where that matters, a binary payload would need tooling that nobody has configured yet.

### Negative

- **Compatibility is enforced in CI, never at publish time.** A registry would refuse an incompatible schema outright; this does not. A publisher whose test is skipped, quarantined, or never written can break a consumer, and the failure surfaces in the consumer's logs at runtime. This is the standing cost of the decision and the strongest argument Option 2 had.
- **The schemas are hand-maintained.** Test 1 catches divergence between a schema and the code that emits it *for event types someone wrote a test for*. A new event type with no publisher test has a schema nobody verifies, which is why §9 of [`Backend Architecture.md`](../../02-backend/Backend%20Architecture.md) makes the missing test a gate failure rather than trusting the practice.
- **JSON costs three to five times Avro's bytes**, in broker storage, in page cache, and in replication that a single broker does not currently pay but a replicated cluster would. `lz4` narrows the gap; it does not close it. At `NFR-SCAL-06`'s 10× peak this is a real throughput consideration, and it is the price of self-description.
- **The denylist is a name check.** `NFR-SEC-07` remains a review obligation for anything a denylist cannot see. Presenting the check as full coverage would be worse than not having it.
- **Header/body duplication can drift** if a future code path sets one without the other. The body-wins rule bounds the damage but does not prevent a confusing log line.

### Neutral / follow-on

- `04-shared/Event Contract/` does not exist yet. It is reserved in [`SA-docs/README.md`](../../README.md#folder-layout) §1.1 and is created by the change that implements this record; until then §4's structure is a specification, not a directory.
- The JSON Schema validation library is not fixed here. Any 2020-12-conformant JVM implementation satisfies §4; naming one is a build concern for [`Backend Architecture.md`](../../02-backend/Backend%20Architecture.md) §8.
- CloudEvents remains a reasonable future move if an external subscriber ever appears, and would be a `v2` envelope under [`Integration Contract.md`](../../04-shared/Integration%20Contract.md) §8.3 rather than an in-place change.
- If the deployment ever grows past one broker and one VM, Option 2 should be re-examined on its publish-time-enforcement merit. The shared-type objection would still stand; the operational objection would not.

## 6. Related Decisions

[ADR-0012](./ADR-0012-transactional-outbox-and-kafka.md) · [ADR-0033](./ADR-0033-polling-outbox-relay.md) · [ADR-0018](./ADR-0018-architecture-governance-ci-gate.md) · [ADR-0031](./ADR-0031-contract-first-openapi.md) · [ADR-0006](./ADR-0006-spring-modulith-module-boundaries.md)

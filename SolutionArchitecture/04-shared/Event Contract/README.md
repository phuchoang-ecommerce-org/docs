# Event Contract — Enterprise Commerce Platform (ECP)

**Document type:** Versioned internal integration contract
**Status:** Proposed
**Audience:** Backend Engineering, Frontend Engineering, QA, Architecture Review
**Related documents:** [Integration Contract](../Integration%20Contract.md) §6–§8 · [ADR-0032](../../01-system/ADR/ADR-0032-json-event-serialisation-and-schema-contract.md) · [Private web revalidation callback](./web-revalidation.v1.md)

---

This directory is the normative JSON Schema contract for events crossing module
boundaries. Every event schema uses JSON Schema 2020-12 and references
[`envelope.v1.json`](./envelope.v1.json); a consumer may rely only on fields its
schema marks required. Event payloads are additive: they permit unknown fields
so a compatible publisher change does not break an existing consumer.

| Location | Purpose |
|---|---|
| `envelope.v1.json` | Common event identity, ordering, correlation, and payload wrapper |
| `catalog/` | Catalog events consumed by search, cache invalidation, and web revalidation |
| `web-revalidation.v1.md` | Signed internal HTTP delivery of a catalog event to `ecp-web`; it is deliberately not part of the public REST OpenAPI contract |

The catalog schemas here are the Sprint 9 set consumed by the web-revalidation
callback. They describe event values, never page content or request credentials.
The callback derives its cache tags from the declared identifiers; it never
accepts a caller-provided cache tag.

# ADR-0037 — The URL Search-Param Encoding Is a Stability Contract

**Status:** Proposed
**Date:** 2026-09-09
**Traces to:** `P11` · `NFR-PERF-01` · `NFR-PERF-03` · `NFR-MAINT-02`

---

## 1. Context and Problem Statement

[ADR-0024](./ADR-0024-frontend-state-management.md) put navigational and shareable UI state in the URL — search query, facet selections, sort, page, active tab — because a customer who filters a category and shares the link, or reloads it, must land on the same view. `P11` makes discovery a revenue problem, and browser back/forward through a filtered set is a discovery flow rather than an edge case.

That record then deferred the format, and flagged the risk in one sentence: *"the encoding must stay stable or old shared links break."*

The risk is larger than it sounds, because a URL is the only piece of this application's state that escapes it. A store schema can be changed in a deploy. A cache key can be versioned. A shared link sits in a message thread, a bookmark bar, a marketing email, and a search index for years, and it is redeemed against whatever version of the application is running when someone clicks it. There is no migration path for a URL that has already been sent.

Two backend rules constrain the answer and are easy to miss. [`Integration Contract.md`](../../04-shared/Integration%20Contract.md) §3.3 makes an **unknown filter parameter a `400`, never silently ignored** — so anything the frontend forwards blindly turns a stale bookmark into a broken page. And §3.2 makes pagination **cursor-based with an opaque `page.next`** that a client "never constructs or parses," so page state cannot be a number.

## 2. Decision Drivers

- `P11` — filtered views must be shareable, reloadable, and back/forward-correct.
- A shared link outlives the deployment that produced it, and cannot be migrated.
- [`Integration Contract.md`](../../04-shared/Integration%20Contract.md) §3.2, §3.3 — opaque cursors; unknown filter parameters are rejected.
- `NFR-PERF-01` / `NFR-PERF-03` — URL state is a cache key, so two spellings of one selection are two cache entries and two renders of the same page.
- `NFR-MAINT-02` — the encoding is used by every list surface in the application; changing it must not require touching all of them.

## 3. Considered Options

**Option 1 — Readable, named parameters with a canonical form and additive-only evolution.** *(chosen)*

- **Pros:** A link is legible to the person sending it, which is most of why anyone shares one. It maps almost directly onto the API's own named filter parameters, so translating the URL into a request is nearly the identity function and there is no place for a mapping table to drift. Canonical ordering means one selection produces one URL, so it is one cache entry and one analytics row. Ignoring unknown parameters on parse makes a removed facet degrade an old link rather than break it, and — because unknown parameters are dropped rather than forwarded — prevents §3.3's `400`.
- **Cons:** Multi-select facets produce long, ugly URLs, which [ADR-0024](./ADR-0024-frontend-state-management.md) §5 already accepts as a cost. Canonical ordering has to be implemented and tested, or it silently does not hold. Additive-only evolution means a badly chosen parameter name is permanent.

**Option 2 — A single compressed, encoded state blob: `?s=eyJxIjoi...`.**

- **Pros:** Short URLs regardless of how many facets are selected. The internal shape can change freely as long as the decoder keeps up. Trivially handles nested and complex filter structures.
- **Cons:** The link is opaque to the person sharing it, which removes the one property that makes URL state feel trustworthy. Every version of the encoder must be decodable forever, which is the versioning ratchet this record exists to avoid — the "we can change it freely" benefit is exactly the thing that makes old links a liability. It defeats analytics, defeats debugging from a log line, and makes an unrecognised old blob an all-or-nothing failure rather than a partial degradation.

**Option 3 — Path segments: `/c/shirts/size/m-l/colour/blue`.**

- **Pros:** The prettiest option, and the most SEO-legible for a small, curated set of facet combinations.
- **Cons:** Combinatorial route explosion, and ambiguity the moment a facet value collides with a path segment. Ordering becomes semantic — `/size/m/colour/blue` and `/colour/blue/size/m` are different URLs for one view — so the cache-key problem gets worse rather than better. Sort and cursor do not belong in a path at all, so it ends up being a hybrid anyway. And it invites indexing of every facet combination, which is not a `P11` benefit but a crawl-budget problem.

**Option 4 — Leave it to each feature.**

- **Cons:** The null option. Fourteen features means fourteen encodings, several of which will handle multi-select or empty values differently, and the inconsistency surfaces first as a shared link that does not reproduce a view. `NFR-MAINT-02` argues against it directly.

## 4. Decision Outcome

**Chosen: Option 1.** Readable named parameters, canonically ordered, evolved additively, with unknown parameters ignored rather than forwarded.

| Commitment | Detail |
|---|---|
| Shape | `q` · `sort=field:asc\|desc` · `page=<opaque cursor>` · `f.<facet>=v1,v2` · `f.<facet>=min..max` · `tab` |
| Canonical form | Parameters serialised alphabetically; multi-select values sorted. One selection, one URL, one cache key |
| Empty is absent | A cleared filter removes its parameter entirely |
| `,` is reserved | As the multi-select separator; a value containing one is percent-encoded. No base64, no JSON in a query string |
| Unknown parameters | **Ignored on parse, dropped on serialise.** An old link degrades rather than breaking, and §3.3's `400` is never triggered by a stale bookmark |
| `page` | Opaque, pass-through, and **reset whenever anything else changes** — a cursor is meaningful only against the query that produced it |
| Evolution | **Additive only. No version parameter**, because versioning would require supporting every version forever |
| Implementation | One parse/serialise module per feature, in `features/<domain>/url/` ([`Feature Structure.md`](../../03-frontend/Feature%20Structure.md) §3.2) |

The full parameter table and the rules are in [`State Management.md`](../../03-frontend/State%20Management.md) §3.

## 5. Consequences

### Positive

- A shared or bookmarked link reproduces the view it was taken from, which is the `P11` property [ADR-0024](./ADR-0024-frontend-state-management.md) chose URL state to get.
- Canonical ordering collapses equivalent selections into one cache key, so `NFR-PERF-01`'s caching is not fragmented by parameter order.
- Ignoring unknown parameters means a removed facet ages a link rather than breaking it, and keeps `Integration Contract.md` §3.3's strictness from becoming a customer-facing failure.
- The URL is legible in a log, in an analytics row, and in a message — which is where most of a shared link's value actually is.

### Negative

- **Parameter names are permanent.** Additive-only evolution means a name chosen badly today is carried indefinitely, and the honest options later are a second name alongside the first or an accepted break. The encoding's durability is bought with exactly this rigidity.
- **Multi-select URLs are long and ugly**, and the mitigation is deliberately unavailable — compressing them would defeat rule 4 and make the link opaque.
- **Canonical ordering is a discipline the code has to implement**, and it fails silently: an un-normalised URL still works, it just fragments the cache and the analytics. It needs a test, not a convention.
- **A facet click is a server round trip** ([ADR-0024](./ADR-0024-frontend-state-management.md) §5), which is correct for shareability and slower than a local state update. On a poor connection this is felt.

### Neutral / follow-on

- Whether `R1` category routes should expose a curated subset of facet combinations as indexable paths — the SEO benefit Option 3 was reaching for — is a `P11` question that can be answered later without changing this encoding, because a canonical path can redirect into a canonical query.
- Internationalisation (`Frontend Architecture.md` §10 `F-04`) would add a locale segment to the path rather than a parameter here, and is unaffected by this record.

## 6. Related Decisions

[ADR-0024](./ADR-0024-frontend-state-management.md) · [ADR-0019](./ADR-0019-nextjs-app-router-rendering-strategy.md) · [ADR-0023](./ADR-0023-server-first-data-fetching.md) · [ADR-0003](./ADR-0003-rest-api-style.md)

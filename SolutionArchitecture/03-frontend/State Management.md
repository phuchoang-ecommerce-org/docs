# State Management — Enterprise Commerce Platform (ECP)

**Document type:** Frontend architecture specification (normative)
**Status:** **Proposed** — discharges [`ADR-0024`](../01-system/ADR/ADR-0024-frontend-state-management.md) §5's deferral of store structure and URL-serialisation format
**Audience:** Frontend Engineering, Architecture Review, QA
**Related documents:** [Frontend Architecture](./Frontend%20Architecture.md) · [Routing](./Routing.md) · [Data Fetching](./Data%20Fetching.md) · [Feature Structure](./Feature%20Structure.md) · [ADR-0024](../01-system/ADR/ADR-0024-frontend-state-management.md) · [ADR-0037](../01-system/ADR/ADR-0037-url-search-param-encoding-contract.md) · [Integration Contract](../04-shared/Integration%20Contract.md)

---

## 1. Scope

[`ADR-0024`](../01-system/ADR/ADR-0024-frontend-state-management.md) decided that state is classified by who owns it, and that the classification decides where it lives. It gave four categories and left two things open: the shape of the client store, and the format of the URL state. This document settles both.

The record's reason for existing is worth restating, because it is the failure this document prevents: **a global store is always the path of least resistance for the next feature**, and the outcome of leaving state placement undecided is a store that accumulates server data, UI flags, form drafts, and filter selections until it is the application. For cart, order, and payment data, a second representation that can disagree with the server has commercial consequences rather than stylistic ones.

---

## 2. Placing State

The four categories of [`ADR-0024`](../01-system/ADR/ADR-0024-frontend-state-management.md) §4, with the question that decides each:

| Category | Lives in | The question |
|---|---|---|
| **Server data** | Server Components; a client cache only in the four cases of [`Data Fetching.md`](./Data%20Fetching.md) §5 | Did it come from the API? |
| **Navigational / shareable** | **The URL** (§3) | Would a customer reasonably bookmark, share, or reload into this? |
| **Ephemeral local** | `useState` in the owning component | Does exactly one component care? |
| **Genuinely global client** | The Zustand store (§4) | Is it client-owned, shared across unrelated routes, and none of the above? |

Asked in that order, the first "yes" wins. The order matters: server data that looks shareable is still server data, and shareable state that looks global still belongs in the URL.

**Two heuristics that resolve most real cases.** State is lifted only as far as it is actually shared — the first question about new state is which component owns it, not which store it goes in. And if a piece of state is hard to place, it is usually two pieces of state: a filter selection (URL) and the open/closed state of the panel that sets it (local).

---

## 3. The URL Encoding Contract

**This is a stability contract, not a formatting convention.** A shared link outlives the deployment that produced it, and [`ADR-0024`](../01-system/ADR/ADR-0024-frontend-state-management.md) §5 names the failure directly: "the encoding must stay stable or old shared links break." `P11` makes filtered discovery views shareable and back/forward-correct by construction, and that property is only as good as the encoding's durability. [`ADR-0037`](../01-system/ADR/ADR-0037-url-search-param-encoding-contract.md) records the decision.

### 3.1 The parameters

| Parameter | Form | Example | Maps to |
|---|---|---|---|
| `q` | Free text | `q=linen+shirt` | The `q` of [`Integration Contract.md`](../04-shared/Integration%20Contract.md) §3.3 |
| `sort` | `field:asc` \| `field:desc` | `sort=price:asc` | The `sort` syntax of `O-09` |
| `page` | **Opaque cursor, pass-through** | `page=eyJvIjoxMjM0fQ` | `page.next`, never parsed or constructed |
| `f.<facet>` | Comma-joined values | `f.size=m,l` | A named filter parameter |
| `f.<facet>` (range) | `min..max`, either side omittable | `f.price=100..500` | Two named parameters server-side |
| `tab` | Identifier | `tab=reviews` | Nothing — client-side view selection |

### 3.2 The rules

1. **Canonical order.** Parameters are serialised alphabetically, and multi-select values within a parameter are sorted. Two equivalent selections produce one URL, which means one cache key, one history entry, and one analytics row rather than a combinatorial spread of them.
2. **Empty is absent.** A cleared filter removes its parameter. `f.size=` never appears.
3. **`,` is the separator and is reserved.** A facet value containing a comma is percent-encoded. Everything else uses standard percent-encoding — no custom escaping, no base64, no JSON in a query string.
4. **Unknown parameters are ignored on parse and dropped on serialise.** This is what makes the contract additive-only and what keeps old links working: a link from a version that had a facet since removed still loads, minus that facet, rather than erroring. It also matters for correctness — [`Integration Contract.md`](../04-shared/Integration%20Contract.md) §3.3 makes an unknown filter parameter a `400`, so forwarding one unrecognised would turn a stale bookmark into a broken page.
5. **`page` resets when anything else changes.** A cursor is meaningful only against the query that produced it; carrying one across a facet change returns results from a set that no longer exists.
6. **There is no version parameter.** Versioning the encoding would mean supporting every version forever. Additive-only change plus rule 4 achieves the same durability without the ratchet.
7. **One implementation per feature.** Parse and serialise live in `features/<domain>/url/` ([`Feature Structure.md`](./Feature%20Structure.md) §3.2). A second parser in a component is how the two disagree.

### 3.3 What follows for the UI

- **A facet click is a navigation.** [`ADR-0024`](../01-system/ADR/ADR-0024-frontend-state-management.md) §5 accepts this explicitly: URL state changes re-render server-side, so a filter interaction is a round trip rather than an instant local update. That is the price of shareability and it is paid deliberately.
- **The transition is rendered, not hidden.** The result list is marked pending during navigation rather than being replaced by a skeleton — replacing content the customer is reading with a skeleton on every facet click reads as a page reload and is worse than a brief dim.
- **Filter state is never mirrored into the store.** Two sources of truth for a facet selection is a synchronisation problem invented for no benefit.
- **Multi-select produces long URLs, and that is accepted.** [`ADR-0024`](../01-system/ADR/ADR-0024-frontend-state-management.md) §5 names it as a negative consequence; compressing them would defeat rule 4 and make a shared link opaque to the person sharing it.

---

## 4. The Client Store

One Zustand store, in `stores/`, with **exactly four slices**.

| Slice | Holds | Constraint |
|---|---|---|
| `cartBadge` | The line count shown in the header | **The named exception.** A small derived number, reconciled from the server on every cart read, never the basis of a decision |
| `toasts` | The transient notification queue | Ephemeral. Never persisted, never restored |
| `modal` | Which global modal is open, and its parameters | Global only because a modal can be opened from anywhere. Route-scoped dialogs use local state |
| `uiPrefs` | Client-side display preferences — list/grid, table density | The only persisted slice, in `localStorage`. Contains nothing about the customer |

### 4.1 The rules

1. **No server data.** If it came from the API, its cache is [`Data Fetching.md`](./Data%20Fetching.md)'s concern. `cartBadge` is the single deliberate exception and it is a count, not a cart.
2. **No authority.** A cached role or permission is for rendering only ([`Frontend Architecture.md`](./Frontend%20Architecture.md) §3.4). `NFR-SEC-01` puts every authorisation decision server-side.
3. **No token, ever.** The session lives in an httpOnly cookie the JavaScript cannot read ([`ADR-0025`](../01-system/ADR/ADR-0025-httponly-cookie-session.md)). There is nothing to store.
4. **Nothing server-rendered reads it.** A Zustand store on the server is either shared between users or silently per-request; both are bugs, and rule `I-7` of [`Feature Structure.md`](./Feature%20Structure.md) §4 makes the import a lint error.
5. **`uiPrefs` is the only persisted slice**, and it hydrates after mount so a persisted preference cannot cause a server/client markup mismatch.
6. **A fifth slice is an amendment to this section**, not a pull request. [`ADR-0024`](../01-system/ADR/ADR-0024-frontend-state-management.md) §4 is explicit: if the store grows large enough for Redux to be worth it, that is a signal state has been misclassified, not that the store needs upgrading.

### 4.2 On the cart badge

It is worth being precise, because [`ADR-0024`](../01-system/ADR/ADR-0024-frontend-state-management.md) §5 warns that "exceptions invite more exceptions."

The badge exists so that adding to a cart gives immediate feedback in the header without a round trip. It is **reconciled from the server on every cart read and after every cart mutation response** — the server's count always wins, including when it is lower. It is never read to decide anything: not whether checkout is reachable, not whether the cart is empty, not what to submit. If the badge and the cart page disagree, the cart page is right and the badge corrects itself on the next read.

---

## 5. Ephemeral Local State

`useState` in the owning component, and it covers more than it first appears to: form field values, disclosure open/closed, hover and focus, in-flight submission state, and the transient state of any control that does not survive a navigation.

**Form state is local, and forms submit through Server Actions** ([`Data Fetching.md`](./Data%20Fetching.md) §6). Field-level validation errors come back from the server in `errors[]` and are mapped onto their inputs; client-side validation is feedback only, and `NFR-SEC-04` keeps the real check server-side. A form library is permitted where a form genuinely warrants one; a form library is not a state-management decision and does not create a fifth category.

---

## 6. What Never Lives in Client State

Collected because each has a specific reason and each is a plausible mistake:

| Never | Why |
|---|---|
| An access or refresh token | Not readable by design ([`ADR-0025`](../01-system/ADR/ADR-0025-httponly-cookie-session.md)); storing one would defeat rotation and reuse detection |
| A role or permission treated as authority | `NFR-SEC-01`; the display hint is rendering data only |
| Order state, payment state, authoritative stock | `NFR-PERF-06` permits no lag; a stale copy is a customer acting on a fact that is no longer true |
| Cart contents | Server-owned. The badge count is the exception, and it is a number |
| Filter or sort selections | The URL owns them (§3), and duplicating them breaks back/forward |
| Anything derivable | A derived value in a store is a cache with no invalidation strategy |

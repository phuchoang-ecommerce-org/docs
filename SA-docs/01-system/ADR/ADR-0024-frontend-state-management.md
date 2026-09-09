# ADR-0024 — Frontend State Management: Server Cache, URL State, and a Minimal Client Store

**Status:** Proposed
**Date:** 2026-09-06
**Traces to:** `CON-02` · `P5` · `P11` · `NFR-MAINT-02` · `NFR-SEC-01`

---

## 1. Context and Problem Statement

No document names a state-management approach. The default outcome of leaving it open is a global store that accumulates everything — server data, UI flags, form drafts, filter selections — because a global store is always the path of least resistance for the next feature.

That outcome is worth avoiding specifically here, for two reasons.

**Most "state" in this application is not client state.** It is server data with a cache, and [ADR-0023](./ADR-0023-server-first-data-fetching.md) has already decided where it lives. Copying it into a client store creates a second representation that can disagree with the server — and for cart, order, and payment data that disagreement has commercial consequences.

**Filter and search state is a `P11` concern.** A customer who filters a category and shares the URL, or reloads it, must land on the same view. If facet selections live in a store rather than in the URL, that breaks — and so does browser back/forward, which is a discovery flow, not an edge case.

## 2. Decision Drivers

- `CON-02` / `NFR-MAINT-02` — high cohesion, loose coupling; a change in one area must not require changes elsewhere. A global store is a coupling surface by construction.
- `P11` — shareable, reloadable, back/forward-safe filtered views.
- `P5` / `NFR-SEC-01` — the client holds no authority. Roles cached client-side are for rendering only; hiding a control is never enforcement.
- [ADR-0019](./ADR-0019-nextjs-app-router-rendering-strategy.md) — Server Components cannot read a client store, so state placement determines component placement.
- `UI Design System.md` §9 — one primary objective per screen, progressive disclosure. Screens that do less need less state.

## 3. Considered Options

**Option 1 — Classify state by ownership: server cache, URL, local component state, and a minimal client store for the narrow remainder.** *(chosen)*

- **Pros:** Each kind of state lives where it belongs. Filter and pagination state in the URL makes views shareable and back/forward-correct, which `P11` needs. Server data stays server data, so there is no second copy to drift. Component-local state stays local, which is what `CON-02` means at the UI level. The client store holds only genuinely global, genuinely client-owned concerns — and stays small because everything else has a better home.
- **Cons:** Four categories to reason about; a developer must decide where a new piece of state belongs. URL state needs serialisation discipline for complex filters.

**Option 2 — A global client store (Redux or Zustand) as the primary state container.**

- **Pros:** One place to look; excellent devtools; familiar; time-travel debugging.
- **Cons:** Pulls server data into the client, creating the second representation this record exists to avoid — and for cart and order state that is a correctness problem, not a style preference. Store slices become a coupling surface across features, working against `CON-02`. Server Components cannot read it, so anything store-backed becomes a Client Component, undoing [ADR-0019](./ADR-0019-nextjs-app-router-rendering-strategy.md)'s benefit page by page.

**Option 3 — React Context for everything shared.**

- **Pros:** Built in; no dependency; adequate for genuinely static shared values.
- **Cons:** Every context consumer re-renders when any part of the value changes, which becomes a performance problem precisely on the busiest screens. Nested providers grow unmanageable. Fine for theme and locale; poor as a general mechanism.

**Option 4 — URL as the only shared state, no client store at all.**

- **Pros:** Maximum shareability; nothing to synchronise; the purest model.
- **Cons:** Some state genuinely does not belong in a URL — an open modal, a toast queue, an optimistic cart badge count. Forcing them there produces ugly URLs and surprising history entries.

## 4. Decision Outcome

**Chosen: Option 1.** State is classified by who owns it, and the classification decides where it lives.

| Category | Lives in | Examples |
|---|---|---|
| **Server data** | Server Components; TanStack Query only where the browser owns the interaction ([ADR-0023](./ADR-0023-server-first-data-fetching.md)) | products, cart contents, orders, reviews |
| **Navigational / shareable UI state** | **The URL** — search params | search query, facet selections, sort, page, active tab |
| **Ephemeral local state** | `useState` in the owning component | form field values, open/closed disclosure, hover |
| **Genuinely global client state** | A minimal **Zustand** store | cart badge count, toast queue, global modal state, client-side UI preferences |

**Rules:**

- **Server data is never copied into the client store.** If it came from the API, its cache is [ADR-0023](./ADR-0023-server-first-data-fetching.md)'s concern. The cart badge count is the deliberate exception: a small derived number kept for immediate feedback, reconciled from the server on every cart read, and never the basis of a decision.
- **Anything a customer would reasonably bookmark or share goes in the URL.** This makes `P11`'s filtered discovery views shareable and back/forward-correct by construction.
- **State is lifted only as far as it is actually shared.** The first question for new state is which component owns it, not which store it goes in.
- **The client store holds no authority.** A cached role or permission is for rendering only — `NFR-SEC-01` puts every authorisation decision server-side ([ADR-0016](./ADR-0016-jwt-refresh-rotation-rbac.md)), and hiding an admin button is courtesy, not security.
- **The session token is never in client state at all** — it lives in an httpOnly cookie the JavaScript cannot read ([ADR-0025](./ADR-0025-httponly-cookie-session.md)).

**Zustand rather than Redux** for the remainder: the remainder is small, and Redux's structure earns its cost at a scale this deliberately does not reach. If the store ever grows large enough for Redux to be worth it, that is a signal state has been misclassified, not that the store needs upgrading.

## 5. Consequences

### Positive

- Filtered and searched views are shareable, reloadable, and back/forward-correct — a direct `P11` benefit that a store-based approach silently loses.
- No second copy of server data, so cart and order state cannot disagree with the server.
- Most components stay Server Components, because most of them do not touch client state ([ADR-0019](./ADR-0019-nextjs-app-router-rendering-strategy.md)).
- The store stays small because everything with a better home has one.

### Negative

- **Four categories means a decision on every new piece of state**, and the wrong call is not immediately visible. Server data in the store, or ephemeral state lifted to global, both work fine at first and cost later.
- **Complex filter state in the URL needs serialisation discipline.** Multi-select facets produce long, ugly URLs, and the encoding must stay stable or old shared links break.
- **The cart badge is a deliberate exception** and exceptions invite more exceptions. It must stay reconciled from the server and must never be treated as authoritative.
- **URL state changes trigger navigation**, so filter interactions re-render server-side. That is correct for shareability and does mean a facet click is a round trip rather than an instant local update.

### Neutral / follow-on

- Store structure and URL-serialisation format are for [`Frontend Architecture.md`](../../03-frontend/Frontend%20Architecture.md).

## 6. Related Decisions

[ADR-0023](./ADR-0023-server-first-data-fetching.md) · [ADR-0019](./ADR-0019-nextjs-app-router-rendering-strategy.md) · [ADR-0025](./ADR-0025-httponly-cookie-session.md) · [ADR-0016](./ADR-0016-jwt-refresh-rotation-rbac.md)

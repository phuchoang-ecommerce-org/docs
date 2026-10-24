# Technical Decisions

Scope for this phase: identity, catalog, cart, inventory, ordering, shipping, and payment. The app uses the Next.js App Router. Its Home Page at `/` shows **Hello, World**; product browsing starts only when the visitor chooses it.

| Technology | Phase | Decision |
| --- | --- | --- |
| React and TypeScript | Now | Build typed components and use strict TypeScript checks. |
| Next.js | Now | Use App Router, Server Components for page reads, and Server Actions for writes. The Next.js server is the only caller of the backend API. |
| Radix UI Primitives | Now | Build project-owned interactive components with Radix behavior for focus, keyboard use, and open/close state. See [radix-ui-behavior.md](../Component-Design/radix-ui-behavior.md). |
| TailwindCSS | Now | Style those components with one Tailwind theme and the approved tokens in [Design-System.md](../UI-UX/Design-System.md). |
| Zod | Only when useful | Validate forms with rules that depend on more than one field. Simple fields can use native checks and server validation. |
| Inter and Lucide | Now | Use the chosen font and one outline icon set. |
| Framer Motion | Later | Consider it for the approved motion presets when CSS is not enough. It is not needed for the first UI build. |
| Zustand | Later | Consider it only for shared client UI state. Never store tokens or backend records in it. |
| TanStack Query | Later | Consider it for client-owned server reads such as frequent polling. Keep checkout, stock, orders, and payment on fresh server reads. |

Build simple controls with native HTML. Use Radix primitives only where they add needed behavior. The browser holds no access or refresh token. The Next.js server handles the session and sends authenticated requests to the backend. Route pages combine feature components; shared UI components do not fetch data or decide business rules. Add a deferred library only with a named use case and a later update to this decision.

For local development, [dev-account-login.md](../Component-Design/dev-account-login.md) defines one-click sign-in for backend seed accounts. It uses the normal identity API and is disabled in prod.

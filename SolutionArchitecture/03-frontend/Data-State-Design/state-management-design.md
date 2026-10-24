# State Management Design

Scope: identity, catalog, cart, inventory, ordering, shipping, and payment. Server data is owned by the backend; the browser does not become a second source of truth.

| State | Owner and place | Life cycle |
| --- | --- | --- |
| Server data | Backend; read by Next.js Server Components. Examples: products, cart, profile, checkout draft, orders, stock, payment, tracking. | Load on page entry. After a write, read the updated value. Public catalog data may be revalidated; private and purchase data is fetched fresh. |
| Shareable page state | URL. Examples: product list page number, sort, category, and selected variant. | Survives reload, links, and browser Back. Never put access or refresh tokens or private data in the URL. |
| Shared client UI state | None by default. Use a small React context only if several components need the same short success message. | Ends on reload or after the message closes. Never holds a role decision, token, cart, order, or payment record. |
| Local UI state | The component that uses it. Examples: form input, open dialog, and the visible checkout step. | Ends when the component closes or the route changes. Keep form input after a failed save. Resume checkout from the backend draft after reload. |

The cart count in the header comes from the latest server cart. After a cart change, refresh the cart and header together. Do not keep a separate long-lived cart copy in client state. After sign-out, clear private UI state and load private pages again only after sign-in.

In this phase, React local state and the URL are enough. Add Zustand later only if real cross-page UI state appears. Add TanStack Query later only for a client-owned read that needs it; do not use it as the cache for orders, payment, or stock.

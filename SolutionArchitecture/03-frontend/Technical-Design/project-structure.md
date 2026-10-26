# Project Structure

Organize source by feature. The seven current feature folders match the API domains: `identity`, `catalog`, `cart`, `inventory`, `ordering`, `shipping`, and `payment`. Create another feature folder only when that domain enters scope.

## Source tree

```text
src/
  app/
    layout.tsx                    # root shell
    globals.css                   # Tailwind entry
    (store)/
      page.tsx                    # /: Hello, World
      products/page.tsx
      products/[productId]/page.tsx
      categories/[categoryId]/page.tsx
      cart/page.tsx
      checkout/page.tsx
      checkout/payment/processing/page.tsx
    (auth)/
      login/page.tsx
      register/page.tsx
      verify-email/page.tsx
      forgot-password/page.tsx
      reset-password/page.tsx
    (account)/
      layout.tsx                  # check customer session
      account/profile/page.tsx
      account/security/page.tsx
      account/addresses/page.tsx
      account/wishlist/page.tsx
      account/orders/page.tsx
      account/orders/[orderId]/page.tsx
      account/orders/[orderId]/tracking/page.tsx
    (staff)/
      layout.tsx                  # check staff role
      staff/catalog/page.tsx
      staff/catalog/products/new/page.tsx
      staff/catalog/products/[productId]/edit/page.tsx
      staff/inventory/page.tsx
      staff/orders/page.tsx
      staff/orders/[orderId]/page.tsx
    api/                          # only needed route handlers
  components/
    ui/                           # stable wrappers over project-owned shadcn/ui Radix source
    layout/                       # PageShell, headers, menus, navigation
  features/
    identity/                     # includes dev-only sign-in panel and action
    catalog/
    cart/
    inventory/
    ordering/
    shipping/
    payment/
  lib/
    api/                          # one server-side backend client and error mapping
    session/                      # cookie, token refresh, CSRF
    format/                       # pure money and date formatting
  styles/
    tokens.css                    # the single Tailwind theme source
public/                           # static images and icons
```

Each route group name in parentheses is for source organization and is absent from the URL. Keep one root `layout.tsx`. Put `loading.tsx`, `error.tsx`, or `not-found.tsx` beside a route only where that route needs one. The full page list is in [sitemap.md](../UI-UX/sitemap.md).

## Inside a feature

```text
features/cart/
  components/                     # CartLine, CartSummary, WishlistItem
  hooks/                          # use-cart-line-editor.ts
  server/
    queries.ts                    # read current cart
    actions.ts                    # add, change, remove; use server
  schemas/                        # input validation when needed
  types.ts                        # cart view types
```

Use the same shape for other features, but create a subfolder only when it has a file. `catalog/url/` may own product list sort and page parameters. The other planned hooks live in `ordering/hooks/` and `payment/hooks/`, as listed in [component-design-guidelines.md](../Component-Design/component-design-guidelines.md).

For dev sign-in, put `dev-account-login-panel.tsx` and `dev-account-login-button.tsx` in `features/identity/components/`, and `dev-login.ts` in `features/identity/server/`. The `/login` route checks private dev config before rendering the panel. The server action checks it again before using a demo account. See [dev-account-login.md](../Component-Design/dev-account-login.md).

| Feature | Owns |
| --- | --- |
| `identity` | Sign-in, registration, profile, security, and addresses. |
| `catalog` | Products, categories, variants, and staff product editing. |
| `cart` | Guest and account carts, cart lines, and wishlist items. |
| `inventory` | Stock display, adjustment, and change history. |
| `ordering` | Checkout draft, order placement, orders, returns, and order status. |
| `shipping` | Delivery options, shipments, and tracking. |
| `payment` | Payment choice, status, retry, and refund. |

## Placement and import rules

1. `app/` owns routes and combines features. A page calls feature server functions, passes data as props, and keeps remote sections in separate loading and error boundaries. Account and staff layouts check access; `/checkout` checks the verified session and cart.
2. `features/<domain>/components/` owns domain display and forms. `features/<domain>/server/` owns reads and Server Actions. Mark server files as `server-only`; actions also validate input and check the session.
3. One feature never imports another feature. Checkout joins cart, ordering, identity, shipping, and payment in its `app/` route.
4. `components/ui/` owns general controls built from Radix or native HTML and styled with Tailwind. `components/layout/` owns the shared shell. They receive props and import no feature or API code. See [component-specification.md](../Component-Design/component-specification.md).
5. Only `lib/api/` makes backend HTTP calls. Only `lib/session/` reads the session cookie. Client Components call Server Actions or refresh the route; they never call the backend directly.
6. `app/api/` holds only a route handler that needs an HTTP endpoint, such as a payment return or signed catalog revalidation. It is not a second general API.

Use kebab-case file names, PascalCase component names, and `use...` hook names. Keep feature types and tests beside their feature. Use import checks for cross-feature imports and for server code in Client Components. Keep Tailwind tokens in one source, `styles/tokens.css`; do not add another theme in a feature.

Next.js [route groups](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups) and [Server/Client Component boundaries](https://nextjs.org/docs/app/getting-started/server-and-client-components) define the framework behavior used here.

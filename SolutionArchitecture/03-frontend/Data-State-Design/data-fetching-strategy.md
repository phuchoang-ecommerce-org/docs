# Data Fetching Strategy

The Next.js server is the only caller of the backend API. Server Components read data for pages. Client actions send writes through Server Actions or a Next.js route handler; browser code does not call the backend directly.

| Pages or data | Fetch and cache rule |
| --- | --- |
| `/` | Static "Hello, World" page. No API fetch. |
| `/products`, categories, product details | Cache public catalog data. Revalidate the affected product or category after a catalog change, with time-based revalidation as a backup. |
| Cart, wishlist, profile, addresses | Fetch per user on the server. Do not use a shared page cache. Refresh after a change. |
| Checkout, orders, payment, shipping, stock, staff pages | Fetch fresh on each visit or action. Do not cache the result in the browser or in a shared page cache. |

Catalog price and availability on a public page help the shopper browse; they are not a promise. The cart reads current values, and order placement checks price and stock again. A catalog change reaches the page through a signed internal revalidation request; staff writes do not clear the cache directly. The time-based rule covers a missed event. If the app runs on several Next.js servers, they need a shared cache so all servers see the same invalidation.

After a successful write, refresh only the views it changes: cart and header after a cart edit; checkout summary after address, shipping, or payment changes; order and tracking after an order action. The payment processing page checks fresh state until the result is known, then opens the order page. Do not auto-retry order placement or payment initiation after a timeout; first read their current state.

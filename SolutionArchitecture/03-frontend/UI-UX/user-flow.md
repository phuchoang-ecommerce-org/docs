# User Flow

## Shopper

1. `/` shows the Home Page with "Hello, World". Stay there until the visitor selects **View products**. Then open `/products` → a category page or `/products/[productId]` → choose a variant → **Add to cart** → `/cart`. A guest can do this without signing in. The cart shows current prices and stock; the shopper can change a quantity or remove a line. A changed or unavailable line stays visible until the shopper fixes it.
2. `/cart` → **Checkout**. If the cart is empty, offer a link to browse. If a guest selects Checkout, go to `/login` or `/register`, then return to `/cart` and continue. An unverified customer goes to `/verify-email` first. Login merges the guest cart with the saved cart and shows any changed or dropped items.
3. Register → check email → `/verify-email` → `/login`. If the link is old or invalid, ask for a new one. A forgotten password goes through `/forgot-password` → email link → `/reset-password` → `/login`.
   In dev only, `/login` also shows five seeded accounts. A developer selects one → normal sign-in → a safe requested page or that role's default page. The panel is absent in prod.
4. The account menu opens profile, security, addresses, wishlist, and orders. Saving a profile or address returns to the same page. The product page can save an item to `/account/wishlist` after sign-in. From the wishlist, a customer may move an available item to `/cart`; an item that cannot move stays saved. Sign out returns to `/`.
5. A verified customer with a cart whose items can all be bought enters `/checkout`. Steps on this page: delivery address and billing details → shipping option and fee → payment method → order summary → place order. Back moves to the earlier step; changing items returns to `/cart`. Any changed price, stock, shipping fee, or payment method needs a new summary before placement.
6. After placement, go to `/account/orders/[orderId]`. Online payment may use a provider step and `/checkout/payment/processing` while the result is checked. Cash on delivery stays **Pending Payment** until delivery. A failed payment offers **Retry payment** on the order page while the retry window is open. An unknown result stays **Pending Payment**; do not call it a failure.
7. `/account/orders` → order page → tracking page. The order page shows **Cancel** only before packing and **Request return** only after delivery and within the return window. Both actions return to the updated order page.

## Staff and warehouse

1. `/staff/catalog` → new or edit product page → save → catalog list. Category changes happen on the catalog page. Show publish actions only when the product can be published.
2. `/staff/inventory` → select SKU and warehouse → adjust stock with a reason → updated stock and change history on the same page.
3. `/staff/orders` → order page → allowed status action. A warehouse worker packs the order, then creates a shipment. The page shows the carrier and tracking reference after dispatch. Support handles returns and refunds on this page when its role allows them.

If a signed-in user opens a page outside their role, show an access message and a link to a page they can use. If a session ends, send the user to `/login` and return them to the requested page after sign-in.

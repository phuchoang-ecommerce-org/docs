# Sitemap

Scope: identity, catalog, cart, inventory, ordering, shipping, and payment. Routes are proposed Next.js pages. Search, promotions, reviews, and other modules are outside this map.

| Area | Route | Main purpose |
| --- | --- | --- |
| Store | `/` | Show the Home Page with "Hello, World" and a link to products. |
| Store | `/products` | Browse published products and choose a category or product. |
| Store | `/categories/[categoryId]` | Browse a category and its published products. |
| Store | `/products/[productId]` | View a product, choose a variant, and see price and availability. |
| Cart | `/cart` | View items and current prices; change quantities, remove items, and start checkout. |
| Account access | `/register` | Create an account. |
| Account access | `/verify-email` | Confirm an email address or ask for a new link. |
| Account access | `/login` | Sign in. |
| Account access | `/forgot-password` | Ask for a reset link. |
| Account access | `/reset-password` | Set a new password from the link. |
| My account | `/account/profile` | View or edit profile details. |
| My account | `/account/security` | Change password or end all sessions. |
| My account | `/account/addresses` | Add, edit, remove, or set a default address. |
| My account | `/account/wishlist` | View saved items and move them to the cart. |
| Checkout | `/checkout` | Enter delivery and billing details, choose shipping and payment, review, and place the order. |
| Checkout | `/checkout/payment/processing` | Wait for an online payment result, then open the order. |
| My orders | `/account/orders` | View order history. |
| My orders | `/account/orders/[orderId]` | View payment and order details; retry payment, cancel, or ask for a return when allowed. |
| My orders | `/account/orders/[orderId]/tracking` | View shipment status and tracking history. |
| Staff catalog | `/staff/catalog` | Manage categories and products. |
| Staff catalog | `/staff/catalog/products/new` | Create a product and its variants. |
| Staff catalog | `/staff/catalog/products/[productId]/edit` | Edit, publish, or unpublish a product. |
| Staff inventory | `/staff/inventory` | View stock by SKU and warehouse; adjust stock and view changes. |
| Staff orders | `/staff/orders` | Find orders for work or support. |
| Staff orders | `/staff/orders/[orderId]` | Advance an order, create a shipment, handle a return, or issue a refund when allowed. |

Guests can browse and use `/cart`. The wishlist and other customer pages need sign-in; checkout also needs a verified email and a non-empty cart. Staff pages show only actions allowed for the signed-in role.

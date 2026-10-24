# UI State Specification

| State | Display and action |
| --- | --- |
| Loading | Keep the page title and layout. Show short placeholders for lists and details; show progress on the button that was pressed. Disable that button until the result is known. |
| Empty | Say what is missing and give one next step: "Your cart is empty" → view products; "No saved items" → view products; "No orders yet" → view products. Empty data is not an error. |
| Field error | Put a short message beside the field, keep entered values, and focus the first invalid field. Never show a password value in an error. |
| Page error | Show what could not load and a **Try again** action. Keep any other loaded part of the page usable. For a missing or private order, show the same "Order not found" page. |
| Success | Show a short confirmation near the action and the saved value or new status. After order placement, show the order number and current payment state on the order page. |
| No access | Show a clear access message and a safe link. A guest goes to sign-in; an unverified customer gets **Resend email** before checkout. |

## Rules for key pages

| Page or action | Special states |
| --- | --- |
| Product and category | Show only published products. If stock data is late, say "Availability unknown"; do not show a stock count to shoppers. A missing product or category gets a useful link back to browsing. |
| Add to cart | Show the updated cart count and total after success. If the quantity is too high, keep the cart unchanged, show the available amount, and offer that amount. An out-of-stock item cannot be added; offer **Save item** after sign-in. |
| Cart | Show current prices and mark each changed price, short line, or unavailable item. Let the shopper fix or remove affected lines; never remove them without notice. If a quantity change fails, restore the old value and explain why. If the cart expired, say so and show the empty state. Disable **Checkout** while the cart is empty or has a line that cannot be bought. |
| Cart after sign-in | Show the merged cart and list any reduced or dropped items. If merge fails, keep sign-in successful and explain that the guest items were not carried over yet. |
| Wishlist | An empty list offers **Browse products**. An unavailable item stays visible. If moving an item to the cart fails, keep it saved and show why. |
| Sign-up and password reset | After a request, use a neutral message such as "If this email has an account, we will send a link." For an expired link, explain it and offer a new one. After a password reset, show **Go to sign-in**. |
| Dev account sign-in | On `/login` in dev, show each account's email, role, and sign-in button. While one is sending, disable repeat clicks. On failure, keep the list and show a short error; on `429`, show when to try again. Never show a password. In prod, show no dev panel. |
| Checkout | No address → show address entry. No shipping option, fee, or payment method → explain the issue and block placement. No delivery estimate → say it is not available; allow the order to continue. A price, fee, or stock change → show the change and require a new review. |
| Place order | While sending, disable repeat clicks. After a slow reply, check the order state before offering another action; never imply a second order was made. If stock is short, show the affected items and stop placement. |
| Payment | **Paid** → show payment success. **Pending Payment** → show that the result is still being checked, or that cash is due on delivery. The processing page links to the order if the wait is long. **Payment Failed** → show the reason when available and **Retry payment** if allowed. Never label a timeout as failed. |
| Order and return | Show only actions allowed by the current order state. After cancellation, show **Cancelled** and any refund as pending until it succeeds. After a return request, show **Request received**; show **Refunded** only after the refund succeeds. |
| Tracking | No shipment yet → show the order state. No carrier update yet → say tracking has not started. Old or missing updates → show the last known event and its time, marked as not current. Show each shipment on its own. |
| Staff changes | While saving a product, stock change, order status, shipment, or refund, block a second submit. On failure, keep entered data and show a retry action. After a stock change, show the new available and reserved amounts; after a refund, show its recorded status. |

Use text with color for every status. All messages must be readable with a keyboard and screen reader. Move focus to a new page error or success message after a major action.

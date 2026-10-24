# Error Handling Strategy

Scope: identity, catalog, cart, inventory, ordering, shipping, and payment.

The Next.js server reads API errors as `application/problem+json`. Match the full `code`, then show short UI text. Do not show the API `title` or `detail` to shoppers. Keep `correlationId` for support. Show field errors beside their fields and keep the entered values.

| API result | UI response |
| --- | --- |
| `400` / `ECP-GEN-4000` | Show each field error. Focus the first field to fix. |
| `401` | Refresh the session once on the server. If it fails, clear the session and go to `/login`, keeping a safe return path. On the login form, show one general sign-in error. |
| `403` | Show **Access denied**. If the signed-in customer must verify their email before checkout, link to `/verify-email`. |
| `404` | Show the same **Not found** page for a missing item and an item the user cannot access. |
| `ECP-CRT-4090` | Keep the cart quantity as it was. Show the available amount and let the user choose it. |
| `ECP-INV-4091` | Show the items that sold out. Stop order placement and return to `/cart` to fix them. |
| `ECP-ORD-4091` | Reload the order and show its new state and allowed actions. |
| `ECP-ORD-4001` or `ECP-ORD-4090` | Stop the action and show a general error. Log the request as a client fault; do not make a new order or payment attempt. |
| `ECP-PAY-4090` | Show **Payment is being checked**. Do not start another payment. |
| `422` | Show what must change. An empty or unusable cart returns to `/cart`; a refund above the paid amount stays on the staff form. Do not retry the same request. |
| `429` | Show when the user may try again, using `Retry-After`. Disable the action until then. |
| `500` or `503` | Show a short error and **Try again** for safe reads. Keep form values. Do not auto-retry order placement or payment. |

If an order or payment request times out, its result is **unknown**. Read the current order or payment state before showing success, failure, or a retry action. A retry of order placement or payment initiation must use the same `Idempotency-Key` and request body. An unavailable section shows its own error without hiding the rest of the page.

Unexpected codes get a general message and are logged with the correlation ID. Never put passwords, tokens, or payment details in UI logs.

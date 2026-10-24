# Form Specification

Check simple field format when the user leaves a field, and clear its error as they correct it. On submit, the Next.js server checks the full form before calling the backend. The backend makes the final decision for stock, price, delivery, payment, and permission. Use native field rules for simple forms; use a shared Zod schema when fields depend on each other.

| Form | Key checks |
| --- | --- |
| Sign-in, registration, password reset | Required email and password, email shape, and the backend password policy. Use a general message for unknown email or wrong password. |
| Profile and address | Required fields and address shape for the destination. Keep the old email active until a new one is verified. |
| Cart quantity | Whole number above zero. Backend checks current stock; zero means remove. |
| Checkout | Required shipping address, billing details, shipping option, and eligible payment method. Show the server's current fee and total before placement. |
| Product and inventory staff forms | Product needs a name. A new variant needs a unique SKU and a price. Stock change needs a non-zero whole number, reason code, and reason; backend checks available stock. |
| Shipment, return, and refund | Shipment needs an order; a manual carrier choice also needs a reason. Return needs selected lines and a reason. Refund needs a positive amount and a reason. Backend checks order state, return time, and the captured amount. |

Dev account buttons are not a password form. They send only an account key; the server action checks that key against its fixed dev allowlist before it signs in.

On submit, show a pending state and block a second click. For `ECP-GEN-4000`, map each `errors[].field` to its field; put other errors above the form. Keep entered values after failure, focus the first error, and link error text to the field for screen readers. Do not keep passwords or payment details after success or in logs.

Changing checkout inputs asks the server for a new summary. Order placement and payment initiation use an `Idempotency-Key`; after a timeout, check the current order or payment state before a retry. Never show success before the server confirms it.

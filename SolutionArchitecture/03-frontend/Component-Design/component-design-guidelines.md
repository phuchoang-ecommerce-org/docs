# Component Design Guidelines

Start with the page and a small feature component. Extract a shared component when two places need the same behavior, or one piece has a clear task and its own accessibility or error states. Keep domain rules in the feature; keep color, focus, and spacing in shared UI pieces.

## Custom hooks for this phase

These are the custom hooks to create. Each stays in its feature and runs only in a Client Component.

| Hook and file | Used by | Responsibility |
| --- | --- | --- |
| `useCartLineEditor` — `features/cart/hooks/use-cart-line-editor.ts` | `CartLine` | Hold a draft quantity and pending state. Call the passed change action; on failure, restore the server quantity and show the error. Sync when a new cart line arrives. |
| `useCheckoutStep` — `features/ordering/hooks/use-checkout-step.ts` | `CheckoutSteps` | Hold the visible step and Back/Next actions. After reload, start at the first unfinished step from the server checkout draft. Never decide price or eligibility. |
| `usePaymentStatusRefresh` — `features/payment/hooks/use-payment-status-refresh.ts` | `PaymentProcessingStatus` | While payment is pending, call `router.refresh()` on a timer. Stop when the result is known or the component closes. Do not start a new payment. |

Each hook receives data or actions through arguments; none calls the backend API, reads tokens, or stores an order or payment record. Forms use local state and server action results. Radix manages dialog behavior. Add another hook only when browser behavior is reused or needs its own setup and cleanup. Zustand and TanStack Query remain later options.

`DevAccountLoginButton` needs a pending state and a server action result, not a new custom hook. Keep its credential lookup in the identity server layer. See [dev-account-login.md](./dev-account-login.md).

Use clear props and `on...` events. Keep Client Components around the interactive part only; pages and display components stay on the server where possible.

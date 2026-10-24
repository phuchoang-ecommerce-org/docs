# Component Inventory

Scope: identity, catalog, cart, inventory, ordering, shipping, and payment. A page loads data and puts these smaller parts together.

| Area | Components to extract | Main use |
| --- | --- | --- |
| Layout | `StoreHeader`, `AccountMenu`, `StaffNav` | Navigation, sign-in link, and cart count. |
| Identity | `LoginForm`, `RegisterForm`, `PasswordForm`, `ProfileForm`, `AddressForm`; dev only: `DevAccountLoginPanel`, `DevAccountLoginButton` | One form per clear user task; one-click sign-in for seeded dev accounts. |
| Catalog | `CategoryTree`, `ProductGrid`, `ProductCard`, `VariantPicker`, `PriceDisplay`, `AvailabilityLabel`, `ProductEditor` | Reuse product display and variant choice across lists and details. |
| Cart | `CartLine`, `CartSummary`, `WishlistItem` | Edit a line, show the current total, and manage saved items. |
| Checkout | `CheckoutSteps`, `AddressPicker`, `ShippingOptionPicker`, `PaymentMethodPicker`, `OrderSummary`, `PlaceOrderButton` | Keep each step small; show the final server total. |
| Orders and shipping | `OrderCard`, `OrderStatus`, `TrackingTimeline`, `ShipmentForm`, `ReturnRequestForm` | Show order progress and allowed actions. |
| Payment | `PaymentStatePanel`, `PaymentProcessingStatus`, `RetryPaymentButton`, `RefundForm` | Show payment state, refresh a pending result, and collect a staff refund request. |
| Inventory | `StockTable`, `StockAdjustmentForm` | Show stock by SKU and warehouse; record a change with a reason. |

Use the shared UI pieces in [component-specification.md](./component-specification.md) inside these feature components. Keep the `/` Home Page text, **Hello, World**, in the page itself; it does not need a special component. Extract a new component when it is reused, has its own clear action or state, or needs one place for accessibility rules.

The dev-only components follow [dev-account-login.md](./dev-account-login.md). They appear on `/login` only when the server enables them.

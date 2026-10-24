# Component Responsibility

`S` means a Server Component that displays props. `C` means a Client Component for user input or browser behavior. Neither type calls the backend API directly.

| Layer and folder | Components | Data responsibility |
| --- | --- | --- |
| Route: `app/` | Home, product, account, checkout, order, and staff page files | Call feature server functions and pass the result down. The `/` page renders **Hello, World** without a fetch. |
| Shared layout: `components/layout/` | `PageShell` (S), `Breadcrumbs` (S), `StoreHeader` (S), `AccountMenu` (C), `StaffNav` (S) | Receive title, links, user display, and cart count from the route. No fetch. |
| Shared display UI: `components/ui/` | `EmptyState` (S), `LoadingSkeleton` (S), `Card` (S), `Badge` (S), `Table` (S) | Render props. No feature rule or fetch. |
| Shared interactive UI: `components/ui/` | `Button` (C), `TextField` (C), `SelectField` (C), `Dialog` (C), `AlertDialog` (C), `StatusMessage` (C), `ErrorState` (C), `Pagination` (C) | Receive props and emit UI events. No feature rule or fetch. |
| Identity: `features/identity/components/` | `LoginForm` (C), `RegisterForm` (C), `PasswordForm` (C), `ProfileForm` (C), `AddressForm` (C) | Hold form input and send submit intent to a server action. |
| Identity dev login: `features/identity/components/` | `DevAccountLoginPanel` (S), `DevAccountLoginButton` (C) | Receive safe account labels from `/login`. The button sends an account key to a server action. Neither component reads the demo password or calls the API. |
| Catalog: `features/catalog/components/` | `CategoryTree` (S), `ProductGrid` (S), `ProductCard` (S), `PriceDisplay` (S), `AvailabilityLabel` (S), `VariantPicker` (C), `ProductEditor` (C) | Display server product data; picker and editor hold only local input. |
| Cart: `features/cart/components/` | `CartSummary` (S), `CartLine` (C), `WishlistItem` (C) | Display the current cart; line and saved-item actions send intent to the server. |
| Ordering: `features/ordering/components/` | `OrderCard` (S), `OrderStatus` (S), `OrderSummary` (S), `CheckoutSteps` (C), `AddressPicker` (C), `ShippingOptionPicker` (C), `PlaceOrderButton` (C), `ReturnRequestForm` (C) | Receive fresh order or checkout data. Only interactive pieces hold temporary UI state. |
| Payment: `features/payment/components/` | `PaymentStatePanel` (S), `PaymentMethodPicker` (C), `PaymentProcessingStatus` (C), `RetryPaymentButton` (C), `RefundForm` (C) | Receive fresh payment state. The processing piece asks the route to refresh while pending. |
| Shipping: `features/shipping/components/` | `TrackingTimeline` (S), `ShipmentForm` (C) | Display shipment events or submit a staff shipment request. |
| Inventory: `features/inventory/components/` | `StockTable` (S), `StockAdjustmentForm` (C) | Display stock or submit a change with a reason. |

`features/<domain>/server/` holds server-only reads and actions, not React components. It calls the shared API client in `lib/api` and reads the session through `lib/session`. A Client Component calls a Server Action or refreshes its route; it never fetches the backend itself. After a write, the route reads fresh data. Keep stock, order, and payment records out of browser caches. Feature folders do not import from each other; the route composes them.

The dev login gate and account allowlist live in `features/identity/server/dev-login.ts`, not in a shared component. See [dev-account-login.md](./dev-account-login.md).

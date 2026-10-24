# Component API

Use typed props. Events name the user's intent with `on...`. A parent handles the event and any server action. Components never receive a token or a raw API error.

| Component | Main props | Event or action |
| --- | --- | --- |
| `PageShell` | `title`, `children`, `actions?` | None |
| `Breadcrumbs` | `items: { label, href }[]` | Link navigation |
| `StoreHeader` | `cartCount`, `navLinks`, `accountLabel?` | Link navigation |
| `AccountMenu` | `displayName`, `links` | `onSignOut()` |
| `StaffNav` | `links` | Link navigation |
| `DevAccountLoginPanel` | `accounts: { key, email, role }[]`, `returnTo?` | Renders `DevAccountLoginButton` for each allowed account. |
| `DevAccountLoginButton` | `accountKey`, `label`, `pending?` | `onSelect(accountKey)`; sends only the key, never credentials. |
| `Button` | `variant`, `type`, `disabled`, `loading`, `children` | `onClick?()`; form buttons may use `type="submit"`. |
| `TextField` | `name`, `label`, `type`, `value`, `required?`, `hint?`, `error?`, `autoComplete?` | `onChange(value)`, `onBlur?()` |
| `SelectField` | `name`, `label`, `value`, `options`, `error?` | `onChange(value)` |
| `Dialog` | `open`, `title`, `children` | `onOpenChange(open)` |
| `AlertDialog` | `open`, `title`, `message`, `pending?` | `onConfirm()`, `onCancel()` |
| `StatusMessage` | `kind`, `message` | `onDismiss?()` |
| `EmptyState` / `ErrorState` | `title`, `message`, `actionLabel?` | `onAction?()` or an `actionHref` link |
| `LoadingSkeleton` | `shape`, `count?` | None |
| `Badge` | `label`, `kind?` | None |
| `Card` | `children`, `title?` | None |
| `Table` | `children`, `caption` | None |
| `Pagination` | `hasNext`, `hasPrevious`, `pageLabel` | `onNext()`, `onPrevious()` |
| `ProductGrid` | `products` | Product links |
| `VariantPicker` | `variants`, `value`, `disabled?` | `onChange(variantId)` |
| `CartLine` | `line`, `pending?`, `error?` | `onQuantityChange(quantity)` returns a mapped success/error result; `onRemove()` |
| `AddressPicker` | `addresses`, `selectedId` | `onSelect(addressId)`, `onAdd()` |
| `ShippingOptionPicker` | `options`, `selectedId` | `onSelect(optionId)` |
| `PaymentMethodPicker` | `methods`, `selectedType` | `onSelect(methodType)` |
| `OrderSummary` | `summary`, `children?` | None; may show `PlaceOrderButton` as a child |
| `PlaceOrderButton` | `canPlace`, `pending?` | `onPlaceOrder()` |
| `PaymentStatePanel` | `state`, `lastCheckedAt?`, `children?` | None; may show `RetryPaymentButton` as a child |
| `RetryPaymentButton` | `canRetry`, `pending?` | `onRetry()` |
| `PaymentProcessingStatus` | `state`, `orderHref` | No event; uses `usePaymentStatusRefresh` and an order link |
| `TrackingTimeline` | `shipments` | None |
| `StockAdjustmentForm` | `stockItemId`, `sku`, `warehouseId`, `pending?`, `errors?` | `onSubmit({ delta, reasonCode, reason })` |
| `ReturnRequestForm` | `orderLines`, `pending?`, `errors?` | `onSubmit({ lines, reason })` |
| `RefundForm` | `maxRefundableAmount`, `pending?`, `errors?` | `onSubmit({ amount, reason })` |

Use `"primary" | "secondary" | "quiet"` for button variants and `"info" | "success" | "error"` for message kinds. IDs and text values are strings; quantities are numbers. Most callbacks return `void` or `Promise<void>`; cart editing returns a typed result so its hook can restore a failed edit. `errors` is a field-to-message map, not a raw API response. Other data uses types from its feature. The server provides formatted money and status text; shared components do not calculate totals. Do not add an event prop to a read-only component.

The dev login components belong to `features/identity`, not `components/ui` or `components/layout`. Their account list contains public labels only; the server action resolves credentials. See [dev-account-login.md](./dev-account-login.md).
